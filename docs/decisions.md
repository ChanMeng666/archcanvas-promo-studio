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

---

# WP-9 — the film, made

## D7. The replica is mounted once, and everything else asks `camera.ts`.

`<ReplicaSlot>` is three `div`s. Where the replica sits, what second of the
screenplay it shows, how far the camera is in and what it is aimed at all come
out of `shotFor()` in **`src/camera.ts`**, which is React-free and Remotion-free
on purpose: `capture/verify-honesty.mjs` bundles it and asks, at real sampled
frames, where the honesty caption's box actually lands on screen.

That is the difference between a gate that checks the film and a gate that
checks a re-derivation of the film. `verify:timeline` already proved the caption
was **scheduled** for three seconds in every master; once the camera could frame
at 1.5x on a point of its choosing, scheduled and visible stopped being the same
claim.

**Mutation evidence.** Disabling the protected-rectangle clamp (`if (false &&
overlaps(...))`) turns `verify:honesty` red immediately with `[cropped]` on six
masters, `[pill]` on two and `[floor]` on one — the caption slides out of frame
and, on the 30 s cut, out of frame long enough to break the three-second floor
as well. Raising `HONESTY_MIN_SEC` to 8 reddens all eight with `[floor]`, which
proves the seconds are measured rather than asserted. Re-wording the film's copy
of the sentence reddens `[drift]`.

## D8. `translate + scale`, not `scale` about the focus.

The first camera scaled about a `transform-origin` at whatever the beat was
about. It is tidier arithmetic, it guarantees coverage for free, and it is
wrong: **scaling about a point leaves that point exactly where it already was**,
so the camera magnified and never aimed. One still showed it — the edit beat
pushed to 1.5x on the kitchen and left the kitchen in the right-hand third with
half the frame empty, because the kitchen had been in the right-hand third at
1.0 too.

The transform is now `translate(tx, ty) scale(s)`, and the three things the
frame owes are three constraints on the same pair of numbers: coverage (never
expose the page behind the picture), protection (the honesty caption, and the
"AI-generated" pill whenever a rendering is on screen), and aim. **The aim is
what gives way**; the scale gives way before either. `RECENTRE = 0.8` rather
than 1: a subject nailed to the exact centre of every shot reads as a slideshow
of centred screenshots.

**The protection is decided per BEAT, not per frame.** The caption's box is 92 %
of the portrait design box's width, so protecting it caps the push at about 1.06
— correctly. Applied per frame, that cap appeared the moment the caption did and
vanished the moment it faded, so the 9:16 draw beat sat wide for four seconds
and then lurched 35 % closer in the last half-second.

## D9. The film draws the LANDING payload, not the as-issued sheet.

Both are synced. The choice was made by looking.

`drawlist.json` is the as-issued sheet: A3 paper, title block, schedule, legend —
the "real product" artifact, and the more impressive object in principle. Its
`viewBox` is 21000 x 14850 mm and the townhouse is 7800 x 9200, so **the building
occupies about a third of the page's width**. Mounted in the replica's own sheet
box — which is itself about a third of the 1600-unit design box, because the
product leaves canvas around the paper for the finding cards and the floating
panels — a room label came out around four pixels tall at 1920. That is not a
legibility problem to be tuned; it is the wrong artifact for a frame.

`landing.json` is the same compiled geometry with the sheet taken off and **the
dimension chains kept** — "a real, dimensioned floor plan" is the claim, and a
demo with the chains removed would be a different one. It is also what the
replica's sheet fit, `CAMERA_ENVELOPE` and pin anchors were tuned against
upstream, so every camera number in the synced screenplay means what it says.

The as-issued payload stays synced because it is `verify:numbers`'s **record**:
a number on screen has to be a number some drawing in this repo produced.

## D10. The second brief is four other plans, not the same one re-framed.

The 120 s cut is the only one that can answer "is this one canned demo?", and
the only honest way to answer it is to draw a different building. So the
`second-brief` scene is a montage of four of the product's own **published**
showcase plans — a family house, a courtyard flat, a neighbourhood clinic, a
bedsit — each drawing itself out under the brief it was actually given.

- They are baked at sync time by the **product's own page parser**
  (`parsePageSvg`, imported out of the source checkout's
  `scripts/generate-studio-demo.mjs`), not by a second SVG reader written here.
  That parser throws on any construct it does not recognise, so a compiler that
  starts grouping under a transform stops the sync instead of quietly baking a
  plan that draws in the wrong place.
- They are drawn by the product's own `PlanSvg`, with the replica's own state
  taken from a point inside its own `drawPlan` beat — so the layer order and the
  band overlaps are not restated, and two drawings in one film cannot draw
  differently.
- **The only words are each plan's own brief and its own title.** "Different
  brief. Same flow." is not cleared copy, and the four briefs make the point
  without anyone having to say it.
- **Inline SVG, never `<Img>`.** More than about twenty `<Img>` elements in one
  object never finish rendering in Remotion.

The scene's `replicaFrom`/`replicaTo` are **plan indices**, not screenplay
seconds. It reuses the window machinery rather than growing a second field,
because every gate already understands a replica beat's window.

## D11. Colour rhythm without relitigating the violet.

> **Superseded twice and back again — see D22 and then D24.** The conclusion
> below is the one that stands; what changed is that it was overturned on
> instruction and then restored.

The brief asked for "occasional full-bleed colour cards (plum with ivory type)".
`tokens.ts` says the opposite in as many words — *violet is a SPOT colour, never
a field and never a fill behind a paragraph; the founder's standing objection to
large flat violet is on the record and this film does not relitigate it* — and
that rule is founder-sourced and the stronger authority.

So the film gets its colour rhythm from **aubergine** (`#3C315B`, the marketing
band palette's own, already a shipped surface, ivory type on it at 9.6:1). One
card takes it: `price`, which is the film's money line. Violet stays a spot —
the accent rule on a card, the caret, the pin heads, the chapter chip's dot —
with exactly one exception, the end card's plum band, which is a **field for
nine frames and then gone**, i.e. a transition and not a page of flat violet.

**This is a deviation from the work package and it is flagged as one.** If the
founder wants the plum card after all, `scenes.ts` grows a third `tone` and one
card changes; nothing else does.

*(It was asked for, built, and withdrawn again: D24.)*

## D12. The cue sheet is derived from the picture, frame by frame.

A key click because a character appeared; a tick because the slider stepped onto
another baked variant; a pin drop because that pin landed. `src/cues.ts` walks
each cut frame by frame, asks `at(screenplay, t)` what the product looks like,
and emits a cue wherever something changed.

Not taste — arithmetic. The same 35 seconds of screenplay run at **2.50x in the
15 s cut and 0.46x in the 120 s one**, so a hand-placed timestamp that fitted one
cut would be wrong in the other three by construction.

Two judgements sit on top of the derivation and both are named constants:
`MAX_KEYS_PER_SEC = 14` (at the 15 s warp the brief types at about forty
characters a second, and forty transients a second is a buzz, not typing) and
`MAX_SIMULTANEOUS = 4`.

**The bug the density check found.** The change detectors were seeded from zero
at the start of every beat, so the 30 s cut's render beat — which opens with all
three review pins already down — read three pins landing and dropped three pin
cues on top of the cut. Six pin drops in a film with three pins. They are now
seeded from the state at the beat's own first frame.

**Mutation evidence.** Setting the thinning gap to 0 reddens `verify:audio` with
`[too-fast]` on all four cuts; renaming a cue's file in `sfx.json` reddens it
with `[missing]`.

## D13. One clock, and the beat grid is inside it.

The scaffold resolved the cut **twice**: `Film.tsx` called `resolveCut(cut,
BEAT_GRID)` while `TIMELINES` — which `beatAtFrame`, the honesty windows and now
the cue sheets all read — was resolved with no grid. That is two clocks, and the
state it produces is a picture that cuts on the bar and a sound sheet derived
from boundaries a frame or two from where the picture actually cut.

`timeline.ts` now imports the grid through `src/data/music-grid.ts` and everything
reads `TIMELINES`. The grid is still derived from the delivered mp3 and never
hand-written. Snapping moves few boundaries — the beds run about 2.36 s to the
bar and the tolerance is 150 ms — and `verify:timeline` prints how many moved.

## D14. The picture's margins are not the type's.

`SAFE` is a rule about where a reader can read a **sentence**: on 9:16 the top
250 px and the bottom 390 px belong to Reels, TikTok and Shorts. A *picture*
behind the top of a share sheet is a picture with its corner covered, and
mounting the replica inside the type-safe area cost it real size — which on this
film is the difference between a room label a viewer can read and one they
cannot.

`layout.picture` is the looser box the replica mounts into: **7.9 % larger than
the type-safe stage at 1920x1080, and 16 % larger at 1080x1920**. A `split`
scene's picture half comes out of `picture` and its line half out of `stage`, so
each gets the box its own rule is about — and the picture half is **clipped**,
because the camera scales the whole layer and a 1.34x push spilled the drawing
straight through the band the line sits in.

## D15. A framing scale, because a push alone could not carry the money shot.

`scenes.ts` declared `camera: { to: 1.03 ... 1.12 }` — the camera's MOVE over a
beat — and nothing about where the camera STANDS. Mounted to fit and pushed by
those numbers, the drawing came out 636 px tall in a 1080 px frame.

`camera.frame` is the standing scale and `camera.to` is still the push; they
multiply. Every value was read off a still, one shot at a time, and every one is
clamped by `framePush` against the protected rectangles.

The one scene that wanted to go the other way is `brief`. Framed at 1.22x on the
composer card it produced a line of type floating in an empty ivory field: the
product's own card is ivory on ivory with a 1.3:1 hairline — deliberately, its
borders are dividers rather than controls — and at that magnification the
hairline is gone and the card with it. There is nothing to fix upstream. The
beat shows the **application** instead, inside the film's own rounded, shadowed
window, and pushes in gently.

## D16. The motion language, in five lines.

1. **Cards reveal, they do not fade.** Each line rises out of its own clipped
   band on `Easing.out(exp)` over 0.28 s, staggered a third of that, under a
   plum rule that wipes in from its own edge.
2. **Every shot arrives.** A replica beat enters on a 1.045 -> 1.0 scale-through
   over 8 frames, folded into the push so the same clamp governs both — a
   translate would have slid the honesty caption off the edge for four frames.
3. **The ground is never still.** The product's own dot lattice drifts about two
   pitches a minute, behind the picture and behind every card, so a held frame
   of a held interface is alive without anything moving in it.
4. **The chapter says its name.** A chip in the product's own vocabulary (the
   replica's `CHAPTERS` labels) pops on the cut with a `pop` under it.
5. **Colour is on screen throughout, and changes with the chapter.** The stage
   behind the window carries the chapter's own colour — ivory, periwinkle,
   buttercream, mint, aubergine — the split bands take it too, the cards
   alternate paper / aubergine / plum, and the montage gives each of its four
   plans a stage of its own. The window keeps the product's true ivory, because
   it is a picture of the product.

   ⚠ This line used to read *"colour arrives once and leaves"*, which was the
   opposite of the brief and an accurate description of what the film did. It is
   here as a correction rather than a rewrite: the first cut was twenty-eight
   beige frames out of thirty and the motion language said so without noticing.

**The entrance opacity has a floor, and the motion check is why.** Extracting
every third frame of a five-second segment showed **one fully blank ivory frame
at every cut** — the first frame of each beat, at opacity 0. On a strip that
reads as a stutter; in motion it is a blink between two shots that are meant to
cut hard. `ENTRY_OPACITY_FLOOR = 0.72`: a one-frame dip to 0.72 is an arrival, a
one-frame dip to 0 is a dropped frame. The montage's pane entrance had the same
shape and the same fix.

## D17. What the three look-fix passes actually changed.

Kept as a record because every one of these was invisible to a green gate.

**Pass 1, the first six stills.** The drawing was 636 px tall in a 1080 px frame
(→ D15, `camera.frame`). The camera magnified without aiming (→ D8). The film's
lattice and the replica's met at the window edge as two dot grids of different
sizes, so the ground moved inside the push. The brief beat was a line of type in
an empty ivory field, so it became the whole application (→ D15).

**Pass 2, 30 s in both aspects and 120 s landscape.** A 1.34x push spilled the
picture through the band the split line sits in — "…and a written list of
everything we couldn't get right." lay across the product's own command bar; the
picture half is now clipped (→ D14). The montage was a head of three lines over
a near-square plan fitted to what was left, 837 px wide in a 1920 px frame; it
became two columns (→ D10). The portrait push lurched 35 % in the last
half-second of the draw beat (→ D8, per-beat protection).

**Pass 3, the contact sheets.** The brief beat was three consecutive pale,
near-identical seconds — the flattest stretch in the 30 s cut — so its push went
from 1.09 to 1.16 and now ends inside the card. The chapter chip read as a label
ON the plan in 9:16, where the replica goes edge to edge; it got a shadow. And
the 60 s and 120 s sheets tiled as a single frame on a black field, because
ffmpeg's `image2` demuxer stops at the first gap in a `%03d` sequence and the
long cuts sample every 2 and 4 seconds — the frames are now named by contiguous
index with the second as a suffix.

**And one trap paid for on the way.** A full sweep of forty-eight stills through
ONE browser session dies part-way with `net::ERR_INSUFFICIENT_RESOURCES` on a
`fonts.gstatic.com` fetch, surfacing as a bare `[NetworkError: A network error
occurred.]` that takes the run down with it. `@remotion/google-fonts` fetches the
two faces on every page. The sweep is run per composition instead — same shape as
the memory trap, where the failure names one thing and the cause is the count.

## D17b. The replica's follow-up, re-synced.

`origin/feat/studio-replica` at `20ce8c8` (PR #211). No exported signature
changed, so the mount did not move — but two things in it did reach this repo.

**The drafting beat grew from 3.8 s to 4.3 s.** The sheet is now still up when
`drawPlan` starts underneath it, so it hands over rather than cutting. Two
consequences here:

- `DRAW_HANDOFF_SEC` was a literal `9.3` in `cuts.ts`, and all four EDLs split
  the draw chapter on it. The second did not move this time; **nothing in this
  repo would have noticed if it had.** It is now derived from the synced
  screenplay's own `drawPlan` beat (`honesty.ts`), which is where the caption's
  numbers already came from.
- The draw scene's camera framed "the sheet, plus the drafting card while it is
  still up" from `state.drafting.visible`, per frame. With the card outliving
  the first strokes by half a second, that framing would have snapped from
  card-and-sheet to sheet-alone in the middle of the money shot's opening. It is
  now decided from the beat's own window against `DRAFTING_SPAN` — the same
  per-beat rule the protected rectangles already use (D8).

**Every card and pill border was silently missing upstream** (a `max()` with a
container-query unit inside the `border` shorthand). They are 1 px again, and
the final stills are visibly crisper than the ones the look passes were done on.

That partly retires the observation behind D15 and it is worth saying so rather
than leaving the note reading as if it still held: the composer card DOES have a
visible edge now. **The wide framing stays**, for a better reason than the one
that produced it — Act I is no longer a card floating on a page, it is a
designed page, with a "Your Projects" heading and a line under it that a 1.22x
framing on the card would crop. The beat now shows a product someone could
recognise, which is what the shot was always trying to do.

The SFX cue sheets needed no change: nothing in `cues.ts` names a second. They
are derived by walking the cut and asking the fold what the product is doing, so
a beat that moves moves the sound with it.

## D18. A gate on the blank first frame.

`capture/verify-opening.mjs`. Every entrance in this film was written as "start
at nothing and arrive" — opacity from 0, a masked line translated out of its
band, a montage pane at 0 — and together they meant **the first frame of every
beat was blank**: one frame of bare ivory on every cut in every master. In motion
that is not an entrance, it is a dropped frame.

It was found by rendering a five-second segment and laying every third frame out
as a strip, which is a thing you do once. The gate is what makes it a habit: it
samples the opening of **every beat of every cut** and asserts the frame carries
ink, reading the same pure functions the components call (`entryOpacity`,
`MONTAGE_PANE_ENTRY_FLOOR`) rather than pixels — 60-odd renders and an
indefensible threshold on an ivory film is not a gate anyone would keep.

One honest weakness, stated rather than hidden: the card branch MIRRORS the
reveal's opacity instead of importing it, because the reveal is a clip plus a
translate and no shared module owns it. The mutation evidence is what keeps the
two in step.

**Mutation evidence.** `ENTRY_OPACITY_FLOOR = 0` reddens it with `[blank]` on
every replica and split opening in all four cuts; `MONTAGE_PANE_ENTRY_FLOOR = 0`
reddens the two `second-brief` beats. Both restore green.

## D19. The honesty caption is handed over, never doubled.

The 15 s cut's time warp leaves the product's own caption readable for 2.67 s,
under the three-second floor, so the film draws the sentence itself. The scaffold
placed that band **starting where the replica's own caption starts**, reasoning
that "a subtitle restating an on-screen caption is ordinary film language and
reads as emphasis, not as a duplicate".

It does not. The still pass caught the product's dark in-app pill and the film's
band 115 px apart carrying the identical sentence. That reads as a rendering bug.

It only became obvious after the replica's follow-up restored the 1 px borders
that had been silently missing upstream — which is its own lesson: **a look pass
done on a build that is not quite the shipping one can miss the thing it was for.**

The band now **ends where the replica's caption becomes visible at all**, so the
two are sequential and adjacent: the film carries the sentence up to the second
the product takes it over, with no frame showing both. Two details are load-
bearing:

- The handoff is at the caption beat's **start**, not at its opaque core's. The
  product's caption spends the first 10 % of its beat fading in, and handing over
  at the core's start left four frames with the band still up and the pill
  already at a quarter opacity.
- The band **does not fade out**. A fade at the join is the one place a dip would
  break the continuous run the floor is measured on.

`verify:honesty` measures the **union** of the two sources — the longest
continuous run in which the sentence is fully opaque, whichever component drew it
— and fails on a **single** doubled frame. Measuring either source alone would
under-count by exactly the handoff.

**Mutation evidence.** The doubling check found the defect it was written for on
its first run: four frames in each 15 s master, before the handoff was moved. The
floor check still reddens all eight at `HONESTY_MIN_SEC = 8`, and the crop check
still reddens six at `[cropped]` with the protected-rectangle clamp disabled.

## D20. Two more things the contact sheet showed, after the re-sync.

**The export chapter was playing the landing loop's fade-out.** The screenplay is
35 s and ends on a fade to nothing, because the landing page LOOPS. A film does
not loop — it cuts to its end card — so an export beat whose window ran to 35
spent its last 0.57 s watching the product dissolve, and the 15 s and 60 s sheets
had a near-empty cell immediately before the end card. The EDLs now end the
chapter at `LOOP_FADE_SEC`, derived from the `loopFade` beat.

**The first frame of the whole film was bare.** It is a card's first frame, and a
card's line is behind its mask on frame 0 by design — so with the accent rule
also starting at zero width there was nothing on it. A thumbnail, a scrub and the
first cell of every contact sheet all land there, and an empty ivory rectangle
reads as a missing asset. `CARD_RULE_FLOOR = 0.18` gives the frame a short plum
mark to open on, and `verify:opening` checks it.

**Mutation evidence.** `CARD_RULE_FLOOR = 0` reddens every card opening in every
cut. Putting the export windows back to 35 is shown by the timeline's own
derivation: 0.57 s of a 2.50 s beat playing a dissolve.

**And the tiling moved out of the render.** It used to run at the end of
`stills.mjs --sheet`, in the same process: a thirty-frame batch died on its
twenty-ninth frame and took the tiling of twenty-eight perfectly good frames
with it. `capture/tile-contact.mjs` (`npm run stills:sheet`) reads whatever is on
disk, so a batch that dies part-way still produces a sheet and a re-run only has
to fill the gap. A step that takes seconds and depends only on files should not
be downstream of one that takes minutes and can fail.

## D21. The protection is bounded by the CLIP, not by the frame.

The 9:16 export beat showed "Export the DXF." over a menu whose DXF row had been
cut off — the film's line naming the one thing the frame had cropped.

The export menu is the subject of that beat, and in portrait it is the product's
full-width bottom SHEET. Two things were wrong and both are now fixed in
`camera.ts`:

- **It was not protected at all.** `framePush` knew about the honesty caption and
  the "AI-generated" pill; the menu is the third thing a shot may not crop, and
  it is protected on its own beat.
- **Protection was measured against the FRAME.** A `split` scene clips the
  picture at the top of its type band, so a rectangle comfortably inside the
  frame can be entirely below that clip. `protectBounds` is that clip; coverage
  still uses the whole frame, because coverage is about the page behind the
  picture and protection is about what a viewer can see.

The 9:16 export shot is now clamped twice over — the scale down to 1.16 by the
menu's full-bleed width, and the translate to −230 px by its height against the
clip — and the whole menu is on screen. The 16:9 shot is unclamped at 1.38,
because there the menu is a small anchored popover.

## D22. The art-direction pass: bigger UI, a colour script, hero type.

The first cut read correctly — what, draw, say the change, receipt, render,
price, end — and was not the film the brief asked for. The review named three
things and all three were real.

**The UI was about a quarter of the picture.** Two causes. `camera.frame` was a
SCALE, and a scale means something different at 1920x1080, at 1080x1920 and
inside a split scene's shorter box, so one hand-tuned number framed well in one
composition out of eight. And the money shot aimed at the PAPER: the drawing is
about two thirds of the sheet, so framing the sheet to 85 % put the building at
56 %.

`camera.fill` is a FRACTION — "the thing this beat is about spans this much of
the frame" — and `camera.ts` derives the scale from that rectangle's real size in
the composition being rendered. The draw scene aims at `buildingBox`, the union
of the page's own room boxes, which is static across the beat so a half-drawn
plan is framed for the plan it will be. `to` may now be **below 1**, so the money
shot pushes in on the drawing and pulls out to reveal the studio as the last
strokes land, and the receipt beat opens tight enough to read the finding and
eases back to show what the finding is about.

**The caption had to follow the shot.** At that framing the product's own caption
is below the frame edge. Protecting it would cap the push at about 1.2 and hand
the problem straight back, so the `draw` scene declares `filmCaption`: the FILM
draws the sentence in its own band, above the camera, where nothing can crop it.
All four cuts now carry it that way, 3.20 s to 9.40 s.

The obligation did not move — it got sharper. `framePush` grew an `expel` rule
that RAISES the scale until the caption is genuinely off screen, because "push it
further" is not something a hand-tuned number can promise across eight
compositions. And `verify:honesty` now fails on the state that would actually be
wrong: a caption half in frame. Whole, or gone.

**Twenty-eight of thirty frames were beige.** The stage behind the window takes
the chapter's colour — ivory, periwinkle, buttercream, mint, aubergine, deep
periwinkle, soft buttercream — and the window keeps the product's true ivory,
because it is a picture of the product and a tinted one would be a lie about it.
Cards alternate paper / aubergine / plum.

Two things about that. The tints were mixed at 28 % and 22 % first, and the
stills showed why that is not enough: at the framings the money shot uses the
stage is a sliver either side of the window, and a 28 % tint in a sliver is
white. **A colour script has to be legible in the frames that show least of it.**
And the plum card overrode `tokens.ts`'s standing note about large flat violet
because the art direction asked for it explicitly. **That lasted one round: D24
withdrew it.** The card is buttercream, the note is back, and the episode is
recorded rather than tidied away.

**Type was timid.** A card's measure was `maxContent`, which is the width a block
of RUNNING type may use; a card is one or two lines meant to carry the whole
frame. It now gets the safe area less a margin, `TYPE.hero` is 190, and each line
rises word by word out of a clipped band rather than fading. The end card's
lockup is bigger with the URL as the largest element after the mark, because the
URL is the call to action.

**Mutation evidence for the two new checks.** `verify:opening` computes the
contrast ratios rather than trusting `CONTRAST_PAIRS`, and checks the first word
is up at frame 3 off the same constants the component eases with — lengthening
`WORD_RISE_SEC` past 0.1 s reddens every card in every cut.

### D22a. What the second contact sheet found

The colour script and the framing landed; two frames did not.

**The receipt beat opened on empty canvas.** The finding card sits on the canvas
BESIDE the paper — correctly, so it does not cover the room it is about — so a
frame holding only the card and its pin is mostly empty canvas with a sliver of
drawing at one edge. The focus now also takes half the building around the pin:
enough drawing to see what the finding is about, without widening the shot to the
point where the sentence in the card stops being legible.

**The receipt beat lurched, twice, for the same reason.** `pinAnchors` reads the
findings off the state, and the state has none until the pins start dropping a
second into the beat — so the shot opened wide on the sheet at 1.9x and snapped
to 4.5x the instant they appeared. It is framed against `DEMO.findings` and the
screenplay's own `openPin` index now, so the framing is a decision about the
SHOT rather than a reaction to its subject arriving. The 120 s cut's two-beat
structure then comes out as the two shots it was written as: wide on the three
pins landing, then close enough to read the one that opens.

**The stage barely shows on the closest framings.** At the money shot's 85 % the
window covers the frame and the coloured ground is a sliver either side. That is
the trade the framing was asked for, and it is why the colour lands mostly on the
cards, the split bands and the wider beats. The 60 s sheet is the one that shows
the script whole: ivory, aubergine, buttercream, mint, aubergine, periwinkle,
buttercream, plum, ivory.

## D23. Per-BEAT expulsion, and the pace ceiling.

**The caption expel cropped the drafting card in 9:16.** Expelling the product's
own caption raises the scale until it clears the frame — 1.64x in portrait — and
the drafting half of the draw chapter wants a scale of about 1. Applied to the
whole `draw` SCENE it cropped the drafting card on both sides: the still read
"…fting…", "…storey Townhouse", "…ng every route…". Unreadable, and obviously
wrong.

So only the half that is the money shot expels. `ResolvedBeat.expelsCaption` is
derived in `timeline.ts` from the beat's own window against `DRAW_HANDOFF_SEC`,
and both the camera and `honestyWindowFor` read that one value. The film's band
then runs over exactly the beats that expel — edge to edge, no wider — so the
product's caption carries the drafting beat and the band carries the money shot,
and the two are never on screen together.

**The handover is a HARD cut, not a fade.** A fade at the join costs a quarter
second in which neither is fully opaque, and the floor is measured on a
continuous run: the 15 s cut came out at 2.60 s that way with 3.23 s of sentence
actually on screen. A hard swap of one identical sentence for another, on a cut
where the whole frame changes anyway, is invisible.

**The floor is measured on `coveredSec`, not on the band.** Both
`verify:timeline` (from the derivation) and `verify:honesty` (frame by frame
through the real camera) measure the continuous seconds the sentence is on screen
from either source, and they agree: 3.23 / 4.22 / 4.96 / 8.71 s.

**And nothing holds still.** `verify:opening` grew a pace check: no beat may hold
longer than 2.5 s without the camera moving (scale changing by more than 3 %) or
the product doing something (more than 0.4 s of screenplay playing). 46 beats
checked. Parking the camera on the 30 s cut's edit beat reddens it.

### D23a. The colour wipes off on the cut

The stage changes colour on the chapter boundary. Cut straight, that is one
colour followed by another — correct, and inert. `ColourWipe` slides the colour
the cut is LEAVING off the frame over eight frames, alternating direction by beat
index so a run of chapters does not read as one gesture repeated.

It sits ABOVE the new ground and BELOW the window, which is the whole trick: the
product is on screen from frame 0 of the beat and what moves is the colour behind
it. A wipe over the whole frame would hide the studio for eight frames on every
cut — the opposite of fast. It is skipped when the two colours match, because a
wipe of ivory over ivory is eight frames of nothing.

`groundOf` is the one table both the router and the slot read: two copies of
"what colour is that scene" is how a wipe ends up wiping the wrong colour off.

### Where the framing actually landed

Measured through the real camera, start → end of beat, as a fraction of the
frame. The 9:16 money shot is width-limited: the building is 7800 × 9200 mm, so
90 % of a 1080-wide frame IS 60 % of its height, and pushing further would crop
the plan.

| beat | 16:9 | 9:16 |
|---|---|---|
| typing — composer card | 67 → 69 % W | 90 → 93 % W |
| drafting card | 84 % W | 89 → 91 % W |
| money shot — the building | 86 → 90 % H | 86 → 90 % W (60 % H, the geometric max) |
| edit — kitchen + command bar | 91 → 94 % H | 91 → 94 % W |
| receipt — pin + open card | 83 → 89 % W | 83 → 89 % W |
| render — sheet + rendering | 89 → 94 % W, 95 → 98 % H | 95 → 98 % W |

End card: the wordmark is 47 % of frame width in 16:9 and 71 % in 9:16, with
`archcanvas.uk` at 13.2 % of the mark's width — the largest element after it.

## D24. The plum card was tried and withdrawn.

D11 recorded that the work package asked for full-bleed plum cards and that
`tokens.ts` says the opposite, on the founder's standing objection to large flat
violet — and that the objection was the stronger authority, so the colour card
was aubergine.

D22 reversed that, on the art direction's explicit instruction, and the film
carried one full-bleed plum card on the price line.

**This reverses it back, and the reason is worth keeping rather than tidying
away.** The objection is a founder decision recorded before either instruction;
an art-direction note is a strong signal but not a licence to overturn one. The
correct move on the first reversal would have been to build it AND say plainly
that it contradicted a standing decision — which the PR body did, which is how it
came back. The process worked; it worked one round slower than it should have.

So:

- **The price card is buttercream** (`#FFFFC4`) with obsidian type at 18:1. It is
  the "you pay" moment, and warm and light suits it better than loud ever did.
- **`CardTone` has no `plum`.** `paper` / `deep` / `bright`.
- **The end card's wipe is a BAND**, a fifth of the frame wide, sweeping once on
  the `end-hit`. It used to be a full-bleed fill for nine frames, and a standing
  objection to large flat violet does not have a nine-frame exemption.
- **Violet is a spot again**: rules, the chapter chip's dot, the caret, pin
  heads, the sweeping band. Roughly a seventh of a frame is the ceiling.
- Aubergine stays on one card and the receipt band. The live marketing site
  already ships aubergine bands; nothing new is being claimed for it.

`tokens.ts` carries the note again, with the round trip in it, so the next person
who reaches for a violet field finds out here rather than in review.

## D25. The rest of the art-direction round: caption size, frame 0, per-aspect expulsion.

Three smaller items from the same review, each with a gate so none of them can
come back quietly.

**The film's own caption sets at 1.42× `TYPE.caption`.** It was 1.15, which under
the money shot's drawing read as small print — the wrong register for the one
sentence in the film whose entire job is to be read. At 1.42 it is 36 px at 1920
wide and 41 px at 1080 wide portrait. The number lives in `src/caption.ts`, alone
in a React-free module, because `capture/verify-opening.mjs` asserts the floors
(30 px landscape, 34 px portrait) and the gates bundle only React-free code. A
constant a gate reads cannot live inside a component.

**Frame 0 is a designed frame.** Platforms pick it for the thumbnail. D20 had
already raised the card's accent rule off zero so the frame was not bare; a tiny
plum dash on ivory is still not a frame anyone would have chosen. The rule now
opens at 0.62 of its width and the first word is 50 % out of its mask
(`WORD_FLOOR`), so the opening frame is a composition and the reveal still reads
as a reveal — the remaining half happens in three frames.

**The caption expulsion is decided PER ASPECT.** D23 made it per beat, which was
right, and then applied the same fill threshold to both frame shapes, which was
not. The replica letterboxes in 16:9 (a 1600×1000 design box against 1.78) so a
tight fill costs a real push and the studio's caption rides up over the drafting
sheet's own text; it FILLS a 9:16 frame (1000×1333 against 0.56) so the same fill
needs no push and the replica's own layout holds. Expelling in portrait anyway
costs a 1.61× push, and at 1.61 the drafting card came back at **142 % of the
frame width** — cropped on both sides, in the cut whose whole job is to show a
plan being drawn. `CAPTION_SAFE_FILL` is now `{ landscape: 0.72, portrait: 1.01 }`
and `timelineFor(cut, aspect)` / `honestyWindow(cut, aspect)` resolve both. Only
`expelsCaption` differs between the two; lengths and boundaries are identical,
and `verify:timeline` asserts that.

## D26. `verify:framing` — the subject has to fit the frame, and the card has to fill one.

The 142 % crop was found by looking at a contact sheet, for the second time. A
green timeline and a green honesty gate both said nothing, because the caption
they check was perfectly placed on top of the wreckage. So the claim the stills
were making now has a gate.

`capture/verify-framing.mjs` asks the real `camera.js`, at the settled end of
every replica beat in all eight masters, where the beat's subject actually lands,
and fails if it is over 104 % of the frame the viewer can see. It also measures
every hero card through `fitLines` — the same arithmetic the card sets itself
with — against the floors the review set: 70 % of the frame width in 16:9, 84 %
of the safe width in 9:16. Both currently clear by a margin (88–99 % subjects,
84 % / 97 % cards).

Writing it turned up **a real defect in every split scene**, which is what a gate
is for. `camera.fill` is a fraction of the frame; a split scene gives its lower
fifth to the type band, so a subject at `fill: 0.90` was landing at 136 % of the
part of the frame a viewer can actually see — a plan cropped through its own room
labels. And `framePush`'s recentre aimed at the frame's centre, which in a split
scene is behind the band, pulling the subject down so the crop fell on its top
edge. Two fixes, one idea: **the camera's frame is the VISIBLE frame.** The fill
is measured against `clipBottom`, and the aim anchors on the centre of
`protectBounds` rather than of the frame. Coverage still uses the whole frame —
the page behind the picture must never show anywhere. `edit` and `export` gave up
a few points of fill (0.90 → 0.86, 0.92 → 0.87) to land the last four beats
inside the ceiling; every subject is now 88–99 % of the visible frame and none of
them is cut.

Mutation evidence, all four checks:

| revert | what reddens |
|---|---|
| `CAPTION_SCALE` 1.42 → 1.15 | 8 `caption-size` failures, one per master |
| `WORD_FLOOR` 0.5 → 0 | 8 `blank` failures on the card openings |
| `CAPTION_SAFE_FILL.portrait` 1.01 → 0.72 | 4 `cropped` failures, the drafting card at **142 %** |
| `TYPE.hero` 190 → 110 | 12 `small` failures |
| the visible-frame fill and aim | 16 `cropped` failures, split scenes at 119–143 % |

## D27. The chapter chip is landscape-only.

A still pass finding, and a small one with a general shape behind it.

In 16:9 the replica letterboxes, so the film's chapter chip sits in a corner of
empty canvas in every scene. In 9:16 the replica goes edge to edge and there is
no empty corner: top-centre put **"BRIEF" through the composer's own "Your
Projects" heading** and **"EXPORT" in the middle of the drawing**. Every other
anchor fails in some other scene — the bottom is the honesty band, the top-right
is the export sheet, the top-left is the zoom toolbar since the replica moved it
there in portrait.

The general shape: a 9:16 frame has no margin to put film furniture in. So in
portrait the chapter is carried by the colour script and the type, which is what
they are for, and the chip is drawn only in landscape.

Not gated. A collision between the film's own overlay and the product's UI is not
a geometric claim about one rectangle — it is "does anything sit on anything" —
and a gate that tried would either re-implement the replica's layout or check
nothing. The still pass is the instrument, which is why it is part of the gate
and not a nicety.

## D28. The drafting beat: the product says it itself, and the spec's card is stale.

The art-direction review reported the honesty pill sitting on the drafting
card's text lines. It is the **film's own band**, not the product's — which
matters, because the band is drawn above the camera and therefore cannot be
cropped, only made to cover something. `verify:honesty` proves the sentence is
visible; nothing proved it was not lying across the interface it captions.

Two causes, and the second one is a finding for the product repo.

**1. `spec.draftCard` is 300 units tall and the rendered card is about 400.** The
card grew a row of room chips and a second status line and the layout spec's
rectangle did not follow, so the camera framed a rectangle three-quarters the
size of the thing and pushed to 2.37×. `camera.ts` § `draftCardBox` pads it by
the measured shortfall, explicitly as a **film-side workaround for a stale
number in a one-way copy we may not edit** — delete it when the product's spec
is corrected. **Reported upstream.**

**2. On those beats the film should not be drawing the band at all.** The card
and the product's caption are both at the bottom of the design box: a close-up on
the card cuts the caption in half, and handing the sentence to the film's band
then lands the band on the card. The camera frames the **union of the card and
the caption**, and `timeline.ts` § `draftShare` turns the expulsion off for any
beat that spends more than half its window on the card. One shot, both things
whole, one copy of the sentence.

Two things were tried on the way and are recorded because they look right:

- **Ending the camera's frame at the film band's top**, the way a split scene
  ends at its clip. It works and it costs the money shot 30 % of its size in
  every cut — a small plan in an empty frame, the exact defect this round exists
  to fix. The band is a centred pill, not a full-width slab. `camera.ts` §
  `visibleBottom` records it.
- **Expelling against `bounds` rather than the frame.** Protection asks "can a
  viewer see all of it" and is bounded by the band; expulsion asks "is it gone",
  and a caption below the band but inside the frame is not gone — it is a second
  copy with five pixels showing. `verify:honesty` caught it as four `half`
  failures, which is the gate doing precisely its job.

Mutation evidence for both, taken while the fix was being built rather than
reconstructed afterwards:

| revert | what reddens |
|---|---|
| `draftShare(win) > 0.5` guard removed (the film draws the band on the drafting beats again) | `verify:honesty` — 24 / 41 / 75 `doubled` frames in the 30, 60 and 120 cuts |
| expulsion measured against `bounds` instead of the frame | `verify:honesty` — 4 `half` failures, the caption 5 px inside the bottom edge |

## D29. FOUNDER CONSTRAINT: no violet-family field over 15 % of a frame.

**This is a founder decision, not a taste call, and it is now a gate.** It has
been reached three times from three directions, each time by someone reaching
for a violet that was not on the last round's list:

1. **Full-bleed plum cards** — asked for by the art direction, built, withdrawn
   (D11 / D22 / D24).
2. **The end card's wipe** — a full-bleed plum fill for nine frames, reduced to a
   band (D24). The band was a fifth of the frame, which is still over the ceiling
   this entry sets.
3. **The STAGE tints behind the window** — periwinkle at 50 % and 70 %. In a
   swatch they read as "a wash"; in a 9:16 split scene the band is **a third of
   the frame**. A tint of a violet is still a violet, and a pale one covering a
   third of the frame is precisely the case the objection is about.

### The rule

> No violet-family colour may cover more than **15 %** (`VIOLET_AREA_MAX`) of the
> visible frame as a flat area, in any scene of any cut, in either frame shape.
> Violet is a rule, a caret, a pin head, a chip, a band sweeping past. It is not
> a field.
>
> **Aubergine keeps two approved uses** — the what-line card and the receipt
> band — and they are counted, not exempted.

### The re-colour

The script is now built from the palette's non-violet members:

| chapter | was | is |
|---|---|---|
| draw | `#D3CCF2` periwinkle 50 % | `#E2DED5` — the product's own hairline used as a FIELD, a warm sand |
| render | `#C3BAF2` periwinkle 70 % | `#D7EFE4` — mint at 24 %, the lights coming up after the dark receipt |

The two mints (`tweak` at 40 %, `render` at 24 %) are three chapters apart with
the aubergine receipt between them, which is what keeps them from reading as a
repeat. The montage cycles `edit / tweak / draw / export`, so it inherits the
fix. Both new grounds clear 4.5:1 against the ink.

### The gate

`capture/verify-violet.mjs`, in the chain. It measures **from the layout rects**,
with no pixel reads: every scene paints a ground over the whole frame
(`scenes.ts` § `groundOf`), a replica or split scene mounts the window on top of
it, so the ground's visible flat area is `frame − window`; the montage paints one
of `MONTAGE_STAGES` full bleed; the end card sweeps `END_WIPE_BAND` of the frame
width in plum.

Violet is decided by **hue, not by a list** — anything in 235–300° at saturation
≥ 0.06. A list only catches the violets someone has already thought of, and all
three rounds above were introduced by a colour that was not on the previous
list.

Moving `groundOf`, `CARD_GROUND` and `MONTAGE_STAGES` out of the components and
into `scenes.ts` is part of the gate, not tidying: the gates bundle only
React-free code, so a colour table inside a component is a colour table the
constraint cannot be checked against.

| revert | what reddens |
|---|---|
| `STAGE.render` → `#C3BAF2` | 4 `field` failures |
| `STAGE.draw` → `#D3CCF2` | 5 `field` failures, including the montage |
| `END_WIPE_BAND` → 0.2 | 1 `field` failure on the end card's wipe |
| the price card's tone → `deep` | 1 `aubergine` failure — a third use |

## D30. The open finding card is closed outside the review beat.

The 9:16 storey still showed a dashed violet leader running from a pin on screen
to a finding card that is not in frame. The state machine is right — the card was
opened at 25.95 s and nothing closes it — but a line pointing off the edge at
nothing is a rendering bug to a viewer.

`camera.ts` § `showOpenFinding` passes a state with `openPin: null` on every
scene except `receipt`. **This is a host decision, not an edit to the replica**:
`state` is a prop, a closed finding card is an ordinary product state (the user
dismissed it), and the film already chooses which second of the screenplay to
show. `src/replica/**` is untouched and no new prop is needed.

### Upstream finding: `ReviewFinding` has no `level`

The same still shows three pins on the **L1** drawing that were raised against
**L0** rooms, sitting at positions that mean nothing on the upper floor and
crowding the cursor on the storey chips. The film cannot fix this and should not
try: it has no way to know which storey a finding belongs to, because
`ReviewFinding` is `{ message, archId? }`.

**What the product would need:** `ReviewFinding.level?: number` — the storey the
finding was raised on, absent meaning sheet-wide — and `ReviewPins` showing only
the findings whose `level` matches `state.plan.page`, plus the sheet-wide ones.
That is a product-repo change; hiding the pins film-side would be the film
editing the product's findings, which is a different and worse thing than
choosing a framing.

## D31. The pin levels landed upstream — and the hand-shaped copy that would have dropped them.

`ReviewFinding.level?: number` is in the product now (replica PR #216, synced at
`ef55353`): pins, the open card and the leader render only on the storey the
finding is about, and a finding with no level stays on every page. D30's upstream
ask is closed.

**It would have arrived here and done nothing.** `film-demo.ts` built
`DemoInputs.findings` as `STUDIO_DEMO.findings.map((f) => ({ message: f.message,
archId: f.archId }))` — every field a finding had **at the time it was written**.
A hand-shaped copy of a type you do not own is a silent dropper: the new field
would have been discarded on the way in, the pins would have gone on hovering
over the first floor, and every gate would have stayed green. It now spreads the
finding and removes only `code`, which is the compiler's lint code and is banned
from a consumer surface.

The same shape caught upstream's own layout test, which is the second instance in
two repos in one round. **Copy a type you do not own by spreading it, and name
the fields you are dropping.**

**`showOpenFinding` stays.** The two fixes cover different failures and the
distinction is the point: upstream hides a card on the WRONG STOREY; this hides
one that is on the right storey and outside the CAMERA'S FRAME. Checked rather
than assumed — forcing it true and rendering `--at 60-Land:52` puts the finding
card half off the left edge with its dashed leader crossing the picture, on the
ground floor where the finding belongs.

### The synced `CLAUDE.md`, and what a needle should read

The sync now carries `src/replica/CLAUDE.md` — deliberately: it is the replica's
own law and the copy is useless without it. Its prose names the DSL three times,
correctly, in the product's own voice, and `verify:replica`'s B4 needle failed on
all three.

The needle's job is to catch a banned word on a SURFACE. A developer document is
not one, so a third scan mode reads only what could become a surface in a doc: a
fenced block, which is code someone may paste, and a **double-quoted** phrase,
which is how prose carries copy. A backtick span is not read — in a developer
document `ArchLang` is how prose names a symbol.

| revert | what reddens |
|---|---|
| `scanModeFor` returning `"all"` for `.md` | 3 `forbidden` hits on the synced doc's prose |
| `quotable` reading backtick spans too | 2 of the 3 come back |
| `findings` mapped field-by-field again | `level` vanishes from `DEMO.findings` and the L1 pins return |

---

# WP-11 — the render

## D32. A master is the picture AND the take, so the music is versioned.

The founder's direction was to render now on the placeholder bed and render
again on the SUNO take when it lands, and to **keep both**. That sounds like a
filing decision and is not one.

The film's edit is snapped to the music: `timeline.ts` pulls every scene
boundary onto the nearest downbeat of that cut's own bed, and `cues.ts` then
derives every sound effect by walking the resulting cut frame by frame. A new
take has its own measured downbeats, so **it moves the cut points** — correctly,
automatically, and irreversibly as far as the old masters are concerned. Version
A cannot be reproduced from version B's audio.

Keeping both therefore means keeping both **renderable**, which is a stronger
claim than keeping both files. Three things are versioned by one id
(`A-confident-arrival`, letter plus the take's own slug, both derived):

- **the beds** — `public/audio/beds/<version>/`, so a second take cannot
  overwrite the first's. `prepare-bed.ps1` takes the directory out of the plan's
  own path rather than holding a constant.
- **the measurements** — `music.json` is now `{ active, versions }` and
  `build-music.mjs` **merges**. An old version's downbeat list is the only
  record of the grid its masters were cut against; replacing the file would
  delete it while leaving the mp3s sitting there looking fine.
- **the masters** — `out/masters/<version>/`.

**There is exactly one switch, and `render.ps1` cannot be it.** `music.json`'s
`active` field is read by `src/audio.ts`, and every gate, every still and every
render reaches the film through that module. So `-MusicVersion` is an
**assertion**: it is compared against `active` and the run stops if they
disagree. Making it a switch would have created a second place the film decides
which take it is cut to — the same two-clocks failure `music-grid.ts` already
records, wearing a different hat — and the failure it produces is the nastiest
kind: eight correct masters filed under the wrong music, which look exactly like
deliverables. `node tools/use-music.mjs <version>` moves the one field, and
refuses to move it to a version whose mp3s are not on disk.

`verify:assets` now checks **every** version's beds rather than the active one's.
A gate that only looked at what is in use would report green for months and then
fail on the day someone went back to A, which is the day it is least useful.

**Evidence that the relocation was a pure move, not a re-cut.** The four beds
were regenerated through the new versioned pipeline and came out **byte-identical
to the originals** — same sha256, same byte count — with all four downbeat lists,
both loudness figures and both true-peak figures unchanged. So version A's
masters are cut on precisely the boundaries the three look passes and the contact
sheets were shot against; nothing in the picture moved to get the audio filed.

**Mutation evidence.**

| mutation | what reddens |
|---|---|
| `active` set to a version the document does not hold | 2 `audio` failures — one from the gate, one from `audioProblems()` in the real module |
| the ACTIVE version's `bed-15.mp3` renamed away | 1 `missing`, naming the version it was declared by |
| a second, NON-active version added whose beds do not exist | 4 `missing` — which is the "every version" claim, proven rather than asserted |

One wording bug fell out of writing them: the summary line read
`all on disk` unconditionally, directly above its own list of the files that
were not. It now says `N NOT on disk`.

Full procedure, both directions: `docs/release.md`.

## D32a. The masters land at −17.6 LUFS, and the duck is the whole reason.

Version A's eight masters measure **−17.3 to −17.9 LUFS integrated**, against beds
normalised to −15.6 … −16.2. Adding sound effects to a bed should make it louder.
These are **1.1 to 2.0 dB quieter**, and the number is not noise: it is ordered by
cut length, which is the clue.

`DUCK` pulls the music down 4 dB under a run of cues, and `duckWindows` merges any
cues closer together than the hold. Measured by sampling the real envelope at 30 fps:

| cut | cues | duck windows | frames ducked | mean bed gain | bed | master |
|---|---|---|---|---|---|---|
| 15 s | 39 | 6 | **73.8 %** | −2.45 dB | −15.6 | −17.6 |
| 30 s | 78 | 12 | **70.8 %** | −2.33 dB | −15.9 | −17.9 |
| 60 s | 118 | 33 | **59.0 %** | −1.84 dB | −16.1 | −17.6 |
| 120 s | 185 | 45 | **50.7 %** | −1.53 dB | −16.2 | −17.3 |

Bed + mean duck gain predicts each master to within 0.1 dB, with the effects adding
a consistent ~0.4 dB back. The model fits exactly, so nothing else is going on.

**The finding is about coverage, not depth.** `audio.ts` chose −4 dB so the movement
would be "heard as space rather than as an effect", and at the density this film
runs the windows merge into **half to three-quarters of the runtime** — so the duck
is not really ducking, it is a −2 dB trim on the bed with a shape. That is a
defensible mix and it is not what the constant reads as.

**Nothing was changed, deliberately.** Depth, coverage and bed level are sound-design
decisions the founder has not heard yet, and the placeholder take is being replaced
anyway. The consequence is benign in both directions: every platform normalises up
from here (YouTube and the vertical feeds target about −14), and true peak is −3.4 to
−4.6 dBTP, so **+1.6 dB is available without a re-mix and without clipping** — a
constant and a re-render, if the founder wants it. Recorded so the next person reads
a measurement rather than rediscovering a 2 dB mystery.

## D33. `Tweak a number.` is cleared. The flag stays.

The one line in the film that no growth-repo or product line says, and the only
one ever registered `needs founder`. **Approved by the founder on 2026-09-20**,
so the clearance row names a date rather than a file — the approval *is* the
source — and `NEEDS_FOUNDER` in `src/copy.ts` is empty for the first time.

`COPY_FLAGS.tweakLine` stays `true` rather than being retired. It costs one
boolean and it is the cheap answer if the question is ever reopened: the tweak
beat plays exactly as long, framed exactly the same, with the chapter chip
carrying it alone. Deleting a working lever because the question it answered has
been answered once is how the next round ends up rebuilding it.

Worth recording, because it nearly went unnoticed: `verify:copy --strict` was
**already green** with the line pending. `--strict` is about `Placeholder`
scaffolding; `NEEDS_FOUNDER` is reported, not enforced. The clearance was a
founder decision that needed making, not a red gate that needed clearing.

## D32. A beat starts on what is THERE, then travels.

A rendered master settled an argument the stills could not. At **19.5 s in the
30 s landscape cut** the left half of the picture is bare dot-grid and the
drawing is cropped off the right edge: the receipt beat is framed for "the pin
and its open card" seconds before the card exists.

The rule that produced it is in `focusRectFor` and it is a good rule — *a
framing that changes because its subject arrived is a lurch*, which is why the
beat frames against `settledReview` rather than against the state of the current
frame. It is right about lurches and wrong about this. The card does not fade in;
it appears. Until it does, the shot is a composition with a hole in it.

**Both things can be true, and the answer is a move.** The beat starts on what is
there — the pins landing on the drawing — and makes ONE eased move to the card
composition. Both ends are derived from the screenplay, not typed: it leaves when
the last pin has landed (`dropPins.at + dur`, nothing more to watch on the wide
shot) and lands when the click lands (`openPin.at + dur`). The time warp runs the
same 35 s screenplay at 2.50× in the 15 s cut and 0.46× in the 120 s one, so a
typed duration would have been wrong in three cuts out of four.

⚠ It ends at the **click**, not at `OPEN_PIN_SEC` — the midpoint, which is the
frame the card actually appears on. Landing exactly there looked right and was
not: an ease-in-out has a flat tail, so the camera was parked in the card's
composition for the last few frames before the card existed. That is the original
defect in miniature.

The same shape was in two more places, found by the gate below rather than by
eye:

- **The render beat** framed the drawing and the rendering card's reserved box
  from its first frame. Same travel, same derivation.
- **The rendering was PROTECTED** — `framePush`'s clamp held its rectangle whole
  — for every beat that would eventually hold it. A card at 15 % opacity has no
  "AI-generated" pill to crop, and reserving its rectangle pushed the drawing
  against the left edge with 41 % of the frame empty on the right. It is
  protected while it is on screen now, at the same 0.5 line `verify:honesty`
  reads, so the two cannot disagree about when the pill must be whole.

### The gate: lean, not emptiness

`camera.ts` § `visibleSubjects` reports what a viewer can see at a given second —
the paper, the command bar, the pins that have dropped, an open card, a rendering
past half opacity, an open menu, an open tweaks panel. `verify:framing` samples
every 0.25 s and measures the **lean**: how much more of the frame is empty on one
side than on the other.

Asymmetry, not emptiness, and the difference is the whole check. A narrow subject
with air on both sides is a composition — the split scenes' storey beat sits at
37 % left and 31 % right and looks right. All the air on **one** side is a camera
holding a space for something that has not appeared.

A **moving** camera is exempt, and the exemption is derived rather than declared:
the focus rect is asked for at the sampled frame and three frames later, and if
it has moved the shot is mid-travel. Delete the travel and the rect stops
changing, the exemption stops applying, and the frames go red again — which is
what the table says.

| revert | what reddens |
|---|---|
| the receipt beat's travel | 29 frames, `empty` |
| the render beat's travel | 6 frames |
| protecting the rendering from the beat's first frame | 4 frames |
| (before this round, no travel at all) | **38 frames across receipt and render** |

## D33. The duck was a trim, and nothing in the repo could have said so.

Eight masters were rendered and measured **-17.3 to -17.9 LUFS integrated**
against a -16 target, with true peaks -3.4 to -4.6 dBTP. Every audio check in
the repo was green, and all of them were about the cue sheet: every cue has a
file, lands inside its cut, nothing piles up. All true of a film that is 1.5 LU
quiet.

**The cause was in the data.** `duckWindows` fired on any run of cues, which
covered 36-59 % of the runtime before the attack and release tails and 50-73 %
with them. A duck that is on for two thirds of a film is not a duck; it is a
trim. It costs loudness everywhere and emphasises nothing, which is the opposite
of both things a duck is for.

`DUCK` now carries `minCues: 4` and `minCuesPerSec: 4`, so only a genuinely dense
passage qualifies — in this film, the typing runs. An isolated pin drop no longer
pulls the bed down for a third of a second, which is also the right answer
musically: those cues are meant to be felt over the music, not to clear a space
in it. Coverage falls to 11-20 %.

| cut | before | after |
|---|---|---|
| 15 s | -17.5 LUFS, duck 73 % | **-15.7**, duck 17 % |
| 30 s | -17.8 LUFS, duck 70 % | **-16.3**, duck 20 % |
| 60 s | -17.6 LUFS, duck 59 % | **-16.3**, duck 14 % |
| 120 s | -17.3 LUFS, duck 50 % | **-16.3**, duck 11 % |

True peaks -3.0 to -4.2 dBTP, all under the -1.0 ceiling. `MASTER_TRIM_DB`
exists and **measures zero**: the gap was not a missing gain.

### The instrument, and why it can be believed

`capture/lib/mix.mjs` builds the mix offline from the manifests — bed, cue
sheet, duck envelope, master trim — playing the film's OWN `duckGainAt`, and
ffmpeg's `ebur128` measures it. A full Remotion render is twenty minutes of
picture to hear thirty seconds of sound.

It is an instrument, not a substitute for the render, and what licenses it is
that **it reproduces the defect**: mixed with the duck as it was when those eight
masters were rendered it reports -17.5 / -17.8 / -17.6 / -17.3 against the
render's measured -17.3 to -17.9, with true peaks inside 0.3 dB. A number that
can produce the bug can be trusted to show it gone.

`duckGainAt` moved from `FilmAudio.tsx` into `audio.ts` for the same reason every
other table has: the gate is React-free, and a gate that re-implements the thing
it checks eventually certifies a film nobody rendered.

### The gate

`verify:loudness` asserts, for **every music version with beds on disk** — so a
second SUNO take is measured the day it lands, not the day it becomes active:

1. each cut within ±0.5 LU of that version's own `targetLufs`;
2. true peak ≤ -1.0 dBTP, the platform limiter's line rather than the sample one;
3. the duck on for ≤ 30 % of runtime — the check that would have caught this
   before a frame was rendered.

| revert | what reddens |
|---|---|
| `minCues` / `minCuesPerSec` → 0 (the always-on duck) | 8 failures: 4 `loudness` at -17.3…-17.8, 4 `duck` at 50-73 % |
| `MASTER_TRIM_DB` → +3 | 7 failures, `loudness` over the top of the window |

### Confirmed against the real masters, 2026-09-20

The offline mix was licensed above by reproducing the defect. Re-rendering
version A at `8181e86` gives the stronger test — does it predict a film that
was not broken?

| cut | predicted | measured | Δ | predicted TP | measured TP | Δ |
|---|---|---|---|---|---|---|
| 15 s | −15.7 | **−15.8** | 0.1 | −3.0 | −3.0 | 0.0 |
| 30 s | −16.3 | **−16.4** | 0.1 | −4.2 | −4.1 | 0.1 |
| 60 s | −16.3 | **−16.4** | 0.1 | −2.4 | **−1.2** | **1.2** |
| 120 s | −16.3 | **−16.3** | 0.0 | −3.2 | −3.0 | 0.2 |

**Loudness is exact** — every cut within 0.1 LU, in both frame shapes (landscape
and portrait measure identically, as they must: same cut, same sound). The model
is trustworthy for the number the gate's first assertion is about, and a version
B can be judged on it before a frame is rendered.

**True peak is not, and the 60 s cut is the case that shows it.** The offline mix
says −2.4 dBTP; the master measures **−1.2**, confirmed two ways (ebur128 true
peak and `astats` sample peak at −1.23 dBFS). It is reached in the **first 64 ms**
and never beaten — the 60 s bed enters on a different point of the take than the
other three, and its entry coincides with the opening cue.

So the gate's second assertion has about **1.2 dB of unmodelled headroom against
it**, and the 60 s cut currently clears the −1.0 ceiling by 0.2 dB rather than the
1.4 the gate believes. Nothing is wrong with the master. What is worth knowing is
that **the peak check is the one with no margin left**, and a louder take, a hotter
cue or a `MASTER_TRIM_DB` above zero would be caught by the ear and the render
before the gate saw it coming. Two plausible causes, neither investigated because
neither changes today's answer: the AAC encode raising inter-sample peaks, and
coincident cues summing differently in the browser's mixer than in the model.

**If version B's 60 s cut is the one that goes over**, this is why, and the fix is
a cue gain in the data rather than a bed level.

## D34. A version is {music, edit, sfxSet}, and B is cut to the bar grid.

The second take is not a different soundtrack under the same picture. A was cut
to a track with **one** big arrival; "Daylight Forward" has eleven sections,
eleven fills and five crashes, and cutting it like A would leave the music doing
all the moving. So the EDLs became a dimension.

### The version model

`src/data/versions.json` ties `{music, edit, sfxSet}` together. **The version ID
is the music version's ID** — deliberately: `tools/use-music.mjs` already writes
`music.json`'s `active`, `render.ps1` already takes `-MusicVersion`, and the beds
are already named for it. A second namespace would have meant two things to keep
in step and a gate to check they were. `FILM_VERSION` in the environment
overrides it and selects all three at once, which is how both versions render
without editing code.

`src/edits/A.ts` holds A's four lists, **moved verbatim**;
`src/data/edit-a-timeline.lock.json` holds A's resolved timeline as it was before
the move — scene, frames, replica window, fill, push, every beat — and
`verify:bars` reproduces it. A is rendered and approved; a diff there is a red
gate, not a review comment.

### The B edit

1. **Claim before proof.** "Get a real, dimensioned floor plan." moves BEFORE the
   drawing. In A the card summarises what you just watched; in B it makes a
   promise and the plan keeps it.
2. **Every major boundary is a MEASURED downbeat.** Not `bpm × n`: the take
   accelerates from 125.3 to 128.3 BPM and a fixed grid is 1.53 s out by the last
   bar. Worst boundary in B is **0.5 frame**. The first wall stroke lands on
   downbeat #5 at **9.24 s** in the 30 s cut, where the full arrangement enters.
3. **Long beats get camera setups**, cut on downbeats, rather than one held
   state.
4. **B does not get the grid snapper.** Its boundaries already are downbeats;
   the snapper moved fourteen of them the first time it ran.

### What the gates changed about the edit

Three things, which is the argument for having them:

- the 30 s **price card went from one bar to two** — thirteen words need 3.4 s and
  the reading-time rule said so;
- the receipt's **establishing wide went from `fill: 0.62` to 0.76** — 19 % of the
  frame is not an establishing shot;
- the 120 s **hook and claim card gained a slow push** — three bars parked is a
  slide, and the pace rule caught it.

### The pace rule, in bars

For edit B the static ceiling is **two bars of the bed's own measured bar**, and a
card is only "holding" once its last word has landed — type still arriving is the
beat doing something. Holding B to A's 2.5 s of wall clock would have meant
either type nobody can read or a card that cuts mid-sentence.

### ⚠ The gate caught itself first

`verify:bars` read a beat field that does not exist. Every comparison came back
`NaN > tolerance` — false — and it reported "0.00 frames off" for sixty
boundaries it had not looked at. **A non-finite measurement now fails.** This is
the second silent-pass of this exact shape in this repo.

| revert | what reddens |
|---|---|
| the 30 s claim card 3 frames longer | 6 `offbeat` — every boundary after it |
| any edit to `edits/A.ts` | 1 `drift` against the lock, naming the beat |

### Not done in this pass

Piecewise per-bar warps inside the draw beat, per-role ducking, the stills and
the motion preview. The edit and the version model land first because everything
else is measured against them.
