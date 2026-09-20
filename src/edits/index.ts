/**
 * The edits, by ID. `cuts.ts` picks one; nothing else reads this directly.
 *
 * Two entries and no plans for a third: the point of the seam is that A stays
 * re-renderable while B is re-cut, not that the film becomes a framework.
 */

import type { Edit } from "../cuts";
import type { CutId } from "../layout-core";
import type { EditId } from "../version";

import { EDIT_A } from "./A";
import { EDIT_B } from "./B";

export const EDITS: Readonly<Record<EditId, Readonly<Record<CutId, readonly Edit[]>>>> = {
  A: EDIT_A,
  B: EDIT_B,
};

export { EDIT_A, EDIT_B };
