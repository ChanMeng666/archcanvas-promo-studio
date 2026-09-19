/**
 * Where everything sits, in DESIGN UNITS.
 *
 * The replica has two layouts and they are a RE-LAYOUT of each other, never a
 * crop: landscape draws into a nominal 1600x1000 box, portrait into 1000x1333
 * with the canvas on top and the command bar, the rendering and the tweaks panel
 * stacked under it. `replica.css` turns a design unit into pixels through `--u`,
 * so the same numbers are a 1600 px desktop band, a 360 px phone and a 1920 px
 * film frame.
 *
 * Two coordinate spaces, and keeping them apart is what makes the cursor land
 * where it is pointing:
 *
 *  • **design** — the fixed overlay. The top bar, the command bar, the canvas
 *    toolbar, the drafting sheet, the export menu, the toast, the caption and
 *    the cursor itself. These do not move when the camera does.
 *  • **world** — inside the camera transform. The sheet, the chrome floating
 *    above it, the tweaks panel, the review pins. `worldToDesign` is the ONE
 *    place that transform is written down; `CanvasStage` applies exactly the
 *    same numbers as a CSS transform, and `layoutMap.ts` resolves cursor targets
 *    through this function, so a cursor aimed at a room cannot drift from the
 *    room it is aimed at.
 *
 * Pure arithmetic — see the house rules in `types.ts`.
 */

/**
 * Which of the two layouts to draw.
 *
 * Declared HERE rather than in `types.ts` because it is a fact about rendering,
 * not about the screenplay: `at(sp, t)` produces the same state for both.
 */
export type LayoutId = "landscape" | "portrait";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Centre of a rect. */
export function centre(r: Rect): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export interface ExportMenuSpec {
  /** Anchored under the sheet's Export button, or a full-width bottom sheet. */
  mode: "anchored" | "sheet";
  w: number;
  /** One item's height. */
  rowH: number;
  /** A group heading's height. */
  labelH: number;
  pad: number;
}

export interface TweaksSpec {
  /** Floating on the sheet (world space) or docked under the canvas (design space). */
  mode: "floating" | "docked";
  /** Design-space box; ignored in `floating` mode, where the box is derived from the sheet. */
  box: Rect;
  w: number;
  h: number;
}

export interface LayoutSpec {
  id: LayoutId;
  /** The design box. */
  W: number;
  H: number;
  /** Chrome/type scale. Portrait is the same design laid out for a phone, so its
   *  chrome is ~2.4x larger in design units to stay legible at 360 px. */
  k: number;
  /**
   * The scale of the SHEET's own chrome, which is smaller than `k` in portrait.
   *
   * The badge, the storey chips and the Export pill all have to fit across the
   * width of the paper; at the body scale they do not, and they overlap. This is
   * the one place the two layouts genuinely trade legibility for fit, so it is a
   * named number rather than a fudge inside a component.
   */
  ck: number;
  /** The window-chrome band at the very top; 0 when the frame is off. */
  frameH: number;
  /** The studio's top bar. */
  topBar: Rect;
  /** The canvas viewport. */
  stage: Rect;
  /** The sheet, in WORLD coordinates (the world is the stage box at zoom 1). */
  sheet: Rect;
  /** The floating chrome row above the sheet, in world coordinates. */
  sheetChrome: { h: number; gap: number };
  /**
   * Act I's brief composer, in design coordinates.
   *
   * ⚠ MUCH BIGGER THAN ITS ACT II COUNTERPART, on purpose. `CAMERA_ENVELOPE`
   * exists to keep the SHEET inside the free area, and before the sheet exists —
   * the whole Brief chapter and the drafting half of Draw, t ≈ 0 → 9.3 — there
   * is no sheet to keep anywhere. The first nine seconds are "somebody types a
   * brief", which is the first impression of the entire loop, and at an 1100 px
   * render a card sized for the canvas puts that sentence at ten pixels. So Act
   * I gets the stage: a heading, the card, the hint, laid out for the box rather
   * than inside a viewport that has not opened yet.
   */
  composer: {
    heading: Rect;
    subheading: Rect;
    card: Rect;
    input: Rect;
    typology: Rect;
    reference: Rect;
    cta: Rect;
    hint: Rect;
    /** The type scale of the Act I page — bigger than `k`. See above. */
    scale: number;
  };
  commandBar: Rect;
  toolbar: Rect;
  draftCard: Rect;
  rendering: Rect;
  caption: Rect;
  /**
   * The honesty caption's type size, in design units.
   *
   * In the SPEC rather than in the component because it is the one sentence with
   * a legibility FLOOR — it is what stops a thirty-five second loop reading as a
   * speed claim, and a caption nobody can read is a caption nobody reads.
   * `tests/studioReplicaLayout.test.ts` asserts it against the widths the
   * landing page and a phone actually render at.
   */
  captionSize: number;
  toast: Rect;
  tweaks: TweaksSpec;
  exportMenu: ExportMenuSpec;
  pinCardW: number;
  /**
   * How many lines of a finding a pin card shows before it clamps.
   *
   * A finding can run to 490 characters and the card sits ON the drawing, so
   * this is a real trade: six lines at desktop width still leave the plan
   * readable, three is all a phone can give up.
   */
  pinCardLines: number;
}

/** The compiled demo's paper is taller than it is wide; this is its ratio. */
export const DEFAULT_SHEET_ASPECT = 11406.4 / 14112.8;

export interface LayoutOptions {
  /** Draw the thin window chrome at the top. */
  browserFrame?: boolean;
  /** `viewBox` width / height of the page being drawn. */
  sheetAspect?: number;
}

/**
 * Build a layout.
 *
 * Deliberately a FUNCTION rather than two frozen constants: the browser frame
 * and the drawing's own proportions both change where the sheet sits, and a
 * table of hand-tuned numbers per combination is how a cursor ends up pointing
 * at where a control used to be.
 */
export function layoutSpec(id: LayoutId, opts: LayoutOptions = {}): LayoutSpec {
  const aspect = opts.sheetAspect && opts.sheetAspect > 0 ? opts.sheetAspect : DEFAULT_SHEET_ASPECT;
  return id === "portrait" ? portrait(aspect, opts.browserFrame !== false) : landscape(aspect, opts.browserFrame !== false);
}

/**
 * How far the screenplay's camera is allowed to travel from the fit.
 *
 * ⚠ THIS IS A CONTRACT WITH `screenplay.ts`, AND IT IS WHY THE SHEET IS THE SIZE
 * IT IS. The sheet is sized so that the WHOLE drawing — the scale bar and the
 * level stamp included — stays between the chrome above it and the command bar
 * below it at EVERY camera the loop uses, not merely at the fit. The first pass
 * sized it to the fit alone; the review chapter's push then slid the title block
 * under the command bar, so the one frame that says "this is a real, dimensioned
 * drawing" was the frame with the scale cut off.
 *
 * A bigger push buys a closer look and costs paper on every other frame, which
 * is a trade worth making explicitly rather than by accident.
 * `tests/studioReplicaLayout.test.ts` asserts no beat leaves this envelope.
 */
export const CAMERA_ENVELOPE = {
  maxZoom: 1.06,
  /** How far `cy` may sit from 0.5. */
  cyBudget: 0.05,
  /** How far `cx` may sit from 0.5. Horizontal has far more slack. */
  cxBudget: 0.09,
} as const;

/**
 * The paper's box in WORLD space: as big as the stage allows once the chrome
 * above it, whatever floats below it, AND the camera envelope have had their
 * share.
 *
 * The drawing's own proportions decide the rest — `aspect` comes from the page's
 * `viewBox`, so a landscape plan and this portrait townhouse both land centred
 * rather than one of them being cropped by a hardcoded box.
 */
function fitSheet(
  stage: Rect,
  aspect: number,
  topBand: number,
  bottomBand: number,
  fill: number,
): Rect {
  const band = Math.max(40, stage.h - topBand - bottomBand);
  const Z = CAMERA_ENVELOPE.maxZoom;
  // Where the sheet's own centre lands on screen at the worst zoom, with `cy`
  // at the middle of its budget…
  const worldCentre = topBand + band / 2;
  const onScreen = stage.h / 2 + (worldCentre - stage.h / 2) * Z;
  // …and how far it can slide either way before the paper leaves the band.
  const drift = CAMERA_ENVELOPE.cyBudget * stage.h * Z;
  const half = Math.min(onScreen - drift - topBand, stage.h - bottomBand - (onScreen + drift));
  const maxH = Math.max(40, (half * 2) / Z);

  let h = Math.round(Math.min(band * fill, maxH));
  let w = Math.round(h * aspect);
  // A wide drawing runs out of stage sideways before it runs out vertically.
  const maxW = Math.round(((stage.w - 2 * CAMERA_ENVELOPE.cxBudget * stage.w * Z) / Z) * 0.92);
  if (w > maxW) {
    w = maxW;
    h = Math.round(w / aspect);
  }
  return {
    x: Math.round((stage.w - w) / 2),
    y: topBand + Math.round((band - h) / 2),
    w,
    h,
  };
}

function landscape(aspect: number, withFrame: boolean): LayoutSpec {
  const W = 1600;
  const H = 1000;
  const frameH = withFrame ? 30 : 0;
  const topBar: Rect = { x: 0, y: frameH, w: W, h: 44 };
  const stage: Rect = { x: 0, y: frameH + topBar.h, w: W, h: H - frameH - topBar.h };

  const cmdW = 640;
  const cmdH = 54;
  // The sheet fits BETWEEN its own chrome and the floating command bar, not into
  // the whole stage. Centre it in the stage and the badge row goes off the top
  // edge while the caption — which names the design — disappears under the bar.
  const chromeBand = 26 + 10 + 10;
  const sheet = fitSheet(stage, aspect, chromeBand, cmdH + 40, 0.95);

  const commandBar: Rect = {
    x: Math.round((W - cmdW) / 2),
    y: stage.y + stage.h - 18 - cmdH,
    w: cmdW,
    h: cmdH,
  };
  const toolbar: Rect = { x: W - 18 - 186, y: stage.y + stage.h - 18 - 36, w: 186, h: 36 };

  // ── Act I ── the heading, the card and the hint as ONE centred block.
  const ak = 1.55;
  const cardW = 1180;
  const cardH = 344;
  const blockH = 52 * ak + 26 * ak + 30 * ak + cardH + 18 * ak + 22 * ak;
  const blockY = Math.round((H - blockH) / 2);
  const heading: Rect = { x: Math.round((W - cardW) / 2), y: blockY, w: cardW, h: 52 * ak };
  const subheading: Rect = { x: heading.x, y: heading.y + heading.h + 4 * ak, w: cardW, h: 26 * ak };
  const card: Rect = {
    x: heading.x,
    y: Math.round(subheading.y + subheading.h + 30 * ak),
    w: cardW,
    h: cardH,
  };
  const rowY = card.y + card.h - 26 * ak - 32 * ak;

  return {
    id: "landscape",
    W,
    H,
    k: 1,
    ck: 1,
    frameH,
    topBar,
    stage,
    sheet,
    sheetChrome: { h: 26, gap: 10 },
    composer: {
      heading,
      subheading,
      card,
      input: { x: card.x + 28 * ak, y: card.y + 22 * ak, w: card.w - 56 * ak, h: 118 * ak },
      typology: { x: card.x + 110 * ak, y: rowY, w: 220 * ak, h: 32 * ak },
      reference: { x: card.x + 348 * ak, y: rowY, w: 118 * ak, h: 32 * ak },
      cta: { x: card.x + card.w - 22 * ak - 214 * ak, y: rowY, w: 214 * ak, h: 32 * ak },
      hint: { x: card.x + 4, y: Math.round(card.y + card.h + 14 * ak), w: card.w, h: 22 * ak },
      scale: ak,
    },
    commandBar,
    toolbar,
    draftCard: { x: Math.round((W - 700) / 2), y: stage.y + Math.round((stage.h - 300) / 2), w: 700, h: 300 },
    rendering: { x: W - 40 - 330, y: stage.y + 90, w: 330, h: 220 },
    // The honesty caption is read, not glanced at — it is the one sentence that
    // stops a compressed loop reading as a speed claim. Wide and set at 18 units
    // so it is still ~12 px at an 1100 px render.
    caption: { x: Math.round((W - 800) / 2), y: commandBar.y - 18 - 50, w: 800, h: 50 },
    captionSize: 18,
    toast: { x: W - 18 - 320, y: toolbar.y - 14 - 44, w: 320, h: 44 },
    tweaks: { mode: "floating", box: { x: 0, y: 0, w: 0, h: 0 }, w: 240, h: 132 },
    exportMenu: { mode: "anchored", w: 224, rowH: 40, labelH: 22, pad: 6 },
    pinCardW: 224,
    pinCardLines: 6,
  };
}

function portrait(aspect: number, withFrame: boolean): LayoutSpec {
  const W = 1000;
  const H = 1333;
  const k = 2.4;
  /**
   * The sheet's own chrome scales LESS than the rest.
   *
   * At the body scale the badge, the storey chips and the Export pill together
   * want ~520 design units, and a phone-width sheet is 440 across — so the left
   * and right clusters overlap and the picture is of a broken product. 1.7 keeps
   * them legible at 360 px and inside the paper.
   */
  const ck = 1.7;
  const frameH = withFrame ? 34 : 0;
  const topBar: Rect = { x: 0, y: frameH, w: W, h: 96 };
  /**
   * The band under the canvas — the command bar, and NOTHING else.
   *
   * The first pass parked the rendering and the tweaks dock down here too, and
   * the result was a third of a phone screen sitting empty for thirty of the
   * thirty-five seconds. Both are floating chrome in the product, so both float
   * here: the canvas keeps the height, and the two panels sit over its bottom
   * edge when they exist.
   */
  const lowerBand = 150;
  const stage: Rect = {
    x: 0,
    y: frameH + topBar.h,
    w: W,
    h: H - frameH - topBar.h - lowerBand,
  };

  const chromeBand = Math.round(26 * ck + 14 * ck + 12);
  const toolbar: Rect = { x: W - 18 - 240, y: stage.y + stage.h - 16 - 58, w: 240, h: 58 };
  const sheet = fitSheet(stage, aspect, chromeBand, 130, 0.98);

  const commandBar: Rect = { x: 28, y: H - 16 - 104, w: W - 56, h: 104 };
  /** The tweaks drawer: over the canvas's bottom edge, full width. */
  const dock: Rect = { x: 24, y: stage.y + stage.h - 14 - 240, w: W - 48, h: 240 };

  // ── Act I ── the same block, stacked for a phone. `k` is already 2.4 here, so
  // the type is legible at 340 px; what Act I gains is the heading and the room
  // to breathe, not a second scale factor.
  const ak = k;
  const cardW = W - 72;
  const cardH = 620;
  const headingH = 54 * ak;
  const subH = 66 * ak;
  const blockH = headingH + 8 * ak + subH + 36 * ak + cardH + 14 * ak + 60 * ak;
  const blockY = Math.round((H - blockH) / 2);
  const heading: Rect = { x: 36, y: blockY, w: cardW, h: headingH };
  const subheading: Rect = { x: 36, y: heading.y + headingH + 8 * ak, w: cardW, h: subH };
  const card: Rect = { x: 36, y: Math.round(subheading.y + subH + 36 * ak), w: cardW, h: cardH };

  return {
    id: "portrait",
    W,
    H,
    k,
    ck,
    frameH,
    topBar,
    stage,
    sheet,
    sheetChrome: { h: 26 * ck, gap: 14 * ck },
    composer: {
      heading,
      subheading,
      card,
      input: { x: card.x + 30, y: card.y + 30, w: card.w - 60, h: 310 },
      typology: { x: card.x + 176, y: card.y + 386, w: card.w - 206, h: 78 },
      reference: { x: card.x + 30, y: card.y + 500, w: 260, h: 78 },
      cta: { x: card.x + card.w - 30 - 440, y: card.y + 500, w: 440, h: 78 },
      hint: { x: card.x + 6, y: Math.round(card.y + cardH + 14 * ak), w: card.w, h: 60 * ak },
      scale: ak,
    },
    commandBar,
    toolbar,
    draftCard: { x: 40, y: stage.y + Math.round((stage.h - 480) / 2), w: W - 80, h: 480 },
    rendering: { x: 16, y: toolbar.y - 14 - 190, w: 285, h: 190 },
    caption: { x: 40, y: toolbar.y - 14 - 80, w: W - 80, h: 80 },
    captionSize: 18 * k,
    toast: { x: 40, y: toolbar.y - 14 - 84, w: W - 80, h: 84 },
    tweaks: { mode: "docked", box: dock, w: dock.w, h: dock.h },
    exportMenu: { mode: "sheet", w: W, rowH: 84, labelH: 48, pad: 14 },
    pinCardW: 360,
    pinCardLines: 3,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  The sheet's own chrome                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export interface SheetChromeBoxes {
  /** The floating band above the sheet. */
  row: Rect;
  reviewBadge: Rect;
  storeyGroup: Rect;
  storeyChips: Rect[];
  /** The toolbar pill at the sheet's top right. */
  right: Rect;
  exportBtn: Rect;
  tweakBtn: Rect;
  /** The always-in-flow caption row under the sheet. */
  caption: Rect;
}

/**
 * Where the sheet's floating chrome sits, in WORLD coordinates.
 *
 * ONE function, used by `SheetChrome` to draw it and by `layoutMap` to aim the
 * cursor at it. Two copies of these numbers is precisely how a demo ends up with
 * a pointer clicking two units left of the button it is clicking.
 *
 * The geometry is the product's: a left cluster (the review badge, then the
 * storey chips) and a right cluster (Export, then the tweak toggle), both
 * floating a short gap above the paper — `DesignFrame`'s `-top-9 left-0` and
 * `-top-9 right-0`.
 */
export function sheetChrome(spec: LayoutSpec, storeys: number, reviewCount: number): SheetChromeBoxes {
  const k = spec.ck;
  const h = spec.sheetChrome.h;
  const y = spec.sheet.y - h - spec.sheetChrome.gap;

  const badgeW = (reviewCount > 0 ? 48 : 34) * k;
  const gap = 6 * k;
  const chipW = 30 * k;
  const chipPad = 4 * k;
  const chipGap = 2 * k;
  const storeyW = storeys > 1 ? storeys * chipW + 2 * chipPad + (storeys - 1) * chipGap : 0;

  const exportW = 86 * k;
  const tweakW = 26 * k;
  const rightPad = 4 * k;
  const rightGap = 3 * k;
  const rightW = rightPad * 2 + exportW + rightGap + tweakW;
  const rightX = spec.sheet.x + spec.sheet.w - rightW;

  const storeyX = spec.sheet.x + badgeW + gap;
  /** The inner controls sit 2 units inside the pill that holds them. */
  const innerY = y + 2 * k;
  const innerH = h - 4 * k;

  return {
    row: { x: spec.sheet.x, y, w: spec.sheet.w, h },
    reviewBadge: { x: spec.sheet.x, y, w: badgeW, h },
    storeyGroup: { x: storeyX, y, w: storeyW, h },
    storeyChips: Array.from({ length: Math.max(0, storeys) }, (_, i) => ({
      x: storeyX + chipPad + i * (chipW + chipGap),
      y: innerY,
      w: chipW,
      h: innerH,
    })),
    right: { x: rightX, y, w: rightW, h },
    exportBtn: { x: rightX + rightPad, y: innerY, w: exportW, h: innerH },
    tweakBtn: { x: rightX + rightPad + exportW + rightGap, y: innerY, w: tweakW, h: innerH },
    caption: {
      x: spec.sheet.x + 2 * k,
      y: spec.sheet.y + spec.sheet.h + 8 * k,
      w: spec.sheet.w - 4 * k,
      h: 18 * k,
    },
  };
}

/** The tweaks panel's box. Floating on the sheet in landscape, docked below in portrait. */
export function tweaksBox(spec: LayoutSpec): Rect {
  if (spec.tweaks.mode === "docked") return spec.tweaks.box;
  return {
    x: spec.sheet.x + spec.sheet.w - 10 * spec.k - spec.tweaks.w,
    y: spec.sheet.y + 40 * spec.k,
    w: spec.tweaks.w,
    h: spec.tweaks.h,
  };
}

/** The panel's natural height, in units of its own scale: title, value, track, buttons, padding. */
const TWEAKS_NATURAL = 112;

export interface TweaksMetrics {
  box: Rect;
  /** The panel's internal scale — see {@link tweaksMetrics}. */
  tk: number;
  innerX: number;
  innerW: number;
  track: Rect;
  reset: Rect;
  save: Rect;
}

/**
 * The tweaks panel's internal geometry, DERIVED so that it fits its own box.
 *
 * Laying the panel out at the layout's body scale is what makes the portrait
 * dock collide with itself: at `k = 2.4` the slider track and the Save button
 * both want the same 30 design units, and the picture is of a broken control.
 * The scale is capped at whatever the box can actually hold instead, so a panel
 * can be docked, floated or resized without a second table of numbers.
 *
 * `TweaksPanel` draws from this and `layoutMap` aims the cursor with it, so the
 * thumb the pointer drags is the thumb on screen.
 */
export function tweaksMetrics(spec: LayoutSpec): TweaksMetrics {
  const box = tweaksBox(spec);
  const tk = Math.min(spec.k, (box.h - 16) / TWEAKS_NATURAL);
  const innerX = box.x + 12 * tk;
  const innerW = box.w - 24 * tk;
  const track: Rect = { x: innerX, y: box.y + 56 * tk, w: innerW, h: 10 * tk };
  const btnH = 26 * tk;
  const btnY = box.y + box.h - 12 * tk - btnH;
  const btnW = (innerW - 8 * tk) / 2;
  return {
    box,
    tk,
    innerX,
    innerW,
    track,
    reset: { x: innerX, y: btnY, w: btnW, h: btnH },
    save: { x: innerX + btnW + 8 * tk, y: btnY, w: btnW, h: btnH },
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  The camera                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

export interface Camera {
  cx: number;
  cy: number;
  zoom: number;
}

/**
 * The stage transform, as `CanvasStage` writes it and as `layoutMap` reads it.
 *
 * `translate(tx, ty) scale(zoom)`, in stage-local pixels, with a `0 0` transform
 * origin. Applying the pair in that order is what makes the world point named by
 * `camera` land in the middle of the viewport.
 */
export function stageTransform(spec: LayoutSpec, cam: Camera): { tx: number; ty: number; zoom: number } {
  const zoom = Number.isFinite(cam.zoom) && cam.zoom > 0 ? cam.zoom : 1;
  const cx = Number.isFinite(cam.cx) ? cam.cx : 0.5;
  const cy = Number.isFinite(cam.cy) ? cam.cy : 0.5;
  return {
    zoom,
    tx: spec.stage.w / 2 - cx * spec.stage.w * zoom,
    ty: spec.stage.h / 2 - cy * spec.stage.h * zoom,
  };
}

/** A world point, in DESIGN coordinates. The inverse is {@link designToWorld}. */
export function worldToDesign(
  spec: LayoutSpec,
  cam: Camera,
  wx: number,
  wy: number,
): { x: number; y: number } {
  const { tx, ty, zoom } = stageTransform(spec, cam);
  return { x: spec.stage.x + tx + wx * zoom, y: spec.stage.y + ty + wy * zoom };
}

/** The inverse of {@link worldToDesign} — used by the tests to prove the round trip. */
export function designToWorld(
  spec: LayoutSpec,
  cam: Camera,
  dx: number,
  dy: number,
): { x: number; y: number } {
  const { tx, ty, zoom } = stageTransform(spec, cam);
  return { x: (dx - spec.stage.x - tx) / zoom, y: (dy - spec.stage.y - ty) / zoom };
}

/**
 * A point in the drawing's own `viewBox` units, mapped into WORLD coordinates.
 *
 * The plan is drawn with `preserveAspectRatio="xMidYMid meet"` inside the sheet
 * box, and the sheet box is built from the page's own aspect ratio — so `meet`
 * is a no-op and this is a plain linear map. It stays written as the general
 * case anyway: a page with a different aspect than the one the layout was built
 * for would otherwise be silently off by the letterbox.
 */
export function planToWorld(
  spec: LayoutSpec,
  viewBox: readonly number[],
  px: number,
  py: number,
): { x: number; y: number } {
  const [vx, vy, vw, vh] = viewBox;
  if (!(vw > 0) || !(vh > 0)) return centre(spec.sheet);
  const s = Math.min(spec.sheet.w / vw, spec.sheet.h / vh);
  const ox = spec.sheet.x + (spec.sheet.w - vw * s) / 2;
  const oy = spec.sheet.y + (spec.sheet.h - vh * s) / 2;
  return { x: ox + (px - vx) * s, y: oy + (py - vy) * s };
}

/** The inverse of {@link planToWorld}. */
export function worldToPlan(
  spec: LayoutSpec,
  viewBox: readonly number[],
  wx: number,
  wy: number,
): { x: number; y: number } {
  const [vx, vy, vw, vh] = viewBox;
  if (!(vw > 0) || !(vh > 0)) return { x: vx ?? 0, y: vy ?? 0 };
  const s = Math.min(spec.sheet.w / vw, spec.sheet.h / vh);
  const ox = spec.sheet.x + (spec.sheet.w - vw * s) / 2;
  const oy = spec.sheet.y + (spec.sheet.h - vh * s) / 2;
  return { x: (wx - ox) / s + vx, y: (wy - oy) / s + vy };
}

/** `"-1903.2 -1903.2 11406.4 14112.8"` → `[-1903.2, -1903.2, 11406.4, 14112.8]`. */
export function parseViewBox(viewBox: string): [number, number, number, number] {
  const parts = String(viewBox)
    .trim()
    .split(/[\s,]+/)
    .map((n) => Number(n));
  if (parts.length < 4 || parts.some((n) => !Number.isFinite(n))) return [0, 0, 1, 1];
  return [parts[0], parts[1], parts[2], parts[3]];
}
