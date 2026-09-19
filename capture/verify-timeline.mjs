#!/usr/bin/env node
// Law 3: the timeline is derived, never typed.
//
// Two halves, and it needs both:
//
//   1. A TEXT check. `src/**` is grepped for frame literals — a `from={840}`, a
//      `durationInFrames={210}`, any number assigned to something named
//      *frame*. One of those anywhere but `src/timeline.ts` and the film has
//      two clocks, which is the state where a cut slips a beat against the
//      music and still looks fine in Studio.
//
//   2. A BEHAVIOUR check. The real core is bundled and executed (see
//      capture/lib/load-core.mjs) and the derived timeline is asserted against
//      the intent in `src/cuts.ts`. This half exists because the text half
//      cannot see an edit whose seconds do not add up to its own cut length.
//
// Usage:
//     node capture/verify-timeline.mjs             structural checks
//     node capture/verify-timeline.mjs --strict    ...and warnings must be empty

import fs from "node:fs";
import path from "node:path";

import { ROOT, SRC, loadCore } from "./lib/load-core.mjs";

const STRICT = process.argv.includes("--strict");

const failures = [];
const fail = (line) => failures.push(line);

/* ── 1. the text check ────────────────────────────────────────────────────── */

/** The one file allowed to do frame arithmetic. */
const TIMELINE = path.join(SRC, "timeline.ts");

/**
 * `src/replica/**` is EXEMPT, and deliberately so. It is a one-way copy of the
 * product's own component tree — this repo may not edit it, so failing it here
 * would be a gate with no fix on this side of the boundary. Its laws are
 * checked by `npm run verify:replica` instead, which is the gate that can
 * actually name the upstream file to change.
 */
const EXEMPT = [path.join(SRC, "replica"), path.join(SRC, "replica-data")];

const FRAME_LITERALS = [
  {
    re: /\bfrom=\{\s*-?\d/g,
    why: "a literal `from={n}` — Sequence offsets come from timeline.ts",
  },
  {
    re: /\bdurationInFrames=\{\s*-?\d/g,
    why: "a literal `durationInFrames={n}` — lengths come from timeline.ts",
  },
  {
    re: /\b[A-Za-z_$][\w$]*[Ff]rames?[\w$]*\s*[:=]\s*-?\d/g,
    why: "a number assigned to a *frame* identifier — seconds live in cuts.ts, frames are derived in timeline.ts",
  },
];

/**
 * Strip comments before matching. Prose about frame 892 is not a frame literal,
 * and a gate that cannot tell the difference gets switched off. `://` is spared
 * so a URL in a comment does not swallow the rest of its line.
 */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
};

const sourceFiles = walk(SRC).filter(
  (p) => p !== TIMELINE && !EXEMPT.some((e) => p.startsWith(e + path.sep)),
);

// The empty-input-set trap: zero source files would pass this half silently.
if (sourceFiles.length === 0) {
  fail("no .ts/.tsx files under src/ outside timeline.ts — the text half checked nothing");
}

for (const file of sourceFiles) {
  const code = stripComments(fs.readFileSync(file, "utf8"));
  code.split("\n").forEach((line, i) => {
    for (const { re, why } of FRAME_LITERALS) {
      re.lastIndex = 0;
      if (re.exec(line)) {
        fail(`${path.relative(ROOT, file)}:${i + 1}  frame literal: ${why}\n      ${line.trim()}`);
      }
    }
  });
}

/* ── 2. the behaviour check ───────────────────────────────────────────────── */

const { timeline, layout, cuts, scenes } = await loadCore();

/* the eight compositions are the eight compositions */

const EXPECTED_DELIVERABLES = [
  ["Studio-15-Landscape-16x9", "15", 1920, 1080],
  ["Studio-15-Vertical-9x16", "15", 1080, 1920],
  ["Studio-30-Landscape-16x9", "30", 1920, 1080],
  ["Studio-30-Vertical-9x16", "30", 1080, 1920],
  ["Studio-60-Landscape-16x9", "60", 1920, 1080],
  ["Studio-60-Vertical-9x16", "60", 1080, 1920],
  ["Studio-120-Landscape-16x9", "120", 1920, 1080],
  ["Studio-120-Vertical-9x16", "120", 1080, 1920],
];

if (layout.DELIVERABLES.length !== EXPECTED_DELIVERABLES.length) {
  fail(`DELIVERABLES has ${layout.DELIVERABLES.length} entries, expected ${EXPECTED_DELIVERABLES.length}`);
}
for (const [id, cut, w, h] of EXPECTED_DELIVERABLES) {
  const d = layout.DELIVERABLES.find((x) => x.id === id);
  if (!d) {
    fail(`DELIVERABLES is missing "${id}"`);
    continue;
  }
  if (d.width !== w || d.height !== h) fail(`"${id}" is ${d.width}x${d.height}, expected ${w}x${h}`);
  else if (Math.min(d.width, d.height) !== 1080) {
    fail(`"${id}" short edge is ${Math.min(d.width, d.height)}, expected 1080`);
  }
  if (d.cut !== cut) fail(`"${id}" declares cut "${d.cut}", expected "${cut}"`);
}

/* every cut's seconds sum to exactly its length, and the frames follow */

const EXPECTED_FRAMES = { "15": 450, "30": 900, "60": 1800, "120": 3600 };

for (const cut of layout.CUT_IDS) {
  const edl = cuts.CUTS[cut];
  if (!edl || edl.length === 0) {
    fail(`cut "${cut}" has no edit decision list`);
    continue;
  }
  const sum = edl.reduce((n, e) => n + e.sec, 0);
  const want = layout.CUT_SECONDS[cut];
  if (Math.abs(sum - want) > 1e-9) {
    fail(`cut "${cut}" sums to ${sum}s, must be exactly ${want}s (off by ${(sum - want).toFixed(3)}s)`);
  }

  const derived = timeline.totalFramesFor(cut);
  if (derived !== EXPECTED_FRAMES[cut]) {
    fail(`cut "${cut}" derives ${derived} frames, expected ${EXPECTED_FRAMES[cut]} at ${layout.FPS} fps`);
  }

  const t = timeline.TIMELINES[cut];
  if (t.beats.reduce((n, b) => n + b.durationInFrames, 0) !== t.totalFrames) {
    fail(`cut "${cut}": the beats do not sum to totalFrames`);
  }
  for (let i = 1; i < t.beats.length; i += 1) {
    if (t.beats[i].startFrame !== t.beats[i - 1].endFrame) {
      fail(`cut "${cut}": beat ${i} starts at ${t.beats[i].startFrame} but beat ${i - 1} ends at ${t.beats[i - 1].endFrame}`);
    }
  }

  /* every scene named by an edit exists, and the RESOLVED beat has (or has not)
     a replica window. Resolved, not declared: a beat may omit the window and
     inherit `defaultReplica` from its scene, and checking the declaration would
     miss a scene whose default is missing. */
  for (const [i, e] of edl.entries()) {
    if (!scenes.SCENE_IDS.includes(e.scene)) {
      fail(`cut "${cut}" beat ${i} names scene "${e.scene}", which is not in SCENE_IDS`);
    }
  }
  for (const b of t.beats) {
    const wants = scenes.hasReplica(b.scene);
    const has = b.replicaFrom !== undefined && b.replicaTo !== undefined;
    if (wants && !has) {
      fail(`cut "${cut}" beat ${b.index} ("${b.scene}") shows the replica but resolves to no window`);
    }
    if (!wants && has) {
      fail(`cut "${cut}" beat ${b.index} ("${b.scene}") is a card but resolves to a replica window`);
    }
    if (has && b.replicaTo <= b.replicaFrom) {
      fail(
        `cut "${cut}" beat ${b.index} ("${b.scene}") runs the replica backwards: ${b.replicaFrom} -> ${b.replicaTo}`,
      );
    }
  }
}

/* ── 3. the honesty caption survives every cut's time warp ────────────────── */
//
// A real design takes two to three minutes; the replica compresses it to
// seconds, and time compression read as a speed promise is a claim nobody made.
// The sentence has to be readable for at least three seconds of FILM time in
// every one of the eight masters — so the window is DERIVED from the edit and
// checked here, never typed. A hand-written window is a number that stops being
// true the first time a beat moves, and this is the film's one honesty
// obligation.

const FLOOR = cuts.HONESTY_MIN_SEC;

for (const cut of layout.CUT_IDS) {
  const h = timeline.HONESTY_WINDOWS[cut];
  if (!h) {
    fail(`cut "${cut}" derives no honesty-caption window at all`);
    continue;
  }
  /*
   * ⚠ `coveredSec`, not `sec`. The film's band and the product's own caption
   * hand over on a beat boundary now — the drafting beat shows the product's,
   * the money shot frames past it and the band takes over — so the band alone
   * under-counts by exactly the handover. The 15 s cut reads 2.85 s of band and
   * 3.23 s of sentence on screen. `verify:honesty` measures the same quantity
   * frame by frame through the real camera, and the two must agree.
   */
  if (h.coveredSec + 1e-9 < FLOOR) {
    fail(
      `cut "${cut}" keeps the honesty caption on screen for ${h.coveredSec.toFixed(2)}s of film time, under the ${FLOOR}s floor ` +
        `(the band gives ${h.sec.toFixed(2)}s, the product's own adds ${h.naturalSec.toFixed(2)}s; source "${h.source}")`,
    );
  }
  if (h.to > timeline.TIMELINES[cut].totalSeconds + 1e-9 || h.from < -1e-9) {
    fail(`cut "${cut}" puts the honesty caption at ${h.from.toFixed(2)}–${h.to.toFixed(2)}s, outside the cut`);
  }
  // The film only draws it where the warp left the replica short. A cut whose
  // natural window already clears the floor but is marked "film" means the
  // derivation disagrees with itself.
  const expected = h.naturalSec >= FLOOR ? "replica" : "film";
  if (h.source !== expected) {
    fail(
      `cut "${cut}" marks the honesty caption source "${h.source}" but its natural window is ${h.naturalSec.toFixed(2)}s (expected "${expected}")`,
    );
  }
}

/* every scene in the roster is used by at least one cut */

const used = new Set(layout.CUT_IDS.flatMap((c) => cuts.CUTS[c].map((e) => e.scene)));
for (const id of scenes.SCENE_IDS) {
  if (!used.has(id)) fail(`scene "${id}" is in SCENE_IDS but no cut uses it — it would never render`);
}

/* Root.tsx still maps, and still reads ONE derived length */

const rootSrc = fs.readFileSync(path.join(SRC, "Root.tsx"), "utf8");
const durationProps = rootSrc.match(/durationInFrames=\{[^}]*\}/g) ?? [];
if (durationProps.length !== 1) {
  fail(
    `src/Root.tsx has ${durationProps.length} distinct durationInFrames props — all eight compositions must read ONE derived length (map over DELIVERABLES)`,
  );
} else if (!/durationInFrames=\{\s*totalFramesFor\(/.test(durationProps[0])) {
  fail(`src/Root.tsx sets ${durationProps[0]} — it must be totalFramesFor(...) from timeline.ts`);
}
if (!/DELIVERABLES\.map/.test(rootSrc)) {
  fail("src/Root.tsx no longer maps over DELIVERABLES — the eight sizes can now drift apart");
}

/* ── report ───────────────────────────────────────────────────────────────── */

console.log(`\nverify:timeline  ${sourceFiles.length} source file(s) scanned\n`);
console.log(timeline.describe());

console.log("  per-composition layout:");
for (const d of layout.DELIVERABLES) {
  const L = layout.deriveLayout(d.width, d.height);
  console.log(
    `    ${d.id.padEnd(26)} ${String(d.width).padStart(4)}x${String(d.height).padEnd(4)} ` +
      `${L.aspect.padEnd(9)} replica=${L.replicaLayout.padEnd(9)} ` +
      `stage ${Math.round(L.stage.w)}x${Math.round(L.stage.h)}  u(40)=${L.u(40)}`,
  );
}

/* what the cut still leans on that does not exist yet */

const needs = scenes.SCENES_WITH_NEEDS ?? [];
if (needs.length) {
  console.log(`\n  ${needs.length} scene(s) waiting on something that does not exist yet:`);
  for (const s of needs) console.log(`    · ${s.id} — needs ${s.needs}`);
}

/* pace — fast and bright, and checkable */

const pace = timeline.paceNotes();
if (pace.length) {
  console.log(`\n  ${pace.length} pace note(s):`);
  for (const p of pace) console.log(`    ! cut ${p.cut}s beat ${p.index} (${p.scene}): ${p.detail}`);
  if (STRICT) fail(`${pace.length} pace note(s) under --strict`);
}

if (timeline.warnings.length) {
  console.log(`\n  ${timeline.warnings.length} timeline warning(s):`);
  for (const w of timeline.warnings) console.log(`    ! ${w}`);
  if (STRICT) fail(`${timeline.warnings.length} timeline warning(s) under --strict`);
}

if (failures.length) {
  console.error(`\nFAIL  verify:timeline  (${failures.length})\n`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error("");
  process.exit(1);
}

console.log(`\nOK  verify:timeline${STRICT ? " --strict" : ""}\n`);
