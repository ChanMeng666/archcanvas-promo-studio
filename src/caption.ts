import { HONESTY, linesFor } from "./copy";
import type { Aspect, Layout } from "./layout-core";
import { TYPE } from "./tokens";

/**
 * How big the film's own honesty band sets, relative to `TYPE.caption`.
 *
 * ⚠ 1.42, not 1.15, and the art-direction review is why: under the money shot's
 * drawing the band read as small print, which is the wrong register for the one
 * sentence in the film that exists to be read. At 1.42 it is 36 px at 1920 wide
 * and 41 px at 1080 wide portrait — above the 30 / 34 px floors the review set,
 * and `capture/verify-opening.mjs` checks both.
 *
 * It lives in its own React-free module because the gate reads it and the gates
 * bundle only React-free code. One number, one home.
 */
export const CAPTION_SCALE = 1.42;

/**
 * The top edge of the film's own honesty band, in frame pixels.
 *
 * Exported because two things need it and they must not disagree: the component
 * that draws the band, and the CAMERA. When the film carries the sentence
 * itself, the band is an opaque pill drawn above the push — so anything the
 * camera frames underneath it is covered rather than cropped, and a gate that
 * only checks cropping sees nothing wrong.
 *
 * ⚠ That is not hypothetical. At 12 s in the 60 s cut the band sat across the
 * last two lines of the drafting card's own text: the card was framed to fill
 * the frame, the band is at the bottom of the stage, and they met. The camera now
 * treats the band's top as the bottom of the frame for that beat, the same way a
 * split scene treats its type band.
 */
export const captionBandTop = (layout: Layout, lineCount: number): number => {
  const height = layout.u(TYPE.caption * CAPTION_SCALE * 1.3) * lineCount + layout.u(40);
  return layout.stage.y + layout.stage.h - height - layout.u(56);
};

/** How many lines the band sets in this frame shape. */
export const captionLines = (aspect: Aspect): number => linesFor(HONESTY.copy, aspect).length;
