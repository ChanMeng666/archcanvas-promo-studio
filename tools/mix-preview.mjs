#!/usr/bin/env node
/**
 * mix-preview.mjs — an audio-only mix of one cut, for checking by measurement.
 *
 * Not a deliverable. This exists so the sound decisions can be checked before
 * anyone renders a film: it lays the bed, places the drawing texture over the
 * real draw beat with the real per-version gain and EQ from
 * `src/data/sfx-roles.json`, and writes a wav plus a spectrogram of the draw
 * region. What it answers is the only question that matters here and cannot be
 * answered from band tables alone: **is the pen actually there, and is it
 * sitting under the music rather than on top of it?**
 *
 * WHEN comes from `src/timeline.ts` — the cue sheet's own clock — so this mix
 * is placed where the film places things, not where this file guesses.
 *
 * Usage:
 *   node tools/mix-preview.mjs --music B-daylight-forward --cut 30
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { loadCore } from "../capture/lib/load-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const val = (f) => { const i = argv.indexOf(f); return i === -1 ? null : argv[i + 1]; };
const CUT = val("--cut") ?? "30";
const OUT_DIR = path.join("D:\\", ".claude-scratch", "2026-09-19", "studio-replica", "mix-preview");

const music = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "music.json"), "utf8"));
const MUSIC = val("--music") ?? music.active;
if (!music.versions[MUSIC]) { console.error(`\n  no music version "${MUSIC}"\n`); process.exit(1); }

const esbuild = createRequire(import.meta.url)("esbuild");
const built = await esbuild.build({
  stdin: { contents: `export * from "./audio";`, resolveDir: path.join(ROOT, "src"), sourcefile: "mix.ts", loader: "ts" },
  bundle: true, write: false, format: "esm", platform: "node", target: "node22", logLevel: "silent",
});
const audio = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`);
const core = await loadCore();

const tl = core.timeline.timelineFor(CUT);
const drawBeats = tl.beats.filter((b) => b.scene === "draw");
if (!drawBeats.length) { console.error(`\n  the ${CUT}s cut has no draw beat\n`); process.exit(1); }
const drawFrom = drawBeats[0].startSec;
const drawTo = drawBeats[drawBeats.length - 1].endSec;

const bed = music.versions[MUSIC].beds[CUT];
const bedPath = path.join(ROOT, "public", bed.file);
const draw = audio.roleCue("draw", { music: MUSIC });
const drawPath = path.join(ROOT, "public", draw.file);

fs.mkdirSync(OUT_DIR, { recursive: true });
const outWav = path.join(OUT_DIR, `mix-${MUSIC}-${CUT}s.wav`);
const outPng = path.join(OUT_DIR, `draw-${MUSIC}-${CUT}s.png`);

/*
 * The drawing texture is ~7.7 s and the beat may be shorter or longer. Trim it
 * to the beat and fade the tail: looping it would double a transient at the
 * seam, and letting it run past the beat would play a drawing sound over a
 * drawing that has stopped.
 */
const drawLen = Math.min(audio.sfx ? Number.MAX_SAFE_INTEGER : Infinity, drawTo - drawFrom);
const drawChain = [
  `volume=${draw.gainDb}dB`,
  draw.eq,
  `atrim=0:${drawLen.toFixed(3)}`,
  `afade=t=out:st=${Math.max(0, drawLen - 0.35).toFixed(3)}:d=0.35:curve=cub`,
  `adelay=${Math.round(drawFrom * 1000)}|${Math.round(drawFrom * 1000)}`,
].filter(Boolean).join(",");

const r = spawnSync("ffmpeg", [
  "-hide_banner", "-nostdin", "-y", "-v", "error",
  "-i", bedPath, "-i", drawPath,
  "-filter_complex",
    `[0:a]aformat=sample_rates=48000:channel_layouts=stereo[bed];` +
    `[1:a]aformat=sample_rates=48000:channel_layouts=stereo,${drawChain}[draw];` +
    `[bed][draw]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[a]`,
  "-map", "[a]", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", outWav,
], { encoding: "utf8" });
if (r.status !== 0) { console.error(`\n  ffmpeg failed:\n${(r.stderr || "").slice(-1500)}\n`); process.exit(1); }

/* Spectrogram of the draw region only, with a little air either side. */
const specFrom = Math.max(0, drawFrom - 1);
const specTo = Math.min(Number(CUT), drawTo + 1);
spawnSync("ffmpeg", ["-hide_banner", "-nostdin", "-y", "-v", "error",
  "-ss", specFrom.toFixed(3), "-t", (specTo - specFrom).toFixed(3), "-i", outWav,
  "-lavfi", "showspectrumpic=s=1000x420:mode=combined:color=intensity:scale=log:legend=1:start=20:stop=20000",
  "-frames:v", "1", outPng], { encoding: "utf8" });

/* Bed alone over the same window, as the control: the difference between the
 * two pictures IS the drawing texture. */
const bedOnlyPng = path.join(OUT_DIR, `bedonly-${MUSIC}-${CUT}s.png`);
spawnSync("ffmpeg", ["-hide_banner", "-nostdin", "-y", "-v", "error",
  "-ss", specFrom.toFixed(3), "-t", (specTo - specFrom).toFixed(3), "-i", bedPath,
  "-lavfi", "showspectrumpic=s=1000x420:mode=combined:color=intensity:scale=log:legend=1:start=20:stop=20000",
  "-frames:v", "1", bedOnlyPng], { encoding: "utf8" });

const loud = (f) => {
  const s = spawnSync("ffmpeg", ["-hide_banner", "-nostdin", "-v", "info", "-i", f, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" });
  const g = (l) => { const m = [...(s.stderr ?? "").matchAll(new RegExp(`${l}:\\s*(-?[\\d.]+)`, "g"))]; return m.length ? Number(m[m.length - 1][1]) : null; };
  return { lufs: g("I"), tp: g("Peak") };
};
const mixL = loud(outWav);

console.log(`\n  mix-preview · ${MUSIC} · ${CUT}s cut`);
console.log(`    draw beat    ${drawFrom.toFixed(2)}s -> ${drawTo.toFixed(2)}s (${(drawTo - drawFrom).toFixed(2)}s)`);
console.log(`    draw cue     ${draw.cueId} · ${draw.gainDb} dB${draw.eq ? ` · ${draw.eq}` : ""}`);
console.log(`    bed          ${bed.file} · ${bed.lufs} LUFS`);
console.log(`    mix          ${mixL.lufs} LUFS · true peak ${mixL.tp} dBTP`);
console.log(`    wav          ${outWav}`);
console.log(`    spectrogram  ${path.basename(outPng)}  (control: ${path.basename(bedOnlyPng)})\n`);
