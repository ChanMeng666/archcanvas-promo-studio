---
name: promo-film
description: >-
  Cut, re-cut or review the ArchCanvas «Studio» promo film. Use when swapping the
  music take, re-timing the edit, changing sound effects, adding a cut length or an
  aspect ratio, reviewing a render before release, or writing a new line of on-screen
  copy — i.e. whenever work touches src/cuts.ts, src/scenes.ts, src/copy.ts, the audio
  pipeline under tools/, render.ps1, or the eleven gates in capture/.
---

# promo-film — cutting a version of the Studio film

Eight masters: four lengths (15 / 30 / 60 / 120 s) × two aspects, Remotion 4 at 30 fps.
Intent lives in **seconds** (`src/cuts.ts`); only `src/timeline.ts` converts to frames.
A master is the picture **and** the take welded together, because every scene boundary
snaps to that cut's own bed. Read `CLAUDE.md` first — this skill is the loop, not a
replacement for the four laws.

*Influence: the public agent skill by op7418, `github.com/op7418/guizang-product-video-skill`
(AGPL-3.0). Its ideas about music-led pacing and about proving a caption by reading it
aloud are re-expressed here in our own terms against our own gates. No text or files
were copied.*

## The loop

**1. Check the standing constraints before touching anything.**
Read `references/constraints.md`. Several of them are founder decisions that an
art-direction impulse cannot overturn (`docs/decisions.md` D24), and two of them —
the plan-tier confirmation and the honesty caption — have already cost deleted assets
and a rework. If a constraint is in your way, that is the answer, not the obstacle.

**2. Analyse the music before you plan a single cut.**
`npm run audio:structure` on the file in `audio/source/`. It writes
`src/data/music-analysis/<slug>.json`, an energy chart and a spectrogram, and it is the
only thing that will tell you the take has no breakdown, no real ending, or a tempo that
wanders. Write the take up as `docs/music/<slug>.md` — `daylight-forward.md` is the shape.
⚠ **The half-time trap**: `tools/analyze-music.mjs` reports 63.83 BPM for
`daylight-forward.mp3`, half the real tempo, because its octave test ties and breaks the
tie on fourth-decimal noise. Trust `audio:structure` / `lib/dsp.mjs` `localBeat` (127.66).
What you want out of this step: bar seconds, the section boundaries, the fills and
crashes, the drop, and where the arrangement stops.

**3. Estimate reading and demo time per beat — before fitting anything to bars.**
A beat's length is decided by what a viewer has to read and what the product has to
finish doing. Only then is it pulled onto the grid. Writing the bar length first and
filling beats to match is how a film ends up with a card nobody can read and a draw that
lands mid-gesture. `references/rhythm.md` has the budgets and the micro-structure.

**4. Write the EDL in seconds, on the bar grid.**
Edit `src/cuts.ts`. `timeline.ts` snaps each boundary to the nearest downbeat within
**±150 ms** and leaves it alone beyond that (`src/timeline.ts:125-142`). Major chapter
boundaries want a downbeat; a small action inside a beat does not, and uniform
quantisation is what makes a cut feel mechanical — let short beats sit off-beat.
Boundaries are computed as absolute seconds and converted once, with the last beat
absorbing the rounding, so a snap moves two beats and changes no total
(`src/timeline.ts:290-300`). `npm run verify:timeline` asserts the exact sums and
450 / 900 / 1800 / 3600 frames.

**5. Camera: start on what is there, then travel.**
`src/camera.ts` resolves focus through the replica's own `layoutMap` — never aim by hand.
`camera.fill` is a **fraction** ("the subject spans this much of the frame"), not a scale;
`fillScale()` derives the number per composition. Three obligations — coverage, protection,
aim — and when they conflict **aim gives way first, scale before either**
(`src/camera.ts:246-263`). Protected rectangles must stay wholly inside; `expel` pushes a
rectangle below the bottom edge and will *raise* the scale to do it. The two travelling
beats (`receipt`, `render`) lerp from what is on screen now to the settled shot over a
window taken from the screenplay (`docs/decisions.md` D32b) — a beat that opens on a hole
saved for something that has not appeared yet is what `verify:framing` catches.

**6. Audio: the cue sheet is derived, never placed.**
`src/cues.ts` walks each resolved cut frame by frame and emits a cue when the product's
state changes, at `beat.startSec + frameToSec(f)`. Do not hand-place a sound.
`references/audio.md` has the fourteen cues, the ducking spec, the loudness procedure,
and where the true-peak ceiling actually bites (a bed's entry meeting the opening cue,
not a loud moment in the middle).

**7. The LOOK loop — render stills and open every one.**
```powershell
node capture/stills.mjs --comp Studio-30-Landscape-16x9      # six named beats
node capture/stills.mjs --sheet --comp <id>                  # contact frames
npm run stills:sheet                                         # tile them, both aspects
node capture/stills.mjs --at 30-Land:7.4,9.1                 # ad-hoc seconds
```
Run stills **per composition** — a long sweep through one browser dies on a
`fonts.gstatic.com` fetch. Every finding in the three look-fix passes recorded at
`docs/decisions.md:473` was invisible to a green gate. A still you did not open is not a
look pass, and a look pass done on a build that is not the shipping one misses the thing
it was for.

**8. Gates, per version.**
`npm run lint && npm run verify` — eleven gates, in order: assets · replica · timeline ·
copy · numbers · audio · honesty · framing · violet · loudness · opening. They bundle and
execute the real `src/**` through `capture/lib/load-core.mjs`, so they test the renderer's
own arithmetic. **Before trusting a green gate, ask what it looked at** — every gate here
prints its count, because a gate whose input set goes empty reports success by doing
nothing. Boundaries moving after a music swap is the system working, not a regression.

**9. Render sequentially, verify each master, stage replacements.**
```powershell
npx remotion bundle --out-dir out/bundle                     # once, not eight times
pwsh -File ./render.ps1 -ListOnly                            # plan + orphan scan
pwsh -File ./render.ps1 -MusicVersion B-<slug> -Bundle out/bundle
./tools/package-masters.ps1 -MusicVersion B-<slug>
```
`-Concurrency` defaults to **2** on this 16 GB box; 4 gets renders killed. Renders are
sequential and the orphan scan runs before the run and between every master — it
**prints, never kills**, filtered on both the process name and *this* project's
`node_modules` path. Never render beside a `check:full` in the product repo. Put new
masters beside the old ones and remove the old only once every new one has been measured
and screened. `MANIFEST.json` numbers are measured from the delivered file, never copied
from the render request.

**10. The human pass — what only ears and eyes can judge.**
```powershell
npm run verify:flash out/masters/<version>/<file>.mp4        # EVERY master
```
No default filename, deliberately. Then, with no gate involved: play the four beds end to
end and listen for the splice (four to six seconds from each end), the entry and the
ending; play a master and check the first cue is not buried, that nothing clips, that the
ending resolves rather than stops. Then pull eight evenly spaced stills from each master
and look: the replica is really drawn rather than blank, the honesty caption is in the
draw section, the "AI-generated" pill is on the rendering, the end card reads
`archcanvas.uk`, no frame carries a bare `$` and nothing names the language.
**Human judgement**, all of it — say plainly which of these you actually did.

**11. Release.** `docs/release.md` is the procedure. Masters are Release assets, never
committed; `MANIFEST.json` is. Check the take's plan tier **before generating**, and
record the date. See `references/versions.md`.

## References

| file | for |
|---|---|
| `references/constraints.md` | the hard laws, each with its reason and its gate |
| `references/rhythm.md` | section budgets, beat structure, snapping policy |
| `references/copy-review.md` | clearing a new line, and the read-aloud test |
| `references/audio.md` | cues, roles, ducking, loudness, the audio traps |
| `references/traps.md` | Remotion/Windows failures already paid for |
| `references/versions.md` | what a version is, and how A and B coexist |
