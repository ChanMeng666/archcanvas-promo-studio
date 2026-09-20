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

## D35. The sound was decided in a manifest almost nothing read.

`src/data/sfx-roles.json` has held the sound design since the palette was
chosen: six roles, a file and a level per role, per-music levels and EQ, a duck
depth with an attack, a hold and a release for each, a loop crossfade for the
drawing texture, and a rule for when the end cue should be suppressed. Every
number in it was measured (`tools/rate-draw.mjs`, `tools/mask-check.mjs`) and
argued in D12.

**The film read one field of it.** `duckWindows` asked whether a cue's role
ducked at all; everything else — `roleCue`, `endCueSuppressed`, every `perMusic`
gain, the loop, the EQ — was reachable from a dev tool and from nothing the
render mounts. `src/cues.ts` hard-coded an absolute gain per emitter and applied
it to whichever sound set happened to be loaded.

Three consequences, all measured rather than inferred:

- **The ElevenLabs palette played at the synthesised palette's levels**, four to
  six decibels hot across the board (a card pop at −5 where its own calibration
  says −10, the end hit at −1 against −6), on material that is longer and
  therefore sums higher. That is what `MASTER_TRIM_DB = −0.5` was compensating
  for. With the roles wired the trim measures **zero again for all four
  versions**, and the 15 s audition cut's true peak went from exactly −1.0 dBTP,
  the gate's ceiling with no margin at all, to **−1.4**.
- **Anchoring was never applied.** `alignBy`/`alignOffsetSec` are measured per
  cue and stored; `FilmAudio` scheduled `cue.atSec` raw. The ElevenLabs typing
  clusters ran **157 ms** behind the characters they were for.
- **The per-music EQ reached nothing**, because Remotion's `<Audio>` takes a
  gain and nothing else. See below.

### A cue names a role, not a file

`Cue` is now `{atSec, role, intent?, nth?, gainDb?, playSec?, fades}`. The sheet
owns WHEN; the manifest owns WHAT and HOW LOUD, per sound set (`perSet` blocks)
and per take. One sheet plays with `synth` and with `elevenlabs-audition`, and a
`gainDb` in the sheet is a **trim on top of** the role's level rather than a
replacement — which is how version A's approved per-gesture levels are carried
over exactly, and how the chapter chip stays the same `appear`/`card` sound six
decibels down.

⚠ **A per-set block's material-calibrated fields do not fall through.** Both
halves of that rule were live bugs within minutes of the merge existing:
`perMusic` fell through and put A's 0.65 s synthesised stroke at the −14 dB
measured for a 7.69 s ElevenLabs texture; `minGapSec` fell through and applied a
1.3 s floor written for typing CLUSTERS to 70 ms single presses, taking the 15 s
cut's typing from twelve cues to **one**. A block exists because the material is
different, so a number measured on the other set's material is wrong here by
construction.

### The drawing is one texture, and in B it is punctuated by bars

The money shot used to be sounded by re-firing a `pencil-line` every 0.42 s — a
stutter with a gap in it for the synthesised palette, and for a vendor set whose
drawing cue is a 7.69 s BED, one copy that ran 2.1 s past its own beat. Now the
beat gets ONE base: anchored on the first stroke's film second, looped with an
equal-power crossfade when the beat outlasts the sample, faded out at the beat's
end. Edit B adds a light `tick` on each band's downbeat, placed from `warp.ts`'s
own knots — **10 ticks across the four cuts, worst 0.00 frames from its knot**.
Edit A gets the base only, because A has no band pins to punctuate.

### Per-role ducking, and the one number that is new

Each cue claims the music for its own role's depth and shape — typing −2.5 dB, a
click −3, a chapter move −4, a confirmation and the end card −5, the drawing bed
nothing at all — and `duckGainAt` takes the DEEPEST claim at every instant,
never the sum.

**D33's density rule survives**, because per-role depths do not fix what it was
about: a shallower duck that is always on is still a trim. What is new is
`SOLO_DUCK_DB`, the depth that ducks outside a dense passage. It was −4 for one
measurement, which let `move` duck alone — and `move` fires on every beat
boundary, five times in the 15 s cut, twenty in the 120 s. Coverage went
**17 % → 31 %**, straight through the ceiling the gate exists to hold. At −5
only a confirmation and the end card qualify and they fire once each. This is
D33's finding arriving again wearing a per-role hat: **a cue that fires at every
cut is not a solo event, whatever its depth says.**

`endCueSuppressed` is wired for the first time. Four of the sixteen cuts drop
their end cue because the card lands within 250 ms of the bed's own final hit.

### The EQ had to be baked, because Remotion cannot filter audio

Version B's 30 s draw window, `draw-b` at its −10 dB role gain, headroom against
the bed (negative means the cue is **louder than the music**):

| band | unshelved | with the manifest's EQ |
|---|---|---|
| 6300 Hz | −0.5 dB | +6.8 dB |
| 8000 Hz | −0.4 dB | +9.3 dB |
| 10000 Hz | −3.7 dB | +7.6 dB |

Three of the bands the hats and shaker live in, on the money shot, in the one
beat the whole edit is built around — and the reason the drawing role is *not*
ducked at all is that its space was supposed to be carved exactly here.

`tools/bake-eq.mjs` renders each recipe into real bytes once, measures the
result the way the vendor cues were measured, registers it as a derived cue and
writes the filename into the `perMusic` entry. `roleCue` plays the baked file
and returns `eq: null` with it, so an offline mixer cannot shelve the same
texture twice. Anchoring is **re-measured** on the baked file rather than copied
— a shelf moves where the first sample within 12 dB of the peak is. Provenance
is **inherited**: a file derived from audition material is audition material,
and `verify:release` reads the same field it always did.

---

## D36. `FILM_VERSION` never reached the picture, and every still was of the wrong film.

The version model (D34) turns on one environment variable. It worked everywhere
it was tested and nowhere it mattered.

`src/version.ts` is executed in two completely different places. In **Node** —
every gate, through `capture/lib/load-core.mjs` — `process.env` is the real
environment, so `FILM_VERSION` selected the version, which is why
`verify:loudness` could measure four versions and `verify:bars` could hold edit
A's lock. Inside the **Remotion bundle** the same module runs in a browser,
where `process.env` is a small object the bundler injects — and Remotion injects
only variables prefixed `REMOTION_`. So `process.env.FILM_VERSION` was
`undefined` in every still, every contact sheet and every render, and all of
them silently fell back to `music.json`'s `active`.

**Proven, not reasoned.** With `FILM_VERSION=A-confident-arrival`, a still of
`Studio-15-Landscape-16x9` at 4.0 s came back as edit **B**'s aubergine claim
card. Edit A has no card at that second; it has the drafting sheet. After the
fix, the same command at the same second returns the drafting sheet.

What it cost, and why it is worse than a wrong still:

- **The gates and the deliverable disagreed about which film was being built**,
  in the direction where the gates are right and the artefact is wrong. Every
  gate in this repo is a Node gate.
- **The two `+el` versions were unrenderable.** A run would have produced the
  `synth` mix and filed it in `out/previews/AUDITION-not-for-release/…+el/` as
  though it were the ElevenLabs one. That is D32's "eight correct masters filed
  under the wrong music", in a second place, and it is the nastier kind of
  failure for the same reason: the output looks exactly like a deliverable.
- **Every look pass ever run on this film was a look pass at `active`.** For
  this round that is harmless — `B-daylight-forward` and `B-daylight-forward+el`
  share a picture — and it would not have been harmless on the day someone shot
  A's sheets while B was active.

The fix is the prefix: `REMOTION_FILM_VERSION` wins, `FILM_VERSION` is still
read so a Node-side habit keeps working, and `capture/stills.mjs` also passes it
explicitly through `renderStill`'s `envVariables`, which is the supported seam
and does not depend on the prefix at all.

`verify:timeline` grew a TEXT tripwire on both halves. It is a text check for
the same reason the frame-literal scan beside it is: the end-to-end proof needs
a render, and a gate that needs a render is a gate nobody runs. The render-side
recipe is in `docs/release.md`.

| revert | what reddens |
|---|---|
| `version.ts` back to `FILM_VERSION` only | 1 `verify:timeline` |
| `stills.mjs`'s `envVariables` removed | 1 `verify:timeline` |

---

## D37. What the look loop found, and what was left alone.

Eight contact sheets (four cuts × two aspects, 210 frames), a beat-overlay strip
for the 30 s cut, one 8 s motion preview with sound, and every image opened.

**What is right.** The story reads with the sound off now that the claim card
precedes the draw: hook → brief → drafting → *"Get a real, dimensioned floor
plan."* → the plan drawing itself → edit → receipt → export → price → end card.
The honesty caption runs three continuous seconds in the 15 s cut with no
drafting sheet, uncropped and never doubled. The montage's four panes differ in
ground colour, brief and plan proportion. Every one of the 30 s cut's eleven
scene boundaries sits on a measured bar, visibly, on the strip. The "AI-generated"
pill is large and whole on every rendering. No violet-family field is over 15 %.

**Where the levels land.** Offline mix, `capture/lib/mix.mjs`:

| version | 15 s | 30 s | 60 s | 120 s |
|---|---|---|---|---|
| `A-confident-arrival` | −15.5 / −3.4 / 15 % | −16.0 / −4.2 / 17 % | −16.2 / −2.4 / 13 % | −16.1 / −3.2 / 10 % |
| `B-daylight-forward` | −16.3 / −2.0 / 23 % | −16.1 / −3.5 / 15 % | −16.2 / −3.3 / 12 % | −16.1 / −1.6 / 8 % |
| `A-confident-arrival+el` | −15.5 / −4.2 / 5 % | −15.9 / −4.2 / 3 % | −16.1 / −3.1 / 1 % | −16.2 / −3.4 / 0 % |
| `B-daylight-forward+el` | −16.5 / −1.4 / 16 % | −16.1 / −3.5 / 0 % | −16.2 / −4.1 / 2 % | −16.2 / −2.1 / 1 % |

LUFS / dBTP / duck coverage. All sixteen inside −16 ± 0.5, all under −1.0 dBTP,
all under the 30 % duck ceiling.

⚠ **Two of those rows duck for 0 % of their runtime**, and that is reported
rather than engineered away. The ElevenLabs palette is sparse — three typing
cues in a 30 s cut where the synthesised palette fires thirty-eight — so no
passage is dense, and on B's 30 s cut the end cue is suppressed as well, which
removes the one solo event. Nothing is in the music's way there, so nothing
moves it. Raising the coverage would mean loosening the density rule D33 was
written to impose.

### Three findings NOT fixed here, each with a still rather than an opinion

All three are in the camera or the replica's own screenplay, which this round
did not touch, and all three are in **both** editions — so each is a founder or
an upstream question rather than a late change to an audio round.

1. **The money shot opens on two overlapping sentences.** At the hand-over the
   replica's drafting card is still ~60 % opaque and does not clear for about
   0.4 s, so *"Sequence shortened — a design really takes two to three
   minutes."* is printed over *"Saving your plan… 2m 16s"* and over the card's
   own *"Designing, checking and reviewing your plan — usually 2–3 minutes."*
   Both are the product's own elements, so no gate is wrong: `verify:honesty`
   compares the film's band against the replica's caption, not the replica's
   caption against the replica's card. It is on the first frames of the beat the
   whole edit is built around, in **A as well as B**, because both start their
   money shot at `DRAW_HANDOFF_SEC` — and `verify:bars` asserts that they do.
   The stills pass never caught it because `stills.mjs` shoots the money shot at
   45 % through the beat, two and a half seconds later.
   Evidence: `D:\.claude-scratch\2026-09-20\edit-b-finish\preview\f04.png`
   (9.30 s), `f05.png` (9.40 s), `f07.png` (9.60 s).
2. **A word cut in half at the bottom of every 9:16 drawing beat.** The sheet's
   own label reads `-storey Townhouse` — "Two" is off the left edge — at about
   40 px, in all four vertical cuts. It sits inside the bottom 390 px that
   Reels/TikTok/Shorts reserve for their own chrome, which is the band the
   replica's `picture` box deliberately overruns, so again no gate is wrong. It
   still reads as a mistake on a surface with no chrome, such as an embed.
   Evidence: `out/stills/wp9/Studio-30-Vertical-9x16/ad-01-11.00s.png`.
3. **The "AI-generated" pill lands in that same bottom band in 9:16.**
   `verify:honesty` requires the pill's rectangle wholly inside the FRAME and it
   is, comfortably and legibly. "Inside the frame" and "visible to a viewer of
   the vertical master on the platform it is cut for" are not the same claim,
   and the obligation the pill discharges (EU AI Act Art. 50) is about the
   second one. Evidence:
   `out/stills/wp9/Studio-60-Vertical-9x16/ad-01-46.00s.png`.

### Mutation evidence for this round

| mutation | what reddens |
|---|---|
| the draw base 2 frames off the first stroke | 4 `draw` |
| the base allowed to outlast its beat | 4 `draw` |
| band ticks 2 frames off their knots | 10 `band` |
| ticks taken from `knots.slice(0, -1)` | 4 `band` + 1 `vacuous` |
| anchoring dropped (`start = action`) | 4 `anchor` |
| the synth set's draw file renamed | 1 `role`, while building `+el` |
| `perMusic` allowed to fall through | 1 `fallthrough` |
| `minGapSec` allowed to fall through | 1 `fallthrough` |
| `SOLO_DUCK_DB` back to −4 | 2 `duck` + 1 `loudness` |
| `MASTER_TRIM_DB` back to −0.5 on audition | 6 `loudness` |
| a version naming a set `sfx.json` does not hold | 2 `version` |
| `version.ts` back to an unprefixed `FILM_VERSION` | 1 `timeline` |

The `perMusic` mutation run against **`verify:loudness` is green**, at the same
−15.5 LUFS, because one cue five decibels down does not move an integrated
figure the bed dominates. That is the whole argument for the `fallthrough`
check, and it is why the manifest's belt-and-braces `perMusic: {}` and
`minGapSec: 0` were deleted: **a second guard that makes the first untestable is
not a second guard.**

### Not done in this pass

The three findings above. A full render of version B — nothing here has been
heard in a master, only in the offline mix and in one 8 s motion preview. The
preview was cut at `--scale=0.75` rather than the 0.667 that was asked for,
because 1080 × 0.667 is 720.36 and Remotion refuses a non-integer height.

---

## D38. Two of the three look findings are fixed; the third names a decision.

D37 recorded three things the look loop found and did not fix, on the grounds
that they were founder or upstream questions. They are not — all three are
film-side — so this is the round that tried all three. Two landed. The third
turned out to be a question about the 9:16 picture, and it is written down here
as a question rather than guessed at.

### The film's own band was printing over the product's drafting sheet

The first reading was wrong in a way worth recording: the overlap is **not** the
replica's caption against the card. The camera expels the replica's caption
correctly on that beat — measured, `captionRect` at y = 1387 in a 1080-tall
frame, fully out. What was on screen was the **film's own band**, an opaque pill
at the bottom of the stage, printed across the card's own *"Designing, checking
and reviewing your plan — usually 2–3 minutes."*

Two existing rules were each right about the case they were written for:

- `draftShare(win) > 0.5` stops a beat expelling when it is MOSTLY the drafting
  card. Upstream deliberately keeps the sheet up while the drawing starts
  underneath it, so the money-shot beat holds the card for 13.5 % of its window
  and sails under a 50 % test.
- `captionBandTop` has carried a docstring describing this exact fix since the
  art-direction round — "the camera now treats the band's top as the bottom of
  the frame for that beat" — and **no callers**. `visibleBottom` records why
  that version was abandoned: it cost the money shot 30 % of its size.

**Three fixes were measured and rejected before the fourth.**

| attempt | what it did |
|---|---|
| protect the card above the band | `drafting.visible` is a boolean; the scale jumps 1.61 → 2.71 in one frame. A 68 % pop is worse than the overlap. |
| ease that with a `lerpPush` over the card's fade | fixes the pop, then fails `verify:honesty` on all eight: at the wider framing the expelled caption comes back half into frame. The card and the caption are vertically adjacent, so lifting one brings the other back. |
| make the band wait for the card, everywhere | A's 15 s money shot is 3.30 s long and the card holds the first 0.45 s. The sentence lands at **2.83 s** against the 3.0 s floor. |

So the band waits for the card **unless waiting would take the sentence under
the floor**. The priority is stated rather than tuned, in the only order it can
be: the sentence is the film's one mandatory obligation and a composition
problem may not spend it. Seven of the eight cut-and-edit combinations wait; A's
15 s cut keeps the overlap and `bandWaitsForCard` says so out loud. Derived, not
tabled — lengthen A's money shot by a fifth of a second and the wait applies
there too, with nothing to remember.

One thing fell out of it. A delayed band no longer abuts the product's caption,
so its fade-in came out of the **opaque** run the floor is measured on: B's 15 s
cut derived 3.07 s and the gate, which samples what is actually drawn, measured
2.87 s. A delayed band is therefore `hardIn`; a fade from nothing in the middle
of a beat, half a second after a card went away, is a glitch with a ramp on it
rather than a hand-over.

`verify:honesty` gains `overprint`, plus the check that keeps it honest: a cut
that declines to wait must be a cut where waiting really would have gone under
the floor, re-derived through `honestyWaitDiagnostic`. An exception earned every
time it is taken, instead of a standing excuse attached to a red gate.

⚠ **A's PICTURE changes; A's TIMELINE does not.** `edit-a-timeline.lock.json` is
untouched and `verify:bars` still reproduces it to the frame. A's masters need
re-rendering — they did anyway, for the sound.

### The pill, and what "visible" means on a vertical master

`verify:honesty` asked whether the "AI-generated" pill's rectangle was inside
the FRAME. It was — comfortably, legibly, and inside the bottom 390 px that
Reels, TikTok and Shorts cover with their own chrome. **"Inside the frame" and
"visible to a viewer of the vertical master on the platform it is cut for" are
not the same claim**, and the obligation the pill discharges (EU AI Act Art. 50)
is about the second one.

In 9:16, while a rendering is on screen, the protection bounds now end at the
safe line rather than the frame edge, and the gate asserts the same. Scoped to
beats that have a pill: bounding every portrait beat that way would pull the
framing back on beats with nothing to protect.

### The blind spot that hid all of this

`stills.mjs` shoots the money shot at 45 % through its beat — two and a half
seconds after the hand-over. The defect lived in the first 0.4–0.8 s. Three look
passes, eight rendered masters and eleven green gates never looked at a frame
that had it. The standard still set now always includes the hand-over: first
stroke −0.2 s, +0.1 s, +0.4 s, derived per cut.

**A still that is never taken is a defect that cannot be found**, and the
general form is worth keeping: when a defect survives a look pass, ask what the
look pass samples before asking what the code does.

### ⚠ NOT fixed: the sheet's caption row, bisected in every 9:16 drawing beat

Root-caused and measured rather than deferred. **Eleven beats** across the four
vertical cuts push the sheet's own caption row into the bottom band, half
outside the frame — `-storey Townhouse`, with "Two" off the left edge, at about
40 px.

It is **not** the picture box overrunning the safe area, which was the obvious
theory: `PICTURE.portrait.bottom` is 400 against a 390 px safe bottom, so the
mount already clears it. The row is put there by the **push** — `pushRect`
scales about the origin, so content leaves the mount box.

Expelling it, the way the product's own caption is expelled on a money shot,
raises the scale until the honesty caption and the pill crop: **9 failures**
across the vertical masters. The row, the caption and the rendering card all
live in the lower third of the 9:16 design, and in that frame shape they cannot
all be satisfied by framing alone.

So the real question is about the 9:16 **picture**, not about a framing rule:
either the picture box ends at the safe line and the chapter-colour band owns
the bottom 390 px (consistent with the split scenes, and a change to every
vertical beat), or the replica gets a 9:16 arrangement that does not put a
sentence under the paper. Both are larger than a framing tweak and neither
should be guessed at the end of a round.

`sheetCaptionRect` lands anyway — derived through `sheetChrome`/`worldToDesign`
so it cannot drift from what the component draws — because whichever way that
question is answered, the next attempt needs the rect.

### ⚠ And the new hand-over frames found a fourth thing, in 9:16 only

The first thing the new samples showed is that the fix works: at the hand-over
in 16:9 the drafting card is clean, legible and whole, with the drawing coming
up behind it and no band on top of it.

The second is that **in 9:16 the drafting card is cropped on both sides** for
the same half-second. The money-shot beat is framed for the drawing at about
2.6x, the card is still on screen for the first 0.5 s of it, and at that scale
the card does not fit: `...y Townhouse`, `...room`, `Kitche...`, `...ting and
reviewing your plan — usu...`. Nearly every line meets a frame edge.

It is pre-existing and was not introduced here — only the band moved — and
`timeline.ts` § `expels` already records the same shape being fixed once before
("applied to the whole scene it cropped the drafting card on both sides"). The
resolution then was to expel only on the money-shot half; what nobody sampled
is that the money-shot half *begins* with the card still up.

It is the same question as the sheet's caption row, at a larger size: in 9:16,
during the hand-over, the frame is holding two subjects that need different
framings. Recorded with the still rather than guessed at.
Evidence: `out/stills/wp9/Studio-30-Vertical-9x16/08-handover+0.1s.png`.

---

## D39. The 9:16 picture clips, and what that settled.

D38 left one question open and called it a question: in 9:16, during the
hand-over, the frame holds two subjects that need different framings. The
commander answered it — the picture clips at the safe line and the chapter's
colour owns the bottom 390 px — and the answer settled two of the three findings
outright and changed the shape of the third.

### a. The clip

The mount box already cleared the platform furniture: `PICTURE.portrait` bottoms
out at 1520 against a 1530 safe line. **The mount is not the picture.**
`camera.ts` scales the whole layer about its origin, so a 2.6x push carries
content straight out of the box it was mounted in, and in 9:16 it lands in the
390 px the platforms cover with their own interface.

So the picture ENDS at `pictureClipBottom` and the chapter's colour owns the
band below it — which is exactly what a `split` scene has always done with its
type band, now one rule instead of two. A 20 px feather at the edge, because a
hard line across the paper reads as a crop while a short one reads as the sheet
running under the band.

⚠ The clip is the MOUNT's bottom rather than the safe line, and the ten pixels
are the point: clipping at 1530 would leave a sliver in which pushed-out content
could still show — the same defect with a smaller number on it.

⚠ **And the gates had to be told.** `camera.ts` reads `clipBottom` for
`fillScale` and for the protection bounds, so `verify:honesty` and
`verify:framing` passing the mount box and not the clip would have measured a
camera the renderer does not use. That is this repo's oldest failure — the gate
that re-implements what it checks — arriving through an omitted argument rather
than a re-derivation. It was live for the length of one commit.

### b. The nudge, and being honest about what it does

A text row must be wholly inside the clip or wholly past it. `framePush` can now
move the picture vertically by at most 48 px to make that true, choosing the
cheaper direction, deciding it **once per beat** (the choice flips when a row is
exactly half across, so a per-frame choice would jump by the row's own height),
and putting the result back through the protection clamp so the honesty caption
and the pill stay authoritative.

A TRANSLATE, never a scale, and that is the whole point of the shape: expelling
these rows raised the SCALE until the caption and the pill cropped — nine
failures — because everything in the lower third of the 9:16 design moves
together.

**With the shipping geometry the nudge does nothing.** The clip already puts the
sheet's caption row well below the edge, so every row is wholly outside and
removing the nudge reddens nothing. It is the mechanism that keeps the invariant
HOLDABLE, not a fix for a live defect, and its evidence comes from a probe that
forces the clip into a row:

| clip forced to 1780 | bisected |
|---|---|
| with the nudge | 2 |
| without the nudge | 6 |

The two that remain are the beats where the protection clamp eats the move,
which is the rule working rather than failing.

`verify:framing` asserts the invariant against `camera.ts`'s own
`sheetCaptionRect` and `spec.commandBar`. Scoped to the PICTURE clip: a `split`
scene's band is film furniture the picture deliberately runs under, and checking
it would be asserting that a design decision is a defect.

### c. The drafting sheet cannot be whole in 9:16, so it is gone

The brief was to hold a framing that contains the card and then punch in.
**Measured, that is not a punch-in.** At the money shot's framing the card is
**2491 px wide in a 1080 px frame — 231 %**. Containing it takes a scale of about
**1.07** against 2.60, which is a different shot; and at 1.07 the product's own
honesty caption is back inside the frame, so it can no longer be expelled and
`verify:honesty` fails eight ways on "whole or gone, never half".

That has now been measured three times across two rounds — as a protection (the
scale pops 1.61 → 2.71 in one frame), as an eased `lerpPush` (8 failures), and
as arithmetic. The conclusion is the same each time and it is structural: **the
card and the caption are vertically adjacent, so lifting one brings the other
back.**

So in 9:16 the card is GONE rather than half. A row of type is whole or it is
gone; a card is no different, and the sheet legitimately disappears a moment
later anyway. A HOST decision with the same standing as `closeFinding`: `state`
is a prop, a dismissed drafting sheet is an ordinary product state, and the film
already chooses which second of the screenplay to show. `src/replica` is
untouched. **16:9 keeps the card**, because there it is 78 % of the frame,
legible, with the walls coming up behind it — the hand-over reads.

The `sheet` check is about cuts **through words**, not every edge. Words run
horizontally, so a left or right edge through the card lands in the middle of
one; a panel whose blank lower edge runs past the frame is how a full-bleed
replica has always looked, and `draftCardBox` pads its height by 100 units for a
stale upstream spec — asserting on that would be asserting against a labelled
workaround. In 9:16 the picture also clips, so there the bottom counts too.

### Mutation evidence

| mutation | what reddens |
|---|---|
| keep the drafting sheet in 9:16 | 4 `sheet` per edit, one per vertical cut |
| the clip forced through a row, nudge removed | 6 `bisected` (2 with the nudge) |
| remove the picture clip | nothing — which is why the `bisected` assertion exists |

### What this round did not settle

The nudge is untested by the shipping geometry, and that is stated rather than
hidden. If the 9:16 arrangement ever moves a text row back across the clip, the
assertion fires and the mechanism is already there; until then it is insurance
with a probe attached rather than a proven fix.

---

## D40. The drawing's own labels, and the number that was optimistic.

Two founder-reported defects, and each turned out to be a rule that was asking
the wrong question rather than a framing or a level that needed nudging.

### The 9:16 render beat cropped the thing the beat is about

Reported as "the sheet crops at the right edge through the room labels".
Shooting the frame showed worse: half the frame empty dot-grid, the sheet cut
through `Powder room`, and the building **656 px off the right edge** of a
1080-wide frame.

**Two causes, both the same shape — a step change part way through a beat.**

- The pill's protection switched on the frame `state.rendering.p` crossed 0.5.
  A protection that appears on one frame yanks the framing on that frame. It is
  the third time this round a boolean in the middle of a beat has produced a
  defect (the drafting card's `visible`, D39-c; `drafting.visible` again in the
  protection attempt; now this).
- The camera's travel and that obligation had **separate clocks**. Half way
  through the move the framing was still the drawing at 0.94 fill — scale 2.4 —
  while the card was already 57 % opaque and had to be kept whole. Those two
  cannot both be satisfied, and the solver did the only thing it could.

So the protection ramps in over the card's own fade and is fully protective by
the 0.5 line `verify:honesty` reads, and the travel is never behind the
obligation. Stated as a rule: **by the time a thing must be whole, the camera
must already be framing for it.**

A third defect fell out of fixing it. A travelling beat interpolated the focus
RECT and solved once — and because the solver clamps, the framing it returns for
an intermediate rect is *not* between the framings for the two ends. It now
interpolates the two solved PUSHES, scale on a log axis. Both ends are
compositions the clamp agreed to, so every frame between them is bounded by the
two; the rect version could swing outside both, and did.

⚠ **The lean check could not have caught any of it**, because a travelling
camera is exempt from lean — and travelling is exactly when this happens. An
exemption that is right about the general case can hide the specific one.

### The rule: room labels, and two scoping decisions

`roomLabelRects` derives every room name and area from the compiler's own
`<text>` leaves through the same `planToWorld`/`worldToDesign` pair `PlanSvg`
draws them with, so it cannot drift from what is on screen.

Both scoping decisions were measured, not assumed:

| scope | red beats (B / A) |
|---|---|
| every `<text>` on the sheet | **42 / 41** |
| room labels only | 8 / 14 |
| room labels, 9:16 only, after the fix | **0 / 0** |

- **Room labels, not every text.** `page.texts` also carries the dimension
  chains — `7800`, `1400`, `550` — and those are a TEXTURE that runs off a
  punched-in shot by design. A rule that banned it would ban the film's entire
  camera language, and 42 red beats out of ~45 is a gate telling you it is
  asking the wrong question rather than a film with 42 defects.
- **9:16 only.** A 16:9 punch-in that clips `Hall 18.0 m²` at the top edge is an
  authored framing doing what a punch-in does — checked by opening the frame,
  where both rooms the beat is about stay perfectly legible. In 9:16 the picture
  meets a clip and a chrome band it did not choose.

The tolerance is the **model's own error**, stated rather than tuned: text
cannot be measured without fonts (`CLAUDE.md`), so a label's box is
`characters × font-size × advance` with the advance set above the real average
on purpose. An overhang under a fifth of the box is the model; more is a word
with a piece missing.

The command bar leaves the row rule. It is a control the picture runs under,
like a `split` scene's band, and its only text is a placeholder; it cannot be
nudged clear of the clip here without pushing the pill behind platform chrome,
and the pill wins.

MUTATION: untie the travel from the obligation → 2 failures in B, 3 in A, all on
the 9:16 render beats.

### The true-peak number was optimistic about the one thing with no margin

`B-daylight-forward+el`'s 15 s master measured **−1.0 dBTP** on the delivered
file — 0.027 dB under the ceiling — while the gate predicted −1.4 and called it
fine.

The prediction was not wrong about the MIX. A lossy encoder reconstructs a
waveform that is close in the ear and not identical on the sample, and the
difference lands on transients, which is what a true-peak meter is about. D33's
table already carried the same gap — the 60 s cut predicted −2.4 and measured
−1.2 — recorded as "unmodelled headroom" and left alone. That was defensible
until a master came within three hundredths of the line.

**So the gate stops predicting and encodes.** `mixAndMeasure` writes the float
mix, encodes it to the same AAC at the same bitrate `package-masters.ps1`
delivers, and measures that:

| | dBTP |
|---|---|
| float mix (what the gate used to report) | −1.4 |
| AAC encode (what it reports now) | −1.1 |
| rendered master (what the file measured) | **−1.0** |

LUFS is still read off the float mix — integrated loudness is a long-window
average the encode moves by hundredths, and true peak is the one it changes.

The ceiling moves to **−1.5 dBTP**, so a cut has half a decibel before the line
a platform limiter enforces rather than being declared fine at −1.0.

**And the dial is the opening cue.** Every bed enters at 0 s and the film's first
cue lands 40 ms later, so a master's highest sample is almost always their sum in
the first ~64 ms. `versions.<id>.openingCueTrimDb` is a per-cut trim on that one
cue — a CUE gain and never a bed level, which is the rule D33 set the first time
a cut came close. Two cuts needed one; all sixteen now sit at −1.8 dBTP or
better, and integrated loudness moved by at most 0.1 LU on any of them.

MUTATION: remove the trims → 1 `peak`, `B-daylight-forward+el` 15 s.

---

## D41. The gate was wrong by a decibel, and the fix is that it can now be told so.

D40 made the loudness gate encode its mix to AAC before measuring, on the
argument that the encoder is what moves a transient. It shipped green. Then the
founder measured the delivered files and `A-confident-arrival`'s 60 s master
came back at **−1.2 dBTP against a prediction of −2.3** — in both aspects, well
over the ceiling the gate had just been tightened to, reported as fine.

The standing hypothesis was bitrate: the gate encodes at `192k`, delivery is
~317 kbps. It is a good hypothesis. It is also wrong, and finding that out
first is the only reason the rest of this entry is worth anything.

### What it is not

The same offline mix for that cut, encoded four ways:

| | dBTP |
|---|---|
| wav float | −2.4 |
| aac 192k | −2.3 |
| aac 317k | −2.3 |
| aac 512k | −2.4 |

Bitrate moves the number by 0.1 dB. The gap is 1.1 dB. A plausible story that
explains a tenth of the evidence is not an explanation, and the acceptance test
here was numeric on purpose.

Delivery really is ~317 kbps, so the encoder is now **derived**: `mix.mjs` probes
a delivered master with `ffprobe` and encodes at its codec, bitrate, sample rate
and channel count, falling back to the measured 317375 and saying which it used.
That is worth doing regardless — a gate that claims to encode "what is
delivered" should not carry a number nobody has checked — but it is not the fix,
and the round would have ended in the wrong place if it had been allowed to look
like one.

### What it is

Decode the delivered film, align it against its own bed sample by sample, and
subtract:

| | A 60 s | B 15 s |
|---|---|---|
| film peak | −1.34 @ 0.0377 s | −3.09 @ 0.0378 s |
| bed alone | −4.26 | −3.01 |
| **film minus bed** | **−11.06 @ 0.0366 s** | **−10.97 @ 0.0366 s** |
| the opening cue, resolved | −11.01 | −11.01 |

Nothing is missing from the mix's content. The film is exactly the bed plus the
opening cue, at the gain the sheet says. What differs is **when, to within a few
milliseconds**: the film starts the cue on a frame boundary and decodes the bed's
MP3 through Chromium, the mix starts it at the exact sample and decodes through
ffmpeg. Where a sharp transient lands on a bed's entry, three milliseconds is
over a decibel of sum — constructive in one film, not in the other.

Frame-quantising the mix was the obvious next move and it fails its own test:
it fits A (−1.47 vs −1.34) and breaks B (−1.45 vs −3.09). The coincidence is
real in one bed and not the other, the residue is decoder-level, and modelling
it means modelling two MP3 decoders. **The model cannot be made right here.**

> ⚠ A trap for whoever looks next: a delivered mp4 decodes 2048 samples
> (42.7 ms) late — the AAC priming delay. Anything comparing a film against a
> mix has to align first, or it will confidently "find" a 43 ms offset that is
> not there. Both of this round's first two readings were that artefact.

### So the gate stops trusting itself

`package-masters.ps1` already measures the true peak of every delivered file
into `out/masters/<version>/MANIFEST.json`, and **that file is tracked even
though the masters are not**. `verify:loudness` now reads it, reports every
prediction against the reality beside it, and fails when the prediction is
optimistic by more than 0.3 dB.

Every other assertion in this gate is the model marking its own homework. This
is the only one that can tell it it is wrong, and on the code that shipped D40
it is red on exactly the cut the founder found.

The asymmetry is deliberate and is the whole safety argument: a prediction BELOW
the delivered peak is how a master ships at −1.2 under a green gate; a prediction
above it is merely over-cautious, so it is a note, not a failure.

### The margin is charged where the error is

A flat ceiling wide enough for the worst case would be −2.6 everywhere. The
evidence does not support that. The model agrees within 0.1–0.3 dB on every cut
whose peak is in the BODY — B 15 s +0.1, B 30 s −0.3, B 60 s +0.1, A 120 s −0.2
— and is wrong by 1.1 dB only where the peak is the opening transient. So the
rule is **−1.5 dBTP, plus the measured 1.1 dB when the peak falls in the first
100 ms**, and the extra margin is a number this round measured rather than a
number chosen to make the table green.

It also matters that the margin is scoped, because the dial only reaches the
scoped case: of the five cuts a flat −2.6 would have failed, three peak at
7.98 s, 100.5 s and 115.5 s, which `openingCueTrimDb` cannot move at all.

### Two more trims

| | trim | peak moves | result |
|---|---|---|---|
| `A-confident-arrival` 60 s | −9 dB | 0.045 s → 32.118 s | −2.6 dBTP |
| `B-daylight-forward+el` 15 s | −16 dB | 0.041 s → 1.448 s | −2.1 dBTP |

Both peaks are now in the body, where the model is accurate, so both are judged
against −1.5 and clear it with room. Integrated loudness is unchanged on both —
the trim is a cue gain, never a bed level, which is still D33's rule.

`B-daylight-forward+el` 15 s takes a second, deeper trim: D40's −10 moved its
peak from the opening to 0.041 s, which is still the opening. The dial had been
turned, not far enough, and only the manifest check could say so.

### Mutation evidence

| mutation | what happens |
|---|---|
| force the encoder back to `192k` | B 30 s goes red, and **A 60 s does not move from −2.6** — the bitrate hypothesis failing its own test one more time |
| remove both trims | 4 failures: 2 `peak`, 2 `model` |

### ⚠ Interim, and the line that would close it

A stale master is not a wrong model. Trimming a cut changes its audio, so the
file on disk stops corresponding to the sheet and the new check measures that
change rather than an error. The two have to be told apart, or the check loses
its teeth to its own fixes.

The manifest already records `renderCommit`, and the sheet's only per-cut dial
lives in a tracked file, so the gate asks git what `openingCueTrimDb` was at
that commit and compares it with now. A cut whose trim is unchanged is checked
against reality even if it carries one; only a cut that was actually retuned is
skipped, and the ⚠ says which kind of answer it is.

That is not yet enough, for a reason worth writing down: **both manifests on
this box were packaged with `workingTreeDirty: true`**, so the commit does not
describe the data that was rendered and the gate falls back — out loud — to the
blunt rule, any trim means possibly stale. The discriminator that closes it is a
**fingerprint of the resolved cue sheet recorded per file in `MANIFEST.json`**,
which `package-masters.ps1` does not write yet. A commit is a proxy for the
data; the data is available.

---

## D42. The correction: it was milliseconds, and it *was* modellable.

D41 measured the right thing and drew the wrong conclusion. It established that
the bitrate story was dead and that the gap between the offline mix and the
delivered film was a few milliseconds of alignment at the opening — and then it
declared that unmodellable, charged a flat 1.1 dB margin for it, and trimmed two
films to fit. This round found the mechanism in the composition, where it had
been written down all along.

### `<Sequence from={secToFrame(startSec)}>`

`FilmAudio.tsx` mounts every cue in a sequence, so **the film starts a cue on a
FRAME.** The offline mix started it at the cue's own second — up to 16.7 ms
away. That is the entire specimen: `A-confident-arrival`'s 60 s cut opens with a
cue about 7 ms from its bed's entry, and 7 ms is the difference between two
transients summing and merely following each other. The mix said −2.4 dBTP; the
film delivered −1.2.

D41 even tested frame-quantisation, saw it fit A and miss B, and stopped. It
missed because of the second term.

### The 16 samples, and saying plainly that it is empirical

Landing on the frame is most of it. The remainder is a constant 16 samples
(0.33 ms), measured by sliding bed+cue against the delivered film's own samples
on four cues across three films and two versions, each fit 3–200× sharper than
its neighbours. The direction is the odd part, and it is what the fits say: the
cue sits 16 samples **further along whichever way the frame rounding already
moved it**, and a cue already on a frame is not moved at all.

No mechanism is offered, because none was found and **a plausible mechanism
would be worse than none** — this round began by inheriting one. What licenses
shipping it is the end-to-end number rather than the story:

| | worst error vs the delivered film |
|---|---|
| the mix as it shipped in D41 | 1.1 dB, optimistic |
| + cues on frames | 0.4 dB, optimistic |
| + the 16 samples | **0.1 dB, over all 32 films** |

Every one of the 32 delivered masters is now predicted within 0.1 dB, and the
model names the sample each peak happens on. Three ways to be wrong were ruled
out by measurement first: the encoder's bitrate (0.1 dB), the bed's alignment
(exactly 2048 samples of AAC priming in every film, so nothing there), and
evaluating gains per frame as Remotion does (identical to the tenth of a dB on
every cut, so it is not in the code).

### So the margin goes, and both trims are re-derived

A margin for an error that has been fixed is not caution, it is a trim on the
film nobody asked for: D41's demanded −2.6 dBTP of any cut whose peak was early.
The ceiling is one number again, −1.5, and the two cuts that genuinely exceed it
were re-measured a decibel at a time against a model that is right:

| | D41 | now | result |
|---|---|---|---|
| `A-confident-arrival` 60 s | −9 dB | **−3 dB** | −2.0 dBTP |
| `B-daylight-forward+el` 15 s | −16 dB | **−8 dB** | −1.9 dBTP |

Both were wrong in both directions — calibrated against a mix in the wrong
millisecond, against a ceiling inflated by the same error. All sixteen cuts now
sit at −1.9 dBTP or better with integrated loudness unchanged to the tenth.

### The guard was excusing the cuts that needed it

D41's stale-master rule skipped the comparison-against-reality for any cut
carrying a trim — which is to say for exactly the cuts near the ceiling. Revert
the placement fix with A 60 s trimmed and its row reads 1.4 dB optimistic under
a green gate: the original defect with extra steps.

So the render writes down what it rendered. `package-masters.ps1` records a
**`cueSha` per film** — a fingerprint of the resolved sheet (file, start, gain,
length, fades) from `tools/version-info.mjs`, the process the render already
asks and the gate does not reimplement. Equal means the film on disk is the film
this sheet describes and the comparison is live whatever trims it carries.
The trim and render-commit heuristics stay as fallbacks for older manifests,
and each says which one it used, because **a skip that does not explain itself
is how a check stops checking.**

MUTATION: revert `cueStartSample` with A 60 s's data as that master was
rendered → ✗ predicts −2.3 dBTP, delivered −1.2, 1.1 dB OPTIMISTIC. The
founder's finding, reproduced as a red gate. Inject the current sha into B 120 s,
skipped until now, and its row goes live and passes at +0.0; inject a wrong one
and it reads "not checked: the cue sheet has changed".

### What this round is really about

Two hypotheses arrived with the work, both plausible, both wrong: the bitrate,
and then "the mix is missing something on that bed entry". The mix was missing
nothing — it had every sample, at the right gain, in the wrong millisecond. The
thing that kept the round honest was refusing to accept a story that explained
a tenth of the evidence, and the only assertion in this gate that can contradict
the model is the one that measures a film.
