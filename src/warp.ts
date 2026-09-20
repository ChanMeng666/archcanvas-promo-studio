/**
 * warp.ts — film time → screenplay time, in ONE place.
 *
 * ── Why this is not a multiplication any more ──────────────────────────────
 *
 * A replica beat plays a window of the product's own 35-second screenplay, and
 * until now it played it at a constant rate: `from + (to - from) * p`. That is
 * right for every beat except the one the film is built around.
 *
 * The drawing arrives in five overlapping bands — shell, openings, furniture,
 * dimensions, text (`replica/at.ts` § BAND_WINDOWS) — and in edit B each band is
 * supposed to START on a downbeat. At a constant rate they start wherever the
 * arithmetic puts them, which in the 30 s cut is 0.4 s off the bar on the first
 * band and drifting after that. So the rate inside the draw beat is PIECEWISE:
 * the film time of each band's first stroke is pinned to a measured downbeat,
 * and the rate between pins is whatever it has to be.
 *
 * ── The three properties that make it safe ─────────────────────────────────
 *
 * **Monotonic.** Screenplay time never runs backwards; a knot that would not
 * increase is dropped rather than accepted, because a cursor that jumps back is
 * worse than a band that misses its bar.
 *
 * **Continuous.** The map is a straight line between knots and the knots are
 * shared, so there is no step at a join — the typing and the cursor do not
 * jitter where the rate changes.
 *
 * **Derived.** The pins are the bed's OWN measured downbeats, chosen as the
 * nearest to where each band would have started anyway. Nothing is typed: a
 * different take moves the pins, and a different edit moves which downbeats are
 * inside the beat at all.
 *
 * ⚠ Edit A does NOT get this. A is rendered and approved, and its resolved
 * picture is locked to the frame — a warp that moved a stroke by two frames
 * would be a new film wearing A's name.
 */

import { BAND_WINDOWS_FOR_WARP, DRAW_PLAN_BEAT } from "./film-demo";
import { FPS, type CutId } from "./layout-core";

/** A pinned pair: this film second shows that screenplay second. */
export type Knot = { readonly film: number; readonly screenplay: number };

/**
 * The knots for one beat, or none when the beat is not a drawing beat.
 *
 * `beatFromSec`/`beatToSec` are the beat's film span; `from`/`to` its screenplay
 * window; `downbeats` the bed's measured list for this cut.
 */
export const drawKnots = (
  beatFromSec: number,
  beatToSec: number,
  from: number,
  to: number,
  downbeats: readonly number[],
): readonly Knot[] => {
  const beat = DRAW_PLAN_BEAT;
  if (!beat || downbeats.length === 0) return [];
  const span = beatToSec - beatFromSec;
  const window = to - from;
  if (!(span > 0) || !(window > 0)) return [];

  // The beat has to actually contain the drawing, not merely touch it.
  const drawFrom = Math.max(from, beat.at);
  const drawTo = Math.min(to, beat.at + beat.dur);
  if (!(drawTo - drawFrom > 0.05)) return [];

  const knots: Knot[] = [{ film: beatFromSec, screenplay: from }];
  for (const [bandStart] of BAND_WINDOWS_FOR_WARP) {
    const screenplay = beat.at + beat.dur * bandStart;
    if (screenplay <= from + 1e-6 || screenplay >= to - 1e-6) continue;
    // Where a constant rate would have put it, then the nearest measured bar.
    const linearFilm = beatFromSec + ((screenplay - from) / window) * span;
    const d = downbeats.reduce(
      (best, x) => (Math.abs(x - linearFilm) < Math.abs(best - linearFilm) ? x : best),
      downbeats[0],
    );
    if (d <= beatFromSec + 1e-6 || d >= beatToSec - 1e-6) continue;
    const last = knots[knots.length - 1];
    // Strictly increasing in BOTH axes, or it is not a warp, it is a rewind.
    if (d <= last.film + 1 / FPS || screenplay <= last.screenplay + 1e-6) continue;
    knots.push({ film: d, screenplay });
  }
  knots.push({ film: beatToSec, screenplay: to });
  return knots.length > 2 ? knots : [];
};

/** Read a piecewise-linear map at one film second. */
export const atFilmSec = (knots: readonly Knot[], filmSec: number): number => {
  if (knots.length === 0) return Number.NaN;
  if (filmSec <= knots[0].film) return knots[0].screenplay;
  for (let i = 1; i < knots.length; i += 1) {
    const a = knots[i - 1];
    const b = knots[i];
    if (filmSec <= b.film) {
      const span = b.film - a.film;
      const p = span > 0 ? (filmSec - a.film) / span : 1;
      return a.screenplay + (b.screenplay - a.screenplay) * p;
    }
  }
  return knots[knots.length - 1].screenplay;
};

/**
 * The screenplay second a beat shows at progress `p`.
 *
 * The one entry point. `camera.ts` draws the picture from it and `cues.ts`
 * places the sound from it, and they must not disagree by so much as a frame —
 * a tick that lands where the stroke isn't is worse than no tick.
 */
export const replicaSecondAt = (
  p: number,
  beatFromSec: number,
  beatToSec: number,
  from: number,
  to: number,
  knots: readonly Knot[],
): number => {
  if (knots.length < 2) return from + (to - from) * p;
  return atFilmSec(knots, beatFromSec + (beatToSec - beatFromSec) * p);
};

/** Cache key for a beat's knots — the beat's own numbers, nothing else. */
export const knotKey = (cut: CutId, beatFromSec: number, from: number, to: number): string =>
  `${cut}:${beatFromSec.toFixed(4)}:${from}:${to}`;
