#!/usr/bin/env node
/**
 * verify-version.mjs — the version map says what it means, and it is FIRST.
 *
 * A version is `{music, edit, sfxSet}` and every other gate measures whatever
 * that map selected. So a map that names a sound set nobody has, or an edit
 * nobody wrote, does not make one gate red — it makes eleven gates measure the
 * fallback and report it under the wrong name. This runs before any of them.
 *
 * ── Why it exists as its own gate ──────────────────────────────────────────
 *
 * `versionProblems()` has been in `src/version.ts` since the version model
 * landed and **nothing read it**. It was correctly reporting that both `+el`
 * versions named an unknown sound set — `version.ts` held a hand-written
 * `"synth" | "elevenlabs"` union and the set on disk is `elevenlabs-audition` —
 * to nobody, for a fortnight. A reported-but-unenforced problem list is a
 * comment with a function signature.
 *
 * ⚠ **Not `verify:versions`.** That one (plural) is the meta-runner: it spawns
 * `npm run verify` once per version, so putting it INSIDE `npm run verify`
 * would recurse until the box gave up. The plural one runs the chain for every
 * version; this singular one is a link in the chain.
 *
 * Usage:  node capture/verify-version.mjs [--json]
 */

import { loadCore } from "./lib/load-core.mjs";

const AS_JSON = process.argv.includes("--json");

const core = await loadCore();
const { VERSION, VERSION_IDS, EDIT_ID, SFX_SET, MUSIC_ID, versionProblems, specFor } = core.version;

const problems = [...versionProblems()];

/*
 * And the vacuity question, out loud: a map with no versions in it would make
 * every assertion below pass by having nothing to assert.
 */
if (VERSION_IDS.length === 0) {
  problems.push("versions.json names no versions at all — every gate downstream would measure a fallback");
}

const rows = VERSION_IDS.map((id) => {
  const spec = specFor(id);
  return `${id.padEnd(24)} music ${String(spec.music ?? id).padEnd(20)} edit ${spec.edit}  sfx ${spec.sfxSet}  ${spec.release ?? "master"}`;
});

if (AS_JSON) {
  console.log(JSON.stringify({ ok: problems.length === 0, VERSION, VERSION_IDS, problems }, null, 2));
  process.exit(problems.length ? 1 : 0);
}

console.log(`\n  verify-version — building ${VERSION}`);
console.log(`    edit ${EDIT_ID} · music ${MUSIC_ID} · sfx ${SFX_SET}`);
console.log(`    ${VERSION_IDS.length} version(s) declared:`);
for (const r of rows) console.log(`      ${r}`);

if (problems.length === 0) {
  console.log("\n  ✓ every version names an edit and a sound set that exist\n");
  process.exit(0);
}
console.log("");
for (const p of problems) console.log(`  ✗ [version] ${p}`);
console.log(`\n  ${problems.length} failure(s).\n`);
process.exit(1);
