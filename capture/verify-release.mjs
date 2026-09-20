#!/usr/bin/env node
/**
 * verify-release.mjs — may this configuration be rendered into `out/masters/`?
 *
 * ── Why a gate and not a note ───────────────────────────────────────────────
 *
 * The film can be cut with a sound-effect set that **nobody is allowed to
 * publish**. `elevenlabs-audition` was generated on a free plan so the founder
 * could hear whether vendor effects beat the synthesised ones; ElevenLabs'
 * free terms withhold commercial rights from anything created outside a paid
 * subscription *before or after*, so upgrading later would not license it.
 *
 * That makes a quarantined set indistinguishable, at render time, from a
 * releasable one: same manifest shape, same file paths, same everything the
 * renderer looks at. The only thing standing between an audition and a master
 * sitting on a landing page is somebody remembering. This project has already
 * proved that does not hold — twelve ElevenLabs assets were generated, cleared
 * in a document, and deleted the next day (`docs/decisions.md` D4).
 *
 * So the rule is executable, and it runs **before** the render rather than
 * before the ship: `render.ps1` calls it, and `npm run ship` calls it.
 *
 * ── Where the rule lives ────────────────────────────────────────────────────
 *
 * In `src/audio.ts`, as `releaseBlockers()` — the same module the film reads.
 * This file bundles and calls it rather than re-deriving "is this licensed?"
 * in its own JavaScript, for the reason `capture/lib/load-core.mjs` states: a
 * gate that re-implements what it checks eventually disagrees with it, and a
 * gate that disagrees goes green on a broken film and red on a good one.
 *
 * ── The bypass this gate once had, and the four mutations that hold it shut ──
 *
 * **It printed the violation and then passed.** When the version model landed,
 * `activeSfxSetId()` became version-aware — FILM_VERSION picks the version, the
 * version names the sound set — while every default parameter in `src/audio.ts`
 * still read the legacy `sfxDoc.active` field. Under
 * `FILM_VERSION=B-daylight-forward+el` this gate rendered:
 *
 *     sfx set   elevenlabs-audition · source elevenlabs · tier free · commercialUse false
 *     ✓ masters may be rendered
 *
 * Green on the exact configuration it exists to refuse, with the contradiction
 * one line above the tick. The lesson is not "check the field": it is that
 * "what is the film playing?" must have exactly ONE answer, and a fallback left
 * lying beside it will be read by something. `sfxDoc.active` is now only the
 * fallback INSIDE `activeSfxSetId()`.
 *
 * Four mutations, each verified to turn this gate red, and each re-runnable:
 *
 *   1. `FILM_VERSION=B-daylight-forward+el` — a version whose set is unlicensed
 *      -> REFUSED, exit 1.
 *
 *      ⚠ It is FILM_VERSION, not `tools/use-sfx.mjs`. That tool writes
 *      `sfx.json`'s `active`, which the version model demoted to a fallback, so
 *      running it no longer changes what the film plays and no longer moves
 *      this gate. Writing the mutation as the tool would have documented a
 *      test that passes for the wrong reason — which is how a mutation record
 *      rots into decoration.
 *   2. Hand-edit `commercialUse: true` into `src/data/sfx.json` -> PASSES. That
 *      is correct and deliberate: the field is data-driven so a PAID
 *      regeneration flips it automatically, and nothing can distinguish a
 *      hand-edit from a legitimate change. **This gate stops accidents, not
 *      decisions**, and the mutation is here so nobody mistakes it for more.
 *   3. Point a `release: "master"` version at the audition set -> REFUSED.
 *   4. Give an audition version an `outDir` outside the quarantine folder
 *      -> REFUSED.
 *
 * Mutation 2 is the one worth re-reading. A gate that cannot be lied to does
 * not exist; a gate that catches every accident does, and that is what this is.
 *
 * Usage:
 *   node capture/verify-release.mjs            # 0 if masters may be rendered
 *   node capture/verify-release.mjs --json
 *   node capture/verify-release.mjs --explain  # print the reasoning even when clear
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const AS_JSON = process.argv.includes("--json");
const EXPLAIN = process.argv.includes("--explain");

/** The folder an audition render is allowed to write into. */
export const AUDITION_DIR = path.join("out", "previews", "AUDITION-not-for-release");

const load = async () => {
  const esbuild = createRequire(import.meta.url)("esbuild");
  const built = await esbuild.build({
    stdin: {
      contents: `export { releaseBlockers, activeSfxSetId, sfxSet, auditionVersions, releasableVersions, outDirFor, MUSIC_VERSION } from "./audio";`,
      resolveDir: SRC, sourcefile: "release-gate.ts", loader: "ts",
    },
    bundle: true, write: false, format: "esm", platform: "node", target: "node22", logLevel: "silent",
  });
  return import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`);
};

const mod = await load();
const setId = mod.activeSfxSetId();
const set = mod.sfxSet(setId);
const blockers = [...mod.releaseBlockers()];

/*
 * The music is versioned separately and carries its own provenance. A take with
 * an explicit `commercialUse: false` blocks a master exactly as a sound set
 * does. Absence is NOT treated as a blocker: the SUNO bed predates this field
 * and is covered by a dated paid-tier confirmation
 * (`docs/audio-provenance.md` § 3). It is reported, so the silence is visible.
 */
/*
 * ⚠ The version's OWN music, not `music.json`'s `active`.
 *
 * Reading `active` here was a leftover from before a version was
 * {music, edit, sfxSet}: under `FILM_VERSION=A-confident-arrival` with B
 * active, this gate reported and provenance-checked **B's** take while
 * building A. Harmless today because both takes are releasable, and exactly
 * the shape that is not harmless the day one is not — the licensing gate would
 * clear the wrong file. Same lesson as the bypass above: "what is the film
 * playing?" must have one answer, and a fallback lying beside it gets read.
 */
const music = JSON.parse(fs.readFileSync(path.join(SRC, "data", "music.json"), "utf8"));
const musicId = mod.MUSIC_VERSION;
const version = music.versions?.[musicId];
const musicNote = version?.provenance?.commercialUse === false
  ? `music version "${musicId}" carries commercialUse: false`
  : version?.provenance?.commercialUse === true
    ? `music version "${musicId}": releasable`
    : `music version "${musicId}": no commercialUse field — covered by the dated SUNO confirmation, not re-decided here`;
if (version?.provenance?.commercialUse === false) blockers.push(musicNote);

/*
 * Version routing.
 *
 * A version is {music, edit, sfxSet}, and an AUDITION version is one whose
 * sound set is not licensed for release. Those still render at full master
 * quality — the founder judges them as finished films, and an audition that
 * looks cheaper than the real thing is not an audition of the real thing — but
 * they must never land in `out/masters/`.
 *
 * So the routing is checked here rather than trusted: every audition version
 * must resolve to the quarantine folder, and every RELEASABLE version must name
 * a sound set that is actually releasable. The second half is the one that
 * catches the real mistake — adding a version that quietly points at the
 * audition palette.
 */
const versionRows = [];
for (const [id, v] of Object.entries(mod.auditionVersions())) {
  const dir = mod.outDirFor(id).split("\\").join("/");
  const ok = dir.startsWith("out/previews/AUDITION-not-for-release/");
  versionRows.push({ id, kind: "audition", sfxSet: v.sfxSet, outDir: dir, ok });
  if (!ok) blockers.push(`audition version "${id}" routes to ${dir}, outside the quarantine folder`);
}
for (const [id, v] of Object.entries(mod.releasableVersions())) {
  const dir = mod.outDirFor(id).split("\\").join("/");
  const setOk = mod.sfxSet(v.sfxSet).provenance?.commercialUse === true;
  versionRows.push({ id, kind: "releasable", sfxSet: v.sfxSet, outDir: dir, ok: setOk });
  if (!setOk) blockers.push(`releasable version "${id}" names sfx set "${v.sfxSet}", which is not licensed for commercial use`);
}

const summary = {
  activeSfxSet: setId,
  sfxSource: set.provenance?.source ?? null,
  sfxTier: set.provenance?.tier ?? null,
  sfxCommercialUse: set.provenance?.commercialUse ?? null,
  activeMusic: musicId,
  musicNote,
  auditionDir: AUDITION_DIR.split(path.sep).join("/"),
  releasable: blockers.length === 0,
  versions: versionRows,
  blockers,
};

if (AS_JSON) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(blockers.length ? 1 : 0);
}

console.log(`\n  verify-release`);
console.log(`    sfx set     ${setId} · source ${summary.sfxSource} · tier ${summary.sfxTier ?? "n/a"} · commercialUse ${summary.sfxCommercialUse}`);
console.log(`    music       ${musicNote}`);
console.log(`    cues        ${set.cues.length} checked for per-asset provenance`);
for (const v of versionRows) {
  console.log(`    ${v.kind === "audition" ? "audition  " : "releasable"}  ${v.id.padEnd(24)} sfx ${v.sfxSet.padEnd(20)} -> ${v.outDir}${v.ok ? "" : "   <- WRONG"}`);
}

if (!blockers.length) {
  if (EXPLAIN) console.log(`\n    every active audio asset is licensed for commercial use.`);
  console.log(`\n  ✓ masters may be rendered\n`);
  process.exit(0);
}

console.log("");
console.log("  ┌────────────────────────────────────────────────────────────────────┐");
console.log("  │  REFUSED — this configuration may not be rendered as a master.     │");
console.log("  └────────────────────────────────────────────────────────────────────┘");
console.log("");
for (const b of blockers) console.log(`  ✗ ${b}`);
console.log("");
console.log(`  What to do instead:`);
console.log(`    • Audition renders are allowed, into ${summary.auditionDir}/`);
console.log(`    • To release, switch to a licensed set:  node tools/use-sfx.mjs synth`);
console.log(`    • Or regenerate on a PAID plan:          node tools/generate-sfx-elevenlabs.mjs --set elevenlabs`);
console.log(`      (that command refuses to run on a free tier, by design)`);
console.log("");
process.exit(1);
