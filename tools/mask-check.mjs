#!/usr/bin/env node
/**
 * mask-check.mjs — where can the drawing texture live without fighting the bed?
 *
 * Both SUNO takes are bright. The drawing candidates are brighter still: every
 * one of them puts 68–89% of its energy above 6 kHz, which is exactly where the
 * hats, shaker and shimmer of the music already are. Two bright things in the
 * same band do not sum to "brighter" — they sum to mush, and the usual fix
 * (turn the effect up until you can hear it) makes the music worse without
 * making the effect clearer.
 *
 * So this compares the bed and the candidate band by band, in thirds of an
 * octave, and reports:
 *
 *   headroomDb  bed level minus candidate level, per band, after the proposed
 *               gain. Negative means the candidate is louder than the music
 *               there; strongly positive means it will be inaudible.
 *   contested   bands where the two are within 6 dB AND the bed is near its own
 *               peak — the bands where a fight actually costs something.
 *
 * The output is a high-shelf recommendation, not a verdict: the aim is to move
 * the cue's energy into 1–4 kHz, where a pen reads as *precision* and where
 * this music is comparatively empty, and to take 2–3 dB off the top so it stops
 * competing with the hats.
 *
 * `--window a..b` restricts the bed measurement to a time range. Without it the
 * whole bed is measured AND the quietest and loudest 2 s windows are reported,
 * because the film's draw beat has not been placed yet for version B — the
 * scenes agent owns WHEN — and a recommendation that only holds for one window
 * is not a recommendation.
 *
 * Usage:
 *   node tools/mask-check.mjs --cue draw-b
 *   node tools/mask-check.mjs --cue draw-b --gain -10 --shelf -3
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const val = (f) => { const i = argv.indexOf(f); return i === -1 ? null : argv[i + 1]; };
const CUE = val("--cue") ?? "draw-b";
const GAIN_DB = Number(val("--gain") ?? -10);
const SHELF_DB = Number(val("--shelf") ?? 0);
const SHELF_HZ = Number(val("--shelf-hz") ?? 5000);
const BELL_DB = Number(val("--bell") ?? 0);
const BELL_HZ = Number(val("--bell-hz") ?? 10000);
const BELL_Q = Number(val("--bell-q") ?? 1.2);
const SET = val("--set") ?? "elevenlabs-audition";
const JSON_OUT = argv.includes("--json");

const SR = 48000;

const decode = (file) => {
  const r = spawnSync("ffmpeg", ["-v", "error", "-vn", "-i", file, "-ac", "1", "-ar", String(SR), "-f", "s16le", "-"],
    { maxBuffer: 1 << 30, encoding: "buffer" });
  if (r.status !== 0) throw new Error(`decode failed: ${file}`);
  const n = Math.floor(r.stdout.length / 2);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = r.stdout.readInt16LE(i * 2) / 32768;
  return x;
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

/** Third-octave centres from 125 Hz to 16 kHz. */
const CENTRES = [125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500,
  3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000];

const bandLevels = (x, from = 0, to = Infinity) => {
  const N = 4096, HOP = 2048;
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const re = new Float64Array(N), im = new Float64Array(N);
  const acc = new Float64Array(CENTRES.length);
  const a = Math.max(0, Math.round(from * SR));
  const z = Math.min(x.length, Math.round(to * SR));
  let frames = 0;
  for (let off = a; off + N <= z; off += HOP) {
    for (let i = 0; i < N; i++) { re[i] = x[off + i] * win[i]; im[i] = 0; }
    fft(re, im);
    for (let b = 0; b < CENTRES.length; b++) {
      const lo = CENTRES[b] / Math.pow(2, 1 / 6), hi = CENTRES[b] * Math.pow(2, 1 / 6);
      let e = 0;
      const k0 = Math.max(1, Math.ceil((lo * N) / SR)), k1 = Math.min(N / 2 - 1, Math.floor((hi * N) / SR));
      for (let k = k0; k <= k1; k++) e += re[k] * re[k] + im[k] * im[k];
      acc[b] += e;
    }
    frames++;
  }
  return Array.from(acc, (e) => 10 * Math.log10(e / Math.max(1, frames) + 1e-20));
};

const music = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "music.json"), "utf8"));
const bedRel = music.versions[val("--music") ?? music.active].beds["30"].file;
const bed = decode(path.join(ROOT, "public", bedRel));

const sfxDoc = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "sfx.json"), "utf8"));
const cue = sfxDoc.sets[SET].cues.find((c) => c.id === CUE);
if (!cue) { console.error(`\n  no cue "${CUE}" in set "${SET}"\n`); process.exit(1); }
/*
 * The cue is measured AFTER the real filter chain has been applied to it, not
 * with the gain and shelf modelled as arithmetic on band levels.
 *
 * The first version of this tool modelled the shelf as a step: every band at or
 * above the corner got the full cut. A real `highshelf` has a slope, so the
 * model overstated the cut just above the corner and understated it below —
 * which is precisely the region being tuned. Rendering the chain and measuring
 * the result costs one ffmpeg call and removes the guess.
 */
const CHAIN = `volume=${GAIN_DB}dB`
  + (SHELF_DB ? `,highshelf=f=${SHELF_HZ}:g=${SHELF_DB}` : "")
  // A single resonant band can survive any sensible shelf: draw-b peaks at
  // 10 kHz and a shelf steep enough to tame it takes the whole top with it.
  // One narrow bell is the surgical alternative.
  + (BELL_DB ? `,equalizer=f=${BELL_HZ}:t=q:w=${BELL_Q}:g=${BELL_DB}` : "");
const processed = path.join(ROOT, "public", "audio", "sfx", `.mask-${CUE}.wav`);
{
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostdin", "-y", "-v", "error",
    "-i", path.join(ROOT, "public", cue.file), "-af", CHAIN,
    "-ar", String(SR), "-ac", "1", "-c:a", "pcm_s16le", processed], { encoding: "utf8" });
  if (r.status !== 0) { console.error(`\n  ffmpeg failed applying "${CHAIN}":\n${r.stderr?.slice(-800)}\n`); process.exit(1); }
}
const sfx = decode(processed);
fs.unlinkSync(processed);

const windowArg = val("--window");
const [wFrom, wTo] = windowArg ? windowArg.split("..").map(Number) : [0, Infinity];

const bedBands = bandLevels(bed, wFrom, wTo);
const sfxBandsRaw = bandLevels(sfx);

/*
 * The proposed processing, applied to the measurement rather than to a file:
 * a flat gain plus a high shelf above `SHELF_HZ`. Judging the EQ on numbers
 * before rendering anything is the whole point — an EQ chosen by rendering and
 * listening is an EQ nobody here can choose.
 */
// Already processed — the measurement IS the shipped signal.
const sfxBands = sfxBandsRaw;

/* Robustness: the loudest and quietest 2 s windows of the bed, since the draw
 * beat's position in version B is not settled yet. */
const dur = bed.length / SR;
let loud = { db: -Infinity, t: 0 }, quiet = { db: Infinity, t: 0 };
for (let t = 0; t + 2 <= dur; t += 1) {
  const b = bandLevels(bed, t, t + 2);
  const broad = 10 * Math.log10(b.reduce((a, v) => a + Math.pow(10, v / 10), 0));
  if (broad > loud.db) loud = { db: broad, t };
  if (broad < quiet.db) quiet = { db: broad, t };
}

const rows = CENTRES.map((hz, i) => ({
  hz,
  bedDb: Number(bedBands[i].toFixed(1)),
  sfxDb: Number(sfxBands[i].toFixed(1)),
  headroomDb: Number((bedBands[i] - sfxBands[i]).toFixed(1)),
}));
const bedPeak = Math.max(...bedBands);
const contested = rows.filter((r, i) => Math.abs(r.headroomDb) < 6 && bedBands[i] > bedPeak - 12);

if (JSON_OUT) { console.log(JSON.stringify({ cue: CUE, gainDb: GAIN_DB, shelfDb: SHELF_DB, shelfHz: SHELF_HZ, rows, contested, loud, quiet }, null, 2)); process.exit(0); }

console.log(`\n  mask-check · ${CUE} against ${bedRel}`);
console.log(`    chain: ${CHAIN}`);
console.log(`    bed window: ${windowArg ?? `whole bed (${dur.toFixed(1)}s)`}`);
console.log(`    bed busiest 2s at ${loud.t}s · quietest 2s at ${quiet.t}s (${(loud.db - quiet.db).toFixed(1)} dB apart)\n`);
console.log("      band      bed     cue   headroom");
for (const r of rows) {
  const bar = r.headroomDb < 0 ? "  <- cue louder than the music here"
    : r.headroomDb < 6 ? "  <- contested"
    : r.headroomDb > 24 ? "  (inaudible)" : "";
  console.log(`    ${String(r.hz).padStart(6)} Hz  ${r.bedDb.toFixed(1).padStart(6)}  ${r.sfxDb.toFixed(1).padStart(6)}  ${r.headroomDb.toFixed(1).padStart(7)}${bar}`);
}
console.log(`\n  ${contested.length} contested band(s) where the bed is within 12 dB of its own peak: ` +
  `${contested.map((c) => c.hz + "Hz").join(", ") || "none"}\n`);
