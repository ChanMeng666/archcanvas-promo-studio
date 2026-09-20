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
 * It has grown two neighbours since, both for the same reason — they are cheap,
 * they are pure, and the thing they check is a founder requirement rather than a
 * preference: **nothing holds still for more than 2.5 s**, and **every colour the
 * film sets type on clears 4.5:1**.
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
const { timelineFor } = film.timeline;
const { SCENES } = film.scenes;
const { entryOpacity, ENTRY_OPACITY_FLOOR } = film.camera;
const { MONTAGE_PANE_ENTRY_FLOOR } = film.film;
const { CARD_RULE_FLOOR, WORD_FLOOR, WORD_RISE_SEC, WORD_STAGGER_SEC, CONTRAST_PAIRS, TYPE } = film.tokens;
const { deriveLayout, DELIVERABLES } = film.layout;
const { EDIT_ID } = film.version;
const audio = film.audio;
const { linesFor } = film.copy;
const { CAPTION_SCALE } = film.caption;

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
 * A card's first frame carries its accent rule, and that is all it has to.
 *
 * A card REVEALS — its line is behind a mask on frame 0 and that is the point of
 * it — so the thing that must not be zero is the rule. It matters most on the
 * very first frame of the whole film, which is a card's first frame: a
 * thumbnail, a scrub and the first cell of every contact sheet all land there,
 * and an empty ivory rectangle reads as a missing asset.
 *
 * `CARD_RULE_FLOOR` comes from `tokens.ts` — the same constant the component
 * sets the rule from — rather than being restated here, so this cannot drift
 * from what is drawn.
 */
const CARD_RULE_MIN = 0.45;

/** How far the first word must already be out of its mask on frame 0. */
const FRAME_ZERO_WORD_MIN = 0.35;

/**
 * The hook has to be ON SCREEN BY FRAME 3 — the art-direction note's words.
 *
 * At 30 fps that is 0.1 s, so the first word's rise must be essentially over by
 * then. Read off the same constants the component eases with, not restated: a
 * check that restates the timing is a check that stops describing it.
 */
const BY_FRAME = 3;
const FIRST_WORD_MIN = 0.9;

/** `easeOutExpo`, the curve the reveal uses. */
const easeOutExpo = (t) => {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
};

let openings = 0;

for (const cut of CUT_IDS) {
  for (const beat of timelineFor(cut, "landscape").beats) {
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
      // The first word of the first line, at frame 3.
      const p = easeOutExpo((BY_FRAME / FPS - WORD_STAGGER_SEC * 0) / WORD_RISE_SEC);
      const ink = 0.25 + 0.75 * p;
      if (ink < FIRST_WORD_MIN) {
        fail(
          "slow",
          `cut ${cut}s beat ${beat.index} "${beat.scene}"`,
          `the card's first word is only ${(ink * 100).toFixed(0)} % up at frame ${BY_FRAME} — ` +
            `the hook has to be on screen by then (rise ${WORD_RISE_SEC}s, stagger ${WORD_STAGGER_SEC}s)`,
        );
      }
      if (CARD_RULE_FLOOR < CARD_RULE_MIN) {
        fail(
          "blank",
          `cut ${cut}s beat ${beat.index} "${beat.scene}"`,
          `the card's accent rule opens at ${CARD_RULE_FLOOR} of its width, under the ${CARD_RULE_MIN} floor — ` +
            "frame 0 is the thumbnail a platform picks, and it has to be a frame someone would have chosen",
        );
      }
      if (WORD_FLOOR < FRAME_ZERO_WORD_MIN) {
        fail(
          "blank",
          `cut ${cut}s beat ${beat.index} "${beat.scene}"`,
          `the card's first word is only ${(WORD_FLOOR * 100).toFixed(0)} % risen on frame 0, under the ` +
            `${(FRAME_ZERO_WORD_MIN * 100).toFixed(0)} % floor — a thumbnail of a starting gun is not a designed frame`,
        );
      }
    }
    // `endcard` opens under the plum wipe, which is full-bleed colour: the one
    // opening in the film that is deliberately not the scene behind it.
  }
}

/* ── the film's own caption is readable ───────────────────────────────────── */

/**
 * How big the film's honesty band sets, per frame shape.
 *
 * ⚠ Floors, not intentions. Under the money shot's drawing the band read as
 * small print in the first cut, which is the wrong register for the one sentence
 * in the film that exists to be read. 30 px at 1920 wide and 34 px at 1080 wide
 * are the sizes the art-direction review set, and this checks the arithmetic the
 * component actually sets type with rather than a remembered number.
 */
const CAPTION_PX_FLOOR = { landscape: 30, portrait: 34 };

let captionSizes = 0;
for (const d of DELIVERABLES) {
  const L = deriveLayout(d.width, d.height);
  const px = L.u(TYPE.caption * CAPTION_SCALE);
  captionSizes += 1;
  const floor = CAPTION_PX_FLOOR[L.aspect];
  if (px + 1e-6 < floor) {
    fail(
      "caption-size",
      d.id,
      `the film's honesty band sets at ${px.toFixed(0)} px, under the ${floor} px floor for ${L.aspect}`,
    );
  }
}
if (captionSizes === 0) fail("vacuous", "caption size", "no composition was measured");

/* ── pace: nothing holds still ─────────────────────────────────────────────── */

/**
 * The longest a shot may hold without moving, in seconds.
 *
 * The founder's requirement for this film is 节奏要加快、观感要活泼明朗 — faster,
 * livelier, brighter. A beat that sits at one scale showing one state for three
 * seconds is the thing that reads as slow, whatever else is on screen, so the
 * ceiling is checked rather than intended.
 *
 * A beat clears it by DOING something: the camera moves (the scale changes by
 * more than 3 % across the beat), or the product does (the beat plays more than
 * `MOVING_REPLICA_SEC` of the screenplay, which at these warps is always
 * something appearing). A card is exempt below its own 2.2 s ceiling, which
 * `verify:timeline` already enforces, and the end card is the resting frame.
 */
const STATIC_MAX_SEC = 2.5;
const MOVING_REPLICA_SEC = 0.4;

/**
 * The same ceiling in BARS, for an edit that is cut to the music.
 *
 * ⚠ Edit B's cards are two and three bars long, and they are that long because
 * their own words take that long to read — the reading-time rule in
 * `verify:bars` is what sets them. Holding B to 2.5 s of wall clock would have
 * meant either type nobody can read or a card that cuts mid-sentence.
 *
 * So for B the ceiling is TWO BARS of the bed's own measured bar, and a card is
 * only "holding" once its last word has landed: type still arriving is the beat
 * doing something, which is the whole point of the rule. `music-analysis` §
 * tempo has the take accelerating, so the bar is read from the bed rather than
 * from a BPM.
 */
const STATIC_MAX_BARS = 2;

const barSecFor = (cut) => {
  const db = audio.downbeatsFor(cut);
  if (db.length < 2) return null;
  return (db[db.length - 1] - db[0]) / (db.length - 1);
};

/** How long a card's words take to finish arriving. */
const riseSec = (scene) => {
  const s = SCENES[scene];
  if (!s?.copy) return 0;
  const words = linesFor(s.copy.copy, "landscape").join(" ").split(/\s+/).filter(Boolean).length;
  return WORD_STAGGER_SEC * Math.max(0, words - 1) + WORD_RISE_SEC;
};

let paced = 0;
for (const cut of CUT_IDS) {
  for (const beat of timelineFor(cut, "landscape").beats) {
    const scene = SCENES[beat.scene];
    if (scene.kind === "endcard") continue;
    paced += 1;
    const bar = EDIT_ID === "B" ? barSecFor(cut) : null;
    const ceiling = bar ? STATIC_MAX_BARS * bar : STATIC_MAX_SEC;
    // A card is not holding while its type is still arriving.
    const held = beat.durationSec - riseSec(beat.scene);
    if (held <= ceiling + 1e-9) continue;

    const moves = Math.abs(Math.log(beat.push || 1)) > 0.03;
    const playing =
      beat.replicaFrom !== undefined && beat.replicaTo !== undefined
        ? Math.abs(beat.replicaTo - beat.replicaFrom)
        : 0;
    if (moves || playing > MOVING_REPLICA_SEC) continue;

    fail(
      "static",
      `cut ${cut}s beat ${beat.index} "${beat.scene}"`,
      `holds ${held.toFixed(2)}s after its type lands, over the ${ceiling.toFixed(2)}s ceiling, with the camera parked ` +
        `(push ${beat.push.toFixed(2)}) and ${playing.toFixed(2)}s of screenplay playing — push it, cut it, or let something arrive`,
    );
  }
}
if (paced === 0) fail("vacuous", "pace", "no beat was paced — this check looked at nothing");

/* ── every colour pair the film sets type in ──────────────────────────────── */

/** WCAG relative luminance of an `#rrggbb`. */
const luminance = (hex) => {
  const v = hex.replace("#", "");
  const ch = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

let pairs = 0;
for (const row of CONTRAST_PAIRS) {
  pairs += 1;
  const r = ratio(row.fg, row.bg);
  if (r + 1e-6 < row.min) {
    fail(
      "contrast",
      `${row.fg} on ${row.bg}`,
      `${r.toFixed(2)}:1, under the ${row.min}:1 this row claims — ${row.use}`,
    );
  }
}
if (pairs === 0) fail("vacuous", "CONTRAST_PAIRS", "the contrast table is empty — nothing was checked");

if (openings === 0) {
  fail("vacuous", "every cut", "no beat was examined at all — this gate looked at nothing");
}

/* ── report ───────────────────────────────────────────────────────────────── */

const summary = {
  openings,
  floor: OPENING_MIN,
  entryOpacityFloor: ENTRY_OPACITY_FLOOR,
  montagePaneFloor: MONTAGE_PANE_ENTRY_FLOOR,
  cardRuleFloor: CARD_RULE_FLOOR,
  wordFloor: WORD_FLOOR,
  captionScale: CAPTION_SCALE,
  contrastPairs: pairs,
  pacedBeats: paced,
  staticMaxSec: STATIC_MAX_SEC,
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
  `    replica/split entrances open at ${ENTRY_OPACITY_FLOOR}; the montage's panes at ${MONTAGE_PANE_ENTRY_FLOOR}; ` +
    `a card's accent rule at ${CARD_RULE_FLOOR}`,
);
console.log(
  `    a card's first word is ${((0.25 + 0.75 * easeOutExpo(BY_FRAME / FPS / WORD_RISE_SEC)) * 100).toFixed(0)} % up at frame ${BY_FRAME}; ` +
    `${pairs} colour pair(s) checked for contrast`,
);
console.log(
  `    ${paced} beat(s) paced against ${EDIT_ID === "B" ? `${STATIC_MAX_BARS} bars` : `${STATIC_MAX_SEC}s`}, measured after the type lands`,
);
console.log(
  `    the film's caption sets at ` +
    DELIVERABLES.filter((d) => d.cut === "30")
      .map((d) => {
        const L = deriveLayout(d.width, d.height);
        return `${L.u(TYPE.caption * CAPTION_SCALE)} px ${L.aspect}`;
      })
      .join(", "),
);

if (!failures.length) {
  console.log("\n  ✓ no scene opens on a blank frame, the hook is up by frame 3, every colour pair clears\n");
  process.exit(0);
}

console.log("");
for (const f of failures) {
  console.log(`  ✗ [${f.kind}] ${f.subject}`);
  console.log(`      ${f.detail}`);
}
console.log(`\n  ${failures.length} failure(s). See ${path.relative(ROOT, ROOT)}docs/decisions.md D18.\n`);
process.exit(1);
