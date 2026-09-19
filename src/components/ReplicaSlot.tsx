import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { FONT } from "../fonts";
import { useLayout, type StageRect } from "../layout";
import { SCENES } from "../scenes";
import { replicaTimeIn, type ResolvedBeat } from "../timeline";
import { APP, CANVAS_DOT_PITCH, RADIUS, SPOT, TRACKING, TYPE, WEIGHT } from "../tokens";

/**
 * Where the product goes.
 *
 * `src/replica/**` is a ONE-WAY copy of
 * `archcanvas/src/components/marketing/studio-replica/` and it has not been
 * synced yet, so this renders a framed placeholder instead: the chapter, the
 * replica window the beat plays, and the mapped screenplay time `t` at this
 * exact frame. That last number is the point of the placeholder — a still
 * proves the time-warp arithmetic before a single pixel of the product exists,
 * and a warp that runs backwards or overruns a chapter is visible in a PNG
 * rather than in a render three hours long.
 *
 * ── The one integration point ──────────────────────────────────────────────
 *
 * WP-9 replaces the `<Placeholder>` below with the real component and changes
 * nothing else. Everything it needs is already on the beat:
 *
 * ```tsx
 * // WP-9: mount the product's own studio here.
 * //   import { StudioReplica, at, buildScreenplay, FIXTURE_DEMO } from "../replica";
 * //   const screenplay = buildScreenplay(demoFor(beat.scene));
 * //   <StudioReplica
 * //     state={at(screenplay, t)}
 * //     layout={layout.replicaLayout}
 * //     drawList={drawList}
 * //   />
 * ```
 *
 * `t` is `replicaTimeIn(beat, frame)`, which is linear and clamped inside the
 * beat's own window — the whole time warp, in one call. `demoFor` is the second
 * question: the `second-brief` scene needs a different `DemoInputs` (the
 * family-house brief), and `scenes.ts` marks it `needs` until one exists.
 *
 * **Do not reach for `useVideoConfig()` here.** The replica lays itself out
 * portrait or landscape from `useLayout().replicaLayout`, which is a re-layout
 * and never a crop.
 */
export const ReplicaSlot: React.FC<{
  beat: ResolvedBeat;
  /**
   * Where to mount, if not the whole stage. A `split` scene hands over the
   * bottom fifth of the stage to its line, so the picture is smaller rather
   * than the type leaving the safe area.
   */
  stage?: StageRect;
}> = ({ beat, stage }) => {
  const frame = useCurrentFrame();
  const layout = useLayout();
  const scene = SCENES[beat.scene];
  const box = stage ?? layout.stage;
  const t = replicaTimeIn(beat, frame);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: APP.canvas,
        // The product's own canvas lattice, so the slot already sits on the
        // ground the replica will land on rather than on a blank rectangle.
        backgroundImage: `radial-gradient(${APP.canvasDot} 1px, transparent 1px)`,
        backgroundSize: `${CANVAS_DOT_PITCH}px ${CANVAS_DOT_PITCH}px`,
      }}
    >
      <AbsoluteFill
        style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      >
        {/* WP-9: mount <StudioReplica state={at(screenplay, t)} layout={layout.replicaLayout} …/> */}
        <Placeholder
          chapter={scene.chapter ?? "—"}
          intent={scene.intent}
          windowFrom={beat.replicaFrom}
          windowTo={beat.replicaTo}
          rate={beat.replicaRate}
          t={t}
          needs={scene.needs}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * Scaffolding, and labelled as such.
 *
 * `capture/verify-copy.mjs` classes anything inside a declaration named
 * `Placeholder` as scaffolding rather than copy: listed on every run, fatal
 * under `--strict`. `npm run ship` passes `--strict`, so the film physically
 * cannot ship with one of these on screen, and the gate does not hold the repo
 * red while WP-9 is mounting the real thing.
 */
const Placeholder: React.FC<{
  chapter: string;
  intent: string;
  windowFrom?: number;
  windowTo?: number;
  rate: number | null;
  t: number | null;
  needs?: string;
}> = ({ chapter, intent, windowFrom, windowTo, rate, t, needs }) => {
  const layout = useLayout();
  const pad = layout.u(40);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        border: `${layout.u(3)}px dashed ${APP.hairline}`,
        borderRadius: layout.u(RADIUS.card),
        backgroundColor: APP.card,
        padding: pad,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: layout.u(TYPE.dimension),
          fontWeight: WEIGHT.medium,
          letterSpacing: `${TRACKING.caps}em`,
          textTransform: "uppercase",
          color: SPOT.action,
        }}
      >
        replica slot
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: layout.u(14) }}>
        <div
          style={{
            fontFamily: FONT.sans,
            fontSize: layout.u(TYPE.title),
            fontWeight: WEIGHT.bold,
            letterSpacing: `${TRACKING.display}em`,
            lineHeight: 1.05,
            color: APP.ink,
          }}
        >
          {chapter}
        </div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: layout.u(TYPE.label),
            color: APP.inkMuted,
            lineHeight: 1.55,
            whiteSpace: "pre-line",
          }}
        >
          {[
            t === null ? "t = —" : `t = ${t.toFixed(2)} s`,
            windowFrom === undefined
              ? "window = —"
              : `window = ${windowFrom} → ${windowTo} s`,
            rate === null ? "rate = —" : `rate = ${rate.toFixed(2)}x`,
          ].join("\n")}
        </div>
      </div>

      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: layout.u(TYPE.dimension),
          color: needs ? SPOT.action : APP.inkMuted,
          lineHeight: 1.5,
        }}
      >
        {needs ? `needs: ${needs}` : intent}
      </div>
    </div>
  );
};
