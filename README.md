# archcanvas-promo-studio

The third promotional film for **[ArchCanvas](https://archcanvas.uk)**, built in
[Remotion](https://www.remotion.dev/). Four lengths × two aspect ratios, from one scene
library and one edit per length.

| | 16:9 · 1920×1080 | 9:16 · 1080×1920 |
| --- | --- | --- |
| **15 s** — what it does | `Studio-15-Landscape-16x9` | `Studio-15-Vertical-9x16` |
| **30 s** — and why | `Studio-30-Landscape-16x9` | `Studio-30-Vertical-9x16` |
| **60 s** — and how | `Studio-60-Landscape-16x9` | `Studio-60-Vertical-9x16` |
| **120 s** — the long form | `Studio-120-Landscape-16x9` | `Studio-120-Vertical-9x16` |

450 / 900 / 1800 / 3600 frames at 30 fps. The vertical cuts are a **re-layout, not a
crop**.

## What is different about this one

The two earlier films are cut from screen recordings. This one renders a **coded replica**
of the product's studio — the infinite canvas, the composer, the drafting sheet, the plan
drawing itself out layer by layer, an edit, the review pins, a rendering, the export
menu — rebuilt in plain CSS and React as a pure function of time.

That buys three things a recording cannot give: a portrait layout that is the product's
own portrait layout rather than a crop; a picture that goes red when the product's
strings change instead of going stale in silence; and one source that renders both this
film and the landing page's own loop.

The replica's home is the **private product repo**, at
`archcanvas/src/components/marketing/studio-replica/`. It is copied here **one way** by
`npm run sync:replica`, which also writes a sha256 ledger. See `docs/decisions.md` D1–D2.

## Quick start

```bash
npm install

# stage the replica, the baked plan data and the renderings from the product repo
npm run sync:replica                          # sibling ../archcanvas
node scripts/sync-replica.mjs --from <path>   # or any checkout / worktree

npm run dev        # Remotion Studio
npm run lint       # tsc --noEmit
npm run verify     # ten gates: assets, replica, timeline, copy, numbers, audio,
                   #   honesty, framing, violet, opening
```

Render a still before rendering anything long:

```bash
npx remotion still src/index.ts Studio-15-Landscape-16x9 out/stills/check.png --frame=30
```

Then the masters, sequentially:

```bash
pwsh -File ./render.ps1 -ListOnly   # the plan and the orphan scan, renders nothing
pwsh -File ./render.ps1             # all eight
npm run verify:flash out/<master>.mp4
```

## Repository status

**Cut, not rendered.** The product's own studio is synced and mounted, the camera
frames it through the replica's own layout map, the sound is derived from what the
picture is doing frame by frame, and all eight compositions play end to end. No master
has been rendered: that is WP-11, and it happens after a person has looked at the
stills.

The replica is synced from the product repo and committed — `npm run verify:replica`
re-hashes every file against `src/data/replica-lock.json`. With nothing synced, that
gate and `verify:numbers` **fail on purpose**: a gate that passes with nothing to check
is how a repo ends up believing it holds a film when it holds a scaffold.

```bash
node capture/stills.mjs --comp <id>           # six beats of one master
node capture/stills.mjs --sheet --comp <id>   # contact frames, one second apart
npm run stills:sheet                          # tile them into one sheet per cut
```

⚠ Run the still sweep **per composition**. `@remotion/google-fonts` fetches from
`fonts.gstatic.com` on every page, and past about forty stills in one browser
session that fetch starts failing — surfacing as a bare `[NetworkError]` that
takes the whole run down, part-written.

| | Owner | State |
| --- | --- | --- |
| scaffold, sync, gates, layout, timeline | WP-6 | done |
| scenes, cuts, the eight compositions | WP-7 | done |
| audio — licence check, bed, SFX, beat grid | WP-8 | done |
| the replica mounted, camera, scenes, sound, end card | WP-9 | done |
| stills review | WP-10 | to do |
| the eight masters | WP-11 | to do |

**One line is still open.** `Tweak a number.` rides over the tweak beat in the 60 s and
120 s cuts and nobody has cleared it. `COPY_FLAGS.tweakLine` in `src/copy.ts` turns it
off without changing a second of any edit — see `docs/copy-clearance.md`.

## Documentation

- **`CLAUDE.md`** — the four laws, the copy law, and the trap list. Read it first.
- **`docs/decisions.md`** — what was decided on purpose and what was deliberately not
  repeated from the earlier films.
- **`docs/copy-clearance.md`** — every line on screen, with the source it came from.

## Licence

UNLICENSED. Private. The ArchCanvas name, brand and product interface are not licensed
for reuse.
