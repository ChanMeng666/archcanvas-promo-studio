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
import { CAPTION_SPAN, DEMO, OPEN_PIN_SEC, PAGES, RENDERING_SPAN, overlaps, stateAt } from "./film-demo";
import { DRAFTING_SPAN } from "./honesty";
import type { Layout, StageRect } from "./layout-core";
import { SCENES, type SceneId } from "./scenes";
import { clamp01, easeOutCubic, frameToSec, type ResolvedBeat } from "./timeline";

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
   */
  for (const r of expel) {
    if (!(r.y > 0)) continue;
    const need = (bounds.y + bounds.h + margin) / r.y;
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
  const aim = RECENTRE * clamp01((s - 1) / 0.2);
  const anchorX = fx + (frameW / 2 - fx) * aim;
  const anchorY = fy + (frameH / 2 - fy) * aim;

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
    loY = Math.max(loY, bounds.y + bounds.h + margin - r.y * s);
  }

  const wantX = anchorX - fx * s;
  const wantY = anchorY - fy * s;
  const tx = clampTo(wantX, loX, hiX);
  const ty = clampTo(wantY, loY, hiY);

  return {
    scale: s,
    tx,
    ty,
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
export const focusRectFor = (
  scene: SceneId,
  ctx: TargetContext,
  /** The beat's replica window, for the decisions that are about the beat. */
  span?: { from: number; to: number },
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
        ? spec.draftCard
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
      const anchors = pinAnchors(ctx);
      const building0 = buildingBox(ctx) ?? sheetOnScreen(ctx);
      /*
       * BEFORE a pin is opened there is no card to read, and the subject is the
       * three pins landing on the drawing — so the shot holds all of them and
       * the building. The contact sheet caught the other version: aimed at the
       * first finding, which is the sheet-wide one and therefore anchored to the
       * paper's top edge, the 120 s cut's first receipt beat was six seconds of
       * empty canvas with a corner of drawing in it.
       */
      if (!span || span.to < OPEN_PIN_SEC) {
        return anchors.reduce<Rect>(
          (acc, a) => unionR(acc, { x: a.x - 20 * spec.ck, y: a.y - 30 * spec.ck, w: 40 * spec.ck, h: 40 * spec.ck }),
          building0,
        );
      }
      const open = state.review.openPin;
      const a = (open !== null ? anchors[open] : undefined) ?? anchors[1] ?? anchors[0];
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
      const card = findingCardBox(ctx, a);
      return card ? unionR(unionR(pinBox, card), near) : unionR(pinBox, building);
    }

    case "storey": {
      const chrome = sheetChrome(spec, ctx.storeys, state.review.badgeCount);
      return unionR(chrome.storeyGroup, buildingBox(ctx) ?? sheetOnScreen(ctx));
    }

    case "render":
      return span && overlaps(span, RENDERING_SPAN)
        ? unionR(spec.rendering, buildingBox(ctx) ?? sheetOnScreen(ctx))
        : buildingBox(ctx) ?? sheetOnScreen(ctx);

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
  const t = from + (to - from) * p;

  const state = stateAt(t);
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
  const filmCaption = SCENES[beat.scene].filmCaption === true;
  const expel: StageRect[] = [];
  if (overlaps(span, CAPTION_SPAN)) {
    if (filmCaption) expel.push(captionRaw);
    else protect.push(pad(captionRaw, layout.u(6)));
  }
  if (overlaps(span, RENDERING_SPAN)) protect.push(pad(renderingRaw, layout.u(6)));
  /*
   * The export menu is the subject of its own beat, and in 9:16 it is a
   * full-width bottom sheet. Unprotected, the push slid it under the split
   * scene's clip and the master showed "Export the DXF." over a menu whose DXF
   * row had been cut off — the line naming the thing the frame had cropped.
   */
  if (beat.scene === "export") protect.push(pad(designRect(mount, exportMenuBox(ctx)), layout.u(8)));

  const focusRect = focusRectFor(beat.scene, ctx, span);
  const focusFilm = focusRect ? designRect(mount, focusRect) : mount.rect;
  const focus = centreOf(focusFilm);
  const stand = fillScale(focusFilm, layout.width, layout.height, beat.fill);

  const push = framePush({
    frameW: layout.width,
    frameH: layout.height,
    scale: stand * pushAt(beat.push, p) * entryScale(localSec),
    focus,
    protect,
    expel,
    // A split scene CLIPS the picture at the top of its type band, and a
    // rectangle comfortably inside the frame can be entirely below that clip.
    // The protection is about what a viewer can see, so it is bounded by the
    // clip; coverage still uses the whole frame.
    protectBounds:
      opts.clipBottom === undefined
        ? undefined
        : { x: 0, y: 0, w: layout.width, h: Math.min(layout.height, opts.clipBottom) },
    // Not a hairline. A protected rectangle that ends two pixels from the frame
    // edge is technically uncropped and looks like a mistake, so the margin is
    // a visible one and the framing gives way to it.
    margin: layout.u(26),
  });

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
