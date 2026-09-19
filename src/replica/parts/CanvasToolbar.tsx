/**
 * The canvas's four zoom controls (`src/components/canvas/CanvasToolbar.tsx`).
 *
 * The chip in the middle is the only part that moves: it reads the camera, so a
 * viewer can see the number change while the canvas pushes in on a pin and knows
 * the picture is a canvas rather than a still. `zoomChip` formats it exactly as
 * the product does.
 */

import type { JSX } from "react";
import { Icon } from "../icons";
import type { LayoutSpec } from "../layout";
import { zoomChip } from "../strings";
import { type as typeStyle, u } from "../style";
import type { ReplicaState } from "../types";

export function CanvasToolbar({ spec, state }: { spec: LayoutSpec; state: ReplicaState }): JSX.Element {
  const k = spec.k;
  const r = spec.toolbar;
  const pad = 8 * k;
  const btn = r.h - 2 * pad;
  const gap = 4 * k;
  const chipW = r.w - 2 * pad - 3 * btn - 3 * gap;

  // ⚠ Portrait keeps the chip and drops the three icon buttons — the reason is
  // with `toolbarCompact` in `layout.ts`. The chip is what reads the camera, so
  // it is the part a still picture actually needs.
  if (spec.toolbarCompact) {
    return (
      <div
        className="sr-pill sr-center sr-mono"
        style={{
          position: "absolute",
          left: u(r.x),
          top: u(r.y),
          width: u(r.w),
          height: u(r.h),
          background: "rgb(255 255 255 / 0.92)",
          border: "var(--sr-hair) solid var(--sr-border)",
          boxSizing: "border-box",
          ...typeStyle(12 * k, 1),
        }}
      >
        {zoomChip(state.zoomPercent)}
      </div>
    );
  }

  return (
    <div
      className="sr-pill sr-row"
      style={{
        position: "absolute",
        left: u(r.x),
        top: u(r.y),
        width: u(r.w),
        height: u(r.h),
        background: "rgb(255 255 255 / 0.92)",
        border: "var(--sr-hair) solid var(--sr-border)",
        boxSizing: "border-box",
      }}
    >
      <span
        className="sr-center"
        style={{ position: "absolute", left: u(pad), top: u(pad), width: u(btn), height: u(btn) }}
      >
        <Icon name="zoomOut" size={u(15 * k)} color="var(--sr-muted-foreground)" />
      </span>
      <span
        className="sr-center sr-pill sr-mono"
        style={{
          position: "absolute",
          left: u(pad + btn + gap),
          top: u(pad),
          width: u(chipW),
          height: u(btn),
          ...typeStyle(11 * k, 1),
        }}
      >
        {zoomChip(state.zoomPercent)}
      </span>
      <span
        className="sr-center"
        style={{
          position: "absolute",
          left: u(pad + btn + chipW + 2 * gap),
          top: u(pad),
          width: u(btn),
          height: u(btn),
        }}
      >
        <Icon name="zoomIn" size={u(15 * k)} color="var(--sr-muted-foreground)" />
      </span>
      <span
        className="sr-center"
        style={{
          position: "absolute",
          left: u(pad + 2 * btn + chipW + 3 * gap),
          top: u(pad),
          width: u(btn),
          height: u(btn),
        }}
      >
        <Icon name="maximize" size={u(15 * k)} color="var(--sr-muted-foreground)" />
      </span>
    </div>
  );
}
