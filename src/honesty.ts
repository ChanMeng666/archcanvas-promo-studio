/**
 * The film's one mandatory sentence, and where it is derived from.
 *
 * **React-free.** `capture/lib/load-core.mjs` bundles it, so the gates work on
 * the real numbers rather than on a copy of them.
 *
 * A real design takes two to three minutes. The replica compresses it to
 * seconds, and time compression read as a speed promise is a claim nobody made.
 * That is why the caption exists, why it is on screen in all eight masters, and
 * why the floor is three seconds of FILM time rather than of screenplay time.
 *
 * ── What changed here, and why it matters ──────────────────────────────────
 *
 * The scaffold carried the caption beat's four numbers as LITERALS copied out of
 * a screenplay that had not been synced yet, with a note saying to delete them
 * once it was. This is that deletion. The beat is now found in the SYNCED
 * screenplay by its action kind, and the envelope fractions are the ones `at.ts`
 * actually applies to a `caption` beat. Move the beat upstream and the floor
 * moves with it; nothing here has to be remembered.
 *
 * The one thing still stated twice is the SENTENCE, and deliberately:
 * `copy.ts` holds it as a string literal because that is what makes it visible
 * to `verify:copy`'s harvest and to the clearance table. Replacing the literal
 * with an import would take the film's most load-bearing sentence out of the
 * gate that checks sentences. So it stays a literal, and {@link captionDrift}
 * is what stops the two copies parting company.
 */

import { HONESTY_CAPTION_TEXT } from "./copy";
import { FIXTURE_DEMO, buildScreenplay } from "./replica/screenplay";

/**
 * The caption beat, out of the synced screenplay.
 *
 * Built from the FIXTURE demo rather than the film's own: the beat's `at` and
 * `dur` do not depend on a word of the demo, and building it from the fixture
 * keeps this module free of the baked payloads — which is what keeps the gate's
 * bundle small enough to load in a fraction of a second.
 */
const SP = buildScreenplay(FIXTURE_DEMO);
const BEAT = SP.beats.find((b) => b.action.k === "caption");

/** The replica's own caption sentence, verbatim, as the screenplay carries it. */
export const REPLICA_HONESTY_TEXT: string =
  BEAT && BEAT.action.k === "caption" ? BEAT.action.text : "";

/** The beat, in screenplay seconds. */
export const REPLICA_CAPTION = {
  beatAt: BEAT?.at ?? 0,
  beatDur: BEAT?.dur ?? 0,
  /** `at.ts` envelopes a caption beat with `envelope(p, 0.1, 0.14)`. */
  fadeInFraction: 0.1,
  fadeOutFraction: 0.14,
} as const;

/* ── the screenplay's other numbers the film has to agree with ───────────── */

/**
 * Where the drafting sheet hands the studio over to the drawing, in screenplay
 * seconds — the `drawPlan` beat's own `at`, read out of the synced screenplay.
 *
 * ⚠ It was a literal `9.3` in `cuts.ts`, and the replica's follow-up is exactly
 * the case that literal was waiting for: the drafting beat grew from 3.8 s to
 * 4.3 s so that the sheet is STILL UP when the drawing starts underneath it,
 * rather than cutting away from it. The hand-over second did not move, but
 * nothing in this repo would have noticed if it had — all four EDLs split the
 * draw chapter on that one number.
 */
const drawBeat = SP.beats.find((b) => b.action.k === "drawPlan");
export const DRAW_HANDOFF_SEC: number = drawBeat?.at ?? 9.3;

/**
 * When the drafting sheet is on screen, in screenplay seconds.
 *
 * The camera reads this per BEAT: the sheet is the subject while it is up, and
 * the drawing is the subject once it is not, and a framing that changed halfway
 * through a beat because a card faded would be the lurch `camera.ts` already
 * refuses elsewhere.
 */
const draftingBeat = SP.beats.find((b) => b.action.k === "drafting");
export const DRAFTING_SPAN = {
  from: draftingBeat?.at ?? 0,
  to: (draftingBeat?.at ?? 0) + (draftingBeat?.dur ?? 0),
} as const;

/**
 * Where the replica's own loop fade begins, in screenplay seconds.
 *
 * ⚠ The 35 s screenplay ends on a fade to nothing, because it LOOPS on the
 * landing page. A film does not loop — it cuts to the end card — so an export
 * beat whose window runs to 35 spends its last half-second watching the product
 * dissolve, and the contact sheet showed exactly that: a near-empty frame
 * immediately before the end card in the 15 s and 60 s cuts. The EDLs end the
 * export chapter here instead.
 */
const loopBeat = SP.beats.find((b) => b.action.k === "loopFade");
export const LOOP_FADE_SEC: number = loopBeat?.at ?? SP.durationSec;

/**
 * The window in which the sentence is FULLY OPAQUE, in screenplay seconds.
 *
 * Measuring the envelope's tails as "on screen" would be the film marking its
 * own homework, so the floor is measured against the core.
 */
export const REPLICA_CAPTION_WINDOW = {
  from: REPLICA_CAPTION.beatAt + REPLICA_CAPTION.beatDur * REPLICA_CAPTION.fadeInFraction,
  to: REPLICA_CAPTION.beatAt + REPLICA_CAPTION.beatDur * (1 - REPLICA_CAPTION.fadeOutFraction),
} as const;

/**
 * Why the two copies of the sentence disagree, or `null`.
 *
 * `verify:honesty` fails on a non-null answer. The product changing its own
 * caption must turn a gate red, not leave the film quietly overlaying last
 * month's wording under this month's picture.
 */
export const captionDrift = (): string | null => {
  if (!BEAT) return "the synced screenplay has no `caption` beat at all — the replica shows no honesty caption";
  if (REPLICA_HONESTY_TEXT !== HONESTY_CAPTION_TEXT) {
    return (
      "the film's own caption and the replica's have parted company:\n" +
      `      film    ${JSON.stringify(HONESTY_CAPTION_TEXT)}\n` +
      `      replica ${JSON.stringify(REPLICA_HONESTY_TEXT)}`
    );
  }
  if (!(REPLICA_CAPTION.beatDur > 0)) return "the caption beat has no duration";
  return null;
};
