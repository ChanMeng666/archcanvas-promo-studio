/**
 * Reading the committed landing payload: follow the alias, apply the delta,
 * merge the layer defaults — and hand back a WHOLE page a renderer can draw.
 *
 * This is a port of `resolveLandingPage` / `applyPageDelta` / `expandLandingPage`
 * in `scripts/generate-studio-demo.mjs`, and it is a port rather than an import
 * for the reason stated in `planTypes.ts`: nothing in this directory may reach
 * outside it. `tests/studioReplicaResolve.test.ts` proves the two agree on every
 * page of the real payload, so a bake that changes the format cannot leave the
 * renderer expanding against the wrong defaults in silence.
 *
 * Three reductions, undone in this order, and the order matters:
 *
 *  1. `alias` — `tweak-0` IS `edit-after`, so it has no pages of its own.
 *  2. `deltaOf` — `tweak-1..3` patch `edit-after` by index. The delta carries no
 *     `defaults`; it reuses the base page's, which is why 3 cannot come first.
 *  3. `defaults` — attributes shared by every node of a `layer|tag` run, merged
 *     UNDER the node's own so a node that differs still wins.
 *
 * Pure: no clock, no random, no I/O. The payload arrives as a parsed object.
 */

import type {
  LandingPayload,
  PlanPage,
  SlimNode,
  SlimPage,
  SlimPageDelta,
  SlimText,
  SlimVariant,
} from "./planTypes";

/** A page is a patch exactly when it names what it patches. */
export function isDelta(page: SlimPage | SlimPageDelta): page is SlimPageDelta {
  return "deltaOf" in page && typeof (page as SlimPageDelta).deltaOf === "string";
}

/**
 * Follow a variant's `alias`, then a page's `deltaOf`, and return a whole slim
 * page. Recursive; the bake never nests a delta on a delta, and `seen` makes a
 * malformed payload fail loudly rather than hanging a render loop.
 */
export function resolveSlimPage(
  variants: Readonly<Record<string, SlimVariant>>,
  variantId: string,
  level: number,
  seen: readonly string[] = [],
): SlimPage {
  if (seen.includes(variantId)) {
    throw new Error(`studio-replica: alias cycle at "${variantId}"`);
  }
  const variant = variants[variantId];
  if (!variant) throw new Error(`studio-replica: no landing variant "${variantId}"`);
  if (variant.alias) return resolveSlimPage(variants, variant.alias, level, [...seen, variantId]);

  const page = (variant.pages ?? []).find((p) => p.level === level);
  if (!page) throw new Error(`studio-replica: variant "${variantId}" has no L${level}`);
  if (!isDelta(page)) return page;
  return applyDelta(page, resolveSlimPage(variants, page.deltaOf, level, [...seen, variantId]));
}

/** A delta over its base. The base's `defaults` survive — the delta has none. */
export function applyDelta(delta: SlimPageDelta, base: SlimPage): SlimPage {
  return {
    level: delta.level,
    name: delta.name,
    viewBox: delta.viewBox,
    defs: delta.defs,
    defaults: base.defaults,
    nodes: base.nodes.map((n, i) => delta.nodes[i] ?? n),
    texts: base.texts.map((t, i) => delta.texts[i] ?? t),
    rooms: delta.rooms,
  };
}

/**
 * Merge each layer's shared attributes back under the node's own.
 *
 * ⚠ `defaults` go UNDER. A node only carries what DIFFERS from its run, so a
 * merge the other way round would overwrite every deviation with the shared
 * value and draw 274 identical strokes.
 */
export function expandPage(slim: SlimPage): PlanPage {
  return {
    level: slim.level,
    name: slim.name,
    viewBox: slim.viewBox,
    defs: slim.defs,
    nodes: slim.nodes.map((n: SlimNode) => ({
      ...n,
      attrs: { ...(slim.defaults[`${n.layer}|${n.tag}`] ?? {}), ...n.attrs },
    })),
    texts: slim.texts.map((t: SlimText) => ({ ...t })),
    rooms: slim.rooms,
  };
}

/** `resolveSlimPage` + `expandPage` — what a renderer actually wants. */
export function resolvePage(
  variants: Readonly<Record<string, SlimVariant>>,
  variantId: string,
  level: number,
): PlanPage {
  return expandPage(resolveSlimPage(variants, variantId, level));
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  The page map                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * `StudioReplica` takes ALREADY-RESOLVED pages, so that the component never has
 * to think about aliases and deltas (and so that the poster frame, which ships
 * one resolved page inlined in the HTML, needs no payload at all). This is the
 * key.
 */
export function pageKey(variant: string, level: number): string {
  return `${variant}:${level}`;
}

export type PlanPageMap = Readonly<Record<string, PlanPage>>;

/**
 * Resolve EVERY page the payload can produce, keyed by {@link pageKey}.
 *
 * A variant with no page at a level simply has no entry — `base` and
 * `edit-after` are baked at L0 only, and asking for their L1 is a legitimate
 * "there is nothing to draw", not an error the renderer should throw on.
 */
export function buildPageMap(payload: LandingPayload): PlanPageMap {
  const out: Record<string, PlanPage> = {};
  const levels = new Set<number>();
  for (const v of Object.values(payload.variants)) {
    for (const p of v.pages ?? []) levels.add(p.level);
  }
  for (const id of Object.keys(payload.variants)) {
    for (const level of levels) {
      try {
        out[pageKey(id, level)] = resolvePage(payload.variants, id, level);
      } catch {
        // Not baked at this level. The renderer falls back to the page it has.
      }
    }
  }
  return out;
}

/**
 * The page to draw for a variant and a storey, degrading rather than throwing.
 *
 * The storey switch runs on the final variant, which is the only one baked at
 * L1; every other variant answers L1 with its ground floor. A blank stage in the
 * middle of a loop is a worse failure than showing the floor we have.
 */
export function pickPage(pages: PlanPageMap, variant: string, level: number): PlanPage | null {
  return pages[pageKey(variant, level)] ?? pages[pageKey(variant, 0)] ?? null;
}
