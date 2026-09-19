/**
 * Literal design tokens. **No expressions live in this file.**
 *
 * Every value is a hex string or a plain number, because the gates parse this
 * file as TEXT. A computed colour — even a one-line `mix()` — is exactly what a
 * text-parsing gate cannot see.
 *
 * ── Where these come from ──────────────────────────────────────────────────
 *
 * The film renders a CODED REPLICA of the product's studio, so its ground is
 * not a mood: it is `archcanvas/src/app/globals.css`, token for token. The
 * product authors most of its neutrals in **OKLCH**. Headless Chrome renders
 * `oklch()` natively, so the replica's own CSS may keep it — but ffmpeg-side
 * tools, the flash gate and every contrast calculation in this repo work in
 * sRGB, so each one is **converted here and the OKLCH original is kept in the
 * comment**. The conversion is Ottosson's, done once, in
 * `D:\.claude-scratch\2026-09-19\studio-replica\oklch.mjs`.
 *
 * Which values were converted (the rest were already hex upstream):
 *
 *   --background       oklch(0.98 0.008 85)   -> #FBF8F2
 *   --foreground       oklch(0.18 0.006 75)   -> #13110F
 *   --card             oklch(0.995 0.005 85)  -> #FFFDFA
 *   --border           oklch(0.9 0.012 85)    -> #E2DED5
 *   --canvas-bg        oklch(0.985 0 0)       -> #FAFAFA
 *   --canvas-grid-dot  oklch(0.85 0 0)        -> #CECECE
 *   --muted-foreground oklch(0.505 0.012 75)  -> #69645D
 *   --muted            oklch(0.955 0.01 85)   -> #F3F0E9
 *   --primary          oklch(0.22 0.006 75)   -> #1C1A18
 *
 * `--plum`, `--plum-strong` and the pastel band colours are authored as hex
 * upstream and are copied verbatim, not converted.
 *
 * ── Two type voices, and this is a system, not decoration ──────────────────
 *
 * **Sans (Space Grotesk) is the human voice.** The brief someone typed, a card,
 * the wordmark, the terms.
 *
 * **Mono (Geist Mono) is the machine voice.** Dimensions, areas, the drawing's
 * own labels, a parameter name. Anything the software computed.
 *
 * When the type changes voice, the source of the claim changed. Never set a
 * written line in mono to look technical, and never set a computed number in
 * sans to look friendly.
 */

/* ── the product's app surface — what the replica sits on ─────────────────── */

/**
 * The studio's own colours. These are the APP tokens (`:root` in globals.css),
 * NOT the marketing `.mkt` layer — the replica is a picture of the product, and
 * the product does not use the marketing palette.
 */
export const APP = {
  /** --background. Warm ivory, the "architect's paper". */
  page: "#FBF8F2",
  /** --foreground. */
  ink: "#13110F",
  /** --muted-foreground. 5.53:1 on the page. */
  inkMuted: "#69645D",
  /** --card / --popover. */
  card: "#FFFDFA",
  /** --border. A decorative hairline, never a control boundary. */
  hairline: "#E2DED5",
  /** --muted / --secondary / --accent fills. */
  muted: "#F3F0E9",
  /** --primary. */
  primary: "#1C1A18",
  /** --canvas-bg. The infinite canvas surface, cooler than the page. */
  canvas: "#FAFAFA",
  /** --canvas-grid-dot. */
  canvasDot: "#CECECE",
  /** --input-border. The one grey that IS a control boundary, 3.28:1. */
  inputBorder: "#8D8980",
} as const;

/** The dot lattice pitch, in product CSS pixels. Straight off the canvas. */
export const CANVAS_DOT_PITCH = 32;

/**
 * How far the lattice behind the replica drifts, in film pixels per frame.
 *
 * About two pitches over a sixty-second cut. Slow enough that it reads as depth
 * rather than as movement, fast enough that a held frame of a held interface is
 * never quite still — which is the difference between "paused" and "alive" on a
 * beat where nothing in the product is happening.
 */
export const CANVAS_DRIFT_PX = 0.22;

/* ── brand accents ────────────────────────────────────────────────────────── */

/**
 * Violet is a SPOT colour: a caret, a pin head, a single hairline, one pill, a
 * rule under a card, the wipe on the end card. **Never a field and never a fill
 * behind a paragraph.**
 *
 * ⚠ This was relitigated twice and the objection won both times. The art
 * direction asked for full-bleed plum cards, the film got one on the price line,
 * and the founder's standing objection to large flat violet — recorded here
 * before any of it — settled it. Then the STAGE tints behind the window turned
 * out to be the same thing at a lower saturation, and they went too.
 *
 * The rule of thumb is now a number with a gate behind it: **no violet-family
 * colour may cover more than {@link VIOLET_AREA_MAX} of a frame as a flat
 * area**, aubergine's two approved uses excepted. `docs/decisions.md` D24 / D29.
 */
/**
 * The ceiling on any violet-family flat area, as a fraction of the frame.
 *
 * A founder constraint, not a taste call: large flat violet is objected to, and
 * "large" needed a number before anyone could check it. A seventh of the frame
 * is the width of a sweeping band, the height of a rule, the size of a chip —
 * everything violet is meant to be — and it is comfortably under a stage ground
 * or a type band, which is everything it is not.
 *
 * `capture/verify-violet.mjs` computes the areas from the layout rects, with no
 * pixel reads, for every scene in both frame shapes.
 */
export const VIOLET_AREA_MAX = 0.15;

/**
 * How wide the end card's sweeping plum band is, as a fraction of the frame.
 *
 * The one place a violet field is allowed at all, and only because it is a
 * field for nine frames and then gone. It lives here rather than in the
 * component because `capture/verify-violet.mjs` checks it against the ceiling,
 * and a number a gate cannot see is a number that drifts. It was a fifth once.
 */
export const END_WIPE_BAND = VIOLET_AREA_MAX - 0.01;

export const SPOT = {
  /** --plum. The brand violet. */
  plum: "#8052FF",
  /** --plum-strong / --action / --ring. 5.59:1 on the page — the TEXT violet. */
  action: "#6A3DF0",
  /** --plum-ink. */
  actionInk: "#FFFFFF",
} as const;

/**
 * The marketing band palette (`(marketing)/marketing.css`). The replica never
 * uses these; the film's own cards and end card may.
 */
export const BAND = {
  aubergine: "#3C315B",
  periwinkle: "#AB9FF2",
  /** The periwinkle that is legible as TEXT on paper (5.07:1). */
  periwinkleText: "#7062AE",
  buttercream: "#FFFFC4",
  mint: "#2EC08B",
} as const;

/* ── the colour script ────────────────────────────────────────────────────── */

/**
 * The stage BEHIND the replica window, per chapter.
 *
 * The first cut was twenty-eight beige frames out of thirty, which is a
 * competent film and not a lively one. The product's own surface must not be
 * tinted — the window keeps the true ivory and the true canvas, because it is a
 * picture of the product — so the colour goes on the ground it floats on, and
 * changes on the chapter boundary with the cut.
 *
 * Tints, not the raw band colours: computed once and written out, because this
 * file is parsed as TEXT and a `mix()` is exactly what a text-parsing gate
 * cannot see.
 *
 * ⚠ **NO VIOLET FAMILY, at any tint.** The draw stage was periwinkle at 50 %
 * and the render stage periwinkle at 70 %, and in a 9:16 split scene that band
 * is a third of the frame — a large flat violet area, which is the thing the
 * founder objects to. A tint of a violet is still a violet; a pale one covering
 * a third of the frame is exactly the case the objection is about. The
 * constraint is now a rule with a gate behind it: no violet-family colour may
 * cover more than {@link VIOLET_AREA_MAX} of a frame as a flat area.
 * `capture/verify-violet.mjs`, `docs/decisions.md` D29.
 *
 * So the script is built from the palette's NON-violet members: the page, the
 * product's own warm hairline used as a field, buttercream at two strengths and
 * mint at two. The two mints are three chapters apart with the dark receipt
 * between them, which is what keeps them from reading as a repeat.
 *
 * ⚠ An earlier pass mixed at 28 % and 22 % and the stills showed why that is not
 * enough: at the framings the money shot uses, the stage is a sliver either side
 * of the window, and a 28 % tint in a sliver is white. A colour script has to be
 * legible in the frames that show least of it.
 *
 * Aubergine is the one that is not a tint, and the one violet-family colour with
 * a standing exception — **two uses, both approved**: the what-line card and the
 * receipt band. The receipt beat is the film's differentiated claim and it gets
 * the frame that says so: a bright window on a dark ground, with the split line
 * in ivory at 9.6:1. The gate counts those two and fails on a third.
 */
export const STAGE = {
  /** --background. Where the film starts and ends. */
  brief: "#FBF8F2",
  /**
   * The product's own hairline (`--border`, `#E2DED5`) used as a FIELD — a warm
   * sand, legible in a sliver, and a colour the product already owns.
   */
  draw: "#E2DED5",
  /** --band-buttercream, straight. */
  edit: "#FFFFC4",
  /** Mint at 40 % over the page. */
  tweak: "#A9E2C9",
  /** --band-aubergine, straight. The one dark stage in the film. */
  review: "#3C315B",
  /**
   * Mint at 24 % over the page. The lights coming up after the dark receipt,
   * and the lightest of the two mints — `tweak` is the same hue at 40 %, three
   * chapters and one aubergine frame away.
   */
  render: "#D7EFE4",
  /** Buttercream, softened — the last colour before the end card. */
  export: "#F7EFC9",
} as const;

/** The lattice on a dark stage has to be light. */
export const STAGE_DOT_ON_DARK = "rgb(255 255 255 / 0.10)";

/** Type on a dark stage. */
export const STAGE_DARK = ["#3C315B"] as const;

/* ── contrast ─────────────────────────────────────────────────────────────── */

/**
 * Foreground/background pairs the film actually sets type in. A gate walks this
 * table. Rows are added as scenes land; a colour pair with no row here has not
 * been checked, which is different from having passed.
 */
export const CONTRAST_PAIRS = [
  { fg: "#13110F", bg: "#FBF8F2", min: 4.5, use: "ink on the page" },
  { fg: "#69645D", bg: "#FBF8F2", min: 4.5, use: "muted ink on the page" },
  { fg: "#6A3DF0", bg: "#FBF8F2", min: 4.5, use: "action violet on the page" },
  { fg: "#13110F", bg: "#FAFAFA", min: 4.5, use: "ink on the canvas" },
  { fg: "#13110F", bg: "#FFFDFA", min: 4.5, use: "ink on a card" },
  { fg: "#FFFFFF", bg: "#6A3DF0", min: 4.5, use: "white on the action fill" },
  { fg: "#FFFFFF", bg: "#3C315B", min: 4.5, use: "white on the aubergine band" },
  { fg: "#FBF8F2", bg: "#3C315B", min: 4.5, use: "ivory type on the aubergine stage" },
  { fg: "#13110F", bg: "#FFFFC4", min: 4.5, use: "ink on the buttercream card" },
  { fg: "#13110F", bg: "#E2DED5", min: 4.5, use: "ink on the warm sand stage" },
  { fg: "#13110F", bg: "#FFFFC4", min: 4.5, use: "ink on the buttercream stage" },
  { fg: "#13110F", bg: "#A9E2C9", min: 4.5, use: "ink on the mint-wash stage" },
  { fg: "#13110F", bg: "#D7EFE4", min: 4.5, use: "ink on the pale mint stage" },
  { fg: "#13110F", bg: "#F7EFC9", min: 4.5, use: "ink on the soft buttercream stage" },
] as const;

/* ── type ─────────────────────────────────────────────────────────────────── */

/**
 * Sizes are in LAYOUT units — `useLayout().u(n)` turns one into screen pixels
 * for the frame being rendered. Never convert these to px in a component, and
 * never read `useVideoConfig().width` to do it yourself.
 */
export const TYPE = {
  /**
   * A full-bleed kinetic card, when the line is short enough to take it. Sans.
   *
   * This is a CEILING, not a size: `fitLines()` shrinks from here toward
   * `body` on the character count, so "Describe your home." fills the frame and
   * "You pay only when you get" sets smaller without either one being typed as
   * a number. 96 was the original ceiling and left a 1920-wide frame looking
   * like a slide with a caption on it — visible in the first still pass, which
   * is the only reason this token exists.
   */
  hero: 190,
  /** A kinetic card's headline, and the ceiling for type over a picture. Sans. */
  display: 96,
  /** A section-weight line. Sans. */
  title: 64,
  /** A written line on screen. Sans. */
  body: 40,
  /** The honesty caption, the AI-generated pill, the end-card terms. Sans. */
  caption: 24,
  /** Room names, area labels, a parameter. Mono. */
  label: 26,
  /** Dimension strings. Mono — the drawing's smallest voice. */
  dimension: 18,
} as const;

export const WEIGHT = {
  regular: 400,
  medium: 500,
  bold: 700,
} as const;

/** Letter-spacing as a fraction of the size. Mono sets looser than sans. */
export const TRACKING = {
  display: -0.022,
  body: -0.008,
  mono: 0.02,
  caps: 0.14,
} as const;

export const LEADING = {
  display: 1.02,
  body: 1.34,
  mono: 1.2,
} as const;

/* ── geometry ─────────────────────────────────────────────────────────────── */

/** Layout units. The product's 4-based Tailwind rhythm. */
export const SPACE = {
  hair: 4,
  xs: 8,
  sm: 16,
  md: 32,
  lg: 64,
  xl: 128,
} as const;

/**
 * `--radius-card: 1.5rem` = 24px and `--radius-pill: 9999px`, straight off
 * globals.css. A card in the replica is a 24px corner; a pill is fully round.
 */
export const RADIUS = {
  card: 24,
  control: 10,
  pill: 9999,
} as const;

export const STROKE = {
  hair: 1.5,
  thin: 3,
  wall: 9,
} as const;

/* ── motion ───────────────────────────────────────────────────────────────── */

/**
 * Durations in SECONDS, never frames. `timeline.ts` is the only file that knows
 * what a frame is; everything here is intent.
 */
export const MOTION = {
  /** A quick cut between scenes. */
  cutSec: 0.28,
  /** The product's own plan cross-fade, from `.arch-crossfade`. */
  morphSec: 0.35,
  /** A tweak slider stepping between pre-baked variants. */
  tweakSec: 0.12,
  /** A card or a pill arriving. */
  enterSec: 0.24,
  /**
   * The end card's plum band crossing the frame. Nine frames at 30 fps.
   *
   * The `end-hit` lands at 55 % of it — on the band's leading edge reaching the
   * middle, not on its trailing edge leaving, because the gesture a viewer hears
   * is the one they are looking at.
   */
  wipeSec: 0.3,
} as const;

/**
 * How much of a card's accent rule is already drawn on its first frame.
 *
 * ⚠ Not zero, and the reason is the first frame of the whole film: it is a
 * card's first frame, and platforms pick it as the thumbnail. At 0.18 it was a
 * tiny dash on ivory — better than bare, and still not a frame anyone chose. At
 * 0.62 the rule is most of the way out and the first word is already half risen
 * (`WORD_FLOOR`), so frame 0 is a composition rather than a starting gun.
 *
 * It lives in this file rather than next to the component because
 * `capture/verify-opening.mjs` reads it, and the gates bundle only the
 * React-free modules.
 */
export const CARD_RULE_FLOOR = 0.62;

/**
 * How a card's words rise into frame: the rise, and the wait between words.
 *
 * ⚠ 0.1 s and 0.035 s, and both are floors the art direction set rather than
 * taste: **the hook must be on screen by frame 3**, which at 30 fps is 0.1 s. So
 * the first word's rise has to be over by then and the stagger has to be a
 * fraction of it. `capture/verify-opening.mjs` reads these and checks the first
 * word is essentially up at frame 3 — a slower reveal is a film waiting for
 * itself, which is the opposite of the brief.
 */
export const WORD_RISE_SEC = 0.1;
export const WORD_STAGGER_SEC = 0.035;

/**
 * How far the first word has already risen on frame 0.
 *
 * The other half of making the opening frame a designed one. The word is half
 * out of its mask and at 62 % opacity before a single frame has played, so a
 * platform that grabs frame 0 for a thumbnail grabs a card mid-sentence rather
 * than an empty rectangle — and the reveal still reads as a reveal, because the
 * remaining half happens in three frames.
 */
export const WORD_FLOOR = 0.5;
