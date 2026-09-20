#!/usr/bin/env node
/**
 * build-draw-audition.mjs — five in-context previews of the plan-drawing beat,
 * one per candidate drawing sound.
 *
 * ── Why in context, and not five audio files ────────────────────────────────
 *
 * The founder's note was about ONE sound: the thing you hear while the floor
 * plan draws itself. Heard on its own, all five candidates are plausible. Heard
 * under the bed, against the picture, at the level the film actually mixes them
 * (-8 dB, `src/cues.ts`), they are not remotely equivalent — one of them is
 * going to fight the music and one of them is going to disappear under it, and
 * neither fact is audible in isolation.
 *
 * ── Render ONCE, mux five times ─────────────────────────────────────────────
 *
 * The picture is identical in all five clips. Rendering it five times would
 * cost five renders and risk five *different* pictures if anything drifted in
 * between. So: one silent 1280x720 segment, then ffmpeg copies the video stream
 * into five containers with five different audio mixes. The video bytes in all
 * five files are the same bytes.
 *
 * ── The draw sounds are used differently from the synthesised one ───────────
 *
 * `src/cues.ts` fires the synthesised `pencil-line` (0.65 s) repeatedly, once
 * per drawing slot, to cover a beat several seconds long. The ElevenLabs
 * candidates are ~8 s single takes that cover the whole beat in one go. These
 * previews mix them the way they would actually be used — one continuous take
 * starting where the draw beat starts — because auditioning them chopped into
 * 0.65 s slices would be auditioning a different sound.
 *
 * Usage:
 *   node tools/build-draw-audition.mjs              # render + mux
 *   node tools/build-draw-audition.mjs --skip-render  # re-mux only
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out", "previews", "AUDITION-not-for-release");
const NOTICE_SRC = path.join(ROOT, "capture", "audition-notice.txt");
const SEGMENT = path.join(OUT, ".segment-silent.mp4");
const SKIP_RENDER = process.argv.includes("--skip-render");

/** The 30s landscape cut's draw beat is frames 144-348; a little air each side. */
const COMP = "Studio-30-Landscape-16x9";
const FROM_FRAME = 120;
const TO_FRAME = 359;
const FPS = 30;
/** Where the draw beat starts, relative to the clip. 144/30 - 120/30. */
const DRAW_AT_SEC = (144 - FROM_FRAME) / FPS;
/** The level `src/cues.ts` mixes `pencil-line` at. */
const SFX_GAIN_DB = -8;

const run = (cmd, args, what, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 28, cwd: ROOT, ...opts });
  if (r.status !== 0) {
    console.error(`\n  ${what} failed (${r.status}):\n${(r.stderr || r.stdout || "").slice(-2500)}\n`);
    process.exit(1);
  }
  return r;
};

fs.mkdirSync(OUT, { recursive: true });
if (fs.existsSync(NOTICE_SRC)) fs.copyFileSync(NOTICE_SRC, path.join(OUT, "README-NOT-FOR-RELEASE.txt"));

const sfxDoc = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "sfx.json"), "utf8"));
const set = sfxDoc.sets["elevenlabs-audition"];
if (!set) { console.error("\n  no elevenlabs-audition set in src/data/sfx.json\n"); process.exit(1); }
const candidates = set.cues.filter((c) => c.role === "draw");

const music = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "music.json"), "utf8"));
const bed = music.versions[music.active].beds["30"];
const bedFile = path.join(ROOT, "public", bed.file);

console.log(`\n  build-draw-audition`);
console.log(`    picture   ${COMP} frames ${FROM_FRAME}-${TO_FRAME} (${((TO_FRAME - FROM_FRAME + 1) / FPS).toFixed(1)}s, 1280x720)`);
console.log(`    bed       ${bed.file} (${music.active})`);
console.log(`    draw at   ${DRAW_AT_SEC.toFixed(2)}s into the clip, mixed at ${SFX_GAIN_DB} dB`);
console.log(`    candidates ${candidates.map((c) => c.id).join(", ")}\n`);

/* ── one silent segment ─────────────────────────────────────────────────────── */

if (!SKIP_RENDER) {
  console.log(`    rendering the segment once (concurrency 1 — this box is shared)…`);
  run("npx", [
    "remotion", "render", "src/index.ts", COMP, SEGMENT,
    `--frames=${FROM_FRAME}-${TO_FRAME}`,
    "--scale=0.667",
    "--concurrency=1",
    "--muted",
    "--log=error",
  ], "remotion render", { shell: true });
  console.log(`    rendered ${path.relative(ROOT, SEGMENT)}`);
} else if (!fs.existsSync(SEGMENT)) {
  console.error(`\n  --skip-render, but ${path.relative(ROOT, SEGMENT)} does not exist.\n`);
  process.exit(1);
}

/* ── five mixes onto the same video stream ──────────────────────────────────── */

const clipSec = (TO_FRAME - FROM_FRAME + 1) / FPS;
const bedFrom = FROM_FRAME / FPS;

const made = [];
for (const cue of candidates) {
  const sfxFile = path.join(ROOT, "public", cue.file);
  const outFile = path.join(OUT, `draw-${cue.id.replace(/^draw-/, "").toUpperCase()}.mp4`);

  /*
   * `-c:v copy` — the video is never re-encoded, so all five clips carry
   * byte-identical picture and any difference the founder hears is the sound.
   * The bed is cut from the same offset the film plays at this point, so the
   * music under the picture is the music that will be under the picture.
   */
  run("ffmpeg", [
    "-hide_banner", "-nostdin", "-y", "-v", "error",
    "-i", SEGMENT,
    "-ss", bedFrom.toFixed(4), "-t", clipSec.toFixed(4), "-i", bedFile,
    "-i", sfxFile,
    "-filter_complex",
      `[1:a]atrim=0:${clipSec.toFixed(4)},asetpts=N/SR/TB[bed];` +
      `[2:a]volume=${SFX_GAIN_DB}dB,adelay=${Math.round(DRAW_AT_SEC * 1000)}|${Math.round(DRAW_AT_SEC * 1000)},` +
      `atrim=0:${clipSec.toFixed(4)},asetpts=N/SR/TB[sfx];` +
      `[bed][sfx]amix=inputs=2:normalize=0:duration=first,` +
      `alimiter=limit=0.95,afade=t=out:st=${(clipSec - 0.25).toFixed(3)}:d=0.25[a]`,
    "-map", "0:v", "-map", "[a]",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest",
    outFile,
  ], `mux ${cue.id}`);

  const size = (fs.statSync(outFile).size / 1024 / 1024).toFixed(1);
  made.push({ id: cue.id, file: path.relative(ROOT, outFile).split(path.sep).join("/"), sizeMb: size });
  console.log(`    ${cue.id.padEnd(8)} -> ${path.basename(outFile).padEnd(12)} ${size} MB`);
}

fs.writeFileSync(
  path.join(OUT, "previews.json"),
  JSON.stringify({
    $comment: "NOT FOR RELEASE — free-tier ElevenLabs audio. See README-NOT-FOR-RELEASE.txt.",
    comp: COMP, fromFrame: FROM_FRAME, toFrame: TO_FRAME, fps: FPS,
    drawAtSec: DRAW_AT_SEC, sfxGainDb: SFX_GAIN_DB,
    musicVersion: music.active, bed: bed.file,
    previews: made,
  }, null, 2) + "\n",
);

console.log(`\n  ${made.length} preview(s) in ${path.relative(ROOT, OUT)}\n`);
