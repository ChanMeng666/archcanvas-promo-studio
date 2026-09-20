# `daylight-forward.mp3` — what is in it, and where to cut it

**Version `B-daylight-forward`.** Measured, not heard. Nobody on this work
package can hear the track, so every statement below is a number with the
command that produced it, and the three things that cannot be settled that way
are named at the bottom rather than guessed at.

Source of every figure: `src/data/music-analysis/daylight-forward.json`,
written by `node tools/analyze-structure.mjs`. The take's own comparison record
is `confident-arrival.json` beside it, produced by the same command so the two
columns mean the same thing.

---

## Provenance

| | |
|---|---|
| file | `audio/source/daylight-forward.mp3` |
| sha256 | `564cd2579709a52bbcfb233d49180dba27770decd6d6774cfe2963bab74512b8` |
| source | **copied**, not moved, from `~/Downloads/Daylight Forward.mp3` — the original is still there and hashes the same |
| generated | SUNO, by the founder. The file's own `comment` tag reads `made with suno; created=2026-09-19T23:20:50Z; id=98233425-aa59-42d6-9228-ab7c525ac8da` — 2026-09-20 in NZ time |
| tags | `title=Daylight Forward` · `artist=chanmeng666` · `encoder=Lavf60.16.100` · a `lyrics-eng` tag holding the nine structure tags from `docs/suno-prompt.md` verbatim, which is the evidence the briefed prompt is the one that was used |
| **plan tier** | **to be confirmed by the founder.** Nothing in the file says. See *Licensing* below — this is the one open item that blocks shipping. |
| container | 133.534 s · mp3 · 48 kHz stereo · 183 kbps · 3,080,112 bytes · an embedded 360×360 mjpeg cover (hence `-vn` everywhere) |
| audio stream | starts at 0.023021 s — encoder delay, normal, and the reason downbeats are measured on the delivered file rather than computed |

**Loudness, as delivered:** −14.0 LUFS integrated, LRA 4.4 LU, **true peak +0.1
dBFS**. Sample peak is +0.09 dBFS on the right channel with two samples at full
scale (`astats`). **The master arrives clipped by a hair.** That is not fatal —
the beds are normalised down about 2 dB and land at −16.1 to −16.2 LUFS with
2.1 to 4.1 dB of true-peak headroom — but any clipping already encoded into the
mp3 cannot be undone by turning it down, and it is worth knowing before a
second take is requested.

---

## Tempo — and the half-time error in the older tool

**127.6 BPM, 4/4, a 1.8935 s bar** (mean, measured across 70 downbeats).
First downbeat 1.776 s.

`tools/analyze-music.mjs` reports **63.83 BPM** for this file, with a 3.76 s
"bar", and every window in its table is consequently two bars wide. That number
is wrong, and the way it goes wrong is worth recording because it goes wrong
*confidently*:

- its octave test ranks candidates by beat-phase drift inside the octave family;
- on this take 63.83 and 127.65 **both** drift 0.050 s, an exact tie;
- the tie falls through to a full-track score of 0.0243 against 0.0240 — a
  difference in the fourth decimal, which is noise;
- 63.83 won by that margin, and nothing said the decision had been a coin flip.

`tools/analyze-structure.mjs` decides it differently. The question is not which
candidate is steadier but whether the points *between* a candidate's grid points
are themselves beats. Broadband that cannot be answered — a shaker plays every
off-beat, so the midpoints score about 0.9 either way:

| candidate | autocorrelation | comb | midpoint/beat, **broadband** | midpoint/beat, **40–160 Hz** |
|---|---|---|---|---|
| 63.8 BPM | 897.4 | 88.79 | 0.884 | **0.912** |
| **127.6 BPM** | 823.9 | 87.42 | 0.912 | **0.808** |

A kick does not play the off-beats, so on the low band they separate, and 63.8
is revealed as a grid that is skipping every second real beat. Two independent
corroborations: `lib/dsp.mjs`'s `localBeat` returns 0.47 s (127.66 BPM) on both
the whole take and its last twenty seconds, and the brief in
`docs/suno-prompt.md` asked for ~124.

⚠ **`analyze-music.mjs` has not been changed.** Its header says it is kept as a
diffable port of the sibling film's analyser. Run it on this take and it will
still say 63.83; that is now a documented trap rather than a surprise.

### The take accelerates. The previous one did not.

The repo records "the beat phase drifts ~0.2 s per 20 s" as a property of SUNO
output. Measured as **bar length per 20 s block** that turns out to be two
different phenomena, and they do not have the same consequences:

| | 0–20 s | 20–40 | 40–60 | 60–80 | 80–100 | 100–120 | fixed-grid error at the last downbeat |
|---|---|---|---|---|---|---|---|
| `daylight-forward` | 125.28 | 125.90 | 126.47 | 127.45 | 126.31 | **128.32** | **−1.53 s** |
| `confident-arrival` | 101.05 | 100.98 | 101.77 | 101.05 | 100.96 | 100.98 | −0.08 s |

The previous take holds one tempo end to end. This one is a **ramp**: it speeds
up about 2.4 % across the track, 80 % of blocks moving the same way, and a grid
extrapolated at its opening bar length would be 1.53 s — most of a bar — out by
the end. `build-music.mjs` already handles exactly this by advancing from each
*snapped* position rather than from an ideal grid, which is why the delivered
beds are fine; but the assumption "a wander of about 0.2 s" is not what this
take does, and a future tool that extrapolates will break on it.

### The bar phase is the least certain number here

Which of the four beats is the bar line scores 1.105× over the runner-up — a
weak margin, and honestly reported as one. The usual tests fail on this
material: the 40–130 Hz band carries a bass line playing eighths rather than a
kick playing quarters (506 low-band transients, median spacing 0.235 s = half a
beat), and a chroma-flux test for chord changes came back flat across all four
positions (0.179 / 0.154 / 0.175 / 0.180). What *does* support phase 3 (first
downbeat 1.776 s) is that every arrangement change lands on it — sections start
at downbeat index 0, 1, 4, 19, 34, 36, 40, 42, 58, 60, 66 and nowhere else.

**It does not reach the delivered beds either way.** `build-music.mjs` defines
each bed's first sample as a downbeat and measures from there.

### Grid quality

282 beats, 70 downbeats. Hit-rate within ±40 ms of a measured onset: **97.2 %**
against all onsets, **66.3 %** against the stricter list — with a chance rate of
24 %, so the strict figure is about 2.8× chance and the loose one is not worth
quoting. Downbeats: 95.7 % / 65.7 %.

---

## Structure

Eleven sections, every boundary snapped to a measured downbeat. `bars` is
counted downbeats, not arithmetic. `dB` is relative to the loudest section.

| # | start | end | bars | bar # | dB | centroid | kick/E | air/E | onsets/s | what the numbers say |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | 0.00 | 3.69 | 1 | −1 | −8.4 | 923 | 0.169 | 0.011 | 6.2 | the opening — first transient at **0.081 s**, out of digital silence, no top end |
| 1 | 3.69 | 9.43 | 3 | 1 | −4.2 | 1273 | 0.132 | 0.037 | 5.4 | groove building, still dark |
| 2 | 9.43 | 38.10 | 15 | 4 | −0.4 | 2077 | 0.188 | 0.117 | 6.8 | **full groove** — the air band arrives here, +30.5 dB over three seconds |
| 3 | 38.10 | 66.55 | 15 | 19 | **0.0** | 2324 | 0.146 | 0.132 | 6.7 | full groove, the brightest section in the track |
| 4 | 66.55 | 70.32 | 2 | 34 | −4.8 | 2443 | **0.028** | 0.125 | 7.4 | the kick drops out, cymbals still ringing — the way into the breakdown |
| 5 | 70.32 | 77.83 | 4 | 36 | −6.4 | 1348 | 0.015 | 0.042 | 6.5 | **breakdown** — sparse and dark, no kick, no air |
| 6 | 77.83 | 81.59 | 2 | 40 | −2.9 | 1462 | 0.087 | 0.051 | 7.2 | the breakdown rebuilding |
| 7 | 81.59 | 111.79 | 16 | 42 | −0.2 | 2140 | 0.166 | 0.115 | 5.9 | full groove again — the longest single section |
| 8 | 111.79 | 115.53 | 2 | 58 | −7.9 | 1671 | 0.099 | 0.068 | 4.0 | a second, short drop-out |
| 9 | 115.53 | 126.73 | 6 | 60 | −1.0 | 2015 | 0.220 | 0.117 | 4.8 | **the final chorus** — entered on the biggest jump in the track |
| 10 | 126.73 | 133.53 | 4 | 66 | −9.7 | 1275 | 0.243 | 0.039 | 2.9 | the cadence, then the ring-out |

**The things a cut hangs on:**

- **First strong hit: 0.081 s.** The track begins on a transient out of digital
  silence. It does what the brief asked ("starts immediately with a hit in the
  first second, no ambient intro"), though the kick itself is not in until about
  2.1 s and the top end not until 9.43 s.
- **Biggest energy jump: +6.92 dB at 115.531 s**, into the final chorus, with
  the second-largest riser in the track (+17.96 dB of air band over the three
  seconds before it). **This is the drop.**
- **Biggest riser: +30.53 dB into 9.433 s** — the whole top end of the mix
  arriving at once. Larger than the drop as a *riser*, but it lifts a section
  that is only 3.9 dB louder, so it reads as an opening rather than a climax.
- **Breakdown: 66.55 – 81.59 s**, fifteen seconds, in two halves (kick out at
  66.55, the sparse floor from 70.32, rebuilding from 77.83).
- **Final hit and ring-out:** the outro starts at **126.735 s**, the arrangement
  stops at **130.6 s**, and the file rings out to **133.23 s** — a **2.63 s**
  tail with no beat in it. That is a real ending, which is what the splice
  needs. It is shorter than the previous take's 4.79 s, and it is still enough:
  the planner allotted 4.36 s of ending to every bed and it fits.
- **11 fills** (the kick drops for under four bars, then returns) and **5
  crashes** (air-band transients over 2.5× the local median). The crash attacks
  land within 140 ms of a bar line — 9.57, 39.86, 55.29, 85.32 s, the last of
  them 17 ms off. Full list in the JSON.

### The pictures

- `daylight-forward-energy.png` — broadband energy (black), kick band (orange),
  air band (blue) and spectral centroid (green), with the section boundaries in
  purple and numbered.
- `daylight-forward-spectrogram.png` — `showspectrumpic`, log scale.

They were **looked at**, and they corroborate the table rather than merely
accompanying it. The spectrogram shows the whole top end above ~16 kHz going
black across 71–83 s and again across 112–118 s, which is the breakdown and the
second drop-out exactly where the section table puts them. The energy chart
shows the orange kick trace collapsing to the floor across 66–78 s, and isolated
blue-and-black spikes at ~24, ~40, ~55, ~86 and ~115 s — which is the fill and
crash list, arrived at independently.

---

## How it differs in character from `confident-arrival`

Same command, same definitions, both columns measured rather than remembered.

| | `confident-arrival` (A) | `daylight-forward` (B) | |
|---|---|---|---|
| length | 134.97 s | 133.53 s | — |
| tempo | 100.9 BPM, 2.374 s bar | **127.6 BPM, 1.894 s bar** | +26 %; a 15 s cut gets 8 bar lines instead of 6 |
| tempo stability | flat (fixed grid 0.08 s out over 135 s) | **accelerando** (1.53 s out) | A is a click track, B is played |
| centroid | 1386 Hz | **2085 Hz** | +50 % brighter |
| 85 % rolloff | 2898 Hz | **4814 Hz** | +66 % |
| energy > 2 kHz | 22.3 % | **30.8 %** | +38 % |
| integrated | −13.3 LUFS | −14.0 LUFS | — |
| LRA | 7.3 LU | **4.4 LU** | B is flatter — less dynamic range, more consistently loud |
| strong onsets | 120 /min | **180 /min** | +50 % denser |
| sections | 9 | 11 | — |
| fills | 2 | **11** | — |
| crashes | 2 | **5** | — |
| biggest jump | +12.54 dB at 99.6 s | +6.92 dB at 115.5 s | A has one huge event; B has many medium ones |
| ring-out | 4.79 s | 2.63 s | both sufficient |

**In one line: B is faster, much brighter, far more evented and less dynamic.**
A is a track with one enormous arrival two thirds of the way through — which is
what it was written for, a single 75-second camera pull-back. B has no single
moment that large, and instead offers eleven fills, five crashes and two
drop-outs spread across its length. That is the difference that matters for a
film that **cuts**: A gives an editor one place to put the big beat, B gives
them a dozen places to put an ordinary one. The LRA figure says the same thing
from the other side — B's 4.4 LU means the bed sits at a steadier level under
dialogue-free picture, which is what a bed is for.

---

## Edit windows

A bed is a **body** with the take's own **ending** crossfaded on at a bar line
(`tools/plan-beds.ps1`). So a "window" is a body start; the ending is the same
for all four — from **128.72 s**, 4.36 s long, one bar of music into the
resolution plus the ring-out. Every cut therefore ends the same way: **the
track's own final cadence, spliced on a bar line**, never a fade. That answers
"how does the ending resolve" for all eight candidates below, and it is the
reason the brief insisted on a take that ends rather than fades.

`bodyLen = L − 4.36 + 1.88`, so 12.52 / 27.52 / 57.52 / 117.52 s.

### 15 s

| | start | spans | body level | climax lands at | why |
|---|---|---|---|---|---|
| **A — recommended, and built** | **115.56 s** | s9 → s10 | **0.883** | **film 0.0 s** | Starts *on* the track's biggest lift (+6.92 dB, bar 60) and runs straight into the outro. |
| B — alternate | 85.339 s | s7 | 0.910 | — | Marginally louder body, and it starts on a crash coming out of a fill. But nothing happens inside it: twelve seconds of unbroken groove with no section change, no fill, no crash. |

**Film-time hooks, candidate A:** `0.00` the lift itself · `11.17` the outro
begins (the body reaches it before the splice does; a bed downbeat sits 35 ms
away) · `10.64` the crossfade starts bleeding the ending in · `12.52` the
resolution lands.

**Recommended: A.** A fifteen-second spot has room for one musical idea, and
"the biggest thing in the track, then the ending" is a better one than "twelve
seconds of the middle". It is also the only bed in either version whose grid is
properly on the take's bar lines — see the caveat below.

### 30 s

| | start | spans | body level | climax lands at | why |
|---|---|---|---|---|---|
| **A — recommended, and built** | **0.14 s** | s0 → s2 | 0.754 | **film 9.29 s** | The track's own beginning. Nine seconds of build, then the whole top end arrives. |
| B — alternate | 81.595 s | s7 → s8 | **0.884** | film 3.73 s | Louder and denser throughout, but it opens in the middle of a section — it sounds like you walked in. |

**Film-time hooks, candidate A:** `0.68` the opening transient's crash ·
`3.55` → s1, the groove thickens · `7.22` a 1.45 s fill · **`9.29` the full
arrangement and the air band arrive (+30.5 dB riser) — the strongest hook in
this window, and a bed downbeat is 53 ms away** · `9.43` the crash on top of it ·
`23.57` a short fill · `25.64` the splice begins · `27.52` the resolution.

**Recommended: A** — and note what it buys. In the current `CUT_30` the money
shot (the plan drawing itself out) runs 7.4 – 11.6 s of film time, so **the
music's biggest entrance lands inside the drawing beat**. That is a marriage the
editor gets for free and should probably protect.

### 60 s

| | start | spans | body level | climax lands at | why |
|---|---|---|---|---|---|
| **A — recommended, and built** | **0.14 s** | s0 → s3 | 0.768 | **film 9.29 s** | The beginning, then both full-groove sections with the fills at 38 and 54 s. Ends before the breakdown. |
| B — alternate | 9.433 s | s2 → s4 | **0.814** | film 0.13 s | Opens on the air arriving, which is a strong first second, but it spends its last three seconds in the drop-out into the breakdown — a sixty-second film would end on the music emptying out. |

**Film-time hooks, candidate A:** `0.68` opening crash · `3.55` → s1 · `7.22`
fill · **`9.29` the air arrives** · `23.57` fill · `37.96` → s3, the brightest
section · `38.46` a 1.49 s fill · `39.72` crash · `53.66` fill · `55.15` crash ·
`55.64` splice · `57.52` resolution.

**Recommended: A.** B is louder on average but it is the only candidate in the
set that would put the track's quietest material at the end of a cut, which is
where a film needs its last chord, not its thinnest bar.

### 120 s

Only five starts fit at all — a 117.52 s body has to begin before 11.2 s — so
this is the least free choice in the set.

| | start | spans | body level | climax lands at | why |
|---|---|---|---|---|---|
| **A — recommended, and built** | **0.14 s** | s0 → s9 | 0.756 | **film 115.39 s** | Plays the take essentially whole: opening, both grooves, the fifteen-second breakdown, the long chorus, the second drop-out, and the final lift 4.6 s before the splice. |
| B — alternate | 9.433 s | s2 → s10 | **0.782** | film 106.10 s | Slightly louder because it skips the intro — which is also what it costs: the film loses the track's beginning and gains nine seconds it has to fill at the other end. |

**Film-time hooks, candidate A** (the long list; all of them are in the JSON):
`0.68` opening crash · `9.29` the air arrives · `23.57` fill · `37.96` → s3 ·
`39.72` crash · `55.15` crash · **`66.41` the kick drops out** · `70.18` the
breakdown floor · `77.69` rebuilding · **`81.45` the groove returns** · `85.18`
crash · **`111.65` the second drop-out** · **`115.39` the final lift** ·
`115.64` splice · `117.52` resolution.

**Recommended: A.** At two minutes the argument for playing a 133-second track
almost entire is close to conclusive — the breakdown at 66 s is a gift to a cut
that has to hold attention that long, and it is the one structural feature
neither shorter cut can use.

---

## Gate status

All eleven gates pass on version B, at commit `84381fc` and after.

| gate | result |
|---|---|
| `lint` (tsc) | clean |
| `verify:assets` | ✓ — 22 audio files across **both** versions on disk; 2 non-literal `staticFile()` calls unchecked, pre-existing |
| `verify:replica` | ✓ |
| `verify:timeline` | ✓ with **one new pace note**: the 120 s cut's `price` card now holds 2.23 s against a 2.2 s ceiling. Advisory. It is a 30 ms overrun caused by a boundary moving 40 ms onto B's grid. |
| `verify:copy` · `verify:numbers` · `verify:honesty` · `verify:framing` · `verify:violet` · `verify:opening` | ✓ |
| `verify:audio` | ✓ — 418 cues across four cuts, re-derived on B's grid |
| `verify:loudness` | ✓ — **after fixing the gate**, see below |

**Boundaries moved, which is the system working:** 15 s 1 of 7 (largest 50 ms) ·
30 s 3 of 10 (140 ms) · 60 s 1 of 13 (10 ms) · 120 s 2 of 20 (40 ms). Seven
boundaries across four cuts, none by more than 0.14 s. Less movement than
`docs/release.md` leads you to expect, because both grids are dense enough that
the nearest bar within ±150 ms is often in much the same place.

**The delivered beds:**

| cut | duration | LUFS | true peak | downbeats | on a real onset |
|---|---|---|---|---|---|
| 15 s | 15.000 s | −16.2 | −2.1 dBTP | 8 | 8/8 |
| 30 s | 30.000 s | −16.1 | −3.5 dBTP | 17 | 14/17 |
| 60 s | 60.000 s | −16.2 | −4.1 dBTP | 33 | 29/33 |
| 120 s | 120.000 s | −16.2 | −2.1 dBTP | 65 | 61/65 |

Every one exact on duration, inside 0.2 LU of the −16 target, and 0.6 dB or more
under the −1.5 dBTP ceiling. The snap column is **112 of 123 (91 %)** against
A's 123 of 123 — a real difference, and the expected one: this take accelerates
and `build-music.mjs` lays a fixed-length grid, so where an onset is not within
half a beat the grid point stands unsnapped.

**Version A is untouched.** Its four bed mp3s are byte-identical (`sha256sum -c`
passes, and git reports no change under `public/audio/beds/A-confident-arrival/`)
and its `music.json` entry is character-for-character what it was. `node
tools/use-music.mjs A-confident-arrival` switches back and A renders as before.

`active` is now `B-daylight-forward`, which is step 2 of the documented
procedure in `docs/release.md`, not a decision taken here.

---

## Two defects found on the way, and what was done about them

### 1. `plan-beds.mjs` scored the entry and never the body — **fixed**

Every factor in the body-start score described the first two seconds. This take
opens from digital silence, so its very first onset scores an infinite entry
`lift`, capped at 3, which no musical re-entry can reach (a return out of a
breakdown measures about 1.4×). It won **all four** cut lengths outright, and
the 15 s bed it produced spent 9.3 of its 12.5 body seconds in the two quietest
sections in the track — body level 0.629 against 0.883 for the final chorus.

Nothing downstream would have said so. The duration, the loudness, the true peak
and the downbeat count would all have been right.

The fix is one multiplicative term — the body's own mean level, the same
quantity `analyze-music.mjs` already scores its windows on. It is a **provable
no-op for version A**: replayed against `confident-arrival.mp3` it re-picks
99.81 / 99.81 / 19.05 / 9.53 s, exactly the `sourceBodyStartSec` values
`music.json` records that take's beds were cut at. On this take it moves only
the 15 s bed, from 0.14 s to 115.56 s.

### 2. `verify:loudness` measured the active take once per version — **fixed**

The gate loops over `musicVersions()` and its header promises "all three, for
EVERY music version with beds on disk". The mixer it called had no way to ask
for anything but the active bed, so it measured one take four times and printed
it under each version's name. With one version on file that was accidentally
correct.

The tell was visible the moment B landed: four rows **identical to the tenth of
a LU, the tenth of a dB and the tenth of an LRA unit** for two takes that do not
sound alike. A gate that agrees with itself that precisely is a gate that is not
looking.

`bedFor(cut, version)` fixes it, and the fix is confirmed against an independent
record: with it, version A's rows read **−15.7 / −16.3 / −16.3 / −16.3**, which
is exactly the prediction `docs/release.md` records for A's real render. The
broken gate had been reporting −16.3 for A's 15 s cut where the documented
prediction was −15.7, and nobody could see it.

A non-active version's row is now marked, because the bed is its own but the
**cue sheet is the active take's** — cues are derived by walking a cut that is
snapped to whichever take is active, so a non-active version's true sound sheet
only exists while it is active. What its row does say honestly is the bed's
level, true peak and headroom under a representative cue load.

---

## A third finding, NOT acted on — the beds are not cut on bar lines

`plan-beds.mjs` chooses a body start that is a measured **onset**. It never asks
whether that onset is a **bar line**. Everything downstream inherits the
offset: `build-music.mjs` defines the bed's first sample as a downbeat, so the
bed's whole grid is displaced by however far the body start sits from the take's
nearest bar.

Measured, over each bed's body (the part before the splice), against the take's
own bar grid:

| version | cut | body start | distance to the nearest take bar line | median offset of the bed's downbeats | within 150 ms |
|---|---|---|---|---|---|
| **B** | 15 s | 115.56 s | **0.029 s** | **0.080 s** | **100 %** |
| B | 30 s | 0.14 s | 1.636 s (−0.245 mod bar) | 0.281 s | 14 % |
| B | 60 s | 0.14 s | — | 0.634 s | 7 % |
| B | 120 s | 0.14 s | — | 0.627 s | 3 % |
| A | 15 s | 99.81 s | 0.196 s | 0.236 s | 0 % |
| A | 30 s | 99.81 s | 0.196 s | 0.236 s | 0 % |
| A | 60 s | 19.05 s | 0.091 s | 0.094 s | 74 % |
| A | 120 s | 9.53 s | 0.068 s | 0.255 s | 43 % |

**This is pre-existing, not introduced by B.** Version A's 15 and 30 second beds
have never had a downbeat within 150 ms of one of their take's bar lines. What
B changes is the spread: its 15 s bed is the best-aligned bed either version has
ever had, and its other three are the worst.

So `snapToDownbeat` is pulling scene boundaries onto a regular grid of real
onsets, which is musically defensible on material this dense — but for six of
the eight beds on disk it is **not** the grid of bar lines the design intends.

It was left alone deliberately. The fix is small — prefer a body start that is
both a strong onset and near a bar line — but it would move version A's 15 and
30 second body starts, and A's masters are snapped to the beds as they are. That
is a call for whoever owns the release, not for this work package.

---

## What could not be determined without ears

Three things, and the first is the only one that blocks anything.

1. **The SUNO plan tier on 2026-09-19/20.** Nothing in the file says; the
   `comment` tag records the tool and the generation id but not the account's
   plan. `docs/suno-prompt.md` and `docs/release.md` § 0 both say to check this
   **before generating**, because commercial rights attach to the tier active
   when an asset is created and upgrading afterwards does not license what
   already exists — twelve ElevenLabs assets were deleted over precisely this
   (`docs/decisions.md` D4). The previous take carries a dated paid-tier
   confirmation for 2026-09-08. **A dated confirmation covering 2026-09-19 is
   owed before anything is rendered with this bed**, and only the founder can
   give it.
2. **Whether the splice is audible.** The numbers say the two halves meet on
   measured onsets a bar apart, with an equal-power crossfade. They cannot say
   whether the join stumbles or the beat doubles. Listen four to six seconds
   from the end of each bed; `docs/suno-prompt.md` § *What to check afterwards*
   says what each fault sounds like. The risk is slightly higher here than on
   the previous take, because this one's tempo *moves* — the body's local bar
   near the splice and the ending's local bar are not the same length.
3. **Whether it is the right piece of music.** Brighter, faster, busier and
   flatter are all measurable and all true. Whether it sounds like daylight and
   paper rather than a stock corporate cue is not a number, and nothing above
   should be read as claiming it is.

A fourth, smaller one: the section characters in the table are read off kick
share, air share, centroid and onset density. Calling section 7 "the chorus"
would be a guess, so the table does not.
