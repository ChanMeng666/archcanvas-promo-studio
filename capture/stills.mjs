#!/usr/bin/env node
/**
 * stills.mjs — look at the film before rendering it.
 *
 * **The still pass is part of the gate, not a nicety.** Every gate in this repo
 * checks something expressible; nothing checks whether a frame is legible, whether
 * a push crops a corner, or whether thirty seconds of contact sheet are thirty
 * identical beige rectangles. A person looking at PNGs does, and this is what
 * produces them.
 *
 * ── Why not `npx remotion still`, eight times ──────────────────────────────
 *
 * Because it re-resolves the bundle per invocation and spins a browser per
 * invocation, and this repo runs on a 16 GB machine shared with other work.
 * Here the bundle is built ONCE and every still is rendered through the same
 * server, sequentially, one browser. `--concurrency` is never raised: a still is
 * a single frame, and the only thing concurrency would buy is the memory
 * pressure that has already rebooted this machine once.
 *
 * ⚠ **For a full sweep, run this once PER COMPOSITION.** `@remotion/google-fonts`
 * fetches the two faces from `fonts.gstatic.com` on every page, and somewhere
 * past forty stills in one browser session that fetch starts failing with
 * `net::ERR_INSUFFICIENT_RESOURCES` — surfacing as a bare `[NetworkError: A
 * network error occurred.]` that takes the whole run down, part-written. Same
 * shape as the memory trap: the failure names the network, the cause is the
 * count.
 *
 * Usage:
 *   node capture/stills.mjs                      every composition, the six beats
 *   for c in ...; do node capture/stills.mjs --comp $c; done      a full sweep
 *   node capture/stills.mjs --comp Studio-30-Landscape-16x9
 *   node capture/stills.mjs --sheet              contact sheets instead
 *   node capture/stills.mjs --at 30L:4.2,12.8    ad-hoc seconds, for a look-fix pass
 *
 * Output: `out/stills/wp9/<comp>/<nn>-<name>.png`, and for `--sheet` the frames
 * in `out/stills/wp9/contact/` that `npm run stills:sheet` tiles.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

import { loadFilm } from "./lib/load-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out", "stills", "wp9");

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1];
};
const only = flag("--comp");
const SHEETS = argv.includes("--sheet");
const adHoc = flag("--at");

/**
 * How often a contact sheet samples, per cut length. One frame a second reads a
 * fifteen- or thirty-second cut as a story; a two-minute cut at that rate is 120
 * thumbnails nobody looks at, so the long cuts step wider.
 */
const SHEET_STEP_SEC = { 15: 1, 30: 1, 60: 2, 120: 4 };

/**
 * The six beats worth looking at, named per cut rather than per composition —
 * the landscape and vertical masters of a cut share an edit, and looking at the
 * same SECOND in both is what makes the pair comparable.
 *
 * Derived, not typed: each entry names a scene and where inside its beat to
 * look, and the seconds come out of the resolved edit. A hand-typed second is a
 * second that stops being the money shot the first time a beat moves.
 */
const BEATS = {
  15: [
    ["hook", 0, 0.55, "hook-card"],
    ["brief", 0, 0.62, "typing"],
    ["draw", 1, 0.45, "money-shot"],
    ["claim-what", 0, 0.55, "claim"],
    ["export", 0, 0.75, "export"],
    ["endcard", 0, 0.7, "endcard"],
  ],
  30: [
    ["hook", 0, 0.55, "hook-card"],
    ["brief", 0, 0.62, "typing"],
    ["draw", 1, 0.45, "money-shot"],
    ["edit", 0, 0.82, "edit-morph"],
    ["receipt", 0, 0.72, "receipt"],
    ["endcard", 0, 0.7, "endcard"],
  ],
  60: [
    ["hook", 0, 0.55, "hook-card"],
    ["draw", 1, 0.45, "money-shot"],
    ["tweak", 0, 0.7, "tweak"],
    ["receipt", 0, 0.78, "receipt"],
    ["render", 0, 0.7, "rendering"],
    ["export", 0, 0.7, "export"],
  ],
  120: [
    ["brief", 1, 0.6, "typology"],
    ["draw", 1, 0.45, "money-shot"],
    ["receipt", 1, 0.62, "pin-open"],
    ["storey", 0, 0.6, "storeys"],
    ["second-brief", 0, 0.3, "second-brief"],
    ["price", 0, 0.6, "price"],
  ],
};

const film = await loadFilm();
const { TIMELINES } = film.timeline;
const { DELIVERABLES, FPS } = film.layout;

/** The absolute frame a `[scene, nth, p, name]` entry names, in a cut. */
function frameFor(cut, [scene, nth, p]) {
  const beats = TIMELINES[cut].beats.filter((b) => b.scene === scene);
  const beat = beats[Math.min(nth, beats.length - 1)];
  if (!beat) return null;
  return beat.startFrame + Math.round(beat.durationInFrames * p);
}

const comps = DELIVERABLES.filter((d) => !only || d.id === only);
if (comps.length === 0) {
  console.error(`\nstills: no composition matches --comp ${only}\n`);
  process.exit(1);
}

console.log(`\nstills: bundling once for ${comps.length} composition(s)…`);
const serveUrl = await bundle({
  entryPoint: path.join(ROOT, "src", "index.ts"),
  onProgress: () => {},
});

let written = 0;

for (const d of comps) {
  const composition = await selectComposition({ serveUrl, id: d.id, inputProps: {} });
  const dir = path.join(OUT, SHEETS ? "contact" : d.id);
  fs.mkdirSync(dir, { recursive: true });

  /** Which frames to shoot, and what to call them. */
  let shots = [];
  if (adHoc) {
    const [tag, list] = adHoc.split(":");
    if (!d.id.includes(tag)) continue;
    shots = list.split(",").map((s, i) => ({
      frame: Math.round(Number(s) * FPS),
      name: `ad-${String(i + 1).padStart(2, "0")}-${Number(s).toFixed(2)}s`,
    }));
  } else if (SHEETS) {
    const step = SHEET_STEP_SEC[d.cut] ?? 2;
    const total = TIMELINES[d.cut].totalFrames;
    shots = [];
    for (let f = 0; f < total; f += step * FPS) {
      // ⚠ INDEXED, with the second as a suffix. ffmpeg's image2 demuxer reads a
      // `%03d` sequence and stops at the FIRST GAP — named by second, the 60 s
      // and 120 s sheets step by 2 and 4, so `t000` was followed by `t002` and
      // the tile came out as one frame on a black field. The index is
      // contiguous; the second is still in the filename for a reader.
      shots.push({
        frame: f,
        name: `c${String(shots.length).padStart(3, "0")}-${(f / FPS).toFixed(0)}s`,
      });
    }
  } else {
    shots = (BEATS[d.cut] ?? []).map((entry, i) => {
      const frame = frameFor(d.cut, entry);
      return frame === null
        ? null
        : { frame, name: `${String(i + 1).padStart(2, "0")}-${entry[3]}` };
    }).filter(Boolean);
  }

  for (const shot of shots) {
    const output = path.join(dir, SHEETS ? `${d.id}-${shot.name}.png` : `${shot.name}.png`);
    await renderStill({
      composition,
      serveUrl,
      output,
      frame: Math.min(shot.frame, composition.durationInFrames - 1),
      imageFormat: "png",
      /*
       * ⚠ Passed EXPLICITLY, and this is the belt to `REMOTION_FILM_VERSION`'s
       * braces. `src/version.ts` runs in a browser here, where `process.env` is
       * whatever the bundler injected; `envVariables` is the supported way to
       * put something in it. Without one of the two, a still is a still of
       * `music.json`'s active version whatever the shell was asked for — which
       * is what every still in this repo was until 2026-09-20.
       */
      envVariables: {
        REMOTION_FILM_VERSION:
          process.env.REMOTION_FILM_VERSION || process.env.FILM_VERSION || "",
      },
      // A contact sheet is looked at as a strip, so half size is plenty and it
      // is the difference between a minute and four.
      scale: SHEETS ? 0.25 : 1,
      concurrency: 1,
      chromiumOptions: { gl: "angle" },
    });
    written += 1;
    process.stdout.write(`  ${d.id.padEnd(27)} f${String(shot.frame).padStart(5)}  ${shot.name}\n`);
  }
}

/* ── the contact sheet is a SEPARATE step ─────────────────────────────────── */

/*
 * It used to be here, at the end of this run. That is the wrong place: a
 * thirty-frame sheet died on its twenty-ninth frame (the `fonts.gstatic.com`
 * exhaustion above) and took the tiling of twenty-eight perfectly good frames
 * with it. A step that takes seconds and depends only on files should not be
 * downstream of one that takes minutes and can fail.
 *
 *   node capture/stills.mjs --sheet --comp <id>    # as many times as it takes
 *   npm run stills:sheet                           # then tile, once
 */

console.log(`\nstills: ${written} file(s) under ${path.relative(ROOT, OUT)}\n`);
