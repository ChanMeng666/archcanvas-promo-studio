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

*Influence: op7418's public skill, `github.com/op7418/guizang-product-video-skill`
(AGPL-3.0) — its music-led pacing and read-it-aloud copy test, re-expressed in our terms
against our gates. No text or files copied.*

## The loop

**1. Check the standing constraints first.** `references/constraints.md`. Several are
founder decisions an art-direction impulse cannot overturn (D24), and two — the plan-tier
confirmation and the honesty caption — have already cost deleted assets and a rework. A
constraint in your way is the answer, not the obstacle.

**2. Analyse the music before you plan a single cut.**
`npm run audio:structure` on the file in `audio/source/`. It writes
`src/data/music-analysis/<slug>.json`, an energy chart and a spectrogram, and it is the
only thing that will tell you the take has no breakdown, no real ending, or a tempo that
wanders. Write it up as `docs/music/<slug>.md` — `daylight-forward.md` is the shape. What
you want out of it: bar seconds, section boundaries, fills and crashes, the drop, and
where the arrangement stops.
⚠ **The half-time trap**: `tools/analyze-music.mjs` reports 63.83 BPM for
`daylight-forward.mp3`, half the real tempo, because its octave test ties and breaks the
tie on fourth-decimal noise. Trust `audio:structure` / `lib/dsp.mjs` `localBeat` (127.66).

**3. Estimate reading and demo time per beat — before fitting anything to bars.**
A beat's length is decided by what a viewer must read and what the product must finish
doing; only then is it pulled onto the grid. Writing the bar length first and filling
beats to match is how a film ends up with a card nobody can read and a draw that lands
mid-gesture. `references/rhythm.md` has the budgets and the micro-structure.

**4. Write the EDL in seconds, on the bar grid.**
Edit `src/cuts.ts`. `timeline.ts` snaps each boundary to the nearest downbeat within
**±150 ms** and leaves it alone beyond that. Major chapter boundaries want a downbeat; a
small action inside a beat does not, and uniform quantisation is what makes a cut feel
mechanical — let short beats sit off-beat. Boundaries are absolute seconds converted once,
last beat absorbing the rounding, so a snap moves two beats and changes no total.
`npm run verify:timeline` asserts the exact sums and 450 / 900 / 1800 / 3600 frames.

**5. Camera: start on what is there, then travel.**
`src/camera.ts` resolves focus through the replica's own `layoutMap` — never aim by hand.
`camera.fill` is a **fraction** ("the subject spans this much of the frame"), not a scale;
`fillScale()` derives the number per composition. Three obligations — coverage, protection,
aim — and when they conflict **aim gives way first, scale before either**. Protected
rectangles stay wholly inside; `expel` pushes one below the bottom edge and will *raise*
the scale to do it. The travelling beats (`receipt`, `render`) lerp from what is on screen
now to the settled shot over a window taken from the screenplay (D32b) — a beat opening on
a hole saved for something not yet there is what `verify:framing` catches.

**6. Audio: the cue sheet is derived, never placed.**
`src/cues.ts` walks each resolved cut frame by frame and emits a cue when the product's
state changes, at `beat.startSec + frameToSec(f)`. Do not hand-place a sound. Which files
those cues resolve to is the **active sound-effect set** (`src/data/sfx.json`, switched by
`node tools/use-sfx.mjs`); each cue aligns by its stored `alignBy` / `alignOffsetSec` —
attack for a transient, start for a texture, anchored on the first strong onset, never on
the peak. `references/audio.md` has the six roles, ducking, loudness, and where the
true-peak ceiling bites (a bed's entry meeting the opening cue, not a loud middle).

**7. The LOOK loop — render stills and open every one.**

⚠ **Set `REMOTION_FILM_VERSION` as well as `FILM_VERSION`, or you are looking at
`music.json`'s active version.** Remotion injects only `REMOTION_`-prefixed variables
into the bundle's `process.env`, so an unprefixed selector reaches every gate and no
frame. `references/traps.md` has the one-command proof.

```powershell
node tools/beat-strip.mjs --cut 30                           # the cut's whole clock
node capture/stills.mjs --comp Studio-30-Landscape-16x9      # six named beats
                                                             #   + the 3 hand-over frames
node capture/stills.mjs --sheet --comp <id>                  # contact frames
npm run stills:sheet                                         # tile them, both aspects
node capture/stills.mjs --at 30-Land:7.4,9.1                 # ad-hoc seconds
```
Run stills **per composition** — a long sweep through one browser dies on a
`fonts.gstatic.com` fetch. Every finding in the three look-fix passes
(`docs/decisions.md:473`) was invisible to a green gate. A still you did not open is not a
look pass, and one run against a build that is not the shipping one misses the thing it
was for.

**8. Gates, per version.**
`npm run lint && npm run verify` — eleven gates, in order: assets · replica · timeline ·
copy · numbers · audio · honesty · framing · violet · loudness · opening. They bundle and
execute the real `src/**` through `capture/lib/load-core.mjs`, so they test the renderer's
own arithmetic. **Before trusting a green gate, ask what it looked at** — every gate here
prints its count, because a gate whose input set goes empty reports success by doing
nothing. Boundaries moving after a music swap is the system working, not a regression.

`npm run verify:release` is deliberately **not** in that aggregate — it is first in
`verify:strict`, and `render.ps1` calls it itself before creating a masters folder. It
refuses when the active sound-effect set, any cue in it, or the active music version
carries `provenance.commercialUse: false`, pointing at the audition directory instead —
**accidents, not decisions** (`references/constraints.md`).

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
`node_modules` path. Never render beside a `check:full` in the product repo. Stage a
replacement: keep the old masters until every new one is measured and screened.
`MANIFEST.json` numbers are measured from the delivered file, never from the request.

**10. The human pass — what only ears and eyes can judge.**
```powershell
npm run verify:flash out/masters/<version>/<file>.mp4        # EVERY master
```
No default filename, deliberately. To compare candidate sounds first, `npm run audition`
builds the draw comparisons and a spectrogram page into
`out/previews/AUDITION-not-for-release/` and `out/audition/`.

Then, with no gate involved: play the four beds end to end and listen for the splice (four
to six seconds from each end), the entry and the ending; play a master and check the first
cue is not buried, that nothing clips, that the ending resolves rather than stops. Then
pull eight evenly spaced stills from each master and look — the replica really drawn
rather than blank, the honesty caption in the draw section, the "AI-generated" pill on the
rendering, the end card reading `archcanvas.uk`, no bare `$`, nothing naming the language.
**Human judgement**, all of it — say plainly which of these you actually did.

**11. Release.** `docs/release.md` is the procedure; `references/versions.md` the shape.
Masters are Release assets, never committed; `MANIFEST.json` is. Check the take's plan
tier **before generating**, record it in that version's `provenance`, and let
`verify:release` enforce what you wrote down.

## Who reviews what

**The founder reviews finished films.** Stills, contact sheets, audition previews and
per-sound comparisons are the **agents' own quality loop** — our instruments for deciding
something is ready — never a gate the founder is asked to stand at. Do not send a contact
sheet up for a verdict, do not ask which draw candidate sounds better before forming and
stating your own view, and do not treat "not yet reviewed" as a reason to stop. Run the
loop, reach a recommendation, render, and put a finished film up with the open questions
named. Founder *decisions* on record (D24, D29, D33) are a different thing; a look pass
does not reopen them.

## References

- `constraints.md` — the hard laws, each with its reason and its gate
- `rhythm.md` — section budgets, beat structure, snapping policy
- `copy-review.md` — clearing a new line, and the read-aloud test
- `audio.md` — sets, the six roles, alignment, ducking, loudness, the audio traps
- `traps.md` — Remotion/Windows failures already paid for
- `versions.md` — what a version is, and how takes and sound sets coexist
