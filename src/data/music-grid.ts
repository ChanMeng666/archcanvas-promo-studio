/**
 * The seam where the music's beat grid reaches the timeline.
 *
 * `tools/analyze-music.mjs` (WP-8) writes `src/data/music.json`. That file does
 * not exist yet, and a static `import ... from "./music.json"` of a file that is
 * not there is a build failure, not a graceful absence — so the grid arrives
 * through this one-line module instead. Today it is `null`, which means
 * `resolveCut` does not snap and the boundaries stay exactly as `cuts.ts`
 * declares them.
 *
 * **WP-8 / WP-9: when `music.json` lands, replace the constant below with**
 *
 * ```ts
 * import grid from "./music.json";
 * export const BEAT_GRID: BeatGrid | null = grid;
 * ```
 *
 * and nothing else changes: `resolveCut` pulls every interior boundary onto the
 * nearest downbeat within ±150 ms, refuses any snap that would starve a beat,
 * and the last beat still absorbs the remainder — so the cut length is exact
 * either way. `verify:timeline` prints how many boundaries moved.
 *
 * **Do not hand-write downbeats here.** A table typed by a human is a table that
 * stops describing the audio the first time the bed is re-cut, with nothing
 * going red. The grid is derived from the file or it is null.
 */

import type { BeatGrid } from "../timeline";

export const BEAT_GRID: BeatGrid | null = null;
