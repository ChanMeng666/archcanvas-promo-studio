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

/**
 * The PICTURE's margins, which are not the type's.
 *
 * `SAFE` is a rule about where a reader can read a sentence: on 9:16 the top 250
 * px and the bottom 390 px belong to Reels, TikTok and Shorts, and a line of
 * type behind a share sheet is a line nobody sees. A PICTURE behind the top of a
 * share sheet is merely a picture with its corner covered — and mounting the
 * replica inside the type-safe area costs it real size, which on this film is
 * the difference between a room label a viewer can read and one they cannot.
 *
 * So the replica gets its own, looser box: it still clears the bottom furniture
 * completely (that is where the caption row and the buttons actually sit) and it
 * gives the top only what the platform's own header takes. Measured against the
 * stills, not guessed: at 1920x1080 this is a 7.9 % larger replica than the
 * type-safe stage gave, and at 1080x1920 it is 16 % larger.
 */
const PICTURE: Record<Aspect, { top: number; bottom: number; side: number }> = {
  landscape: { top: 44, bottom: 52, side: 44 },
  portrait: { top: 130, bottom: 400, side: 20 },
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
  /** The rectangle a block of TYPE may occupy, inside the text-safe area. */
  stage: { x: number; y: number; w: number; h: number };
  /** The rectangle the PICTURE is mounted into — looser than `stage`, see `PICTURE`. */
  picture: { x: number; y: number; w: number; h: number };
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

  const pic = PICTURE[aspect];
  const picture = {
    x: pic.side,
    y: pic.top,
    w: width - pic.side * 2,
    h: height - pic.top - pic.bottom,
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
    picture,
    isWide: aspect === "landscape",
  };
};

/**
 * Where the PICTURE stops in this frame shape, in film pixels.
 *
 * ── Why 9:16 clips and 16:9 does not ───────────────────────────────────────
 *
 * The mount box already clears the platform furniture — `PICTURE.portrait`
 * bottoms out at 1520 against a 1530 safe line — but the mount is not the
 * picture. `camera.ts` scales the whole layer about its origin, so a 2.6x push
 * carries content straight out of the box it was mounted in, and in 9:16 that
 * content lands in the 390 px Reels, TikTok and Shorts cover with their own
 * interface. Measured: eleven beats across the four vertical cuts put the
 * sheet's own caption row down there, cut in half by the frame edge
 * (`-storey Townhouse`), and the drafting card lands cropped on both sides for
 * the hand-over half-second.
 *
 * So in 9:16 the picture ENDS here and the chapter's colour owns the band
 * below — exactly what a `split` scene already does with its type band, one
 * rule instead of two. In 16:9 there is no platform band to respect and the
 * window's own shadow needs the room, so the picture runs to the frame.
 *
 * ⚠ The clip is the MOUNT's bottom, not the safe line, and the ten pixels
 * matter: clipping at 1530 would leave a sliver in which pushed-out content
 * could still show, which is the defect with a smaller number on it.
 */
export const pictureClipBottom = (l: Layout): number =>
  l.aspect === "portrait" ? l.picture.y + l.picture.h : l.height;

/**
 * How far the picture dissolves into the band at the clip, in film pixels.
 *
 * A hard line across the paper reads as a crop; a short feather reads as the
 * sheet running under the band. Kept small — past about a thirtieth of the
 * frame it stops being an edge treatment and starts being a vignette.
 */
export const PICTURE_FEATHER_PX = 20;

/* ── the split stage ──────────────────────────────────────────────────────── */

/**
 * How much of the stage a `split` scene's line takes, as a fraction.
 *
 * ── Why the line is INSIDE the stage and not under it ──────────────────────
 *
 * The first still pass put it in the band below the stage, which looked
 * obvious and was wrong twice. In 16:9 that band is 88 px and the two-line
 * receipt sentence is about 160 px, so it ran off the bottom of the frame — a
 * thing a still shows instantly and a green gate never will. And in 9:16 it
 * would have "fitted", into the 390 px **Reels and TikTok cover with their own
 * interface**: type that is comfortably inside the frame and completely behind
 * a share sheet.
 *
 * The safe area is the whole point of `SAFE`. So a split scene divides the
 * STAGE — picture above, line below, both inside the area a viewer can
 * actually see — and the picture gives up the room rather than the type
 * leaving the readable frame.
 */
const SPLIT_BAND: Record<Aspect, number> = {
  landscape: 0.19,
  portrait: 0.17,
};

export type StageRect = { x: number; y: number; w: number; h: number };

/**
 * The two rectangles of a split scene: the picture above, the line below.
 *
 * The PICTURE half is cut out of `picture` and the LINE half out of `stage`, so
 * each gets the box its own rule is about — the replica gets the looser picture
 * margins, and the type stays inside the area a platform's interface does not
 * cover. Splitting one box for both is what put a two-line receipt sentence 72
 * px past the bottom of a 16:9 frame in the scaffold's first still pass.
 */
export const splitStage = (l: Layout): { replica: StageRect; line: StageRect } => {
  const band = Math.round(l.stage.h * SPLIT_BAND[l.aspect]);
  const gap = l.u(24);
  const lineY = l.stage.y + l.stage.h - band;
  return {
    replica: {
      x: l.picture.x,
      y: l.picture.y,
      w: l.picture.w,
      h: Math.max(80, lineY - gap - l.picture.y),
    },
    line: { x: l.stage.x, y: lineY, w: l.stage.w, h: band },
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
