# Release — rendering the eight masters, and keeping two music versions

**For the founder, and for whoever renders next.** This is the procedure, the
reason it is shaped this way, and the exact commands for version B.

---

## What a "version" is, and why there is more than one

The film's edit is **snapped to the music**. `src/timeline.ts` pulls every scene
boundary onto the nearest downbeat of that cut's own bed, within ±150 ms, and
`src/cues.ts` derives every sound effect by walking the resulting cut frame by
frame. So a master is not a picture with music laid under it — it is the picture
**and** the take, welded together.

That has one consequence that decides the whole layout of this document: **a new
take moves the cut points.** Its downbeats are somewhere else, so scene
boundaries land somewhere else, so the sound sheet is derived somewhere else.
That is correct and automatic, and it means version A's masters cannot be
reproduced from version B's audio. If both versions are to be kept — and they
are — then both have to stay *renderable*, not merely archived.

So three things are versioned, all by the same id:

| | where |
|---|---|
| the beds | `public/audio/beds/<version>/bed-15.mp3` … |
| the measurements (downbeats, LUFS, true peak, provenance) | `src/data/music.json` → `versions.<version>` |
| the masters | `out/masters/<version>/` |

A version id is a **letter and the take's own name** — `A-confident-arrival`,
`B-<whatever-lands>`. Neither half is typed: `tools/plan-beds.mjs` derives the
slug from the file in `audio/source/` and takes the next unused letter from
what `music.json` already knows about. Re-cutting a take that already has a
version keeps its letter, so a re-cut of A lands back in A's folder rather than
quietly becoming B.

**`music.json` has exactly one switch: `active`.** `src/audio.ts` reads it and
everything else reads `src/audio.ts` — the gates, the stills, the renders. There
is no second place the film could decide which take it is cut to, which is the
same discipline `src/data/music-grid.ts` already records under "one clock".

---

## Version A — re-rendered 2026-09-20 at `8181e86`

Eight masters, `out/masters/A-confident-arrival/`. Every one exact on frame count
(450 / 900 / 1800 / 3600), 30 fps, h264 / yuv420p, AAC audio present and not
silent, and past `verify:flash` with zero flash pairs. The record is
`MANIFEST.json`; the review copies are in `review/`.

This **replaced** the first render (`8593e72`), which was superseded by the travel
and loudness fixes. The old mp4s were deleted rather than kept — 147 MB to
preserve a provenance that four lines of JSON preserve better — and
`MANIFEST.json`'s `supersedes` is that record. The replacement was staged: the
previous masters were moved aside and only removed once every new one had been
measured and screened, so a failed render could never have left the folder
without a good master.

The container duration reads ~60 ms over each cut length on all eight. That is the
AAC tail padding — the **video** stream is exactly 15.000 / 30.000 / 60.000 /
120.000 s.



| | |
|---|---|
| version | `A-confident-arrival` |
| track | `confident-arrival.mp3`, 101.69 BPM, bar 2.36 s |
| provenance | SUNO, founder-generated, paid tier confirmed 2026-09-08 (`docs/audio-provenance.md`) |
| status | **placeholder**, borrowed from `../archcanvas-promo-remotion`. Genuinely good, measurably the brightest of three takes (`docs/suno-prompt.md`), but written for a 75 s continuous camera move rather than a product film that cuts. |

It is kept, not replaced. When B exists, A stays renderable.

---

## Version B — the whole procedure

Four commands. The only judgement in it is the one no command can make: whether
the take is any good.

### 0. Before generating — check the plan tier

**On the paid plan, before you generate. Not before you ship.** Commercial
rights attach to the tier that was active when an asset was *created*, and
upgrading afterwards does not license what already exists. Twelve ElevenLabs
assets were deleted over exactly this (`docs/decisions.md` D4). It is one check
and it is the cheapest thing in this document.

The prompt itself, with the reasoning behind every adjective and two alternates,
is `docs/suno-prompt.md`. The three non-negotiables: **instrumental, four-bar
phrasing, a real ending that rings out** — the beds splice the take's own ending
on at a bar line, so a take that fades has nothing to splice.

### 1. Drop the take in

`audio/source/` must hold exactly **one** file; the tools refuse to guess
between two.

```powershell
Move-Item ~\Downloads\<new-take>.mp3 audio\source\
Move-Item audio\source\confident-arrival.mp3 audio\takes\   # or anywhere out of source/
```

A's beds are already cut and measured, so moving its source out costs nothing —
`public/audio/beds/A-confident-arrival/` and `music.json` are what make A
renderable, not the take. (Put it back if you ever want to re-cut A.)

### 2. Cut the beds

```powershell
npm run audio:beds
```

Plan → cut → measure. It derives the version id (`B-<slug>`), writes the four
beds into `public/audio/beds/B-<slug>/`, **merges** the new entry into
`music.json` beside A's, and makes B active. Nothing of A's is touched.

`npm run audio:all` also rebuilds the fourteen sound effects, which this does
**not** need — they are synthesised offline and have nothing to do with the
music track.

### 3. Check it

```powershell
npm run lint
npm run verify          # all ten gates; scene boundaries re-snap to B's grid
```

`verify:timeline` prints how many boundaries moved and every cut still summing
to exactly its length. **Boundaries moving is the system working, not a
regression** — B has its own beat grid, so its cut points are its own.

`verify:assets` checks **every** version's beds are on disk, not just the active
one, so a deleted A bed reddens here rather than on the day someone tries to
re-render A.

Then the part no command does — play the four beds end to end and listen for the
splice (four to six seconds from the end of each), the start, and the ending.
`docs/suno-prompt.md` § *What to check afterwards* says what each fault sounds
like.

Worth a look before committing eight renders to it: `npm run stills -- --comp
Studio-30-Landscape-16x9`, which is cheap and shows whether a boundary landed
somewhere unfortunate.

### 4. Render

```powershell
npx remotion bundle --out-dir out/bundle          # once, not eight times
./render.ps1 -MusicVersion B-<slug> -Bundle out/bundle
```

`-MusicVersion` is an **assertion, not a switch.** It is checked against
`music.json`'s `active` and the run stops if they disagree, because a master
filed under the wrong music is worse than no master — it looks like a
deliverable. Omit it and the masters are filed under whatever is active.

### 5. Measure, record, and make the review copies

```powershell
./tools/package-masters.ps1 -MusicVersion B-<slug>
```

It probes every master, writes `out/masters/B-<slug>/MANIFEST.json`, and
transcodes the review copies. It fails if a master is missing, the wrong size,
not 30 fps, not `yuv420p`, short of its frame count, silent, or over the
true-peak ceiling.

Every number in the manifest is **measured from the delivered file**, never
copied from what the render was asked for. That is this project's oldest lesson
restated: every number about the broken sound effects was right while the files
were wrong (`docs/decisions.md` D10).

Two things it reports that are **not** faults:

- **The container runs ~60 ms long.** An mp4's format duration is its longest
  stream, and AAC pads its tail to a whole 1024-sample frame. The manifest
  carries the video stream's own duration and frame count beside it, and those
  are exact — 450 / 900 / 1800 / 3600 frames at 30 fps.
- **The measured loudness should match `verify:loudness` within ~0.1 LU.** It
  did on version A: −15.8 / −16.4 / −16.4 / −16.3 against a predicted −15.7 /
  −16.3 / −16.3 / −16.3. **If a re-render disagrees by more than about 0.5 LU,
  the gate's model is wrong and that is the finding** — do not just accept the
  file.
- **True peak is predicted less reliably than loudness.** On the 60 s cut the
  model said −2.4 dBTP and the master measured −1.2, reached in the first 64 ms
  where that bed's entry meets the opening cue. It clears the −1.0 ceiling by
  0.2 dB, so **the peak check is the one with no margin left**. If a new take
  goes over, expect it there, and fix it with a cue gain in the data rather
  than a bed level. `docs/decisions.md`, *Confirmed against the real masters*.

### 6. Screen every master

```powershell
npm run verify:flash out/masters/B-<slug>/<file>.mp4
```

**Every one.** `capture/check-flash.mjs` deliberately has no default filename; a
default is how seven go unchecked.

Then look at the frames, which no gate does. Pull eight evenly spaced stills out
of each master and check the things only an eye catches: the replica UI is
really there rather than a blank, the honesty caption is in the draw section,
the "AI-generated" pill is on the rendering, the end card says `archcanvas.uk`,
and no frame carries a bare `$` or names the DSL.

---

## Going back to A

```powershell
node tools/use-music.mjs                      # list the versions, * marks active
node tools/use-music.mjs A-confident-arrival  # switch back
npm run verify
./render.ps1 -MusicVersion A-confident-arrival
```

One field changes. Nothing is re-cut and nothing is re-measured: A's beds are on
disk and its downbeats are already in the document. `use-music.mjs` refuses to
switch to a version whose mp3s are missing, and says which ones.

---

## What is committed and what is not

**Not committed:** the masters and the review copies. A 120 s 1080p master is
tens of MB, there are eight of them per version, and git keeps every version
forever. They ship as **GitHub Release assets**.

**Committed:** `out/masters/<version>/MANIFEST.json` — filename, bytes, sha256,
duration, resolution, integrated loudness, true peak, the render commit, the
music version and track, and the date. It is small, and a release asset with no
record in the repo is a file nobody can later prove anything about.

The beds are committed, like everything else under `public/`: a fresh clone must
be able to render the film (`.gitignore` says why this repo answers that
question the opposite way to the sibling one).

---

## Review copies

`out/masters/<version>/review/<comp>-720.mp4` — 1280-wide for landscape,
720-wide for portrait, CRF 23. They play anywhere and they are small enough to
send. **The masters themselves are never re-encoded**; the review copy is made
from the master and the master is left alone.

---

## The traps, in the order they bite

All of these have been paid for once. `CLAUDE.md` § *Traps already paid for*
holds the full list; these four are the render-day ones.

- **A killed render does not clean up after itself.** Three of them once left
  5.3 GB across 18 orphaned processes, which then got the next render killed for
  memory — a loop that reads as "this film is too heavy" and is not.
  `render.ps1` scans before the run and between every master, filtered on both
  the process name and *this* project's `node_modules` path, and only ever
  prints. **A human decides what to kill.**
- **Never name a PowerShell variable `$args`, and never write `& npx @args`.**
  `$args` is an automatic variable; `@args` splats the empty automatic one, npx
  opens an interactive shell, that shell exits 0, and the summary reports a
  *previous* run's master as this run's output. A green run that rendered
  nothing. That is why the summary prints each file's **modification time**.
- **When more memory does not help, the problem is not memory.** `will-change`
  on a large transformed layer once asked Chrome for a 22,250 × 22,881 px
  backing store and killed renders with 5.4 GB free.
- **Don't run eight renders in parallel**, and don't run one beside a
  `check:full` in the product repo. One machine, 16 GB, and it has been rebooted
  over this before.

---

## Sound-effect sets, and the gate that stops an audition shipping

The music has `active`. The sound effects now have one too, for the same reason
and with the same shape: `src/data/sfx.json` has **one** `active` field,
`src/audio.ts` reads it, everything else reads `src/audio.ts`.

| set | source | releasable |
|---|---|---|
| `synth` | ffmpeg, `tools/synth-sfx.mjs` | **yes** — no vendor, no terms |
| `elevenlabs-audition` | ElevenLabs, free tier, 2026-09-20 | **no** — audition only |
| `elevenlabs` | ElevenLabs, paid tier | yes, once it exists |

```bash
node tools/use-sfx.mjs                          # list, and say which is releasable
node tools/use-sfx.mjs synth                    # the licensed set
node tools/use-sfx.mjs elevenlabs-audition --draw c
```

### Why a set can exist that must never ship

`elevenlabs-audition` was generated so the founder could hear whether vendor
effects beat the synthesised ones — specifically the sound the plan makes while
it draws itself. The account is on a free plan, which carries no commercial
licence and whose terms withhold rights from anything created outside a paid
subscription **before or after**. Upgrading later does not license what already
exists (`docs/audio-provenance.md` §4, `docs/decisions.md` D4).

At render time a quarantined set is indistinguishable from a licensed one: same
manifest shape, same paths, same everything the renderer looks at. The only
thing between it and a master on a landing page is somebody remembering — and
this project has already proved that does not hold.

### The gate

```bash
npm run verify:release        # 0 = masters may be rendered
```

It reads `releaseBlockers()` out of `src/audio.ts`, so the gate and the film
cannot disagree about what is licensed. It refuses when the active sound set, or
any individual cue in it, or the active music version, carries
`commercialUse: false`.

It runs in **two** places, and the first one matters most:

- **`render.ps1`, before it renders anything.** Not at ship time — a refusal
  after a two-hour render costs the render.
- **`npm run ship`**, via `verify:strict`.

Auditions are not blocked, only misfiled: they render to
`out/previews/AUDITION-not-for-release/`, which carries a standing notice
(`capture/audition-notice.txt`, copied in by `npm run audition`).

**What the gate does not defend against** is a hand-edit of
`src/data/sfx.json` setting `commercialUse: true`. That is deliberate. The field
is data-driven so a *paid* regeneration flips it automatically, and nothing can
distinguish a hand-edit from a legitimate one. The gate stops accidents, not
decisions.

### Moving the audition to a releasable set

```bash
# 1. upgrade the ElevenLabs plan FIRST — rights attach to the tier live at
#    generation, not at shipping
node tools/generate-sfx-elevenlabs.mjs --set elevenlabs   # refuses on a free tier
node tools/use-sfx.mjs elevenlabs --draw <a|b|c|d|e>
npm run verify:release
pwsh -File ./render.ps1
```

The prompts are committed (`audio/sfx-sets/prompts.json`), so the brief survives
the regeneration. **The audio does not:** the sound-effects API exposes no seed,
so the same prompt returns a different take. A paid regeneration is a re-mix, not
a re-render, and the result needs listening to again.
