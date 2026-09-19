import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { linesFor, type CardCopy } from "../copy";
import { FONT } from "../fonts";
import { splitStage, useLayout, type Layout } from "../layout";
import type { CardTone } from "../scenes";
import { ColourWipe } from "./ColourWipe";
import { FPS, clamp01, easeOutCubic, easeOutExpo } from "../timeline";
import {
  APP,
  BAND,
  CARD_RULE_FLOOR,
  MOTION,
  RADIUS,
  SPOT,
  TRACKING,
  TYPE,
  WEIGHT,
  WORD_FLOOR,
  WORD_RISE_SEC,
  WORD_STAGGER_SEC,
} from "../tokens";
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
  /** The card's ground. See `scenes.ts` § tone. */
  tone?: CardTone;
  /** The colour the cut is leaving, for the wipe. */
  from?: string | null;
  /** The beat's index — alternates the wipe's direction. */
  seed?: number;
}> = ({ copy, dur, tone = "paper", from = null, seed = 0 }) => {
  const frame = useCurrentFrame();
  const layout = useLayout();
  const lines = linesFor(copy, layout.aspect);
  const centred = layout.aspect === "portrait";

  /*
   * HERO SCALE. `maxContent` is the width a BLOCK of running type may use; a
   * card is one or two lines that are meant to carry the whole frame, and
   * holding them to a reading measure is what made the first cut's "Describe
   * your home." sit small in an empty frame. A card gets the safe area, less a
   * margin, and the ceiling is high enough that the character count is what
   * decides — not the token.
   */
  const size = fitLines(lines, {
    preferred: TYPE.hero,
    min: TYPE.body,
    maxWidth: (layout.stage.w * 0.97) / layout.scale,
    weight: "bold",
  });

  const sec = frame / FPS;
  // The whole card leaves together at the end of the beat, so the cut lands on
  // paper rather than on half a sentence.
  const outSec = MOTION.cutSec * 0.5;
  const out = 1 - clamp01((sec - (dur / FPS - outSec)) / outSec);

  const { ground, ink, rule } = TONES[tone];

  return (
    <AbsoluteFill style={{ backgroundColor: ground }}>
      {/* The same lattice the canvas has, so a card is the same world as the
          picture it cuts to rather than a slide that arrived from elsewhere. */}
      <CardGround layout={layout} frame={frame} tone={tone} />
      <ColourWipe from={from} to={ground} frame={frame} seed={seed} width={layout.width} />

      <AbsoluteFill
        style={{
          left: layout.stage.x,
          top: layout.stage.y,
          width: layout.stage.w,
          height: layout.stage.h,
          justifyContent: "center",
          // Centred in 9:16, ragged-left in 16:9 — and the ACCENT RULE has to
          // follow, or it hangs off to the left of centred type and reads as a
          // misalignment rather than as a mark. The portrait stills had it.
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
            sec={sec}
            delay={WORD_STAGGER_SEC * wordsBefore(lines, i)}
            centred={centred}
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

const TONES: Record<CardTone, { ground: string; ink: string; rule: string }> = {
  /** Ink on the product's own paper. */
  paper: { ground: APP.page, ink: APP.ink, rule: SPOT.action },
  /** The marketing band's aubergine, ivory type at 9.6:1. */
  deep: { ground: BAND.aubergine, ink: APP.page, rule: BAND.periwinkle },
  /**
   * Buttercream, full bleed, obsidian type at 18:1 — the film's brightest frame.
   *
   * It was plum for one pass. `tokens.ts` says why it is not.
   */
  bright: { ground: BAND.buttercream, ink: APP.ink, rule: SPOT.action },
};

const wordsOf = (line: string): string[] => line.split(" ").filter(Boolean);

/** How many words precede line `i`, so the stagger runs across the whole card. */
const wordsBefore = (lines: readonly string[], i: number): number =>
  lines.slice(0, i).reduce((n, l) => n + wordsOf(l).length, 0);

/**
 * One line, revealed WORD BY WORD from behind a clip rather than faded up.
 *
 * The band is `overflow: hidden` and each word rises into it. A fade is what a
 * slide deck does; a mask reveal is what says the words are being written, and
 * doing it per word rather than per line is the difference between type
 * arriving and type appearing.
 *
 * The mask is 1.16 of the type size and the travel is 1.06 of it, so a glyph is
 * entirely outside the band at rest and entirely inside it — descenders and all
 * — when it lands. Word spacing is drawn as a margin rather than a space
 * character, because a space inside an `overflow: hidden` span collapses.
 */
const MaskedLine: React.FC<{
  text: string;
  /** Seconds since the beat started. */
  sec: number;
  /** How long this line waits before its first word. */
  delay: number;
  centred: boolean;
  style: React.CSSProperties;
}> = ({ text, sec, delay, centred, style }) => {
  const size = typeof style.fontSize === "number" ? style.fontSize : 0;
  const words = wordsOf(text);
  return (
    <div
      style={{
        overflow: "hidden",
        height: size * 1.16,
        width: "100%",
        display: "flex",
        justifyContent: centred ? "center" : "flex-start",
      }}
    >
      {words.map((word, i) => {
        // The first word of the first line starts half risen: frame 0 is the
        // thumbnail, and it has to be a frame someone would have chosen.
        const raw = easeOutExpo(clamp01((sec - delay - WORD_STAGGER_SEC * i) / WORD_RISE_SEC));
        const floor = delay === 0 && i === 0 ? WORD_FLOOR : 0;
        const p = floor + (1 - floor) * raw;
        return (
          <span
            key={`${i}-${word}`}
            style={{
              ...style,
              whiteSpace: "pre",
              marginRight: i === words.length - 1 ? 0 : size * 0.26,
              transform: `translateY(${((1 - p) * size * 1.06).toFixed(2)}px)`,
              opacity: 0.25 + 0.75 * p,
            }}
          >
            {word}
          </span>
        );
      })}
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
const CardGround: React.FC<{ layout: Layout; frame: number; tone: CardTone }> = ({
  layout,
  frame,
  tone,
}) => {
  const deep = tone !== "paper";
  const pitch = layout.u(deep ? 56 : 44);
  const drift = (frame * (deep ? 0.3 : 0.2)) % pitch;
  const dot = Math.max(1, layout.u(deep ? 2 : 1.6));
  const colour = deep ? "rgb(255 255 255 / 0.08)" : "rgb(19 17 15 / 0.055)";
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
export const SplitLine: React.FC<{ copy: CardCopy; dur: number; ink?: string; rule?: string }> = ({
  copy,
  dur,
  ink = APP.ink,
  rule: ruleColour = SPOT.action,
}) => {
  const frame = useCurrentFrame();
  const layout = useLayout();
  const lines = linesFor(copy, layout.aspect);
  const band = splitStage(layout).line;
  const centred = layout.aspect === "portrait";

  // Bounded by the band's HEIGHT as well as its width. A width-only fit put the
  // two-line receipt sentence 72 px past the bottom of a 16:9 frame in the first
  // still pass — the character count says nothing about how many lines there
  // are, and the band is the shorter constraint on a wide frame.
  const lineBox = band.h / (lines.length * 1.16 * 1.14);
  const size = Math.min(
    lineBox / layout.scale,
    fitLines(lines, {
      // A chapter verb is not a caption. `TYPE.title` held it to about half the
      // band's height, which read as a subtitle under a picture rather than as
      // the film speaking.
      preferred: TYPE.title * 1.45,
      min: TYPE.caption,
      maxWidth: (band.w * 0.96) / layout.scale,
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
        alignItems: "flex-start",
        opacity: out,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: layout.u(18), width: "100%" }}>
        <div
          style={{
            width: layout.u(10),
            height: layout.u(size * 1.05 * lines.length),
            borderRadius: layout.u(5),
            backgroundColor: ruleColour,
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
              sec={sec}
              delay={WORD_STAGGER_SEC * wordsBefore(lines, i)}
              centred={centred}
              style={{
                fontFamily: FONT.sans,
                fontSize: layout.u(size),
                fontWeight: WEIGHT.medium,
                letterSpacing: `${TRACKING.body}em`,
                lineHeight: 1.18,
                color: ink,
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
 * Top-left in landscape, inside the TEXT-safe area rather than the picture's —
 * it is type, and the platform furniture rule applies to type.
 *
 * ⚠ **Landscape only, and the stills are why.** The replica letterboxes in 16:9,
 * so the chip's corner is empty canvas in every scene. It FILLS a 9:16 frame, so
 * there is no empty corner to sit in: top-centre put "BRIEF" through the
 * composer's own "Your Projects" heading and "EXPORT" in the middle of the
 * drawing. Every other anchor collides with something in some scene — the
 * bottom with the honesty band, the top-right with the export sheet — because
 * the real answer is that a portrait frame has no margin to put film furniture
 * in. In 9:16 the chapter is carried by the colour script and the type instead.
 */
export const ChapterChip: React.FC<{ label: string }> = ({ label }) => {
  const frame = useCurrentFrame();
  const layout = useLayout();
  const p = easeOutCubic(clamp01(frame / FPS / (MOTION.enterSec * 1.3)));
  if (layout.aspect === "portrait") return null;

  return (
    <AbsoluteFill
      style={{
        left: layout.stage.x,
        top: layout.stage.y,
        width: layout.stage.w,
        height: layout.u(TYPE.caption * 2.2),
        alignItems: "flex-start",
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
          // A shadow, so the chip reads as chrome above the picture rather than
          // as a label printed on it — the canvas is pale and so is the chip.
          boxShadow: `0 ${layout.u(6)}px ${layout.u(18)}px rgb(19 17 15 / 0.10)`,
          transform: `scale(${(0.82 + 0.18 * p).toFixed(4)})`,
          transformOrigin: "0% 0%",
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
