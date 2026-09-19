/**
 * The replica's public surface.
 *
 * Two consumers, one barrel: the landing page (`StudioSection` + its client
 * mount) and the promo-film repo, which receives this directory verbatim through
 * `scripts/sync-replica.mjs`. Anything exported here is part of the contract
 * between them.
 *
 * `replica.css` is NOT exported — a stylesheet import resolves differently in
 * Next.js and in a Remotion bundle, so each host imports it by path for itself.
 */

export * from "./types";
export * from "./strings";
export * from "./easing";
export * from "./screenplay";
export * from "./at";

/* The renderer. */
export * from "./planTypes";
export * from "./resolvePages";
export * from "./planDraw";
export * from "./layout";
export * from "./layoutMap";
export * from "./StudioReplica";
