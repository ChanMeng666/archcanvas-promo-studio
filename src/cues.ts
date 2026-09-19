/**
 * The cue sheet, DERIVED from the picture rather than typed against it.
 *
 * **React-free.** `capture/verify-audio.mjs` bundles this and checks the real
 * sheets in Node — the same sheets the film mounts.
 *
 * ── Why nothing here is a hand-placed timestamp ────────────────────────────
 *
 * A key click is a key click because a character appeared. A tick is a tick
 * because the slider stepped onto another baked variant. A pin drop is a pin
 * drop because that pin landed. So the sheet is built by WALKING the cut frame
 * by frame, asking `at(screenplay, t)` what the product looks like, and emitting
 * a cue wherever something actually changed.
 *
 * The alternative — a table of seconds — is a table that stops describing the
 * picture the first time a beat moves, silently, in exactly the way a viewer
 * hears and cannot name. And it is not a hypothetical here: the same 35 seconds
 * of screenplay run at 2.50x in the 15 s cut and 0.46x in the 120 s one, so a
 * timestamp that fitted one cut would be wrong in the other three by
 * construction. Derived, all four are right, and re-cutting the film re-cuts the
 * sound with it.
 *
 * ── The one thing that is a judgement and not a derivation ─────────────────
 *
 * How many key clicks per second. At the 15 s cut's warp the brief types at
 * about 40 characters a second, and forty transients a second is not typing —
 * it is a buzz. `MAX_KEYS_PER_SEC` thins them, keeping the FIRST of each run so
 * the attack still lands with the character. 14 is where a fast typist actually
 * sits.
 */

import { sfx, type Cue, type CueSheet, type SfxId } from "./audio";
import { SCREENPLAY, stateAt } from "./film-demo";
import type { CutId } from "./layout-core";
import { SCENES } from "./scenes";
import { MOTION } from "./tokens";
import { FPS, TIMELINES, frameToSec, type ResolvedBeat, type ResolvedCut } from "./timeline";

/** The ceiling on typing density, in cues per second. */
export const MAX_KEYS_PER_SEC = 14;

/** No more than this many cues may be sounding at the same instant. */
export const MAX_SIMULTANEOUS = 4;

/** Where a beat maps a local frame onto the screenplay's clock. */
const replicaSecond = (beat: ResolvedBeat, localFrame: number): number | null => {
  if (beat.replicaFrom === undefined || beat.replicaTo === undefined) return null;
  const dur = Math.max(1, beat.durationInFrames);
  const p = Math.min(1, Math.max(0, localFrame / dur));
  return beat.replicaFrom + (beat.replicaTo - beat.replicaFrom) * p;
};

/**
 * Every cue of a cut, in playing order.
 *
 * Walks each beat frame by frame. A `second-brief` beat is skipped by the
 * state-derived half — its window indexes the montage, not the screenplay, so
 * asking the fold about it would answer with the opening frame of the loop and
 * scatter key clicks over a montage nobody is typing into.
 */
export const cuesFor = (cut: CutId): CueSheet => {
  const resolved: ResolvedCut = TIMELINES[cut];
  const out: Cue[] = [];
  const keyTimes: number[] = [];

  for (const beat of resolved.beats) {
    const scene = SCENES[beat.scene];
    const isMontage = beat.scene === "second-brief";

    /* ── the cut itself ─────────────────────────────────────────────────── */

    if (beat.index > 0) {
      // Alternating, so a long cut does not sound like one gesture repeated.
      out.push({ atSec: beat.startSec, sfx: beat.index % 2 === 0 ? "whoosh-in" : "whoosh-out", gainDb: -7 });
    }
    if (scene.kind === "card" || scene.kind === "endcard") {
      out.push({ atSec: beat.startSec + 0.04, sfx: "pop", gainDb: -5 });
    } else if (scene.chapter) {
      // The chapter chip popping in.
      out.push({ atSec: beat.startSec + 0.05, sfx: "pop", gainDb: -11 });
    }
    if (scene.kind === "endcard") {
      // The plum band crossing, and the mark landing behind it.
      out.push({ atSec: beat.startSec + MOTION.wipeSec * 0.55, sfx: "end-hit", gainDb: -1 });
    }

    if (isMontage) {
      // Four plans, each drawing itself: a pencil line per plan, on its entrance.
      const slots = Math.max(1, Math.round((beat.replicaTo ?? 0) - (beat.replicaFrom ?? 0)));
      for (let i = 0; i < slots; i += 1) {
        const at = beat.startSec + (beat.durationSec / slots) * (i + 0.18);
        out.push({ atSec: at, sfx: "pencil-line", gainDb: -8 });
        out.push({ atSec: at + beat.durationSec / slots * 0.62, sfx: "paper-settle", gainDb: -13 });
      }
      continue;
    }

    if (beat.replicaFrom === undefined) continue;

    /* ── what the product is doing, frame by frame ──────────────────────── */

    /**
     * ⚠ Seeded from the beat's FIRST frame, never from zero.
     *
     * Seeded from zero, every one of these fires on the first frame of every
     * later beat: the 30 s cut's render beat opens with all three review pins
     * already down, so a zero-seeded `prevPins` read three pins landing and
     * dropped three pin cues on top of the cut — six pin drops in a film with
     * three pins, all at the wrong moments. A cue is a CHANGE, so the state
     * before the change has to be the state the beat actually starts in.
     */
    const seed = stateAt(replicaSecond(beat, 0) ?? 0);
    let prevTyped = seed.composer.text.length + seed.command.text.length;
    let prevPressed = seed.cursor.pressed;
    let prevVariant: string | null = seed.tweaks.open > 0.3 ? seed.tweaks.activeVariant : null;
    let prevPins: readonly number[] = seed.review.pinsDropped;
    let prevRendering = seed.rendering.p;
    let prevToast = seed.toast.p;
    let prevDrawn = seed.plan.bands[4] ?? 0;
    let lastPencil = -Infinity;

    for (let f = 1; f < beat.durationInFrames; f += 1) {
      const t = replicaSecond(beat, f);
      if (t === null) break;
      const s = stateAt(t);
      const atSec = beat.startSec + frameToSec(f);

      // typing — the composer in Act I, the command bar in Act II
      const typed = s.composer.text.length + s.command.text.length;
      if (typed > prevTyped) keyTimes.push(atSec);
      prevTyped = typed;

      // the pointer going down
      if (s.cursor.pressed && !prevPressed) out.push({ atSec, sfx: "click", gainDb: -6 });
      prevPressed = s.cursor.pressed;

      // the drawing, while any band is still running
      const drawing = s.plan.bands.some((b) => b > 0.001 && b < 0.999);
      if (drawing && atSec - lastPencil >= PENCIL_GAP_SEC) {
        out.push({ atSec, sfx: "pencil-line", gainDb: -9 });
        lastPencil = atSec;
      }
      const drawn = s.plan.bands[4] ?? 0;
      if (prevDrawn < 0.995 && drawn >= 0.995) out.push({ atSec, sfx: "paper-settle", gainDb: -9 });
      prevDrawn = drawn;

      // the slider stepping onto another baked variant
      if (s.tweaks.open > 0.3 && s.tweaks.activeVariant && s.tweaks.activeVariant !== prevVariant) {
        if (prevVariant !== null) out.push({ atSec, sfx: "tick", gainDb: -8 });
        prevVariant = s.tweaks.activeVariant;
      }

      // the pins landing, one cue each
      for (let i = 0; i < s.review.pinsDropped.length; i += 1) {
        const now = s.review.pinsDropped[i] ?? 0;
        const was = prevPins[i] ?? 0;
        if (was < 0.5 && now >= 0.5) out.push({ atSec, sfx: "pin-drop", gainDb: -5 });
      }
      prevPins = s.review.pinsDropped;

      // the rendering arriving, and the toast stamping
      if (prevRendering < 0.02 && s.rendering.p >= 0.02) out.push({ atSec, sfx: "shimmer", gainDb: -4 });
      prevRendering = s.rendering.p;
      if (prevToast < 0.05 && s.toast.p >= 0.05) out.push({ atSec, sfx: "stamp", gainDb: -4 });
      prevToast = s.toast.p;
    }
  }

  out.push(...thin(keyTimes));

  return out
    .filter((c) => c.atSec >= 0 && c.atSec < resolved.totalSeconds)
    .sort((a, b) => a.atSec - b.atSec);
};

/** How often a pencil line may sound while the plan draws. */
const PENCIL_GAP_SEC = 0.42;

/**
 * Thin a run of character times down to `MAX_KEYS_PER_SEC`, cycling the three
 * key variants.
 *
 * Keeps the FIRST of each run rather than every nth character: at a 2.5x warp
 * the nth-character rule lands a cue on whichever character happened to be nth,
 * which drifts against the visible text. Keeping the first of each window keeps
 * the attack on the moment a character appeared, and drops the ones the ear
 * could not have separated anyway.
 *
 * One sample fired forty times is a machine gun — the ear locks onto an
 * identical transient at an even interval within three or four hits. Three
 * variants is enough to break it.
 */
const thin = (times: readonly number[]): Cue[] => {
  const keys: SfxId[] = ["key-1", "key-2", "key-3"];
  const gap = 1 / MAX_KEYS_PER_SEC;
  const out: Cue[] = [];
  let last = -Infinity;
  for (const t of times) {
    if (t - last < gap) continue;
    last = t;
    out.push({ atSec: t, sfx: keys[out.length % keys.length], gainDb: -9 });
  }
  return out;
};

/* ── what a gate checks ───────────────────────────────────────────────────── */

export interface CueProblem {
  cut: CutId;
  kind: "unknown-cue" | "past-end" | "negative" | "too-dense";
  detail: string;
}

/**
 * Every complaint a gate can make about a sheet without decoding a file.
 *
 * The density rule is the one worth having: nothing about the derivation stops
 * four gestures landing on the same frame, and four transients at once is not
 * four sounds — it is a click. `MAX_SIMULTANEOUS` is checked against real
 * overlap, using each cue's own measured duration from `sfx.json`.
 */
export const cueProblems = (cut: CutId): readonly CueProblem[] => {
  const problems: CueProblem[] = [];
  const total = TIMELINES[cut].totalSeconds;
  const sheet = cuesFor(cut);

  const live: number[] = [];
  for (const cue of sheet) {
    let dur = 0;
    try {
      dur = sfx(cue.sfx).durationSec;
    } catch {
      problems.push({ cut, kind: "unknown-cue", detail: `"${cue.sfx}" is not in sfx.json` });
      continue;
    }
    if (cue.atSec < 0) {
      problems.push({ cut, kind: "negative", detail: `"${cue.sfx}" at ${cue.atSec.toFixed(3)}s` });
    }
    if (cue.atSec >= total) {
      problems.push({
        cut,
        kind: "past-end",
        detail: `"${cue.sfx}" at ${cue.atSec.toFixed(3)}s, past the ${total.toFixed(2)}s end`,
      });
    }
    while (live.length > 0 && live[0] <= cue.atSec) live.shift();
    live.push(cue.atSec + dur);
    live.sort((a, b) => a - b);
    if (live.length > MAX_SIMULTANEOUS) {
      problems.push({
        cut,
        kind: "too-dense",
        detail: `${live.length} cues sounding at ${cue.atSec.toFixed(3)}s (ceiling ${MAX_SIMULTANEOUS}) — the last is "${cue.sfx}"`,
      });
    }
  }
  return problems;
};

/** A printable sheet, for the gate's output. */
export const describeCues = (cut: CutId): string => {
  const sheet = cuesFor(cut);
  const byId = new Map<string, number>();
  for (const c of sheet) byId.set(c.sfx, (byId.get(c.sfx) ?? 0) + 1);
  const rows = [...byId.entries()].sort((a, b) => b[1] - a[1]);
  return (
    `  cut ${cut}s  ${sheet.length} cue(s) over ${TIMELINES[cut].totalSeconds.toFixed(2)}s ` +
    `(${(sheet.length / Math.max(1, TIMELINES[cut].totalSeconds)).toFixed(2)}/s)\n` +
    rows.map(([id, n]) => `      ${id.padEnd(13)} ${String(n).padStart(4)}`).join("\n")
  );
};

/** The screenplay the sheets were derived against — printed so a gate can say so. */
export const SCREENPLAY_SECONDS = SCREENPLAY.durationSec;
export { FPS };
