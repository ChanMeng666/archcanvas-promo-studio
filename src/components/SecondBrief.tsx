import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { FONT } from "../fonts";
import { MONTAGE, MONTAGE_PAGES, MONTAGE_PANE_ENTRY_FLOOR, drawState } from "../film-demo";
import { useLayout } from "../layout";
import { typedLength } from "../replica/at";
import { PlanSvg } from "../replica/parts/PlanSvg";
import { clamp01, easeOutCubic, easeOutExpo, frameToSec, type ResolvedBeat } from "../timeline";
import { APP, CANVAS_DOT_PITCH, CANVAS_DRIFT_PX, RADIUS, SPOT, STAGE, TRACKING, TYPE, WEIGHT } from "../tokens";
import { fitLines } from "../typefit";

/**
 * The 120 s cut's second brief: four more plans, four more briefs.
 *
 * ── Why a montage, and why these four ──────────────────────────────────────
 *
 * The long cut is the only one that can answer "is this one canned demo?", and
 * the only honest way to answer it is to draw a different building. Re-framing
 * the townhouse from another angle would be the film asserting a variety it had
 * not shown.
 *
 * So: four of the product's own PUBLISHED showcase plans — a family house, a
 * courtyard apartment, a neighbourhood clinic, a bedsit — each drawing itself
 * out under the brief it was actually given. The briefs and the titles are the
 * only text, and both come out of `src/lib/showcase.generated.ts` through the
 * sync. The film adds no sentence here, which is deliberate: "different brief,
 * same flow" is a claim nobody has cleared, and the four briefs make it without
 * anyone having to say it.
 *
 * ── How it draws ───────────────────────────────────────────────────────────
 *
 * With `PlanSvg`, the product's own renderer, and with the replica's own state
 * taken from a point inside its own `drawPlan` beat. Neither the layer order nor
 * the band overlaps are restated here — two drawings in one film that draw
 * differently is exactly the seam a viewer notices without being able to say
 * why.
 *
 * ⚠ **Inline SVG, and not one `<Img>`.** More than about twenty `<Img>` elements
 * in one object never finish rendering: Remotion registers a `delayRender` per
 * image and fails naming an arbitrary one, which reads like a corrupt file and
 * is not. Four plans as four images would be fine; four plans as four images
 * PLUS the renderings would not, and the failure only shows up in a full render.
 */
export const SecondBrief: React.FC<{ beat: ResolvedBeat }> = ({ beat }) => {
  const frame = useCurrentFrame();
  const layout = useLayout();

  // The beat's "replica window" indexes the montage rather than the screenplay:
  // `replicaFrom: 0, replicaTo: 2` is "the first two plans". `cuts.ts` says so
  // in its own comment, and `verify:timeline` still gets the window it requires
  // of a replica beat.
  const from = Math.max(0, Math.round(beat.replicaFrom ?? 0));
  const to = Math.min(MONTAGE.length, Math.round(beat.replicaTo ?? MONTAGE.length));
  const count = Math.max(1, to - from);

  const dur = Math.max(1, beat.durationInFrames);
  const p = clamp01(frame / dur);
  const slot = Math.min(count - 1, Math.floor(p * count));
  const local = clamp01(p * count - slot);

  const index = Math.min(MONTAGE.length - 1, from + slot);
  const plan = MONTAGE[index];
  const page = MONTAGE_PAGES[index];

  /*
   * The montage keeps the colour script running. Four plans over sixteen
   * seconds on one ground is the stretch where the film would go quiet again,
   * so each plan gets its own stage and the change lands on the slot boundary
   * with the plan.
   */
  const ground = MONTAGE_STAGES[index % MONTAGE_STAGES.length];

  return (
    <AbsoluteFill style={{ backgroundColor: ground }}>
      <Lattice frame={frame} pitch={layout.u(CANVAS_DOT_PITCH)} ground={ground} />
      <MontagePane key={index} plan={plan} page={page} p={local} layout={layout} />
    </AbsoluteFill>
  );
};

/**
 * One plan's four seconds: the brief types, then the drawing comes in under it.
 *
 * `key={index}` on the caller is what restarts this — without it React keeps the
 * same element across a slot change and the entrance never replays, which looks
 * exactly like the montage having frozen.
 */
const MontagePane: React.FC<{
  plan: (typeof MONTAGE)[number];
  page: (typeof MONTAGE_PAGES)[number];
  p: number;
  layout: ReturnType<typeof useLayout>;
}> = ({ plan, page, p, layout }) => {
  /*
   * TWO COLUMNS IN 16:9, STACKED IN 9:16 — and the first still pass is why.
   *
   * Stacked in both, the head (a title and three lines of brief) took 225 px
   * off the top of a 984 px picture box, and a plan whose own proportions are
   * near-square then fitted to the REMAINING height: an 837 px drawing in a
   * 1920 px frame with a third of the width empty on either side. A wide frame
   * has width to spend and no height to spare, so the words take the left and
   * the drawing takes the full height beside them. A phone frame is the other
   * way round.
   */
  const wide = layout.aspect === "landscape";
  const centred = !wide;

  // The brief is typed over the first fifth, the drawing runs from a beat later
  // to the end, and both leave together.
  const typed = plan.brief.slice(0, typedLength(plan.brief, clamp01(p / 0.22)));
  const draw = clamp01((p - 0.1) / 0.8);
  // Floored for the same reason `entryOpacity` is — see the constant, which
  // `verify:opening` reads so the gate checks the number the component uses.
  const enter =
    MONTAGE_PANE_ENTRY_FLOOR + (1 - MONTAGE_PANE_ENTRY_FLOOR) * easeOutExpo(clamp01(p / 0.1));
  const leave = 1 - clamp01((p - 0.93) / 0.07);

  const col = wide ? Math.round(layout.picture.w * 0.34) : layout.stage.w;
  const briefLines = breakBrief(typed, wide ? 30 : 38);
  const briefSize = fitLines(briefLines, {
    preferred: wide ? TYPE.body : TYPE.body * 0.88,
    min: TYPE.caption,
    maxWidth: col / layout.scale,
    weight: "medium",
  });

  const headTop = wide ? layout.picture.y + Math.round(layout.picture.h * 0.24) : layout.picture.y;
  const headH = wide ? 0 : layout.u(TYPE.caption * 2.4) + layout.u(briefSize * 1.32) * briefLines.length;

  const planBox = wide
    ? {
        x: layout.picture.x + col + layout.u(56),
        y: layout.picture.y,
        w: layout.picture.w - col - layout.u(56),
        h: layout.picture.h,
      }
    : {
        x: layout.picture.x,
        y: layout.picture.y + headH,
        w: layout.picture.w,
        h: Math.max(120, layout.picture.h - headH),
      };

  const [, , vw, vh] = plan.viewBox.trim().split(/[\s,]+/).map(Number);
  const aspect = vw > 0 && vh > 0 ? vw / vh : 1;
  const sheetW = Math.min(planBox.w, planBox.h * aspect);
  const sheetH = sheetW / aspect;

  return (
    <AbsoluteFill style={{ opacity: leave }}>
      {/* the plan's own title, in the machine voice */}
      <div
        style={{
          position: "absolute",
          left: wide ? layout.picture.x : layout.stage.x,
          top: headTop,
          width: col,
          display: "flex",
          justifyContent: centred ? "center" : "flex-start",
          alignItems: "center",
          gap: layout.u(12),
          opacity: enter,
          transform: `translateY(${((1 - enter) * layout.u(50)).toFixed(1)}px)`,
        }}
      >
        <span
          style={{
            width: layout.u(size(enter) * 34),
            height: layout.u(5),
            borderRadius: layout.u(3),
            backgroundColor: SPOT.action,
            display: centred ? "none" : "block",
            flex: "0 0 auto",
          }}
        />
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: layout.u(TYPE.caption * 0.86),
            fontWeight: WEIGHT.medium,
            letterSpacing: `${TRACKING.caps}em`,
            textTransform: "uppercase",
            color: APP.inkMuted,
            whiteSpace: "nowrap",
          }}
        >
          {plan.title}
        </span>
      </div>

      {/* the brief, as someone typed it */}
      <div
        style={{
          position: "absolute",
          left: wide ? layout.picture.x : layout.stage.x,
          top: headTop + layout.u(TYPE.caption * 1.9),
          width: col,
          display: "flex",
          flexDirection: "column",
          alignItems: centred ? "center" : "flex-start",
        }}
      >
        {briefLines.map((line, i) => (
          <span
            key={`${i}-${line}`}
            style={{
              fontFamily: FONT.sans,
              fontSize: layout.u(briefSize),
              fontWeight: WEIGHT.medium,
              letterSpacing: `${TRACKING.body}em`,
              lineHeight: 1.32,
              color: APP.ink,
              whiteSpace: "pre",
              textAlign: centred ? "center" : "left",
            }}
          >
            {line}
            {i === briefLines.length - 1 && typed.length < plan.brief.length ? <Caret layout={layout} /> : null}
          </span>
        ))}
      </div>

      {/* the drawing */}
      <div
        style={{
          position: "absolute",
          left: planBox.x + (planBox.w - sheetW) / 2,
          top: planBox.y + (planBox.h - sheetH) / 2,
          width: sheetW,
          height: sheetH,
          backgroundColor: "#ffffff",
          borderRadius: layout.u(RADIUS.control),
          border: `${Math.max(1, layout.u(1))}px solid ${APP.hairline}`,
          boxShadow: `0 ${layout.u(18)}px ${layout.u(48)}px rgb(19 17 15 / 0.10)`,
          overflow: "hidden",
          opacity: enter,
          transform: `scale(${(0.985 + 0.015 * easeOutCubic(clamp01(p / 0.14))).toFixed(4)})`,
        }}
      >
        <PlanSvg
          page={page}
          state={drawState(draw)}
          style={{ position: "absolute", inset: 0 }}
        />
      </div>
    </AbsoluteFill>
  );
};

/** One stage per montage plan, from the film's own script. */
const MONTAGE_STAGES = [STAGE.edit, STAGE.tweak, STAGE.draw, STAGE.export] as const;

const size = (p: number): number => 0.4 + 0.6 * p;

/** The typing caret, on the replica's own blink period. */
const Caret: React.FC<{ layout: ReturnType<typeof useLayout> }> = ({ layout }) => {
  const frame = useCurrentFrame();
  const on = Math.floor(frameToSec(frame) / 0.53) % 2 === 0;
  return (
    <span
      style={{
        display: "inline-block",
        width: layout.u(3),
        height: layout.u(TYPE.body * 0.78),
        marginLeft: layout.u(3),
        verticalAlign: "text-bottom",
        backgroundColor: SPOT.action,
        opacity: on ? 1 : 0,
      }}
    />
  );
};

/**
 * Break a brief onto lines at word boundaries, at most three.
 *
 * Authored breaks are the rule for the film's OWN copy (`copy.ts`), because a
 * sentence it wrote can be broken once and checked. These are the product's
 * briefs, four of them, of different lengths, at two frame shapes — authoring
 * eight break tables for text nobody in this repo may edit would be eight tables
 * to get wrong. Greedy wrapping at a character budget is the honest answer, and
 * the last line is elided rather than allowed to run off the frame.
 */
const MAX_BRIEF_LINES = 5;

const breakBrief = (text: string, budget: number): string[] => {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > budget && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
    if (lines.length === MAX_BRIEF_LINES) break;
  }
  if (lines.length < MAX_BRIEF_LINES && line) lines.push(line);
  return lines.length > 0 ? lines : [""];
};

/** The canvas lattice, drifting — the same ground the replica scenes stand on. */
const Lattice: React.FC<{ frame: number; pitch: number; ground: string }> = ({ frame, pitch, ground }) => {
  const drift = (frame * CANVAS_DRIFT_PX) % pitch;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: ground,
        backgroundImage: `radial-gradient(${APP.canvasDot} 1.4px, transparent 1.4px)`,
        backgroundSize: `${pitch}px ${pitch}px`,
        backgroundPosition: `${drift.toFixed(2)}px ${(drift * 0.6).toFixed(2)}px`,
      }}
    />
  );
};
