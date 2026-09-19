# The music brief

**For the founder.** This is the one thing in the film that has to be generated
by a human with a SUNO account, and it is the only manual step in the audio
pipeline. Everything else — the four beds, the fourteen sound effects, the beat
grid — is derived by command from whatever track lands in `audio/source/`.

The track on disk today, `confident-arrival.mp3`, is a **placeholder borrowed
from the previous film**. It is genuinely good and it is measurably the best of
the three takes we had (see below), but it was written for a 75-second
continuous camera pull-back, not for a fast product film that cuts. Replacing it
is the point of this document.

---

## The prompt

SUNO **Custom mode**, **Instrumental ON**.

### Style

```
Bright, lively, optimistic modern product-film instrumental. 124 BPM, 4/4.
Warm and airy, daylight rather than neon. Plucked synth and muted electric
guitar lead, light claps and shaker, crisp kick and rim, soft round synth bass,
one sustained warm pad underneath. Clean, spacious mix with air at the top.
Confident and forward-moving, never frantic. Clear four-bar phrases. Starts
immediately with a hit in the first second, no ambient intro. Ends on a
resolved final chord that rings out.
```

### Exclude styles

```
vocals, vocal chops, choir, ukulele, whistling, corporate acoustic, lo-fi,
trap hats, heavy distortion, orchestral swell, cinematic braams, sidechain
pumping, long ambient intro, fade-out ending, dubstep, EDM drop
```

### Lyrics box — the structure tags

SUNO reads section tags even with Instrumental on, and using them is how you get
a track with an actual ending instead of an arrangement that stops.

```
[Intro]
[Verse]
[Build]
[Chorus]
[Verse]
[Breakdown]
[Chorus]
[Outro]
[End]
```

---

## Why these words and not others

Every adjective here maps to something the pipeline or the film actually needs.

- **~124 BPM.** Fast enough to carry a 15-second cut, slow enough that a
  120-second one does not exhaust. At 124 a bar is 1.94 s, so the 15s cut gets
  about seven bar lines to cut on — enough choice without the grid being so dense
  that snapping stops meaning anything. (The placeholder is 101.7 BPM, a 2.36 s
  bar, and seven downbeats in fifteen seconds.)
- **"Clear four-bar phrases."** `tools/plan-beds.mjs` looks for a clean entry
  and splices the track's own ending onto a body. Both splices land on measured
  onsets. A track that phrases irregularly gives it less to work with, and the
  15/30/60/120 edits stop landing on bar lines.
- **"Starts immediately with a hit in the first second."** Every bed must sound
  like it BEGINS. A long ambient intro is dead weight in a 15-second spot, and
  the planner will simply cut past it.
- **"Ends on a resolved final chord that rings out."** This is the load-bearing
  one. The beds do not fade out — they splice the take's real ending on at a bar
  line, so the track must HAVE an ending. A SUNO take that fades has nothing to
  splice and every cut will end on a fade instead, which across eight masters
  reads as a pattern rather than a choice.
- **"Warm, airy, daylight."** The product's own surfaces are ivory paper with a
  single plum accent, and the film is a bright one. Neon and night are the wrong
  room.
- **No sidechain pumping, no fade-out** in Exclude Styles, because both are
  things the pipeline would then have to fight. The duck is applied in the
  composition from where the effects actually are (`DUCK` in `src/audio.ts`); a
  bed that already pumps cannot be un-pumped.
- **No vocals**, and not only because there is no voiceover: a vocal is copy, and
  copy in this project needs a clearance row in `docs/copy-clearance.md`.

---

## Two alternates

If the first prompt lands somewhere dull, these move in different directions
rather than being rewordings of the same idea.

### Alternate A — more rhythmic, more "studio at work"

```
Upbeat instrumental for a design-tool film. 128 BPM, 4/4. Driving muted-guitar
and marimba interplay over a tight kick-and-rim groove, handclaps on the
backbeat, warm analog bass. Bright and busy without being cluttered; the pulse
is the hook. Strong four-bar phrasing, a short breakdown two-thirds through,
and a decisive stop-hit ending with a ring-out.
```

### Alternate B — more open, more "daylight and paper"

```
Optimistic, airy instrumental. 120 BPM, 4/4. Soft mallet and plucked-string
motif over gentle four-on-the-floor kick, brushed shaker, round sub bass and a
wide warm pad. Spacious, unhurried but forward-moving, lots of air above 8 kHz.
Clear four-bar phrases, a lift into the final section, and a resolved final
chord that rings out for three or four seconds.
```

Both keep the same three non-negotiables: **instrumental, four-bar phrasing, a
real ending.**

---

## The swap procedure

One command. It re-derives everything from the new track — the tempo, the beat
grid, where each bed is cut, where the ending is spliced, and the downbeat lists
the film's edit snaps to. Nothing is hand-typed, so nothing goes stale.

```bash
# 1. Drop the new take in, and take the old one out. `audio/source/` must hold
#    exactly ONE file — the tools refuse to guess between two.
mv ~/Downloads/<new-take>.mp3 audio/source/
rm audio/source/confident-arrival.mp3

# 2. Rebuild the beds. Plan -> cut -> measure.
npm run audio:beds

# 3. Check it.
npm run lint
npm run verify:assets
```

`npm run audio:all` does the effects as well, which the swap does not need — the
fourteen cues have nothing to do with the music track.

### What to check afterwards

**By number, from the output of step 2.** `prepare-bed.ps1` prints a table and
fails the run if any bed is outside tolerance, so a green run already means:

- every bed's duration is its cut length, within +0.25 s;
- integrated loudness is near −16 LUFS and true peak is under −1.5 dBTP;
- `build-music.mjs` then reports how many downbeats it found per bed, and how
  many of them landed on a real measured onset. **That last column is the one to
  read.** On the placeholder it is 7/7, 13/13, 26/26 and 52/52. If a new track
  comes back with a lot of unsnapped downbeats, its beat is not being detected
  and the edit will not land on it.

**By ear, which is the part no command can do.** Play all four beds end to end
and listen for three things specifically:

1. **The splice.** About four to six seconds from the end of each bed, the take's
   own ending is crossfaded on over one bar. It should be inaudible as a join. If
   you hear a stumble or a doubled beat there, the track's tempo wanders enough
   that the two halves do not line up — tell me and the crossfade can be
   shortened to a single beat.
2. **The start.** Each bed should sound like the music began, not like you walked
   in on it.
3. **The ending.** It should resolve. If any of the four just stops, the take
   probably faded rather than ending, and the prompt's last line is the fix.

---

## What the placeholder measures, for comparison

Three candidate takes were analysed with `tools/analyze-music.mjs`. "Bright" is
not a matter of opinion here — it is spectral centroid, 85% rolloff and the share
of energy above 2 kHz, each weighted by frame energy so fade tails do not vote.

| take | length | BPM | centroid | rolloff 85% | energy >2 kHz | onsets/min |
|---|---|---|---|---|---|---|
| **`confident-arrival.mp3`** (chosen) | 134.97 s | 101.7 | **1386 Hz** | **2897 Hz** | **22.4%** | **40.9** |
| `drafting-room-full.mp3` | 203.93 s | 98.4 | 612 Hz | 1040 Hz | 6.5% | 38.2 |
| `ink-on-paper-full.mp3` | 179.05 s | 162.2 | 657 Hz | 1109 Hz | 6.8% | 32.2 |

The chosen take is 2.3× brighter by centroid and 3.4× by high-frequency energy
than either alternative, and the liveliest of the three. The other two are the
felt-piano-and-brushes material the earlier films were built on — the right mood
for a drafting room at night, the wrong one for this film.

It also has a **real ending**: the arrangement stops at 128.3 s and rings out to
133.1 s, which is exactly what the splice needs. Ask the new take for the same.

---

## Licensing

SUNO, founder-generated, **paid tier confirmed 2026-09-08**. That confirmation
covers `confident-arrival.mp3`; a new take generated on the same account is
covered by the same entitlement, but **check the plan is still active before
generating**, not after.

That ordering is not pedantry. It is the single most expensive lesson in this
project's history: twelve ElevenLabs assets were generated on a free tier and had
to be deleted, because commercial rights attach to the tier active **when an
asset is created** and upgrading afterwards does not license what already exists.
The sound effects in this film are synthesised offline precisely so that question
can never arise again. The music is the one place it still can.

Full evidence: `docs/audio-provenance.md`. The ruling: `docs/decisions.md` D4.
