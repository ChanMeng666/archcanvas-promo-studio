#!/usr/bin/env node
/**
 * verify-audio.mjs — prove the sound the film mounts is sound that exists,
 * lands inside the cut, and does not pile up.
 *
 * The cue sheets are DERIVED from the picture (`src/cues.ts`): a key click
 * because a character appeared, a tick because the slider stepped, a pin drop
 * because that pin landed. Derivation is what keeps them right across four cuts
 * whose warps differ by a factor of five — and it is also what makes a gate
 * necessary, because a derivation can produce a cue for a file that is not
 * there, at a second past the end of the cut, or four at once.
 *
 * Four checks, and each one has cost somebody a render somewhere:
 *
 *   1. **every cue names a file the manifest carries, and that file is on
 *      disk.** `staticFile()` fails SOFTLY in Remotion — a missing sample is
 *      silence, not an error, so a master can ship with a hole in its sound and
 *      nobody hears it until it is on a landing page.
 *   2. **no cue past the end of its cut, and none before the start.** A cue
 *      scheduled at 30.4 s of a 30 s master is simply not in the film; it looks
 *      like a beat that lost its sound.
 *   3. **at most `MAX_SIMULTANEOUS` cues sounding at once.** Four transients on
 *      one frame is not four sounds, it is a click. This was a real finding: a
 *      zero-seeded change detector fired all three pin drops again at the start
 *      of the following beat, and the density check is what named it.
 *   4. **every bed is as long as its cut, peaks under the ceiling, and its
 *      downbeats ascend.** `src/audio.ts`'s own self-check, run here rather than
 *      at import time — a module that throws on import takes the Studio down
 *      with it, and a bad manifest should fail a gate, not the editor.
 *
 * And the vacuity question, out loud: it prints how many cues it looked at, and
 * a cut with ZERO is a failure rather than a tick. A gate whose input set can go
 * empty reports success by doing nothing; the sibling project produced exactly
 * that failure four times in one day.
 *
 * Usage:  node capture/verify-audio.mjs [--json]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadFilm } from "./lib/load-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const AS_JSON = process.argv.includes("--json");

const failures = [];
const fail = (kind, subject, detail) => failures.push({ kind, subject, detail });

const film = await loadFilm();
const { CUT_IDS } = film.layout;
const { TIMELINES } = film.timeline;
const { cuesFor, cueProblems, MAX_SIMULTANEOUS, MAX_KEYS_PER_SEC } = film.cues;
const { allSfx, audioProblems, bedFor, sfx } = film.audio;

/* ── 1. the manifests describe files that exist ───────────────────────────── */

let filesChecked = 0;
for (const cue of allSfx()) {
  const abs = path.join(PUBLIC_DIR, cue.file);
  filesChecked += 1;
  if (!fs.existsSync(abs)) {
    fail("missing", cue.file, `sfx "${cue.id}" names a file that is not in public/ — Remotion would render silence here`);
  }
}
for (const cut of CUT_IDS) {
  const bed = bedFor(cut);
  const abs = path.join(PUBLIC_DIR, bed.file);
  filesChecked += 1;
  if (!fs.existsSync(abs)) fail("missing", bed.file, `the ${cut}s cut's bed is not in public/`);
}

/* ── 2. the manifests are internally sound ────────────────────────────────── */

for (const problem of audioProblems()) fail("manifest", "src/data", problem);

/* ── 3. the cue sheets ────────────────────────────────────────────────────── */

const perCut = {};
let totalCues = 0;

for (const cut of CUT_IDS) {
  const sheet = cuesFor(cut);
  totalCues += sheet.length;
  const seconds = TIMELINES[cut].totalSeconds;
  perCut[cut] = { cues: sheet.length, seconds, perSecond: sheet.length / Math.max(1, seconds) };

  if (sheet.length === 0) {
    fail("vacuous", `cut ${cut}s`, "derived ZERO cues — a silent master is not a passing gate");
    continue;
  }

  for (const problem of cueProblems(cut)) {
    fail(problem.kind, `cut ${problem.cut}s`, problem.detail);
  }

  // The typing ceiling, checked against the sheet rather than trusted. `thin()`
  // is what enforces it; this is what notices when `thin()` stops being called.
  const keys = sheet.filter((c) => c.sfx.startsWith("key-")).map((c) => c.atSec);
  for (let i = 1; i < keys.length; i += 1) {
    const gap = keys[i] - keys[i - 1];
    if (gap < 1 / MAX_KEYS_PER_SEC - 1e-6) {
      fail(
        "too-fast",
        `cut ${cut}s`,
        `two key cues ${(gap * 1000).toFixed(0)} ms apart at ${keys[i].toFixed(3)}s — the ceiling is ${MAX_KEYS_PER_SEC}/s`,
      );
      break;
    }
  }

  // Nothing may be scheduled with a sample that runs past the master's end.
  const last = sheet[sheet.length - 1];
  const tail = last.atSec + sfx(last.sfx).durationSec;
  if (tail > seconds + 0.5) {
    fail("past-end", `cut ${cut}s`, `the last cue's sample runs to ${tail.toFixed(2)}s, past the ${seconds.toFixed(2)}s master`);
  }
}

/* ── report ───────────────────────────────────────────────────────────────── */

const summary = { filesChecked, totalCues, maxSimultaneous: MAX_SIMULTANEOUS, perCut, failures };

if (AS_JSON) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(failures.length ? 1 : 0);
}

console.log("\n  verify-audio");
console.log(`    ${filesChecked} audio file(s) named by the manifests, all resolved against public/`);
console.log(`    ${totalCues} cue(s) derived across ${CUT_IDS.length} cut(s); ceiling ${MAX_SIMULTANEOUS} at once, ${MAX_KEYS_PER_SEC} key(s)/s`);
for (const cut of CUT_IDS) {
  const c = perCut[cut];
  console.log(`      cut ${String(cut).padStart(3)}s  ${String(c.cues).padStart(4)} cue(s)  ${c.perSecond.toFixed(2)}/s`);
}

if (!failures.length) {
  console.log("\n  ✓ every cue has a file, lands inside its cut, and nothing piles up\n");
  process.exit(0);
}

console.log("");
for (const f of failures) {
  console.log(`  ✗ [${f.kind}] ${f.subject}`);
  console.log(`      ${f.detail}`);
}
console.log(`\n  ${failures.length} failure(s).\n`);
process.exit(1);
