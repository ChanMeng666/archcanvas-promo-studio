/**
 * The pointer, and the ripple it leaves behind.
 *
 * Position comes from `cursorPoint`, which lerps the two resolved targets by
 * `state.cursor.p` — and `p` is ALREADY EASED (`types.ts` § CursorState). The
 * one thing this component must not do is curve it again: a double-eased cursor
 * reads as hesitation, and it arrives late for its own click.
 *
 * The ripple outlives the press on purpose. A click with no aftermath is
 * invisible at 30 fps, which is exactly when a viewer needs to know that
 * something was pressed.
 */

import type { JSX } from "react";
import { CursorArrow } from "../icons";
import { cursorPoint, type TargetContext } from "../layoutMap";
import { pct, u } from "../style";

export function Cursor({ ctx }: { ctx: TargetContext }): JSX.Element {
  const { spec, state } = ctx;
  const k = spec.k;
  const p = cursorPoint(ctx);
  const x = p.x * spec.W;
  const y = p.y * spec.H;
  const ripple = pct(state.cursor.ripple);
  const size = 22 * k;

  return (
    <div style={{ position: "absolute", left: u(x), top: u(y), width: 0, height: 0 }}>
      {ripple > 0 && ripple < 1 ? (
        <span
          className="sr-pill"
          style={{
            position: "absolute",
            left: u(-((10 + ripple * 22) * k)),
            top: u(-((10 + ripple * 22) * k)),
            width: u((20 + ripple * 44) * k),
            height: u((20 + ripple * 44) * k),
            border: `${u(2 * k)} solid rgb(106 61 240 / ${(0.55 * (1 - ripple)).toFixed(3)})`,
            boxSizing: "border-box",
            display: "block",
          }}
        />
      ) : null}
      <span
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          display: "block",
          // The hotspot is the arrow's tip, at (5.5, 2.5) of a 24 box.
          transform: `translate(${u(-size * 0.23)}, ${u(-size * 0.1)}) scale(${state.cursor.pressed ? 0.88 : 1})`,
          transformOrigin: "0 0",
        }}
      >
        <CursorArrow size={u(size)} />
      </span>
    </div>
  );
}
