import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { HONESTY, linesFor } from "../copy";
import { FONT } from "../fonts";
import { useLayout } from "../layout";
import { FPS, clamp01, ramp } from "../timeline";
import { APP, MOTION, RADIUS, TRACKING, TYPE, WEIGHT } from "../tokens";

/**
 * The film's own honesty caption — the safety net under the replica's.
 *
 * ── The obligation ─────────────────────────────────────────────────────────
 *
 * A real design takes two to three minutes. The replica compresses it to
 * seconds, and **time compression read as a speed promise is a claim nobody
 * made** — which is why the sentence exists at all, why it is on screen in all
 * eight masters, and why the floor is three seconds of FILM time rather than of
 * screenplay time.
 *
 * ── Why the film sometimes draws it itself ─────────────────────────────────
 *
 * The replica carries the caption at screenplay 8.0–12.5 s. The time warp
 * shortens that: at the 15 s cut's rate the product's own caption is readable
 * for about 2.7 s, which is under the floor. So `timeline.ts` DERIVES the
 * window per cut (`honestyWindowFor`) and says who owns it. Where the derived
 * window is long enough — the 30, 60 and 120 cuts today — this component does
 * not render at all and the product's own caption does the whole job. Where it
 * is short, this renders the identical sentence for the full window.
 *
 * The two are deliberately in different places: the replica's caption is inside
 * the studio stage, this one is a subtitle band under it. For the ~2.7 s they
 * overlap, a subtitle restating an on-screen caption is ordinary film language
 * and reads as emphasis, not as a duplicate. The alternative — suppressing the
 * replica's own caption — is not available and should not be: `src/replica/**`
 * is a one-way copy and editing it here is a red gate by design.
 *
 * ⚠ The sentence is a COPY of the replica's `HONESTY_CAPTION` until the sync
 * lands. **WP-9: import it from `src/replica` and delete the local constant.**
 */
export const HonestyCaption: React.FC<{
  /** Film seconds, absolute in the cut. From `honestyWindowFor`. */
  from: number;
  to: number;
}> = ({ from, to }) => {
  const frame = useCurrentFrame();
  const layout = useLayout();
  const sec = frame / FPS;

  if (sec < from || sec > to) return null;

  // A fade short enough that the readable core is nearly the whole window —
  // the floor is measured on the core, so a long fade would be the film
  // marking its own homework.
  const fade = Math.min(MOTION.enterSec, (to - from) / 6);
  const opacity =
    clamp01(ramp(sec, from, from + fade, 0, 1)) * clamp01(ramp(sec, to - fade, to, 1, 0));

  const lines = linesFor(HONESTY.copy, layout.aspect);

  // Anchored to the BOTTOM OF THE STAGE, never to the bottom of the frame. In
  // 9:16 the last 390 px belong to Reels, TikTok and Shorts, and the film's one
  // mandatory sentence is the last thing that may sit behind a share sheet.
  const height = layout.u(TYPE.caption * 1.15 * 1.3) * lines.length + layout.u(34);

  return (
    <AbsoluteFill
      style={{
        left: layout.stage.x,
        top: layout.stage.y + layout.stage.h - height - layout.u(56),
        width: layout.stage.w,
        height,
        justifyContent: "flex-start",
        alignItems: "center",
        opacity,
      }}
    >
      <div
        style={{
          backgroundColor: APP.card,
          border: `${layout.u(1.5)}px solid ${APP.hairline}`,
          borderRadius: layout.u(RADIUS.pill),
          padding: `${layout.u(14)}px ${layout.u(30)}px`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: layout.u(4),
        }}
      >
        {lines.map((line) => (
          <div
            key={line}
            style={{
              fontFamily: FONT.sans,
              fontSize: layout.u(TYPE.caption * 1.15),
              fontWeight: WEIGHT.medium,
              letterSpacing: `${TRACKING.body}em`,
              lineHeight: 1.3,
              color: APP.inkMuted,
              whiteSpace: "nowrap",
              textAlign: "center",
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
