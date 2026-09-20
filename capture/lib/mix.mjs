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
const FPS = 30;

/**
 * Where a cue actually lands in the delivered film, in samples.
 *
 * ⚠ The mix used to put a cue at its own second. The film cannot: the
 * composition mounts every cue in a `<Sequence from={secToFrame(rc.startSec)}>`,
 * so a cue starts on a FRAME — up to 16.7 ms from where the mix had it. That
 * sounds like nothing and decides everything a true-peak meter reports:
 * `A-confident-arrival`'s 60 s cut opens with a cue about 7 ms from the bed's
 * own entry, and 7 ms is the difference between two transients summing and
 * merely following each other. The mix predicted -2.4 dBTP; the film delivered
 * -1.2, and the gate called it fine for two rounds.
 *
 * ── The 16 ────────────────────────────────────────────────────────────────
 *
 * Landing on the frame is most of it. The remainder is a constant 16 samples
 * (0.33 ms), and it is EMPIRICAL: fitted by sliding bed+cue against the
 * delivered film's own samples, on four cues across three films and two
 * versions, where each fit is 3-200x sharper than any neighbouring offset. The
 * direction is the odd part and it is what the fits say — the cue sits 16
 * samples FURTHER along whichever way the frame rounding already moved it, and
 * a cue whose second is already on a frame is not moved at all.
 *
 * No explanation is offered for that, because none was found and a plausible
 * one would be worse than none. What licenses shipping it is the end-to-end
 * test rather than the story: with this rule the offline mix predicts the true
 * peak of ALL EIGHT delivered cuts within 0.1 dB, and names the sample each
 * peak happens on. Without it, two cuts are out by 0.4 dB in the dangerous
 * direction. The previous round charged a flat 1.1 dB "model error" margin for
 * this and trimmed two films that did not need it.
 *
 * ⚠ If Remotion's audio path changes, this number is wrong and nothing here
 * will notice. `verify:loudness` compares every prediction against the true
 * peak `package-masters.ps1` measured from the delivered file, which is what
 * will notice; re-fit with `tp-offset` (the probe in the round's scratch) if a
 * re-render starts disagreeing.
 */
const CUE_NUDGE_SAMPLES = 16;
export const cueStartSample = (startSec) => {
  const onFrame = Math.round(startSec * FPS) * (SAMPLE_RATE / FPS);
  const exact = Math.round(startSec * SAMPLE_RATE);
  return onFrame + CUE_NUDGE_SAMPLES * Math.sign(onFrame - exact);
};

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

  /*
   * `opts.version` mixes another take's bed under the ACTIVE take's cue sheet.
   *
   * That is not the same thing as that take's own mix and the gate says so: the
   * cues are derived by walking the cut, and the cut is snapped to whichever
   * take is active, so a non-active version's real sound sheet only exists while
   * it is active. What this does measure honestly is the bed's own level, its
   * true peak and its headroom under a representative cue load — which is what
   * "has version A gone out of spec?" is actually asking.
   */
  const bed = A.bedFor(cut, opts.version);
  const bedPcm = decode(path.join(ROOT, "public", bed.file));
  const sheet = cuesFor(cut);
  const events = A.duckEvents(sheet);
  const trim = dbToGain(A.MASTER_TRIM_DB);

  // The bed, ducked sample by sample with the film's own envelope.
  let ducked = 0;
  for (let i = 0; i < frames; i += 1) {
    const sec = i / SAMPLE_RATE;
    /*
     * The duck and the master trim are measured apart, and conflating them was
     * a real bug.
     *
     * This counted a frame as ducked whenever the COMBINED gain fell below
     * unity. That was indistinguishable from the truth for as long as
     * `MASTER_TRIM_DB` was exactly 0 — which it was, for every version that
     * existed when this was written. The audition versions carry a -0.5 dB
     * master trim, so the combined gain is 0.944 on every sample of the film,
     * and the gate reported the duck as ON for 100 % of the runtime and failed
     * the "a duck that is always on is a trim" check. The duck was in fact
     * never on at all: 0 windows.
     *
     * A trim is not a duck. The metric is about the envelope, so it reads the
     * envelope.
     */
    const duckG = A.duckGainAt(sec, events);
    const g = duckG * trim;
    if (duckG < 0.999) ducked += 1;
    const src = (i + Math.round((bed.offsetSec ?? 0) * SAMPLE_RATE)) * CHANNELS;
    if (src < 0 || src + 1 >= bedPcm.length) continue;
    out[i * CHANNELS] = bedPcm[src] * g;
    out[i * CHANNELS + 1] = bedPcm[src + 1] * g;
  }

  /*
   * The effects, summed on top at their own gains.
   *
   * ⚠ Three things come from `resolveCue`, not from the cue: the FILE (the role
   * resolved against this version's sound set and take), the START (the action
   * minus the cue's measured first strong onset) and the ENVELOPE (`playSec`
   * plus the equal-power fades a looped texture is made of). Reading
   * `cue.gainDb` and `cue.atSec` directly — which is what this did — measured a
   * mix nothing would ever render.
   */
  const cache = new Map();
  for (const cue of sheet) {
    const rc = A.resolveCue(cue);
    if (!cache.has(rc.file)) cache.set(rc.file, decode(path.join(ROOT, "public", rc.file)));
    const pcm = cache.get(rc.file);
    const start = cueStartSample(rc.startSec);
    const playFrames = Math.round(rc.playSec * SAMPLE_RATE);
    for (let j = 0; j + 1 < pcm.length; j += CHANNELS) {
      const n = j / CHANNELS;
      if (n >= playFrames) break;
      const i = start + n;
      if (i < 0 || i >= frames) continue;
      const g = A.cueGainAt(rc, n / SAMPLE_RATE);
      out[i * CHANNELS] += pcm[j] * g;
      out[i * CHANNELS + 1] += pcm[j + 1] * g;
    }
  }

  // Where the loudest sample is. The gate needs it: the model's error is a
  // property of an OPENING transient, so the margin it carries depends on
  // whether this cut's peak is one.
  let peak = 0;
  let peakAt = 0;
  for (let i = 0; i < out.length; i += 1) {
    const a = Math.abs(out[i]);
    if (a > peak) { peak = a; peakAt = i; }
  }

  return {
    cut,
    durationSec,
    pcm: out,
    peakAtSec: peakAt / CHANNELS / SAMPLE_RATE,
    events,
    duckedFraction: ducked / frames,
    cueCount: sheet.length,
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

/**
 * The AAC the master is delivered in, and why the gate now measures it.
 *
 * ⚠ The offline mix predicted -1.4 dBTP for `B-daylight-forward+el`'s 15 s cut
 * and the rendered film measured **-1.0**, 0.027 dB under the ceiling. The mix
 * was not wrong about the mix: a lossy encoder reconstructs a waveform that is
 * close in the ear and not identical on the sample, and the difference shows up
 * as inter-sample overshoot at exactly the transients a true-peak meter is
 * about. The same gap is in D33's table — the 60 s cut predicted -2.4 and
 * measured -1.2 — recorded there as "unmodelled headroom" and left alone.
 *
 * A prediction that is systematically optimistic about the one number with no
 * margin left is worse than no prediction, so the gate stops predicting and
 * encodes: same codec and bitrate `package-masters.ps1` delivers, measured
 * after the encode. It costs one ffmpeg pass per cut.
 *
 * LUFS is still read off the float mix. Integrated loudness is a long-window
 * average and the encode moves it by hundredths; true peak is the one the
 * encoder changes.
 */
/**
 * The delivery's real audio settings, PROBED from a master rather than typed.
 *
 * ⚠ 192k was a guess and it was wrong: Remotion's own AAC settings deliver
 * ~317 kbps. It was also not the cause of the gap it was blamed for — see the
 * note on `deliverySettings` below — but a gate that claims to encode "what is
 * delivered" may not carry a number nobody checked.
 *
 * Falls back to the recorded default when no master is on disk, and says which
 * it used.
 */
const FALLBACK_BITRATE = 317375;

let cachedDelivery = null;

export const deliverySettings = () => {
  if (cachedDelivery) return cachedDelivery;
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\//, ""), "..", "..");
  const masters = path.join(root, "out", "masters");
  let probed = null;
  if (fs.existsSync(masters)) {
    for (const version of fs.readdirSync(masters)) {
      const dir = path.join(masters, version);
      if (!fs.statSync(dir).isDirectory()) continue;
      const file = fs.readdirSync(dir).find((n) => n.endsWith(".mp4"));
      if (!file) continue;
      const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries",
        "stream=codec_name,bit_rate,sample_rate,channels", "-of", "default=noprint_wrappers=1", path.join(dir, file)],
        { encoding: "utf8" });
      const get = (k) => (String(r.stdout ?? "").match(new RegExp(`${k}=(\S+)`)) ?? [])[1];
      const br = Number(get("bit_rate"));
      if (Number.isFinite(br) && br > 0) {
        probed = { codec: get("codec_name"), bitrate: br, sampleRate: Number(get("sample_rate")), channels: Number(get("channels")), from: `${version}/${file}` };
        break;
      }
    }
  }
  cachedDelivery = probed ?? { codec: "aac", bitrate: FALLBACK_BITRATE, sampleRate: SAMPLE_RATE, channels: CHANNELS, from: "no master on disk — recorded default" };
  return cachedDelivery;
};

const encodeAac = (wavAbs, outAbs) => {
  const d = deliverySettings();
  ffmpeg(["-y", "-i", wavAbs, "-c:a", d.codec === "aac" ? "aac" : d.codec, "-b:a", String(d.bitrate), "-ar", String(d.sampleRate), "-ac", String(d.channels), outAbs]);
  return outAbs;
};

/** Mix a cut, write it to a scratch WAV, encode it, and measure both. */
export const mixAndMeasure = async (cut, film, version) => {
  const mix = await mixCut(cut, { film, version });
  const base = path.join(os.tmpdir(), `archcanvas-mix-${version ?? "active"}-${cut}`);
  const wav = `${base}.wav`;
  const m4a = `${base}.m4a`;
  writeWav(mix.pcm, wav);
  const float = measure(wav);
  let encoded = { truePeakDb: NaN };
  try {
    encodeAac(wav, m4a);
    encoded = measure(m4a);
  } catch {
    // An encoder that is not there is a gate that says so, not one that
    // silently reports the float peak as if it were the delivered one.
  }
  fs.rmSync(wav, { force: true });
  fs.rmSync(m4a, { force: true });
  return {
    ...mix,
    ...float,
    /** The peak of the FLOAT mix, kept so the encode's cost can be read. */
    floatPeakDb: float.truePeakDb,
    truePeakDb: encoded.truePeakDb,
    pcm: undefined,
  };
};
