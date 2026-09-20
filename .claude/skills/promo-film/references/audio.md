# Audio — cues, ducking, loudness

Two layers: a **bed** (the music take, cut to each length) and **cues** (fourteen
synthesised sound effects). They are versioned differently — the bed belongs to the take,
the cues do not (`references/versions.md`).

## The fourteen cues and what they are for

`SFX_IDS` (`src/audio.ts:36-48`): `key-1 key-2 key-3 click whoosh-in whoosh-out
pencil-line paper-settle tick pin-drop pop stamp shimmer end-hit`. There is no role enum —
each cue's `desc` in `src/data/sfx.json` is what it is for. Read as roles they group into
six jobs, which is the useful number for a film this length:

| role | cues | rule |
|---|---|---|
| typing | `key-1..3` | short clusters at the product's own rate, thinned to `MAX_KEYS_PER_SEC = 14` |
| selection / confirm | `click`, `tick` | dry and short; one per actual state change |
| structural transition | `whoosh-in`, `whoosh-out` | **only** at a chapter cut, alternating by beat index |
| drawing | `pencil-line`, `paper-settle` | the draw and its landing; `PENCIL_GAP_SEC = 0.42` |
| appearance | `pop`, `pin-drop`, `shimmer` | cards, pins, a rendering resolving |
| resolution | `stamp`, `end-hit` | export, and the end card — one each, kept scarce |

`MAX_SIMULTANEOUS = 4` (`src/cues.ts:43`). If a moment needs five sounds, the picture is
doing too much, not the sheet.

**All fourteen are synthesised offline by `tools/synth-sfx.mjs` with ffmpeg primitives** —
no vendor, no service, no generation prompts. The "prompt" analogue is the filter graph,
recorded as a `recipeHash` per cue in `src/data/sfx.json` alongside duration, peak, RMS,
DC offset and byte count; `npm run audio:sfx:check` fails on drift. Every noise source
carries an explicit seed, and ten consecutive builds came out byte-identical. The reason
they are synthesised rather than licensed is `docs/decisions.md` D4.

## Placement

**Do not hand-place a cue.** `src/cues.ts` walks each resolved cut frame by frame, reads
the replica's own state at that frame, and emits on a change at
`atSec = beat.startSec + frameToSec(f)`. The same 35 s of screenplay runs at 2.50× in the
15 s cut and 0.46× in the 120 s cut, and the sheet follows automatically.

There is no `syncOffset` concept here, because every cue is authored to peak at its own
start — the one exception is handled by a fixed offset in the emitter, e.g. `end-hit` at
`beat.startSec + MOTION.wipeSec * 0.55`. **If a future cue has its loudest moment in the
middle of the file, it must be given its own offset in `cues.ts`, not moved by ear** —
otherwise it lands late by however long its attack is.

Detector state is seeded from the beat's **first** frame, never from zero. Seeding from
zero once produced six pin drops for three pins.

## Ducking

`DUCK` (`src/audio.ts:304-311`): `amountDb -4`, `attackSec 0.08`, `holdSec 0.25`,
`releaseSec 0.35`, and two thresholds — `minCues 4`, `minCuesPerSec 4`. It is **flat, on
the bed only**; per-cue level is the cue's own `gainDb` trim.

The thresholds are the whole lesson. Ducking on *every* run of cues covered 50–74 % of the
runtime and pulled masters to −17.3…−17.9 LUFS against a −16 target. The fix was not
master gain — `MASTER_TRIM_DB` is **0**, measured — it was ducking only for genuinely
dense passages. Coverage fell to 11–20 % and the cuts landed −15.7 / −16.3 / −16.3 / −16.3.
`verify:loudness` caps coverage at `DUCK_MAX_FRACTION = 0.3`.

If a key cue is inaudible, look in this order: cue gain, then the bed's own level in that
section, then the duck. Raising the master is the one move that is never the answer.

## Loudness

Targets: **−16 LUFS integrated, −1.5 dBTP** for a bed (`audio/bed-plan.json`); the gate
allows ±0.5 LU and **≤ −1.0 dBTP** for the mix (`capture/verify-loudness.mjs`).

Beds are made two-pass: `loudnorm` measures, then re-runs with the measured
`I`/`TP`/`LRA`/`thresh`/`offset` **and `linear=true`** so it cannot fall into dynamic mode
(`tools/prepare-bed.ps1`). Order matters: the 20 ms fade-in and 0.6 s fade-out are applied
**before** loudnorm measures — with the fades after, the 15 s bed delivered −15.4 LUFS
against −16. The ending is spliced, not faded: the take's own ending is crossfaded onto
the body at a bar line with an equal-power `qsin` curve, which is why a take that fades out
has nothing to splice.

**Where true peak bites: the bed's entry meeting the opening cue**, in the first ~64 ms —
not a loud moment in the middle. The 60 s cut's model predicted −2.4 dBTP and the master
measured −1.2, clearing the ceiling by 0.2 dB. That check has no margin left. If a new
take goes over, expect it there, and **fix it with a cue gain in the data, not a bed
level**.

`verify:loudness` does not read a rendered file — it rebuilds the mix offline from the
bed, the cue sheet and the film's own `duckGainAt`. `package-masters.ps1` then measures
the delivered master. They agreed within 0.1 LU on version A; **if a re-render disagrees
by more than about 0.5 LU, the gate's model is wrong and that is the finding** — do not
just accept the file.

## Traps

- **`amix` silently drops ragged inputs.** Swept cues came out the right duration with
  only the first grain audible, on about one build in six, from byte-identical inputs.
  `silenceremove` was blamed first and replacing it fixed nothing; the intermittence only
  showed up by building ten times. Fix: place grains with `afade=t=in:st=X` on
  full-length sources, and `apad` + `atrim` every layer to the same span. Keep the
  collapse guard in `buildCue()` forever.
- **A gate looping over N things can still be looking at one.** `verify:loudness` iterated
  every music version through a mixer that could only reach the *active* bed — one take
  measured four times, printed under each version's name. With one version on file it was
  accidentally right. The tell when B landed: four rows identical to the tenth of a LU for
  two takes that do not sound alike. **Agreement that precise is a shared input, not
  confirmation.**
- **ffmpeg `ebur128` writes to stderr and exits 0** — reading the wrong stream measured
  NaN on every working file.
- **Cues are WAV, beds are MP3.** MP3 prepends ~1152 samples (~24 ms) of encoder delay; a
  cue shipped as MP3 is late by that much. Never commit a WAV bed.
- **Downbeats are measured on the delivered mp3**, decoded as the browser will, never
  extrapolated — and the grid step comes from the plan's bar length, not from a median of
  the bed's own onsets (medians returned 1.88–2.24 s against a true 2.36 s, because
  subdivisions drag them down).
- **The half-time trap**: see `SKILL.md` step 2.
- ffmpeg on Windows: `$ErrorActionPreference = "Continue"` (progress goes to stderr),
  `-ss` **after** `-i` (input seeking on an mp3 lands ~26 ms out), and `-vn` on any SUNO
  file (embedded cover art becomes a video stream).
- Use the core `remotion` `<Audio>`, not `@remotion/media`'s — the latter previewed fine
  and rendered −91 dB of silence in a sibling film.
