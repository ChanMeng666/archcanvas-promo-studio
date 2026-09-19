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
5. **Colour arrives once and leaves.** One aubergine card on the money line, one
   plum band across the end card on the `end-hit`. Everything else is ivory,
   ink, and violet as a spot.

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
container-query unit inside the `border` shorthand). They are 1 px again, which
is why the replica reads crisper in the final stills than in the ones the look
passes were done on. It does not change the finding behind D15 — the composer
card's hairline is 1.3:1 against the paper by design, so at a 1.22x framing it
is still not a card edge a viewer sees.

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
