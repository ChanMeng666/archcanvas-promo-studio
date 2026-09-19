/**
 * The shape of the pre-baked studio demo — the data a coded replica of the
 * studio draws from, on the landing page and in the promo film.
 *
 * NEITHER RUNTIME PARSES SVG AND NEITHER IMPORTS ARCHLANG.
 * `scripts/generate-studio-demo.mjs` compiles the sources in
 * `scripts/studio-demo/` at build time and commits THREE artifacts, which this
 * file is the hand-written contract for — `tsc` is what catches a generator
 * that drifts from it:
 *
 *   • `public/showcase/studio-demo/drawlist.json` — {@link StudioDemoFilm}, the
 *     faithful as-issued sheets. The film repo copies it; no size budget.
 *   • `public/showcase/studio-demo/landing.json` — {@link StudioDemoLanding},
 *     the same drawings without their sheet, slimmed, only the pages the 35 s
 *     screenplay shows. FETCHED by the client, so every kilobyte is on a phone.
 *   • `src/lib/marketing/studioDemo.generated.ts` — {@link StudioDemo}, the
 *     small typed things plus ONE inlined page for the static poster frame.
 *
 * ── FLATTENING: WHY A DRAW LIST IS FAITHFUL ─────────────────────────────────
 *
 * A compiled page is two levels deep and no more: a `<defs>`, a paper `<rect>`,
 * eight named layer groups (`<g id="A-FLOR">` …) each holding leaf shapes, and
 * three anonymous groups at the end holding the north arrow, the scale bar and
 * the level stamp. **No `<g>` carries a `transform`, a `fill`, a `stroke`, a
 * `style`, an `opacity` or a `clip-path`** — every presentational attribute is
 * on the leaf itself. So a leaf's painted result does not depend on its
 * ancestors, and lifting every leaf into one ordered list with a `layer` tag
 * loses nothing.
 *
 * That is an assumption about an upstream compiler, so the generator ASSERTS it
 * rather than trusting it: a `<g>` with any attribute outside
 * `id` / `inkscape:groupmode` / `inkscape:label` fails the build. If a future
 * archlang starts grouping under a transform, `npm run studio-demo:build` stops
 * with the offending tag instead of silently baking a plan that draws in the
 * wrong place. (This is the same upstream-tripwire discipline as `tests/archlang/`:
 * a red one after a bump is the design working.)
 *
 * Two attributes are dropped on the way in, and nothing else is:
 *   • `data-span` — source byte offsets, used by `deterministicActions` to map a
 *     click back to a clause. The replica rewrites no source, and the spans are
 *     ~9 % of the payload.
 *   • `inkscape:*` — Inkscape layer metadata, meaningless without the `<g>`.
 *
 * ── COORDINATES ─────────────────────────────────────────────────────────────
 *
 * Everything is in the page's own `viewBox` units, which are MILLIMETRES.
 * A renderer must set `vector-effect: non-scaling-stroke`, or a 14 mm stroke
 * scales with the building.
 */

/** The six pre-baked states. `tweak-0` is `edit-after` re-stated, not a new design. */
export type VariantId = "base" | "edit-after" | "tweak-0" | "tweak-1" | "tweak-2" | "tweak-3";

/**
 * The CAD layer a node belongs to — `A-FLOR`, `A-WALL`, `A-DOOR`, `A-GLAZ`,
 * `A-FURN`, `A-FLOR-STRS`, `A-ANNO-TEXT`, `A-ANNO-DIMS` as archlang emits them,
 * plus the synthetic `"sheet"` for everything OUTSIDE a named layer group: the
 * paper rect, the north arrow, the scale bar and the level stamp.
 *
 * Left as a plain `string` on purpose. The layer roster belongs to the
 * compiler, and a union here would turn an upstream addition into a type error
 * in code that only ever groups by it.
 */
export type Layer = string;

/** One drawable leaf: a `<polygon>`, `<line>`, `<path>`, `<polyline>`, `<rect>`, `<circle>` or `<ellipse>`. */
export interface DrawNode {
  /** The SVG element name, verbatim. */
  tag: string;
  /** Its attributes, verbatim and in source order, minus `data-span` / `inkscape:*`. */
  attrs: Record<string, string>;
  layer: Layer;
  /** Index of this node within the page's `nodes` array — document order. */
  order: number;
  /** `data-arch-id`: the plan element this belongs to, when it is annotated. */
  archId?: string;
  /** `data-arch-kind`: `room` | `wall` | `door` | `window` | `furniture` | `stair` | … */
  archKind?: string;
  /** `data-arch-label`: the compiler's own name for the element (archlang >= 1.36 owns these). */
  archLabel?: string;
  /** `data-arch-primary`: the one node per element that carries its selection/a11y role. */
  primary?: boolean;
  /**
   * True when the node paints a FILL and strokes nothing — a floor poché, a
   * furniture body, the paper. A stroke-draw animation has no outline to run
   * along, so these fade in instead.
   */
  fillOnly?: boolean;
}

/** One `<text>` leaf. Text fades in; it is never stroke-drawn. */
export interface TextNode {
  attrs: Record<string, string>;
  /** The rendered string, entities already decoded. */
  text: string;
  layer: Layer;
  archId?: string;
}

/** A room's extent, `[minX, minY, maxX, maxY]` in viewBox units — enough to aim a cursor at one. */
export interface RoomBox {
  archId: string;
  label: string;
  bbox: [number, number, number, number];
}

/** One storey = one compiled page = one drawing. */
export interface PlanPage {
  /** The `level` number from the source (0 = ground). */
  level: number;
  /** The storey's name, as the source wrote it: "Ground floor", "First floor". */
  name: string;
  /** `min-x min-y width height`, in millimetres. */
  viewBox: string;
  /**
   * The page's `<defs>…</defs>` markup (the poché fill pattern), with every id
   * NAMESPACED per page (`poche-base-L0`) and every `url(#…)` repointed.
   *
   * ⚠ This is why. Each compiled page declares `id="poche"`. Mount two at once —
   * a morph crossfading `edit-after` over `base`, a film frame holding both
   * storeys — and the second is a duplicate id: the browser resolves
   * `url(#poche)` to whichever came first, so one plan's walls take the other's
   * hatch, and lose it entirely when that page unmounts. Doing it at bake time
   * means neither runtime has to remember.
   */
  defs: string;
  nodes: DrawNode[];
  texts: TextNode[];
  rooms: RoomBox[];
}

export interface Variant {
  id: VariantId;
  pages: PlanPage[];
  /** The value of `param.name` this variant was compiled at — the four tweak variants only. */
  paramValue?: number;
}

/** The parameter the Tweaks beat drags, and the four values it is baked at. */
export interface StudioDemoParam {
  name: string;
  unit: "mm";
  values: number[];
}

// ── The film payload: public/showcase/studio-demo/drawlist.json ─────────────

/**
 * Every variant, every storey, compiled AS ISSUED — paper, title block,
 * schedule, legend. A film frame is 1920 px and a cut can hold the drawing as a
 * document. No size budget: the film repo copies this wholesale.
 */
export interface StudioDemoFilm {
  slug: string;
  title: string;
  param: StudioDemoParam;
  variants: Record<VariantId, Variant>;
}

// ── The landing payload: public/showcase/studio-demo/landing.json ───────────
//
// The same drawings, three reductions, each proved lossless at bake time. It is
// FETCHED, not imported — the landing section asks for it when it scrolls into
// view — so everything here is about bytes on someone's phone.
//
//   1. Compiled from `displaySource`: the drawing WITHOUT its A3 sheet, title
//      block, schedule and legend, so it fills a ~900 px band instead of
//      sitting in the corner of a page. THE DIMENSIONS STAY — "a real,
//      dimensioned floor plan" is the claim the landing page is making, and a
//      demo with the chains taken off would be a different claim.
//   2. Only the pages the 35 s screenplay shows: L0 for base / edit-after /
//      tweak-1..3, and L1 for tweak-3 alone (the one storey switch).
//   3. `tweak-0` is an ALIAS of `edit-after`, `tweak-1..3` are DELTAS on it, and
//      attributes shared across a layer are hoisted into `defaults`.
//
// `resolveLandingPage` in `scripts/generate-studio-demo.mjs` is the reference
// implementation of reading it: follow the alias, then the delta, then merge
// the layer defaults under each node's own attributes.

/** A leaf in the landing payload — a {@link DrawNode} with the duplicated bytes taken out. */
export interface LandingNode {
  tag: string;
  /** ONLY what differs from `LandingPage.defaults[layer + "|" + tag]`. Merge those UNDER these. */
  attrs: Record<string, string>;
  layer: Layer;
  order: number;
  /** Kept on the element's PRIMARY node only — nothing on the landing page addresses another. */
  archId?: string;
  archKind?: string;
  archLabel?: string;
  primary?: true;
  fillOnly?: boolean;
}

/** A `<text>` leaf in the landing payload. Keeps its `archId` — a label fades with its room. */
export interface LandingText {
  attrs: Record<string, string>;
  text: string;
  layer: Layer;
  archId?: string;
}

export interface LandingPage {
  level: number;
  name: string;
  viewBox: string;
  /** Namespaced per page, exactly as {@link PlanPage.defs}. */
  defs: string;
  /** Attributes shared by every node of a `layer + "|" + tag` run. Merge UNDER the node's own. */
  defaults: Record<string, Record<string, string>>;
  nodes: LandingNode[];
  texts: LandingText[];
  rooms: RoomBox[];
}

/**
 * A page stored as a PATCH on another variant's page at the same level.
 *
 * Dragging `HALL` moves the hall wall and what it bounds and nothing else — 37
 * of 283 ground-floor nodes — so the tweak variants patch `edit-after` rather
 * than restating it three times over. The keys of `nodes` / `texts` are indices
 * into the base page's arrays, as decimal strings.
 *
 * It carries NO `defaults` of its own: it reuses the base page's, and the bake
 * refuses to build a delta unless the two are identical, so an unpatched node
 * can never be expanded against the wrong ones.
 */
export interface LandingPageDelta {
  level: number;
  name: string;
  viewBox: string;
  defs: string;
  deltaOf: VariantId;
  nodes: Record<string, LandingNode>;
  texts: Record<string, LandingText>;
  rooms: RoomBox[];
}

export interface LandingVariant {
  id: VariantId;
  /** This variant IS that one — same source, same `let`, same drawing. It has no pages of its own. */
  alias?: VariantId;
  pages?: (LandingPage | LandingPageDelta)[];
  paramValue?: number;
}

export interface StudioDemoLanding {
  slug: string;
  param: StudioDemoParam;
  variants: Record<VariantId, LandingVariant>;
}

/** Narrowing helper — a page is a patch exactly when it names what it patches. */
export function isLandingPageDelta(page: LandingPage | LandingPageDelta): page is LandingPageDelta {
  return "deltaOf" in page;
}

// ── The typed module: src/lib/marketing/studioDemo.generated.ts ─────────────

/**
 * One finding, taken VERBATIM from `lint()` on the final variant. The replica's
 * review pins may not invent text; `code` and `message` are the compiler's own
 * words, and `archId` is the annotated element the diagnostic's source span
 * falls inside.
 */
export interface Finding {
  code: string;
  message: string;
  archId?: string;
  /**
   * The storey the finding is about, when it is about one. A sheet-wide finding
   * (a scale that does not fit) has none.
   *
   * Not in the work package's sketch of this type, and added because without it
   * a renderer cannot know which page to pin a finding on.
   */
  level?: number;
}

/**
 * What the app imports. SMALL THINGS ONLY — no draw lists, because whatever
 * chunk imports this module would carry them into its first load.
 */
export interface StudioDemo {
  /** `two-storey-townhouse` — the same building the showcase gallery ships. */
  slug: string;
  /** What a homeowner types. Verbatim from `SHOWCASE_PLANS` in `src/lib/showcase.generated.ts`. */
  brief: string;
  title: string;
  param: StudioDemoParam;
  /** The room the Edit beat clicks on. */
  kitchen: { archId: string; label: string };
  /** Every room name in the building, ground floor first — the chips the drafting beat lights up. */
  roomChips: string[];
  /** Storey level (as a decimal string) -> the name the source gave it. */
  pageNames: Record<string, string>;
  /** Real `lint()` output on the FINAL variant (`tweak-3`). Never written by hand. */
  findings: Finding[];
  /** Checked numbers from `describe()`. Quoted, not adjectives. */
  facts: Record<string, string | number>;
  /**
   * Where the landing draw lists live, and what they must hash to. The client
   * fetches `path` on IntersectionObserver; `sha256` and `bytes` are what stop
   * the committed JSON and this module drifting apart unnoticed.
   *
   * Both are of the LF-normalised bytes. `core.autocrlf` is true on Windows, so
   * a checked-out `landing.json` is a byte longer than the generator wrote it;
   * LF is what the index, CI and the Linux Docker build all see.
   */
  landing: { path: string; bytes: number; sha256: string };
  /**
   * ONE page, whole and self-contained (resolved, never a delta): the
   * screenplay's final frame, which the Server Component renders into the HTML
   * so the section is right with no JS, under `prefers-reduced-motion`, and
   * before the fetch lands. It is the only draw list inlined anywhere.
   */
  poster: { variant: VariantId; page: LandingPage };
}
