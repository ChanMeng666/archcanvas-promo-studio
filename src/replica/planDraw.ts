/**
 * Turning a compiled page into a DRAWING ORDER.
 *
 * `at.ts` hands the renderer five band progresses (`state.plan.bands`, in
 * `LAYER_BANDS` order) and `nodeProgress` spreads a band's nodes inside it. What
 * it cannot know is which band a given CAD layer belongs to, or how many nodes
 * share that band — that is a fact about the compiled drawing, and it lives
 * here.
 *
 * The order is the one a person drawing this by hand would use, and the same one
 * the landing page's existing plan animation uses: the shell closes, the
 * openings pierce it, the furniture arrives, the chains are measured, the words
 * are written.
 *
 * The result is CACHED against the page object. A 274-node page is re-banded
 * sixty times a second otherwise, for an answer that cannot change — the page is
 * a frozen build artifact. The cache is a `WeakMap`, so a page that falls out of
 * scope takes its entry with it, and it is keyed by IDENTITY, so two pages that
 * happen to look alike still get their own.
 */

import type { PlanPage } from "./planTypes";
import { LAYER_BANDS } from "./types";
import type { LayerBand } from "./types";

/**
 * Which band a CAD layer draws in.
 *
 * `A-FLOR-STRS` (the stair) counts as shell rather than furniture: a staircase
 * is structure, and a plan whose stair appears with the sofas reads wrong.
 * Anything unrecognised lands in `dims` — the synthetic `"sheet"` layer is the
 * north arrow, the scale bar and the level stamp, which ARE annotations. The one
 * exception is the paper itself, handled by {@link isPaper}.
 */
export function bandForLayer(layer: string): LayerBand {
  switch (layer) {
    case "A-FLOR":
    case "A-WALL":
    case "A-FLOR-STRS":
      return "shell";
    case "A-DOOR":
    case "A-GLAZ":
      return "openings";
    case "A-FURN":
      return "furniture";
    case "A-ANNO-TEXT":
      return "text";
    default:
      return "dims";
  }
}

/**
 * The page's own paper — the white `<rect>` the compiler lays down first.
 *
 * It belongs to the `shell` band and to the very front of it, because the paper
 * is what the drawing is drawn ON. Leave it in `dims` with the rest of the sheet
 * layer and the first two thirds of the animation happen on the dot grid, then a
 * white rectangle appears underneath and the plan looks pasted on.
 */
export function isPaper(node: { tag: string; layer: string; order: number; fillOnly?: boolean }): boolean {
  return node.layer === "sheet" && node.tag === "rect" && node.order === 0 && node.fillOnly === true;
}

export interface DrawPlan {
  /** Band per node, parallel to `page.nodes`. */
  bands: LayerBand[];
  /** Index of the node WITHIN its band, parallel to `page.nodes`. */
  orderInBand: number[];
  /** How many nodes each band holds, in `LAYER_BANDS` order. */
  bandCounts: number[];
  /** True for the paper rect — drawn flat, never staggered. */
  paper: boolean[];
  /** Index of each text within the text layer, parallel to `page.texts`. */
  textOrder: number[];
  textCount: number;
}

const CACHE = new WeakMap<PlanPage, DrawPlan>();

/** The banding for a page. Cached by identity; safe to call every frame. */
export function drawPlanFor(page: PlanPage): DrawPlan {
  const hit = CACHE.get(page);
  if (hit) return hit;

  const bands: LayerBand[] = new Array<LayerBand>(page.nodes.length);
  const orderInBand: number[] = new Array<number>(page.nodes.length);
  const paper: boolean[] = new Array<boolean>(page.nodes.length);
  const counts = new Map<LayerBand, number>();
  for (const b of LAYER_BANDS) counts.set(b, 0);

  for (let i = 0; i < page.nodes.length; i++) {
    const n = page.nodes[i];
    const isPaperNode = isPaper(n);
    const band = isPaperNode ? "shell" : bandForLayer(n.layer);
    const seen = counts.get(band) ?? 0;
    bands[i] = band;
    orderInBand[i] = seen;
    paper[i] = isPaperNode;
    counts.set(band, seen + 1);
  }

  const built: DrawPlan = {
    bands,
    orderInBand,
    bandCounts: LAYER_BANDS.map((b) => counts.get(b) ?? 0),
    paper,
    textOrder: page.texts.map((_, i) => i),
    textCount: page.texts.length,
  };
  CACHE.set(page, built);
  return built;
}

/**
 * Hyphenated SVG attribute names, as React wants them.
 *
 * React maps a known camelCase SVG prop back to its hyphenated DOM name, but an
 * attribute it does NOT know is emitted under whatever key it was given — so
 * passing `stroke-width` through unchanged is how you get an element React
 * silently drops, and passing `strokemiterlimit` is how you get one the browser
 * ignores. Everything the bake emits is in React's table under its camelCase
 * spelling, which is what this produces; `data-`, `aria-` and namespaced names
 * are left alone, because those React passes through verbatim by design.
 */
export function reactAttrName(name: string): string {
  if (name.startsWith("data-") || name.startsWith("aria-") || name.includes(":")) return name;
  return name.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
}

/** Every attribute of a node, keyed as React wants them. */
export function reactAttrs(attrs: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs)) out[reactAttrName(k)] = v;
  return out;
}
