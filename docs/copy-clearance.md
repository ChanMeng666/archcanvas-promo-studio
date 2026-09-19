# Copy clearance

**Every word on screen is cleared, or it does not ship.**

`capture/verify-copy.mjs` reads this file and treats every `` `backticked` `` string
in it as a cleared phrase. On-screen prose with no row here is a hard failure —
deliberately, because the line nobody cleared is exactly the line that slips.

## How to add a row

1. Find the line in the authority: `../archcanvas-growth` —
   `strategy/positioning.md`, `investor/founder-brief.md` §7 (bans B1–B14),
   `marketing/content/voice.md` (banned words), `strategy/category.md` §6.
2. Put the phrase in backticks in the **Line** column, exactly as it appears on
   screen, including punctuation and capitalisation. The gate matches the whole
   trimmed string, case-insensitively.
3. Name the file and section it came from. "I wrote it" is not a source.
4. If it is a paraphrase rather than a quotation, say so and say why the change
   was needed.

⚠ **The growth repo is not a verbatim truth source.** It has not been updated for
the B15 finding, so `positioning.md`, `messaging-library.md` (tagline #7, all the
boilerplate, the founder bio) and `category.md` still contain the banned phrase
"AI architect". Write **"AI architectural designer"**. Do not copy from them
without reading the ban list first.

## Cleared

| Line | Cut(s) | Source in archcanvas-growth | Cleared? |
| --- | --- | --- | --- |
| _(none yet — WP-9 writes the cards)_ | | | |

## Required, in every cut

These are not optional lines that happen to be cleared. Each one has to be on
screen in **all eight masters**, and a test asserts it.

| Line | Why it is mandatory | Where it goes |
| --- | --- | --- |
| the honesty caption | A real design takes two to three minutes; the replica compresses it to seconds. Time compression read as a speed promise is a claim nobody made. On screen **≥ 3 s** in every cut. | over the `draw` scene |
| the AI-generated pill | EU AI Act Art. 50. It is the product's own pill, always visible on a rendering, never a hover state. | wherever `render` shows a rendering |

The exact wording of both comes from the product, not from this repo: the caption
is the `caption` beat in the replica's own screenplay, and the pill is the
product's own component. Copy them verbatim at WP-9 and add their rows above.

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
- **"buildable", "build from", "permit-ready", "code-compliant"** — B3.
- **A bare currency figure on screen** — USD on a `.uk` surface is DMCCA
  drip-pricing exposure. The price frame is a sentence, not a number.
- **Any traction number** — B13. Every figure available is either zero or
  unquotable without its n.
- **Primacy claims** — B8, audited against ~60 prior-art items and retired twice.
- **Hype** — revolutionary, game-changing, insane, mind-blowing, magic, seamless,
  effortless, unleash, supercharge, next-level, cutting-edge, world-class,
  disrupt, 10x, paradigm, best-in-class, powerful, robust, blazing. The rule
  behind the list: replace the adjective with the evidence.
- **Opening on "AI"** — open on the plan and on the help.
