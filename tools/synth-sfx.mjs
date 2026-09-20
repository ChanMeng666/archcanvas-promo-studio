#!/usr/bin/env node
/**
 * synth-sfx.mjs — every sound effect in this film, synthesised offline with
 * ffmpeg and nothing else.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * It is not a compromise. See `docs/audio-provenance.md` for the full evidence
 * and `docs/decisions.md` D4 for the ruling, but the short version is: the eight
 * drafting-room cues the earlier films used were generated through ElevenLabs on
 * 2026-09-07, the key they came off reported `tier: "free"` when it was checked
 * the next day, and that plan's terms withhold commercial rights from anything
 * created outside a paid subscription *before or after*. The sibling film
 * deleted all twelve of its ElevenLabs assets over exactly this. So this film
 * does not inherit them.
 *
 * What replaces them is better in the one way that matters here: **provenance is
 * unambiguous by construction.** There is no vendor, no account, no tier and no
 * terms — there is a filter graph in this file, and running it again produces
 * the same bytes. For a UI-sound palette that is most of the job anyway.
 *
 * ── Two properties this file is built to hold ───────────────────────────────
 *
 * 1. **Committed AND regenerable.** The .wav files are checked in, because a
 *    fresh clone must be able to render the film without an ffmpeg on the box.
 *    But every one of them can be rebuilt from here, and `src/data/sfx.json`
 *    carries a sha256 of each cue's filter graph so a silent divergence between
 *    the recipe and the bytes on disk is visible. Change a graph, the hash
 *    changes, and `--check` says which cue drifted.
 * 2. **Deterministic.** Every `anoisesrc` carries an explicit `seed`. Without
 *    one, ffmpeg seeds from the clock and "regenerable" quietly becomes
 *    "re-rollable" — you would get a different sound design every run and the
 *    hash would be a lie.
 *
 * ── WAV, not MP3, and this is deliberate ────────────────────────────────────
 *
 * The music beds are MP3 (a 120-second bed as WAV is 23 MB and git keeps every
 * version). The cues are WAV, because **MP3 prepends encoder delay** — on the
 * order of 1152 samples, about 24 ms. On a 92 ms key-press that is a quarter of
 * the sound arriving late, and it is late by an amount that depends on the
 * decoder. A cue sheet that places a click on a frame and then hears it 24 ms
 * later is a sync bug nobody would find by looking. WAV is sample-exact, and at
 * these lengths it is also *smaller* than the beds by two orders of magnitude.
 *
 * Remotion's core `<Audio>` decodes WAV through Chrome and is fine with it. (The
 * trap the sibling repo paid for was `@remotion/media`'s `<Audio>` rendering a
 * silent track — a component choice, not a container choice. Use the core one.)
 *
 * ── Listening by numbers ────────────────────────────────────────────────────
 *
 * Nobody involved in generating these can hear them. So every cue is verified
 * the only way it can be: `ffprobe` for duration and format, `astats` for peak,
 * RMS, DC offset and flat-count (clipping), and `showspectrumpic` for a picture
 * of the envelope and the spectral motion. `--spectrograms` writes those PNGs.
 * They are how you catch a "sweep" that does not sweep, or a cue that is all
 * click and no body — both of which happened while this file was being written.
 *
 * Usage:
 *   node tools/synth-sfx.mjs                    # build every cue + sfx.json
 *   node tools/synth-sfx.mjs --only key-1,pop   # build a subset
 *   node tools/synth-sfx.mjs --spectrograms     # also write PNGs to the scratch dir
 *   node tools/synth-sfx.mjs --check            # verify disk against the recipe hashes
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "audio", "sfx");
const MANIFEST = path.join(ROOT, "src", "data", "sfx.json");
const SPECTRO_DIR = "D:\\.claude-scratch\\2026-09-19\\studio-replica\\sfx-spectrograms";

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => { const i = argv.indexOf(f); return i === -1 ? null : argv[i + 1]; };
const ONLY = val("--only")?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
const SPECTROGRAMS = has("--spectrograms");
const CHECK = has("--check");

const SR = 48000;
/** Every cue is normalised to exactly this peak. Headroom for the mix. */
const PEAK_DBFS = -3.0;

/* ── filter-graph helpers ───────────────────────────────────────────────────── */

/**
 * A swept-noise "grain cloud".
 *
 * ffmpeg's `highpass` / `lowpass` / `bandpass` take a fixed frequency — there is
 * no way to automate one over time. So a spectral sweep is built the granular
 * way: N short noise bursts, each band-passed at its own centre frequency,
 * each given a triangular envelope, and overlapped 50% so the envelopes sum
 * flat. Two linear ramps crossing at half-height add to a constant, which is why
 * the fades are exactly `hop` long and the grains are exactly `2 * hop`.
 *
 * This is what makes `pencil-line` sound like a stroke rather than a hiss, and
 * it is the part to LOOK at on a spectrogram — a broken sweep shows up as
 * stripes, and a sweep that is not sweeping shows up as a flat band.
 *
 * @returns {{inputs: string[], chain: string, label: string}}
 */
const sweepNoise = ({ label, dur, f0, f1, n = 14, q = 1.4, color = "white", seed = 1, gain = 1, cascade = 3 }) => {
  const hop = dur / n;
  const grain = hop * 2;
  const inputs = [];
  const parts = [];
  const tags = [];
  for (let i = 0; i < n; i++) {
    // Log sweep: pitch is perceived logarithmically, so an even spread in Hz
    // sounds like it accelerates and then stalls.
    const f = f0 * Math.pow(f1 / f0, n === 1 ? 0 : i / (n - 1));
    const w = Math.max(60, f / q);
    inputs.push(`anoisesrc=d=${(dur + hop).toFixed(4)}:c=${color}:a=1:s=${seed + i}:r=${SR}`);
    const delayMs = Math.round(i * hop * 1000);
    /*
     * The bandpass is CASCADED, and the first version of this file was not.
     *
     * `bandpass` is second-order — about 12 dB/octave. Against white noise that
     * is nowhere near enough: the first spectrogram of `pencil-line` showed
     * usable energy all the way to 19 kHz, so all twenty grains overlapped into
     * one broadband wall and the sweep — which is the entire point of the cue —
     * was invisible on the picture and would have been inaudible under a bed.
     * Three passes gives ~36 dB/octave, which is enough for the moving band to
     * actually read as movement.
     *
     * This is exactly the class of defect the spectrogram pass exists to catch:
     * the file was the right length, the right peak and the right duration, and
     * it was still the wrong sound.
     */
    const band = Array.from({ length: cascade }, () => `bandpass=f=${f.toFixed(1)}:width_type=h:w=${w.toFixed(1)}`).join(",");
    /*
     * Every grain is a FULL-LENGTH noise source positioned by its fade times,
     * not a short one moved with `adelay`. That is the second correction this
     * function needed, and the bug behind it was nasty.
     *
     * With `adelay`, the sixteen inputs all had different lengths, and `amix`
     * intermittently produced silence for the late-arriving ones: `whoosh-in`
     * and `whoosh-out` each came out the correct total DURATION with only the
     * first grain audible — about 17% of the sound — on roughly one build in
     * six, from byte-identical inputs. It was blamed on the trim filter first,
     * and replacing that did not fix it, which is what finally pointed at the
     * mixer.
     *
     * `afade=t=in:st=X` is silent before X, so a fade pair positions a grain
     * exactly as `adelay` did, sample-accurately, while leaving every input the
     * same length. With nothing ragged to mix, there is no dropout case for
     * `amix` to get wrong.
     */
    parts.push(
      `[${label}in${i}]${band},` +
      `afade=t=in:st=${(i * hop).toFixed(4)}:d=${hop.toFixed(4)}:curve=tri,` +
      `afade=t=out:st=${(i * hop + hop).toFixed(4)}:d=${hop.toFixed(4)}:curve=tri` +
      `[${label}g${i}]`,
    );
    void delayMs;
    tags.push(`[${label}g${i}]`);
  }
  parts.push(`${tags.join("")}amix=inputs=${n}:normalize=0:duration=longest,volume=${gain}[${label}]`);
  return { inputs, chain: parts.join(";"), label, dur: dur + hop };
};

/** A decaying sine — the body of a thud, a ping or a bell partial. */
const tone = ({ label, freq, dur, decay = dur, gain = 1, delay = 0, curve = "cub" }) => ({
  // Positioned by fade times on a full-length source rather than by `adelay`,
  // so every layer entering `amix` is the same length. See the note in
  // `sweepNoise` for the mixer bug that rule exists to avoid.
  inputs: [`sine=f=${freq}:d=${(delay + dur).toFixed(4)}:r=${SR}`],
  chain:
    `[${label}in0]afade=t=in:st=${delay.toFixed(4)}:d=0.004:curve=tri,` +
    `afade=t=out:st=${delay.toFixed(4)}:d=${decay.toFixed(4)}:curve=${curve}` +
    `,volume=${gain}[${label}]`,
  label,
  dur: delay + dur,
});

/**
 * A frequency chirp, as an explicit phase expression.
 *
 * instantaneous frequency f(t) = f0 + k*t, so phase(t) = 2*PI*(f0*t + k*t^2/2).
 * Writing the phase rather than the frequency is the whole trick: `sin(2*PI*f(t)*t)`
 * is the obvious-looking version and it is WRONG — it sweeps at twice the rate
 * you asked for, because t multiplies the already-varying f.
 */
const chirp = ({ label, f0, f1, dur, gain = 1, delay = 0, decay = dur }) => {
  const k = (f1 - f0) / dur;
  return {
    inputs: [`aevalsrc='sin(2*PI*(${f0}*t+${(k / 2).toFixed(4)}*t*t))':d=${dur.toFixed(4)}:s=${SR}`],
    chain:
      `[${label}in0]afade=t=in:st=0:d=0.003:curve=tri,` +
      `afade=t=out:st=0:d=${decay.toFixed(4)}:curve=exp` +
      (delay > 0 ? `,adelay=${Math.round(delay * 1000)}:all=1` : "") +
      `,volume=${gain}[${label}]`,
    label,
    dur: delay + dur,
  };
};

/** A short enveloped noise burst — clicks, transients, air. */
const burst = ({ label, dur, hp = 0, lp = 0, color = "white", seed = 1, gain = 1, delay = 0, attack = 0.002, curve = "exp", cascade = 2 }) => {
  const filters = [];
  // Cascaded for the same reason as the sweep: one second-order lowpass leaves
  // enough noise an octave up to make a key press read as a hiss.
  if (hp) for (let i = 0; i < cascade; i++) filters.push(`highpass=f=${hp}`);
  if (lp) for (let i = 0; i < cascade; i++) filters.push(`lowpass=f=${lp}`);
  filters.push(`afade=t=in:st=${delay.toFixed(4)}:d=${attack.toFixed(4)}:curve=tri`);
  filters.push(`afade=t=out:st=${(delay + attack).toFixed(4)}:d=${Math.max(0.001, dur - attack).toFixed(4)}:curve=${curve}`);
  filters.push(`volume=${gain}`);
  return {
    inputs: [`anoisesrc=d=${(delay + dur).toFixed(4)}:c=${color}:a=1:s=${seed}:r=${SR}`],
    chain: `[${label}in0]${filters.join(",")}[${label}]`,
    label,
    dur: delay + dur,
  };
};

/**
 * Assemble layers into one graph.
 *
 * Every layer names its own inputs; this renumbers them into the real ffmpeg
 * input indices, sums the layers, and applies a tail filter chain. `amix` with
 * `normalize=0` sums rather than averaging — averaging would make a two-layer
 * cue quieter than a one-layer cue for no musical reason, and the final
 * normalisation pass would then just undo it differently per cue.
 */
const assemble = (layers, tail = "") => {
  const inputs = [];
  const chains = [];
  /*
   * Every layer is padded to the cue's longest layer before mixing. Same reason
   * as the grains: `amix` mishandled ragged inputs intermittently, dropping the
   * late ones to silence on about one build in six. `apad` + `atrim` makes every
   * branch exactly `span` long, so there is no dropout condition at all.
   */
  const span = Math.max(...layers.map((l) => l.dur ?? 0));
  for (const layer of layers) {
    const base = inputs.length;
    inputs.push(...layer.inputs);
    // Rewire this layer's private [<label>inN] tags onto real input indices.
    let chain = layer.chain;
    for (let i = layer.inputs.length - 1; i >= 0; i--) {
      chain = chain.split(`[${layer.label}in${i}]`).join(`[${base + i}:a]`);
    }
    // Re-tag the layer's output so the pad chain can consume it. A plain suffix
    // swap, not a regex: `[a]` inside a RegExp is a character class, and an
    // under-escaped version of this line silently matched nothing and produced
    // a graph with an unconnected filter output.
    const outTag = `[${layer.label}]`;
    if (!chain.endsWith(outTag)) throw new Error(`layer "${layer.label}" does not end by producing ${outTag}`);
    chain = chain.slice(0, -outTag.length) + `[${layer.label}raw]`;
    chains.push(chain);
    chains.push(
      `[${layer.label}raw]apad=whole_dur=${span.toFixed(4)},atrim=end=${span.toFixed(4)},asetpts=N/SR/TB[${layer.label}]`,
    );
  }
  const tags = layers.map((l) => `[${l.label}]`).join("");
  const mix = layers.length === 1
    ? `${tags}anull[mixed]`
    : `${tags}amix=inputs=${layers.length}:normalize=0:duration=longest[mixed]`;
  chains.push(mix);
  /*
   * A global sub-sonic highpass, on every cue.
   *
   * The spectrograms showed a solid bright band under ~60 Hz across the full
   * length of the swept cues — bandpass ringing and mix residue, not signal.
   * Nothing in this roster is meant to have content down there (the lowest
   * intended fundamental is `end-hit` at 74 Hz), it is inaudible on the devices
   * a promo gets watched on, and it is NOT free: it counts toward the peak, so
   * the normalisation pass was spending real headroom on rumble and making the
   * audible part of every sweep quieter than it should be.
   */
  chains.push(`[mixed]highpass=f=45,highpass=f=45,aformat=sample_fmts=s16:sample_rates=${SR}:channel_layouts=mono${tail ? "," + tail : ""}[out]`);
  return { inputs, filterComplex: chains.join(";") };
};

/* ── the cue roster ─────────────────────────────────────────────────────────── */
/*
 * Short, dry and tasteful — modern product-film UI sounds, not arcade. Nothing
 * here is longer than 1.2 s and most are under 300 ms, because a cue that
 * outlasts the gesture that caused it reads as a mistake.
 *
 * `desc` is what the cue is FOR, so a future editor picking one does not have to
 * guess from the id.
 */
const CUES = [
  /*
   * Three key variants, and the reason is the whole point: the replica types a
   * brief character by character. One `key` sample fired forty times is a
   * machine gun — the ear locks onto the identical transient instantly. Three
   * variants cycled break the pattern for almost nothing. They differ in body
   * pitch and in the noise seed, not in level.
   */
  {
    id: "key-1", desc: "Keyboard character — variant 1 of 3, cycled so typing does not machine-gun.",
    build: () => assemble([
      burst({ label: "a", dur: 0.055, hp: 1400, lp: 7000, seed: 101, gain: 0.55, attack: 0.001 }),
      tone({ label: "b", freq: 168, dur: 0.07, decay: 0.07, gain: 0.5 }),
    ]),
  },
  {
    id: "key-2", desc: "Keyboard character — variant 2 of 3.",
    build: () => assemble([
      burst({ label: "a", dur: 0.052, hp: 1600, lp: 7600, seed: 202, gain: 0.55, attack: 0.001 }),
      tone({ label: "b", freq: 154, dur: 0.065, decay: 0.065, gain: 0.5 }),
    ]),
  },
  {
    id: "key-3", desc: "Keyboard character — variant 3 of 3.",
    build: () => assemble([
      burst({ label: "a", dur: 0.058, hp: 1250, lp: 6600, seed: 303, gain: 0.55, attack: 0.001 }),
      tone({ label: "b", freq: 182, dur: 0.075, decay: 0.075, gain: 0.5 }),
    ]),
  },
  {
    id: "click", desc: "A pointer click on a control — button, chip, menu item.",
    build: () => assemble([
      burst({ label: "a", dur: 0.035, hp: 2200, lp: 9000, seed: 404, gain: 0.6, attack: 0.0008 }),
      tone({ label: "b", freq: 420, dur: 0.045, decay: 0.045, gain: 0.35 }),
    ]),
  },
  {
    id: "whoosh-in", desc: "A panel, card or menu arriving. Rising sweep.",
    build: () => assemble([
      sweepNoise({ label: "a", dur: 0.34, f0: 320, f1: 3600, n: 16, q: 1.9, color: "pink", seed: 500, gain: 0.9 }),
    ], "highpass=f=160,highpass=f=160,afade=t=in:st=0:d=0.08:curve=tri,afade=t=out:st=0.2:d=0.14:curve=exp"),
  },
  {
    id: "whoosh-out", desc: "A panel, card or menu leaving. Falling sweep.",
    build: () => assemble([
      sweepNoise({ label: "a", dur: 0.32, f0: 3200, f1: 300, n: 16, q: 1.9, color: "pink", seed: 600, gain: 0.9 }),
    ], "highpass=f=150,highpass=f=150,afade=t=in:st=0:d=0.04:curve=tri,afade=t=out:st=0.14:d=0.18:curve=exp"),
  },
  {
    /*
     * The plan drawing itself out. A stroke, not a hiss: the sweep climbs
     * because a pencil pulled across paper gets brighter as it speeds up, and
     * the low grain layer underneath is the paper tooth. ~0.6 s, per the brief.
     */
    id: "pencil-line", desc: "A plan stroke drawing itself — graphite across paper, ~0.6 s.",
    build: () => assemble([
      sweepNoise({ label: "a", dur: 0.6, f0: 1500, f1: 4200, n: 20, q: 2.6, color: "pink", seed: 700, gain: 0.9 }),
      sweepNoise({ label: "b", dur: 0.6, f0: 600, f1: 1100, n: 12, q: 1.6, color: "brown", seed: 760, gain: 0.5 }),
    ], "highpass=f=260,highpass=f=260,afade=t=in:st=0:d=0.05:curve=tri,afade=t=out:st=0.46:d=0.22:curve=cub"),
  },
  {
    id: "paper-settle", desc: "A sheet landing on the desk — the drafting sheet appearing.",
    build: () => assemble([
      tone({ label: "a", freq: 96, dur: 0.16, decay: 0.16, gain: 0.55 }),
      burst({ label: "b", dur: 0.09, hp: 200, lp: 2400, seed: 800, gain: 0.5, attack: 0.002 }),
      sweepNoise({ label: "c", dur: 0.5, f0: 2600, f1: 900, n: 14, q: 1.8, color: "white", seed: 850, gain: 0.34 }),
    ], "afade=t=out:st=0.34:d=0.30:curve=cub"),
  },
  {
    id: "tick", desc: "One step of a slider or parameter — the smallest sound here.",
    build: () => assemble([
      burst({ label: "a", dur: 0.022, hp: 3000, lp: 11000, seed: 900, gain: 0.5, attack: 0.0006 }),
      tone({ label: "b", freq: 1250, dur: 0.03, decay: 0.03, gain: 0.22 }),
    ]),
  },
  {
    /*
     * A review pin landing on the drawing. Two inharmonic partials so it reads
     * as a small metal object rather than a musical note — a pin that lands in
     * tune with the bed would sound like part of the music.
     */
    id: "pin-drop", desc: "A review pin landing on the plan.",
    build: () => assemble([
      tone({ label: "a", freq: 2320, dur: 0.3, decay: 0.3, gain: 0.42 }),
      tone({ label: "b", freq: 3510, dur: 0.22, decay: 0.22, gain: 0.26 }),
      burst({ label: "c", dur: 0.02, hp: 2600, lp: 12000, seed: 1000, gain: 0.4, attack: 0.0006 }),
    ], "aecho=0.7:0.6:22:0.18,afade=t=out:st=0.18:d=0.16:curve=cub"),
  },
  {
    id: "pop", desc: "A card arriving on the canvas.",
    build: () => assemble([
      chirp({ label: "a", f0: 900, f1: 260, dur: 0.13, gain: 0.5, decay: 0.13 }),
      burst({ label: "b", dur: 0.018, hp: 1800, lp: 8000, seed: 1100, gain: 0.32, attack: 0.0006 }),
    ], "afade=t=out:st=0.1:d=0.06:curve=cub"),
  },
  {
    id: "stamp", desc: "Save, confirm, toast — something committed.",
    build: () => assemble([
      tone({ label: "a", freq: 118, dur: 0.34, decay: 0.34, gain: 0.6 }),
      burst({ label: "b", dur: 0.05, hp: 380, lp: 3600, seed: 1200, gain: 0.5, attack: 0.0012 }),
      tone({ label: "c", freq: 640, dur: 0.1, decay: 0.1, gain: 0.2 }),
    ], "afade=t=out:st=0.2:d=0.2:curve=cub"),
  },
  {
    /*
     * The rendering revealing itself. Four bell partials on a major-ninth stack,
     * entered in sequence — the only cue here that is allowed to be pretty,
     * because it is the only beat where the film shows a picture rather than a
     * mechanism.
     */
    id: "shimmer", desc: "The rendering resolving into view.",
    build: () => assemble([
      tone({ label: "a", freq: 1568, dur: 0.95, decay: 0.95, gain: 0.3, delay: 0 }),
      tone({ label: "b", freq: 2093, dur: 0.85, decay: 0.85, gain: 0.26, delay: 0.07 }),
      tone({ label: "c", freq: 2637, dur: 0.75, decay: 0.75, gain: 0.22, delay: 0.15 }),
      tone({ label: "d", freq: 3520, dur: 0.6, decay: 0.6, gain: 0.16, delay: 0.24 }),
      burst({ label: "e", dur: 0.3, hp: 4200, lp: 14000, seed: 1300, gain: 0.14, attack: 0.05 }),
    ], "aecho=0.8:0.7:55:0.22,afade=t=out:st=0.66:d=0.34:curve=cub"),
  },
  {
    id: "end-hit", desc: "The end card landing. The one cue allowed to be big.",
    build: () => assemble([
      tone({ label: "a", freq: 74, dur: 0.9, decay: 0.9, gain: 0.7 }),
      tone({ label: "b", freq: 148, dur: 0.5, decay: 0.5, gain: 0.3 }),
      burst({ label: "c", dur: 0.14, hp: 300, lp: 6000, seed: 1400, gain: 0.45, attack: 0.001 }),
      sweepNoise({ label: "d", dur: 0.5, f0: 3000, f1: 700, n: 12, q: 2.0, color: "pink", seed: 1450, gain: 0.22 }),
    ], "aecho=0.8:0.6:70:0.16,afade=t=out:st=0.58:d=0.36:curve=cub"),
  },
];

/* ── rendering ──────────────────────────────────────────────────────────────── */

const run = (args, label) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostdin", ...args], { encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.status !== 0) {
    console.error(`\n  ffmpeg failed for ${label}:\n${r.stderr?.slice(-3000)}\n`);
    process.exit(1);
  }
  return r.stderr ?? "";
};

const probeJson = (file) => {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-of", "json", file], { encoding: "utf8" });
  return JSON.parse(r.stdout);
};

/**
 * astats gives peak, RMS, DC offset and the flat-run count that reveals clipping.
 *
 * NOTE the regex is deliberately NOT anchored to the start of a line. ffmpeg
 * prefixes every filter log line with `[Parsed_astats_0 @ 0x...] `, so a `^\s*`
 * anchor matches nothing and every measurement comes back null — which then
 * looks exactly like "the graph produced silence". Cost about ten minutes.
 */
const stats = (file) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostdin", "-v", "info", "-i", file, "-af", "astats", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 28 });
  const text = r.stderr ?? "";
  const grab = (label) => {
    const m = [...text.matchAll(new RegExp(`${label}:\\s*(-?[\\d.]+|-?inf)`, "gi"))];
    if (!m.length) return null;
    const v = m[m.length - 1][1];
    return v.includes("inf") ? (v.startsWith("-") ? -Infinity : Infinity) : Number(v);
  };
  return {
    peakDb: grab("Peak level dB"),
    rmsDb: grab("RMS level dB"),
    dcOffset: grab("DC offset"),
    flatFactor: grab("Flat factor"),
    peakCount: grab("Peak count"),
  };
};

const graphHash = (spec) => createHash("sha256").update(JSON.stringify(spec)).digest("hex").slice(0, 16);

/**
 * The last moment a 16-bit mono WAV is above `floorDb`, read from the samples.
 *
 * `gainDb` is the gain that is ABOUT to be applied, so the threshold is judged
 * against the cue as it will ship rather than as it was rendered — otherwise a
 * quiet render gets trimmed on a floor it has not been lifted past yet.
 */
const lastAudibleSec = (file, gainDb = 0, floorDb = -60) => {
  const buf = fs.readFileSync(file);
  // Walk the RIFF chunks to the `data` payload; a WAV from ffmpeg may carry a
  // LIST/INFO chunk before it, so a fixed 44-byte offset is not safe.
  let off = 12;
  let size = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const chunk = buf.readUInt32LE(off + 4);
    if (id === "data") { off += 8; size = Math.min(chunk, buf.length - off); break; }
    off += 8 + chunk + (chunk % 2);
  }
  if (!size) return 0;
  const n = Math.floor(size / 2);
  const threshold = Math.pow(10, (floorDb - gainDb) / 20);
  for (let i = n - 1; i >= 0; i--) {
    if (Math.abs(buf.readInt16LE(off + i * 2) / 32768) >= threshold) return (i + 1) / SR;
  }
  return 0;
};

const buildCue = (cue) => {
  const spec = cue.build();
  const hash = graphHash({ inputs: spec.inputs, filterComplex: spec.filterComplex, peak: PEAK_DBFS, sr: SR });
  const outFile = path.join(OUT_DIR, `${cue.id}.wav`);
  const tmp = path.join(OUT_DIR, `.${cue.id}.tmp.wav`);

  const inputArgs = spec.inputs.flatMap((src) => ["-f", "lavfi", "-i", src]);

  // Pass 1 — render raw.
  run([...inputArgs, "-filter_complex", spec.filterComplex, "-map", "[out]", "-c:a", "pcm_s16le", "-ar", String(SR), "-ac", "1", "-y", tmp], cue.id);

  // Pass 2 — measure the real peak, then apply one flat gain so EVERY cue lands
  // on exactly PEAK_DBFS. Guessing gains per layer and hoping is how a palette
  // ends up with one cue 9 dB hotter than the rest.
  const raw = stats(tmp);
  if (raw.peakDb === null || !Number.isFinite(raw.peakDb)) {
    console.error(`  ${cue.id}: could not measure a peak — the graph probably produced silence.`);
    process.exit(1);
  }
  const gainDb = Number((PEAK_DBFS - raw.peakDb).toFixed(3));

  /*
   * ── Trailing silence is trimmed, and it is measured HERE rather than by a
   *    filter. That is a correction, and the bug it fixes is worth recording.
   *
   * Why trim at all: `amix` runs until its longest input ends and a decaying
   * fade reaches zero well before its nominal length, so the first build gave a
   * `shimmer` whose file was 1.005 s and whose last audible sample was at about
   * 0.68 s. A cue sheet scheduling the next event off `durationSec` would leave
   * a third of a second of nothing and nobody would see why.
   *
   * The first implementation did it with
   * `areverse,silenceremove=...,areverse`, and **that filter chain is not
   * reliable here.** On identical input it returned 0.2916 s for `whoosh-in` on
   * five consecutive runs and then 0.0625 s — 17% of a correctly-rendered
   * 0.3615 s pass-1 file, i.e. the first grain and nothing after it. Same bytes
   * in, different bytes out. The render was fine both times; only the trim
   * differed.
   *
   * So the trim no longer asks a filter where the sound ends. It reads the
   * samples and finds out, then cuts to that length with `-t`. Deterministic,
   * inspectable, and one ffmpeg pass shorter. The collapse guard below stays
   * anyway — a guard that has caught a real failure once is not removed because
   * its cause was fixed.
   */
  const untrimmedDur = Number(probeJson(tmp).format.duration);
  const audibleEnd = lastAudibleSec(tmp, gainDb);
  const trimDur = Math.min(untrimmedDur, audibleEnd + 0.02);

  if (trimDur < untrimmedDur * 0.25) {
    console.error(
      `\n  ${cue.id}: COLLAPSED — ${untrimmedDur.toFixed(4)}s rendered, ${trimDur.toFixed(4)}s audible ` +
      `(${((trimDur / untrimmedDur) * 100).toFixed(0)}%).\n  That is not an envelope, it is a truncation. The graph is wrong.\n`,
    );
    process.exit(1);
  }

  // Pass 2 — gain, length and a 5 ms terminal fade in one go, so "ends at zero"
  // is a property of the pipeline rather than a lucky consequence of each cue's
  // own envelope.
  const fadeAt = Math.max(0, trimDur - 0.005).toFixed(4);
  run([
    "-i", tmp, "-t", trimDur.toFixed(4),
    "-af", `volume=${gainDb}dB,afade=t=out:st=${fadeAt}:d=0.005:curve=tri`,
    "-c:a", "pcm_s16le", "-ar", String(SR), "-ac", "1", "-y", outFile,
  ], cue.id);
  fs.unlinkSync(tmp);

  const meta = probeJson(outFile);
  const final = stats(outFile);
  const durationSec = Number(Number(meta.format.duration).toFixed(4));

  return {
    id: cue.id,
    file: `audio/sfx/${cue.id}.wav`,
    desc: cue.desc,
    durationSec,
    peakDb: final.peakDb,
    rmsDb: final.rmsDb,
    dcOffset: final.dcOffset,
    sampleRate: Number(meta.streams[0].sample_rate),
    channels: meta.streams[0].channels,
    bytes: fs.statSync(outFile).size,
    recipeHash: hash,
    _gainDb: gainDb,
    _flatFactor: final.flatFactor,
  };
};

const spectrogram = (cue, row) => {
  fs.mkdirSync(SPECTRO_DIR, { recursive: true });
  const png = path.join(SPECTRO_DIR, `${cue.id}.png`);
  run([
    "-v", "error", "-i", path.join(ROOT, "public", row.file.replace(/^audio\//, "audio/")),
    "-lavfi", `showspectrumpic=s=900x420:mode=combined:color=intensity:scale=log:legend=1:start=20:stop=20000`,
    "-frames:v", "1", "-y", png,
  ], `${cue.id} spectrogram`);
  return png;
};

/* ── main ───────────────────────────────────────────────────────────────────── */

const selected = CUES.filter((c) => !ONLY || ONLY.includes(c.id));
if (ONLY && selected.length !== ONLY.length) {
  const missing = ONLY.filter((id) => !CUES.some((c) => c.id === id));
  console.error(`  unknown cue id(s): ${missing.join(", ")}`);
  process.exit(1);
}

if (CHECK) {
  if (!fs.existsSync(MANIFEST)) { console.error("  no src/data/sfx.json — run without --check first."); process.exit(1); }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const synthCues = manifest.sets?.synth?.cues ?? manifest.cues ?? [];
  const byId = new Map(synthCues.map((c) => [c.id, c]));
  const problems = [];
  for (const cue of CUES) {
    const row = byId.get(cue.id);
    if (!row) { problems.push(`${cue.id}: in this file but not in the manifest`); continue; }
    const spec = cue.build();
    const hash = graphHash({ inputs: spec.inputs, filterComplex: spec.filterComplex, peak: PEAK_DBFS, sr: SR });
    if (hash !== row.recipeHash) problems.push(`${cue.id}: recipe changed (${row.recipeHash} -> ${hash}) but the .wav was not rebuilt`);
    const abs = path.join(ROOT, "public", row.file);
    if (!fs.existsSync(abs)) problems.push(`${cue.id}: ${row.file} is missing from disk`);
    else if (fs.statSync(abs).size !== row.bytes) problems.push(`${cue.id}: ${row.file} is ${fs.statSync(abs).size} bytes, manifest says ${row.bytes}`);
  }
  for (const row of synthCues) if (!CUES.some((c) => c.id === row.id)) problems.push(`${row.id}: in the manifest but no longer has a recipe`);
  console.log(`\n  synth-sfx --check · ${CUES.length} recipe(s) against ${synthCues.length} manifest row(s)`);
  if (!problems.length) { console.log("  ✓ every cue on disk matches its recipe\n"); process.exit(0); }
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log(`\n  ${problems.length} problem(s). Re-run \`npm run audio:sfx\`.\n`);
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });

/*
 * Sweep up intermediates from a previous run that died partway. A build that
 * exits on the collapse guard leaves its `.<id>.tmp.wav` behind, and a stale
 * dotfile sitting next to fourteen real cues is exactly the kind of thing that
 * gets committed by a `git add -A` and then puzzled over later. (One did.)
 */
for (const name of fs.readdirSync(OUT_DIR)) {
  if (name.startsWith(".") && name.endsWith(".wav")) fs.unlinkSync(path.join(OUT_DIR, name));
}

console.log(`\n  synth-sfx · ${selected.length} cue(s) · ${SR} Hz mono WAV · every peak normalised to ${PEAK_DBFS} dBFS\n`);
const rows = [];
for (const cue of selected) {
  const row = buildCue(cue);
  rows.push(row);
  const png = SPECTROGRAMS ? spectrogram(cue, row) : null;
  console.log(
    `    ${cue.id.padEnd(13)} ${String(row.durationSec).padStart(7)}s  peak ${String(row.peakDb).padStart(6)} dB  ` +
    `rms ${String(row.rmsDb).padStart(7)} dB  dc ${String(row.dcOffset).padStart(9)}  ${String(row.bytes).padStart(7)} B  ` +
    `(gain ${row._gainDb > 0 ? "+" : ""}${row._gainDb} dB)${png ? "  + png" : ""}`,
  );
}

/* Merge rather than replace, so `--only` does not silently drop the other cues. */
let doc = {};
if (fs.existsSync(MANIFEST)) {
  try { doc = JSON.parse(fs.readFileSync(MANIFEST, "utf8")); } catch { doc = {}; }
}
let existing = doc.sets?.synth?.cues ?? doc.cues ?? [];
const merged = new Map(existing.map((c) => [c.id, c]));
for (const row of rows) {
  const { _gainDb, _flatFactor, ...clean } = row;
  merged.set(row.id, clean);
}
// Keep the manifest in roster order, and drop rows whose recipe is gone.
const ordered = CUES.map((c) => merged.get(c.id)).filter(Boolean);

/*
 * The manifest holds SETS, not one flat roster: this film can be cut with the
 * synthesised palette or with a vendor one, and `active` says which. This
 * writer owns exactly `sets.synth` and never touches another set or `active` —
 * rebuilding the synth cues must not silently switch the film back to them.
 */
doc.$comment =
  "Generated — do not hand-edit. `active` names the sound-effect set the film is cut with; src/audio.ts " +
  "reads exactly that and everything else reads src/audio.ts. Each set carries per-cue `provenance`, and " +
  "`commercialUse: false` quarantines a set: `npm run verify:release` refuses to render masters with it " +
  "active. sets.synth is rebuilt by tools/synth-sfx.mjs, vendor sets by tools/generate-sfx-elevenlabs.mjs. " +
  "See docs/audio-provenance.md and docs/release.md.";
doc.active ??= "synth";
doc.sets ??= {};
doc.sets.synth = {
  generator: "tools/synth-sfx.mjs",
  sampleRate: SR,
  peakTargetDb: PEAK_DBFS,
  /*
   * Synthesised from ffmpeg primitives: no vendor, no account, no terms. So
   * `commercialUse` is true BY CONSTRUCTION rather than by a tier somebody
   * checked once — which is the whole reason this set exists.
   */
  provenance: { source: "synth", tier: null, generatedAt: new Date().toISOString(), commercialUse: true },
  /** Identity — this set IS the film's canonical vocabulary. */
  aliases: Object.fromEntries(ordered.map((c) => [c.id, c.id])),
  cues: ordered,
};
// The pre-sets shape kept the roster at the top level. Remove it, so there is
// exactly one place a cue can be read from.
delete doc.cues; delete doc.generator; delete doc.sampleRate; delete doc.peakTargetDb;

fs.writeFileSync(MANIFEST, JSON.stringify(doc, null, 2) + "\n");

console.log(`\n  wrote ${path.relative(ROOT, MANIFEST)} (${ordered.length} cue(s))`);
if (SPECTROGRAMS) console.log(`  spectrograms -> ${SPECTRO_DIR}`);
const over = rows.filter((r) => r.durationSec > 1.2);
if (over.length) { console.log(`\n  ✗ ${over.length} cue(s) longer than the 1.2 s budget: ${over.map((r) => `${r.id} ${r.durationSec}s`).join(", ")}\n`); process.exit(1); }
console.log("");
