import React from "react";
import { AbsoluteFill, Img, useCurrentFrame } from "remotion";

import { WORDMARK } from "../assets";
import { END_DESCRIPTOR, END_DOMAIN, linesFor } from "../copy";
import { FONT } from "../fonts";
import { useLayout } from "../layout";
import { FPS, clamp01, easeOutCubic, easeOutExpo } from "../timeline";
import { APP, END_WIPE_BAND, MOTION, SPOT, TRACKING, TYPE, WEIGHT } from "../tokens";

/**
 * The closing frame: the mark, the address, and what the thing is.
 *
 * ── The descriptor is a legal choice, not a style one ──────────────────────
 *
 * It says **"AI architectural designer"** and never "AI architect". "Architect"
 * is a protected title under the UK Architects Act 1997 s.20 (to £2,500 per
 * offence; ARB's misuse policy names websites specifically) and the NZ
 * Registered Architects Act 2005 s.7 (to NZ$10,000) — and New Zealand is the
 * law the product's own Terms choose. ARB has said it cannot police the
 * "architectural" derivatives, so the substitution is expressly outside its
 * reach and means the same thing to a reader. `verify:copy` carries the
 * product repo's own needle, `/\bAI architect(?!ural)/i`, byte-identically.
 *
 * ── Why the wordmark is an SVG and not type ────────────────────────────────
 *
 * The mark is drawn, not set: it is `archcanvas-wordmark.svg` from the product's
 * own `public/brand/`, copied here and checked by `verify:assets`. Remotion
 * fails *softly* on a missing `staticFile()` — a blank region, not an error —
 * so the eight-master render could otherwise complete with a hole where the
 * logo goes. That is the entire reason `verify:assets` runs first.
 *
 * ── The wipe ───────────────────────────────────────────────────────────────
 *
 * A plum BAND sweeps across the frame once, on the `end-hit`, and the card is
 * revealed behind it. A band and not a full-bleed fill: the founder's objection
 * to large flat violet stands, and a band about a fifth of the frame wide is a
 * gesture rather than a surface. One move, a third of a second, and everything
 * after it is ivory.
 */
/**
 * How wide the sweeping band is, as a fraction of the frame.
 *
 * It used to be the whole frame, which made it a flat violet surface for nine
 * frames — and the standing objection to large flat violet does not have a
 * nine-frame exemption. A band reads as a swipe, which is what it was always
 * meant to be.
 *
 * ⚠ The number lives in `tokens.ts` as `END_WIPE_BAND`, under
 * `VIOLET_AREA_MAX`, because `verify:violet` checks it against the ceiling and
 * a number a gate cannot see is a number that drifts back to a fifth.
 */
const WIPE_BAND = END_WIPE_BAND;

export const EndCard: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const layout = useLayout();
  const sec = frame / FPS;

  const wipe = easeOutExpo(clamp01(sec / MOTION.wipeSec));
  const after = clamp01((sec - MOTION.wipeSec * 0.55) / MOTION.cutSec);

  const mark = easeOutCubic(clamp01(after));
  const line = easeOutCubic(clamp01((sec - MOTION.wipeSec * 0.55 - MOTION.cutSec * 0.5) / MOTION.cutSec));
  const tail = easeOutCubic(clamp01((sec - MOTION.wipeSec * 0.55 - MOTION.cutSec) / MOTION.cutSec));

  /*
   * The lockup, bigger — and the URL is the largest thing after the mark,
   * because the URL is the CALL TO ACTION and the first cut set it at half the
   * size of the wordmark like a caption.
   *
   * The mark holds its size; only the rule under it draws itself out, so the
   * frame a viewer screenshots is stable from half a second in. Sized off the
   * STAGE rather than as a fixed token so 9:16 keeps it clear of the bottom
   * 390 px the platforms cover.
   */
  const markWidth = Math.min(
    layout.stage.w * (layout.aspect === "landscape" ? 0.54 : 0.86),
    layout.u(1180),
  );
  const domainSize = markWidth * 0.132;

  // The last third of a second belongs to the picture, not to the animation —
  // an end card still moving when the file ends reads as a truncated render.
  const settle = clamp01((dur / FPS - sec) / 0.2);

  return (
    <AbsoluteFill style={{ backgroundColor: APP.page }}>
      <AbsoluteFill
        style={{
          left: layout.stage.x,
          top: layout.stage.y,
          width: layout.stage.w,
          height: layout.stage.h,
          justifyContent: "center",
          alignItems: "center",
          gap: layout.u(30),
          opacity: Math.min(1, settle + 0.0),
        }}
      >
        <Img
          src={WORDMARK}
          alt="ArchCanvas"
          style={{
            width: markWidth,
            height: "auto",
            opacity: mark,
            transform: `translateY(${((1 - mark) * layout.u(14)).toFixed(1)}px)`,
          }}
        />

        <div
          style={{
            width: markWidth * 0.38 * line,
            height: layout.u(7),
            borderRadius: layout.u(4),
            backgroundColor: SPOT.action,
          }}
        />

        <div
          style={{
            fontFamily: FONT.sans,
            fontSize: domainSize,
            fontWeight: WEIGHT.bold,
            letterSpacing: `${TRACKING.display}em`,
            lineHeight: 1.05,
            color: APP.ink,
            whiteSpace: "nowrap",
            opacity: line,
          }}
        >
          {linesFor(END_DOMAIN.copy, layout.aspect)[0]}
        </div>

        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: layout.u(TYPE.caption * 1.15),
            fontWeight: WEIGHT.regular,
            letterSpacing: `${TRACKING.caps}em`,
            textTransform: "uppercase",
            color: APP.inkMuted,
            whiteSpace: "nowrap",
            opacity: tail,
          }}
        >
          {linesFor(END_DESCRIPTOR.copy, layout.aspect)[0]}
        </div>
      </AbsoluteFill>

      {/* The band, sweeping once. Above the card, so the card is revealed. */}
      {wipe < 1 ? (
        <AbsoluteFill
          style={{
            backgroundColor: SPOT.plum,
            width: layout.width * WIPE_BAND,
            transform: `translateX(${((wipe * (1 + WIPE_BAND) - WIPE_BAND) * layout.width).toFixed(1)}px)`,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
