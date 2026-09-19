#!/usr/bin/env node
/**
 * verify-replica.mjs — prove the copy still is the copy.
 *
 * `src/replica/**` is a one-way copy of the product's own studio replica. The
 * failure this gate exists for is not exotic: someone opens a synced file to
 * fix a nudge in the film, it works, it ships, and now two repos disagree about
 * what the product's interface looks like with nothing recording that they do.
 *
 * Three checks:
 *
 *   1. The lock exists and is NOT EMPTY. An empty ledger would turn check 2
 *      into "verify nothing" and report success — the exact shape of failure
 *      the sibling film hit four times in one day.
 *   2. Every row's file is present, is the recorded byte count, and hashes to
 *      the recorded sha256 (text compared at LF, the way the sync stored it).
 *      Files sitting under a synced root that the lock does NOT name are
 *      reported too: an extra file in src/replica/ is an edit the lock cannot
 *      see.
 *   3. The synced replica contains none of the tokens it is forbidden to
 *      contain. These are the product's own laws, re-checked on this side of
 *      the boundary so a film cannot be cut from a replica that broke them:
 *
 *        will-change   a hint on a large transformed layer asks Chrome for a
 *                      backing store the size of the layer. A render died for
 *                      memory on a 22,250 x 22,881 px one with 5.4 GB free.
 *        Date.now      the replica must be a pure function of t. A wall clock
 *                      makes it non-deterministic, which in Remotion means
 *                      frame N renders differently in two workers.
 *        Math.random   same reason, louder.
 *        gsap          a wall-clock animation library. The replica animates by
 *                      being asked what it looks like at time t, and nothing else.
 *        ArchLang      B4: the DSL is a different room and a different funnel.
 *                      It is not named on any consumer surface, and a promo is
 *                      the most consumer surface there is.
 *
 * Usage:  node scripts/verify-replica.mjs [--json]
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCK = path.join(ROOT, "src", "data", "replica-lock.json");
const AS_JSON = process.argv.includes("--json");

const slash = (p) => p.split(path.sep).join("/");
const failures = [];
const fail = (kind, subject, detail) => failures.push({ kind, subject, detail });

/* ── 1. the lock ──────────────────────────────────────────────────────────── */

if (!fs.existsSync(LOCK)) {
  console.error(
    [
      "",
      "verify-replica: src/data/replica-lock.json does not exist.",
      "",
      "  The replica has never been synced into this repo, so there is no film —",
      "  only the scaffold. This is a legitimate state before WP-1 and WP-2 land",
      "  upstream, and it is deliberately a FAILURE rather than a skip: a gate that",
      "  passes when it has nothing to check is how a repo ends up believing it is",
      "  synced when it holds nothing at all.",
      "",
      "  Sync it:  npm run sync:replica",
      "            node scripts/sync-replica.mjs --from <archcanvas worktree>",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

let lock;
try {
  lock = JSON.parse(fs.readFileSync(LOCK, "utf8"));
} catch (err) {
  console.error(`\nverify-replica: src/data/replica-lock.json is not valid JSON: ${String(err.message).split("\n")[0]}\n`);
  process.exit(1);
}

const rows = Array.isArray(lock.files) ? lock.files : [];
if (rows.length === 0) {
  console.error(
    "\nverify-replica: the lock names ZERO files. An empty ledger verifies nothing and would\n" +
      "report success by doing nothing. Re-run `npm run sync:replica`.\n",
  );
  process.exit(1);
}

/* ── 2. hashes ────────────────────────────────────────────────────────────── */

const BINARY = new Set([".webp", ".png", ".jpg", ".jpeg", ".gif", ".woff", ".woff2", ".ttf", ".otf", ".mp3", ".mp4"]);
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/** Read exactly as sync-replica stored it: text at LF, binary untouched. */
function readNormalised(abs) {
  const raw = fs.readFileSync(abs);
  if (BINARY.has(path.extname(abs).toLowerCase())) return raw;
  return Buffer.from(raw.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
}

let checkedBytes = 0;
const locked = new Set(rows.map((r) => r.path));

for (const row of rows) {
  const abs = path.join(ROOT, row.path);
  if (!fs.existsSync(abs)) {
    fail("missing", row.path, "in the lock but not on disk — restore it with `npm run sync:replica`");
    continue;
  }
  const bytes = readNormalised(abs);
  checkedBytes += bytes.length;
  if (bytes.length !== row.bytes) {
    fail("size", row.path, `lock says ${row.bytes} bytes, file is ${bytes.length}`);
    continue;
  }
  const hash = sha256(bytes);
  if (hash !== row.sha256) {
    fail(
      "drift",
      row.path,
      `sha256 ${hash.slice(0, 16)}… does not match the lock's ${String(row.sha256).slice(0, 16)}… — ` +
        "this file was edited here. Revert it, fix it upstream in archcanvas, and re-sync.",
    );
  }
}

/** Anything under a synced root that the lock does not name is an unrecorded edit. */
const SYNCED_ROOTS = [path.join("src", "replica"), path.join("src", "replica-data"), path.join("public", "renders")];
const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walk(abs, out);
    else out.push(slash(path.relative(ROOT, abs)));
  }
  return out;
};

const onDisk = SYNCED_ROOTS.flatMap((r) => walk(path.join(ROOT, r)));
for (const rel of onDisk) {
  if (!locked.has(rel)) {
    fail("stray", rel, "sits under a synced root but has no row in the lock — it was added by hand, not by the sync");
  }
}

/* ── 3. forbidden tokens ──────────────────────────────────────────────────── */

/**
 * Two classes, and the split is load-bearing.
 *
 * **Code tokens** are about what the replica DOES, so they are checked against
 * code with the comments stripped, and `.md` is not read at all. The replica's
 * own CLAUDE.md states its purity law in prose — "no `Date.now`, no
 * `performance.now`, no `Math.random`" — and the first run of this gate failed on
 * exactly that sentence, plus the comment in `easing.ts` explaining what stands
 * in for `Math.random`. A gate that cannot tell a rule from its violation gets
 * switched off.
 *
 * **Claim tokens** are about what the replica SAYS, and a claim in a comment is
 * still a claim someone will paste onto a surface. `ArchLang` is checked
 * everywhere, comments and Markdown included — which is also what the product's
 * own `tests/marketingNoCode.test.ts` needle does, so the two cannot disagree.
 */
const CODE_TOKENS = [
  {
    re: /will-change/,
    why: "a will-change hint on a large transformed layer asks Chrome to allocate backing store for the whole thing; renders were killed for memory with 5.4 GB free",
  },
  {
    re: /\bDate\.now\s*\(/,
    why: "the replica must be a pure function of t — a wall clock renders differently in two Remotion workers",
  },
  {
    re: /\bperformance\.now\s*\(/,
    why: "same as Date.now: a wall clock is not frame-deterministic",
  },
  { re: /\bMath\.random\s*\(/, why: "the film would not be reproducible frame to frame" },
  {
    re: /\bgsap\b/i,
    why: "a wall-clock animation library; the replica animates by being asked what it looks like at time t",
  },
];

const CLAIM_TOKENS = [
  {
    re: /ArchLang/i,
    why: "B4 — the DSL is never named on a consumer surface, and a promo is the most consumer surface there is",
  },
];

/**
 * Strip comments before matching a code token. `://` is spared so a URL in a
 * comment does not swallow the rest of its line. Newlines are preserved so the
 * reported line numbers stay true.
 */
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const scanned = [];
const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".css"]);
const CLAIM_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".json", ".md"]);

for (const rel of rows.map((r) => r.path)) {
  if (!rel.startsWith("src/replica")) continue;
  const ext = path.extname(rel).toLowerCase();
  if (!CLAIM_EXT.has(ext)) continue;
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;

  const raw = fs.readFileSync(abs, "utf8");
  scanned.push(rel);

  const report = (re, why, text) => {
    text.split("\n").forEach((line, i) => {
      if (re.test(line)) {
        fail("forbidden", `${rel}:${i + 1}`, `${re} — ${why}\n      ${line.trim().slice(0, 120)}`);
      }
    });
  };

  if (CODE_EXT.has(ext)) {
    const code = stripComments(raw);
    for (const { re, why } of CODE_TOKENS) report(re, why, code);
  }
  for (const { re, why } of CLAIM_TOKENS) report(re, why, raw);
}

// The same empty-set question, asked of check 3 rather than check 2: the lock
// can be full of renderings and still carry no replica source at all.
if (scanned.length === 0) {
  fail(
    "empty-scan",
    "src/replica/**",
    "the lock holds no scannable replica source, so the forbidden-token check looked at nothing",
  );
}

/* ── report ───────────────────────────────────────────────────────────────── */

const summary = {
  lock: "src/data/replica-lock.json",
  sourceRepo: lock.sourceRepo ?? null,
  sourceCommit: lock.sourceCommit ?? null,
  sourceBranch: lock.sourceBranch ?? null,
  files: rows.length,
  bytes: checkedBytes,
  replicaFilesScanned: scanned.length,
  failures,
};

if (AS_JSON) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(failures.length ? 1 : 0);
}

console.log(`\n  verify-replica`);
console.log(`    source ${lock.sourceRepo ?? "unknown"}`);
console.log(`           ${lock.sourceCommit ?? "unknown"} on ${lock.sourceBranch ?? "unknown"}${lock.sourceDirty ? "  (dirty)" : ""}`);
console.log(`    ${rows.length} file(s) re-hashed, ${(checkedBytes / 1024).toFixed(1)} KB`);
console.log(
  `    ${scanned.length} synced source file(s) scanned: ${CODE_TOKENS.length} code token(s) (comments stripped) + ${CLAIM_TOKENS.length} claim token(s) (everywhere)`,
);

if (!failures.length) {
  console.log(`\n  ✓ the copy matches the lock, and the replica breaks none of its laws\n`);
  process.exit(0);
}

console.log("");
for (const f of failures) {
  console.log(`  ✗ [${f.kind}] ${f.subject}`);
  console.log(`      ${f.detail}`);
}
console.log(`\n  ${failures.length} failure(s). src/replica/** is NOT editable here — fix it in archcanvas and re-sync.\n`);
process.exit(1);
