#!/usr/bin/env node
/**
 * analyze-structure.mjs — read a take's ARRANGEMENT, for an editor who cannot
 * hear it.
 *
 * ── Why this exists beside tools/analyze-music.mjs ───────────────────────────
 *
 * `analyze-music.mjs` answers the three questions the BED pipeline asks: which
 * take is brightest, where are the bar lines, and where does a body of length L
 * start well. It is deliberately a near-verbatim port of the sibling film's
 * analyser so it can be diffed against its original, and it is not to be grown.
 *
 * This file answers the question the EDIT asks, which is a different one:
 * **what happens in this track, and when.** Where the kick comes in, where it
 * drops out, where the lift is, where the biggest energy jump is, how long the
 * ring-out lasts. Those are the hooks a cut hangs story beats on — "the plan
 * starts drawing on the drop at 6.4 s" — and nothing in the repo measured them
 * before. It shares `lib/dsp.mjs` with the bed pipeline wherever the two ask the
 * same question, so the ending this reports is the ending `plan-beds.mjs` will
 * splice.
 *
 * ── Three things it measures that the older tool gets wrong or does not ask ──
 *
 * **1. The octave, decided on the LOW BAND.** `analyze-music.mjs` disambiguates
 * half/double time by phase drift inside the octave family, and on
 * `daylight-forward.mp3` that test ties: 63.83 BPM and 127.65 BPM both drift
 * 0.050 s, and the tie falls to a full-track score differing in the fourth
 * decimal. It locked 63.83 — half the real tempo, a 3.76 s "bar" — and every
 * window it then reported was two bars wide. The test here is not how steady a
 * candidate is but whether the points BETWEEN its grid points are themselves
 * beats: broadband that question cannot be answered (a shaker plays every
 * off-beat, so the midpoints score ~0.9 either way), but a kick does not play
 * the off-beats, so the same ratio measured on 40–160 Hz flux separates them —
 * 0.912 at 63.8 against 0.808 at 127.6. `lib/dsp.mjs`'s `localBeat` independently
 * returns 0.47 s (127.66 BPM) on this take, which is the corroboration.
 *
 * **2. Tempo drift as a RAMP, not as a wander.** The repo records "the beat
 * phase drifts ~0.2 s per 20 s" and treats that as a property of SUNO output.
 * Measured as bar length per 20 s block it is not one property but two different
 * ones: `confident-arrival` holds 2.375 s a bar end to end (a fixed-bar grid
 * anchored at its first downbeat is 0.08 s out 135 s later — nothing), while
 * `daylight-forward` accelerates monotonically, 1.916 s a bar to 1.870 s, and the
 * same fixed grid is **1.53 s out** by its last downbeat. A phase-drift figure
 * cannot tell those apart and they do not have the same consequences.
 *
 * **3. Sections, from four signals rather than from loudness.** Novelty over a
 * self-similarity matrix of [energy, centroid, kick band, air band, flux] with a
 * checkerboard kernel, PLUS a plain energy-step nominator, because novelty alone
 * under-segments a track that keeps one texture across a verse and a chorus.
 * Boundaries are then snapped to the measured downbeat grid — an arrangement
 * changes on a bar line or it is not an arrangement change.
 *
 * ── What it cannot do ────────────────────────────────────────────────────────
 *
 * It names sections by their numbers ("no kick, bright, sparse"), not by their
 * function. Calling one of them "the chorus" is a guess and is labelled as one.
 *
 * Usage:
 *   node tools/analyze-structure.mjs                       # the take in audio/source/
 *   node tools/analyze-structure.mjs <audio> [--out <dir>] [--slug <name>]
 *   node tools/analyze-structure.mjs <audio> --bpm 127.6   # override the octave test
 *   node tools/analyze-structure.mjs <audio> --no-images
 *
 * Writes `src/data/music-analysis/<slug>.json` and, unless `--no-images`,
 * `docs/music/<slug>-energy.png` and `docs/music/<slug>-spectrogram.png`.
 * Read-only against the audio. Cutting is `tools/plan-beds.ps1`.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import { decodeMono, rmsEnvelope, onsetFlux, pickOnsets, localBeat, findEnding, probeDuration, measureLoudness } from "./lib/dsp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const val = (f, d = null) => { const i = argv.indexOf(f); return i === -1 ? d : argv[i + 1]; };

const resolveDefault = () => {
  const dir = path.join(ROOT, "audio", "source");
  if (!fs.existsSync(dir)) return undefined;
  const takes = fs.readdirSync(dir).filter((n) => /\.(mp3|wav|flac|m4a)$/i.test(n));
  return takes.length === 1 ? path.join(dir, takes[0]) : undefined;
};
const AUDIO = argv.find((a, i) => !a.startsWith("--") && !(i > 0 && ["--out", "--slug", "--bpm"].includes(argv[i - 1]))) ?? resolveDefault();
if (!AUDIO || !fs.existsSync(AUDIO)) {
  console.error("\n  usage: node tools/analyze-structure.mjs <audio> [--out <dir>] [--slug <name>]\n");
  process.exit(1);
}
const SLUG = val("--slug") ?? path.basename(AUDIO).replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
const JSON_DIR = val("--out") ?? path.join(ROOT, "src", "data", "music-analysis");
const IMG_DIR = path.join(ROOT, "docs", "music");
const IMAGES = !argv.includes("--no-images");

/* ── STFT ───────────────────────────────────────────────────────────────── */
const SR = 22050, N = 2048, HOP = 256;           // 11.61 ms frames
const FPS = SR / HOP;
const y = decodeMono(AUDIO, SR);
const duration = y.length / SR;

const fft = (re, im) => {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
};

const win = new Float64Array(N);
for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
const HALF = N / 2, binHz = SR / N;
const nF = Math.max(0, Math.floor((y.length - N) / HOP) + 1);

const BANDS = { kick: [40, 130], lowmid: [130, 400], mid: [400, 2000], high: [2000, 6000], air: [6000, 10500] };
const bandIdx = Object.fromEntries(Object.entries(BANDS).map(([k, [a, b]]) =>
  [k, [Math.max(1, Math.round(a / binHz)), Math.min(HALF - 1, Math.round(b / binHz))]]));

const energy = new Float64Array(nF), centroid = new Float64Array(nF), rolloff = new Float64Array(nF);
const band = Object.fromEntries(Object.keys(BANDS).map((k) => [k, new Float64Array(nF)]));
const flux = new Float64Array(nF), fluxLow = new Float64Array(nF);
const prevMag = new Float64Array(HALF), mag = new Float64Array(HALF);
const re = new Float64Array(N), im = new Float64Array(N);

for (let f = 0; f < nF; f++) {
  const off = f * HOP;
  for (let i = 0; i < N; i++) { re[i] = y[off + i] * win[i]; im[i] = 0; }
  fft(re, im);
  let tot = 0, num = 0;
  for (let k = 1; k < HALF; k++) { const m = Math.hypot(re[k], im[k]); mag[k] = m; tot += m; num += m * k * binHz; }
  energy[f] = tot;
  centroid[f] = tot > 1e-9 ? num / tot : 0;
  let acc = 0; rolloff[f] = 0;
  for (let k = 1; k < HALF; k++) { acc += mag[k]; if (acc >= 0.85 * tot) { rolloff[f] = k * binHz; break; } }
  for (const [name, [a, b]] of Object.entries(bandIdx)) { let s = 0; for (let k = a; k <= b; k++) s += mag[k]; band[name][f] = s; }
  let fl = 0, flo = 0;
  for (let k = 1; k < HALF; k++) {
    const d = Math.log10(mag[k] + 1e-6) - Math.log10(prevMag[k] + 1e-6);
    if (d > 0) { fl += d; const hz = k * binHz; if (hz >= 40 && hz <= 160) flo += d; }
  }
  flux[f] = fl; fluxLow[f] = flo;
  prevMag.set(mag);
}

const smooth = (a, hw) => {
  const n = a.length, o = new Float64Array(n);
  for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let k = -hw; k <= hw; k++) { const j = i + k; if (j >= 0 && j < n) { s += a[j]; c++; } } o[i] = s / c; }
  return o;
};
const meanBetween = (arr, t0, t1) => {
  const a = Math.max(0, Math.round(t0 * FPS)), b = Math.min(arr.length, Math.round(t1 * FPS));
  let s = 0; for (let k = a; k < b; k++) s += arr[k];
  return s / Math.max(1, b - a);
};

/* ── onsets, in two strengths ───────────────────────────────────────────── */
const fluxS = smooth(flux, 1);
const medWin = Math.round(0.35 * FPS);
const raw = [];
for (let f = 2; f < nF - 2; f++) {
  if (!(fluxS[f] > fluxS[f - 1] && fluxS[f] >= fluxS[f + 1])) continue;
  const w = Array.from(fluxS.slice(Math.max(0, f - medWin), Math.min(nF, f + medWin))).sort((p, q) => p - q);
  const med = w[Math.floor(w.length / 2)], mean = w.reduce((p, q) => p + q, 0) / w.length;
  if (fluxS[f] > med + 0.6 * Math.max(1e-6, mean - med) + 0.15 * mean) raw.push({ t: f / FPS, s: fluxS[f] });
}
const thin = (list, gap) => {
  const kept = [];
  for (const o of [...list].sort((a, b) => b.s - a.s)) if (kept.every((k) => Math.abs(k.t - o.t) >= gap)) kept.push(o);
  return kept.sort((a, b) => a.t - b.t);
};
const onsets = thin(raw, 0.06);
/*
 * A stricter list, for validating the grid against.
 *
 * The full list runs at about six onsets a second — shaker, hat and pluck
 * subdivisions all count — and at that density a ±40 ms window catches roughly
 * half of ANY grid, true or not, so a hit-rate measured against it says nothing.
 * `strong` keeps the upper half by strength at 0.2 s spacing, and the report
 * carries the chance rate beside the hit rate so the number can be read.
 */
const sortedS = onsets.map((o) => o.s).sort((a, b) => a - b);
const medS = sortedS[Math.floor(sortedS.length / 2)] ?? 0;
const strong = thin(onsets.filter((o) => o.s >= medS), 0.2);
const chanceRate40ms = Math.min(1, (strong.length / duration) * 0.08);

/* ── tempo, and the octave test ─────────────────────────────────────────── */
const EFPS = 100, nE = Math.floor(duration * EFPS);
const envOf = (src) => { const e = new Float64Array(nE); for (let i = 0; i < nF; i++) { const j = Math.floor((i / FPS) * EFPS); if (j < nE) e[j] += src[i]; } return smooth(e, 2); };
const env = envOf(fluxS), lowEnv = envOf(fluxLow);
const envMean = env.reduce((a, b) => a + b, 0) / nE;
const cen = Float64Array.from(env, (v) => v - envMean);
const acAt = (bpm) => {
  const lag = (60 / bpm) * EFPS, l0 = Math.floor(lag), fr = lag - l0;
  let s = 0, c = 0;
  for (let f = 0; f + l0 + 1 < nE; f++) { s += cen[f] * (cen[f + l0] * (1 - fr) + cen[f + l0 + 1] * fr); c++; }
  return s / c;
};
const ac = [];
for (let bpm = 50; bpm <= 220; bpm += 0.05) ac.push({ bpm: Number(bpm.toFixed(2)), score: acAt(bpm) });
const acPeaks = ac.filter((c, i) => i > 1 && i < ac.length - 2 && c.score > ac[i - 1].score && c.score > ac[i + 1].score)
  .sort((a, b) => b.score - a.score).slice(0, 8);

const comb = (bpm, t0, t1, src = env) => {
  const beatF = (60 / bpm) * EFPS;
  const a = Math.round(t0 * EFPS), z = Math.min(nE, Math.round(t1 * EFPS));
  let bp = 0, bs = -Infinity;
  for (let p = 0; p < Math.round(beatF); p++) {
    let s = 0, c = 0;
    for (let f = a + p; f < z; f += beatF) { s += src[Math.round(f)] ?? 0; c++; }
    const v = s / Math.max(1, c);
    if (v > bs) { bs = v; bp = p; }
  }
  return { score: bs, phase: bp / EFPS };
};

const baseBpm = acPeaks[0].bpm;
const family = [0.5, 1, 2].map((m) => Number((baseBpm * m).toFixed(2))).filter((b) => b >= 50 && b <= 220);
const octaveTest = family.map((bpm) => {
  const full = comb(bpm, 0, duration);
  const beatSec = 60 / bpm, beatF = beatSec * EFPS;
  const phases = [];
  for (let t = 0; t + 20 <= duration; t += 20) phases.push(comb(bpm, t, t + 20).phase);
  const un = [phases[0] ?? 0];
  for (let i = 1; i < phases.length; i++) {
    let p = phases[i];
    while (p - un[i - 1] > beatSec / 2) p -= beatSec;
    while (p - un[i - 1] < -beatSec / 2) p += beatSec;
    un.push(p);
  }
  const lowLock = comb(bpm, 0, duration, lowEnv);
  const at = (src, phaseSec) => { let s = 0, c = 0; for (let f = phaseSec * EFPS; f < nE; f += beatF) { s += src[Math.round(f)] ?? 0; c++; } return s / Math.max(1, c); };
  const kickOn = at(lowEnv, lowLock.phase), kickMid = at(lowEnv, lowLock.phase + beatSec / 2);
  return {
    bpm, beatSec: Number(beatSec.toFixed(4)), autocorr: Number(acAt(bpm).toPrecision(4)),
    combScore: Number(full.score.toFixed(4)), beatPhaseSec: Number(full.phase.toFixed(3)),
    kickMidRatio: Number((kickMid / (kickOn || 1e-9)).toFixed(3)),
    phaseDriftPer20sSec: Number(((un[un.length - 1] - un[0]) / Math.max(1, un.length - 1)).toFixed(3)),
  };
});

/**
 * The beat is the SLOWEST candidate whose midpoints do not themselves carry kick
 * energy. If they do, the candidate is skipping real beats.
 */
const FORCE = val("--bpm");
const bpm = FORCE ? Number(FORCE) : (() => {
  for (const b of [...family].sort((a, b) => a - b)) {
    const row = octaveTest.find((r) => r.bpm === b);
    if (row && row.kickMidRatio < 0.85 && b >= 85) return b;
  }
  const inRange = octaveTest.filter((r) => r.bpm >= 85 && r.bpm <= 180);
  return (inRange.length ? inRange : octaveTest).sort((a, b) => a.kickMidRatio - b.kickMidRatio)[0].bpm;
})();
const beatSec = 60 / bpm, nominalBarSec = beatSec * 4;
const lock = octaveTest.find((r) => r.bpm === bpm) ?? { beatPhaseSec: 0, phaseDriftPer20sSec: 0 };

/* ── the beat grid, following the drift ─────────────────────────────────── */
/*
 * Step a beat at a time from the locked phase, snapping each step to the nearest
 * onset within ±35% of a beat and advancing FROM WHERE IT SNAPPED — the rule
 * `tools/build-music.mjs` uses for downbeats, and the only one that survives a
 * take that accelerates.
 */
const times = onsets.map((o) => o.t);
const nearest = (list, t) => list.reduce((best, o) => (Math.abs(o - t) < Math.abs(best - t) ? o : best), Infinity);
const beats = [];
{
  let t = lock.beatPhaseSec;
  while (t < 1e-6) t += beatSec;
  while (t <= duration) {
    const n = nearest(times, t);
    if (Number.isFinite(n) && Math.abs(n - t) <= 0.35 * beatSec) { beats.push(Number(n.toFixed(3))); t = n + beatSec; }
    else { beats.push(Number(t.toFixed(3))); t += beatSec; }
  }
}
const strongTimes = strong.map((o) => o.t);
const hitRate = (list, pool) => Number((list.filter((t) => Math.abs(nearest(pool, t) - t) <= 0.04).length / Math.max(1, list.length)).toFixed(3));

/*
 * Which beat of four is the bar line.
 *
 * Scored on kick-band energy, then tie-broken towards the phase that puts the
 * take's strongest transient on a bar line — a track briefed to open with a hit
 * opens on one. ⚠ On a take whose bass plays eighths this test is weak, and the
 * report says how weak: `barPhaseMargin` is the winner over the runner-up. It
 * does not reach the delivered beds either way — `build-music.mjs` defines each
 * bed's first sample as a downbeat.
 */
const lowAt = (t) => fluxLow[Math.min(nF - 1, Math.max(0, Math.round(t * FPS)))] ?? 0;
const strongestOnset = onsets.reduce((m, o) => (o.s > (m?.s ?? -1) ? o : m), null);
const strongestIdx = beats.findIndex((t) => strongestOnset && Math.abs(t - strongestOnset.t) <= 0.5 * beatSec);
const phaseVote = [0, 1, 2, 3].map((p) => {
  let s = 0, c = 0;
  for (let i = p; i < beats.length; i += 4) { s += lowAt(beats[i]); c++; }
  return { p, score: Number((s / Math.max(1, c)).toFixed(4)), hitOnOne: strongestIdx >= 0 && strongestIdx % 4 === p };
}).sort((a, b) => b.score - a.score);
const barPhase = (phaseVote.filter((r) => r.score >= 0.9 * phaseVote[0].score).find((r) => r.hitOnOne) ?? phaseVote[0]).p;
const downbeats = beats.filter((_, i) => i % 4 === barPhase);

/* ── drift: a ramp or a wander? ─────────────────────────────────────────── */
const barByBlock = [];
for (let t = 0; t + 20 <= duration; t += 20) {
  const inB = downbeats.filter((d) => d >= t && d < t + 20);
  if (inB.length < 3) continue;
  const gaps = inB.slice(1).map((v, i) => v - inB[i]).filter((g) => g < nominalBarSec * 1.3);
  const m = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  barByBlock.push({ fromSec: t, toSec: t + 20, barSec: Number(m.toFixed(4)), bpm: Number((240 / m).toFixed(2)) });
}
const bar0 = barByBlock[0]?.barSec ?? nominalBarSec;
const extrapErr = downbeats.map((d, i) => Number((d - (downbeats[0] + i * bar0)).toFixed(3)));
const meanBarSec = downbeats.length > 1 ? Number(((downbeats.at(-1) - downbeats[0]) / (downbeats.length - 1)).toFixed(4)) : nominalBarSec;

/* ── the ending, from the bed pipeline's own detector ───────────────────── */
const rms8 = rmsEnvelope(decodeMono(AUDIO));
const ending = findEnding(rms8, pickOnsets(onsetFlux(rms8), { minGapSec: 0.4 }));

/* ── sections ───────────────────────────────────────────────────────────── */
const FW = 0.25, nS = Math.floor(duration / FW);
const F = [];
for (let i = 0; i < nS; i++) {
  const t0 = i * FW, t1 = t0 + FW;
  F.push([
    Math.log10(meanBetween(energy, t0, t1) + 1e-6), meanBetween(centroid, t0, t1) / 1000,
    Math.log10(meanBetween(band.kick, t0, t1) + 1e-6), Math.log10(meanBetween(band.air, t0, t1) + 1e-6),
    meanBetween(flux, t0, t1), Math.log10(meanBetween(band.mid, t0, t1) + 1e-6),
  ]);
}
for (let d = 0; d < F[0].length; d++) {
  const col = F.map((r) => r[d]);
  const mu = col.reduce((a, b) => a + b, 0) / col.length;
  const sd = Math.sqrt(col.reduce((a, b) => a + (b - mu) ** 2, 0) / col.length) || 1;
  for (const r of F) r[d] = (r[d] - mu) / sd;
}
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const sim = (i, j) => (i < 0 || j < 0 || i >= nS || j >= nS) ? 0 : dot(F[i], F[j]) / (Math.sqrt(dot(F[i], F[i]) * dot(F[j], F[j])) || 1);
const K = Math.round(6 / FW);
const nov = new Float64Array(nS);
for (let i = 0; i < nS; i++) {
  let past = 0, future = 0, cross = 0, c = 0;
  for (let a = 1; a <= K; a++) for (let b = 1; b <= K; b++) {
    const w = Math.exp(-((a * a + b * b) / (2 * (K / 2) ** 2)));
    past += w * sim(i - a, i - b); future += w * sim(i + a, i + b); cross += w * sim(i - a, i + b); c += w;
  }
  nov[i] = (past + future - 2 * cross) / (2 * c);
}
const novS = smooth(nov, 2);
const novMean = novS.reduce((a, b) => a + b, 0) / nS;
const novSd = Math.sqrt(Array.from(novS).reduce((a, b) => a + (b - novMean) ** 2, 0) / nS);
const cands = [];
for (let i = K; i < nS - K; i++) if (novS[i] > novS[i - 1] && novS[i] >= novS[i + 1] && novS[i] > novMean + 0.25 * novSd) cands.push({ t: i * FW, v: novS[i], from: "novelty" });
// The energy-step nominator: novelty alone under-segments one texture held
// across a verse and a chorus.
for (let t = 4; t + 4 <= duration; t += 2) {
  const d = 20 * Math.log10((meanBetween(energy, t, t + 4) + 1e-9) / (meanBetween(energy, t - 4, t) + 1e-9));
  if (Math.abs(d) >= 2.5) cands.push({ t, v: novMean + 0.4 * novSd + Math.abs(d) / 100, from: "energy-step" });
}
const picked = [];
for (const c of [...cands].sort((a, b) => b.v - a.v)) if (picked.every((p) => Math.abs(p.t - c.t) >= 4)) picked.push(c);
picked.sort((a, b) => a.t - b.t);
const snapDb = (t) => downbeats.length ? downbeats.reduce((best, d) => (Math.abs(d - t) < Math.abs(best - t) ? d : best), downbeats[0]) : t;
const bounds = [...new Set([0, ...picked.map((p) => snapDb(p.t))])].sort((a, b) => a - b);

const db0 = downbeats[0] ?? 0;
const barOf = (t) => { const i = downbeats.findIndex((d) => Math.abs(d - t) < 0.05); return i >= 0 ? i : Math.round((t - db0) / meanBarSec); };
const sections = [];
for (let i = 0; i < bounds.length; i++) {
  const t0 = bounds[i], t1 = i + 1 < bounds.length ? bounds[i + 1] : duration;
  const e = meanBetween(energy, t0, t1);
  const ons = onsets.filter((o) => o.t >= t0 && o.t < t1);
  sections.push({
    index: i, startSec: Number(t0.toFixed(3)), endSec: Number(t1.toFixed(3)),
    startBar: barOf(t0), bars: downbeats.filter((d) => d >= t0 - 0.05 && d < t1 - 0.05).length,
    lenSec: Number((t1 - t0).toFixed(3)), _e: e,
    centroidHz: Math.round(meanBetween(centroid, t0, t1)), rolloff85Hz: Math.round(meanBetween(rolloff, t0, t1)),
    kickShare: Number((meanBetween(band.kick, t0, t1) / e).toFixed(4)),
    airShare: Number((meanBetween(band.air, t0, t1) / e).toFixed(4)),
    highShare: Number((meanBetween(band.high, t0, t1) / e).toFixed(4)),
    onsetsPerSec: Number((ons.length / (t1 - t0)).toFixed(2)),
  });
}
const maxE = Math.max(...sections.map((s) => s._e));
for (const s of sections) {
  s.energyRel = Number((s._e / maxE).toFixed(3));
  s.levelDb = Number((20 * Math.log10(s._e / maxE)).toFixed(1));
  delete s._e;
  // A one-line guess, from the numbers only. NOT a claim about what it is.
  const kick = s.kickShare > 0.09, bright = s.centroidHz > 1900, dense = s.onsetsPerSec > 5.5;
  s.character = s.energyRel < 0.35 ? (s.kickShare > 0.15 ? "final cadence and ring-out" : "near-silent — intro or tail")
    : !kick ? (bright ? "kick out, cymbals ringing — the drop-out into a breakdown" : "kick out, dark and sparse — breakdown")
      : s.energyRel > 0.92 ? (bright && dense ? "full groove, bright and busy" : "full groove") : (bright ? "groove, a little held back" : "mid-weight groove");
}
const jumps = sections.slice(1).map((s, i) => ({
  atSec: s.startSec, atBar: s.startBar,
  deltaDb: Number((20 * Math.log10((s.energyRel + 1e-6) / (sections[i].energyRel + 1e-6))).toFixed(2)),
}));
const airS = smooth(band.air, Math.round(0.25 * FPS));
const risers = bounds.slice(1).map((b) => {
  const a = Math.max(0, Math.round((b - 3) * FPS)), z = Math.min(nF - 1, Math.round(b * FPS));
  return { intoSec: Number(b.toFixed(3)), airGainDb: Number((20 * Math.log10((airS[z] || 1e-9) / (airS[a] || 1e-9))).toFixed(2)) };
});
const biggestJump = jumps.reduce((m, j) => (j.deltaDb > (m?.deltaDb ?? -Infinity) ? j : m), null);
const biggestRiser = risers.reduce((m, r) => (r.airGainDb > (m?.airGainDb ?? -Infinity) ? r : m), null);

/* ── fills and crashes: the hooks INSIDE a section ──────────────────────── */
/*
 * A section map alone is not enough to cut to. The moments an editor reaches for
 * are mostly not section boundaries — they are the bar where the drums stop for
 * half a bar, and the crash that lands on the bar after it. Two detectors, both
 * reported in source time and both snapped to the bar grid:
 *
 *   fills   — the kick band falls below a quarter of its own local median for
 *             between a beat and four bars, then comes back. A drop-out that
 *             lasts longer than that is a section, and it is already in the
 *             table above.
 *   crashes — a transient in the air band at least 2.5x its local median. A
 *             cymbal crash is the loudest thing in a mix that a listener reads
 *             as "something just started", which is exactly what a cut wants
 *             underneath it.
 */
const kickS = smooth(band.kick, Math.round(0.2 * FPS));
const localMedian = (arr, f, halfSec) => {
  const a = Math.max(0, f - Math.round(halfSec * FPS)), b = Math.min(arr.length, f + Math.round(halfSec * FPS));
  const w = Array.from(arr.slice(a, b)).sort((p, q) => p - q);
  return w[Math.floor(w.length / 2)] || 1e-9;
};
const nearestDb = (t) => (downbeats.length ? downbeats.reduce((best, d) => (Math.abs(d - t) < Math.abs(best - t) ? d : best), downbeats[0]) : t);
const fills = [];
{
  let open = null;
  for (let f = 0; f < nF; f++) {
    const below = kickS[f] < 0.25 * localMedian(kickS, f, 8);
    if (below && open === null) open = f;
    if (!below && open !== null) {
      const t0 = open / FPS, t1 = f / FPS, len = t1 - t0;
      if (len >= beatSec * 0.8 && len <= nominalBarSec * 4) {
        fills.push({ startSec: Number(t0.toFixed(3)), endSec: Number(t1.toFixed(3)), lenSec: Number(len.toFixed(3)),
          resumesAtBarSec: Number(nearestDb(t1).toFixed(3)), inSection: sections.findIndex((s) => t0 >= s.startSec && t0 < s.endSec) });
      }
      open = null;
    }
  }
}
const crashes = [];
{
  const airPeak = [];
  for (let f = 2; f < nF - 2; f++) {
    if (!(airS[f] > airS[f - 1] && airS[f] >= airS[f + 1])) continue;
    const ratio = airS[f] / localMedian(airS, f, 6);
    if (ratio >= 2.5) airPeak.push({ t: f / FPS, ratio });
  }
  for (const p of [...airPeak].sort((a, b) => b.ratio - a.ratio)) {
    if (crashes.every((c) => Math.abs(c.atSec - p.t) >= 2)) {
      // The reported time is the ATTACK, not the smoothed peak. A crash decays
      // over most of a second, so the peak of a 0.25 s-smoothed envelope sits
      // about a beat late — and a beat late is the difference between cutting on
      // the bar line and cutting off it.
      let f = Math.round(p.t * FPS);
      const stop = Math.max(0, f - Math.round(1.0 * FPS));
      while (f > stop && airS[f - 1] < airS[f]) f--;
      const attack = f / FPS;
      crashes.push({ atSec: Number(attack.toFixed(3)), peakSec: Number(p.t.toFixed(3)), onBarSec: Number(nearestDb(attack).toFixed(3)), offBarMs: Math.round((attack - nearestDb(attack)) * 1000), airRatio: Number(p.ratio.toFixed(2)) });
    }
  }
  crashes.sort((a, b) => a.atSec - b.atSec);
}

/* ── global brightness and liveliness ───────────────────────────────────── */
let wC = 0, wR = 0, wH = 0, wT = 0;
for (let f = 0; f < nF; f++) {
  const e = energy[f]; if (e <= 1e-9) continue;
  wC += centroid[f] * e; wR += rolloff[f] * e; wH += band.high[f] + band.air[f]; wT += e;
}
const eS = smooth(energy, Math.round(0.35 * FPS));
const global = {
  centroidHz: Number((wC / wT).toFixed(1)), rolloff85Hz: Number((wR / wT).toFixed(1)),
  highRatio2k: Number((wH / wT).toFixed(4)),
  onsetsPerMin: Number(((onsets.length / duration) * 60).toFixed(1)),
  strongOnsetsPerMin: Number(((strong.length / duration) * 60).toFixed(1)),
  crest: Number((Math.max(...eS) / (eS.reduce((a, b) => a + b, 0) / nF)).toFixed(2)),
};

/* ── images ─────────────────────────────────────────────────────────────── */
const GLYPH = {
  "0": "111101101101111", "1": "010110010010111", "2": "111001111100111", "3": "111001111001111",
  "4": "101101111001001", "5": "111100111001111", "6": "111100111101111", "7": "111001001001001",
  "8": "111101111101111", "9": "111101111001111", ".": "000000000000010", "-": "000000111000000",
  E: "111100110100111", K: "101101110101101", A: "111101111101101",
  C: "111100100100111", B: "110101110101110", P: "110101110100100", M: "101111111101101",
  D: "110101101101110", i: "010000010010010", r: "000000111100100", c: "000000111100111",
  a: "000000111101111", e: "000000111110111", n: "000000110101101", g: "000000111101011",
  y: "000000101111001", t: "010111010010011", d: "001001111101111", o: "000000111101111",
  u: "000000101101111", l: "100100100100111", k: "100100101110101", b: "100100110101110",
  f: "011100110100100", h: "100100110101101", m: "000000111111101", p: "000110101110100",
  s: "000000111010111", v: "000000101101010", w: "000000101111111", x: "000000101010101",
  z: "000000111010111", j: "001000001001110", q: "000011101011001",
  " ": "000000000000000", "/": "001001010100100", ":": "000010000010000",
};
const drawText = (buf, W, H, x0, y0, text, r, g, b, scale = 2) => {
  let x = x0;
  for (const ch of text) {
    const gl = GLYPH[ch] ?? GLYPH[" "];
    for (let ry = 0; ry < 5; ry++) for (let rx = 0; rx < 3; rx++) {
      if (gl[ry * 3 + rx] !== "1") continue;
      for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
        const px = x + rx * scale + sx, py = y0 + ry * scale + sy;
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const i = (py * W + px) * 3; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
      }
    }
    x += 4 * scale;
  }
};
const encodePng = (W, H, rgb) => {
  const rawBuf = Buffer.alloc((W * 3 + 1) * H);
  for (let yy = 0; yy < H; yy++) { rawBuf[yy * (W * 3 + 1)] = 0; rgb.copy(rawBuf, yy * (W * 3 + 1) + 1, yy * W * 3, (yy + 1) * W * 3); }
  const T = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
  const crc = (b) => { let c = -1; for (const v of b) c = T[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(rawBuf)), chunk("IEND", Buffer.alloc(0))]);
};

if (IMAGES) {
  fs.mkdirSync(IMG_DIR, { recursive: true });
  const W = 1800, H = 620, L = 54, R = 16, T = 64, B = 46;
  const pw = W - L - R, ph = H - T - B;
  const buf = Buffer.alloc(W * H * 3, 0xff);
  const px = (x, yy, r, g, b) => { if (x < 0 || yy < 0 || x >= W || yy >= H) return; const i = (yy * W + x) * 3; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; };
  const xOf = (t) => L + Math.round((t / duration) * pw);
  for (let t = 0; t <= duration; t += 10) { const x = xOf(t); for (let yy = T; yy < T + ph; yy++) px(x, yy, 0xe8, 0xe8, 0xe8); }
  for (const [i, b] of bounds.entries()) {
    const x = xOf(b);
    for (let yy = T - 12; yy < T + ph; yy++) { px(x, yy, 0x8b, 0x1a, 0x8b); px(x + 1, yy, 0x8b, 0x1a, 0x8b); }
    drawText(buf, W, H, x + 3, T - 12, String(i), 0x8b, 0x1a, 0x8b, 2);
  }
  const plot = (arr, r, g, b, scaleMax) => {
    const m = scaleMax ?? (Math.max(...arr) || 1);
    let prev = null;
    for (let x = 0; x < pw; x++) {
      const t0 = (x / pw) * duration, t1 = ((x + 1) / pw) * duration;
      const a = Math.round(t0 * FPS), z = Math.max(a + 1, Math.round(t1 * FPS));
      let s = 0, c = 0; for (let k = a; k < z && k < arr.length; k++) { s += arr[k]; c++; }
      const yy = T + ph - Math.round(Math.min(1, Math.max(0, (s / Math.max(1, c)) / m)) * ph);
      if (prev !== null) for (let q = Math.min(prev, yy); q <= Math.max(prev, yy); q++) px(L + x, q, r, g, b);
      px(L + x, yy, r, g, b); prev = yy;
    }
  };
  const hw = Math.round(0.35 * FPS);
  plot(smooth(energy, hw), 0x11, 0x11, 0x11);
  plot(smooth(band.kick, hw), 0xcc, 0x33, 0x00);
  plot(smooth(band.air, hw), 0x00, 0x77, 0xcc);
  plot(smooth(centroid, Math.round(0.5 * FPS)), 0x00, 0x99, 0x55, 5000);
  for (let x = L; x < L + pw; x++) px(x, T + ph, 0, 0, 0);
  for (let yy = T; yy <= T + ph; yy++) px(L, yy, 0, 0, 0);
  for (let t = 0; t <= duration; t += 10) {
    const x = xOf(t);
    for (let k = 0; k < 6; k++) px(x, T + ph + k, 0, 0, 0);
    drawText(buf, W, H, x - 6, T + ph + 10, String(Math.round(t)), 0x33, 0x33, 0x33, 2);
  }
  drawText(buf, W, H, L, 10, `${SLUG}  ${duration.toFixed(1)}s  ${bpm} BPM  bar ${meanBarSec}s`, 0x11, 0x11, 0x11, 3);
  const legend = [["energy", 0x11, 0x11, 0x11], ["kick 40-130", 0xcc, 0x33, 0x00], ["air 6k-10k", 0x00, 0x77, 0xcc], ["centroid 0-5k", 0x00, 0x99, 0x55]];
  let lx = L;
  for (const [label, r, g, b] of legend) {
    for (let k = 0; k < 22; k++) for (let q = 0; q < 3; q++) px(lx + k, 44 + q, r, g, b);
    drawText(buf, W, H, lx + 27, 41, label, r, g, b, 2);
    lx += 27 + label.length * 8 + 24;
  }
  drawText(buf, W, H, L + pw - 190, 41, "purple: section bounds", 0x8b, 0x1a, 0x8b, 2);
  fs.writeFileSync(path.join(IMG_DIR, `${SLUG}-energy.png`), encodePng(W, H, buf));

  const spec = spawnSync("ffmpeg", ["-y", "-v", "error", "-vn", "-i", AUDIO, "-lavfi",
    "showspectrumpic=s=1800x760:mode=combined:legend=1:scale=log:gain=3:color=intensity",
    path.join(IMG_DIR, `${SLUG}-spectrogram.png`)], { encoding: "utf8" });
  if (spec.status !== 0) console.error("  spectrogram failed:\n" + spec.stderr);
}

/* ── write ──────────────────────────────────────────────────────────────── */
const report = {
  $comment: "Generated by tools/analyze-structure.mjs — do not hand-edit. Measured from the SOURCE take; the delivered beds are measured separately by tools/build-music.mjs into src/data/music.json. See docs/music/<slug>.md.",
  file: path.relative(ROOT, AUDIO).split(path.sep).join("/"),
  slug: SLUG,
  durationSec: Number(duration.toFixed(3)),
  containerDurationSec: probeDuration(AUDIO),
  loudness: (() => { const l = measureLoudness(AUDIO); return { integratedLufs: l.lufs, truePeakDb: l.truePeakDb, lra: l.lra }; })(),
  brightness: global,
  tempo: {
    bpm, beatSec: Number(beatSec.toFixed(4)), nominalBarSec: Number(nominalBarSec.toFixed(4)),
    timeSignature: "4/4 — assumed, not measured. Every section length came back a whole number of 4-beat bars, which is consistent with it and does not prove it.",
    autocorrPeakBpm: baseBpm,
    octaveTest, octaveRule: "the slowest candidate whose midpoints carry no kick energy (kickMidRatio < 0.85)",
    meanBarSecFromDownbeats: meanBarSec, meanBpmFromDownbeats: Number((240 / meanBarSec).toFixed(2)),
    firstDownbeatSec: Number((downbeats[0] ?? 0).toFixed(3)), beatPhaseSec: Number(lock.beatPhaseSec.toFixed(3)),
    barPhaseOfBeat: barPhase, barPhaseVote: phaseVote,
    barPhaseMargin: Number((phaseVote[0].score / (phaseVote[1].score || 1e-9)).toFixed(3)),
    drift: {
      barByBlock, fixedGridBarSec: bar0,
      fixedGridErrorAtLastDownbeatSec: extrapErr.at(-1),
      /*
       * A ramp and a wander of the same size are not the same problem: a wander
       * comes back, a ramp does not, and only a ramp makes an extrapolated grid
       * useless by the end of a 120 s bed. The test is the accumulated error, not
       * the per-block figure — `netBarChangeSec` says which way it went and
       * `monotoneFraction` how steadily.
       */
      shape: Math.abs(extrapErr.at(-1) ?? 0) > 0.5 ? (bar0 > (barByBlock.at(-1)?.barSec ?? bar0) ? "ramp — accelerando" : "ramp — rallentando") : "wander",
      netBarChangeSec: barByBlock.length > 1 ? Number(((barByBlock.at(-1).barSec - bar0)).toFixed(4)) : 0,
      monotoneFraction: barByBlock.length > 1
        ? Number((barByBlock.slice(1).filter((b, i) => Math.sign(b.barSec - barByBlock[i].barSec) === Math.sign((barByBlock.at(-1).barSec - bar0) || 1)).length / (barByBlock.length - 1)).toFixed(2))
        : 0,
      fixedGridErrorSeries: extrapErr,
    },
  },
  grid: {
    beats: beats.length, beatHitRate40ms: hitRate(beats, times), beatHitRate40msStrong: hitRate(beats, strongTimes),
    downbeats: downbeats.length, downbeatHitRate40ms: hitRate(downbeats, times), downbeatHitRate40msStrong: hitRate(downbeats, strongTimes),
    chanceRate40msAgainstStrong: Number(chanceRate40ms.toFixed(3)),
    beatTimes: beats, downbeatTimes: downbeats,
  },
  onsets: { count: onsets.length, perSec: Number((onsets.length / duration).toFixed(2)), strongCount: strong.length, strongPerSec: Number((strong.length / duration).toFixed(2)) },
  firstStrongHitSec: Number((onsets[0]?.t ?? 0).toFixed(3)),
  ending: {
    arrangementStopsSec: ending.stopSec, ringOutEndsSec: ending.quietSec,
    ringOutSec: Number((ending.quietSec - ending.stopSec).toFixed(3)),
    lastStrongOnsetSec: ending.lastStrongOnsetSec,
    outroStartsSec: sections.at(-1)?.startSec ?? null,
  },
  sections, jumps, risers, fills, crashes,
  biggestEnergyJump: biggestJump, biggestRiser,
  strongestOnsets: [...strong].sort((a, b) => b.s - a.s).slice(0, 24).sort((a, b) => a.t - b.t).map((o) => ({ t: Number(o.t.toFixed(3)), strength: Number(o.s.toFixed(2)) })),
};
fs.mkdirSync(JSON_DIR, { recursive: true });
const jsonPath = path.join(JSON_DIR, `${SLUG}.json`);
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");

/* ── print ──────────────────────────────────────────────────────────────── */
const L2 = report.loudness;
console.log(`\n  ${report.file}`);
console.log(`  ${report.durationSec}s · ${L2.integratedLufs} LUFS · true peak ${L2.truePeakDb} dBFS${L2.truePeakDb > -0.1 ? "   <- at or over full scale as delivered" : ""} · LRA ${L2.lra}`);
console.log(`\n  Octave test (autocorrelation peak ${baseBpm} BPM)`);
console.log("    bpm      autocorr    comb   kick-midpoint/beat   phase   phase drift");
for (const r of octaveTest) {
  console.log(`    ${String(r.bpm).padStart(6)}  ${String(r.autocorr).padStart(10)}  ${r.combScore.toFixed(2).padStart(6)}  ${r.kickMidRatio.toFixed(3).padStart(18)}  ${r.beatPhaseSec.toFixed(3).padStart(6)}s  ${r.phaseDriftPer20sSec.toFixed(3).padStart(7)}s/20s${r.bpm === bpm ? "  <- the beat" : ""}`);
}
console.log(`\n  ${bpm} BPM · beat ${beatSec.toFixed(4)}s · bar ${meanBarSec}s measured (${nominalBarSec.toFixed(4)}s nominal) · first downbeat ${report.tempo.firstDownbeatSec}s`);
console.log(`  bar phase ${barPhase} of 4, margin ${report.tempo.barPhaseMargin}x over the runner-up${report.tempo.barPhaseMargin < 1.15 ? "   <- weak, read the doc" : ""}`);
console.log(`  drift: ${report.tempo.drift.shape} (${(report.tempo.drift.monotoneFraction * 100).toFixed(0)}% of blocks move the same way) · ${barByBlock.map((b) => b.bpm).join(" -> ")} BPM · a fixed ${bar0}s grid is ${extrapErr.at(-1)}s out by the last downbeat`);
console.log(`  grid: ${beats.length} beats, hit-rate ±40 ms ${(report.grid.beatHitRate40ms * 100).toFixed(1)}% all / ${(report.grid.beatHitRate40msStrong * 100).toFixed(1)}% strong (chance ${(chanceRate40ms * 100).toFixed(0)}%)`);
console.log(`  ${downbeats.length} downbeats · ${(report.grid.downbeatHitRate40ms * 100).toFixed(1)}% / ${(report.grid.downbeatHitRate40msStrong * 100).toFixed(1)}%`);
console.log(`  brightness centroid ${global.centroidHz} Hz · rolloff85 ${global.rolloff85Hz} Hz · >2 kHz ${(global.highRatio2k * 100).toFixed(1)}% · ${global.onsetsPerMin} onsets/min`);
console.log(`  first hit ${report.firstStrongHitSec}s · outro from ${report.ending.outroStartsSec}s · arrangement stops ${ending.stopSec}s · ring-out to ${ending.quietSec}s (${report.ending.ringOutSec}s)\n`);
console.log("    #   start      end     bars   bar#     dB  centroid   kick   air   ons/s   character");
for (const s of sections) {
  console.log(`   ${String(s.index).padStart(2)}  ${s.startSec.toFixed(2).padStart(7)}s ${s.endSec.toFixed(2).padStart(8)}s  ${String(s.bars).padStart(5)}  ${String(s.startBar).padStart(4)}  ${s.levelDb.toFixed(1).padStart(5)}  ${String(s.centroidHz).padStart(7)}  ${s.kickShare.toFixed(3)}  ${s.airShare.toFixed(3)}  ${s.onsetsPerSec.toFixed(2).padStart(5)}   ${s.character}`);
}
console.log("\n  boundary jumps            risers (air-band gain over the 3 s before)");
for (let i = 0; i < jumps.length; i++) {
  const r = risers[i];
  console.log(`    ${jumps[i].atSec.toFixed(2).padStart(7)}s  bar ${String(jumps[i].atBar).padStart(2)}  ${(jumps[i].deltaDb > 0 ? "+" : "") + jumps[i].deltaDb} dB      ${r ? `${(r.airGainDb > 0 ? "+" : "") + r.airGainDb} dB` : ""}`);
}
console.log(`\n  biggest energy jump: ${biggestJump ? `${biggestJump.deltaDb > 0 ? "+" : ""}${biggestJump.deltaDb} dB at ${biggestJump.atSec}s` : "none"} · biggest riser: ${biggestRiser ? `+${biggestRiser.airGainDb} dB into ${biggestRiser.intoSec}s` : "none"}`);
console.log(`\n  fills — the kick drops out for under four bars, then returns (${fills.length})`);
for (const f of fills) console.log(`    ${f.startSec.toFixed(2).padStart(7)}s -> ${f.endSec.toFixed(2).padStart(7)}s  (${f.lenSec.toFixed(2)}s)  groove resumes on the bar at ${f.resumesAtBarSec}s   in section ${f.inSection}`);
console.log(`\n  crashes — air-band transients over 2.5x the local median (${crashes.length})`);
for (const c of crashes) console.log(`    attack ${c.atSec.toFixed(2).padStart(7)}s  ${c.airRatio.toFixed(1)}x   bar line ${c.onBarSec}s  (${c.offBarMs > 0 ? "+" : ""}${c.offBarMs} ms off the bar)`);
console.log(`\n  wrote ${path.relative(ROOT, jsonPath)}${IMAGES ? ` · docs/music/${SLUG}-energy.png · docs/music/${SLUG}-spectrogram.png` : ""}\n`);
