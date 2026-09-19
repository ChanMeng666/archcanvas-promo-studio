#!/usr/bin/env node
/**
 * plan-beds.mjs — decide, by measurement, where each of the four beds is cut
 * out of the source take.
 *
 * ── The requirement ─────────────────────────────────────────────────────────
 *
 * Every bed must START clean — on a real onset, entering out of something
 * quieter, so the music sounds like it BEGINS rather than like you walked in on
 * it — and must END on a musical resolution rather than a fade pulled down in
 * the middle of a phrase.
 *
 * A window that does both at once does not generally exist. The take's good
 * entries are not 15, 30, 60 and 120 seconds before its ending. So each bed is
 * **two pieces spliced at a bar line**: a BODY that starts well, and the take's
 * OWN ENDING — the final hit and its ring-out — crossfaded onto the end of it.
 * That is the whole design, and it is why this file exists instead of four
 * hand-typed start times.
 *
 * ── Why the numbers are derived and not typed ───────────────────────────────
 *
 * The founder is going to replace this track. The brief in `docs/suno-prompt.md`
 * asks for a new one, and the swap has to be one command — so nothing here may
 * be specific to `confident-arrival.mp3`. Everything below is measured: the
 * local beat, the final hit, the ring-out, the re-entry points. Drop a different
 * take in `audio/source/` and this file re-derives a plan for it.
 *
 * ── The splice arithmetic ───────────────────────────────────────────────────
 *
 *   total = bodyLen + endLen - crossfade          (acrossfade's own length rule)
 *
 * Both splice points are measured ONSETS, so the two halves meet on a beat and
 * do not flam. The free variable that absorbs the remainder is the **length of
 * the ring-out**, and it is free precisely because a ring-out has no beat in it:
 * trimming a decaying tail by a fraction of a second is inaudible, where
 * trimming a bar of music is not. So the body gets whole musical units and the
 * tail takes up the slack.
 *
 * Usage:
 *   node tools/plan-beds.mjs                          # the take in audio/source/
 *   node tools/plan-beds.mjs --source <file> [--json]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  decodeMono, rmsEnvelope, onsetFlux, pickOnsets, localBeat, findEnding, rmsBetween, probeDuration,
} from "./lib/dsp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(ROOT, "audio", "source");
const PLAN_FILE = path.join(ROOT, "audio", "bed-plan.json");

const argv = process.argv.slice(2);
const val = (f) => { const i = argv.indexOf(f); return i === -1 ? null : argv[i + 1]; };
const JSON_OUT = argv.includes("--json");

/** The four cut lengths. Mirrors `src/layout-core.ts` CUT_SECONDS. */
const CUTS = [15, 30, 60, 120];

/* ── locate the take ────────────────────────────────────────────────────────── */

let source = val("--source");
if (!source) {
  const takes = fs.existsSync(SOURCE_DIR)
    ? fs.readdirSync(SOURCE_DIR).filter((n) => /\.(mp3|wav|flac|m4a)$/i.test(n))
    : [];
  if (takes.length === 0) {
    console.error(`\n  audio/source/ holds no take. Drop the SUNO file there (see docs/suno-prompt.md) or pass --source.\n`);
    process.exit(1);
  }
  if (takes.length > 1) {
    console.error(`\n  audio/source/ holds ${takes.length} takes: ${takes.join(", ")}\n  Pass --source to say which one.\n`);
    process.exit(1);
  }
  source = path.join(SOURCE_DIR, takes[0]);
}
if (!fs.existsSync(source)) { console.error(`  source not found: ${source}`); process.exit(1); }

/* ── measure ────────────────────────────────────────────────────────────────── */

const duration = probeDuration(source);
const x = decodeMono(source);
const rms = rmsEnvelope(x);
const flux = onsetFlux(rms);
const onsets = pickOnsets(flux, { minGapSec: 0.4 });
const ending = findEnding(rms, onsets);

// The beat WHERE THE ENDING IS, not an average over the take. The splice happens
// here, so this is the tempo that has to be right.
const tailOnsets = onsets.filter((o) => o.t >= Math.max(0, ending.stopSec - 20) && o.t <= ending.stopSec);
const beat = localBeat(tailOnsets) ?? localBeat(onsets);
if (!beat) { console.error("  could not measure a beat — is this file music?"); process.exit(1); }
const { beatSec, barSec } = beat;

/*
 * The ending window.
 *
 * It starts one bar before the final hit, so the bed plays a full bar INTO the
 * resolution rather than arriving at it cold, and it runs as far as the ring-out
 * is usable. `quietSec` is where the file stops carrying signal; back off a
 * little so the bed does not end on the digital-silence boundary.
 */
const endingStart = (() => {
  const target = ending.stopSec - barSec;
  // Snap to the measured onset nearest the target: the bar line, as played.
  return onsets.reduce((best, o) => (Math.abs(o.t - target) < Math.abs(best - target) ? o.t : best), target);
})();
const endingMax = Math.max(endingStart + barSec, ending.quietSec - 0.15);

const CROSSFADE = Number(barSec.toFixed(3)); // one bar, equal-power
/**
 * How long an ending we aim for: one bar of music leading into the resolution,
 * plus about four seconds of ring-out after it. The arithmetic below adjusts it
 * per cut, because the ring-out is the free variable.
 */
const END_TARGET = Math.min(endingMax - endingStart, barSec + 4.0);

/*
 * Candidate body starts: an onset that is clearly louder than the two seconds
 * before it. That is what a "clean entry" is — the track coming back in after a
 * breakdown, or its own opening. Scored, not hand-picked, so a new take works.
 */
const strongest = onsets.reduce((m, o) => Math.max(m, o.strength), 0);
const entries = onsets
  .filter((o) => o.t < endingStart - barSec * 2)
  .map((o) => {
    const before = rmsBetween(rms, Math.max(0, o.t - 2), o.t);
    const after = rmsBetween(rms, o.t, o.t + 2);
    return {
      t: o.t,
      strength: Number(o.strength.toFixed(4)),
      // How much louder it gets. A re-entry after a breakdown scores high; a
      // point in the middle of a steady passage scores about 1.
      lift: Number((after / (before + 1e-9)).toFixed(3)),
      after: Number(after.toFixed(5)),
      relStrength: Number((o.strength / strongest).toFixed(3)),
    };
  });

/**
 * Pick a body start for a cut of length `L`.
 *
 * Constraints: the body has to fit between the start and the ending window, and
 * it should sit in material with some energy in it. Among what fits, prefer the
 * cleanest entry — but weight the onset's own strength too, so a lift caused by
 * the take merely getting louder does not beat an actual downbeat.
 */
const pickBody = (L) => {
  const bodyTargetLen = L - END_TARGET + CROSSFADE;
  const viable = entries.filter((e) => e.t + bodyTargetLen <= endingStart + 0.001 && e.t >= 0);
  if (!viable.length) return null;
  const loudest = Math.max(...viable.map((e) => e.after));
  const scored = viable.map((e) => ({
    ...e,
    score: Number((Math.min(3, e.lift) * (0.45 + 0.55 * (e.after / loudest)) * (0.5 + 0.5 * e.relStrength)).toFixed(4)),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored;
};

const beds = [];
for (const L of CUTS) {
  const candidates = pickBody(L);
  if (!candidates) {
    console.error(`\n  the ${L}s bed does not fit: the take is ${duration.toFixed(2)}s and its ending starts at ${endingStart.toFixed(2)}s.\n  A ${L}s cut needs about ${(L - END_TARGET + CROSSFADE).toFixed(1)}s of body before that.\n`);
    process.exit(1);
  }
  const start = candidates[0];

  // Body end: the measured onset nearest the arithmetic target, so the splice
  // lands on a beat. Then the ring-out absorbs whatever that moved.
  const bodyTargetEnd = start.t + (L - END_TARGET + CROSSFADE);
  const bodyEnd = onsets
    .filter((o) => o.t > start.t + barSec && o.t <= endingStart + 0.001)
    .reduce((best, o) => (Math.abs(o.t - bodyTargetEnd) < Math.abs(best - bodyTargetEnd) ? o.t : best), bodyTargetEnd);

  const bodyLen = Number((bodyEnd - start.t).toFixed(4));
  const endLen = Number((L - bodyLen + CROSSFADE).toFixed(4));

  if (endingStart + endLen > endingMax + 0.001) {
    console.error(`\n  the ${L}s bed wants a ${endLen.toFixed(2)}s ending but only ${(endingMax - endingStart).toFixed(2)}s of ring-out exists.\n`);
    process.exit(1);
  }
  if (endLen <= CROSSFADE) {
    console.error(`\n  the ${L}s bed's ending (${endLen.toFixed(2)}s) is shorter than the crossfade (${CROSSFADE}s).\n`);
    process.exit(1);
  }

  beds.push({
    cut: String(L),
    file: `audio/bed-${L}.mp3`,
    bodyStartSec: Number(start.t.toFixed(4)),
    bodyEndSec: Number(bodyEnd.toFixed(4)),
    bodyLenSec: bodyLen,
    endingStartSec: Number(endingStart.toFixed(4)),
    endingLenSec: endLen,
    crossfadeSec: CROSSFADE,
    /** What the two pieces should add up to. The gate re-measures the file. */
    expectedSec: Number((bodyLen + endLen - CROSSFADE).toFixed(4)),
    entry: { lift: start.lift, relStrength: start.relStrength, score: start.score },
  });
}

const plan = {
  $comment:
    "Generated by tools/plan-beds.mjs — do not hand-edit. Every number is measured from the source take, " +
    "so replacing the track is one command. tools/prepare-bed.ps1 consumes this; tools/build-music.mjs then " +
    "measures the DELIVERED beds and writes src/data/music.json.",
  source: path.relative(ROOT, source).split(path.sep).join("/"),
  sourceDurationSec: Number(duration.toFixed(3)),
  beatSec,
  barSec,
  bpm: Number((60 / beatSec).toFixed(2)),
  finalHitSec: ending.stopSec,
  ringOutEndsSec: ending.quietSec,
  endingStartSec: Number(endingStart.toFixed(4)),
  crossfadeSec: CROSSFADE,
  targetLufs: -16,
  targetTruePeakDb: -1.5,
  beds,
};

fs.mkdirSync(path.dirname(PLAN_FILE), { recursive: true });
fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2) + "\n");

if (JSON_OUT) { console.log(JSON.stringify(plan, null, 2)); process.exit(0); }

console.log(`\n  plan-beds · ${plan.source}`);
console.log(`    ${plan.sourceDurationSec}s · beat ${beatSec}s (${plan.bpm} BPM) · bar ${barSec}s`);
console.log(`    final hit at ${plan.finalHitSec}s · ring-out usable to ${plan.ringOutEndsSec}s`);
console.log(`    ending window starts ${plan.endingStartSec}s · crossfade ${CROSSFADE}s (one bar, equal-power)\n`);
console.log("    cut    body window            len      ending            len    total   entry lift");
for (const b of plan.beds) {
  console.log(
    `    ${b.cut.padStart(3)}s   ${b.bodyStartSec.toFixed(2).padStart(7)}s -> ${b.bodyEndSec.toFixed(2).padStart(7)}s  ${b.bodyLenSec.toFixed(2).padStart(7)}s   ` +
    `${b.endingStartSec.toFixed(2)}s +${b.endingLenSec.toFixed(2).padStart(5)}s  ${b.endingLenSec.toFixed(2).padStart(5)}s  ${b.expectedSec.toFixed(2).padStart(7)}s   ${b.entry.lift.toFixed(2)}x`,
  );
}
console.log(`\n  wrote ${path.relative(ROOT, PLAN_FILE)}\n`);
