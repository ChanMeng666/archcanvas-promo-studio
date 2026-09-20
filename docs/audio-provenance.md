# Audio provenance

Where every sound in this film came from, and — for the eight sound effects this
film does **not** use — the evidence behind that.

Written because the question "may we ship this sound?" was answered three
different ways across two sibling repos on two consecutive days, and the answers
contradict each other. The record below is what survives when you read all of
them against the filesystem.

---

## Verdict, up front

| Asset | Source | Verdict |
|---|---|---|
| **14 sound effects** (`synth`, active) | Synthesised offline by `tools/synth-sfx.mjs` (ffmpeg only) | **Clear.** No vendor, no account, no terms. |
| **21 sound effects** (`elevenlabs-audition`) | ElevenLabs, 2026-09-20, **free tier** | **NOT FOR RELEASE.** Audition only — quarantined by manifest and by `npm run verify:release`. See §4. |
| **Music bed** `confident-arrival.mp3` | SUNO, founder-generated, confirmed paid tier 2026-09-08 | **Clear**, on the strength of that dated confirmation. |
| ~~8 drafting-room cues~~ | ElevenLabs, 2026-09-07, `../archcanvas-promo-video/audio/sfx-*.mp3` | **UNUSABLE. Not copied into this repo.** |
| ~~`drafting-room-full.mp3`~~, ~~`ink-on-paper-full.mp3`~~ | SUNO, `../archcanvas-promo-video` | **Not used** — darkest of the candidates, and their licensing boxes are still blank. |

---

## 1. The eight ElevenLabs cues: why they are not here

### What was inherited as a claim

`../archcanvas-promo-remotion/docs/suno-prompt.md` § *Licensing — CLOSED,
2026-09-08* carries three ticked boxes:

> - [x] **ElevenLabs — Text to Speech:** paid tier, commercial use permitted · confirmed 2026-09-08
> - [x] **ElevenLabs — Sound Effects:** paid tier, commercial use permitted · confirmed 2026-09-08
> - [x] **SUNO:** paid tier, commercial use permitted · confirmed 2026-09-08

Read alone, that closes the question. It does not survive being read alongside
the rest of that repo.

### What the same repo says four hours later

Those boxes were committed in `7203c6f` at **13:19** on 2026-09-08. At **16:38**
the same day, commit `490a306` — *"drop the voiceover, cut the film to 75s, and
give it a real bed"* — says:

> Licensing, not craft. The ElevenLabs key the eight takes and four sound effects
> were generated on reports tier "free", verified directly against
> `/v1/user/subscription`. The free plan carries no commercial licence, and the
> clause that matters reads: content created outside a paid subscription, BEFORE
> OR AFTER, cannot be used commercially. Upgrading later would not have licensed
> what already existed, so all twelve assets are deleted rather than kept and
> hoped over — along with the four scripts that made them, so nobody runs one by
> accident. **The first film's eight effects came from the same pipeline and are
> no longer staged either.**

The same repo's `docs/copy-clearance.md` records it as settled:

> All twelve ElevenLabs assets were deleted.

And its `docs/suno-prompt.md`, in the section immediately under the ticked boxes,
records the measurement that caused it:

> at **2026-09-08**, while the 8 narration takes and the 4 new effects were being
> generated, `GET /v1/user/subscription` on the key in `.env` returned
> **`tier: "free"`** (1,615 of 10,000 characters used).

### The filesystem agrees with the commit, not the checkboxes

`../archcanvas-promo-remotion/public/audio/` today contains exactly one file,
`bgm.mp3`. No `vo-*.mp3`, no `sfx-*.mp3`. That directory is **not gitignored**
(`git check-ignore` returns nothing for it), so this is the tracked, deliberate
state rather than a local tidy-up.

### The eight cues in question are inside the window

`../archcanvas-promo-video/audio/sfx-manifest.json` carries its own timestamp:

```
"generatedAt": "2026-09-07T13:53:11.727Z"
```

2026-09-07 is **before** the 2026-09-08 check that returned `tier: "free"`, and
the ElevenLabs clause quoted above withholds commercial rights from content
created outside a paid subscription *before or after*. There is no reading of
that clause under which a 2026-09-07 generation is licensed by a later upgrade.

And that older film's own licensing boxes were never ticked at all
(`../archcanvas-promo-video/docs/suno-prompt.md` § Licensing):

```
- [ ] SUNO plan tier: ______________ · confirmed on: ____________
- [ ] ElevenLabs plan tier (SFX): ______________ · confirmed on: ____________
```

That film shipped with them blank — which the sibling repo itself names as the
failure mode: *"that is how an open gate stops being noticed."*

### The current tier could not be checked, and would not have settled it

An `ELEVENLABS_API_KEY` is present in three sibling `.env` files. All three were
tried against `GET https://api.elevenlabs.io/v1/user/subscription` — a read-only
endpoint, no generation endpoint was called, and no key value was printed,
logged or committed. All three returned:

```
HTTP 401  {"detail":{"type":"authentication_error","code":"unauthorized",
           "message":"Invalid API key","status":"invalid_api_key"}}
```

The key has been revoked or rotated since. **This changes nothing**, and it is
worth being explicit about why: commercial rights attach to the tier that was
active **when an asset was generated**, not to the tier active when it ships or
when somebody checks. Even a `tier: "pro"` answer today would say nothing about
2026-09-07. The sibling repo makes exactly this point about its own confirmation.

### Verdict

**The record does not positively show the cues were generated under a paid plan.
It shows the opposite, measured, on the day.** They are treated as unusable, are
not copied into this repo, and no file under `public/audio/` derives from them.

The brief for this work package said to treat them as unusable unless the record
positively showed otherwise. It does not; it affirmatively shows the free tier.

### One inconsistency left standing, deliberately

`../archcanvas-promo-remotion/docs/suno-prompt.md` still shows two ticked
ElevenLabs boxes that its own later commit contradicts, and its `CLAUDE.md`,
`copy-clearance.md` and `decisions.md` all point at a **`docs/decisions.md` D11**
that was never written — the file stops at D10. Five references, no section.

Both are that repo's to fix, and **this repo does not edit sibling repos**. They
are recorded here because the next person to read those ticked boxes will reach
the wrong conclusion in about thirty seconds, exactly as this work package nearly
did.

---

## 2. The fourteen cues this film does use

Synthesised by `tools/synth-sfx.mjs` from ffmpeg primitives — `sine`,
`anoisesrc`, `aevalsrc`, and `bandpass` / `afade` / `aecho` / `volume` /
`apad` / `amix` to shape them. There is no vendor in the chain, so there is
no tier to check and no terms to comply with.

Two properties make that claim auditable rather than merely asserted:

- **Deterministic.** Every `anoisesrc` carries an explicit `seed`. **Ten**
  consecutive full builds produced byte-identical output across all fourteen
  files. Without the seeds, ffmpeg seeds from the clock and "regenerable" would
  quietly mean "re-rollable". Ten rather than one because an earlier version of
  the graph failed intermittently — about one build in six — and a single green
  run would have missed it entirely (`docs/decisions.md` D10).
- **Hashed.** `src/data/sfx.json` stores a sha256 of each cue's filter graph.
  `npm run audio:sfx:check` fails if a recipe changed without the `.wav` being
  rebuilt, or if a file's byte count no longer matches.

The `.wav` files are committed **and** regenerable — committed because a fresh
clone must be able to render without ffmpeg on the box, regenerable because a
committed binary with no recipe is just another asset of unknown provenance.

| cue | duration | peak dBFS | RMS dB | what it is for |
|---|---|---|---|---|
| `key-1` | 0.070 s | -3.0 | -21.8 | Keyboard character — variant 1 of 3, cycled so typing does not machine-gun. |
| `key-2` | 0.065 s | -3.0 | -24.7 | Keyboard character — variant 2 of 3. |
| `key-3` | 0.075 s | -3.0 | -22.3 | Keyboard character — variant 3 of 3. |
| `click` | 0.045 s | -3.0 | -22.8 | A pointer click on a control — button, chip, menu item. |
| `whoosh-in` | 0.289 s | -3.0 | -16.3 | A panel, card or menu arriving. Rising sweep. |
| `whoosh-out` | 0.244 s | -3.0 | -16.7 | A panel, card or menu leaving. Falling sweep. |
| `pencil-line` | 0.647 s | -3.0 | -16.6 | A plan stroke drawing itself — graphite across paper, ~0.6 s. |
| `paper-settle` | 0.536 s | -3.0 | -20.1 | A sheet landing on the desk — the drafting sheet appearing. |
| `tick` | 0.030 s | -3.0 | -23.2 | One step of a slider or parameter — the smallest sound here. |
| `pin-drop` | 0.245 s | -3.0 | -24.8 | A review pin landing on the plan. |
| `pop` | 0.097 s | -3.0 | -17.3 | A card arriving on the canvas. |
| `stamp` | 0.283 s | -3.0 | -20.8 | Save, confirm, toast — something committed. |
| `shimmer` | 0.784 s | -3.0 | -20.3 | The rendering resolving into view. |
| `end-hit` | 0.709 s | -3.0 | -22.7 | The end card landing. The one cue allowed to be big. |

All fourteen: 48 kHz mono WAV, peak normalised to exactly −3.0 dBFS, every
duration inside the 1.2 s budget, DC offset ≤ 1×10⁻⁵ (396 KB for all fourteen), and every file decays to
true zero (a 5 ms terminal fade makes that a property of the pipeline rather
than a lucky consequence of each envelope).

### What could not be verified without ears

Nobody who built these can hear them. They were verified by `ffprobe`, by
`astats`, and by looking at a `showspectrumpic` spectrogram of every cue — which
is how three real defects were found and fixed: a `pencil-line` whose sweep was
buried under broadband noise leaking to 19 kHz, sub-60 Hz grain-rate rumble
eating headroom on every swept cue, and an intermittent `amix` failure that
silently emptied the whooshes on about one build in six (`docs/decisions.md`
D10). Every one of those files had a correct duration, sample rate and peak
while being the wrong sound.

**What numbers cannot answer:** whether the cues sound good together, whether
they sit right under the bed at the levels chosen, and whether each reads as the
gesture it is named for. That is a listening pass the founder still owes, and it
is the one part of this work package that was not verified.

---

## 3. The music bed

`audio/source/confident-arrival.mp3` — 134.974 s, SUNO, generated by the
founder, and the one candidate carrying a dated paid-tier confirmation
(2026-09-08, `../archcanvas-promo-remotion/docs/suno-prompt.md`). It is
committed to this repo because SUNO output is irreproducible: the same prompt
does not return the same track, so a generated bed is a source asset, not a
build artefact.

It was also the right musical choice, and that was measured rather than argued
— see `docs/decisions.md` D7 for the numbers and
`docs/suno-prompt.md` for the brief that replaces it.

The two SUNO takes in `../archcanvas-promo-video/audio/source/` were analysed
and rejected: measurably darker (spectral centroid 612 / 657 Hz against 1386),
and their own licensing boxes are blank. Either reason alone was sufficient.

---

## 4. The ElevenLabs audition set — generated 2026-09-20, NOT releasable

The founder watched version A, liked it, and disliked exactly one sound: the
synthesised `pencil-line` that plays while the floor plan draws itself. They
asked for the whole palette to be generated with ElevenLabs instead, and put a
key in the main checkout's `.env`.

**The account is on the free tier.** Confirmed before anything was generated:

```
GET /v1/user/subscription
  tier                   free
  status                 free
  character_count        0 / 10000
  next reset             2026-10-09T06:27:12Z
  can_extend_limit       false
```

So this round is an **audition**, not a change of sound design. Free-tier output
carries no commercial licence, and — the clause this project has already paid
for once — rights are withheld from content created outside a paid subscription
*before or after*, so upgrading later would not license these files.

### What stops them shipping by accident

Not a note in a document. Four mechanisms, each tested:

1. **Per-asset provenance.** Every row in `sets.elevenlabs-audition` carries
   `provenance: { source: "elevenlabs", tier: "free", generatedAt, commercialUse: false }`.
   The tier is measured at generation time by the generator, not asserted here.
2. **`npm run verify:release`** refuses when any active audio asset has
   `commercialUse: false`. It calls `releaseBlockers()` out of `src/audio.ts` —
   the same module the film reads — rather than re-deriving the rule.
3. **`render.ps1` calls that gate before it renders**, not before it ships, so a
   refusal costs nothing. `npm run ship` calls it too, via `verify:strict`.
4. **The generator refuses `--set elevenlabs`** (the releasable set name) on a
   free tier, so a set that *looks* releasable cannot be produced by choosing a
   nicer name.

Audition renders are still allowed — they go to
`out/previews/AUDITION-not-for-release/`, which carries a standing notice
(`capture/audition-notice.txt`).

**The one thing none of this defends against is somebody editing
`src/data/sfx.json` by hand to say `commercialUse: true`.** That is deliberate:
the manifest is generated, the gate is data-driven so that a *paid* regeneration
flips it automatically, and there is no way to distinguish a hand-edit from a
legitimate one. The gate stops accidents, not decisions.

### What was generated

21 cues, 67.5 s, in six roles. Cost **685 credits of 10,000** (6.9%) — note the
docs say 40 credits/second but the account was actually billed about **10
credits/second**, so the budget guard was roughly 4× conservative. Ceiling was
70% of remaining; the plan printed before spending was 2,700 credits.

| cue | role | duration | peak dBFS | RMS dB | centroid Hz | align |
|---|---|---|---|---|---|---|
| `draw-a` | draw | 8.00 s | -3.0 | -22.2 | 8630 | start |
| `draw-b` | draw | 7.69 s | -3.0 | -23.9 | 8130 | start |
| `draw-c` | draw | 7.94 s | -3.2 | -20.0 | 8146 | start |
| `draw-d` | draw | 7.96 s | -3.0 | -23.6 | 10290 | start |
| `draw-e` | draw | 7.79 s | -3.0 | -27.2 | 9820 | start |
| `type-1` | type | 1.88 s | -3.4 | -31.5 | 5015 | attack +0.194s |
| `type-2` | type | 1.36 s | -3.0 | -31.5 | 8211 | attack +0.030s |
| `type-3` | type | 1.36 s | -3.0 | -29.4 | 4864 | attack +0.472s |
| `type-4` | type | 1.92 s | -3.0 | -30.9 | 6198 | attack +0.078s |
| `click` | click | 0.11 s | -3.0 | -21.9 | 2560 | attack +0.034s |
| `tick` | click | 1.00 s | -3.0 | -30.6 | 8808 | attack |
| `chip` | click | 1.00 s | -3.0 | -31.2 | 9727 | attack +0.060s |
| `move-in` | move | 0.63 s | -3.5 | -20.0 | 1087 | start |
| `move-out` | move | 0.31 s | -5.3 | -20.0 | 1357 | start |
| `pop` | appear | 1.00 s | -3.0 | -20.2 | 955 | attack |
| `pin-drop` | appear | 0.78 s | -3.0 | -27.9 | 5821 | attack +0.027s |
| `confirm` | appear | 1.48 s | -3.0 | -22.7 | 871 | attack |
| `sheet` | appear | 1.30 s | -3.0 | -27.2 | 8261 | attack +1.011s |
| `shimmer` | appear | 2.48 s | -3.0 | -21.6 | 9883 | start |
| `end-1` | end | 3.00 s | -3.0 | -16.9 | 133 | attack |
| `end-2` | end | 3.00 s | -3.0 | -22.0 | 854 | attack |

**Alignment** is recorded per cue because the obvious rule is wrong half the
time. The brief said to align the on-screen action to the sound's attack
(`cue.at = action.at − peakAtSec`), which is right for a transient and wrong for
a texture: `draw-e`'s loudest sample is at 7.0 s of a 7.8 s file, so
attack-aligning it would start the drawing sound seven seconds early. And for
transients the anchor is the **first strong onset** (−12 dB from peak), not the
global peak — `type-1`'s loudest key press is at 1.43 s of a 1.88 s cluster.

### The five `draw` candidates

The actual question. Five concepts, ~8 s each, judged in context rather than in
isolation: `tools/build-draw-audition.mjs` renders **one** silent 8-second
segment of the 30 s landscape cut (frames 120–359, 1280×720) and muxes five
different audio mixes onto the same video stream, so the picture is byte-identical
and any difference is the sound. Mixed at −8 dB, the level `src/cues.ts` already
uses for this cue.

`tools/build-audition-page.mjs` assembles `out/audition/index.html` — players,
prompts, spectrograms, and the current synthesised `pencil-line` alongside for a
fair comparison.

### Known imperfections, recorded rather than hidden

- **`sheet`** (the drafting-sheet landing) has its first strong onset at 1.011 s,
  because in that take the paper rustle is louder than the slap that a viewer
  actually sees land. It is honest to the take and probably wants regenerating.
- **Generation is not reproducible.** The sound-effects API exposes no seed, so
  the same prompt returns a different take. That is why the audio is committed
  rather than treated as a build artefact — and why a paid regeneration is a
  **re-mix, not a re-render**. Expect the takes to differ.
- **Nobody involved can hear any of it.** Every cue was checked with ffprobe,
  `astats` and a spectrogram, which rules out silence, clipping, DC offset,
  wrong length, and obvious speech or music where an effect was asked for. It
  cannot rule out "sounds wrong". That is the founder's pass, and it is the
  entire point of the audition page.

### If the answer is yes

```bash
# after upgrading the ElevenLabs plan
node tools/generate-sfx-elevenlabs.mjs --set elevenlabs     # refuses on free
node tools/use-sfx.mjs elevenlabs --draw <a|b|c|d|e>
npm run verify:release                                       # must go green
```

### If the answer is no

```bash
node tools/use-sfx.mjs synth
```

---

## How to re-run any of this

```bash
npm run audio:analyze      # measure the take in audio/source/
npm run audio:sfx          # rebuild all 14 cues + src/data/sfx.json
npm run audio:sfx:check    # do the files on disk still match their recipes?
npm run audio:beds         # plan -> cut -> measure -> src/data/music.json
npm run audio:all          # sfx + beds
npm run verify:assets      # every declared audio file exists; audio.ts self-check
npm run verify:release     # may these assets be rendered as a master?
node tools/use-sfx.mjs     # which sound set is active, and is it releasable?
npm run audition           # rebuild the five draw previews + out/audition/index.html
node tools/synth-sfx.mjs --spectrograms   # PNGs, for the next person who cannot hear either
```
