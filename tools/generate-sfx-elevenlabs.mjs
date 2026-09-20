#!/usr/bin/env node
/**
 * generate-sfx-elevenlabs.mjs — build a vendor sound-effect set from
 * `audio/sfx-sets/prompts.json`.
 *
 * ── The licensing rule this script enforces in code ─────────────────────────
 *
 * ElevenLabs' free plan carries no commercial licence, and its terms withhold
 * rights from content created outside a paid subscription *before or after* —
 * upgrading later does not license what already exists. This project has paid
 * for that lesson once already: twelve assets were generated on a free tier and
 * had to be deleted (`docs/audio-provenance.md`, `docs/decisions.md` D4).
 *
 * So the tier is not a note in a document. It is **measured at generation time**
 * and written into the manifest beside the bytes:
 *
 *   - `GET /v1/user/subscription` runs BEFORE anything is generated.
 *   - `commercialUse` is `true` only if that call reported a known paid tier.
 *     Not "not free" — a tier string this tool has never seen is not a licence.
 *   - `--set elevenlabs` (the releasable name) is REFUSED on a free tier, so
 *     you cannot produce a releasable-looking set by passing a nicer name.
 *
 * When the account moves to a paid plan, the same prompts regenerate as a
 * releasable set with one command. That is the whole reason the prompts live in
 * a committed JSON file rather than in a chat log.
 *
 * ── Cost ────────────────────────────────────────────────────────────────────
 *
 * 40 credits per second, with the duration stated explicitly (omit it and the
 * model picks a length and bills for the length it picked). The plan is printed
 * and confirmed against the remaining quota before the first call, and the run
 * refuses to spend more than `--budget` percent of what is left — default 70,
 * so the founder keeps room for retries.
 *
 * ── The key ─────────────────────────────────────────────────────────────────
 *
 * Read in-process from the MAIN checkout's gitignored `.env`, by absolute path,
 * through `tools/lib/elevenlabs.mjs`, which is the only file that touches it.
 * It is never printed, logged, committed, or copied into a worktree, and every
 * error thrown from that module is scrubbed.
 *
 * Usage:
 *   node tools/generate-sfx-elevenlabs.mjs --set elevenlabs-audition
 *   node tools/generate-sfx-elevenlabs.mjs --set elevenlabs-audition --only draw-a,draw-b
 *   node tools/generate-sfx-elevenlabs.mjs --set elevenlabs-audition --dry-run
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readKey, subscription, isPaidTier, generate, creditsFor, scrub } from "./lib/elevenlabs.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROMPTS = path.join(ROOT, "audio", "sfx-sets", "prompts.json");
const SFX_JSON = path.join(ROOT, "src", "data", "sfx.json");

const argv = process.argv.slice(2);
const val = (f) => { const i = argv.indexOf(f); return i === -1 ? null : argv[i + 1]; };
const SET = val("--set");
const ONLY = val("--only")?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
const BUDGET_PCT = Number(val("--budget") ?? 70);
const DRY = argv.includes("--dry-run");
const FORMAT = val("--format") ?? "mp3_44100_128";

if (!SET) { console.error("\n  --set is required, e.g. --set elevenlabs-audition\n"); process.exit(1); }

const SET_DIR = path.join(ROOT, "audio", "sfx-sets", SET);
const PUBLIC_DIR = path.join(ROOT, "public", "audio", "sfx", SET);
const SPECTRO_DIR = path.join("D:\\.claude-scratch\\2026-09-19\\studio-replica", `sfx-${SET}`);

/* ── ffmpeg helpers ─────────────────────────────────────────────────────────── */

const ff = (args, what) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostdin", ...args], { encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.status !== 0) { console.error(`\n  ffmpeg failed (${what}):\n${(r.stderr ?? "").slice(-1500)}\n`); process.exit(1); }
  return r.stderr ?? "";
};
const probe = (file) => JSON.parse(spawnSync("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-of", "json", file], { encoding: "utf8" }).stdout);

/** Read a 16-bit WAV's samples, walking the RIFF chunks (a fixed 44-byte offset is not safe). */
const readWav = (file) => {
  const buf = fs.readFileSync(file);
  let off = 12, size = 0, channels = 1, rate = 48000;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const len = buf.readUInt32LE(off + 4);
    if (id === "fmt ") { channels = buf.readUInt16LE(off + 10); rate = buf.readUInt32LE(off + 12); }
    if (id === "data") { off += 8; size = Math.min(len, buf.length - off); break; }
    off += 8 + len + (len % 2);
  }
  const frames = Math.floor(size / 2 / channels);
  // Mono-sum for measurement only; the file itself keeps its channels.
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let acc = 0;
    for (let c = 0; c < channels; c++) acc += buf.readInt16LE(off + (i * channels + c) * 2) / 32768;
    mono[i] = acc / channels;
  }
  return { mono, channels, rate };
};

const db = (v) => (v > 0 ? 20 * Math.log10(v) : -Infinity);

/**
 * Where the sound actually starts and stops, and where its ATTACK is.
 *
 * `peakAtSec` is the one the cue sheet needs. A vendor effect does not begin at
 * its loudest moment — a whoosh peaks in the middle, a pen stroke a little after
 * the start — so scheduling a cue at the instant of the on-screen action puts
 * the sound visibly late. The film aligns the ACTION to the ATTACK:
 * `cue.at = action.at - peakAtSec`.
 */
const analyse = ({ mono, rate }) => {
  let peak = 0, peakAt = 0;
  for (let i = 0; i < mono.length; i++) {
    const a = Math.abs(mono[i]);
    if (a > peak) { peak = a; peakAt = i; }
  }
  const floor = peak * Math.pow(10, -45 / 20);
  let start = 0; while (start < mono.length && Math.abs(mono[start]) < floor) start++;
  let end = mono.length - 1; while (end > start && Math.abs(mono[end]) < floor) end--;
  /*
   * The first STRONG onset — 12 dB below the peak — not the first audible
   * sample and not the global peak. This is the moment a listener hears the
   * sound "happen", and it is what an attack-aligned cue lines up with.
   */
  const strong = peak * Math.pow(10, -12 / 20);
  let onset = start; while (onset < mono.length && Math.abs(mono[onset]) < strong) onset++;
  if (onset >= mono.length) onset = start;
  let sum = 0, dc = 0;
  for (let i = start; i <= end; i++) { sum += mono[i] * mono[i]; dc += mono[i]; }
  const n = Math.max(1, end - start + 1);
  return {
    peak, peakAtSec: peakAt / rate,
    firstOnsetSec: onset / rate,
    startSec: start / rate, endSec: (end + 1) / rate,
    rms: Math.sqrt(sum / n), dc: dc / n,
  };
};

/** Energy-weighted spectral centroid — the same brightness measure the music analyser uses. */
const centroidHz = ({ mono, rate }) => {
  const N = 2048, HOP = 1024;
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const re = new Float64Array(N), im = new Float64Array(N);
  const fft = (re_, im_) => {
    const n = re_.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { [re_[i], re_[j]] = [re_[j], re_[i]]; [im_[i], im_[j]] = [im_[j], im_[i]]; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ur = re_[i + k], ui = im_[i + k];
          const vr = re_[i + k + len / 2] * cr - im_[i + k + len / 2] * ci;
          const vi = re_[i + k + len / 2] * ci + im_[i + k + len / 2] * cr;
          re_[i + k] = ur + vr; im_[i + k] = ui + vi;
          re_[i + k + len / 2] = ur - vr; im_[i + k + len / 2] = ui - vi;
          const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
  };
  let wc = 0, wt = 0;
  for (let off = 0; off + N <= mono.length; off += HOP) {
    for (let i = 0; i < N; i++) { re[i] = mono[off + i] * win[i]; im[i] = 0; }
    fft(re, im);
    let energy = 0, num = 0;
    for (let k = 1; k < N / 2; k++) {
      const m = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      energy += m; num += m * ((k * rate) / N);
    }
    if (energy > 1e-9) { wc += (num / energy) * energy; wt += energy; }
  }
  return wt > 0 ? Number((wc / wt).toFixed(1)) : 0;
};

/**
 * How the film should line this cue up with what is on screen.
 *
 * The brief said to align the action to the sound's attack —
 * `cue.at = action.at - peakAtSec` — because a whoosh peaks in the middle, so
 * scheduling it at the instant of the gesture puts it audibly late. That is
 * right for a **transient**, and measurably wrong for a **texture**.
 *
 * `draw-e` is the case that proves it: its loudest sample is at 7.013 s of a
 * 7.79 s file, because the take builds. Attack-aligning it would start the
 * drawing sound seven seconds before the plan begins to draw. A bed has no
 * single moment that "is" the sound; it should simply start when the action
 * starts.
 *
 * So the rule is per-cue and recorded in the manifest rather than applied by
 * whoever writes the cue sheet:
 *
 *   alignBy "attack" -> cue.at = action.at - alignOffsetSec   (transients)
 *   alignBy "start"  -> cue.at = action.at                    (textures)
 *
 * And the offset is the first STRONG onset, not the global peak, which is a
 * second correction the measurements forced. `type-1`'s loudest key press is at
 * 1.432 s of a 1.88 s cluster and `sheet`'s loudest moment is the rustle at
 * 1.023 s, well after the slap that a viewer actually sees land. Aligning
 * either on its global peak would start it more than a second early. The moment
 * a listener hears the sound HAPPEN is its first strong onset.
 */
const alignmentOf = (cue, measured) => {
  const attackAligned = cue.norm === "transient";
  return {
    alignBy: attackAligned ? "attack" : "start",
    alignOffsetSec: attackAligned ? Number(measured.firstOnsetSec.toFixed(4)) : 0,
  };
};

/* ── the plan ───────────────────────────────────────────────────────────────── */

const bank = JSON.parse(fs.readFileSync(PROMPTS, "utf8"));
let cues = bank.cues;
if (ONLY) {
  const missing = ONLY.filter((id) => !cues.some((c) => c.id === id));
  if (missing.length) { console.error(`\n  unknown cue id(s): ${missing.join(", ")}\n`); process.exit(1); }
  cues = cues.filter((c) => ONLY.includes(c.id));
}

const totalSeconds = cues.reduce((a, c) => a + c.durationSeconds, 0);
const totalCredits = cues.reduce((a, c) => a + creditsFor(c.durationSeconds), 0);

/**
 * Recompute every manifest row from the audio already on disk — no API call, no
 * credits.
 *
 * This exists because the first version did not have it, and the moment the
 * alignment rule above changed, the only way to get the new field into the
 * manifest would have been to regenerate 21 sounds. Generation is not
 * reproducible here (the API exposes no seed), so that would not have been a
 * re-measure — it would have been a different sound design, bought again.
 * Measurements are derived; they should never be a reason to spend money.
 */
const remeasure = () => {
  const doc = JSON.parse(fs.readFileSync(SFX_JSON, "utf8"));
  doc.sets ??= {};
  let set = doc.sets[SET];

  /*
   * Reconstruct the set entry if it is gone but the audio is not.
   *
   * This is not hypothetical: a bad patch to `synth-sfx.mjs` let it run in its
   * old shape and rewrite `sfx.json` without `sets`, dropping 21 rows while
   * every .wav and every raw .pcm sat untouched on disk. The wrong repair would
   * have been to regenerate — the API exposes no seed, so regenerating buys a
   * DIFFERENT sound design and calls it a restore. Everything in a row except
   * the tier is either measurable from the file or recorded in the prompt bank,
   * and the generation time is the raw file's mtime, so the row can be rebuilt
   * exactly. `--tier` has to be stated because the tier at generation is the one
   * fact on disk that nothing can prove after the fact.
   */
  if (!set) {
    const tier = val("--tier");
    if (!tier) {
      console.error(`\n  src/data/sfx.json has no set "${SET}".\n` +
        `  To rebuild it from the audio already on disk, pass the tier those files were generated under:\n` +
        `    node tools/generate-sfx-elevenlabs.mjs --set ${SET} --remeasure --tier free\n`);
      process.exit(1);
    }
    const paid = isPaidTier(tier);
    const rows = [];
    for (const cue of bank.cues) {
      const wav = path.join(PUBLIC_DIR, `${cue.id}.wav`);
      if (!fs.existsSync(wav)) continue;
      const raw = [".pcm", ".mp3"].map((e) => path.join(SET_DIR, `${cue.id}${e}`)).find((f) => fs.existsSync(f));
      rows.push({
        id: cue.id, role: cue.role, concept: cue.concept ?? null, desc: cue.desc,
        file: `audio/sfx/${SET}/${cue.id}.wav`,
        prompt: {
          text: cue.text, durationSeconds: cue.durationSeconds, promptInfluence: cue.promptInfluence,
          modelId: bank.modelId, outputFormat: FORMAT, endpoint: bank.endpoint, seed: null,
        },
        provenance: {
          source: "elevenlabs", tier,
          generatedAt: (raw ? fs.statSync(raw).mtime : new Date()).toISOString(),
          commercialUse: paid,
          reconstructed: "manifest row rebuilt from the audio on disk; the audio itself was never regenerated",
        },
      });
    }
    if (!rows.length) { console.error(`\n  no audio found under ${path.relative(ROOT, PUBLIC_DIR)}.\n`); process.exit(1); }
    set = doc.sets[SET] = {
      generator: "tools/generate-sfx-elevenlabs.mjs",
      sampleRate: 48000,
      provenance: { source: "elevenlabs", tier, generatedAt: rows[0].provenance.generatedAt, commercialUse: paid },
      aliases: bank.aliases ?? {},
      cues: rows,
    };
    console.log(`\n  reconstructed ${rows.length} row(s) for "${SET}" from disk (tier ${tier}, commercialUse ${paid})`);
  }

  set.aliases = bank.aliases ?? set.aliases ?? {};
  console.log(`\n  remeasure · set "${SET}" · ${set.cues.length} cue(s) · no API call, no credits\n`);
  for (const row of set.cues) {
    const file = path.join(ROOT, "public", row.file);
    if (!fs.existsSync(file)) { console.error(`  ${row.id}: ${row.file} is missing`); process.exit(1); }
    const wav = readWav(file);
    const a = analyse(wav);
    const meta = probe(file);
    const cue = bank.cues.find((c) => c.id === row.id) ?? { norm: row.role === "draw" || row.role === "move" ? "texture" : "transient" };
    Object.assign(row, {
      durationSec: Number(Number(meta.format.duration).toFixed(4)),
      peakAtSec: Number(a.peakAtSec.toFixed(4)),
      ...alignmentOf(cue, a),
      peakDb: Number(db(a.peak).toFixed(3)),
      rmsDb: Number(db(a.rms).toFixed(3)),
      dcOffset: Number(a.dc.toFixed(6)),
      centroidHz: centroidHz(wav),
      sampleRate: Number(meta.streams[0].sample_rate),
      channels: meta.streams[0].channels,
      bytes: fs.statSync(file).size,
    });
    console.log(`    ${row.id.padEnd(12)} ${row.durationSec.toFixed(2)}s  peak ${row.peakDb.toFixed(1)} dB  align ${row.alignBy}${row.alignBy === "attack" ? ` -${row.alignOffsetSec.toFixed(3)}s` : ""}`);
  }
  fs.writeFileSync(SFX_JSON, JSON.stringify(doc, null, 2) + "\n");
  console.log(`\n  rewrote src/data/sfx.json -> sets.${SET}\n`);
};

if (argv.includes("--remeasure")) { remeasure(); process.exit(0); }

const main = async () => {
  const key = readKey();
  const sub = await subscription(key);
  const paid = isPaidTier(sub.tier);

  console.log(`\n  generate-sfx-elevenlabs · set "${SET}"`);
  console.log(`    subscription   tier ${sub.tier} (${sub.status}) · ${sub.characterCount}/${sub.characterLimit} credits used · ${sub.remaining} remaining`);
  console.log(`    quota resets   ${sub.nextResetIso}`);
  console.log(`    commercial use ${paid ? "PERMITTED (paid tier)" : "NOT PERMITTED — this set is an audition and is quarantined"}`);

  /*
   * The name is a promise about licensing, so it is checked against the tier.
   * `elevenlabs` is the releasable set; producing one on a free plan would be a
   * set that LOOKS releasable sitting next to one that is not.
   */
  if (SET === "elevenlabs" && !paid) {
    console.error(`\n  REFUSED. "--set elevenlabs" is the releasable set name and the account is on tier "${sub.tier}".\n` +
      `  Free-tier output cannot be used commercially, and upgrading later does not license what already exists.\n` +
      `  Generate into "elevenlabs-audition" instead, or upgrade the plan first.\n`);
    process.exit(1);
  }
  if (SET.endsWith("-audition") && paid) {
    console.log(`    NOTE: the tier is paid, so this set could have been generated as the releasable "elevenlabs".`);
  }

  const pct = sub.remaining ? (totalCredits / sub.remaining) * 100 : 100;
  console.log(`\n    plan           ${cues.length} generation(s) · ${totalSeconds.toFixed(1)}s · ${totalCredits} credits · ${pct.toFixed(1)}% of remaining quota`);
  for (const c of cues) {
    console.log(`      ${c.id.padEnd(12)} ${String(c.durationSeconds).padStart(5)}s  ${String(creditsFor(c.durationSeconds)).padStart(4)} cr  influence ${c.promptInfluence}  [${c.role}]`);
  }
  if (pct > BUDGET_PCT) {
    console.error(`\n  REFUSED. That is ${pct.toFixed(1)}% of the remaining quota and the ceiling is ${BUDGET_PCT}%.\n` +
      `  Raise it deliberately with --budget, or generate a subset with --only.\n`);
    process.exit(1);
  }
  if (DRY) { console.log(`\n  --dry-run: nothing generated, no credits spent.\n`); process.exit(0); }

  fs.mkdirSync(SET_DIR, { recursive: true });
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.mkdirSync(SPECTRO_DIR, { recursive: true });

  const generatedAt = new Date().toISOString();
  const rows = [];
  let spent = 0;

  for (const cue of cues) {
    process.stdout.write(`    ${cue.id.padEnd(12)} generating ${cue.durationSeconds}s … `);
    let bytes;
    try {
      bytes = await generate(key, {
        text: cue.text,
        durationSeconds: cue.durationSeconds,
        promptInfluence: cue.promptInfluence,
        outputFormat: FORMAT,
        modelId: bank.modelId,
      });
    } catch (err) {
      console.log("FAILED");
      console.error(`\n  ${scrub(err.message)}\n`);
      process.exit(1);
    }
    spent += creditsFor(cue.durationSeconds);

    const isPcm = FORMAT.startsWith("pcm_");
    const rawFile = path.join(SET_DIR, `${cue.id}.${isPcm ? "pcm" : "mp3"}`);
    fs.writeFileSync(rawFile, bytes);

    /*
     * A `pcm_*` response is HEADERLESS raw PCM, so ffmpeg has to be told the
     * framing. The channel count is derived rather than assumed: a 1-second
     * request came back as 192,000 bytes, which is s16le 48 kHz **stereo** — but
     * it is also exactly 2 seconds of s16le 48 kHz mono, and guessing wrong
     * gives a file of the right byte count playing at half speed an octave down.
     * Dividing by the duration we asked for settles it, and the assertion below
     * means a future format change cannot slip through as a plausible-sounding
     * wrong answer.
     */
    const pcmRate = isPcm ? Number(FORMAT.split("_")[1]) : null;
    let ffIn = ["-i", rawFile];
    if (isPcm) {
      const channels = Math.round(bytes.length / 2 / pcmRate / cue.durationSeconds);
      if (channels !== 1 && channels !== 2) {
        console.log("UNREADABLE");
        console.error(`\n  ${cue.id}: ${bytes.length} bytes of ${FORMAT} for a ${cue.durationSeconds}s request implies ${channels} channels.\n` +
          `  That is neither mono nor stereo, so the framing is not what this tool assumes. Credits were spent.\n`);
        process.exit(1);
      }
      ffIn = ["-f", "s16le", "-ar", String(pcmRate), "-ac", String(channels), "-i", rawFile];
    }

    // 1. To the repo's SFX format: 48 kHz WAV. Channels are kept as delivered.
    const wide = path.join(PUBLIC_DIR, `.${cue.id}.raw.wav`);
    ff(["-y", "-v", "error", ...ffIn, "-ar", "48000", "-c:a", "pcm_s16le", wide], cue.id);

    // 2. Measure, then trim to where the sound actually is and normalise for the
    //    role. Transients get a peak ceiling; textures get an RMS target so a
    //    single spike cannot make a whole bed quiet.
    const raw = readWav(wide);
    const a = analyse(raw);
    if (!Number.isFinite(db(a.peak)) || a.peak < 1e-4) {
      console.log("SILENT");
      console.error(`\n  ${cue.id} came back effectively silent (peak ${db(a.peak).toFixed(1)} dBFS). Credits were still spent.\n`);
      fs.unlinkSync(wide);
      continue;
    }
    const gainDb = cue.norm === "texture"
      ? Math.min(-3 - db(a.peak), -20 - db(a.rms))  // RMS target, peak-capped
      : -3 - db(a.peak);                            // peak target

    const trimStart = Math.max(0, a.startSec - 0.005);
    const trimEnd = Math.min(a.endSec + 0.03, raw.mono.length / raw.rate);
    const outFile = path.join(PUBLIC_DIR, `${cue.id}.wav`);
    const dur = trimEnd - trimStart;
    ff([
      "-y", "-v", "error", "-i", wide, "-ss", trimStart.toFixed(4), "-t", dur.toFixed(4),
      "-af", `volume=${gainDb.toFixed(3)}dB,afade=t=out:st=${Math.max(0, dur - 0.02).toFixed(4)}:d=0.02:curve=tri`,
      "-ar", "48000", "-c:a", "pcm_s16le", outFile,
    ], cue.id);
    fs.unlinkSync(wide);

    const final = readWav(outFile);
    const fa = analyse(final);
    const meta = probe(outFile);

    ff(["-v", "error", "-i", outFile, "-lavfi",
      "showspectrumpic=s=900x420:mode=combined:color=intensity:scale=log:legend=1:start=20:stop=20000",
      "-frames:v", "1", "-y", path.join(SPECTRO_DIR, `${cue.id}.png`)], `${cue.id} spectrogram`);

    const row = {
      id: cue.id,
      role: cue.role,
      concept: cue.concept ?? null,
      desc: cue.desc,
      file: `audio/sfx/${SET}/${cue.id}.wav`,
      durationSec: Number(Number(meta.format.duration).toFixed(4)),
      /** Seconds from the file's start to its loudest sample. See `analyse`. */
      peakAtSec: Number(fa.peakAtSec.toFixed(4)),
      ...alignmentOf(cue, fa),
      peakDb: Number(db(fa.peak).toFixed(3)),
      rmsDb: Number(db(fa.rms).toFixed(3)),
      dcOffset: Number(fa.dc.toFixed(6)),
      centroidHz: centroidHz(final),
      sampleRate: Number(meta.streams[0].sample_rate),
      channels: meta.streams[0].channels,
      bytes: fs.statSync(outFile).size,
      prompt: {
        text: cue.text,
        durationSeconds: cue.durationSeconds,
        promptInfluence: cue.promptInfluence,
        modelId: bank.modelId,
        outputFormat: FORMAT,
        endpoint: bank.endpoint,
        seed: null,
      },
      provenance: {
        source: "elevenlabs",
        tier: sub.tier,
        generatedAt,
        commercialUse: paid,
      },
    };
    rows.push(row);
    console.log(`${row.durationSec.toFixed(2)}s  peak ${row.peakDb.toFixed(1)} dB  rms ${row.rmsDb.toFixed(1)} dB  attack @${row.peakAtSec.toFixed(3)}s  ${row.centroidHz} Hz`);
  }

  /* ── merge into src/data/sfx.json under `sets` ─────────────────────────────── */

  const doc = JSON.parse(fs.readFileSync(SFX_JSON, "utf8"));
  doc.sets ??= {};
  const existing = doc.sets[SET]?.cues ?? [];
  const merged = new Map(existing.map((c) => [c.id, c]));
  for (const r of rows) merged.set(r.id, r);
  const order = bank.cues.map((c) => c.id);
  const ordered = [...merged.values()].sort((x, y) => order.indexOf(x.id) - order.indexOf(y.id));

  doc.sets[SET] = {
    generator: "tools/generate-sfx-elevenlabs.mjs",
    sampleRate: 48000,
    provenance: { source: "elevenlabs", tier: sub.tier, generatedAt, commercialUse: paid },
    /**
     * Canonical film cue id -> this set's own cue id. `src/audio.ts` resolves
     * `sfx("pencil-line")` through this, so switching sets never requires
     * touching `src/cues.ts`.
     */
    aliases: doc.sets[SET]?.aliases ?? {},
    cues: ordered,
  };
  fs.writeFileSync(SFX_JSON, JSON.stringify(doc, null, 2) + "\n");

  console.log(`\n    spent          ${spent} credits (${((spent / sub.remaining) * 100).toFixed(1)}% of what was remaining)`);
  const after = await subscription(key);
  console.log(`    quota now      ${after.characterCount}/${after.characterLimit} used · ${after.remaining} remaining`);
  console.log(`    wrote          src/data/sfx.json -> sets.${SET} (${ordered.length} cue(s))`);
  console.log(`    audio          ${path.relative(ROOT, PUBLIC_DIR)}`);
  console.log(`    spectrograms   ${SPECTRO_DIR}`);
  if (!paid) {
    console.log(`\n    QUARANTINED: commercialUse=false. \`npm run verify:release\` refuses to render masters with this set active.\n`);
  } else {
    console.log("");
  }
};

main().catch((err) => { console.error(`\n  ${scrub(err?.message ?? err)}\n`); process.exit(1); });
