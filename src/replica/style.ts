/**
 * Design units → CSS.
 *
 * Every size in the replica is a multiple of `--u`, the px-per-design-unit the
 * root sets (`replica.css`). These helpers are the only place that `calc()` is
 * written, so a component says `u(12)` and never `"calc(var(--u) * 12)"` twelve
 * times with one of them mistyped.
 *
 * Pure string arithmetic — no clock, no measurement, no DOM.
 */

import type { CSSProperties } from "react";
import type { Rect } from "./layout";

/** `n` design units, as a CSS length. */
export function u(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return `calc(var(--u) * ${round(v)})`;
}

/** Absolute placement from a design-space rect. */
export function box(r: Rect, extra?: CSSProperties): CSSProperties {
  return {
    position: "absolute",
    left: u(r.x),
    top: u(r.y),
    width: u(r.w),
    height: u(r.h),
    ...extra,
  };
}

/** Absolute placement with the height left to the content. */
export function boxAuto(r: Rect, extra?: CSSProperties): CSSProperties {
  return {
    position: "absolute",
    left: u(r.x),
    top: u(r.y),
    width: u(r.w),
    ...extra,
  };
}

/** Type: size and line height together, so a font size is never set alone. */
export function type(size: number, leading = 1.4, weight?: number): CSSProperties {
  return {
    fontSize: u(size),
    lineHeight: String(leading),
    ...(weight === undefined ? {} : { fontWeight: weight }),
  };
}

/**
 * A drop shadow measured in DESIGN UNITS.
 *
 * A shadow written in pixels is the same defect as a radius written in pixels:
 * `0 10px 28px` is a soft float in a 1600 px band and a black smear under a
 * 180 px thumbnail. Offsets scale with the box; the alpha does not.
 */
export function shadow(y: number, blur: number, spread: number, alpha: number): string {
  return `0 ${u(y)} ${u(blur)} ${u(spread)} rgb(0 0 0 / ${alpha})`;
}

/** Six decimal places is plenty for a CSS length and keeps the markup diffable. */
export function round(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1e4) / 1e4;
}

/** Clamp to 0..1 without importing the easing module's semantics. */
export function pct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
