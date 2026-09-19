/**
 * The export menu — Image and CAD, and nothing else.
 *
 * ⚠ THIS IS A PARTIAL VIEW OF A REAL MENU, NOT AN INVENTED ONE. The product's
 * menu carries a third group naming the source format, which is machinery the
 * buyer never needs to see; the two groups here are shown verbatim, labels and
 * second lines and all, from `strings.ts`. Adding an item that the product does
 * not offer would make this a promise rather than a picture.
 *
 * It anchors under the sheet's Export trigger in landscape and rises as a bottom
 * sheet in portrait, where a 224-unit dropdown hanging off a control near the
 * right edge would fall off the screen. `exportMenuBox` / `exportItemBox` own
 * both cases and `layoutMap` resolves `exportItem:"DXF"` through the same two
 * functions.
 */

import type { JSX } from "react";
import { Icon } from "../icons";
import { exportItemBox, exportMenuBox, type TargetContext } from "../layoutMap";
import { EXPORT_GROUPS } from "../strings";
import { pct, shadow, type as typeStyle, u } from "../style";

export function ExportMenu({ ctx }: { ctx: TargetContext }): JSX.Element | null {
  const { spec, state } = ctx;
  const open = pct(state.exportMenu.open);
  if (open <= 0.02) return null;

  const k = spec.k;
  const box = exportMenuBox(ctx);
  const sheetMode = spec.exportMenu.mode === "sheet";

  return (
    <div
      className="sr-panel"
      style={{
        position: "absolute",
        left: u(box.x),
        top: u(box.y + (1 - open) * (sheetMode ? 24 * k : 6 * k)),
        width: u(box.w),
        height: u(box.h),
        opacity: open,
        transform: sheetMode ? undefined : `scale(${(0.97 + 0.03 * open).toFixed(4)})`,
        transformOrigin: "100% 0%",
        borderRadius: sheetMode ? `${u(20 * k)} ${u(20 * k)} 0 0` : undefined,
        background: "rgb(255 255 255 / 0.98)",
        boxShadow: shadow(12, 34, -10, 0.28),
        overflow: "hidden",
      }}
    >
      {EXPORT_GROUPS.map((group) => (
        <div key={group.label}>
          {group.items.map((item) => {
            const r = exportItemBox(ctx, item.label);
            if (!r) return null;
            const hovered = state.exportMenu.hovered === item.label;
            return (
              <div
                key={item.label}
                className="sr-row"
                style={{
                  position: "absolute",
                  left: u(r.x - box.x),
                  top: u(r.y - box.y),
                  width: u(r.w),
                  height: u(r.h),
                  gap: u(8 * k),
                  padding: `0 ${u(8 * k)}`,
                  boxSizing: "border-box",
                  borderRadius: u(8 * k),
                  background: hovered ? "var(--sr-muted)" : "transparent",
                }}
              >
                <Icon
                  name={group.label === "CAD" ? "fileText" : "file"}
                  size={u(14 * k)}
                  color="var(--sr-muted-foreground)"
                />
                <span className="sr-col" style={{ minWidth: 0 }}>
                  <span style={typeStyle(12 * k, 1.25, 500)}>{item.label}</span>
                  <span
                    className="sr-truncate"
                    style={{ ...typeStyle(10 * k, 1.3), color: "rgb(123 116 107 / 0.75)" }}
                  >
                    {item.sublabel}
                  </span>
                </span>
              </div>
            );
          })}
          <GroupLabel ctx={ctx} label={group.label} boxX={box.x} boxY={box.y} />
        </div>
      ))}
    </div>
  );
}

/**
 * A group heading sits directly above its first item, so it is placed from that
 * item's own box rather than from a second running total that could drift.
 */
function GroupLabel({
  ctx,
  label,
  boxX,
  boxY,
}: {
  ctx: TargetContext;
  label: string;
  boxX: number;
  boxY: number;
}): JSX.Element | null {
  const { spec } = ctx;
  const k = spec.k;
  const group = EXPORT_GROUPS.find((g) => g.label === label);
  const first = group ? exportItemBox(ctx, group.items[0].label) : null;
  if (!first) return null;
  return (
    <div
      className="sr-row"
      style={{
        position: "absolute",
        left: u(first.x - boxX + 8 * k),
        top: u(first.y - boxY - spec.exportMenu.labelH),
        height: u(spec.exportMenu.labelH),
        ...typeStyle(10 * k, 1, 600),
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: "var(--sr-muted-foreground)",
      }}
    >
      {label}
    </div>
  );
}
