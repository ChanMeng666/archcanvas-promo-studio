import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { CAPTION_SCALE } from "../caption";
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
 * not render at all and the product's own caption does the whole job.
 *
 * ── BEFORE the replica's own, never on top of it ───────────────────────────
 *
 * The first version overlapped the two, on the reasoning that a subtitle
 * restating an on-screen caption reads as emphasis. It does not: the still pass
 * caught the product's dark in-app pill and this band 115 px apart carrying the
 * identical sentence, which reads as a rendering bug. The window now ENDS where
 * the replica's caption reaches full opacity, so the sentence is handed over
 * rather than doubled — and this component does not fade out, because a fade at
 * the join is the one place a dip would break the continuous run the three-
 * second floor is measured on.
 *
 * Suppressing the replica's own caption is not available and should not be:
 * `src/replica/**` is a one-way copy and editing it here is a red gate by
 * design.
 *
 * ⚠ The sentence is deliberately still a literal in `copy.ts` rather than an
 * import from the synced `strings.ts`: that literal is what makes it visible to
 * `verify:copy`'s harvest and to the clearance table. `honesty.ts` →
 * `captionDrift()` is what stops the two parting company.
 */
export const HonestyCaption: React.FC<{
  /** Film seconds, absolute in the cut. From `honestyWindowFor`. */
  from: number;
  to: number;
  /** Appear at full opacity — the product's caption was carrying it until now. */
  hardIn?: boolean;
}> = ({ from, to, hardIn = false }) => {
  const frame = useCurrentFrame();
  const layout = useLayout();
  const sec = frame / FPS;

  if (sec < from || sec > to) return null;

  // Fades IN, and does not fade out.
  //
  // `to` is the second the replica's own caption reaches full opacity, so the
  // band hands the sentence over rather than overlapping it — and a fade at that
  // join is the one place a dip would break the continuous run the floor is
  // measured on. The fade in is short for the same reason: the floor is measured
  // on the opaque core, so a long fade would be the film marking its own
  // homework.
  const fade = hardIn ? 0 : Math.min(MOTION.enterSec, (to - from) / 6);
  const opacity = fade <= 0 ? 1 : clamp01(ramp(sec, from, from + fade, 0, 1));

  const lines = linesFor(HONESTY.copy, layout.aspect);

  // Anchored to the BOTTOM OF THE STAGE, never to the bottom of the frame. In
  // 9:16 the last 390 px belong to Reels, TikTok and Shorts, and the film's one
  // mandatory sentence is the last thing that may sit behind a share sheet.
  const height = layout.u(TYPE.caption * CAPTION_SCALE * 1.3) * lines.length + layout.u(40);

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
          padding: `${layout.u(18)}px ${layout.u(38)}px`,
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
              fontSize: layout.u(TYPE.caption * CAPTION_SCALE),
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
