#!/usr/bin/env node
/**
 * measure-bed-hits.mjs — where each bed's own final hit lands, re-measured.
 *
 * The `end` role is suppressed when the end card falls too close to the music's
 * own resolution, so that rule needs two numbers: when the card lands (the
 * timeline knows, per version and per cut) and when the music resolves (only
 * the audio knows).
 *
 * The second one used to be typed into `sfx-roles.json` by hand. That was fine
 * exactly once. Beds get re-cut — a new take, a new plan, a changed crossfade —
 * and a hand-typed hit time survives all of it silently, which would leave the
 * suppression rule reading a number about a file that no longer exists. So it
 * is measured from the delivered mp3s and written back, and
 * `--check` fails if what is on disk no longer matches what is recorded.
 *
 * The endcard side is NOT cached here. It comes from
 * `timeline.endcardStartSec(cut, aspect)` at the moment it is needed, because
 * the edit is still being changed and a cached copy of someone else's live
 * number is the same bug in the other direction.
 *
 * Usage:
 *   node tools/measure-bed-hits.mjs            # measure and write
 *   node tools/measure-bed-hits.mjs --check    # fail on drift
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodeMono, rmsEnvelope, onsetFlux, pickOnsets, findEnding, probeDuration } from "./lib/dsp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROLES = path.join(ROOT, "src", "data", "sfx-roles.json");
const MUSIC = path.join(ROOT, "src", "data", "music.json");
const CHECK = process.argv.includes("--check");

const music = JSON.parse(fs.readFileSync(MUSIC, "utf8"));
const roles = JSON.parse(fs.readFileSync(ROLES, "utf8"));

const measured = {};
const rows = [];
for (const [vid, v] of Object.entries(music.versions)) {
  measured[vid] = {};
  for (const [cut, bed] of Object.entries(v.beds)) {
    const file = path.join(ROOT, "public", bed.file);
    if (!fs.existsSync(file)) { console.error(`\n  missing bed: ${bed.file}\n`); process.exit(1); }
    const x = decodeMono(file);
    const rms = rmsEnvelope(x);
    const ending = findEnding(rms, pickOnsets(onsetFlux(rms), { minGapSec: 0.3 }));
    measured[vid][cut] = ending.stopSec;
    rows.push({ vid, cut, hit: ending.stopSec, dur: probeDuration(file) });
  }
}

if (CHECK) {
  const recorded = roles.$measured?.bedFinalHitSec ?? {};
  const problems = [];
  for (const [vid, cuts] of Object.entries(measured)) {
    for (const [cut, hit] of Object.entries(cuts)) {
      const was = recorded[vid]?.[cut];
      if (was == null) problems.push(`${vid} ${cut}s: not recorded (measures ${hit}s)`);
      else if (Math.abs(was - hit) > 0.02) problems.push(`${vid} ${cut}s: recorded ${was}s, measures ${hit}s`);
    }
  }
  for (const vid of Object.keys(recorded)) {
    if (!measured[vid]) problems.push(`${vid}: recorded but no such music version`);
  }
  console.log(`\n  measure-bed-hits --check · ${rows.length} bed(s)`);
  if (!problems.length) { console.log(`  ✓ every recorded final hit matches the audio on disk\n`); process.exit(0); }
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log(`\n  ${problems.length} drift(s). Re-run \`node tools/measure-bed-hits.mjs\`.\n`);
  process.exit(1);
}

roles.$measured = { ...(roles.$measured ?? {}), bedFinalHitSec: measured };
/*
 * The endcard times were cached here once and are deliberately removed: they
 * belong to the edit, the edit is live, and `timeline.endcardStartSec()` is the
 * only thing entitled to answer.
 */
delete roles.$measured.endcardStartSec_editA;
delete roles.$measured.$endcardNote;
roles.$measured.$note =
  "bedFinalHitSec is MEASURED from the delivered beds by tools/measure-bed-hits.mjs; " +
  "`--check` fails on drift. The endcard side is deliberately NOT cached here — it comes from " +
  "timeline.endcardStartSec(cut, aspect) per version, because the edit is still changing.";

fs.writeFileSync(ROLES, JSON.stringify(roles, null, 2) + "\n");

console.log(`\n  measure-bed-hits · ${rows.length} bed(s)\n`);
console.log("    version                cut     final hit    from end");
for (const r of rows) {
  console.log(`    ${r.vid.padEnd(22)} ${r.cut.padStart(3)}s  ${r.hit.toFixed(2).padStart(9)}s  ${(r.dur - r.hit).toFixed(2).padStart(8)}s`);
}
console.log(`\n  wrote ${path.relative(ROOT, ROLES)}\n`);
