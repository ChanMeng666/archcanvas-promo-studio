import React from "react";
import { Composition } from "remotion";

import { Film } from "./Film";
import { DELIVERABLES, FPS } from "./layout";
import { totalFramesFor } from "./timeline";

/**
 * Eight masters: four lengths x two aspect ratios, short edge 1080 in all eight.
 *
 * ── There is no `calculateMetadata`, and that is deliberate ────────────────
 *
 * `calculateMetadata` runs in Studio AND in every render worker. `gavigo-ire-
 * video` probed audio durations over HTTP inside one, wrapped in a catch-block
 * that returned a default on failure — so a 404 shipped the whole film at
 * placeholder length and nobody noticed until the master was cut. Lengths here
 * come from `timeline.ts`, derived from seconds in `cuts.ts`, read
 * synchronously.
 *
 * `verify:timeline` checks that this file still MAPS over `DELIVERABLES` and
 * still has exactly one `durationInFrames` prop. Eight compositions that each
 * spell out their own length is how a vertical cut ends up a beat short of the
 * landscape one.
 */
export const RemotionRoot: React.FC = () => (
  <>
    {DELIVERABLES.map((d) => (
      <Composition
        key={d.id}
        id={d.id}
        component={Film}
        defaultProps={{ cut: d.cut }}
        durationInFrames={totalFramesFor(d.cut)}
        fps={FPS}
        width={d.width}
        height={d.height}
      />
    ))}
  </>
);
