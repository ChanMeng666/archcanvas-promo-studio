#!/usr/bin/env node
/**
 * version-info.mjs — what IS this version, and where does it write?
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * `render.ps1` and `tools/package-masters.ps1` both need to know a version's
 * music, edit, sound set, release kind and output directory. Both are
 * PowerShell, and the answers live in TypeScript — `src/version.ts` resolves
 * `{music, edit, sfxSet}` and `src/audio.ts` § `outDirFor` decides masters
 * versus quarantine.
 *
 * The tempting shortcut is for each script to read `versions.json` and
 * reimplement `outDirFor` in four lines of PowerShell. That is exactly the
 * failure this repo keeps writing down: a second copy of a rule drifts, and
 * the drift here would put an AUDITION render into `out/masters/`, which is
 * the one outcome `verify:release` exists to prevent. `capture/lib/load-core`
 * states the general form — a gate that re-implements what it checks
 * eventually disagrees with it.
 *
 * So this bundles the real modules and prints what they say. One answer.
 *
 * ⚠ It resolves the version from `REMOTION_FILM_VERSION` / `FILM_VERSION` the
 * same way every other process does, unless `--version <id>` overrides it.
 *
 * Usage:
 *   node tools/version-info.mjs                      # the active version, as JSON
 *   node tools/version-info.mjs --version B-daylight-forward
 *   node tools/version-info.mjs --list               # every version, one per line
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

const argv = process.argv.slice(2);
const val = (f) => { const i = argv.indexOf(f); return i === -1 ? null : argv[i + 1]; };
const LIST = argv.includes("--list");

// An explicit --version must reach the modules the same way the environment
// would, because that is the seam they actually read.
const wanted = val("--version");
if (wanted) {
  process.env.REMOTION_FILM_VERSION = wanted;
  process.env.FILM_VERSION = wanted;
}

const esbuild = createRequire(import.meta.url)("esbuild");
const built = await esbuild.build({
  stdin: {
    contents: `export { outDirFor, sfxSet, activeSfxSetId, resolveCue } from "./audio";
               export { VERSION, VERSION_IDS, specFor, EDIT_ID, SFX_SET, MUSIC_ID } from "./version";
               export { cuesFor } from "./cues";
               export { CUT_IDS } from "./layout-core";`,
    resolveDir: SRC, sourcefile: "version-info.ts", loader: "ts",
  },
  bundle: true, write: false, format: "esm", platform: "node", target: "node22", logLevel: "silent",
});
const mod = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`);

const musicDoc = JSON.parse(fs.readFileSync(path.join(SRC, "data", "music.json"), "utf8"));

/**
 * A fingerprint of what a cut will SOUND like, per cut.
 *
 * ⚠ This is what tells a stale master from a wrong model. `verify:loudness`
 * compares its prediction against the true peak measured from the delivered
 * file, and that comparison is only meaningful while the film on disk still
 * corresponds to the sheet. Trim a cue and the check would otherwise read the
 * fix as the model getting worse — so the gate used to skip any cut carrying a
 * trim, which quietly excused exactly the cuts most likely to be near the
 * ceiling.
 *
 * So the render writes down what it rendered. Every resolved field that can
 * change a sample goes in: the file, when it starts, how loud, how long, its
 * fades. Nothing about the picture, so a framing fix does not invalidate a
 * sound comparison.
 */
const cueSha = (cut) => {
  const parts = mod.cuesFor(cut).map((c) => {
    const rc = mod.resolveCue(c);
    return [rc.file, rc.startSec.toFixed(4), rc.gainDb, rc.playSec.toFixed(4), rc.fadeInSec, rc.fadeOutSec].join("|");
  });
  return crypto.createHash("sha256").update(parts.join("\n")).digest("hex").slice(0, 16);
};

const describe = (id) => {
  const spec = mod.specFor(id);
  const musicId = spec.music ?? id;
  const music = musicDoc.versions?.[musicId] ?? null;
  const set = mod.sfxSet(spec.sfxSet);
  return {
    version: id,
    music: musicId,
    track: music?.track ?? null,
    bpm: music?.bpm ?? null,
    barSec: music?.barSec ?? null,
    edit: spec.edit,
    sfxSet: spec.sfxSet,
    release: spec.release ?? "master",
    // From `outDirFor`, never re-derived here. Forward slashes so PowerShell
    // and the JSON agree; Join-Path copes with either.
    outDir: mod.outDirFor(id).split("\\").join("/"),
    provenance: {
      sfxSource: set?.provenance?.source ?? null,
      sfxTier: set?.provenance?.tier ?? null,
      sfxCommercialUse: set?.provenance?.commercialUse ?? null,
      musicCommercialUse: music?.provenance?.commercialUse ?? null,
      musicNote: music?.provenance?.note ?? null,
    },
    // Only for the ACTIVE version: the modules were bundled with its data, so
    // another version's sheet is not this process's to resolve.
    cueSha: id === mod.VERSION ? Object.fromEntries(mod.CUT_IDS.map((c) => [c, cueSha(c)])) : null,
    note: spec.note ?? null,
  };
};

if (LIST) {
  for (const id of mod.VERSION_IDS) {
    const d = describe(id);
    console.log(
      `${d.version.padEnd(26)} music ${String(d.music).padEnd(22)} edit ${d.edit}  ` +
      `sfx ${d.sfxSet.padEnd(20)} ${d.release.padEnd(9)} -> ${d.outDir}`,
    );
  }
  process.exit(0);
}

const id = wanted ?? mod.VERSION;
if (!mod.VERSION_IDS.includes(id)) {
  console.error(`\n  unknown version "${id}". versions.json holds: ${mod.VERSION_IDS.join(", ")}\n`);
  process.exit(1);
}
console.log(JSON.stringify(describe(id), null, 2));
