#!/usr/bin/env node
/**
 * beat-strip.mjs — one picture of a cut's clock: the take, the bars, the edit
 * and the sound, all on the same axis.
 *
 * ── What it is for ─────────────────────────────────────────────────────────
 *
 * Edit B's whole claim is that its boundaries ARE downbeats and its drawing
 * bands open on bars. `verify:bars` proves that to the frame, and a number
 * proves nothing about whether the RESULT has a shape — whether the cuts land
 * where the arrangement does something, whether a chapter sits across a fill,
 * whether the sound has a hole in it. A gate answers "is it on the grid?"; this
 * answers "is the grid in the right place?", which is a human question.
 *
 * ── Everything on it is measured, nothing is drawn from intent ─────────────
 *
 * The waveform is `showwavespic` of the DELIVERED bed, so its x-axis is film
 * time by construction rather than by a mapping that could be wrong — the beds
 * are spliced, so anything extrapolated from the source take's analysis would
 * drift by the end of the cut. The bars are the bed's own measured downbeats.
 * The boundaries are the resolved timeline. The band pins are `warp.ts`'s knots.
 * The cue lanes are the real cue sheet, resolved through the active sound set.
 *
 * Usage:
 *   node tools/beat-strip.mjs --cut 30
 *   FILM_VERSION=B-daylight-forward+el node tools/beat-strip.mjs --cut 30
 *
 * Output: `out/strips/<version>-<cut>s.png`. Not a deliverable, not committed.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { loadFilm } from "../capture/lib/load-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const val = (f, d = null) => { const i = argv.indexOf(f); return i === -1 ? d : argv[i + 1]; };
const CUT = val("--cut", "30");

const film = await loadFilm();
const { FPS } = film.layout;
const { timelineFor } = film.timeline;
const { VERSION, EDIT_ID } = film.version;
const A = film.audio;
const { cuesFor } = film.cues;

const resolved = timelineFor(CUT, "landscape");
if (!resolved) { console.error(`\n  no ${CUT}s cut\n`); process.exit(1); }
const bed = A.bedFor(CUT);
const downbeats = A.downbeatsFor(CUT);
const total = resolved.totalSeconds;

/* ── geometry ─────────────────────────────────────────────────────────────── */

const W = 1920, H = 470;
const L = 84, R = 84;
const INNER = W - L - R;
const x = (sec) => Math.round(L + (sec / total) * INNER);

const WAVE_Y = 54, WAVE_H = 120;
const LANE_Y = 196, LANE_H = 14;
const LANES = ["draw", "type", "click", "move", "appear", "end"];
const laneY = (role) => LANE_Y + LANES.indexOf(role) * (LANE_H + 3);
const AXIS_Y = LANE_Y + LANES.length * (LANE_H + 3) + 10;
const THUMB_Y = 384, THUMB_H = 72;

/* ── the marks ────────────────────────────────────────────────────────────── */

const filters = [];
const box = (px, py, w, h, colour, alpha = 1) =>
  filters.push(`drawbox=x=${px}:y=${py}:w=${w}:h=${h}:color=${colour}@${alpha}:t=fill`);
const FONT = "C\\:/Windows/Fonts/consola.ttf";
const esc = (s) => String(s).replace(/([:\\'%])/g, "\\$1");
const text = (px, py, s, colour, size = 15) =>
  filters.push(
    `drawtext=fontfile='${FONT}':text='${esc(s)}':x=${px}:y=${py}:fontsize=${size}:fontcolor=${colour}`,
  );

/* every measured downbeat, floor to ceiling but dim */
for (const d of downbeats) {
  if (d < 0 || d > total) continue;
  box(x(d), WAVE_Y - 8, 1, AXIS_Y - WAVE_Y + 12, "0x4a5568", 0.9);
}
/* every fourth one gets its second printed, so the ruler can be read */
downbeats.forEach((d, i) => {
  if (i % 4 !== 0 || d > total) return;
  text(x(d) - 12, AXIS_Y + 6, d.toFixed(2), "0x8fa0b5", 13);
});

/* the edit: a boundary wherever the scene changes, labelled, two rows */
let row = 0;
for (const b of resolved.beats) {
  const isMajor = b.index === 0 || b.prevScene !== b.scene;
  box(x(b.startSec), WAVE_Y - 14, isMajor ? 3 : 1, AXIS_Y - WAVE_Y + 18, isMajor ? "0xffd166" : "0x8d7a3f", isMajor ? 1 : 0.8);
  if (!isMajor) continue;
  row = 1 - row;
  text(x(b.startSec) + 5, WAVE_Y - 34 + row * 17, b.scene, "0xffd166", 15);
}

/* the drawing's band pins — the warp's own knots */
let pins = 0;
for (const b of resolved.beats) {
  for (const k of (b.warpKnots ?? []).slice(1, -1)) {
    pins += 1;
    box(x(k.film) - 1, WAVE_Y, 3, WAVE_H, "0x06d6a0", 1);
    text(x(k.film) - 10, WAVE_Y + WAVE_H + 4, "band", "0x06d6a0", 13);
  }
}

/* the sound, one lane per role */
const sheet = cuesFor(CUT);
const tally = new Map();
for (const cue of sheet) {
  const rc = A.resolveCue(cue);
  const y = laneY(cue.role);
  if (y < LANE_Y) continue;
  const w = Math.max(2, Math.round((rc.playSec / total) * INNER));
  const colour = cue.role === "draw" ? (cue.intent === "band" ? "0x06d6a0" : "0x2e86ab") : "0xef476f";
  box(x(rc.startSec), y, w, LANE_H, colour, cue.role === "draw" && cue.intent !== "band" ? 0.55 : 0.95);
  tally.set(cue.role, (tally.get(cue.role) ?? 0) + 1);
}
for (const role of LANES) {
  text(10, laneY(role) - 1, `${role.padEnd(7)}${String(tally.get(role) ?? 0).padStart(3)}`, "0x9aa7b5", 13);
}

/* the duck, as a line under the lanes: how far the music is giving way */
const events = A.duckEvents(sheet);
for (let px = 0; px < INNER; px += 2) {
  const sec = (px / INNER) * total;
  const g = A.duckGainAt(sec, events);
  if (g > 0.999) continue;
  const db = 20 * Math.log10(g);
  box(L + px, AXIS_Y - 6 + Math.round(db), 2, Math.max(1, Math.round(-db)), "0xf78c6b", 0.9);
}

text(
  12, 16,
  `${VERSION}  edit ${EDIT_ID}  ${CUT}s  ·  ${downbeats.length} measured downbeats  ·  ` +
    `${resolved.beats.length} beats  ·  ${pins} band pins  ·  ${sheet.length} cues  ·  ` +
    `bed ${bed.lufs} LUFS  ·  sfx ${A.activeSfxSetId()}`,
  "0xe6edf3", 17,
);
text(12, 34, "yellow = scene boundary   grey = measured bar   green = drawing band pin   orange = the duck", "0x6f7d8c", 14);

/* ── the thumbnails ───────────────────────────────────────────────────────── */

const contact = path.join(ROOT, "out", "stills", "wp9", "contact");
const comp = `Studio-${CUT}-Landscape-16x9`;
const frames = fs.existsSync(contact)
  ? fs.readdirSync(contact).filter((f) => f.startsWith(`${comp}-c`)).sort()
  : [];
const EVERY = Math.max(1, Math.ceil(frames.length / 15));
const picked = frames.filter((_, i) => i % EVERY === 0);

/* ── build ────────────────────────────────────────────────────────────────── */

const inputs = ["-f", "lavfi", "-i", `color=c=0x11161d:s=${W}x${H}`, "-i", path.join(ROOT, "public", bed.file)];
for (const f of picked) inputs.push("-i", path.join(contact, f));

const chain = [
  `[1:a]showwavespic=s=${INNER}x${WAVE_H}:colors=0x5a8fb5|0x5a8fb5:split_channels=0[wave]`,
  `[0:v][wave]overlay=${L}:${WAVE_Y}[base]`,
];
let last = "base";
if (picked.length) {
  const tags = picked.map((_, i) => `[${i + 2}:v]`).join("");
  chain.push(`${tags}hstack=inputs=${picked.length},scale=${INNER}:${THUMB_H}:flags=bilinear[thumbs]`);
  chain.push(`[base][thumbs]overlay=${L}:${THUMB_Y}[withthumbs]`);
  last = "withthumbs";
}
chain.push(`[${last}]${filters.join(",")}[out]`);

const outDir = path.join(ROOT, "out", "strips");
fs.mkdirSync(outDir, { recursive: true });
const outPng = path.join(outDir, `${VERSION}-${CUT}s.png`);

const r = spawnSync(
  "ffmpeg",
  ["-hide_banner", "-nostdin", "-y", "-v", "error", ...inputs,
   "-filter_complex", chain.join(";"), "-map", "[out]", "-frames:v", "1", outPng],
  { encoding: "utf8", maxBuffer: 1 << 28 },
);
if (r.status !== 0) {
  console.error(`\n  ffmpeg failed:\n${(r.stderr || "").slice(-2000)}\n`);
  process.exit(1);
}

console.log(`\n  beat-strip · ${VERSION} · ${CUT}s cut`);
console.log(`    ${downbeats.length} bars, ${resolved.beats.length} beats, ${pins} band pin(s), ${sheet.length} cue(s)`);
console.log(`    ${picked.length} thumbnail(s) of ${frames.length} contact frame(s)`);
console.log(`    ${outPng}\n`);
