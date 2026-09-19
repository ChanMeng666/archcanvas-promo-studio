/**
 * The derived timeline. **The only file in this repo that does frame
 * arithmetic**, and the only file allowed to contain a frame literal.
 *
 * React-free and Remotion-free: `capture/lib/load-core.mjs` bundles this with
 * esbuild and executes it in Node, so `verify-timeline.mjs` checks the real
 * clock rather than a re-implementation of it. A gate that re-implements what
 * it checks eventually disagrees with it, and then it is worse than no gate.
 *
 * Everything here is derived from two inputs and nothing else:
 *
 *   - `cuts.ts`        — intent in seconds, four edit decision lists
 *   - `layout-core.ts` — FPS and how long each cut is meant to be
 *
 * If an edit does not add up, the shortfall goes into `warnings` and the cut is
 * padded or clipped on its LAST beat rather than silently landing a frame off.
 * Nothing is defaulted in silence: `verify:timeline` fails while `warnings` is
 * non-empty.
 */

import { CUT_IDS, CUT_SECONDS, FPS, type CutId } from "./layout-core";
import { CUTS, type Edit } from "./cuts";
import type { SceneId } from "./scenes";

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

/** Identical to Remotion's `Easing.inOut(Easing.cubic)`. */
export const easeInOutCubic = (t: number): number => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/* ── the derived edit ─────────────────────────────────────────────────────── */

export type TimelineBeat = {
  index: number;
  scene: SceneId;
  edit: Edit;
  startSec: number;
  durationSec: number;
  startFrame: number;
  durationInFrames: number;
  /** Exclusive: the next beat's startFrame. */
  endFrame: number;
  /** The replica window this beat plays, in screenplay seconds, or null. */
  replica: { from: number; to: number } | null;
  /**
   * How fast the replica's clock runs during this beat. 1 is real time, >1 is
   * compressed. Null on a card.
   */
  replicaRate: number | null;
};

export type CutTimeline = {
  cut: CutId;
  beats: readonly TimelineBeat[];
  totalFrames: number;
  totalSeconds: number;
};

const buildCut = (cut: CutId): CutTimeline => {
  const edits = CUTS[cut];
  const target = CUT_SECONDS[cut];
  const targetFrames = framesForCut(cut);

  if (edits.length === 0) {
    warn(`cut "${cut}" has an empty edit decision list — there is nothing to render.`);
  }

  const sum = edits.reduce((n, e) => n + e.sec, 0);
  // Exact, not "close enough". A tenth of a second of drift per cut is how a
  // vertical master ends up a beat short of its music bed.
  if (Math.abs(sum - target) > 1e-9) {
    warn(
      `cut "${cut}" sums to ${sum}s but must be exactly ${target}s (off by ${(sum - target).toFixed(3)}s).`,
    );
  }

  const beats: TimelineBeat[] = [];
  let cursorFrame = 0;
  let cursorSec = 0;

  edits.forEach((edit, index) => {
    const isLast = index === edits.length - 1;
    // Rounding each beat independently can leave the cut a frame over or under.
    // The LAST beat absorbs it, so the composition length is always exact and
    // the discrepancy lands where a single frame is least visible.
    const durationInFrames = isLast
      ? targetFrames - cursorFrame
      : secToFrame(edit.sec);

    if (durationInFrames < 1) {
      warn(
        `cut "${cut}" beat ${index} ("${edit.scene}", ${edit.sec}s) is ${durationInFrames} frames long — it never appears.`,
      );
    }

    const hasWindow = edit.replicaFrom !== undefined && edit.replicaTo !== undefined;
    if (hasWindow && (edit.replicaTo as number) <= (edit.replicaFrom as number)) {
      warn(
        `cut "${cut}" beat ${index} ("${edit.scene}") has replicaFrom ${edit.replicaFrom} >= replicaTo ${edit.replicaTo} — the replica would run backwards.`,
      );
    }

    const replica = hasWindow
      ? { from: edit.replicaFrom as number, to: edit.replicaTo as number }
      : null;

    beats.push({
      index,
      scene: edit.scene,
      edit,
      startSec: cursorSec,
      durationSec: edit.sec,
      startFrame: cursorFrame,
      durationInFrames,
      endFrame: cursorFrame + durationInFrames,
      replica,
      replicaRate: replica && edit.sec > 0 ? (replica.to - replica.from) / edit.sec : null,
    });

    cursorFrame += durationInFrames;
    cursorSec += edit.sec;
  });

  const totalFrames = beats.length > 0 ? beats[beats.length - 1].endFrame : 0;
  if (beats.length > 0 && totalFrames !== targetFrames) {
    warn(`cut "${cut}" derives ${totalFrames} frames but must be ${targetFrames}.`);
  }

  return { cut, beats, totalFrames, totalSeconds: frameToSec(totalFrames) };
};

const built = {} as Record<CutId, CutTimeline>;
for (const id of CUT_IDS) built[id] = buildCut(id);

/** The four derived edits, keyed by cut. */
export const TIMELINES: Readonly<Record<CutId, CutTimeline>> = built;

/** How long a composition runs. `Root.tsx` reads only this. */
export const totalFramesFor = (cut: CutId): number => TIMELINES[cut].totalFrames;

/** Which beat a frame falls in. Clamped at both ends; null on an empty cut. */
export const beatAtFrame = (cut: CutId, frame: number): TimelineBeat | null => {
  const { beats } = TIMELINES[cut];
  if (beats.length === 0) return null;
  for (const b of beats) {
    if (frame < b.endFrame) return b;
  }
  return beats[beats.length - 1];
};

/** 0..1 through a beat. */
export const progressInBeat = (beat: TimelineBeat, frame: number): number =>
  clamp01((frame - beat.startFrame) / Math.max(1, beat.durationInFrames));

/**
 * The replica's own clock at a frame — the whole point of the time warp. Null
 * on a card scene, where there is no replica on screen.
 */
export const replicaTimeAt = (cut: CutId, frame: number): number | null => {
  const beat = beatAtFrame(cut, frame);
  if (!beat || !beat.replica) return null;
  const p = progressInBeat(beat, frame);
  return beat.replica.from + (beat.replica.to - beat.replica.from) * p;
};

/* ── warnings ─────────────────────────────────────────────────────────────── */

/**
 * Every place the derivation fell back or disagreed with intent. Empty is the
 * ship condition, and `verify:timeline` enforces it.
 */
export const warnings: readonly string[] = warningList;

/** A printable derivation, used by load-core.mjs and by the gate's output. */
export const describe = (): string => {
  const out: string[] = [];
  for (const id of CUT_IDS) {
    const t = TIMELINES[id];
    out.push(`  cut ${id}s  ${t.totalFrames} frames  (${t.totalSeconds.toFixed(2)}s @ ${FPS}fps)`);
    out.push(
      "    " +
        ["scene".padEnd(12), "start s".padStart(8), "dur s".padStart(7), "start".padStart(6), "frames".padStart(6), "replica".padStart(14), "rate".padStart(6)].join(" "),
    );
    for (const b of t.beats) {
      out.push(
        "    " +
          [
            b.scene.padEnd(12),
            b.startSec.toFixed(2).padStart(8),
            b.durationSec.toFixed(2).padStart(7),
            String(b.startFrame).padStart(6),
            String(b.durationInFrames).padStart(6),
            (b.replica ? `${b.replica.from}-${b.replica.to}` : "-").padStart(14),
            (b.replicaRate === null ? "-" : `${b.replicaRate.toFixed(2)}x`).padStart(6),
          ].join(" "),
      );
    }
    out.push("");
  }
  return out.join("\n");
};
