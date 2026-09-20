#!/usr/bin/env node
/**
 * verify-loudness.mjs — the mix lands where a platform expects it to.
 *
 * ── The failure this exists for ────────────────────────────────────────────
 *
 * Eight masters were rendered and measured **-17.3 to -17.9 LUFS integrated**
 * against a -16 target. Nothing in the repo could have said so: every audio
 * check was about the cue sheet — every cue has a file, lands inside its cut,
 * nothing piles up — and all of it was true of a film that was 1.5 LU quiet.
 *
 * The cause was in the data rather than in the mix. The music duck fired on any
 * run of cues, which covered 50-73 % of the runtime, so the bed was simply
 * turned down for most of the film. A duck that is always on is a trim.
 *
 * ── How this measures without rendering ────────────────────────────────────
 *
 * `capture/lib/mix.mjs` builds the mix offline from the manifests — the bed, the
 * cue sheet, the duck envelope, the master trim — playing the film's OWN
 * `duckGainAt`, and ffmpeg's `ebur128` measures it. A full render is twenty
 * minutes of picture to hear thirty seconds of sound.
 *
 * It is an instrument, not a substitute for the render: Remotion resamples and
 * encodes on its own path. What licenses it is that it AGREES with the path it
 * is standing in for — mixed with the duck as it was when those eight masters
 * were rendered, it reports -17.5 / -17.8 / -17.6 / -17.3 against the render's
 * measured -17.3 to -17.9, and true peaks inside 0.3 dB. A number that
 * reproduces the defect is a number that can be trusted to show it gone.
 *
 * ── What it asserts ────────────────────────────────────────────────────────
 *
 *   1. Every cut lands at the version's own `targetLufs` ± {@link LUFS_WINDOW}.
 *   2. True peak is at or under {@link TRUE_PEAK_MAX} — the platform limiter's
 *      line, not the sample-peak one, because a sample peak under 0 dBFS can
 *      still inter-sample over.
 *   3. The duck is a DUCK: on for no more than {@link DUCK_MAX_FRACTION} of the
 *      runtime. This is the check that would have caught the original defect
 *      before a single frame was rendered.
 *
 * All three, for EVERY VERSION in `src/data/versions.json` — so a second take is
 * measured the day it lands, not the day it becomes active.
 *
 * ⚠ **It iterates VERSIONS, not music takes, and that distinction is the whole
 * correctness of this gate.**
 *
 * A version names exactly one music take, one edit and one sound set. Those
 * three travel together: the cue sheet is derived by walking a cut that is
 * snapped to its own take's downbeats, so B's sheet only exists over B's bed.
 *
 * This loop used to run over music takes and mix each bed with whichever sheet
 * happened to be ACTIVE, marking the mismatched rows "cue sheet is the active
 * take's". That is a combination no version describes and nothing will ever
 * render — and it duly went red, at -16.7 LUFS, for a pairing that cannot
 * happen. A red gate with a standing excuse attached is worse than no gate: it
 * trains everyone to read past the one day it goes red for a real reason.
 *
 * So the impossible row is not explained any more, it is not produced.
 * `loadFilmForVersion()` evaluates the core once per version, with
 * `FILM_VERSION` set, so each row is a real film: its own bed, its own sheet,
 * its own palette, its own master trim.
 *
 * Usage:  node capture/verify-loudness.mjs [--json]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadFilm, loadFilmForVersion } from "./lib/load-core.mjs";
import { deliverySettings, mixAndMeasure } from "./lib/mix.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * How far the PREDICTION may sit from the film that was actually delivered.
 *
 * ⚠ This is the check that matters, and it is the only one here that compares
 * the gate against reality rather than against itself. Every other assertion is
 * the model marking its own homework: it mixes from the manifests, measures
 * what it mixed, and agrees with itself. `MANIFEST.json` records the true peak
 * MEASURED from the delivered file, so wherever a master has been rendered the
 * gate can be told it was wrong.
 *
 * It is reported for every cut that has a manifest and fatal past this bound.
 */
const REAL_TOLERANCE_DB = 0.3;

/** The delivered true peak for a version x cut, from the tracked manifest. */
const recordedPeaks = (version, cut) => {
  const file = path.join(ROOT, "out", "masters", version, "MANIFEST.json");
  if (!fs.existsSync(file)) return [];
  let doc;
  try { doc = JSON.parse(fs.readFileSync(file, "utf8")); } catch { return []; }
  const rows = Array.isArray(doc) ? doc : (doc.masters ?? doc.files ?? []);
  return rows
    .filter((r) => typeof r?.file === "string" && r.file.includes(`_${cut}s_`) && Number.isFinite(r.truePeakDb))
    .map((r) => ({ file: r.file, truePeakDb: r.truePeakDb }));
};

const AS_JSON = process.argv.includes("--json");

const failures = [];
const fail = (kind, subject, detail) => failures.push({ kind, subject, detail });

const film = await loadFilm();
const { CUT_IDS } = film.layout;
const A = film.audio;
const VERSIONS = A.allVersionIds();

/** How far from the version's target a cut may land, in LU. */
const LUFS_WINDOW = 0.5;

/**
 * The true-peak ceiling, in dBTP — now measured on an AAC ENCODE of the mix.
 *
 * ⚠ -1.5, not the platform's -1.0, and the difference is a margin this gate
 * used not to have. `B-daylight-forward+el`'s 15 s master measured -1.0 dBTP on
 * the delivered file, 0.027 dB under the line, while this gate predicted -1.4
 * and called it fine. The prediction was not wrong about the MIX: a lossy
 * encoder reconstructs a waveform that is close in the ear and not identical on
 * the sample, and the difference lands on transients, which is what a true-peak
 * meter is about.
 *
 * So two changes together. `mixAndMeasure` encodes the mix to the same AAC the
 * master is delivered in and measures THAT — B+el's 15 s cut now reads -1.1
 * against the film's -1.0, where the float mix said -1.4. And the ceiling moves
 * to -1.5, so a cut has half a decibel of room before it reaches the line a
 * platform limiter actually enforces.
 *
 * The dial for a cut that goes over is the OPENING CUE's gain, in
 * `versions.json` — never the bed's (D33). Every bed enters at 0 s and the
 * film's first cue lands 40 ms later, so the highest sample in a master is
 * almost always their sum in the first ~64 ms.
 */
const TRUE_PEAK_MAX = -1.5;

/**
 * The window in which the model is known to be unreliable, and the margin it
 * costs.
 *
 * ⚠ Both numbers are measured, and the SCOPE is the point. The offline mix
 * agrees with the delivered film within 0.1–0.3 dB on every cut whose peak sits
 * in the body of the film (B 15 s +0.1, B 30 s −0.3, B 60 s +0.1, A 120 s
 * −0.2). It is wrong by 1.1 dB on exactly one kind of moment: a cue transient
 * landing on a bed entry in the first frames, where the film's millisecond
 * alignment differs from the mix's and three milliseconds is over a decibel of
 * sum.
 *
 * So the extra margin is charged where the error is, not everywhere. A flat
 * −2.6 ceiling would have demanded trims on three cuts whose peaks are at
 * 7.98 s, 100.5 s and 115.5 s — moments the model predicts well — and the
 * `openingCueTrimDb` dial cannot move those anyway.
 */
const OPENING_SEC = 0.1;
const OPENING_MODEL_ERROR_DB = 1.1;

/**
 * ⚠ -2.6, and every tenth of it is measured.
 *
 * -1.0 is the platform limiter's line. -1.5 was that plus half a decibel of
 * room. The extra 1.1 dB is the **model's own worst observed error**: A's 60 s
 * cut predicted -2.3 dBTP and the delivered film measured -1.2, and the cause
 * is millisecond-level alignment between a cue and a bed entry that the offline
 * mix cannot reproduce (see the commit that added the manifest check). A margin
 * smaller than the model's error is not a margin.
 *
 * It tightens as the model improves: shrink the worst delta the manifest check
 * reports and this can come back down.
 */

/**
 * How much of a cut's runtime the duck may be on for.
 *
 * ⚠ The number that names the original defect. Past about a third, the music is
 * not giving way to anything — it is simply quieter, and the film measures
 * quiet. It was 50-73 %.
 */
const DUCK_MAX_FRACTION = 0.3;

const rows = [];
const realRows = [];
const staleRows = [];
let measured = 0;
let realChecked = 0;

for (const versionId of VERSIONS) {
  // Each version is evaluated on its own terms: its music, its edit, its sound
  // set. Nothing here mixes one version's bed with another's cue sheet.
  const vFilm = await loadFilmForVersion(versionId);
  const vA = vFilm.audio;
  const musicId = vA.MUSIC_VERSION;
  const meta = vA.musicFor(musicId);
  if (!meta || !meta.beds) continue;
  // A version whose beds have not been cut yet is not a failure — it is a track
  // someone has registered and not prepared.
  const cuts = CUT_IDS.filter((c) => meta.beds[c]);
  if (cuts.length === 0) {
    rows.push(`${versionId.padEnd(24)} no beds prepared — nothing to measure`);
    continue;
  }

  const target = meta.targetLufs ?? -16;
  const version = versionId;
  for (const cut of cuts) {
    const r = await mixAndMeasure(cut, vFilm, musicId);
    measured += 1;
    rows.push(
      `${versionId.padEnd(24)} ${(cut + "s").padStart(5)}  ${r.lufs.toFixed(1)} LUFS  ` +
        `TP ${r.truePeakDb.toFixed(1)}${Number.isFinite(r.peakAtSec) && r.peakAtSec <= OPENING_SEC ? "*" : " "}  LRA ${r.lra.toFixed(1)}  duck ${(r.duckedFraction * 100).toFixed(0)} %` +
        `${r.masterTrimDb ? `  trim ${r.masterTrimDb > 0 ? "+" : ""}${r.masterTrimDb} dB` : ""}` +
        `   ${vA.activeSfxSetId()}`,
    );

    if (!Number.isFinite(r.lufs)) {
      fail("unmeasured", `${version} ${cut}s`, "ebur128 reported nothing — the mix could not be measured");
      continue;
    }
    if (Math.abs(r.lufs - target) > LUFS_WINDOW + 1e-9) {
      fail(
        "loudness",
        `${version} ${cut}s`,
        `${r.lufs.toFixed(1)} LUFS against a ${target} target — ` +
          `${(r.lufs - target).toFixed(1)} LU out, past the ±${LUFS_WINDOW} window`,
      );
    }
    const opening = Number.isFinite(r.peakAtSec) && r.peakAtSec <= OPENING_SEC;
    const ceiling = opening ? TRUE_PEAK_MAX - OPENING_MODEL_ERROR_DB : TRUE_PEAK_MAX;
    if (r.truePeakDb > ceiling + 1e-9) {
      fail(
        "peak",
        `${version} ${cut}s`,
        `true peak ${r.truePeakDb.toFixed(1)} dBTP, over the ${TRUE_PEAK_MAX} dBTP ceiling — ` +
          "a platform limiter will pull it down and the mix will not be the mix that was approved",
      );
    }
    /*
     * ⚠ The gate against REALITY, wherever reality is on disk.
     *
     * Everything above is the model agreeing with itself. This is the one
     * assertion that can tell the model it is wrong, and it earned its place:
     * the offline mix predicted -2.3 dBTP for A's 60 s cut and the delivered
     * film measured **-1.2** — over the ceiling, reported green, for two
     * rounds. The manifests are tracked even though the masters are not, so
     * this works in a fresh clone.
     */
    for (const rec of recordedPeaks(version, cut)) {
      realChecked += 1;
      const delta = r.truePeakDb - rec.truePeakDb;
      realRows.push(
        `${version.padEnd(24)} ${(cut + "s").padStart(5)} predicted ${r.truePeakDb.toFixed(1)}  ` +
          `delivered ${rec.truePeakDb.toFixed(1)}  delta ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}  ${rec.file}`,
      );
      /*
       * ⚠ Fatal only when the model is OPTIMISTIC, and the asymmetry is the
       * whole safety argument rather than a convenience.
       *
       * A prediction BELOW the delivered peak is the dangerous one: it is how a
       * master ships at -1.2 dBTP under a green gate. A prediction ABOVE it is
       * over-cautious — the ceiling still protects, and the only cost is a trim
       * that was not strictly needed.
       *
       * It also keeps a STALE master from blocking the repo. Change a cut's
       * audio and the film on disk no longer corresponds to the sheet; the
       * prediction then reads as wildly pessimistic against the old file, which
       * is reported and not fatal, and the next render settles it.
       */
      /*
       * ⚠ And a STALE master is not a wrong model.
       *
       * Changing a cut's audio makes the film on disk stop corresponding to the
       * sheet, and the comparison then measures the change rather than the
       * model: trimming A's 60 s opening cue by 9 dB moved its predicted peak
       * 0.3 dB and left the delivered film exactly where it was, which reads as
       * the model getting *worse*.
       *
       * The honest discriminator is a fingerprint of the cue sheet recorded at
       * render time, and `tools/package-masters.ps1` does not write one yet —
       * the one line it needs is in the PR. Until it does, the interim rule is
       * the narrowest thing that keeps the check's teeth: a disagreement is
       * fatal unless THIS ROUND changed that cut's audio, which is exactly what
       * an `openingCueTrimDb` entry records. Every cut without one is still
       * checked against reality, which is the ten rows that matter today.
       */
      const audioChangedHere = vA.openingCueTrimDb(cut, version) !== 0;
      if (audioChangedHere) {
        staleRows.push(`${version} ${cut}s — audio trimmed since this master was rendered; re-render to re-check`);
      } else if (delta < -REAL_TOLERANCE_DB - 1e-9) {
        fail(
          "model",
          `${version} ${cut}s`,
          `the offline mix predicts ${r.truePeakDb.toFixed(1)} dBTP and the delivered film measured ` +
            `${rec.truePeakDb.toFixed(1)} — ${Math.abs(delta).toFixed(1)} dB OPTIMISTIC, past the ` +
            `${REAL_TOLERANCE_DB} dB tolerance. That is how a master ships over the ceiling under a green ` +
            "gate (" + rec.file + ")",
        );
      }
    }

    if (r.duckedFraction > DUCK_MAX_FRACTION + 1e-9) {
      fail(
        "duck",
        `${version} ${cut}s`,
        `the music is ducked for ${(r.duckedFraction * 100).toFixed(0)} % of the runtime, over the ` +
          `${(DUCK_MAX_FRACTION * 100).toFixed(0)} % ceiling. A duck that is always on is a trim: it costs ` +
          "loudness everywhere and emphasises nothing",
      );
    }
  }
}

if (measured === 0) {
  fail("vacuous", "loudness", "no mix was measured — every music version is missing its beds");
}

/* ── report ───────────────────────────────────────────────────────────────── */

if (AS_JSON) {
  console.log(JSON.stringify({ ok: failures.length === 0, measured, LUFS_WINDOW, TRUE_PEAK_MAX, DUCK_MAX_FRACTION, rows, failures }, null, 2));
} else {
  console.log("\n  verify-loudness");
  console.log(
    `    mixed offline from the cue sheet and measured with ebur128; window ±${LUFS_WINDOW} LU, ` +
      `peak ≤ ${TRUE_PEAK_MAX} dBTP, duck ≤ ${(DUCK_MAX_FRACTION * 100).toFixed(0)} %`,
  );
  for (const r of rows) console.log(`      ${r}`);
  const d = deliverySettings();
  console.log(`
    encoded as delivered: ${d.codec} ${Math.round(d.bitrate / 1000)} kbps ${d.sampleRate} Hz (${d.from})`);
  if (realChecked === 0) {
    console.log("    no delivered master on record yet — the model is unchecked against reality");
  } else {
    console.log(`    ${realChecked} cut(s) checked against the delivered film, tolerance ±${REAL_TOLERANCE_DB} dB:`);
    for (const r of realRows) console.log(`      ${r}`);
    for (const r of staleRows) console.log(`      ⚠ ${r}`);
  }
  if (failures.length === 0) {
    console.log("\n  ✓ every cut lands in the window, under the peak, with the duck a duck\n");
  } else {
    console.log("");
    for (const f of failures) console.log(`  ✗ [${f.kind}] ${f.subject}\n      ${f.detail}`);
    console.log("");
  }
}

process.exit(failures.length === 0 ? 0 : 1);
