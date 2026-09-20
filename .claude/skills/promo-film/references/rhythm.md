# Rhythm — how long a beat is, and why

Length is decided by what a viewer must read and what the product must finish doing.
The bar grid arrives afterwards, to align what is already the right length.

## Budgets

| | 15 s | 30 s | 60 s | 120 s |
|---|---|---|---|---|
| beats | 7 | 10 | 13 | 20 |
| median beat | ~1.9 s | ~2.7 s | ~4.4 s | ~7.0 s |
| shortest | 1.6 s | 1.8 s | 2.2 s | 2.2 s |

Shape, at every length: a hook card, the product doing the thing, a claim, one or more
proofs, the end card. The short cuts drop proofs rather than shortening all of them — a
beat cut below what it needs reads as a glitch, not as pace.

**A card is 1.2–2.2 s** (`CARD_SEC`, `src/scenes.ts:399`). Under 1.2 s it cannot be read;
over 2.2 s the cut stops moving. The end card is exempt **by kind** — it is the resting
frame, 1.9–4.2 s across the four cuts. `verify:timeline --strict` makes the pace note fatal.

**No beat holds more than 2.5 s without motion** (`STATIC_MAX_SEC`,
`capture/verify-opening.mjs:201`). It is cleared by a real camera push (`|log(push)| > 0.03`)
or by at least 0.4 s of replica play. This is not "add motion to beat the detector" — it is
"if nothing is happening for two and a half seconds, the beat is too long".

**`MIN_BEAT_SEC = 0.5`** (`src/timeline.ts:145`). Below that a beat is a flash.

## Beat micro-structure

Every beat: **establish → the action → the result readable → cut.** The failure modes are
symmetrical — everything arriving at once and then holding still, or an action that
finishes after the cut has taken it away. Put the explaining text in early so reading
overlaps the demonstration rather than following it.

**Claim before proof.** A card that names the capability, then the product proving it,
reads as evidence. The reverse reads as a caption apologising for what just happened.
Where a cut does the draw first and the claim after, that is worth revisiting.

**Draw by bars, not by seconds.** The plan drawing itself out is the money shot; its
length should be a whole number of bars so its internal rhythm agrees with the bed, and
the hand-over of the honesty caption happens at the beat's start
(`DRAW_HANDOFF_SEC`, derived from the synced screenplay in `src/honesty.ts` — never a
literal, because upstream moves).

**Vary the layout in montages.** The 120 s second-brief montage shows four other published
plans; four identical frames in a row is the one place this film can read as a slideshow.
Change what the pane is doing, not just what is in it.

**Stillness is allowed** — for reading, and for the end card. What is not allowed is a
long hold with no information in it.

## Snapping

`src/timeline.ts` pulls each boundary to the nearest downbeat of that cut's own bed within
**±150 ms**, and returns the time unchanged beyond that tolerance. At 30 fps, 150 ms is
4.5 frames — enough to be felt, which is why the tolerance is a window and not a magnet.

Policy:

- **Chapter boundaries want a downbeat.** A cut between sections that lands off the bar is
  the one a viewer notices.
- **A small action inside a beat does not.** Let it fall where the product puts it.
- **Never quantise everything to one length.** Uniform beats are what makes an edit read
  as mechanical; the variation between 1.6 s and 3.3 s in the 15 s cut is doing work.
- Boundaries are absolute seconds converted once, last beat absorbing the rounding
  (`src/timeline.ts:290-300`), so a snap moves two beats and changes no total. After a
  music swap `verify:timeline` prints how many moved — **that is the system working.**
  Seven moved when version B landed, none by more than 0.14 s.

Use the take's own arrangement: put the biggest reveal near the take's biggest energy
jump, a chapter boundary on a crash, and the end card after the arrangement stops so the
ring-out covers it. `docs/music/<slug>.md` lists the fills, crashes, the drop and where
the arrangement ends, in film time.

## Camera as rhythm

One push per chapter; no flying camera. Every shot arrives 1.045 → 1.0 over 8 frames
(`ENTRY_SEC = 0.26`, `ENTRY_FROM = 1.045`, `src/camera.ts:883-904`) — a reveal, not a fade,
and scale-only so an entrance cannot slide a caption off frame. Cuts are ~0.28 s on
`Easing.out(cubic)` and the `ColourWipe` slides the leaving colour off over 8 frames.

Framing is decided **per beat, not per frame** — deciding it per frame once lurched 35 %
in the last half-second. `verify:framing` samples at 95 % through the beat: subject ≤ 104 %
of the visible frame (`CROP_TOLERANCE`), everything visible covering ≥ 22 % (`SUBJECT_MIN`),
opposing empty bands within 0.28 of each other (`LOPSIDED_MAX`), hero type at ≥ 0.7 of the
frame landscape / 0.84 of the **safe** width portrait.
