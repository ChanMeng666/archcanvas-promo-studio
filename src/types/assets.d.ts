/**
 * Module shims for the non-TypeScript files the SYNCED replica brings with it.
 *
 * `src/replica/` is copied one way out of the product repo, where it is
 * compiled by Next. Here it is compiled by `tsc --noEmit` and bundled by
 * Remotion's webpack, and webpack handles a `.css` import that tsc has never
 * heard of. Without these, a clean `npm run lint` would go red the moment the
 * first real sync lands `replica.css` — which would look like the replica being
 * broken rather than like tsc needing to be told.
 *
 * `.json` needs no shim: `resolveJsonModule` is on, and that is deliberate, so
 * `src/replica-data/index.ts` gets the drawlist's real inferred shape rather
 * than `any`.
 */

declare module "*.css";
declare module "*.svg" {
  const src: string;
  export default src;
}
