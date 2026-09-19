#!/usr/bin/env node
/**
 * tile-contact.mjs — build the contact sheets from whatever frames are on disk.
 *
 * The tiling used to live at the end of `stills.mjs --sheet`, in the same
 * process as the renders. That is the wrong place for it: a thirty-frame sheet
 * run died on its twenty-ninth frame (the `fonts.gstatic.com` exhaustion that
 * `CLAUDE.md` records), and with it went the tiling of twenty-eight frames that
 * had rendered perfectly well. A step that takes seconds and depends only on
 * files should not be downstream of a step that takes minutes and can fail.
 *
 * So: render frames with `stills.mjs --sheet`, as many times as it takes, then
 * tile once with this. It reads `out/stills/wp9/contact/`, groups by
 * composition, and writes one `contact-sheet-<comp>.png` per composition.
 *
 * ⚠ BOTH frame shapes. It was landscape-only, on the reasoning that a tiled 9:16
 * grid at a readable width is taller than a screen — which is true of a square
 * grid and not true of the right one. The founder reviews both aspects, and the
 * two shapes differ in more than proportion: the chapter chip is landscape-only,
 * the caption breaks into two lines, the split band is deeper, the replica fills
 * the frame instead of letterboxing. A round of defects lived only in 9:16 and
 * was found by looking at single stills one at a time. The grid is chosen from
 * the FRAME's shape so the sheet comes out roughly 16:9 either way.
 *
 * Usage:  node capture/tile-contact.mjs
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadCore } from "./lib/load-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out", "stills", "wp9");
const DIR = path.join(OUT, "contact");

const { DELIVERABLES } = (await loadCore()).layout;

if (!fs.existsSync(DIR)) {
  console.error("\ntile-contact: out/stills/wp9/contact/ does not exist. Run `node capture/stills.mjs --sheet --comp <id>` first.\n");
  process.exit(1);
}

const files = fs.readdirSync(DIR).filter((n) => n.endsWith(".png") && n.includes("-c"));
const byComp = new Map();
for (const f of files) {
  const comp = f.slice(0, f.lastIndexOf("-c"));
  if (!byComp.has(comp)) byComp.set(comp, []);
  byComp.get(comp).push(f);
}

if (byComp.size === 0) {
  console.error("\ntile-contact: no frames found — this gate would report success by doing nothing.\n");
  process.exit(1);
}

let written = 0;
for (const [comp, list] of [...byComp.entries()].sort()) {
  list.sort();
  const n = list.length;
  const d = DELIVERABLES.find((x) => x.id === comp);
  if (!d) {
    console.error(`  ${comp.padEnd(27)} is not a composition in DELIVERABLES — skipped`);
    continue;
  }
  /*
   * Aim the SHEET at 16:9, whatever the frame is. cols/rows * (frameW/frameH)
   * = 16/9, solved for cols with rows = n/cols. A 9:16 cut therefore lays out
   * wide and shallow (10 x 3) where a 16:9 one lays out 7 x 5 — the same thirty
   * frames, both readable on one screen.
   */
  const cols = Math.min(n, Math.max(1, Math.round(Math.sqrt((n * (16 / 9)) / (d.width / d.height)))));
  const rows = Math.ceil(n / cols);

  /**
   * ffmpeg's `image2` demuxer reads a `%03d` sequence and STOPS AT THE FIRST
   * GAP, and this build has no globbing at all. The frames carry a
   * `-<seconds>s` suffix the pattern cannot express, so they are copied into a
   * scratch directory as a bare contiguous sequence first — which also means a
   * batch that died part-way tiles the frames it did produce.
   */
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), "contact-"));
  list.forEach((f, i) => fs.copyFileSync(path.join(DIR, f), path.join(staging, `${String(i).padStart(3, "0")}.png`)));

  const sheet = path.join(OUT, `contact-sheet-${comp}.png`);
  try {
    execFileSync(
      "ffmpeg",
      ["-y", "-v", "error", "-i", path.join(staging, "%03d.png"),
       "-vf", `scale=320:-1,tile=${cols}x${rows}:margin=6:padding=4:color=0x13110F`,
       "-frames:v", "1", sheet],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    written += 1;
    console.log(`  ${comp.padEnd(27)} ${String(n).padStart(3)} frame(s)  ${cols}x${rows}  ${path.relative(ROOT, sheet)}`);
  } catch (err) {
    console.log(`  ${comp.padEnd(27)} FAILED: ${String(err.message).split("\n")[0]}`);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

console.log(`\ntile-contact: ${written} sheet(s) from ${files.length} frame(s)\n`);
process.exit(written === 0 ? 1 : 0);
