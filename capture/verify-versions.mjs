#!/usr/bin/env node
/**
 * verify-versions.mjs — run the whole chain once per version.
 *
 * ⚠ A CHILD PROCESS per version, not a loop in this one. `FILM_VERSION` is read
 * when the modules initialise and the core is bundled once per process, so a
 * second pass inside the same process would measure the first version twice and
 * say both were green.
 */

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const versions = Object.keys(require("../src/data/versions.json").versions ?? {});

if (versions.length === 0) {
  console.error("\nverify-versions: versions.json names no versions — nothing to check.\n");
  process.exit(1);
}

let bad = 0;
for (const v of versions) {
  console.log(`\n══════ ${v} ══════`);
  const r = spawnSync("npm", ["run", "verify"], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, FILM_VERSION: v },
  });
  if (r.status !== 0) bad += 1;
}

console.log(bad === 0 ? `\n✓ all ${versions.length} version(s) green\n` : `\n✗ ${bad} version(s) red\n`);
process.exit(bad === 0 ? 0 : 1);
