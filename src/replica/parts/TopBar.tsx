/**
 * The studio's slim top bar — `StudioShell.tsx`'s `<header>`.
 *
 * Breadcrumb (Dashboard / the project's name) on the left, the two project-level
 * actions on the right, in the product's order: Transcript, then Share. Every
 * word comes from `strings.ts`, which the string test pins against the real
 * component.
 */

import type { JSX } from "react";
import { Icon } from "../icons";
import type { LayoutSpec } from "../layout";
import { TOP_BAR_DASHBOARD, TOP_BAR_SHARE, TOP_BAR_TRANSCRIPT } from "../strings";
import { type as typeStyle, u } from "../style";

export function TopBar({ spec, title }: { spec: LayoutSpec; title: string }): JSX.Element {
  const k = spec.k;
  const bar = spec.topBar;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: u(bar.y),
        width: u(bar.w),
        height: u(bar.h),
        background: "var(--sr-background)",
        borderBottom: "var(--sr-hair) solid var(--sr-border)",
      }}
    >
      <div
        className="sr-row"
        style={{
          position: "absolute",
          left: u(14 * k),
          top: u(bar.h / 2),
          transform: "translateY(-50%)",
          gap: u(6 * k),
          // The two action pills on the right are wider, relative to the bar, in
          // portrait — so the breadcrumb gets less of it, or the project name
          // runs under "Transcript" at 340 px.
          maxWidth: u(bar.w * (spec.id === "portrait" ? 0.42 : 0.55)),
        }}
      >
        <Icon name="home" size={u(12 * k)} color="var(--sr-muted-foreground)" />
        <span className="sr-muted" style={typeStyle(12 * k, 1.2)}>
          {TOP_BAR_DASHBOARD}
        </span>
        <span style={{ ...typeStyle(12 * k, 1.2), color: "var(--sr-border)" }}>/</span>
        <span className="sr-truncate" style={typeStyle(13 * k, 1.2, 500)}>
          {title}
        </span>
      </div>

      <div
        className="sr-row"
        style={{
          position: "absolute",
          right: u(14 * k),
          top: u(bar.h / 2),
          transform: "translateY(-50%)",
          gap: u(8 * k),
        }}
      >
        <span
          className="sr-row sr-pill sr-outline"
          style={{
            gap: u(5 * k),
            height: u(28 * k),
            padding: `0 ${u(10 * k)}`,
            ...typeStyle(11.5 * k, 1),
          }}
        >
          <Icon name="messages" size={u(11 * k)} />
          {TOP_BAR_TRANSCRIPT}
        </span>
        <span
          className="sr-row sr-pill sr-outline"
          style={{
            gap: u(5 * k),
            height: u(28 * k),
            padding: `0 ${u(10 * k)}`,
            ...typeStyle(11.5 * k, 1),
          }}
        >
          <Icon name="share" size={u(11 * k)} />
          {TOP_BAR_SHARE}
        </span>
      </div>
    </div>
  );
}
