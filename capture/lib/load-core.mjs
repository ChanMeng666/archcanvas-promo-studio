// Bundle the film's React-free core and execute it in Node, so the gates test
// the real code.
//
// `layout-core.ts`, `cuts.ts`, `scenes.ts`, `timeline.ts` and `tokens.ts`
// import no React and no Remotion for exactly this reason. The alternative — a
// gate that re-derives the timeline in its own JavaScript — eventually
// disagrees with the film, and a gate that disagrees with what it checks is
// worse than no gate: it goes green on a broken cut and red on a good one, and
// you learn to ignore it.
//
// Run it directly to print the derived timeline:
//     node capture/lib/load-core.mjs

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const esbuild = require("esbuild");

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, "..", "..");
export const SRC = path.join(ROOT, "src");

/** The modules the gates are allowed to reach. Each one must stay React-free. */
const ENTRY = `
export * as layout from "./layout-core";
export * as cuts from "./cuts";
export * as scenes from "./scenes";
export * as timeline from "./timeline";
export * as tokens from "./tokens";
`;

/**
 * The FILM core: everything above, plus the modules that need the synced
 * replica and the baked payloads.
 *
 * Kept as a second entry point rather than folded into the first because these
 * pull in about 1.4 MB of committed JSON. `verify:timeline` asks only about
 * seconds and frames and should not pay for a drawing; `verify:honesty` needs
 * to know where the caption's box lands on screen at frame 292 and cannot
 * answer without one.
 *
 * Still React-free, and still a tripwire: `camera.ts`, `film-demo.ts`,
 * `cues.ts`, `honesty.ts` and the replica modules they reach all compile in
 * Node, so a React import creeping into any of them blows up here.
 */
const FILM_ENTRY = `
${ENTRY}
export * as camera from "./camera";
export * as film from "./film-demo";
export * as cues from "./cues";
export * as honesty from "./honesty";
export * as audio from "./audio";
// The film caption's own type scale, which a gate has to check. The component is
// React; the constant is not, and esbuild keeps only what is reachable.
export * as caption from "./caption";
// The authored lines and the size arithmetic that sets them, so the framing gate
// can measure a card the way the card measures itself.
export * as copy from "./copy";
export * as typefit from "./typefit";
`;

let cached = null;
let cachedFilm = null;

const evaluate = async (contents, sourcefile) => {
  const built = await esbuild.build({
    stdin: { contents, resolveDir: SRC, sourcefile, loader: "ts" },
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    target: "node22",
    // If any of these modules ever grows a React or Remotion import, the bundle
    // pulls in a DOM library and this blows up in Node. That failure is the
    // point: it is the tripwire on "the core stays React-free".
    external: ["react", "react-dom", "remotion"],
    logLevel: "silent",
  });

  const code = built.outputFiles[0].text;
  const url = "data:text/javascript;base64," + Buffer.from(code, "utf8").toString("base64");
  return import(url);
};

/** Bundle + evaluate the core. Cached, so a gate can call it freely. */
export async function loadCore() {
  if (cached) return cached;
  cached = await evaluate(ENTRY, "core-entry.ts");
  return cached;
}

/** The core plus the replica-backed modules. Cached the same way. */
export async function loadFilm() {
  if (cachedFilm) return cachedFilm;
  cachedFilm = await evaluate(FILM_ENTRY, "film-entry.ts");
  return cachedFilm;
}

/* ── run directly ─────────────────────────────────────────────────────────── */

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const { timeline, layout } = await loadCore();

  console.log("\nDerived timeline (seconds are intent; frames are derived)\n");
  console.log(timeline.describe());

  console.log("Compositions\n");
  for (const d of layout.DELIVERABLES) {
    const L = layout.deriveLayout(d.width, d.height);
    console.log(
      `  ${d.id.padEnd(26)} ${String(d.width).padStart(4)}x${String(d.height).padEnd(4)} ` +
        `${L.aspect.padEnd(9)} replica=${L.replicaLayout.padEnd(9)} ` +
        `stage ${Math.round(L.stage.w)}x${Math.round(L.stage.h)}  ` +
        `${timeline.totalFramesFor(d.cut)} frames`,
    );
  }

  if (timeline.warnings.length) {
    console.log(`\n${timeline.warnings.length} warning(s):`);
    for (const w of timeline.warnings) console.log(`  ! ${w}`);
  } else {
    console.log("\nNo warnings.");
  }
  console.log("");
}
