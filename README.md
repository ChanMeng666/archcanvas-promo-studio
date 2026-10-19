<div align="center">

# ArchCanvas studio film

**A product film for [ArchCanvas](https://archcanvas.uk), the AI architectural designer, whose picture is a coded replica of the product's studio, rendered frame by frame in Remotion rather than screen-recorded.**

</div>

## The film

### ArchCanvas studio film



https://github.com/user-attachments/assets/f3686aaa-8bdf-4a8c-88b4-7f33aca8f18a



▶ Watch on YouTube: https://youtu.be/rUZAiXgt9JY

Four lengths (15, 30, 60 and 120 s) by two aspect ratios (16:9 and 9:16), in two music versions, all cut from one scene library.

## How it's made

- **The interface is code, not footage.** The studio (canvas, composer, drafting sheet, review pins, export menu) is rebuilt in React and CSS as a pure function of time, so every frame is deterministic and re-renders the same.
- **The vertical cuts are a re-layout, not a crop.** The replica has its own portrait layout, and the camera frames it through the replica's layout map.
- **The edit is snapped to the music.** `src/timeline.ts` pulls each scene boundary onto the nearest downbeat of the cut's music bed, and the sound effects are derived from what the picture is doing, frame by frame.
- **Sound effects are synthesised offline** (`tools/synth-sfx.mjs`); the music is two SUNO takes made by Chan Meng.
- **Gates before any render:** `npm run verify` checks assets, timeline, on-screen copy, numbers, loudness, true peak and framing, and `npm run verify:flash` screens a master for flashes (WCAG 2.3.1).

## Make your own

```bash
npm install                      # Node 22+
npm run dev                      # Remotion Studio: all eight compositions
npm run verify                   # the gates
pwsh -File ./render.ps1          # the eight masters into out/masters/<version>/
npx remotion render src/index.ts Studio-15-Landscape-16x9 out/test.mp4   # or one cut
```

Everything needed to render is committed: the replica, the music beds and the sound effects. The full SUNO takes (`audio/source/`) are not; bring your own track and run `npm run audio:beds` to cut new beds from it. `docs/release.md` explains versions and how to pick one.

## Licence

- **Code:** MIT, see [`LICENSE`](LICENSE).
- **Films, music, images and other media made by Chan Meng:** CC BY 4.0, see [`LICENSE-MEDIA.md`](LICENSE-MEDIA.md).
- **Not covered:** the ArchCanvas name, logo and brand assets; the fonts (Space Grotesk and Geist Mono, under the SIL Open Font License); the inlined lucide icon paths (ISC); the libraries, under their own licences (Remotion has its own licence); and the ElevenLabs audition effects in `public/audio/sfx/elevenlabs-audition/` and `audio/sfx-sets/elevenlabs-audition/`, which are not used in the released films.

More detail: [docs/overview.md](docs/overview.md)
