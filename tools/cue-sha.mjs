#!/usr/bin/env node
/**
 * cue-sha.mjs — a fingerprint of the RESOLVED cue sheet, per version × cut.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * `verify:loudness` has to tell a stale master from a wrong model. A master
 * rendered before a trim landed will disagree with the prediction, and that is
 * not the model being optimistic — it is the file being old. Its note says the
 * discriminator it actually wants is "a fingerprint of the resolved cue sheet
 * at render time", and that until one exists it falls back to asking git what
 * `openingCueTrimDb` was at the manifest's `renderCommit`.
 *
 * That fallback has two holes the note names — a dirty tree at render time, and
 * a shallow clone that cannot reach the commit — and one it does not: the trim
 * is only the cue sheet's *per-cut dial*. Anything else that moves a cue (a
 * role's gain, an `alignOffsetSec`, a new cue, a changed sfx set) changes the
 * sound without changing that table, and the commit comparison would call the
 * master fresh.
 *
 * So this hashes the thing itself. `package-masters.ps1` records it per film,
 * which makes staleness a property of THAT FILE rather than of a commit, and
 * survives both holes: a dirty tree and a shallow clone are irrelevant to a
 * hash that was computed from the sheet that was rendered.
 *
 * ⚠ The hash covers what a listener would hear change: each cue's time, its
 * resolved file, and its gain. It deliberately does NOT cover the whole module
 * or a formatted string — a comment or a rename would then read as new audio.
 *
 * Usage:
 *   node tools/cue-sha.mjs --version A-confident-arrival     # {"15": "...", ...}
 */

import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadFilmForVersion } from "../capture/lib/load-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const argv = process.argv.slice(2);
const val = (f) => { const i = argv.indexOf(f); return i === -1 ? null : argv[i + 1]; };

const version = val("--version");
if (!version) {
  console.error("\n  usage: node tools/cue-sha.mjs --version <id>\n");
  process.exit(1);
}

const film = await loadFilmForVersion(version);
const { CUT_IDS } = film.layout;
const { cuesFor } = film.cues;
const A = film.audio;

const out = {};
for (const cut of CUT_IDS) {
  let sheet;
  try { sheet = cuesFor(cut); } catch { out[cut] = null; continue; }
  /*
   * Canonical, and only the audible fields. `atSec` is rounded to the
   * millisecond because the film quantises a cue to a frame anyway, and a
   * float's last bits are not a difference anyone can hear — while they would
   * make the hash change for nothing.
   */
  const canon = sheet.map((c) => {
    let file = null;
    try { file = A.sfxFileFor ? A.sfxFileFor(c) : (c.sfx ? A.sfxFile(c.sfx) : null); }
    catch { file = c.sfx ?? c.role ?? null; }
    return [Number(c.atSec).toFixed(3), file ?? (c.sfx ?? c.role ?? ""), Number(c.gainDb ?? 0).toFixed(2)];
  });
  out[cut] = crypto.createHash("sha256").update(JSON.stringify(canon)).digest("hex").slice(0, 16);
}

console.log(JSON.stringify(out));
