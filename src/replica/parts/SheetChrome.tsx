/**
 * The chrome that floats around the sheet: the review badge, the storey chips,
 * the Export trigger, the tweak toggle and the caption row.
 *
 * All of it is WORLD space — it rides the camera with the paper, exactly as
 * `DesignFrame`'s `-top-9 left-0` / `-top-9 right-0` clusters ride the card. The
 * boxes come from `sheetChrome()`, which `layoutMap` also reads, so the cursor
 * and the button cannot disagree about where the button is.
 *
 * The chrome appears only once the drawing has started: before that there is no
 * sheet to hang it on.
 */

import type { JSX } from "react";
import { Icon } from "../icons";
import { sheetChrome, type LayoutSpec } from "../layout";
import { EXPORT_TRIGGER, storeyChip } from "../strings";
import { type as typeStyle, u } from "../style";
import type { ReplicaState } from "../types";

export function SheetChrome({
  spec,
  state,
  storeys,
  title,
}: {
  spec: LayoutSpec;
  state: ReplicaState;
  storeys: number;
  title: string;
}): JSX.Element | null {
  // The sheet's chrome has its own scale — see `LayoutSpec.ck`.
  const k = spec.ck;
  const c = sheetChrome(spec, storeys, state.review.badgeCount);
  const shown = state.plan.bands[0] > 0;
  if (!shown) return null;

  const reviewOn = state.review.badgeCount > 0;
  const exportOn = state.exportMenu.open > 0.05;
  const tweakOn = state.tweaks.open > 0.05;

  return (
    <>
      {/* ── review badge ── quiet by design; the count appears only when there
          is one, exactly as the product's ⚑ does. */}
      <div
        className={`sr-row sr-pill ${reviewOn ? "sr-chrome-on" : "sr-chrome"}`}
        style={{
          position: "absolute",
          left: u(c.reviewBadge.x),
          top: u(c.reviewBadge.y),
          width: u(c.reviewBadge.w),
          height: u(c.reviewBadge.h),
          justifyContent: "center",
          gap: u(4 * k),
        }}
      >
        <Icon name="flag" size={u(12 * k)} />
        {state.review.badgeCount > 0 ? (
          <span className="sr-mono" style={typeStyle(10 * k, 1)}>
            {state.review.badgeCount}
          </span>
        ) : null}
      </div>

      {/* ── storey chips ── always visible rather than hover-revealed: which
          floor you are looking at is state, not an affordance to discover. */}
      {storeys > 1 && state.storey.chipsVisible ? (
        <div
          className="sr-row sr-pill sr-chrome"
          style={{
            position: "absolute",
            left: u(c.storeyGroup.x),
            top: u(c.storeyGroup.y),
            width: u(c.storeyGroup.w),
            height: u(c.storeyGroup.h),
          }}
        >
          {c.storeyChips.map((chip, i) => {
            const active = state.storey.page === i;
            return (
              <span
                key={i}
                className="sr-pill sr-mono sr-center"
                style={{
                  position: "absolute",
                  left: u(chip.x - c.storeyGroup.x),
                  top: u(chip.y - c.storeyGroup.y),
                  width: u(chip.w),
                  height: u(chip.h),
                  ...typeStyle(10 * k, 1),
                  textTransform: "uppercase",
                  background: active ? "rgb(106 61 240 / 0.2)" : "transparent",
                  color: active ? "var(--sr-action)" : "var(--sr-muted-foreground)",
                }}
              >
                {storeyChip(i)}
              </span>
            );
          })}
        </div>
      ) : null}

      {/* ── the sheet's own toolbar ── Export + the tweak toggle, nothing else. */}
      <div
        className="sr-pill sr-chrome"
        style={{
          position: "absolute",
          left: u(c.right.x),
          top: u(c.right.y),
          width: u(c.right.w),
          height: u(c.right.h),
        }}
      >
        <span
          className="sr-row sr-pill sr-mono"
          style={{
            position: "absolute",
            left: u(c.exportBtn.x - c.right.x),
            top: u(c.exportBtn.y - c.right.y),
            width: u(c.exportBtn.w),
            height: u(c.exportBtn.h),
            justifyContent: "center",
            gap: u(4 * k),
            ...typeStyle(10 * k, 1),
            border: "var(--sr-hair) solid var(--sr-border)",
            background: exportOn ? "var(--sr-muted)" : "var(--sr-background)",
            color: "var(--sr-foreground)",
          }}
        >
          <Icon name="download" size={u(10 * k)} />
          {EXPORT_TRIGGER}
          <Icon name="chevronDown" size={u(10 * k)} style={{ opacity: 0.6 }} />
        </span>
        <span
          className="sr-pill sr-center"
          style={{
            position: "absolute",
            left: u(c.tweakBtn.x - c.right.x),
            top: u(c.tweakBtn.y - c.right.y),
            width: u(c.tweakBtn.w),
            height: u(c.tweakBtn.h),
            background: tweakOn ? "var(--sr-muted)" : "transparent",
            color: tweakOn ? "var(--sr-action)" : "var(--sr-muted-foreground)",
          }}
        >
          <Icon name="sliders" size={u(12 * k)} />
        </span>
      </div>

      {/* ── caption row ── the design's name and its version count. Always in
          flow under the sheet; the ONE permanent piece of text on the card. */}
      <div
        className="sr-row"
        style={{
          position: "absolute",
          left: u(c.caption.x),
          top: u(c.caption.y),
          width: u(c.caption.w),
          height: u(c.caption.h),
          justifyContent: "space-between",
          gap: u(8 * k),
        }}
      >
        <span
          className="sr-truncate"
          style={{ ...typeStyle(10 * k, 1.4), color: "rgb(123 116 107 / 0.8)" }}
        >
          {title}
        </span>
        <span
          className="sr-mono"
          style={{ ...typeStyle(10 * k, 1.4), color: "rgb(123 116 107 / 0.6)", flexShrink: 0 }}
        >
          {state.versionLabel}
        </span>
      </div>
    </>
  );
}
