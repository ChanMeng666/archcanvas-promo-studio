/**
 * The shape of a pre-baked drawing, as the RENDERER needs it.
 *
 * ⚠ This is a deliberate second declaration of `src/lib/marketing/studioDemo.types.ts`,
 * and the duplication is the point: house rule 1 (`types.ts`) forbids this
 * directory from importing anything outside itself, because the whole directory
 * is copied into a repo where `@/lib/...` does not exist. So the app's contract
 * cannot be imported here, and a renderer that silently diverged from it would
 * fail at runtime rather than at `tsc`.
 *
 * `tests/studioReplicaResolve.test.ts` is what stops the two drifting: it feeds
 * the REAL `landing.json` through both this file's resolver and the generator's,
 * and asserts they agree page for page, node for node. A field added upstream
 * and not mirrored here turns it red.
 *
 * Coordinates are the page's own `viewBox` units, which are MILLIMETRES — hence
 * `vector-effect="non-scaling-stroke"` on every stroked node in `PlanSvg`.
 */

/** One drawable leaf: `<polygon>`, `<line>`, `<path>`, `<polyline>`, `<rect>`, `<circle>`, `<ellipse>`. */
export interface PlanNode {
  tag: string;
  /** Presentation + geometry, verbatim, in source order. Hyphenated SVG names. */
  attrs: Record<string, string>;
  /** The CAD layer, or the synthetic `"sheet"` for the paper and its stamps. */
  layer: string;
  /** Index within the page's `nodes` array — document order. */
  order: number;
  archId?: string;
  archKind?: string;
  archLabel?: string;
  primary?: boolean;
  /**
   * The node paints a FILL and strokes nothing. A stroke-draw animation has no
   * outline to run along, so these fade in rather than being drawn.
   */
  fillOnly?: boolean;
}

/** One `<text>` leaf. Text fades in; it is never stroke-drawn. */
export interface PlanText {
  attrs: Record<string, string>;
  text: string;
  layer: string;
  archId?: string;
}

/** A room's extent, `[minX, minY, maxX, maxY]` in viewBox units. */
export interface PlanRoom {
  archId: string;
  label: string;
  bbox: [number, number, number, number];
}

/** One storey = one compiled page = one drawing, fully resolved and expanded. */
export interface PlanPage {
  level: number;
  name: string;
  viewBox: string;
  /** `<defs>…</defs>` markup, ids already namespaced per page by the bake. */
  defs: string;
  nodes: PlanNode[];
  texts: PlanText[];
  rooms: PlanRoom[];
}

/* ── the committed payload, before it is resolved ─────────────────────────── */

/** A leaf with the layer's shared attributes taken out. Merge `defaults` UNDER `attrs`. */
export interface SlimNode {
  tag: string;
  attrs: Record<string, string>;
  layer: string;
  order: number;
  archId?: string;
  archKind?: string;
  archLabel?: string;
  primary?: true;
  fillOnly?: boolean;
}

export interface SlimText {
  attrs: Record<string, string>;
  text: string;
  layer: string;
  archId?: string;
}

export interface SlimPage {
  level: number;
  name: string;
  viewBox: string;
  defs: string;
  /** Keyed `layer + "|" + tag`. */
  defaults: Record<string, Record<string, string>>;
  nodes: SlimNode[];
  texts: SlimText[];
  rooms: PlanRoom[];
}

/** A page stored as a PATCH on another variant's page at the same level. */
export interface SlimPageDelta {
  level: number;
  name: string;
  viewBox: string;
  defs: string;
  deltaOf: string;
  /** Keys are indices into the base page's arrays, as decimal strings. */
  nodes: Record<string, SlimNode>;
  texts: Record<string, SlimText>;
  rooms: PlanRoom[];
}

export interface SlimVariant {
  id: string;
  /** This variant IS that one — same source, same drawing, no pages of its own. */
  alias?: string;
  pages?: (SlimPage | SlimPageDelta)[];
  paramValue?: number;
}

export interface LandingPayload {
  slug: string;
  param: { name: string; unit: string; values: number[] };
  variants: Record<string, SlimVariant>;
}
