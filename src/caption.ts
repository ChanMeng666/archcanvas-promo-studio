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
