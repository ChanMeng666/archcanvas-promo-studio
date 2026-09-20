import React, { useMemo } from "react";
import { Audio, Sequence, staticFile } from "remotion";

import {
  MASTER_TRIM_DB,
  bedFor,
  cueGainAt,
  duckEvents,
  duckGainAt,
  resolveCue,
  type Cue,
  type DuckEvent,
} from "../audio";
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
 * `src/data/sfx-roles.json` says how far the music gives way under each kind of
 * gesture — −2.5 dB under typing, −5 under the end card, nothing under the
 * drawing bed — and `audio.ts` derives the events from the cue sheet itself, so
 * a duck cannot drift from the thing it is ducking under. Overlapping claims
 * take the DEEPEST, never the sum. A bed that arrives pre-ducked can only be
 * un-ducked by re-cutting it; this one is flat, and the envelope is a function
 * of the frame.
 */
export const FilmAudio: React.FC<{ cut: CutId }> = ({ cut }) => {
  const cues = useMemo(() => cuesFor(cut), [cut]);
  const bed = bedFor(cut);
  const events = useMemo(() => duckEvents(cues), [cues]);

  const duck = useMemo(() => duckEnvelope(events), [events]);

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
        <CueSound key={`${i}-${cue.role}-${cue.intent ?? ""}-${cue.atSec.toFixed(3)}`} cue={cue} />
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
 *
 * ── Three things `audio.ts` decides and this only obeys ────────────────────
 *
 * **Which file and how loud** — the role, the active sound set and the music
 * take, resolved once in `resolveCue` so the component, the offline mix and the
 * gates cannot disagree about a level.
 *
 * **Where the file starts** — `startSec`, which is the action's second minus
 * the cue's measured first strong onset. Scheduling `cue.atSec` raw, which is
 * what this did before, put the ElevenLabs typing clusters 157 ms behind the
 * characters they were for.
 *
 * **How long it sounds, and its fades** — `playSec` trims the sequence, so a
 * 7.69 s drawing texture under a 3.74 s beat stops with the beat instead of
 * playing over the next one, and the equal-power fades are what make a looped
 * texture one texture.
 */
const CueSound: React.FC<{ cue: Cue }> = ({ cue }) => {
  const rc = resolveCue(cue);
  const from = secToFrame(rc.startSec);
  return (
    <Sequence from={from} durationInFrames={secToFrame(rc.playSec) + 2} layout="none">
      <Audio
        src={staticFile(rc.file)}
        volume={
          rc.fadeInSec > 0 || rc.fadeOutSec > 0
            ? (frame) => cueGainAt(rc, frame / FPS)
            : dbToGain(rc.gainDb)
        }
      />
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
  (events: readonly DuckEvent[]) =>
  (sec: number): number =>
    duckGainAt(sec, events);
