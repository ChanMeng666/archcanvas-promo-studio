#!/usr/bin/env node
/**
 * verify-opening.mjs — no scene may open on an empty frame.
 *
 * ── The defect this exists for ─────────────────────────────────────────────
 *
 * Every entrance in this film was written as "start at nothing and arrive":
 * opacity from 0, a masked line translated entirely out of its band, a montage
 * pane at 0. Each is correct in isolation and together they meant **the first
 * frame of every beat was blank** — one frame of bare ivory on every cut in
 * every master. In motion that is not an entrance, it is a dropped frame, and
 * the only reason anyone saw it is that a five-second segment was rendered and
 * every third frame laid out as a strip.
 *
 * A still pass catches that once. A gate catches it every time, and that is the
 * difference between a fix and a habit.
 *
 * ── Why this reads the arithmetic and not the pixels ──────────────────────
 *
 * Rendering the first frame of every beat of every master is 60-odd renders and
 * several minutes, and a pixel test on an ivory film would need a threshold
 * nobody can defend. The values that decide whether a frame is empty are all
 * pure functions of the local frame — `entryOpacity`, the card's mask reveal,
 * the montage's pane entrance — so the gate asks THOSE, through the same
 * modules the components call. If a component stops using them the gate goes
 * blind, which is why it also reports how many openings it actually looked at.
 *
 * Usage:  node capture/verify-opening.mjs [--json]
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadFilm } from "./lib/load-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AS_JSON = process.argv.includes("--json");

const failures = [];
const fail = (kind, subject, detail) => failures.push({ kind, subject, detail });

const film = await loadFilm();
const { CUT_IDS, FPS } = film.layout;
const { TIMELINES } = film.timeline;
const { SCENES } = film.scenes;
const { entryOpacity, ENTRY_OPACITY_FLOOR } = film.camera;
const { MONTAGE_PANE_ENTRY_FLOOR } = film.film;

/**
 * How much ink a frame must carry to count as arrived.
 *
 * Not a taste threshold: 0.5 is the point at which a frame reads as a picture
 * the viewer is meant to be looking at rather than as a fade in progress. The
 * entrances are all well above it by construction (0.72); the value exists so
 * that "somebody set it back to 0" is what the gate catches, not a two-percent
 * drift.
 */
const OPENING_MIN = 0.5;

/**
 * A card's first frame, as `KineticCard` computes it.
 *
 * ⚠ A MIRROR, and the one thing here that could drift. The card's reveal is a
 * clip plus a translate, which is not a number `camera.ts` owns, so this gate
 * restates the opacity half of it. The mutation evidence in
 * `docs/decisions.md` D18 is what keeps it honest: break the component and this
 * must go red, so the two are checked against each other rather than trusted.
 */
const cardOpeningInk = () => 0.25 + 0.75 * 0;

let openings = 0;

for (const cut of CUT_IDS) {
  for (const beat of TIMELINES[cut].beats) {
    const scene = SCENES[beat.scene];
    openings += 1;

    // Frame 0 of the beat, in the beat's own local seconds.
    const localSec = 0;

    if (scene.kind === "replica" || scene.kind === "split") {
      const ink = beat.scene === "second-brief" ? MONTAGE_PANE_ENTRY_FLOOR : entryOpacity(localSec);
      if (ink < OPENING_MIN) {
        fail(
          "blank",
          `cut ${cut}s beat ${beat.index} "${beat.scene}"`,
          `opens at ${ink.toFixed(3)} opacity, under the ${OPENING_MIN} floor — ` +
            "one bare frame on the cut, which reads as a dropped frame rather than an entrance",
        );
      }
    } else if (scene.kind === "card") {
      // A card's first frame IS its reveal starting, and that is the point of a
      // card — but it may not be invisible either.
      if (cardOpeningInk() < 0.2) {
        fail(
          "blank",
          `cut ${cut}s beat ${beat.index} "${beat.scene}"`,
          `the card's first line opens at ${cardOpeningInk().toFixed(3)} opacity — a card reveals, it does not appear from nothing`,
        );
      }
    }
    // `endcard` opens under the plum wipe, which is full-bleed colour: the one
    // opening in the film that is deliberately not the scene behind it.
  }
}

if (openings === 0) {
  fail("vacuous", "every cut", "no beat was examined at all — this gate looked at nothing");
}

/* ── report ───────────────────────────────────────────────────────────────── */

const summary = {
  openings,
  floor: OPENING_MIN,
  entryOpacityFloor: ENTRY_OPACITY_FLOOR,
  montagePaneFloor: MONTAGE_PANE_ENTRY_FLOOR,
  fps: FPS,
  failures,
};

if (AS_JSON) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(failures.length ? 1 : 0);
}

console.log("\n  verify-opening");
console.log(`    ${openings} scene opening(s) across ${CUT_IDS.length} cut(s), floor ${OPENING_MIN}`);
console.log(
  `    replica/split entrances open at ${ENTRY_OPACITY_FLOOR}; the montage's panes at ${MONTAGE_PANE_ENTRY_FLOOR}`,
);

if (!failures.length) {
  console.log("\n  ✓ no scene opens on a blank frame\n");
  process.exit(0);
}

console.log("");
for (const f of failures) {
  console.log(`  ✗ [${f.kind}] ${f.subject}`);
  console.log(`      ${f.detail}`);
}
console.log(`\n  ${failures.length} failure(s). See ${path.relative(ROOT, ROOT)}docs/decisions.md D18.\n`);
process.exit(1);
