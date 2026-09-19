/**
 * The film's audio, as data. **No React and no Remotion in this file** — WP-9
 * mounts the `<Audio>` elements; everything here is types, manifests and pure
 * functions, so `capture/lib/load-core.mjs` can bundle it and a gate can check
 * the cue sheets in Node.
 *
 * Two manifests back it, and both are generated:
 *
 *   `src/data/music.json`  four beds, and where their downbeats are
 *   `src/data/sfx.json`    fourteen cues, synthesised offline with ffmpeg
 *
 * Neither is hand-edited. `npm run audio:all` rebuilds both from the take in
 * `audio/source/` and the recipes in `tools/synth-sfx.mjs`.
 *
 * ── Two things worth knowing before you use this ────────────────────────────
 *
 * **No sound effect here came from a vendor.** All fourteen are synthesised by
 * `tools/synth-sfx.mjs` from ffmpeg primitives. That is a licensing decision
 * with evidence behind it, not an aesthetic one — `docs/audio-provenance.md`
 * and `docs/decisions.md` D4.
 *
 * **The downbeats are measured on the delivered mp3, not computed.** The take's
 * beat phase drifts about 0.2 s per 20 s, and the beds are spliced, so an
 * extrapolated grid would be most of a beat out by the end of the 120s cut.
 * `downbeatsFor()` returns real positions in the file the film plays.
 */

import musicJson from "./data/music.json";
import sfxJson from "./data/sfx.json";
import { CUT_IDS, type CutId } from "./layout-core";

/* ── sound effects ──────────────────────────────────────────────────────────── */

export const SFX_IDS = [
  "key-1", "key-2", "key-3",
  "click",
  "whoosh-in", "whoosh-out",
  "pencil-line",
  "paper-settle",
  "tick",
  "pin-drop",
  "pop",
  "stamp",
  "shimmer",
  "end-hit",
] as const;

export type SfxId = (typeof SFX_IDS)[number];

export type SfxCue = {
  readonly id: string;
  readonly file: string;
  readonly desc: string;
  readonly durationSec: number;
  readonly peakDb: number;
  readonly rmsDb: number;
  readonly dcOffset: number;
  readonly sampleRate: number;
  readonly channels: number;
  readonly bytes: number;
  readonly recipeHash: string;
};

const SFX_BY_ID = new Map<string, SfxCue>((sfxJson.cues as SfxCue[]).map((c) => [c.id, c]));

/**
 * Look up a cue. Throws on an unknown id rather than returning undefined: a
 * missing cue is a silent hole in the master, and `staticFile` on a path that
 * does not exist fails SOFTLY in Remotion — you get a blank, not an error. The
 * only good time to find out is now.
 */
export const sfx = (id: SfxId): SfxCue => {
  const cue = SFX_BY_ID.get(id);
  if (!cue) throw new Error(`unknown sfx id "${id}" — rebuild with \`npm run audio:sfx\``);
  return cue;
};

/** The public path a `staticFile` call takes. */
export const sfxFile = (id: SfxId): string => sfx(id).file;

export const allSfx = (): readonly SfxCue[] => sfxJson.cues as SfxCue[];

/* ── music ──────────────────────────────────────────────────────────────────── */

export type Bed = {
  readonly file: string;
  readonly offsetSec: number;
  readonly downbeats: readonly number[];
  readonly barSec: number;
  readonly beatSec: number;
  readonly measuredBarSec: number | null;
  readonly durationSec: number;
  readonly lufs: number;
  readonly truePeakDb: number;
  readonly sourceBodyStartSec: number;
  readonly sourceEndingStartSec: number;
};

export type Music = {
  readonly track: string;
  readonly bpm: number;
  readonly barSec: number;
  readonly beatSec: number;
  readonly beds: Readonly<Record<CutId, Bed>>;
};

export const music = musicJson as unknown as Music;

export const bedFor = (cut: CutId): Bed => {
  const bed = music.beds[cut];
  if (!bed) throw new Error(`no music bed for the ${cut}s cut — run \`npm run audio:beds\``);
  return bed;
};

/** Film-time seconds at which a bar lands, for this cut. */
export const downbeatsFor = (cut: CutId): readonly number[] => bedFor(cut).downbeats;

/**
 * The nearest downbeat to `t`, or `t` itself if none is within `toleranceSec`.
 *
 * WP-7 owns where the cuts are; this only answers where a bar is. The tolerance
 * defaults to 150 ms because beyond that the correction is large enough to be
 * felt as the edit being in the wrong place — at which point the honest answer
 * is to leave the boundary where the edit wanted it and let it fall off the
 * beat, rather than dragging the picture a quarter of a second to chase the
 * music.
 */
export const snapToDownbeat = (cut: CutId, t: number, toleranceSec = 0.15): number => {
  let best = t;
  let bestDelta = Infinity;
  for (const d of downbeatsFor(cut)) {
    const delta = Math.abs(d - t);
    if (delta < bestDelta) { bestDelta = delta; best = d; }
  }
  return bestDelta <= toleranceSec ? best : t;
};

/* ── cue sheets ─────────────────────────────────────────────────────────────── */

/**
 * One scheduled sound. `atSec` is FILM time — the same clock as `cuts.ts` — so
 * a cue sheet can be read next to an EDL without conversion.
 *
 * `gainDb` is a trim relative to the cue as built. Every cue is normalised to
 * -3 dBFS peak, so the default of 0 already gives a consistent palette; a trim
 * is for when one gesture should sit further back, not for fixing a cue that is
 * too loud in general. Fix that in `tools/synth-sfx.mjs`, where it stays fixed.
 */
export type Cue = {
  readonly atSec: number;
  readonly sfx: SfxId;
  readonly gainDb?: number;
};

export type CueSheet = readonly Cue[];

/**
 * Turn per-character typing timestamps into key cues, cycling the three `key`
 * variants.
 *
 * **The cycling is the whole point.** One key sample fired forty times is a
 * machine gun: the ear locks onto an identical transient repeating at an even
 * interval within about three or four hits, and what should read as someone
 * typing reads as a sound effect looping. Three variants is enough to break it.
 *
 * The replica core exposes deterministic per-character typing times; this
 * deliberately does NOT import it and takes the array instead, so the audio
 * layer has no dependency on the synced replica and this stays testable with a
 * literal.
 *
 * `everyNth` exists because a cue per character is usually too dense to read as
 * typing at all — at the replica's typing speed, every second or third
 * character is closer to how a keyboard actually sounds under music. Spaces and
 * other characters are the caller's business: pass the timestamps you want
 * heard.
 */
export const typingCues = (
  charTimesSec: readonly number[],
  { everyNth = 2, gainDb = -6 }: { everyNth?: number; gainDb?: number } = {},
): CueSheet => {
  const keys: SfxId[] = ["key-1", "key-2", "key-3"];
  const out: Cue[] = [];
  for (let i = 0; i < charTimesSec.length; i += Math.max(1, everyNth)) {
    out.push({ atSec: charTimesSec[i], sfx: keys[out.length % keys.length], gainDb });
  }
  return out;
};

/** Merge cue sheets and put them in playing order. */
export const mergeCues = (...sheets: readonly CueSheet[]): CueSheet =>
  sheets.flat().slice().sort((a, b) => a.atSec - b.atSec);

/* ── ducking ────────────────────────────────────────────────────────────────── */

/**
 * How far to pull the music down under a dense passage of effects, as DATA.
 *
 * Declarative for the same reason the sibling film's duck was: a duck that is
 * hand-placed in the bed cannot be moved once the picture changes, and a bed
 * that arrives pre-ducked can only be un-ducked by re-cutting it. The bed
 * `prepare-bed.ps1` delivers is flat; WP-9 applies this at mount time from
 * wherever the cues actually are.
 *
 * -4 dB is chosen to be heard as space rather than as an effect: past about
 * 6 dB on a bed this dense the movement itself becomes audible, and audible
 * pumping is on the exclude list in `docs/suno-prompt.md`.
 */
export type DuckSpec = {
  readonly amountDb: number;
  readonly attackSec: number;
  readonly releaseSec: number;
  readonly holdSec: number;
};

export const DUCK: DuckSpec = {
  amountDb: -4,
  attackSec: 0.08,
  releaseSec: 0.35,
  holdSec: 0.25,
};

/**
 * The windows the music should duck under, derived from a cue sheet rather than
 * typed: any run of cues closer together than `holdSec` becomes one window.
 * Returned in film-time seconds.
 */
export const duckWindows = (cues: CueSheet, spec: DuckSpec = DUCK): readonly { fromSec: number; toSec: number }[] => {
  if (cues.length === 0) return [];
  const sorted = cues.slice().sort((a, b) => a.atSec - b.atSec);
  const windows: { fromSec: number; toSec: number }[] = [];
  for (const cue of sorted) {
    const end = cue.atSec + sfx(cue.sfx).durationSec + spec.holdSec;
    const last = windows[windows.length - 1];
    if (last && cue.atSec <= last.toSec) last.toSec = Math.max(last.toSec, end);
    else windows.push({ fromSec: cue.atSec, toSec: end });
  }
  return windows;
};

/* ── self-check ─────────────────────────────────────────────────────────────── */

/**
 * Everything a gate should be able to assert about the audio without decoding a
 * file. Exported as a function rather than run at import time — a module that
 * throws on import takes the Remotion studio down with it, and a bad manifest
 * should fail a gate, not the editor.
 */
export const audioProblems = (): readonly string[] => {
  const problems: string[] = [];
  for (const id of SFX_IDS) {
    const cue = SFX_BY_ID.get(id);
    if (!cue) { problems.push(`sfx "${id}" is in SFX_IDS but not in sfx.json`); continue; }
    if (cue.durationSec > 1.2) problems.push(`sfx "${id}" is ${cue.durationSec}s — the budget is 1.2s`);
    if (cue.peakDb > -3 + 0.05) problems.push(`sfx "${id}" peaks at ${cue.peakDb} dBFS — the ceiling is -3`);
    if (Math.abs(cue.dcOffset) > 0.001) problems.push(`sfx "${id}" has a DC offset of ${cue.dcOffset}`);
  }
  for (const row of sfxJson.cues as SfxCue[]) {
    if (!(SFX_IDS as readonly string[]).includes(row.id)) problems.push(`sfx.json has "${row.id}", which SFX_IDS does not list`);
  }
  for (const cut of CUT_IDS) {
    const bed = music.beds[cut];
    if (!bed) { problems.push(`no music bed for the ${cut}s cut`); continue; }
    const target = Number(cut);
    if (bed.durationSec < target) problems.push(`bed-${cut} is ${bed.durationSec}s, shorter than the ${target}s cut`);
    if (bed.durationSec > target + 0.25) problems.push(`bed-${cut} is ${bed.durationSec}s, more than 0.25s over the ${target}s cut`);
    if (bed.truePeakDb > -1.5) problems.push(`bed-${cut} true peak is ${bed.truePeakDb} dBTP — the ceiling is -1.5`);
    if (bed.downbeats.length < 2) problems.push(`bed-${cut} has ${bed.downbeats.length} downbeat(s)`);
    for (let i = 1; i < bed.downbeats.length; i++) {
      if (bed.downbeats[i] <= bed.downbeats[i - 1]) { problems.push(`bed-${cut} downbeats are not strictly increasing at index ${i}`); break; }
    }
    const last = bed.downbeats[bed.downbeats.length - 1];
    if (last > bed.durationSec) problems.push(`bed-${cut} has a downbeat at ${last}s, past its ${bed.durationSec}s end`);
  }
  return problems;
};
