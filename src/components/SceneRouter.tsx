import React from "react";
import { AbsoluteFill } from "remotion";

import { COPY_FLAGS } from "../copy";
import { CHAPTER_LABELS } from "../film-demo";
import { PICTURE_FEATHER_PX, pictureClipBottom, splitStage, useLayout } from "../layout";
import { SCENES, groundOf } from "../scenes";
import type { ResolvedBeat } from "../timeline";
import { APP, BAND, SPOT, STAGE } from "../tokens";
import { EndCard } from "./EndCard";
import { ChapterChip, KineticCard, SplitLine } from "./KineticCard";
import { ReplicaSlot } from "./ReplicaSlot";
import { SecondBrief } from "./SecondBrief";

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
 * **The camera is inside `ReplicaSlot`, not around it.** The push is computed by
 * `camera.ts` together with the mount and the protected rectangles, because the
 * clamp that keeps the honesty caption on screen needs all three at once. A
 * wrapper that only knew a scale could not do it, and a wrapper that did it
 * separately would be a second copy of the maths for the gate to disagree with.
 *
 * **A card scene never carries a chapter chip.** The chip says which of the
 * product's seven acts is on screen; on a card there is no product on screen,
 * and a chip over the film's own voice would be labelling the wrong thing.
 */
/** The ground a scene shows, whatever its kind — what a wipe leaves behind. */
export const SceneRouter: React.FC<{ beat: ResolvedBeat }> = ({ beat }) => {
  const scene = SCENES[beat.scene];
  const dur = beat.durationInFrames;

  switch (scene.kind) {
    case "card":
      return scene.copy ? (
        <KineticCard
          copy={scene.copy.copy}
          dur={dur}
          tone={scene.tone ?? "paper"}
          from={groundOf(beat.prevScene)}
          seed={beat.index}
        />
      ) : (
        <AbsoluteFill style={{ backgroundColor: APP.page }} />
      );

    case "endcard":
      return <EndCard dur={dur} />;

    case "split":
      return <Split beat={beat} dur={dur} />;

    case "replica":
    default:
      return <FullBleed beat={beat} />;
  }
};

/**
 * A full-bleed replica beat: the picture, clipped, on the chapter's ground.
 *
 * ⚠ The clip is the point. `ReplicaSlot` mounts inside `layout.picture`, and
 * `camera.ts` then scales the whole layer about its origin — so a 2.6x push
 * carries content out of the box it was mounted in, and in 9:16 it lands in the
 * 390 px the platforms cover with their own interface. That is where the
 * sheet's caption row was being cut in half and where the drafting card was
 * losing both its sides.
 *
 * So the picture ends where `pictureClipBottom` says and the chapter's colour
 * owns the band below it — which is what a `split` scene has always done with
 * its type band, now one rule rather than two. In 16:9 the clip is the frame
 * and this costs nothing.
 *
 * The ground is painted OUTSIDE the clip: `ReplicaSlot` paints its own, and a
 * clipped ground is a clipped ground.
 */
const FullBleed: React.FC<{ beat: ResolvedBeat }> = ({ beat }) => {
  const layout = useLayout();
  const scene = SCENES[beat.scene];
  const clip = pictureClipBottom(layout);
  const clipped = clip < layout.height;
  /*
   * A hard line across the paper reads as a crop; a short feather reads as the
   * sheet running under the band. The mask is on the CLIP layer, which is not
   * transformed — the trap list's warning is about backing store for large
   * TRANSFORMED layers, and this is not one.
   */
  const feather = clipped
    ? `linear-gradient(to bottom, #000 calc(100% - ${PICTURE_FEATHER_PX}px), transparent 100%)`
    : undefined;

  /*
   * ⚠ The MONTAGE is not clipped, and the first version of this clipped it.
   *
   * The clip exists because `camera.ts` scales the replica about its origin and
   * carries content out of the mount box. The montage has no camera: it is
   * film-drawn, it paints its own full-bleed ground per pane, and clipping it
   * left the pane's buttercream stopping at 1520 with 400 px of ivory under it
   * — a pane that looks cut short, which is the defect this round is about
   * wearing the opposite hat.
   */
  const montage = beat.scene === "second-brief";

  return (
    <AbsoluteFill style={{ backgroundColor: groundOf(beat.scene) ?? APP.page }}>
      {montage ? (
        <SecondBrief beat={beat} />
      ) : (
        <AbsoluteFill
          style={{
            height: clip,
            overflow: "hidden",
            maskImage: feather,
            WebkitMaskImage: feather,
          }}
        >
          <ReplicaSlot beat={beat} clipBottom={clipped ? clip : undefined} />
        </AbsoluteFill>
      )}
      {scene.chapter && !montage ? (
        <ChapterChip label={CHAPTER_LABELS[scene.chapter]} />
      ) : null}
    </AbsoluteFill>
  );
};

/**
 * Whether this beat's split line is on screen./**
 * Whether this beat's split line is on screen.
 *
 * One scene, one flag: `tweak` is the only beat whose line the founder has not
 * signed off, and `COPY_FLAGS.tweakLine` turns it off without touching a second
 * of the edit. The chapter chip still names the act, which is what makes the
 * fallback a real fallback rather than a hole.
 */
const lineIsOn = (beat: ResolvedBeat): boolean =>
  beat.scene !== "tweak" || COPY_FLAGS.tweakLine;

/**
 * Picture above, line below, **each in the box its own rule is about**.
 *
 * The picture half comes out of `layout.picture`, which clears the platform's
 * furniture and nothing else; the line half comes out of `layout.stage`, which
 * is the text-safe area. Splitting one box for both is what put a two-line
 * receipt sentence 72 px past the bottom of a 16:9 frame in the scaffold's first
 * still pass — and on 9:16 it would have "fitted" into the 390 px Reels and
 * TikTok cover with their own interface.
 */
const Split: React.FC<{ beat: ResolvedBeat; dur: number }> = ({ beat, dur }) => {
  const layout = useLayout();
  const scene = SCENES[beat.scene];
  const { replica, line } = splitStage(layout);
  // The tighter of the two: a split scene's band, or the picture clip.
  const clipBottom = Math.min(line.y - layout.u(10), pictureClipBottom(layout));
  /*
   * The band takes the chapter's own colour, so the type sits in the film's
   * colour script rather than on beige under a coloured stage. The review
   * chapter is the dark one: ivory type on aubergine at 9.6:1.
   */
  const chapter = scene.chapter;
  const band = chapter ? STAGE[chapter] : APP.page;
  const dark = chapter === "review";

  return (
    <AbsoluteFill style={{ backgroundColor: band }}>
      {/*
        ⚠ CLIPPED, and it is not decoration.

        `ReplicaSlot` mounts inside `replica` but the camera scales the whole
        layer, so a 1.34x push spills the picture straight through the band the
        line sits in. The first still pass had "…and a written list of
        everything we couldn't get right." lying across the product's own
        command bar. The clip is the boundary the split promises.
      */}
      <AbsoluteFill style={{ height: clipBottom, overflow: "hidden" }}>
        <ReplicaSlot beat={beat} stage={replica} clipBottom={clipBottom} />
      </AbsoluteFill>
      {scene.chapter ? <ChapterChip label={CHAPTER_LABELS[scene.chapter]} /> : null}
      {scene.copy && lineIsOn(beat) ? (
        <SplitLine
          copy={scene.copy.copy}
          dur={dur}
          ink={dark ? APP.page : APP.ink}
          rule={dark ? BAND.buttercream : SPOT.action}
        />
      ) : null}
    </AbsoluteFill>
  );
};
