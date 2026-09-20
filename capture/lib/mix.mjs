/**
 * mix.mjs — build the film's audio offline, from the same data the film plays.
 *
 * ── Why mix rather than render ─────────────────────────────────────────────
 *
 * Eight masters came back at **-17.3 to -17.9 LUFS** against a -16 target, and
 * the cause was in the data: the music duck was on for 51-74 % of the runtime,
 * which is a trim rather than a duck. Finding that needed a number, and a number
 * needed a decoded mix — but a full Remotion render is twenty minutes of picture
 * to hear thirty seconds of sound, on a 16 GB machine shared with two other
 * agents.
 *
 * So this builds the mix from the manifests: the bed, the cue sheet, the duck
 * envelope, the master trim. It plays the SAME `duckGainAt` the component does,
 * because a measurement of a different envelope measures nothing.
 *
 * ffmpeg decodes (and later measures); the summing is done here, in float, so
 * the envelope applied is exactly the film's and not an approximation of it in
 * filter syntax.
 *
 * ── What it is NOT ─────────────────────────────────────────────────────────
 *
 * Not a substitute for hearing the film, and not a claim that the master will
 * measure to the decimal: Remotion resamples and encodes on its own path. It is
 * an instrument for the thing that was wrong — how much of the time the music is
 * pulled down, and roughly where the mix lands — and it is deterministic, which
 * an ear is not.
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadFilm } from "./load-core.mjs";

export const SAMPLE_RATE = 48000;
const CHANNELS = 2;

const ffmpeg = (args) =>
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", ...args], {
    maxBuffer: 1 << 30,
    encoding: "buffer",
  });

/** Decode any audio file to interleaved stereo float32 at 48 kHz. */
const decode = (abs) => {
  const raw = ffmpeg(["-i", abs, "-f", "f32le", "-ac", String(CHANNELS), "-ar", String(SAMPLE_RATE), "-"]);
  return new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.byteLength / 4));
};

const dbToGain = (db) => Math.pow(10, db / 20);

/**
 * Mix one cut and return the interleaved float32 buffer plus what was applied.
 *
 * `durationSec` is the cut's own length — the bed is trimmed or zero-padded to
 * it, exactly as a `<Sequence>` would.
 */
export const mixCut = async (cut, opts = {}) => {
  const film = opts.film ?? (await loadFilm());
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\//, ""), "..", "..");
  const A = film.audio;
  const { cuesFor } = film.cues;
  const { CUT_SECONDS } = film.layout;

  const durationSec = CUT_SECONDS[cut];
  const frames = Math.round(durationSec * SAMPLE_RATE);
  const out = new Float32Array(frames * CHANNELS);

  const bed = A.bedFor(cut);
  const bedPcm = decode(path.join(ROOT, "public", bed.file));
  const windows = A.duckWindows(cuesFor(cut));
  const trim = dbToGain(A.MASTER_TRIM_DB);

  // The bed, ducked sample by sample with the film's own envelope.
  let ducked = 0;
  for (let i = 0; i < frames; i += 1) {
    const sec = i / SAMPLE_RATE;
    const g = A.duckGainAt(sec, windows) * trim;
    if (g < 0.999) ducked += 1;
    const src = (i + Math.round((bed.offsetSec ?? 0) * SAMPLE_RATE)) * CHANNELS;
    if (src < 0 || src + 1 >= bedPcm.length) continue;
    out[i * CHANNELS] = bedPcm[src] * g;
    out[i * CHANNELS + 1] = bedPcm[src + 1] * g;
  }

  // The effects, summed on top at their own gains.
  const cache = new Map();
  for (const cue of cuesFor(cut)) {
    const meta = A.sfx(cue.sfx);
    if (!cache.has(meta.file)) cache.set(meta.file, decode(path.join(ROOT, "public", meta.file)));
    const pcm = cache.get(meta.file);
    const g = dbToGain(cue.gainDb ?? 0);
    const start = Math.round(cue.atSec * SAMPLE_RATE);
    for (let j = 0; j + 1 < pcm.length; j += CHANNELS) {
      const i = start + j / CHANNELS;
      if (i < 0 || i >= frames) continue;
      out[i * CHANNELS] += pcm[j] * g;
      out[i * CHANNELS + 1] += pcm[j + 1] * g;
    }
  }

  return {
    cut,
    durationSec,
    pcm: out,
    windows,
    duckedFraction: ducked / frames,
    cueCount: cuesFor(cut).length,
    masterTrimDb: A.MASTER_TRIM_DB,
  };
};

/** Write a float32 mix to a WAV ffmpeg can read back. */
export const writeWav = (pcm, abs) => {
  const bytes = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + bytes.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(3, 20); // IEEE float
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * CHANNELS * 4, 28);
  header.writeUInt16LE(CHANNELS * 4, 32);
  header.writeUInt16LE(32, 34);
  header.write("data", 36);
  header.writeUInt32LE(bytes.length, 40);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, Buffer.concat([header, bytes]));
};

/**
 * Integrated loudness, loudness range and TRUE peak, from ffmpeg.
 *
 * `ebur128` with `peak=true` reports the true peak, which is what a platform
 * limiter looks at — a sample peak under 0 dBFS can still inter-sample over.
 */
export const measure = (wavAbs) => {
  // `spawnSync`, not `execFileSync`: ebur128 writes its summary to STDERR and
  // exits 0, so the success path is exactly the path that throws nothing and
  // returns nothing. The first version of this read `err.stderr` and measured
  // NaN on every file that worked.
  const r = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-i", wavAbs, "-af", "ebur128=peak=true", "-f", "null", "-"],
    { maxBuffer: 1 << 28, encoding: "utf8" },
  );
  const stderr = String(r.stderr ?? "");
  const tail = stderr.slice(stderr.lastIndexOf("Integrated loudness"));
  const num = (label) => {
    const m = tail.match(new RegExp(label + ":\\s*(-?\\d+(?:\\.\\d+)?)"));
    return m ? Number(m[1]) : NaN;
  };
  return { lufs: num("I"), lra: num("LRA"), truePeakDb: num("Peak") };
};

/** Mix a cut, write it to a scratch WAV and measure it. */
export const mixAndMeasure = async (cut, film) => {
  const mix = await mixCut(cut, { film });
  const wav = path.join(os.tmpdir(), `archcanvas-mix-${cut}.wav`);
  writeWav(mix.pcm, wav);
  const m = measure(wav);
  fs.rmSync(wav, { force: true });
  return { ...mix, ...m, pcm: undefined };
};
