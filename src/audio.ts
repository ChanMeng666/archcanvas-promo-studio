/**
 * The film's audio, as data. **No React and no Remotion in this file** — WP-9
 * mounts the `<Audio>` elements; everything here is types, manifests and pure
 * functions, so `capture/lib/load-core.mjs` can bundle it and a gate can check
 * the cue sheets in Node.
 *
 * Two manifests back it, and both are generated:
 *
 *   `src/data/music.json`  one entry per music TAKE — four beds and their
 *                          measured downbeats — and which one is `active`
 *   `src/data/sfx.json`    fourteen cues, synthesised offline with ffmpeg
 *
 * Neither is hand-edited. `npm run audio:all` rebuilds both from the take in
 * `audio/source/` and the recipes in `tools/synth-sfx.mjs`;
 * `node tools/use-music.mjs <version>` moves `active` without re-cutting.
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

/**
 * Where a set's audio came from, and whether the film may ship it.
 *
 * `commercialUse` is the field that matters and it is decided **at generation
 * time**, not here: ElevenLabs' free plan withholds commercial rights from
 * anything created outside a paid subscription *before or after*, so upgrading
 * later does not license what already exists. `tools/generate-sfx-elevenlabs.mjs`
 * measures the tier before it generates and writes the answer beside the bytes.
 * Nothing downstream re-decides it — `releaseBlockers()` only reads it.
 */
export type SfxProvenance = {
  readonly source: "synth" | "elevenlabs";
  readonly tier: string | null;
  readonly generatedAt: string;
  readonly commercialUse: boolean;
  readonly reconstructed?: string;
};

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
  /** Synth set only — a sha256 of the cue's ffmpeg filter graph. */
  readonly recipeHash?: string;
  /** Vendor sets only. */
  readonly role?: string;
  readonly concept?: string | null;
  readonly peakAtSec?: number;
  /**
   * How to line this cue up with the picture.
   *
   * `"attack"` — `cue.at = action.at - alignOffsetSec`. A transient's audible
   * moment is its first strong onset, which is not necessarily its file start.
   * `"start"`  — `cue.at = action.at`. A texture has no single moment that "is"
   * the sound; `draw-e`'s loudest sample is at 7.0s of a 7.8s file, and
   * attack-aligning that would begin the drawing sound seven seconds early.
   */
  readonly alignBy?: "attack" | "start";
  readonly alignOffsetSec?: number;
  readonly centroidHz?: number;
  readonly provenance?: SfxProvenance;
};

export type SfxSet = {
  readonly generator: string;
  readonly provenance: SfxProvenance;
  /** Canonical film cue id -> this set's own cue id. */
  readonly aliases: Readonly<Record<string, string>>;
  readonly cues: readonly SfxCue[];
};

type SfxDoc = { readonly active: string; readonly sets: Readonly<Record<string, SfxSet>> };
const sfxDoc = sfxJson as unknown as SfxDoc;

export const SFX_SET_IDS: readonly string[] = Object.keys(sfxDoc.sets);

/**
 * The set the film is cut with. **One switch**, in `src/data/sfx.json`, exactly
 * as the music has one `active` — so there is no second place the film could
 * decide which palette it is using. Change it with `node tools/use-sfx.mjs`.
 */
export const activeSfxSetId = (): string => sfxDoc.active;
export const sfxSet = (id: string = sfxDoc.active): SfxSet => {
  const set = sfxDoc.sets[id];
  if (!set) throw new Error(`unknown sfx set "${id}" — known sets: ${SFX_SET_IDS.join(", ")}`);
  return set;
};

const byIdFor = (setId: string) => new Map(sfxSet(setId).cues.map((c) => [c.id, c]));

/**
 * Look up a cue by its CANONICAL id, resolved through the active set's aliases.
 *
 * The alias hop is what lets a vendor set reduce fourteen cues to six roles
 * without `src/cues.ts` knowing: the film asks for `pencil-line` and gets
 * whichever file this set nominates for it.
 *
 * Throws on an unknown id rather than returning undefined. A missing cue is a
 * silent hole in the master — `staticFile` on a path that does not exist fails
 * SOFTLY in Remotion, so you get a blank region rather than an error, and the
 * only good time to find out is now.
 */
export const sfx = (id: SfxId, setId: string = sfxDoc.active): SfxCue => {
  const set = sfxSet(setId);
  const resolved = set.aliases[id] ?? id;
  const cue = byIdFor(setId).get(resolved);
  if (!cue) {
    throw new Error(
      `sfx "${id}" resolves to "${resolved}" in set "${setId}", which has no such cue — ` +
      `rebuild with \`npm run audio:sfx\` or fix the aliases in audio/sfx-sets/prompts.json`,
    );
  }
  return cue;
};

/** The public path a `staticFile` call takes. */
export const sfxFile = (id: SfxId, setId: string = sfxDoc.active): string => sfx(id, setId).file;

export const allSfx = (setId: string = sfxDoc.active): readonly SfxCue[] => sfxSet(setId).cues;

/**
 * Everything standing between the current configuration and a releasable
 * master. Empty means the film may be rendered into `out/masters/`.
 *
 * `capture/verify-release.mjs` is the gate; this function is the rule, so the
 * gate cannot drift from what the film actually reads.
 */
export const releaseBlockers = (setId: string = sfxDoc.active): readonly string[] => {
  const problems: string[] = [];
  const set = sfxSet(setId);
  if (!set.provenance.commercialUse) {
    problems.push(
      `sfx set "${setId}" is not licensed for commercial use ` +
      `(source ${set.provenance.source}, tier ${set.provenance.tier ?? "n/a"}) — it is an audition set`,
    );
  }
  for (const cue of set.cues) {
    if (cue.provenance && !cue.provenance.commercialUse) {
      problems.push(`sfx "${cue.id}" in set "${setId}" carries commercialUse: false (tier ${cue.provenance.tier ?? "n/a"})`);
    }
  }
  return problems;
};

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

/**
 * `music.json` holds EVERY take the film has been cut to, and names one.
 *
 * The film's edit is snapped to the music — `timeline.ts` pulls every scene
 * boundary onto the nearest downbeat of the cut's own bed — so a master is the
 * picture and the take together. A second take is therefore a second set of
 * masters, and keeping both means the first one has to stay renderable: its
 * beds stay on disk under `public/audio/beds/<version>/` and its measured
 * downbeats stay in this document.
 *
 * `active` is the switch, and it is deliberately the ONLY one. Every gate,
 * every still and every render reads the film through this module, so there is
 * no second place a version could be selected and disagree. `render.ps1` reads
 * the same field and refuses to write a master into a folder that does not
 * match it, which is what stops a master being filed under the wrong music.
 *
 * Move it with `node tools/use-music.mjs <version>`. See `docs/release.md`.
 */
export type MusicDoc = {
  readonly active: string;
  readonly versions: Readonly<Record<string, Music>>;
};

const doc = musicJson as unknown as MusicDoc;

/** Which take the film is currently cut to. */
export const MUSIC_VERSION: string = doc.active;

export const musicVersions = (): readonly string[] => Object.keys(doc.versions ?? {});

/**
 * The active version's measurements.
 *
 * An unknown `active` degrades to an empty record rather than throwing: a module
 * that throws on import takes the Remotion studio down with it, and a bad
 * manifest should redden a gate, not the editor. `audioProblems()` reports it.
 */
export const music: Music =
  doc.versions?.[doc.active] ??
  ({ track: "", bpm: 0, barSec: 0, beatSec: 0, beds: {} } as unknown as Music);

/**
 * One version's measurements, by name. `undefined` for a name that is not in
 * the manifest.
 *
 * Exported so `verify:loudness` can measure EVERY take on disk rather than only
 * the one the film is cut to — a second SUNO track lands as a new version, and
 * a gate that only ever looks at `active` would certify it the day it became
 * active and not before.
 */
export const musicFor = (version: string): Music | undefined => doc.versions?.[version];

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
  /** The fewest cues a window must hold before it counts as a dense passage. */
  readonly minCues: number;
  /** And how many per second, so a slow trickle of cues is not a "passage". */
  readonly minCuesPerSec: number;
};

/**
 * ⚠ The density thresholds are the fix for a measured defect, not a taste.
 *
 * Every run of cues used to duck, and the eight rendered masters came back at
 * **-17.3 to -17.9 LUFS** against a -16 target: the windows covered 36-59 % of
 * the runtime before the attack and release tails, 51-74 % with them. A duck
 * that is on for two thirds of a film is not a duck, it is a trim — the bed is
 * quiet throughout and nothing is emphasised by it.
 *
 * At four cues and four per second only the genuinely dense passages qualify,
 * which in this film means the typing runs. Coverage falls to 11-20 %. An
 * isolated pin drop or a single tick no longer pulls the music down for a third
 * of a second, which is also the right answer musically: those cues are meant to
 * be felt over the bed, not to clear a space in it.
 */
export const DUCK: DuckSpec = {
  amountDb: -4,
  attackSec: 0.08,
  releaseSec: 0.35,
  holdSec: 0.25,
  minCues: 4,
  minCuesPerSec: 4,
};

/**
 * A master trim on the whole mix, in dB.
 *
 * Nothing mysterious: the bed is delivered at -15.9 LUFS, the duck takes some
 * of that away wherever it is on, and the masters landed 1.3-1.9 LU under the
 * -16 target. This is what closes the gap, measured offline from the same cue
 * sheet the film plays (`capture/verify-loudness.mjs`) rather than guessed.
 *
 * It applies to the BED, not to the effects: the effects are already placed
 * against the bed by ear-free arithmetic in `sfx.json`, and moving both would
 * leave their balance where it was while making the keys louder in absolute
 * terms than anything in the film needs them to be.
 *
 * ⚠ **It measures zero, and that is the finding.** The gap was not a missing
 * gain, it was the duck being on for two thirds of the film; with the duck
 * selective the four cuts land at -15.7 / -16.3 / -16.3 / -16.3 LUFS, all inside
 * -16 ± 0.5, with nothing added. The knob stays because the next track will not
 * necessarily be delivered at the same loudness as this one — and because a zero
 * that was measured is worth more than a number that was not needed.
 */
export const MASTER_TRIM_DB = 0;

/**
 * The windows the music should duck under, derived from a cue sheet rather than
 * typed: any run of cues closer together than `holdSec` becomes one window.
 * Returned in film-time seconds.
 */
export const duckWindows = (cues: CueSheet, spec: DuckSpec = DUCK): readonly { fromSec: number; toSec: number }[] => {
  if (cues.length === 0) return [];
  const sorted = cues.slice().sort((a, b) => a.atSec - b.atSec);
  const windows: { fromSec: number; toSec: number; cues: number }[] = [];
  for (const cue of sorted) {
    const end = cue.atSec + sfx(cue.sfx).durationSec + spec.holdSec;
    const last = windows[windows.length - 1];
    if (last && cue.atSec <= last.toSec) {
      last.toSec = Math.max(last.toSec, end);
      last.cues += 1;
    } else {
      windows.push({ fromSec: cue.atSec, toSec: end, cues: 1 });
    }
  }
  // Only the DENSE ones duck. See `DUCK`.
  return windows
    .filter((w) => w.cues >= spec.minCues && w.cues / Math.max(spec.holdSec, w.toSec - w.fromSec) >= spec.minCuesPerSec)
    .map((w) => ({ fromSec: w.fromSec, toSec: w.toSec }));
};

/**
 * The music's gain at one second, 1 (open) down to the duck's floor.
 *
 * Here rather than in `FilmAudio.tsx` because two things play the same envelope
 * and they must not disagree: the component, and the offline mix that
 * `verify:loudness` measures. A gate that re-implements the thing it is checking
 * is a gate that eventually certifies a film nobody rendered.
 */
export const duckGainAt = (
  sec: number,
  windows: readonly { fromSec: number; toSec: number }[],
  spec: DuckSpec = DUCK,
): number => {
  const floor = Math.pow(10, spec.amountDb / 20);
  let deepest = 1;
  for (const w of windows) {
    if (sec < w.fromSec - spec.attackSec || sec > w.toSec + spec.releaseSec) continue;
    const inP = Math.min(1, Math.max(0, (sec - (w.fromSec - spec.attackSec)) / spec.attackSec));
    const outP = Math.min(1, Math.max(0, (w.toSec + spec.releaseSec - sec) / spec.releaseSec));
    deepest = Math.min(deepest, 1 - (1 - floor) * Math.min(inP, outP));
  }
  return deepest;
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
  const active = sfxSet();
  for (const id of SFX_IDS) {
    let cue: SfxCue | null = null;
    try { cue = sfx(id); } catch (err) { problems.push(String((err as Error).message)); continue; }
    if (cue.durationSec > 1.2) problems.push(`sfx "${id}" is ${cue.durationSec}s — the budget is 1.2s`);
    if (cue.peakDb > -3 + 0.05) problems.push(`sfx "${id}" peaks at ${cue.peakDb} dBFS — the ceiling is -3`);
    if (Math.abs(cue.dcOffset) > 0.001) problems.push(`sfx "${id}" has a DC offset of ${cue.dcOffset}`);
  }
  /*
   * A vendor set legitimately carries cues the film has no canonical id for —
   * five competing `draw` concepts, a fourth typing variant — so an unmapped
   * cue is only a problem in the set that IS the canonical vocabulary.
   */
  const mapped = new Set(Object.values(active.aliases));
  for (const row of active.cues) {
    if (active.provenance.source === "synth" && !(SFX_IDS as readonly string[]).includes(row.id)) {
      problems.push(`the synth set has "${row.id}", which SFX_IDS does not list`);
    }
    if (active.provenance.source !== "synth" && !mapped.has(row.id) && !(SFX_IDS as readonly string[]).includes(row.id)) {
      // Not fatal, and not reported: an audition set is meant to hold extras.
    }
  }
  if (!doc.versions?.[doc.active]) {
    problems.push(
      `music.json names "${doc.active}" as active, but its versions are ${musicVersions().join(", ") || "(none)"} — ` +
      "run `node tools/use-music.mjs` to see what is built",
    );
    return problems;
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
