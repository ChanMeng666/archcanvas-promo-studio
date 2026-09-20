# Audio — sets, cues, ducking, loudness

Two layers: a **bed** (the music take, cut to each length) and **cues** (a sound-effect
**set**). Both are versioned, separately — `references/versions.md`.

## Sets and the six roles

`src/data/sfx.json` holds `{ active, sets: { <id>: { … } } }`. The switch is the one
`active` string (`activeSfxSetId()`, `src/audio.ts:120`); move it with
`node tools/use-sfx.mjs <set>`, no argument to list. Two sets exist — **`synth`** and
**`elevenlabs-audition`** — and `elevenlabs` is the reserved name for a releasable vendor
set that does not exist yet. Each set maps the film's fourteen canonical cue ids onto its
own files through `aliases` (`src/audio.ts:141-152`), so a set swaps without touching
`src/cues.ts`; `--draw <a..e>` repoints the `pencil-line` alias at one of five candidates.

Every cue carries a `role` (`src/audio.ts:84`). The **six roles** are declared once, at
`audio/sfx-sets/prompts.json:24-31`:

| role | job | rule |
|---|---|---|
| `draw` | the plan drawing itself out, and the sheet settling | a texture, not a hit; `PENCIL_GAP_SEC = 0.42` |
| `type` | the brief being typed | short clusters at the product's own rate, thinned to `MAX_KEYS_PER_SEC = 14` |
| `click` | selection and confirmation | dry and short; one per actual state change |
| `move` | structural transition | **only** at a chapter cut, alternating by beat index |
| `appear` | cards, pins, a rendering resolving | scarce enough to still mean something |
| `end` | export and the end card | one each |

`MAX_SIMULTANEOUS = 4` (`src/cues.ts:43`) — five sounds at once means the picture is doing
too much, not the sheet.

The `synth` set is generated offline by `tools/synth-sfx.mjs` from ffmpeg primitives — no
vendor, no prompts. Its "prompt" analogue is the filter graph, recorded as a `recipeHash`
per cue alongside duration, peak, RMS, DC offset and bytes; `npm run audio:sfx:check`
fails on drift. Every noise source is seeded and ten builds came out byte-identical.

The `elevenlabs-audition` set comes from `audio/sfx-sets/prompts.json` via
`tools/generate-sfx-elevenlabs.mjs --set <name>`, which calls
`GET /v1/user/subscription` **before generating anything** and writes the answer into the
set's provenance. `--set elevenlabs` (the releasable name) **refuses outright on a
non-paid tier**, so a `commercialUse: true` manifest cannot come from a free-tier run, and
nothing downstream re-decides it. ⚠ **There is no seed** — the API exposes none, every row
stores `seed: null`, and **regenerating is a re-mix, not a re-render**: a different sound
design, bought again. Hence the audio is committed and `--remeasure` exists.

## Placement

**Do not hand-place a cue.** `src/cues.ts` walks each resolved cut frame by frame, reads
the replica's state at that frame, and emits on a change at
`atSec = beat.startSec + frameToSec(f)`. The same 35 s of screenplay runs at 2.50× in the
15 s cut and 0.46× in the 120 s cut, and the sheet follows.

**A cue names a ROLE and an intent, never a file.** `{atSec, role, intent?, nth?,
gainDb?, playSec?, fades}`; the manifest maps role → file and level **per sound set**
(`perSet` blocks) and per take, so one sheet plays with `synth` and with
`elevenlabs-audition`. A `gainDb` in the sheet is a **trim on top of** the role's level,
for one instance sitting further back than its siblings — not a place to set a palette.
⚠ A `perSet` block's material-calibrated fields (`perMusic`, `perFile`, `loop`,
`bandTick`, `minGapSec`) **do not fall through** to the role; `verify:audio`'s
`fallthrough` check asserts it, because nothing else can see that bug.

**The drawing beat gets ONE base**, anchored on the first stroke's film second, looped
with an equal-power crossfade if the beat outlasts the sample, faded out at the beat's
end — never a retrigger. Edit B adds a light `tick` on each band's downbeat, placed from
`beat.warpKnots.slice(1, -1)` so the punctuation cannot drift from the bars the bands
were pinned to.

**Alignment is per cue and stored as data**, `alignBy` + `alignOffsetSec`
(`src/audio.ts:87-97`): a transient is `"attack"`, so
`cue.at = action.at − alignOffsetSec`; a texture is `"start"`, so `cue.at = action.at`.
The offset is the **first strong onset** — the first sample within 12 dB of peak — and
**not the peak**. Two corrections are baked into that, both paid for: a texture's global
peak is not its anchor (`draw-e` is loudest at 7.013 s of a 7.79 s file, so
attack-aligning would have started the drawing sound seven seconds early), and even a
transient anchors on its first strong onset (`type-1` peaks at 1.432 s of a 1.88 s
cluster). `peakAtSec` is measured, stored, and deliberately not what anything aligns to.
A few emitters carry their own fixed offset for picture reasons —
`end-hit` at `beat.startSec + MOTION.wipeSec * 0.55` — in `cues.ts`, not nudged by ear.

Detector state is seeded from the beat's **first** frame, never from zero. Seeding from
zero once produced six pin drops for three pins.

## Ducking

**Per role, deepest wins, never summed.** `src/data/sfx-roles.json` carries a `duckDb`
and an `attack`/`hold`/`release` for each role — typing −2.5 dB, a click −3, a chapter
`move` −4, a `confirm` and the `end` card −5, the `draw` bed **0** (its space is carved
with EQ instead). `duckEvents()` turns the sheet into one claim per cue and
`duckGainAt()` takes the deepest at every instant, so two clicks 80 ms apart cannot dig
a 6 dB hole. `DUCK` keeps only what is about the SHEET rather than about a sound:
`holdSec`, `minCues 4`, `minCuesPerSec 4`.

The density thresholds are the lesson and they survive the per-role rewrite. Ducking on
*every* run of cues covered 50–74 % of runtime and pulled masters to −17.3…−17.9 LUFS
against −16. Per-role *depths* do not fix that — a shallower duck that is always on is
still a trim — so only dense passages duck, coverage sits at 0–23 % across sixteen cuts,
and `DUCK_MAX_FRACTION = 0.3` is the ceiling.

⚠ **`SOLO_DUCK_DB = −5`** is the one depth that ducks outside a dense passage, and −5 is
measured rather than chosen: at −4 the `move` role qualified, `move` fires on every beat
boundary, and coverage went 17 % → **31 %**, through the ceiling. A cue that fires at
every cut is not a solo event, whatever its depth says (`docs/decisions.md` D35).

`MASTER_TRIM_DB` is **0** for all four versions, measured. If a key cue is inaudible,
look in order — the role's gain, the bed's level in that section, the duck. Raising the
master is never the answer.

## Loudness

Targets: **−16 LUFS integrated, −1.5 dBTP** for a bed (`audio/bed-plan.json`); the gate
allows ±0.5 LU and **≤ −1.5 dBTP** for the mix (`capture/verify-loudness.mjs`), measured on
an AAC encode at the **delivery's own settings — probed with `ffprobe` off a delivered
master, never typed**.

⚠ **The offline mix must place cues where the FILM places them, or the true peak it
reports is a different film's.** `FilmAudio.tsx` mounts every cue in a
`<Sequence from={secToFrame(rc.startSec)}>`, so a cue starts on a FRAME — up to 16.7 ms
from its own second. A 60 s opens with a cue ~7 ms from its bed's entry, which is the
difference between two transients summing and following each other: the mix said −2.4
dBTP and the film delivered −1.2, for two rounds, green. `mix.mjs` § `cueStartSample`
owns this, plus a constant **16 samples** that is EMPIRICAL — fitted against delivered
films, direction included, with no mechanism claimed. Together: every one of the 32
delivered masters predicted within **0.1 dB**, each on the right sample (D42).

Ruled out by measurement, so do not re-run them: the encoder's bitrate (0.1 dB across
192k/256k/317k/512k), the bed's alignment (exactly 2048 samples of AAC priming in every
film), and evaluating gains per frame as Remotion does (identical to the tenth of a dB).

The dial for a cut over the ceiling is `versions.<id>.openingCueTrimDb` — the OPENING
cue's gain, never the bed's — because every bed enters at 0 s and the first cue lands
40 ms later, so the highest sample is usually their sum in the first ~64 ms. Turn it a
decibel at a time and watch the number; it stops responding once the bed alone owns that
sample. Current: A 60 s −3, B 120 s −7, B+el 15 s −8, everything at −1.9 dBTP or better.

Beds are made two-pass (`tools/prepare-bed.ps1`): `loudnorm` measures, then re-runs with
the measured `I`/`TP`/`LRA`/`thresh`/`offset` **and `linear=true`** so it cannot fall into
dynamic mode. Order matters — the 20 ms fade-in and 0.6 s fade-out are applied **before**
loudnorm measures; with them after, the 15 s bed delivered −15.4 LUFS against −16. The
ending is spliced, not faded: the take's own ending is crossfaded onto the body at a bar
line with an equal-power `qsin`, which is why a take that fades has nothing to splice.

**True peak bites at the bed's entry meeting the opening cue**, in the first ~64 ms, not
a loud middle. If a new take goes over, expect it there, and **fix it with a cue gain in
the data, not a bed level**.

`verify:loudness` does not read a rendered file — it rebuilds the mix offline from the
bed, the cue sheet and the film's own `duckGainAt`. **The one assertion that is not the
model marking its own homework** is the comparison against
`out/masters/<version>/MANIFEST.json`, which `package-masters.ps1` writes from the
delivered files and which is **tracked even though the masters are not**: every prediction
is reported beside the reality, and an **optimistic** one (predicted more than 0.3 dB
below the measured peak) is fatal. Pessimistic is a note — a prediction under the real
peak is how a master ships at −1.2 under a green gate; over it is only over-cautious.

⚠ **Commit `MANIFEST.json` after packaging.** It is the only thing in the repo that can
contradict the model. Each film carries a `cueSha` — a fingerprint of the resolved sheet
— so a cut whose audio changed since its render is skipped as stale while every other cut
stays checked, trims and all. Older manifests without one fall back to blunter rules that
say so out loud. **If a re-render disagrees by more than about 0.5 LU, the gate's model is
wrong and that is the finding** — do not just accept the file.

## Traps

- **Remotion's `<Audio>` takes a gain and NOTHING else.** The role manifest's per-music
  EQ was a string nothing the film mounts could apply, and the drawing texture ran 0.4 to
  3.7 dB *over* the music at 6.3–10 kHz on the money shot for as long as that was true.
  `node tools/bake-eq.mjs` renders each recipe into real bytes, `roleCue` plays the baked
  file and returns `eq: null` with it, and `verify:audio` fails on a stale recipe hash.
  **Anything the manifest can say that `<Audio>` cannot do has to be baked.**
- **`amix` silently drops ragged inputs.** Swept cues came out the right duration with
  only the first grain audible, about one build in six, from byte-identical inputs;
  `silenceremove` was blamed first and replacing it fixed nothing. Fix: place grains with
  `afade=t=in:st=X` on full-length sources and `apad` + `atrim` every layer to one span.
- **A gate looping over N things can still be looking at one.** `verify:loudness` iterated
  every music version through a mixer that could only reach the *active* bed, so it
  measured one take four times under four names — accidentally right while one version
  existed. The tell when B landed: four rows identical to the tenth of a LU for two takes
  that do not sound alike. **Agreement that precise is a shared input, not confirmation.**
  Fixed with `bedFor(cut, version)`; a non-active row now says out loud that the bed is
  its own while the cue sheet is the active take's.
- **ffmpeg `ebur128` writes to stderr and exits 0** — reading the wrong stream measured
  NaN on every working file. And **cues are WAV, beds are MP3**: MP3 prepends ~1152
  samples (~24 ms) of encoder delay, so a cue shipped as MP3 is late by that much.
- **A delivered mp4 decodes 2048 samples (42.7 ms) late** — the AAC priming delay.
  Anything comparing a film against an offline mix has to align by correlation first or
  it will confidently "find" a 43 ms offset that is not in the film. Two readings in a
  row were that artefact before it was caught.
- **Downbeats are measured on the delivered mp3**, decoded as the browser will, never
  extrapolated — and the grid step comes from the plan's bar length, not a median of the
  bed's own onsets (medians returned 1.88–2.24 s against a true 2.36 s, because
  subdivisions drag them down). The half-time trap is in `SKILL.md` step 2.
- ffmpeg on Windows: `$ErrorActionPreference = "Continue"`, `-ss` **after** `-i`, `-vn` on
  any SUNO file. Use core `remotion` `<Audio>` — `@remotion/media`'s rendered −91 dB of
  silence after previewing fine.
