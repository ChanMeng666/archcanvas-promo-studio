#!/usr/bin/env node
/**
 * use-sfx.mjs — point the film at a sound-effect set, and choose which `draw`
 * candidate the plan-drawing beat uses.
 *
 * ⚠ **Since the version model landed this is a FALLBACK switch, not the switch.**
 * `FILM_VERSION` picks a version out of `src/data/versions.json`, and the
 * version names its own sound set; `active` here is only consulted when the
 * selected version names none, which none of them do today. So this tool still
 * reports what is on disk and still repoints `--draw`, but setting `active`
 * will NOT change what a render or a gate uses. Change the version instead.
 *
 * The sibling of `tools/use-music.mjs`, and the same law: **one switch.**
 * `src/data/sfx.json` has a single `active` field, `src/audio.ts` reads it, and
 * everything else — the gates, the stills, the renders — reads `src/audio.ts`.
 * There is no second place the film could decide which palette it is using.
 *
 * `--draw <a..e>` exists because the audition's whole question is which of five
 * drawing sounds the founder wants. It repoints one alias (`pencil-line`), which
 * is the only thing that has to change to try another.
 *
 * Usage:
 *   node tools/use-sfx.mjs                          # list the sets
 *   node tools/use-sfx.mjs synth                    # go back to the synthesised set
 *   node tools/use-sfx.mjs elevenlabs-audition      # audition set (cannot be released)
 *   node tools/use-sfx.mjs elevenlabs-audition --draw c
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SFX = path.join(ROOT, "src", "data", "sfx.json");
const PUBLIC_DIR = path.join(ROOT, "public");

if (!fs.existsSync(SFX)) { console.error("\n  no src/data/sfx.json — run `npm run audio:sfx` first.\n"); process.exit(1); }

const doc = JSON.parse(fs.readFileSync(SFX, "utf8"));
const sets = doc.sets ?? {};
const ids = Object.keys(sets);
if (!ids.length) { console.error("\n  src/data/sfx.json names no sets.\n"); process.exit(1); }

const argv = process.argv.slice(2);
const drawArg = (() => { const i = argv.indexOf("--draw"); return i === -1 ? null : argv[i + 1]; })();
const wanted = argv.find((a) => !a.startsWith("--") && a !== drawArg);

const list = () => {
  console.log("\n  sound-effect sets");
  for (const id of ids) {
    const s = sets[id];
    const missing = s.cues.filter((c) => !fs.existsSync(path.join(PUBLIC_DIR, c.file)));
    const mark = id === doc.active ? "*" : " ";
    const lic = s.provenance?.commercialUse
      ? "releasable"
      : `AUDITION — ${s.provenance?.source ?? "?"} ${s.provenance?.tier ?? "?"} tier, not for release`;
    console.log(
      `  ${mark} ${id.padEnd(22)} ${String(s.cues.length).padStart(2)} cue(s)   ${lic}` +
      `${missing.length ? `   ${missing.length} MISSING from public/` : ""}`,
    );
    if (id === doc.active) {
      const drawn = s.aliases?.["pencil-line"];
      if (drawn) console.log(`      pencil-line -> ${drawn}`);
    }
  }
  console.log("");
};

if (!wanted && !drawArg) { list(); process.exit(0); }

if (wanted) {
  if (!sets[wanted]) {
    console.error(`\n  no such set "${wanted}". Known: ${ids.join(", ")}\n`);
    process.exit(1);
  }
  doc.active = wanted;
}

const active = sets[doc.active];

if (drawArg) {
  const id = `draw-${String(drawArg).toLowerCase().replace(/^draw-/, "")}`;
  if (!active.cues.some((c) => c.id === id)) {
    const options = active.cues.filter((c) => c.role === "draw").map((c) => c.id);
    console.error(`\n  set "${doc.active}" has no cue "${id}".` +
      `${options.length ? ` Its draw candidates are: ${options.join(", ")}` : " It has no draw candidates."}\n`);
    process.exit(1);
  }
  active.aliases = { ...active.aliases, "pencil-line": id };
}

/*
 * Say the licensing consequence out loud at the moment of switching, rather
 * than leaving it to be discovered at render time. `npm run verify:release`
 * still refuses the render — this is the warning, not the guard.
 */
const releasable = active.provenance?.commercialUse === true;
fs.writeFileSync(SFX, JSON.stringify(doc, null, 2) + "\n");

console.log(`\n  active sound-effect set: ${doc.active}`);
console.log(`    ${active.cues.length} cue(s) · pencil-line -> ${active.aliases?.["pencil-line"] ?? "(unmapped)"}`);
if (releasable) {
  console.log(`    releasable: masters may be rendered.\n`);
} else {
  console.log(
    `\n    NOT FOR RELEASE — ${active.provenance?.source} on the "${active.provenance?.tier}" tier.\n` +
    `    \`npm run verify:release\` will refuse to render into out/masters/.\n` +
    `    Audition renders go to out/previews/AUDITION-not-for-release/.\n`,
  );
}
