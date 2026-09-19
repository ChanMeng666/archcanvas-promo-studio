/**
 * The scene library. **React-free** — the gates bundle it and run it in Node.
 *
 * There are not four films here. There is one library of scenes and four edit
 * decision lists (`cuts.ts`) that pick from it, so a fix to how the draw scene
 * reads lands in all eight masters at once.
 *
 * ── Four kinds, and the distinction is load-bearing ────────────────────────
 *
 *   **replica** — the coded replica of the product's studio is on screen alone.
 *   The scene's whole job is to put the camera somewhere and let the replica's
 *   own clock run. The picture comes from `src/replica/`, which is SYNCED from
 *   the product repo and never edited here.
 *
 *   **split** — the replica, plus ONE short line of the film's own type in the
 *   safe area beneath it. Used where the picture needs a verb the interface
 *   does not supply ("Say the change."), never to add a claim the picture does
 *   not support.
 *
 *   **card** — type on the ivory ground, no replica. A card invents a sentence,
 *   which is the expensive kind: every line needs a row in
 *   `docs/copy-clearance.md` before it may ship, and `verify:copy` enforces it.
 *
 *   **endcard** — the closing frame. A card in every respect except that it
 *   holds longer than a card may (a card is 1.2–2.2 s; the end card rests), so
 *   the pace check in `verify:timeline` exempts it by kind rather than by name.
 *
 * `hasReplica` is derived from the kind and is what the gates actually read —
 * a replica beat must carry a `replicaFrom`/`replicaTo` window and a card beat
 * must not.
 */

import {
  CLAIM_WHAT,
  EXPORT_LINE,
  FACTS,
  HOOK,
  PRICE,
  RECEIPT,
  SAY_THE_CHANGE,
  TWEAK_A_NUMBER,
  type CopyLine,
} from "./copy";

/** The seven acts of the replica's own screenplay. Mirrors its `ChapterId`. */
export type ChapterId =
  | "brief"
  | "draw"
  | "edit"
  | "tweak"
  | "review"
  | "render"
  | "export";

/**
 * Ordered as the 60 s cut plays them, which is also the product's own order:
 * describe, draw, read what you got, change it, tune it, see what is still
 * wrong, walk the storeys, look at it, take it away.
 */
export const SCENE_IDS = [
  "hook",
  "brief",
  "draw",
  "claim-what",
  "edit",
  "tweak",
  "receipt",
  "storey",
  "render",
  "export",
  "price",
  "second-brief",
  "endcard",
] as const;

export type SceneId = (typeof SCENE_IDS)[number];

export type SceneKind = "replica" | "split" | "card" | "endcard";

/**
 * The camera's behaviour on a scene, as a DEFAULT that a cut may override.
 *
 * A single scale multiplier, never a rect: this film cuts where the earlier one
 * moved, and a cut-based film that also flies the camera around reads as two
 * ideas fighting. `1` holds.
 */
export interface PushSpec {
  /** End/start scale over the beat. */
  to: number;
  /**
   * The scale the shot SITS at before the push, about what the scene is for.
   *
   * ⚠ This did not exist until the replica was actually on screen, and its
   * absence was the first still pass's biggest finding. The replica's landscape
   * layout gives the paper about a THIRD of its 1600-unit design box — correctly,
   * because the product leaves canvas around the sheet for the finding cards and
   * the floating panels. Mounted to fit a 1920 frame and pushed by the 1.03–1.12
   * this file already declared, the drawing came out 636 px tall in a 1080 px
   * frame: an interface demo where the money shot should be.
   *
   * So a scene now says where the camera STANDS as well as how it moves.
   * `frame` is the standing scale, `to` is the push over the beat, and the two
   * multiply. The values below were read off stills, one shot at a time, and
   * every one of them is clamped by `framePush` against the honesty caption —
   * so a framing that would crop the film's one obligation is reduced rather
   * than shipped.
   */
  frame?: number;
}

export interface Scene {
  id: SceneId;
  kind: SceneKind;
  /**
   * What this scene is for, in one line. **Not copy** — nothing here reaches
   * the screen and `verify:copy` does not read it.
   */
  intent: string;
  /** The film's own line, on a `split`, `card` or `endcard`. */
  copy?: CopyLine;
  /** The chapter of the replica's screenplay this scene sits over. */
  chapter?: ChapterId;
  /**
   * The replica window this scene plays when a cut does not say otherwise, in
   * screenplay seconds. The windows are the landing page's own chapter
   * boundaries, so the film and the website show literally the same seconds of
   * the same screenplay.
   */
  defaultReplica?: { from: number; to: number };
  /** The push this scene wants when a cut does not say otherwise. */
  camera?: PushSpec;
  /**
   * A card's ground. `paper` is ink on ivory; `deep` is full-bleed aubergine
   * with ivory type.
   *
   * ⚠ There is no violet option, and that is a decision rather than an
   * oversight. The founder's standing objection to large flat violet is on the
   * record, and a promo is not the place to relitigate it — so the one card that
   * changes the film's colour takes the marketing band palette's AUBERGINE
   * (`#3C315B`, white on it at 9.6:1, already a shipped surface), and violet
   * stays what `tokens.ts` says it is: a spot. `docs/decisions.md` D11.
   */
  tone?: "paper" | "deep";
  /**
   * Something this scene needs that does not exist yet. A scene with a `needs`
   * renders, but `verify:timeline` prints it on every run so a cut cannot
   * quietly ship against a fixture.
   */
  needs?: string;
}

/**
 * The roster.
 *
 * The replica windows below are the chapters of the 35 s landing loop:
 * brief 0–5.5 · draw 5.5–13 · edit 13–19 · tweak 19–23.5 · review 23.5–28 ·
 * render 28–31.5 · export 31.5–35. `storey` and `render` split the render
 * chapter at 29.8, where the storey chips stop and the rendering fades in.
 */
export const SCENES: Readonly<Record<SceneId, Scene>> = {
  hook: {
    id: "hook",
    kind: "card",
    intent: "Open on the plan and the help, never on the letters A and I.",
    copy: HOOK,
  },

  brief: {
    id: "brief",
    kind: "replica",
    intent: "Someone types what they want. The composer, the typology, the launch control.",
    chapter: "brief",
    defaultReplica: { from: 0, to: 5.5 },
    /*
     * THE WIDE SHOT, and it is the one scene that wants to be.
     *
     * The first still pass framed the composer card at 1.22x and got a line of
     * type floating in an empty ivory field: the product's own card is ivory on
     * ivory with a 1.3:1 hairline (deliberately — its borders are dividers, not
     * controls), and at that magnification the hairline is gone and the card
     * with it. There is nothing to fix upstream; a card that reads as a card at
     * 1100 px in a browser does not need to read as one at 2300 px in a film.
     *
     * So the brief beat shows the APPLICATION instead — window chrome, top bar,
     * the card on the canvas, the violet launch control — inside the film's own
     * rounded, shadowed window, and pushes in gently. The frame has structure
     * even where the product's own surface is deliberately flat. 1.09 is also
     * the most a 1600 x 1000 design box can take in a 16:9 frame before the
     * window's own edges leave it — so the push runs THROUGH that point and ends
     * inside the card. The contact sheet is why: at 1.09 the brief beat was three
     * consecutive seconds of a pale, near-identical window, the flattest stretch
     * in the 30 s cut. A push that starts on the whole application and finishes
     * on the sentence someone is typing is the same information with a move
     * under it.
     */
    camera: { to: 1.16, frame: 1 },
  },

  draw: {
    id: "draw",
    kind: "replica",
    intent:
      "The drafting sheet works, then the drawing comes in by layer. THE MONEY SHOT, and the honesty caption's home.",
    chapter: "draw",
    defaultReplica: { from: 5.5, to: 13 },
    // THE MONEY SHOT. 1.35 puts the paper at ~80 % of the frame height, which is
    // as close as the honesty caption's clamp allows on this beat — and the
    // caption is on screen for most of it, so that is the real ceiling.
    camera: { to: 1.08, frame: 1.35 },
  },

  "claim-what": {
    id: "claim-what",
    kind: "card",
    intent: "The what-line. The one sentence that says what the product does.",
    copy: CLAIM_WHAT,
  },

  edit: {
    id: "edit",
    kind: "split",
    intent: "Select a room, say what to change, watch the plan morph in place.",
    copy: SAY_THE_CHANGE,
    chapter: "edit",
    defaultReplica: { from: 13, to: 19 },
    // Closest framing in the film: the kitchen takes the building's full width
    // and the hall gives up the strip, and from the fit a viewer cannot see it.
    camera: { to: 1.06, frame: 1.5 },
  },

  tweak: {
    id: "tweak",
    kind: "split",
    intent: "A parameter moves and the geometry follows. The machine voice.",
    copy: TWEAK_A_NUMBER,
    chapter: "tweak",
    defaultReplica: { from: 19, to: 23.5 },
    // The slider and the wall it moves have to be in one frame or the beat says
    // nothing, so this is the widest of the close framings.
    camera: { to: 1.05, frame: 1.28 },
  },

  receipt: {
    id: "receipt",
    kind: "split",
    intent:
      "The review pins drop and one opens. The differentiated beat — what it could NOT get right, in writing.",
    copy: RECEIPT,
    chapter: "review",
    defaultReplica: { from: 23.5, to: 28 },
    // The open card and its pin, with enough drawing behind them to see what the
    // finding is about.
    camera: { to: 1.1, frame: 1.34 },
  },

  storey: {
    id: "storey",
    kind: "split",
    intent:
      "L0 → L1 → L0. One source, one page per level — which is when 'every room' is literally on screen.",
    copy: FACTS,
    chapter: "render",
    defaultReplica: { from: 28, to: 29.8 },
    // Both storey chips and the paper that changes under them.
    camera: { to: 1.04, frame: 1.3 },
  },

  render: {
    id: "render",
    kind: "replica",
    intent:
      "The rendering fades in, carrying the product's own always-visible AI-generated pill. A presentation aid, never the pitch — so the film says nothing over it.",
    chapter: "render",
    defaultReplica: { from: 29.8, to: 31.5 },
    // The rendering card carries the always-visible "AI-generated" pill, which
    // `framePush` protects: this scale is the one the clamp allows.
    camera: { to: 1.05, frame: 1.26 },
  },

  export: {
    id: "export",
    kind: "split",
    intent: "The export menu. Image and CAD, the real menu's own two groups, cursor on DXF.",
    copy: EXPORT_LINE,
    chapter: "export",
    defaultReplica: { from: 31.5, to: 35 },
    // The open menu and the sheet it belongs to.
    camera: { to: 1.06, frame: 1.3 },
  },

  price: {
    id: "price",
    kind: "card",
    intent: "The pay-per-result frame. No bare figure ever appears on screen.",
    copy: PRICE,
    // The film's one full-bleed colour frame, and it lands on the money line.
    tone: "deep",
  },

  /**
   * ⚠ This scene's `replicaFrom`/`replicaTo` are PLAN INDICES, not screenplay
   * seconds — `{ from: 0, to: 2 }` means "the first two montage plans".
   *
   * It reuses the window machinery rather than growing a second field because
   * every gate already understands a replica beat's window: `verify:timeline`
   * still requires one, still refuses a backwards one, and still refuses a card
   * that declares one. `SecondBrief` is the one component that reads it as an
   * index, and it says so where it does.
   */
  "second-brief": {
    id: "second-brief",
    kind: "replica",
    intent:
      "120 s only. Four more of the product's published plans, each under the brief it was really given — the one claim a long cut can make that a short one cannot.",
    defaultReplica: { from: 0, to: 4 },
    camera: { to: 1 },
  },

  endcard: {
    id: "endcard",
    kind: "endcard",
    intent: "The wordmark, the domain, and the descriptor that is not a protected title.",
  },
};

export const sceneOf = (id: SceneId): Scene => SCENES[id];

/** A scene that puts the synced replica on screen — `replica` or `split`. */
export const hasReplica = (id: SceneId): boolean =>
  SCENES[id].kind === "replica" || SCENES[id].kind === "split";

/** Every scene that puts the synced replica on screen. */
export const REPLICA_SCENES: readonly SceneId[] = SCENE_IDS.filter(hasReplica);

/** Every scene that sets the film's own type full-bleed. */
export const CARD_SCENES: readonly SceneId[] = SCENE_IDS.filter(
  (id) => SCENES[id].kind === "card",
);

/** Scenes that depend on something that does not exist yet. */
export const SCENES_WITH_NEEDS: readonly Scene[] = SCENE_IDS.map((id) => SCENES[id]).filter(
  (s) => s.needs !== undefined,
);

/**
 * How long a full-bleed card may hold, in seconds.
 *
 * The pace is fast and bright: a card is a beat, not a slide. Under 1.2 s it
 * cannot be read at all; over 2.2 s the cut stops moving and the film reads as
 * a deck. The end card is exempt by kind — it is the resting frame.
 */
export const CARD_SEC = { min: 1.2, max: 2.2 } as const;

/**
 * The longest a replica shot may hold with the camera parked, in seconds.
 *
 * Past this a static interface stops being watched. A beat that runs longer
 * must either push in or be cut in two — both are edits, and both are visible
 * in `cuts.ts` rather than fixed in a component.
 */
export const MAX_STATIC_UI_SEC = 9;
