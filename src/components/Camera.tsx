import React from "react";
import { AbsoluteFill } from "remotion";

import { pushTransform, type FramePush } from "../camera";

/**
 * A `FramePush`, applied.
 *
 * All the arithmetic — the log-space interpolation, the clamp that keeps the
 * honesty caption and the "AI-generated" pill inside the frame — lives in the
 * React-free `camera.ts`, so a gate can ask for the same numbers without a
 * renderer. This is the two lines of CSS that put them on screen, and nothing
 * else.
 *
 * ── Two rules that are not style ───────────────────────────────────────────
 *
 * **A translate and a scale, never a scale about a moving origin.** Scaling
 * about the focus magnifies without ever AIMING — the first still pass caught
 * it in one frame, an edit beat pushed to 1.5 on the kitchen with the kitchen
 * still in the right-hand third. `camera.ts` derives the pair and clamps it so
 * the frame stays covered and the protected rectangles stay whole.
 *
 * **No `will-change`.** Ever, on this or on anything it wraps. It asks Chrome to
 * allocate backing store for the whole transformed layer; a sibling film's
 * renders were killed for memory with 5.4 GB free over a 22,250 x 22,881 px one.
 * The tell is worth keeping: when more memory does not help, the problem is not
 * memory.
 */
export const PushLayer: React.FC<{ push: FramePush; children: React.ReactNode }> = ({
  push,
  children,
}) => {
  if (push.scale <= 1 + 1e-9) return <AbsoluteFill>{children}</AbsoluteFill>;
  return (
    <AbsoluteFill
      style={{ transform: pushTransform(push), transformOrigin: "0 0" }}
    >
      {children}
    </AbsoluteFill>
  );
};
