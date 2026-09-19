/**
 * Easing, and the two clamps everything else in here is built on.
 *
 * Pure arithmetic only — see the house rules in `types.ts`.
 */

import type { EaseName } from "./types";

/** Clamp to 0..1, treating a non-finite input as 0 rather than propagating NaN. */
export function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

export function lerp(a: number, b: number, p: number): number {
  return a + (b - a) * p;
}

/**
 * `p` mapped onto a sub-window of 0..1, clamped at both ends.
 *
 * `slice(0.4, 0.6, p)` is "the middle fifth of this beat, as its own 0..1".
 * A zero-width window degrades to a step rather than dividing by zero.
 */
export function slice(from: number, to: number, p: number): number {
  const span = to - from;
  if (!Number.isFinite(span) || span <= 0) return p >= to ? 1 : 0;
  return clamp01((p - from) / span);
}

export function easeOutCubic(p: number): number {
  const x = clamp01(p);
  return 1 - Math.pow(1 - x, 3);
}

export function easeOutQuad(p: number): number {
  const x = clamp01(p);
  return 1 - (1 - x) * (1 - x);
}

export function easeInOutCubic(p: number): number {
  const x = clamp01(p);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function applyEase(name: EaseName, p: number): number {
  switch (name) {
    case "outCubic":
      return easeOutCubic(p);
    case "outQuad":
      return easeOutQuad(p);
    case "inOutCubic":
      return easeInOutCubic(p);
    case "linear":
      return clamp01(p);
  }
}

/**
 * A fade envelope: in over `fadeIn`, hold, out over `fadeOut`.
 *
 * Used by the caption, the toast and the loop fade, all of which are "appear,
 * stay long enough to be read, leave".
 */
export function envelope(p: number, fadeIn: number, fadeOut: number): number {
  const x = clamp01(p);
  const up = fadeIn > 0 ? clamp01(x / fadeIn) : 1;
  const down = fadeOut > 0 ? clamp01((1 - x) / fadeOut) : 1;
  return Math.min(up, down);
}

/**
 * A deterministic 32-bit hash of an integer, seeded.
 *
 * This is what stands in for `Math.random` everywhere in the replica: typing
 * rhythm, per-node draw stagger. Same input, same output, in the browser and in
 * the renderer — which is the whole point, since a film frame rendered twice
 * has to be the same frame.
 *
 * (A standard integer avalanche — Thomas Wang's 32-bit mix.)
 */
export function hash32(i: number, seed: number): number {
  let x = (i | 0) ^ ((seed | 0) * 0x9e3779b1);
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x = x ^ (x >>> 16);
  return x >>> 0;
}

/** The same hash, as a fraction in [0, 1). */
export function hashUnit(i: number, seed: number): number {
  return hash32(i, seed) / 0x100000000;
}
