#!/usr/bin/env node
/**
 * verify-bars.mjs — the edit is on the grid, and A has not moved.
 *
 * Two jobs, one per edit, because the two editions make different promises.
 *
 * ── Edit A: it has not moved ───────────────────────────────────────────────
 *
 * A is rendered and approved. `src/data/edit-a-timeline.lock.json` holds every
 * beat of its resolved timeline — scene, frames, replica window, fill, push —
 * captured before the version refactor moved a line of it. A diff is a red gate,
 * not a review comment.
 *
 * ── Edit B: every major boundary is a measured downbeat ────────────────────
 *
 * B is cut to the bar grid, so the grid is what checks it:
 *
 *   1. Every MAJOR boundary — the start of a beat whose scene differs from the
 *      one before it — is within {@link MAJOR_TOL_FRAMES} frame of an entry in
 *      the bed's own measured downbeat list. Not `bpm × n`: the take
 *      accelerates from 125.3 to 128.3 BPM, and a fixed grid is 1.53 s out by
 *      the last bar.
 *   2. The money shot — the draw beat that starts at the hand-over — begins on a
 *      downbeat, and the gate prints which one, so "the first stroke lands on
 *      the full arrangement" is a number someone can check rather than a claim.
 *   3. No card is on screen for less than the time its own words take to read.
 *      Reading time is derived from the authored lines, not declared.
 *   4. The cut sums to its length exactly (the timeline gate's rule, re-asserted
 *      here because B's lengths are hand-placed against a list).
 *
 * Usage:  node capture/verify-bars.mjs [--json]      (FILM_VERSION selects)
 */

import { loadFilm } from "./lib/load-core.mjs";

const AS_JSON = process.argv.includes("--json");

const failures = [];
const fail = (kind, subject, detail) => failures.push({ kind, subject, detail });

const film = await loadFilm();
const { CUT_IDS, CUT_SECONDS, FPS } = film.layout;
const { timelineFor } = film.timeline;
const { SCENES } = film.scenes;
const { VERSION, EDIT_ID } = film.version;
const A = film.audio;
const { DRAW_HANDOFF_SEC } = film.honesty;
const { linesFor } = film.copy;

/** How far a major boundary may sit from a downbeat. One frame. */
const MAJOR_TOL_FRAMES = 1;

/**
 * How long a word takes to read on a card, in seconds.
 *
 * ⚠ Reading time first, bars second. The bar count of a card is not chosen
 * because two bars is tidy — it is chosen because the line takes about this long
 * at the size it is set, and then rounded UP to whole bars. 0.26 s a word is a
 * comfortable display-type rate; the constant is here so a card that gets a new
 * line cannot quietly become unreadable.
 */
const SEC_PER_WORD = 0.26;
const READ_FLOOR_SEC = 0.9;

const readingSec = (scene) => {
  const s = SCENES[scene];
  if (!s?.copy) return 0;
  const words = linesFor(s.copy.copy, "landscape").join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(READ_FLOOR_SEC, words * SEC_PER_WORD);
};

const rows = [];
let checkedBoundaries = 0;

if (EDIT_ID === "A") {
  const lock = JSON.parse(
    (await import("node:fs")).readFileSync(new URL("../src/data/edit-a-timeline.lock.json", import.meta.url), "utf8"),
  );
  for (const cut of CUT_IDS) {
    const got = timelineFor(cut, "landscape").beats.map((b) => [
      b.scene,
      b.durationInFrames,
      b.replicaFrom ?? null,
      b.replicaTo ?? null,
      Number((b.fill ?? 0).toFixed(4)),
      Number((b.push ?? 0).toFixed(4)),
    ]);
    checkedBoundaries += got.length;
    const want = lock.cuts?.[cut];
    if (!want) {
      fail("lock", `cut ${cut}s`, "the lock has no entry for this cut — it was captured from a different film");
      continue;
    }
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      const first = got.findIndex((b, i) => JSON.stringify(b) !== JSON.stringify(want[i]));
      fail(
        "drift",
        `cut ${cut}s`,
        `A's resolved timeline no longer matches the lock — first difference at beat ${first}: ` +
          `${JSON.stringify(want[first])} became ${JSON.stringify(got[first])}. A is rendered and approved; ` +
          "if this change is intended it is a new version, not an edit to A",
      );
    }
    rows.push(`${(cut + "s").padStart(5)}  ${got.length} beat(s) checked against the lock`);
  }
} else {
  for (const cut of CUT_IDS) {
    const resolved = timelineFor(cut, "landscape");
    const downbeats = A.downbeatsFor(cut);
    if (downbeats.length === 0) {
      fail("grid", `cut ${cut}s`, "the bed carries no measured downbeats — there is no grid to cut to");
      continue;
    }

    const nearest = (sec) =>
      downbeats.reduce((best, d) => (Math.abs(d - sec) < Math.abs(best - sec) ? d : best), downbeats[0]);

    let major = 0;
    let worst = { off: 0, at: 0, scene: "" };
    for (const beat of resolved.beats) {
      const startSec = beat.startFrame / FPS;
      const prev = beat.prevScene;
      if (beat.index === 0 || prev === beat.scene) continue;
      major += 1;
      checkedBoundaries += 1;
      const d = nearest(startSec);
      const offFrames = Math.abs(startSec - d) * FPS;
      // ⚠ NaN fails. The first version of this read a field that does not exist,
      // every comparison came back false, and the gate reported "0.00 frames
      // off" for sixty boundaries it had not looked at.
      if (!Number.isFinite(offFrames)) {
        fail("offbeat", `cut ${cut}s "${beat.scene}"`, "the boundary time is not a number — the gate measured nothing");
        continue;
      }
      if (offFrames > worst.off) worst = { off: offFrames, at: startSec, scene: beat.scene };
      if (offFrames > MAJOR_TOL_FRAMES + 1e-6) {
        fail(
          "offbeat",
          `cut ${cut}s "${beat.scene}"`,
          `the boundary at ${startSec.toFixed(2)}s is ${offFrames.toFixed(1)} frames from the nearest measured ` +
            `downbeat (${d.toFixed(2)}s) — over the ${MAJOR_TOL_FRAMES}-frame tolerance`,
        );
      }
    }

    // The money shot: the draw beat that starts at the hand-over.
    const money = resolved.beats.find(
      (b) => b.scene === "draw" && Math.abs((b.replicaFrom ?? -1) - DRAW_HANDOFF_SEC) < 1e-6,
    );
    let moneyNote = "no money-shot beat";
    if (!money) {
      fail("money", `cut ${cut}s`, "no draw beat starts at the hand-over — the first wall stroke has no home");
    } else {
      const startSec = money.startFrame / FPS;
      const d = nearest(startSec);
      const offFrames = Math.abs(startSec - d) * FPS;
      moneyNote = `first stroke ${startSec.toFixed(2)}s on downbeat ${d.toFixed(2)}s (#${downbeats.indexOf(d)}), ${offFrames.toFixed(1)} frame off`;
      if (offFrames > MAJOR_TOL_FRAMES + 1e-6) {
        fail(
          "money",
          `cut ${cut}s`,
          `the first wall stroke is at ${startSec.toFixed(2)}s, ${offFrames.toFixed(1)} frames from the downbeat ` +
            `at ${d.toFixed(2)}s. This is the one moment the whole edit is built around`,
        );
      }
    }

    /*
     * Reading time is measured over the RUN, not the beat. A scene split into
     * three camera setups keeps its line on screen across all three — the
     * receipt's sentence does not restart when the camera punches in — so
     * charging each setup with the whole sentence would have banned the very
     * thing this edit does.
     */
    const runs = [];
    for (const beat of resolved.beats) {
      const last = runs[runs.length - 1];
      if (last && last.scene === beat.scene) last.frames += beat.durationInFrames;
      else runs.push({ scene: beat.scene, frames: beat.durationInFrames, at: beat.startFrame / FPS });
    }
    for (const run of runs) {
      const need = readingSec(run.scene);
      if (need <= 0) continue;
      const have = run.frames / FPS;
      if (have + 1e-6 < need) {
        fail(
          "unreadable",
          `cut ${cut}s "${run.scene}" @${run.at.toFixed(2)}s`,
          `on screen for ${have.toFixed(2)}s against ${need.toFixed(2)}s of reading time. ` +
            "Pick the bars from the words, not the words from the bars",
        );
      }
    }

    const total = resolved.totalFrames / FPS;
    if (Math.abs(total - CUT_SECONDS[cut]) > 1e-6) {
      fail("length", `cut ${cut}s`, `sums to ${total.toFixed(3)}s, not ${CUT_SECONDS[cut]}s`);
    }

    rows.push(
      `${(cut + "s").padStart(5)}  ${resolved.beats.length} beats, ${major} major boundaries, ` +
        `worst ${worst.off.toFixed(2)} frame off @${worst.at.toFixed(2)}s; ${moneyNote}`,
    );
  }
}

if (checkedBoundaries === 0) fail("vacuous", VERSION, "nothing was checked");

if (AS_JSON) {
  console.log(JSON.stringify({ ok: failures.length === 0, version: VERSION, edit: EDIT_ID, rows, failures }, null, 2));
} else {
  console.log(`\n  verify-bars — ${VERSION} (edit ${EDIT_ID})`);
  for (const r of rows) console.log(`      ${r}`);
  if (failures.length === 0) {
    console.log(
      EDIT_ID === "A"
        ? "\n  ✓ A's resolved timeline is identical to the lock, to the frame\n"
        : `\n  ✓ every major boundary is within ${MAJOR_TOL_FRAMES} frame of a measured downbeat\n`,
    );
  } else {
    console.log("");
    for (const f of failures) console.log(`  ✗ [${f.kind}] ${f.subject}\n      ${f.detail}`);
    console.log("");
  }
}

process.exit(failures.length === 0 ? 0 : 1);
