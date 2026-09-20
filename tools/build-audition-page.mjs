#!/usr/bin/env node
/**
 * build-audition-page.mjs — a local page the founder opens to judge the sounds.
 *
 * Nobody on the building side of this can hear. Every measurement in the
 * manifests is real and none of them answers "is this the right sound", so the
 * deliverable of this work package is not a set of files — it is a page that
 * makes the decision easy for the one person who can actually make it.
 *
 * Opened straight off disk (`file://`), so every path is relative and nothing
 * is fetched. The audio and video are referenced where they already live rather
 * than copied; only the spectrograms are copied in, because they are generated
 * into a scratch directory that is not part of the repo.
 *
 * Usage:  node tools/build-audition-page.mjs
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out", "audition");
const SPECTRO_OUT = path.join(OUT, "spectrograms");
const SCRATCH_SPECTRO = "D:\\.claude-scratch\\2026-09-19\\studio-replica\\sfx-elevenlabs-audition";
const PREVIEW_DIR = path.join(ROOT, "out", "previews", "AUDITION-not-for-release");

const SET_ID = "elevenlabs-audition";

fs.mkdirSync(SPECTRO_OUT, { recursive: true });

const sfxDoc = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "sfx.json"), "utf8"));
const set = sfxDoc.sets[SET_ID];
const synth = sfxDoc.sets.synth;
if (!set) { console.error(`\n  no "${SET_ID}" set in src/data/sfx.json\n`); process.exit(1); }

/** Copy a cue's spectrogram in, making one if the scratch copy is gone. */
const spectrogram = (cueFile, id) => {
  const dest = path.join(SPECTRO_OUT, `${id}.png`);
  const src = path.join(SCRATCH_SPECTRO, `${id}.png`);
  if (fs.existsSync(src)) fs.copyFileSync(src, dest);
  else {
    spawnSync("ffmpeg", ["-hide_banner", "-nostdin", "-v", "error", "-i", path.join(ROOT, "public", cueFile),
      "-lavfi", "showspectrumpic=s=760x220:mode=combined:color=intensity:scale=log:legend=0:start=20:stop=20000",
      "-frames:v", "1", "-y", dest], { encoding: "utf8" });
  }
  return `spectrograms/${id}.png`;
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** out/audition -> repo root is two levels up. */
const rel = (publicFile) => `../../public/${publicFile}`;

const previews = fs.existsSync(path.join(PREVIEW_DIR, "previews.json"))
  ? JSON.parse(fs.readFileSync(path.join(PREVIEW_DIR, "previews.json"), "utf8"))
  : null;

const draws = set.cues.filter((c) => c.role === "draw");
const others = set.cues.filter((c) => c.role !== "draw");
const ROLE_ORDER = ["type", "click", "move", "appear", "end"];
const ROLE_TITLE = {
  type: "type — the brief being typed",
  click: "click — a control being used",
  move: "move — a panel arriving or leaving",
  appear: "appear — something landing on screen",
  end: "end — the closing card",
};

const cueCard = (c, extra = "") => `
      <div class="cue">
        <div class="cue-head">
          <h4>${esc(c.id)}</h4>
          <span class="nums">${c.durationSec.toFixed(2)}s · peak ${c.peakDb.toFixed(1)} dB · rms ${c.rmsDb.toFixed(1)} dB · ${c.centroidHz} Hz${
            c.alignBy === "attack" && c.alignOffsetSec > 0.004 ? ` · attack +${c.alignOffsetSec.toFixed(3)}s` : ""
          }</span>
        </div>
        <p class="desc">${esc(c.desc)}</p>
        <audio controls preload="none" src="${esc(rel(c.file))}"></audio>
        <img class="spec" src="${esc(spectrogram(c.file, c.id))}" alt="spectrogram of ${esc(c.id)}">
        <details><summary>prompt</summary><p class="prompt">${esc(c.prompt?.text ?? "")}</p>
          <p class="meta">${c.prompt?.durationSeconds}s requested · prompt_influence ${c.prompt?.promptInfluence} · ${esc(c.prompt?.modelId ?? "")} · ${esc(c.prompt?.outputFormat ?? "")} · no seed available</p>
        </details>${extra}
      </div>`;

const synthPencil = synth.cues.find((c) => c.id === "pencil-line");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sound audition — ArchCanvas Studio</title>
<style>
  :root { --ink:#1b1a17; --paper:#faf7f1; --muted:#6b6459; --line:#e2dbcd; --plum:#8052ff; --warn:#a3231b; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--paper); color:var(--ink);
         font:16px/1.55 ui-sans-serif,-apple-system,"Segoe UI",system-ui,sans-serif; }
  .wrap { max-width:1100px; margin:0 auto; padding:0 20px 80px; }
  .banner { background:var(--warn); color:#fff; padding:14px 20px; font-weight:600; }
  .banner span { font-weight:400; opacity:.92; }
  h1 { font-size:30px; margin:34px 0 6px; letter-spacing:-.01em; }
  h2 { font-size:22px; margin:48px 0 4px; padding-bottom:8px; border-bottom:1px solid var(--line); }
  h3 { font-size:17px; margin:30px 0 10px; color:var(--muted); font-weight:600; }
  h4 { font-size:15px; margin:0; font-family:ui-monospace,"Cascadia Code",Consolas,monospace; }
  .lede { color:var(--muted); max-width:70ch; }
  audio { width:100%; height:34px; margin:8px 0 6px; }
  video { width:100%; border-radius:8px; background:#000; display:block; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(330px,1fr)); gap:18px; }
  .cue { border:1px solid var(--line); border-radius:10px; padding:14px; background:#fff; }
  .cue-head { display:flex; justify-content:space-between; align-items:baseline; gap:10px; flex-wrap:wrap; }
  .nums { font-size:11.5px; color:var(--muted); font-family:ui-monospace,Consolas,monospace; }
  .desc { font-size:13.5px; color:var(--muted); margin:6px 0 4px; }
  .spec { width:100%; border-radius:6px; display:block; margin-top:4px; }
  details { margin-top:8px; }
  summary { cursor:pointer; font-size:13px; color:var(--plum); }
  .prompt { font-size:13px; background:#f4f0e6; padding:10px; border-radius:6px; margin:8px 0 4px; }
  .meta { font-size:11.5px; color:var(--muted); font-family:ui-monospace,Consolas,monospace; margin:0; }
  .draw-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(440px,1fr)); gap:22px; }
  .draw { border:2px solid var(--line); border-radius:12px; padding:16px; background:#fff; }
  .draw.ref { border-style:dashed; background:#f7f4ec; }
  .tag { display:inline-block; font-size:11px; letter-spacing:.08em; text-transform:uppercase;
         color:#fff; background:var(--plum); border-radius:99px; padding:3px 10px; margin-bottom:8px; }
  .tag.ref { background:var(--muted); }
  .concept { font-weight:600; font-size:16px; margin:4px 0 8px; }
  .note { background:#fff; border:1px solid var(--line); border-left:3px solid var(--plum);
          padding:14px 16px; border-radius:8px; margin:20px 0; font-size:14.5px; }
  .note b { color:var(--ink); }
  code { font-family:ui-monospace,Consolas,monospace; font-size:.9em; background:#efeade; padding:1px 5px; border-radius:4px; }
  footer { margin-top:60px; padding-top:20px; border-top:1px solid var(--line); color:var(--muted); font-size:13.5px; }
</style>
</head>
<body>
<div class="banner">Free-tier audition — NOT FOR RELEASE.
  <span>These sounds were generated on an ElevenLabs free plan, which carries no commercial licence.
  Nothing here may be published. This page exists so you can decide whether to pay for a plan and regenerate them.</span>
</div>
<div class="wrap">

<h1>Sound audition</h1>
<p class="lede">Twenty-one candidate sound effects, generated from the prompts in
<code>audio/sfx-sets/prompts.json</code>. The question that matters is the first section —
everything below it is the rest of the palette, for completeness.</p>

<div class="note">
  <b>How to judge this.</b> Play the five clips in <b>Drawing the plan</b> first, with sound on, in order.
  They are the same eight seconds of the real 30-second cut, the same picture and the same music — the only
  difference between them is the drawing sound. The video stream is byte-identical in all five, so anything
  you notice is the sound.
  <br><br>
  Then tell me <b>one letter</b>. Everything else can follow from that.
</div>

<h2>Drawing the plan — A to E</h2>
<p class="lede">The sound you did not like. Mixed at <code>-8 dB</code>, which is the level
<code>src/cues.ts</code> already uses for this cue, starting ${previews ? previews.drawAtSec.toFixed(2) : "0.80"}s into each clip
where the drawing begins.</p>

<div class="draw-grid">
${draws.map((c) => {
  const letter = c.id.replace(/^draw-/, "").toUpperCase();
  const preview = previews?.previews?.find((p) => p.id === c.id);
  const vid = preview ? `../previews/AUDITION-not-for-release/draw-${letter}.mp4` : null;
  return `  <div class="draw">
    <span class="tag">${letter}</span>
    <div class="concept">${esc(c.concept ?? c.id)}</div>
    ${vid ? `<video controls preload="metadata" src="${esc(vid)}"></video>` : `<p class="desc">(no preview rendered)</p>`}
    <p class="desc">${esc(c.desc)}</p>
    <p class="nums">${c.durationSec.toFixed(2)}s · peak ${c.peakDb.toFixed(1)} dB · rms ${c.rmsDb.toFixed(1)} dB · centroid ${c.centroidHz} Hz</p>
    <audio controls preload="none" src="${esc(rel(c.file))}"></audio>
    <img class="spec" src="${esc(spectrogram(c.file, c.id))}" alt="spectrogram of ${esc(c.id)}">
    <details><summary>prompt</summary><p class="prompt">${esc(c.prompt?.text ?? "")}</p>
      <p class="meta">${c.prompt?.durationSeconds}s requested · prompt_influence ${c.prompt?.promptInfluence}</p></details>
  </div>`;
}).join("\n")}
${synthPencil ? `  <div class="draw ref">
    <span class="tag ref">Reference</span>
    <div class="concept">The current synthesised sound</div>
    <p class="desc">What is in version A today — <code>pencil-line</code>, built from ffmpeg noise and filters.
    This is the one you asked to replace. Included so the comparison is fair.</p>
    <p class="nums">${synthPencil.durationSec.toFixed(2)}s · peak ${synthPencil.peakDb.toFixed(1)} dB · rms ${synthPencil.rmsDb.toFixed(1)} dB</p>
    <audio controls preload="none" src="${esc(rel(synthPencil.file))}"></audio>
    <img class="spec" src="${esc(spectrogram(synthPencil.file, "synth-pencil-line"))}" alt="spectrogram of the synthesised pencil-line">
    <p class="desc" style="margin-top:8px">Note it is <b>0.65s</b> and is fired repeatedly, once per stroke, to cover the beat.
    The five candidates above are single ~8s takes that cover it in one go — which is how they are mixed in the clips.</p>
  </div>` : ""}
</div>

<h2>The rest of the palette</h2>
<p class="lede">Generated in the same round, judged the same way. Each of these replaces one of the
synthesised cues if you decide to move the whole set over.</p>

${ROLE_ORDER.map((role) => {
  const items = others.filter((c) => c.role === role);
  if (!items.length) return "";
  return `<h3>${esc(ROLE_TITLE[role] ?? role)}</h3>
    <div class="grid">${items.map((c) => cueCard(c)).join("")}
    </div>`;
}).join("\n")}

<h2>What happens next</h2>
<div class="note">
  <b>If you want them:</b> upgrade the ElevenLabs plan, then
  <code>node tools/generate-sfx-elevenlabs.mjs --set elevenlabs</code>. That command refuses to run on a free
  tier, so it cannot quietly produce a set that looks releasable. It regenerates from the same prompts —
  but the API has no seed, so the takes <b>will differ</b>. It is a re-mix, not a re-render.
  <br><br>
  <b>If you do not:</b> <code>node tools/use-sfx.mjs synth</code> and nothing changes.
  <br><br>
  <b>Either way,</b> masters cannot be rendered while the audition set is active —
  <code>npm run verify:release</code> refuses, and <code>render.ps1</code> asks it before it starts.
</div>

<footer>
  Generated by <code>tools/build-audition-page.mjs</code> ·
  set <code>${esc(SET_ID)}</code> · ${set.cues.length} cues ·
  source ${esc(set.provenance.source)}, tier <b>${esc(String(set.provenance.tier))}</b>,
  commercial use <b>not permitted</b> ·
  evidence in <code>docs/audio-provenance.md</code>
</footer>
</div>
</body>
</html>
`;

fs.writeFileSync(path.join(OUT, "index.html"), html);
console.log(`\n  audition page -> ${path.relative(ROOT, path.join(OUT, "index.html"))}`);
console.log(`    ${draws.length} draw candidate(s)${previews ? " with in-context previews" : " (no previews rendered yet)"}`);
console.log(`    ${others.length} other cue(s) · ${fs.readdirSync(SPECTRO_OUT).length} spectrogram(s) copied in\n`);
