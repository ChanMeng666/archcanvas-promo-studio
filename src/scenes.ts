/**
 * The scene library. **Types and the roster — WP-7 fills in the components.**
 *
 * There are not four films here. There is one library of scenes and four edit
 * decision lists (`cuts.ts`) that pick from it, so a fix to how the draw scene
 * reads lands in all eight masters at once.
 *
 * A scene is one of two kinds and the distinction is load-bearing:
 *
 *   **replica** — the coded replica of the product's studio is on screen, and
 *   the scene's whole job is to put the camera somewhere and let the replica's
 *   own clock run. The picture comes from `src/replica/`, which is SYNCED from
 *   the product repo and never edited here.
 *
 *   **card** — type on the ivory ground, no replica. A card invents a sentence,
 *   which is the expensive kind, so every line one sets needs a row in
 *   `docs/copy-clearance.md` before it may ship.
 */

/* ── the roster ───────────────────────────────────────────────────────────── */

/**
 * Ordered as the 60s cut plays them, which is also the product's own order:
 * describe, draw, read what you got, change it, tune it, see what is still
 * wrong, look at it, take it away.
 */
export const SCENE_IDS = [
  "hook",
  "brief",
  "draw",
  "claim-what",
  "edit",
  "tweak",
  "receipt",
  "render",
  "export",
  "price",
  "endcard",
] as const;

export type SceneId = (typeof SCENE_IDS)[number];

export type SceneKind = "replica" | "card";

export type Scene = {
  id: SceneId;
  kind: SceneKind;
  /**
   * What this scene is for, in one line. Not copy — nothing here reaches the
   * screen, and `verify:copy` does not read it.
   */
  intent: string;
  /**
   * The chapter of the replica's screenplay this scene sits over, when it is a
   * replica scene. `null` on a card.
   */
  chapter: string | null;
};

/**
 * The roster. **Deliberately data and not components yet** — WP-7 adds the
 * render half, and until it does, `Film.tsx` draws a labelled placeholder per
 * scene so the compositions are inspectable today.
 */
export const SCENES: Readonly<Record<SceneId, Scene>> = {
  hook: {
    id: "hook",
    kind: "card",
    intent: "Open on the plan and the help, never on the letters A and I.",
    chapter: null,
  },
  brief: {
    id: "brief",
    kind: "replica",
    intent: "Someone types what they want. The composer, the typology, the launch control.",
    chapter: "brief",
  },
  draw: {
    id: "draw",
    kind: "replica",
    intent: "The drafting sheet works, then the drawing comes in by layer.",
    chapter: "draw",
  },
  "claim-what": {
    id: "claim-what",
    kind: "card",
    intent: "The what-line. The one sentence that says what the product does.",
    chapter: null,
  },
  edit: {
    id: "edit",
    kind: "replica",
    intent: "Select a room, say what to change, watch the plan morph in place.",
    chapter: "edit",
  },
  tweak: {
    id: "tweak",
    kind: "replica",
    intent: "A parameter moves and the geometry follows. The machine voice.",
    chapter: "tweak",
  },
  receipt: {
    id: "receipt",
    kind: "replica",
    intent: "The review pins. The differentiated beat — what it could NOT get right.",
    chapter: "review",
  },
  render: {
    id: "render",
    kind: "replica",
    intent: "Storeys, then the rendering, which always carries its AI-generated pill.",
    chapter: "render",
  },
  export: {
    id: "export",
    kind: "replica",
    intent: "The export menu. Image and CAD, the real menu's own two groups.",
    chapter: "export",
  },
  price: {
    id: "price",
    kind: "card",
    intent: "The pay-per-result frame. No bare figure ever appears on screen.",
    chapter: null,
  },
  endcard: {
    id: "endcard",
    kind: "card",
    intent: "The wordmark, the honesty caption's last home, and the domain.",
    chapter: null,
  },
};

export const sceneOf = (id: SceneId): Scene => SCENES[id];

/** Every scene that puts the synced replica on screen. */
export const REPLICA_SCENES: readonly SceneId[] = SCENE_IDS.filter(
  (id) => SCENES[id].kind === "replica",
);
