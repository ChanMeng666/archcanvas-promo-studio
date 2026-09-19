#!/usr/bin/env node
/**
 * sync-replica.mjs — copy the studio replica ONE WAY out of the product repo.
 *
 * The replica is a coded picture of ArchCanvas's studio. Its source of truth is
 * `archcanvas/src/components/marketing/studio-replica/`, where it sits next to
 * the real strings and the real tokens and is covered by the product's own
 * copy tripwires. This script COPIES it here, never moves it, and **nothing in
 * this repo may edit the copy** — a fix goes upstream and comes back through a
 * re-sync. `src/data/replica-lock.json` is the sha256 ledger that makes that
 * rule enforceable rather than remembered.
 *
 * What it stages:
 *
 *   src/components/marketing/studio-replica/**  ->  src/replica/**
 *   src/lib/marketing/studioDemo.types.ts       ->  src/replica-data/studioDemo.types.ts
 *   public/showcase/studio-demo/drawlist.json   ->  src/data/drawlist.json
 *   public/showcase/renders/<listed>.webp       ->  public/renders/<name>.webp
 *
 * and then writes `src/replica-data/index.ts`, the one piece of glue this repo
 * owns: the replica declares its own `VariantId`/`DemoInputs` in its `types.ts`,
 * while the BAKED data is typed by `studioDemo.types.ts`, and something has to
 * join the drawlist JSON to a type. It is generated rather than hand-written so
 * it cannot drift from what the sync actually landed.
 *
 * Usage:
 *   node scripts/sync-replica.mjs                       sibling ../archcanvas
 *   ARCHCANVAS_REPO=<path> node scripts/sync-replica.mjs
 *   node scripts/sync-replica.mjs --from <path>         a worktree or any checkout
 *   node scripts/sync-replica.mjs --check               hash-only; exit 1 on drift
 *
 * ── The failure this script refuses to have ────────────────────────────────
 *
 * The sibling film's notes record it four times in one day: *a gate whose input
 * set can go empty reports success by doing nothing.* A copy loop over a
 * directory that is not there copies nothing, writes an empty ledger, prints a
 * tidy zero and exits 0 — and the next person believes the replica is synced.
 * So **every source path below is REQUIRED**, a missing one is fatal, and the
 * lock file is never written from an empty set.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const LOCK = path.join(ROOT, "src", "data", "replica-lock.json");

const argv = process.argv.slice(2);
const CHECK = argv.includes("--check");
const fromFlag = (() => {
  const i = argv.indexOf("--from");
  if (i === -1) return null;
  const v = argv[i + 1];
  if (!v || v.startsWith("--")) die("--from needs a path: --from D:\\path\\to\\checkout");
  return v;
})();

/** Repo-relative, forward slashes. Stable in the lock diff on every platform. */
const slash = (p) => p.split(path.sep).join("/");

function die(message) {
  console.error(`\nsync-replica: ${message}\n`);
  process.exit(1);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * The source checkout
 * ───────────────────────────────────────────────────────────────────────── */

/**
 * `--from` wins, then `ARCHCANVAS_REPO`, then the sibling `../archcanvas`.
 *
 * An explicitly named checkout that does not validate is FATAL and never falls
 * through to the sibling. Someone who named a worktree would otherwise get a
 * film quietly cut from `main` — which, while WP-1 and WP-2 are in flight, is
 * precisely the checkout that does NOT have the replica in it.
 */
const MARKER = path.join("src", "app", "globals.css");
const isProductRepo = (dir) => fs.existsSync(path.join(dir, MARKER));

function resolveSource() {
  if (fromFlag) {
    const dir = path.resolve(fromFlag);
    if (isProductRepo(dir)) return dir;
    die(
      [
        `--from points at ${slash(dir)}, which is not an archcanvas checkout.`,
        `It must contain ${slash(MARKER)}.`,
        "",
        "Not falling back to ../archcanvas: you named a checkout, and syncing from a",
        "different one is worse than not syncing at all.",
      ].join("\n"),
    );
  }

  const override = process.env.ARCHCANVAS_REPO;
  if (override) {
    const dir = path.resolve(override);
    if (isProductRepo(dir)) return dir;
    die(`ARCHCANVAS_REPO is set to ${slash(dir)}, which is not an archcanvas checkout (no ${slash(MARKER)}).`);
  }

  const sibling = path.resolve(ROOT, "..", "archcanvas");
  if (isProductRepo(sibling)) return sibling;

  die(
    [
      "could not find the archcanvas checkout.",
      "",
      `Looked in ${slash(sibling)} for ${slash(MARKER)} and did not find it.`,
      "Set ARCHCANVAS_REPO, or pass --from <path>. There is no fallback and no stub:",
      "the replica IS the picture, so a missing source is a missing film.",
    ].join("\n"),
  );
}

const SOURCE = resolveSource();
const from = (...parts) => path.join(SOURCE, ...parts);

/* ─────────────────────────────────────────────────────────────────────────────
 * The manifest
 * ───────────────────────────────────────────────────────────────────────── */

/** The replica's own directory. Everything in it, minus the exclusions. */
const REPLICA_SRC = path.join("src", "components", "marketing", "studio-replica");
const REPLICA_DEST = path.join("src", "replica");

/**
 * `CLAUDE.md` is INCLUDED on purpose: it is the replica's own law (pure render,
 * no wall-clock, relative imports only) and the copy is useless without it.
 * Tests are excluded — they belong to the product's vitest projects and would
 * not run here anyway.
 */
const REPLICA_EXCLUDE = [/\.test\.tsx?$/, /\.spec\.tsx?$/, /^__tests__\//, /^\.DS_Store$/];

/** Single files. Each one is required; a missing one is fatal. */
const FILES = [
  {
    src: path.join("src", "lib", "marketing", "studioDemo.types.ts"),
    dest: path.join("src", "replica-data", "studioDemo.types.ts"),
    role: "types",
  },
  {
    src: path.join("public", "showcase", "studio-demo", "drawlist.json"),
    dest: path.join("src", "data", "drawlist.json"),
    role: "drawlist",
  },
];

/**
 * The renderings. Pre-existing product output, reused rather than regenerated —
 * `two-storey-townhouse` is the home page's and the film's main plan, and
 * `family-house` is the 120s cut's second brief.
 *
 * AI renderings, so every one of them carries the product's own "AI-generated"
 * pill wherever it appears on screen (EU AI Act Art 50). That is a rule for the
 * scenes, not for this script, but it is recorded here because this is where
 * the files enter the repo.
 */
const RENDERS = [
  "two-storey-townhouse-aerial.webp",
  "two-storey-townhouse-exterior.webp",
  "two-storey-townhouse-interior.webp",
  "family-house-aerial.webp",
  "family-house-exterior.webp",
  "family-house-interior.webp",
];

/* ─────────────────────────────────────────────────────────────────────────────
 * Copying
 * ───────────────────────────────────────────────────────────────────────── */

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/** Extensions copied byte-for-byte. Everything else is normalised to LF. */
const BINARY = new Set([".webp", ".png", ".jpg", ".jpeg", ".gif", ".woff", ".woff2", ".ttf", ".otf", ".mp3", ".mp4"]);

const isBinary = (file) => BINARY.has(path.extname(file).toLowerCase());

/**
 * Read a source file the way it will be stored.
 *
 * Text is normalised to LF here, not left to `.gitattributes`. The lock's
 * sha256 is computed over these exact bytes, so a checkout with `autocrlf=true`
 * and one without must produce the same hash or `verify:replica` would report
 * drift on a machine difference. (The product repo's own lesson: measure with
 * `git cat-file`, never with whatever the working tree happens to hold.)
 */
function readNormalised(abs) {
  const raw = fs.readFileSync(abs);
  if (isBinary(abs)) return raw;
  return Buffer.from(raw.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
}

const walk = (dir, base = dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = slash(path.relative(base, abs));
    if (entry.isDirectory()) walk(abs, base, out);
    else out.push(rel);
  }
  return out;
};

const stats = { copied: 0, unchanged: 0, bytes: 0 };

/**
 * PLANNED FIRST, WRITTEN SECOND — and that ordering is a bug fix, not a style.
 *
 * The first version staged each file as it found it, and the first real run
 * proved why that is wrong: pointed at a checkout where the replica existed but
 * `studioDemo.types.ts` did not, it copied six replica files, THEN died on the
 * missing one, and exited 1 having left a partial copy on disk with no lock to
 * describe it. The next sync then reported those six as "unchanged", which is
 * the half-synced state this whole ledger exists to make impossible.
 *
 * So: every source is read and hashed before a single byte is written. A missing
 * source now fails with nothing touched.
 */
const planned = [];
/** Every staged file, as it will appear in the lock. */
const rows = [];

function plan({ srcAbs, destRel, role, sourceRel }) {
  if (!fs.existsSync(srcAbs)) {
    die(
      `required source file is missing: ${slash(path.relative(SOURCE, srcAbs))} (under ${slash(SOURCE)})\n` +
        "  Nothing has been written — the whole set is read before anything is copied.",
    );
  }
  const bytes = readNormalised(srcAbs);
  planned.push({ destRel, bytes, sha256: sha256(bytes), role, sourceRel });
}

/** Write what was planned, skipping files whose bytes are already identical. */
function commitPlan() {
  for (const p of planned) {
    const destAbs = path.join(ROOT, p.destRel);
    const same =
      fs.existsSync(destAbs) &&
      fs.statSync(destAbs).size === p.bytes.length &&
      sha256(readNormalised(destAbs)) === p.sha256;

    if (same) {
      stats.unchanged += 1;
    } else if (!CHECK) {
      fs.mkdirSync(path.dirname(destAbs), { recursive: true });
      fs.writeFileSync(destAbs, p.bytes);
      stats.copied += 1;
    }

    stats.bytes += p.bytes.length;
    rows.push({ path: slash(p.destRel), bytes: p.bytes.length, sha256: p.sha256, role: p.role, source: p.sourceRel });
  }
}

/* the replica directory ---------------------------------------------------- */

const replicaSrcAbs = from(REPLICA_SRC);
if (!fs.existsSync(replicaSrcAbs)) {
  die(
    [
      `the replica directory is not in this checkout:`,
      `  ${slash(path.join(SOURCE, REPLICA_SRC))}`,
      "",
      "That directory is WP-2's deliverable and lands on the product repo's",
      "`wp/replica-core` branch. Until it is merged, sync from the worktree that has it:",
      "",
      "  node scripts/sync-replica.mjs --from D:\\github_repository\\archcanvas\\.claude\\worktrees\\wp2",
      "",
      "Refusing to write an empty lock: a sync that copies nothing and exits 0 is how",
      "a repo ends up believing it is synced when it holds no replica at all.",
    ].join("\n"),
  );
}

const replicaFiles = walk(replicaSrcAbs).filter(
  (rel) => !REPLICA_EXCLUDE.some((re) => re.test(rel) || re.test(path.basename(rel))),
);

if (replicaFiles.length === 0) {
  die(`${slash(path.join(SOURCE, REPLICA_SRC))} exists but holds no files after exclusions — nothing to sync.`);
}

for (const rel of replicaFiles) {
  plan({
    srcAbs: path.join(replicaSrcAbs, rel),
    destRel: path.join(REPLICA_DEST, rel),
    role: "replica",
    sourceRel: slash(path.join(REPLICA_SRC, rel)),
  });
}

/* the single files --------------------------------------------------------- */

for (const f of FILES) {
  plan({ srcAbs: from(f.src), destRel: f.dest, role: f.role, sourceRel: slash(f.src) });
}

/* the renderings ----------------------------------------------------------- */

for (const name of RENDERS) {
  plan({
    srcAbs: from("public", "showcase", "renders", name),
    destRel: path.join("public", "renders", name),
    role: "render",
    sourceRel: slash(path.join("public", "showcase", "renders", name)),
  });
}

/* every source read and hashed — only now is anything written --------------- */

commitPlan();

/* ─────────────────────────────────────────────────────────────────────────────
 * The generated seam
 * ───────────────────────────────────────────────────────────────────────── */

/**
 * `src/replica-data/index.ts` — the only file this repo owns on the boundary.
 *
 * `typeof drawlist` rather than a hand-named type: `resolveJsonModule` infers
 * the drawlist's real shape from the bytes that were actually staged, so this
 * cannot claim a structure the data does not have. WP-7 and WP-9 narrow against
 * the named types re-exported from `studioDemo.types.ts`.
 */
const SEAM_REL = path.join("src", "replica-data", "index.ts");
const SEAM = `/**
 * GENERATED BY scripts/sync-replica.mjs — do not edit, and do not delete.
 *
 * The seam between the replica's own types (\`src/replica/types.ts\`, which
 * declares its \`VariantId\` and \`DemoInputs\`) and the BAKED data, whose types
 * live upstream in \`src/lib/marketing/studioDemo.types.ts\`. Both arrive by
 * sync; this file is the join, and it is generated so it cannot drift from what
 * the sync actually landed.
 */

import drawlist from "../data/drawlist.json";

export * from "./studioDemo.types";

/** The pre-baked draw list: the compiled plan, flattened at build time. */
export const DRAWLIST = drawlist;

/** The drawlist's real shape, inferred from the staged bytes. */
export type Drawlist = typeof drawlist;
`;

if (!CHECK) {
  fs.mkdirSync(path.join(ROOT, "src", "replica-data"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, SEAM_REL), SEAM, { encoding: "utf8" });
}
rows.push({
  path: slash(SEAM_REL),
  bytes: Buffer.byteLength(SEAM, "utf8"),
  sha256: sha256(Buffer.from(SEAM, "utf8")),
  role: "seam",
  source: null,
});

/* ─────────────────────────────────────────────────────────────────────────────
 * The lock
 * ───────────────────────────────────────────────────────────────────────── */

const git = (...args) => {
  try {
    return execFileSync("git", ["-C", SOURCE, ...args], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
};

rows.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

const lock = {
  $comment: [
    "WRITTEN BY scripts/sync-replica.mjs — NEVER HAND-EDIT.",
    "",
    "The one-way boundary between this film and the product. Every row is a file",
    "COPIED out of the archcanvas checkout named below, with the bytes it was copied",
    "as (text normalised to LF) and their sha256.",
    "",
    "src/replica/** IS NOT EDITABLE HERE. Fix it upstream and re-sync. `npm run",
    "verify:replica` re-hashes every row and fails on any difference, so an edit made",
    "here shows up as drift rather than as a divergence nobody notices.",
    "",
    "Regenerate with `npm run sync:replica`. Check without writing: `--check`.",
  ].join("\n"),
  generatedBy: "scripts/sync-replica.mjs",
  sourceRepo: slash(SOURCE),
  sourceCommit: git("rev-parse", "HEAD"),
  sourceBranch: git("rev-parse", "--abbrev-ref", "HEAD"),
  sourceDirty: git("status", "--porcelain") ? true : false,
  totals: {
    files: rows.length,
    bytes: rows.reduce((n, r) => n + r.bytes, 0),
    byRole: rows.reduce((acc, r) => {
      acc[r.role] = (acc[r.role] ?? 0) + 1;
      return acc;
    }, {}),
  },
  files: rows,
};

// Belt and braces on the empty-set trap: the manifest above already makes every
// path required, but an exclusion list that grows teeth could still empty this.
if (rows.length === 0) die("refusing to write an empty lock — nothing was staged.");

const json = `${JSON.stringify(lock, null, 2)}\n`;

if (CHECK) {
  const before = fs.existsSync(LOCK) ? fs.readFileSync(LOCK, "utf8") : null;
  if (before === null) {
    console.error("\nsync-replica --check: src/data/replica-lock.json does not exist. Run `npm run sync:replica`.\n");
    process.exit(1);
  }
  if (before !== json) {
    console.error(
      "\nsync-replica --check: the source has moved on from the committed lock.\n" +
        `  source ${slash(SOURCE)} @ ${lock.sourceCommit ?? "unknown"}${lock.sourceDirty ? " (dirty)" : ""}\n` +
        "  Run `npm run sync:replica` and commit the result.\n",
    );
    process.exit(1);
  }
  console.log(`\nsync-replica --check: clean. ${rows.length} file(s) match the lock.\n`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(LOCK), { recursive: true });
fs.writeFileSync(LOCK, json, { encoding: "utf8" });

/* ─────────────────────────────────────────────────────────────────────────────
 * Report
 * ───────────────────────────────────────────────────────────────────────── */

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

console.log(`\nsync-replica: source = ${slash(SOURCE)}`);
console.log(`  commit ${lock.sourceCommit ?? "unknown"} on ${lock.sourceBranch ?? "unknown"}${lock.sourceDirty ? "  (WORKING TREE DIRTY)" : ""}`);
for (const [role, n] of Object.entries(lock.totals.byRole)) {
  const bytes = rows.filter((r) => r.role === role).reduce((a, r) => a + r.bytes, 0);
  console.log(`  ${role.padEnd(9)} ${String(n).padStart(3)} file(s)  ${kb(bytes).padStart(10)}`);
}
console.log(`  ${"TOTAL".padEnd(9)} ${String(rows.length).padStart(3)} file(s)  ${kb(lock.totals.bytes).padStart(10)}   ${stats.copied} written, ${stats.unchanged} unchanged`);
console.log(`  lock      src/data/replica-lock.json (${json.length} bytes)`);
if (lock.sourceDirty) {
  console.log("\n  ! the source checkout has uncommitted changes, so sourceCommit does not fully");
  console.log("    describe what was copied. Commit upstream before syncing for a release.");
}
console.log("\n  next: npm run verify:replica\n");
