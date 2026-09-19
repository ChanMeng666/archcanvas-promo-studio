import React from "react";
import { AbsoluteFill } from "remotion";

import { splitStage, useLayout } from "../layout";
import { SCENES } from "../scenes";
import type { ResolvedBeat } from "../timeline";
import { APP } from "../tokens";
import { Camera } from "./Camera";
import { EndCard } from "./EndCard";
import { KineticCard, SplitLine } from "./KineticCard";
import { ReplicaSlot } from "./ReplicaSlot";

/**
 * One beat in, one picture out.
 *
 * The router is deliberately the only place that knows what a scene KIND means
 * on screen. `cuts.ts` names scenes and seconds, `scenes.ts` says what a scene
 * is, `timeline.ts` turns that into frames — and the mapping from kind to
 * component lives here and nowhere else, so adding a kind is one `case` rather
 * than a search through four cuts.
 *
 * **Everything takes `dur` as a prop.** Inside a `<Sequence>`,
 * `useVideoConfig().durationInFrames` reports the COMPOSITION length, not the
 * sequence's, which is how a 0.28 s entrance ends up easing over two minutes
 * and looking like nothing is happening.
 *
 * **The camera wraps the replica, never the type.** A push on a card would be a
 * second idea fighting the cut; a push on the interface is the chapter's point.
 */
export const SceneRouter: React.FC<{ beat: ResolvedBeat }> = ({ beat }) => {
  const scene = SCENES[beat.scene];
  const dur = beat.durationInFrames;

  switch (scene.kind) {
    case "card":
      return scene.copy ? (
        <KineticCard copy={scene.copy.copy} dur={dur} />
      ) : (
        <AbsoluteFill style={{ backgroundColor: APP.page }} />
      );

    case "endcard":
      return <EndCard />;

    case "split":
      return <Split beat={beat} dur={dur} />;

    case "replica":
    default:
      return (
        <Camera push={beat.push} dur={dur}>
          <ReplicaSlot beat={beat} />
        </Camera>
      );
  }
};

/**
 * Picture above, line below, **both inside the safe area**.
 *
 * The camera pushes on the picture only. A push that also moved the type would
 * make the line drift against a frame edge it is supposed to be parallel to,
 * and on 9:16 it would walk it into the bottom 390 px that Reels, TikTok and
 * Shorts cover with their own interface.
 */
const Split: React.FC<{ beat: ResolvedBeat; dur: number }> = ({ beat, dur }) => {
  const layout = useLayout();
  const scene = SCENES[beat.scene];
  const { replica } = splitStage(layout);

  return (
    <AbsoluteFill style={{ backgroundColor: APP.canvas }}>
      <Camera push={beat.push} dur={dur}>
        <ReplicaSlot beat={beat} stage={replica} />
      </Camera>
      {scene.copy ? <SplitLine copy={scene.copy.copy} dur={dur} /> : null}
    </AbsoluteFill>
  );
};
