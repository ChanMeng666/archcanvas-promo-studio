/**
 * The studio, drawn from a `ReplicaState`.
 *
 * ⚠ A PURE FUNCTION OF ITS PROPS. No hooks, no effects, no clock, no measurement
 * — every moving value on this page is an inline style computed from `state`,
 * because the web host drives `t` from a rAF clock and the film drives it from
 * `frame / fps`, out of order, across workers. A CSS transition would be correct
 * in the first and wrong in the second, which is why `replica.css` has none.
 *
 * ⚠ NOTHING IN HERE IS FOCUSABLE OR INTERACTIVE. It renders `div`s and `span`s,
 * never `button`/`input`/`a`, and no element carries a role, a tabindex or a
 * handler. The whole subtree is a picture: the HOST names it (`role="img"` plus
 * the described steps) and the HOST owns the real controls — pause, and the
 * chapter tabs. A `<button>` in here would be a control inside an `img`, which
 * is an accessibility defect and a lie about what the page can do.
 *
 * Two acts, laid out twice:
 *
 *  • Act I is the brief composer, and Act II is the canvas. Between them the
 *    product runs a staged CSS handoff (`.studio-act-out` / `.studio-act-in` in
 *    `globals.css`); here the same two curves are computed from
 *    `state.actProgress`, so a frame renderer catches the dissolve mid-way
 *    rather than missing it.
 *  • `layout="landscape"` draws into 1600x1000 and `"portrait"` into 1000x1333
 *    with the canvas on top and the chrome stacked under it. Portrait is a
 *    re-layout, never a crop — a cropped desktop UI at 360 px is illegible, and
 *    illegible is the one thing this component may not be.
 */

import type { CSSProperties, JSX } from "react";
import { clamp01 } from "./easing";
import { layoutSpec, parseViewBox, type LayoutId, type LayoutSpec } from "./layout";
import { targetContext } from "./layoutMap";
import type { PlanPage } from "./planTypes";
import { pickPage, type PlanPageMap } from "./resolvePages";
import { pct, u } from "./style";
import type { DemoInputs, ReplicaState } from "./types";

import { BrowserFrame } from "./parts/BrowserFrame";
import { CanvasStage } from "./parts/CanvasStage";
import { CanvasToolbar } from "./parts/CanvasToolbar";
import { Caption } from "./parts/Caption";
import { CommandBar } from "./parts/CommandBar";
import { Composer } from "./parts/Composer";
import { Cursor } from "./parts/Cursor";
import { DraftingSheet } from "./parts/DraftingSheet";
import { ExportMenu } from "./parts/ExportMenu";
import { GHOST_LAYERS, PlanSvg } from "./parts/PlanSvg";
import { RenderingCard } from "./parts/RenderingCard";
import { ReviewPins } from "./parts/ReviewPins";
import { SheetChrome } from "./parts/SheetChrome";
import { Toast } from "./parts/Toast";
import { TopBar } from "./parts/TopBar";
import { TweaksPanel } from "./parts/TweaksPanel";

export interface StudioReplicaProps {
  state: ReplicaState;
  demo: DemoInputs;
  /**
   * Every drawing, ALREADY RESOLVED, keyed by `pageKey(variant, level)`
   * (`resolvePages.ts`). Resolved rather than raw so this component never has to
   * think about aliases and deltas — and so the poster frame, which ships one
   * page inlined in the server-rendered HTML, needs no payload at all.
   */
  pages: PlanPageMap;
  layout?: LayoutId;
  /**
   * Px per design unit. Omitted, the CSS falls back to container-query units and
   * the replica fills whatever box the host gives it.
   */
  unit?: number;
  /** The thin window chrome at the top. On by default. */
  browserFrame?: boolean;
  /** Map a screenplay asset path onto something this host can fetch. */
  assetUrl?: (src: string) => string;
  className?: string;
  style?: CSSProperties;
}

/** The web host serves the screenplay's paths as-is; the film remaps them. */
const identity = (src: string): string => src;

/**
 * The three drawing overlays' boxes, hoisted to constants.
 *
 * `PlanSvg` is memoised on its props (see its own header), and a style object
 * built inside the render is a new object on every frame — which would make the
 * memo miss on every frame and cost exactly what it was added to save. Frozen
 * module constants instead: these never depend on state.
 */
const FILL: CSSProperties = { position: "absolute", inset: 0 };
const FILL_ON_PAPER: CSSProperties = { position: "absolute", inset: 0, background: "#ffffff" };

export function StudioReplica({
  state,
  demo,
  pages,
  layout = "landscape",
  unit,
  browserFrame = true,
  assetUrl = identity,
  className,
  style,
}: StudioReplicaProps): JSX.Element {
  const page = pickPage(pages, state.plan.variant, state.plan.page);
  const spec = layoutSpec(layout, {
    browserFrame,
    sheetAspect: page ? aspectOf(page) : undefined,
  });

  // The act handoff, as the product's two animations describe it: the briefing
  // fades and shrinks a little over 400 ms, the studio fades in over 450 ms
  // starting 180 ms in — so for a moment both are painted.
  const act = clamp01(state.actProgress);
  const outOpacity = 1 - clamp01(act / 0.72);
  const inOpacity = clamp01((act - 0.28) / 0.72);

  const frameStyle: CSSProperties = {
    ...(unit && unit > 0 ? ({ "--u": `${unit}px` } as CSSProperties) : {}),
    opacity: 1 - pct(state.loopFade),
  };

  return (
    <div
      className={["studio-replica", className].filter(Boolean).join(" ")}
      data-layout={layout}
      style={{ aspectRatio: `${spec.W} / ${spec.H}`, ...style }}
    >
      <div className="sr-frame" style={frameStyle}>
        <BrowserFrame spec={spec} />

        {inOpacity > 0 ? (
          <div style={{ opacity: inOpacity }}>
            <Studio
              spec={spec}
              state={state}
              demo={demo}
              page={page}
              pages={pages}
              assetUrl={assetUrl}
            />
          </div>
        ) : null}

        {outOpacity > 0 ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: outOpacity,
              transform: `scale(${(1 - 0.015 * act).toFixed(4)})`,
            }}
          >
            <Composer spec={spec} state={state} />
          </div>
        ) : null}

        {/* The cursor is above everything, including the act it is leaving. */}
        <Cursor ctx={targetContext(spec, state, page, demo.pageCount)} />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function Studio({
  spec,
  state,
  demo,
  page,
  pages,
  assetUrl,
}: {
  spec: LayoutSpec;
  state: ReplicaState;
  demo: DemoInputs;
  page: PlanPage | null;
  pages: PlanPageMap;
  assetUrl: (src: string) => string;
}): JSX.Element {
  const ctx = targetContext(spec, state, page, demo.pageCount);
  const drawn = state.plan.bands[0] > 0;

  // The morph: the OUTGOING variant held over the incoming one and faded out,
  // and the parent's geometry lingering as a dashed ghost on its own clock —
  // the two overlays `DesignFrame` runs, with the same ordering (the ghost sits
  // above the crossfade so it stays visible through it).
  const cross = state.plan.crossfade;
  const crossPage = cross ? pickPage(pages, cross.from, state.plan.page) : null;
  const ghost = state.plan.ghost;
  const ghostPage = ghost ? pickPage(pages, ghost.variant, state.plan.page) : null;

  return (
    <>
      <TopBar spec={spec} title={demo.title} />

      <CanvasStage
        spec={spec}
        state={state}
        overlay={
          <>
            {drawn ? <ToolbarSlot spec={spec} state={state} /> : null}
          </>
        }
      >
        {page && drawn ? (
          <div
            className={state.selection.archId ? "sr-sheet sr-sheet-selected" : "sr-sheet"}
            style={{
              position: "absolute",
              left: u(spec.sheet.x),
              top: u(spec.sheet.y),
              width: u(spec.sheet.w),
              height: u(spec.sheet.h),
            }}
          >
            <PlanSvg
              className="sr-plan"
              page={page}
              state={state}
              selectedArchId={state.selection.archId}
              style={FILL}
            />
            {/* The plan we are leaving, opaque over the new one. */}
            {crossPage && cross ? (
              <PlanSvg
                className="sr-plan"
                page={crossPage}
                state={state}
                complete
                opacity={1 - cross.p}
                style={FILL_ON_PAPER}
              />
            ) : null}
            {/* …and its geometry, dashed, for a second or so afterwards. */}
            {ghostPage && ghost ? (
              <PlanSvg
                className="sr-plan sr-ghost"
                page={ghostPage}
                state={state}
                complete
                layers={GHOST_LAYERS}
                opacity={ghost.opacity}
                style={FILL}
              />
            ) : null}
          </div>
        ) : null}

        <SheetChrome spec={spec} state={state} storeys={demo.pageCount} title={demo.title} />
        {spec.tweaks.mode === "floating" ? <TweaksPanel spec={spec} state={state} /> : null}
      </CanvasStage>

      {/* Design-space overlays, in z order: the pins sit on the drawing, the
          rendering floats beside it, the menu and the toast sit over both. */}
      <ReviewPins ctx={ctx} />
      <RenderingCard
        spec={spec}
        src={state.rendering.src}
        progress={state.rendering.p}
        assetUrl={assetUrl}
      />
      {spec.tweaks.mode === "docked" ? <TweaksPanel spec={spec} state={state} /> : null}
      <CommandBar spec={spec} state={state} />
      <DraftingSheet spec={spec} state={state} />
      <Caption spec={spec} state={state} />
      <ExportMenu ctx={ctx} />
      <Toast spec={spec} state={state} />
    </>
  );
}

/** The toolbar is stage-fixed, so it goes in the stage's overlay slot. */
function ToolbarSlot({ spec, state }: { spec: LayoutSpec; state: ReplicaState }): JSX.Element {
  // The toolbar's own box is in DESIGN space; inside the stage it is offset by
  // the stage's origin.
  const inner: LayoutSpec = {
    ...spec,
    toolbar: { ...spec.toolbar, x: spec.toolbar.x - spec.stage.x, y: spec.toolbar.y - spec.stage.y },
  };
  return <CanvasToolbar spec={inner} state={state} />;
}

function aspectOf(page: PlanPage): number {
  const [, , w, h] = parseViewBox(page.viewBox);
  return h > 0 ? w / h : 1;
}
