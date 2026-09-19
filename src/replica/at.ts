/**
 * `at(screenplay, t) → ReplicaState` — the whole replica, as a function of time.
 *
 * TOTAL AND PURE, and both halves are load-bearing:
 *
 *  • **Pure** because the same `t` has to paint the same pixels in a browser at
 *    60 Hz and in a film renderer at 30 fps, on a machine that may render frame
 *    900 before frame 12. Nothing in here reads a clock, a random source or a
 *    global. The only entropy is `hash32`, seeded by index.
 *  • **Total** because `t` arrives from a rAF delta and from `frame / fps`, and
 *    both can hand over something silly. A negative `t`, a `t` past the end, a
 *    `NaN` — each returns a valid state rather than throwing into a render loop
 *    that has no way to recover.
 *
 * The evaluator is a FOLD: beats are applied in ascending `at`, each with its
 * own local progress, and a later beat overwrites what an earlier one set. That
 * is what makes `camera` and `cursorTo` able to say "from wherever we were" —
 * the accumulated state at that point in the fold IS where we were.
 */

import {
  applyEase,
  clamp,
  clamp01,
  easeInOutCubic,
  easeOutCubic,
  easeOutQuad,
  envelope,
  hashUnit,
  lerp,
  slice,
} from "./easing";
import {
  COMMAND_PLACEHOLDER_LATEST,
  DRAFTING_REAL_SEC,
  commandPlaceholderFor,
  formatElapsed,
  versionLabel,
} from "./strings";
import { LAYER_BANDS } from "./types";
import type {
  Beat,
  ChapterId,
  LayerBand,
  ReplicaState,
  Screenplay,
  VariantId,
} from "./types";

/** How many nodes of a layer may be mid-stroke at once. */
export const MAX_SIMULTANEOUS_NODES = 70;

/** The typing rhythm's seed. Any constant would do; this one is arbitrary and fixed. */
const TYPING_SEED = 0x5eed;

/** Caret blink period, in seconds (on for half of it). */
const CARET_PERIOD_SEC = 1.06;

/**
 * Where each layer band starts and finishes inside the draw beat.
 *
 * Overlapping on purpose: the walls are still closing when the doors start, so
 * the drawing reads as one hand moving rather than five passes.
 */
const BAND_WINDOWS: readonly [number, number][] = [
  [0.0, 0.4], // shell — floors and walls
  [0.18, 0.56], // openings — doors and glazing
  [0.4, 0.74], // furniture
  [0.6, 0.9], // dimensions
  [0.78, 1.0], // text
];

function initialState(t: number): ReplicaState {
  return {
    t,
    chapter: "brief",
    act: "composer",
    actProgress: 0,
    cursor: { from: null, to: null, p: 1, ease: "linear", pressed: false, ripple: 0 },
    composer: { text: "", caret: false, typology: null, ctaPressed: false },
    drafting: {
      visible: false,
      line: "",
      pass: null,
      title: "",
      chips: [],
      chipsVisibleCount: 0,
      elapsed: formatElapsed(0),
    },
    plan: {
      variant: "base",
      page: 0,
      bands: [0, 0, 0, 0, 0],
      crossfade: null,
      ghost: null,
    },
    selection: { archId: null, label: null },
    command: { placeholder: COMMAND_PLACEHOLDER_LATEST, text: "", sending: false },
    tweaks: {
      open: 0,
      param: null,
      value: 0,
      thumb: 0,
      unit: "",
      activeVariant: null,
      saved: false,
    },
    storey: { page: 0, chipsVisible: false },
    review: { badgeCount: 0, pinsDropped: [], findings: [], openPin: null },
    rendering: { p: 0, src: null },
    exportMenu: { open: 0, hovered: null },
    toast: { text: null, p: 0 },
    caption: { text: null, p: 0 },
    camera: { cx: 0.5, cy: 0.52, zoom: 0.92 },
    zoomPercent: 92,
    versionLabel: versionLabel(1),
    loopFade: 0,
  };
}

/**
 * The state at time `t`.
 *
 * `t` is clamped to `[0, durationSec]` and a non-finite `t` is read as 0, so
 * `at(sp, NaN)` is the opening frame and `at(sp, 1e9)` is the closing one.
 */
export function at(sp: Screenplay, t: number): ReplicaState {
  const tc = Number.isFinite(t) ? clamp(t, 0, sp.durationSec) : 0;
  const s = initialState(tc);

  // Two facts the fold needs that live in the screenplay rather than in a beat:
  // the panel has to open showing the knob it is about to move, and the storey
  // chips only exist on a plan that has storeys.
  seedTweaks(sp, s);
  const hasStoreys = sp.beats.some((b) => b.action.k === "switchStorey");

  // The version caption climbs as edits land. Held here rather than in the
  // state so an action can bump it without every other action carrying it.
  let version = 1;

  for (const beat of sp.beats) {
    if (tc < beat.at) continue;
    const p = beat.dur > 0 ? clamp01((tc - beat.at) / beat.dur) : 1;
    version = applyBeat(s, beat, p, tc, version);
  }

  // ── derived ──────────────────────────────────────────────────────────────
  s.chapter = chapterAt(sp, tc);
  s.zoomPercent = Math.round(s.camera.zoom * 100);
  s.versionLabel = versionLabel(version);
  s.composer.caret =
    Math.floor(tc / (CARET_PERIOD_SEC / 2)) % 2 === 0 && s.act === "composer";
  s.command.placeholder = s.selection.label
    ? commandPlaceholderFor(s.selection.label)
    : COMMAND_PLACEHOLDER_LATEST;
  s.storey.chipsVisible = hasStoreys && s.plan.bands[0] > 0;

  return s;
}

/** The chapter `t` falls in — the last mark at or before it. */
export function chapterAt(sp: Screenplay, t: number): ChapterId {
  const tc = Number.isFinite(t) ? clamp(t, 0, sp.durationSec) : 0;
  let id: ChapterId = sp.chapters.length > 0 ? sp.chapters[0].id : "brief";
  for (const c of sp.chapters) {
    if (tc >= c.at) id = c.id;
  }
  return id;
}

function seedTweaks(sp: Screenplay, s: ReplicaState): void {
  for (const beat of sp.beats) {
    if (beat.action.k !== "tweak") continue;
    const a = beat.action;
    s.tweaks.param = a.param;
    s.tweaks.unit = a.unit;
    s.tweaks.value = a.values.length > 0 ? a.values[0] : 0;
    s.tweaks.thumb = 0;
    s.tweaks.activeVariant = a.variants.length > 0 ? a.variants[0] : null;
    return;
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  The fold                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

function applyBeat(
  s: ReplicaState,
  beat: Beat,
  p: number,
  t: number,
  version: number,
): number {
  const a = beat.action;
  switch (a.k) {
    case "cursorTo": {
      const ease = a.ease ?? "outCubic";
      // `from` is wherever the previous move left us — which is exactly what the
      // fold is holding right now.
      if (s.cursor.to !== a.to) s.cursor.from = s.cursor.to;
      s.cursor.to = a.to;
      s.cursor.ease = ease;
      s.cursor.p = applyEase(ease, p);
      return version;
    }

    case "click": {
      // Down for the first half of the beat, and a ripple that outlives it.
      s.cursor.pressed = p < 0.45;
      s.cursor.ripple = p >= 1 ? 0 : easeOutQuad(p);
      return version;
    }

    case "typeBrief": {
      s.composer.text = a.text.slice(0, typedLength(a.text, p));
      return version;
    }

    case "pickTypology": {
      if (p >= 0.5) s.composer.typology = a.label;
      return version;
    }

    case "launch": {
      s.composer.ctaPressed = p < 0.6;
      s.actProgress = easeInOutCubic(p);
      s.act = s.actProgress >= 0.5 ? "studio" : "composer";
      return version;
    }

    case "drafting": {
      const n = a.steps.length;
      const idx = n === 0 ? -1 : Math.min(n - 1, Math.floor(p * n));
      const step = idx >= 0 ? a.steps[idx] : null;
      s.drafting.visible = p < 1;
      s.drafting.line = step ? step.line : "";
      s.drafting.pass = step?.pass ? [step.pass[0], step.pass[1]] : null;
      // The title arrives with the streaming tool args, a beat after the sheet.
      s.drafting.title = p >= 0.12 ? a.title : "";
      s.drafting.chips = a.chips;
      // Room chips land once the gate has described a candidate — the middle of
      // the run, not the start.
      s.drafting.chipsVisibleCount = Math.floor(
        slice(0.35, 0.8, p) * a.chips.length,
      );
      // The clock counts the REAL timescale, not the compressed one. See
      // DRAFTING_REAL_SEC.
      s.drafting.elapsed = formatElapsed(p * DRAFTING_REAL_SEC);
      return version;
    }

    case "drawPlan": {
      s.plan.variant = a.variant;
      s.plan.page = a.page;
      s.storey.page = a.page;
      s.plan.bands = BAND_WINDOWS.map(([from, to]) =>
        easeOutQuad(slice(from, to, p)),
      );
      return version;
    }

    case "selectRoom": {
      if (p >= 0.5) {
        s.selection.archId = a.archId;
        s.selection.label = a.label;
      }
      return version;
    }

    case "typeCommand": {
      s.command.text = a.text.slice(0, typedLength(a.text, p));
      return version;
    }

    case "send": {
      if (p >= 0.5) s.command.sending = true;
      return version;
    }

    case "morphPlan": {
      s.plan.variant = a.to;
      s.plan.crossfade = p < 1 ? { from: a.from, to: a.to, p: easeInOutCubic(p) } : null;
      // The parent geometry lingers as a dashed overlay, on its OWN clock — it
      // outlives the crossfade by design, so it is measured off wall time in the
      // screenplay rather than off this beat's progress.
      const ghostP = a.ghostSec > 0 ? clamp01((t - beat.at) / a.ghostSec) : 1;
      const opacity = 1 - easeOutCubic(ghostP);
      s.plan.ghost = opacity > 0 ? { variant: a.from, opacity } : null;
      if (p > 0) {
        s.command.sending = false;
        s.command.text = "";
        s.selection.archId = null;
        s.selection.label = null;
      }
      return p > 0 ? Math.max(version, 2) : version;
    }

    case "openTweaks": {
      s.tweaks.open = easeOutCubic(p);
      return version;
    }

    case "tweak": {
      const values = a.values;
      if (values.length === 0) return version;
      const first = values[0];
      const last = values[values.length - 1];
      const eased = easeInOutCubic(p);
      const value = lerp(first, last, eased);
      s.tweaks.param = a.param;
      s.tweaks.unit = a.unit;
      s.tweaks.value = value;
      s.tweaks.thumb = last === first ? 0 : clamp01((value - first) / (last - first));
      const idx = nearestIndex(values, value);
      s.tweaks.activeVariant = a.variants[idx] ?? null;
      // What is DRAWN is the nearest baked variant, not the continuous value —
      // the slider is smooth and the drawing steps, which is what the real
      // debounced recompile looks like too.
      if (s.tweaks.activeVariant) s.plan.variant = s.tweaks.activeVariant;
      return version;
    }

    case "saveTweak": {
      s.tweaks.saved = p >= 0.5;
      s.tweaks.open = 1 - easeOutCubic(p);
      return p >= 0.5 ? Math.max(version, 3) : version;
    }

    case "switchStorey": {
      if (p >= 0.5) {
        s.storey.page = a.page;
        s.plan.page = a.page;
      }
      return version;
    }

    case "reviewBadge": {
      if (p >= 0.5) s.review.badgeCount = a.count;
      return version;
    }

    case "dropPins": {
      const n = a.pins.length;
      s.review.findings = a.pins;
      const span = 0.5;
      s.review.pinsDropped = a.pins.map((_, i) => {
        const start = n > 1 ? (i / (n - 1)) * (1 - span) : 0;
        return easeOutCubic(slice(start, start + span, p));
      });
      return version;
    }

    case "openPin": {
      if (p >= 0.5) s.review.openPin = a.index;
      return version;
    }

    case "showRendering": {
      s.rendering.src = a.src;
      s.rendering.p = easeOutCubic(p);
      return version;
    }

    case "openExport": {
      s.exportMenu.open = easeOutCubic(p);
      return version;
    }

    case "hoverExport": {
      if (p > 0) s.exportMenu.hovered = a.item;
      return version;
    }

    case "camera": {
      const e = easeInOutCubic(p);
      s.camera = {
        cx: lerp(s.camera.cx, a.to.cx, e),
        cy: lerp(s.camera.cy, a.to.cy, e),
        zoom: lerp(s.camera.zoom, a.to.zoom, e),
      };
      return version;
    }

    case "toast": {
      const v = p >= 1 ? 0 : envelope(p, 0.12, 0.22);
      s.toast = v > 0 ? { text: a.text, p: v } : { text: null, p: 0 };
      return version;
    }

    case "caption": {
      const v = p >= 1 ? 0 : envelope(p, 0.1, 0.14);
      s.caption = v > 0 ? { text: a.text, p: v } : { text: null, p: 0 };
      return version;
    }

    case "loopFade": {
      s.loopFade = easeInOutCubic(p);
      return version;
    }
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers the renderer needs too                                            */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * How far a single drawn node is along its stroke.
 *
 * The band gives the layer's progress; this spreads the layer's nodes inside it
 * so a 246-node plan draws as a hand moving across the sheet rather than 246
 * strokes appearing at once. The spread is sized so that at most
 * `MAX_SIMULTANEOUS_NODES` are mid-stroke — on a small layer that is all of
 * them, and the stagger costs nothing.
 *
 * `order` is the node's index within `layer`, `countInLayer` the layer's size.
 */
export function nodeProgress(
  state: ReplicaState,
  layer: LayerBand,
  order: number,
  countInLayer: number,
): number {
  const bandIdx = LAYER_BANDS.indexOf(layer);
  if (bandIdx < 0) return 0;
  const band = state.plan.bands[bandIdx] ?? 0;
  const count = Math.max(1, Math.floor(countInLayer));
  if (count <= MAX_SIMULTANEOUS_NODES) return clamp01(band);
  const spread = clamp(MAX_SIMULTANEOUS_NODES / count, 0.08, 1);
  const i = clamp(Math.floor(order), 0, count - 1);
  const start = (i / (count - 1)) * (1 - spread);
  return clamp01((band - start) / spread);
}

/**
 * How many characters of `text` have been typed at progress `p`.
 *
 * Deterministic and human-looking: each character's dwell is a seeded hash of
 * its index plus a real pause after sentence punctuation, and the whole lot is
 * normalised so the last character always lands exactly at `p === 1`. Strictly
 * non-decreasing in `p`, which the tests assert — a brief that un-types itself
 * for one frame reads as a glitch.
 */
export function typedLength(text: string, p: number, seed: number = TYPING_SEED): number {
  const n = text.length;
  if (n === 0) return 0;
  const x = clamp01(p);
  if (x >= 1) return n;

  let total = 0;
  const cum: number[] = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    total += charWeight(text, i, seed);
    cum[i] = total;
  }
  const target = x * total;
  let count = 0;
  while (count < n && cum[count] <= target) count++;
  return count;
}

/** One character's share of the typing budget. Never zero, never negative. */
function charWeight(text: string, i: number, seed: number): number {
  const base = 0.7 + hashUnit(i, seed) * 0.7;
  const prev = i > 0 ? text.charAt(i - 1) : "";
  let pause = 0;
  if (prev === "." || prev === ":" || prev === "?" || prev === "!") pause = 2.2;
  else if (prev === "," || prev === ";") pause = 1.2;
  else if (prev === " ") pause = 0.15;
  return base + pause;
}

/** Index of the value nearest `v`; ties go to the lower index. */
function nearestIndex(values: readonly number[], v: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < values.length; i++) {
    const d = Math.abs(values[i] - v);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** The variant drawn at time `t` — a convenience for the draw-list loader. */
export function variantAt(sp: Screenplay, t: number): VariantId {
  return at(sp, t).plan.variant;
}
