# CLAUDE.md — `src/components/marketing/studio-replica/`

**A coded reproduction of the ArchCanvas studio that is a pure function of time.**
`at(screenplay, t) → ReplicaState`, then `<StudioReplica state demo pages layout />` renders it.
It replaced the landing page's 30 KB screenshot, and it runs in **two repos**: here, inside
Next.js, and in the private promo-film repo (`D:\github_repository\archcanvas-promo-studio`,
Remotion), which receives this directory **verbatim** through a one-way copy.

Almost every rule below exists because that second host has no Next.js, no Tailwind, no `@/`
alias, and — the sharp one — **no wall clock**: Remotion paints frame 900 before frame 12, each
in a fresh page, on several workers. Anything that reads a clock, animates itself, or reaches
outside this directory is correct here and broken there, silently.

Narrative: `docs/specs/2026-09-19-studio-replica-and-promo-film.md`.
Mechanical enforcement: `tests/studioReplicaPurity.test.ts` (imports, clocks, CSS, scoping),
`tests/studioReplicaStrings.test.ts` (copy), `tests/studioReplicaCore.test.ts` +
`tests/studioReplicaLayout.test.ts`, `tests/dom/studioReplica*.test.tsx`,
`tests/marketingNoCode.test.ts`, `tests/landingReplicaBoundary.test.ts`.

---

## The laws

### 1. `at(t)` is total and time-pure — and the clock lives in ONE named file

No `Date.now`, no `performance.now`, no `new Date`, no `Math.random`, no `requestAnimationFrame`,
anywhere except **`useReplicaClock.ts`**, which is the web host's rAF loop and the only file here
that may carry `"use client"`. It is deliberately not allowed a *wall* clock either: rAF hands its
own timestamp to the callback, and a wall clock is what makes a loop that was parked off-screen
jump the seconds it spent parked. It is also kept **out of `index.ts`** — a Server Component
importing the barrel would inherit a client boundary it never asked for.

`at()` must survive every `t`: negative, `NaN`, past the end. `NaN` reads as the opening frame, an
overrun as the closing one.

**If you ignore this:** two renders of the same film frame disagree, and the defect shows up as a
flicker in an exported MP4 that no test in a browser can reproduce.

### 2. Nothing in here animates itself

No `transition`, no `animation`, no `@keyframes`, no `will-change` — in `replica.css` **or** in an
inline style object. Every moving value is computed from `ReplicaState`.

A CSS transition interpolates on the wall clock: right at 60 Hz, simply wrong in a frame renderer,
which catches it at an arbitrary point or never starts it. `will-change` is banned for a second
reason — it promotes a compositing layer per element, and a morph paints a ~280-node drawing twice
over. That is how a 16 GB box runs a renderer out of memory.

### 3. Relative imports only, and only to siblings

`react` is the one allowance. No `@/`, no `next/*`, no `gsap`, no `framer-motion`, no `lucide-react`
(`icons.tsx` inlines the same paths at lucide's own geometry, under its ISC licence — the film repo
must not grow a dependency to render a 24×24 path), no Tailwind class names. Every rule in
`replica.css` is scoped under `.studio-replica`, because the film imports that stylesheet beside
its own and one unscoped `div { … }` would restyle a whole other application — and nothing in
*this* repo would change.

### 4. App tokens, not the `.mkt` layer — with one carve-out

`replica.css` mirrors `:root` in `src/app/globals.css`. It is a picture of the **product**, and
the product runs on the app palette, not on the marketing layer.

⚠ **The carve-out is the marketing weight law.** `(marketing)/marketing.css` sets `font-weight:
350` throughout — the brand voice. The replica's **interior** is exempt, because it mirrors a
product that uses heavier faces. Everything **below** the box — the pause button, the seven step
chips, the progress hairline — is marketing chrome and is *not* exempt; those rules live in
`marketing.css` under `.mkt-demo-*`.

### 5. Strings are byte-faithful, and proved against product source

`strings.ts` is the only place words live. `tests/studioReplicaStrings.test.ts` imports the real
constant where the product exports one (e.g. `phaseLine` from `src/lib/chat/designerProgress.ts`)
and reads the product source as text where the string is inline JSX.

**Change the product's copy and that test goes red.** That is the design: fix `strings.ts`, do not
"fix" the test. A string here that the product does not say is a lie about the product.

### 6. Nothing inside is focusable, and nothing names the compiler

The whole subtree is `aria-hidden`; the HOST gives it `role="img"`, a name, and a described list
of steps, and owns the only real controls. A `<button>` in here is a control inside an image: a
tab stop that leads nowhere.

The compiler's name is a machine substrate the buyer never sees. `ArchLang` must not appear in
this directory at all, **comments included** — a name in a doc comment is one paste from a name in
JSX. (`studioReplicaPurity` sweeps here; `marketingNoCode` sweeps the landing hosts, the generated
modules and the drawing's own text.)

### 7. The plan draws at the COMPILER's millimetre weights — NOT `non-scaling-stroke`

`PlanSvg.tsx` must **not** put `vector-effect="non-scaling-stroke"` on plan nodes. The viewBox is
in millimetres, so a 19 mm door line becomes 19 CSS **pixels**: measured on the first pass, the
plan rendered as a black rectangle wrapped in blue bars.

The property is right in exactly one place — `.sr-ghost svg *` in `replica.css`, where the ghost
deliberately throws the weights away for one hairline — and it is right in
`src/components/landing/PlanDraw.tsx`, which is a different thing (a decorative wireframe). Do not
generalise from either.

### 8. A hairline is a literal `1px`, and may never go inside `max()`

`--sr-hair: 1px`. Two reasons, and the second cost an afternoon:

- the product does not scale its hairlines — a divider is 1 px on a phone and 1 px on a 27-inch
  monitor; a "proportional" one is a bar;
- **`max(1px, calc(var(--u) * 1))`, where `--u` is a `cqw`, is silently dropped inside the
  `border` shorthand.** Every card, pill and outline rendered with *no edge at all* while the
  shadows underneath made it look almost right. Four iterations before it was seen.

Everything else geometric goes through `--u` (design units): landscape draws into a nominal
1600×1000 box, portrait into 1000×1333.

### 9. `CAMERA_ENVELOPE` is a contract between `layout.ts` and `screenplay.ts`

`layout.ts` exports `{ maxZoom: 1.06, cyBudget: 0.05, cxBudget: 0.09 }`; every `camera` beat must
stay inside it, and `tests/studioReplicaLayout.test.ts` walks the loop asserting the sheet stays
whole. A bigger push buys a closer look and costs paper on **every other frame** — an explicit
trade, not an accident. A push past the envelope slid the title block under the command bar and
cut the scale bar off the "finished drawing" frame.

⚠ A camera push **cannot** fix the legibility of design-space chrome (the command bar, the open
finding card): that chrome does not ride the camera, so a push enlarges the drawing and leaves the
card where it was. The lever is the type size.

### 10. The export menu shows Image + CAD, on purpose

`EXPORT_GROUPS` is a **partial view of the real menu**, not an invented one. The product's third
group names the source format, which is machinery the buyer never needs to see. Two groups, four
items, the same labels and sublabels the product uses.

### 11. Review findings are real `lint()` output — never hand-written

The three pins quote the compiler's own sentences about the baked plan, produced by
`scripts/generate-studio-demo.mjs` and committed into `src/lib/marketing/studioDemo.generated.ts`.
`screenplay.ts`'s `FIXTURE_DEMO` carries self-identifying `FIXTURE finding …` placeholders instead
of criticism, so a fixture can never be mistaken for shippable copy.

`tests/archlang/studioDemoFindings.test.ts` re-runs the real compiler and proves the quotes are
still its words. **When it goes red after an archlang bump, re-bake — do not edit the generated
file.**

### 12. A review pin belongs to a FLOOR, and the badge belongs to the DESIGN

`ReviewFinding.level` carries the storey a finding is about; `pinAnchors` reports `onThisPage`, and
`ReviewPins` renders the pin, the open card and its leader only when that is true. A finding with
no level is about the **sheet** (a scale that does not fit the paper) and stays on every page, at
the paper's edge.

Without it the two ground-floor pins went on hovering over the **first** floor the moment the
Render chapter switched storeys — pointing at rooms that are not on that drawing.

⚠ Two things that look like bugs and are not. The **badge still counts 3 on both floors**, because
the product's does: `buildReviewPins` is per FRAME and `DesignFrame`'s ⚑ counts the lot. And
`onThisPage` is *reported*, never filtered out of the array — `openPin` is an index into
`state.review.findings`, so a compacted list would open a different finding.

What the product does with an off-storey pin is drop it into its **unanchored list**, which this
replica retired in favour of one card at a time; hiding is the closest behaviour left.

### 13. The honesty caption is a disclosure, so it must be READABLE

`HONESTY_CAPTION` — "Sequence shortened — a design really takes two to three minutes." — is on
screen at **full opacity for ≥ 3.0 s** every loop. A real design takes minutes; the loop compresses
it to seconds, and without the sentence the compression reads as a speed promise.

Present in the DOM is not the claim. `tests/dom/studioReplicaHonesty.test.tsx` integrates seconds
at opacity ≥ 0.99 off the rendered node, against the screenplay the landing page actually serves.
The portrait break is **derived** (`captionTextLines` splits at the sentence's own em dash and the
halves concatenate back), so the words exist in exactly one constant.

The "AI-generated" pill on the rendering card is the same class of rule, for EU AI Act Art 50:
every frame the image is on screen, not only the settled one.

---

## Hosts — `src/components/landing/`

Three files, and the split is the whole budget story. (No nested `CLAUDE.md` of their own: they
are one subsystem with this directory, per `docs/DOCS-POLICY.md` rule 2.)

- **`StudioSection.tsx` — a Server Component, and it stays one.** It renders `at(sp, posterSec)`
  as a static poster from the typed module alone, in **both** layouts, with a media query hiding
  one. No fetch, so the section is complete with JavaScript off, under reduced motion, and in the
  first paint; the visible poster's own aspect ratio sets the box height, so the animation swapping
  in later costs **zero layout shift**. It also imports `replica.css` here rather than in the
  `(marketing)` layout, so no other route carries it.
- **`StudioReplicaMount.tsx` — the only client module in the `/` first load.** An
  IntersectionObserver (`rootMargin: 200px`) dynamically `import()`s the player and fetches
  `landing.json` as the section comes up. `prefers-reduced-motion: reduce` **or** `Save-Data`:
  nothing loads and nothing plays, and there is no play button, because a play button that starts
  motion is what was asked not to happen — the chapter chips still work and show a still.
  No JS, or the fetch fails: the poster alone, with the controls never rendered.
- **`StudioReplicaPlayer.tsx`** — the lazily loaded half that owns `useReplicaClock`.

⚠ **A static import of the player, or of `landing.json`, compiles and renders identically and puts
the whole renderer back in the entry chunk.** `tests/landingReplicaBoundary.test.ts` is the
tripwire. `import type` from the player module is fine and is what keeps the dynamic import typed.

**The controls are a TOOLBAR, not APG tabs.** Seven chips drive one region and playback moves the
marker on its own, so `aria-selected` would repeatedly claim a selection nobody made, and a roving
tabindex following playback would move the tab stop out from under a keyboard user who had paused
to read. Roving index follows **focus**; `aria-current` follows **playback**. Activating a chip
seeks **and pauses** — someone who reaches for "Review" wants to look at it.

---

## Working on it

**See it without a dev server.** The replica is a pure function of time, so it needs no server, no
database and no browser to produce a frame:

```bash
npx tsx --tsconfig scripts/tsconfig.bench.json scripts/studio-replica/preview.mts
```

Server-renders a list of `t` values as self-contained HTML, screenshots them with the globally
installed Playwright, and emits a **contact sheet** — one frame per second of the 35 s loop — into
`D:\.claude-scratch\<date>\studio-replica\preview\`. Every layout bug named above was found here.

⚠ **Marketing QA needs `npm run dev -- --turbopack`.** The webpack dev compiler refuses
`src/instrumentation.ts`'s `node:` import and every page render 500s. Dev-only, not caused by this
round, tracked in `docs/TODO.md`.

**Re-bake the data** with `npm run studio-demo:build` (free, offline, deterministic, **byte-
idempotent** — running it twice is zero git diff). It writes only its own five paths and
**deletes nothing, ever, and never sweeps a directory**: `corpus:build` once cleaned its output
directory and took a nested `CLAUDE.md` with it.

---

## The film repo: ONE WAY OUT

`D:\github_repository\archcanvas-promo-studio` copies this directory with its own
`scripts/sync-replica.mjs` and records a sha256 ledger in `src/data/replica-lock.json`; its
`verify:replica` goes red on drift.

- **This directory is the source of truth.** Never edit the film's `src/replica/` copy — the next
  sync overwrites it, and until then the two differ with nothing to say so.
- **The two repos never share a git remote**, and archcanvas CI never reads the sibling directory.
- A change here is a change to a film that may already have been rendered. If an export signature
  in `index.ts` moves, the film repo's build is what discovers it.
