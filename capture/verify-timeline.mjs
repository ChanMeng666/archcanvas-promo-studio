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

  /* every scene named by an edit exists, and a replica beat has a window */
  for (const [i, e] of edl.entries()) {
    if (!scenes.SCENE_IDS.includes(e.scene)) {
      fail(`cut "${cut}" beat ${i} names scene "${e.scene}", which is not in SCENE_IDS`);
      continue;
    }
    const s = scenes.SCENES[e.scene];
    const hasWindow = e.replicaFrom !== undefined && e.replicaTo !== undefined;
    if (s.kind === "replica" && !hasWindow) {
      fail(`cut "${cut}" beat ${i} ("${e.scene}") is a replica scene with no replicaFrom/replicaTo window`);
    }
    if (s.kind === "card" && hasWindow) {
      fail(`cut "${cut}" beat ${i} ("${e.scene}") is a card but declares a replica window`);
    }
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
