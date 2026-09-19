import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { easeInOutCubic, ramp } from "../timeline";

/**
 * The push-in. One scale multiplier over a beat, and nothing else.
 *
 * ── Why the interpolation is in log space ──────────────────────────────────
 *
 * A push from 1.00 to 1.12 interpolated linearly accelerates: the same
 * arithmetic step is a smaller and smaller *proportion* of the current scale,
 * so the move reads as slowing down at the wrong end. Zoom is perceived
 * multiplicatively, so a constant-rate push is a constant rate of CHANGE in
 * `log(scale)`. `exp(lerp(0, ln(push), p))` is that, and it also guarantees the
 * scale is never zero or negative whatever `p` does.
 *
 * ── Two rules that are not style ───────────────────────────────────────────
 *
 * **No `will-change`.** Ever, on this or on anything it wraps. It asks Chrome to
 * allocate backing store for the whole transformed layer; a sibling film's
 * renders were killed for memory with 5.4 GB free over a 22,250 × 22,881 px
 * one, and `verify:replica` greps the synced replica for it for the same
 * reason. The tell is worth keeping: **when more memory does not help, the
 * problem is not memory.**
 *
 * **Clamped at both ends.** `ramp` cannot extrapolate, which is how a scale
 * stays a scale off the end of a beat.
 */
export const Camera: React.FC<{
  /** End/start scale over the beat. 1 holds and the wrapper does nothing. */
  push: number;
  /**
   * The beat's length in frames. **Taken as a prop, never read from
   * `useVideoConfig()`** — inside a `<Sequence>` that reports the COMPOSITION
   * length, which is how a six-second push ends up spread over two minutes.
   */
  dur: number;
  children: React.ReactNode;
}> = ({ push, dur, children }) => {
  const frame = useCurrentFrame();

  if (push === 1) return <AbsoluteFill>{children}</AbsoluteFill>;

  const p = easeInOutCubic(dur > 0 ? frame / dur : 1);
  const scale = Math.exp(ramp(p, 0, 1, 0, Math.log(push)));

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "50% 50%",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
