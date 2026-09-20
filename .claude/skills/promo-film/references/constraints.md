# The standing constraints

Each row: the law, why it exists, and what enforces it. Where nothing enforces it, it
says **human judgement** — those are the ones that get lost.

## Copy

**Every word on screen is cleared or it does not ship.** `docs/copy-clearance.md` is the
table; `capture/verify-copy.mjs` reads every backticked string in it as a cleared row and
fails on on-screen prose with no row. The line nobody cleared is exactly the line that
slips. Authority is `../archcanvas-growth` (positioning, founder brief §7 = bans B1–B14,
voice.md, category.md §6) — or shipped product copy, which is stronger still.

The bans that bite, summarised (the full lists are 30 phrases, 29 words and 14 regexes at
`capture/verify-copy.mjs:77-158`):

- **"AI architect" is banned on legal grounds and is not on the B1–B14 card.** UK
  Architects Act 1997 s.20 and NZ Registered Architects Act 2005 s.7 — NZ is the law the
  Terms chose. Write **"AI architectural designer"**. Enforced by
  `/\bAI architect(?!ural)/i`. ⚠ The growth repo has not been updated, so do not copy
  from it verbatim.
- **B4 — the language is never named**, no `.arch` source, no "as code", no DSL jargon.
  `verify:replica` greps the synced replica for it too, comments included.
- **B11 — only three things may be called measurement:** reachability, exact areas,
  byte-identical determinism. Clear widths, walk distances and furniture clearances are
  advisory, always. The safe verb is **"checked"**.
- **B12 — never say the gate blocks a defective plan.** `SHIP_RESIDUAL = true`: out of
  budget with defects left, it charges and ships. A governor, not a gate.
- **B3 — no permit or buildability overclaim.** Not "build from", not "buildable", not
  "permit-ready", not "code-compliant".
- **No speed claim.** The film compresses two to three minutes into seconds; a regex
  catches "in seconds" / "instantly" and the caption below exists for the rest.
- **No bare currency figure on screen** — USD on a `.uk` surface is DMCCA drip-pricing
  exposure. `/\$\s*\d/` is a pattern in two gates.
- **No traction number, ever.** Do not open on "AI"; open on the plan and the help.
- A rendering is a **presentation aid**, not a promise about the building.

## The two things that must be on screen in every cut

**The honesty caption.** A real design takes two to three minutes; time compression read
as a speed promise is a claim nobody made. `HONESTY_MIN_SEC = 3.0` (`src/cuts.ts:295`),
and `capture/verify-honesty.mjs` measures the **longest continuous run** at full opacity
(ink ≥ 0.999) across the union of the product's own caption and the film's band. It must
be **whole or gone, never cropped** (2 px margin) and **never doubled** — a single frame
with both visible fails. The band does not fade out; the handover to the replica's caption
is a hard cut at the beat's start (`docs/decisions.md` D19, D23).

**The product's own "AI-generated" pill**, on any rendering, always visible, never a hover
state — EU AI Act Art. 50. `verify-honesty.mjs` requires the pill's rectangle to be wholly
inside the frame whenever `renderingOpacity >= 0.5`, and `camera.ts` protects it there.

## Colour

**No large flat violet.** `VIOLET_AREA_MAX = 0.15` (`src/tokens.ts:119`) — violet may not
exceed 15 % of the visible frame in any scene, any cut, either frame shape. A founder
decision (`docs/decisions.md` D29), and an art-direction note cannot overturn one: the
plum price card was withdrawn and the card is buttercream `#FFFFC4` (D24). Violet is
detected **by hue** (235–300° at saturation ≥ 0.06), not by a colour list, so renaming a
token does not get past it. Area is computed from layout rectangles, not pixels.

Aubergine `#3C315B` carries the colour rhythm instead, and its **two approved uses are the
what-line card and the receipt band** (`AUBERGINE_APPROVED` in `capture/verify-violet.mjs`).
It is **counted, not exempted** — a third use fails, and so does an approved scene that
stops being aubergine. The end wipe has its own ceiling at 0.14 (`src/tokens.ts:129`).

## Frame shapes

9:16 is re-laid-out, never cropped from 16:9. The **top 250 px and bottom 390 px belong to
Reels / TikTok / Shorts** — type stays out of them (`stage`); the replica's `picture` box is
deliberately larger than the type-safe stage (7.9 % at 1920×1080, 16 % at 1080×1920).
Design boxes are 1600×1000 landscape, 1000×1333 portrait. Caption floors are 30 px
landscape / 34 px portrait (`capture/verify-opening.mjs`), and `CAPTION_SAFE_FILL` is
`{ landscape: 0.72, portrait: 1.01 }` — the portrait value is above 1 on purpose, the
honest way to say "never expel here".

## The replica

`src/replica/**` is a **one-way copy** of `archcanvas/src/components/marketing/studio-replica/`
and is not editable here. Found a bug, want a different string? Fix it upstream and
`npm run sync:replica`. `src/data/replica-lock.json` is the sha256 ledger and
`npm run verify:replica` goes red on drift, so an edit here is a red gate rather than a
quiet divergence. The one existing film-side workaround (`DRAFT_CARD_SPEC_SHORTFALL` in
`camera.ts`) is labelled as one and deleted when upstream fixes it.

**Nothing on screen is mocked up.** Plans are baked by the product's own compiler into
`src/data/drawlist.json`; renderings are the product's own output; strings are the
product's own strings. A replica *can* draw a number no compiler emitted — that is what
`verify:numbers` is for.

**The two repos never share a git remote.** No submodule, no npm package, ever.

## Licensing

**Check a vendor's plan tier before you spend its credits, not before you ship.**
Commercial rights attach to the tier active when an asset was *created*; upgrading
afterwards does not license what already exists. ElevenLabs' free plan carries no
commercial licence and its terms cover content created outside a paid subscription
*before or after* — twelve assets were deleted over this (`docs/decisions.md` D4), and
that is why all fourteen sound effects are synthesised offline instead.

For SUNO the record is a dated checkbox per take in `docs/suno-prompt.md`
("plan tier for `<take>.mp3` · confirmed on: ____"). **Human judgement — there is no
gate.** No code in this repo refuses a master on licence grounds; an unconfirmed take is
blocked by the founder and by this line, so leave the box unticked until it is true and
do not render against a take whose box is empty.
