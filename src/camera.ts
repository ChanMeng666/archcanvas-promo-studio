/**
 * Where the replica is mounted, and where the camera looks.
 *
 * **React-free**, and that is the whole design. `capture/verify-honesty.mjs`
 * bundles this module and asks it, at real sampled frames, where the honesty
 * caption's box lands on screen — using the same arithmetic the component
 * renders with, not a re-derivation of it. A gate that re-implements what it
 * checks eventually disagrees with it, and then it is worse than no gate.
 *
 * ── The mount ──────────────────────────────────────────────────────────────
 *
 * The replica draws into a fixed DESIGN box (1600x1000 landscape, 1000x1333
 * portrait) and scales through one number, `--u`, px per design unit. So
 * mounting it is: fit the design box into the film's picture rectangle, take the
 * integer-free scale, centre what is left over. `unit` goes to the component as
 * a prop; everything else here exists to turn a design-space rectangle into film
 * pixels so the camera can aim at it.
 *
 * ── The push: two numbers, three obligations ───────────────────────────────
 *
 * `translate(tx, ty) scale(s)` about `0 0`. The first version scaled about a
 * `transform-origin` at the focus instead, which is tidier arithmetic and
 * wrong: scaling about a point leaves that point exactly where it was, so the
 * camera magnified without ever AIMING. One still showed it — the edit beat
 * pushed to 1.5x on the kitchen and left the kitchen in the right-hand third
 * with half the frame empty.
 *
 * With a translate the three things the frame owes are three constraints on the
 * same pair of numbers, and `framePush` intersects them:
 *
 *   coverage    the page behind the picture is never exposed.
 *   protection  the honesty caption, and the "AI-generated" pill whenever a
 *               rendering is on screen, stay whole. A push that frames the
 *               kitchen beautifully and slides the caption off the bottom edge
 *               is not a nice shot with a small problem — it is the film making
 *               a speed claim.
 *   aim         where this beat wanted to look.
 *
 * The aim is what gives way, and the scale gives way before either. The
 * renderer and the gate call the same function, so the picture cannot be right
 * in one and wrong in the other.
 */

import {
  layoutSpec,
  parseViewBox,
  planToWorld,
  sheetChrome,
  tweaksBox,
  worldToDesign,
  type LayoutId,
  type LayoutSpec,
  type Rect,
} from "./replica/layout";
import {
  exportMenuBox,
  findingCardBox,
  pinAnchors,
  resolveTarget,
  sheetOnScreen,
  targetContext,
  tweaksControls,
  type TargetContext,
} from "./replica/layoutMap";
import type { PlanPage } from "./replica/planTypes";
import { pickPage } from "./replica/resolvePages";
import type { ReplicaState } from "./replica/types";
import {
  CAPTION_SPAN,
  DEMO,
  OPEN_PIN_INDEX,
  OPEN_PIN_SEC,
  OPEN_PIN_TRAVEL,
  PAGES,
  RENDERING_SPAN,
  RENDERING_TRAVEL,
  overlaps,
  stateAt,
} from "./film-demo";
import { DRAFTING_SPAN } from "./honesty";
import type { Layout, StageRect } from "./layout-core";
import type { SceneId } from "./scenes";
import { clamp01, easeOutCubic, frameToSec, replicaSecondFor, type ResolvedBeat } from "./timeline";

/* ── the mount ────────────────────────────────────────────────────────────── */

export interface Mount {
  layout: LayoutId;
  spec: LayoutSpec;
  /** Px per design unit. Handed to `<StudioReplica unit={…}>`. */
  unit: number;
  /** The replica's own box in film pixels, centred in the picture rectangle. */
  rect: StageRect;
}

/** The film's picture box for a beat: the whole picture, or a split scene's top. */
export const mountReplica = (
  box: StageRect,
  layout: LayoutId,
  opts: { browserFrame: boolean; sheetAspect?: number },
): Mount => {
  const spec = layoutSpec(layout, { browserFrame: opts.browserFrame, sheetAspect: opts.sheetAspect });
  const unit = Math.min(box.w / spec.W, box.h / spec.H);
  const w = spec.W * unit;
  const h = spec.H * unit;
  return {
    layout,
    spec,
    unit,
    rect: { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h },
  };
};

/** A design-space rectangle, in film pixels. */
export const designRect = (m: Mount, r: Rect): StageRect => ({
  x: m.rect.x + r.x * m.unit,
  y: m.rect.y + r.y * m.unit,
  w: r.w * m.unit,
  h: r.h * m.unit,
});

/** A layoutMap point (normalised to the design box), in film pixels. */
export const designPoint = (m: Mount, v: { x: number; y: number }): { x: number; y: number } => ({
  x: m.rect.x + v.x * m.spec.W * m.unit,
  y: m.rect.y + v.y * m.spec.H * m.unit,
});

/** The smallest rectangle containing both. */
export const union = (a: StageRect, b: StageRect): StageRect => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

/** A rectangle grown by `pad` on every side. */
export const pad = (r: StageRect, p: number): StageRect => ({
  x: r.x - p,
  y: r.y - p,
  w: r.w + p * 2,
  h: r.h + p * 2,
});

export const centreOf = (r: StageRect): { x: number; y: number } => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/* ── the push ─────────────────────────────────────────────────────────────── */

export interface FramePush {
  scale: number;
  /** The translate, in film pixels, applied BEFORE the scale about `0 0`. */
  tx: number;
  ty: number;
  /** The scale was reduced to keep a protected rectangle whole. */
  scaleClamped: boolean;
  /** The framing was pulled back to keep a protected rectangle whole. */
  focusClamped: boolean;
}

export interface FrameInput {
  frameW: number;
  frameH: number;
  /** The push at this instant, already eased. >= 1. */
  scale: number;
  /** What the shot is about, in film pixels. */
  focus: { x: number; y: number };
  /** Rectangles that must stay entirely inside the frame, in film pixels. */
  protect?: readonly StageRect[];
  /**
   * Rectangles that must end up entirely BELOW the bottom edge, in film pixels.
   *
   * The money shot's case, and the only one: framed on the building, the studio's
   * own honesty caption belongs off screen — the film draws the sentence in its
   * own band instead. Half of it hanging into the bottom of the frame is the
   * state that would actually be wrong, and "push it further" is not a thing a
   * hand-tuned number can promise across eight compositions. Downward only,
   * because that is the one direction the caption can leave by and a general
   * four-way rule would be four ways to get it wrong.
   */
  expel?: readonly StageRect[];
  /**
   * The box a protected rectangle must stay inside, if not the whole frame.
   *
   * ⚠ A `split` scene CLIPS the picture at the top of its type band, and a rect
   * that is comfortably inside the frame can be entirely below that clip. The
   * 9:16 export beat is the case: the menu is a full-width bottom sheet, the
   * push slid it under the clip, and the master showed "Export the DXF." over a
   * menu whose DXF row had been cut off. Coverage still uses the whole frame —
   * it is the PROTECTION that is about what a viewer can see.
   */
  protectBounds?: StageRect;
  /** How far inside the protection bounds a protected rectangle must stay. */
  margin?: number;
  /**
   * Rows of TEXT that must end up wholly inside the clip or wholly past it,
   * each with the direction chosen for the beat.
   *
   * ⚠ A TRANSLATE, never a scale, and that is the whole design. Expelling the
   * sheet's caption row raised the scale until the honesty caption and the
   * "AI-generated" pill cropped — nine failures across the vertical masters —
   * because everything in the lower third of the 9:16 design moves together.
   * A vertical nudge of a few tens of pixels moves the row across the edge and
   * leaves the composition where it was.
   *
   * The direction is decided per BEAT and passed in, not re-chosen per frame:
   * the choice flips when the row is exactly half across, and a nudge that
   * flipped mid-beat would jump by the row's own height.
   */
  nudge?: readonly { rect: StageRect; dir: 1 | -1 }[];
  /** The edge the nudge is about — the picture clip, in film pixels. */
  nudgeEdge?: number;
  /** The most a nudge may move the picture. */
  nudgeMax?: number;
}

const clampTo = (v: number, lo: number, hi: number): number =>
  hi < lo ? (lo + hi) / 2 : v < lo ? lo : v > hi ? hi : v;

/**
 * How far toward the middle of the frame a push brings the thing it is about.
 *
 * ⚠ 0 was the first version, by accident: scaling about a `transform-origin` AT
 * the focus keeps that point exactly where it already was, so the camera
 * MAGNIFIED without ever AIMING. The still pass named it in one frame — the edit
 * beat pushed to 1.5 on the kitchen and left the kitchen in the right-hand third
 * with half the frame empty, because the kitchen had been in the right-hand
 * third at 1.0 too.
 *
 * Not 1 either. A subject nailed to the exact centre of every shot reads as a
 * slideshow of centred screenshots; leaving a fifth of the offset is what makes
 * a frame look composed rather than cropped.
 */
const RECENTRE = 0.8;

/**
 * The transform for one frame: `translate(tx, ty) scale(s)` about `0 0`.
 *
 * Written as a translate and a scale rather than as a scale about a moving
 * origin, because aiming and magnifying are two different things and the first
 * version conflated them. In this form the three obligations are three
 * constraints on the SAME pair of numbers:
 *
 *   coverage    `tx` in `[-(s-1)·W, 0]`, so the page behind the picture is
 *               never exposed.
 *   protection  `margin ≤ r·s + tx ≤ W − margin` for every rectangle that may
 *               not be cropped.
 *   aim         `tx = anchor − focus·s`, the framing this beat asked for.
 *
 * The aim is what gives way. It is clamped into the intersection of the other
 * two, and `focusClamped` says when it had to be — so a framing that would crop
 * the honesty caption comes out as a slightly wider shot with a flag on it,
 * rather than as a compliant-looking film that is not.
 */
export const framePush = ({
  frameW,
  frameH,
  scale,
  focus,
  protect = [],
  expel = [],
  protectBounds,
  margin = 8,
  nudge = [],
  nudgeEdge,
  nudgeMax = 48,
}: FrameInput): FramePush => {
  const bounds = protectBounds ?? { x: 0, y: 0, w: frameW, h: frameH };
  let s = Number.isFinite(scale) && scale > 1 ? scale : 1;
  let scaleClamped = false;

  // A rectangle wider than the frame at scale `s` cannot be kept whole by ANY
  // translate, so the scale gives way before the obligation does.
  for (const r of protect) {
    if (r.w > 0) {
      const cap = (bounds.w - 2 * margin) / r.w;
      if (cap < s) {
        s = Math.max(1, cap);
        scaleClamped = true;
      }
    }
    if (r.h > 0) {
      const cap = (bounds.h - 2 * margin) / r.h;
      if (cap < s) {
        s = Math.max(1, cap);
        scaleClamped = true;
      }
    }
  }

  /*
   * An expelled rectangle raises the scale until it CAN leave the frame.
   *
   * The translate is bounded above by 0 (coverage), so at best the rectangle
   * sits at `r.y * s`. Requiring that to clear the bottom edge is a floor on the
   * scale, and solving it here rather than hoping the authored `fill` is big
   * enough is what makes the rule hold in all eight compositions instead of the
   * two it was tuned in.
   *
   * ⚠ Against the FRAME, not against `bounds`. Protection asks "can a viewer see
   * all of it", so it is bounded by the band or the clip; expulsion asks "is it
   * gone", and a rectangle below the band but inside the frame is not gone — it
   * is a second copy of the sentence, five pixels of it showing. Measuring
   * expulsion against `bounds` produced exactly that, and `verify:honesty`
   * caught it as four "half" failures.
   */
  for (const r of expel) {
    if (!(r.y > 0)) continue;
    const need = (frameH + margin) / r.y;
    if (need > s) {
      s = need;
      scaleClamped = true;
    }
  }

  if (s <= 1 + 1e-9) {
    return { scale: 1, tx: 0, ty: 0, scaleClamped, focusClamped: false };
  }

  const fx = Number.isFinite(focus.x) ? focus.x : frameW / 2;
  const fy = Number.isFinite(focus.y) ? focus.y : frameH / 2;

  // A hold is a hold: the recentre fades in with the push, so a beat that barely
  // moves does not slide its subject across the frame to get there.
  // Toward the middle of what a VIEWER CAN SEE, not the middle of the frame. In
  // a split scene the lower fifth is the type band, so aiming at the frame's
  // centre pulls the subject down behind it and crops its top edge off the
  // screen — which is exactly what the split beats' stills showed.
  const aim = RECENTRE * clamp01((s - 1) / 0.2);
  const anchorX = fx + (bounds.x + bounds.w / 2 - fx) * aim;
  const anchorY = fy + (bounds.y + bounds.h / 2 - fy) * aim;

  let loX = -(s - 1) * frameW;
  let hiX = 0;
  let loY = -(s - 1) * frameH;
  let hiY = 0;
  for (const r of protect) {
    loX = Math.max(loX, bounds.x + margin - r.x * s);
    hiX = Math.min(hiX, bounds.x + bounds.w - margin - (r.x + r.w) * s);
    loY = Math.max(loY, bounds.y + margin - r.y * s);
    hiY = Math.min(hiY, bounds.y + bounds.h - margin - (r.y + r.h) * s);
  }
  for (const r of expel) {
    loY = Math.max(loY, frameH + margin - r.y * s);
  }

  const wantX = anchorX - fx * s;
  const wantY = anchorY - fy * s;
  const tx = clampTo(wantX, loX, hiX);
  const ty = clampTo(wantY, loY, hiY);

  /*
   * The nudge, last, and bounded by everything above it.
   *
   * It runs AFTER the protection clamp and is put back through it, so the
   * honesty caption and the pill stay authoritative: a nudge that would crop
   * either is reduced to whatever fits, and where the outward move is the one
   * that gets clamped away the inward one is tried instead — "prefer pulling
   * the row IN" is a fallback rather than a preference, because a row pulled in
   * is legible and a row pushed half-way is the defect.
   */
  let nudged = ty;
  if (nudgeEdge !== undefined && nudge.length > 0) {
    const needed = (dir: 1 | -1, r: StageRect): number => {
      const top = r.y * s + ty;
      const bot = (r.y + r.h) * s + ty;
      if (top >= nudgeEdge - 1e-6 || bot <= nudgeEdge + 1e-6) return 0;
      return dir > 0 ? nudgeEdge - top : nudgeEdge - bot;
    };
    let want = 0;
    let fallback = 0;
    for (const n of nudge) {
      const d = needed(n.dir, n.rect);
      if (Math.abs(d) > Math.abs(want)) want = d;
      const back = needed(n.dir > 0 ? -1 : 1, n.rect);
      if (Math.abs(back) > Math.abs(fallback)) fallback = back;
    }
    const cap = (v: number) => Math.max(-nudgeMax, Math.min(nudgeMax, v));
    const first = clampTo(ty + cap(want), loY, hiY);
    // Did the protection clamp eat it? Then take the other direction.
    nudged = Math.abs(first - ty) + 1e-6 < Math.abs(cap(want))
      ? clampTo(ty + cap(fallback), loY, hiY)
      : first;
  }

  return {
    scale: s,
    tx,
    ty: nudged,
    scaleClamped,
    focusClamped: Math.abs(tx - wantX) > 0.5 || Math.abs(ty - wantY) > 0.5,
  };
};

/** Where a film-pixel rectangle lands once a push is applied. */
export const pushRect = (p: FramePush, r: StageRect): StageRect => ({
  x: r.x * p.scale + p.tx,
  y: r.y * p.scale + p.ty,
  w: r.w * p.scale,
  h: r.h * p.scale,
});

/** The push as a CSS transform. One place, so the gate and the DOM agree. */
export const pushTransform = (p: FramePush): string =>
  p.scale <= 1 + 1e-9
    ? "none"
    : `translate(${p.tx.toFixed(2)}px, ${p.ty.toFixed(2)}px) scale(${p.scale.toFixed(5)})`;

/** True when the rectangle is entirely inside the frame, with `margin` to spare. */
export const insideFrame = (r: StageRect, frameW: number, frameH: number, margin = 0): boolean =>
  r.x >= margin - 0.5 &&
  r.y >= margin - 0.5 &&
  r.x + r.w <= frameW - margin + 0.5 &&
  r.y + r.h <= frameH - margin + 0.5;

/* ── what each scene looks at ─────────────────────────────────────────────── */

/**
 * The design-space rectangle a scene's camera is about.
 *
 * Aimed through the replica's own `layoutMap` wherever there is a target for it
 * — the sheet as it is actually on screen, the pin the cursor opened, the row
 * the export menu drew — so a camera cannot drift from the thing it is framing
 * when a layout or a storey count changes. `null` means "the whole picture",
 * which is what the fallback centre already is.
 */
/**
 * The drafting card, as the card is actually DRAWN.
 *
 * ⚠ `spec.draftCard` is 300 units tall and the rendered card is about 400: the
 * card grew a row of room chips and a second status line, and the layout spec's
 * rectangle did not follow. Framed on the spec's rect the beat pushed to 2.37x
 * and the card's last line ran off under the film's honesty band — visible at
 * 12 s in the 60 s cut, which is how it was found.
 *
 * The pad is measured off that frame, not chosen. It is a FILM-SIDE workaround
 * for a stale number in a one-way copy we may not edit (`src/replica/**`), and
 * it should be deleted the moment the product's own spec is corrected — which
 * has been reported upstream. `docs/decisions.md` D28.
 *
 * The card is framed in UNION with the product's own caption, because on this
 * beat the product says the sentence itself: a close-up of the card alone put
 * the caption half off the bottom edge, and the film's band — which is what
 * covers for that — then sat across the card's last two lines. One shot with
 * both in it is the only framing that owes nothing.
 */
const DRAFT_CARD_SPEC_SHORTFALL = 100;

const draftCardBox = (spec: LayoutSpec): Rect => ({
  ...spec.draftCard,
  h: spec.draftCard.h + DRAFT_CARD_SPEC_SHORTFALL,
});

/**
 * How far through a travel window a given second is, eased.
 *
 * `undefined` means "no frame given", and the answer is 1 — the settled
 * composition, which is what every caller that is not the renderer wants.
 */
const travel = (at: number | undefined, win: { from: number; to: number }): number => {
  if (at === undefined) return 1;
  if (!(win.to > win.from)) return 1;
  // Ease in AND out: the move starts from a hold and lands on one, which is
  // what makes it read as a camera move rather than as a cut that slid.
  const p = clamp01((at - win.from) / (win.to - win.from));
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
};

/**
 * One eased move between two resolved PUSHES.
 *
 * Scale on a LOG axis, translate linearly — the same reason `pushAt`
 * interpolates `log(scale)`: zoom is perceived multiplicatively, and a linear
 * ramp reads as slowing down at the wrong end.
 */
const lerpPush = (a: FramePush, b: FramePush, p: number): FramePush => {
  if (p >= 1) return b;
  if (p <= 0) return a;
  return {
    scale: Math.exp(Math.log(a.scale) + (Math.log(b.scale) - Math.log(a.scale)) * p),
    tx: a.tx + (b.tx - a.tx) * p,
    ty: a.ty + (b.ty - a.ty) * p,
    scaleClamped: a.scaleClamped || b.scaleClamped,
    focusClamped: a.focusClamped || b.focusClamped,
  };
};

/** One eased move between two framings. */
const lerpRect = (a: Rect, b: Rect, p: number): Rect =>
  p >= 1 ? b : p <= 0 ? a : { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, w: a.w + (b.w - a.w) * p, h: a.h + (b.h - a.h) * p };

/**
 * How far through its travel a beat is, or `null` when it does not travel.
 *
 * Exported so `shotFor` can interpolate the resolved PUSH rather than the focus
 * RECT — see the note there. `receipt` and `render` are the two, and the
 * windows are the screenplay's own.
 */
export const travelProgress = (
  scene: SceneId,
  span: { from: number; to: number } | undefined,
  at: number | undefined,
): number | null => {
  if (at === undefined || !span) return null;
  if (scene === "receipt" && overlaps(span, OPEN_PIN_TRAVEL)) return travel(at, OPEN_PIN_TRAVEL);
  if (scene === "render" && overlaps(span, RENDERING_SPAN)) return travel(at, RENDERING_TRAVEL);
  return null;
};

export const focusRectFor = (
  scene: SceneId,
  ctx: TargetContext,
  /** The beat's replica window, for the decisions that are about the beat. */
  span?: { from: number; to: number },
  /**
   * The replica second this FRAME is at, for the two beats that travel.
   *
   * Omitted, every beat returns its settled composition — which is what the
   * cropping and hero checks want, and what every other beat does at every
   * frame. Supplied, `receipt` and `render` blend from what is on screen now to
   * what the beat is about, over a window read off the screenplay. See
   * `film-demo.ts` § OPEN_PIN_TRAVEL.
   */
  at?: number,
): Rect | null => {
  const { spec, state } = ctx;

  switch (scene) {
    case "brief":
      return spec.composer.card;

    case "second-brief":
      return null;

    case "draw":
      // The drafting card on the beat the card OWNS; the BUILDING on the beat
      // the drawing owns. Decided from the beat's window rather than from
      // `state.drafting.visible`, because the sheet outlives the drawing's first
      // strokes by half a second — read per frame, the framing would have
      // snapped in the middle of the money shot's opening.
      return span && overlapFraction(span, DRAFTING_SPAN) > 0.5
        ? unionR(draftCardBox(spec), spec.caption)
        : buildingBox(ctx) ?? sheetOnScreen(ctx);

    case "edit": {
      // The kitchen AND the command bar someone is typing into: the beat is the
      // sentence and the change it makes, and a frame with only one of them is
      // half the beat.
      const p = resolveTarget(ctx, { kind: "room", archId: DEMO.kitchen.archId });
      const building = buildingBox(ctx);
      const w = (building?.w ?? spec.W * 0.4) * 0.72;
      const h = (building?.h ?? spec.H * 0.4) * 0.72;
      const room: Rect = { x: p.x * spec.W - w / 2, y: p.y * spec.H - h / 2, w, h };
      return unionR(room, spec.commandBar);
    }

    case "tweak": {
      // The knob and the wall it moves, and nothing else.
      const panel = tweaksBox(spec);
      const building = buildingBox(ctx) ?? sheetOnScreen(ctx);
      return unionR(spec.tweaks.mode === "docked" ? panel : tweaksControls(ctx).track, building);
    }

    case "receipt": {
      /*
       * ⚠ Framed against the findings the beat WILL have, not the ones the
       * current frame happens to hold.
       *
       * `pinAnchors` reads them off the state, and the state has none until the
       * pins start dropping a second into the beat — so the shot opened wide on
       * the sheet at 1.9x and snapped to 4.5x the instant they appeared. A
       * framing that changes because its subject arrived is the same lurch the
       * per-beat protection rule exists to stop; the beat is ABOUT the findings
       * from its first frame.
       */
      const settled = settledReview(ctx);
      const anchors = pinAnchors(settled);
      const building0 = buildingBox(ctx) ?? sheetOnScreen(ctx);
      /*
       * BEFORE a pin is opened there is no card to read, and the subject is the
       * three pins landing on the drawing — so the shot holds all of them and
       * the building. The contact sheet caught the other version: aimed at the
       * first finding, which is the sheet-wide one and therefore anchored to the
       * paper's top edge, the 120 s cut's first receipt beat was six seconds of
       * empty canvas with a corner of drawing in it.
       */
      const pinsWide = anchors.reduce<Rect>(
        (acc, a) => unionR(acc, { x: a.x - 20 * spec.ck, y: a.y - 30 * spec.ck, w: 40 * spec.ck, h: 40 * spec.ck }),
        building0,
      );
      if (!span || span.to < OPEN_PIN_SEC) return pinsWide;
      const a = anchors[OPEN_PIN_INDEX] ?? anchors[0];
      if (!a) return sheetOnScreen(ctx);
      /*
       * The card that has to be READ, the pin it belongs to, and enough of the
       * building around that pin to see what the finding is about.
       *
       * ⚠ The third term is not decoration. The card sits on the empty canvas
       * BESIDE the paper, so a frame holding only the card and the pin is mostly
       * empty canvas — the contact sheet showed the receipt beat opening on a
       * pale rectangle with a sliver of drawing at one edge. Half the building
       * around the pin keeps a drawing in frame without widening the shot to the
       * point where the sentence in the card stops being legible.
       */
      const pinBox: Rect = { x: a.x - 20 * spec.ck, y: a.y - 30 * spec.ck, w: 40 * spec.ck, h: 40 * spec.ck };
      const building = buildingBox(ctx) ?? sheetOnScreen(ctx);
      const near: Rect = {
        x: a.x - building.w * 0.26,
        y: a.y - building.h * 0.26,
        w: building.w * 0.52,
        h: building.h * 0.52,
      };
      const card = findingCardBox(settled, a);
      const settledShot = card ? unionR(unionR(pinBox, card), near) : unionR(pinBox, building);
      return lerpRect(pinsWide, settledShot, travel(at, OPEN_PIN_TRAVEL));
    }

    case "storey": {
      const chrome = sheetChrome(spec, ctx.storeys, state.review.badgeCount);
      return unionR(chrome.storeyGroup, buildingBox(ctx) ?? sheetOnScreen(ctx));
    }

    case "render": {
      const drawing = buildingBox(ctx) ?? sheetOnScreen(ctx);
      if (!span || !overlaps(span, RENDERING_SPAN)) return drawing;
      // Same travel as the receipt beat, for the same reason: until the
      // rendering has faded in, its half of the frame is a hole.
      return lerpRect(drawing, unionR(spec.rendering, drawing), travel(at, RENDERING_TRAVEL));
    }

    case "export":
      return unionR(exportMenuBox(ctx), buildingBox(ctx) ?? sheetOnScreen(ctx));

    default:
      return null;
  }
};

/**
 * The BUILDING's box in design coordinates — the union of the page's rooms,
 * padded — rather than the paper's.
 *
 * ⚠ The difference is the whole money shot. The sheet is the paper, and the
 * drawing occupies about two thirds of it: framing the sheet to 85 % of the
 * frame puts the building at 56 %, which is what the first cut looked like and
 * why the art-direction note said the UI was too small. Framing THIS to 85 %
 * puts the building at 85 %.
 *
 * Static across a beat: room boxes come from the baked page, so a plan that is
 * only half drawn is framed for the plan it will be. A framing that grew as the
 * drawing appeared would be a camera chasing its own subject.
 */
export const buildingBox = (ctx: TargetContext): Rect | null => {
  const page = ctx.page;
  if (!page || page.rooms.length === 0) return null;
  const vb = parseViewBox(page.viewBox);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const room of page.rooms) {
    const [x0, y0, x1, y1] = room.bbox;
    const a = planToWorld(ctx.spec, vb, x0, y0);
    const b = planToWorld(ctx.spec, vb, x1, y1);
    minX = Math.min(minX, a.x, b.x);
    minY = Math.min(minY, a.y, b.y);
    maxX = Math.max(maxX, a.x, b.x);
    maxY = Math.max(maxY, a.y, b.y);
  }
  if (!Number.isFinite(minX)) return null;
  const tl = worldToDesign(ctx.spec, ctx.state.camera, minX, minY);
  const br = worldToDesign(ctx.spec, ctx.state.camera, maxX, maxY);
  // A building framed to its own walls has no air. 9 % on every side is the
  // dimension chains and enough paper to read it as a drawing on a sheet.
  const w = br.x - tl.x;
  const h = br.y - tl.y;
  return { x: tl.x - w * 0.09, y: tl.y - h * 0.09, w: w * 1.18, h: h * 1.18 };
};

/**
 * Every ROOM LABEL on the drawing, as a rectangle in design space.
 *
 * ── Why the drawing's own type needed a rule ───────────────────────────────
 *
 * `verify:framing`'s bisection rule knew the studio's CHROME — the sheet's
 * caption row, the command bar — and not the one kind of type the film is
 * actually about. In 9:16 the render beat cropped the sheet at the right frame
 * edge straight through `Living / Dining` and `Kitchen`, in both edits and
 * every vertical cut that has a render beat. A room label cut in half is worse
 * than a chrome row cut in half: it is the product's answer to the brief,
 * unreadable, in the beat that exists to show it.
 *
 * ── Derived, not re-drawn ──────────────────────────────────────────────────
 *
 * The labels are `page.texts` — the compiler's own `<text>` leaves, with their
 * own `x`, `y`, `font-size` and `text-anchor` — mapped through the SAME
 * `planToWorld` → `worldToDesign` pair `PlanSvg` draws them with and
 * `buildingBox` frames against. Nothing is re-derived, so nothing can drift.
 *
 * ⚠ The BOX is conservative and says so. The film cannot measure text without
 * fonts (`CLAUDE.md`: measure layout only after `document.fonts.ready`), so the
 * width is `characters x font-size x ADVANCE`. {@link LABEL_ADVANCE} is above
 * the real average advance of the replica's sans on purpose: over-estimating a
 * label's width makes the gate complain early, which is the right direction to
 * be wrong in for type the viewer is meant to read.
 */
const LABEL_ADVANCE = 0.62;

/** Ascent above the baseline, as a fraction of the font size. */
const LABEL_ASCENT = 0.82;

export const roomLabelRects = (ctx: TargetContext): Rect[] => {
  const page = ctx.page;
  if (!page || page.texts.length === 0) return [];
  const vb = parseViewBox(page.viewBox);
  const out: Rect[] = [];

  /*
   * ⚠ ROOM LABELS, not every `<text>` on the sheet.
   *
   * `page.texts` also carries the dimension chains — `7800`, `1400`, `550` —
   * and those are a TEXTURE: they run off the edge of a punched-in shot by
   * design, the way the drawing does, and a rule that banned it would ban the
   * film's entire camera language. Measured before the filter: 42 beats red in
   * edit B and 41 in A, which is nearly every replica beat and is the gate
   * telling you it is asking the wrong question.
   *
   * A room's name and its area are content: they are the product's answer to
   * the brief. They are identified by the compiler's own `archId` — the same id
   * `rooms[]` carries and the same one selection uses — with the label text as
   * the fallback for a page whose texts are not id-tagged.
   */
  const roomIds = new Set(page.rooms.map((r) => r.archId));
  const roomLabels = new Set(page.rooms.map((r) => r.label));

  for (const t of page.texts) {
    const text = (t.text ?? "").trim();
    if (!text) continue;
    if (!(t.archId && roomIds.has(t.archId)) && !roomLabels.has(text)) continue;
    const x = Number(t.attrs.x);
    const y = Number(t.attrs.y);
    const size = Number(t.attrs["font-size"]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(size) || size <= 0) continue;

    const w = text.length * size * LABEL_ADVANCE;
    const anchor = t.attrs["text-anchor"];
    // `middle` and `end` move the box, not the anchor point. The compiler emits
    // both, and reading the attribute is cheaper than being wrong about it.
    const left = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
    const top = y - size * LABEL_ASCENT;

    const a = planToWorld(ctx.spec, vb, left, top);
    const b = planToWorld(ctx.spec, vb, left + w, top + size * 1.2);
    const tl = worldToDesign(ctx.spec, ctx.state.camera, Math.min(a.x, b.x), Math.min(a.y, b.y));
    const br = worldToDesign(ctx.spec, ctx.state.camera, Math.max(a.x, b.x), Math.max(a.y, b.y));
    out.push({ x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y });
  }
  return out;
};

/**
 * The same context with the review chapter's findings already in place.
 *
 * The receipt beat's framing must not depend on whether the pins have landed
 * yet — see the branch that uses it. `DEMO.findings` is what the beat drops, so
 * this is the state the beat is heading for rather than an invention.
 */
const settledReview = (ctx: TargetContext): TargetContext => ({
  ...ctx,
  state: {
    ...ctx.state,
    review: {
      ...ctx.state.review,
      findings: DEMO.findings,
      badgeCount: DEMO.findings.length,
      openPin: OPEN_PIN_INDEX,
    },
  },
});

/**
 * The things a viewer can actually SEE on the replica right now, in design
 * space.
 *
 * ⚠ The word is *visible*, and it is the whole point. `focusRectFor` frames a
 * beat against what the beat is ABOUT — deliberately, because a framing that
 * changes because its subject arrived is a lurch. The cost is the other failure:
 * a shot framed for "the pin and its open card" holds a card-shaped hole for as
 * long as the card takes to appear, and the master's 19.5 s frame in the 30 s
 * cut was half bare canvas with the drawing cropped off the right edge.
 *
 * So this reports what is on screen at THIS second, and `verify:framing` uses it
 * to ask whether the frame is mostly a space being saved for something that is
 * not there yet. The 0.5 thresholds are the same "readable" line the honesty
 * gate uses for the caption; a thing half faded in is a thing a viewer sees.
 */
export const visibleSubjects = (ctx: TargetContext): Rect[] => {
  const { spec, state } = ctx;
  const out: Rect[] = [];

  /*
   * The PAPER, not the building. A wide shot of the whole sheet is a composed
   * frame; measured against the building inside it, the same shot looks like a
   * small object in a large emptiness. What a viewer reads here is the drawing
   * ON its sheet.
   */
  if (state.actProgress >= 0.5) {
    out.push(sheetOnScreen(ctx));
    // The command bar is on screen through the whole of Act II and it is real
    // interface, not canvas — a frame that holds the drawing and the bar is not
    // holding a space for anything.
    out.push(spec.commandBar);
  } else {
    // The whole Act I column — heading, card and hint. The card alone left the
    // top third of the frame "empty" in the gate's eyes while a viewer was
    // reading a heading in it.
    out.push(unionR(unionR(spec.composer.heading, spec.composer.card), spec.composer.hint));
  }

  if (state.drafting.visible) out.push(draftCardBox(spec));

  const anchors = pinAnchors(ctx);
  anchors.forEach((a, i) => {
    if (!a.onThisPage) return;
    if ((state.review.pinsDropped[i] ?? 0) < 0.5) return;
    out.push({ x: a.x - 20 * spec.ck, y: a.y - 30 * spec.ck, w: 40 * spec.ck, h: 40 * spec.ck });
  });
  const open = state.review.openPin;
  if (open !== null) {
    const a = anchors[open];
    if (a?.onThisPage) {
      const card = findingCardBox(ctx, a);
      if (card) out.push(card);
    }
  }

  if (state.rendering.p >= 0.5) out.push(spec.rendering);
  if (state.exportMenu.open >= 0.5) out.push(exportMenuBox(ctx));
  if (state.tweaks.open >= 0.5) out.push(spec.tweaks.mode === "docked" ? tweaksBox(spec) : tweaksControls(ctx).track);

  return out;
};

/**
 * The sheet's own CAPTION ROW — the line under the paper that names the design
 * — in design space, or `null` when there is no sheet on screen.
 *
 * ⚠ It is text, it is the width of a sentence, and in 9:16 it was being cut in
 * half by the clip: eleven beats across the four vertical cuts showed
 * `-storey Townhouse`, with "Two" outside the frame, at about 40 px.
 *
 * Resolved through `sheetChrome` and `worldToDesign`, the same geometry the
 * component draws the row with, so it cannot drift from what is on screen —
 * and exported so `verify:framing` asserts against the same rect rather than a
 * second copy of it.
 */
export const sheetCaptionRect = (ctx: TargetContext): Rect | null => {
  const { spec, state } = ctx;
  if (state.actProgress < 0.5) return null;
  const chrome = sheetChrome(spec, ctx.storeys, state.review.badgeCount);
  const cap = chrome.caption;
  const tl = worldToDesign(spec, state.camera, cap.x, cap.y);
  const z = state.camera.zoom;
  return { x: tl.x, y: tl.y, w: cap.w * z, h: cap.h * z };
};

/** How much of `a` lies inside `b`, 0..1. */
const overlapFraction = (a: { from: number; to: number }, b: { from: number; to: number }): number => {
  const width = a.to - a.from;
  if (!(width > 0)) return 0;
  return Math.max(0, Math.min(a.to, b.to) - Math.max(a.from, b.from)) / width;
};

const unionR = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

/* ── the whole shot ───────────────────────────────────────────────────────── */

export interface Shot {
  /** Screenplay seconds. */
  t: number;
  state: ReplicaState;
  page: PlanPage | null;
  mount: Mount;
  push: FramePush;
  /** The replica's own honesty caption, in film pixels AFTER the push. */
  captionRect: StageRect;
  /** The film draws the sentence on this beat; the replica's own may leave frame. */
  filmCaption: boolean;
  /** How opaque that caption is at this instant, 0..1. */
  captionOpacity: number;
  /** The rendering card's box after the push, and how opaque it is. */
  renderingRect: StageRect;
  renderingOpacity: number;
}

/**
 * Everything a frame of a replica beat needs, from a SEQUENCE-LOCAL frame.
 *
 * ⚠ Local, not absolute. Inside a `<Sequence>` `useCurrentFrame()` counts from
 * the sequence's start; WP-7 found a helper that subtracted `beat.startFrame`
 * from one, clamped to zero and pinned the product's clock to the start of every
 * beat — the push ran, the cards animated, and the interface stood still.
 */
/**
 * The bottom edge of the frame a viewer can actually SEE the replica in.
 *
 * A split scene's type band ends it early: below the clip the replica is covered
 * by opaque film furniture, so framing it there is framing it nowhere. `fill`,
 * the aim and the protected rectangles all measure against this. Only COVERAGE
 * still uses the whole frame — the page behind the picture must never show,
 * including under a band.
 *
 * ⚠ The film's OWN honesty band is deliberately NOT counted here, and it was
 * tried. The band is a centred pill, not a full-width slab, and ending the frame
 * at its top cost the money shot 30 % of its size in every cut — a small plan in
 * an empty frame, which is the defect the art-direction round exists to fix. The
 * one place the band genuinely covered something was the drafting card's last
 * two lines, and that is fixed where it belongs: those beats keep the product's
 * own caption and the film does not draw a band at all (`timeline.ts` §
 * draftShare).
 */
export const visibleBottom = (layout: Layout, clipBottom?: number): number =>
  clipBottom === undefined ? layout.height : Math.min(layout.height, clipBottom);

/**
 * Which scenes may show an OPEN finding card.
 *
 * The receipt beat is about the card: it opens, it is read, the camera is framed
 * on it. Every later beat inherits `openPin` from the screenplay's state machine
 * and is framed on something else entirely — so the card sits outside the frame
 * and the product draws a dashed violet leader from a pin on screen to a card
 * that is not. A line pointing off the edge at nothing is a rendering bug to a
 * viewer, whatever it means to the state machine.
 *
 * ⚠ This is a HOST decision, not an edit to the replica: `state` is a prop, a
 * closed finding card is an ordinary product state (the user dismissed it), and
 * the film already chooses which second of the screenplay to show. `src/replica`
 * is untouched.
 */
const showOpenFinding = (scene: SceneId): boolean => scene === "receipt";

/*
 * ⚠ STILL NEEDED after the product added `ReviewFinding.level`, and the reason
 * is worth keeping: upstream now hides a pin, its card and its leader on the
 * storey the finding is not about, which fixes the L1 case completely. It does
 * not fix — and should not — the case this is for: on the EXPORT beat the card
 * is on the right storey and simply outside the camera's frame, so the leader
 * still crossed the picture to a card half off the left edge. Checked, not
 * assumed: `--at 60-Land:52` with this forced true.
 */

const closeFinding = (state: ReplicaState): ReplicaState =>
  state.review.openPin === null ? state : { ...state, review: { ...state.review, openPin: null } };

/**
 * The drafting sheet is not part of the 9:16 money shot.
 *
 * ── Measured, after three attempts at keeping it ───────────────────────────
 *
 * Upstream deliberately holds the sheet up while the drawing starts underneath
 * it, so the money-shot beat opens with the card on screen for about half a
 * second. In 16:9 that is a good half-second: the card is 78 % of the frame
 * width, legible, with the walls coming up behind it. In 9:16 the same card is
 * **2491 px wide in a 1080 px frame — 231 %** — and it arrives cropped through
 * its own words on both sides: `...y Townhouse`, `Kitche...`, `...ting and
 * reviewing your plan — usu...`.
 *
 * Containing it is not available. At the money shot's 2.60x it would take a
 * scale of about **1.07** to fit the card across, which is not a punch-in from
 * a held framing, it is a different shot — and at 1.07 the product's own
 * honesty caption is back inside the frame, so it can no longer be expelled and
 * `verify:honesty` fails eight ways on "whole or gone, never half". That was
 * measured twice, once as a protection and once as an eased `lerpPush`.
 *
 * So in 9:16 the card is GONE rather than half. A row of type is whole or it is
 * gone; a card is no different, and the sheet legitimately disappears a moment
 * later anyway.
 *
 * ⚠ A HOST decision, not an edit to the replica — the same standing as
 * `closeFinding` above. `state` is a prop, a dismissed drafting sheet is an
 * ordinary product state, and the film already chooses which second of the
 * screenplay to show. `src/replica` is untouched.
 *
 * Only in 9:16, and only on the beat that frames past the caption: the 16:9
 * hand-over keeps the card because there it reads.
 */
const hideDraftingSheet = (state: ReplicaState): ReplicaState =>
  state.drafting.visible ? { ...state, drafting: { ...state.drafting, visible: false } } : state;

export const shotFor = (
  beat: ResolvedBeat,
  localFrame: number,
  layout: Layout,
  box: StageRect,
  opts: { browserFrame: boolean; clipBottom?: number },
): Shot => {
  const dur = Math.max(1, beat.durationInFrames);
  const localSec = frameToSec(localFrame);
  const p = clamp01(localSec / frameToSec(dur));

  const from = beat.replicaFrom ?? 0;
  const to = beat.replicaTo ?? from;
  // Piecewise inside a drawing beat, constant everywhere else. `timeline.ts`
  // attached the knots; this does not decide, it reads.
  const t = replicaSecondFor(beat, p);

  const raw = showOpenFinding(beat.scene) ? stateAt(t) : closeFinding(stateAt(t));
  const state = layout.aspect === "portrait" && beat.expelsCaption ? hideDraftingSheet(raw) : raw;
  const probe = mountReplica(box, layout.replicaLayout, { browserFrame: opts.browserFrame });
  const page = pickPage(PAGES, state.plan.variant, state.plan.page);
  const mount = page
    ? mountReplica(box, layout.replicaLayout, { browserFrame: opts.browserFrame, sheetAspect: aspectOfPage(page) })
    : probe;

  const ctx = targetContext(mount.spec, state, page, DEMO.pageCount);

  // The two things the push may not crop, decided for the WHOLE BEAT rather
  // than frame by frame — a shot's framing is a decision about the shot, and a
  // cap that appears when a caption does and goes when it goes is a lurch.
  const captionRaw = designRect(mount, mount.spec.caption);
  const renderingRaw = designRect(mount, mount.spec.rendering);
  const span = { from: Math.min(from, to), to: Math.max(from, to) };
  const protect: StageRect[] = [];
  /*
   * The money shot is allowed to push PAST the product's own caption, and this
   * flag is how. Framed so the building fills 85 % of the frame, the caption —
   * which sits at the bottom of the studio's design box — is well below the
   * frame edge, and protecting it would cap the push at about 1.2 and hand back
   * the small-UI problem the art direction was about.
   *
   * The obligation does not move: a scene that declares `filmCaption` makes the
   * FILM draw the sentence in its own band, above the camera, where nothing can
   * crop it. What the gate enforces instead is the thing that would actually be
   * wrong — a caption half in frame. Either it is whole or it is gone.
   */
  const filmCaption = beat.expelsCaption;
  const expel: StageRect[] = [];
  if (overlaps(span, CAPTION_SPAN)) {
    if (filmCaption) expel.push(captionRaw);
    else protect.push(pad(captionRaw, layout.u(6)));
  }
  /*
   * ⚠ Protected while the rendering is ON SCREEN, not for every beat that will
   * eventually hold it. The obligation is that the "AI-generated" pill is never
   * cropped (`verify:honesty` § 3), and a card at 15 % opacity has no pill to
   * crop — but reserving its rectangle pushed the drawing hard against the left
   * edge and left 41 % of the frame empty on the right, waiting. Same defect as
   * the receipt beat's, in the protection machinery rather than the framing.
   *
   * The 0.5 line is the same one the honesty gate reads, so the two cannot
   * disagree about when the pill has to be whole.
   */
  /*
   * ⚠ The pill's protection RAMPS IN, and the boolean it replaces is the same
   * defect twice over.
   *
   * It used to switch on the frame `state.rendering.p` crossed 0.5. A
   * protection that appears on one frame yanks the framing on that frame: in
   * 9:16 the render beat's building went from inside the frame to **801-1736**
   * in a 1080-wide frame, cut through `Powder room`, and came back. The lean
   * check could not see it because a travelling camera is exempt from lean,
   * which is exactly when it happened.
   *
   * So the framing eases into the obligation over the card's own fade, and is
   * FULLY protective by the 0.5 line `verify:honesty` reads — the pill is whole
   * from the instant the gate asks, and nothing moves on a single frame. Below
   * 0.02 there is no card at all, which is where D32 started: reserving its
   * rectangle before it exists leaves a hole in the composition.
   */
  const pillWeight = overlaps(span, RENDERING_SPAN)
    ? clamp01((state.rendering.p - 0.02) / (0.5 - 0.02))
    : 0;
  const pillOnScreen = pillWeight > 0;
  const pillRect = pad(renderingRaw, layout.u(6));
  /*
   * The export menu is the subject of its own beat, and in 9:16 it is a
   * full-width bottom sheet. Unprotected, the push slid it under the split
   * scene's clip and the master showed "Export the DXF." over a menu whose DXF
   * row had been cut off — the line naming the thing the frame had cropped.
   */
  if (beat.scene === "export") protect.push(pad(designRect(mount, exportMenuBox(ctx)), layout.u(8)));

  /*
   * ⚠ A travelling beat interpolates the resolved PUSH, not the focus RECT.
   *
   * Lerping the rect and solving once looks equivalent and is not. The solver
   * clamps against the protected rectangles, so the framing it returns for an
   * intermediate rect is not between the framings it returns for the two ends
   * — it can swing outside both. Measured on the 9:16 render beat: the two ends
   * put the building at 43-1064 and 490-1091 in a 1080-wide frame, and the
   * frame half way between put it at **781-1688**, six hundred pixels off the
   * right edge, with `focusClamped` true and the sheet cut through
   * `Powder room`. The lean check could not see it because a moving camera is
   * exempt from lean, which is exactly when this happens.
   *
   * Interpolating the two SOLVED pushes cannot do that: both ends are
   * compositions the clamp agreed to, so every frame between them is bounded by
   * the two. Same argument as `lerpRect`, one level further down.
   */
  /*
   * ⚠ The travel is never behind the OBLIGATION.
   *
   * The camera's move and the pill's protection had separate clocks, and at the
   * 9:16 render beat they disagreed: half way through the move the framing was
   * still the drawing at 0.94 fill — scale 2.4 — while the card was already
   * 57 % opaque and had to be kept whole. Those two cannot both be satisfied,
   * so the solver did the only thing it could and shoved the drawing 656 px off
   * the right edge, through `Powder room`.
   *
   * Tying them is the fix and it is a statement rather than a tuning: **by the
   * time a thing must be whole, the camera must already be framing for it.**
   */
  const travelP = (() => {
    const t0 = travelProgress(beat.scene, span, t);
    if (t0 === null) return pillWeight > 0 && beat.scene === "render" ? pillWeight : null;
    return Math.max(t0, pillWeight);
  })();
  const focusAt = (rect: Rect | null): { film: StageRect; focus: { x: number; y: number } } => {
    const film = rect ? designRect(mount, rect) : mount.rect;
    return { film, focus: centreOf(film) };
  };
  const settledRect = focusRectFor(beat.scene, ctx, span);
  const focusRect = travelP === null ? focusRectFor(beat.scene, ctx, span, t) : settledRect;
  const startRect = travelP === null ? null : focusRectFor(beat.scene, ctx, span, -Infinity);
  const { film: focusFilm, focus } = focusAt(focusRect);
  /*
   * `fill` is a fraction of the frame the VIEWER SEES. In a full-bleed scene
   * that is the frame; in a split scene the picture stops at the type band, and
   * measuring the fill against the whole frame pushed a 0.90 subject to 136 % of
   * the visible half — a plan cropped through its own room labels in the beat
   * whose job is to show a room changing.
   */
  const viewH = visibleBottom(layout, opts.clipBottom);
  const stand = fillScale(focusFilm, layout.width, viewH, beat.fill);

  /*
   * Everything the solver needs that is not a rectangle list, named once so the
   * dry run below and the real push cannot drift apart.
   *
   * ⚠ In 9:16 the pill is bounded by the SAFE frame, not by the frame.
   * `verify:honesty` asked whether the "AI-generated" pill's rectangle was
   * inside the FRAME, and it was — comfortably, legibly, and inside the bottom
   * 390 px the platforms cover with their own chrome. "Inside the frame" and
   * "visible to a viewer on the platform the vertical master is cut for" are
   * not the same claim, and the obligation (EU AI Act Art. 50) is about the
   * second. Only while a rendering is on screen: bounding every portrait beat
   * that way would pull back beats with no pill to protect.
   */
  const pushBase = {
    frameW: layout.width,
    frameH: layout.height,
    scale: stand * pushAt(beat.push, p) * entryScale(localSec),
    focus,
    protectBounds: (() => {
      const safeBottom = layout.aspect === "portrait" && pillOnScreen
        ? layout.height - layout.safe.bottom
        : Infinity;
      const h = Math.min(viewH, safeBottom);
      return h >= layout.height ? undefined : { x: 0, y: 0, w: layout.width, h };
    })(),
    // Not a hairline. A protected rectangle that ends two pixels from the frame
    // edge is technically uncropped and looks like a mistake, so the margin is
    // a visible one and the framing gives way to it.
    margin: layout.u(26),
  };

  /*
   * ── The text rows the clip must not bisect ────────────────────────────────
   *
   * In 9:16 the picture stops at `pictureClipBottom` and the chapter's colour
   * owns the band below. A row of TYPE meeting that edge is the defect this is
   * about: eleven beats across the four vertical cuts showed the sheet's own
   * caption row cut in half by it — `-storey Townhouse`, with "Two" outside.
   *
   * The direction is decided ONCE, here, from the settled framing, and passed
   * to the solver: the cheaper move flips when the row is exactly half across,
   * so a per-frame choice would jump by the row's own height in the middle of a
   * beat. Deciding it per beat is the same law the framing already follows.
   */
  const clipEdge = opts.clipBottom;
  const nudge: { rect: StageRect; dir: 1 | -1 }[] = [];
  if (clipEdge !== undefined) {
    const rows: StageRect[] = [];
    const row = sheetCaptionRect(ctx);
    if (row) rows.push(designRect(mount, row));
    if (state.actProgress >= 0.5) rows.push(designRect(mount, mount.spec.commandBar));
    if (rows.length > 0) {
      const dry = framePush({ ...pushBase, protect, expel });
      for (const r of rows) {
        const top = r.y * dry.scale + dry.ty;
        const bot = (r.y + r.h) * dry.scale + dry.ty;
        if (top >= clipEdge || bot <= clipEdge) continue;
        // The smaller move wins: down until the row is wholly past the edge, or
        // up until it is wholly inside it.
        nudge.push({ rect: r, dir: clipEdge - top <= bot - clipEdge ? 1 : -1 });
      }
    }
  }

  const solveWith = (f: StageRect, c: { x: number; y: number }, pl: readonly StageRect[]): FramePush =>
    framePush({
      ...pushBase,
      scale: fillScale(f, layout.width, viewH, beat.fill) * pushAt(beat.push, p) * entryScale(localSec),
      focus: c,
      protect: pl,
      expel,
      nudge,
      nudgeEdge: clipEdge,
    });

  /** One framing, with the pill's protection weighted by how present it is. */
  const solve = (f: StageRect, c: { x: number; y: number }): FramePush =>
    pillWeight <= 0
      ? solveWith(f, c, protect)
      : pillWeight >= 1
        ? solveWith(f, c, [...protect, pillRect])
        : lerpPush(solveWith(f, c, protect), solveWith(f, c, [...protect, pillRect]), pillWeight);

  const settledPush = solve(focusFilm, focus);
  const push =
    travelP === null
      ? settledPush
      : (() => {
          const a = focusAt(startRect);
          return lerpPush(solve(a.film, a.focus), settledPush, travelP);
        })();

  return {
    t,
    state,
    page,
    mount,
    push,
    captionRect: pushRect(push, captionRaw),
    captionOpacity: state.caption.p,
    filmCaption,
    renderingRect: pushRect(push, renderingRaw),
    renderingOpacity: state.rendering.p,
  };
};

/**
 * The drafting card's box after the push, or `null` when it is not on screen.
 *
 * For `verify:honesty`, which has to ask whether the film's opaque band is
 * printing over the product's own sheet. Exported rather than re-derived in the
 * gate for the usual reason: `draftCardBox` carries a labelled workaround for a
 * stale upstream spec (`DRAFT_CARD_SPEC_SHORTFALL`), and a gate with its own
 * copy of that would go green on the day upstream fixed it.
 */
export const draftCardRectFor = (shot: Shot): StageRect | null =>
  shot.state.drafting.visible
    ? pushRect(shot.push, designRect(shot.mount, draftCardBox(shot.mount.spec)))
    : null;

/**
 * The scene's entrance, as a SCALE and nothing else.
 *
 * The film cuts on the beat; what carries momentum across the cut is the first
 * eight frames of the new shot still arriving. A translate would do it too and
 * is not available here: a replica beat may be carrying the honesty caption, and
 * a shot that slides in from the right is a shot whose caption is off the right
 * edge for four frames. A scale-through goes through `framePush`, which clamps
 * against the protected rectangles — so the entrance is subject to the same
 * obligation as the push it is multiplied into, and the gate sees both.
 */
export const ENTRY_SEC = 0.26;
export const ENTRY_FROM = 1.045;

export const entryScale = (localSec: number): number => {
  const p = clamp01(localSec / ENTRY_SEC);
  return 1 + (ENTRY_FROM - 1) * (1 - easeOutCubic(p));
};

/**
 * The scene's own opacity over its first frames. Paired with {@link entryScale}.
 *
 * ⚠ It starts at {@link ENTRY_OPACITY_FLOOR}, not at zero, and the motion check
 * is why. Extracting every third frame of a five-second segment showed **one
 * fully blank ivory frame at every cut** — the first frame of each beat, at
 * opacity 0. On a strip that reads as a stutter; in motion it is a blink between
 * two shots that are supposed to cut hard. A dip to 0.72 for one frame is an
 * arrival; a dip to 0 is a dropped frame.
 */
export const ENTRY_OPACITY_FLOOR = 0.72;

export const entryOpacity = (localSec: number): number =>
  ENTRY_OPACITY_FLOOR + (1 - ENTRY_OPACITY_FLOOR) * clamp01(localSec / (ENTRY_SEC * 0.62));

/**
 * The scale at progress `p`, interpolated on `log(scale)`.
 *
 * Zoom is perceived multiplicatively: interpolated linearly, the same arithmetic
 * step is a smaller and smaller PROPORTION of the current scale, so the move
 * reads as slowing down at the wrong end. `exp(lerp(0, ln(push), p))` is a
 * constant rate of change in log space, and it also guarantees the scale can
 * never be zero or negative whatever `p` does.
 */
export const pushAt = (push: number, p: number): number => {
  if (!(push > 0) || push === 1) return 1;
  return Math.exp(Math.log(push) * easeOutCubic(clamp01(p)));
};

/**
 * The scale at which a design-space rectangle fills `fill` of the frame.
 *
 * A FRACTION, not a scale, and the difference is what the art-direction pass
 * was about. A scale means something different at 1920x1080 and 1080x1920 and
 * different again when the replica is mounted into a split scene's shorter box
 * — so a hand-tuned 1.35 that framed the drawing well in one composition framed
 * it small in five others. A fraction means the same thing everywhere: "the
 * thing this beat is about spans this much of the frame".
 *
 * The limiting axis wins, so the rectangle is never larger than `fill` on
 * either — and the result is floored at 1, because a scale below 1 would expose
 * the page behind the picture.
 */
export const fillScale = (rect: StageRect, frameW: number, frameH: number, fill: number): number => {
  if (!(rect.w > 0) || !(rect.h > 0)) return 1;
  const f = clamp01(fill);
  return Math.max(1, Math.min((frameW * f) / rect.w, (frameH * f) / rect.h));
};

/** `viewBox` width / height — what `layoutSpec` sizes the paper from. */
export const aspectOfPage = (page: PlanPage): number => {
  const parts = page.viewBox.trim().split(/[\s,]+/).map(Number);
  if (parts.length < 4 || parts.some((n) => !Number.isFinite(n)) || !(parts[3] > 0)) return 1;
  return parts[2] / parts[3];
};
