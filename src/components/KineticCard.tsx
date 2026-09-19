import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { linesFor, type CardCopy } from "../copy";
import { FONT } from "../fonts";
import { splitStage, useLayout } from "../layout";
import { FPS, clamp01, easeOutCubic } from "../timeline";
import { APP, MOTION, SPOT, TRACKING, TYPE, WEIGHT } from "../tokens";
import { fitLines } from "../typefit";

/**
 * A full-bleed line of the film's own type on the product's own paper.
 *
 * ── The four rules ─────────────────────────────────────────────────────────
 *
 * **Authored line breaks, rendered `nowrap`.** The same string breaks in
 * different places at 1080 and 1920 wide, so `copy.ts` declares a `landscape`
 * and a `portrait` break for every card and neither is allowed to reflow. A bad
 * break then shows up as type running off the frame in a still — which is
 * something a person notices — instead of as a silently uglier line.
 *
 * **Snappy, and over before it is noticed.** One move, `Easing.out(cubic)`
 * across `MOTION.cutSec` (0.28 s), lines staggered a third of that. Anything
 * slower reads as a slide transition, and this film cuts.
 *
 * **Violet is a spot colour.** A rule two characters wide above the line, and
 * nothing else. The founder's standing objection to large flat violet is on the
 * record and this film does not relitigate it.
 *
 * **Left-aligned in landscape, centred in portrait.** A 9:16 frame is read on a
 * phone held in one hand and the eye is already centred; a 16:9 frame is read
 * across a room and a ragged-right block gives it an edge to start from.
 */
export const KineticCard: React.FC<{
  copy: CardCopy;
  /** The beat's length in frames — never `useVideoConfig().durationInFrames`. */
  dur: number;
}> = ({ copy, dur }) => {
  const frame = useCurrentFrame();
  const layout = useLayout();
  const lines = linesFor(copy, layout.aspect);
  const centred = layout.aspect === "portrait";

  const size = fitLines(lines, {
    preferred: TYPE.hero,
    min: TYPE.body,
    maxWidth: layout.maxContent / layout.scale,
    weight: "bold",
  });

  // The whole card leaves together at the end of the beat, so the cut lands on
  // paper rather than on half a sentence.
  const outSec = MOTION.cutSec * 0.5;
  const out = 1 - clamp01((frame / FPS - (dur / FPS - outSec)) / outSec);

  return (
    <AbsoluteFill style={{ backgroundColor: APP.page }}>
      <AbsoluteFill
        style={{
          left: layout.stage.x,
          top: layout.stage.y,
          width: layout.stage.w,
          height: layout.stage.h,
          justifyContent: "center",
          alignItems: centred ? "center" : "flex-start",
          opacity: out,
        }}
      >
        <div
          style={{
            width: layout.u(size * 1.1),
            height: layout.u(6),
            backgroundColor: SPOT.action,
            marginBottom: layout.u(size * 0.34),
            transform: `scaleX(${easeOutCubic(clamp01(frame / FPS / MOTION.cutSec))})`,
            transformOrigin: centred ? "50% 50%" : "0% 50%",
          }}
        />

        {lines.map((line, i) => {
          const delay = (MOTION.cutSec / 3) * i;
          const p = easeOutCubic(clamp01((frame / FPS - delay) / MOTION.cutSec));
          return (
            <div
              key={line}
              style={{
                fontFamily: FONT.sans,
                fontSize: layout.u(size),
                fontWeight: WEIGHT.bold,
                letterSpacing: `${TRACKING.display}em`,
                lineHeight: 1.06,
                color: APP.ink,
                whiteSpace: "nowrap",
                textAlign: centred ? "center" : "left",
                opacity: p,
                transform: `translateY(${(1 - p) * layout.u(size * 0.32)}px)`,
              }}
            >
              {line}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * The same voice, one size down, under a replica shot.
 *
 * A `split` scene puts the picture first and adds a verb the interface does not
 * supply. It sets in `TYPE.title` rather than `TYPE.display` for exactly that
 * reason: a line that competes with the drawing for the frame is a card, and a
 * card belongs on its own beat.
 */
export const SplitLine: React.FC<{ copy: CardCopy; dur: number }> = ({ copy, dur }) => {
  const frame = useCurrentFrame();
  const layout = useLayout();
  const lines = linesFor(copy, layout.aspect);
  const band = splitStage(layout).line;

  // Bounded by the band's HEIGHT as well as its width. A width-only fit put the
  // two-line receipt sentence 72 px past the bottom of a 16:9 frame in the first
  // still pass — the character count says nothing about how many lines there
  // are, and the band is the shorter constraint on a wide frame.
  const lineBox = band.h / (lines.length * 1.18 * 1.12);
  const size = Math.min(
    lineBox / layout.scale,
    fitLines(lines, {
      preferred: TYPE.title,
      min: TYPE.caption,
      maxWidth: band.w / layout.scale,
      weight: "medium",
    }),
  );

  const outSec = MOTION.cutSec * 0.5;
  const out = 1 - clamp01((frame / FPS - (dur / FPS - outSec)) / outSec);

  return (
    <AbsoluteFill
      style={{
        left: band.x,
        top: band.y,
        width: band.w,
        height: band.h,
        justifyContent: "center",
        alignItems: layout.aspect === "portrait" ? "center" : "flex-start",
        opacity: out,
      }}
    >
      {lines.map((line, i) => {
        const delay = (MOTION.cutSec / 3) * i;
        const p = easeOutCubic(clamp01((frame / FPS - delay) / MOTION.cutSec));
        return (
          <div
            key={line}
            style={{
              fontFamily: FONT.sans,
              fontSize: layout.u(size),
              fontWeight: WEIGHT.medium,
              letterSpacing: `${TRACKING.body}em`,
              lineHeight: 1.18,
              color: APP.ink,
              whiteSpace: "nowrap",
              textAlign: layout.aspect === "portrait" ? "center" : "left",
              opacity: p,
              transform: `translateY(${(1 - p) * layout.u(size * 0.3)}px)`,
            }}
          >
            {line}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
