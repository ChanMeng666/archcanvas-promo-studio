# Copy review — clearing a line, and proving it says something

The gate proves a line was *cleared*. It cannot prove the line is *clear*. Both passes
are required and they are different jobs.

## Clearing a new line (the mechanical half)

1. **Find it in an authority.** `../archcanvas-growth` — `strategy/positioning.md`,
   `investor/founder-brief.md` §7 (bans B1–B14), `marketing/content/voice.md`,
   `strategy/category.md` §6. **Shipped product copy is a stronger source still**: a
   sentence already live on archcanvas.uk has been through the same argument once.
   ⚠ The growth repo has not been updated for the "AI architect" ban — do not copy from
   it verbatim (`references/constraints.md`).
2. **Add a row to `docs/copy-clearance.md`** with the phrase in backticks, **exactly as
   it reaches the screen** — punctuation, capitalisation and the authored break included.
   The gate matches the whole trimmed string, case-insensitively, so **a two-line card
   needs two rows**, one per line. Record the source beside it.
3. Run `npm run verify:copy`. It harvests from three places, because a line can reach the
   screen from any of them: `src/copy.ts` (every string in a `landscape` / `portrait` /
   `lines` array and every `*_TEXT` constant — a line held in a module and rendered as
   `{line}` is invisible to a JSX harvest, which would otherwise have been the quiet way
   past this gate), every `JsxText` node plus `alt`/`aria-label`/`title` in `src/**/*.tsx`,
   and `src/data/script.json`.
4. The synced replica is **scanned but never registration-gated** — its strings are
   cleared upstream, and a clearance row here would be a second, drifting copy of that
   authority. What this gate adds on this side is the banned-term scan.

A line that cannot be traced to an authority and is not obviously derivable from shipped
product copy is a **founder question**, not a judgement call. `NEEDS_FOUNDER` in
`src/copy.ts` is the list; it is reported, not enforced, so an empty list means someone
emptied it deliberately. `Tweak a number.` went through that route and was approved
2026-09-20 (`docs/decisions.md` D33).

## Proving the line says something (the half no gate does)

**Human judgement.** Four checks, in this order:

1. **Write the plain fact first.** What could someone not do before, what do they do now,
   what is different afterwards — in flat prose, only the parts you can source. Do not
   invent the "before" if you do not know it.
2. **Cover the picture and read the line aloud.** On screen, a vague line borrows meaning
   from the frame behind it and sounds specific. Read it with nothing behind it: if a
   listener who has never seen the product still has to ask *what happened, where, and
   what do I get*, the line is decoration. A full stop is not content.
3. **Title and caption must not be synonyms.** The caption's job is to add the object,
   the action and the observable result. If it only restates the title in longer words,
   one of the two is doing nothing — usually the caption, occasionally the title.
4. **Check it against the clock.** A line that needs longer than its beat allows is not
   fixed by shrinking the type. Cut words, split it across two beats, or lengthen the
   beat — and if the beat then breaks the 2.2 s card ceiling, the line is too long for a
   card (`references/rhythm.md`).

Two failure shapes worth naming, because both have appeared here:

- **A claim dressed as an observation.** "It checks the plan" is fine; anything implying
  a defective plan is blocked is B12 and false (`SHIP_RESIDUAL = true`).
- **A measurement that is not one.** Only reachability, exact areas and byte-identical
  determinism may be called measured. Everything else is **checked** (B11).

## Before a render

`verify:honesty` also greps every `.ts`/`.tsx`/`.json` under `src/` for three needles —
the language's name, a bare `$` figure, and `/\bAI architect(?!ural)/i` — with comments
stripped. So a banned term in a comment is not a failure, but a banned term in data is.
The last check is still a pair of eyes on eight stills per master: no frame carrying a
bare `$`, nothing naming the language, the end card reading `archcanvas.uk`.
