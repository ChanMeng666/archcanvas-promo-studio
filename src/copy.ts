/**
 * Every word the FILM says in its own voice.
 *
 * Not every word on screen — the replica speaks the product's own interface
 * strings, and those are cleared upstream by `tests/marketingNoCode.test.ts`
 * sitting next to them (law 1: the replica is not edited here). What lives in
 * this file is the film's authored copy: three kinetic cards, four short lines
 * riding over replica beats, and the end card.
 *
 * ── Why a `.ts` file and not `src/data/script.json` ────────────────────────
 *
 * The scaffold's `verify-copy.mjs` already reads `script.json` and every
 * `JsxText` node. Neither would see a line held here and rendered as
 * `{line}` — a JSX **expression** is invisible to a JsxText harvest, which is
 * the quiet way a film ships an uncleared sentence. So this file is harvested
 * explicitly: `capture/verify-copy.mjs` parses it and treats every string in a
 * `landscape` / `portrait` / `lines` array and every `text:` property as
 * on-screen prose — scanned for banned terms AND required to have a backticked
 * row in `docs/copy-clearance.md`.
 *
 * The trade this file buys back is the `source` field. A JSON script cannot
 * carry one; here every line names the file it came out of, next to the line,
 * so the clearance table and the copy cannot drift apart silently.
 *
 * ── The law, in one paragraph ──────────────────────────────────────────────
 *
 * Never "AI architect" (the title is protected in the UK and NZ — write "AI
 * architectural designer"). Never the compiler's name, never "as code", never
 * a `.arch` source. No bare currency figure. No permit or buildability claim.
 * No primacy claim, no traction number, no hype word. Only **reachability**,
 * **exact areas** and **byte-identical determinism** may be stated as
 * measured — a clearance, a route and a door width never may. Nothing may say
 * the check BLOCKS a defective plan; it reports what it could not fix. The
 * rendering is a presentation aid and never the pitch. And **no speed claim**:
 * the film compresses two to three minutes of real work into seconds, so
 * "in seconds" or "instantly" would turn an editing decision into a promise.
 * `docs/copy-clearance.md` carries the full argument, row by row.
 */

/** Authored line breaks, per frame shape. Rendered `nowrap`, never reflowed. */
export interface CardCopy {
  /** 16:9. */
  landscape: readonly string[];
  /** 9:16 — a re-break, not the same string in a narrower box. */
  portrait: readonly string[];
}

export interface CopyLine {
  id: string;
  copy: CardCopy;
  /** The file and line the wording came out of. "I wrote it" is not a source. */
  source: string;
  /** `true` when the source is verbatim or a truncation of it. */
  cleared: boolean | "needs founder";
  /** Why it clears the ban list, or what the founder has to decide. */
  note: string;
}

/* ── the three kinetic cards ──────────────────────────────────────────────── */

/**
 * The opener. **Does not open on "AI"** — in the spaces the buyer actually
 * gathers in, "AI" is a liability as an opener, not a hook; the plan and the
 * help come first (positioning do-NOT #2).
 */
export const HOOK: CopyLine = {
  id: "hook",
  copy: {
    landscape: ["Describe your home."],
    portrait: ["Describe", "your home."],
  },
  source:
    "archcanvas/src/components/landing/HeroCompile.tsx — HERO_COPY.h1[0], the live <h1>, verbatim",
  cleared: true,
  note: "Layer 1 hygiene, which is the correct altitude for an opening frame. Says nothing about permits, speed or measurement.",
};

/** The what-line. The second and third lines of the same live `<h1>`. */
export const CLAIM_WHAT: CopyLine = {
  id: "claim-what",
  copy: {
    landscape: ["Get a real,", "dimensioned floor plan."],
    portrait: ["Get a real,", "dimensioned", "floor plan."],
  },
  source:
    "archcanvas/src/components/landing/HeroCompile.tsx — HERO_COPY.h1[1] and h1[2], verbatim, keeping the product's own authored break",
  cleared: true,
  note: "Cleared against B3, B4, B5, B11 and B12 on the live surface. 'Dimensioned' is compiled geometry, not a clearance figure.",
};

/**
 * The price frame. A sentence, never a number — a bare currency figure on a
 * `.uk` surface is drip-pricing exposure, and the gate greps for `$` + digit.
 */
export const PRICE: CopyLine = {
  id: "price",
  copy: {
    landscape: ["You pay only when you get", "a result you keep —", "no subscription."],
    portrait: ["You pay only", "when you get", "a result you keep —", "no subscription."],
  },
  source:
    "archcanvas-growth/strategy/positioning.md §Positioning statement, line 36: 'You pay only when you get a result you keep — no subscription.' Verbatim, re-broken for the frame",
  cleared: true,
  note: "The verbatim-locked no-subscription framing. No figure, no currency, and no promise credits do not keep (they never expire; they are not a refund).",
};

/* ── the four lines that ride over a replica beat ─────────────────────────── */

/** Over the edit chapter, while a room is picked and a sentence is typed. */
export const SAY_THE_CHANGE: CopyLine = {
  id: "edit",
  copy: {
    landscape: ["Say the change."],
    portrait: ["Say the change."],
  },
  source:
    "archcanvas/src/components/landing/StudioSection.tsx — the live section caption 'Select a room, say the change, watch the plan recompile', truncated to its middle clause",
  cleared: true,
  note: "A truncation of shipped copy, not a paraphrase. Describes the interaction on screen and claims nothing about the result.",
};

/** Over the tweak chapter, while a parameter moves and the plan follows. */
export const TWEAK_A_NUMBER: CopyLine = {
  id: "tweak",
  copy: {
    landscape: ["Tweak a number."],
    portrait: ["Tweak a number."],
  },
  source:
    "Founder approval, 2026-09-20. Drafted for this film; nearest prior authority is the product's own panel title 'Tweak parameters' (archcanvas/src/components/canvas/TweaksPanel.tsx, mirrored as TWEAKS_TITLE in the replica's strings.ts)",
  cleared: true,
  note: "The film's own sentence, and the only one that was ever in that state. Literal — a named parameter is dragged and the plan redraws — and it breaks no ban. Approved by the founder on 2026-09-20; the approval IS the source, which is why the row names a date rather than a file.",
};

/**
 * Over the storey switch, when both levels of the same source are on screen.
 *
 * **B11's whole point.** Reachability and exact areas are two of the only three
 * things this company may call measurement; the third, byte-identical
 * determinism, is a developer-room claim and is not used here. Nothing about a
 * clear width, a walked route or a furniture clearance may join them.
 */
export const FACTS: CopyLine = {
  id: "storey",
  copy: {
    landscape: ["Every room reachable.", "Every area exact."],
    portrait: ["Every room reachable.", "Every area exact."],
  },
  source:
    "archcanvas/src/components/landing/CompileScrollBand.tsx — BAND_COPY.process, 'Every room reachable, every area exact', verbatim, split into its own two sentences",
  cleared: true,
  note: "B11 clear by construction: a real modeled access graph and shoelace/πR² areas. Deliberately does NOT say the check blocks anything (B12).",
};

/**
 * The receipt line — Layer 2, and the one differentiated thing the film says.
 *
 * It is a claim about what the product WRITES DOWN, never about what it
 * prevents. `SHIP_RESIDUAL = true`: out of budget with defects left, it charges
 * and ships and names them. A governor, not a gate.
 */
export const RECEIPT: CopyLine = {
  id: "receipt",
  copy: {
    landscape: ["…and a written list of", "everything we couldn't get right."],
    portrait: ["…and a written list", "of everything", "we couldn't get right."],
  },
  source:
    "archcanvas-growth/strategy/positioning.md §The three-layer ladder, Layer 2: 'Describe your home. Get a dimensioned floor plan — and a written list of everything we couldn't get right.' Verbatim tail",
  cleared: true,
  note: "The receipt frame, the only claim backed by shipped code that no competitor in the set makes. Stated as disclosure, which is what the code does.",
};

/** Over the export menu, with the cursor resting on the CAD group. */
export const EXPORT_LINE: CopyLine = {
  id: "export",
  copy: {
    landscape: ["Export the DXF."],
    portrait: ["Export the DXF."],
  },
  source:
    "archcanvas/src/components/landing/StudioSection.tsx — the live section body 'When it holds up, export the DXF.', truncated",
  cleared: true,
  note: "A capability, not a comparison. B1 bans 'we export CAD, they export pixels' as a DIFFERENTIATOR — the market leader exports DXF too — and this line makes no contrast at all.",
};

/* ── the end card ─────────────────────────────────────────────────────────── */

export const END_DOMAIN: CopyLine = {
  id: "endcard.domain",
  copy: { landscape: ["archcanvas.uk"], portrait: ["archcanvas.uk"] },
  source: "The live product domain (archcanvas/CLAUDE.md; the legacy host 308-redirects to it)",
  cleared: true,
  note: "A fact, not a claim.",
};

/**
 * The descriptor. **"AI architect" is banned on legal grounds** — UK Architects
 * Act 1997 s.20 and NZ Registered Architects Act 2005 s.7, and NZ is the law the
 * product's own Terms choose. ARB has said it cannot police "architectural"
 * derivatives, so the substitution is expressly outside its reach and means the
 * same thing. The growth repo still carries the banned form in places; it is not
 * a verbatim truth source.
 */
export const END_DESCRIPTOR: CopyLine = {
  id: "endcard.descriptor",
  copy: {
    landscape: ["AI architectural designer"],
    portrait: ["AI architectural designer"],
  },
  source:
    "archcanvas-growth/marketing/copy/messaging-library.md §Product boilerplate (25 words) and the wording rule beneath the taglines, 2026-09-14",
  cleared: true,
  note: "The approved substitute for the protected title. The product repo enforces /\\bAI architect(?!ural)/i in CI and this gate repeats the needle byte-identically.",
};

/* ── the honesty caption ──────────────────────────────────────────────────── */

/**
 * The one sentence the product does not say, because the product has no reason
 * to: a real design takes two to three minutes and this film compresses it.
 *
 * ⚠ This string is a COPY of the replica's own `HONESTY_CAPTION`
 * (`strings.ts`), held here because `src/replica/` is not synced yet and the
 * film needs to be able to overlay the identical sentence when the time warp
 * shortens the replica's own caption below the three-second floor.
 *
 * **WP-9: once the replica is synced, import `HONESTY_CAPTION` from
 * `src/replica` and delete this constant.** Two copies of one sentence is one
 * copy too many; `verify:timeline` prints both so the divergence is visible
 * until then.
 */
export const HONESTY_CAPTION_TEXT =
  "Sequence shortened — a design really takes two to three minutes.";

export const HONESTY: CopyLine = {
  id: "honesty",
  copy: {
    landscape: [HONESTY_CAPTION_TEXT],
    portrait: ["Sequence shortened — a design", "really takes two to three minutes."],
  },
  source:
    "archcanvas/src/components/marketing/studio-replica/strings.ts — HONESTY_CAPTION, the replica's own caption, verbatim",
  cleared: true,
  note: "Mandatory in all eight masters, ≥ 3 s of FILM time. The film renders it only where the time warp leaves the replica's own caption short; `verify:timeline` proves the floor per cut.",
};

/* ── the one switch ───────────────────────────────────────────────────────── */

/**
 * Lines that are on screen by a decision that was not final.
 *
 * `tweakLine` is `Tweak a number.` — the single sentence in this film that no
 * growth-repo or product line says. **The founder approved it on 2026-09-20**,
 * so it is cleared copy now and the flag stays `true`; `NEEDS_FOUNDER` is empty
 * for the first time.
 *
 * The switch stays, because retiring it would be deleting the cheap answer to a
 * question that could be asked again. Flip it to `false` and the tweak beat
 * plays exactly as long, framed exactly the same, with the chapter chip
 * ("Tweak") carrying the beat alone: no EDL changes, no cut re-sums, nothing to
 * re-derive. An answer either way is a one-character change.
 */
export const COPY_FLAGS = {
  tweakLine: true,
} as const;

/* ── the roster ───────────────────────────────────────────────────────────── */

/** Every authored line in the film. The clearance table is checked against it. */
export const COPY_LINES: readonly CopyLine[] = [
  HOOK,
  CLAIM_WHAT,
  PRICE,
  SAY_THE_CHANGE,
  TWEAK_A_NUMBER,
  FACTS,
  RECEIPT,
  EXPORT_LINE,
  END_DOMAIN,
  END_DESCRIPTOR,
  HONESTY,
];

/** The lines the founder still has to sign off. Reported, never silent. */
export const NEEDS_FOUNDER: readonly CopyLine[] = COPY_LINES.filter(
  (l) => l.cleared === "needs founder",
);

/** Pick the authored break for a frame shape. */
export const linesFor = (copy: CardCopy, aspect: "landscape" | "portrait"): readonly string[] =>
  aspect === "portrait" ? copy.portrait : copy.landscape;
