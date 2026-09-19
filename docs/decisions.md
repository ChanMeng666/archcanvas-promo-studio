# Decisions

What was decided on purpose, and what was deliberately **not** repeated from the two
earlier films. Written so the next person — or the next agent — does not spend a day
rediscovering an argument that was already had.

The earlier films are `../archcanvas-promo-video` (HyperFrames, 92 s, silent, ivory
paper, centred text cards, chronological demo loop, 16:9 only) and
`../archcanvas-promo-remotion` (Remotion, 75 s, one continuous camera pull-back across
an infinite canvas, told backwards, four aspect ratios). Read the second one's
`docs/decisions.md` before arguing with anything below. **Neither of them is to be
ported.** What is inherited is the engineering — the gates, the seconds-not-frames law,
`useLayout()`, the trap list — and none of the film.

---

## D1. The product is a coded replica, not a screen recording.

**Both earlier films are cut from capture.** OBS takes of the live product, cropped and
decimated: real, unarguable, and frozen. This one renders a **replica** — the product's
interface, rebuilt in plain CSS and React, driven as a pure function of time.

**Why, in order of how much each reason is worth.**

1. **A recording cannot be re-laid-out.** The vertical cuts here are a re-layout, not a
   crop: the composer stacks above the sheet the way the product itself does below `md`.
   A 1786×944 capture in a 1080×1920 frame can only be cropped, letterboxed or scaled,
   and all three read as an afterthought. The replica renders portrait natively.
2. **A recording goes stale silently.** The product's README screenshots have already
   fallen a whole redesign behind once, with nothing going red. The replica lives next
   to the real strings and real tokens in the product repo and is covered by the
   product's own copy tripwires: the strings change, the tests go red.
3. **One replica, two hosts.** The same source renders the landing page's 35-second loop
   and this film. A fix lands in both. That is the whole reason the replica is a pure
   `at(screenplay, t) → state` and not an animation: the web host drives `t` from a rAF
   clock, this repo drives it from `frame / fps`, and neither host owns the picture.

**What this costs, said out loud.** A replica CAN lie in a way a recording cannot — it
is code, so it can draw a number no compiler emitted. That is what `verify:numbers` and
the "everything on screen came out of the product" law exist for, and it is why the
drawlist is **baked from the real compiler** rather than hand-authored.

## D2. The replica is synced ONE WAY, with a lock file.

`src/replica/**` is a copy. The original is
`archcanvas/src/components/marketing/studio-replica/`, and **nothing in this repo may
edit the copy** — a fix goes upstream and comes back through `npm run sync:replica`.

`src/data/replica-lock.json` records every staged file's path, byte count and sha256,
plus the source commit and branch. `npm run verify:replica` re-hashes all of it and
fails on any difference, and also reports a file sitting under a synced root that the
lock does not name.

**Why a lock and not a submodule or a package.** A submodule makes the two repos share
history and invites a push in the wrong direction; the standing rule is that **these two
repos never share a git remote**. A published package would put a marketing component on
npm. A copy plus a hash ledger keeps the boundary one-way, keeps a fresh clone able to
render, and makes divergence a red gate instead of a thing somebody notices in six
weeks.

**Why the copy is committed, when the sibling film gitignores its `public/`.** Same rule,
opposite answer. There, a clone can re-sync from a sibling repo. Here the source is the
**private** product repo, and without the replica there is no film at all. So the bytes
are committed and the lock says where they came from.

**The failure mode this is aimed at.** The sibling film records it four times in one day:
*a gate whose input set can go empty reports success by doing nothing.* So
`sync-replica.mjs` treats every source path as required and refuses to write an empty
lock, and `verify-replica.mjs` fails on a missing lock, on a zero-row lock, and on a
lock that names no scannable replica source.

## D3. Four cuts, one scene library, EDLs in seconds.

There are not four films. `src/scenes.ts` is a library of eleven scenes; `src/cuts.ts`
holds one edit decision list per length, **in seconds**; `src/timeline.ts` is the only
file in the repo that turns a second into a frame.

`replicaFrom` / `replicaTo` time-warp the replica's own clock into a beat, so the same
source material runs at about 1.8× in the 15-second cut and about 0.4× — with pauses —
in the 120. The windows are the landing page's own chapter boundaries, so the film and
the website are literally showing the same seconds of the same screenplay.

`verify:timeline` asserts that each EDL's seconds sum to **exactly** its cut length, that
the derived frame counts are 450 / 900 / 1800 / 3600, that every scene in the roster is
used, and that `Root.tsx` still maps over `DELIVERABLES` with one derived length. A tenth
of a second of drift per cut is how a vertical master ends up a beat short of its music.

## D4. SFX provenance — **SETTLED 2026-09-19. The eight inherited cues are unusable.**

The eight ElevenLabs drafting-room cues are **not used and not copied into this repo.**
All fourteen sound effects in this film are synthesised offline by `tools/synth-sfx.mjs`.

**The evidence, because this question had three different answers on record.**
`../archcanvas-promo-remotion/docs/suno-prompt.md` carries a ticked box —
*"ElevenLabs — Sound Effects: paid tier, commercial use permitted · confirmed
2026-09-08"* — committed at 13:19 that day. At **16:38 the same day**, commit `490a306`
in the same repo deleted all twelve ElevenLabs assets, saying the key they were generated
on *"reports tier 'free', verified directly against `/v1/user/subscription`"*, and adding
that *"the first film's eight effects came from the same pipeline and are no longer staged
either."* The filesystem agrees with the commit: that repo's `public/audio/` holds one
file, `bgm.mp3`, and the directory is not gitignored.

The eight cues in question carry their own timestamp —
`../archcanvas-promo-video/audio/sfx-manifest.json` says
`"generatedAt": "2026-09-07T13:53:11.727Z"` — which is inside the window, and that film's
own licensing boxes were never ticked at all.

The current tier could not be read: the key in all three sibling `.env` files now returns
`401 invalid_api_key`. **That would not have settled it anyway** — rights attach to the
tier active when an asset was *generated*, so a paid answer today says nothing about
2026-09-07.

The brief said to treat them as unusable unless the record positively showed a paid plan.
It does not; it affirmatively shows the free one. Full chain: `docs/audio-provenance.md`.

**The replacement is not a compromise.** Fourteen cues, ffmpeg primitives only, every
noise source explicitly seeded, a sha256 of each filter graph in `src/data/sfx.json`, and
`npm run audio:sfx:check` to catch a recipe that changed without its `.wav` being rebuilt.
Ten consecutive full builds are byte-identical. Provenance is unambiguous *by
construction* — there is no vendor in the chain to have terms.

**The music is the one place the question can still arise**, and the ordering rule is
therefore restated where the founder will read it (`docs/suno-prompt.md`): be on the paid
plan **before** generating, not before shipping.

## D7. The bed is chosen by measurement, and it is spliced, not faded.

**Which take.** Three candidates were measured rather than auditioned:
`confident-arrival.mp3` has a spectral centroid of 1386 Hz against 612 and 657 for the two
`archcanvas-promo-video` takes, 22.4% of its energy above 2 kHz against 6.5% and 6.8%, and
the highest onset density of the three. The founder's direction was "bright, lively,
fast"; two of those three are numbers and the third — brightness — is a spectrum. Picking
a bed by adjective is how the sibling film ended up re-briefing a lullaby. The other two
also have blank licensing boxes, so two independent reasons reach the same answer.

**Why each bed is two pieces.** Every cut must start clean *and* end on a resolution, and
a window that does both does not exist: the take's good entries are not 15, 30, 60 and 120
seconds before its ending. So each bed is a **body** starting on a measured re-entry, with
the take's **own ending** — the final hit at 128.3 s and its ring-out — crossfaded on over
one bar with equal-power (`qsin`) curves. The arithmetic is `total = body + ending −
crossfade`, and the free variable that absorbs the remainder is the length of the ring-out,
because a decaying tail has no beat in it and can be trimmed by a fraction of a second
inaudibly. A bar of music cannot.

The alternative was a fade-out on all four. Rejected: a fade pulled down mid-phrase is
audible as a mistake once, and four of them across eight masters is audible as a habit.

**Nothing is hand-typed.** `tools/plan-beds.mjs` measures the take and writes
`audio/bed-plan.json`; `tools/prepare-bed.ps1` executes it; `tools/build-music.mjs`
measures what was delivered. The founder replaces the track with one command.

## D8. The downbeats are measured on the delivered mp3, never extrapolated.

A grid computed from the source tempo would be wrong, and it took measuring to find out.
On `confident-arrival.mp3` the best global beat phase **creeps about 0.2 s per 20 s
block** — so a grid extrapolated across the 120s bed is most of a beat out by the end,
four times the ±150 ms a scene boundary may snap within. A SUNO take is generated audio,
not a sequenced click track. Two further shifts compound it: the beds are **spliced**, so
the seam moves the grid, and MP3 encoder delay moves everything again by ~24 ms.

So `tools/build-music.mjs` decodes the shipped MP3 the way the browser will and reports
what is actually in it. The grid steps at the bar length measured over the ending region —
a median of *all* onset gaps reads low, because subdivisions halve it, and that error
produced bar lengths of 1.88–2.24 s against a true 2.36 s before it was caught. Each step
then advances from the position it **snapped to**, not from the ideal grid, so the list
follows the take's own drift instead of walking away from it. Result: 7/7, 13/13, 26/26 and
52/52 downbeats land on real measured onsets.

`snapToDownbeat` lives in `src/audio.ts` and returns `t` unchanged when the nearest
downbeat is further than the tolerance — past that the correction is felt as the edit being
in the wrong place, and the honest answer is to let the boundary fall off the beat rather
than drag the picture a quarter-second to chase the music.

## D9. Cues are WAV; beds are MP3.

MP3 prepends encoder delay — on the order of 1152 samples, about 24 ms, and decoder
dependent. On a 45 ms `click` that is half the sound arriving late, which is a sync bug
nobody finds by looking. The cues are therefore sample-exact WAV, and at 3–75 KB each that
costs nothing. The beds stay MP3 because a 120-second bed as WAV is 23 MB and git keeps
every version forever; their downbeats are measured on the decoded MP3, so the delay is
inside the measurement rather than unaccounted for.

## D10. Two ffmpeg bugs that produced correct-looking, wrong files.

Recorded because both were **silent** — right duration, right sample rate, right peak,
wrong sound — and both cost real time.

- **`amix` intermittently drops ragged inputs.** The swept cues were built as short noise
  grains positioned with `adelay`, giving sixteen inputs of different lengths. On roughly
  one build in six, `whoosh-in` or `whoosh-out` came out the correct total duration with
  only the first grain audible — about 17% of the sound — from byte-identical inputs. The
  fix is to give `amix` nothing ragged: every grain is now a full-length source positioned
  by `afade` start times (`afade=t=in:st=X` is silent before X, so it places a grain exactly
  as `adelay` did), and `assemble()` pads every layer to the cue's longest with `apad` +
  `atrim`. Ten consecutive builds are now byte-identical.
- **`silenceremove` was blamed first, and replacing it did not fix it.** That is the useful
  half of the story: the trim was rewritten to measure the last audible sample in Node and
  cut with `-t`, which is deterministic and one pass shorter, and the collapse happened
  again — which is what finally pointed at the mixer. The in-Node trim was kept anyway.

The collapse guard that caught both is still in `buildCue()` and stays there. A guard that
has caught a real failure once is not removed because its cause was fixed.

**The general lesson, which is this project's own rule restated:** every number about these
files was right while the files were wrong. Length, sample rate, peak and loudness all
passed. What caught it was looking at a spectrogram — and what caught the *intermittence*
was running the build ten times instead of once.

## D5. This film cuts. The last one did not.

The sibling film is one continuous camera move and has no cuts at all — that was its
whole idea, and porting it would produce a remake. Here the unit is a **beat**: a fast
cut on `Easing.out(cubic)` over about 0.28 s, with one push-in per chapter in the 60s
cut and kinetic type cards between.

Two consequences that are easy to miss:

- **The flash gate matters here and did not there.** A continuous pull-back physically
  cannot strobe. Cutting between a full-bleed card and a bright drawing can, so
  `verify:flash` runs on **every one of the eight masters**, and `capture/check-flash.mjs`
  deliberately has no default filename — a default is how seven go unchecked.
- **No camera flying over a world.** The push is a single scale multiplier per beat, not
  a rect. A cut-based film that also flies the camera around reads as two ideas fighting.

## D6. Eight masters, rendered sequentially, on a 16 GB box.

Four lengths × two aspect ratios. `render.ps1` renders them one at a time at
`--concurrency=2`, and scans for this project's own orphaned Remotion processes **before
the run and between every master** — printing, never killing, because a human decides.

The numbers behind those choices are the sibling film's, paid for in real time: three
killed renders once accumulated **5.3 GB across 18 orphaned processes**, which then got
the next render killed for memory — a loop that reads as "the film is too heavy" and is
not. And `will-change: transform` on a large transformed layer asked Chrome for a
22,250 × 22,881 px backing store and killed renders with 5.4 GB free. **When more memory
does not help, the problem is not memory.**

`verify:replica` greps the synced replica for `will-change` for exactly that reason,
even though the replica is upstream's code — because the render that dies is ours.
