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

/* ── brand accents ────────────────────────────────────────────────────────── */

/**
 * Violet is a SPOT colour: a caret, a pin head, a single hairline, one pill.
 * Never a field and never a fill behind a paragraph. The founder's standing
 * objection to large flat violet is on the record and this film does not
 * relitigate it.
 */
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
  hero: 150,
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
} as const;
