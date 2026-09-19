#!/usr/bin/env node
/**
 * verify-assets.mjs — prove that every byte the film loads is a byte that exists.
 *
 * WHY THIS EXISTS: **Remotion fails SOFTLY on a missing `staticFile()`.** You do
 * not get an error — you get a blank region in the render. A long render of eight
 * masters can therefore complete, report success, and ship with a hole in it that
 * nobody sees until it is on a landing page. There is no runtime signal to catch;
 * the only defence is to check the asset tree before the render starts, which is
 * why `npm run verify` runs this first.
 *
 * It checks:
 *
 *   1. Every `staticFile("...")` string in `src/**` names a file that exists under
 *      `public/`. A miss is a hard failure.
 *   2. Every file under `public/renders/` is named by `src/data/replica-lock.json`,
 *      once that lock exists — a rendering that arrived by hand has no provenance,
 *      and law 2 of this repo is that nothing on screen is mocked up.
 *   3. It says out loud how many `staticFile()` calls it actually looked at.
 *
 * ── The vacuity banner ─────────────────────────────────────────────────────
 *
 * Point 3 is not decoration. The sibling film's asset gate once passed at ZERO
 * `staticFile()` calls and reported a tick, which is the same failure as a copy
 * gate passing on an empty `src/`. Here, zero calls is a legitimate state — the
 * scaffold loads nothing — so it prints a banner instead of pretending, and
 * `--strict` (which `npm run ship` passes) turns it fatal. The rule is the
 * project's rule: **before trusting a green gate, ask what it actually looked at.**
 *
 * Usage:  node capture/verify-assets.mjs [--json] [--strict]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const SRC = path.join(ROOT, "src");
const LOCK = path.join(ROOT, "src", "data", "replica-lock.json");

const AS_JSON = process.argv.includes("--json");
const STRICT = process.argv.includes("--strict");

const slash = (p) => p.split(path.sep).join("/");
const violations = [];
const fail = (kind, subject, detail) => violations.push({ kind, subject, detail });

/* ── 1. every staticFile() resolves ───────────────────────────────────────── */

const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
};

const sourceFiles = walk(SRC);
const calls = [];
const dynamic = [];

/**
 * Strip comments before matching.
 *
 * A doc comment that EXPLAINS the `staticFile()` trap contains the token
 * `staticFile()`, and an unstripped scan reports it as an unverifiable dynamic
 * call. That is worse than a cosmetic bug: this line exists to make the
 * unchecked calls visible, and a permanent false entry is how a reader learns
 * to skip it. Comments are blanked rather than deleted so line numbers survive,
 * and `://` is spared so a URL does not swallow the rest of its line.
 */
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

for (const file of sourceFiles) {
  const rel = slash(path.relative(ROOT, file));
  const text = stripComments(fs.readFileSync(file, "utf8"));
  for (const m of text.matchAll(/staticFile\(\s*(["'`])([^"'`]*)\1\s*\)/g)) {
    calls.push({ rel, asset: m[2] });
  }
  // A `staticFile(someVariable)` cannot be checked here. Reported so the fact
  // that it is unverified is visible rather than assumed away.
  for (const m of text.matchAll(/staticFile\(\s*(?!["'`])/g)) {
    dynamic.push({ rel, at: m.index });
  }
}

for (const { rel, asset } of calls) {
  const abs = path.join(PUBLIC_DIR, asset);
  if (!fs.existsSync(abs)) {
    fail("missing", asset, `referenced by ${rel}, but public/${asset} does not exist — Remotion would render a blank region here`);
  }
}

/* ── 2. every rendering has provenance ────────────────────────────────────── */

let lockNote = "src/data/replica-lock.json not present — rendering provenance unverified";
const renderDir = path.join(PUBLIC_DIR, "renders");

if (fs.existsSync(LOCK)) {
  let lock = null;
  try {
    lock = JSON.parse(fs.readFileSync(LOCK, "utf8"));
  } catch (err) {
    fail("lock", "src/data/replica-lock.json", `not valid JSON: ${String(err.message).split("\n")[0]}`);
  }
  if (lock) {
    const locked = new Set((lock.files ?? []).map((f) => f.path));
    const onDisk = fs.existsSync(renderDir)
      ? fs.readdirSync(renderDir).filter((n) => !n.startsWith("."))
      : [];
    for (const name of onDisk) {
      const rel = `public/renders/${name}`;
      if (!locked.has(rel)) {
        fail("unprovenanced", rel, "is on disk but not in the replica lock — it did not arrive by `npm run sync:replica`");
      }
    }
    lockNote = `${onDisk.length} rendering(s) in public/renders/, all named by the lock`;
  }
} else if (fs.existsSync(renderDir) && fs.readdirSync(renderDir).length > 0) {
  fail("unprovenanced", "public/renders/", "holds files but there is no replica lock to account for them");
}

/* ── 3. the audio manifests ───────────────────────────────────────────────── */
/*
 * The beds and the cues are not reached through `staticFile("literal")` — WP-9
 * mounts them from `src/audio.ts`, which reads two generated manifests. A
 * `staticFile` call whose argument is a variable cannot be resolved by check 1
 * above, which can only report it as unverified. This section verifies them.
 *
 * It calls `audioProblems()` out of `src/audio.ts` rather than re-deriving the
 * rules here, for the reason `capture/lib/load-core.mjs` gives at length: a gate
 * that re-implements what it checks eventually disagrees with it, and a gate
 * that disagrees goes green on a broken film and red on a good one.
 */

const MUSIC = path.join(SRC, "data", "music.json");
const SFX = path.join(SRC, "data", "sfx.json");
let audioNote = "no audio manifests — run `npm run audio:all`";
let audioFiles = 0;

if (fs.existsSync(MUSIC) || fs.existsSync(SFX)) {
  const declared = [];
  if (fs.existsSync(MUSIC)) {
    const music = JSON.parse(fs.readFileSync(MUSIC, "utf8"));
    for (const bed of Object.values(music.beds ?? {})) declared.push({ from: "music.json", file: bed.file });
  } else fail("audio", "src/data/music.json", "missing — run `npm run audio:beds`");
  if (fs.existsSync(SFX)) {
    const sfx = JSON.parse(fs.readFileSync(SFX, "utf8"));
    for (const cue of sfx.cues ?? []) declared.push({ from: "sfx.json", file: cue.file });
  } else fail("audio", "src/data/sfx.json", "missing — run `npm run audio:sfx`");

  for (const { from, file } of declared) {
    if (!fs.existsSync(path.join(PUBLIC_DIR, file))) {
      fail("missing", file, `declared by ${from}, but public/${file} does not exist — the film would play silence here`);
    }
  }
  audioFiles = declared.length;

  // The real invariants, from the real module.
  try {
    const { createRequire } = await import("node:module");
    const esbuild = createRequire(import.meta.url)("esbuild");
    const built = await esbuild.build({
      stdin: { contents: `export { audioProblems } from "./audio";`, resolveDir: SRC, sourcefile: "audio-gate.ts", loader: "ts" },
      bundle: true, write: false, format: "esm", platform: "node", target: "node22", logLevel: "silent",
    });
    const mod = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`);
    for (const problem of mod.audioProblems()) fail("audio", "src/audio.ts", problem);
    audioNote = `${audioFiles} audio file(s) declared by the manifests, all on disk; src/audio.ts self-check ran`;
  } catch (err) {
    fail("audio", "src/audio.ts", `could not be evaluated: ${String(err.message).split("\n")[0]}`);
    audioNote = `${audioFiles} audio file(s) declared; the self-check could NOT run`;
  }
}

/* ── report ───────────────────────────────────────────────────────────────── */

const vacuous = calls.length === 0;
if (vacuous && STRICT) {
  fail("vacuous", "staticFile()", "zero calls under src/ — this gate verified nothing, and --strict does not accept that");
}

const summary = {
  strict: STRICT,
  sourceFiles: sourceFiles.length,
  staticFileCalls: calls.length,
  dynamicCalls: dynamic.length,
  lockNote,
  audioNote,
  violations,
};

if (AS_JSON) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(violations.length ? 1 : 0);
}

console.log(`\n  verify-assets${STRICT ? " --strict" : ""}`);
console.log(`    ${sourceFiles.length} source file(s) scanned`);
console.log(`    ${calls.length} literal staticFile() call(s) checked against public/`);
console.log(`    ${lockNote}`);
console.log(`    ${audioNote}`);
if (dynamic.length) {
  console.log(`    ! ${dynamic.length} staticFile() call(s) with a non-literal argument — NOT checked:`);
  for (const d of dynamic) console.log(`        ${d.rel}`);
}

if (vacuous) {
  console.log("");
  console.log("  ┌──────────────────────────────────────────────────────────────────┐");
  console.log("  │  VACUOUS: there are no staticFile() calls, so this gate verified  │");
  console.log("  │  NOTHING. That is correct while the scaffold loads no assets and  │");
  console.log("  │  wrong the moment a scene does. --strict makes it fatal.          │");
  console.log("  └──────────────────────────────────────────────────────────────────┘");
}

if (!violations.length) {
  console.log(`\n  ✓ every asset the film names is on disk\n`);
  process.exit(0);
}
console.log("");
for (const v of violations) {
  console.log(`  ✗ [${v.kind}] ${v.subject}`);
  console.log(`      ${v.detail}`);
}
console.log(`\n  ${violations.length} violation(s).\n`);
process.exit(1);
