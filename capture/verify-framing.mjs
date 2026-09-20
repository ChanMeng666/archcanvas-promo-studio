#!/usr/bin/env node
/**
 * verify-framing.mjs — what a shot is about has to FIT in the frame, and FILL it.
 *
 * Two failures that no other gate can see, both found by looking at contact
 * sheets and both expensive to find that way.
 *
 * **1. Cropped.** Every beat that mounts the replica names a thing it is about —
 * the drafting sheet, the building, the receipt — and `focusRectFor` is where
 * that thing lives. The camera then pushes in until the beat's `fill` is
 * satisfied, plus whatever the constraint families add: protect this, expel
 * that. Those additions are *not* bounded by the fill, and twice now an expel
 * rule intended for one frame shape blew the other one's push past the point
 * where the subject still fitted — the 9:16 drafting card came back at 142 % of
 * the frame width, cropped on both sides, in a cut whose entire job is to show a
 * plan being drawn. A green timeline and a green honesty gate said nothing,
 * because the caption they check was perfectly placed on top of the wreckage.
 *
 * So: at the settled end of every replica beat, the subject's box, projected
 * through the real push by the real `camera.js`, must be inside the frame.
 *
 * **2. Small.** The other half of the same review. A hero card is one sentence
 * that has to carry a whole frame, and set at a reading measure it reads as a
 * caption with nothing around it. `fitLines` decides the size from the longest
 * authored line, so the card's set width is arithmetic, not a guess — and this
 * asserts the arithmetic lands above the floor the art direction set.
 *
 * **3. Saving a space for something that is not there.** The other half of the
 * cropping check, and the one a master frame caught after the film had been
 * rendered. `focusRectFor` frames a beat against what the beat is ABOUT, on
 * purpose — a framing that changes because its subject arrived is a lurch. The
 * cost is that a shot framed for "the pin and its open card" holds a card-shaped
 * hole for as long as the card takes to open: at 19.5 s in the 30 s landscape
 * master the left HALF of the picture was bare dot-grid and the drawing was
 * cropped off the right edge. So at sampled frames through every beat, the
 * things actually ON SCREEN (`camera.js` § visibleSubjects) must fill enough of
 * the visible frame, and no single edge band may be empty beyond
 * {@link EMPTY_BAND_MAX}.
 *
 * All three are measured through the modules the renderer uses. A gate that
 * re-derives what it checks eventually disagrees with it.
 *
 * Usage:  node capture/verify-framing.mjs [--json]
 */

import { loadFilm } from "./lib/load-core.mjs";

const AS_JSON = process.argv.includes("--json");

const failures = [];
const fail = (kind, subject, detail) => failures.push({ kind, subject, detail });

const film = await loadFilm();
const { DELIVERABLES, deriveLayout, splitStage, FPS } = film.layout;
const { timelineFor } = film.timeline;
const { SCENES } = film.scenes;
const { shotFor, designRect, focusRectFor, pushRect, visibleSubjects, union } = film.camera;
const { linesFor } = film.copy;
const { fitLines, ADVANCE } = film.typefit;
const { TYPE } = film.tokens;

/**
 * How far past the frame a subject may reach before it counts as cropped.
 *
 * ⚠ A few per cent, not zero. A shot framed at `fill: 0.94` is *meant* to press
 * on the edges — that is what a money shot is — and the mount rounds. What this
 * catches is the other thing entirely: a subject at 120 %, 140 %, where the
 * viewer is looking at the middle of something and the film never shows them
 * what it was.
 */
const CROP_TOLERANCE = 1.04;

/** Where in a beat the push has settled. Entrances are allowed to be wide. */
const SETTLED = 0.95;

/**
 * How LOPSIDED the air may be: the gap between the empty band on one side and
 * the empty band on the other, as a fraction of the frame.
 *
 * ⚠ Asymmetry, not emptiness, and the difference is the whole check. A narrow
 * subject in a wide frame has air on both sides and is composed — the split
 * scenes' storey beat sits at 37 % left and 31 % right and looks right. What
 * reads as a mistake is all the air on ONE side, which is exactly the shape of a
 * camera holding a space for something that has not appeared: the 30 s master's
 * receipt beat opened at 52 % left and 0 % right.
 */
const LOPSIDED_MAX = 0.28;

/** How much of the visible frame the things on screen must add up to. */
const SUBJECT_MIN = 0.22;

/** How often the sweep looks inside a beat, in seconds. */
const SAMPLE_SEC = 0.25;

/* ── 1. the subject fits ──────────────────────────────────────────────────── */

let framed = 0;
const worst = [];

for (const d of DELIVERABLES) {
  const layout = deriveLayout(d.width, d.height);
  const sp = splitStage(layout);
  let cutWorst = { where: "", wRel: 0, hRel: 0 };

  for (const beat of timelineFor(d.cut, layout.aspect).beats) {
    if (beat.replicaFrom === undefined) continue;
    const scene = SCENES[beat.scene];
    const split = scene.kind === "split";
    const box = split ? sp.replica : layout.picture;
    const clipBottom = split ? sp.line.y - layout.u(10) : undefined;

    const shot = shotFor(beat, Math.round(beat.durationInFrames * SETTLED), layout, box, {
      browserFrame: layout.aspect === "landscape",
      clipBottom,
    });
    const focus = focusRectFor(
      beat.scene,
      { spec: shot.mount.spec, state: shot.state, page: shot.page, storeys: 2 },
      { from: Math.min(beat.replicaFrom, beat.replicaTo), to: Math.max(beat.replicaFrom, beat.replicaTo) },
    );
    if (focus === null) continue;

    const onScreen = pushRect(shot.push, designRect(shot.mount, focus));
    framed += 1;

    // The subject is measured against the box it is mounted into, not the whole
    // frame: a split scene gives half the stage to its line, and a subject that
    // fills the picture half is correct rather than 50 % oversized.
    const wRel = onScreen.w / (split ? sp.replica.w : layout.width);
    const hRel = onScreen.h / (split ? sp.replica.h : layout.height);
    if (wRel > cutWorst.wRel) cutWorst = { where: `${beat.index} "${beat.scene}"`, wRel, hRel };

    if (wRel > CROP_TOLERANCE || hRel > CROP_TOLERANCE) {
      fail(
        "cropped",
        `${d.id} beat ${beat.index} "${beat.scene}"`,
        `the shot's subject lands at ${(wRel * 100).toFixed(0)} % x ${(hRel * 100).toFixed(0)} % of the frame ` +
          `at fill ${beat.fill.toFixed(2)} — over the ${(CROP_TOLERANCE * 100).toFixed(0)} % ceiling, so the ` +
          "viewer never sees the thing the beat is about",
      );
    }
  }
  worst.push(`${d.id.padEnd(26)} widest subject ${(cutWorst.wRel * 100).toFixed(0)} % at beat ${cutWorst.where}`);
}

if (framed === 0) fail("vacuous", "framing", "no replica beat was measured — the sweep found nothing to check");

/* ── 3. nothing is framing a space for something that is not there ────────── */

let sampled = 0;
const emptiest = [];

for (const d of DELIVERABLES) {
  const layout = deriveLayout(d.width, d.height);
  const sp = splitStage(layout);
  let worstHere = { band: 0, where: "", side: "" };

  for (const beat of timelineFor(d.cut, layout.aspect).beats) {
    if (beat.replicaFrom === undefined) continue;
    const scene = SCENES[beat.scene];
    const split = scene.kind === "split";
    const box = split ? sp.replica : layout.picture;
    const clipBottom = split ? sp.line.y - layout.u(10) : undefined;
    const viewH = clipBottom ?? layout.height;

    const step = Math.max(1, Math.round(SAMPLE_SEC * FPS));
    // The entrance is allowed to be wide, so the sweep starts after it.
    for (let f = Math.round(0.35 * FPS); f < beat.durationInFrames; f += step) {
      const shot = shotFor(beat, f, layout, box, {
        browserFrame: layout.aspect === "landscape",
        clipBottom,
      });
      const ctx = { spec: shot.mount.spec, state: shot.state, page: shot.page, storeys: 2 };
      // The montage draws four other plans on its own ground and has no layout
      // map to ask. `focusRectFor` says so by returning null — the same answer
      // the cropping check above reads.
      if (focusRectFor(beat.scene, ctx) === null) break;
      /*
       * ⚠ A MOVING camera is exempt, and the exemption is derived rather than
       * declared: the focus rect is asked for at this frame and three frames
       * later, and if it has moved the shot is mid-travel. A camera easing from
       * "the pins landing" to "the pin and its card" leans by construction while
       * it moves — that is what a move looks like — and both ENDS of the move are
       * judged like any other frame.
       *
       * Deriving it this way is what keeps it honest: delete the travel and the
       * rect stops changing, the exemption stops applying, and the thirty frames
       * this round was opened by go red again.
       */
      const lookahead = shotFor(beat, Math.min(f + 3, beat.durationInFrames - 1), layout, box, {
        browserFrame: layout.aspect === "landscape",
        clipBottom,
      });
      const span = {
        from: Math.min(beat.replicaFrom, beat.replicaTo),
        to: Math.max(beat.replicaFrom, beat.replicaTo),
      };
      const r0 = focusRectFor(beat.scene, ctx, span, shot.t);
      const r1 = focusRectFor(
        beat.scene,
        { spec: lookahead.mount.spec, state: lookahead.state, page: lookahead.page, storeys: 2 },
        span,
        lookahead.t,
      );
      const moving =
        r0 !== null &&
        r1 !== null &&
        Math.max(Math.abs(r1.x - r0.x), Math.abs(r1.y - r0.y), Math.abs(r1.w - r0.w), Math.abs(r1.h - r0.h)) >
          Math.max(r0.w, r0.h) * 0.004;

      const subjects = visibleSubjects(ctx)
        .map((r) => pushRect(shot.push, designRect(shot.mount, r)))
        .map((r) => ({
          x: Math.max(0, r.x),
          y: Math.max(0, r.y),
          w: Math.min(layout.width, r.x + r.w) - Math.max(0, r.x),
          h: Math.min(viewH, r.y + r.h) - Math.max(0, r.y),
        }))
        .filter((r) => r.w > 0 && r.h > 0);
      if (subjects.length === 0) continue;
      sampled += 1;

      const u = subjects.reduce((acc, r) => union(acc, r));
      const left = Math.max(0, u.x) / layout.width;
      const right = Math.max(0, layout.width - (u.x + u.w)) / layout.width;
      const top = Math.max(0, u.y) / viewH;
      const bottom = Math.max(0, viewH - (u.y + u.h)) / viewH;
      const axes = [
        { axis: "left/right", v: Math.abs(left - right), a: left, b: right, names: ["left", "right"] },
        { axis: "top/bottom", v: Math.abs(top - bottom), a: top, b: bottom, names: ["top", "bottom"] },
      ];
      const worst = axes.reduce((x, y) => (y.v > x.v ? y : x));
      if (worst.v > worstHere.band) {
        worstHere = { band: worst.v, where: `${beat.index} "${beat.scene}" @${(f / FPS).toFixed(1)}s`, side: worst.axis };
      }

      if (!moving && worst.v > LOPSIDED_MAX) {
        const [n0, n1] = worst.names;
        fail(
          "empty",
          `${d.id} beat ${beat.index} "${beat.scene}" at ${(f / FPS).toFixed(2)}s`,
          `${(worst.a * 100).toFixed(0)} % of the frame is empty on the ${n0} against ` +
            `${(worst.b * 100).toFixed(0)} % on the ${n1} — a ${(worst.v * 100).toFixed(0)} % lean, over the ` +
            `${(LOPSIDED_MAX * 100).toFixed(0)} % ceiling. The camera is saving a space for something that has ` +
            "not appeared",
        );
      }
      const covered = (u.w * u.h) / (layout.width * viewH);
      if (!moving && covered < SUBJECT_MIN) {
        fail(
          "small",
          `${d.id} beat ${beat.index} "${beat.scene}" at ${(f / FPS).toFixed(2)}s`,
          `everything on screen adds up to ${(covered * 100).toFixed(0)} % of the visible frame, under the ` +
            `${(SUBJECT_MIN * 100).toFixed(0)} % floor`,
        );
      }
    }
  }
  emptiest.push(
    `${d.id.padEnd(26)} worst lean ${(worstHere.band * 100).toFixed(0).padStart(3)} % ${worstHere.side.padEnd(11)} at beat ${worstHere.where}`,
  );
}

if (sampled === 0) fail("vacuous", "emptiness", "no frame was sampled for empty space");

/* ── 2. the hero cards are hero-sized ─────────────────────────────────────── */

/**
 * How much of the frame a card's longest line must cover once it has risen.
 *
 * Landscape is against the full frame width; portrait is against the SAFE
 * width, because a 9:16 frame's side margins are not negotiable and measuring
 * against the full width would just be asking for type under the safe line.
 */
const HERO_FLOOR = { landscape: 0.7, portrait: 0.84 };

let cards = 0;
const heroes = [];

for (const d of DELIVERABLES) {
  const layout = deriveLayout(d.width, d.height);
  const basis = layout.aspect === "landscape" ? layout.width : layout.stage.w;
  const seen = new Set();

  for (const beat of timelineFor(d.cut, layout.aspect).beats) {
    const scene = SCENES[beat.scene];
    if (scene.kind !== "card" || !scene.copy || seen.has(beat.scene)) continue;
    seen.add(beat.scene);

    const lines = linesFor(scene.copy.copy, layout.aspect);
    const size = fitLines(lines, {
      preferred: TYPE.hero,
      min: TYPE.body,
      maxWidth: (layout.stage.w * 0.97) / layout.scale,
      weight: "bold",
    });
    const longest = lines.reduce((n, l) => Math.max(n, l.length), 1);
    const setWidth = layout.u(size) * longest * ADVANCE.bold;
    const rel = setWidth / basis;
    cards += 1;
    if (d.cut === "30") heroes.push(`${beat.scene} ${(rel * 100).toFixed(0)} % ${layout.aspect}`);

    if (rel + 1e-9 < HERO_FLOOR[layout.aspect]) {
      fail(
        "small",
        `${d.id} "${beat.scene}"`,
        `the card sets at ${(rel * 100).toFixed(0)} % of the ` +
          `${layout.aspect === "landscape" ? "frame" : "safe"} width, under the ` +
          `${(HERO_FLOOR[layout.aspect] * 100).toFixed(0)} % floor — a sentence meant to carry the frame ` +
          "reading as a caption in an empty one",
      );
    }
  }
}

if (cards === 0) fail("vacuous", "hero cards", "no card was measured");

/* ── report ───────────────────────────────────────────────────────────────── */

if (AS_JSON) {
  console.log(
    JSON.stringify(
      { ok: failures.length === 0, framed, cards, sampled, cropTolerance: CROP_TOLERANCE, heroFloor: HERO_FLOOR, lopsidedMax: LOPSIDED_MAX, failures },
      null,
      2,
    ),
  );
} else {
  console.log("\n  verify-framing");
  console.log(`    ${framed} replica beat(s) measured at ${SETTLED * 100} % through the beat, ceiling ${CROP_TOLERANCE}`);
  for (const w of worst) console.log(`      ${w}`);
  console.log(`    ${cards} card(s) measured; the 30s cut sets ${heroes.join(", ")}`);
  console.log(`    ${sampled} frame(s) sampled every ${SAMPLE_SEC}s, lean ceiling ${(LOPSIDED_MAX * 100).toFixed(0)} %`);
  for (const e of emptiest) console.log(`      ${e}`);
  if (failures.length === 0) {
    console.log("\n  ✓ every shot's subject fits its frame, and every card fills one\n");
  } else {
    console.log("");
    for (const f of failures) console.log(`  ✗ [${f.kind}] ${f.subject}\n      ${f.detail}`);
    console.log("");
  }
}

process.exit(failures.length === 0 ? 0 : 1);
