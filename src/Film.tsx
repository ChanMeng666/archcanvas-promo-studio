import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { FONT } from "./fonts";
import { useLayout, type CutId } from "./layout";
import { SCENES } from "./scenes";
import { TIMELINES, beatAtFrame, progressInBeat, replicaTimeAt } from "./timeline";
import { APP, CANVAS_DOT_PITCH, RADIUS, SPOT, TRACKING, TYPE, WEIGHT } from "./tokens";

/**
 * THE SCAFFOLD, AND NOTHING ELSE YET.
 *
 * Every visible string in this file lives inside `Placeholder`, which is not
 * copy: `capture/verify-copy.mjs` classes it as scaffolding, lists it on every
 * run, and fails on it only under `--strict`. So the film cannot ship with one
 * of these on screen, and the gate does not hold the repo red while WP-7 and
 * WP-9 are writing the real scenes.
 *
 * What this proves today: the fonts load, `useLayout()` gives both arrangements
 * sensible numbers, and the derived timeline puts the right scene under the
 * right frame in all eight compositions.
 */
const Placeholder: React.FC<{
  cut: CutId;
  frame: number;
}> = ({ cut, frame }) => {
  const layout = useLayout();
  const timeline = TIMELINES[cut];
  const beat = beatAtFrame(cut, frame);
  const scene = beat ? SCENES[beat.scene] : null;
  const replicaAt = replicaTimeAt(cut, frame);
  const through = beat ? progressInBeat(beat, frame) : 0;

  const stack = layout.aspect === "portrait";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: APP.page,
        color: APP.ink,
        fontFamily: FONT.sans,
        // The product's own canvas lattice, so the scaffold already sits on the
        // ground the replica will land on rather than on a blank rectangle.
        backgroundImage: `radial-gradient(${APP.canvasDot} 1px, transparent 1px)`,
        backgroundSize: `${CANVAS_DOT_PITCH}px ${CANVAS_DOT_PITCH}px`,
      }}
    >
      <AbsoluteFill
        style={{
          left: layout.stage.x,
          top: layout.stage.y,
          width: layout.stage.w,
          height: layout.stage.h,
          justifyContent: "center",
          alignItems: stack ? "center" : "flex-start",
          textAlign: stack ? "center" : "left",
          gap: layout.u(24),
        }}
      >
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: layout.u(TYPE.dimension),
            fontWeight: WEIGHT.medium,
            letterSpacing: `${TRACKING.caps}em`,
            textTransform: "uppercase",
            color: APP.inkMuted,
          }}
        >
          scaffold
        </div>

        <div
          style={{
            fontSize: layout.u(TYPE.display),
            fontWeight: WEIGHT.bold,
            letterSpacing: `${TRACKING.display}em`,
            lineHeight: 1.02,
            maxWidth: layout.maxContent,
          }}
        >
          {scene ? scene.id : "no beat"}
        </div>

        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: layout.u(TYPE.label),
            color: APP.inkMuted,
            lineHeight: 1.6,
            whiteSpace: "pre-line",
          }}
        >
          {[
            `${cut}s · ${layout.width}x${layout.height} · ${layout.replicaLayout}`,
            `frame ${frame} / ${timeline.totalFrames}`,
            beat
              ? `beat ${beat.index} · ${beat.durationSec}s · ${(through * 100).toFixed(0)}%`
              : "beat -",
            replicaAt === null
              ? "replica -"
              : `replica t = ${replicaAt.toFixed(2)}s`,
          ].join("\n")}
        </div>

        <div
          style={{
            width: stack ? layout.stage.w * 0.7 : layout.stage.w * 0.55,
            height: layout.u(6),
            borderRadius: RADIUS.pill,
            backgroundColor: APP.hairline,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${(frame / Math.max(1, timeline.totalFrames)) * 100}%`,
              height: "100%",
              backgroundColor: SPOT.action,
            }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Film: React.FC<{ cut: CutId }> = ({ cut }) => {
  const frame = useCurrentFrame();
  return <Placeholder cut={cut} frame={frame} />;
};
