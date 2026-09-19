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
import { LOOP_FADE_SEC } from "./honesty";
import { APP, BAND, STAGE } from "./tokens";

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
 * A card's ground.
 *
 * Declared HERE rather than beside the component that draws it, because
 * `scenes.ts` is bundled and executed in Node by the gates and a `.tsx` import
 * would drag React into that bundle — which is the tripwire, not a nuisance.
 */
export type CardTone = "paper" | "deep" | "bright";

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
   * How much of the FRAME the thing this beat is about should fill, 0..1.
   *
   * A FRACTION, not a scale. It was a scale for one pass, and the
   * art-direction review is why it is not: a hand-tuned 1.35 that framed the
   * drawing well at 1920x1080 framed it small at 1080x1920 and smaller again
   * inside a split scene's shorter box, so the first cut had the UI at about a
   * quarter of the picture and a composer card adrift in beige. A fraction means
   * the same thing in every composition, and `camera.ts` derives the scale from
   * the focus rectangle's real size in that frame.
   *
   * `to` is still the push over the beat and the two multiply, so a beat can be
   * framed close and then pull OUT (`to` below 1) to reveal the studio around
   * it. Every result is floored at 1 and clamped by `framePush` against the
   * protected rectangles.
   */
  fill?: number;
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
   * The film draws the honesty caption over this scene, and the replica's own
   * may therefore leave the frame.
   *
   * Only the `draw` scene sets it, and only because the money shot's framing
   * puts the product's caption below the frame edge. The obligation does not
   * move: `honestyWindowFor` gives the sentence to the film's own band, above
   * the camera, where nothing can crop it, and `verify:honesty` enforces the
   * thing that would actually be wrong - a caption half in frame.
   */
  filmCaption?: boolean;
  /**
   * A card's ground: `paper` (ink on ivory), `deep` (aubergine) or `bright`
   * (buttercream).
   *
   * ⚠ The cards ALTERNATE, and that is the point rather than a preference — a
   * film whose every card is ivory is a film whose contact sheet is one colour.
   *
   * There is no `plum`. There was, for one pass, on the art direction's explicit
   * instruction; the founder's standing objection to large flat violet is older
   * and stands, so the price card is buttercream with obsidian type instead —
   * which is the warmer, lighter frame the "you pay" moment wanted anyway.
   * `docs/decisions.md` D24.
   */
  tone?: CardTone;
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
    tone: "paper",
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
    // The composer card across two thirds of the frame, pushing to fill it:
    // someone typing is the beat, and the words have to be readable.
    camera: { to: 1.14, fill: 0.66 },
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
    // THE MONEY SHOT. The BUILDING at 85 % of the frame (`buildingBox`), then a
    // pull-out over the beat that reveals the studio around it as the last
    // strokes land. The product's own caption is off-frame at this framing, so
    // the film draws the sentence itself.
    camera: { to: 0.62, fill: 0.85 },
    filmCaption: true,
  },

  "claim-what": {
    id: "claim-what",
    kind: "card",
    intent: "The what-line. The one sentence that says what the product does.",
    copy: CLAIM_WHAT,
    tone: "deep",
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
    // The kitchen and the command bar in one frame: the beat is the sentence
    // and the change it makes.
    //
    // 0.86, not 0.90: a split scene's fill is measured against the part of the
    // frame above the type band (`camera.ts` § shotFor), and the last few points
    // were the difference between a subject that fits and one cut at its top
    // edge. `verify:framing`.
    camera: { to: 1.06, fill: 0.86 },
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
    // The knob and the wall it moves.
    camera: { to: 1.05, fill: 0.88 },
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
    // Close enough to READ the finding — a frame wide enough to hold the whole
    // drawing is a frame the sentence in the card is illegible in — and then a
    // gentle pull-out, so the beat ends showing the drawing the finding is
    // about and a little of the aubergine stage it floats on.
    camera: { to: 0.86, fill: 0.82 },
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
    camera: { to: 1.04, fill: 0.86 },
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
    // The drawing and the rendering card side by side, filling the frame.
    camera: { to: 1.04, fill: 0.94 },
  },

  export: {
    id: "export",
    kind: "split",
    intent: "The export menu. Image and CAD, the real menu's own two groups, cursor on DXF.",
    copy: EXPORT_LINE,
    chapter: "export",
    // Not 35: the screenplay ends on the landing loop's fade-out and a film
    // cuts to its end card instead. See `cuts.ts` § LOOP_FADE_SEC.
    defaultReplica: { from: 31.5, to: LOOP_FADE_SEC },
    // The menu, readable, with the drawing it belongs to. 0.87 rather than 0.92
    // for the reason the `edit` beat gives.
    camera: { to: 1.04, fill: 0.87 },
  },

  price: {
    id: "price",
    kind: "card",
    intent: "The pay-per-result frame. No bare figure ever appears on screen.",
    copy: PRICE,
    // The film's brightest frame, and it lands on the money line.
    tone: "bright",
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

/* ── what colour a scene's ground is ──────────────────────────────────────── */

/**
 * The ground a scene paints behind everything else, as one table.
 *
 * ⚠ ONE table, and it lives here rather than in the component because three
 * things read it and they must not disagree: the router (which paints it), the
 * colour wipe (which has to know what colour it is wiping off) and
 * `capture/verify-violet.mjs` (which has to know how much of the frame it
 * covers). The gate is React-free, so a table inside a component is a table the
 * constraint cannot be checked against.
 */
export const CARD_GROUND: Readonly<Record<CardTone, string>> = {
  /** Ink on the product's own paper. */
  paper: APP.page,
  /** The marketing band's aubergine — one of its two approved uses. */
  deep: BAND.aubergine,
  /** Buttercream, full bleed — the film's brightest frame. It was plum once. */
  bright: BAND.buttercream,
};

export const groundOf = (id: SceneId | null): string | null => {
  if (!id) return null;
  const s = SCENES[id];
  if (s.chapter) return STAGE[s.chapter];
  if (s.tone) return CARD_GROUND[s.tone];
  return APP.page;
};

/**
 * The four grounds the second brief's montage cycles, one per plan.
 *
 * Here for the same reason `groundOf` is: the montage paints a full-bleed field
 * and the violet gate has to be able to see which colour.
 */
export const MONTAGE_STAGES = [STAGE.edit, STAGE.tweak, STAGE.draw, STAGE.export] as const;
