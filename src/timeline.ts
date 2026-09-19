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

import { CUT_IDS, CUT_SECONDS, FPS, type CutId } from "./layout-core";
import { CUTS, HONESTY_MIN_SEC, HONESTY_OVERLAY_SEC, type Edit } from "./cuts";
import { DRAW_HANDOFF_SEC } from "./honesty";
import { gridFor } from "./data/music-grid";
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
}

export interface ResolvedCut {
  cut: CutId;
  beats: readonly ResolvedBeat[];
  totalFrames: number;
  totalSeconds: number;
  /** How many boundaries the beat grid actually moved. 0 with no grid. */
  snapped: number;
}

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
export const resolveCut = (cut: CutId, grid?: BeatGrid | null): ResolvedCut => {
  const edits = CUTS[cut];
  const target = CUT_SECONDS[cut];
  const targetFrames = framesForCut(cut);

  if (edits.length === 0) {
    warn(`cut "${cut}" has an empty edit decision list — there is nothing to render.`);
    return { cut, beats: [], totalFrames: 0, totalSeconds: 0, snapped: 0 };
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
    const wanted = snapToDownbeat(bounds[i], grid);
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
      expelsCaption:
        scene.filmCaption === true && win !== null && win.from >= DRAW_HANDOFF_SEC - 1e-9,
      replicaRate: win && durationSec > 0 ? (win.to - win.from) / durationSec : null,
    };
  });

  const totalFrames = beats[beats.length - 1].endFrame;
  if (totalFrames !== targetFrames) {
    warn(`cut "${cut}" derives ${totalFrames} frames but must be ${targetFrames}.`);
  }

  return { cut, beats, totalFrames, totalSeconds: frameToSec(totalFrames), snapped };
};

const built = {} as Record<CutId, ResolvedCut>;
for (const id of CUT_IDS) built[id] = resolveCut(id, gridFor(id));

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
export const honestyWindowFor = (resolved: ResolvedCut): HonestyWindow => {
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
        const from = mapped(vLo);
        const to = mapped(vHi);
        const last = expelled[expelled.length - 1];
        if (last && Math.abs(last.to - from) < 1e-6) last.to = to;
        else expelled.push({ from, to });
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
    return { ...best, sec: naturalSec, source: "replica", naturalSec, hardIn: false, coveredSec: naturalSec };
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
      hardIn: before !== undefined,
      coveredSec: covered,
    };
  }

  if (best) {
    // Short, and nothing expels: the film covers the shortfall AHEAD of the
    // product's own caption, ending where it becomes visible.
    const to = best.from;
    const from = Math.max(0, to - HONESTY_OVERLAY_SEC);
    return { from, to, sec: to - from, source: "film", naturalSec, hardIn: false, coveredSec: to - from + naturalSec };
  }

  const firstReplica = resolved.beats.find((b) => b.replicaFrom !== undefined);
  const from = firstReplica ? firstReplica.startSec : 0;
  const to = Math.min(from + HONESTY_OVERLAY_SEC, resolved.totalSeconds);
  warn(
    `cut "${resolved.cut}" never plays the honesty caption's own beat — the film overlays the whole ${HONESTY_OVERLAY_SEC}s itself.`,
  );
  return { from, to, sec: to - from, source: "film", naturalSec, hardIn: false, coveredSec: to - from };
};

const honestyBuilt = {} as Record<CutId, HonestyWindow>;
for (const id of CUT_IDS) honestyBuilt[id] = honestyWindowFor(TIMELINES[id]);

/** The honesty window per cut, with no beat grid applied. */
export const HONESTY_WINDOWS: Readonly<Record<CutId, HonestyWindow>> = honestyBuilt;

for (const id of CUT_IDS) {
  const h = HONESTY_WINDOWS[id];
  if (h.coveredSec + 1e-9 < HONESTY_MIN_SEC) {
    warn(
      `cut "${id}" keeps the honesty caption on screen for ${h.coveredSec.toFixed(2)}s, under the ${HONESTY_MIN_SEC}s floor.`,
    );
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
