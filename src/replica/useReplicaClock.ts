"use client";

/**
 * The web host's clock — the ONE file in this directory that reads a clock.
 *
 * Everything else here is a pure function of `t`; this is where `t` comes from
 * in a browser. The film gets its `t` from `frame / fps` and never imports this
 * file, which is why the hook lives beside the thing it drives rather than in
 * the landing tree: one `useReplicaClock` for the section, the preview harness
 * and anything else that wants to play the loop, and exactly one place where a
 * rAF exists. `tests/studioReplicaPurity.test.ts` allows the clock calls and the
 * `"use client"` directive HERE and nowhere else in the directory.
 *
 * ⚠ NOT exported from `index.ts`. The barrel is the contract with the film repo,
 * which has no React Server Components and no `"use client"`; and in this repo a
 * server component that touched the barrel would take a client boundary it did
 * not ask for. Hosts import this file by path.
 *
 * Four properties the section depends on:
 *
 *  • **One rAF.** Not one per chapter, not one per component — a second loop is
 *    how two frames of the same second get painted with different `t`.
 *  • **`dt` is clamped.** A backgrounded tab, a long task or a breakpoint hands
 *    back a delta of seconds; unclamped, the loop teleports through half the
 *    screenplay and the viewer sees a jump cut. `MAX_STEP_SEC` (1/15 s) means a
 *    stall costs at most one slow frame, and the story is still continuous.
 *  • **It stops when nobody is watching.** The host's IntersectionObserver says
 *    `active`, the Page Visibility API says `hidden`, and either one parks the
 *    loop. `playing` stays what the VIEWER set it to, so a tab switch does not
 *    silently turn their pause into a play (or the reverse).
 *  • **It re-renders at most `minStepSec` apart, and backs off further on a slow
 *    machine.** The replica is an 800-node tree; React reconciling it 60 times a
 *    second on a mid-range phone is the one cost this component can actually
 *    feel. 30 fps is indistinguishable for a UI demonstration and halves the
 *    work — and where even that is too much, the loop measures how long frames
 *    are actually taking and paints less often still, so the main thread is
 *    never saturated by a decorative animation. A page whose scrolling stutters
 *    because of a picture of a product is a worse advertisement than no picture.
 *
 * ⚠ None of the throttling touches `t`: it advances with the wall clock whether
 * or not a frame is painted, so a slow machine sees the same story at the same
 * speed in fewer frames. Skipping TIME rather than frames is how a demonstration
 * ends up looking like a different, faster product.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { chapterAt } from "./at";
import type { ChapterId, Screenplay } from "./types";

/** The largest step the loop will take in one frame — see the header. */
export const MAX_STEP_SEC = 1 / 15;

/** How often the clock is allowed to re-render its consumer, at best. */
export const DEFAULT_MIN_STEP_SEC = 1 / 30;

/**
 * How much of a frame the replica may take before the clock starts skipping.
 *
 * The loop keeps a rolling average of the delta rAF hands it — which IS the cost
 * of the last frame, this animation included — and refuses to paint again until
 * at least that much screenplay time has passed. On a machine holding 60 Hz the
 * average is 16.7 ms, below the 33 ms cap, and this does nothing at all. On one
 * where a frame costs 100 ms it settles at roughly a 50 % duty cycle, which
 * leaves the main thread half free for the things a reader actually did ask for.
 */
const LOAD_SMOOTHING = 0.2;

/**
 * The frame cost above which the clock halves its paint rate.
 *
 * 1/24 s. Above it the machine is already missing the 30 fps this loop asks for,
 * and asking again every frame simply queues work behind work. Halving the rate
 * roughly halves the cost, and the skipped frames make the average fall again —
 * so the loop settles just under the threshold instead of saturating above it.
 */
const SLOW_FRAME_SEC = 1 / 24;

export interface ReplicaClockOptions {
  /** Play as soon as the host says the section is on screen. */
  autoplay?: boolean;
  /** The host's verdict: is the section in (or near) the viewport? */
  active?: boolean;
  /** Smallest advance in `t` that is worth a render. */
  minStepSec?: number;
}

export interface ReplicaClock {
  /** Screenplay time, in seconds, always inside `[0, durationSec)`. */
  t: number;
  /** The chapter `t` falls in — the same answer `at()` would give. */
  chapter: ChapterId;
  /** What the viewer asked for. Unchanged by scrolling away or hiding the tab. */
  playing: boolean;
  /** What is actually happening: `playing` AND on screen AND visible. */
  running: boolean;
  play: () => void;
  pause: () => void;
  /** Jump to a point in the loop. Wraps, and tolerates a silly number. */
  seek: (sec: number) => void;
}

export function useReplicaClock(
  sp: Screenplay,
  { autoplay = true, active = true, minStepSec = DEFAULT_MIN_STEP_SEC }: ReplicaClockOptions = {},
): ReplicaClock {
  const duration = sp.durationSec > 0 ? sp.durationSec : 1;

  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(autoplay);
  const [documentVisible, setDocumentVisible] = useState(true);

  /** The real time, advanced every frame. `t` is the throttled copy React sees. */
  const timeRef = useRef(0);
  /** The last `t` handed to React — the throttle's other half. */
  const paintedRef = useRef(0);
  /**
   * A rolling average of what a frame is costing, in seconds.
   *
   * Seeded at a 60 Hz frame rather than at nothing, so that ONE slow frame —
   * the first one after a resume, a garbage collection, a long task belonging to
   * someone else — cannot be mistaken for a slow machine. Only a sustained cost
   * moves it past the threshold.
   */
  const loadRef = useRef(1 / 60);

  const running = playing && active && documentVisible;

  useEffect(() => {
    const read = () => setDocumentVisible(!document.hidden);
    read();
    document.addEventListener("visibilitychange", read);
    return () => document.removeEventListener("visibilitychange", read);
  }, []);

  useEffect(() => {
    if (!running) return;

    let frame = 0;
    /** The previous frame's timestamp; null on the first frame after a resume. */
    let last: number | null = null;

    const step = (now: number) => {
      if (last !== null) {
        // rAF's own timestamp, so the loop reads no clock of its own and a
        // resumed loop cannot inherit the seconds it spent parked.
        const dt = Math.min(MAX_STEP_SEC, Math.max(0, (now - last) / 1000));
        const next = (timeRef.current + dt) % duration;
        timeRef.current = next;
        loadRef.current = loadRef.current * (1 - LOAD_SMOOTHING) + dt * LOAD_SMOOTHING;
        const step =
          loadRef.current > SLOW_FRAME_SEC
            ? Math.max(minStepSec, loadRef.current * 2)
            : minStepSec;
        // `next < painted` is the wrap: always paint the frame that starts the
        // loop over, however small the step that got there.
        if (next < paintedRef.current || next - paintedRef.current >= step) {
          paintedRef.current = next;
          setT(next);
        }
      }
      last = now;
      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [running, duration, minStepSec]);

  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);

  const seek = useCallback(
    (sec: number) => {
      const raw = Number.isFinite(sec) ? sec : 0;
      // Modulo twice: a negative seek lands inside the loop rather than outside it.
      const wrapped = ((raw % duration) + duration) % duration;
      timeRef.current = wrapped;
      paintedRef.current = wrapped;
      setT(wrapped);
    },
    [duration],
  );

  return { t, chapter: chapterAt(sp, t), playing, running, play, pause, seek };
}
