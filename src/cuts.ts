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
 * A replica scene shows a WINDOW of the replica's own screenplay clock, and the
 * window does not have to be the same length as the scene. `replicaFrom: 5.5,
 * replicaTo: 13` inside a 4.5-second scene plays 7.5 seconds of the product in
 * 4.5 — a 1.67x speed-up — which is how the same source material reads as
 * urgent at 15 s and as unhurried at 120 s.
 *
 * The windows below are **not invented**: they are the chapter boundaries of
 * the home page's own 35-second loop (the plan's chapter table), so the film
 * and the landing page are showing literally the same seconds of the same
 * screenplay. A card scene has no window, because there is no replica on
 * screen.
 *
 * ⚠ THESE ARE PLACEHOLDER EDLs. The beat lengths are structurally correct — the
 * sums are exact and the chapter windows are real — but the rhythm has not been
 * cut against music yet (WP-8) and no scene component exists yet (WP-7 and
 * WP-9). Nothing here has been watched.
 */

import type { CutId } from "./layout-core";
import type { SceneId } from "./scenes";

/**
 * One beat of an edit.
 *
 * `push` is the camera's move on the replica during the beat: how much closer
 * it ends than it starts, as a multiplier. `1` holds. It is deliberately a
 * single number rather than a rect — this film cuts, where the earlier one
 * moved, and a cut-based film that also flies the camera around reads as two
 * ideas fighting.
 */
export type Edit = {
  scene: SceneId;
  /** How long this beat is on screen, in seconds. */
  sec: number;
  /** Start of the replica window, in screenplay seconds. Omitted on a card. */
  replicaFrom?: number;
  /** End of the replica window, in screenplay seconds. Omitted on a card. */
  replicaTo?: number;
  /** Camera push over the beat, as an end/start scale multiplier. */
  push?: number;
};

/* ── 15 s — What ──────────────────────────────────────────────────────────── */

/** Describe a home; get a drawing. Nothing else fits in fifteen seconds. */
const CUT_15: readonly Edit[] = [
  { scene: "hook", sec: 2.5 },
  { scene: "brief", sec: 3, replicaFrom: 0, replicaTo: 5.5, push: 1.04 },
  { scene: "draw", sec: 4.5, replicaFrom: 5.5, replicaTo: 13, push: 1.06 },
  { scene: "claim-what", sec: 2 },
  { scene: "export", sec: 2, replicaFrom: 31.5, replicaTo: 35 },
  { scene: "endcard", sec: 1 },
];

/* ── 30 s — What + Why ────────────────────────────────────────────────────── */

/** Adds the receipt beat, which is the one differentiated thing the film says. */
const CUT_30: readonly Edit[] = [
  { scene: "hook", sec: 2.5 },
  { scene: "brief", sec: 3.5, replicaFrom: 0, replicaTo: 5.5, push: 1.04 },
  { scene: "draw", sec: 6, replicaFrom: 5.5, replicaTo: 13, push: 1.06 },
  { scene: "claim-what", sec: 2.5 },
  { scene: "edit", sec: 4, replicaFrom: 13, replicaTo: 19, push: 1.05 },
  { scene: "receipt", sec: 4.5, replicaFrom: 23.5, replicaTo: 28, push: 1.08 },
  { scene: "render", sec: 3, replicaFrom: 28, replicaTo: 31.5 },
  { scene: "price", sec: 2.5 },
  { scene: "endcard", sec: 1.5 },
];

/* ── 60 s — What + Why + How ──────────────────────────────────────────────── */

/** All seven chapters, one push per chapter, three kinetic cards. */
const CUT_60: readonly Edit[] = [
  { scene: "hook", sec: 3 },
  { scene: "brief", sec: 5, replicaFrom: 0, replicaTo: 5.5, push: 1.05 },
  { scene: "draw", sec: 9, replicaFrom: 5.5, replicaTo: 13, push: 1.08 },
  { scene: "claim-what", sec: 3 },
  { scene: "edit", sec: 7, replicaFrom: 13, replicaTo: 19, push: 1.06 },
  { scene: "tweak", sec: 6, replicaFrom: 19, replicaTo: 23.5, push: 1.05 },
  { scene: "receipt", sec: 7, replicaFrom: 23.5, replicaTo: 28, push: 1.1 },
  { scene: "render", sec: 6, replicaFrom: 28, replicaTo: 31.5, push: 1.04 },
  { scene: "export", sec: 5, replicaFrom: 31.5, replicaTo: 35, push: 1.06 },
  { scene: "price", sec: 4 },
  { scene: "endcard", sec: 5 },
];

/* ── 120 s — the long form ────────────────────────────────────────────────── */

/**
 * Deeper on tweak, storeys and the rendering, then a second brief. The repeat
 * of `brief` / `draw` / `claim-what` near the end is the "same process,
 * different brief" montage — a different plan, the same seven chapters, which
 * is the one claim a long cut can make that a short one cannot.
 */
const CUT_120: readonly Edit[] = [
  { scene: "hook", sec: 4 },
  { scene: "brief", sec: 8, replicaFrom: 0, replicaTo: 5.5, push: 1.06 },
  { scene: "draw", sec: 14, replicaFrom: 5.5, replicaTo: 13, push: 1.1 },
  { scene: "claim-what", sec: 4 },
  { scene: "edit", sec: 12, replicaFrom: 13, replicaTo: 19, push: 1.08 },
  { scene: "tweak", sec: 11, replicaFrom: 19, replicaTo: 23.5, push: 1.06 },
  { scene: "receipt", sec: 12, replicaFrom: 23.5, replicaTo: 28, push: 1.12 },
  { scene: "render", sec: 12, replicaFrom: 28, replicaTo: 31.5, push: 1.05 },
  { scene: "export", sec: 9, replicaFrom: 31.5, replicaTo: 35, push: 1.08 },
  { scene: "brief", sec: 8, replicaFrom: 0, replicaTo: 5.5, push: 1.04 },
  { scene: "draw", sec: 12, replicaFrom: 5.5, replicaTo: 13, push: 1.08 },
  { scene: "claim-what", sec: 4 },
  { scene: "price", sec: 5 },
  { scene: "endcard", sec: 5 },
];

/** The four edits. `timeline.ts` checks each sums to its cut length. */
export const CUTS: Readonly<Record<CutId, readonly Edit[]>> = {
  "15": CUT_15,
  "30": CUT_30,
  "60": CUT_60,
  "120": CUT_120,
};
