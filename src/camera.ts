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

import { layoutSpec, sheetChrome, tweaksBox, type LayoutId, type LayoutSpec, type Rect } from "./replica/layout";
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
import { CAPTION_SPAN, DEMO, PAGES, RENDERING_SPAN, overlaps, stateAt } from "./film-demo";
import type { Layout, StageRect } from "./layout-core";
import type { SceneId } from "./scenes";
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
  /** How far inside the frame edge a protected rectangle must stay. */
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
  margin = 8,
}: FrameInput): FramePush => {
  let s = Number.isFinite(scale) && scale > 1 ? scale : 1;
  let scaleClamped = false;

  // A rectangle wider than the frame at scale `s` cannot be kept whole by ANY
  // translate, so the scale gives way before the obligation does.
  for (const r of protect) {
    if (r.w > 0) {
      const cap = (frameW - 2 * margin) / r.w;
      if (cap < s) {
        s = Math.max(1, cap);
        scaleClamped = true;
      }
    }
    if (r.h > 0) {
      const cap = (frameH - 2 * margin) / r.h;
      if (cap < s) {
        s = Math.max(1, cap);
        scaleClamped = true;
      }
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
    loX = Math.max(loX, margin - r.x * s);
    hiX = Math.min(hiX, frameW - margin - (r.x + r.w) * s);
    loY = Math.max(loY, margin - r.y * s);
    hiY = Math.min(hiY, frameH - margin - (r.y + r.h) * s);
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
export const focusRectFor = (scene: SceneId, ctx: TargetContext): Rect | null => {
  const { spec, state } = ctx;

  switch (scene) {
    case "brief":
      return spec.composer.card;

    case "draw":
      // The money shot: the sheet, and the drafting card while it is still up.
      return state.drafting.visible ? unionR(spec.draftCard, sheetOnScreen(ctx)) : sheetOnScreen(ctx);

    case "edit": {
      const p = resolveTarget(ctx, { kind: "room", archId: DEMO.kitchen.archId });
      const sheet = sheetOnScreen(ctx);
      // The kitchen, with enough of the building around it to read the change.
      const w = sheet.w * 0.66;
      const h = sheet.h * 0.66;
      return { x: p.x * spec.W - w / 2, y: p.y * spec.H - h / 2, w, h };
    }

    case "tweak": {
      const t = tweaksControls(ctx).track;
      return unionR(spec.tweaks.mode === "docked" ? tweaksBox(spec) : t, sheetOnScreen(ctx));
    }

    case "receipt": {
      const anchors = pinAnchors(ctx);
      const open = state.review.openPin;
      const a = (open !== null ? anchors[open] : undefined) ?? anchors[0];
      if (!a) return sheetOnScreen(ctx);
      const pinBox: Rect = { x: a.x - 20 * spec.ck, y: a.y - 30 * spec.ck, w: 40 * spec.ck, h: 40 * spec.ck };
      const card = findingCardBox(ctx, a);
      return card ? unionR(pinBox, card) : unionR(pinBox, sheetOnScreen(ctx));
    }

    case "storey": {
      const chrome = sheetChrome(spec, ctx.storeys, state.review.badgeCount);
      return unionR(chrome.storeyGroup, sheetOnScreen(ctx));
    }

    case "render":
      return state.rendering.p > 0.02 ? unionR(spec.rendering, sheetOnScreen(ctx)) : sheetOnScreen(ctx);

    case "export":
      return state.exportMenu.open > 0.05 ? unionR(exportMenuBox(ctx), sheetOnScreen(ctx)) : sheetOnScreen(ctx);

    default:
      return null;
  }
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
  opts: { browserFrame: boolean },
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
  if (overlaps(span, CAPTION_SPAN)) protect.push(pad(captionRaw, layout.u(6)));
  if (overlaps(span, RENDERING_SPAN)) protect.push(pad(renderingRaw, layout.u(6)));

  const focusRect = focusRectFor(beat.scene, ctx);
  const focus = focusRect
    ? centreOf(designRect(mount, focusRect))
    : centreOf(mount.rect);

  const push = framePush({
    frameW: layout.width,
    frameH: layout.height,
    scale: beat.frame * pushAt(beat.push, p) * entryScale(localSec),
    focus,
    protect,
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
  if (!(push > 1)) return 1;
  return Math.exp(Math.log(push) * easeOutCubic(clamp01(p)));
};

/** `viewBox` width / height — what `layoutSpec` sizes the paper from. */
export const aspectOfPage = (page: PlanPage): number => {
  const parts = page.viewBox.trim().split(/[\s,]+/).map(Number);
  if (parts.length < 4 || parts.some((n) => !Number.isFinite(n)) || !(parts[3] > 0)) return 1;
  return parts[2] / parts[3];
};
