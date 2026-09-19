/**
 * The drafting sheet — what the studio IS for the two to three minutes a design
 * takes (`src/components/studio/DraftingSheet.tsx`).
 *
 * Everything it prints is the loop's own report: the real phase line, the real
 * pass counter, the plan's real room labels. Two properties carry over from the
 * product and both are honesty rather than decoration:
 *
 *  • **The pass counter is hidden on pass 1.** A "pass 1/4" on every design
 *    advertises a repair loop that usually does not run.
 *  • **The elapsed timer counts the REAL timescale**, not the compressed one.
 *    The loop spends four seconds here; the clock says what the work costs. A
 *    replica whose timer read "4s" would be claiming a speed the product does
 *    not have — the opposite of what the honesty caption exists for.
 */

import type { JSX } from "react";
import { Spinner } from "../icons";
import type { LayoutSpec } from "../layout";
import { DRAFTING_LABEL, ELAPSED_VISIBLE_AFTER_S, EXPECTATION_LINE, draftingPass } from "../strings";
import { type as typeStyle, u } from "../style";
import type { ReplicaState } from "../types";

export function DraftingSheet({ spec, state }: { spec: LayoutSpec; state: ReplicaState }): JSX.Element | null {
  if (!state.drafting.visible) return null;
  const k = spec.k;
  const card = spec.draftCard;
  const d = state.drafting;
  const chips = d.chips.slice(0, d.chipsVisibleCount);
  // "45s" only once there is a wait worth naming, like the product's own timer.
  const elapsedSeconds = Number(d.elapsed.replace(/[^0-9]/g, "")) || 0;
  const showElapsed = d.elapsed.includes("m") || elapsedSeconds >= ELAPSED_VISIBLE_AFTER_S;

  return (
    <div
      className="sr-card sr-sheet"
      style={{
        position: "absolute",
        left: u(card.x),
        top: u(card.y),
        width: u(card.w),
        minHeight: u(card.h),
        background: "var(--sr-card)",
        padding: u(20 * k),
        boxSizing: "border-box",
      }}
    >
      <div className="sr-row" style={{ gap: u(8 * k) }}>
        <Spinner size={u(14 * k)} turn={state.t * 0.9} color="var(--sr-action)" />
        <span className="sr-muted" style={typeStyle(12 * k, 1.2, 500)}>
          {DRAFTING_LABEL}
        </span>
        <span style={{ flex: 1 }} />
        {d.pass ? (
          <span className="sr-mono sr-muted" style={typeStyle(10 * k, 1.2)}>
            {draftingPass(d.pass[0], d.pass[1])}
          </span>
        ) : null}
      </div>

      <div
        style={{
          marginTop: u(8 * k),
          minHeight: u(24 * k),
          ...typeStyle(18 * k, 1.25, 600),
          letterSpacing: "-0.01em",
        }}
      >
        {d.title}
      </div>

      {chips.length > 0 ? (
        <div style={{ marginTop: u(12 * k), display: "flex", flexWrap: "wrap", gap: u(6 * k) }}>
          {chips.map((label, i) => (
            <span
              key={`${i}-${label}`}
              className="sr-pill"
              style={{
                padding: `${u(2 * k)} ${u(8 * k)}`,
                background: "rgb(106 61 240 / 0.1)",
                color: "var(--sr-action)",
                ...typeStyle(11 * k, 1.4),
              }}
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}

      <p className="sr-muted sr-wrap" style={{ margin: `${u(12 * k)} 0 0`, ...typeStyle(12 * k, 1.45) }}>
        {d.line}
        {showElapsed ? <span className="sr-mono"> · {d.elapsed}</span> : null}
      </p>

      <p
        className="sr-wrap"
        style={{
          margin: `${u(4 * k)} 0 0`,
          color: "rgb(123 116 107 / 0.75)",
          ...typeStyle(11 * k, 1.45),
        }}
      >
        {EXPECTATION_LINE}
      </p>
    </div>
  );
}
