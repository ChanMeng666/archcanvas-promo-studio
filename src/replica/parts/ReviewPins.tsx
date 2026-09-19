/**
 * Review pins — the receipt.
 *
 * Every finding drops a ⚑ onto the drawing: on its own room where it names one,
 * and on the paper's top edge where it is about the sheet as a whole. ONE of
 * them is open, showing its text VERBATIM and the two actions the product
 * offers, "Have AI fix" and "Dismiss".
 *
 * ⚠ The text is never paraphrased and never invented. These are the compiler's
 * own words about this drawing, carried through the bake — the whole point of
 * the "…and a written list of everything we couldn't get right" claim is that
 * the list is real.
 *
 * Three rules, each of which was a defect in the first pass:
 *
 *  • **Exactly one card.** The sheet-wide finding used to render as a permanent
 *    card in the corner, so two were open at once with nothing to say which one
 *    the cursor had just opened.
 *  • **The card is BESIDE the paper, never on it.** A card under its own pin
 *    covers the room the finding is about, and often its label — showing a
 *    reader a complaint while taking the evidence away. The canvas around the
 *    sheet is empty; `findingCardBox` puts it there.
 *  • **A leader joins the two**, because a card a third of a screen from its pin
 *    is otherwise two unrelated things.
 */

import type { JSX } from "react";
import { Icon } from "../icons";
import {
  PIN_H,
  PIN_W,
  findingCardBox,
  pinAnchors,
  type TargetContext,
} from "../layoutMap";
import { PIN_DISMISS, PIN_FIX } from "../strings";
import { pct, shadow, type as typeStyle, u } from "../style";

/** Every finding in the demo is an advisory note; the product labels them so. */
const PIN_LABEL = "advisory";

export function ReviewPins({ ctx }: { ctx: TargetContext }): JSX.Element | null {
  const { spec, state } = ctx;
  // Pins and their cards live ON the sheet, so they take the sheet's own scale.
  const k = spec.ck;
  const findings = state.review.findings;
  if (findings.length === 0) return null;

  const anchors = pinAnchors(ctx);
  const openIdx = state.review.openPin;
  // ⚠ The open card follows its PIN off the page. While the first floor is
  // shown, a ground-floor finding's card would be a complaint floating over a
  // drawing it is not about, joined by a leader to a pin that is not there.
  const openRaw = openIdx === null ? null : (anchors[openIdx] ?? null);
  const openAnchor = openRaw?.onThisPage ? openRaw : null;
  const openFinding = openAnchor && openIdx !== null ? (findings[openIdx] ?? null) : null;
  // `null` when an open export menu has taken the only space the card can go —
  // see `findingCardBox`. The pin stays either way.
  const card = openAnchor ? findingCardBox(ctx, openAnchor) : null;

  return (
    <>
      {/* The leader goes UNDER the pins and the card, so neither is crossed. */}
      {card && openAnchor ? <Leader ctx={ctx} from={card} to={openAnchor} /> : null}

      {findings.map((f, i) => {
        const a = anchors[i];
        const p = pct(state.review.pinsDropped[i] ?? 0);
        if (!a || !a.onThisPage || p <= 0) return null;
        const open = i === openIdx;
        const pinW = PIN_W * k;
        const pinH = PIN_H * k;
        return (
          <span
            key={`pin-${i}`}
            className="sr-pill sr-center"
            style={{
              position: "absolute",
              left: u(a.x - pinW / 2),
              // Drops in from above and settles on its element.
              top: u(a.y - pinH - 8 * k - (1 - p) * 18 * k),
              width: u(pinW),
              height: u(pinH),
              opacity: p,
              transform: `scale(${(0.7 + 0.3 * p).toFixed(3)})`,
              transformOrigin: "50% 100%",
              // The open one wears the violet the card is trimmed with, so the
              // pair reads as one thing across the gap between them.
              border: `calc(var(--u) * ${(1.2 * k).toFixed(2)}) solid ${
                open ? "rgb(106 61 240 / 0.55)" : "rgb(123 116 107 / 0.35)"
              }`,
              background: open ? "rgb(106 61 240 / 0.12)" : "rgb(255 255 255 / 0.97)",
              color: open ? "var(--sr-action)" : "var(--sr-foreground)",
              boxShadow: shadow(1, 4, 0, 0.2),
            }}
          >
            {/* The product draws a ⚑ CHARACTER here. The replica cannot: the
                display faces a host supplies have no glyph for it, and a missing
                glyph renders as a notdef box — measured, in this very harness.
                The icon is the same mark and is always there. */}
            <Icon name="flag" size={u(12 * k)} weight={2.2} />
          </span>
        );
      })}

      {card && openFinding ? (
        <FindingCard ctx={ctx} box={card} message={openFinding.message} />
      ) : null}
    </>
  );
}

/**
 * The hairline from the card to its pin.
 *
 * An SVG rather than a rotated div: the line is diagonal and its length changes
 * with the camera, and a transform-based rule would need a second copy of the
 * arithmetic that already lives in `findingCardBox`.
 */
function Leader({
  ctx,
  from,
  to,
}: {
  ctx: TargetContext;
  from: { x: number; y: number; w: number; h: number };
  to: { x: number; y: number };
}): JSX.Element {
  const { spec } = ctx;
  const k = spec.ck;
  // The card's inner edge — the side facing the pin.
  const ax = to.x > from.x + from.w / 2 ? from.x + from.w : from.x;
  const ay = from.y + 18 * k;
  const by = to.y - (PIN_H / 2 + 8) * k;

  const minX = Math.min(ax, to.x) - 2;
  const minY = Math.min(ay, by) - 2;
  const w = Math.abs(ax - to.x) + 4;
  const h = Math.abs(ay - by) + 4;

  return (
    <svg
      style={{
        position: "absolute",
        left: u(minX),
        top: u(minY),
        width: u(w),
        height: u(h),
        overflow: "visible",
        pointerEvents: "none",
      }}
      viewBox={`0 0 ${Math.max(1, w)} ${Math.max(1, h)}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <line
        x1={ax - minX}
        y1={ay - minY}
        x2={to.x - minX}
        y2={by - minY}
        stroke="rgb(106 61 240 / 0.45)"
        strokeWidth={1.2 * k}
        strokeDasharray={`${4 * k} ${3 * k}`}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function FindingCard({
  ctx,
  box,
  message,
}: {
  ctx: TargetContext;
  box: { x: number; y: number; w: number; h: number };
  message: string;
}): JSX.Element {
  const { spec } = ctx;
  const k = spec.ck;
  return (
    <div
      className="sr-panel"
      style={{
        position: "absolute",
        left: u(box.x),
        top: u(box.y),
        width: u(box.w),
        padding: u(8 * k),
        boxSizing: "border-box",
        background: "rgb(255 255 255 / 0.98)",
        borderColor: "rgb(106 61 240 / 0.35)",
        boxShadow: shadow(6, 18, -8, 0.25),
      }}
    >
      <div
        className="sr-mono"
        style={{ ...typeStyle(9 * k, 1.2), textTransform: "uppercase", color: "var(--sr-muted-foreground)" }}
      >
        {PIN_LABEL}
      </div>
      <p
        className="sr-clamp sr-wrap"
        style={{
          margin: `${u(4 * k)} 0 0`,
          ...typeStyle(spec.findingSize, 1.4),
          WebkitLineClamp: spec.pinCardLines,
        }}
      >
        {message}
      </p>
      <div className="sr-row" style={{ marginTop: u(8 * k), gap: u(5 * k) }}>
        <span
          className="sr-pill"
          style={{
            padding: `${u(2 * k)} ${u(8 * k)}`,
            background: "rgb(106 61 240 / 0.1)",
            color: "var(--sr-action)",
            ...typeStyle(11 * k, 1.4),
          }}
        >
          {PIN_FIX}
        </span>
        <span
          className="sr-pill"
          style={{
            padding: `${u(2 * k)} ${u(8 * k)}`,
            border: "var(--sr-hair) solid var(--sr-border)",
            color: "var(--sr-muted-foreground)",
            ...typeStyle(11 * k, 1.4),
          }}
        >
          {PIN_DISMISS}
        </span>
      </div>
    </div>
  );
}
