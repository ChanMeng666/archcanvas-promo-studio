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
 * ── WHEN here, WHAT and HOW LOUD in the role manifest ──────────────────────
 *
 * Every cue below names a **role** and sometimes an **intent** — `appear`/`pin`,
 * `click`/`step`, `move`/`in`. `src/data/sfx-roles.json` maps those onto files
 * and levels **per sound set and per music take**, so this file plays unchanged
 * with `synth` and with `elevenlabs-audition`, and re-choosing the sound design
 * cannot move a cue by a frame.
 *
 * A `gainDb` here is a **trim on top of** the role's level, for when one
 * instance sits further back than its siblings — the chapter chip is the same
 * `appear`/`card` sound as a full-bleed card, six decibels down. It is not a
 * place to set a palette's level; that is the manifest's job, where it stays
 * decided.
 *
 * ── The drawing is ONE texture, not a retrigger ────────────────────────────
 *
 * The plan drawing itself out is the money shot, and it used to be sounded by
 * re-firing a `pencil-line` every `PENCIL_GAP_SEC`. That is a stutter with a
 * gap in it for the synthesised palette and, for a vendor set whose drawing cue
 * is a 7.69 s BED, it was one copy that ran 2.1 s past the beat it belonged to.
 * Now the beat gets ONE continuous base: anchored on the first stroke's film
 * second, looped with an equal-power crossfade if the beat outlasts the sample,
 * and faded out at the beat's end. In edit B it also gets a light `tick` on each
 * band's downbeat — the warp's own knots, so the punctuation cannot drift from
 * the bars the bands were pinned to.
 *
 * ── The one thing that is a judgement and not a derivation ─────────────────
 *
 * How many key clicks per second. At the 15 s cut's warp the brief types at
 * about 40 characters a second, and forty transients a second is not typing —
 * it is a buzz. `MAX_KEYS_PER_SEC` thins them, keeping the FIRST of each run so
 * the attack still lands with the character. 14 is where a fast typist actually
 * sits.
 */

import {
  BAND_INTENT,
  MUSIC_VERSION,
  endCueSuppressed,
  resolveCue,
  roleCue,
  roleView,
  type Cue,
  type CueSheet,
} from "./audio";
import { SCREENPLAY, stateAt } from "./film-demo";
import type { CutId } from "./layout-core";
import { SCENES } from "./scenes";
import { MOTION } from "./tokens";
import { EDIT_ID } from "./version";
import { FPS, TIMELINES, endcardStartSec, frameToSec, replicaSecondFor, type ResolvedBeat, type ResolvedCut } from "./timeline";

/** The ceiling on typing density, in cues per second. */
export const MAX_KEYS_PER_SEC = 14;

/** No more than this many cues may be sounding at the same instant. */
export const MAX_SIMULTANEOUS = 4;

/**
 * A band is being drawn when it is neither untouched nor finished.
 *
 * The same test the old per-frame pencil retrigger used, kept because it is the
 * product's own answer to "is the pen moving?" rather than a time window
 * somebody wrote down.
 */
const isDrawing = (bands: readonly number[]): boolean =>
  bands.some((b) => b > 0.0005 && b < 0.9995);

/** Where a beat maps a local frame onto the screenplay's clock. */
const replicaSecond = (beat: ResolvedBeat, localFrame: number): number | null => {
  if (beat.replicaFrom === undefined || beat.replicaTo === undefined) return null;
  const dur = Math.max(1, beat.durationInFrames);
  const p = Math.min(1, Math.max(0, localFrame / dur));
  // The SAME map the picture uses. See `timeline.ts` § replicaSecondFor.
  return replicaSecondFor(beat, p);
};

/**
 * One continuous drawing texture over `fromSec`..`toSec`.
 *
 * The sample is usually not the length of the beat, in either direction, and
 * both directions are handled here rather than by hoping: a longer beat gets
 * more copies, each crossfaded into the last by the role manifest's own
 * `loop.crossfadeSec`, and a shorter one gets a single copy trimmed to the beat.
 * Either way the last copy fades out so the drawing sound stops when the drawing
 * does.
 *
 * ⚠ Equal-power, and `audio.ts` § `cueGainAt` is where that lives: two linear
 * crossfades sum to a dip at the seam, which on a dense texture is audible as a
 * pulse at exactly the loop period — the one artefact a loop is for hiding.
 */
const drawBaseCues = (fromSec: number, toSec: number, trimDb = 0): Cue[] => {
  const total = toSec - fromSec;
  if (!(total > 0)) return [];
  const { durationSec: len } = roleCue("draw", { music: MUSIC_VERSION });
  const view = roleView("draw");
  const crossfade = Math.min(view.loop?.crossfadeSec ?? 0, len / 3);
  const fadeOut = Math.min(view.fadeOutSec ?? 0, len);
  // A step that does not advance is an infinite loop wearing a crossfade.
  const step = Math.max(len - crossfade, len * 0.5, 1 / FPS);

  const out: Cue[] = [];
  let at = fromSec;
  let i = 0;
  while (at < toSec - 1e-6 && i < 64) {
    const remaining = toSec - at;
    const playSec = Math.min(len, remaining);
    const isLast = playSec >= remaining - 1e-6;
    out.push({
      atSec: at,
      role: "draw",
      gainDb: trimDb,
      playSec,
      fadeInSec: i > 0 ? crossfade : 0,
      fadeOutSec: isLast ? Math.min(fadeOut, playSec) : crossfade,
      note: out.length === 0 ? "the drawing base, on the first stroke" : `loop ${i}`,
    });
    if (isLast) break;
    at += step;
    i += 1;
  }
  return out;
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
      out.push({ atSec: beat.startSec, role: "move", intent: beat.index % 2 === 0 ? "in" : "out" });
    }
    if (scene.kind === "card" || scene.kind === "endcard") {
      out.push({ atSec: beat.startSec + 0.04, role: "appear", intent: "card" });
    } else if (scene.chapter) {
      // The chapter chip popping in — the same sound as a card, further back.
      out.push({ atSec: beat.startSec + 0.05, role: "appear", intent: "card", gainDb: -6 });
    }
    if (scene.kind === "endcard") {
      /*
       * The plum band crossing, and the mark landing behind it — unless the
       * music is already landing there.
       *
       * ⚠ Suppression is the role manifest's rule and this is the first thing
       * that reads it. Measured at 160–200 ms on version A's long cuts: two
       * impacts that close read as one stumble rather than two events, and the
       * take's own resolution is the better of the two.
       */
      const cardAt = endcardStartSec(cut) ?? beat.startSec;
      if (!endCueSuppressed(MUSIC_VERSION, cut, cardAt)) {
        out.push({ atSec: beat.startSec + MOTION.wipeSec * 0.55, role: "end" });
      }
    }

    if (isMontage) {
      // Four plans, each drawing itself: one drawing texture per plan, over its
      // own slot, and the sheet settling as it lands.
      const slots = Math.max(1, Math.round((beat.replicaTo ?? 0) - (beat.replicaFrom ?? 0)));
      const slotSec = beat.durationSec / slots;
      for (let i = 0; i < slots; i += 1) {
        const at = beat.startSec + slotSec * (i + 0.18);
        // A montage pane is a thumbnail of a drawing, not the money shot: one
        // decibel back from the drawing role, and trimmed to its own slot so
        // four panes cannot stack four copies of a seven-second bed.
        out.push(...drawBaseCues(at, Math.min(beat.endSec, at + slotSec * 0.72), +1));
        out.push({ atSec: at + slotSec * 0.62, role: "appear", intent: "sheet", gainDb: -4 });
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
    // The first frame of this beat on which the pen is moving. -1 = never.
    let firstDrawFrame = isDrawing(seed.plan.bands) ? 0 : -1;

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
      if (s.cursor.pressed && !prevPressed) out.push({ atSec, role: "click", intent: "button" });
      prevPressed = s.cursor.pressed;

      // the drawing — noted here, sounded once, below
      if (firstDrawFrame < 0 && isDrawing(s.plan.bands)) firstDrawFrame = f;
      const drawn = s.plan.bands[4] ?? 0;
      if (prevDrawn < 0.995 && drawn >= 0.995) out.push({ atSec, role: "appear", intent: "sheet" });
      prevDrawn = drawn;

      // the slider stepping onto another baked variant
      if (s.tweaks.open > 0.3 && s.tweaks.activeVariant && s.tweaks.activeVariant !== prevVariant) {
        if (prevVariant !== null) out.push({ atSec, role: "click", intent: "step" });
        prevVariant = s.tweaks.activeVariant;
      }

      // the pins landing, one cue each
      for (let i = 0; i < s.review.pinsDropped.length; i += 1) {
        const now = s.review.pinsDropped[i] ?? 0;
        const was = prevPins[i] ?? 0;
        if (was < 0.5 && now >= 0.5) out.push({ atSec, role: "appear", intent: "pin" });
      }
      prevPins = s.review.pinsDropped;

      // the rendering arriving, and the toast stamping
      if (prevRendering < 0.02 && s.rendering.p >= 0.02) out.push({ atSec, role: "appear", intent: "render" });
      prevRendering = s.rendering.p;
      if (prevToast < 0.05 && s.toast.p >= 0.05) out.push({ atSec, role: "appear", intent: "confirm" });
      prevToast = s.toast.p;
    }

    /* ── the drawing: one base under the beat, and B's band ticks ───────── */

    if (firstDrawFrame >= 0) {
      /*
       * ⚠ The base covers the BEAT, not the strokes.
       *
       * It starts on the first stroke — anything earlier is a drawing sound
       * over a sheet nobody has touched — and it runs to the beat's end rather
       * than to the last stroke, because the last band finishing and the cut
       * are a beat apart and silence in between reads as a dropped track. The
       * role manifest's `fadeOutSec` takes it out.
       */
      const from = beat.startSec + frameToSec(firstDrawFrame);
      out.push(...drawBaseCues(from, beat.endSec));

      /*
       * Edit B only, and the times are the warp's OWN knots.
       *
       * `warp.ts` pins each band's first stroke to a measured downbeat and
       * `timeline.ts` hangs the knots on the beat; the interior knots — all but
       * the two endpoints, which are the beat's own edges — are those pins. Any
       * other source for these times could drift from the picture by a frame,
       * and a tick that lands where the stroke is not is worse than no tick.
       */
      if (EDIT_ID === "B") {
        for (const knot of beat.warpKnots.slice(1, -1)) {
          out.push({ atSec: knot.film, role: "draw", intent: BAND_INTENT, note: "band downbeat" });
        }
      }
    }
  }

  out.push(...thin(keyTimes));

  return out
    .filter((c) => c.atSec >= 0 && c.atSec < resolved.totalSeconds)
    .sort((a, b) => a.atSec - b.atSec);
};

/**
 * Thin a run of character times down to `MAX_KEYS_PER_SEC`, cycling the role's
 * typing variants.
 *
 * Keeps the FIRST of each run rather than every nth character: at a 2.5x warp
 * the nth-character rule lands a cue on whichever character happened to be nth,
 * which drifts against the visible text. Keeping the first of each window keeps
 * the attack on the moment a character appeared, and drops the ones the ear
 * could not have separated anyway.
 *
 * One sample fired forty times is a machine gun — the ear locks onto an
 * identical transient at an even interval within three or four hits. `nth`
 * rotates the role's variants, of which the synthesised set has three single
 * presses and the ElevenLabs set four multi-key clusters.
 */
const thin = (times: readonly number[]): Cue[] => {
  /*
   * Three floors, and the widest wins.
   *
   * `MAX_KEYS_PER_SEC` is the judgement about what typing sounds like.
   * `minGapSec` is the role manifest's musical preference. The third is
   * physical and derived: a sample must never be re-triggered before it has
   * finished. That constant was chosen against the synthesised set, whose key
   * cues are ~70 ms; the ElevenLabs set maps the same role onto CLUSTERS of
   * 1.36–1.92 s — four to seven keystrokes already inside one file — and firing
   * those at the old rate stacked five to seven of them, which `verify:audio`
   * reported as 261 `too-dense` violations across the four cuts.
   */
  const variants = roleView("type").files.length;
  let longest = 0;
  for (let i = 0; i < variants; i += 1) longest = Math.max(longest, roleCue("type", { nth: i }).durationSec);
  const preferred = roleView("type").minGapSec ?? 0;
  const gap = Math.max(1 / MAX_KEYS_PER_SEC, preferred, longest * 0.9);

  const out: Cue[] = [];
  let last = -Infinity;
  for (const t of times) {
    if (t - last < gap) continue;
    last = t;
    out.push({ atSec: t, role: "type", nth: out.length });
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
 * overlap, using each cue's own resolved length.
 *
 * ⚠ The `draw` role is exempt, and deliberately. It is a BED — one continuous
 * texture under the whole beat, with two copies sounding at once for a quarter
 * of a second at each loop seam — so counting it counts the floor the other
 * cues stand on and would fail the money shot for having a floor. The ceiling
 * is about transients piling up.
 */
export const cueProblems = (cut: CutId): readonly CueProblem[] => {
  const problems: CueProblem[] = [];
  const total = TIMELINES[cut].totalSeconds;
  const sheet = cuesFor(cut);

  const live: number[] = [];
  for (const cue of sheet) {
    let rc;
    try {
      rc = resolveCue(cue);
    } catch (err) {
      problems.push({ cut, kind: "unknown-cue", detail: String((err as Error).message) });
      continue;
    }
    if (rc.startSec < 0) {
      problems.push({ cut, kind: "negative", detail: `"${rc.cueId}" starts at ${rc.startSec.toFixed(3)}s` });
    }
    if (rc.startSec >= total) {
      problems.push({
        cut,
        kind: "past-end",
        detail: `"${rc.cueId}" at ${rc.startSec.toFixed(3)}s, past the ${total.toFixed(2)}s end`,
      });
    }
    if (cue.role === "draw") continue;
    while (live.length > 0 && live[0] <= rc.startSec) live.shift();
    live.push(rc.startSec + rc.playSec);
    live.sort((a, b) => a - b);
    if (live.length > MAX_SIMULTANEOUS) {
      problems.push({
        cut,
        kind: "too-dense",
        detail: `${live.length} cues sounding at ${rc.startSec.toFixed(3)}s (ceiling ${MAX_SIMULTANEOUS}) — the last is "${rc.cueId}"`,
      });
    }
  }
  return problems;
};

/** A printable sheet, for the gate's output. */
export const describeCues = (cut: CutId): string => {
  const sheet = cuesFor(cut);
  const byId = new Map<string, number>();
  for (const c of sheet) {
    const key = `${c.role}${c.intent ? `/${c.intent}` : ""}`;
    byId.set(key, (byId.get(key) ?? 0) + 1);
  }
  const rows = [...byId.entries()].sort((a, b) => b[1] - a[1]);
  return (
    `  cut ${cut}s  ${sheet.length} cue(s) over ${TIMELINES[cut].totalSeconds.toFixed(2)}s ` +
    `(${(sheet.length / Math.max(1, TIMELINES[cut].totalSeconds)).toFixed(2)}/s)\n` +
    rows.map(([id, n]) => `      ${id.padEnd(16)} ${String(n).padStart(4)}`).join("\n")
  );
};

/**
 * The drawing beats of a cut, with what the sheet promised about each one.
 *
 * Exported for `verify:audio`, which has to assert that the base really covers
 * the beat and that every band tick sits on its knot. A gate that recomputed
 * "where is the drawing?" in its own JavaScript would eventually disagree with
 * the sheet, and then it would be certifying its own arithmetic.
 */
export const drawBeatsFor = (
  cut: CutId,
): readonly {
  index: number;
  scene: string;
  startSec: number;
  endSec: number;
  firstStrokeSec: number;
  lastStrokeSec: number;
  knotFilmSec: readonly number[];
}[] => {
  const out: {
    index: number; scene: string; startSec: number; endSec: number;
    firstStrokeSec: number; lastStrokeSec: number; knotFilmSec: readonly number[];
  }[] = [];
  for (const beat of TIMELINES[cut].beats) {
    if (beat.replicaFrom === undefined || beat.scene === "second-brief") continue;
    let first = -1;
    let last = -1;
    for (let f = 0; f < beat.durationInFrames; f += 1) {
      const t = replicaSecond(beat, f);
      if (t === null) break;
      if (!isDrawing(stateAt(t).plan.bands)) continue;
      if (first < 0) first = f;
      last = f;
    }
    if (first < 0) continue;
    out.push({
      index: beat.index,
      scene: beat.scene,
      startSec: beat.startSec,
      endSec: beat.endSec,
      firstStrokeSec: beat.startSec + frameToSec(first),
      lastStrokeSec: beat.startSec + frameToSec(last),
      knotFilmSec: beat.warpKnots.slice(1, -1).map((k) => k.film),
    });
  }
  return out;
};

/** The screenplay the sheets were derived against — printed so a gate can say so. */
export const SCREENPLAY_SECONDS = SCREENPLAY.durationSec;
export { FPS };
