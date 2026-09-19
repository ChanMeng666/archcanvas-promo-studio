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
| **14 sound effects** | Synthesised offline by `tools/synth-sfx.mjs` (ffmpeg only) | **Clear.** No vendor, no account, no terms. |
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

## How to re-run any of this

```bash
npm run audio:analyze      # measure the take in audio/source/
npm run audio:sfx          # rebuild all 14 cues + src/data/sfx.json
npm run audio:sfx:check    # do the files on disk still match their recipes?
npm run audio:beds         # plan -> cut -> measure -> src/data/music.json
npm run audio:all          # sfx + beds
npm run verify:assets      # every declared audio file exists; audio.ts self-check
node tools/synth-sfx.mjs --spectrograms   # PNGs, for the next person who cannot hear either
```
