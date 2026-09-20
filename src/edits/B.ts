/**
 * EDIT B — re-cut around "Daylight Forward", on the bar grid.
 *
 * ── What is different from A, and why ──────────────────────────────────────
 *
 * A was cut to a track with ONE big arrival, so A holds: long beats, one long
 * push, the drawing as the single event. This take has a dozen small arrivals —
 * eleven sections, eleven fills, five crashes — and cutting it like A would
 * leave the music doing all the moving. **B cuts more and lets the music drive.**
 *
 * Three structural changes:
 *
 * 1. **Claim before proof.** "Get a real, dimensioned floor plan." moves BEFORE
 *    the drawing. In A the card summarises what you just watched; in B it makes
 *    a promise and the plan keeps it, which is the shape of every product film
 *    that works. The card lands on a fill and the first wall stroke lands on the
 *    downbeat where the full arrangement enters.
 * 2. **Every major boundary is a measured downbeat.** Not `bpm × n` — the take
 *    accelerates (125.3 → 128.3 BPM across its length, `music-analysis` §
 *    tempo.drift), so a fixed grid is 1.53 s out by the last bar. The numbers
 *    below are differences between entries in the BED's own measured downbeat
 *    list, and `verify:timeline` checks every one of them to the frame.
 * 3. **Long beats get an internal arc.** A five-second receipt in A is one
 *    camera setup; in B it is three, cut on downbeats: the whole sheet with the
 *    pins landing, a punch-in on the pin, the card readable. A beat that holds
 *    one state for five seconds is a beat that stops being watched.
 *
 * ── Reading time first, bars second ────────────────────────────────────────
 *
 * The bar count of a card is not chosen because two bars is tidy. It is chosen
 * because the line takes about that long to read at the size it is set, and then
 * rounded to whole bars. Where a line would not fit the bars available, the
 * SCENE moved rather than the type shrinking.
 *
 * ── What did NOT change ────────────────────────────────────────────────────
 *
 * Every word. `copy.ts` is the cleared copy and B re-orders it; it does not add
 * to it. Every law holds unchanged: the honesty caption's three continuous
 * seconds, the pill, the violet ceiling, the safe areas.
 */

import type { Edit } from "../cuts";
import { DRAW_HANDOFF_SEC, LOOP_FADE_SEC } from "../honesty";
import type { CutId } from "../layout-core";

/* ── 15 s — the drop ──────────────────────────────────────────────────────── */

/**
 * The 15 s window starts ON the drop (`plan-beds` put its body at 115.56 s), so
 * frame 0 is a lift rather than a fade-in — and the hook card is already
 * composed there, which the opening gate checks.
 *
 * Downbeats: 0.04 1.92 3.75 5.66 7.48 9.40 11.21 13.10.
 *
 * The drafting sheet is the one thing B drops at this length. Fifteen seconds
 * buys a promise, a drawing and a way out; a sheet that says "pass 3 of 4" is
 * the fourth-best of those four things.
 */
const CUT_15: readonly Edit[] = [
  { scene: "hook", sec: 1.92, why: "On the lift. One bar — the card is up at frame 0 and gone on the next downbeat." },
  {
    scene: "brief",
    sec: 1.83,
    replicaFrom: 0,
    replicaTo: 5.5,
    push: 1.14,
    why: "3.01x — the fastest warp in either version. The eye needs to see words appearing, not read them.",
  },
  { scene: "claim-what", sec: 1.91, why: "The promise, one bar, before anything is drawn. @3.75" },
  {
    scene: "draw",
    sec: 3.74,
    replicaFrom: DRAW_HANDOFF_SEC,
    replicaTo: 13,
    push: 1.12,
    why: "0.99x. The first stroke lands on the downbeat at 5.66 and the drawing runs at real time.",
  },
  {
    scene: "export",
    sec: 1.81,
    replicaFrom: 31.5,
    replicaTo: LOOP_FADE_SEC,
    push: 1.04,
    why: "The menu, the DXF row, out. @9.40",
  },
  { scene: "endcard", sec: 3.79, why: "The outro begins at 11.21 and the cadence resolves at 12.52 — the URL locks there." },
];

/* ── 30 s — the spine ─────────────────────────────────────────────────────── */

/**
 * Downbeats: 0.04 1.94 3.89 5.76 7.43 9.24 11.04 12.97 14.88 16.77 18.72 20.39
 * 22.06 23.94 25.89 27.77 29.65.
 *
 * The cut the commander specified by its hooks, resolved against the bed's own
 * list: the crash at 0, the groove thickening at 3.89, the fill at 7.43 under
 * the claim card, **the full arrangement at 9.24 under the first wall stroke**,
 * the fill at 23.94 cutting out of the review.
 */
const CUT_30: readonly Edit[] = [
  { scene: "hook", sec: 1.94, why: "On the crash at 0." },
  {
    scene: "brief",
    sec: 3.82,
    replicaFrom: 0,
    replicaTo: 5.5,
    push: 1.14,
    why: "1.44x. Two bars of typing; the groove thickens at 3.89 halfway through it.",
  },
  {
    scene: "draw",
    sec: 1.67,
    replicaFrom: 5.5,
    replicaTo: DRAW_HANDOFF_SEC,
    fill: 0.8,
    push: 1.02,
    why: "2.28x over the drafting sheet — it is a beat of thinking, not a beat of reading. @5.76",
  },
  { scene: "claim-what", sec: 1.81, why: "The promise, on the fill at 7.43, one bar before the drawing starts." },
  {
    scene: "draw",
    sec: 5.64,
    replicaFrom: DRAW_HANDOFF_SEC,
    replicaTo: 13,
    push: 1.12,
    why: "0.66x — SLOWER than the product. The first stroke is on 9.24, where the full arrangement enters.",
  },
  {
    scene: "edit",
    sec: 3.84,
    replicaFrom: 13,
    replicaTo: 19,
    push: 1.06,
    why: "Select, say it, watch it move. @14.88",
  },
  {
    scene: "receipt",
    sec: 1.67,
    replicaFrom: 23.5,
    replicaTo: 25.4,
    fill: 0.62,
    push: 1.02,
    why: "SETUP 1 of 3 — the whole sheet, the pins landing on it. @18.72",
  },
  {
    scene: "receipt",
    sec: 1.67,
    replicaFrom: 25.4,
    replicaTo: 26.3,
    fill: 0.86,
    push: 1.03,
    why: "SETUP 2 — a punch-in on the pin as it opens. @20.39",
  },
  {
    scene: "receipt",
    sec: 1.88,
    replicaFrom: 26.3,
    replicaTo: 28,
    fill: 0.82,
    push: 1.02,
    why: "SETUP 3 — the card, readable. @22.06",
  },
  {
    scene: "export",
    sec: 1.95,
    replicaFrom: 31.5,
    replicaTo: LOOP_FADE_SEC,
    push: 1.04,
    why: "Out on the fill at 23.94.",
  },
  { scene: "price", sec: 1.88, why: "The money line, one bar. @25.89" },
  { scene: "endcard", sec: 2.23, why: "@27.77 to the cadence." },
];

/* ── 60 s — room to look ──────────────────────────────────────────────────── */

/**
 * Downbeats every ~1.9 s to 59.67. The second half opens on the brightest
 * section (37.33) and the crash at 55.85 cuts to the end card.
 *
 * ⚠ The commander's direction put the brightest section under "tweak →
 * receipt". It is under the RECEIPT's third setup instead — the beat where the
 * finding becomes readable, which is the film's one honest turn and the moment
 * that most wants the lift. The tweak keeps its own two bars before it.
 */
const CUT_60: readonly Edit[] = [
  { scene: "hook", sec: 3.85, why: "Two bars on the crash." },
  {
    scene: "brief",
    sec: 5.35,
    replicaFrom: 0,
    replicaTo: 5.5,
    push: 1.1,
    why: "1.03x — real time. At sixty seconds the brief can be read. @3.89",
  },
  {
    scene: "draw",
    sec: 3.73,
    replicaFrom: 5.5,
    replicaTo: DRAW_HANDOFF_SEC,
    fill: 0.8,
    push: 1.02,
    why: "1.02x over the sheet — the pass lines are readable here. @9.24",
  },
  { scene: "claim-what", sec: 3.8, why: "Two bars for the promise. @12.97" },
  {
    scene: "draw",
    sec: 7.17,
    replicaFrom: DRAW_HANDOFF_SEC,
    replicaTo: 13,
    push: 1.12,
    why: "0.52x. The first stroke is on 16.77 and the drawing takes twice as long as the product needs.",
  },
  { scene: "edit", sec: 5.77, replicaFrom: 13, replicaTo: 19, push: 1.06, why: "@23.94" },
  { scene: "tweak", sec: 3.79, replicaFrom: 19, replicaTo: 23.5, push: 1.05, why: "@29.71" },
  {
    scene: "receipt",
    sec: 1.92,
    replicaFrom: 23.5,
    replicaTo: 25.4,
    fill: 0.62,
    push: 1.02,
    why: "SETUP 1 — the sheet and the pins. @33.50",
  },
  {
    scene: "receipt",
    sec: 1.91,
    replicaFrom: 25.4,
    replicaTo: 26.3,
    fill: 0.86,
    push: 1.03,
    why: "SETUP 2 — the punch-in. @35.42",
  },
  {
    scene: "receipt",
    sec: 3.8,
    replicaFrom: 26.3,
    replicaTo: 28,
    fill: 0.82,
    push: 1.02,
    why: "SETUP 3 — the card, on the brightest section at 37.33.",
  },
  { scene: "storey", sec: 3.8, replicaFrom: 28, replicaTo: 29.8, push: 1.04, why: "@41.13" },
  { scene: "render", sec: 3.53, replicaFrom: 29.8, replicaTo: 31.5, push: 1.04, why: "@44.93" },
  { scene: "export", sec: 3.6, replicaFrom: 31.5, replicaTo: LOOP_FADE_SEC, push: 1.04, why: "@48.46" },
  { scene: "price", sec: 3.79, why: "@52.06, out on the crash at 55.85." },
  { scene: "endcard", sec: 4.15, why: "@55.85" },
];

/* ── 120 s — the arrangement is the structure ─────────────────────────────── */

/**
 * The long cut follows the take's own shape rather than an editor's:
 *
 *   0 – 25.89    the promise, made before anything is drawn
 *   25.89        the drawing, thirteen seconds of it
 *   67.15        **the breakdown — the kick goes out** and the receipt gets the
 *                quiet. The one section of the film that admits what it got
 *                wrong is the one section with no drums under it.
 *   82.11        the groove returns: storeys, rendering, export
 *   97.23        the montage, four other plans, two bars each
 *   112.04       the drop-out: the price line in the quiet
 *   115.83       the lift: the end card, URL locking on the cadence
 */
const CUT_120: readonly Edit[] = [
  { scene: "hook", sec: 5.76, why: "Three bars — the long cut can afford to arrive." },
  {
    scene: "brief",
    sec: 9.12,
    replicaFrom: 0,
    replicaTo: 5.5,
    push: 1.08,
    why: "0.60x — slower than real. Someone typing, at the speed someone types. @5.76",
  },
  {
    scene: "draw",
    sec: 5.51,
    replicaFrom: 5.5,
    replicaTo: DRAW_HANDOFF_SEC,
    fill: 0.8,
    push: 1.02,
    why: "0.69x over the sheet. @14.88",
  },
  { scene: "claim-what", sec: 5.5, why: "Three bars. The promise, held. @20.39" },
  {
    scene: "draw",
    sec: 13.32,
    replicaFrom: DRAW_HANDOFF_SEC,
    replicaTo: 13,
    push: 1.14,
    why: "0.28x — the slowest the drawing runs in either version. First stroke on 25.89.",
  },
  { scene: "edit", sec: 9.25, replicaFrom: 13, replicaTo: 19, push: 1.06, why: "@39.21" },
  { scene: "tweak", sec: 9.27, replicaFrom: 19, replicaTo: 23.5, push: 1.05, why: "@48.46" },
  {
    scene: "receipt",
    sec: 5.69,
    replicaFrom: 23.5,
    replicaTo: 25.0,
    fill: 0.62,
    push: 1.02,
    why: "SETUP 1 — the sheet and the pins, still over the groove. @57.73",
  },
  {
    scene: "receipt",
    sec: 3.73,
    replicaFrom: 25.0,
    replicaTo: 25.4,
    fill: 0.7,
    push: 1.03,
    why: "SETUP 2 — closing in as the last pin lands. @63.42",
  },
  {
    scene: "receipt",
    sec: 5.43,
    replicaFrom: 25.4,
    replicaTo: 26.3,
    fill: 0.86,
    push: 1.03,
    why: "SETUP 3 — the punch-in, ON the kick going out at 67.15. The breakdown starts here.",
  },
  {
    scene: "receipt",
    sec: 9.53,
    replicaFrom: 26.3,
    replicaTo: 28,
    fill: 0.82,
    push: 1.02,
    why: "SETUP 4 — the card, readable, in the quietest part of the take. @72.58",
  },
  { scene: "storey", sec: 5.76, replicaFrom: 28, replicaTo: 29.8, push: 1.04, why: "The groove returns at 82.11." },
  { scene: "render", sec: 5.62, replicaFrom: 29.8, replicaTo: 31.5, push: 1.04, why: "@87.87" },
  { scene: "export", sec: 5.61, replicaFrom: 31.5, replicaTo: LOOP_FADE_SEC, push: 1.04, why: "@93.49" },
  {
    scene: "second-brief",
    sec: 3.75,
    replicaFrom: 0,
    replicaTo: 1,
    push: 1,
    why: "ONE plan per pane, two bars each — a different brief and a different layout every time. @97.23",
  },
  { scene: "second-brief", sec: 3.73, replicaFrom: 1, replicaTo: 2, push: 1, why: "@100.98" },
  { scene: "second-brief", sec: 3.7, replicaFrom: 2, replicaTo: 3, push: 1, why: "@104.71" },
  { scene: "second-brief", sec: 3.63, replicaFrom: 3, replicaTo: 4, push: 1, why: "@108.41" },
  { scene: "price", sec: 3.79, why: "The drop-out at 112.04 — the money line in the quiet." },
  { scene: "endcard", sec: 4.17, why: "The lift at 115.83, and the cadence takes it out." },
];

/** The four edits. `timeline.ts` checks each sums to its cut length. */
export const EDIT_B: Readonly<Record<CutId, readonly Edit[]>> = {
  "15": CUT_15,
  "30": CUT_30,
  "60": CUT_60,
  "120": CUT_120,
};
