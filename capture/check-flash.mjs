#!/usr/bin/env node
/**
 * The flash gate. Screens a rendered master against WCAG SC 2.3.1 (Three Flashes or
 * Below Threshold), which forbids more than three flashes in any one-second period.
 *
 * A "flash" is a PAIR of opposing changes in relative luminance where both states sit
 * at or above 10% of full-scale luminance and the change itself is at least 10% -- the
 * general flash threshold. Ported from `../a11y-loop-promo-video/capture/check-flash.mjs`
 * with the same four constants; the differences are the reporting and the note below.
 *
 * WHAT THIS IS NOT. It is a screening test, not a certified analyser. It samples
 * whole-frame average luminance rather than the 341x256-pixel "large area" region the
 * guideline defines, and it does not evaluate the red flash threshold at all. A
 * whole-frame average is the CONSERVATIVE direction -- a localised flash covering less
 * than 25% of the viewport is exempt anyway, so measuring the whole frame can only
 * over-report -- but it is not a substitute for PEAT on content with real strobing.
 * A green result here means "nothing in this film looks like a flash to a crude
 * detector". It does not mean the film has been certified by anybody.
 *
 * WHY THE MEASURE IS PER-TRANSITION AND NOT CUMULATIVE. The comparison below is strictly
 * frame-to-frame (`frames[i] - frames[i - 1]`), never against a baseline or a running
 * mean. SC 2.3.1 is not about drift, it is about a change fast enough to be a flash, and
 * a measure that accumulated would fail a film for a slow wash it was designed to have.
 *
 * WHY IT MATTERS MORE HERE THAN IN THE SIBLING FILM. That one is a single continuous
 * camera move and physically cannot strobe. This one CUTS -- four edits, up to fourteen
 * beats each, on kinetic type over an ivory ground. A 0.28s cut between a full-bleed card
 * and a bright drawing is exactly the shape this gate is looking for, so it is run on
 * every one of the eight masters, not on a representative one.
 *
 * Usage:  node capture/check-flash.mjs out/<master>.mp4
 *         npm run verify:flash out/<master>.mp4
 * Exits 1 on a failing second, 2 if it could not measure at all.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const FPS = 30;
/** Relative-luminance change that counts as a transition. */
const DELTA = 0.1;
/** Both sides of a flash pair must sit above this to count (general threshold). */
const FLOOR = 0.1;
/** SC 2.3.1's limit. */
const MAX_PER_SECOND = 3;

// No default master, and that is deliberate: there are EIGHT here, not four, and a
// default is how seven of them go unchecked while the gate reports a pass on the one
// somebody happened to name in a constant.
if (!process.argv[2]) {
  console.error('flash check: name the master to screen.');
  console.error('\n  npm run verify:flash out/<file>.mp4');
  console.error('\nEvery one of the eight masters is screened separately. This film CUTS, so');
  console.error('a pass on the landscape edit says nothing about the vertical one.');
  process.exit(2);
}

const target = resolve(process.argv[2]);

if (!existsSync(target)) {
  console.error(`flash check: no such file\n  ${target}`);
  console.error(`\nRender one first:  pwsh -File ./render.ps1 -Only 15l`);
  process.exit(2);
}

/**
 * Pull per-frame average luminance out of ffmpeg's signalstats filter.
 * YAVG is the mean luma (0-255) of each frame; `fps=30` normalises the sample rate so
 * the one-second windows below are exactly FPS frames wide whatever the source is.
 */
function luminance(path) {
  return new Promise((res, rej) => {
    const ff = spawn('ffmpeg', [
      '-hide_banner',
      '-nostats',
      '-i', path,
      '-vf', `fps=${FPS},signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-`,
      '-f', 'null',
      '-',
    ]);

    let out = '';
    let err = '';
    ff.stdout.on('data', (d) => (out += d));
    ff.stderr.on('data', (d) => (err += d));
    ff.on('error', () => rej(new Error('ffmpeg not found on PATH')));
    ff.on('close', (code) => {
      if (code !== 0 && !out) return rej(new Error(`ffmpeg exited ${code}\n${err.slice(-800)}`));
      const values = [...out.matchAll(/lavfi\.signalstats\.YAVG=([\d.]+)/g)].map((m) =>
        // Normalise to 0-1. signalstats reports full-range luma.
        Number(m[1]) / 255
      );
      res(values);
    });
  });
}

const frames = await luminance(target).catch((e) => {
  console.error(`flash check: could not measure ${target}\n  ${e.message}`);
  process.exit(2);
});

if (frames.length < FPS) {
  console.error(`flash check: only ${frames.length} frames sampled -- is the file complete?`);
  process.exit(2);
}

/**
 * A transition is a frame-to-frame luminance change of at least DELTA where the brighter
 * side clears the floor. Direction is tracked so an opposing pair (up then down) counts
 * as one flash rather than two transitions.
 */
const transitions = [];
/** The single biggest frame-to-frame swing in the film, floor or no floor. */
let biggest = { frame: 0, change: 0, from: frames[0] ?? 0, to: frames[0] ?? 0 };

for (let i = 1; i < frames.length; i += 1) {
  const change = frames[i] - frames[i - 1];
  if (Math.abs(change) > Math.abs(biggest.change)) {
    biggest = { frame: i, change, from: frames[i - 1], to: frames[i] };
  }
  if (Math.abs(change) >= DELTA && Math.max(frames[i], frames[i - 1]) >= FLOOR) {
    transitions.push({ frame: i, direction: Math.sign(change), change });
  }
}

/**
 * Count opposing PAIRS within each rolling one-second window.
 *
 * The pair is the unit, and the `i += 1` that consumes the second half of one is the
 * difference from the a11y-loop original, which counted every direction *change* between
 * consecutive transitions. That over-reports by roughly 2x: a clip alternating at exactly
 * 3 Hz has 6 transitions in a second, which is 3 flashes and legal, and the original
 * scored it 5 and failed it. Over-reporting is the safe direction for a gate, but a gate
 * that calls a compliant film non-compliant is still lying, and this repo does not.
 * Verified against generated clips: 3 Hz passes at 3, 4 Hz fails at 4, 8 Hz fails at 8.
 */
let worst = { second: 0, flashes: 0, transitions: 0 };
const offenders = [];
for (let start = 0; start + FPS <= frames.length; start += 1) {
  const window = transitions.filter((t) => t.frame >= start && t.frame < start + FPS);
  let flashes = 0;
  for (let i = 1; i < window.length; i += 1) {
    if (window[i].direction !== window[i - 1].direction) {
      flashes += 1;
      i += 1; // both transitions belong to this flash; neither starts the next one
    }
  }
  if (flashes > worst.flashes) {
    worst = { second: start / FPS, flashes, transitions: window.length };
  }
  if (flashes > MAX_PER_SECOND) {
    offenders.push({ at: (start / FPS).toFixed(2), flashes, transitions: window.length });
  }
}

const duration = (frames.length / FPS).toFixed(2);
const at = (frame) => `${(frame / FPS).toFixed(2)}s`;

console.log(`\nflash check -- ${target}`);
console.log(`  ${frames.length} frames analysed  ${duration}s at ${FPS} fps`);
console.log(
  `  largest single swing: ${(Math.abs(biggest.change) * 100).toFixed(1)}% at ${at(biggest.frame)} ` +
  `(luma ${biggest.from.toFixed(3)} -> ${biggest.to.toFixed(3)}, threshold ${DELTA * 100}%)`
);
console.log(`  transitions over ${DELTA * 100}%: ${transitions.length} in the whole film`);
console.log(
  `  busiest second: ${worst.flashes} flash pair(s) from ${worst.transitions} transition(s) ` +
  `at ${worst.second.toFixed(2)}s  (limit ${MAX_PER_SECOND} per second)`
);
console.log('  measured per-transition, frame to frame -- a slow luminance ramp is not a flash.');
console.log('  screening test: whole-frame average luminance, no red-flash analysis. NOT PEAT,');
console.log('  and not a certification. It says nothing here looks like a flash, nothing more.');

if (offenders.length) {
  // Collapse the rolling windows into distinct regions so one busy moment does not print
  // thirty near-identical lines.
  const regions = [];
  for (const o of offenders) {
    const last = regions[regions.length - 1];
    if (last && Number(o.at) - Number(last.end) < 1) {
      last.end = o.at;
      last.peak = Math.max(last.peak, o.flashes);
    } else {
      regions.push({ start: o.at, end: o.at, peak: o.flashes });
    }
  }
  console.log(`\n  FAIL -- ${regions.length} region(s) over ${MAX_PER_SECOND} flashes per second:`);
  regions.forEach((r) => console.log(`    - ${r.start}s to ${r.end}s   up to ${r.peak} flashes`));
  process.exit(1);
}

console.log('\n  PASS -- no second exceeds three flashes');
