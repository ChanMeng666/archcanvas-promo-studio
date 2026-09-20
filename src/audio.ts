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
import { MUSIC_ID, SFX_SET } from "./version";
import sfxJson from "./data/sfx.json";
import rolesJson from "./data/sfx-roles.json";
import versionsJson from "./data/versions.json";
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
/**
 * ⚠ The VERSION's set, not the manifest's `active`.
 *
 * One selector. `FILM_VERSION` picks a version and the music, the edit and the
 * sound palette all follow from `versions.json`; `sfx-sets`' own `active` is the
 * default for a version that does not name one, which is none of them today.
 */
export const activeSfxSetId = (): string => (sfxDoc.sets[SFX_SET] ? SFX_SET : sfxDoc.active);
export const sfxSet = (id: string = activeSfxSetId()): SfxSet => {
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
export const sfx = (id: SfxId, setId: string = activeSfxSetId()): SfxCue => {
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
export const sfxFile = (id: SfxId, setId: string = activeSfxSetId()): string => sfx(id, setId).file;

export const allSfx = (setId: string = activeSfxSetId()): readonly SfxCue[] => sfxSet(setId).cues;

/**
 * Everything standing between the current configuration and a releasable
 * master. Empty means the film may be rendered into `out/masters/`.
 *
 * `capture/verify-release.mjs` is the gate; this function is the rule, so the
 * gate cannot drift from what the film actually reads.
 */
/*
 * ⚠ The default here is `activeSfxSetId()`, NOT `sfxDoc.active`, and the
 * difference was a live quarantine bypass.
 *
 * When the version model landed, `activeSfxSetId()` became version-aware
 * (FILM_VERSION -> the version's sfxSet) while every default parameter in this
 * file still read the legacy `sfxDoc.active` field. So under
 * FILM_VERSION=B-daylight-forward+el the gate PRINTED
 * "elevenlabs-audition ... commercialUse false" from `activeSfxSetId()` and
 * then checked `synth` and passed — reporting green on the exact configuration
 * it exists to refuse, with the contradiction visible one line above the tick.
 *
 * Any accessor that answers "what is the film playing?" must go through one
 * function. `sfxDoc.active` is now only the fallback INSIDE that function, for
 * when FILM_VERSION names no set.
 */
export const releaseBlockers = (setId: string = activeSfxSetId()): readonly string[] => {
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

/* ── roles: WHAT plays and HOW LOUD ─────────────────────────────────────────── */

/**
 * The role layer, and the division of labour it encodes.
 *
 * The cue sheet owns **WHEN** — which frame a click belongs on. This owns
 * **WHAT** plays there and **HOW LOUD**. Keeping them apart is what lets the
 * sound design be re-chosen without touching the edit, and the edit be recut
 * without re-deciding every gain.
 *
 * `src/data/sfx-roles.json` is hand-written from measurements and every number
 * in it has a reason in `docs/decisions.md` D12.
 */

export type RoleDuck = { readonly attack: number; readonly hold: number; readonly release: number };

/** A looped role's seam. `draw` is the only one that loops. */
export type RoleLoop = { readonly crossfadeSec: number };

/** The `draw` role's punctuation: one light hit on each band's downbeat. */
export type RoleBandTick = {
  readonly file: string;
  readonly gainDb: number;
  readonly anchor: "start" | "attack";
  readonly duckDb: number;
};

/**
 * The half of a role that can differ between sound sets.
 *
 * ⚠ Which FILES and at what LEVEL, and nothing else. The duck, the budget and
 * the suppression rules stay on the role, because how far the music gives way
 * under a gesture is a property of the gesture rather than of the library the
 * sound was bought from.
 */
export type RoleView = {
  readonly files: readonly string[];
  readonly byIntent?: Readonly<Record<string, string>>;
  readonly anchor: "start" | "attack";
  readonly gainDb: number;
  /**
   * Per music take: a level, an EQ recipe, and the file that recipe was BAKED
   * into.
   *
   * ⚠ `eq` alone never reached the film. Remotion's `<Audio>` takes a gain and
   * nothing else, so for as long as the EQ was only a string the one thing that
   * ever played it was `tools/mix-preview.mjs`. Measured on version B's 30 s
   * draw window, the unshelved texture sat 0.4–3.7 dB OVER the music at 6.3, 8
   * and 10 kHz — the bands the hats and shaker live in, on the money shot, and
   * the reason the drawing role is not ducked at all is that its space was
   * supposed to be carved here. `tools/bake-eq.mjs` renders the recipe into
   * `file` and this plays that. The recipe stays as the record of how.
   */
  readonly perMusic?: Readonly<Record<string, { gainDb?: number; eq?: string; file?: string }>>;
  readonly perFile?: Readonly<Record<string, { gainDb?: number; anchor?: "start" | "attack"; duckDb?: number }>>;
  readonly loop?: RoleLoop;
  readonly bandTick?: RoleBandTick;
  readonly fadeOutSec?: number;
  /**
   * How close two cues of this role may sit, as a musical preference.
   *
   * Per set, because it is a property of the MATERIAL: 1.3 s is right for a
   * 1.4–1.9 s typing cluster and absurd for a 70 ms single press.
   */
  readonly minGapSec?: number;
};

export type SfxRole = RoleView & {
  readonly desc: string;
  readonly rotate?: boolean;
  readonly duckDb: number;
  readonly duck: RoleDuck | null;
  readonly suppressIfNearBedFinalHitSec?: number;
  /** How many keystrokes each typing cluster stands in for. */
  readonly coversKeystrokes?: Readonly<Record<string, number>>;
  /** Field-by-field overrides for one sound set. See `$perSetNote`. */
  readonly perSet?: Readonly<Record<string, Partial<RoleView>>>;
};

type RolesDoc = {
  readonly roles: Readonly<Record<string, SfxRole>>;
  readonly $measured: {
    readonly bedFinalHitSec: Readonly<Record<string, Readonly<Record<string, number>>>>;
  };
};
const rolesDoc = rolesJson as unknown as RolesDoc;

/**
 * How long a cue in each role may be. `null` = no limit.
 *
 * `draw` is a bed that loops to cover an arbitrary beat, so a length limit on
 * it is meaningless. `type` is a cluster of several keystrokes. Everything else
 * is a one-shot that should not outlast its gesture.
 */
const ROLE_BUDGET_SEC: Readonly<Record<string, number | null>> = {
  draw: null,
  type: 2.5,
  click: 1.2,
  move: 1.5,
  appear: 3.0,
  end: 3.5,
};

export const ROLE_IDS: readonly string[] = Object.keys(rolesDoc.roles);
export type RoleId = string;

export const role = (id: RoleId): SfxRole => {
  const r = rolesDoc.roles[id];
  if (!r) throw new Error(`unknown sfx role "${id}" — known: ${ROLE_IDS.join(", ")}`);
  return r;
};

/**
 * A role as ONE sound set sees it.
 *
 * Field by field, not all-or-nothing: `perSet.synth` names that set's own files
 * and its own levels, and an all-or-nothing override would have meant restating
 * a whole role to change two filenames — a restated block is a block that
 * drifts.
 *
 * ⚠ **But the material-calibrated fields do not fall through**, and that is not
 * tidiness. A `perSet` block exists precisely because this set's material is
 * different, so a number measured against the other set's material is wrong
 * here by construction — and wrong silently, which is the expensive kind. Both
 * halves of that were live bugs within minutes of this function existing:
 *
 *   - `perMusic` fell through, so version A's **synthesised** 0.65 s stroke
 *     inherited the −14 dB that was measured for a 7.69 s ElevenLabs texture
 *     under A's darker bed. Five decibels quieter than the approved master, on
 *     the money shot, with every gate green.
 *   - `minGapSec` fell through, so the 1.3 s floor written for 1.4–1.9 s typing
 *     CLUSTERS was applied to 70 ms single presses, and the 15 s cut's typing
 *     went from twelve key cues to **one**.
 *
 * So `perMusic`, `perFile`, `loop`, `bandTick` and `minGapSec` come from the
 * block or from nowhere. `anchor` and `fadeOutSec` still fall through: how a
 * sound is lined up with a gesture, and that a texture is faded out rather than
 * cut, are properties of the role.
 */
export const roleView = (id: RoleId, setId: string = activeSfxSetId()): RoleView => {
  const r = role(id);
  const o = r.perSet?.[setId];
  const scoped = o !== undefined;
  return {
    files: o?.files ?? r.files,
    byIntent: o?.byIntent ?? r.byIntent,
    anchor: o?.anchor ?? r.anchor,
    gainDb: o?.gainDb ?? r.gainDb,
    perMusic: scoped ? o.perMusic : r.perMusic,
    perFile: scoped ? o.perFile : r.perFile,
    loop: scoped ? o.loop : r.loop,
    bandTick: scoped ? o.bandTick : r.bandTick,
    minGapSec: scoped ? o.minGapSec : r.minGapSec,
    fadeOutSec: o?.fadeOutSec ?? r.fadeOutSec,
  };
};

/** Which role owns a file, in a given set. `null` when nothing claims it. */
const roleOfFile = (fileId: string, setId: string): RoleId | null => {
  for (const rid of ROLE_IDS) {
    const v = roleView(rid, setId);
    if (v.files.includes(fileId)) return rid;
    if (Object.values(v.byIntent ?? {}).includes(fileId)) return rid;
    if (v.bandTick?.file === fileId) return rid;
  }
  return null;
};

/** The budget for whichever role currently maps to this canonical cue id. */
export const roleBudgetSec = (canonicalId: string): number | null => {
  const setId = activeSfxSetId();
  const mapped = sfxSet(setId).aliases?.[canonicalId] ?? canonicalId;
  const rid = roleOfFile(mapped, setId);
  if (rid === null) return 1.2;
  // `in`, not `??`. `draw`'s budget is an explicit `null` meaning "no limit",
  // and `??` treats null as absent — so the nullish default silently reimposed
  // 1.2 s on the one role that must not have one, and the gate went on failing
  // the drawing bed for being 7.7 s long.
  return rid in ROLE_BUDGET_SEC ? ROLE_BUDGET_SEC[rid] : 1.2;
};

/** The `band` intent is the drawing bed's punctuation, not a file of its own. */
export const BAND_INTENT = "band";

/**
 * Resolve a role (and optionally an intent, e.g. `click`/`button`) to the file
 * and the numbers the mixer needs, for a given music version and sound set.
 *
 * `nth` rotates through a role's variants — the typing role exists in four
 * clusters precisely so a long run of keys never repeats one back to back.
 */
export const roleCue = (
  id: RoleId,
  { intent, nth = 0, music, set }: { intent?: string; nth?: number; music?: string; set?: string } = {},
): {
  cueId: string; file: string; durationSec: number; gainDb: number; eq: string | null;
  anchor: "start" | "attack"; offsetSec: number; duckDb: number; duck: RoleDuck | null;
} => {
  const r = role(id);
  const setId = set ?? activeSfxSetId();
  const v = roleView(id, setId);
  const tick = intent === BAND_INTENT ? v.bandTick : undefined;
  const perMusic = tick || !music ? undefined : v.perMusic?.[music];
  /*
   * The BAKED file wins, when the manifest names one. `eq` is then already in
   * the bytes, so it is not returned — an offline mixer that applied both would
   * shelve the same texture twice.
   */
  const cueId = tick?.file
    ?? perMusic?.file
    ?? (intent && v.byIntent?.[intent])
    ?? (r.rotate ? v.files[nth % Math.max(1, v.files.length)] : v.files[0]);
  const perFile = v.perFile?.[cueId];
  const cue = sfxSet(setId).cues.find((c) => c.id === cueId);
  if (!cue) {
    throw new Error(
      `role "${id}"${intent ? ` (${intent})` : ""} wants cue "${cueId}", which the set "${setId}" does not have — ` +
      `switch sets with \`node tools/use-sfx.mjs\` or fix src/data/sfx-roles.json`,
    );
  }
  const anchor = tick?.anchor ?? perFile?.anchor ?? v.anchor;
  return {
    cueId,
    file: cue.file,
    durationSec: cue.durationSec,
    gainDb: tick?.gainDb ?? perMusic?.gainDb ?? perFile?.gainDb ?? v.gainDb,
    // Null once it is baked: the filter is in the file, and a mixer that
    // applied it again would shelve the same texture twice.
    eq: tick || perMusic?.file ? null : (perMusic?.eq ?? null),
    anchor,
    // `start` schedules at the action; `attack` pulls back so the sound's first
    // strong onset lands ON it. The offset is measured, never typed.
    offsetSec: anchor === "attack" ? (cue.alignOffsetSec ?? 0) : 0,
    duckDb: tick?.duckDb ?? perFile?.duckDb ?? r.duckDb,
    duck: r.duck,
  };
};

/** Where a bed's own last strong hit lands — the `end` role's suppression reads this. */
export const bedFinalHitSec = (musicVersion: string, cut: CutId): number | null =>
  rolesDoc.$measured.bedFinalHitSec[musicVersion]?.[cut] ?? null;

/**
 * Should the end-card cue be suppressed on this cut?
 *
 * True when the card lands close enough to the music's own final hit that the
 * two read as one stumble rather than two events. Measured at 160–200 ms on
 * version A's long cuts, which clears a strict 120 ms collision test and is
 * still a flam — so the threshold is 250 ms and the music wins.
 */
export const endCueSuppressed = (musicVersion: string, cut: CutId, endcardStartSec: number): boolean => {
  const r = role("end");
  const window = r.suppressIfNearBedFinalHitSec ?? 0;
  const hit = bedFinalHitSec(musicVersion, cut);
  if (hit == null || !window) return false;
  return Math.abs(endcardStartSec - hit) < window;
};

/* ── versions: {music, edit, sfxSet} ────────────────────────────────────────── */

export type FilmVersion = {
  readonly music: string;
  readonly edit: string;
  readonly sfxSet: string;
  readonly outDir?: string;
  readonly quality?: string;
  /** `master` (may ship) or `audition` (renders at master quality, never ships). */
  readonly release?: string;
  readonly note?: string;
};

/**
 * ⚠ ONE flat map, not a `releasable` group and an `audition` group.
 *
 * Two groups meant two places to add a version and a question — "which list is
 * this in?" — every time one was read. An audition is a version with somewhere
 * else to write and a reason it may not ship, which is two fields. `release`
 * says which, and `outDirFor` is the only thing that cares.
 */
type VersionsDoc = {
  readonly versions: Readonly<Record<string, FilmVersion>>;
};
const versionsDoc = versionsJson as unknown as VersionsDoc;

const pick = (release: string) =>
  Object.fromEntries(Object.entries(versionsDoc.versions ?? {}).filter(([, v]) => (v.release ?? "master") === release));

/**
 * Every version id in `versions.json`, releasable and audition alike.
 *
 * A gate that wants to measure "the film" has to iterate THIS, not the music
 * takes: a version is one music + one edit + one sound set, and those three only
 * make sense together. Iterating takes and pairing each bed with whatever cue
 * sheet is loaded produces rows for combinations nothing will ever render.
 */
export const allVersionIds = (): readonly string[] => Object.keys(versionsDoc.versions ?? {});

export const auditionVersions = (): Readonly<Record<string, FilmVersion>> => pick("audition");
export const releasableVersions = (): Readonly<Record<string, FilmVersion>> => pick("master");
export const allVersions = (): Readonly<Record<string, FilmVersion>> => versionsDoc.versions ?? {};

/**
 * Where a version's masters are allowed to be written.
 *
 * An audition version renders at full master quality — the founder judges these
 * as finished films — but it never lands in `out/masters/`. The routing is a
 * function of the sound set's licence, not of anyone remembering.
 */
export const outDirFor = (versionId: string): string => {
  const v = versionsDoc.versions?.[versionId];
  if (!v) throw new Error(`unknown version "${versionId}"`);
  if ((v.release ?? "master") === "audition") {
    return v.outDir ?? `out/previews/AUDITION-not-for-release/${versionId}`;
  }
  return v.outDir ?? `out/masters/${versionId}`;
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

/**
 * Which take the film is currently cut to.
 *
 * The VERSION's, not the manifest's `active` — a version is `{music, edit,
 * sfxSet}` and `FILM_VERSION` selects all three at once. `active` is still the
 * default, which is what `tools/use-music.mjs` writes.
 */
export const MUSIC_VERSION: string = doc.versions?.[MUSIC_ID] ? MUSIC_ID : doc.active;

export const musicVersions = (): readonly string[] => Object.keys(doc.versions ?? {});

/**
 * The active version's measurements.
 *
 * An unknown `active` degrades to an empty record rather than throwing: a module
 * that throws on import takes the Remotion studio down with it, and a bad
 * manifest should redden a gate, not the editor. `audioProblems()` reports it.
 */
export const music: Music =
  doc.versions?.[MUSIC_VERSION] ??
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

/**
 * The bed the film plays for a cut — or, with `version`, that version's.
 *
 * The film never passes `version`: there is one active take and everything reads
 * it through here, which is the "one clock" rule `src/data/music-grid.ts`
 * records. The argument exists for the GATES, which are supposed to measure
 * every version on disk and could not.
 *
 * ⚠ `capture/verify-loudness.mjs` looped over `musicVersions()` and called a
 * mixer that had no way to ask for anything but the active bed, so it measured
 * the active take once per version and printed it under each version's name.
 * With one version on file that was accidentally right. The day version B landed
 * it reported four identical rows — same LUFS, same true peak, same LRA to a
 * tenth — for two takes that do not sound alike, and a gate that agrees with
 * itself that precisely is a gate that is not looking.
 */
export const bedFor = (cut: CutId, version?: string): Bed => {
  const doc = version ? musicFor(version) : music;
  if (!doc) throw new Error(`no music version "${version}" in music.json — have ${musicVersions().join(", ")}`);
  const bed = doc.beds[cut];
  if (!bed) throw new Error(`no music bed for the ${cut}s cut${version ? ` of ${version}` : ""} — run \`npm run audio:beds\``);
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
 * ── It names a ROLE, not a file ────────────────────────────────────────────
 *
 * The sheet owns **WHEN**; `src/data/sfx-roles.json` owns **WHAT** plays there
 * and **HOW LOUD**, per sound set and per music take. So one sheet plays with
 * `synth` and with `elevenlabs-audition` without a line of `cues.ts` knowing
 * which is loaded — and re-choosing the sound design cannot move a cue, while
 * re-cutting the film cannot un-decide a gain.
 *
 * ⚠ `atSec` is the **action's** time, not the sample's start. Anchoring is
 * applied once, in `resolveCue`: `start = atSec − offsetSec`, where the offset
 * is the cue's measured first strong onset for an `attack`-anchored sound and
 * zero for a texture. Before this, nothing applied it at all and the ElevenLabs
 * typing clusters landed 157 ms behind the characters they were for.
 *
 * `gainDb` is a **trim on top of the role's level**, not a replacement — for
 * when one instance sits further back than its siblings. The chapter chip is
 * the same `appear`/`card` sound as a full-bleed card, six decibels down.
 */
export type Cue = {
  readonly atSec: number;
  readonly role: RoleId;
  readonly intent?: string;
  /** Which variant, for a rotating role. */
  readonly nth?: number;
  readonly gainDb?: number;
  /** How long this cue sounds. Defaults to the sample's own length. */
  readonly playSec?: number;
  readonly fadeInSec?: number;
  readonly fadeOutSec?: number;
  /** Why this cue exists, for a gate's output. Never affects the sound. */
  readonly note?: string;
};

export type CueSheet = readonly Cue[];

/** One cue with its file, its level and its scheduled start all resolved. */
export type ResolvedCue = {
  readonly cue: Cue;
  readonly cueId: string;
  readonly file: string;
  /** When the FILE starts, once the anchor has been applied. */
  readonly startSec: number;
  /** When the ACTION is — what the picture does. `cue.atSec`. */
  readonly actionSec: number;
  readonly offsetSec: number;
  readonly durationSec: number;
  readonly playSec: number;
  readonly gainDb: number;
  readonly fadeInSec: number;
  readonly fadeOutSec: number;
  readonly duckDb: number;
  readonly duck: RoleDuck | null;
};

/**
 * The one place a cue becomes a sound. The component, the offline mix and the
 * gates all call it, so none of them can disagree about a level or a frame.
 */
export const resolveCue = (cue: Cue, opts: { set?: string; music?: string } = {}): ResolvedCue => {
  const r = roleCue(cue.role, { intent: cue.intent, nth: cue.nth, music: opts.music ?? MUSIC_VERSION, set: opts.set });
  const playSec = Math.min(cue.playSec ?? r.durationSec, r.durationSec);
  return {
    cue,
    cueId: r.cueId,
    file: r.file,
    startSec: cue.atSec - r.offsetSec,
    actionSec: cue.atSec,
    offsetSec: r.offsetSec,
    durationSec: r.durationSec,
    playSec,
    gainDb: r.gainDb + (cue.gainDb ?? 0),
    fadeInSec: cue.fadeInSec ?? 0,
    fadeOutSec: cue.fadeOutSec ?? 0,
    duckDb: r.duckDb,
    duck: r.duck,
  };
};

/** The gain a resolved cue plays at, `secIntoFile` seconds in. Linear, 0..1. */
export const cueGainAt = (rc: ResolvedCue, secIntoFile: number): number => {
  if (secIntoFile < 0 || secIntoFile > rc.playSec) return 0;
  const base = Math.pow(10, rc.gainDb / 20);
  const inP = rc.fadeInSec > 0 ? Math.min(1, secIntoFile / rc.fadeInSec) : 1;
  const outP = rc.fadeOutSec > 0 ? Math.min(1, (rc.playSec - secIntoFile) / rc.fadeOutSec) : 1;
  // Equal power, so two crossfading copies of one texture sum to one texture
  // rather than to a dip at the seam.
  return base * Math.sqrt(Math.max(0, Math.min(1, inP))) * Math.sqrt(Math.max(0, Math.min(1, outP)));
};

/* ── ducking ────────────────────────────────────────────────────────────────── */

/**
 * WHEN a passage counts as dense enough to duck under, as DATA.
 *
 * Declarative for the same reason the sibling film's duck was: a duck that is
 * hand-placed in the bed cannot be moved once the picture changes, and a bed
 * that arrives pre-ducked can only be un-ducked by re-cutting it. The bed
 * `prepare-bed.ps1` delivers is flat; `FilmAudio` applies the envelope at mount
 * time from wherever the cues actually are.
 *
 * How FAR the music gives way is no longer here. It is per role, in
 * `src/data/sfx-roles.json`: −2.5 dB under typing, −3 under a click, −4 under a
 * chapter move, −5 under a confirmation or the end card, and nothing at all
 * under the drawing bed, whose space is carved with EQ instead. Every one of
 * those is under the 6 dB past which the movement itself becomes audible on a
 * bed this dense, and audible pumping is on the exclude list in
 * `docs/suno-prompt.md`.
 */
export type DuckSpec = {
  /**
   * How far apart two cues may be and still be one passage — and nothing else.
   *
   * ⚠ Depth, attack and release used to live here as three flat constants and
   * are now per ROLE (`src/data/sfx-roles.json`), because −4 dB over 0.63 s is
   * the right shape for a chapter transition and the wrong one for a click.
   * What stayed here is the only part of the old spec that was about the SHEET
   * rather than about a sound: what counts as a dense passage.
   */
  readonly holdSec: number;
  /** The fewest cues a passage must hold before it counts as a dense one. */
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
/**
 * ⚠ **Zero again, for every version, and the −0.5 dB the audition versions used
 * to carry is gone because its cause is.**
 *
 * That trim was measured when the ElevenLabs palette was playing at the
 * SYNTHESISED palette's levels: the cue sheet hard-coded absolute gains — a pop
 * at −5, an end hit at −1 — and applied them to whichever set was loaded, while
 * the role manifest's own calibration for that set (−10 and −6) was never read
 * by anything the film mounts. Four to six decibels hot across the board, on
 * longer material, summed higher; −15.3 LUFS on the 15 s cut; hence −0.5 at the
 * master.
 *
 * The cue sheet now resolves through the roles, so the palette plays at the
 * level it was calibrated to, and the audition mixes landed at −16.6 to −16.9
 * WITH the old trim still applied. Removing it puts all eight inside the window
 * and gives the 15 s cut's true peak 0.3 dB of margin it did not have before.
 *
 * Trimming the CUES is still the wrong lever and the note it earned stands:
 * 1.5 dB off the whole set moved the mix 0.1 LU, because the bed dominates the
 * integrated figure. One decibel at the master moves the master by one decibel.
 *
 * The knob stays at a measured zero for the same reason it did before: the next
 * track will not necessarily be delivered at this one's loudness, and a zero
 * that was measured is worth more than a number that was not needed.
 */
export const MASTER_TRIM_DB: number = 0;

/**
 * One cue's claim on the music: how deep, from when, with what shape.
 *
 * Not a "window" any more. A window is a span with one depth, which is what a
 * single flat duck needs; the role table gives a click −3 dB over 0.30 s and the
 * end card −5 dB over 0.77 s, and merging those into one span can only be done
 * by losing one of them. So each cue keeps its own envelope and `duckGainAt`
 * takes the DEEPEST at every instant — never the sum, because two clicks 80 ms
 * apart must not dig a 6 dB hole.
 */
export type DuckEvent = {
  /** When the music is fully down — the action's own instant. */
  readonly atSec: number;
  /** How long it stays down after that. */
  readonly holdSec: number;
  readonly amountDb: number;
  readonly attackSec: number;
  readonly releaseSec: number;
};

/**
 * ⚠ The density thresholds still gate which cues duck, and the reason is
 * measured rather than inherited.
 *
 * D33 is the record: a duck that fires on every cue covered 50–73 % of the
 * runtime and cost 1.5 LU everywhere. Per-role DEPTHS do not fix that — a
 * shallower duck that is always on is still a trim — so the rule that survived
 * is "a duck is for a dense passage", and what the role table adds is how deep
 * and how fast, per gesture, inside one.
 *
 * `SOLO_DUCK_DB` is the exception, and it is the only thing about this that is
 * new: −5 dB is what the role table reserves for a **confirmation and the end
 * card**, and those two are the events the film is allowed to clear a space
 * for. They fire once each per cut, so they cost coverage in tenths of a per
 * cent.
 *
 * ⚠ It was −4 for one measurement, which let the `move` role duck alone too.
 * `move` fires on every beat boundary — five times in the 15 s cut, twenty in
 * the 120 s — at 0.44 s each, and coverage went from 17 % to **31 %**, straight
 * through the ceiling the gate exists to hold. A cue that fires at every cut is
 * not a solo event, whatever its depth says; that is D33's finding arriving
 * again wearing a per-role hat. See D35.
 */
export const SOLO_DUCK_DB = -5;

/** Every claim a sheet makes on the music, in playing order. */
export const duckEvents = (
  cues: CueSheet,
  opts: { set?: string; music?: string; spec?: DuckSpec } = {},
): readonly DuckEvent[] => {
  const spec = opts.spec ?? DUCK;
  if (cues.length === 0) return [];
  const resolved = cues
    .map((c) => resolveCue(c, opts))
    .filter((rc) => rc.duckDb !== 0 && rc.duck !== null)
    .sort((a, b) => a.actionSec - b.actionSec);

  /*
   * Dense runs first: a run is cues no further apart than the hold, and it
   * qualifies at `minCues` and `minCuesPerSec`. Everything in a qualifying run
   * ducks; a cue outside one ducks only if its role is structural.
   */
  const runs: { cues: ResolvedCue[]; from: number; to: number }[] = [];
  for (const rc of resolved) {
    const last = runs[runs.length - 1];
    if (last && rc.actionSec - last.to <= spec.holdSec) {
      last.cues.push(rc);
      last.to = rc.actionSec;
    } else {
      runs.push({ cues: [rc], from: rc.actionSec, to: rc.actionSec });
    }
  }

  const out: DuckEvent[] = [];
  for (const run of runs) {
    const span = Math.max(spec.holdSec, run.to - run.from);
    const dense = run.cues.length >= spec.minCues && run.cues.length / span >= spec.minCuesPerSec;
    for (const rc of run.cues) {
      if (!dense && rc.duckDb > SOLO_DUCK_DB + 1e-9) continue;
      const d = rc.duck!;
      out.push({
        atSec: rc.actionSec,
        // The music gives way for the GESTURE, capped at the role's hold: a
        // 7.7 s sample does not buy a 7.7 s hole.
        holdSec: Math.min(rc.playSec, d.hold),
        amountDb: rc.duckDb,
        attackSec: d.attack,
        releaseSec: d.release,
      });
    }
  }
  return out.sort((a, b) => a.atSec - b.atSec);
};

/**
 * The music's gain at one second, 1 (open) down to the deepest claim on it.
 *
 * Here rather than in `FilmAudio.tsx` because two things play the same envelope
 * and they must not disagree: the component, and the offline mix that
 * `verify:loudness` measures. A gate that re-implements the thing it is checking
 * is a gate that eventually certifies a film nobody rendered.
 */
export const duckGainAt = (sec: number, events: readonly DuckEvent[]): number => {
  let deepest = 1;
  for (const e of events) {
    const from = e.atSec - e.attackSec;
    const to = e.atSec + e.holdSec;
    if (sec < from || sec > to + e.releaseSec) continue;
    const floor = Math.pow(10, e.amountDb / 20);
    const inP = e.attackSec > 0 ? Math.min(1, Math.max(0, (sec - from) / e.attackSec)) : 1;
    const outP = e.releaseSec > 0 ? Math.min(1, Math.max(0, (to + e.releaseSec - sec) / e.releaseSec)) : 1;
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
    /*
     * The length budget is per ROLE, because 1.2 s was written for the
     * synthesised palette of one-shot UI cues and is simply the wrong question
     * for a vendor set. The drawing texture is a BED — 7.7 s of it, looped to
     * cover beats up to 24 s — and a typing cue is a CLUSTER of several
     * keystrokes, not a single key. Applying the one-shot budget to those
     * reported five failures on cues that are the right length for their job.
     *
     * What the budget is really guarding is a transient that overstays the
     * gesture that caused it, so it still applies, at the scale each role
     * actually works at.
     */
    const budget = roleBudgetSec(id);
    if (budget != null && cue.durationSec > budget) {
      problems.push(`sfx "${id}" is ${cue.durationSec}s — the budget for its role is ${budget}s`);
    }
    if (cue.peakDb > -3 + 0.05) problems.push(`sfx "${id}" peaks at ${cue.peakDb} dBFS — the ceiling is -3`);
    if (Math.abs(cue.dcOffset) > 0.001) problems.push(`sfx "${id}" has a DC offset of ${cue.dcOffset} — DC-block it (tools/generate-sfx-elevenlabs.mjs --reprocess)`);
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
