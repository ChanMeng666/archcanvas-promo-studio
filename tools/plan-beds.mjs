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
 * ── The beds are VERSIONED, per take ────────────────────────────────────────
 *
 * Every bed lands under `public/audio/beds/<version>/`, where `<version>` is a
 * letter and the take's own name — `A-confident-arrival`, `B-<the-next-take>`.
 * The letter is assigned here, from what `src/data/music.json` already knows
 * about, and a take that already has one keeps it.
 *
 * **Why a folder per take and not four files that get overwritten.** A master is
 * the picture AND the music, the scene boundaries snap to the take's own
 * downbeats, and a new take has its own beat grid — so re-cutting the beds in
 * place does not just change the sound of an old master, it makes that master
 * unreproducible. Both versions are kept, so both have to stay renderable:
 * `docs/release.md`.
 *
 * Usage:
 *   node tools/plan-beds.mjs                          # the take in audio/source/
 *   node tools/plan-beds.mjs --source <file> [--json]
 *   node tools/plan-beds.mjs --version C-some-name    # override the derived id
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
const MUSIC_FILE = path.join(ROOT, "src", "data", "music.json");

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

/* ── the version id ─────────────────────────────────────────────────────────── */

/**
 * `A-confident-arrival` — a sequence letter and the take's own name.
 *
 * The letter is what makes a chronology readable at a glance in `out/masters/`
 * and in a release; the slug is what makes it say WHICH take without anyone
 * having to look it up. Neither is typed: both are derived, and re-running on a
 * take that already has a version keeps that version's letter, so a re-cut of A
 * lands back in A's folder rather than quietly becoming B.
 */
const VERSION_RE = /^([A-Z])-(.+)$/;
const slugify = (name) =>
  name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const knownVersions = (() => {
  if (!fs.existsSync(MUSIC_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(MUSIC_FILE, "utf8")).versions ?? {}; } catch { return {}; }
})();

const version = (() => {
  const explicit = val("--version");
  if (explicit) {
    if (!VERSION_RE.test(explicit)) {
      console.error(`\n  --version ${explicit} is not shaped like a version id. It is a capital letter, a hyphen and a slug: B-bright-daylight.\n`);
      process.exit(1);
    }
    return explicit;
  }
  const slug = slugify(path.basename(source));
  for (const id of Object.keys(knownVersions)) {
    const m = VERSION_RE.exec(id);
    if (m && m[2] === slug) return id;
  }
  const used = new Set(Object.keys(knownVersions).map((id) => VERSION_RE.exec(id)?.[1]).filter(Boolean));
  const letter = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].find((c) => !used.has(c));
  if (!letter) {
    console.error(`\n  twenty-six music versions is not a thing this was built for. Pass --version.\n`);
    process.exit(1);
  }
  return `${letter}-${slug}`;
})();

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
 * The loudest two seconds anywhere in the take — the yardstick a body's own
 * level is measured against. The same normalisation `tools/analyze-music.mjs`
 * uses for its window table, so the two tools agree about what "live" means.
 */
const loudestBlock = (() => {
  let m = 0;
  for (let t = 0; t + 2 <= duration; t += 2) m = Math.max(m, rmsBetween(rms, t, t + 2));
  return m || 1e-9;
})();

/**
 * Pick a body start for a cut of length `L`.
 *
 * Constraints: the body has to fit between the start and the ending window, and
 * it should sit in material with some energy in it. Among what fits, prefer the
 * cleanest entry — but weight the onset's own strength too, so a lift caused by
 * the take merely getting louder does not beat an actual downbeat.
 *
 * ── The body term, and the take that made it necessary ──────────────────────
 *
 * Every other factor here describes the first two seconds. Nothing described the
 * other thirteen, or the other hundred and eighteen, and on a take whose quiet
 * material happens to come first that is not a small omission.
 *
 * `daylight-forward.mp3` opens from digital silence, so its very first onset
 * scores an infinite `lift` — capped at 3, which no musical re-entry can reach
 * (a return out of a breakdown measures about 1.4x). It therefore won every cut
 * length outright, and the 15 s bed it produced spent 9.3 of its 12.5 body
 * seconds in the two quietest sections in the track: mean body level 0.629 of
 * the take's loudest block, against 0.883 for a start on the final chorus. A
 * fifteen-second spot cannot afford to open on the thinnest nine seconds of its
 * own music, and nothing in the pipeline would have said so — the durations,
 * the loudness and the downbeat counts would all have been right.
 *
 * So the score is multiplied by the body's own mean level. It is one term, it is
 * the same quantity `analyze-music.mjs` already scores its windows on, and it is
 * **provably a no-op for version A**: replayed against `confident-arrival.mp3`
 * it re-picks 99.81 / 99.81 / 19.05 / 9.53 s, which is exactly what
 * `src/data/music.json` records that take's beds were cut at. On
 * `daylight-forward.mp3` it moves the 15 s bed from 0.14 s to 115.56 s — the
 * track's biggest lift, +6.92 dB — and leaves 30 / 60 / 120 where they were.
 */
const pickBody = (L) => {
  const bodyTargetLen = L - END_TARGET + CROSSFADE;
  const viable = entries.filter((e) => e.t + bodyTargetLen <= endingStart + 0.001 && e.t >= 0);
  if (!viable.length) return null;
  const loudest = Math.max(...viable.map((e) => e.after));
  const scored = viable.map((e) => {
    const body = rmsBetween(rms, e.t, e.t + bodyTargetLen) / loudestBlock;
    return {
      ...e,
      body: Number(body.toFixed(4)),
      score: Number((Math.min(3, e.lift) * (0.45 + 0.55 * (e.after / loudest)) * (0.5 + 0.5 * e.relStrength) * body).toFixed(4)),
    };
  });
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
    file: `audio/beds/${version}/bed-${L}.mp3`,
    bodyStartSec: Number(start.t.toFixed(4)),
    bodyEndSec: Number(bodyEnd.toFixed(4)),
    bodyLenSec: bodyLen,
    endingStartSec: Number(endingStart.toFixed(4)),
    endingLenSec: endLen,
    crossfadeSec: CROSSFADE,
    /** What the two pieces should add up to. The gate re-measures the file. */
    expectedSec: Number((bodyLen + endLen - CROSSFADE).toFixed(4)),
    entry: { lift: start.lift, relStrength: start.relStrength, body: start.body, score: start.score },
  });
}

const plan = {
  $comment:
    "Generated by tools/plan-beds.mjs — do not hand-edit. Every number is measured from the source take, " +
    "so replacing the track is one command. tools/prepare-bed.ps1 consumes this; tools/build-music.mjs then " +
    "measures the DELIVERED beds and writes src/data/music.json.",
  version,
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

console.log(`\n  plan-beds · ${plan.source} · version ${plan.version}`);
console.log(`    ${plan.sourceDurationSec}s · beat ${beatSec}s (${plan.bpm} BPM) · bar ${barSec}s`);
console.log(`    final hit at ${plan.finalHitSec}s · ring-out usable to ${plan.ringOutEndsSec}s`);
console.log(`    ending window starts ${plan.endingStartSec}s · crossfade ${CROSSFADE}s (one bar, equal-power)\n`);
console.log("    cut    body window            len      ending            len    total   entry lift   body level");
for (const b of plan.beds) {
  console.log(
    `    ${b.cut.padStart(3)}s   ${b.bodyStartSec.toFixed(2).padStart(7)}s -> ${b.bodyEndSec.toFixed(2).padStart(7)}s  ${b.bodyLenSec.toFixed(2).padStart(7)}s   ` +
    `${b.endingStartSec.toFixed(2)}s +${b.endingLenSec.toFixed(2).padStart(5)}s  ${b.endingLenSec.toFixed(2).padStart(5)}s  ${b.expectedSec.toFixed(2).padStart(7)}s   ${b.entry.lift.toFixed(2).padStart(6)}x   ${b.entry.body.toFixed(3).padStart(8)}`,
  );
}
console.log(`\n  wrote ${path.relative(ROOT, PLAN_FILE)}\n`);
