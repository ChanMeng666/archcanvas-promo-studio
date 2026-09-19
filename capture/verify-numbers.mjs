#!/usr/bin/env node
/**
 * The numbers gate. Fails the build when the film puts a number on screen that
 * no drawing in this repo actually produced.
 *
 * Law 2 of this repo: **nothing on screen is mocked up.** The replica is a coded
 * picture of the product, so it is very easy to draw a plausible number into it —
 * a room area, a wall dimension, a parameter value — and have it look exactly as
 * real as a number the compiler emitted. The difference is invisible on screen and
 * total in substance, and a film that invents a dimension is a film that has
 * invented a measurement claim.
 *
 * So every area- or dimension-shaped numeral that reaches the screen must appear
 * in the BAKED data: `src/data/drawlist.json`, synced from the product's own
 * pre-baked demo output. The pins, the schedule, the dimension strings and the
 * tweak values all come from there.
 *
 * ── Skeleton, and honest about it ──────────────────────────────────────────
 *
 * Two checks are implemented and one is declared:
 *
 *   A. sourced   — every area/dimension numeral in this repo's OWN on-screen copy
 *                  (the film's cards, not the synced replica) is a substring of
 *                  the drawlist. Implemented.
 *   B. paired    — a rendering is only ever shown beside its OWN plan: a file
 *                  reaching for `renders/family-house-*` in the same component as
 *                  a `two-storey-townhouse` reference is a crossed pair.
 *                  Implemented.
 *   C. pinned    — the review pins' sentences must be the variant's real lint
 *                  output, never written for the film. NOT implemented here: the
 *                  authority is the product's own bake (WP-1), and the check
 *                  belongs next to it. Recorded so the gap is visible rather than
 *                  forgotten.
 *
 * Usage:  node capture/verify-numbers.mjs [--json]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const DRAWLIST = path.join(SRC, "data", "drawlist.json");
/**
 * The RECORD is both baked payloads, not just the as-issued one.
 *
 * `drawlist.json` is the as-issued sheet and `landing.json` is what the film
 * actually draws (`docs/decisions.md` D9). They come out of the same bake, so in
 * practice a number in one is a number in the other — but "in practice" is what
 * a gate exists to stop relying on, and the second file is three lines.
 */
const EXTRA_RECORDS = [
  path.join(SRC, "data", "landing.json"),
  path.join(SRC, "data", "showcase-plans.json"),
];
const AS_JSON = process.argv.includes("--json");

const slash = (p) => p.split(path.sep).join("/");
const violations = [];
const fail = (kind, subject, detail) => violations.push({ kind, subject, detail });

/* ── the record ───────────────────────────────────────────────────────────── */

if (!fs.existsSync(DRAWLIST)) {
  console.error(
    [
      "",
      "verify-numbers: src/data/drawlist.json does not exist.",
      "",
      "  The baked plan data has never been synced, so there is no record to check a",
      "  number against. This is a FAILURE and not a skip: a numbers gate with no",
      "  numbers would pass every invented dimension in the film.",
      "",
      "  Sync it:  npm run sync:replica",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const drawlistText =
  fs.readFileSync(DRAWLIST, "utf8") +
  EXTRA_RECORDS.filter((p) => fs.existsSync(p)).map((p) => fs.readFileSync(p, "utf8")).join("");
if (drawlistText.trim().length < 2) {
  console.error("\nverify-numbers: src/data/drawlist.json is empty — it records nothing.\n");
  process.exit(1);
}

/* ── harvest this repo's own on-screen numbers ────────────────────────────── */

/**
 * `src/replica/**` is excluded: its numbers come out of the product and are the
 * record, not a claim about it. What is checked here is what THIS repo wrote.
 */
const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "replica" || e.name === "replica-data") continue;
      walk(p, out);
    } else if (/\.tsx$/.test(p)) out.push(p);
  }
  return out;
};

const files = walk(SRC);

/** An area (`121.5 m²`, `108 m2`) or a millimetre dimension (`2900mm`). */
const NUMERALS = [
  { re: /(\d[\d,]*(?:\.\d+)?)\s*(?:m²|m2|sqm)\b/gi, kind: "area" },
  { re: /(\d[\d,]*(?:\.\d+)?)\s*mm\b/gi, kind: "dimension" },
];

const found = [];
for (const file of files) {
  const rel = slash(path.relative(ROOT, file));
  const text = fs.readFileSync(file, "utf8");
  for (const { re, kind } of NUMERALS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      found.push({ rel, kind, raw: m[0].trim(), value: m[1].replace(/,/g, "") });
    }
  }
}

for (const n of found) {
  if (!drawlistText.includes(n.value)) {
    fail(
      "sourced",
      `${n.rel}  ${n.raw}`,
      `the ${n.kind} ${n.value} does not appear anywhere in src/data/drawlist.json — it was not produced by a drawing in this repo`,
    );
  }
}

/* ── pairing ──────────────────────────────────────────────────────────────── */

/** The two plans this film uses, and the renderings that belong to each. */
const PLANS = ["two-storey-townhouse", "family-house"];

for (const file of files) {
  const rel = slash(path.relative(ROOT, file));
  const text = fs.readFileSync(file, "utf8");
  const rendered = new Set(
    [...text.matchAll(/renders\/([a-z-]+?)-(?:aerial|exterior|interior)\.webp/g)].map((m) => m[1]),
  );
  if (rendered.size === 0) continue;
  for (const plan of PLANS) {
    if (rendered.has(plan)) continue;
    // A component that shows one plan's rendering must not also name the other plan.
    if (new RegExp(`\\b${plan}\\b`).test(text)) {
      fail(
        "paired",
        rel,
        `shows rendering(s) for ${[...rendered].join(", ")} but also names "${plan}" — a rendering is only ever shown beside its own drawing`,
      );
    }
  }
}

/* ── report ───────────────────────────────────────────────────────────────── */

const summary = {
  drawlistBytes: drawlistText.length,
  componentFiles: files.length,
  numeralsFound: found.length,
  notImplemented: ["C. pinned — review-pin text is checked upstream, at the bake"],
  violations,
};

if (AS_JSON) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(violations.length ? 1 : 0);
}

console.log(`\n  verify-numbers`);
console.log(`    ${files.length} component file(s) scanned (src/replica/** excluded — it IS the record)`);
console.log(
  `    ${found.length} area/dimension numeral(s) reconciled against the baked record — ` +
    `drawlist.json + landing.json + showcase-plans.json (${drawlistText.length} bytes)`,
);
console.log(`    not implemented here: review-pin text, which is checked upstream at the bake`);

if (!violations.length) {
  console.log(`\n  ✓ every number on screen came out of a drawing in this repo\n`);
  process.exit(0);
}
console.log("");
for (const v of violations) {
  console.log(`  ✗ [${v.kind}] ${v.subject}`);
  console.log(`      ${v.detail}`);
}
console.log(`\n  ${violations.length} violation(s).\n`);
process.exit(1);
