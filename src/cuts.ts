/**
 * The four edit decision lists. **Intent lives here, in SECONDS.**
 *
 * `timeline.ts` is the only file allowed to turn one of these into frames, and
 * `verify:timeline` fails if the seconds in a cut do not sum to EXACTLY the
 * cut's length. That is the whole contract: change a beat here, and the eight
 * masters re-derive; type a frame number anywhere, and the gate goes red.
 *
 * ── `replicaFrom` / `replicaTo`: the time warp ─────────────────────────────
 *
 * A replica beat shows a WINDOW of the replica's own screenplay clock, and the
 * window does not have to be the same length as the beat. `replicaFrom: 5.5,
 * replicaTo: 9.3` inside a 1.7-second beat plays 3.8 seconds of the product in
 * 1.7 — a 2.24× speed-up — which is how the same source material reads as
 * urgent at 15 s and as unhurried at 120 s.
 *
 * The windows are **not invented**: they are the chapter boundaries of the home
 * page's own 35-second loop, declared once as `defaultReplica` in `scenes.ts`.
 * A beat that omits them inherits the scene's; a beat that names them is
 * splitting a chapter deliberately, and every such split is annotated below.
 *
 * ── The one rhythm rule that is not taste ──────────────────────────────────
 *
 * **The drawing is the money shot and it is warped least in every cut.** Typing
 * can run at 2.5× and still read, because the eye only needs to see that words
 * are appearing. A plan drawing itself out by layer is the only thing on screen
 * that nobody has seen before, and a viewer who misses it has watched an
 * interface demo. So the `draw` chapter is split at 9.3 s — the moment the
 * drafting sheet hands over to the drawing — and the two halves get different
 * rates: the sheet is compressed, the drawing is not. In the 60 and 120 cuts
 * the drawing runs SLOWER than real time.
 *
 * ── The honesty caption ────────────────────────────────────────────────────
 *
 * The replica's own caption ("Sequence shortened — a design really takes two to
 * three minutes.") sits at screenplay 8.0–12.5 s inside the draw chapter. The
 * time warp shortens it, and it must survive at **≥ 3 s of FILM time in every
 * one of the eight masters**. `timeline.ts` derives the window per cut from
 * these tables and `verify:timeline` fails below the floor; where the derived
 * window is short — today, only the 15 s cut — the film overlays the identical
 * sentence in its own caption band to make up the difference. Nothing here is
 * hand-typed, so a re-cut cannot silently drop below the floor.
 */

import type { CutId } from "./layout-core";
import type { SceneId } from "./scenes";

/**
 * One beat of an edit.
 *
 * `push` is the camera's move on the replica during the beat, as an end/start
 * scale multiplier. Omitted, the scene's own `camera` applies; `1` holds.
 */
export type Edit = {
  scene: SceneId;
  /** How long this beat is on screen, in seconds. */
  sec: number;
  /** Start of the replica window, in screenplay seconds. Omitted → the scene's. */
  replicaFrom?: number;
  /** End of the replica window, in screenplay seconds. Omitted → the scene's. */
  replicaTo?: number;
  /** Camera push over the beat, as an end/start scale multiplier. */
  push?: number;
  /** Why this beat is cut the way it is, when it is not obvious. */
  why?: string;
};

/* ── the draw chapter's two halves ────────────────────────────────────────── */

/**
 * Where the drafting sheet hands the studio over to the drawing.
 *
 * Screenplay 9.3 s: the `drawPlan` beat's own start. Named once so the four
 * EDLs cannot disagree about where the money shot begins.
 */
export const DRAW_HANDOFF_SEC = 9.3;

/* ── 15 s — What ──────────────────────────────────────────────────────────── */

/**
 * Describe a home; get a drawing; take it away. Nothing else fits.
 *
 * The fastest cut in the set, and the only one where the derived honesty window
 * falls under three seconds — so the film's own caption carries it. Peak warp
 * is 2.50× on the typing; the drawing runs at 1.12×, barely faster than real.
 */
const CUT_15: readonly Edit[] = [
  { scene: "hook", sec: 1.6 },
  {
    scene: "brief",
    sec: 2.2,
    replicaFrom: 0,
    replicaTo: 5.5,
    push: 1.04,
    why: "2.50x — the fastest thing in the film. The eye needs to see words appearing, not read them.",
  },
  {
    scene: "draw",
    sec: 1.7,
    replicaFrom: 5.5,
    replicaTo: DRAW_HANDOFF_SEC,
    push: 1.03,
    why: "2.24x over the drafting sheet only.",
  },
  {
    scene: "draw",
    sec: 3.3,
    replicaFrom: DRAW_HANDOFF_SEC,
    replicaTo: 13,
    push: 1.06,
    why: "1.12x — the money shot, the longest beat in a fifteen-second film.",
  },
  { scene: "claim-what", sec: 1.8 },
  { scene: "export", sec: 2.5, replicaFrom: 31.5, replicaTo: 35, push: 1.05 },
  { scene: "endcard", sec: 1.9 },
];

/* ── 30 s — What + Why ────────────────────────────────────────────────────── */

/**
 * Adds the edit and the receipt beat, which is the one differentiated thing the
 * film says, and closes on the price frame. The drawing now runs at 0.88× —
 * slower than the product actually draws it.
 */
const CUT_30: readonly Edit[] = [
  { scene: "hook", sec: 1.8 },
  { scene: "brief", sec: 3.0, replicaFrom: 0, replicaTo: 5.5, push: 1.04, why: "1.83x." },
  {
    scene: "draw",
    sec: 2.6,
    replicaFrom: 5.5,
    replicaTo: DRAW_HANDOFF_SEC,
    push: 1.03,
    why: "1.46x over the sheet.",
  },
  {
    scene: "draw",
    sec: 4.2,
    replicaFrom: DRAW_HANDOFF_SEC,
    replicaTo: 13,
    push: 1.06,
    why: "0.88x — the drawing is held longer than it really takes.",
  },
  { scene: "claim-what", sec: 2.0 },
  { scene: "edit", sec: 4.2, replicaFrom: 13, replicaTo: 19, push: 1.05 },
  { scene: "receipt", sec: 5.0, replicaFrom: 23.5, replicaTo: 28, push: 1.08 },
  {
    scene: "render",
    sec: 2.4,
    replicaFrom: 29.8,
    replicaTo: 31.5,
    push: 1.04,
    why: "The rendering only. The storey switch is cut — a thirty-second film cannot afford it.",
  },
  { scene: "price", sec: 2.0 },
  { scene: "endcard", sec: 2.8 },
];

/* ── 60 s — What + Why + How ──────────────────────────────────────────────── */

/**
 * All seven chapters, **one camera push per chapter**, and three kinetic cards.
 *
 * The three cards are `hook`, `claim-what` and `price` — the film's own voice,
 * full-bleed, between the chapters. The chapter verbs ("Say the change.",
 * "Tweak a number.") ride as `split` lines over the picture instead of stopping
 * it, which is why there are four more lines than there are cards.
 *
 * One push per chapter, in order: brief 1.05 · draw 1.08 · edit 1.06 ·
 * tweak 1.05 · review 1.10 · render 1.05 · export 1.06. The draw chapter's
 * first half and the storey beat hold the camera still so the chapter's single
 * push lands where the chapter's point is.
 */
const CUT_60: readonly Edit[] = [
  { scene: "hook", sec: 2.2 },
  { scene: "brief", sec: 6.0, replicaFrom: 0, replicaTo: 5.5, push: 1.05, why: "0.92x." },
  {
    scene: "draw",
    sec: 4.4,
    replicaFrom: 5.5,
    replicaTo: DRAW_HANDOFF_SEC,
    push: 1,
    why: "Camera parked — the chapter's one push belongs on the drawing, not on the sheet.",
  },
  {
    scene: "draw",
    sec: 4.6,
    replicaFrom: DRAW_HANDOFF_SEC,
    replicaTo: 13,
    push: 1.08,
    why: "0.80x — slower than the product draws it.",
  },
  { scene: "claim-what", sec: 2.2 },
  { scene: "edit", sec: 8.0, replicaFrom: 13, replicaTo: 19, push: 1.06 },
  { scene: "tweak", sec: 5.4, replicaFrom: 19, replicaTo: 23.5, push: 1.05 },
  { scene: "receipt", sec: 8.0, replicaFrom: 23.5, replicaTo: 28, push: 1.1 },
  {
    scene: "storey",
    sec: 3.2,
    replicaFrom: 28,
    replicaTo: 29.8,
    push: 1,
    why: "Parked — the render chapter's one push is on the rendering.",
  },
  { scene: "render", sec: 4.0, replicaFrom: 29.8, replicaTo: 31.5, push: 1.05 },
  { scene: "export", sec: 6.0, replicaFrom: 31.5, replicaTo: 35, push: 1.06 },
  { scene: "price", sec: 2.2 },
  { scene: "endcard", sec: 3.8 },
];

/* ── 120 s — the long form ────────────────────────────────────────────────── */

/**
 * Depth, not more scenes. Every chapter that rewards a second look is cut in
 * two — the brief at the typology pick, the edit at the send, the tweak at the
 * second parameter step, the review between the pins dropping and one opening
 * — so nothing sits still for more than eight seconds and every half gets its
 * own push.
 *
 * Then the second brief: the same seven chapters against a different plan,
 * which is the one claim a long cut can make that a short one cannot. It is
 * marked `needs` in `scenes.ts` because the second screenplay does not exist
 * yet, and `verify:timeline` prints that on every run.
 */
const CUT_120: readonly Edit[] = [
  { scene: "hook", sec: 2.2 },
  { scene: "brief", sec: 6.0, replicaFrom: 0, replicaTo: 3.0, push: 1.04, why: "The cursor and the typing." },
  { scene: "brief", sec: 5.0, replicaFrom: 3.0, replicaTo: 5.5, push: 1.06, why: "The typology and the launch control." },
  { scene: "draw", sec: 8.0, replicaFrom: 5.5, replicaTo: DRAW_HANDOFF_SEC, push: 1.03, why: "0.48x over the sheet — the phase lines are readable here." },
  { scene: "draw", sec: 8.0, replicaFrom: DRAW_HANDOFF_SEC, replicaTo: 13, push: 1.1, why: "0.46x. The money shot, twice as long as the product takes." },
  { scene: "claim-what", sec: 2.2 },
  { scene: "edit", sec: 7.0, replicaFrom: 13, replicaTo: 16.0, push: 1.05, why: "Pick the room, type the sentence." },
  { scene: "edit", sec: 7.0, replicaFrom: 16.0, replicaTo: 19, push: 1.08, why: "Send, and the plan morphs under the dashed ghost." },
  { scene: "tweak", sec: 6.0, replicaFrom: 19, replicaTo: 21.0, push: 1.04, why: "The panel opens on the knob." },
  { scene: "tweak", sec: 6.0, replicaFrom: 21.0, replicaTo: 23.5, push: 1.06, why: "The value steps and the geometry follows." },
  { scene: "receipt", sec: 7.0, replicaFrom: 23.5, replicaTo: 25.8, push: 1.06, why: "The badge, then three pins land." },
  { scene: "receipt", sec: 7.0, replicaFrom: 25.8, replicaTo: 28, push: 1.12, why: "One pin opens and is read. The film's slowest push." },
  { scene: "storey", sec: 8.0, replicaFrom: 28, replicaTo: 29.8, push: 1.05 },
  { scene: "render", sec: 8.0, replicaFrom: 29.8, replicaTo: 31.5, push: 1.05 },
  { scene: "export", sec: 8.0, replicaFrom: 31.5, replicaTo: 35, push: 1.08 },
  { scene: "second-brief", sec: 7.0, replicaFrom: 0, replicaTo: 5.5, push: 1.04, why: "Same composer, different words." },
  { scene: "second-brief", sec: 9.0, replicaFrom: 5.5, replicaTo: 13, push: 1.08, why: "Same seven chapters, a different plan drawing itself." },
  { scene: "claim-what", sec: 2.2 },
  { scene: "price", sec: 2.2 },
  { scene: "endcard", sec: 4.2 },
];

/** The four edits. `timeline.ts` checks each sums to its cut length. */
export const CUTS: Readonly<Record<CutId, readonly Edit[]>> = {
  "15": CUT_15,
  "30": CUT_30,
  "60": CUT_60,
  "120": CUT_120,
};

/* ── the honesty caption's own numbers ────────────────────────────────────── */

/**
 * The replica's own caption beat, in SCREENPLAY seconds, reduced to the window
 * where it is actually readable.
 *
 * The beat is `at: 8.0, dur: 4.5` in the replica's screenplay, and `at.ts`
 * envelopes it — fading in over the first 10% and out over the last 14%. So the
 * sentence is fully opaque from 8.0 + 0.45 to 12.5 − 0.63, and that core is
 * what the three-second floor is measured against. Measuring the envelope's
 * tails as "on screen" would be the film marking its own homework.
 *
 * ⚠ These four numbers are COPIES of the replica's beat table, which is not
 * synced yet. **WP-9: re-derive them from the synced `screenplay.ts` and delete
 * the literals.** `verify:timeline` prints them on every run so the copy cannot
 * go stale unseen.
 */
export const REPLICA_CAPTION = {
  beatAt: 8.0,
  beatDur: 4.5,
  fadeInFraction: 0.1,
  fadeOutFraction: 0.14,
} as const;

/** The readable window, derived. */
export const REPLICA_CAPTION_WINDOW = {
  from: REPLICA_CAPTION.beatAt + REPLICA_CAPTION.beatDur * REPLICA_CAPTION.fadeInFraction,
  to:
    REPLICA_CAPTION.beatAt +
    REPLICA_CAPTION.beatDur * (1 - REPLICA_CAPTION.fadeOutFraction),
} as const;

/**
 * The floor, in FILM seconds, in every one of the eight masters.
 *
 * Three seconds is the shortest a sentence of that length can be read at a
 * glance while a camera is moving past it. It is not a target — it is the
 * minimum, and `verify:timeline` treats a cut below it as a failed build.
 */
export const HONESTY_MIN_SEC = 3.0;

/**
 * What the film's own overlay runs for when it has to step in, in film seconds.
 *
 * Deliberately above the floor. A window cut to exactly 3.000 s is a window
 * that a rounding change makes non-compliant, and "compliant to three decimal
 * places" is not what the caption is for.
 */
export const HONESTY_OVERLAY_SEC = 3.4;
