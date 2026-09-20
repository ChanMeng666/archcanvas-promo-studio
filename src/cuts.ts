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

import { EDITS } from "./edits";
import type { CutId } from "./layout-core";
import type { SceneId } from "./scenes";
import { EDIT_ID, type EditId } from "./version";

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
  /**
   * How much of the frame this beat's subject fills, 0..1. Omitted, the scene's
   * own `camera.fill` applies; `1` is the wide shot.
   */
  fill?: number;
  /** Why this beat is cut the way it is, when it is not obvious. */
  why?: string;
};

/* ── the draw chapter's two halves ────────────────────────────────────────── */

/**
 * Where the drafting sheet hands the studio over to the drawing.
 *
 * The `drawPlan` beat's own `at`, DERIVED from the synced screenplay — it was a
 * literal `9.3` until the replica's follow-up moved the drafting beat around it
 * (3.8 s to 4.3 s, so the sheet is still up when the first strokes appear under
 * it). The second did not move that time. Nothing here would have noticed if it
 * had: all four EDLs split the draw chapter on this one number.
 */
export { DRAW_HANDOFF_SEC } from "./honesty";

/**
 * Where the export chapter ends.
 *
 * NOT 35. The screenplay's last beat is a fade to nothing, because the landing
 * page LOOPS; a film cuts to its end card instead, and a window that ran to 35
 * spent its last half-second watching the product dissolve. Derived from the
 * `loopFade` beat, so a screenplay that moves it moves this.
 */
export { LOOP_FADE_SEC } from "./honesty";


/**
 * The active version's edit.
 *
 * ⚠ This used to BE the table. It is now a lookup, because a version of the
 * film is `{music, edit, sfxSet}` and the second take wanted a different cut
 * rather than the same cut over different music. `src/version.ts` resolves which
 * one; `FILM_VERSION` in the environment overrides it, which is how both
 * versions render without editing code.
 */
export const CUTS: Readonly<Record<CutId, readonly Edit[]>> = EDITS[EDIT_ID];

/** Any edit, for the gates that check every version rather than the active one. */
export const cutsForEdit = (edit: EditId): Readonly<Record<CutId, readonly Edit[]>> => EDITS[edit] ?? EDITS.A;

/* ── the honesty caption's own numbers ────────────────────────────────────── */

/**
 * ⚠ These were four literals copied out of a screenplay that had not been synced
 * yet. They are now DERIVED from the synced one — `honesty.ts` finds the caption
 * beat by its action kind and reads the envelope `at.ts` actually applies. Move
 * the beat upstream and every cut's floor moves with it.
 */
export { REPLICA_CAPTION, REPLICA_CAPTION_WINDOW } from "./honesty";

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
