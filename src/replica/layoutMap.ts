/**
 * Every `CursorTarget`, resolved to a point on the stage.
 *
 * The screenplay says WHERE symbolically — "the CTA", "the kitchen", "the second
 * pin" — because the two layouts put those things in different places and a
 * hardcoded coordinate would be wrong in one of them (`types.ts` § CursorRef).
 * This is the table that turns a name into a point, and it resolves it through
 * exactly the same geometry the components draw with: `sheetChrome` for the
 * badge and the buttons, `planToWorld` + `worldToDesign` for a room, the export
 * menu's own row arithmetic for a menu item. A second set of numbers here is how
 * a demo ends up with a pointer clicking next to the control it is clicking.
 *
 * Points come back NORMALISED to the design box (0..1 on each axis), which is
 * what `Cursor` wants and what a test can assert is on screen.
 */

import {
  centre,
  parseViewBox,
  planToWorld,
  sheetChrome,
  tweaksMetrics,
  worldToDesign,
  type LayoutSpec,
  type Rect,
} from "./layout";
import type { PlanPage } from "./planTypes";
import { EXPORT_GROUPS } from "./strings";
import type { CursorTarget, ReplicaState, Vec } from "./types";

/** Everything a target needs to know about the frame it is being resolved in. */
export interface TargetContext {
  spec: LayoutSpec;
  state: ReplicaState;
  /** The page on screen. Null degrades room targets to the sheet's centre. */
  page: PlanPage | null;
  /** How many storeys the plan has — the chip row only exists above one. */
  storeys: number;
}

/** The export menu's items, flattened in the order they are drawn. */
export const EXPORT_ITEMS: readonly string[] = EXPORT_GROUPS.flatMap((g) => g.items.map((i) => i.label));

export function targetContext(
  spec: LayoutSpec,
  state: ReplicaState,
  page: PlanPage | null,
  storeys: number,
): TargetContext {
  return { spec, state, page, storeys };
}

/** A design-space point, normalised to the design box. */
function norm(spec: LayoutSpec, x: number, y: number): Vec {
  return { x: x / spec.W, y: y / spec.H };
}

/** A world-space rect's centre, in normalised design space. */
function worldCentre(ctx: TargetContext, r: Rect): Vec {
  const c = centre(r);
  const d = worldToDesign(ctx.spec, ctx.state.camera, c.x, c.y);
  return norm(ctx.spec, d.x, d.y);
}

/**
 * Where a room's pin hangs, in DESIGN coordinates.
 *
 * The bbox CENTRE, mapped through the drawing's viewBox and then the camera —
 * the same two maps `PlanSvg` draws the room with. Exported because `ReviewPins`
 * needs the identical point: a pin that does not sit on the thing it is about is
 * worse than no pin.
 */
export function roomAnchor(ctx: TargetContext, archId: string): { x: number; y: number } | null {
  const page = ctx.page;
  if (!page) return null;
  const room = page.rooms.find((r) => r.archId === archId);
  if (!room) return null;
  const vb = parseViewBox(page.viewBox);
  const [minX, minY, maxX, maxY] = room.bbox;
  const w = planToWorld(ctx.spec, vb, (minX + maxX) / 2, (minY + maxY) / 2);
  return worldToDesign(ctx.spec, ctx.state.camera, w.x, w.y);
}

export interface PinAnchor {
  x: number;
  y: number;
  /** False for a finding about the whole sheet, which hangs on the paper's edge. */
  anchored: boolean;
}

/**
 * Where each review pin sits, in DESIGN coordinates — one entry per finding.
 *
 * TWO rules, and both were defects first:
 *
 *  • **Findings that share an element fan out sideways.** Two of the demo's
 *    three are about the same room, and stacked pins are one pin as far as a
 *    viewer is concerned.
 *  • **A finding about the whole sheet still gets a pin**, on the paper's top
 *    edge where the drawing has not started. The first version gave it a
 *    permanently-open card in the corner instead, which covered the hall, its
 *    dimension chains, and half of what the frame was meant to show — and left
 *    two cards open at once, so nothing said which one the cursor had opened.
 */
export function pinAnchors(ctx: TargetContext): PinAnchor[] {
  const seen = new Map<string, number>();
  const { spec, state } = ctx;
  let sheetWide = 0;
  return state.review.findings.map((f) => {
    const base = f.archId ? roomAnchor(ctx, f.archId) : null;
    if (!base) {
      // The paper's top edge, stepped along it if there is more than one.
      const n = sheetWide++;
      const w = worldToDesign(
        spec,
        state.camera,
        spec.sheet.x + spec.sheet.w * 0.09 + n * (PIN_W + 10) * spec.ck,
        spec.sheet.y + spec.sheet.h * 0.045,
      );
      return { x: w.x, y: w.y, anchored: false };
    }
    const n = seen.get(f.archId ?? "") ?? 0;
    seen.set(f.archId ?? "", n + 1);
    // A pin is a fixed-size piece of chrome, so the fan-out is in DESIGN units:
    // scaling it by the camera would overlap the pins at the far end of a zoom
    // out, which is the one place the fan exists to prevent.
    return {
      x: base.x + n * (PIN_W + 8) * spec.ck,
      y: base.y - n * 5 * spec.ck,
      anchored: true,
    };
  });
}

/** The sheet's box in DESIGN coordinates — where the drawing actually is. */
export function sheetOnScreen(ctx: TargetContext): Rect {
  const { spec, state } = ctx;
  const tl = worldToDesign(spec, state.camera, spec.sheet.x, spec.sheet.y);
  const z = state.camera.zoom;
  return { x: tl.x, y: tl.y, w: spec.sheet.w * z, h: spec.sheet.h * z };
}

/**
 * Where the ONE open finding card goes: beside the paper, never on it.
 *
 * A card dropped under its own pin covers the room the finding is about and,
 * half the time, the room's label — so the reader is shown a complaint and has
 * the evidence taken away in the same gesture. The canvas around the sheet is
 * empty; the card goes there, on whichever side has room, vertically near its
 * pin, and `ReviewPins` draws a leader back to it.
 *
 * On a phone there is no side room, so it falls back to under the paper — and
 * returns `null` when an open export menu has taken that space. A card drawn
 * underneath a menu is a card nobody reads, and half of one peeping out from
 * behind it reads as a layout bug; the pin stays, which is what actually marks
 * the finding.
 */
export function findingCardBox(ctx: TargetContext, pin: { x: number; y: number }): Rect | null {
  const { spec } = ctx;
  const gap = 18 * ctx.spec.ck;
  const w = spec.pinCardW;
  const sheet = sheetOnScreen(ctx);
  const h = spec.pinCardLines * 14 * spec.ck + 58 * spec.ck;

  const leftRoom = sheet.x - gap - 12;
  const rightRoom = spec.W - (sheet.x + sheet.w + gap) - 12;
  const y = clampRange(pin.y - h * 0.35, spec.stage.y + 12, spec.stage.y + spec.stage.h - h - 12);

  if (leftRoom >= w && pin.x <= spec.W / 2) {
    return { x: sheet.x - gap - w, y, w, h };
  }
  if (rightRoom >= w) {
    return { x: sheet.x + sheet.w + gap, y, w, h };
  }
  if (leftRoom >= w) {
    return { x: sheet.x - gap - w, y, w, h };
  }
  // No side room — under the paper, clamped into the stage.
  const below: Rect = {
    x: clampRange(pin.x - w / 2, 12, spec.W - w - 12),
    y: clampRange(sheet.y + sheet.h + gap, spec.stage.y + 12, spec.stage.y + spec.stage.h - h - 12),
    w,
    h,
  };
  if (ctx.state.exportMenu.open > 0.05) {
    const menu = exportMenuBox(ctx);
    // Mostly behind the menu — the pin says enough on its own.
    const hidden = Math.min(below.y + below.h, menu.y + menu.h) - Math.max(below.y, menu.y);
    if (hidden > below.h * 0.4) return null;
  }
  return below;
}

function clampRange(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.min(Math.max(v, lo), hi > lo ? hi : lo);
}

/** The pin's own size, in units of `ck`. `ReviewPins` draws it; `layoutMap` aims at it. */
export const PIN_W = 28;
export const PIN_H = 22;

/** The open export menu's own box, in DESIGN coordinates. */
export function exportMenuBox(ctx: TargetContext): Rect {
  const { spec } = ctx;
  const m = spec.exportMenu;
  const rows = EXPORT_GROUPS.reduce((n, g) => n + g.items.length, 0);
  const h = m.pad * 2 + EXPORT_GROUPS.length * m.labelH + rows * m.rowH + (EXPORT_GROUPS.length - 1) * m.pad;

  if (m.mode === "sheet") {
    return { x: 0, y: spec.H - h, w: spec.W, h };
  }
  const chrome = sheetChrome(spec, ctx.storeys, ctx.state.review.badgeCount);
  const btn = chrome.exportBtn;
  const anchor = worldToDesign(spec, ctx.state.camera, btn.x + btn.w, btn.y + btn.h);
  const x = Math.min(Math.max(8, anchor.x - m.w), spec.W - m.w - 8);
  const y = Math.min(anchor.y + 6 * spec.k, spec.H - h - 8);
  return { x, y, w: m.w, h };
}

/** One item's row in the open export menu, in DESIGN coordinates. */
export function exportItemBox(ctx: TargetContext, label: string): Rect | null {
  const { spec } = ctx;
  const m = spec.exportMenu;
  const box = exportMenuBox(ctx);
  let y = box.y + m.pad;
  for (const group of EXPORT_GROUPS) {
    y += m.labelH;
    for (const item of group.items) {
      if (item.label === label) {
        return { x: box.x + m.pad, y, w: box.w - m.pad * 2, h: m.rowH };
      }
      y += m.rowH;
    }
    y += m.pad;
  }
  return null;
}

/** The tweaks slider's track and its Save button, in DESIGN coordinates. */
export function tweaksControls(ctx: TargetContext): { track: Rect; save: Rect; reset: Rect } {
  const { spec } = ctx;
  const { track, save, reset } = tweaksMetrics(spec);

  if (spec.tweaks.mode === "docked") return { track, save, reset };
  // Floating: the panel rides the sheet, so its controls go through the camera.
  const toDesign = (r: Rect): Rect => {
    const a = worldToDesign(spec, ctx.state.camera, r.x, r.y);
    const z = ctx.state.camera.zoom;
    return { x: a.x, y: a.y, w: r.w * z, h: r.h * z };
  };
  return { track: toDesign(track), save: toDesign(save), reset: toDesign(reset) };
}

/** The command bar's input and send button, in DESIGN coordinates. */
export function commandControls(spec: LayoutSpec): { input: Rect; send: Rect } {
  const k = spec.k;
  const bar = spec.commandBar;
  const btn = 34 * k;
  const pad = 10 * k;
  const send: Rect = { x: bar.x + bar.w - pad - btn, y: bar.y + (bar.h - btn) / 2, w: btn, h: btn };
  const mic: Rect = { x: send.x - 4 * k - btn, y: send.y, w: btn, h: btn };
  return {
    input: { x: bar.x + pad, y: bar.y + (bar.h - btn) / 2, w: mic.x - 6 * k - (bar.x + pad), h: btn },
    send,
  };
}

/**
 * The point a `CursorTarget` names, normalised to the design box.
 *
 * TOTAL: an unresolvable target (a room the drawing does not carry, a menu item
 * in a menu that is shut) falls back to the middle of the stage rather than
 * returning `NaN`. A cursor that renders at `NaN` disappears for the rest of the
 * loop; a cursor that parks in the middle is merely uninteresting.
 */
export function resolveTarget(ctx: TargetContext, target: CursorTarget | null): Vec {
  const { spec } = ctx;
  const fallback = norm(spec, spec.stage.x + spec.stage.w / 2, spec.stage.y + spec.stage.h / 2);
  if (!target) return fallback;

  switch (target.kind) {
    case "point": {
      const x = Number.isFinite(target.at.x) ? target.at.x : 0.5;
      const y = Number.isFinite(target.at.y) ? target.at.y : 0.5;
      return { x, y };
    }

    case "ref": {
      switch (target.ref) {
        case "composer.input": {
          const r = spec.composer.input;
          return norm(spec, r.x + 40 * spec.k, r.y + 20 * spec.k);
        }
        case "composer.typology":
          return centreOf(spec, spec.composer.typology);
        case "composer.cta":
          return centreOf(spec, spec.composer.cta);
        case "command.input": {
          const r = commandControls(spec).input;
          return norm(spec, r.x + 30 * spec.k, r.y + r.h / 2);
        }
        case "command.send":
          return centreOf(spec, commandControls(spec).send);
        case "sheet.tweak":
          return worldCentre(ctx, sheetChrome(spec, ctx.storeys, ctx.state.review.badgeCount).tweakBtn);
        case "sheet.export":
          return worldCentre(ctx, sheetChrome(spec, ctx.storeys, ctx.state.review.badgeCount).exportBtn);
        case "sheet.reviewBadge":
          return worldCentre(ctx, sheetChrome(spec, ctx.storeys, ctx.state.review.badgeCount).reviewBadge);
        case "tweaks.slider": {
          const t = tweaksControls(ctx).track;
          // The thumb, not the middle of the track — the cursor is dragging it.
          const p = Number.isFinite(ctx.state.tweaks.thumb) ? ctx.state.tweaks.thumb : 0;
          return norm(spec, t.x + t.w * Math.min(1, Math.max(0, p)), t.y + t.h / 2);
        }
        case "tweaks.save":
          return centreOf(spec, tweaksControls(ctx).save);
      }
      return fallback;
    }

    case "room": {
      const a = roomAnchor(ctx, target.archId);
      return a ? norm(spec, a.x, a.y) : worldCentre(ctx, spec.sheet);
    }

    case "pin": {
      const anchors = pinAnchors(ctx);
      const a = anchors[target.index] ?? anchors[0];
      if (!a) return worldCentre(ctx, spec.sheet);
      // A pin floats just above its anchor, so the cursor aims at the PIN, not
      // at the element under it. `ReviewPins` uses the same two constants.
      return norm(spec, a.x, a.y - (PIN_H / 2 + 8) * spec.ck);
    }

    case "storey": {
      const chrome = sheetChrome(spec, ctx.storeys, ctx.state.review.badgeCount);
      const chip = chrome.storeyChips[target.page] ?? chrome.storeyChips[0];
      return chip ? worldCentre(ctx, chip) : worldCentre(ctx, spec.sheet);
    }

    case "exportItem": {
      const r = exportItemBox(ctx, target.item);
      return r ? centreOf(spec, r) : fallback;
    }
  }
}

function centreOf(spec: LayoutSpec, r: Rect): Vec {
  const c = centre(r);
  return norm(spec, c.x, c.y);
}

/**
 * The cursor's position this frame: `from` and `to`, lerped by `cursor.p`.
 *
 * ⚠ `p` arrives ALREADY EASED (`types.ts` § CursorState). Re-applying a curve
 * here is the classic double-ease, and it reads as the pointer hesitating.
 */
export function cursorPoint(ctx: TargetContext): Vec {
  const { cursor } = ctx.state;
  const to = resolveTarget(ctx, cursor.to);
  if (!cursor.from) return to;
  const from = resolveTarget(ctx, cursor.from);
  const p = Number.isFinite(cursor.p) ? Math.min(1, Math.max(0, cursor.p)) : 1;
  return { x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p };
}
