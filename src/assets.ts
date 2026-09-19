/**
 * Every file the film loads, named as a LITERAL.
 *
 * **Remotion fails softly on a missing `staticFile()`** — a blank region, not an
 * error — so an eight-master render can complete and ship with a hole in it.
 * `capture/verify-assets.mjs` is the only defence, and it can only check a call
 * whose argument it can read: `staticFile(someVariable)` is reported as
 * unverifiable and stays that way.
 *
 * So the screenplay's asset paths are mapped through a TABLE of literal calls
 * rather than by rewriting a string at runtime. Six renderings, six checked
 * paths, and a screenplay that asks for a seventh throws here instead of drawing
 * nothing.
 */

import { staticFile } from "remotion";

/**
 * The product's own renderings, as `scripts/sync-replica.mjs` stages them:
 * `public/showcase/renders/<name>.webp` upstream becomes `public/renders/` here.
 */
const RENDERS: Record<string, string> = {
  "two-storey-townhouse-aerial.webp": staticFile("renders/two-storey-townhouse-aerial.webp"),
  "two-storey-townhouse-exterior.webp": staticFile("renders/two-storey-townhouse-exterior.webp"),
  "two-storey-townhouse-interior.webp": staticFile("renders/two-storey-townhouse-interior.webp"),
  "family-house-aerial.webp": staticFile("renders/family-house-aerial.webp"),
  "family-house-exterior.webp": staticFile("renders/family-house-exterior.webp"),
  "family-house-interior.webp": staticFile("renders/family-house-interior.webp"),
};

/**
 * The `assetUrl` the replica is handed.
 *
 * The screenplay names `/showcase/renders/<name>.webp`, which is the path the
 * WEB host serves. Anything else is a bug in the screenplay or a rendering that
 * was never synced, and both are better as a thrown error at module-adjacent
 * time than as an empty card in master number six.
 */
export const replicaAssetUrl = (src: string): string => {
  const name = src.slice(src.lastIndexOf("/") + 1);
  const file = RENDERS[name];
  if (!file) {
    throw new Error(
      `no synced rendering for "${src}" — add it to RENDERS in scripts/sync-replica.mjs and re-sync`,
    );
  }
  return file;
};

export const WORDMARK = staticFile("brand/archcanvas-wordmark.svg");
export const ICON = staticFile("brand/archcanvas-icon.svg");
