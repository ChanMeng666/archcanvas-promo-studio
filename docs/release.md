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

## Version B — `B-daylight-forward`, cut 2026-09-20

**The beds exist and every gate is green. Nothing has been rendered.**

| | |
|---|---|
| version | `B-daylight-forward` |
| track | `daylight-forward.mp3`, **127.6 BPM, bar 1.894 s**, 133.53 s |
| beds | `public/audio/beds/B-daylight-forward/` — 15.000 / 30.000 / 60.000 / 120.000 s, −16.1 to −16.2 LUFS, true peak −2.1 to −4.1 dBTP |
| provenance | SUNO, founder-generated, created 2026-09-19T23:20:50Z per the file's own tag. **Plan tier NOT yet confirmed for that date** (`docs/audio-provenance.md`) |
| analysis | `docs/music/daylight-forward.md` — structure, edit windows, the fills and crashes in film time |
| status | **blocked on the tier confirmation**, and on a listening pass. Renderable the moment both land. |

Against version A: 26 % faster, 50 % brighter by spectral centroid, 50 % denser
in strong onsets, and 4.4 LU of loudness range against 7.3 — and where A has one
enormous arrival at 99.6 s, B has eleven fills, five crashes and two drop-outs
spread across its length. That is the difference that matters for a film that
cuts. The reasoning, with the numbers, is in `docs/music/daylight-forward.md`.

Seven scene boundaries moved across the four cuts, none by more than 0.14 s, and
`verify:timeline` raised one new advisory pace note (the 120 s cut's `price` card
now holds 2.23 s against a 2.2 s ceiling — a 30 ms overrun).

**Two gate defects surfaced doing this, both fixed, both documented in the
analysis doc:** `plan-beds.mjs` scored a bed's entry and never its body, and
`verify:loudness` measured the active take once per version and printed it under
every version's name. The second is the sharper lesson — it went unnoticed
because with one version on file its answer was accidentally right, and the tell
when B landed was four rows *identical to the tenth of a LU* for two takes that
do not sound alike.

⚠ **`tools/analyze-music.mjs` reports 63.83 BPM for this take.** That is half
the real tempo; its octave test ties and breaks the tie on noise. Use
`npm run audio:structure` for the tempo, or `lib/dsp.mjs`'s `localBeat`, both of
which say 127.66. The older tool has deliberately not been changed.

---

## The four versions, and the one variable that selects them

A version is `{music, edit, sfxSet}` (`src/data/versions.json`, `docs/decisions.md`
D34). There are four:

| version | music | edit | sound set | may ship | renders to |
|---|---|---|---|---|---|
| `A-confident-arrival` | A | A | `synth` | **yes** | `out/masters/A-confident-arrival/` |
| `B-daylight-forward` | B | B | `synth` | **yes** | `out/masters/B-daylight-forward/` |
| `A-confident-arrival+el` | A | A | `elevenlabs-audition` | **no** | `out/previews/AUDITION-not-for-release/A-confident-arrival+el/` |
| `B-daylight-forward+el` | B | B | `elevenlabs-audition` | **no** | `out/previews/AUDITION-not-for-release/B-daylight-forward+el/` |

The two `+el` versions render at **full master quality** — same codec, same
loudness target — because the founder judges finished films, not drafts. What
makes them auditions is the licence: the ElevenLabs set was generated on a free
plan, which carries no commercial rights (`docs/audio-provenance.md` §4), so
`outDirFor()` sends them somewhere else and `verify:release` refuses to let them
into `out/masters/`. **The routing is a function of the licence, not of anyone
remembering.**

### ⚠ The variable is `REMOTION_FILM_VERSION`, and the prefix is load-bearing

```powershell
$env:REMOTION_FILM_VERSION = "B-daylight-forward+el"   # picture AND sound
$env:FILM_VERSION          = "B-daylight-forward+el"   # for anything Node-only
```

Set **both**. `src/version.ts` runs in two places and they do not share an
environment: in Node — every gate — `process.env` is the real one, and inside
the Remotion bundle it is a small object the bundler injects, into which
Remotion puts only `REMOTION_`-prefixed variables.

This is not a style note. For the whole life of the version model the variable
was unprefixed, so it selected the version for every gate and for **nothing that
renders**: stills, contact sheets and masters all silently fell back to
`music.json`'s `active`. `docs/decisions.md` D36 has the proof and what it cost.

**The end-to-end check, when anything near this changes** — a text tripwire in
`verify:timeline` covers the mechanism, but only a frame proves it:

```powershell
$env:REMOTION_FILM_VERSION = "A-confident-arrival"
npx remotion still Studio-15-Landscape-16x9 out/env-check.png --frame=120 --scale=0.4
```

Frame 120 is 4.0 s. **Edit A shows the drafting sheet there; edit B shows the
aubergine "Get a real, dimensioned floor plan." card.** A card means the variable
is not reaching the picture.

### Rendering an audition version

`render.ps1` knows about **music** versions, not about the four-version map: it
files into `out/masters/<active music version>/` and asserts `-MusicVersion`
against `music.json`'s `active`. With an audition version selected it stops
before rendering anything, because it calls `verify:release` first and that
refuses an unlicensed set — so it **cannot** misfile an audition as a master,
but it cannot produce one either.

So the two `+el` versions are rendered by hand, to the directory `outDirFor()`
names, and that is a gap rather than a design:

```powershell
$env:REMOTION_FILM_VERSION = "B-daylight-forward+el"
$env:FILM_VERSION          = "B-daylight-forward+el"
npx remotion bundle --out-dir out/bundle
npx remotion render Studio-30-Landscape-16x9 `
  out/previews/AUDITION-not-for-release/B-daylight-forward+el/Studio-30-Landscape-16x9.mp4 `
  --concurrency=2
```

Copy `capture/audition-notice.txt` in beside them. A render script that reads
`outDirFor()` and drives all four versions is the obvious next piece of work.

---

## Cutting a version — the whole procedure

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
Copy-Item ~\Downloads\<new-take>.mp3 audio\source\<kebab-case-name>.mp3
Move-Item audio\source\<the-previous-take>.mp3 audio\takes\
```

**Copy, do not move.** The download is the only other copy of an irreproducible
asset until the commit lands; there is no reason for a `git add` mistake to be
able to lose it. Name it kebab-case — the version id is derived from the
filename, so `Daylight Forward.mp3` would become `B-daylight-forward` anyway and
having the two agree saves reading `plan-beds.mjs` to find out.

The previous take's beds are already cut and measured, so moving its source out
costs nothing — `public/audio/beds/<version>/` and `music.json` are what make a
version renderable, not the take. (Put it back if you ever want to re-cut it.)

### 1b. Measure it before you cut it

```powershell
npm run audio:structure          # the take in audio/source/
```

Not in the original four commands, and it belongs here: it writes
`src/data/music-analysis/<slug>.json` plus an energy chart and a spectrogram
under `docs/music/`, and it is the only thing in the pipeline that will tell you
the take has no breakdown, no ending, or a tempo that wanders. Write the take up
as `docs/music/<slug>.md` — `daylight-forward.md` is the template.

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
- **True peak is predicted less reliably than loudness, and the manifest is how
  the gate finds out.** The model is accurate within ~0.3 dB wherever a cut's
  peak is in the body, and wrong by ~1.1 dB where it is the opening transient —
  a matter of milliseconds between the bed's entry and the first cue, not of
  encoder settings (bitrate accounts for 0.1 dB of it; D41). So
  `verify:loudness` now reads the true peaks `package-masters.ps1` wrote into
  `MANIFEST.json` and **fails when its own prediction was optimistic by more
  than 0.3 dB**. That means **the manifest must be committed after a packaging
  run** — it is tracked although the masters are not, and it is the only thing
  in the gate that can contradict the model. If a cut goes over, fix it with
  `openingCueTrimDb` in the data rather than a bed level, and trim until the
  peak moves out of the first 100 ms.

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
