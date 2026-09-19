/**
 * The small amount of signal processing the bed pipeline needs, in one place.
 *
 * `tools/analyze-music.mjs` deliberately does NOT import this. That file is a
 * near-verbatim port of the sibling film's analyser, kept standalone so it can
 * be diffed against its original; its header explains every choice in it and
 * splitting it would make that argument unreadable. What lives here is the
 * subset `plan-beds.mjs` and `build-music.mjs` both need, and those two must
 * agree exactly — the plan measures the SOURCE, the manifest measures the
 * DELIVERED bed, and if they disagreed about what an onset is, the downbeats
 * written into `music.json` would not be the ones the bed was cut on.
 *
 * The one rule carried over from the analyser, because it fails quietly:
 * **smooth the log envelope BEFORE differencing it.** Measured on the reference
 * take, raw flux locks onto 109.10 BPM and smoothed flux onto 98.35, and 98.35
 * is the figure two earlier projects independently recorded. Raw flux locks onto
 * the frame-scale noise floor, which in this material is loud enough to out-vote
 * the beat.
 */
import { spawnSync } from "node:child_process";

export const SR = 8000;
export const HOP = 80; // samples = 10 ms

/**
 * Decode any container to mono float samples.
 *
 * `-vn` is not optional: a SUNO export carries an embedded mjpeg cover-art
 * stream, and without it ffmpeg tries to make sense of the picture.
 */
export const decodeMono = (file, rate = SR) => {
  const dec = spawnSync(
    "ffmpeg",
    ["-v", "error", "-vn", "-i", file, "-ac", "1", "-ar", String(rate), "-f", "s16le", "-"],
    { maxBuffer: 1 << 30, encoding: "buffer" },
  );
  if (dec.status !== 0) throw new Error(`ffmpeg decode failed for ${file}:\n${dec.stderr.toString().slice(-2000)}`);
  const raw = dec.stdout;
  const n = Math.floor(raw.length / 2);
  // Read through the Buffer rather than aliasing an Int16Array onto it — Node
  // may hand back an odd byteOffset and Int16Array throws on that, on some
  // inputs only.
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = raw.readInt16LE(i * 2) / 32768;
  return x;
};

/** 10 ms RMS envelope. */
export const rmsEnvelope = (x) => {
  const nFrames = Math.floor(x.length / HOP);
  const rms = new Float64Array(nFrames);
  for (let f = 0; f < nFrames; f++) {
    let acc = 0;
    const base = f * HOP;
    for (let i = 0; i < HOP; i++) { const v = x[base + i]; acc += v * v; }
    rms[f] = Math.sqrt(acc / HOP);
  }
  return rms;
};

/** Positive flux of the smoothed log envelope — see the header. */
export const onsetFlux = (rms) => {
  const n = rms.length;
  const logEnv = Float64Array.from(rms, (v) => Math.log10(v + 1e-6));
  const smoothed = new Float64Array(n);
  for (let f = 0; f < n; f++) {
    let acc = 0, c = 0;
    for (let k = -3; k <= 3; k++) { const j = f + k; if (j >= 0 && j < n) { acc += logEnv[j]; c++; } }
    smoothed[f] = acc / c;
  }
  const flux = new Float64Array(n);
  for (let f = 1; f < n; f++) flux[f] = Math.max(0, smoothed[f] - smoothed[f - 1]);
  return flux;
};

/**
 * Local maxima of the flux, thinned to a minimum spacing, in time order.
 * `minGapSec` keeps two readings of one transient from both surviving.
 */
export const pickOnsets = (flux, { minGapSec = 0.25, from = 0, to = Infinity } = {}) => {
  const a = Math.max(1, Math.round(from * 100));
  const z = Math.min(flux.length - 1, Math.round(to * 100));
  const peaks = [];
  for (let f = a; f < z; f++) if (flux[f] > flux[f - 1] && flux[f] >= flux[f + 1]) peaks.push({ t: f / 100, strength: flux[f] });
  peaks.sort((p, q) => q.strength - p.strength);
  const kept = [];
  for (const p of peaks) if (kept.every((k) => Math.abs(k.t - p.t) >= minGapSec)) kept.push(p);
  kept.sort((p, q) => p.t - q.t);
  return kept;
};

/**
 * The beat period where the music actually is, measured from the spacing
 * between onsets rather than from a global autocorrelation.
 *
 * **This is the whole reason a global grid is not used anywhere in this
 * pipeline.** Measured on `confident-arrival.mp3`, the best global beat phase
 * creeps about 0.2 s per 20 s block — so a downbeat grid extrapolated from the
 * start of the take is most of a beat wrong by 120 s, which is four times the
 * +/-150 ms window a scene boundary is allowed to snap within. A SUNO take is
 * generated audio, not a sequenced click track, and it does not hold one tempo
 * to the precision a 120-second extrapolation needs.
 *
 * The median of inter-onset intervals that are plausibly one beat apart is
 * robust to both a missed onset (gives 2x) and a subdivision (gives 0.5x),
 * because those land outside the accepted band rather than dragging a mean.
 */
export const localBeat = (onsets, { lo = 0.3, hi = 0.95 } = {}) => {
  const gaps = [];
  for (let i = 1; i < onsets.length; i++) {
    const d = onsets[i].t - onsets[i - 1].t;
    if (d >= lo && d <= hi) gaps.push(d);
  }
  if (!gaps.length) return null;
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  return { beatSec: Number(median.toFixed(4)), barSec: Number((median * 4).toFixed(4)), samples: gaps.length };
};

/**
 * Where the music stops, and where the file goes properly quiet.
 *
 * `stopSec`  — the last onset above a fraction of the take's strongest, i.e.
 *              the final hit. This is the thing an ending has to contain.
 * `quietSec` — the last frame above `floorDb` relative to full scale. Beyond
 *              this there is nothing left to use, so a bed must end before it.
 */
export const findEnding = (rms, onsets, { floorDb = -55, strongFrac = 0.35, levelFrac = 0.5 } = {}) => {
  const floor = Math.pow(10, floorDb / 20);
  let last = rms.length - 1;
  while (last > 0 && rms[last] < floor) last--;
  const quietSec = Number((last / 100).toFixed(3));

  /*
   * The level gate is load-bearing, and leaving it out gets the wrong answer
   * confidently.
   *
   * `flux` is computed on the LOG envelope, which makes it level-independent by
   * design — that is what stops a bed that swells 6 dB late from drowning every
   * early onset. The side effect is that a quiet ring-out produces onset
   * strengths in the same range as the loud body: on `confident-arrival.mp3` the
   * arrangement stops at 127.77 s, and without this gate the "final hit" came
   * back as 132.62 s, four and a half seconds into the decay. Every bed would
   * then have spliced its ending out of the tail and had no resolution in it at
   * all — and nothing downstream would have said so, because the durations and
   * the loudness would all have been right.
   *
   * So a candidate for the final hit must also sit in a passage that is still
   * playing: local RMS at least `levelFrac` of the take's median.
   */
  const sorted = Float64Array.from(rms).sort();
  const median = sorted[Math.floor(sorted.length / 2)] || 1e-9;
  const localLevel = (t) => {
    const a = Math.max(0, Math.round(t * 100));
    const z = Math.min(rms.length, a + 30); // 300 ms
    let s = 0;
    for (let f = a; f < z; f++) s += rms[f];
    return s / Math.max(1, z - a);
  };

  /*
   * `stopSec` is found by LEVEL, not by picking the last strong onset, and the
   * onset version was tried first and was wrong twice in different directions.
   *
   * Un-gated it returned 132.62 s (deep in the decay). Gated on level it
   * returned 125.98 s — because `pickOnsets` thins globally by strength, so
   * whether the genuine last hit at 127.77 s survives the thinning depends on
   * onsets elsewhere in the take. Neither failure is visible downstream.
   *
   * Where the ARRANGEMENT stops is a question about level and nothing else:
   * walk back from the end and find the last moment the track is still playing
   * at something like its own body level. That is robust to which onsets
   * happened to survive, and to how the ending was arranged.
   */
  let stopFrame = Math.min(rms.length - 1, Math.round(quietSec * 100));
  while (stopFrame > 0 && localLevel(stopFrame / 100) < levelFrac * median) stopFrame -= 1;
  const stopSec = Number((stopFrame / 100).toFixed(3));

  // Kept for callers that want to know how emphatic that last moment was.
  const strongest = onsets.reduce((m, o) => Math.max(m, o.strength), 0);
  const lastStrongOnset = onsets.filter((o) => o.strength >= strongFrac * strongest && o.t <= stopSec).pop() ?? null;

  return { stopSec, quietSec, medianRms: median, lastStrongOnsetSec: lastStrongOnset?.t ?? null };
};

/** Mean RMS between two times, for scoring how quiet or loud a passage is. */
export const rmsBetween = (rms, t0, t1) => {
  const a = Math.max(0, Math.round(t0 * 100));
  const z = Math.min(rms.length, Math.round(t1 * 100));
  let s = 0;
  for (let f = a; f < z; f++) s += rms[f];
  return s / Math.max(1, z - a);
};

/** Duration in seconds, from the container. */
export const probeDuration = (file) => {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffprobe failed for ${file}`);
  return Number(String(r.stdout).trim());
};

/** Integrated loudness and true peak, via ebur128. */
export const measureLoudness = (file) => {
  const r = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-nostdin", "-v", "info", "-vn", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"],
    { encoding: "utf8", maxBuffer: 1 << 28 },
  );
  const text = r.stderr ?? "";
  // The summary block at the end is what matters; take the LAST match of each.
  const grab = (label) => {
    const m = [...text.matchAll(new RegExp(`${label}:\\s*(-?[\\d.]+|-?inf)`, "gi"))];
    if (!m.length) return null;
    const v = m[m.length - 1][1];
    return v.includes("inf") ? -Infinity : Number(v);
  };
  return { lufs: grab("I"), truePeakDb: grab("Peak"), lra: grab("LRA") };
};
