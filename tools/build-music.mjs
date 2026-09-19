#!/usr/bin/env node
/**
 * build-music.mjs — measure the DELIVERED beds and write `src/data/music.json`.
 *
 * ── Why this measures the output rather than computing from the plan ────────
 *
 * The downbeats in `music.json` are what WP-7's `snapToDownbeat` lands scene
 * boundaries on, within about +/-150 ms. There are two ways to produce them and
 * only one of them survives contact with the material:
 *
 *   (a) take the source tempo, extrapolate a grid, subtract the body start.
 *   (b) measure the file that actually shipped.
 *
 * (a) is wrong, and measurably so. On `confident-arrival.mp3` the best global
 * beat phase creeps about 0.2 s per 20 s block — so a grid extrapolated from the
 * start of a take is nearly a full beat out by 120 s, four times the window a
 * cut is allowed to snap within. A SUNO take is generated audio, not a sequenced
 * click track, and it does not hold one tempo that precisely.
 *
 * There is a second reason, and it is the stronger one. The beds are **spliced**:
 * a body, then the take's own ending crossfaded on at a bar line. The seam moves
 * the grid. Only the delivered file knows where its own downbeats ended up, and
 * MP3 encoder delay shifts everything again by another ~24 ms. So this file
 * decodes the shipped MP3 exactly as Chrome will and reports what is in it.
 *
 * ── How a downbeat is decided ───────────────────────────────────────────────
 *
 * A regular bar grid, snapped onto real onsets. Pure onset picking gives a list
 * that thins out through a breakdown, exactly where an editor still needs
 * somewhere to cut; a pure grid ignores the drift this whole file exists to
 * handle. So: lay a grid at the measured bar length, and move each grid point to
 * the nearest measured onset if one is within half a beat. Regular where the
 * music is sparse, measured where it is not.
 *
 * Usage:
 *   node tools/build-music.mjs [--json]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  decodeMono, rmsEnvelope, onsetFlux, pickOnsets, localBeat, probeDuration, measureLoudness,
} from "./lib/dsp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLAN_FILE = path.join(ROOT, "audio", "bed-plan.json");
const OUT = path.join(ROOT, "src", "data", "music.json");
const JSON_OUT = process.argv.includes("--json");

if (!fs.existsSync(PLAN_FILE)) {
  console.error("\n  no audio/bed-plan.json — run `node tools/plan-beds.mjs` then `pwsh -File tools/prepare-bed.ps1`.\n");
  process.exit(1);
}
const plan = JSON.parse(fs.readFileSync(PLAN_FILE, "utf8"));

const beds = {};
const rows = [];

for (const bedPlan of plan.beds) {
  const file = path.join(ROOT, "public", bedPlan.file);
  if (!fs.existsSync(file)) {
    console.error(`\n  ${bedPlan.file} is missing — run \`pwsh -File tools/prepare-bed.ps1\` first.\n`);
    process.exit(1);
  }

  const durationSec = probeDuration(file);
  const loudness = measureLoudness(file);
  const x = decodeMono(file);
  const rms = rmsEnvelope(x);
  const flux = onsetFlux(rms);
  const onsets = pickOnsets(flux, { minGapSec: 0.3 });

  /*
   * The grid STEP comes from the plan, not from a median of this file's onsets,
   * and that is a correction rather than a shortcut.
   *
   * Taking the median inter-onset interval per bed returned bar lengths of
   * 1.96 / 2.24 / 1.88 / 2.16 s for the four beds — against a true bar of 2.36 s
   * that two independent analyses and the sibling repo all agree on. The median
   * is dragged down by SUBDIVISIONS: a kick on the beat and a hat between them
   * are both onsets, so half the gaps are half a beat and the median lands
   * between the two. The plan's figure is measured over the ending region, where
   * the arrangement is sparse enough for the beat to be unambiguous.
   *
   * `localBeat` is still run per bed, but only to report disagreement.
   */
  const measured = localBeat(onsets);
  const barSec = Number(plan.barSec.toFixed(4));
  const halfBeat = plan.beatSec / 2;

  /*
   * The grid is anchored at 0 because the bed's first sample IS a downbeat: the
   * planner cut the body to start on the onset it chose as the entry.
   *
   * Each step advances from the position that was SNAPPED TO, not from the ideal
   * grid. That is what lets the list follow the take's own tempo drift — about
   * 0.2 s per 20 s — instead of walking away from it. Advancing off the ideal
   * grid, the accumulated error passes half a beat partway through the 120s bed
   * and every downbeat after that point snaps to the wrong beat, which is worse
   * than not snapping at all.
   */
  const downbeats = [];
  let snapped = 0;
  let t = 0;
  while (t <= durationSec - 0.05) {
    let near = Number.POSITIVE_INFINITY;
    for (const o of onsets) if (Math.abs(o.t - t) < Math.abs(near - t)) near = o.t;
    if (Number.isFinite(near) && Math.abs(near - t) <= halfBeat) {
      downbeats.push(Number(near.toFixed(3)));
      snapped++;
      t = near + barSec;
    } else {
      downbeats.push(Number(t.toFixed(3)));
      t += barSec;
    }
  }
  // A snap can land two grid points on one onset; keep them strictly increasing.
  const clean = [];
  for (const d of downbeats) if (!clean.length || d - clean[clean.length - 1] >= halfBeat) clean.push(d);

  beds[bedPlan.cut] = {
    file: bedPlan.file,
    /** Where this bed starts in FILM time. The film opens on it, so zero. */
    offsetSec: 0,
    /** Film-time seconds. `snapToDownbeat` reads exactly this. */
    downbeats: clean,
    barSec,
    beatSec: Number(plan.beatSec.toFixed(4)),
    /** What a median of THIS file's onset gaps says — for comparison only; it
     *  reads low wherever the arrangement has subdivisions in it. */
    measuredBarSec: measured ? Number(measured.barSec.toFixed(4)) : null,
    durationSec: Number(durationSec.toFixed(3)),
    lufs: loudness.lufs,
    truePeakDb: loudness.truePeakDb,
    /** Where in the source take the body came from — provenance, not timing. */
    sourceBodyStartSec: bedPlan.bodyStartSec,
    sourceEndingStartSec: bedPlan.endingStartSec,
  };

  rows.push({
    cut: bedPlan.cut, durationSec, barSec, downbeats: clean.length, snapped,
    lufs: loudness.lufs, tp: loudness.truePeakDb,
    spread: clean.length > 1 ? Number(((clean[clean.length - 1] - clean[0]) / (clean.length - 1)).toFixed(3)) : 0,
  });
}

const music = {
  $comment:
    "Generated by tools/build-music.mjs — do not hand-edit. Downbeats are measured on the DELIVERED mp3 " +
    "(decoded the way the browser will decode it), not extrapolated from the source tempo: the take's beat " +
    "phase drifts ~0.2s per 20s and the beds are spliced, so an extrapolated grid is most of a beat wrong by " +
    "120s. Regenerate with `npm run audio:beds`.",
  track: path.basename(plan.source),
  trackSourceDurationSec: plan.sourceDurationSec,
  bpm: plan.bpm,
  barSec: plan.barSec,
  beatSec: plan.beatSec,
  targetLufs: plan.targetLufs,
  targetTruePeakDb: plan.targetTruePeakDb,
  beds,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(music, null, 2) + "\n");

if (JSON_OUT) { console.log(JSON.stringify(music, null, 2)); process.exit(0); }

console.log(`\n  build-music · ${music.track} · ${music.bpm} BPM · bar ${music.barSec}s\n`);
console.log("    cut    duration     bar   downbeats  on a real onset   mean gap      LUFS   true peak");
for (const r of rows) {
  console.log(
    `    ${r.cut.padStart(3)}s  ${r.durationSec.toFixed(3).padStart(8)}s  ${r.barSec.toFixed(3)}s  ` +
    `${String(r.downbeats).padStart(9)}  ${String(`${r.snapped}/${r.downbeats}`).padStart(15)}  ` +
    `${r.spread.toFixed(3)}s  ${String(r.lufs).padStart(8)}  ${String(r.tp).padStart(6)} dBTP`,
  );
}
console.log(`\n  wrote ${path.relative(ROOT, OUT)}\n`);
