/**
 * One scene library, eight deliverables — the pure half.
 *
 * React-free and Remotion-free so `capture/lib/load-core.mjs` can bundle it
 * with esbuild and check the real per-format numbers in Node. The thin
 * `useLayout()` hook that feeds it `useVideoConfig()` lives in `layout.ts`;
 * components import from THERE and never touch this file directly.
 *
 * **Scenes never read `useVideoConfig().width`.** They read `useLayout()`.
 * A component inside a `<Sequence>` also must take its length as a `dur` prop —
 * `useVideoConfig().durationInFrames` reports the COMPOSITION length there.
 */

/**
 * 30, and it is not a free choice. The replica is a pure function of time
 * (`at(screenplay, t)`), and the web host drives it from a rAF clock while this
 * repo drives it from `frame / fps`. 30 is what the product's own capture and
 * both earlier films run at, so nothing has to be resampled.
 */
export const FPS = 30;

/* ── the four cuts ────────────────────────────────────────────────────────── */

/**
 * Four lengths, ONE scene library. These are not four films: `cuts.ts` holds an
 * edit decision list per length, in SECONDS, that picks scenes out of
 * `scenes.ts` and time-warps the replica's own clock into them.
 */
export const CUT_IDS = ["15", "30", "60", "120"] as const;
export type CutId = (typeof CUT_IDS)[number];

/** How long each cut runs, in seconds. The EDLs must sum to exactly this. */
export const CUT_SECONDS: Readonly<Record<CutId, number>> = {
  "15": 15,
  "30": 30,
  "60": 60,
  "120": 120,
};

/* ── aspect ───────────────────────────────────────────────────────────────── */

export type Aspect = "landscape" | "portrait";

/**
 * How the REPLICA lays itself out, which is a different question from how the
 * FRAME is shaped.
 *
 * The vertical cuts are a re-layout, never a crop: the product's own studio
 * stacks the composer above the sheet below `md`, and the replica has both
 * arrangements. A 9:16 frame gets the portrait arrangement because that is what
 * the product would actually show at that width — not because 16:9 was cut down
 * the middle.
 */
export type ReplicaLayout = "landscape" | "portrait";

export const aspectOf = (width: number, height: number): Aspect =>
  width >= height ? "landscape" : "portrait";

/* ── safe areas ───────────────────────────────────────────────────────────── */

/**
 * Text safe areas, in screen px. Reels, TikTok and Shorts cover the top and
 * bottom of a 9:16 frame with their own UI, so vertical gives up far more than
 * landscape does.
 */
const SAFE: Record<Aspect, { top: number; bottom: number; side: number }> = {
  landscape: { top: 80, bottom: 88, side: 128 },
  portrait: { top: 250, bottom: 390, side: 92 },
};

/**
 * The unit scale per aspect. The short edge is 1080 in both, so this barely
 * moves; landscape steps up because it is read across a room.
 */
const UNIT_SCALE: Record<Aspect, number> = {
  landscape: 1.05,
  portrait: 1,
};

export type Layout = {
  width: number;
  height: number;
  aspect: Aspect;
  /** Which arrangement of the replica this frame shows. */
  replicaLayout: ReplicaLayout;
  safe: { top: number; bottom: number; side: number };
  /** The multiplier `u()` applies. Exposed so a gate can print it. */
  scale: number;
  /** Turn a token-space value into screen pixels for THIS frame. */
  u: (value: number) => number;
  /** The widest a block of type may run. */
  maxContent: number;
  /** The rectangle the replica is mounted into, inside the safe area. */
  stage: { x: number; y: number; w: number; h: number };
  isWide: boolean;
};

export const deriveLayout = (width: number, height: number): Layout => {
  const aspect = aspectOf(width, height);
  const safe = SAFE[aspect];
  const scale = UNIT_SCALE[aspect];

  const stage = {
    x: safe.side,
    y: safe.top,
    w: width - safe.side * 2,
    h: height - safe.top - safe.bottom,
  };

  return {
    width,
    height,
    aspect,
    replicaLayout: aspect,
    safe,
    scale,
    u: (value: number) => Math.round(value * scale),
    maxContent: aspect === "landscape" ? 1420 : width - safe.side * 2,
    stage,
    isWide: aspect === "landscape",
  };
};

/* ── the deliverables ─────────────────────────────────────────────────────── */

export type Deliverable = {
  id: string;
  cut: CutId;
  width: number;
  height: number;
};

/**
 * The eight masters. Four lengths x two aspect ratios, short edge 1080 in all
 * eight. `Root.tsx` maps over this and nothing else, so the eight cannot drift
 * apart — `verify:timeline` checks that it still does.
 */
export const DELIVERABLES: readonly Deliverable[] = [
  { id: "Studio-15-Landscape-16x9", cut: "15", width: 1920, height: 1080 },
  { id: "Studio-15-Vertical-9x16", cut: "15", width: 1080, height: 1920 },
  { id: "Studio-30-Landscape-16x9", cut: "30", width: 1920, height: 1080 },
  { id: "Studio-30-Vertical-9x16", cut: "30", width: 1080, height: 1920 },
  { id: "Studio-60-Landscape-16x9", cut: "60", width: 1920, height: 1080 },
  { id: "Studio-60-Vertical-9x16", cut: "60", width: 1080, height: 1920 },
  { id: "Studio-120-Landscape-16x9", cut: "120", width: 1920, height: 1080 },
  { id: "Studio-120-Vertical-9x16", cut: "120", width: 1080, height: 1920 },
] as const;
