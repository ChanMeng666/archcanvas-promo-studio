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
    camera: { to: 1.05 },
  },

  draw: {
    id: "draw",
    kind: "replica",
    intent:
      "The drafting sheet works, then the drawing comes in by layer. THE MONEY SHOT, and the honesty caption's home.",
    chapter: "draw",
    defaultReplica: { from: 5.5, to: 13 },
    camera: { to: 1.08 },
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
    camera: { to: 1.06 },
  },

  tweak: {
    id: "tweak",
    kind: "split",
    intent: "A parameter moves and the geometry follows. The machine voice.",
    copy: TWEAK_A_NUMBER,
    chapter: "tweak",
    defaultReplica: { from: 19, to: 23.5 },
    camera: { to: 1.05 },
  },

  receipt: {
    id: "receipt",
    kind: "split",
    intent:
      "The review pins drop and one opens. The differentiated beat — what it could NOT get right, in writing.",
    copy: RECEIPT,
    chapter: "review",
    defaultReplica: { from: 23.5, to: 28 },
    camera: { to: 1.1 },
  },

  storey: {
    id: "storey",
    kind: "split",
    intent:
      "L0 → L1 → L0. One source, one page per level — which is when 'every room' is literally on screen.",
    copy: FACTS,
    chapter: "render",
    defaultReplica: { from: 28, to: 29.8 },
    camera: { to: 1.04 },
  },

  render: {
    id: "render",
    kind: "replica",
    intent:
      "The rendering fades in, carrying the product's own always-visible AI-generated pill. A presentation aid, never the pitch — so the film says nothing over it.",
    chapter: "render",
    defaultReplica: { from: 29.8, to: 31.5 },
    camera: { to: 1.05 },
  },

  export: {
    id: "export",
    kind: "split",
    intent: "The export menu. Image and CAD, the real menu's own two groups, cursor on DXF.",
    copy: EXPORT_LINE,
    chapter: "export",
    defaultReplica: { from: 31.5, to: 35 },
    camera: { to: 1.06 },
  },

  price: {
    id: "price",
    kind: "card",
    intent: "The pay-per-result frame. No bare figure ever appears on screen.",
    copy: PRICE,
  },

  "second-brief": {
    id: "second-brief",
    kind: "replica",
    intent:
      "120 s only. The same seven chapters against a different brief — the one claim a long cut can make that a short one cannot.",
    chapter: "brief",
    defaultReplica: { from: 0, to: 5.5 },
    camera: { to: 1.04 },
    needs: "family-house screenplay — a second DemoInputs and its baked draw list (WP-9 decides)",
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
