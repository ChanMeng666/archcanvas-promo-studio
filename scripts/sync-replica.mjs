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
 *   src/lib/marketing/studioDemo.generated.ts   ->  src/replica-data/studioDemo.generated.ts
 *   public/showcase/studio-demo/drawlist.json   ->  src/data/drawlist.json
 *   public/showcase/studio-demo/landing.json    ->  src/data/landing.json
 *   public/showcase/renders/<listed>.webp       ->  public/renders/<name>.webp
 *   public/showcase/plans/<listed>.annotated.svg -> src/data/showcase-plans.json  (BAKED)
 *
 * and then writes `src/replica-data/index.ts`, the one piece of glue this repo
 * owns: the replica declares its own `VariantId`/`DemoInputs` in its `types.ts`,
 * while the BAKED data is typed by `studioDemo.types.ts`, and something has to
 * join the drawlist JSON to a type. It is generated rather than hand-written so
 * it cannot drift from what the sync actually landed.
 *
 * ── The one thing here that is BAKED rather than copied ────────────────────
 *
 * `src/data/showcase-plans.json` is the 120 s cut's second-brief montage: four
 * of the product's own published showcase plans, flattened from their
 * `.annotated.svg` into a draw list the film can stroke on. It is baked at sync
 * time, with the PRODUCT'S OWN PARSER (`parsePageSvg`, imported out of the
 * source checkout's `scripts/generate-studio-demo.mjs`) rather than a second
 * SVG reader written here — the parser throws on any construct it does not
 * recognise, so a compiler that starts grouping under a transform stops the
 * sync instead of quietly baking a plan that draws in the wrong place. That
 * import needs the source checkout's `node_modules`, and a missing one is
 * fatal for the usual reason: a montage that silently bakes nothing is a
 * fifteen-second hole in the long cut.
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
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

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
    /**
     * The small typed things — the real brief, the real title, the real room
     * chips, the real `lint()` findings. `DemoInputs` is assembled from this and
     * nothing else, so the film cannot invent a word the product did not say.
     */
    src: path.join("src", "lib", "marketing", "studioDemo.generated.ts"),
    dest: path.join("src", "replica-data", "studioDemo.generated.ts"),
    role: "demo",
  },
  {
    src: path.join("public", "showcase", "studio-demo", "drawlist.json"),
    dest: path.join("src", "data", "drawlist.json"),
    role: "drawlist",
  },
  {
    /**
     * The payload the film actually DRAWS — see `docs/decisions.md` D9. The
     * as-issued sheet in `drawlist.json` stays synced as the numbers gate's
     * record, but it puts the building in a corner of an A3 page; the landing
     * payload is the same compiled geometry without the sheet, which is what
     * the replica's own layout, camera envelope and pin anchors are built for.
     */
    src: path.join("public", "showcase", "studio-demo", "landing.json"),
    dest: path.join("src", "data", "landing.json"),
    role: "landing",
  },
];

/**
 * The 120 s cut's second brief: four more of the product's published plans,
 * baked into one draw list. Their briefs and titles come from
 * `src/lib/showcase.generated.ts`, so every word over the montage is a word the
 * product has actually been given.
 */
const SHOWCASE_SLUGS = ["family-house", "courtyard-apartment", "accessible-clinic", "compact-bedsit"];
/** The plan the main screenplay designs. Only its typology label is taken. */
const DEMO_SLUG = "two-storey-townhouse";
const SHOWCASE_DEST = path.join("src", "data", "showcase-plans.json");
const SHOWCASE_ROSTER = path.join("src", "lib", "showcase.generated.ts");

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

/**
 * Stage a file this script BUILT rather than copied.
 *
 * `inputs` is the whole point: a derived artifact has no single source path, so
 * the lock records every file it was derived from with that file's own sha256.
 * `--check` re-bakes from the source checkout, so an upstream change still shows
 * up as drift — the input hashes are there so a reader can see WHICH one moved
 * without re-running anything.
 */
function planDerived({ destRel, text, role, sourceRel, inputs }) {
  const bytes = Buffer.from(text, "utf8");
  planned.push({ destRel, bytes, sha256: sha256(bytes), role, sourceRel, inputs });
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
    const row = { path: slash(p.destRel), bytes: p.bytes.length, sha256: p.sha256, role: p.role, source: p.sourceRel };
    if (p.inputs) row.inputs = p.inputs;
    rows.push(row);
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

/* the second-brief montage, BAKED ------------------------------------------ */

/**
 * Flatten four published showcase plans into one draw list.
 *
 * The parser is the PRODUCT'S: `parsePageSvg` out of the source checkout's own
 * `scripts/generate-studio-demo.mjs`. Writing a second SVG reader here is the
 * shape of bug that `planTypes.ts` upstream calls out — two readers that agree
 * until one day they do not — and this one is strict by construction: it throws
 * on any element, attribute or stray byte it does not recognise, so a compiler
 * change stops the sync with the offending tag rather than baking a plan that
 * draws in the wrong place.
 *
 * Only what the montage strokes is kept: the geometry, the layer, the document
 * order and the `fillOnly` flag. `data-arch-*` is dropped — nothing in the
 * montage is selectable, and the montage carries no pins.
 */
async function bakeShowcase() {
  const generatorAbs = from("scripts", "generate-studio-demo.mjs");
  if (!fs.existsSync(generatorAbs)) {
    die(`the product's own page parser is missing: ${slash(path.join(SOURCE, "scripts", "generate-studio-demo.mjs"))}`);
  }
  if (!fs.existsSync(from("node_modules"))) {
    die(
      [
        `the source checkout has no node_modules, so its own page parser cannot be imported:`,
        `  ${slash(path.join(SOURCE, "node_modules"))}`,
        "",
        "`scripts/generate-studio-demo.mjs` imports the compiler at module scope. Run",
        "`npm install` in the source checkout (or point --from at one that has it).",
        "",
        "Not falling back to a second SVG reader written here: the montage would bake",
        "against a parser nobody checks, which is worse than not baking it at all.",
      ].join("\n"),
    );
  }

  let parsePageSvg;
  try {
    ({ parsePageSvg } = await import(pathToFileURL(generatorAbs).href));
  } catch (err) {
    die(`could not load the product's page parser: ${String(err.message).split("\n")[0]}`);
  }
  if (typeof parsePageSvg !== "function") {
    die("scripts/generate-studio-demo.mjs no longer exports parsePageSvg — the montage bake has lost its parser.");
  }

  const rosterAbs = from(SHOWCASE_ROSTER);
  if (!fs.existsSync(rosterAbs)) die(`required source file is missing: ${slash(SHOWCASE_ROSTER)}`);
  const roster = readShowcaseRoster(fs.readFileSync(rosterAbs, "utf8"));

  const inputs = [{ path: slash(SHOWCASE_ROSTER), sha256: sha256(readNormalised(rosterAbs)) }];
  const plans = [];

  for (const slug of SHOWCASE_SLUGS) {
    const entry = roster.get(slug);
    if (!entry) die(`SHOWCASE_PLANS in ${slash(SHOWCASE_ROSTER)} has no "${slug}" — the montage names a plan the product does not publish.`);
    const svgRel = path.join("public", "showcase", "plans", `${slug}.annotated.svg`);
    const svgAbs = from(svgRel);
    if (!fs.existsSync(svgAbs)) die(`required source file is missing: ${slash(svgRel)}`);
    const raw = readNormalised(svgAbs);
    inputs.push({ path: slash(svgRel), sha256: sha256(raw) });

    let page;
    try {
      page = parsePageSvg(raw.toString("utf8"));
    } catch (err) {
      die(`the product's parser refused ${slash(svgRel)}: ${String(err.message).split("\n")[0]}`);
    }
    plans.push({
      slug,
      title: entry.title,
      brief: entry.brief,
      viewBox: page.viewBox,
      defs: page.defs,
      nodes: page.nodes.map((n) => ({
        tag: n.tag,
        attrs: n.attrs,
        layer: n.layer,
        order: n.order,
        ...(n.fillOnly ? { fillOnly: true } : {}),
      })),
      texts: page.texts.map((t) => ({ attrs: t.attrs, text: t.text, layer: t.layer })),
    });
  }

  /**
   * The typology the composer picks in Act I, taken from the roster rather than
   * typed here: it is the product's own selector label for the very plan the
   * screenplay designs (`src/lib/agent/typologies.ts` → "Residential"), and a
   * label typed into a film is a label that stops matching the product.
   */
  const demoEntry = roster.get(DEMO_SLUG);
  if (!demoEntry) die(`SHOWCASE_PLANS has no "${DEMO_SLUG}" — the film's own plan is not in the product's roster.`);

  planDerived({
    destRel: SHOWCASE_DEST,
    text: `${JSON.stringify({ demoTypology: demoEntry.type, plans }, null, 0)}\n`,
    role: "showcase",
    sourceRel: "public/showcase/plans/*.annotated.svg + " + slash(SHOWCASE_ROSTER),
    inputs,
  });
}

/**
 * Read `slug` / `title` / `brief` out of the roster, with the TypeScript parser
 * rather than a regex.
 *
 * `archSource` in that file is a single string literal holding a whole plan
 * source, escaped newlines and quotes and all — a line-oriented scan walks
 * straight into it and comes out with something that looks like a brief. The
 * AST cannot make that mistake.
 */
function readShowcaseRoster(text) {
  const sf = ts.createSourceFile("showcase.generated.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out = new Map();
  const literal = (n) => (n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null);

  const visit = (node) => {
    if (ts.isObjectLiteralExpression(node)) {
      const fields = {};
      for (const p of node.properties) {
        if (!ts.isPropertyAssignment(p) || !ts.isIdentifier(p.name)) continue;
        const v = literal(p.initializer);
        if (v !== null) fields[p.name.text] = v;
      }
      if (fields.slug && fields.title && fields.brief && fields.type) {
        out.set(fields.slug, { title: fields.title, brief: fields.brief, type: fields.type });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  if (out.size === 0) {
    die(`${slash(SHOWCASE_ROSTER)} yielded no plans — the roster's shape has changed and the montage would bake nothing.`);
  }
  return out;
}

await bakeShowcase();

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
 *
 * Two payloads are synced and they are NOT interchangeable:
 *
 *   DRAWLIST  the as-issued sheets — paper, title block, schedule, legend. The
 *             numbers gate's record (\`capture/verify-numbers.mjs\`). The
 *             building is about a third of the page's width, so it is not what
 *             the film draws.
 *   LANDING   the same compiled geometry without the sheet, slimmed. What the
 *             film draws, and what the replica's layout is built for.
 *             \`docs/decisions.md\` D9.
 */

import drawlist from "../data/drawlist.json";
import landing from "../data/landing.json";
import showcase from "../data/showcase-plans.json";

import type { StudioDemoLanding } from "./studioDemo.types";

export * from "./studioDemo.types";
export { STUDIO_DEMO } from "./studioDemo.generated";

/** The as-issued draw list. The record the numbers gate checks against. */
export const DRAWLIST = drawlist;

/** The drawlist's real shape, inferred from the staged bytes. */
export type Drawlist = typeof drawlist;

/**
 * The display payload the film draws: aliases, deltas and layer defaults.
 *
 * Typed by the upstream contract rather than inferred from the bytes. The
 * drawlist above is inferred on purpose — it is the numbers gate's RECORD, and
 * an inferred type cannot claim a structure the data does not have — but this
 * one is READ, node by node, thirty times a second, and a 186 KB inferred
 * literal type is a type-check that takes minutes instead of seconds.
 */
export const LANDING = landing as unknown as StudioDemoLanding;

/** One plan of the second-brief montage, flattened at sync time. */
export interface ShowcasePlanJson {
  slug: string;
  title: string;
  brief: string;
  viewBox: string;
  defs: string;
  nodes: { tag: string; attrs: Record<string, string>; layer: string; order: number; fillOnly?: boolean }[];
  texts: { attrs: Record<string, string>; text: string; layer: string }[];
}

/**
 * The 120 s cut's second brief: four more published plans, flattened at sync
 * time by the product's own page parser. Each carries the brief the product was
 * actually given.
 */
export const SHOWCASE_PLANS = showcase.plans as unknown as ShowcasePlanJson[];

/** The composer's typology label, as the product's own roster spells it. */
export const DEMO_TYPOLOGY: string = showcase.demoTypology;
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
