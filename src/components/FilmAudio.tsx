import React, { useMemo } from "react";
import { Audio, Sequence, staticFile } from "remotion";

import { MASTER_TRIM_DB, bedFor, duckGainAt, duckWindows, sfx, type Cue } from "../audio";
import { cuesFor } from "../cues";
import type { CutId } from "../layout";
import { FPS, secToFrame } from "../timeline";

/**
 * The film's sound: one bed, and every cue the picture earned.
 *
 * ── Core `<Audio>`, not `@remotion/media`'s ────────────────────────────────
 *
 * The latter previewed fine and rendered a silent track — −91 dB across the
 * whole file — in `a11y-loop-promo-video`. There is no reason to find out
 * whether that is fixed on a film with eight masters.
 *
 * ── The bed's length is read, never probed ─────────────────────────────────
 *
 * `music.json` carries the measured duration of the delivered mp3, written once
 * by ffprobe in Node. Probing in `calculateMetadata` would run in Studio AND in
 * every render worker, and a catch-block that substitutes a default there is how
 * `gavigo-ire-video` shipped at placeholder timing with nobody noticing.
 *
 * ── The duck is applied here, not baked in ─────────────────────────────────
 *
 * `audio.ts` says how far the music gives way (−4 dB) and derives the windows
 * from the cue sheet itself, so a duck cannot drift from the thing it is ducking
 * under. A bed that arrives pre-ducked can only be un-ducked by re-cutting it;
 * this one is flat, and the envelope is a function of the frame.
 */
export const FilmAudio: React.FC<{ cut: CutId }> = ({ cut }) => {
  const cues = useMemo(() => cuesFor(cut), [cut]);
  const bed = bedFor(cut);
  const windows = useMemo(() => duckWindows(cues), [cues]);

  const duck = useMemo(() => duckEnvelope(windows), [windows]);

  return (
    <>
      <Audio
        src={staticFile(bed.file)}
        volume={(frame) => duck(frame / FPS) * dbToGain(MASTER_TRIM_DB)}
        // The bed is cut to the cut: `audio:beds` splices a body and an ending
        // to within 0.25 s of the composition, and `verify:audio` checks it.
        loop={false}
      />
      {cues.map((cue, i) => (
        <CueSound key={`${i}-${cue.sfx}-${cue.atSec.toFixed(3)}`} cue={cue} />
      ))}
    </>
  );
};

/**
 * One cue, in its own `<Sequence>`.
 *
 * A `<Sequence from={…}>` rather than a `startFrom` on the `<Audio>`: `startFrom`
 * seeks INTO the file, which is the opposite of what a cue wants. The sequence
 * is one frame longer than the sample so a cue landing on the last frame of a
 * beat still has somewhere to sound.
 */
const CueSound: React.FC<{ cue: Cue }> = ({ cue }) => {
  const meta = sfx(cue.sfx);
  const from = secToFrame(cue.atSec);
  return (
    <Sequence from={from} durationInFrames={secToFrame(meta.durationSec) + 2} layout="none">
      <Audio src={staticFile(meta.file)} volume={dbToGain(cue.gainDb ?? 0)} />
    </Sequence>
  );
};

/** −6 dB is half the amplitude. Anything below −60 is silence. */
export const dbToGain = (db: number): number => {
  if (!Number.isFinite(db)) return 1;
  if (db <= -60) return 0;
  return Math.pow(10, db / 20);
};

/**
 * The music's gain at a film second, given the windows it has to give way under.
 *
 * ⚠ A thin wrapper on purpose. The envelope itself lives in `audio.ts`, because
 * the offline mix that `verify:loudness` measures plays the same one — and a
 * gate that re-implements the thing it checks is a gate that eventually
 * certifies a film nobody rendered.
 */
const duckEnvelope =
  (windows: readonly { fromSec: number; toSec: number }[]) =>
  (sec: number): number =>
    duckGainAt(sec, windows);
