import React, { useMemo } from "react";
import { AbsoluteFill, Sequence } from "remotion";

import { HonestyCaption } from "./components/HonestyCaption";
import { SceneRouter } from "./components/SceneRouter";
import { BEAT_GRID } from "./data/music-grid";
import { useLayout, type CutId } from "./layout";
import { SCENES } from "./scenes";
import { honestyWindowFor, resolveCut } from "./timeline";
import { APP } from "./tokens";

/**
 * The cut, laid out.
 *
 * One `<Sequence>` per beat of the resolved edit, and **not one frame number
 * typed anywhere**: `resolveCut` derives every `from` and every length from the
 * seconds in `cuts.ts`, and `capture/verify-timeline.mjs` greps this file (and
 * every other file but `timeline.ts`) for a frame literal. Two clocks in a film
 * is the state where a cut slips a beat against the music and still looks fine
 * in Studio.
 *
 * ── Three things this component owns, and nothing else ─────────────────────
 *
 * **The ground.** Ivory paper under every beat, so a card cutting to a replica
 * shot never flashes a different background for a frame. `verify:flash` runs on
 * all eight masters because cutting between a full-bleed card and a bright
 * drawing is exactly what can strobe.
 *
 * **The beat grid.** `BEAT_GRID` is `null` until WP-8 lands `music.json`; with
 * one, `resolveCut` pulls the interior boundaries onto the nearest downbeat
 * within ±150 ms and the last beat absorbs the remainder, so the composition
 * length is identical either way.
 *
 * **The honesty caption.** Derived, not placed: `honestyWindowFor` says how long
 * the replica's own caption survives this cut's time warp and who has to draw
 * it. Where the warp leaves it under the three-second floor, the film overlays
 * the identical sentence for the whole window — ABOVE the sequences, so it
 * cannot be cut off by a beat boundary landing inside it.
 */
export const Film: React.FC<{ cut: CutId }> = ({ cut }) => {
  const layout = useLayout();
  const resolved = useMemo(() => resolveCut(cut, BEAT_GRID), [cut]);
  const honesty = useMemo(() => honestyWindowFor(resolved), [resolved]);

  return (
    <AbsoluteFill style={{ backgroundColor: APP.page, width: layout.width, height: layout.height }}>
      {resolved.beats.map((beat) => (
        <Sequence
          key={`${beat.index}-${beat.scene}`}
          name={`${beat.index} ${beat.scene}${SCENES[beat.scene].needs ? " (needs)" : ""}`}
          from={beat.startFrame}
          durationInFrames={beat.durationInFrames}
          layout="none"
        >
          <SceneRouter beat={beat} />
        </Sequence>
      ))}

      {honesty.source === "film" ? (
        <HonestyCaption from={honesty.from} to={honesty.to} />
      ) : null}
    </AbsoluteFill>
  );
};
