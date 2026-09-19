/**
 * The parametric tweaks panel (`src/components/canvas/TweaksPanel.tsx`).
 *
 * One numeric knob from the plan's own source, its value in millimetres, and the
 * two buttons the product offers: Reset and Save. Dragging it recompiles the
 * drawing for free — no credit, no model — which is why it is worth four seconds
 * of a thirty-five second loop.
 *
 * The panel floats on the sheet in landscape (so it rides the camera) and docks
 * under the canvas in portrait, where a floating panel would cover the plan it
 * is changing. `tweaksBox` owns that decision and `layoutMap` reads the same
 * function, so the cursor drags the thumb that is actually there.
 */

import type { JSX } from "react";
import { Icon } from "../icons";
import { tweaksMetrics, type LayoutSpec } from "../layout";
import { TWEAKS_RESET, TWEAKS_SAVE, TWEAKS_TITLE } from "../strings";
import { pct, shadow, type as typeStyle, u } from "../style";
import type { ReplicaState } from "../types";

export function TweaksPanel({ spec, state }: { spec: LayoutSpec; state: ReplicaState }): JSX.Element | null {
  const open = pct(state.tweaks.open);
  if (open <= 0.02 || !state.tweaks.param) return null;

  // The panel's own scale, capped so the track and the buttons cannot land on
  // each other in a short dock — `tweaksMetrics` owns that arithmetic, and
  // `layoutMap` aims the cursor with the same call.
  const m = tweaksMetrics(spec);
  const k = m.tk;
  const box = m.box;
  const innerX = m.innerX - box.x;
  const innerW = m.innerW;
  const trackY = m.track.y - box.y;
  const thumb = pct(state.tweaks.thumb);
  const btnY = m.save.y - box.y;
  const btnW = m.save.w;

  return (
    <div
      className="sr-panel"
      style={{
        position: "absolute",
        left: u(box.x),
        top: u(box.y),
        width: u(box.w),
        height: u(box.h),
        opacity: open,
        // The panel grows out of its own top-right corner, which is where the
        // toggle that opened it sits.
        transform: `scale(${(0.96 + 0.04 * open).toFixed(4)})`,
        transformOrigin: "100% 0%",
        boxShadow: shadow(10, 28, -10, 0.2),
        background: "rgb(255 255 255 / 0.97)",
      }}
    >
      <div
        className="sr-row"
        style={{
          position: "absolute",
          left: u(innerX),
          top: u(10 * k),
          width: u(innerW),
          justifyContent: "space-between",
        }}
      >
        <span style={typeStyle(12 * k, 1.2, 600)}>{TWEAKS_TITLE}</span>
        <Icon name="x" size={u(12 * k)} color="var(--sr-muted-foreground)" />
      </div>

      <div
        className="sr-row"
        style={{
          position: "absolute",
          left: u(innerX),
          top: u(34 * k),
          width: u(innerW),
          justifyContent: "space-between",
        }}
      >
        <span style={typeStyle(11 * k, 1.2, 500)}>{state.tweaks.param}</span>
        <span className="sr-mono sr-muted" style={typeStyle(10 * k, 1.2)}>
          {Math.round(state.tweaks.value)} {state.tweaks.unit}
        </span>
      </div>

      {/* The track, and the thumb where `state` says it is. */}
      <div
        className="sr-pill"
        style={{
          position: "absolute",
          left: u(innerX),
          top: u(trackY + 3 * k),
          width: u(innerW),
          height: u(4 * k),
          background: "var(--sr-muted)",
        }}
      />
      <div
        className="sr-pill"
        style={{
          position: "absolute",
          left: u(innerX),
          top: u(trackY + 3 * k),
          width: u(innerW * thumb),
          height: u(4 * k),
          background: "var(--sr-action)",
        }}
      />
      <div
        className="sr-pill"
        style={{
          position: "absolute",
          left: u(innerX + innerW * thumb - 7 * k),
          top: u(trackY - 2 * k),
          width: u(14 * k),
          height: u(14 * k),
          background: "var(--sr-action)",
          border: `${u(2 * k)} solid #ffffff`,
          boxSizing: "border-box",
          boxShadow: shadow(1, 3, 0, 0.25),
        }}
      />

      <span
        className="sr-row sr-pill sr-outline"
        style={{
          position: "absolute",
          left: u(innerX),
          top: u(btnY),
          width: u(btnW),
          height: u(26 * k),
          justifyContent: "center",
          gap: u(5 * k),
          ...typeStyle(11 * k, 1, 500),
        }}
      >
        <Icon name="rotate" size={u(11 * k)} />
        {TWEAKS_RESET}
      </span>
      <span
        className="sr-row sr-pill"
        style={{
          position: "absolute",
          left: u(innerX + btnW + 8 * k),
          top: u(btnY),
          width: u(btnW),
          height: u(26 * k),
          justifyContent: "center",
          gap: u(5 * k),
          ...typeStyle(11 * k, 1, 500),
          background: "var(--sr-foreground)",
          color: "var(--sr-background)",
        }}
      >
        <Icon name="save" size={u(11 * k)} />
        {TWEAKS_SAVE}
      </span>
    </div>
  );
}
