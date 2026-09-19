/**
 * The infinite canvas: a dot grid that pans and zooms under a transformed world.
 *
 * The grid is a viewport-fixed background whose `background-size` scales with
 * the camera and whose `background-position` follows the pan — the same trick
 * `CanvasGrid.tsx` uses, and the reason the lattice tiles forever instead of
 * ending where the content box does.
 *
 * `children` are WORLD-space: the sheet, its chrome, the tweaks panel, the pins.
 * They go inside one element carrying `stageTransform`'s `translate … scale`,
 * which is the same arithmetic `layoutMap` resolves a cursor target through.
 */

import type { CSSProperties, JSX, ReactNode } from "react";
import { stageTransform, type LayoutSpec } from "../layout";
import { u } from "../style";
import type { ReplicaState } from "../types";

/** `CANVAS_CONFIG.gridDotSize` — the lattice pitch at 100 %. */
const GRID_PITCH = 32;

export function CanvasStage({
  spec,
  state,
  children,
  overlay,
}: {
  spec: LayoutSpec;
  state: ReplicaState;
  /** World-space content — transformed by the camera. */
  children: ReactNode;
  /** Stage-space content — pinned to the viewport (the toolbar, the command bar). */
  overlay?: ReactNode;
}): JSX.Element {
  const { tx, ty, zoom } = stageTransform(spec, state.camera);
  const pitch = GRID_PITCH * zoom;

  const gridStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    backgroundColor: "var(--sr-canvas-bg)",
    backgroundImage: "radial-gradient(circle, var(--sr-canvas-dot) 1px, transparent 1px)",
    backgroundSize: `${u(pitch)} ${u(pitch)}`,
    backgroundPosition: `${u(tx)} ${u(ty)}`,
  };

  return (
    <div
      style={{
        position: "absolute",
        left: u(spec.stage.x),
        top: u(spec.stage.y),
        width: u(spec.stage.w),
        height: u(spec.stage.h),
        overflow: "hidden",
      }}
    >
      <div style={gridStyle} />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: u(spec.stage.w),
          height: u(spec.stage.h),
          transformOrigin: "0 0",
          transform: `translate(${u(tx)}, ${u(ty)}) scale(${zoom.toFixed(4)})`,
        }}
      >
        {children}
      </div>
      {overlay}
    </div>
  );
}
