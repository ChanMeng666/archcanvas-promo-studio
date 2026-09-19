/**
 * The screenplay: what happens, and when.
 *
 * Beats are declared in SECONDS, never frames — the web host runs a rAF clock
 * and the film runs `frame / fps`, and a beat table in frames would belong to
 * one of them. `at.ts` folds this into a `ReplicaState`; nothing here computes
 * a state.
 *
 * The demo's CONTENT (brief, title, chips, the parametric values, the review
 * findings, the rendering) arrives as `DemoInputs` rather than being imported,
 * so the same screenplay can run a second brief in the film without a second
 * screenplay — and so this directory keeps its zero-import rule.
 */

import { clamp01 } from "./easing";
import {
  DRAFTING_PHASES,
  HONESTY_CAPTION,
  TWEAK_SAVED_TOAST,
} from "./strings";
import type {
  Beat,
  ChapterId,
  ChapterMark,
  CursorRef,
  CursorTarget,
  DemoInputs,
  DraftingStep,
  Screenplay,
} from "./types";

/** The landing loop's length. */
export const DURATION_SEC = 35;

/**
 * The frame the SERVER renders, and the one a reduced-motion reader sees.
 *
 * Deliberately not `DURATION_SEC`: the loop ends on a fade, and a poster of a
 * faded stage is an empty box. 33.5 s is the export menu open on the CAD group
 * — the finished plan, its storeys, its review badge and a real export list in
 * one frame.
 */
export const POSTER_SEC = 33.5;

export const CHAPTERS: readonly ChapterMark[] = [
  { id: "brief", at: 0, label: "Brief" },
  { id: "draw", at: 5.5, label: "Draw" },
  { id: "edit", at: 13, label: "Edit" },
  { id: "tweak", at: 19, label: "Tweak" },
  { id: "review", at: 23.5, label: "Review" },
  { id: "render", at: 28, label: "Render" },
  { id: "export", at: 31.5, label: "Export" },
] as const;

/** The drafting sheet's script, taken from the real phase lines. */
const DRAFTING_STEPS: readonly DraftingStep[] = DRAFTING_PHASES.map((p) =>
  "pass" in p ? { line: p.line, pass: p.pass } : { line: p.line },
);

/**
 * The townhouse the landing loop designs.
 *
 * The brief is the real one from the showcase roster (`two-storey-townhouse` in
 * `src/lib/showcase.generated.ts`), so the words on screen are words the product
 * has actually been given.
 *
 * ⚠ `findings` is the ONE field this fixture cannot supply honestly. A review
 * pin must quote the real output of the variant it hangs on, and that variant is
 * baked by the demo generator — so the fixture carries self-identifying
 * placeholders instead of invented architectural criticism, and
 * `tests/studioReplicaStrings.test.ts` asserts the marker so they can never be
 * mistaken for shippable copy. The landing page and the film both pass the
 * generated inputs.
 */
export const FIXTURE_DEMO: DemoInputs = {
  brief:
    "A narrow two-storey townhouse: hall, living and kitchen downstairs, two double bedrooms and a bathroom upstairs.",
  typology: "Residential",
  title: "Two-storey Townhouse",
  roomChips: [
    "Hall",
    "WC",
    "Living / Dining",
    "Kitchen",
    "Landing",
    "Bath",
    "Bedroom 1",
    "Bedroom 2",
  ],
  kitchen: { archId: "r_kitchen", label: "Kitchen" },
  editCommand: "Widen the kitchen and move its door to the hall side.",
  param: {
    name: "HALL",
    unit: "mm",
    values: [2400, 2600, 2750, 2900],
    variants: ["tweak-0", "tweak-1", "tweak-2", "tweak-3"],
  },
  findings: [
    { message: "FIXTURE finding 1 — replaced by the baked variant's review output." },
    {
      message: "FIXTURE finding 2 — replaced by the baked variant's review output.",
      archId: "r_hall",
    },
    {
      message: "FIXTURE finding 3 — replaced by the baked variant's review output.",
      archId: "r_kitchen",
    },
  ],
  renderingSrc: "/showcase/renders/two-storey-townhouse-exterior.webp",
  pageCount: 2,
};

/**
 * Build the 35 s landing loop for a given demo.
 *
 * The beat table is fixed; only the words and the variant ids come from `demo`.
 * Beats are returned in ascending `at` order, which `at.ts` relies on for its
 * fold (a later beat overwrites what an earlier one set).
 */
export function buildScreenplay(demo: DemoInputs): Screenplay {
  const { kitchen, param } = demo;

  const beats: Beat[] = [
    /* ── Brief ─────────────────────────────────────── 0 – 5.5 ───────────── */
    b(0, 0.8, "brief", { k: "cursorTo", to: ref("composer.input"), ease: "outCubic" }),
    b(0.8, 0.18, "brief", { k: "click" }),
    b(1.0, 3.0, "brief", { k: "typeBrief", text: demo.brief }),
    b(4.05, 0.4, "brief", { k: "cursorTo", to: ref("composer.typology"), ease: "outCubic" }),
    b(4.45, 0.18, "brief", { k: "click" }),
    b(4.45, 0.25, "brief", { k: "pickTypology", label: demo.typology }),
    b(4.8, 0.4, "brief", { k: "cursorTo", to: ref("composer.cta"), ease: "outCubic" }),
    b(5.2, 0.18, "brief", { k: "click" }),
    b(5.2, 0.3, "brief", { k: "launch" }),

    /* ── Draw ──────────────────────────────────────── 5.5 – 13 ──────────── */
    // The sheet IS the studio while it is up — the drawing only begins once it
    // has finished, exactly as it does in the product.
    b(5.5, 3.8, "draw", {
      k: "drafting",
      steps: DRAFTING_STEPS,
      title: demo.title,
      chips: demo.roomChips,
    }),
    // The composer's controls do not exist in Act II, so the cursor is parked on
    // the canvas itself for the handoff — a symbolic target the renderer can
    // still resolve is the difference between a parked cursor and a crash.
    b(5.5, 0.9, "draw", {
      k: "cursorTo",
      to: { kind: "point", at: { x: 0.5, y: 0.8 } },
      ease: "outCubic",
    }),
    // The honesty caption. 4.5 s on screen, against a 3 s floor the tests
    // integrate rather than assume.
    b(8.0, 4.5, "draw", { k: "caption", text: HONESTY_CAPTION }),
    b(9.3, 3.5, "draw", { k: "drawPlan", variant: "base", page: 0 }),
    b(12.5, 0.6, "draw", { k: "camera", to: { cx: 0.5, cy: 0.5, zoom: 1 } }),

    /* ── Edit ──────────────────────────────────────── 13 – 19 ───────────── */
    // The camera leans into the lower-left quarter BEFORE the edit, and stays
    // there through the morph. That is where the whole change happens — the
    // kitchen takes the building's full width and the hall and the powder room
    // give up the strip it takes — and from the fit, at 1100 px, a viewer simply
    // cannot see it happen. The push is inside `CAMERA_ENVELOPE`, so the sheet
    // stays whole (`layout.ts`).
    b(13.0, 0.9, "edit", { k: "camera", to: { cx: 0.42, cy: 0.54, zoom: 1.06 } }),
    b(13.0, 0.6, "edit", { k: "cursorTo", to: room(kitchen.archId), ease: "outCubic" }),
    b(13.6, 0.18, "edit", { k: "click" }),
    b(13.6, 0.3, "edit", {
      k: "selectRoom",
      archId: kitchen.archId,
      label: kitchen.label,
    }),
    b(13.95, 0.45, "edit", { k: "cursorTo", to: ref("command.input"), ease: "outCubic" }),
    b(14.4, 0.18, "edit", { k: "click" }),
    b(14.6, 2.55, "edit", { k: "typeCommand", text: demo.editCommand }),
    b(17.2, 0.35, "edit", { k: "cursorTo", to: ref("command.send"), ease: "outCubic" }),
    b(17.55, 0.18, "edit", { k: "click" }),
    b(17.55, 0.25, "edit", { k: "send" }),
    // 350 ms crossfade, then the parent geometry lingers as a dashed ghost —
    // the same two timings the real canvas uses.
    b(17.9, 0.35, "edit", {
      k: "morphPlan",
      from: "base",
      to: "edit-after",
      ghostSec: 1.6,
    }),
    // …and back out to the whole drawing once the change has landed. The tweak
    // that follows moves a wall the viewer needs to see in context, and the
    // panel that moves it floats on the sheet's right.
    b(18.4, 0.6, "edit", { k: "camera", to: { cx: 0.5, cy: 0.5, zoom: 1 } }),

    /* ── Tweak ─────────────────────────────────────── 19 – 23.5 ─────────── */
    b(19.0, 0.45, "tweak", { k: "cursorTo", to: ref("sheet.tweak"), ease: "outCubic" }),
    b(19.45, 0.18, "tweak", { k: "click" }),
    b(19.45, 0.35, "tweak", { k: "openTweaks" }),
    b(19.95, 0.4, "tweak", { k: "cursorTo", to: ref("tweaks.slider"), ease: "outCubic" }),
    b(20.4, 1.8, "tweak", {
      k: "tweak",
      param: param.name,
      variants: param.variants,
      values: param.values,
      unit: param.unit,
    }),
    b(22.25, 0.35, "tweak", { k: "cursorTo", to: ref("tweaks.save"), ease: "outCubic" }),
    b(22.6, 0.18, "tweak", { k: "click" }),
    b(22.6, 0.25, "tweak", { k: "saveTweak" }),
    b(22.9, 1.6, "tweak", { k: "toast", text: TWEAK_SAVED_TOAST }),

    /* ── Review ────────────────────────────────────── 23.5 – 28 ─────────── */
    b(23.5, 0.4, "review", {
      k: "cursorTo",
      to: ref("sheet.reviewBadge"),
      ease: "outCubic",
    }),
    b(23.9, 0.18, "review", { k: "click" }),
    b(23.9, 0.25, "review", { k: "reviewBadge", count: demo.findings.length }),
    b(24.2, 1.2, "review", { k: "dropPins", pins: demo.findings }),
    b(25.5, 0.45, "review", { k: "cursorTo", to: pin(1), ease: "outCubic" }),
    b(25.95, 0.18, "review", { k: "click" }),
    b(25.95, 0.35, "review", { k: "openPin", index: 1 }),
    // Toward the pin, not away from it. The first version pushed to `cy: 0.44`,
    // which frames the storey ABOVE the finding's own room — and at 1.12 it also
    // slid the title block under the command bar. Both fixed by aiming at the
    // thing the pin is about and staying inside `CAMERA_ENVELOPE`.
    b(25.95, 0.8, "review", { k: "camera", to: { cx: 0.44, cy: 0.545, zoom: 1.06 } }),

    /* ── Render ────────────────────────────────────── 28 – 31.5 ─────────── */
    b(28.0, 0.35, "render", { k: "cursorTo", to: storey(1), ease: "outCubic" }),
    b(28.35, 0.18, "render", { k: "click" }),
    b(28.35, 0.3, "render", { k: "switchStorey", page: 1 }),
    b(29.0, 0.3, "render", { k: "cursorTo", to: storey(0), ease: "outCubic" }),
    b(29.3, 0.18, "render", { k: "click" }),
    b(29.3, 0.3, "render", { k: "switchStorey", page: 0 }),
    b(29.8, 0.9, "render", { k: "camera", to: { cx: 0.5, cy: 0.5, zoom: 1 } }),
    b(29.8, 1.5, "render", { k: "showRendering", src: demo.renderingSrc }),

    /* ── Export ────────────────────────────────────── 31.5 – 35 ─────────── */
    b(31.5, 0.45, "export", { k: "cursorTo", to: ref("sheet.export"), ease: "outCubic" }),
    b(31.95, 0.18, "export", { k: "click" }),
    b(31.95, 0.35, "export", { k: "openExport" }),
    b(31.95, 0.6, "export", { k: "camera", to: { cx: 0.57, cy: 0.5, zoom: 1.04 } }),
    b(32.4, 0.5, "export", { k: "cursorTo", to: exportItem("DXF"), ease: "outCubic" }),
    b(32.9, 1.3, "export", { k: "hoverExport", item: "DXF" }),
    b(34.2, 0.8, "export", { k: "loopFade" }),
  ];

  return {
    durationSec: DURATION_SEC,
    posterSec: POSTER_SEC,
    chapters: CHAPTERS,
    beats,
  };
}

/* ── tiny constructors, so the table above reads as a table ──────────────── */

function b(at: number, dur: number, chapter: ChapterId, action: Beat["action"]): Beat {
  return { at, dur, chapter, action };
}

function ref(r: CursorRef): CursorTarget {
  return { kind: "ref", ref: r };
}

function room(archId: string): CursorTarget {
  return { kind: "room", archId };
}

function pin(index: number): CursorTarget {
  return { kind: "pin", index };
}

function storey(page: number): CursorTarget {
  return { kind: "storey", page };
}

function exportItem(item: string): CursorTarget {
  return { kind: "exportItem", item };
}

/* ── time warp ───────────────────────────────────────────────────────────── */

/** One cut of the film: `sec` seconds of screen time covering a span of the loop. */
export interface SceneCut {
  /** Where in the screenplay this cut starts. */
  replicaFrom: number;
  /** Where it ends — may be BEFORE `replicaFrom` for a reverse cut. */
  replicaTo: number;
  /** How many seconds of film it occupies. */
  sec: number;
}

/**
 * Map a scene's own local time onto screenplay time.
 *
 * This is the only stretching the film does: a 15 s cut runs the same beats
 * about 1.8× faster, a 120 s cut runs them slower with room to breathe, and
 * neither needs its own screenplay. Linear and clamped — an eased warp would
 * make a beat's duration depend on where in the cut it fell, which is exactly
 * the kind of thing that makes two renders of one frame disagree.
 */
export function mapSceneTime(localSec: number, cut: SceneCut): number {
  if (!Number.isFinite(cut.sec) || cut.sec <= 0) return cut.replicaFrom;
  const p = clamp01(Number.isFinite(localSec) ? localSec / cut.sec : 0);
  return cut.replicaFrom + (cut.replicaTo - cut.replicaFrom) * p;
}
