/**
 * How big a line of type may be set, without measuring it.
 *
 * **Measuring is the correct answer and it is not available here.** A real fit
 * needs `document.fonts.ready` and a layout pass, held open with `delayRender`;
 * an effect that runs before the webfonts land measures FALLBACK metrics, and
 * the fallback layout can be *shorter* — an overflow guard in a sibling film
 * once reported a comfortable fit on a frame overflowing by 507 px. So a
 * measured fit that does not wait is worse than no fit at all.
 *
 * What this does instead is bound the size from the character count with a
 * per-weight advance estimate, which cannot overflow in the direction that
 * matters as long as the estimate is generous. The estimates below were checked
 * against rendered stills at both frame shapes — that is the only reason they
 * are trusted, and a new weight needs the same check, not a guess.
 *
 * Authored line breaks stay authored: this only picks a SIZE. The lines
 * themselves are declared per aspect in `copy.ts` and rendered `nowrap`, so a
 * bad break shows up as an overflow rather than as a silent reflow.
 */

/**
 * Average advance width as a fraction of the font size, per weight, for Space
 * Grotesk over ordinary sentence case. Bold is wider per glyph; the display
 * tracking in `tokens.ts` is negative, which is already folded in.
 */
export const ADVANCE = {
  bold: 0.545,
  medium: 0.525,
  regular: 0.515,
} as const;

export type Advance = keyof typeof ADVANCE;

export interface FitOptions {
  /** The size the line wants, in layout units. */
  preferred: number;
  /** The smallest it may be set before the line stops carrying the frame. */
  min: number;
  /** How wide the block may run, in layout units. */
  maxWidth: number;
  weight?: Advance;
}

/**
 * The largest size at which the longest authored line still fits `maxWidth`.
 *
 * Never larger than `preferred` and never smaller than `min`: a line that
 * cannot fit at `min` is a line whose authored breaks are wrong, and the right
 * place to fix that is `copy.ts`, not here. `verify:copy` cannot see it, so the
 * stills are what catch it — which is why the still pass is part of the gate
 * and not a nicety.
 */
export const fitLines = (
  lines: readonly string[],
  { preferred, min, maxWidth, weight = "bold" }: FitOptions,
): number => {
  const longest = lines.reduce((n, l) => Math.max(n, l.length), 1);
  return Math.max(min, Math.min(preferred, maxWidth / (longest * ADVANCE[weight])));
};
