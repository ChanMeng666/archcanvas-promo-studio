import React from "react";
import { AbsoluteFill } from "remotion";

import { FPS, clamp01, easeOutExpo } from "../timeline";
import { MOTION } from "../tokens";

/**
 * The colour the cut is leaving, sliding off the frame.
 *
 * ── Why a wipe and not just a new colour ───────────────────────────────────
 *
 * The stage changes colour on the chapter boundary. Cut straight, that is a
 * frame of one colour followed by a frame of another — correct, and inert. A
 * wipe gives the cut a direction, which is most of what "carries momentum"
 * means, and it costs one `div` and a `translateX`.
 *
 * ── Where it sits in the stack, which is the whole trick ───────────────────
 *
 * ABOVE the new ground and BELOW the window. So the picture is never covered —
 * the product is on screen from frame 0 of the beat — and what moves is the
 * colour behind it. A wipe over the whole frame would hide the studio for eight
 * frames on every cut, which is the opposite of fast.
 *
 * It alternates direction by beat index so a run of chapters does not read as
 * one gesture repeated, and it is skipped entirely when the two colours are the
 * same: a wipe of ivory over ivory is eight frames of nothing.
 */
export const ColourWipe: React.FC<{
  /** The colour being replaced. Null or equal to the new one: nothing renders. */
  from: string | null;
  to: string;
  /** Frames since the beat started. */
  frame: number;
  /** Alternates the direction. The beat's index. */
  seed: number;
  width: number;
}> = ({ from, to, frame, seed, width }) => {
  if (!from || from === to) return null;
  const p = easeOutExpo(clamp01(frame / FPS / (MOTION.cutSec * 0.9)));
  if (p >= 1) return null;
  const dir = seed % 2 === 0 ? 1 : -1;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: from,
        transform: `translateX(${(dir * p * width).toFixed(1)}px)`,
      }}
    />
  );
};
