/**
 * The honesty caption.
 *
 * The ONE sentence on screen that the product itself never says, and the one
 * that has to be there: a real design takes two to three minutes and this loop
 * is thirty-five seconds. Compressing time is normal in a demo; letting the
 * compression read as a speed claim is not. `strings.ts` owns the wording,
 * `at.ts` keeps it on screen for over three seconds, and a test integrates that
 * rather than trusting the beat table.
 *
 * Rendered as a quiet slab rather than a caption bar so it reads at 360 px as
 * well as at 1920.
 */

import type { JSX } from "react";
import type { LayoutSpec } from "../layout";
import { pct, type as typeStyle, u } from "../style";
import type { ReplicaState } from "../types";

export function Caption({ spec, state }: { spec: LayoutSpec; state: ReplicaState }): JSX.Element | null {
  const p = pct(state.caption.p);
  if (!state.caption.text || p <= 0.01) return null;
  const k = spec.k;
  const r = spec.caption;

  return (
    <div
      className="sr-center sr-pill"
      style={{
        position: "absolute",
        left: u(r.x),
        top: u(r.y),
        width: u(r.w),
        minHeight: u(r.h),
        opacity: p,
        padding: `${u(8 * k)} ${u(16 * k)}`,
        boxSizing: "border-box",
        background: "rgb(36 31 26 / 0.88)",
        color: "#fbf8f2",
        textAlign: "center",
        ...typeStyle(13 * k, 1.35),
      }}
    >
      <span className="sr-wrap">{state.caption.text}</span>
    </div>
  );
}
