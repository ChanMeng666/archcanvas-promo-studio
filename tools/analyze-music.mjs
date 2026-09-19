#!/usr/bin/env node
/**
 * Measure a music take so a bed can be CUT from it by number rather than by ear.
 *
 * ── How this differs from the sibling film's copy of the same tool ───────────
 *
 * `../archcanvas-promo-remotion/tools/analyze-music.mjs` serves ONE continuous
 * 75-second camera move. It has no cuts, so it has no beat grid to hit; what it
 * needs from a track is a *shape* — quiet open, one lift landing at the
 * reversal. Almost all of its output is the shape-led window table.
 *
 * This film is the opposite. It **cuts**, four times over, at 15 / 30 / 60 /
 * 120 s, and every scene boundary wants to land on a downbeat. So the DSP core
 * is inherited verbatim (it is validated and the header below says why every
 * line of it is the way it is) and the *reporting* is rebuilt around three new
 * questions this project actually asks:
 *
 *   1. **Which take is brightest?** The founder's direction is "bright, lively,
 *      fast". That is a measurable thing — spectral centroid and a high/low band
 *      ratio — and picking a bed by adjective is how you end up with the lullaby
 *      the sibling film had to re-brief. See `--json` -> `brightness`.
 *   2. **Where are the downbeats?** Not "where is the one big accent". The whole
 *      bar grid, exported, so `prepare-bed.ps1` can cut on one and WP-7's
 *      `snapToDownbeat` can land a scene on one.
 *   3. **Where does a cut of length L start and end well?** A bar-aligned start
 *      at a *phrase* boundary (4 bars), and an end that can be resolved.
 *
 * ── The DSP core, inherited. Do not re-derive these. ─────────────────────────
 *
 * Method: decode to 8 kHz mono, take a 10 ms RMS envelope, difference it in the
 * log domain and half-wave rectify (positive energy flux only — a note starting
 * is an onset, a note ending is not). Log domain because a bed that swells 6 dB
 * late would otherwise drown every early onset; we want attacks, not loudness.
 *
 *   - **Smooth the log envelope BEFORE differencing (±30 ms mean).** This is not
 *     cosmetic and it is not optional, and it fails *quietly*: you get a
 *     confident number that is simply wrong. Measured on
 *     `../archcanvas-promo-video/audio/source/drafting-room-full.mp3`, raw flux
 *     locks onto 109.10 BPM and smoothed flux onto 98.35 — and 98.35 is the
 *     figure two earlier projects independently recorded. The raw-flux answer is
 *     not a near miss and not an octave error; it is a lock onto the frame-scale
 *     noise floor, which in this kind of material is loud enough to out-vote the
 *     beat. Every stage here runs on the one smoothed `flux` array and there is
 *     deliberately no unsmoothed copy to reach for by accident.
 *   - **Fractional autocorrelation lag.** Rounding the lag to whole 10 ms frames
 *     makes neighbouring BPM values share a lag, the curve becomes plateaus and
 *     every local peak hides.
 *   - **Octave disambiguation by phase lock, restricted to the octave family.**
 *     Autocorrelation peaks at the bar as readily as at the beat, so its raw
 *     maximum is often a half or a quarter of the true tempo. A correct tempo
 *     holds phase across the whole track; a wrong one drifts. `drift` is the
 *     column to read — the winner is the small one, not the loud one. **Only the
 *     raw best's octave family (x0.25 .. x4) may win.** An unrelated tempo can
 *     score a low drift by luck, and in the sibling repo one did. Other local
 *     peaks are printed as context and cannot be selected.
 *
 * Usage:
 *   node tools/analyze-music.mjs "<audio>" [--cut 30] [--top 14] [--json]
 *   node tools/analyze-music.mjs "<audio>" --compare        # brightness only, fast
 *
 * Read-only. Cutting is tools/prepare-bed.ps1.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const VALUED = new Set(["--cut", "--top", "--probe"]);
const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && VALUED.has(argv[i - 1])));
const flag = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? dflt : Number(argv[i + 1]);
};
const flagStr = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? dflt : argv[i + 1];
};

/**
 * With no file named, read the single take in `audio/source/` — the same
 * resolution `plan-beds.mjs` uses, so `npm run audio:analyze` needs no argument
 * and analysing a candidate take is still one positional away.
 */
const resolveDefault = () => {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "audio", "source");
  if (!existsSync(dir)) return undefined;
  const takes = readdirSync(dir).filter((n) => /\.(mp3|wav|flac|m4a)$/i.test(n));
  return takes.length === 1 ? path.join(dir, takes[0]) : undefined;
};

const AUDIO = positional[0] ?? resolveDefault();
const CUT = flag("cut", 30);
const TOP = flag("top", 14);
const JSON_OUT = argv.includes("--json");
const COMPARE = argv.includes("--compare");

if (!AUDIO || !existsSync(AUDIO)) {
  console.error('usage: node tools/analyze-music.mjs "<audio file>" [--cut 30] [--json] [--compare]');
  process.exit(1);
}

const SR = 8000;
const HOP = 80; // samples = 10ms

/**
 * `-vn` matters: a SUNO export carries an embedded mjpeg cover-art stream, and
 * without it ffmpeg will happily try to make sense of the picture. Piped to
 * stdout rather than through a temp file — a 200 s take at 8 kHz mono is ~3 MB,
 * so the pipe is simpler and leaves nothing behind if the process dies.
 */
const decode = (rate) => {
  const dec = spawnSync(
    "ffmpeg",
    ["-v", "error", "-vn", "-i", AUDIO, "-ac", "1", "-ar", String(rate), "-f", "s16le", "-"],
    { maxBuffer: 1 << 30, encoding: "buffer" },
  );
  if (dec.status !== 0) {
    console.error("ffmpeg decode failed:\n" + dec.stderr.toString());
    process.exit(1);
  }
  // Read through the Buffer rather than aliasing an Int16Array onto it. Node may
  // hand back a Buffer whose byteOffset is odd, and Int16Array construction
  // throws on an unaligned offset — a failure that only shows up on some inputs.
  const raw = dec.stdout;
  const n = Math.floor(raw.length / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = raw.readInt16LE(i * 2) / 32768;
  return out;
};

const x = decode(SR);
const nSamples = x.length;
const duration = nSamples / SR;

/* ── 10ms RMS envelope ──────────────────────────────────────────────────────── */
const nFrames = Math.floor(nSamples / HOP);
const rms = new Float64Array(nFrames);
for (let f = 0; f < nFrames; f++) {
  let acc = 0;
  const base = f * HOP;
  for (let i = 0; i < HOP; i++) { const v = x[base + i]; acc += v * v; }
  rms[f] = Math.sqrt(acc / HOP);
}

/* ── onset strength: positive flux of the SMOOTHED log envelope ─────────────── */
const logEnv = Float64Array.from(rms, (v) => Math.log10(v + 1e-6));
const SMOOTH = 3;
const smoothed = new Float64Array(nFrames);
for (let f = 0; f < nFrames; f++) {
  let acc = 0, n = 0;
  for (let k = -SMOOTH; k <= SMOOTH; k++) {
    const j = f + k;
    if (j >= 0 && j < nFrames) { acc += logEnv[j]; n++; }
  }
  smoothed[f] = acc / n;
}
const flux = new Float64Array(nFrames);
for (let f = 1; f < nFrames; f++) flux[f] = Math.max(0, smoothed[f] - smoothed[f - 1]);

/* ── tempo: autocorrelation of the onset envelope, 60–200 BPM ───────────────── */
const mean = flux.reduce((a, b) => a + b, 0) / nFrames;
const centred = Float64Array.from(flux, (v) => v - mean);
const results = [];
let best = { bpm: 0, score: -Infinity };
for (let bpm = 60; bpm <= 200; bpm += 0.05) {
  const lag = (60 / bpm) * 100;
  const l0 = Math.floor(lag);
  const frac = lag - l0;
  let s = 0, count = 0;
  for (let f = 0; f + l0 + 1 < nFrames; f++) {
    const shifted = centred[f + l0] * (1 - frac) + centred[f + l0 + 1] * frac;
    s += centred[f] * shifted;
    count++;
  }
  s /= count;
  results.push({ bpm: Number(bpm.toFixed(2)), score: s });
  if (s > best.score) best = { bpm: Number(bpm.toFixed(2)), score: s };
}

const peaksBpm = results
  .filter((c, i) => i > 1 && i < results.length - 2 && c.score > results[i - 1].score && c.score > results[i + 1].score)
  .sort((a, b) => b.score - a.score)
  .slice(0, 10);

const combScore = (bpm, t0, t1) => {
  const beatFrames = (60 / bpm) * 100;
  const a = Math.round(t0 * 100);
  const z = Math.min(nFrames, Math.round(t1 * 100));
  let bestPhase = 0, bestSum = -Infinity;
  for (let p = 0; p < Math.round(beatFrames); p++) {
    let s = 0;
    for (let f = a + p; f < z; f += beatFrames) s += flux[Math.round(f)] ?? 0;
    const norm = s / ((z - a) / beatFrames);
    if (norm > bestSum) { bestSum = norm; bestPhase = p; }
  }
  return { score: bestSum, phase: bestPhase / 100 };
};

const probeArg = flagStr("probe", null);
const family = new Set();
const context = new Set();
if (probeArg) {
  for (const v of probeArg.split(",").map(Number)) family.add(Number(v.toFixed(2)));
} else {
  for (const m of [0.25, 0.5, 1, 2, 4]) {
    const v = Number((best.bpm * m).toFixed(2));
    if (v >= 60 && v <= 200) family.add(v);
  }
  for (const p of peaksBpm.slice(0, 6)) {
    const v = Number(p.bpm.toFixed(2));
    if (!family.has(v)) context.add(v);
  }
}
const probes = [...new Set([...family, ...context])].sort((a, b) => a - b).map((bpm) => {
  const full = combScore(bpm, 0, duration);
  const p1 = combScore(bpm, 0, duration / 3);
  const p3 = combScore(bpm, (2 * duration) / 3, duration);
  const beatLen = 60 / bpm;
  let drift = Math.abs(p1.phase - p3.phase);
  drift = Math.min(drift, beatLen - drift);
  return { bpm, family: family.has(bpm), full: full.score, phaseFull: full.phase, first: p1.score, last: p3.score, phase1: p1.phase, phase3: p3.phase, drift };
});
const locked = probes.filter((p) => p.family).sort((a, b) => a.drift - b.drift || b.full - a.full)[0] ?? null;

/* ── peak picking, with a musical minimum spacing ───────────────────────────── */
const gridBpm = locked?.bpm ?? best.bpm;
const beatSec = 60 / gridBpm;
const barSec = beatSec * 4;
const beatFrames = Math.max(4, Math.round(beatSec * 100));
const MIN_GAP = Math.max(beatFrames * 2, 60);
const rawPeaks = [];
for (let f = 1; f < nFrames - 1; f++) {
  if (flux[f] <= flux[f - 1] || flux[f] < flux[f + 1]) continue;
  rawPeaks.push({ frame: f, t: f / 100, strength: flux[f] });
}
rawPeaks.sort((a, b) => b.strength - a.strength);
const onsets = [];
for (const p of rawPeaks) {
  if (onsets.every((c) => Math.abs(c.frame - p.frame) >= MIN_GAP)) onsets.push(p);
  if (onsets.length >= 400) break;
}

/* ── brightness, and why it is measured rather than judged ──────────────────── */
/*
 * The founder's direction is "bright, lively, fast". Two of those three are
 * already numbers here (tempo; onset density). "Bright" is the third, and it is
 * a spectral question, so it gets a spectrum: a 2048-point FFT at 22.05 kHz,
 * hop 1024, Hann-windowed, over the whole take.
 *
 *   centroidHz  — the energy-weighted mean frequency. The standard correlate of
 *                 perceived brightness. A felt-piano-and-brushes bed sits low;
 *                 plucks, claps and open hats pull it up.
 *   rolloff85Hz — the frequency below which 85% of the energy lives. Reported
 *                 alongside the centroid because a single loud cymbal can drag a
 *                 centroid without the track actually being bright, and rolloff
 *                 is less easily moved by one band.
 *   highRatio   — energy above 2 kHz as a fraction of the total. The most
 *                 directly interpretable of the three.
 *
 * All three are weighted by frame energy, so silence and fade tails do not vote.
 */
const FFT_N = 2048;
const FFT_HOP = 1024;
const SR2 = 22050;

// Iterative radix-2 FFT, in place, real input in `re` and zeros in `im`.
const fft = (re, im) => {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
};

const measureBrightness = () => {
  const y = decode(SR2);
  const win = new Float64Array(FFT_N);
  for (let i = 0; i < FFT_N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_N - 1));
  let wCent = 0, wRoll = 0, wHigh = 0, wTot = 0, frames = 0;
  const re = new Float64Array(FFT_N), im = new Float64Array(FFT_N);
  for (let off = 0; off + FFT_N <= y.length; off += FFT_HOP) {
    for (let i = 0; i < FFT_N; i++) { re[i] = y[off + i] * win[i]; im[i] = 0; }
    fft(re, im);
    const half = FFT_N / 2;
    let energy = 0, num = 0, high = 0;
    const mag = new Float64Array(half);
    for (let k = 1; k < half; k++) {
      const m = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      const hz = (k * SR2) / FFT_N;
      mag[k] = m;
      energy += m;
      num += m * hz;
      if (hz >= 2000) high += m;
    }
    if (energy <= 1e-9) continue;
    let acc = 0, roll = 0;
    for (let k = 1; k < half; k++) { acc += mag[k]; if (acc >= 0.85 * energy) { roll = (k * SR2) / FFT_N; break; } }
    // Weight by frame energy so fade tails and silence do not vote.
    wCent += (num / energy) * energy;
    wRoll += roll * energy;
    wHigh += (high / energy) * energy;
    wTot += energy;
    frames++;
  }
  return {
    centroidHz: Number((wCent / wTot).toFixed(1)),
    rolloff85Hz: Number((wRoll / wTot).toFixed(1)),
    highRatio2k: Number((wHigh / wTot).toFixed(4)),
    fftFrames: frames,
  };
};

const brightness = measureBrightness();

/* ── liveliness: onset density and dynamic crest ────────────────────────────── */
// Onsets per minute over the whole take, counted on a musical grid rather than
// on the top-N list, so it is a property of the track and not of `--top`.
const STRONG = rawPeaks.length ? rawPeaks[0].strength : 1;
const livelyOnsets = onsets.filter((p) => p.strength >= 0.12 * STRONG);
const meanRms = rms.reduce((a, b) => a + b, 0) / nFrames;
const peakRms = Math.max(...rms);
const liveliness = {
  onsetsPerMin: Number(((livelyOnsets.length / duration) * 60).toFixed(1)),
  meanRms: Number(meanRms.toFixed(5)),
  crest: Number((peakRms / (meanRms + 1e-9)).toFixed(2)),
};

/* ── arrangement profile ────────────────────────────────────────────────────── */
const BUCKET = 2;
const buckets = [];
for (let start = 0; start < duration; start += BUCKET) {
  const a = Math.floor(start * 100);
  const b = Math.min(nFrames, Math.floor((start + BUCKET) * 100));
  let acc = 0;
  for (let f = a; f < b; f++) acc += rms[f];
  buckets.push({ t: start, level: b > a ? acc / (b - a) : 0 });
}
const loudest = Math.max(...buckets.map((b) => b.level)) || 1;
const profile = buckets.map((b) => ({ t: b.t, rel: Number((b.level / loudest).toFixed(3)) }));

/* ── the downbeat grid ──────────────────────────────────────────────────────── */
/*
 * The bar grid, in SOURCE time, from the phase-locked tempo. `prepare-bed.ps1`
 * cuts on one of these and re-expresses the survivors in FILM time in
 * src/data/music.json, which is what WP-7's snapToDownbeat reads. Derived here
 * once so neither of those files ever contains a hand-typed beat.
 */
const barPhase = locked?.phaseFull ?? 0;
const downbeats = [];
for (let t = barPhase; t < duration; t += barSec) downbeats.push(Number(t.toFixed(4)));

/* ── where does a cut of length L start and end well? ───────────────────────── */
/*
 * A bed must START clean — at a phrase start, not mid-bar, where the track is
 * not already at full tilt — and END on a resolution. Ending is handled by
 * splicing the take's own ending on (prepare-bed.ps1), so what is scored here is
 * the BODY: a 4-bar (phrase) aligned start, low energy right before it (so the
 * cut is not audible as a splice out of a wall), and a body that has some life
 * in it rather than being uniformly quiet.
 */
const rmsBetween = (t0, t1) => {
  const a = Math.max(0, Math.round(t0 * 100));
  const z = Math.min(nFrames, Math.round(t1 * 100));
  let s = 0;
  for (let f = a; f < z; f++) s += rms[f];
  return s / Math.max(1, z - a);
};
const phraseSec = barSec * 4;
const windows = [];
for (let m = 0; ; m++) {
  const start = barPhase + m * phraseSec;
  if (start < 0) continue;
  if (start + CUT > duration) break;
  const open = rmsBetween(start, start + 2);
  const before = rmsBetween(Math.max(0, start - 2), start);
  const body = rmsBetween(start, start + CUT);
  // A clean entry: the two seconds before the cut point are quieter than the two
  // after it, so the bed sounds like it begins rather than like it resumes.
  const entry = Math.min(2, (open + 1e-9) / (before + 1e-9));
  const score = Math.pow(body / loudest, 0.75) * (0.5 + 0.5 * entry);
  windows.push({
    start: Number(start.toFixed(3)),
    bar: m * 4,
    open: Number((open / loudest).toFixed(3)),
    before: Number((before / loudest).toFixed(3)),
    body: Number((body / loudest).toFixed(3)),
    entry: Number(entry.toFixed(2)),
    score: Number(score.toFixed(3)),
  });
}
windows.sort((a, b) => b.score - a.score);

/* ── the take's own ending ──────────────────────────────────────────────────── */
/*
 * Where does the track actually stop? Reported so prepare-bed.ps1 can splice the
 * real resolution onto a body instead of fading out mid-phrase. `endsAt` is the
 * last moment above a floor relative to the take's mean; `tailSec` is how much
 * of the take that leaves as usable ending material.
 */
const FLOOR = meanRms * 0.08;
let lastLoud = nFrames - 1;
while (lastLoud > 0 && rms[lastLoud] < FLOOR) lastLoud--;
const endsAt = Number((lastLoud / 100).toFixed(3));
// The last downbeat at or before the point the music stops — the bar line the
// ending "belongs" to, which is where a splice must land.
const lastDownbeat = downbeats.filter((d) => d <= endsAt).pop() ?? 0;

const report = {
  file: AUDIO,
  durationSec: Number(duration.toFixed(3)),
  rawBpm: best.bpm,
  bpm: gridBpm,
  secondsPerBeat: Number(beatSec.toFixed(4)),
  barSec: Number(barSec.toFixed(4)),
  phraseSec: Number(phraseSec.toFixed(4)),
  beatPhaseSec: Number(barPhase.toFixed(4)),
  brightness,
  liveliness,
  ending: { endsAt, tailSec: Number((duration - endsAt).toFixed(3)), lastDownbeat: Number(lastDownbeat.toFixed(4)) },
  cut: CUT,
  tempoCandidates: peaksBpm.map((p) => ({ bpm: p.bpm, score: p.score })),
  phaseLock: probes.map((p) => ({ bpm: p.bpm, family: p.family, full: Number(p.full.toFixed(4)), first: Number(p.first.toFixed(4)), last: Number(p.last.toFixed(4)), phase1: Number(p.phase1.toFixed(3)), phase3: Number(p.phase3.toFixed(3)), drift: Number(p.drift.toFixed(3)) })),
  downbeats,
  strongestOnsets: onsets.slice(0, TOP).sort((a, b) => a.t - b.t).map((p) => ({ t: Number(p.t.toFixed(2)), strength: Number(p.strength.toFixed(4)) })),
  profile,
  windows: windows.slice(0, 8),
};

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

if (COMPARE) {
  console.log(
    `  ${AUDIO}\n` +
    `    ${report.durationSec}s · ${report.bpm} BPM · bar ${report.barSec}s\n` +
    `    brightness  centroid ${brightness.centroidHz} Hz · rolloff85 ${brightness.rolloff85Hz} Hz · >2kHz ${(brightness.highRatio2k * 100).toFixed(1)}%\n` +
    `    liveliness  ${liveliness.onsetsPerMin} onsets/min · crest ${liveliness.crest}\n`,
  );
  process.exit(0);
}

console.log(`\n  ${AUDIO}`);
console.log(`  ${report.durationSec}s · raw autocorrelation peak ${report.rawBpm} BPM`);
console.log(`  phase-locked ${report.bpm} BPM · beat ${report.secondsPerBeat}s · bar ${report.barSec}s · phrase ${report.phraseSec}s · phase ${report.beatPhaseSec}s`);
console.log(`  brightness: centroid ${brightness.centroidHz} Hz · rolloff85 ${brightness.rolloff85Hz} Hz · energy >2kHz ${(brightness.highRatio2k * 100).toFixed(1)}%`);
console.log(`  liveliness: ${liveliness.onsetsPerMin} onsets/min · crest ${liveliness.crest}`);
console.log(`  ending: music stops at ${report.ending.endsAt}s (tail ${report.ending.tailSec}s) · last bar line at ${report.ending.lastDownbeat}s\n`);

console.log("  Tempo candidates (autocorrelation local peaks)");
for (const p of report.tempoCandidates) {
  console.log(`    ${p.bpm.toFixed(2).padStart(7)} BPM   score ${p.score.toExponential(3)}   x2 = ${(p.bpm * 2).toFixed(2)}`);
}

console.log("\n  Tempo disambiguation (beat-grid phase lock — least drift wins within the octave family)");
console.log("    bpm      full-track   first-third   last-third   phase(1st)  phase(3rd)     drift");
for (const p of report.phaseLock) {
  const mark = locked && p.bpm === locked.bpm ? " <- locked" : p.family ? "" : "   (context only)";
  console.log(
    `    ${p.bpm.toFixed(2).padStart(6)}  ${p.full.toFixed(4).padStart(11)}  ${p.first.toFixed(4).padStart(12)}  ${p.last.toFixed(4).padStart(11)}  ${p.phase1.toFixed(3).padStart(9)}s  ${p.phase3.toFixed(3).padStart(9)}s  ${p.drift.toFixed(3).padStart(7)}s${mark}`,
  );
}

console.log(`\n  Arrangement (relative RMS, ${BUCKET}s blocks)`);
for (const b of report.profile) {
  const n = Math.round(b.rel * 44);
  console.log(`    ${String(b.t).padStart(5)}s |${"#".repeat(n)}${" ".repeat(44 - n)}| ${b.rel.toFixed(2)}`);
}

console.log("\n  Strongest onsets (source time)");
for (const o of report.strongestOnsets) {
  console.log(`    ${String(o.t).padStart(7)}s  ${"|".repeat(Math.max(1, Math.round(o.strength * 60)))} ${o.strength}`);
}

console.log(`\n  Phrase-aligned ${CUT}s body windows — clean entry, live body`);
console.log("    start        bar    open   before    body   entry   score");
for (const c of report.windows) {
  console.log(
    `    ${c.start.toFixed(3).padStart(9)}s  ${String(c.bar).padStart(5)}  ${c.open.toFixed(3).padStart(6)}  ${c.before.toFixed(3).padStart(6)}  ${c.body.toFixed(3).padStart(6)}  ${c.entry.toFixed(2).padStart(6)}x  ${c.score.toFixed(3).padStart(6)}`,
  );
}
console.log(`\n  ${downbeats.length} downbeats on the grid (source time). --json exports them.\n`);
