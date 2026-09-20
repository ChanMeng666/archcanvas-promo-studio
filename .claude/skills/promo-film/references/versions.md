# Versions — a version is music + edit + sound-effect set

The edit is snapped to the take. `src/timeline.ts` pulls every scene boundary onto the
nearest downbeat of that cut's own bed, and `src/cues.ts` derives every sound effect by
walking the resulting cut frame by frame. So a master is not a picture with music under
it — it is the picture **and** the take, welded together.

The consequence that shapes everything: **a new take moves the cut points.** Its
downbeats are elsewhere, so boundaries land elsewhere, so the sound sheet is derived
elsewhere. Version A's masters cannot be reproduced from version B's audio. If both
versions are to be kept, both must stay *renderable*, not merely archived.

## The three versioned things

| | where |
|---|---|
| beds | `public/audio/beds/<version>/bed-15.mp3` … |
| measurements (downbeats, LUFS, true peak, provenance) | `src/data/music.json` → `versions.<version>` |
| masters | `out/masters/<version>/` |

The **sound-effect set** is versioned separately and on its own axis, because it has
nothing to do with the music track: `src/data/sfx.json` holds every set and names one
`active`, switched by `node tools/use-sfx.mjs <set>`. `npm run audio:all` rebuilds the
`synth` set; a music swap does not need it. So a master is pinned by three choices —
music version, edit, and which set was active — and the third is the one with no folder
name to remind you, which is why `verify:release` reads it before a master may exist.

A version id is a **letter plus the take's own slug** — `A-confident-arrival`,
`B-daylight-forward`. Neither half is typed: `tools/plan-beds.mjs` derives the slug from
the single file in `audio/source/` and takes the next unused letter from what
`music.json` already knows. Re-cutting a take that already has a version keeps its letter,
so a re-cut of A lands back in A rather than quietly becoming B.

**`music.json` has exactly one switch: `active`.** `src/audio.ts` reads it and everything
else reads `src/audio.ts` — the gates, the stills, the renders. There is no second place
the film could decide which take it is cut to. `build-music.mjs` **merges** a new entry
beside the existing ones and never replaces: an old version's downbeat list is the only
record of the grid its masters were cut against.

## Cutting a new version

```powershell
# 0. Confirm the plan tier BEFORE generating — see references/constraints.md
Copy-Item ~\Downloads\<take>.mp3 audio\source\<kebab-case-name>.mp3   # copy, do not move
Move-Item audio\source\<previous-take>.mp3 audio\takes\               # exactly one source file

npm run audio:structure    # measure it before cutting it -> docs/music/<slug>.md
npm run audio:beds         # plan -> cut -> measure; derives the id, merges, makes it active
npm run lint
npm run verify             # boundaries re-snap to the new grid; that is the system working
```

Then the part no command does: play the four beds end to end and listen for the splice
(four to six seconds from each end), the entry and the ending. `docs/suno-prompt.md`
§ *What to check afterwards* says what each fault sounds like. Cheap sanity check before
committing eight renders: `npm run stills -- --comp Studio-30-Landscape-16x9`.

Render, measure and screen per `docs/release.md` and `SKILL.md` steps 9–11.

## Switching back

```powershell
node tools/use-music.mjs                      # list versions; * marks active
node tools/use-music.mjs A-confident-arrival  # switch back
npm run verify
pwsh -File ./render.ps1 -MusicVersion A-confident-arrival
```

One field changes. Nothing is re-cut and nothing is re-measured — A's beds are on disk and
its downbeats are already recorded. `use-music.mjs` refuses to switch to a version whose
mp3s are missing, and says which ones.

**`render.ps1 -MusicVersion` is an assertion, not a switch.** It is compared against
`active` and stops the run on disagreement, because a master filed under the wrong music is
worse than no master: it looks like a deliverable.

## Auditioning a sound-effect set

```powershell
node tools/use-sfx.mjs                         # list sets; * marks active
node tools/use-sfx.mjs elevenlabs-audition     # switch; it warns, it does not block
node tools/use-sfx.mjs elevenlabs-audition --draw c   # repoint one alias
npm run audition                               # draw candidates + the HTML page
```

`npm run audition` builds five muxes of one 8 s draw segment (one per candidate, silent
picture plus the candidate at −8 dB) into `out/previews/AUDITION-not-for-release/`,
carrying a `README-NOT-FOR-RELEASE.txt` in with them, and an HTML page with spectrograms
under `out/audition/`. `npm run verify:release` refuses masters while an unlicensed set is
active, so the audition can be heard properly without being able to leave as a
deliverable. Switch back to `synth` before rendering, or promote the set properly with
`node tools/generate-sfx-elevenlabs.mjs --set elevenlabs` — which refuses to run on a free
tier, by design, and which is a **re-mix**: there is no seed, so it buys a different sound
design rather than restoring this one.

`verify:assets` checks **every** version's beds are on disk, not just the active one, so a
deleted bed reddens today rather than on the day someone tries to re-render that version.
`verify:loudness` likewise measures every version with beds on disk, so a second take is
measured the day it lands — non-active rows carry the active take's cue sheet, which is
noted in its output rather than hidden.

## What is committed

**Not committed:** the masters and the review copies — tens of MB each, eight per version,
and git keeps every version forever. They ship as GitHub Release assets.

**Committed:** `out/masters/<version>/MANIFEST.json` — filename, bytes, sha256, duration,
frame count, resolution, integrated loudness, true peak, the render commit, the music
version and track, the date, and a `supersedes[]` list. Every number is **measured from
the delivered file**, never copied from what the render was asked for. A release asset with
no record in the repo is a file nobody can later prove anything about, and four lines of
JSON preserve a superseded build's provenance better than 147 MB of mp4 does.

The beds *are* committed, like everything under `public/`: a fresh clone must be able to
render the film.

**Replacing a version's masters is staged** — the previous masters are moved aside and
removed only once every new one has been measured and screened, so a failed render can
never leave the folder without a good master.
