import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";

import { END_DESCRIPTOR, END_DOMAIN, linesFor } from "../copy";
import { FONT } from "../fonts";
import { useLayout } from "../layout";
import { FPS, clamp01, easeOutCubic } from "../timeline";
import { APP, MOTION, SPOT, TRACKING, TYPE, WEIGHT } from "../tokens";

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
 */
export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const layout = useLayout();
  const sec = frame / FPS;

  const mark = easeOutCubic(clamp01(sec / (MOTION.cutSec * 1.4)));
  const line = easeOutCubic(clamp01((sec - MOTION.cutSec * 0.6) / MOTION.cutSec));
  const tail = easeOutCubic(clamp01((sec - MOTION.cutSec * 1.1) / MOTION.cutSec));

  // The mark holds its size; only the rule under it draws itself out, so the
  // frame the viewer photographs is stable from a third of a second in.
  const markWidth = layout.aspect === "landscape" ? layout.u(760) : layout.u(620);

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
          gap: layout.u(36),
        }}
      >
        <Img
          src={staticFile("brand/archcanvas-wordmark.svg")}
          alt="ArchCanvas"
          style={{
            width: markWidth,
            height: "auto",
            opacity: mark,
            transform: `translateY(${(1 - mark) * layout.u(18)}px)`,
          }}
        />

        <div
          style={{
            width: markWidth * 0.34 * line,
            height: layout.u(5),
            backgroundColor: SPOT.action,
          }}
        />

        <div
          style={{
            fontFamily: FONT.sans,
            fontSize: layout.u(TYPE.title * 0.82),
            fontWeight: WEIGHT.bold,
            letterSpacing: `${TRACKING.display}em`,
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
            fontSize: layout.u(TYPE.caption),
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
    </AbsoluteFill>
  );
};
