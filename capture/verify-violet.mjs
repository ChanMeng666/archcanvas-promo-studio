#!/usr/bin/env node
/**
 * verify-violet.mjs — the founder's constraint on large flat violet, as a number.
 *
 * ── The constraint ─────────────────────────────────────────────────────────
 *
 * **No violet-family colour may cover more than `VIOLET_AREA_MAX` of a frame as
 * a flat area, in any scene of any cut, in either frame shape.** Violet is a
 * spot: a rule, a caret, a pin head, a chip, a band sweeping past. It is not a
 * field.
 *
 * This is a founder decision and it has now been reached three times from three
 * directions, which is why it is a gate rather than a note. First the
 * full-bleed plum cards (`docs/decisions.md` D11, D22, D24). Then the STAGE
 * tints behind the window — periwinkle at 50 % and 70 %, which read as "a wash"
 * in a swatch and as **a third of a 9:16 frame** in a split scene. A tint of a
 * violet is still a violet, and a pale one covering a third of the frame is
 * precisely the case the objection is about.
 *
 * ── How it measures, and why there are no pixels in it ─────────────────────
 *
 * From the LAYOUT RECTS, through the same `camera.js` the renderer uses. A
 * screenshot gate would be slower, would need a browser, would drift with fonts,
 * and — worst — would be checking the output of the thing it is meant to
 * constrain. The model is small enough to state completely:
 *
 *   - every scene paints a **ground** over the whole frame (`scenes.ts` §
 *     `groundOf`) — the chapter's stage colour, or a card's tone;
 *   - a replica or split scene mounts the **window** on top of it, which is
 *     opaque and covers what it covers, so the ground's visible flat area is
 *     `frame − window`;
 *   - a split scene's band is the same colour as its stage, so the sum is the
 *     same subtraction;
 *   - the montage paints one of `MONTAGE_STAGES` full bleed;
 *   - the end card sweeps a plum **band** of `WIPE_BAND` of the frame width.
 *
 * ── What counts as violet ──────────────────────────────────────────────────
 *
 * Hue, not a list. A list only catches the violets someone has already thought
 * of, and the two rounds this constraint has survived were both introduced by
 * someone reaching for a colour that was not on the list. Anything in
 * {@link VIOLET_HUE} with real saturation is violet-family, whatever it is
 * called.
 *
 * **Aubergine has two approved uses** — the what-line card and the receipt band
 * — so the gate does not exempt the colour, it COUNTS the uses and fails on a
 * third. An exemption by value would have let the next round paint six frames
 * aubergine and stay green.
 *
 * Usage:  node capture/verify-violet.mjs [--json]
 */

import { loadFilm } from "./lib/load-core.mjs";

const AS_JSON = process.argv.includes("--json");

const failures = [];
const fail = (kind, subject, detail) => failures.push({ kind, subject, detail });

const film = await loadFilm();
const { DELIVERABLES, deriveLayout, splitStage } = film.layout;
const { timelineFor } = film.timeline;
const { SCENES, groundOf, MONTAGE_STAGES } = film.scenes;
const { shotFor, pushRect } = film.camera;
const { VIOLET_AREA_MAX, END_WIPE_BAND, SPOT, BAND } = film.tokens;

/** The hue window that is violet-family, in degrees. */
const VIOLET_HUE = { from: 235, to: 300 };
/** Below this saturation a hue is a neutral and the name of it is noise. */
const VIOLET_SAT_MIN = 0.06;

const hsl = (hex) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) hue = ((b - r) / d + 2) * 60;
  else hue = ((r - g) / d + 4) * 60;
  return { h: hue, s, l };
};

const isViolet = (hex) => {
  if (typeof hex !== "string" || !/^#[0-9a-fA-F]{6}$/.test(hex)) return false;
  const { h, s } = hsl(hex);
  return s >= VIOLET_SAT_MIN && h >= VIOLET_HUE.from && h < VIOLET_HUE.to;
};

/** How much of the frame the replica's window covers, as a fraction. */
const windowShare = (beat, layout) => {
  const scene = SCENES[beat.scene];
  if (scene.kind !== "replica" && scene.kind !== "split") return 0;
  const split = scene.kind === "split";
  const sp = splitStage(layout);
  const box = split ? sp.replica : layout.picture;
  const clipBottom = split ? sp.line.y - layout.u(10) : undefined;

  const shot = shotFor(beat, Math.round(beat.durationInFrames * 0.95), layout, box, {
    browserFrame: layout.aspect === "landscape",
    clipBottom,
  });
  const r = pushRect(shot.push, shot.mount.rect);
  // Clipped to what is on screen: a split scene's picture stops at the clip, and
  // the part of the window past the frame edge covers nothing.
  const x0 = Math.max(0, r.x);
  const y0 = Math.max(0, r.y);
  const x1 = Math.min(layout.width, r.x + r.w);
  const y1 = Math.min(clipBottom ?? layout.height, r.y + r.h);
  const covered = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  return covered / (layout.width * layout.height);
};

/* ── the sweep ────────────────────────────────────────────────────────────── */

let measured = 0;
let violetSeen = 0;
const aubergineUses = new Set();
const worst = new Map();

for (const d of DELIVERABLES) {
  const layout = deriveLayout(d.width, d.height);

  for (const beat of timelineFor(d.cut, layout.aspect).beats) {
    const scene = SCENES[beat.scene];
    const ground = groundOf(beat.scene);
    if (ground === null) continue;
    measured += 1;

    const share = 1 - windowShare(beat, layout);
    const key = `${ground} ${layout.aspect}`;
    if (!worst.has(key) || worst.get(key).share < share) {
      worst.set(key, { colour: ground, aspect: layout.aspect, share, where: `${d.id} "${beat.scene}"` });
    }

    if (!isViolet(ground)) continue;
    violetSeen += 1;

    if (ground.toUpperCase() === BAND.aubergine.toUpperCase()) {
      aubergineUses.add(beat.scene);
      continue;
    }
    if (share > VIOLET_AREA_MAX) {
      fail(
        "field",
        `${d.id} "${beat.scene}"`,
        `${ground} is violet-family and covers ${(share * 100).toFixed(0)} % of the frame as a flat area — ` +
          `over the ${(VIOLET_AREA_MAX * 100).toFixed(0)} % ceiling. Violet is a spot, not a field`,
      );
    }
  }
}

/* ── the montage's own grounds ────────────────────────────────────────────── */

for (const ground of MONTAGE_STAGES) {
  measured += 1;
  if (!isViolet(ground)) continue;
  fail(
    "field",
    `the second brief's montage`,
    `${ground} is violet-family and the montage paints it full bleed — 100 % of the frame`,
  );
}

/* ── the end card's sweeping band ─────────────────────────────────────────── */

/*
 * The one violet FIELD the film is allowed, and only because it is a field for
 * nine frames and then gone. It still has to be under the ceiling — a fifth was
 * the first answer to "how wide", and a fifth is over it.
 */
measured += 1;
if (isViolet(SPOT.plum) && END_WIPE_BAND > VIOLET_AREA_MAX) {
  fail(
    "field",
    "the end card's wipe",
    `the band is ${(END_WIPE_BAND * 100).toFixed(0)} % of the frame width in ${SPOT.plum} — over the ` +
      `${(VIOLET_AREA_MAX * 100).toFixed(0)} % ceiling. A swipe, not a surface`,
  );
}

/* ── aubergine's two approved uses, counted ───────────────────────────────── */

/**
 * The two scenes aubergine is approved for. Not a threshold and not an
 * exemption: an exemption by colour would let the next round paint six frames
 * aubergine and stay green.
 */
const AUBERGINE_APPROVED = ["claim-what", "receipt"];

for (const scene of aubergineUses) {
  if (!AUBERGINE_APPROVED.includes(scene)) {
    fail(
      "aubergine",
      `"${scene}"`,
      `aubergine has two approved uses — ${AUBERGINE_APPROVED.join(" and ")} — and this is a third. ` +
        "It is violet-family; the exception is for those two frames, not for the colour",
    );
  }
}
for (const scene of AUBERGINE_APPROVED) {
  if (!aubergineUses.has(scene)) {
    fail(
      "aubergine",
      `"${scene}"`,
      "is an approved aubergine use and is no longer aubergine — either the approval or the film has moved, " +
        "and the gate would silently pass a film with no dark frame in it",
    );
  }
}

if (measured === 0) fail("vacuous", "violet", "no ground was measured");

/* ── report ───────────────────────────────────────────────────────────────── */

const rows = [...worst.values()].sort((a, b) => b.share - a.share).slice(0, 8);

if (AS_JSON) {
  console.log(JSON.stringify({ ok: failures.length === 0, measured, violetSeen, VIOLET_AREA_MAX, rows, failures }, null, 2));
} else {
  console.log("\n  verify-violet");
  console.log(
    `    ${measured} ground(s) measured, ceiling ${(VIOLET_AREA_MAX * 100).toFixed(0)} % of the frame; ` +
      `hue ${VIOLET_HUE.from}-${VIOLET_HUE.to} at saturation >= ${VIOLET_SAT_MIN} is violet-family`,
  );
  for (const r of rows) {
    console.log(
      `      ${r.colour} ${r.aspect.padEnd(9)} up to ${(r.share * 100).toFixed(0).padStart(3)} % flat` +
        `${isViolet(r.colour) ? "  [violet]" : ""}   ${r.where}`,
    );
  }
  console.log(`    aubergine: ${[...aubergineUses].map((s) => `"${s}"`).join(", ") || "unused"}`);
  console.log(`    the end card's plum band sweeps ${(END_WIPE_BAND * 100).toFixed(0)} % of the frame width`);
  if (failures.length === 0) {
    console.log("\n  ✓ no violet-family field anywhere, and aubergine keeps its two approved frames\n");
  } else {
    console.log("");
    for (const f of failures) console.log(`  ✗ [${f.kind}] ${f.subject}\n      ${f.detail}`);
    console.log("");
  }
}

process.exit(failures.length === 0 ? 0 : 1);
