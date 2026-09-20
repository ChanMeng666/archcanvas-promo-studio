#!/usr/bin/env node
/**
 * rate-draw.mjs — decide which drawing texture the film uses, by measurement.
 *
 * The founder is not auditioning individual sounds any more; they will watch
 * finished films. So the choice is ours, and it should be defensible rather
 * than preferred. The intent is fixed — the plan draws itself stroke by stroke,
 * walls first, and the sound should read as precise technical drafting — and
 * `draw-a` (technical pen and ruler) is the intended shape. This tool exists to
 * find out whether its NUMBERS disqualify it.
 *
 * ── The disqualifying criteria, and why each one matters here ───────────────
 *
 * A cue that plays as a continuous bed under a 3–8 s drawing beat has failure
 * modes a one-shot does not:
 *
 *   gapSec       The longest run of near-silence inside the texture. A drafting
 *                sound with a 0.8 s hole in it reads as the audio dropping out,
 *                not as a pause between strokes. Threshold 0.6 s.
 *   swingDb      Short-term (100 ms) level range, 5th to 95th percentile. Past
 *                about 8 dB the bed pumps against the music instead of sitting
 *                under it.
 *   crescendo    Slope of short-term level over the file, in dB/s. A texture
 *                that builds cannot be looped or trimmed to fit a beat of
 *                unknown length, and it fights a musical phrase that is not
 *                building with it.
 *   highRatio    Share of energy above 6 kHz. The bed is bright — hats and
 *                shimmer live up there — so a pen that is mostly 8 kHz hiss
 *                competes with the music for the same band and has to be
 *                high-shelved until it disappears.
 *   tonality     Spectral flatness (Wiener entropy), 0 = pure tone, 1 = noise.
 *                A drafting sound with a pitch in it will clash with the key.
 *
 * Usage:  node tools/rate-draw.mjs [--set elevenlabs-audition] [--json]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const val = (f) => { const i = argv.indexOf(f); return i === -1 ? null : argv[i + 1]; };
const SET = val("--set") ?? "elevenlabs-audition";
const JSON_OUT = argv.includes("--json");

const SR = 48000;
const GAP_MAX_SEC = 0.6;
const SWING_MAX_DB = 8;
const HIGH_HZ = 6000;

const decode = (file) => {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", String(SR), "-f", "s16le", "-"],
    { maxBuffer: 1 << 30, encoding: "buffer" });
  if (r.status !== 0) throw new Error(`decode failed: ${file}`);
  const n = Math.floor(r.stdout.length / 2);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = r.stdout.readInt16LE(i * 2) / 32768;
  return x;
};

const db = (v) => (v > 0 ? 20 * Math.log10(v) : -120);

/** 100 ms RMS frames — the scale at which a bed is felt to pump. */
const shortTerm = (x, winSec = 0.1) => {
  const w = Math.round(winSec * SR);
  const out = [];
  for (let i = 0; i + w <= x.length; i += w) {
    let acc = 0;
    for (let j = i; j < i + w; j++) acc += x[j] * x[j];
    out.push({ t: i / SR, db: db(Math.sqrt(acc / w)) });
  }
  return out;
};

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))];

/** Longest run, in seconds, more than `downDb` below the file's own median frame. */
const longestGap = (frames, downDb = 18) => {
  const med = percentile([...frames.map((f) => f.db)].sort((a, b) => a - b), 0.5);
  const floor = med - downDb;
  let best = 0, run = 0;
  for (const f of frames) {
    if (f.db < floor) { run += 0.1; best = Math.max(best, run); } else run = 0;
  }
  return { gapSec: Number(best.toFixed(2)), floorDb: Number(floor.toFixed(1)), medianDb: Number(med.toFixed(1)) };
};

/** Least-squares slope of short-term level, dB per second. */
const slopeDbPerSec = (frames) => {
  const n = frames.length;
  const mx = frames.reduce((a, f) => a + f.t, 0) / n;
  const my = frames.reduce((a, f) => a + f.db, 0) / n;
  let num = 0, den = 0;
  for (const f of frames) { num += (f.t - mx) * (f.db - my); den += (f.t - mx) ** 2; }
  return Number((num / den).toFixed(2));
};

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

/**
 * Band shares and spectral flatness.
 *
 * Flatness is the ratio of geometric to arithmetic mean of the magnitude
 * spectrum: 1 for white noise, →0 for a pure tone. It is the cheap, honest way
 * to ask "is there a pitch in here?" without guessing at harmonics.
 */
const spectrum = (x) => {
  const N = 2048, HOP = 1024;
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const re = new Float64Array(N), im = new Float64Array(N);
  const bandTotal = new Float64Array(N / 2);
  let flatSum = 0, frames = 0, high = 0, mid = 0, total = 0;
  for (let off = 0; off + N <= x.length; off += HOP) {
    for (let i = 0; i < N; i++) { re[i] = x[off + i] * win[i]; im[i] = 0; }
    fft(re, im);
    let energy = 0, logSum = 0, linSum = 0, bins = 0;
    for (let k = 1; k < N / 2; k++) {
      const m = Math.sqrt(re[k] * re[k] + im[k] * im[k]) + 1e-12;
      const hz = (k * SR) / N;
      bandTotal[k] += m;
      energy += m;
      if (hz >= HIGH_HZ) high += m;
      if (hz >= 1000 && hz < 4000) mid += m;
      total += m;
      logSum += Math.log(m); linSum += m; bins++;
    }
    if (energy > 1e-6) { flatSum += Math.exp(logSum / bins) / (linSum / bins); frames++; }
  }
  return {
    highRatio6k: Number((high / total).toFixed(4)),
    midRatio1to4k: Number((mid / total).toFixed(4)),
    flatness: Number((flatSum / Math.max(1, frames)).toFixed(4)),
  };
};

const sfxDoc = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "sfx.json"), "utf8"));
const cues = sfxDoc.sets[SET].cues.filter((c) => c.role === "draw");

const rows = cues.map((c) => {
  const x = decode(path.join(ROOT, "public", c.file));
  const frames = shortTerm(x);
  const levels = frames.map((f) => f.db).sort((a, b) => a - b);
  const swing = percentile(levels, 0.95) - percentile(levels, 0.05);
  const gap = longestGap(frames);
  const sp = spectrum(x);
  return {
    id: c.id,
    concept: c.concept,
    durationSec: c.durationSec,
    gapSec: gap.gapSec,
    swingDb: Number(swing.toFixed(1)),
    slopeDbPerSec: slopeDbPerSec(frames),
    ...sp,
    fails: [
      gap.gapSec > GAP_MAX_SEC ? `gap ${gap.gapSec}s > ${GAP_MAX_SEC}s` : null,
      swing > SWING_MAX_DB ? `swing ${swing.toFixed(1)} dB > ${SWING_MAX_DB} dB` : null,
      Math.abs(slopeDbPerSec(frames)) > 1.0 ? `slope ${slopeDbPerSec(frames)} dB/s (crescendo)` : null,
      sp.flatness < 0.15 ? `flatness ${sp.flatness} (tonal)` : null,
    ].filter(Boolean),
  };
});

// "Harsh above 6 kHz" is relative to the others, so it is judged after the set
// is measured rather than against an absolute number invented here.
const meanHigh = rows.reduce((a, r) => a + r.highRatio6k, 0) / rows.length;
for (const r of rows) {
  if (r.highRatio6k > meanHigh * 1.15) r.fails.push(`high-band ${(r.highRatio6k * 100).toFixed(1)}% vs set mean ${(meanHigh * 100).toFixed(1)}%`);
}

if (JSON_OUT) { console.log(JSON.stringify({ meanHigh, rows }, null, 2)); process.exit(0); }

console.log(`\n  rate-draw · set "${SET}" · ${rows.length} candidates`);
console.log(`  thresholds: gap <= ${GAP_MAX_SEC}s · swing <= ${SWING_MAX_DB} dB · |slope| <= 1.0 dB/s · flatness >= 0.15 · >6kHz <= ${(meanHigh * 1.15 * 100).toFixed(1)}% (set mean +15%)\n`);
console.log("    id        dur    gap   swing   slope   >6kHz   1-4kHz  flatness   verdict");
for (const r of rows) {
  console.log(
    `    ${r.id.padEnd(8)} ${r.durationSec.toFixed(2)}s  ${r.gapSec.toFixed(2)}s  ${r.swingDb.toFixed(1).padStart(5)}  ` +
    `${r.slopeDbPerSec.toFixed(2).padStart(6)}  ${(r.highRatio6k * 100).toFixed(1).padStart(5)}%  ${(r.midRatio1to4k * 100).toFixed(1).padStart(5)}%  ` +
    `${r.flatness.toFixed(3).padStart(7)}   ${r.fails.length ? "FAIL" : "ok"}`,
  );
  for (const f of r.fails) console.log(`             - ${f}`);
}
const passing = rows.filter((r) => !r.fails.length);
console.log(`\n  ${passing.length} of ${rows.length} clear every threshold: ${passing.map((r) => r.id).join(", ") || "(none)"}\n`);
