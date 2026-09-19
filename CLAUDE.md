# CLAUDE.md — ArchCanvas «Studio»

The **third** ArchCanvas film, and the first one that is not cut from screen recordings.
Four lengths (15 / 30 / 60 / 120 s) × two aspect ratios = **eight masters**, built in
Remotion 4.0.522 at 30 fps.

What is on screen is a **coded replica** of the product's studio: the infinite canvas,
the brief composer, the drafting sheet, the plan drawing itself out by layer, an edit, a
parameter, the review pins, a rendering, the export menu. It is rebuilt in plain CSS and
React as a pure function of time, so it re-lays-out for a 9:16 frame instead of being
cropped into one.

Two earlier films exist and **neither is to be ported**: `../archcanvas-promo-video`
(HyperFrames, 92 s) and `../archcanvas-promo-remotion` («Zoom Out», 75 s, one continuous
camera move). What is inherited from the second is the engineering — the gates, the
seconds-not-frames law, `useLayout()`, the trap list below. Read `docs/decisions.md` for
what was deliberately not repeated.

---

## The four laws

**1. `src/replica/**` IS NOT EDITABLE HERE.** It is a one-way copy of
`archcanvas/src/components/marketing/studio-replica/`. Found a bug, need a nudge, want
a different string? **Fix it upstream in archcanvas and re-sync.**
`src/data/replica-lock.json` is the sha256 ledger and `npm run verify:replica` fails on
any drift, so an edit made here is a red gate, not a quiet divergence. The two repos
**never share a git remote**.

**2. Every word on screen is cleared, or it does not ship.** `docs/copy-clearance.md`
holds every phrase with the approved source it came from, and `capture/verify-copy.mjs`
is a gate. A phrase with no clearance row fails the build — deliberately: the line nobody
cleared is exactly the line that slips.

**3. Nothing on screen is mocked up.** Every drawing, every number, every rendering and
every interface string came out of the real product: the plans are baked by the product's
own compiler into `src/data/drawlist.json`, the renderings are the product's own output,
the strings are the product's own strings. A replica CAN draw a number no compiler
emitted — that is what `verify:numbers` is for.

**4. The timeline is derived, never typed.** Intent lives in **seconds** in `src/cuts.ts`.
`src/timeline.ts` is the only file that does arithmetic and the only one allowed to
contain a frame literal. Never write a frame number in a `from={}` or
`durationInFrames={}` anywhere else — `capture/verify-timeline.mjs` greps for it.

## Copy law — read before writing a single word

The authority is `../archcanvas-growth`: `strategy/positioning.md`,
`investor/founder-brief.md` §7 (bans B1–B14), `marketing/content/voice.md` (banned
words), `strategy/category.md` §6.

**A promo is the consumer room. Layer 1 and Layer 2 only, never Layer 3.**

Six that will bite:

- **"AI architect" is banned on legal grounds and is NOT on the B1–B14 card.** UK
  Architects Act 1997 s.20 (to £2,500 per offence; ARB's misuse policy names "websites
  (including URLs and metadata)" specifically) and NZ Registered Architects Act 2005 s.7
  (to NZ$10,000 — and NZ is the law the Terms chose). Write **"AI architectural
  designer"**. The product repo enforces `/\bAI architect(?!ural)/i`; **the growth repo
  has not been updated**, so do not copy from it verbatim.
- **B11 — only three things may be called measurement:** reachability, exact areas and
  byte-identical determinism. Clear widths, walk distances and furniture clearances are
  **advisory**, always. The safe verb is **"checked"**.
- **B12 — never say the gate blocks a defective plan.** `SHIP_RESIDUAL = true`: out of
  budget with defects left, it charges and ships. A **governor, not a gate**.
- **B4 — no "as code", no DSL jargon, no `.arch` source, and the DSL is never named.**
  `verify:replica` greps the synced replica for it too.
- **B3 — no permit or buildability overclaim.** Not "build from", not "buildable", not
  "permit-ready", not "code-compliant".
- **Do not open on "AI"** — open on the plan and the help. **No traction number, ever.**
  **No bare currency figure on screen** (USD on a `.uk` surface is DMCCA drip-pricing
  exposure).

**Two things must be on screen in every cut:**

- The **honesty caption**. A real design takes two to three minutes; the replica
  compresses it to seconds, and time compression read as a speed promise is a claim
  nobody made. **≥ 3 s in every one of the eight masters.**
- The product's own **"AI-generated" pill**, on any rendering, always visible, never a
  hover state (EU AI Act Art. 50).

## Structure

```
src/layout-core.ts   FPS, cut lengths, the 8 DELIVERABLES, deriveLayout(),     [React-free]
                     `stage` (type-safe) vs `picture` (the replica's box),
                     splitStage() — the split a `split` scene uses
src/layout.ts        useLayout() — the hook every component reads
src/cuts.ts          four EDLs, in SECONDS                                     [React-free]
src/scenes.ts        the 13-scene roster, its four kinds, the pace rules,      [React-free]
                     `camera.frame` (where the camera stands) + `camera.to`,
                     groundOf() / CARD_GROUND / MONTAGE_STAGES — the ONE table
                     of what colour a scene is, because the violet gate reads it
src/copy.ts          every word the FILM says in its own voice, + COPY_FLAGS   [React-free]
src/honesty.ts       the caption beat, the draw hand-over and the drafting     [React-free]
                     span — all DERIVED from the synced screenplay
src/timeline.ts      the ONLY frame arithmetic in the repo; resolveCut(),      [React-free]
                     honestyWindowFor(), timelineFor(cut, aspect) +
                     honestyWindow(cut, aspect) — grid-snapped, one clock, and
                     only `expelsCaption` differs between the frame shapes
src/camera.ts        the mount, the push, the protected-rectangle clamp        [React-free]
src/film-demo.ts     DemoInputs, the screenplay, the resolved pages, the       [React-free]
                     montage — all read out of the synced product data
src/cues.ts          the cue sheets, DERIVED by walking each cut frame by frame[React-free]
src/audio.ts         the manifests, the duck spec, the self-check              [React-free]
src/typefit.ts       size-from-character-count, because measuring needs fonts  [React-free]
src/caption.ts       CAPTION_SCALE — how big the film's own band sets          [React-free]
src/tokens.ts        the product's own colours, converted from OKLCH to sRGB   [React-free]
src/fonts.ts         Space Grotesk + Geist Mono, narrowed
src/assets.ts        every staticFile() as a LITERAL, so the gate can read it
src/Root.tsx         8 <Composition>s, mapped from DELIVERABLES
src/Film.tsx         <Sequence> per resolved beat + the honesty overlay + sound
src/components/      SceneRouter · KineticCard/SplitLine/ChapterChip ·
                     ReplicaSlot · SecondBrief · EndCard · HonestyCaption ·
                     FilmAudio · Camera (PushLayer)
src/data/music-grid.ts  the beat grid, read off the delivered mp3
src/replica/         SYNCED, NOT EDITABLE — the product's own studio replica
src/replica-data/    SYNCED types + STUDIO_DEMO + the generated seam (index.ts)
src/data/            drawlist.json (the numbers gate's record), landing.json
                     (what the film DRAWS), showcase-plans.json (the montage,
                     baked at sync time), music.json, sfx.json,
                     replica-lock.json (the ledger)
public/brand/        the product's wordmark + icon, for the end card
public/renders/      SYNCED renderings
public/audio/        the four beds + fourteen synthesised cues
capture/             the gates, and `stills.mjs` — the look pass
scripts/             sync-replica.mjs + verify-replica.mjs
```

The React-free files are bundled and executed in Node by `capture/lib/load-core.mjs`, so
the gates test the real code rather than a re-implementation of it. **Keep them free of
React and Remotion imports** — esbuild will blow up loudly if one creeps in, and that
failure is the tripwire working. It exposes two entry points: `loadCore()` for the
modules a timeline question needs, and `loadFilm()` for the ones that reach the synced
replica and the ~1.4 MB of baked payload behind it.

## Commands

```bash
npm install
npm run sync:replica                          # from ../archcanvas
node scripts/sync-replica.mjs --from <path>   # from a worktree or any checkout
node scripts/sync-replica.mjs --check         # hash-only; exit 1 on drift
npm run dev                                   # Remotion Studio

npm run lint                                  # tsc --noEmit
npm run verify                                # assets -> replica -> timeline -> copy -> numbers
                                              #   -> audio -> honesty -> framing -> violet
                                              #   -> opening
npm run stills --  --comp Studio-30-Landscape-16x9   # six beats of one master
for c in ...; do node capture/stills.mjs --comp $c; done   # a full sweep, per comp
node capture/stills.mjs --sheet --comp <id>   # contact FRAMES for one cut
npm run stills:sheet                          # tile them, once, from disk —
                                              #   BOTH aspects, grid aimed at 16:9
node capture/stills.mjs --at 30-Land:7.4,9.1  # ad-hoc seconds, for a look-fix pass
pwsh -File ./render.ps1 -ListOnly             # the plan + the orphan scan, renders nothing
pwsh -File ./render.ps1                       # all eight, sequential
npm run verify:flash out/<master>.mp4         # EVERY master, not one
```

## Traps already paid for

Carried over from `../archcanvas-promo-remotion`, `../chan-meng-promo-video` and
`../a11y-loop-promo-video`. Every one of these cost real time somewhere. **Do not
rediscover them.**

- **Measure layout only after `document.fonts.ready`.** An effect runs before the
  webfonts are applied, so text is sized in fallback metrics — and the fallback layout
  can be *shorter*. An overflow guard once reported a comfortable fit on a frame
  overflowing by 507 px. Any layout assertion here must hold a `delayRender` and wait.
- **Remotion shows only the first line of a `cancelRender` message.** Keep every
  diagnostic on one line or you will not see it.
- **Remotion fails *softly* on a missing `staticFile()`** — you get a blank region, not
  an error, so a long render can complete and ship with a hole in it. `verify:assets`
  runs first for exactly this reason.
- **Don't probe audio durations in `calculateMetadata`.** It runs in Studio *and* in
  every render worker, and a catch-block that substitutes a default is how a film ships
  at placeholder timing with nobody noticing. Probe once with ffprobe in Node, commit the
  number, read it synchronously.
- **Use the core `remotion` `<Audio>`, not `@remotion/media`'s.** The latter previewed
  fine and rendered a silent track (−91 dB across the file) in a11y-loop-promo-video.
- **Always clamp `interpolate`** — `extrapolateLeft` *and* `extrapolateRight`. Prefer
  `ramp()` / `clamp01()` from `timeline.ts`, which cannot extrapolate.
- **Scenes never read `useVideoConfig().width`.** They read `useLayout()`. A component
  inside a `<Sequence>` also must take its length as a `dur` prop —
  `useVideoConfig().durationInFrames` reports the *composition* length there.
- **Authored line breaks, rendered `nowrap`.** The same string breaks in different places
  at 1080 and 1920 wide; a bad break must show up as an overflow failure, not a silent
  reflow.
- **Never put `will-change` on a large layer.** It asks Chrome to allocate backing store
  for the whole thing. Renders were killed for memory with 5.4 GB free on a
  22,250 × 22,881 px one. The tell: **when more memory does not help, the problem is not
  memory.** `verify:replica` greps the synced replica for it.
- **More than about twenty `<Img>` elements in one object will not render.** Remotion
  registers a `delayRender` per image and never finishes the queue; it fails naming an
  arbitrary-but-deterministic one, which reads like a corrupt file and is not.
  Downscaling does not help, because the cost is the COUNT. Composite montages offline.
- **A killed Remotion render does not clean up after itself.** Three killed renders
  accumulated **5.3 GB across 18 orphaned processes**, which then got the next render
  killed for memory. `render.ps1` scans before the run and between every master, filtered
  on **both** the process name and this project's own `node_modules` path, and only ever
  prints.
- **Never name a PowerShell variable `$args`, and never write `& npx @args`.** `$args` is
  an automatic variable; `@args` splats the empty automatic one, npx opens an interactive
  shell, that shell exits 0, and the summary reports a PREVIOUS render's master as this
  run's output. A green run that rendered nothing.
- **Check a vendor's plan tier BEFORE spending its credits, not before shipping.**
  ElevenLabs' free plan carries no commercial licence, and its terms say content created
  outside a paid subscription — *before or after* — cannot be used commercially.
  Upgrading later does not license what already exists. Twelve assets were deleted over
  this. `GET /v1/user/subscription` answers it in one call. See `docs/decisions.md` D4.
- **A long still run through ONE browser exhausts its network resources.**
  `@remotion/google-fonts` fetches the two faces from `fonts.gstatic.com` on every
  page, and after a few dozen stills in one session the fetch fails with
  `net::ERR_INSUFFICIENT_RESOURCES` — which surfaces as a bare
  `[NetworkError: A network error occurred.]` and takes the whole run with it,
  part-written. `capture/stills.mjs` is therefore run **per composition**
  (`--comp`) for a full sweep, not once over all eight. The tell is the same as
  the memory one: the failure names the network, and the cause is the count.
- **A gate whose input set can go empty reports success by doing nothing.** The sibling
  project produced that failure four times in one day. Every gate here says out loud how
  many things it looked at, `verify:assets` prints a VACUOUS banner at zero
  `staticFile()` calls, and `verify:replica` fails on a missing or empty lock rather than
  skipping. **Before trusting a green gate, ask what it actually looked at.**
- **ffmpeg on Windows/PowerShell:** wrap it in `$ErrorActionPreference = "Continue"`
  (ffmpeg writes progress to stderr, which PowerShell turns into error records); put
  `-ss` **after** `-i` (input seeking on an mp3 can land ~26 ms out); pass `-vn` when
  touching a SUNO file (embedded cover art becomes a video stream otherwise).

## Don'ts

- **Don't edit `src/replica/**`.** Fix it upstream and re-sync. This is law 1.
- **Don't add an archcanvas git remote to this repo.** Ever.
- **Don't commit the masters.** Tens of MB each, eight of them, and git keeps every
  version forever. GitHub Release assets.
- **Don't write a frame number outside `timeline.ts`.**
- **Don't name the DSL, show `.arch` source, or write "as code".**
- **Don't put a number on screen that is not in `src/data/drawlist.json`.**
- **Don't aim the camera by hand.** `camera.ts` resolves a scene's focus through the
  replica's own `layoutMap`, so a shot cannot drift from the thing it frames.
- **Don't hand-place a sound cue.** `cues.ts` derives them from what the product is
  doing at that frame; the same 35 s of screenplay runs at 2.50x and at 0.46x.
- **Don't run a full render to check a change.** Render a still, look at it, then render.
- **Don't run eight renders in parallel**, and don't run a render beside a `check:full`
  in the product repo. One machine, 16 GB, and it has been rebooted over this before.
