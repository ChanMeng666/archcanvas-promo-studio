import React, { useMemo } from "react";
import { AbsoluteFill, Sequence } from "remotion";

import { FilmAudio } from "./components/FilmAudio";
import { HonestyCaption } from "./components/HonestyCaption";
import { SceneRouter } from "./components/SceneRouter";
import { useLayout, type CutId } from "./layout";
import { SCENES } from "./scenes";
import { honestyWindow, timelineFor } from "./timeline";
import { APP } from "./tokens";

import "./replica/replica.css";

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
 * ── Four things this component owns, and nothing else ──────────────────────
 *
 * **The ground.** Ivory paper under every beat, so a card cutting to a replica
 * shot never flashes a different background for a frame. `verify:flash` runs on
 * all eight masters because cutting between a full-bleed card and a bright
 * drawing is exactly what can strobe.
 *
 * **The stylesheet.** `replica.css` is imported HERE, once, rather than in the
 * component that uses it: a stylesheet import is a side effect, and putting it
 * next to the film's root is the difference between "the styles are loaded" and
 * "the styles are loaded if that component happened to be reached".
 *
 * **The sound.** The bed and every derived cue, above the picture in the tree
 * and outside every `<Sequence>` — a cue's own sequence is created by
 * `FilmAudio`, in film time, from the same resolved edit the picture uses.
 *
 * **The honesty caption.** Derived, not placed: `honestyWindowFor` says how long
 * the replica's own caption survives this cut's time warp and who has to draw
 * it. Where the warp leaves it under the three-second floor, the film overlays
 * the identical sentence for the whole window — ABOVE the sequences, so it
 * cannot be cut off by a beat boundary landing inside it, and outside the
 * camera, so no push can crop it.
 *
 * ── One clock ──────────────────────────────────────────────────────────────
 *
 * `timelineFor(cut, aspect)`, not a fresh `resolveCut`. The scaffold resolved
 * here with the beat grid while `TIMELINES` — which the cue sheets, `beatAtFrame`
 * and every gate read — was resolved without it. Both now come from the one
 * derivation, and the grid is applied inside it.
 *
 * It takes the ASPECT because one thing genuinely differs between the two frame
 * shapes: which beats frame past the product's own honesty caption, and
 * therefore where the film's own band runs. Lengths and boundaries are
 * identical, and `verify:timeline` asserts that.
 */
export const Film: React.FC<{ cut: CutId }> = ({ cut }) => {
  const layout = useLayout();
  const resolved = timelineFor(cut, layout.aspect);
  const honesty = useMemo(() => honestyWindow(cut, layout.aspect), [cut, layout.aspect]);

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
        <HonestyCaption from={honesty.from} to={honesty.to} hardIn={honesty.hardIn} />
      ) : null}

      <FilmAudio cut={cut} />
    </AbsoluteFill>
  );
};
