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

import { loadFilm, loadFilmForVersion } from "./lib/load-core.mjs";
import { mixAndMeasure } from "./lib/mix.mjs";

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
 * How much of a cut's runtime the duck may be on for.
 *
 * ⚠ The number that names the original defect. Past about a third, the music is
 * not giving way to anything — it is simply quieter, and the film measures
 * quiet. It was 50-73 %.
 */
const DUCK_MAX_FRACTION = 0.3;

const rows = [];
let measured = 0;

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
        `TP ${r.truePeakDb.toFixed(1)}  LRA ${r.lra.toFixed(1)}  duck ${(r.duckedFraction * 100).toFixed(0)} %` +
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
    if (r.truePeakDb > TRUE_PEAK_MAX + 1e-9) {
      fail(
        "peak",
        `${version} ${cut}s`,
        `true peak ${r.truePeakDb.toFixed(1)} dBTP, over the ${TRUE_PEAK_MAX} dBTP ceiling — ` +
          "a platform limiter will pull it down and the mix will not be the mix that was approved",
      );
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
  if (failures.length === 0) {
    console.log("\n  ✓ every cut lands in the window, under the peak, with the duck a duck\n");
  } else {
    console.log("");
    for (const f of failures) console.log(`  ✗ [${f.kind}] ${f.subject}\n      ${f.detail}`);
    console.log("");
  }
}

process.exit(failures.length === 0 ? 0 : 1);
