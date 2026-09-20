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
// Which version this process is building, and which edit travels with it.
export * as version from "./version";
export * as honesty2 from "./honesty";
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

const filmByVersion = new Map();

/**
 * The film as ONE named version sees it — its music, its edit and its sound set
 * together.
 *
 * `src/version.ts` reads `FILM_VERSION` once, at module scope, so a single
 * evaluation can only ever hold one version's edit and one version's cue sheet.
 * That is why `verify-loudness` used to pair every bed with whichever sheet
 * happened to be active and mark the rows "cue sheet is the active take's": not
 * a choice, a limitation of loading the core once.
 *
 * It produced a gate that was red for a pairing no version describes — B's bed
 * under A's sheet — and a red gate with a standing excuse is a gate that gets
 * ignored the day it goes red for a real reason. So instead of explaining the
 * impossible row, this removes it: set the variable, evaluate again, and measure
 * each version as the thing it actually is.
 *
 * The bundle text is identical between versions (the value is read at runtime,
 * not inlined), and a `data:` URL is content-addressed — so two versions would
 * import the SAME cached module and silently share the first one's edit. The
 * version marker in the banner comment is what makes the two URLs differ, and
 * it is load-bearing rather than decorative.
 */
export async function loadFilmForVersion(versionId) {
  if (filmByVersion.has(versionId)) return filmByVersion.get(versionId);

  /*
   * ⚠ BOTH variables, and the one that matters is the PREFIXED one.
   *
   * `src/version.ts` reads `REMOTION_FILM_VERSION || FILM_VERSION`, in that
   * order, because the prefixed one is the only one Remotion injects into the
   * bundle (D36). Setting only `FILM_VERSION` here therefore isolated nothing
   * whenever `REMOTION_FILM_VERSION` was exported in the shell: the outer value
   * won for every version, and `verify:loudness` printed the ACTIVE version's
   * mix four times under four different names.
   *
   * The nasty part is which runs it broke. With neither variable set — the
   * repo's own habit — the gate was correct, so it looked fine. It went wrong
   * precisely when someone followed the documented procedure and exported both,
   * which is what the skill and `render.ps1` now tell you to do. A gate that is
   * right by default and wrong when driven as documented is worse than one that
   * is simply wrong: the numbers stay plausible and nothing says they moved.
   *
   * Caught by comparing rows: under `REMOTION_FILM_VERSION=B-daylight-forward`
   * the row labelled `A-confident-arrival` reported B's 120 s true peak of
   * -1.6 dBTP.
   */
  const previous = process.env.FILM_VERSION;
  const previousPrefixed = process.env.REMOTION_FILM_VERSION;
  process.env.FILM_VERSION = versionId;
  process.env.REMOTION_FILM_VERSION = versionId;
  try {
    const film = await evaluate(
      // An EXPORT, not a comment: esbuild strips comments, so a comment marker
      // left the bundle text byte-identical between versions, the data: URL
      // identical with it, and the second version silently got the first one's
      // cached module — reporting A's numbers under B's name, which is the very
      // failure this function exists to stop.
      `${FILM_ENTRY}
export const LOADED_VERSION = ${JSON.stringify(versionId)};`,
      `film-entry.${versionId}.ts`,
    );
    filmByVersion.set(versionId, film);
    return film;
  } finally {
    if (previous === undefined) delete process.env.FILM_VERSION;
    else process.env.FILM_VERSION = previous;
    if (previousPrefixed === undefined) delete process.env.REMOTION_FILM_VERSION;
    else process.env.REMOTION_FILM_VERSION = previousPrefixed;
  }
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
