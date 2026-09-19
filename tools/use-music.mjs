#!/usr/bin/env node
/**
 * use-music.mjs — point the film at a music version that is already built.
 *
 * ── Why this exists at all ──────────────────────────────────────────────────
 *
 * The film's edit is snapped to the music. `src/timeline.ts` pulls every scene
 * boundary onto the nearest downbeat of the cut's own bed, so a master is the
 * picture AND the take: change the take and the cut points move. Two takes
 * therefore mean two sets of masters, and keeping both means both have to stay
 * **renderable**, not merely archived.
 *
 * `npm run audio:beds` cuts a new version's beds and makes it active. This is
 * the way back. It changes exactly one field — `active` in `src/data/music.json`
 * — because that field is the single constant every gate, every still and every
 * render reads through `src/audio.ts`. Nothing is re-cut and nothing is
 * measured: the version's beds are on disk and its downbeats are already in the
 * document.
 *
 * Usage:
 *   node tools/use-music.mjs                 # print the versions and which is active
 *   node tools/use-music.mjs A-confident-arrival
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MUSIC = path.join(ROOT, "src", "data", "music.json");
const PUBLIC_DIR = path.join(ROOT, "public");

if (!fs.existsSync(MUSIC)) {
  console.error("\n  no src/data/music.json — run `npm run audio:beds` first.\n");
  process.exit(1);
}

const doc = JSON.parse(fs.readFileSync(MUSIC, "utf8"));
const versions = doc.versions ?? {};
const ids = Object.keys(versions).sort();

if (ids.length === 0) {
  console.error("\n  src/data/music.json names no versions — run `npm run audio:beds`.\n");
  process.exit(1);
}

const list = () => {
  console.log("\n  music versions");
  for (const id of ids) {
    const v = versions[id];
    const beds = Object.values(v.beds ?? {});
    // Say whether it could actually be rendered, rather than only that it is
    // listed. A version whose mp3s were deleted is not a version you can go
    // back to, and the useful time to find that out is now.
    const missing = beds.filter((b) => !fs.existsSync(path.join(PUBLIC_DIR, b.file)));
    const mark = id === doc.active ? "*" : " ";
    console.log(
      `  ${mark} ${id.padEnd(26)} ${String(v.track).padEnd(26)} ${String(v.bpm).padStart(6)} BPM   ` +
      `${beds.length} bed(s)${missing.length ? `   ${missing.length} MISSING from public/` : ""}`,
    );
  }
  console.log("\n  * = active. Switch with `node tools/use-music.mjs <version>`.\n");
};

const wanted = process.argv[2];
if (!wanted) { list(); process.exit(0); }

if (!versions[wanted]) {
  console.error(`\n  no version "${wanted}" in src/data/music.json.`);
  list();
  process.exit(1);
}

const missing = Object.values(versions[wanted].beds ?? {})
  .map((b) => b.file)
  .filter((f) => !fs.existsSync(path.join(PUBLIC_DIR, f)));
if (missing.length) {
  console.error(`\n  "${wanted}" is in the document but ${missing.length} of its bed(s) are not on disk:`);
  for (const f of missing) console.error(`    public/${f}`);
  console.error(`\n  Re-cut them: put its take back in audio/source/ and run \`npm run audio:beds\`.\n`);
  process.exit(1);
}

if (doc.active === wanted) {
  console.log(`\n  ${wanted} is already active. Nothing changed.\n`);
  process.exit(0);
}

const was = doc.active;
doc.active = wanted;
fs.writeFileSync(MUSIC, JSON.stringify(doc, null, 2) + "\n");

console.log(`\n  active music version: ${was} -> ${wanted}`);
console.log(`    ${versions[wanted].track} · ${versions[wanted].bpm} BPM · bar ${versions[wanted].barSec}s`);
console.log(`\n  The edit re-snaps to this take's downbeats. Re-run \`npm run verify\` before rendering,`);
console.log(`  and render into this version's own folder: ./render.ps1 -MusicVersion ${wanted}\n`);
