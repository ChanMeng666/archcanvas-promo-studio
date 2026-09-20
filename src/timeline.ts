/**
 * The derived timeline. **The only file in this repo that does frame
 * arithmetic**, and the only file allowed to contain a frame literal.
 *
 * React-free and Remotion-free: `capture/lib/load-core.mjs` bundles this with
 * esbuild and executes it in Node, so `verify-timeline.mjs` checks the real
 * clock rather than a re-implementation of it. A gate that re-implements what
 * it checks eventually disagrees with it, and then it is worse than no gate.
 *
 * Everything here is derived from three inputs and nothing else:
 *
 *   - `cuts.ts`        — intent in seconds, four edit decision lists
 *   - `scenes.ts`      — what a scene is, and the replica window it defaults to
 *   - `layout-core.ts` — FPS and how long each cut is meant to be
 *
 * …plus one OPTIONAL fourth: a beat grid from the music. It is passed in, never
 * imported, so a missing `src/data/music.json` cannot change what the film
 * derives — it only means the boundaries are not snapped yet.
 *
 * If a derivation falls back, the shortfall goes into `warnings` and is never
 * thrown. Nothing is defaulted in silence: `verify:timeline --strict` fails
 * while `warnings` is non-empty.
 */

import { CUT_IDS, CUT_SECONDS, FPS, type Aspect, type CutId } from "./layout-core";
import { CUTS, HONESTY_MIN_SEC, HONESTY_OVERLAY_SEC, type Edit } from "./cuts";
import { DRAFTING_SPAN, DRAW_HANDOFF_SEC } from "./honesty";
import { gridFor } from "./data/music-grid";
import { EDIT_ID } from "./version";
import { drawKnots, replicaSecondAt, type Knot } from "./warp";
import { REPLICA_CAPTION, REPLICA_CAPTION_WINDOW } from "./honesty";
import { CARD_SEC, MAX_STATIC_UI_SEC, SCENES, hasReplica, type SceneId } from "./scenes";

export { FPS };

/* ── warnings collector ───────────────────────────────────────────────────── */

/**
 * Collected here, exported as `warnings`, and never thrown.
 *
 * A derivation that falls back must SAY it fell back. `gavigo-ire-video` shipped
 * at placeholder timing because a catch-block substituted a default and nothing
 * recorded that it had.
 */
const warningList: string[] = [];
const warn = (message: string): void => {
  warningList.push(message);
};

/* ── seconds to frames, and nowhere else ──────────────────────────────────── */

/** The one conversion. Round-half-up, so a beat is never a frame short. */
export const secToFrame = (sec: number): number => Math.round(sec * FPS);

/** The inverse, for anything that wants to think in seconds again. */
export const frameToSec = (frame: number): number => frame / FPS;

/** How many frames a whole cut runs. 450 / 900 / 1800 / 3600 at 30 fps. */
export const framesForCut = (cut: CutId): number => secToFrame(CUT_SECONDS[cut]);

/* ── clamped ramps ────────────────────────────────────────────────────────── */

/**
 * **Always clamp.** Remotion's `interpolate` extrapolates at BOTH ends by
 * default, which is how an opacity reaches 1.4 and a scale goes negative off
 * the end of a beat. Everything in this repo ramps through these two helpers,
 * which cannot extrapolate; where a component reaches for Remotion's
 * `interpolate` directly it must pass `extrapolateLeft` AND `extrapolateRight`
 * as `"clamp"`.
 */
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** A clamped lerp. Remotion's `interpolate` would drag React in here. */
export const ramp = (v: number, a: number, b: number, from: number, to: number): number => {
  if (b === a) return v < a ? from : to;
  return from + (to - from) * clamp01((v - a) / (b - a));
};

/** Identical to Remotion's `Easing.out(Easing.cubic)`, inlined to stay React-free. */
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);

/**
 * Identical to Remotion's `Easing.out(Easing.exp)`.
 *
 * Steeper off the mark than `outCubic` and almost arrived at a third of the way
 * through. It is what a line reveal wants — the eye reads "it moved" and then
 * reads the word — where a push-in wants the gentler cubic, because a camera
 * that snaps is a camera a viewer notices.
 */
export const easeOutExpo = (t: number): number => {
  const x = clamp01(t);
  return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
};

/** Identical to Remotion's `Easing.inOut(Easing.cubic)`. */
export const easeInOutCubic = (t: number): number => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/* ── the music's beat grid ────────────────────────────────────────────────── */

/**
 * What `tools/analyze-music.mjs` writes to `src/data/music.json` (WP-8).
 *
 * **Derived, never hand-placed.** A downbeat table typed by a human is a table
 * that drifts from the file it claims to describe the first time the bed is
 * re-cut, and nothing goes red.
 */
export interface BeatGrid {
  bpm: number;
  /** Where the first downbeat sits in the audio file, in seconds. */
  offsetSec: number;
  /** Every strong beat, in seconds from the start of the bed. Ascending. */
  downbeats: readonly number[];
}

/**
 * Pull a second onto the nearest strong beat, if one is close enough.
 *
 * ±150 ms by default: a cut landing within that of a downbeat reads as ON the
 * downbeat, and one landing further away reads as a deliberate off-beat cut
 * that snapping would destroy. With no grid — which is the state until WP-8
 * lands one — this is the identity function, and that is the honest answer
 * rather than a guessed tempo.
 */
export const snapToDownbeat = (
  sec: number,
  grid: BeatGrid | null | undefined,
  tolerance = 0.15,
): number => {
  if (!grid || grid.downbeats.length === 0) return sec;
  let best = sec;
  let bestDelta = Infinity;
  for (const raw of grid.downbeats) {
    const beat = raw + grid.offsetSec;
    const delta = Math.abs(beat - sec);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = beat;
    }
  }
  return bestDelta <= tolerance ? best : sec;
};

/** No beat may be snapped shorter than this. A quarter-second beat is a flash. */
const MIN_BEAT_SEC = 0.5;

/* ── the resolved edit ────────────────────────────────────────────────────── */

/**
 * One beat of a cut, fully resolved: seconds AND frames, with the scene's
 * defaults folded in so a component needs nothing but this.
 */
export interface ResolvedBeat {
  index: number;
  scene: SceneId;
  /** The scene the cut came FROM, so a beat can wipe the colour it replaces. */
  prevScene: SceneId | null;
  edit: Edit;
  startSec: number;
  endSec: number;
  durationSec: number;
  startFrame: number;
  /** Exclusive: the next beat's `startFrame`. */
  endFrame: number;
  durationInFrames: number;
  /** Start of the replica window, in screenplay seconds. Undefined on a card. */
  replicaFrom?: number;
  /** End of the replica window, in screenplay seconds. Undefined on a card. */
  replicaTo?: number;
  /** Camera push over the beat, end/start scale. 1 holds. */
  push: number;
  /** How much of the frame this beat's subject fills, 0..1. 1 is the wide shot. */
  fill: number;
  /**
   * This beat frames past the product's own honesty caption, and the FILM draws
   * the sentence over it instead.
   *
   * ⚠ Per BEAT, not per scene, and the 9:16 drafting card is why. Expelling the
   * caption raises the scale until it clears the frame — 1.64x in portrait — and
   * the drafting half of the draw chapter wants a scale of about 1. Applied to
   * the whole scene it cropped the drafting card on both sides: "...fting...",
   * "...storey Townhouse". So only the half that is the money shot expels; the
   * half that is the drafting card keeps the product's caption whole, and
   * `honestyWindowFor` runs the film's band over exactly the beats that expel,
   * so the two are never on screen together.
   */
  expelsCaption: boolean;
  /**
   * How fast the replica's clock runs during this beat. 1 is real time, >1 is
   * compressed. Null on a card.
   */
  replicaRate: number | null;
  /** Pinned (film, screenplay) pairs inside a drawing beat. Empty = constant rate. */
  warpKnots: readonly Knot[];
}

export interface ResolvedCut {
  cut: CutId;
  /** Which frame shape this was resolved for — only `expelsCaption` differs. */
  aspect: Aspect;
  beats: readonly ResolvedBeat[];
  totalFrames: number;
  totalSeconds: number;
  /** How many boundaries the beat grid actually moved. 0 with no grid. */
  snapped: number;
}

/**
 * Does this beat frame past the product's own honesty caption?
 *
 * ⚠ PER ASPECT, and two conditions. The second one is what the art-direction
 * review caught; the per-aspect part is what fixing it broke and then fixed.
 *
 * The obvious case is the money shot: framed on the building at 85 % of the
 * frame, the caption is far below the edge, so the film draws the sentence in
 * its own band instead.
 *
 * The case that was missed is the drafting beat. The product's caption sits
 * under the command bar, the drafting sheet sits in the middle of the stage, and
 * at a framing tight enough to make the sheet readable the caption rides UP over
 * the sheet's own text. A caption on top of the interface it is captioning is
 * not "in its designed place" — it is a collision — so any beat that frames the
 * replica closer than `CAPTION_SAFE_FILL` hands the sentence to the film's band
 * too. The band is above the camera; nothing can land on it.
 *
 * Below that fill the shot is wide enough that the replica's own layout holds,
 * and the product says it itself.
 */
const CAPTION_SAFE_FILL: Record<Aspect, number> = {
  /**
   * The replica letterboxes in a 16:9 frame — a 1600 x 1000 design box is 1.60
   * against the frame's 1.78 — so reaching any tight fill costs a real push. The
   * drafting card at 0.85 is a 2.37x shot, and at 2.37 the caption rides up over
   * the sheet's own text.
   */
  landscape: 0.72,
  /**
   * The replica FILLS a 9:16 frame — 1000 x 1333 is 0.75 against 0.56 — so the
   * same fills need no push at all and the replica's own layout holds. Above 1
   * so it never triggers, which is the honest way to say "never here" rather
   * than a number that looks tuned.
   *
   * It matters that this is not simply set to the landscape value: expelling in
   * portrait costs a 1.61x push (the caption sits at 78 % of the design height,
   * and clearing the bottom edge from there is expensive), and at 1.61 the
   * drafting card is 143 % of the frame width. Cropped on both sides — the exact
   * defect the per-beat rule was introduced to fix.
   */
  portrait: 1.01,
};

/** How much of a beat's replica window is spent on the drafting card. */
const draftShare = (win: { from: number; to: number }): number => {
  const lo = Math.max(win.from, DRAFTING_SPAN.from);
  const hi = Math.min(win.to, DRAFTING_SPAN.to);
  const len = win.to - win.from;
  return len > 0 ? Math.max(0, hi - lo) / len : 0;
};

const expels = (
  id: SceneId,
  win: { from: number; to: number } | null,
  fill: number,
  aspect: Aspect,
): boolean => {
  if (SCENES[id].filmCaption !== true || win === null) return false;
  /*
   * ⚠ NOT on the drafting beats, whatever the fill says.
   *
   * The drafting card and the product's caption are both at the bottom of the
   * design box, so a beat that frames the card closely either cuts the caption
   * in half or — once the film takes the sentence over — lands its own band
   * across the card's last two lines. Both were on the contact sheet. The
   * camera frames the card and the caption together instead (`camera.ts` §
   * draftCardBox), which means the product says it itself and the film must not
   * also.
   */
  if (draftShare(win) > 0.5) return false;
  if (win.from >= DRAW_HANDOFF_SEC - 1e-9) return true;
  return fill > CAPTION_SAFE_FILL[aspect] + 1e-9;
};

/** The replica window a beat plays: its own, or the scene's default. */
const windowFor = (edit: Edit): { from: number; to: number } | null => {
  const scene = SCENES[edit.scene];
  const from = edit.replicaFrom ?? scene.defaultReplica?.from;
  const to = edit.replicaTo ?? scene.defaultReplica?.to;
  if (from === undefined || to === undefined) return null;
  return { from, to };
};

/**
 * Turn an edit decision list into frames.
 *
 * **The boundaries are computed, then rounded — not rounded, then summed.**
 * Rounding each beat independently and adding them up leaves a cut a frame over
 * or under, which is how a vertical master ends up a beat short of its music.
 * Here every boundary is an absolute second converted once, the last boundary
 * IS the cut length, and the last beat absorbs whatever the rounding left. That
 * also makes grid snapping safe: a snapped boundary moves two beats and changes
 * no total.
 */
export const resolveCut = (cut: CutId, grid?: BeatGrid | null, aspect: Aspect = "landscape"): ResolvedCut => {
  const edits = CUTS[cut];
  const target = CUT_SECONDS[cut];
  const targetFrames = framesForCut(cut);

  if (edits.length === 0) {
    warn(`cut "${cut}" has an empty edit decision list — there is nothing to render.`);
    return { cut, aspect, beats: [], totalFrames: 0, totalSeconds: 0, snapped: 0 };
  }

  const sum = edits.reduce((n, e) => n + e.sec, 0);
  // Exact, not "close enough". A tenth of a second of drift per cut is how a
  // vertical master ends up a beat short of its music bed.
  if (Math.abs(sum - target) > 1e-9) {
    warn(
      `cut "${cut}" sums to ${sum}s but must be exactly ${target}s (off by ${(sum - target).toFixed(3)}s).`,
    );
  }

  /* boundaries in absolute seconds: n+1 of them, first 0, last the cut length */
  const bounds: number[] = [0];
  for (const e of edits) bounds.push(bounds[bounds.length - 1] + e.sec);
  bounds[bounds.length - 1] = target;

  /* snap the interior boundaries only, and never past a neighbour */
  let snapped = 0;
  for (let i = 1; i < bounds.length - 1; i += 1) {
    // ⚠ Edit B is not snapped. Its boundaries ARE downbeats — every length in
    // `edits/B.ts` is a difference between two entries in the measured list — so
    // the snapper is a second opinion fighting the first; it moved fourteen of
    // B's boundaries the first time it ran. The GRID is still passed in, because
    // the piecewise draw warp needs the same downbeats.
    const wanted = EDIT_ID === "B" ? bounds[i] : snapToDownbeat(bounds[i], grid);
    if (wanted === bounds[i]) continue;
    const floor = bounds[i - 1] + MIN_BEAT_SEC;
    // Every beat after this one still needs room, so the ceiling walks back
    // from the end rather than only looking at the next boundary.
    const ceiling = target - MIN_BEAT_SEC * (bounds.length - 1 - i);
    if (wanted <= floor || wanted >= ceiling) continue;
    bounds[i] = wanted;
    snapped += 1;
  }

  const beats: ResolvedBeat[] = edits.map((edit, index) => {
    const startSec = bounds[index];
    const endSec = bounds[index + 1];
    const isLast = index === edits.length - 1;
    const startFrame = secToFrame(startSec);
    const endFrame = isLast ? targetFrames : secToFrame(endSec);
    const win = windowFor(edit);
    const scene = SCENES[edit.scene];
    const durationSec = endSec - startSec;

    if (hasReplica(edit.scene) && !win) {
      warn(
        `cut "${cut}" beat ${index} ("${edit.scene}") shows the replica but has no window, and its scene declares no default.`,
      );
    }
    if (!hasReplica(edit.scene) && win) {
      warn(`cut "${cut}" beat ${index} ("${edit.scene}") is a card but declares a replica window.`);
    }
    if (win && win.to <= win.from) {
      warn(
        `cut "${cut}" beat ${index} ("${edit.scene}") has replicaFrom ${win.from} >= replicaTo ${win.to} — the replica would run backwards.`,
      );
    }
    if (endFrame - startFrame < 1) {
      warn(
        `cut "${cut}" beat ${index} ("${edit.scene}", ${edit.sec}s) is ${endFrame - startFrame} frames long — it never appears.`,
      );
    }

    return {
      index,
      scene: edit.scene,
      prevScene: index > 0 ? edits[index - 1].scene : null,
      edit,
      startSec,
      endSec,
      durationSec,
      startFrame,
      endFrame,
      durationInFrames: endFrame - startFrame,
      replicaFrom: win?.from,
      replicaTo: win?.to,
      push: edit.push ?? scene.camera?.to ?? 1,
      fill: edit.fill ?? scene.camera?.fill ?? 1,
      expelsCaption: expels(edit.scene, win, edit.fill ?? scene.camera?.fill ?? 1, aspect),
      replicaRate: win && durationSec > 0 ? (win.to - win.from) / durationSec : null,
      /*
       * The piecewise warp, when this beat is the drawing and the edit asks for
       * one. Attached to the BEAT rather than looked up later, because the
       * picture and the sound both read it and they must not disagree by a
       * frame: a tick that lands where the stroke is not is worse than no tick.
       */
      warpKnots:
        EDIT_ID === "B" && win
          ? drawKnots(startSec, endSec, win.from, win.to, grid?.downbeats ?? [])
          : [],
    };
  });

  const totalFrames = beats[beats.length - 1].endFrame;
  if (totalFrames !== targetFrames) {
    warn(`cut "${cut}" derives ${totalFrames} frames but must be ${targetFrames}.`);
  }

  return { cut, aspect, beats, totalFrames, totalSeconds: frameToSec(totalFrames), snapped };
};

/**
 * The beat grid, or NOTHING when the edit was authored on one.
 *
 * ⚠ Both edits get the grid; only A gets SNAPPED to it. B's boundaries already
 * are downbeats, but the piecewise draw warp needs the same measured list to pin
 * its bands to, so withholding the grid from B withheld it from the warp as
 * well — which is how the first version of this produced no knots at all.
 */
const gridForEdit = (id: CutId) => gridFor(id);

const built = {} as Record<CutId, ResolvedCut>;
for (const id of CUT_IDS) built[id] = resolveCut(id, gridForEdit(id));

/**
 * The same four edits resolved for a 9:16 frame.
 *
 * ⚠ Only `expelsCaption` differs, and it has to: expelling the product's caption
 * costs a 1.61x push in portrait and 2.37x is what a landscape drafting shot
 * needs anyway, so the same rule applied to both crops the portrait drafting
 * card on every side. Lengths, boundaries and windows are identical — the gates
 * assert it.
 */
const builtPortrait = {} as Record<CutId, ResolvedCut>;
for (const id of CUT_IDS) builtPortrait[id] = resolveCut(id, gridForEdit(id), "portrait");

/**
 * When the end card starts, in FILM seconds, for the active version's edit.
 *
 * ⚠ Per version × cut, and reachable from the audio side, which is the whole
 * reason it is exported. `audio.ts` suppresses the END cue when it would land
 * within 250 ms of the bed's own final hit, and it needs to know when the end
 * card actually begins to do that — a number that is different in every cut and
 * different again in edit B, where the end card lands on the take's lift at
 * 115.83 s rather than wherever A's seconds happened to add up.
 *
 * `null` when a cut has no end card, which no cut does, but a derived number
 * that cannot say "I do not know" is a derived number that lies.
 */
export const endcardStartSec = (cut: CutId, aspect: Aspect = "landscape"): number | null => {
  const beat = timelineFor(cut, aspect).beats.find((b) => SCENES[b.scene].kind === "endcard");
  return beat ? beat.startSec : null;
};

/**
 * The screenplay second a beat shows at progress `p`. THE entry point.
 *
 * Constant rate unless the beat carries knots, which only a drawing beat in
 * edit B does.
 */
export const replicaSecondFor = (beat: ResolvedBeat, p: number): number =>
  replicaSecondAt(p, beat.startSec, beat.endSec, beat.replicaFrom ?? 0, beat.replicaTo ?? beat.replicaFrom ?? 0, beat.warpKnots);

/** The resolved edit for a frame shape. `Film.tsx` and every gate read this. */
export const timelineFor = (cut: CutId, aspect: Aspect): ResolvedCut =>
  aspect === "portrait" ? builtPortrait[cut] : built[cut];

/**
 * The four derived edits, keyed by cut, WITH the music's bar grid applied.
 *
 * ⚠ One clock. The scaffold snapped in `Film.tsx` and left this un-snapped,
 * which would have left the cue sheet — derived from these beats — describing
 * boundaries a frame or two from where the picture actually cut. Everything now
 * reads this: the compositions' lengths, `beatAtFrame`, the cue sheets, the
 * honesty windows and every gate.
 */
export const TIMELINES: Readonly<Record<CutId, ResolvedCut>> = built;

/** How long a composition runs. `Root.tsx` reads only this. */
export const totalFramesFor = (cut: CutId): number => TIMELINES[cut].totalFrames;

/** Which beat a frame falls in. Clamped at both ends; null on an empty cut. */
export const beatAtFrame = (cut: CutId, frame: number): ResolvedBeat | null => {
  const { beats } = TIMELINES[cut];
  if (beats.length === 0) return null;
  for (const b of beats) {
    if (frame < b.endFrame) return b;
  }
  return beats[beats.length - 1];
};

/**
 * 0..1 through a beat, from a **sequence-local** frame.
 *
 * ⚠ The trap this signature exists to stop. Inside a `<Sequence>`,
 * `useCurrentFrame()` counts from the sequence's own start, not the
 * composition's — the same way `useVideoConfig().durationInFrames` reports the
 * composition's length rather than the sequence's. A helper that subtracted
 * `beat.startFrame` from a local frame would go negative, clamp to 0, and pin
 * the replica's clock to the START of every beat: every push would run, every
 * card would animate, and the product would stand still. It did exactly that,
 * and a single still caught it — `t = 9.30 s` at a frame where the arithmetic
 * says 11.59 — which is the whole argument for the placeholder printing `t`.
 *
 * So: **local frames in a component, absolute frames only in `beatAtFrame`.**
 */
export const progressInBeat = (beat: ResolvedBeat, localFrame: number): number =>
  clamp01(localFrame / Math.max(1, beat.durationInFrames));

/**
 * The replica's own clock at a point inside a beat — the whole point of the
 * time warp. Takes a **sequence-local** frame.
 *
 * Linear and clamped: an eased warp would make a replica beat's duration depend
 * on where in the cut it fell, which is exactly the kind of thing that makes two
 * renders of one frame disagree.
 */
export const replicaTimeIn = (beat: ResolvedBeat, localFrame: number): number | null => {
  if (beat.replicaFrom === undefined || beat.replicaTo === undefined) return null;
  const p = progressInBeat(beat, localFrame);
  return beat.replicaFrom + (beat.replicaTo - beat.replicaFrom) * p;
};

/**
 * The replica's clock at an **absolute** frame of a cut. Null on a card.
 *
 * For a gate, a probe or a still's filename — not for a component, which is
 * inside a `<Sequence>` and only ever sees local frames.
 */
export const replicaTimeAt = (cut: CutId, frame: number): number | null => {
  const beat = beatAtFrame(cut, frame);
  return beat ? replicaTimeIn(beat, frame - beat.startFrame) : null;
};

/* ── the honesty caption ──────────────────────────────────────────────────── */

/**
 * Where the honesty caption is on screen in a cut, in FILM seconds.
 *
 * `source` says who is drawing it. `"replica"` means the time warp left the
 * product's own caption on screen long enough and the film adds nothing;
 * `"film"` means the warp shortened it below the floor and the film overlays
 * the identical sentence in its own band for the whole window.
 *
 * This is DERIVED. The alternative — a hand-typed window per cut — is a number
 * that stops being true the first time a beat moves, and the thing it is
 * protecting is the film's one honesty obligation.
 */
export interface HonestyWindow {
  from: number;
  to: number;
  sec: number;
  source: "replica" | "film";
  /** What the replica's own caption alone would have given, in film seconds. */
  naturalSec: number;
  /**
   * The CONTINUOUS seconds the sentence is on screen from either source — the
   * film's band plus any replica run that abuts it.
   *
   * ⚠ This, not `sec`, is what the floor is about. The band and the product's
   * own caption now hand over on a beat boundary, so measuring the band alone
   * under-counts by exactly the handover: the 15 s cut reads 2.85 s of band and
   * 3.23 s of sentence. `verify:honesty` measures the same quantity frame by
   * frame through the real camera and must agree with this.
   */
  coveredSec: number;
  /**
   * The band appears at FULL opacity rather than fading in.
   *
   * ⚠ True whenever the product's own caption was carrying the sentence up to
   * this second, which is the normal case now: the drafting beat shows the
   * product's caption, the money shot frames past it, and the film's band takes
   * over on the cut between them. A fade there costs a quarter-second in which
   * NEITHER is fully opaque, and the floor is measured on a continuous run — the
   * 15 s cut came out at 2.60 s that way, under the floor, with 3.23 s of caption
   * actually on screen. A hard swap of one identical sentence for another, on a
   * cut where the whole frame changes anyway, is invisible.
   */
  hardIn: boolean;
  /**
   * The band held off until the drafting card had gone.
   *
   * False means it could not: waiting would have taken the sentence under
   * {@link HONESTY_MIN_SEC}, and the obligation outranks the composition.
   */
  bandWaitsForCard: boolean;
}

/**
 * Derive the window from a resolved cut.
 *
 * A "run" is one or more CONSECUTIVE beats of the SAME scene whose mapped
 * caption intervals touch. Two beats of `draw` cut back to back keep the
 * caption up across the cut; a card between them does not, and neither does a
 * jump to another chapter — so the runs are not merged across either, and the
 * longest run is what the floor is measured against.
 */
/**
 * ⚠ TWO derivations, and the floor picks between them.
 *
 * The band must not be drawn over the product's drafting card — see the
 * `expelled` branch below — but waiting for the card costs the start of the
 * band, and on a short money shot that is the difference between clearing the
 * three-second floor and not. A's 15 s cut is the case: its money-shot beat is
 * 3.30 s, the card holds the first 0.45 s of it, and waiting lands the sentence
 * at **2.83 s**.
 *
 * So the priority is stated rather than tuned, and in the only order it can be:
 * the sentence is the film's one mandatory obligation and a composition problem
 * may not spend it. Wait where waiting is affordable — seven of the eight
 * cut-and-edit combinations — and where it is not, the overlap stands and
 * `bandWaitsForCard` says so out loud.
 *
 * It is derived, not tabled: lengthen A's money shot by a fifth of a second and
 * the wait starts applying there too, with nothing to remember.
 */
export const honestyWindowFor = (resolved: ResolvedCut): HonestyWindow => {
  const waited = deriveHonesty(resolved, true);
  if (waited.coveredSec + 1e-9 >= HONESTY_MIN_SEC) return waited;
  return deriveHonesty(resolved, false);
};

const deriveHonesty = (resolved: ResolvedCut, waitForCard: boolean): HonestyWindow => {
  /** Runs in which the replica's OWN caption is fully opaque and on screen. */
  const runs: { from: number; to: number; scene: SceneId }[] = [];
  /**
   * Film-time spans of the beats that frame PAST the product's caption.
   *
   * This is exactly where the film's own band belongs: over the beats where the
   * product is not saying it, and nowhere else. Placing it by the caption's
   * playing span instead would put it on top of the beats that DO show it — the
   * doubling `verify:honesty` fails on.
   */
  const expelled: { from: number; to: number }[] = [];
  /**
   * The band's start was pushed back to let the drafting card leave.
   *
   * ⚠ It implies `hardIn`, and the floor is why. The band fades in over
   * `MOTION.enterSec` unless told not to, the floor counts only FULLY opaque
   * frames, and a delayed band no longer abuts the product's own caption — so
   * the fade came out of the run: B's 15 s cut derived 3.07 s and the gate,
   * which samples what is actually drawn, measured 2.87 s. A fade in from
   * nothing, in the middle of a beat, half a second after a card went away, is
   * not a hand-over anyway; it is a glitch with a ramp on it.
   */
  let delayedForCard = false;

  for (const beat of resolved.beats) {
    if (beat.replicaFrom === undefined || beat.replicaTo === undefined) continue;
    const span = beat.replicaTo - beat.replicaFrom;
    if (span <= 0) continue;

    const mapped = (t: number): number =>
      beat.startSec + ((t - beat.replicaFrom!) / span) * beat.durationSec;

    const vLo = Math.max(beat.replicaFrom, REPLICA_CAPTION.beatAt);
    const vHi = Math.min(beat.replicaTo, REPLICA_CAPTION.beatAt + REPLICA_CAPTION.beatDur);

    if (beat.expelsCaption) {
      if (vHi > vLo) {
        /*
         * ⚠ The band starts at the beat, and the CAMERA is what keeps it off
         * the drafting card — see `camera.ts` § cardProtect.
         *
         * Delaying the band until the card had gone was tried first and is the
         * wrong lever: it is the obvious reading of "never both on screen", it
         * costs the 15 s cuts 0.5–0.8 s, and they fell to **2.39 s and 2.57 s**
         * against the 3.0 s floor. The sentence is the film's one mandatory
         * obligation; a fix for a composition problem may not spend it.
         */
        const cardGone = waitForCard && beat.replicaFrom < DRAFTING_SPAN.to
          ? (() => {
              const dur = Math.max(1, beat.durationInFrames);
              for (let f = 0; f <= dur; f += 1) {
                if (replicaSecondFor(beat, clamp01(f / dur)) >= DRAFTING_SPAN.to) {
                  return beat.startSec + frameToSec(f);
                }
              }
              return beat.endSec;
            })()
          : -Infinity;
        const from = Math.max(mapped(vLo), cardGone);
        if (from > mapped(vLo) + 1e-6) delayedForCard = true;
        // TO THE BEAT'S END, not to the caption beat's window: the product's
        // caption is off frame for the WHOLE of an expelling beat, so there is
        // nothing to double with and nothing to hand back to until the cut.
        const to = beat.endSec;
        if (to - from > 1e-6) {
          const last = expelled[expelled.length - 1];
          if (last && Math.abs(last.to - from) < 1e-6) last.to = to;
          else expelled.push({ from, to });
        }
      }
      continue;
    }

    const lo = Math.max(beat.replicaFrom, REPLICA_CAPTION_WINDOW.from);
    const hi = Math.min(beat.replicaTo, REPLICA_CAPTION_WINDOW.to);
    if (hi <= lo) continue;

    const from = mapped(lo);
    const to = mapped(hi);
    const last = runs[runs.length - 1];
    if (last && last.scene === beat.scene && Math.abs(last.to - from) < 1e-6) last.to = to;
    else runs.push({ from, to, scene: beat.scene });
  }

  const best = runs.reduce<{ from: number; to: number } | null>(
    (acc, r) => (acc === null || r.to - r.from > acc.to - acc.from ? r : acc),
    null,
  );
  const naturalSec = best ? best.to - best.from : 0;

  /*
   * The product alone clears the floor: the film adds nothing. This is the state
   * the 30, 60 and 120 cuts were in before the money shot needed to push past
   * the caption, and it is still reachable — a cut whose draw chapter is not
   * framed that close would land here.
   */
  if (best && naturalSec >= HONESTY_MIN_SEC && expelled.length === 0) {
    return { ...best, sec: naturalSec, source: "replica", naturalSec, hardIn: false, coveredSec: naturalSec, bandWaitsForCard: waitForCard };
  }

  const band = expelled.reduce<{ from: number; to: number } | null>(
    (acc, r) => (acc === null || r.to - r.from > acc.to - acc.from ? r : acc),
    null,
  );

  if (band) {
    // Over the expelling beat, edge to edge. The product's own caption picks up
    // on either side where a neighbouring beat still shows it, and
    // `verify:honesty` measures the union of the two.
    const before = runs.find((r) => Math.abs(r.to - band.from) < 0.05);
    const after = runs.find((r) => Math.abs(r.from - band.to) < 0.05);
    const covered =
      (before ? before.to - before.from : 0) +
      (band.to - band.from) +
      (after ? after.to - after.from : 0);
    return {
      from: band.from,
      to: band.to,
      sec: band.to - band.from,
      source: "film",
      naturalSec,
      hardIn: before !== undefined || delayedForCard,
      coveredSec: covered,
      bandWaitsForCard: waitForCard,
    };
  }

  if (best) {
    // Short, and nothing expels: the film covers the shortfall AHEAD of the
    // product's own caption, ending where it becomes visible.
    const to = best.from;
    const from = Math.max(0, to - HONESTY_OVERLAY_SEC);
    return { from, to, sec: to - from, source: "film", naturalSec, hardIn: false, coveredSec: to - from + naturalSec, bandWaitsForCard: waitForCard };
  }

  const firstReplica = resolved.beats.find((b) => b.replicaFrom !== undefined);
  const from = firstReplica ? firstReplica.startSec : 0;
  const to = Math.min(from + HONESTY_OVERLAY_SEC, resolved.totalSeconds);
  warn(
    `cut "${resolved.cut}" never plays the honesty caption's own beat — the film overlays the whole ${HONESTY_OVERLAY_SEC}s itself.`,
  );
  return { from, to, sec: to - from, source: "film", naturalSec, hardIn: false, coveredSec: to - from, bandWaitsForCard: waitForCard };
};

/**
 * Both derivations of a cut's honesty window: the one that waits for the
 * drafting card, and the one the film actually uses.
 *
 * For `verify:honesty`, so the exception can be checked rather than believed.
 * When the film did NOT wait, the gate asserts that waiting really would have
 * taken the sentence under the floor — an exception that is earned every time
 * it is taken, instead of a standing excuse attached to a red gate.
 */
export const honestyWaitDiagnostic = (
  cut: CutId,
  aspect: Aspect,
): { waited: HonestyWindow; used: HonestyWindow } => {
  const resolved = timelineFor(cut, aspect);
  return { waited: deriveHonesty(resolved, true), used: honestyWindow(cut, aspect) };
};

const honestyBuilt = {} as Record<CutId, HonestyWindow>;
for (const id of CUT_IDS) honestyBuilt[id] = honestyWindowFor(TIMELINES[id]);
const honestyPortrait = {} as Record<CutId, HonestyWindow>;
for (const id of CUT_IDS) honestyPortrait[id] = honestyWindowFor(builtPortrait[id]);

/** The honesty window per cut, landscape. */
export const HONESTY_WINDOWS: Readonly<Record<CutId, HonestyWindow>> = honestyBuilt;

/**
 * The honesty window for a frame shape.
 *
 * It differs between the two, and it must: the band runs over exactly the beats
 * that frame past the product's own caption, and which beats those are depends
 * on the frame shape.
 */
export const honestyWindow = (cut: CutId, aspect: Aspect): HonestyWindow =>
  aspect === "portrait" ? honestyPortrait[cut] : honestyBuilt[cut];

for (const id of CUT_IDS) {
  for (const h of [honestyBuilt[id], honestyPortrait[id]]) {
    if (h.coveredSec + 1e-9 < HONESTY_MIN_SEC) {
      warn(
        `cut "${id}" keeps the honesty caption on screen for ${h.coveredSec.toFixed(2)}s, under the ${HONESTY_MIN_SEC}s floor.`,
      );
    }
  }
}

/* ── pace ─────────────────────────────────────────────────────────────────── */

/** A pace complaint: not a failure on its own, but a thing the gate prints. */
export interface PaceNote {
  cut: CutId;
  index: number;
  scene: SceneId;
  detail: string;
}

/**
 * Where the cut stops being fast and bright.
 *
 * Two rules, both from the brief and both checkable: a full-bleed card holds
 * 1.2–2.2 s, and a replica shot does not run past `MAX_STATIC_UI_SEC` with the
 * camera parked. The end card is exempt — it is the resting frame, not a card.
 */
export const paceNotes = (): readonly PaceNote[] => {
  const notes: PaceNote[] = [];
  for (const cut of CUT_IDS) {
    for (const b of TIMELINES[cut].beats) {
      const kind = SCENES[b.scene].kind;
      if (kind === "card") {
        if (b.durationSec < CARD_SEC.min - 1e-9) {
          notes.push({
            cut,
            index: b.index,
            scene: b.scene,
            detail: `card holds ${b.durationSec.toFixed(2)}s, under the ${CARD_SEC.min}s floor — it cannot be read`,
          });
        }
        if (b.durationSec > CARD_SEC.max + 1e-9) {
          notes.push({
            cut,
            index: b.index,
            scene: b.scene,
            detail: `card holds ${b.durationSec.toFixed(2)}s, over the ${CARD_SEC.max}s ceiling — the cut stops moving`,
          });
        }
      }
      if (hasReplica(b.scene) && b.durationSec > MAX_STATIC_UI_SEC + 1e-9 && b.push === 1) {
        notes.push({
          cut,
          index: b.index,
          scene: b.scene,
          detail: `${b.durationSec.toFixed(2)}s of interface with the camera parked — push in or cut it in two`,
        });
      }
    }
  }
  return notes;
};

/* ── warnings ─────────────────────────────────────────────────────────────── */

/**
 * Every place the derivation fell back or disagreed with intent. Empty is the
 * ship condition, and `verify:timeline --strict` enforces it.
 */
export const warnings: readonly string[] = warningList;

/** A printable derivation, used by load-core.mjs and by the gate's output. */
export const describe = (): string => {
  const out: string[] = [];
  for (const id of CUT_IDS) {
    const t = TIMELINES[id];
    const h = HONESTY_WINDOWS[id];
    out.push(`  cut ${id}s  ${t.totalFrames} frames  (${t.totalSeconds.toFixed(2)}s @ ${FPS}fps)`);
    out.push(
      `    honesty caption ${h.from.toFixed(2)}–${h.to.toFixed(2)}s = ${h.sec.toFixed(2)}s ` +
        `(${h.source}${h.hardIn ? ", hard in" : ""}; the product's own adds ${h.naturalSec.toFixed(2)}s, ` +
        `${h.coveredSec.toFixed(2)}s continuous, floor ${HONESTY_MIN_SEC}s)`,
    );
    out.push(
      "    " +
        [
          "scene".padEnd(13),
          "start s".padStart(8),
          "dur s".padStart(7),
          "start".padStart(6),
          "frames".padStart(6),
          "replica".padStart(13),
          "rate".padStart(7),
          "push".padStart(6),
          "fill".padStart(6),
        ].join(" "),
    );
    for (const b of t.beats) {
      out.push(
        "    " +
          [
            b.scene.padEnd(13),
            b.startSec.toFixed(2).padStart(8),
            b.durationSec.toFixed(2).padStart(7),
            String(b.startFrame).padStart(6),
            String(b.durationInFrames).padStart(6),
            (b.replicaFrom === undefined ? "-" : `${b.replicaFrom}-${b.replicaTo}`).padStart(13),
            (b.replicaRate === null ? "-" : `${b.replicaRate.toFixed(2)}x`).padStart(7),
            (b.push === 1 ? "-" : b.push.toFixed(2)).padStart(6),
            (b.fill === 1 ? "-" : b.fill.toFixed(2)).padStart(6),
          ].join(" "),
      );
    }
    out.push("");
  }
  return out.join("\n");
};
