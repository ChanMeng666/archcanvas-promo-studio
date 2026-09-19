/**
 * The rendering (效果图) — a borderless photograph floating on the paper canvas.
 *
 * ⚠ THE "AI-generated" PILL IS ALWAYS VISIBLE AND IS NOT DECORATION. EU AI Act
 * Article 50 wants a person looking at synthetic media to be able to tell that
 * it is synthetic; the product's own pill is deliberately not hover-revealed,
 * because an image that discloses its nature only on mouseover discloses nothing
 * on a phone — and a film frame has no mouse at all. It renders whenever the
 * image does.
 *
 * The image itself arrives through `assetUrl`, so the landing page can serve it
 * from `/showcase/...` and the film can map the same path onto a local file
 * without either of them rewriting the screenplay.
 */

import type { JSX } from "react";
import type { LayoutSpec } from "../layout";
import { RENDERING_PILL } from "../strings";
import { pct, type as typeStyle, u } from "../style";

export function RenderingCard({
  spec,
  src,
  progress,
  assetUrl,
}: {
  spec: LayoutSpec;
  src: string | null;
  progress: number;
  /** Map a screenplay path onto something this host can fetch. */
  assetUrl: (src: string) => string;
}): JSX.Element | null {
  const p = pct(progress);
  if (!src || p <= 0.01) return null;
  const k = spec.k;
  const r = spec.rendering;

  return (
    <div
      style={{
        position: "absolute",
        left: u(r.x),
        // Rises a little as it fades in — the product's images land, they do not
        // blink on.
        top: u(r.y + (1 - p) * 10 * k),
        width: u(r.w),
        height: u(r.h),
        opacity: p,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- the replica runs
          outside Next.js by design (house rule 1 in `types.ts`); `next/image`
          does not exist in the film repo. */}
      <img
        src={assetUrl(src)}
        alt=""
        className="sr-photo"
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: u(10 * k),
        }}
      />
      <span
        className="sr-pill sr-mono"
        style={{
          position: "absolute",
          left: u(8 * k),
          bottom: u(8 * k),
          padding: `${u(2 * k)} ${u(8 * k)}`,
          border: "var(--sr-hair) solid var(--sr-border)",
          background: "rgb(255 255 255 / 0.92)",
          color: "var(--sr-muted-foreground)",
          ...typeStyle(10 * k, 1.5),
        }}
      >
        {RENDERING_PILL}
      </span>
    </div>
  );
}
