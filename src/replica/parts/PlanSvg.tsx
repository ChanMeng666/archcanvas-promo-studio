/**
 * The drawing — the one thing on this page that has to be good.
 *
 * Every stroked node is drawn the way a plotter draws: `pathLength="1"` makes
 * the outline one unit long whatever its real length, `stroke-dasharray="1"`
 * turns it into a single dash, and `stroke-dashoffset = 1 - p` slides that dash
 * along until the line is complete. `at.ts` supplies `p` per node — a band
 * progress spread across the band's members — so 274 nodes read as one hand
 * moving over the sheet rather than 274 strokes appearing at once.
 *
 * Three rules that are not obvious and each of which was a real defect:
 *
 *  • **The drawing's own stroke widths are left ALONE, and it must NOT carry
 *    `vector-effect: non-scaling-stroke`.** The viewBox is in millimetres and
 *    the compiler's weights are millimetres too — a 19 mm door line, a 15 mm
 *    dimension line — so they scale with the sheet into the sub-pixel hairlines
 *    a drawing is made of. Pin them to screen space and every one of them
 *    becomes fifteen to thirty CSS PIXELS: measured, the plan renders as a black
 *    rectangle wrapped in bright blue bars. The weight HIERARCHY is what makes
 *    it read as a real drawing, and the hierarchy is in those millimetres.
 *    (Non-scaling-stroke belongs on the two overlays instead, which replace
 *    every width with one screen-space value — `replica.css` § `.sr-ghost`.)
 *  • **A finished node is drawn with its OWN attributes.** Once `p` reaches 1
 *    the dash machinery comes off entirely, so a door swing gets its real
 *    `stroke-dasharray` back instead of being held solid by ours — and the
 *    poster frame, which is every node at `p = 1`, carries none of it.
 *  • **Fills come in AFTER their strokes.** A floor poché or a furniture body
 *    has no outline to run along; if it faded on the band's own clock it would
 *    pop in ahead of the wall that contains it. Fill-only nodes fade with the
 *    band; a node that both fills and strokes holds its fill back until the
 *    stroke is most of the way round.
 *  • **The defs are injected as markup, not rebuilt.** They carry the poché
 *    pattern, and the bake has already namespaced every id per page — mount two
 *    pages at once (a crossfade, a film frame holding both storeys) and a shared
 *    `id="poche"` would give one plan's walls the other's hatch.
 */

import { createElement, memo } from "react";
import type { CSSProperties, JSX } from "react";
import { clamp01, slice } from "../easing";
import { nodeProgress } from "../at";
import { drawPlanFor, reactAttrs } from "../planDraw";
import type { PlanPage } from "../planTypes";
import type { ReplicaState } from "../types";
import { pct } from "../style";

interface Props {
  page: PlanPage;
  state: ReplicaState;
  /** The whole drawing's opacity — the crossfade and the ghost drive this. */
  opacity?: number;
  /** The selected room gets the product's violet wash. */
  selectedArchId?: string | null;
  /**
   * Draw every band complete, ignoring `state.plan.bands`.
   *
   * The ghost and the outgoing half of a crossfade are drawings the viewer has
   * ALREADY seen finished; re-running their stroke animation would un-draw them.
   */
  complete?: boolean;
  /**
   * Draw only these CAD layers.
   *
   * For the ghost. The parent geometry is restyled in bulk to one dashed violet
   * hairline, and at that weight its 166 dimension lines and its scale bar are
   * not a diff — they are a violet haze over the drawing they are supposed to be
   * compared with. The product's ghost is built from a stripped SVG for the same
   * reason (`buildGhostSvg`); this is that strip, done by layer.
   */
  layers?: readonly string[];
  style?: CSSProperties;
  className?: string;
}

/** What the ghost keeps: the shell and the openings — the geometry that moved. */
export const GHOST_LAYERS: readonly string[] = [
  "A-FLOR",
  "A-WALL",
  "A-FLOR-STRS",
  "A-DOOR",
  "A-GLAZ",
];

/** How much of a node's stroke must be down before its fill starts arriving. */
const FILL_HOLD = 0.55;

/**
 * The selection colours, from `globals.css` § "Select-to-act".
 *
 * `--plum-strong` is rgb(106 61 240); the room wash is that at 16 %, the outline
 * is a screen-space 2 px. Written as literals because this directory has no
 * access to the app's token file and a CSS variable would resolve to nothing
 * inside the injected drawing.
 */
const SELECT_FILL = "rgb(106 61 240 / 0.16)";
const SELECT_STROKE = "#6a3df0";

function PlanSvgFrame({
  page,
  state,
  opacity = 1,
  selectedArchId = null,
  complete = false,
  layers,
  style,
  className,
}: Props): JSX.Element {
  const plan = drawPlanFor(page);
  const keep = layers ? new Set(layers) : null;

  const progressOf = (i: number): number => {
    if (complete) return 1;
    return nodeProgress(state, plan.bands[i], plan.orderInBand[i], plan.bandCounts[bandIndex(plan.bands[i])]);
  };

  const textBand = complete ? 1 : (state.plan.bands[4] ?? 0);

  return (
    <div
      className={className}
      style={{ opacity: pct(opacity), ...style }}
      aria-hidden="true"
    >
      <svg
        viewBox={page.viewBox}
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        height="100%"
        style={{ display: "block", overflow: "visible" }}
        aria-hidden="true"
        focusable="false"
      >
        {/* `<defs>` is valid anywhere in an SVG, so the bake's markup goes in
            through a plain group rather than being parsed and rebuilt. */}
        <g dangerouslySetInnerHTML={{ __html: page.defs }} />

        {page.nodes.map((n, i) => {
          if (keep && !keep.has(n.layer)) return null;
          const p = progressOf(i);
          if (p <= 0) return null;
          const attrs = reactAttrs(n.attrs);
          const selected = Boolean(selectedArchId && n.archId === selectedArchId);

          const done = p >= 0.999;

          if (n.fillOnly) {
            // The paper and the pochés: nothing to run a dash along, so they
            // arrive as opacity. The paper (band `shell`, order 0) therefore
            // fades up first and the drawing lands ON it.
            return createElement(n.tag, {
              key: i,
              ...attrs,
              ...(selected ? { fill: SELECT_FILL } : {}),
              ...(done ? {} : { opacity: round3(p) }),
            });
          }

          if (done) {
            return createElement(n.tag, {
              key: i,
              ...attrs,
              ...(selected ? { stroke: SELECT_STROKE, strokeWidth: selectedWidth(n.attrs) } : {}),
            });
          }

          const hasFill = typeof n.attrs.fill === "string" && n.attrs.fill !== "none";
          return createElement(n.tag, {
            key: i,
            ...attrs,
            pathLength: 1,
            strokeDasharray: 1,
            strokeDashoffset: round3(1 - p),
            ...(hasFill ? { fillOpacity: round3(slice(FILL_HOLD, 1, p)) } : {}),
          });
        })}

        {(keep ? [] : page.texts).map((t, i) => {
          // A stagger inside the text band, so the labels are written rather
          // than stamped. The last one still lands exactly at band = 1.
          const start = plan.textCount > 1 ? (i / (plan.textCount - 1)) * 0.45 : 0;
          const o = clamp01(slice(start, start + 0.55, textBand));
          if (o <= 0) return null;
          return createElement(
            "text",
            {
              key: i,
              ...reactAttrs(t.attrs),
              opacity: round3(o),
              ...(selectedArchId && t.archId === selectedArchId ? { fill: SELECT_STROKE } : {}),
            },
            t.text,
          );
        })}
      </svg>
    </div>
  );
}

/**
 * The drawing, memoised on the only thing it reads out of `ReplicaState`.
 *
 * This component builds 250-odd SVG elements. The web host re-renders the whole
 * replica thirty times a second, and for all but the three and a half seconds
 * the drawing is being laid down, what it produces is IDENTICAL — the bands are
 * all 1 and nothing else on its props has moved.
 *
 * ⚠ Honest about the evidence: this is REASONED, not measured. Frame timings on
 * the landing page (1x and 4x CPU, 20 s windows) did not separate it from the
 * noise, because the windows that were slow were slow for other reasons and the
 * window where this matters is three seconds long. It is kept because the work
 * it skips is real and its comparator is cheap — not because a number moved.
 * The measured win in that round belongs to the clock's load back-off
 * (`useReplicaClock.ts`).
 *
 * ⚠ The comparator is a claim about what the render function READS: `page`, the
 * five numbers in `state.plan.bands`, and its own flags. Anything new taken out
 * of `state` below has to be added here, or it will be a value that silently
 * stops updating. It is a memo rather than a `useMemo` because this directory's
 * components are pure functions of their props and take no hooks — see the
 * header of `StudioReplica.tsx`.
 *
 * The frame renderer is unaffected: it paints each frame in a fresh tree, where
 * a memo has nothing to compare against and simply renders.
 */
export const PlanSvg = memo(PlanSvgFrame, samePlanFrame);

function samePlanFrame(a: Props, b: Props): boolean {
  if (
    a.page !== b.page ||
    a.opacity !== b.opacity ||
    a.selectedArchId !== b.selectedArchId ||
    a.complete !== b.complete ||
    a.layers !== b.layers ||
    a.className !== b.className ||
    a.style !== b.style
  ) {
    return false;
  }
  // A `complete` drawing ignores the bands outright.
  if (a.complete && b.complete) return true;
  const x = a.state.plan.bands;
  const y = b.state.plan.bands;
  if (x === y) return true;
  if (x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) {
    if (x[i] !== y[i]) return false;
  }
  return true;
}

/** `LAYER_BANDS.indexOf`, without re-importing the array into the hot path. */
function bandIndex(band: string): number {
  switch (band) {
    case "shell":
      return 0;
    case "openings":
      return 1;
    case "furniture":
      return 2;
    case "dims":
      return 3;
    default:
      return 4;
  }
}

/**
 * A selected element's outline, in the drawing's OWN units.
 *
 * The product draws this at a screen-space 2 px. Here it is roughly twice the
 * node's own weight instead, for the same reason the strokes are left alone
 * above: a 2 px outline on an mm-scale viewBox is either invisible or the width
 * of a corridor, depending on the zoom.
 */
function selectedWidth(attrs: Record<string, string>): number {
  const w = Number(attrs["stroke-width"]);
  return Number.isFinite(w) && w > 0 ? Math.max(w * 1.8, 24) : 30;
}

function round3(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1000) / 1000;
}
