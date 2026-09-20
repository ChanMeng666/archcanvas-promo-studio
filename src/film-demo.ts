/**
 * The film's `DemoInputs`, its screenplay and its resolved pages.
 *
 * **React-free** — `capture/lib/load-core.mjs` bundles it so a gate can ask the
 * replica what it looks like at a given second without starting a renderer.
 * That is what lets the honesty gate check the caption's box against the real
 * camera maths instead of against a re-implementation of them.
 *
 * ── Nothing here is written, everything is read ────────────────────────────
 *
 * `STUDIO_DEMO` is the product's own generated module, synced. The brief is the
 * brief the product was given, the title is the title it drew, the room chips
 * are the rooms it found, and the three findings are verbatim `lint()` output on
 * the final variant. The one string that is not in that module — the typology
 * the composer picks — is read out of the product's own showcase roster at sync
 * time (`DEMO_TYPOLOGY`), and the edit command comes from the SYNCED
 * screenplay's own fixture, so the film authors none of it.
 *
 * ── Which payload is drawn ─────────────────────────────────────────────────
 *
 * `LANDING`, not `DRAWLIST`. See `docs/decisions.md` D9: the as-issued sheet
 * puts a 7.8 m building in a third of an A3 page, and at 1920 px a room label on
 * it is four pixels tall. The landing payload is the same compiled geometry with
 * the sheet taken off — and it is what the replica's own sheet fit, camera
 * envelope and pin anchors were tuned against upstream. The as-issued payload
 * stays synced as the numbers gate's record.
 */

import { at } from "./replica/at";
import { buildPageMap } from "./replica/resolvePages";
import { FIXTURE_DEMO, buildScreenplay } from "./replica/screenplay";
import type { LandingPayload, PlanPage } from "./replica/planTypes";
import type { PlanPageMap } from "./replica/resolvePages";
import type { DemoInputs, ReplicaState, Screenplay } from "./replica/types";
import {
  DEMO_TYPOLOGY,
  LANDING,
  SHOWCASE_PLANS,
  STUDIO_DEMO,
  type ShowcasePlanJson,
} from "./replica-data";

/* ── the demo ─────────────────────────────────────────────────────────────── */

/**
 * The four baked parameter states, in the order the slider steps through them.
 *
 * Declared here rather than derived from `STUDIO_DEMO.param.values.length`
 * because the mapping value -> variant is a fact about the bake, and a bake that
 * grew a fifth value should fail the type check rather than quietly leave the
 * slider drawing the fourth drawing for two of its five stops.
 */
const PARAM_VARIANTS = ["tweak-0", "tweak-1", "tweak-2", "tweak-3"] as const;

/** The rendering the render chapter fades in. Product output, never generated here. */
export const RENDERING_SRC = "/showcase/renders/two-storey-townhouse-exterior.webp";

export const DEMO: DemoInputs = {
  brief: STUDIO_DEMO.brief,
  typology: DEMO_TYPOLOGY,
  title: STUDIO_DEMO.title,
  roomChips: STUDIO_DEMO.roomChips,
  kitchen: STUDIO_DEMO.kitchen,
  // The synced screenplay's own fixture sentence — a product-shaped command,
  // cleared upstream by `tests/studioReplicaStrings.test.ts` sitting next to it.
  editCommand: FIXTURE_DEMO.editCommand,
  param: {
    name: STUDIO_DEMO.param.name,
    unit: "mm",
    values: STUDIO_DEMO.param.values,
    variants: PARAM_VARIANTS,
  },
  /*
   * ⚠ Copied FIELD BY FIELD once, and that was the bug waiting to happen. The
   * mapping was `{ message, archId }`, which was every field a finding had —
   * until the product added `level`, and a hand-shaped copy silently dropped it.
   * The pins would then have gone on hovering over the first floor, pointing at
   * ground-floor rooms that are not there, and nothing here would have said so.
   *
   * `code` is the one field deliberately left behind: it is the compiler's lint
   * code, it never reaches a screen, and naming it on a consumer surface is a
   * ban. Everything else the product says about a finding comes across.
   */
  findings: STUDIO_DEMO.findings.map(({ code: _code, ...finding }) => finding),
  renderingSrc: RENDERING_SRC,
  pageCount: Object.keys(STUDIO_DEMO.pageNames).length,
};

/** The 35-second loop, built once. Both the film and the landing page run this. */
export const SCREENPLAY: Screenplay = buildScreenplay(DEMO);

/**
 * Every page the payload can produce, resolved.
 *
 * Built at module scope, which Remotion re-executes in every render worker —
 * about 1,700 nodes across six variants, which is a few milliseconds and is
 * paid once per worker rather than once per frame.
 */
export const PAGES: PlanPageMap = buildPageMap(LANDING as unknown as LandingPayload);

/** The replica's state at a screenplay second. The film's one entry point to it. */
export const stateAt = (t: number): ReplicaState => at(SCREENPLAY, t);

/**
 * The seven chapter labels, keyed by id — the product's own words.
 *
 * `CHAPTERS` in the synced screenplay is what the landing page's chapter tabs
 * are built from, so the chip over a replica beat says exactly what the website
 * says. A vocabulary invented for the film would be a seventh thing to keep in
 * step with the product, and nobody would notice when it stopped being.
 */
export const CHAPTER_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  SCREENPLAY.chapters.map((c) => [c.id, c.label]),
);

/* ── the honesty caption ──────────────────────────────────────────────────── */


/**
 * Re-exported from `honesty.ts`, which derives it from the SYNCED screenplay.
 *
 * It lives there rather than here because the gates bundle it, and this module
 * pulls in the baked payloads — a megabyte of drawing that a gate asking "when
 * is the caption opaque?" has no use for.
 */
export { REPLICA_CAPTION_WINDOW, REPLICA_HONESTY_TEXT, captionDrift } from "./honesty";

/* ── the second brief ─────────────────────────────────────────────────────── */

/** One montage plan, as the sync bakes it. The shape is the seam's. */
export type MontagePlan = ShowcasePlanJson;

/**
 * The 120 s cut's second brief: four more of the product's published plans.
 *
 * **Why a montage and not the same townhouse from another angle.** The long cut
 * is the only one that can say "this is not one canned demo", and it can only
 * say it by drawing a different building. Re-framing the same plan would be the
 * film asserting variety it had not shown. The four here are the product's own
 * published showcase plans, baked from their compiled SVG at sync time, and the
 * only words on screen are each plan's own brief and its own title — no line the
 * film wrote, so there is nothing to clear and nothing to overclaim.
 */
export const MONTAGE: readonly MontagePlan[] = SHOWCASE_PLANS;

/**
 * The montage plans as `PlanPage`s, built ONCE.
 *
 * `PlanSvg` — the product's own drawing renderer — takes a `PlanPage` and a
 * `ReplicaState`, and `drawPlanFor` caches a page's layer banding in a `WeakMap`
 * keyed by IDENTITY. Rebuilding these objects per frame would miss that cache
 * every time and re-band four hundred nodes thirty times a second for an answer
 * that cannot change. They are frozen build artifacts; they are built here.
 *
 * `rooms` is empty on purpose: nothing in the montage is selected, pinned or
 * pointed at, and a room box exists to aim something.
 */
export const MONTAGE_PAGES: readonly PlanPage[] = MONTAGE.map((p) => ({
  level: 0,
  name: p.title,
  viewBox: p.viewBox,
  defs: p.defs,
  nodes: p.nodes.map((n) => ({ ...n })),
  texts: p.texts.map((t) => ({ ...t })),
  rooms: [],
}));

/**
 * The screenplay's own `drawPlan` beat, so the montage can borrow its rhythm.
 *
 * The five layer bands overlap on a schedule `at.ts` owns (the walls are still
 * closing when the doors start). Rather than restate that schedule for the
 * montage — which is how two drawings in one film end up drawing differently —
 * the montage asks the real fold for the state at a point inside the real beat.
 */
const drawBeat = SCREENPLAY.beats.find((b) => b.action.k === "drawPlan");
export const DRAW_BEAT = { at: drawBeat?.at ?? 9.3, dur: drawBeat?.dur ?? 3.5 } as const;

/**
 * The windows, in screenplay seconds, in which the film's two protected things
 * are on screen at all.
 *
 * ⚠ Used to decide the protection for a WHOLE BEAT rather than frame by frame,
 * and the difference is visible. The caption's box is 92 % of the portrait
 * design box's width, so protecting it caps the push at about 1.06 — correctly.
 * Applied per frame, that cap appeared the moment the caption did and vanished
 * the moment it faded, so the 9:16 draw beat sat wide for four seconds and then
 * lurched 35 % closer in the last half-second. A shot's framing is a decision
 * about the shot; it does not change halfway through because a caption ended.
 */
const captionBeat = SCREENPLAY.beats.find((b) => b.action.k === "caption");
const renderBeat = SCREENPLAY.beats.find((b) => b.action.k === "showRendering");

export const CAPTION_SPAN = {
  from: captionBeat?.at ?? 0,
  to: (captionBeat?.at ?? 0) + (captionBeat?.dur ?? 0),
} as const;

/** The rendering stays on screen once it has arrived, so this has no end. */
export const RENDERING_SPAN = {
  from: renderBeat ? renderBeat.at + renderBeat.dur * 0.4 : Infinity,
  to: SCREENPLAY.durationSec,
} as const;

/**
 * When the review chapter OPENS a pin, in screenplay seconds.
 *
 * The receipt beat frames differently before and after: while the pins are
 * dropping there is no card to read and the shot has to hold the drawing they
 * are landing on; once one is open, the sentence in the card is the subject.
 * Read per BEAT against this, not per frame, for the usual reason — a framing
 * that changes halfway through a beat is a lurch.
 */
const openPinBeat = SCREENPLAY.beats.find((b) => b.action.k === "openPin");
export const OPEN_PIN_SEC: number = openPinBeat ? openPinBeat.at + openPinBeat.dur * 0.5 : Infinity;

/**
 * The window the receipt beat TRAVELS across, in screenplay seconds.
 *
 * ⚠ The camera used to be framed for "the pin and its open card" from the
 * beat's first frame, on the rule that a framing must not change because its
 * subject arrived. That rule is right about lurches and wrong about this: the
 * card does not fade, it appears, and until it does the shot is half bare canvas
 * with the drawing cropped off the far edge. A rendered master showed it at
 * 19.5 s in the 30 s cut.
 *
 * So the beat starts on what is there — the pins landing on the drawing — and
 * makes ONE eased move to the card composition. Both ends are read off the
 * screenplay: it leaves when the last pin has landed (there is nothing more to
 * watch on the wide shot) and lands when the CLICK lands, `at + dur`. A typed
 * duration would have been wrong in three cuts out of four, because the time
 * warp runs this 35 s screenplay at 2.50x in the 15 s cut and 0.46x in the
 * 120 s one.
 *
 * ⚠ It ends at the click, not at `OPEN_PIN_SEC` — which is the midpoint, the
 * frame the card actually appears on. Landing exactly there looked right and was
 * not: an ease-in-out has a flat tail, so the camera was already parked in the
 * card's composition for the last few frames before the card existed, which is
 * the original defect in miniature. Overrunning the card's arrival by the
 * second half of the click keeps the shot moving until the card is there.
 */
const dropPinsBeat = SCREENPLAY.beats.find((b) => b.action.k === "dropPins");
export const OPEN_PIN_TRAVEL = {
  from: dropPinsBeat ? dropPinsBeat.at + dropPinsBeat.dur : 0,
  to: openPinBeat ? openPinBeat.at + openPinBeat.dur : OPEN_PIN_SEC,
} as const;

/**
 * The window the render beat travels across. Same shape, same reason: the
 * rendering card is a hole in the top-right of the frame until it fades in, and
 * `RENDERING_SPAN.from` is already the second the film counts it as present.
 */
export const RENDERING_TRAVEL = {
  from: renderBeat ? renderBeat.at : 0,
  to: renderBeat ? renderBeat.at + renderBeat.dur * 0.7 : RENDERING_SPAN.from,
} as const;

/**
 * The `drawPlan` beat itself, for the warp.
 *
 * `warp.ts` needs where the drawing starts and how long it runs in SCREENPLAY
 * seconds to work out where each band begins. Exported from here because this is
 * the module that already reads the synced screenplay; a second `find` somewhere
 * else is a second thing to be wrong.
 */
export const DRAW_PLAN_BEAT: { at: number; dur: number } | null = drawBeat
  ? { at: drawBeat.at, dur: drawBeat.dur }
  : null;

/**
 * Where each layer band starts, as a fraction of the drawing beat.
 *
 * ⚠ A COPY of `replica/at.ts` § BAND_WINDOWS' start values, and it is a copy
 * because that table is inside a one-way synced file with no export. If the
 * product re-phases its bands this drifts silently — which is why
 * `verify:bars` asserts each pinned band actually starts where it was pinned,
 * rather than trusting this list.
 */
export const BAND_WINDOWS_FOR_WARP: readonly (readonly [number, number])[] = [
  [0.0, 0.4],
  [0.18, 0.56],
  [0.4, 0.74],
  [0.6, 0.9],
  [0.78, 1.0],
];

/** Which finding the review chapter opens. The screenplay's, not a guess. */
export const OPEN_PIN_INDEX: number =
  openPinBeat && openPinBeat.action.k === "openPin" ? openPinBeat.action.index : 0;

/** Do two closed intervals meet? */
export const overlaps = (a: { from: number; to: number }, b: { from: number; to: number }): boolean =>
  a.from <= b.to && b.from <= a.to;

/** The replica's state partway through its own draw beat, 0..1. */
export const drawState = (p: number): ReplicaState =>
  stateAt(DRAW_BEAT.at + DRAW_BEAT.dur * (p < 0 ? 0 : p > 1 ? 1 : p));

/**
 * How opaque a montage pane is on its first frame.
 *
 * Floored for the same reason `camera.ts` floors `entryOpacity`: a pane that
 * starts at 0 gives the montage one blank frame per slot, which reads as a
 * dropped frame rather than as an entrance. Exported so
 * `capture/verify-opening.mjs` checks the number the component actually uses.
 */
export const MONTAGE_PANE_ENTRY_FLOOR = 0.72;

/** `[minX, minY, width, height]` of a montage plan's viewBox. */
export const montageViewBox = (plan: MontagePlan): [number, number, number, number] => {
  const p = plan.viewBox.trim().split(/[\s,]+/).map(Number);
  if (p.length < 4 || p.some((n) => !Number.isFinite(n))) return [0, 0, 1, 1];
  return [p[0], p[1], p[2], p[3]];
};

/** The page the replica draws at a screenplay second — for a gate, not a component. */
export const pageAt = (t: number): PlanPage | null => {
  const s = stateAt(t);
  return PAGES[`${s.plan.variant}:${s.plan.page}`] ?? PAGES[`${s.plan.variant}:0`] ?? null;
};
