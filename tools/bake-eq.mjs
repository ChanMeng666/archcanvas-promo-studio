#!/usr/bin/env node
/**
 * bake-eq.mjs — render the role manifest's per-music EQ into real files,
 * because the film cannot apply it at mount time.
 *
 * ── The gap this closes ────────────────────────────────────────────────────
 *
 * `src/data/sfx-roles.json` has carried a per-music EQ for the drawing texture
 * since the sound was chosen — a high shelf and a bell, measured band by band
 * with `tools/mask-check.mjs` against each take's own spectrum. Nothing the film
 * mounts could apply it: Remotion's `<Audio>` takes a gain and nothing else, so
 * the only thing that ever played the EQ'd cue was `tools/mix-preview.mjs`,
 * which is a listening instrument and not the film.
 *
 * Measured, so it is not a theoretical gap. Version B's 30 s draw window,
 * `draw-b` at its −10 dB role gain, against the bed:
 *
 *   band       headroom unshelved    headroom with the manifest's EQ
 *   6300 Hz          −0.5 dB                        +6.8 dB
 *   8000 Hz          −0.4 dB                        +9.3 dB
 *  10000 Hz          −3.7 dB                        +7.6 dB
 *
 * Negative is the cue louder than the music. Three of the bands the hats and
 * shaker live in, on the money shot, in the one beat the whole edit is built
 * around — and the reason the drawing role is not ducked at all is that its
 * space was supposed to be carved with exactly this.
 *
 * ── What it does, and what stays decided ───────────────────────────────────
 *
 * The `eq` string stays in the manifest as the RECIPE, auditable and
 * reproducible; this renders it once per (set, role, music) into
 * `<cue>.<music>.wav`, measures the result the same way the vendor cues were
 * measured, registers it in `src/data/sfx.json` as a derived cue, and writes the
 * filename back into the `perMusic` entry. `src/audio.ts` then plays the baked
 * file whenever one is named, which is how the film ends up playing what the
 * manifest says.
 *
 * Provenance is INHERITED, not re-decided: a file derived from an audition cue
 * is audition material, and `verify:release` reads the same field it always did.
 *
 * Usage:
 *   node tools/bake-eq.mjs              build (or rebuild) every baked cue
 *   node tools/bake-eq.mjs --check      recipes and files agree; exit 1 if not
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROLES = path.join(ROOT, "src", "data", "sfx-roles.json");
const SFX = path.join(ROOT, "src", "data", "sfx.json");
const PUBLIC = path.join(ROOT, "public");
const CHECK = process.argv.includes("--check");

const roles = JSON.parse(fs.readFileSync(ROLES, "utf8"));
const sfx = JSON.parse(fs.readFileSync(SFX, "utf8"));

/* ── measurement, identical to the vendor cues' ───────────────────────────── */

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
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let acc = 0;
    for (let c = 0; c < channels; c++) acc += buf.readInt16LE(off + (i * channels + c) * 2) / 32768;
    mono[i] = acc / channels;
  }
  return { mono, channels, rate, bytes: buf.length };
};

const db = (v) => (v > 0 ? 20 * Math.log10(v) : -Infinity);

const analyse = ({ mono, rate }) => {
  let peak = 0, peakAt = 0;
  for (let i = 0; i < mono.length; i++) {
    const a = Math.abs(mono[i]);
    if (a > peak) { peak = a; peakAt = i; }
  }
  const floor = peak * Math.pow(10, -45 / 20);
  let start = 0; while (start < mono.length && Math.abs(mono[start]) < floor) start++;
  let end = mono.length - 1; while (end > start && Math.abs(mono[end]) < floor) end--;
  const strong = peak * Math.pow(10, -12 / 20);
  let onset = start; while (onset < mono.length && Math.abs(mono[onset]) < strong) onset++;
  if (onset >= mono.length) onset = start;
  let sum = 0, dc = 0;
  for (let i = start; i <= end; i++) { sum += mono[i] * mono[i]; dc += mono[i]; }
  const n = Math.max(1, end - start + 1);
  return {
    peak, peakAtSec: peakAt / rate, firstOnsetSec: onset / rate,
    rms: Math.sqrt(sum / n), dc: dc / n, durationSec: mono.length / rate,
  };
};

/* ── what wants baking ────────────────────────────────────────────────────── */

/** Every (set, role, music) the manifest asks for an EQ on. */
const wanted = [];
for (const [roleId, role] of Object.entries(roles.roles)) {
  for (const setId of Object.keys(sfx.sets)) {
    const block = role.perSet?.[setId];
    const scoped = block !== undefined;
    const perMusic = scoped ? block.perMusic : role.perMusic;
    const files = block?.files ?? role.files;
    if (!perMusic || !files?.length) continue;
    for (const [music, entry] of Object.entries(perMusic)) {
      if (typeof entry !== "object" || entry === null || !entry.eq) continue;
      wanted.push({ setId, roleId, music, sourceId: files[0], eq: entry.eq, entry });
    }
  }
}

if (wanted.length === 0) {
  console.error("\n  bake-eq: no perMusic entry carries an `eq` — nothing to bake, and that is a failure\n" +
    "  rather than a tick: this tool exists because those entries were not reaching the film.\n");
  process.exit(1);
}

/* ── build ────────────────────────────────────────────────────────────────── */

let changed = 0;
const rows = [];

for (const job of wanted) {
  const set = sfx.sets[job.setId];
  const source = set.cues.find((c) => c.id === job.sourceId);
  if (!source) {
    console.error(`\n  bake-eq: set "${job.setId}" has no cue "${job.sourceId}"\n`);
    process.exit(1);
  }
  const bakedId = `${job.sourceId}.${job.music}`;
  const rel = source.file.replace(/\.wav$/, `.${job.music}.wav`);
  const abs = path.join(PUBLIC, rel);
  // The recipe is the source's bytes plus the filter string: change either and
  // the baked file is stale. Same argument as `synth-sfx.mjs`'s recipeHash.
  const srcBytes = fs.readFileSync(path.join(PUBLIC, source.file));
  const recipeHash = crypto.createHash("sha256")
    .update(crypto.createHash("sha256").update(srcBytes).digest("hex"))
    .update("\n").update(job.eq).digest("hex").slice(0, 16);

  const existing = set.cues.find((c) => c.id === bakedId);
  const upToDate = existing && existing.recipeHash === recipeHash && fs.existsSync(abs);

  if (CHECK) {
    rows.push(`${bakedId.padEnd(34)} ${upToDate ? "ok" : "STALE"}`);
    if (!upToDate) changed += 1;
    continue;
  }
  if (upToDate) {
    rows.push(`${bakedId.padEnd(34)} unchanged`);
    continue;
  }

  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const r = spawnSync("ffmpeg", [
    "-hide_banner", "-nostdin", "-y", "-v", "error",
    "-i", path.join(PUBLIC, source.file),
    "-af", job.eq,
    "-ar", String(source.sampleRate ?? 48000), "-ac", String(source.channels ?? 2),
    "-c:a", "pcm_s16le", abs,
  ], { encoding: "utf8" });
  if (r.status !== 0) {
    console.error(`\n  ffmpeg failed on ${bakedId}:\n${(r.stderr || "").slice(-1200)}\n`);
    process.exit(1);
  }

  const wav = readWav(abs);
  const a = analyse(wav);
  const row = {
    id: bakedId,
    file: rel,
    desc: `${source.desc ?? source.id} with the ${job.music} shelf baked in`,
    durationSec: Number(a.durationSec.toFixed(4)),
    peakDb: Number(db(a.peak).toFixed(3)),
    rmsDb: Number(db(a.rms).toFixed(3)),
    dcOffset: Number(a.dc.toFixed(6)),
    sampleRate: wav.rate,
    channels: wav.channels,
    bytes: wav.bytes,
    role: source.role,
    // ⚠ Anchoring is re-measured, not copied. A shelf moves where the first
    // sample within 12 dB of the peak is, and a cue that is anchored on a
    // number measured before the filter is a cue that is late by the
    // difference.
    alignBy: source.alignBy ?? "start",
    alignOffsetSec: (source.alignBy ?? "start") === "attack" ? Number(a.firstOnsetSec.toFixed(4)) : 0,
    peakAtSec: Number(a.peakAtSec.toFixed(4)),
    recipeHash,
    derivedFrom: source.id,
    eq: job.eq,
    // INHERITED. A file derived from audition material is audition material,
    // and `verify:release` reads this field, not this tool's opinion.
    provenance: source.provenance ?? set.provenance,
  };
  const at = set.cues.findIndex((c) => c.id === bakedId);
  if (at === -1) set.cues.push(row); else set.cues[at] = row;
  job.entry.file = bakedId;
  changed += 1;
  rows.push(
    `${bakedId.padEnd(34)} ${row.durationSec.toFixed(2)}s  peak ${row.peakDb.toFixed(1)} dB  ` +
    `(source ${source.peakDb.toFixed(1)})  ${(row.bytes / 1024).toFixed(0)} KB`,
  );
}

if (!CHECK && changed > 0) {
  fs.writeFileSync(SFX, `${JSON.stringify(sfx, null, 2)}\n`);
  fs.writeFileSync(ROLES, `${JSON.stringify(roles, null, 2)}\n`);
}

console.log(`\n  bake-eq${CHECK ? " --check" : ""} · ${wanted.length} EQ'd cue(s) declared by the role manifest`);
for (const row of rows) console.log(`    ${row}`);

if (CHECK && changed > 0) {
  console.log(`\n  ✗ ${changed} baked cue(s) are stale — run \`node tools/bake-eq.mjs\`\n`);
  process.exit(1);
}
console.log(CHECK ? "\n  ✓ every baked cue matches its recipe\n" : `\n  ${changed} rebuilt, ${rows.length - changed} unchanged\n`);
