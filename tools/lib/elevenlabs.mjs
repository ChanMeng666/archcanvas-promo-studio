/**
 * The only place in this repo that touches the ElevenLabs API key.
 *
 * ── The rules this module exists to enforce ─────────────────────────────────
 *
 * 1. **The key is read in-process and never written anywhere.** Not to a log,
 *    not to a manifest, not to an error message, not to a temp file, and not
 *    into this worktree. It is read by ABSOLUTE PATH from the main checkout's
 *    gitignored `.env`; `.env` is never copied next to the generated audio.
 * 2. **Errors are scrubbed before they are thrown.** A fetch failure is the
 *    likeliest way a secret reaches a terminal — an error object that carries
 *    the request options carries the header. Everything thrown from here is a
 *    plain `Error` built from a whitelist of fields, and `scrub()` runs over the
 *    message regardless, so even an unexpected shape cannot carry a key through.
 * 3. **Nothing here calls a generation endpoint on its own.** `generate()` is
 *    explicit and metered; the caller has to have budgeted first.
 *
 * ── Cost, because it is spent before it is noticed ──────────────────────────
 *
 * Sound effects bill at **40 credits per second when `duration_seconds` is
 * given** (and at a model-chosen duration when it is not, which is worse: you
 * cannot budget it). So every call here passes an explicit duration, and
 * `creditsFor()` is the only arithmetic anyone should use.
 */

import fs from "node:fs";

const DEFAULT_ENV = "D:\\github_repository\\archcanvas-promo-studio\\.env";
const API = "https://api.elevenlabs.io";

/** 40 credits per second, per the sound-effects docs. */
export const CREDITS_PER_SECOND = 40;
export const creditsFor = (seconds) => Math.ceil(seconds * CREDITS_PER_SECOND);

/**
 * Remove anything key-shaped from a string.
 *
 * ElevenLabs keys are `sk_` + hex. The pattern is deliberately broader than the
 * current format: a secret that changes shape must not become a secret that
 * leaks. Belt and braces over the whitelisting in `callJson`.
 */
export const scrub = (text) =>
  String(text ?? "")
    .replace(/sk_[A-Za-z0-9]{8,}/g, "sk_***REDACTED***")
    .replace(/xi-api-key[^\n]*/gi, "xi-api-key: ***REDACTED***");

/**
 * Read the key from the main checkout's `.env`. Returns the value; the caller
 * must not hold on to it, print it, or pass it anywhere but a request header.
 */
export const readKey = (envPath = process.env.ELEVENLABS_ENV_FILE || DEFAULT_ENV) => {
  if (!fs.existsSync(envPath)) {
    throw new Error(`no .env at ${envPath} — the ElevenLabs key lives in the MAIN checkout, not in a worktree.`);
  }
  const line = fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((l) => /^\s*ELEVENLABS_API_KEY\s*=/.test(l));
  if (!line) throw new Error(`ELEVENLABS_API_KEY is not set in ${envPath}`);
  const value = line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
  if (!value) throw new Error(`ELEVENLABS_API_KEY is empty in ${envPath}`);
  return value;
};

/**
 * A request that returns JSON. Throws a scrubbed, whitelisted Error on failure.
 * `key` is passed straight into the header and is never placed in any object
 * that could later be stringified into a message.
 */
const callJson = async (path, key) => {
  let res;
  try {
    res = await fetch(`${API}${path}`, { headers: { "xi-api-key": key } });
  } catch (err) {
    // A network error can carry the request in `cause`. Take the message only.
    throw new Error(scrub(`network error calling ${path}: ${err?.message ?? "unknown"}`));
  }
  const text = await res.text();
  if (!res.ok) throw new Error(scrub(`${path} returned ${res.status}: ${text.slice(0, 400)}`));
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(scrub(`${path} returned non-JSON: ${text.slice(0, 200)}`));
  }
};

/**
 * `GET /v1/user/subscription` — the one call that answers "may this output ever
 * be used commercially?".
 *
 * Returns only the fields this project records. The full response carries
 * account identifiers that have no business in a committed manifest.
 */
export const subscription = async (key) => {
  const d = await callJson("/v1/user/subscription", key);
  const used = d.character_count ?? null;
  const limit = d.character_limit ?? null;
  return {
    tier: d.tier ?? null,
    status: d.status ?? null,
    characterCount: used,
    characterLimit: limit,
    remaining: limit != null && used != null ? limit - used : null,
    nextResetUnix: d.next_character_count_reset_unix ?? null,
    nextResetIso: d.next_character_count_reset_unix
      ? new Date(d.next_character_count_reset_unix * 1000).toISOString()
      : null,
    canExtend: d.can_extend_character_limit ?? null,
  };
};

/**
 * Is this tier allowed to produce assets this film may actually ship?
 *
 * ElevenLabs' free plan carries no commercial licence, and its terms withhold
 * rights from content created outside a paid subscription *before or after* —
 * so upgrading later does not license what already exists. That is why the
 * question is asked at GENERATION time and the answer is written into the
 * manifest next to the bytes, rather than being decided when someone renders.
 *
 * Anything that is not positively a known paid tier is treated as not
 * commercial. A tier string this function has never seen is not a licence.
 */
export const PAID_TIERS = new Set(["starter", "creator", "pro", "scale", "business", "enterprise", "growing_business"]);
export const isPaidTier = (tier) => typeof tier === "string" && PAID_TIERS.has(tier.toLowerCase());

/**
 * `POST /v1/sound-generation`. Returns a Buffer of the generated audio.
 *
 * `durationSeconds` is always passed explicitly: without it the model picks a
 * length and bills for the length it picked, which makes a budget impossible.
 */
export const generate = async (key, { text, durationSeconds, promptInfluence = 0.3, loop = false, outputFormat = "mp3_44100_128", modelId = "eleven_text_to_sound_v2" }) => {
  const body = JSON.stringify({
    text,
    duration_seconds: durationSeconds,
    prompt_influence: promptInfluence,
    loop,
    model_id: modelId,
  });
  let res;
  try {
    res = await fetch(`${API}/v1/sound-generation?output_format=${encodeURIComponent(outputFormat)}`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body,
    });
  } catch (err) {
    throw new Error(scrub(`network error calling /v1/sound-generation: ${err?.message ?? "unknown"}`));
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(scrub(`/v1/sound-generation returned ${res.status}: ${text.slice(0, 400)}`));
  }
  return Buffer.from(await res.arrayBuffer());
};
