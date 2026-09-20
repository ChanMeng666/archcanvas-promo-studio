/**
 * Which VERSION of the film this process is building.
 *
 * ── Why a version is three things ──────────────────────────────────────────
 *
 * The film used to have one edit and a swappable music track, and that was true
 * right up until the second track arrived and the right answer was to re-cut
 * the picture around it. A version is `{music, edit, sfxSet}`: the take, the
 * edit decision lists cut to it, and the effects set. `src/data/versions.json`
 * is the one place those are tied together.
 *
 * ── The ID is the music version's ID ───────────────────────────────────────
 *
 * Deliberately, and not for tidiness: `tools/use-music.mjs` already writes
 * `music.json`'s `active`, `render.ps1` already takes `-MusicVersion`, and the
 * beds are already named for it. Giving versions a second namespace would have
 * meant two things to keep in step and a gate to check they were.
 *
 * ⚠ `FILM_VERSION` in the environment wins, and that is how both versions are
 * rendered without editing code. `Root.tsx` reads it once.
 *
 * ⚠ It reads `music.json` DIRECTLY rather than importing `audio.ts`, and that is
 * not a shortcut: `audio.ts` has to ask this module which music to load, so the
 * other direction is a cycle. This file is the bottom of the stack.
 */

import musicJson from "./data/music.json";
import versionsJson from "./data/versions.json";

export type EditId = "A" | "B";
export type SfxSetId = "synth" | "elevenlabs";

export type VersionSpec = {
  readonly edit: EditId;
  readonly sfxSet: SfxSetId;
  readonly note?: string;
};

const doc = versionsJson as unknown as {
  readonly versions: Readonly<Record<string, VersionSpec>>;
};

/** Every version the repo knows how to build. */
export const VERSION_IDS: readonly string[] = Object.keys(doc.versions ?? {});

/**
 * The active version's ID.
 *
 * `FILM_VERSION` first — that is the seam a render script and a gate both use
 * to build a version that is not the active one — then the music manifest's own
 * `active`, which is what the founder's `use-music.mjs` flips.
 */
export const VERSION: string =
  (typeof process !== "undefined" ? process.env?.FILM_VERSION : undefined) ||
  ((musicJson as unknown as { active?: string }).active ?? "A-confident-arrival");

/**
 * What travels with a version.
 *
 * An unknown ID degrades to edit A rather than throwing: a module that throws on
 * import takes the Remotion studio down with it, and a typo in an env var should
 * redden a gate, not the editor. `versionProblems()` reports it.
 */
export const specFor = (id: string): VersionSpec => doc.versions?.[id] ?? { edit: "A", sfxSet: "synth" };

export const EDIT_ID: EditId = specFor(VERSION).edit;
export const SFX_SET: SfxSetId = specFor(VERSION).sfxSet;

/** Everything a gate should be able to say about the version map. */
export const versionProblems = (): readonly string[] => {
  const out: string[] = [];
  if (VERSION_IDS.length === 0) out.push("versions.json names no versions at all");
  if (!doc.versions?.[VERSION]) {
    out.push(`the active version "${VERSION}" is not in versions.json — the film fell back to edit A`);
  }
  for (const [id, spec] of Object.entries(doc.versions ?? {})) {
    if (spec.edit !== "A" && spec.edit !== "B") out.push(`version "${id}" names an unknown edit "${spec.edit}"`);
    if (spec.sfxSet !== "synth" && spec.sfxSet !== "elevenlabs") {
      out.push(`version "${id}" names an unknown sfx set "${spec.sfxSet}"`);
    }
  }
  return out;
};
