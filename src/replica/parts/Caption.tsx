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
 * well as at 1920 — and sized to the SENTENCE, not to the page. A slab running
 * the width of the design box reads as a banner, which is the wrong weight for a
 * footnote about timing, and on a phone the sentence overflowed its box entirely
 * and landed on the zoom chip and the cursor.
 *
 * ⚠ The break in portrait is AUTHORED, and derived from the constant rather than
 * re-typed: `captionTextLines` splits at the sentence's own em dash, and the two
 * halves concatenate back to `HONESTY_CAPTION` exactly — which is what keeps the
 * copy tripwire able to find it in the DOM.
 */

import { Fragment, type JSX } from "react";
import { captionTextLines, type LayoutSpec } from "../layout";
import { pct, type as typeStyle, u } from "../style";
import type { ReplicaState } from "../types";

export function Caption({ spec, state }: { spec: LayoutSpec; state: ReplicaState }): JSX.Element | null {
  const p = pct(state.caption.p);
  if (!state.caption.text || p <= 0.01) return null;
  const k = spec.k;
  const r = spec.caption;
  const lines = captionTextLines(state.caption.text, spec.captionLines);

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
        padding: `${u(10 * k)} ${u(20 * k)}`,
        boxSizing: "border-box",
        background: "rgb(36 31 26 / 0.88)",
        color: "#fbf8f2",
        textAlign: "center",
        ...typeStyle(spec.captionSize, 1.35),
      }}
    >
      <span className="sr-wrap">
        {lines.map((line, i) => (
          <Fragment key={i}>
            {i > 0 ? <br /> : null}
            {line}
          </Fragment>
        ))}
      </span>
    </div>
  );
}
