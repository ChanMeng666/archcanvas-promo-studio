/**
 * Act II — the floating command bar (`src/components/studio/CommandBar.tsx`,
 * hosting `Composer` in its `bar` variant).
 *
 * A pure composer row: the 📍 chip when an element is selected, a borderless
 * input, the mic and the send button. The placeholder is CONTEXT-AWARE and that
 * is load-bearing rather than decorative — with a room selected it says "Tell me
 * what to do with Kitchen…", which is *why* the product's element action bar
 * needs no free-text button. `at.ts` computes it; this only prints it.
 */

import type { JSX } from "react";
import { Icon } from "../icons";
import { commandControls } from "../layoutMap";
import type { LayoutSpec } from "../layout";
import { shadow, type as typeStyle, u } from "../style";
import type { ReplicaState } from "../types";

export function CommandBar({ spec, state }: { spec: LayoutSpec; state: ReplicaState }): JSX.Element {
  const k = spec.k;
  const bar = spec.commandBar;
  const { input, send } = commandControls(spec);
  const mic = { x: send.x - 4 * k - send.w, y: send.y, w: send.w, h: send.h };
  const selected = state.selection.label;
  const chipW = selected ? Math.min(160 * k, 40 * k + selected.length * 6.2 * k) : 0;
  const typed = state.command.text;

  return (
    <div
      className="sr-card"
      style={{
        position: "absolute",
        left: u(bar.x),
        top: u(bar.y),
        width: u(bar.w),
        height: u(bar.h),
        background: "rgb(255 255 255 / 0.96)",
        boxShadow: shadow(10, 28, -10, 0.2),
      }}
    >
      {/* 📍 the scoped element — the chip the placeholder pairs with. */}
      {selected ? (
        <span
          className="sr-row sr-pill"
          style={{
            position: "absolute",
            left: u(input.x - bar.x),
            top: u(input.y - bar.y + (input.h - 22 * k) / 2),
            height: u(22 * k),
            maxWidth: u(chipW),
            padding: `0 ${u(8 * k)}`,
            gap: u(4 * k),
            border: "var(--sr-hair) solid rgb(106 61 240 / 0.4)",
            background: "rgb(106 61 240 / 0.1)",
            color: "var(--sr-action)",
            ...typeStyle(11 * k, 1),
          }}
        >
          <Icon name="mapPin" size={u(11 * k)} />
          <span className="sr-truncate">{selected}</span>
          <Icon name="x" size={u(10 * k)} />
        </span>
      ) : null}

      <div
        style={{
          position: "absolute",
          left: u(input.x - bar.x + (selected ? chipW + 8 * k : 0)),
          top: u(input.y - bar.y),
          width: u(input.w - (selected ? chipW + 8 * k : 0)),
          height: u(input.h),
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          ...typeStyle(13.5 * k, 1.3),
          color: typed.length > 0 ? "var(--sr-foreground)" : "var(--sr-muted-foreground)",
        }}
      >
        <span className="sr-truncate">{typed.length > 0 ? typed : state.command.placeholder}</span>
        {typed.length > 0 && state.command.sending === false ? (
          <span
            style={{
              display: "inline-block",
              width: u(1.5 * k),
              height: u(14 * k),
              marginLeft: u(1 * k),
              background: "var(--sr-foreground)",
              flexShrink: 0,
            }}
          />
        ) : null}
      </div>

      <span
        className="sr-center sr-pill"
        style={{
          position: "absolute",
          left: u(mic.x - bar.x),
          top: u(mic.y - bar.y),
          width: u(mic.w),
          height: u(mic.h),
          color: "var(--sr-muted-foreground)",
        }}
      >
        <Icon name="mic" size={u(15 * k)} />
      </span>

      <span
        className="sr-center sr-pill"
        style={{
          position: "absolute",
          left: u(send.x - bar.x),
          top: u(send.y - bar.y),
          width: u(send.w),
          height: u(send.h),
          background: typed.trim().length > 0 ? "var(--sr-foreground)" : "var(--sr-muted)",
          color: typed.trim().length > 0 ? "var(--sr-background)" : "var(--sr-muted-foreground)",
          opacity: state.command.sending ? 0.75 : 1,
        }}
      >
        <Icon name="send" size={u(15 * k)} />
      </span>
    </div>
  );
}
