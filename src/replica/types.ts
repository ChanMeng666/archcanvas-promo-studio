/**
 * The replica's data model.
 *
 * ⚠ HOUSE RULES FOR THIS WHOLE DIRECTORY (they are why this file imports
 * nothing):
 *
 *  1. **Relative imports only, and only to siblings.** These files are copied
 *     verbatim into the promo-film repo, which has no Next.js, no Tailwind and
 *     no `@/` alias. A single `@/lib/...` makes the copy uncompilable there.
 *  2. **Time-pure.** `at(screenplay, t)` is a total function of `t` alone — no
 *     `Date.now`, no `performance.now`, no `Math.random`, no globals. The web
 *     host drives `t` from a rAF clock; the film drives it from `frame / fps`.
 *     Both must paint the same pixels for the same `t`.
 *  3. **No product name for the compiler.** This is a consumer surface, and the
 *     DSL is invisible to the buyer (`tests/marketingNoCode.test.ts` scans this
 *     directory).
 *
 * `tests/studioReplicaPurity.test.ts` enforces 1 and 2 mechanically.
 */

/** The seven acts of the landing loop, in order. */
export type ChapterId =
  | "brief"
  | "draw"
  | "edit"
  | "tweak"
  | "review"
  | "render"
  | "export";

/**
 * A pre-baked drawing. WP-1 bakes one draw list per variant; the same union is
 * declared in `src/lib/marketing/studioDemo.types.ts` and reconciled by WP-3.
 */
export type VariantId =
  | "base"
  | "edit-after"
  | "tweak-0"
  | "tweak-1"
  | "tweak-2"
  | "tweak-3";

/** A point in the replica's stage box, normalised to 0..1. */
export interface Vec {
  x: number;
  y: number;
}

/**
 * Where the cursor is going, said SYMBOLICALLY.
 *
 * The core knows nothing about pixels: the landscape and portrait layouts put
 * the command bar, the toolbar and the storey chips in different places, and a
 * hardcoded coordinate would be wrong in one of them. The renderer owns a
 * `resolve(target) → Vec` table keyed on these; `{ kind: "point" }` is the
 * escape hatch for a move that genuinely is "to this corner".
 */
export type CursorRef =
  /* Act I, the brief composer */
  | "composer.input"
  | "composer.typology"
  | "composer.cta"
  /* Act II, the floating command bar */
  | "command.input"
  | "command.send"
  /* Act II, the sheet's own chrome */
  | "sheet.tweak"
  | "sheet.export"
  | "sheet.reviewBadge"
  /* The tweaks panel */
  | "tweaks.slider"
  | "tweaks.save";

export type CursorTarget =
  | { kind: "point"; at: Vec }
  | { kind: "ref"; ref: CursorRef }
  /** A plan element, by its anchor id — resolved from the drawn geometry. */
  | { kind: "room"; archId: string }
  /** The nth review pin, in `dropPins` order. */
  | { kind: "pin"; index: number }
  /** The storey chip for a page index (0 = entry storey). */
  | { kind: "storey"; page: number }
  /** An item in the open export menu, by its visible label ("DXF"). */
  | { kind: "exportItem"; item: string };

export type EaseName = "linear" | "outCubic" | "inOutCubic" | "outQuad";

/**
 * The layer bands the plan draws in, in order.
 *
 * The same order the product's own plan renderer uses: structure first, then
 * the openings that pierce it, then what stands in the rooms, then the
 * measurements, then the words.
 */
export type LayerBand = "shell" | "openings" | "furniture" | "dims" | "text";

export const LAYER_BANDS: readonly LayerBand[] = [
  "shell",
  "openings",
  "furniture",
  "dims",
  "text",
] as const;

/** One drafting step: the line the sheet prints, and its pass counter if any. */
export interface DraftingStep {
  line: string;
  /** `[round, maxRounds]` — the sheet hides this on pass 1. */
  pass?: [number, number];
}

export interface ReviewFinding {
  message: string;
  /** The element the pin hangs on, when the finding resolves to one. */
  archId?: string;
  /**
   * The STOREY the finding is about, when it is about one.
   *
   * ⚠ A pin belongs to a floor, not to a design. Without this the two
   * ground-floor findings went on hovering over the FIRST floor the moment the
   * storey switched — pointing at rooms that are not there, on a drawing they
   * are not about. A sheet-wide finding (a scale that does not fit the paper)
   * has no level and stays on every page.
   */
  level?: number;
}

export type Action =
  /* ── cursor ───────────────────────────────────────────────────────────── */
  | { k: "cursorTo"; to: CursorTarget; ease?: EaseName }
  | { k: "click" }
  /* ── brief ────────────────────────────────────────────────────────────── */
  | { k: "typeBrief"; text: string }
  | { k: "pickTypology"; label: string }
  | { k: "launch" }
  /* ── draw ─────────────────────────────────────────────────────────────── */
  | { k: "drafting"; steps: readonly DraftingStep[]; title: string; chips: readonly string[] }
  | { k: "drawPlan"; variant: VariantId; page: number }
  /* ── edit ─────────────────────────────────────────────────────────────── */
  | { k: "selectRoom"; archId: string; label: string }
  | { k: "typeCommand"; text: string }
  | { k: "send" }
  | { k: "morphPlan"; from: VariantId; to: VariantId; ghostSec: number }
  /* ── tweak ────────────────────────────────────────────────────────────── */
  | { k: "openTweaks" }
  | {
      k: "tweak";
      param: string;
      variants: readonly VariantId[];
      values: readonly number[];
      unit: "mm";
    }
  | { k: "saveTweak" }
  /* ── review + storeys ─────────────────────────────────────────────────── */
  | { k: "switchStorey"; page: number }
  | { k: "reviewBadge"; count: number }
  | { k: "dropPins"; pins: readonly ReviewFinding[] }
  | { k: "openPin"; index: number }
  /* ── render + export ──────────────────────────────────────────────────── */
  | { k: "showRendering"; src: string }
  | { k: "openExport" }
  | { k: "hoverExport"; item: string }
  /* ── stage ────────────────────────────────────────────────────────────── */
  | { k: "camera"; to: { cx: number; cy: number; zoom: number } }
  | { k: "toast"; text: string }
  | { k: "caption"; text: string }
  | { k: "loopFade" };

/** One scripted action, declared in SECONDS. */
export interface Beat {
  at: number;
  dur: number;
  chapter: ChapterId;
  action: Action;
}

export interface ChapterMark {
  id: ChapterId;
  /** Equals the `at` of that chapter's first beat — asserted by the tests. */
  at: number;
  label: string;
}

export interface Screenplay {
  durationSec: number;
  chapters: readonly ChapterMark[];
  beats: readonly Beat[];
  /**
   * The `t` the STATIC poster frame is rendered at.
   *
   * Not simply `durationSec`: the loop ends on a fade-out, and a server-rendered
   * poster of a faded stage is a blank box behind a no-JS reader's first
   * impression. This is the most representative frame instead (the export menu
   * open on the CAD group), and it is what `StudioSection`'s server render and
   * the reduced-motion path both use.
   */
  posterSec: number;
}

/**
 * Everything the screenplay needs from the pre-baked demo (WP-1).
 *
 * Passed in rather than imported, so that this directory stays free of `@/`
 * imports AND so that the film can drive the same screenplay from a second
 * brief without a second screenplay.
 */
export interface DemoInputs {
  /** The architect's brief, typed character by character in Act I. */
  brief: string;
  /** The typology picked in the composer, by its visible label. */
  typology: string;
  /** The design's name, as the drafting sheet prints it. */
  title: string;
  /** The room chips the drafting sheet fills in. */
  roomChips: readonly string[];
  /** The room the edit chapter selects. */
  kitchen: { archId: string; label: string };
  /** What the architect types into the command bar to edit it. */
  editCommand: string;
  /** The parametric knob the tweak chapter drags. */
  param: {
    name: string;
    unit: "mm";
    /** One value per baked variant, ascending. */
    values: readonly number[];
    variants: readonly VariantId[];
  };
  /** Real review output — never invented copy. */
  findings: readonly ReviewFinding[];
  /** The rendering image shown in the render chapter. */
  renderingSrc: string;
  /** How many storey pages the plan has (1 = single storey, no chips). */
  pageCount: number;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  The state                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export interface CursorState {
  /** Where the cursor is coming from — null before the first move. */
  from: CursorTarget | null;
  /** Where it is going. */
  to: CursorTarget | null;
  /**
   * How far along, ALREADY EASED. The renderer resolves both targets to points
   * and lerps linearly by this — it must not re-apply an easing curve.
   */
  p: number;
  /** Which curve produced `p` — informational, for a renderer that wants it. */
  ease: EaseName;
  /** The button is down. */
  pressed: boolean;
  /** The click ripple, 0 (none) → 1 (spent). */
  ripple: number;
}

export interface ComposerState {
  /** The brief typed SO FAR. */
  text: string;
  /** Blink phase for the caret — a pure function of `t`. */
  caret: boolean;
  /** The picked typology's visible label, or null while free-form. */
  typology: string | null;
  /** The CTA is held down. */
  ctaPressed: boolean;
}

export interface DraftingState {
  visible: boolean;
  line: string;
  /** `[round, maxRounds]`, or null on a pass the sheet does not count. */
  pass: [number, number] | null;
  title: string;
  /** Every room chip the sheet will show, in order. */
  chips: readonly string[];
  /** How many of them have landed. */
  chipsVisibleCount: number;
  /** The mini elapsed timer, as the product formats it ("0:42"). */
  elapsed: string;
}

export interface PlanState {
  variant: VariantId;
  /** Which storey page is on screen; 0 is the entry storey. */
  page: number;
  /** Draw progress per layer band, in `LAYER_BANDS` order. */
  bands: readonly number[];
  /** The in-place morph, while one is running. */
  crossfade: { from: VariantId; to: VariantId; p: number } | null;
  /** The parent geometry, overlaid dashed and fading. */
  ghost: { variant: VariantId; opacity: number } | null;
}

export interface TweaksState {
  /** Panel reveal, 0 (closed) → 1 (open). */
  open: number;
  param: string | null;
  /** The continuous value under the thumb. */
  value: number;
  /** The thumb's position along its track, 0..1. */
  thumb: number;
  unit: string;
  /** The baked variant nearest the continuous value — what is actually drawn. */
  activeVariant: VariantId | null;
  saved: boolean;
}

export interface ReviewState {
  badgeCount: number;
  /** Drop progress per pin, in `dropPins` order. */
  pinsDropped: readonly number[];
  /** The findings themselves, so the renderer needs no second source. */
  findings: readonly ReviewFinding[];
  openPin: number | null;
}

export interface ReplicaState {
  /** The clamped time this state was computed at. */
  t: number;
  chapter: ChapterId;
  act: "composer" | "studio";
  /** The Act I → Act II handoff, 0 (composer) → 1 (studio). */
  actProgress: number;

  cursor: CursorState;
  composer: ComposerState;
  drafting: DraftingState;
  plan: PlanState;
  selection: { archId: string | null; label: string | null };
  command: { placeholder: string; text: string; sending: boolean };
  tweaks: TweaksState;
  storey: { page: number; chipsVisible: boolean };
  review: ReviewState;
  rendering: { p: number; src: string | null };
  exportMenu: { open: number; hovered: string | null };
  toast: { text: string | null; p: number };
  caption: { text: string | null; p: number };
  camera: { cx: number; cy: number; zoom: number };
  /** The canvas toolbar's zoom chip, already rounded the way the product does. */
  zoomPercent: number;
  /** The sheet's version caption — "v1", "v2", … */
  versionLabel: string;
  /** The end-of-loop fade, 0 (opaque) → 1 (gone). */
  loopFade: number;
}
