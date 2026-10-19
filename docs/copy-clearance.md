# Copy clearance

**Every word on screen is cleared, or it does not ship.**

`capture/verify-copy.mjs` reads this file and treats every `` `backticked` `` string
in it as a cleared phrase. On-screen prose with no row here is a hard failure —
deliberately, because the line nobody cleared is exactly the line that slips.

**What the gate harvests**, in three places, because a line can reach the screen
from any of them:

1. **`src/copy.ts`** — the film's own authored lines, parsed as TypeScript. Every
   string in a `landscape` / `portrait` / `lines` array and every `*_TEXT`
   constant is on-screen prose. This one is not optional cleverness: a line held
   in a `.ts` module and rendered as `{line}` is a JSX **expression**, invisible
   to a `JsxText` harvest, so "put the copy in a constants file" would otherwise
   have been the quiet way past this gate.
2. **`src/**/*.tsx`** — every `JsxText` node, plus `alt` / `aria-label` /
   `title` / `aria-description`. Scaffolding inside a `Placeholder` declaration
   is listed on every run and fatal only under `--strict`.
3. **`src/data/script.json`** — if WP-9 ever authors cards there instead.

**The replica is scanned and never registration-gated.** `src/replica/**` is the
product's real interface, copied one way; its strings are cleared upstream by
`tests/marketingNoCode.test.ts` sitting next to them, and a clearance row here
would be a second, drifting copy of that authority. What this gate adds on this
side is the banned-term scan, because a film cut from a replica that broke a ban
must not render.

## How to add a row

1. Find the line in the authority: the product's private positioning notes —
   `strategy/positioning.md`, `founder-brief.md` §7 (bans B1–B14),
   `marketing/content/voice.md` (banned words), `strategy/category.md` §6 — or
   the **shipped product copy**, which is a stronger source still: a sentence
   already live on archcanvas.uk has been through the same argument.
2. Put the phrase in backticks in the **Line** column, **exactly as it reaches
   the screen**, including punctuation, capitalisation and the authored break.
   The gate matches the whole trimmed string, case-insensitively — so a
   two-line card needs **two rows**, one per line. A fragment reaches a viewer
   exactly as hard as a sentence does.
3. Name the file and the constant it came from. "I wrote it" is not a source.
4. If it is a paraphrase or a truncation rather than a quotation, say so and say
   why the change was needed.

⚠ **The positioning notes are not a verbatim truth source.** It has not been updated for
the B15 finding, so `positioning.md`, `messaging-library.md` (tagline #7, all the
boilerplate, the founder bio) and `category.md` still contain the banned phrase
"AI architect". Write **"AI architectural designer"**. Do not copy from them
without reading the ban list first.

⚠ **The live landing page is not one either.** `StudioSection.tsx` currently ships
the heading *"One canvas, from brief to build-ready"*, and **"build-ready" is a B3
violation** that this gate fails on. A line being live is evidence it was
considered, not evidence it is clear.

---

## Cleared

Each line is registered separately because a line is the unit the gate checks.
`L` is the 16:9 break, `P` the 9:16 break, `L+P` a line that is the same in both.

### The three kinetic cards

| Line | Break | Cut(s) | Source | Cleared? | Note |
| --- | --- | --- | --- | --- | --- |
| `Describe your home.` | L | 15 · 30 · 60 · 120 | `archcanvas/src/components/landing/HeroCompile.tsx` — `HERO_COPY.h1[0]`, the live `<h1>`, verbatim | ✅ | Layer 1 hygiene, the right altitude for an opening frame. **Does not open on "AI"** (do-NOT #2 — in the ICP's own spaces, lead with the plan and the help). |
| `Describe` | P | 15 · 30 · 60 · 120 | Same line, re-broken for 9:16 | ✅ | A break, not a rewrite. |
| `your home.` | P | 15 · 30 · 60 · 120 | Same | ✅ | |
| `Get a real,` | L+P | 15 · 30 · 60 · 120 | `HeroCompile.tsx` — `HERO_COPY.h1[1]`, verbatim, keeping the product's own authored break | ✅ | Cleared against B3, B4, B5, B11 and B12 on the live surface. |
| `dimensioned floor plan.` | L | 15 · 30 · 60 · 120 | `HeroCompile.tsx` — `HERO_COPY.h1[2]`, verbatim | ✅ | "Dimensioned" is compiled geometry, not a clearance figure — B11 clear. |
| `dimensioned` | P | 15 · 30 · 60 · 120 | Same, re-broken | ✅ | |
| `floor plan.` | P | 15 · 30 · 60 · 120 | Same, re-broken | ✅ | |
| `You pay only when you get` | L | 30 · 60 · 120 | `positioning-notes/strategy/positioning.md` §Positioning statement, line 36: *"You pay only when you get a result you keep — no subscription."* Verbatim, re-broken | ✅ | The verbatim-locked no-subscription framing. |
| `a result you keep —` | L+P | 30 · 60 · 120 | Same | ✅ | **No figure and no currency.** A bare `$`+digit on a `.uk` surface is DMCCA drip-pricing exposure; the gate greps for it. |
| `no subscription.` | L+P | 30 · 60 · 120 | Same | ✅ | Promises nothing credits do not do: they never expire, and they are not a refund. |
| `You pay only` | P | 30 · 60 · 120 | Same, re-broken | ✅ | |
| `when you get` | P | 30 · 60 · 120 | Same, re-broken | ✅ | |

### The four lines that ride over a replica beat

| Line | Break | Cut(s) | Source | Cleared? | Note |
| --- | --- | --- | --- | --- | --- |
| `Say the change.` | L+P | 60 · 120 | `archcanvas/src/components/landing/StudioSection.tsx` — the live section caption *"Select a room, say the change, watch the plan recompile"*, truncated to its middle clause | ✅ | A truncation of shipped copy, not a paraphrase. Describes the interaction on screen and claims nothing about the result. |
| `Tweak a number.` | L+P | 60 · 120 | **Founder approval, 2026-09-20.** Drafted for this film; nearest prior authority is the product's own panel title *"Tweak parameters"* (`TweaksPanel.tsx`, mirrored as `TWEAKS_TITLE` in the replica's `strings.ts`) | ✅ | Literal — a named parameter is dragged and the plan redraws — and it breaks no ban. No positioning-note line says it, so it is the film's own sentence: **the founder is the source, which is why this row names a date rather than a file.** It was the only line in the film ever in that state. |
| `Every room reachable.` | L+P | 60 · 120 | `archcanvas/src/components/landing/CompileScrollBand.tsx` — `BAND_COPY.process`, *"Every room reachable, every area exact"*, verbatim, split into its own sentence | ✅ | **B11 clear by construction.** Reachability is a real modeled access graph — one of only three things this company may call measurement. |
| `Every area exact.` | L+P | 60 · 120 | Same constant, second clause | ✅ | Exact areas are shoelace / πR² — the second of the three. The third, byte-identical determinism, is a developer-room claim and is not used. **Nothing here says the check BLOCKS anything (B12).** |
| `…and a written list of` | L | 30 · 60 · 120 | `positioning-notes/strategy/positioning.md` §The three-layer ladder, Layer 2: *"Describe your home. Get a dimensioned floor plan — and a written list of everything we couldn't get right."* Verbatim tail | ✅ | The receipt frame — the only claim backed by shipped code (`SHIP_RESIDUAL`) that no competitor in the set makes. |
| `everything we couldn't get right.` | L | 30 · 60 · 120 | Same | ✅ | A claim about what the product **writes down**, never about what it prevents. Out of budget with defects left it charges and ships and names them: a governor, not a gate. |
| `…and a written list` | P | 30 · 60 · 120 | Same, re-broken | ✅ | |
| `of everything` | P | 30 · 60 · 120 | Same, re-broken | ✅ | |
| `we couldn't get right.` | P | 30 · 60 · 120 | Same, re-broken | ✅ | |
| `Export the DXF.` | L+P | 15 · 60 · 120 | `StudioSection.tsx` — the live section body *"When it holds up, export the DXF."*, truncated | ✅ | A capability, not a comparison. **B1 bans "we export CAD, they export pixels" as a differentiator** — the market leader exports DXF too — and this line makes no contrast at all. |

### The end card

| Line | Break | Cut(s) | Source | Cleared? | Note |
| --- | --- | --- | --- | --- | --- |
| `archcanvas.uk` | L+P | all eight | The live product domain (`archcanvas/CLAUDE.md`; the legacy host 308-redirects to it) | ✅ | A fact, not a claim. |
| `AI architectural designer` | L+P | all eight | `positioning-notes/marketing/copy/messaging-library.md` §Product boilerplate (25 words), and the wording rule beneath the taglines, 2026-09-14 | ✅ | **The approved substitute for a protected title.** UK Architects Act 1997 s.20 and NZ Registered Architects Act 2005 s.7 — and NZ is the law the product's Terms choose. ARB has said it cannot police the "architectural" derivatives. The gate carries the product repo's own needle `/\bAI architect(?!ural)/i` byte-identically. |

### The honesty caption

| Line | Break | Cut(s) | Source | Cleared? | Note |
| --- | --- | --- | --- | --- | --- |
| `Sequence shortened — a design really takes two to three minutes.` | L | all eight | `archcanvas/src/components/marketing/studio-replica/strings.ts` — `HONESTY_CAPTION`, the replica's own caption, verbatim | ✅ | Mandatory. See the next section for the floor and how it is enforced. |
| `Sequence shortened — a design` | P | all eight | Same, re-broken for 9:16 | ✅ | |
| `really takes two to three minutes.` | P | all eight | Same, re-broken | ✅ | |

---

## Required, in every cut

These are not optional lines that happen to be cleared. Each one has to be on
screen in **all eight masters**.

| Line | Why it is mandatory | Where it goes |
| --- | --- | --- |
| the honesty caption | A real design takes two to three minutes; the replica compresses it to seconds. Time compression read as a speed promise is a claim nobody made. On screen **≥ 3 s of FILM time** in every cut. | over the `draw` scene |
| the AI-generated pill | EU AI Act Art. 50. It is the product's own pill, always visible on a rendering, never a hover state. | wherever `render` shows a rendering |

**The honesty floor is derived, not typed.** The replica carries the caption at
screenplay 8.0–12.5 s, and `at.ts` envelopes it, so the readable core is
8.45–11.87 s. `src/timeline.ts` maps that core through each cut's own time warp
(`honestyWindowFor`) and `capture/verify-timeline.mjs` fails the build below
3.0 s. Where the warp leaves it short — today **only the 15 s cut**, at 2.67 s —
the film overlays the identical sentence in its own subtitle band for 3.4 s. As
derived today:

| Cut | The replica's own caption alone | On screen | Drawn by |
| --- | --- | --- | --- |
| 15 s | 2.67 s | **3.40 s** (5.12–8.52 s) | the film |
| 30 s | 3.50 s | **3.50 s** (6.82–10.32 s) | the replica |
| 60 s | 4.18 s | **4.18 s** (11.62–15.80 s) | the replica |
| 120 s | 7.35 s | **7.35 s** (19.41–26.76 s) | the replica |

A hand-typed window would stop being true the first time a beat moved, with
nothing going red. That is why none of these six numbers is written in a source
file — they are printed by the gate.

---

## Never, on any surface

Short form of the ban list. The gate enforces all of it; this is here so you do
not have to lose an afternoon to it first.

- **"AI architect"** — protected title, UK Architects Act 1997 s.20 and NZ
  Registered Architects Act 2005 s.7. Write "AI architectural designer".
- **"as code", "DSL", ".arch", the DSL's name** — B4. A different room, a
  different funnel. It is not named anywhere in this film.
- **"measured"** of a clearance, a route, a door or a width — B11. Only
  reachability, exact areas and byte-identical determinism may be called
  measurement. The safe verb is "checked".
- **Any claim that the gate blocks a bad plan** — B12. It is a governor, not a
  gate: out of budget with defects left, it charges and ships.
- **"buildable", "build from", "build-ready", "permit-ready", "code-compliant"** — B3.
- **A bare currency figure on screen** — USD on a `.uk` surface is DMCCA
  drip-pricing exposure. The price frame is a sentence, not a number.
- **Any speed claim** — "in seconds", "instantly", "within seconds". A
  generation takes 100–160 s and this film compresses it; a speed line would
  turn an editing decision into a promise and contradict the caption that is
  mandatory in the same cut.
- **Any traction number** — B13. Every figure available is either zero or
  unquotable without its n.
- **Primacy claims** — B8, audited against ~60 prior-art items and retired twice.
- **Hype** — revolutionary, game-changing, insane, mind-blowing, magic, seamless,
  effortless, unleash, supercharge, next-level, cutting-edge, world-class,
  disrupt, 10x, paradigm, best-in-class, powerful, robust, blazing. The rule
  behind the list: replace the adjective with the evidence.
- **Opening on "AI"** — open on the plan and on the help.

---

## Open, for the founder

**Nothing. Closed 2026-09-20.**

One line was ever open — **`Tweak a number.`**, on screen in the 60 s and 120 s
cuts — and the founder approved it on 2026-09-20. `COPY_FLAGS.tweakLine` stays
`true` and `NEEDS_FOUNDER` in `src/copy.ts` is now empty.

The switch itself stays. It costs one boolean, and it is the cheap answer if the
question is ever reopened: set it to `false` and the tweak beat plays exactly as
long, framed exactly the same, with the chapter chip carrying it alone.

---

## WP-9 — what the film actually puts on screen, and where it came from

Three sources reach a viewer's eye, and only one of them is this repo's to write.

**1. The film's own voice** — `src/copy.ts`. Eleven lines, every one with a row
in the table above and a source beside it in the module. Nothing was added in
WP-9; the roster the scaffold cleared is the roster that ships.

**2. The product's own interface** — `src/replica/**`, synced one way. Scanned
for banned terms by both `verify:copy` and `verify:replica`, never
registration-gated: those strings are cleared upstream by
`tests/marketingNoCode.test.ts` sitting next to them, and a clearance row here
would be a second, drifting copy of that authority. Everything the studio says
on screen is in that category — `Drafting…`, `Design my plan · 1 credit`,
`Tweak parameters`, `AI-generated`, `Have AI fix`, the phase lines, the review
findings (verbatim `lint()` output), the export menu's two groups.

**3. The product's own SHOWCASE ROSTER** — new in WP-9, and the one thing worth
spelling out. The 120 s cut's second brief draws four published showcase plans,
and the only text over them is **each plan's own title and its own brief**, read
out of `src/lib/showcase.generated.ts` at sync time. The film writes no sentence
there. That is deliberate: "Different brief. Same flow." would have been the
obvious line and nobody has cleared it, whereas four real briefs make the same
point as evidence rather than as a claim.

The four, for the record — these are the words the product was actually given:

| Plan | On screen |
|---|---|
| `Three-bed Family House` | `A three-bedroom single-storey house. The road is on the south, the garden on the north — I want the bedrooms and living room on the garden and bifold doors out to it.` |
| `Courtyard Apartment` | `A ground-floor flat built around a private courtyard — one bedroom, a bathroom off the hall, and living that opens onto the court.` |
| `Neighbourhood Clinic` | `A small neighbourhood clinic: reception and waiting, three consulting rooms, a treatment room, staff room and an accessible toilet. Wheelchair users must get everywhere.` |
| `Compact Bedsit` | `A tiny studio flat, about 35 square metres. I want a proper wardrobe and doors that don't eat the floor.` |

A brief is typed, so it is on screen partially for most of its beat. The gate
matches whole strings, so these rows clear the finished sentence; the partial
states are prefixes of a cleared string and cannot introduce a word the finished
one does not contain.

**The chapter chips** carry `Brief` / `Draw` / `Edit` / `Tweak` / `Review` /
`Render` / `Export` — the replica's own `CHAPTERS` labels, which are also the
landing page's chapter tabs. Product vocabulary, not the film's.

### The one line that was open, and the switch that held it

`COPY_FLAGS.tweakLine` in `src/copy.ts`, `true`.

`Tweak a number.` is the single sentence in this film that no positioning-note or
product line says. It is literal — a named parameter is dragged and the plan
redraws — and it breaks no ban, but it was the film's own and the founder had not
seen it. **The founder approved it on 2026-09-20**, so the row above is cleared
and the flag stays `true`.

The switch stays anyway. Set it to `false` and the tweak beat plays **exactly as
long, framed exactly the same**, with the chapter chip ("Tweak") carrying it
alone. No EDL changes, no cut re-sums, nothing to re-derive, and
`verify:timeline` still shows both the 60 s and 120 s cuts summing to exactly
their length. That was the whole reason it was a flag and not an edit — the
answer either way is a one-character change — and it is the reason to keep it:
the question can be reopened without holding the film.
