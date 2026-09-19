import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { linesFor, type CardCopy } from "../copy";
import { FONT } from "../fonts";
import { splitStage, useLayout, type Layout } from "../layout";
import { FPS, clamp01, easeOutCubic, easeOutExpo } from "../timeline";
import { APP, BAND, CARD_RULE_FLOOR, MOTION, RADIUS, SPOT, TRACKING, TYPE, WEIGHT } from "../tokens";
import { fitLines } from "../typefit";

/**
 * A full-bleed line of the film's own type.
 *
 * ── The five rules ─────────────────────────────────────────────────────────
 *
 * **Authored line breaks, rendered `nowrap`.** The same string breaks in
 * different places at 1080 and 1920 wide, so `copy.ts` declares a `landscape`
 * and a `portrait` break for every card and neither is allowed to reflow. A bad
 * break then shows up as type running off the frame in a still — which is
 * something a person notices — instead of as a silently uglier line.
 *
 * **Each line arrives behind its own mask.** The line is not faded in: it is
 * revealed, rising out of a clipped band, one line after the next a third of a
 * beat apart. A fade is what a slide deck does; a mask reveal is what says the
 * words are being written.
 *
 * **Snappy, and over before it is noticed.** `Easing.out(expo)` across
 * `MOTION.cutSec` (0.28 s). Anything slower reads as a transition, and this film
 * cuts.
 *
 * **Violet is a SPOT colour.** A rule two characters wide that wipes in on the
 * beat, and nothing else. The founder's standing objection to large flat violet
 * is on the record; a card that wants to be loud gets the AUBERGINE ground
 * instead (`ColourCard` below), which is the marketing band palette's own and
 * carries white type at 9.6:1.
 *
 * **Left-aligned in landscape, centred in portrait.** A 9:16 frame is read on a
 * phone held in one hand and the eye is already centred; a 16:9 frame is read
 * across a room and a ragged-right block gives it an edge to start from.
 */
export const KineticCard: React.FC<{
  copy: CardCopy;
  /** The beat's length in frames — never `useVideoConfig().durationInFrames`. */
  dur: number;
  /** Full-bleed aubergine with ivory type, instead of ink on paper. */
  tone?: "paper" | "deep";
}> = ({ copy, dur, tone = "paper" }) => {
  const frame = useCurrentFrame();
  const layout = useLayout();
  const lines = linesFor(copy, layout.aspect);
  const centred = layout.aspect === "portrait";
  const deep = tone === "deep";

  const size = fitLines(lines, {
    preferred: TYPE.hero,
    min: TYPE.body,
    maxWidth: layout.maxContent / layout.scale,
    weight: "bold",
  });

  const sec = frame / FPS;
  // The whole card leaves together at the end of the beat, so the cut lands on
  // paper rather than on half a sentence.
  const outSec = MOTION.cutSec * 0.5;
  const out = 1 - clamp01((sec - (dur / FPS - outSec)) / outSec);

  const ink = deep ? APP.page : APP.ink;
  const rule = deep ? BAND.periwinkle : SPOT.action;

  return (
    <AbsoluteFill style={{ backgroundColor: deep ? BAND.aubergine : APP.page }}>
      {/* The same lattice the canvas has, so a card is the same world as the
          picture it cuts to rather than a slide that arrived from elsewhere. */}
      <CardGround layout={layout} frame={frame} deep={deep} />

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
        <AccentRule
          width={layout.u(size * 1.35)}
          height={layout.u(11)}
          colour={rule}
          p={CARD_RULE_FLOOR + (1 - CARD_RULE_FLOOR) * easeOutExpo(clamp01(sec / MOTION.cutSec))}
          origin={centred ? "50% 50%" : "0% 50%"}
          marginBottom={layout.u(size * 0.34)}
        />

        {lines.map((line, i) => (
          <MaskedLine
            key={line}
            text={line}
            p={easeOutExpo(clamp01((sec - (MOTION.cutSec / 3) * i) / MOTION.cutSec))}
            style={{
              fontFamily: FONT.sans,
              fontSize: layout.u(size),
              fontWeight: WEIGHT.bold,
              letterSpacing: `${TRACKING.display}em`,
              lineHeight: 1.06,
              color: ink,
              textAlign: centred ? "center" : "left",
            }}
          />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * One line, revealed from behind a clip rather than faded up.
 *
 * The band is `overflow: hidden` and the line rises into it. `lineHeight` on the
 * band is what stops a descender being clipped at rest — the mask is 1.16 of the
 * type size, and the travel is 0.9 of it, so the glyph is entirely outside the
 * band at `p = 0` and entirely inside it at `p = 1`.
 */
const MaskedLine: React.FC<{
  text: string;
  p: number;
  style: React.CSSProperties;
}> = ({ text, p, style }) => {
  const size = typeof style.fontSize === "number" ? style.fontSize : 0;
  return (
    <div style={{ overflow: "hidden", height: size * 1.16, width: "100%" }}>
      <div
        style={{
          ...style,
          whiteSpace: "nowrap",
          transform: `translateY(${((1 - p) * size * 1.06).toFixed(2)}px)`,
          opacity: 0.25 + 0.75 * p,
        }}
      >
        {text}
      </div>
    </div>
  );
};

/** The accent, wiping in from its own edge. */
const AccentRule: React.FC<{
  width: number;
  height: number;
  colour: string;
  p: number;
  origin: string;
  marginBottom: number;
}> = ({ width, height, colour, p, origin, marginBottom }) => (
  <div
    style={{
      width,
      height,
      backgroundColor: colour,
      marginBottom,
      borderRadius: height / 2,
      transform: `scaleX(${p.toFixed(4)})`,
      transformOrigin: origin,
    }}
  />
);

/**
 * A card's ground: the same lattice as the canvas, drifting.
 *
 * A flat field for two seconds is the frame a viewer's eye slides off, and a
 * contact sheet of eight of them is what makes a film look like a deck. The
 * lattice ties a card to the product's own canvas and gives the colour
 * something to sit on — 7 % on the deep card, a hair of the canvas dot on the
 * paper one. Visible in motion, invisible as texture.
 */
const CardGround: React.FC<{ layout: Layout; frame: number; deep: boolean }> = ({
  layout,
  frame,
  deep,
}) => {
  const pitch = layout.u(deep ? 56 : 44);
  const drift = (frame * (deep ? 0.3 : 0.2)) % pitch;
  const dot = Math.max(1, layout.u(deep ? 2 : 1.6));
  const colour = deep ? "rgb(255 255 255 / 0.07)" : "rgb(19 17 15 / 0.055)";
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `radial-gradient(${colour} ${dot}px, transparent ${dot}px)`,
        backgroundSize: `${pitch}px ${pitch}px`,
        backgroundPosition: `${drift.toFixed(2)}px ${(drift * 0.55).toFixed(2)}px`,
      }}
    />
  );
};

/**
 * The same voice, one size down, under a replica shot.
 *
 * A `split` scene puts the picture first and adds a verb the interface does not
 * supply. It sets in `TYPE.title` rather than `TYPE.hero` for exactly that
 * reason: a line that competes with the drawing for the frame is a card, and a
 * card belongs on its own beat.
 */
export const SplitLine: React.FC<{ copy: CardCopy; dur: number }> = ({ copy, dur }) => {
  const frame = useCurrentFrame();
  const layout = useLayout();
  const lines = linesFor(copy, layout.aspect);
  const band = splitStage(layout).line;
  const centred = layout.aspect === "portrait";

  // Bounded by the band's HEIGHT as well as its width. A width-only fit put the
  // two-line receipt sentence 72 px past the bottom of a 16:9 frame in the first
  // still pass — the character count says nothing about how many lines there
  // are, and the band is the shorter constraint on a wide frame.
  const lineBox = band.h / (lines.length * 1.18 * 1.16);
  const size = Math.min(
    lineBox / layout.scale,
    fitLines(lines, {
      preferred: TYPE.title,
      min: TYPE.caption,
      maxWidth: band.w / layout.scale,
      weight: "medium",
    }),
  );

  const sec = frame / FPS;
  const outSec = MOTION.cutSec * 0.5;
  const out = 1 - clamp01((sec - (dur / FPS - outSec)) / outSec);
  const rule = easeOutExpo(clamp01(sec / MOTION.cutSec));

  return (
    <AbsoluteFill
      style={{
        left: band.x,
        top: band.y,
        width: band.w,
        height: band.h,
        justifyContent: "center",
        alignItems: centred ? "center" : "flex-start",
        opacity: out,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: layout.u(18), width: "100%" }}>
        <div
          style={{
            width: layout.u(10),
            height: layout.u(size * 1.05 * lines.length),
            borderRadius: layout.u(5),
            backgroundColor: SPOT.action,
            transform: `scaleY(${rule.toFixed(4)})`,
            transformOrigin: "50% 0%",
            flex: "0 0 auto",
            display: centred ? "none" : "block",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", width: "100%", alignItems: centred ? "center" : "flex-start" }}>
          {lines.map((line, i) => (
            <MaskedLine
              key={line}
              text={line}
              p={easeOutExpo(clamp01((sec - (MOTION.cutSec / 3) * i) / MOTION.cutSec))}
              style={{
                fontFamily: FONT.sans,
                fontSize: layout.u(size),
                fontWeight: WEIGHT.medium,
                letterSpacing: `${TRACKING.body}em`,
                lineHeight: 1.18,
                color: APP.ink,
                textAlign: centred ? "center" : "left",
              }}
            />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * The chapter chip: which of the product's seven acts this beat is.
 *
 * The labels are the replica's own `CHAPTERS` marks, synced — the same words the
 * landing page's chapter tabs carry, so the film is not inventing a vocabulary
 * for the product. It pops on the cut and holds; `pop` fires under it.
 *
 * Top-left in landscape, top-centre in portrait, always inside the TEXT-safe
 * area rather than the picture's — it is type, and the platform furniture rule
 * applies to type.
 */
export const ChapterChip: React.FC<{ label: string }> = ({ label }) => {
  const frame = useCurrentFrame();
  const layout = useLayout();
  const p = easeOutCubic(clamp01(frame / FPS / (MOTION.enterSec * 1.3)));
  const centred = layout.aspect === "portrait";

  return (
    <AbsoluteFill
      style={{
        left: layout.stage.x,
        top: layout.stage.y,
        width: layout.stage.w,
        height: layout.u(TYPE.caption * 2.2),
        alignItems: centred ? "center" : "flex-start",
        justifyContent: "flex-start",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: layout.u(10),
          padding: `${layout.u(9)}px ${layout.u(20)}px`,
          borderRadius: layout.u(RADIUS.pill),
          backgroundColor: APP.card,
          border: `${Math.max(1, layout.u(1.5))}px solid ${APP.hairline}`,
          // A shadow, because in 9:16 the replica goes edge to edge and the chip
          // is therefore always over the drawing. Without one it reads as a
          // label ON the plan rather than as chrome above it — visible in the
          // portrait receipt still, where "REVIEW" sat inside the building.
          boxShadow: `0 ${layout.u(6)}px ${layout.u(18)}px rgb(19 17 15 / 0.10)`,
          transform: `scale(${(0.82 + 0.18 * p).toFixed(4)})`,
          transformOrigin: centred ? "50% 0%" : "0% 0%",
          opacity: p,
        }}
      >
        <span
          style={{
            width: layout.u(9),
            height: layout.u(9),
            borderRadius: layout.u(5),
            backgroundColor: SPOT.plum,
            display: "block",
          }}
        />
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: layout.u(TYPE.caption * 0.82),
            fontWeight: WEIGHT.medium,
            letterSpacing: `${TRACKING.caps}em`,
            textTransform: "uppercase",
            color: APP.inkMuted,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
      </div>
    </AbsoluteFill>
  );
};
