import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { replicaAssetUrl } from "../assets";
import { entryOpacity, pushTransform, shotFor } from "../camera";
import { FONT } from "../fonts";
import { useLayout, type StageRect } from "../layout";
import { DEMO, PAGES } from "../film-demo";
import { StudioReplica } from "../replica/StudioReplica";
import { frameToSec, type ResolvedBeat } from "../timeline";
import { APP, CANVAS_DOT_PITCH, CANVAS_DRIFT_PX, RADIUS } from "../tokens";

/**
 * The product, on screen.
 *
 * This is the film's ONE integration point with the synced replica, and it is
 * deliberately thin: `shotFor` (in the React-free `camera.ts`) answers where the
 * replica is mounted, what second of the screenplay it is showing and what the
 * camera is doing, and this component turns that into three `div`s. Everything a
 * gate wants to know about a frame it can therefore ask without a renderer —
 * which is what lets `verify:honesty` check the caption against the real camera
 * maths rather than against a copy of them.
 *
 * ── The window ─────────────────────────────────────────────────────────────
 *
 * In 16:9 the replica sits in a rounded, softly shadowed window floating on the
 * ivory page, with the replica's own browser chrome on: a wide frame has the
 * room, and the chrome is what says "this is an application" in one glance.
 *
 * In 9:16 both are off. A phone frame has no room to spend on a border, and the
 * chrome band is 30 design units of furniture in the one composition where every
 * unit of height is the difference between a legible room label and a smudge.
 * The picture goes edge to edge instead, which is also how a vertical cut reads
 * as native rather than as a letterboxed desktop.
 *
 * ── What is NOT here ───────────────────────────────────────────────────────
 *
 * No `will-change`, on this or on anything it wraps. It asks Chrome to allocate
 * backing store for the whole transformed layer, and a sibling film's renders
 * were killed for memory with 5.4 GB free over one. `verify:replica` greps the
 * synced replica for it for the same reason.
 */
export const ReplicaSlot: React.FC<{
  beat: ResolvedBeat;
  /** Where to mount, if not the whole picture box. A `split` scene passes its top. */
  stage?: StageRect;
}> = ({ beat, stage }) => {
  const frame = useCurrentFrame();
  const layout = useLayout();
  const box = stage ?? layout.picture;
  const windowed = layout.aspect === "landscape";

  const shot = shotFor(beat, frame, layout, box, { browserFrame: windowed });
  const { mount, push } = shot;

  return (
    <AbsoluteFill style={{ backgroundColor: APP.page }}>
      <AbsoluteFill
        style={{
          transform: pushTransform(push),
          transformOrigin: "0 0",
          opacity: entryOpacity(frameToSec(frame)),
        }}
      >
        {/*
          ⚠ INSIDE the push, not behind it.

          Behind it, the film's lattice stayed at 1x while the replica's own
          scaled with the shot, and the window's edge became a hard seam between
          two dot grids of different sizes — a frame that reads as two pictures
          rather than one canvas. Scaling it with everything else is also safe:
          the layer is an `AbsoluteFill` and `framePush` clamps the translate so
          a scale >= 1 always covers the frame.
        */}
        <CanvasGround frame={frame} layout={layout} />
        <div
          style={{
            position: "absolute",
            left: mount.rect.x,
            top: mount.rect.y,
            width: mount.rect.w,
            height: mount.rect.h,
            borderRadius: windowed ? layout.u(RADIUS.card) : 0,
            overflow: "hidden",
            boxShadow: windowed
              ? `0 ${layout.u(26)}px ${layout.u(70)}px rgb(19 17 15 / 0.13), 0 ${layout.u(3)}px ${layout.u(10)}px rgb(19 17 15 / 0.06)`
              : "none",
            border: windowed ? `${Math.max(1, layout.u(1))}px solid ${APP.hairline}` : "none",
          }}
        >
          <StudioReplica
            state={shot.state}
            demo={DEMO}
            pages={PAGES}
            layout={mount.layout}
            unit={mount.unit}
            browserFrame={windowed}
            assetUrl={replicaAssetUrl}
            style={{
              width: mount.rect.w,
              height: mount.rect.h,
              // The replica's own two faces come from the film's `fonts.ts`, so
              // the picture and the type around it are set in the same metal.
              ["--replica-sans" as string]: FONT.sans,
              ["--replica-mono" as string]: FONT.mono,
            }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * The infinite canvas the window floats on: the product's own dot lattice,
 * drifting a little.
 *
 * Two pitches of the lattice over the whole film, which is slow enough that a
 * viewer reads it as depth rather than as movement, and fast enough that a
 * static frame of a static interface is never actually static. It is a
 * background-position on one element — no layer promotion, nothing to allocate.
 */
const CanvasGround: React.FC<{ frame: number; layout: ReturnType<typeof useLayout> }> = ({
  frame,
  layout,
}) => {
  const pitch = layout.u(CANVAS_DOT_PITCH);
  const drift = (frame * CANVAS_DRIFT_PX) % pitch;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: APP.canvas,
        backgroundImage: `radial-gradient(${APP.canvasDot} ${Math.max(1, layout.u(1.4))}px, transparent ${Math.max(1, layout.u(1.4))}px)`,
        backgroundSize: `${pitch}px ${pitch}px`,
        backgroundPosition: `${drift.toFixed(2)}px ${(drift * 0.6).toFixed(2)}px`,
      }}
    />
  );
};
