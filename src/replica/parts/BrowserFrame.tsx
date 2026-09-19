/**
 * The thin window chrome at the top of the stage.
 *
 * Optional, and a prop rather than a decision: on the landing page it says "this
 * is a screenshot of a real application" in one glance, and in a film cut that
 * pushes into the canvas it is the first thing that gives the frame away as a
 * mock-up. It carries no text — a fabricated address bar is a claim, and a bare
 * pill is furniture.
 */

import type { JSX } from "react";
import type { LayoutSpec } from "../layout";
import { u } from "../style";

export function BrowserFrame({ spec }: { spec: LayoutSpec }): JSX.Element | null {
  if (spec.frameH <= 0) return null;
  const k = spec.k;
  const dot = 8 * k;
  const y = (spec.frameH - dot) / 2;
  const pillW = 260 * k;
  const pillH = 14 * k;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: u(spec.W),
        height: u(spec.frameH),
        background: "var(--sr-muted)",
        borderBottom: "var(--sr-hair) solid var(--sr-border)",
      }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="sr-pill"
          style={{
            position: "absolute",
            left: u(14 * k + i * (dot + 6 * k)),
            top: u(y),
            width: u(dot),
            height: u(dot),
            background: "var(--sr-border)",
            display: "block",
          }}
        />
      ))}
      <span
        className="sr-pill"
        style={{
          position: "absolute",
          left: u((spec.W - pillW) / 2),
          top: u((spec.frameH - pillH) / 2),
          width: u(pillW),
          height: u(pillH),
          background: "var(--sr-background)",
          border: "var(--sr-hair) solid var(--sr-border)",
          display: "block",
        }}
      />
    </div>
  );
}
