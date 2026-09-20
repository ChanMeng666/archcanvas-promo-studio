#!/usr/bin/env node
/**
 * verify-honesty.mjs — the two things that must be on screen, checked ON SCREEN.
 *
 * `verify:timeline` already proves the honesty caption is scheduled for at least
 * three seconds in every master. That is a statement about the EDIT, and it was
 * the whole check until the camera existed. It is no longer enough: the film now
 * frames the replica at up to 1.5x with the origin on whatever the beat is
 * about, and a push that frames the kitchen beautifully can slide the caption
 * off the bottom edge. Scheduled and visible are different claims.
 *
 * So this gate samples real frames, asks `camera.js` — the same React-free
 * module the renderer calls — where the caption's box actually LANDS, and fails
 * if it is outside the frame while it is readable. Same arithmetic, not a
 * re-derivation: a gate that re-implements what it checks eventually disagrees
 * with it, and then it is worse than no gate.
 *
 * Five checks:
 *
 *   1. **The caption is fully opaque for >= 3.0 s of CONTINUOUS film time in
 *      every one of the eight masters**, measured on the ENVELOPE'S CORE rather
 *      than its tails, and across BOTH sources: the film's band hands the
 *      sentence over to the product's own pill, so measuring either alone
 *      under-counts by exactly the handoff.
 *   1b. **And never both at once.** Two copies of one sentence 115 px apart
 *      reads as a rendering bug, not as emphasis. The still pass caught it; this
 *      is what stops it returning.
 *   1c. **The product's own caption is whole or it is gone, never half.** The
 *      money shot frames the building at 85 % of the frame, which puts the
 *      studio's caption well below the edge — deliberately, and the film draws
 *      the sentence itself over that beat (`scenes.ts` § filmCaption). What must
 *      never happen is the in-between: a caption with its top half showing.
 *   2. **It is never cropped** — its box, after the mount and after the push,
 *      is inside the frame at every sampled second it is readable.
 *   3. **The "AI-generated" pill is on screen whenever a rendering is >= 50 %
 *      opaque** (EU AI Act Art. 50). Checked as the rendering card's box being
 *      inside the frame, because the pill is drawn inside that card and the
 *      product owns where.
 *   3b. **The film's own band never prints over the product's drafting sheet.**
 *      The band is an OPAQUE pill at the bottom of the stage; upstream keeps the
 *      sheet up while the drawing starts underneath it, so the money-shot beat
 *      opened with the band across the card's own "Designing, checking and
 *      reviewing your plan - usually 2-3 minutes." Two sentences saying nearly
 *      the same thing, over each other, on the first frames of the beat the
 *      whole edit is built around. Nothing cropped, nothing doubled, five green
 *      checks - it survived three look passes and a rendered master, and only a
 *      motion preview found it.
 *   4. **The film's caption and the replica's are the same sentence.** Two
 *      copies of one sentence is one copy too many; this is what stops them
 *      parting company when the product re-words its own.
 *   5. **The banned needles, over every rendered text source**: `ArchLang`, a
 *      bare `$` before a digit, and `AI architect` not followed by `ural`. The
 *      last is a REGEX and the lookahead is the whole point.
 *
 * Usage:  node capture/verify-honesty.mjs [--json]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadFilm } from "./lib/load-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AS_JSON = process.argv.includes("--json");

const failures = [];
const exceptions = [];
const fail = (kind, subject, detail) => failures.push({ kind, subject, detail });

const film = await loadFilm();
const { DELIVERABLES, deriveLayout, FPS, pictureClipBottom, splitStage } = film.layout;
const { timelineFor, honestyWindow } = film.timeline;
const { SCENES } = film.scenes;
const { shotFor, insideFrame, draftCardRectFor } = film.camera;
const { honestyBandRect, captionLines } = film.caption;
const { honestyWaitDiagnostic } = film.timeline;
const { HONESTY_MIN_SEC } = film.cuts;

/** Do two rectangles share any area? */
const intersects = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Entirely outside the frame — no part of it visible. */
const outsideFrame = (r, w, h) => r.x + r.w <= 0.5 || r.y + r.h <= 0.5 || r.x >= w - 0.5 || r.y >= h - 0.5;
const { captionDrift } = film.honesty;

/* ── 4. the two copies of the sentence ────────────────────────────────────── */

const drift = captionDrift();
if (drift) fail("drift", "the honesty caption", drift);

/* ── 1 + 2 + 3: sample the real frames ────────────────────────────────────── */

/**
 * The same decision `ReplicaSlot` makes, restated in the one place a gate can
 * reach it. It is two lines and it is derived from the aspect, so it cannot
 * drift in a way that matters; anything larger would belong in `camera.ts`.
 */
/**
 * The clip `SceneRouter` applies, for this frame shape and this scene kind.
 *
 * ⚠ It is not optional detail. `camera.ts` reads `clipBottom` for `fillScale`
 * and for the protection bounds, so a gate that passes the mount box and not
 * the clip measures a camera the renderer does not use — "the gate that
 * re-implements what it checks", arriving through an omitted argument.
 */
const clipFor = (layout, split) => {
  const clip = split
    ? Math.min(splitStage(layout).line.y - layout.u(10), pictureClipBottom(layout))
    : pictureClipBottom(layout);
  return clip < layout.height ? clip : undefined;
};

const boxFor = (layout, beat) =>
  SCENES[beat.scene].kind === "split" ? splitStage(layout).replica : layout.picture;

/** How far inside the frame edge a protected box must sit to count as whole. */
const MARGIN = 2;

const report = {};

for (const d of DELIVERABLES) {
  const layout = deriveLayout(d.width, d.height);
  const resolved = timelineFor(d.cut, layout.aspect);
  const windowed = layout.aspect === "landscape";

  let opaqueFrames = 0;
  let captionSamples = 0;
  let pillSamples = 0;
  let overlapFrames = 0;
  const band = honestyBandRect(layout, captionLines(layout.aspect));
  const frameRect = { x: 0, y: 0, w: layout.width, h: layout.height };

  /**
   * The sentence's opacity at every frame of the master, from EITHER source.
   *
   * The floor is a claim about the sentence being on screen, not about which
   * component drew it — and since the film's band now hands over to the
   * replica's own pill rather than overlapping it, measuring either one alone
   * would under-count by exactly the handoff. Indexed by absolute frame so the
   * run can cross a beat boundary, which is the whole point.
   */
  const ink = new Float64Array(resolved.totalFrames);
  const filmInk = new Float64Array(resolved.totalFrames);
  const win = honestyWindow(d.cut, layout.aspect);
  /*
   * ⚠ The exception is CHECKED, not believed.
   *
   * Waiting for the card costs the start of the band, and on a short money shot
   * that is the difference between clearing the three-second floor and not — A's
   * 15 s cut lands at 2.83 s. So the film does not wait there, and the overlap
   * stands, because the sentence is the obligation and a composition problem may
   * not spend it. What this asserts is that the exception was EARNED: every cut
   * that declines to wait must be a cut where waiting really would have gone
   * under. A standing excuse attached to a red gate trains everyone to read past
   * the day it goes red for a real reason.
   */
  const bandWaits = win.bandWaitsForCard;
  if (!bandWaits) {
    const { waited } = honestyWaitDiagnostic(d.cut, layout.aspect);
    exceptions.push(`${d.id}: band does not wait (waiting = ${waited.coveredSec.toFixed(2)}s, floor ${HONESTY_MIN_SEC}s)`);
    if (waited.coveredSec + 1e-9 >= HONESTY_MIN_SEC) {
      fail(
        "overprint",
        d.id,
        `the band does not wait for the drafting sheet, but waiting would have kept the sentence on ` +
          `screen for ${waited.coveredSec.toFixed(2)}s — over the ${HONESTY_MIN_SEC}s floor. The overlap is ` +
          "not paying for anything here",
      );
    }
  }
  if (win.source === "film") {
    // The band fades in over `MOTION.enterSec` (capped at a sixth of the window)
    // and does NOT fade out — `HonestyCaption`'s own arithmetic.
    const fade = win.hardIn ? 0 : Math.min(0.24, (win.to - win.from) / 6);
    for (let f = 0; f < resolved.totalFrames; f += 1) {
      const sec = f / FPS;
      if (sec < win.from || sec > win.to) continue;
      filmInk[f] = fade <= 0 ? 1 : Math.min(1, Math.max(0, (sec - win.from) / fade));
    }
  }

  for (const beat of resolved.beats) {
    if (beat.replicaFrom === undefined) continue;
    if (beat.scene === "second-brief") continue;
    const box = boxFor(layout, beat);
    const clipBottom = clipFor(layout, SCENES[beat.scene].kind === "split");

    for (let f = 0; f < beat.durationInFrames; f += 1) {
      const shot = shotFor(beat, f, layout, box, { browserFrame: windowed, clipBottom });
      const abs = beat.startFrame + f;

      // Only a caption the camera has left WHOLE counts toward the floor. One
      // that has been framed out of shot is not on screen, whatever its opacity.
      const whole = insideFrame(shot.captionRect, layout.width, layout.height, MARGIN);
      const gone = outsideFrame(shot.captionRect, layout.width, layout.height);
      const visible = whole ? shot.captionOpacity : 0;
      if (abs < ink.length) ink[abs] = Math.max(ink[abs], visible);

      // 1 — fully opaque means the envelope is at its plateau, not on a tail.
      if (visible >= 0.999) opaqueFrames += 1;

      // 2 — whole, or gone. Never half.
      if (shot.captionOpacity > 0.02) {
        captionSamples += 1;
        const ok = shot.filmCaption ? whole || gone : whole;
        if (!ok) {
          fail(
            shot.filmCaption ? "half" : "cropped",
            d.id,
            (shot.filmCaption
              ? "the product's own caption is PART of the way off screen at "
              : "the honesty caption is cropped at ") +
              `${(beat.startSec + f / FPS).toFixed(2)}s (beat ${beat.index} "${beat.scene}", ` +
              `push ${shot.push.scale.toFixed(3)}): box ${fmt(shot.captionRect)} in ` +
              `${layout.width}x${layout.height}`,
          );
          f = beat.durationInFrames; // one report per beat is enough to act on
        }
      }

      // 3b — the band is opaque; the drafting card must not be under it.
      if (filmInk[abs] >= 0.1 && bandWaits) {
        const card = draftCardRectFor(shot);
        if (card && intersects(card, band) && intersects(card, frameRect)) {
          overlapFrames += 1;
          if (overlapFrames === 1) {
            fail(
              "overprint",
              d.id,
              `the film's honesty band is printing over the product's drafting sheet at ` +
                `${(beat.startSec + f / FPS).toFixed(2)}s (beat ${beat.index} "${beat.scene}"): ` +
                `band ${fmt(band)}, card ${fmt(card)} in ${layout.width}x${layout.height}`,
            );
          }
        }
      }

      // 3 — the rendering card carries the always-visible "AI-generated" pill.
      if (shot.renderingOpacity >= 0.5) {
        pillSamples += 1;
        /*
         * ⚠ In 9:16 the bar is the SAFE frame, not the frame.
         *
         * This asked whether the pill's rectangle was inside the FRAME, and it
         * was — comfortably, legibly, and sitting in the bottom 390 px that
         * Reels, TikTok and Shorts cover with their own chrome. The obligation
         * the pill discharges (EU AI Act Art. 50) is about what a viewer
         * actually sees, so on the masters cut FOR those platforms the pill has
         * to clear their furniture.
         */
        const bottomBar = layout.aspect === "portrait" ? layout.safe.bottom : 0;
        const inside = insideFrame(shot.renderingRect, layout.width, layout.height - bottomBar, MARGIN);
        if (!inside) {
          fail(
            "pill",
            d.id,
            `the rendering card — and its "AI-generated" pill — is ${bottomBar ? "inside the platform chrome band" : "cropped"} at ` +
              `${(beat.startSec + f / FPS).toFixed(2)}s (push ${shot.push.scale.toFixed(3)}): ` +
              `box ${fmt(shot.renderingRect)} in ${layout.width}x${layout.height}`,
          );
          f = beat.durationInFrames;
        }
      }
    }
  }

  // The longest CONTINUOUS run in which the sentence is on screen, whichever
  // component is drawing it.
  let longestRun = 0;
  let run = 0;
  let doubled = 0;
  for (let f = 0; f < resolved.totalFrames; f += 1) {
    const both = Math.max(ink[f], filmInk[f]);
    if (both >= 0.999) {
      run += 1;
      longestRun = Math.max(longestRun, run);
    } else {
      run = 0;
    }
    // Two copies of one sentence, in two places, at once. This is what the
    // still pass caught and what the handoff exists to prevent.
    if (ink[f] > 0.25 && filmInk[f] > 0.25) doubled += 1;
  }

  const replicaSec = opaqueRun(ink) / FPS;
  const filmDraws = win.source === "film";
  const filmSec = filmDraws ? opaqueRun(filmInk) / FPS : 0;
  const total = longestRun / FPS;

  report[d.id] = {
    replicaOpaqueSec: Number(replicaSec.toFixed(3)),
    filmOverlaySec: Number(filmSec.toFixed(3)),
    effectiveSec: Number(total.toFixed(3)),
    doubledFrames: doubled,
    captionSamples,
    pillSamples,
    opaqueFrames,
  };

  if (total + 1e-6 < HONESTY_MIN_SEC) {
    fail(
      "floor",
      d.id,
      `the honesty caption is continuously on screen for ${total.toFixed(2)}s, under the ${HONESTY_MIN_SEC}s floor ` +
        `(replica's own run ${replicaSec.toFixed(2)}s, the film's band ${filmSec.toFixed(2)}s)`,
    );
  }
  if (doubled > 0) {
    fail(
      "doubled",
      d.id,
      `${doubled} frame(s) carry the sentence TWICE — the product's own caption and the film's band at once. ` +
        "The band is meant to hand over at `honestyWindowFor().to`, not to overlap.",
    );
  }
  if (captionSamples === 0 && !filmDraws) {
    fail("vacuous", d.id, "no sampled frame showed the caption at all, and the film is not overlaying one");
  }
}

/** The longest run of fully-opaque frames in an ink track. */
function opaqueRun(track) {
  let best = 0;
  let run = 0;
  for (const v of track) {
    if (v >= 0.999) {
      run += 1;
      best = Math.max(best, run);
    } else run = 0;
  }
  return best;
}

/* ── 5. the needles, over every rendered text source ──────────────────────── */

const NEEDLES = [
  { re: /ArchLang/i, why: "B4 — the compiler is never named on a consumer surface" },
  { re: /\$\s*\d/, why: "no bare dollar figure on screen — USD on a .uk surface is DMCCA drip-pricing exposure" },
  { re: /\bAI architect(?!ural)/i, why: "B15 — 'architect' is a protected title in the UK and NZ; write 'AI architectural designer'" },
];

/**
 * Comments are stripped, and that is not laziness.
 *
 * Half the files in this repo EXPLAIN these three bans in prose, quoting the
 * banned form to do it. A scan that cannot tell a rule from its violation fails
 * on its own documentation, and a gate that fails on its own documentation gets
 * switched off. What reaches a screen is a string literal or JSX text; that is
 * what is read.
 */
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|json)$/.test(p)) out.push(p);
  }
  return out;
};

/**
 * The drawlist is excluded and the landing payload is not.
 *
 * `drawlist.json` is the numbers gate's RECORD — it is not drawn, and it carries
 * the compiler's own layer names. What the film DRAWS is `landing.json`,
 * `showcase-plans.json` and the replica's own strings, and those are read.
 */
const SKIP = new Set(["drawlist.json", "replica-lock.json"]);

let scanned = 0;
for (const file of walk(path.join(ROOT, "src"))) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  if (SKIP.has(path.basename(file))) continue;
  scanned += 1;
  const raw = fs.readFileSync(file, "utf8");
  const text = file.endsWith(".json") ? raw : stripComments(raw);
  text.split("\n").forEach((line, i) => {
    for (const { re, why } of NEEDLES) {
      if (re.test(line)) {
        fail("needle", `${rel}:${i + 1}`, `${re} — ${why}\n      ${line.trim().slice(0, 120)}`);
      }
    }
  });
}

if (scanned === 0) fail("vacuous", "src/**", "the needle scan looked at no files at all");

/* ── report ───────────────────────────────────────────────────────────────── */

function fmt(r) {
  return `${r.x.toFixed(0)},${r.y.toFixed(0)} ${r.w.toFixed(0)}x${r.h.toFixed(0)}`;
}

const summary = { floorSec: HONESTY_MIN_SEC, sourcesScanned: scanned, masters: report, failures };

if (AS_JSON) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(failures.length ? 1 : 0);
}

console.log("\n  verify-honesty");
console.log(`    ${scanned} text source(s) scanned for the three needles`);
console.log(`    the caption, measured on screen through the real camera, per master:`);
for (const d of DELIVERABLES) {
  const r = report[d.id];
  console.log(
    `      ${d.id.padEnd(27)} ${r.effectiveSec.toFixed(2)}s ` +
      `(replica ${r.replicaOpaqueSec.toFixed(2)}s + film ${r.filmOverlaySec.toFixed(2)}s), ` +
      `${r.captionSamples} frame(s) checked for cropping, ${r.pillSamples} for the pill`,
  );
}

if (!failures.length) {
  console.log(`\n  ✓ the caption clears ${HONESTY_MIN_SEC}s uncropped in all eight, the pill is never cut, no needle found\n`);
  process.exit(0);
}

console.log("");
for (const f of failures) {
  console.log(`  ✗ [${f.kind}] ${f.subject}`);
  console.log(`      ${f.detail}`);
}
console.log(`\n  ${failures.length} failure(s).\n`);
process.exit(1);
