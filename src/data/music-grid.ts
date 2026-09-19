/**
 * The seam where the music's beat grid reaches the timeline.
 *
 * `tools/analyze-music.mjs` (WP-8) measured the downbeats ON THE DELIVERED MP3 —
 * not on the source take and not from the tempo, because the take's beat phase
 * drifts about 0.2 s per 20 s and the beds are spliced, so an extrapolated grid
 * would be most of a beat out by the end of the 120 s cut. Each cut has its own
 * bed and therefore its own grid.
 *
 * `resolveCut` pulls every interior boundary onto the nearest bar within
 * ±150 ms, refuses any snap that would starve a beat, and lets the last beat
 * absorb the remainder — so the composition length is identical either way.
 * `verify:timeline` prints how many boundaries moved.
 *
 * **Do not hand-write downbeats here.** A table typed by a human is a table that
 * stops describing the audio the first time the bed is re-cut, with nothing
 * going red. The grid is derived from the file, or it is null.
 *
 * ── Why this is imported rather than passed in ─────────────────────────────
 *
 * The scaffold passed the grid into `resolveCut` from `Film.tsx` and left
 * `TIMELINES` — which every gate, the cue sheet and `beatAtFrame` read —
 * un-snapped. That is two clocks: the picture would have cut on the bar and the
 * sound sheet would have been derived against boundaries a frame or two away
 * from where the picture actually cut. One clock, and it is this one.
 */

import { music } from "../audio";
import type { CutId } from "../layout-core";
import type { BeatGrid } from "../timeline";

/*
 * Read through `src/audio.ts`, not out of the JSON directly. The document now
 * holds one entry per music take and names the active one, and resolving that
 * here as well would be a second place the film could decide which take it is
 * cut to — which is exactly the two-clocks failure the note below records,
 * wearing a different hat.
 */
const beds = music.beds as Record<string, { offsetSec: number; downbeats: readonly number[] }>;

/** The bar grid for a cut's own bed, or null if it has none. */
export const gridFor = (cut: CutId): BeatGrid | null => {
  const bed = beds[cut];
  if (!bed || !Array.isArray(bed.downbeats) || bed.downbeats.length === 0) return null;
  return { bpm: music.bpm, offsetSec: bed.offsetSec, downbeats: [...bed.downbeats] };
};
