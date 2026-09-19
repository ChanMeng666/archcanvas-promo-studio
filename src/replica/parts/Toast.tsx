/**
 * The toast — the product's Sonner notice, bottom-right (`app/layout.tsx` pins
 * `position="bottom-right"`).
 *
 * One line, and it appears only because a tweak was SAVED: "Tweak saved — now
 * the latest version". The envelope (in, hold, out) is computed in `at.ts`, so
 * the fade is a function of `t` rather than a CSS transition.
 */

import type { JSX } from "react";
import { Icon } from "../icons";
import type { LayoutSpec } from "../layout";
import { pct, shadow, type as typeStyle, u } from "../style";
import type { ReplicaState } from "../types";

export function Toast({ spec, state }: { spec: LayoutSpec; state: ReplicaState }): JSX.Element | null {
  const p = pct(state.toast.p);
  if (!state.toast.text || p <= 0.01) return null;
  const k = spec.k;
  const r = spec.toast;

  return (
    <div
      className="sr-row sr-panel"
      style={{
        position: "absolute",
        left: u(r.x),
        top: u(r.y + (1 - p) * 8 * k),
        width: u(r.w),
        minHeight: u(r.h),
        opacity: p,
        gap: u(8 * k),
        padding: `0 ${u(12 * k)}`,
        boxSizing: "border-box",
        background: "rgb(255 255 255 / 0.98)",
        boxShadow: shadow(8, 24, -10, 0.3),
      }}
    >
      <Icon name="save" size={u(13 * k)} color="var(--sr-action)" />
      <span className="sr-wrap" style={typeStyle(12 * k, 1.35)}>
        {state.toast.text}
      </span>
    </div>
  );
}
