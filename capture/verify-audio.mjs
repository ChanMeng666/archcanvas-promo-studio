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
 * Eight checks, and each one has cost somebody a render somewhere:
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
 *   5. **the drawing has ONE continuous base under it, and it covers the beat.**
 *      The money shot's sound used to be a `pencil-line` re-fired every 0.42 s;
 *      with a vendor set whose drawing cue is a 7.69 s bed that became one copy
 *      running 2.1 s past its own beat. So: the base starts within a frame of
 *      the first stroke, there is no silent gap inside the beat, and nothing
 *      sounds past the beat's end.
 *   6. **every band tick is on its knot.** In edit B each drawing band opens on
 *      a measured downbeat (`warp.ts`), and the tick that marks it is placed
 *      from the warp's own knots. A tick that lands where the stroke is not is
 *      worse than no tick, so the gate measures the distance in frames rather
 *      than trusting that both read the same array.
 *   7. **anchoring is applied.** A cue's file starts at `action − alignOffset`,
 *      to within a frame. Nothing applied it at all until this round, and the
 *      ElevenLabs typing clusters ran 157 ms behind their characters.
 *   8. **every role/intent resolves in EVERY set, and no per-set block inherits
 *      a number measured on another set's material.** The second half is the
 *      only check here that no other gate can stand in for: `perMusic` falling
 *      through put version A's synthesised stroke five decibels down on the
 *      money shot, and the loudness gate measured the same -15.5 LUFS either
 *      way, because one quiet cue does not move a figure the bed dominates.
 *
 * And the vacuity question, out loud: it prints how many cues it looked at, and
 * a cut with ZERO is a failure rather than a tick. A gate whose input set can go
 * empty reports success by doing nothing; the sibling project produced exactly
 * that failure four times in one day.
 *
 * Usage:  node capture/verify-audio.mjs [--json]
 */

import crypto from "node:crypto";
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
const { CUT_IDS, FPS } = film.layout;
const { TIMELINES } = film.timeline;
const { cuesFor, cueProblems, drawBeatsFor, MAX_SIMULTANEOUS, MAX_KEYS_PER_SEC } = film.cues;
const { allSfx, audioProblems, bedFor, MUSIC_VERSION, resolveCue, role, roleCue, roleView, ROLE_IDS, SFX_SET_IDS } = film.audio;
const { VERSION, EDIT_ID, versionProblems } = film.version;

/** How far a derived cue may sit from the moment it is derived FROM. */
const TOL_FRAMES = 1;
const TOL_SEC = TOL_FRAMES / FPS;

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

/*
 * ⚠ And the VERSION map, here, because nothing else was reading it.
 *
 * `versionProblems()` has been correctly reporting that the two `+el` versions
 * name an unknown sound set since the day they landed — `version.ts` held a
 * hand-written union naming `elevenlabs`, and the set on disk is
 * `elevenlabs-audition`. Reported, never enforced, so it said so to nobody for
 * a fortnight. Which set a version loads is an audio fact, so it fails here.
 */
for (const problem of versionProblems()) fail("version", "src/data/versions.json", problem);

/*
 * Every role, and every intent the sheets use, resolves in EVERY set — not just
 * in the one this process is building.
 *
 * A role whose files are named for one set throws only when that set is active,
 * which means a broken mapping in `synth` is invisible for as long as everyone
 * is auditioning `elevenlabs-audition`. `roleCue` throwing at render time is a
 * film with a hole in it; throwing here is a Tuesday.
 */
let mappingsChecked = 0;
const usedIntents = new Map();
for (const cut of CUT_IDS) {
  for (const cue of cuesFor(cut)) {
    if (!usedIntents.has(cue.role)) usedIntents.set(cue.role, new Set());
    usedIntents.get(cue.role).add(cue.intent ?? null);
  }
}
for (const setId of SFX_SET_IDS) {
  for (const [roleId, intents] of usedIntents) {
    for (const intent of intents) {
      mappingsChecked += 1;
      try {
        roleCue(roleId, { intent: intent ?? undefined, set: setId });
      } catch (err) {
        fail("role", `${setId} · ${roleId}${intent ? `/${intent}` : ""}`, String(err.message));
      }
    }
  }
}
if (mappingsChecked === 0) fail("vacuous", "roles", "no role mapping was resolved — the sheets name nothing");

/*
 * A per-set block's MATERIAL-CALIBRATED fields come from the block or from
 * nowhere — never from the role.
 *
 * This is a property of `roleView`, asserted rather than trusted, because the
 * bug it is about is invisible everywhere else. `perMusic` falling through put
 * version A's 0.65 s synthesised stroke at the -14 dB measured for a 7.69 s
 * ElevenLabs texture: five decibels down on the money shot, and
 * `verify:loudness` measured -15.5 LUFS either way, because one cue five
 * decibels quieter does not move an integrated figure the bed dominates. Nothing
 * in the repo could have said so — which is the shape this project has paid for
 * before.
 */
const SET_SCOPED = ["perMusic", "perFile", "loop", "bandTick", "minGapSec"];
let scopedChecked = 0;
for (const setId of SFX_SET_IDS) {
  for (const roleId of ROLE_IDS) {
    const block = role(roleId).perSet?.[setId];
    if (block === undefined) continue;
    const view = roleView(roleId, setId);
    for (const field of SET_SCOPED) {
      scopedChecked += 1;
      if (JSON.stringify(view[field] ?? null) === JSON.stringify(block[field] ?? null)) continue;
      fail(
        "fallthrough",
        `${setId} · ${roleId}.${field}`,
        `resolves to ${JSON.stringify(view[field])} but this set's own block says ${JSON.stringify(block[field] ?? null)} — ` +
          "a set names its own files because its material is different, so a number measured on the other set's " +
          "material is wrong here by construction",
      );
    }
  }
}

/*
 * A baked EQ still matches its recipe.
 *
 * `tools/bake-eq.mjs` renders the manifest's per-music filter into real bytes,
 * because Remotion's `<Audio>` takes a gain and nothing else. That makes the
 * baked file a DERIVED artefact committed next to its source, and a derived
 * artefact with no tripwire is a stale artefact waiting to happen: change the
 * shelf, or re-buy the source, and the film goes on playing yesterday's filter
 * with every other gate green. The hash is recomputed from the source's bytes
 * and the recipe string — no ffmpeg, no decode.
 */
let bakedChecked = 0;
for (const setId of SFX_SET_IDS) {
  for (const roleId of ROLE_IDS) {
    const v = roleView(roleId, setId);
    for (const [music, entry] of Object.entries(v.perMusic ?? {})) {
      if (!entry || typeof entry !== "object" || !entry.eq) continue;
      bakedChecked += 1;
      if (!entry.file) {
        fail(
          "baked",
          `${setId} · ${roleId} · ${music}`,
          `declares an EQ (${entry.eq}) but names no baked file — Remotion cannot filter audio, so this ` +
            "recipe reaches nothing. Run `node tools/bake-eq.mjs`",
        );
        continue;
      }
      const baked = film.audio.sfxSet(setId).cues.find((c) => c.id === entry.file);
      const source = film.audio.sfxSet(setId).cues.find((c) => c.id === baked?.derivedFrom);
      if (!baked || !source) {
        fail("baked", `${setId} · ${roleId} · ${music}`, `names "${entry.file}", which the set does not carry`);
        continue;
      }
      const srcAbs = path.join(PUBLIC_DIR, source.file);
      if (!fs.existsSync(srcAbs)) continue; // the missing-file check above owns this
      const want = crypto.createHash("sha256")
        .update(crypto.createHash("sha256").update(fs.readFileSync(srcAbs)).digest("hex"))
        .update("\n").update(entry.eq).digest("hex").slice(0, 16);
      if (baked.recipeHash !== want) {
        fail(
          "baked",
          `${setId} · ${roleId} · ${music}`,
          `"${entry.file}" was baked from a different source or a different recipe ` +
            `(${baked.recipeHash} vs ${want}) — run \`node tools/bake-eq.mjs\``,
        );
      }
    }
  }
}

/* ── 3. the cue sheets ────────────────────────────────────────────────────── */

const perCut = {};
let totalCues = 0;
let drawBeatsChecked = 0;
let bandTicksChecked = 0;
let worstTickFrames = 0;

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
  const keys = sheet.filter((c) => c.role === "type").map((c) => c.atSec);
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

  /*
   * Anchoring, per cue: the FILE starts at the action minus the cue's own
   * measured first strong onset, to within a frame.
   *
   * ⚠ Checked against `roleCue`'s offset rather than against `resolveCue`'s own
   * arithmetic, so this is two readings of the manifest agreeing rather than one
   * function agreeing with itself.
   */
  for (const cue of sheet) {
    const rc = resolveCue(cue);
    const r = roleCue(cue.role, { intent: cue.intent, nth: cue.nth, music: MUSIC_VERSION });
    const want = cue.atSec - r.offsetSec;
    if (!Number.isFinite(rc.startSec) || Math.abs(rc.startSec - want) > TOL_SEC + 1e-9) {
      fail(
        "anchor",
        `cut ${cut}s "${rc.cueId}"`,
        `scheduled at ${rc.startSec.toFixed(3)}s; the action is at ${cue.atSec.toFixed(3)}s and the cue's ` +
          `first strong onset is ${r.offsetSec.toFixed(3)}s in, so it belongs at ${want.toFixed(3)}s`,
      );
      break;
    }
  }

  // Nothing may be scheduled with a sample that runs past the master's end.
  const tails = sheet.map((c) => { const rc = resolveCue(c); return { rc, tail: rc.startSec + rc.playSec }; });
  const worst = tails.reduce((a, b) => (b.tail > a.tail ? b : a), tails[0]);
  if (worst.tail > seconds + 0.5) {
    fail(
      "past-end",
      `cut ${cut}s`,
      `"${worst.rc.cueId}" sounds to ${worst.tail.toFixed(2)}s, past the ${seconds.toFixed(2)}s master`,
    );
  }

  /* ── 4. the drawing: one base under the beat, ticks on the knots ──────── */

  for (const db of drawBeatsFor(cut)) {
    drawBeatsChecked += 1;
    const base = sheet
      .filter((c) => c.role === "draw" && c.intent === undefined)
      .map((c) => resolveCue(c))
      .filter((rc) => rc.startSec < db.endSec - 1e-6 && rc.startSec + rc.playSec > db.firstStrokeSec + 1e-6)
      .sort((a, b) => a.startSec - b.startSec);

    if (base.length === 0) {
      fail("draw", `cut ${cut}s beat ${db.index}`, "the plan draws here and nothing sounds under it");
      continue;
    }
    if (Math.abs(base[0].startSec - db.firstStrokeSec) > TOL_SEC + 1e-9) {
      fail(
        "draw",
        `cut ${cut}s beat ${db.index}`,
        `the drawing base starts at ${base[0].startSec.toFixed(3)}s but the first stroke is at ` +
          `${db.firstStrokeSec.toFixed(3)}s — ${(Math.abs(base[0].startSec - db.firstStrokeSec) * FPS).toFixed(1)} frames out`,
      );
    }
    // No silent gap inside the beat: each copy must start before the last one
    // has finished, and the last must reach the beat's end.
    let covered = base[0].startSec;
    for (const rc of base) {
      if (rc.startSec > covered + 1e-6) {
        fail(
          "draw",
          `cut ${cut}s beat ${db.index}`,
          `the drawing base goes silent from ${covered.toFixed(3)}s to ${rc.startSec.toFixed(3)}s, inside the beat`,
        );
        break;
      }
      covered = Math.max(covered, rc.startSec + rc.playSec);
    }
    if (covered + TOL_SEC < db.endSec) {
      fail(
        "draw",
        `cut ${cut}s beat ${db.index}`,
        `the drawing base stops at ${covered.toFixed(3)}s, ${(db.endSec - covered).toFixed(2)}s before the ` +
          `beat ends at ${db.endSec.toFixed(3)}s`,
      );
    }
    if (covered > db.endSec + TOL_SEC) {
      fail(
        "draw",
        `cut ${cut}s beat ${db.index}`,
        `the drawing base runs to ${covered.toFixed(3)}s, ${(covered - db.endSec).toFixed(2)}s past the beat — ` +
          "a drawing sound over a drawing that has stopped",
      );
    }

    /* Edit B: one tick per band pin, each on its knot. */
    const ticks = sheet
      .filter((c) => c.role === "draw" && c.intent === "band")
      .map((c) => c.atSec)
      .filter((t) => t >= db.startSec - 1e-6 && t <= db.endSec + 1e-6)
      .sort((a, b) => a - b);
    const knots = [...db.knotFilmSec].sort((a, b) => a - b);
    if (EDIT_ID !== "B") {
      if (ticks.length) fail("band", `cut ${cut}s beat ${db.index}`, `edit ${EDIT_ID} has no band pins, but ${ticks.length} band tick(s) were emitted`);
      continue;
    }
    if (ticks.length !== knots.length) {
      fail(
        "band",
        `cut ${cut}s beat ${db.index}`,
        `${knots.length} band pin(s) on this beat but ${ticks.length} tick(s) — the warp and the sheet disagree ` +
          "about how many bands open here",
      );
      continue;
    }
    for (let i = 0; i < knots.length; i += 1) {
      const offFrames = Math.abs(ticks[i] - knots[i]) * FPS;
      bandTicksChecked += 1;
      worstTickFrames = Math.max(worstTickFrames, offFrames);
      if (!Number.isFinite(offFrames) || offFrames > TOL_FRAMES + 1e-6) {
        fail(
          "band",
          `cut ${cut}s beat ${db.index} @${knots[i].toFixed(2)}s`,
          `the band tick is ${offFrames.toFixed(1)} frames from its knot — over the ${TOL_FRAMES}-frame tolerance`,
        );
      }
    }
  }
}

/* ── report ───────────────────────────────────────────────────────────────── */

/*
 * ⚠ A drawing beat with no base, or an edit-B cut with no band ticks, is the
 * empty-input-set failure this repo has now produced twice. Both are counted and
 * both are fatal at zero.
 */
if (drawBeatsChecked === 0) {
  fail("vacuous", VERSION, "no drawing beat was found in any cut — the money shot has no sound to check");
}
if (EDIT_ID === "B" && bandTicksChecked === 0) {
  fail("vacuous", VERSION, "edit B pins its drawing bands to downbeats, and not one band tick was checked");
}

const summary = {
  filesChecked, totalCues, maxSimultaneous: MAX_SIMULTANEOUS, perCut,
  drawBeatsChecked, bandTicksChecked, worstTickFrames, mappingsChecked, failures,
};

if (AS_JSON) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(failures.length ? 1 : 0);
}

console.log(`\n  verify-audio — ${VERSION} (edit ${EDIT_ID})`);
console.log(`    ${filesChecked} audio file(s) named by the manifests, all resolved against public/`);
console.log(`    ${totalCues} cue(s) derived across ${CUT_IDS.length} cut(s); ceiling ${MAX_SIMULTANEOUS} at once, ${MAX_KEYS_PER_SEC} key(s)/s`);
for (const cut of CUT_IDS) {
  const c = perCut[cut];
  console.log(`      cut ${String(cut).padStart(3)}s  ${String(c.cues).padStart(4)} cue(s)  ${c.perSecond.toFixed(2)}/s`);
}
console.log(
  `    ${drawBeatsChecked} drawing beat(s) with a continuous base; ` +
    `${bandTicksChecked} band tick(s), worst ${worstTickFrames.toFixed(2)} frame off its knot`,
);
console.log(`    ${mappingsChecked} role→file mapping(s) resolved across ${SFX_SET_IDS.length} set(s): ${SFX_SET_IDS.join(", ")}`);
console.log(`    ${scopedChecked} per-set field(s) checked for fall-through from the role; ${bakedChecked} baked EQ recipe(s) still current`);

if (!failures.length) {
  console.log("\n  ✓ every cue has a file, is anchored, lands inside its cut, and nothing piles up\n");
  process.exit(0);
}

console.log("");
for (const f of failures) {
  console.log(`  ✗ [${f.kind}] ${f.subject}`);
  console.log(`      ${f.detail}`);
}
console.log(`\n  ${failures.length} failure(s).\n`);
process.exit(1);
