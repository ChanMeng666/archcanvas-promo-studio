# Traps already paid for

`CLAUDE.md` § *Traps already paid for* is the full list. These are the ones that bite
while cutting, rendering and reviewing a version. Every one cost real time once.

## Memory and process

- **Never put `will-change` on a large transformed layer.** It asks Chrome to allocate
  backing store for the whole thing — once 22,250 × 22,881 px, which killed renders with
  5.4 GB free. The diagnostic that generalises: **when more memory does not help, the
  problem is not memory.** `verify:replica` greps the synced replica for it.
- **More than about twenty `<Img>` elements in one object will not render.** Remotion
  registers a `delayRender` per image and never finishes the queue, then fails naming an
  arbitrary-but-deterministic one, which reads like a corrupt file and is not. Downscaling
  does not help — the cost is the **count**. Composite offline, or use inline SVG (which
  is what the montage does).
- **A killed render does not clean up after itself.** Three killed renders left 5.3 GB
  across 18 orphaned processes, which then got the *next* render killed for memory — a
  loop that reads as "this film is too heavy" and is not. `render.ps1` scans before the
  run and between every master and **only ever prints; a human decides what to kill.**
- **Filter processes by name AND path.** `render.ps1` matches four executable names
  *and* this project's own `node_modules` path against `CommandLine` or `ExecutablePath`.
  The path keeps the founder's Chrome and the sibling film's render out of the list; the
  name keeps out terminals and greps that merely mention the path. Dropping either half
  produces a list you cannot act on.
- **Don't run eight renders in parallel**, and don't run one beside a `check:full` in the
  product repo. One machine, 16 GB; it has been rebooted over this.
- **A long still run through one browser exhausts its network resources.**
  `@remotion/google-fonts` refetches both faces per page, and after a few dozen stills the
  fetch dies with `net::ERR_INSUFFICIENT_RESOURCES`, surfacing as a bare
  `[NetworkError: A network error occurred.]` and taking the part-written run with it.
  Run `capture/stills.mjs` **per composition**. Same shape as the memory one: the failure
  names the network, the cause is the count.

## PowerShell

- **Never name a variable `$args`, and never write `& npx @args`.** `$args` is an
  automatic variable; `@args` splats the empty one, npx opens an interactive shell, that
  shell exits 0, and the summary reports a *previous* run's master as this run's output —
  a green run that rendered nothing.
- **Print modification times.** A file existing is not evidence that *this* run wrote it.
  `render.ps1` prints `modified … (N min ago)` beside every master for exactly this.
- **`@(...)` around a filtered collection.** A single hashtable's `.Count` is its key
  count, which once made the banner announce five masters when one was selected.

## Timeline and frames

- **Inside a `<Sequence>`, `useCurrentFrame()` counts from that sequence's own start.** A
  helper subtracting `beat.startFrame` from a local frame goes negative, clamps to 0 and
  pins the replica's clock to the start of every beat — every push runs, every card
  animates, and the product stands still. It did exactly that, and one still caught it
  (`t = 9.30 s` at a frame where the arithmetic said 11.59). Law: **local frames in a
  component, absolute frames only in `beatAtFrame`.**
- **No frame literal outside `src/timeline.ts`.** `verify:timeline` greps for it.
- **Always clamp `interpolate`**, both ends — prefer `ramp()` / `clamp01()` from
  `timeline.ts`, which cannot extrapolate. And beware an ease with a flat tail: it parked
  the camera on its subject before that subject existed.
- **Decide framing per beat, not per frame.** Per frame, it lurched 35 % in the last half
  second.

## Stale things passing as fresh

- **Derive, don't type.** `DRAW_HANDOFF_SEC` as a literal `9.3` would not have noticed
  upstream moving the beat; it is derived from the synced screenplay instead. The same
  argument retires every hand-typed number that has a source.
- **Copy a type you do not own by spreading it, and name the fields you drop.** A
  hand-shaped map of the findings type would have silently lost `level` when it landed
  upstream, with every gate green.
- **A stale number in a one-way copy is a labelled workaround, not a fix.**
  `DRAFT_CARD_SPEC_SHORTFALL` pads a `spec.draftCard` of 300 against a rendered ~400; it
  is documented as film-side and deleted when upstream fixes it.
- **A still that is never TAKEN is a defect that cannot be found.** `stills.mjs` shot the
  money shot at 45 % through its beat; the film's opaque honesty band was printing over
  the product's drafting sheet for the first 0.4–0.8 s of it, in every cut, in both
  edits. Three look passes, eight rendered masters and eleven green gates never sampled a
  frame that had it. The hand-over frames are in the standard set now. **When a defect
  survives a look pass, ask what the look pass SAMPLES before asking what the code does.**
- **Screenshots shot and never opened are not a look pass.** Every finding in the three
  look-fix passes was invisible to a green gate, and a look pass run against a build that
  is not the shipping one misses the thing it was for.
- **The version selector must be `REMOTION_FILM_VERSION`.** `src/version.ts` runs in Node
  for every gate and in a BROWSER inside the Remotion bundle, and Remotion injects only
  `REMOTION_`-prefixed variables into the second one. Unprefixed, `FILM_VERSION` selected
  the version for every gate and for **nothing that renders** — every still and every
  master silently fell back to `music.json`'s `active`, and the two `+el` versions were
  unrenderable. Set **both** variables, and prove it with a frame rather than a claim:
  `REMOTION_FILM_VERSION=A-confident-arrival npx remotion still
  Studio-15-Landscape-16x9 out/env-check.png --frame=120` must show edit A's drafting
  sheet, not edit B's aubergine card (`docs/decisions.md` D36).
- **`--scale` must produce integer dimensions.** 1080 × 0.667 = 720.36 and Remotion
  refuses it, after bundling and rendering every frame. 0.5 and 0.75 are safe.
- **A gate whose input set can go empty reports success by doing nothing** — four times in
  one day in a sibling repo. Every gate here prints how many things it looked at;
  `verify:assets` prints a VACUOUS banner at zero `staticFile()` calls. **Before trusting
  a green gate, ask what it actually looked at.**

## Rendering and assets

- **Remotion fails *softly* on a missing `staticFile()`** — a blank region, not an error,
  so a long render completes and ships with a hole in it. `verify:assets` runs first for
  this reason, and `src/assets.ts` keeps every path a literal so the gate can read it.
- **Remotion shows only the first line of a `cancelRender` message.** Keep diagnostics on
  one line.
- **Measure layout only after `document.fonts.ready`.** An effect running before webfonts
  apply sizes text in fallback metrics — which can be *shorter*, so an overflow guard once
  reported a comfortable fit on a frame overflowing by 507 px.
- **Don't probe audio durations in `calculateMetadata`.** It runs in Studio *and* every
  render worker; a catch-block substituting a default is how a film ships at placeholder
  timing with nobody noticing.
- **ffmpeg's `image2` demuxer stops at the first gap** in a `%03d` sequence — one frame on
  black. Contact frames are indexed contiguously with the second as a suffix.
- **Keep an expensive step upstream of a cheap one separable.** A 30-frame batch dying on
  frame 29 destroyed the tiling of 28 good frames, which is why tiling is its own command.
- **Tile both frame shapes.** A round of defects once lived only in 9:16.
- **Don't run a full render to check a change.** Render a still, look at it, then render.
