# True-peak ground truth — all 32 delivered films

Measured **from the delivered mp4s**, 2026-09-21, on branch `wp/render-b5` after
the #19 re-render. For the agent on `wp/true-peak-model`.

`real` = `ebur128=peak=true` on the file. `pred` = `verify:loudness`'s current
AAC-encoded prediction. `peak @` = the 0.107 s window holding the maximum
(`astats reset=5`), so it answers "opening transient or not", not sample-exact.
**Δ = real − pred; positive means the model is OPTIMISTIC**, which is the
dangerous direction.

## The table

| version | film | real TP | pred TP | Δ | peak @ | real LUFS | pred LUFS | over −1.5? |
|---|---|---|---|---|---|---|---|---|
| A-confident-arrival | 15l | **-3.4** | -3.6 | +0.20 | 0.064s | -15.5 | -15.5 | no |
| A-confident-arrival | 15v | **-3.4** | -3.6 | +0.20 | 0.064s | -15.5 | -15.5 | no |
| A-confident-arrival | 30l | **-4.1** | -4.2 | +0.10 | 0.064s | -16.0 | -16.0 | no |
| A-confident-arrival | 30v | **-4.1** | -4.2 | +0.10 | 0.064s | -16.0 | -16.0 | no |
| A-confident-arrival | 60l | **-1.2** | -2.3 | +1.10 | 0.064s | -16.2 | -16.2 | **YES** |
| A-confident-arrival | 60v | **-1.2** | -2.3 | +1.10 | 0.064s | -16.2 | -16.2 | **YES** |
| A-confident-arrival | 120l | **-3.0** | -3.1 | +0.10 | 31.509s | -16.2 | -16.1 | no |
| A-confident-arrival | 120v | **-3.0** | -3.1 | +0.10 | 31.509s | -16.2 | -16.1 | no |
| B-daylight-forward | 15l | **-2.2** | -2.1 | -0.10 | 1.472s | -16.3 | -16.3 | no |
| B-daylight-forward | 15v | **-2.2** | -2.1 | -0.10 | 1.472s | -16.3 | -16.3 | no |
| B-daylight-forward | 30l | **-3.2** | -3.6 | +0.40 | 2.005s | -16.1 | -16.1 | no |
| B-daylight-forward | 30v | **-3.2** | -3.6 | +0.40 | 2.005s | -16.1 | -16.1 | no |
| B-daylight-forward | 60l | **-3.3** | -3.4 | +0.10 | 13.035s | -16.2 | -16.2 | no |
| B-daylight-forward | 60v | **-3.3** | -3.4 | +0.10 | 13.035s | -16.2 | -16.2 | no |
| B-daylight-forward | 120l | **-2.1** | -1.8 | -0.30 | 115.499s | -16.1 | -16.1 | no |
| B-daylight-forward | 120v | **-2.1** | -1.8 | -0.30 | 115.499s | -16.1 | -16.1 | no |
| A-confident-arrival+el | 15l | **-4.2** | -4.2 | 0.00 | 8.981s | -15.5 | -15.5 | no |
| A-confident-arrival+el | 15v | **-4.2** | -4.2 | 0.00 | 8.981s | -15.5 | -15.5 | no |
| A-confident-arrival+el | 30l | **-4.2** | -4.1 | -0.10 | 24.747s | -15.9 | -15.9 | no |
| A-confident-arrival+el | 30v | **-4.2** | -4.1 | -0.10 | 24.747s | -15.9 | -15.9 | no |
| A-confident-arrival+el | 60l | **-2.7** | -2.9 | +0.20 | 0.064s | -16.1 | -16.1 | no |
| A-confident-arrival+el | 60v | **-2.7** | -2.9 | +0.20 | 0.064s | -16.1 | -16.1 | no |
| A-confident-arrival+el | 120l | **-3.3** | -3.5 | +0.20 | 10.133s | -16.2 | -16.2 | no |
| A-confident-arrival+el | 120v | **-3.3** | -3.5 | +0.20 | 10.133s | -16.2 | -16.2 | no |
| B-daylight-forward+el | 15l | **-1.9** | -2.2 | +0.30 | 0.064s | -16.5 | -16.5 | no |
| B-daylight-forward+el | 15v | **-1.9** | -2.2 | +0.30 | 0.064s | -16.5 | -16.5 | no |
| B-daylight-forward+el | 30l | **-3.5** | -3.4 | -0.10 | 9.173s | -16.1 | -16.1 | no |
| B-daylight-forward+el | 30v | **-3.5** | -3.4 | -0.10 | 9.173s | -16.1 | -16.1 | no |
| B-daylight-forward+el | 60l | **-4.1** | -4.2 | +0.10 | 55.872s | -16.2 | -16.2 | no |
| B-daylight-forward+el | 60v | **-4.1** | -4.2 | +0.10 | 55.872s | -16.2 | -16.2 | no |
| B-daylight-forward+el | 120l | **-2.1** | -2.3 | +0.20 | 115.499s | -16.2 | -16.2 | no |
| B-daylight-forward+el | 120v | **-2.1** | -2.3 | +0.20 | 115.499s | -16.2 | -16.2 | no |

## The audio stream, which is identical across all 32

```
codec aac   profile LC   48000 Hz   2 ch
bit_rate 317375 (~317 kbps)
```

Every film reports the same codec, profile, sample rate and channel count; the
measured `bit_rate` varies only with content. The gate encodes its mix at a
hard-coded `AAC_BITRATE = "192k"` (`capture/lib/mix.mjs`), which is **not** what
Remotion delivers — but see below, because that turned out not to be the cause.

## What the numbers say

**30 of 32 films agree within ±0.4 dB.** Two do not, and they are the same film
in both aspects:

> **`A-confident-arrival` 60 s L+V — real −1.2, predicted −2.3, Δ +1.1.**
> Both are recorded `verified: false` in that version's MANIFEST, reason
> `true peak −1.2 > −1.5 dBTP`.

### The bitrate hypothesis is dead — I tested it

Same A 60 s mix, measured four ways:

| | dBTP |
|---|---|
| the gate's float mix, no encode at all | **−2.40** |
| AAC 192k (what the gate measures today) | −2.30 |
| AAC 256k | −2.30 |
| AAC 320k | −2.20 |
| **the delivered master** | **−1.2** |

Encoding is worth 0.1–0.2 dB and matching the delivery bitrate would buy about
0.1. **The offline mix itself is 1.2 dB below what Remotion renders.** Encoding
the mix more faithfully is still the right change — it removes a known 0.1–0.2 dB
of optimism — but it will not close this gap, and if it is the only change the
model will still pass A 60 s.

### The sharpest clue: it is not simply "peaks at the opening"

Six films peak in the first window (0.064 s) and five of them agree:

| film | peak @ | Δ |
|---|---|---|
| A 15 s | 0.064 s | +0.2 |
| A 30 s | 0.064 s | +0.1 |
| A+el 60 s | 0.064 s | +0.2 |
| B+el 15 s | 0.064 s | +0.3 |
| **A 60 s** | **0.064 s** | **+1.1** |

**`A` 60 s and `A+el` 60 s share a bed, a take and an edit and differ only in the
sound set — and the +el one agrees.** So the discrepancy is not in the bed, not
in the time warp and not in the duck: it is in how the **synth** cue landing at
the opening of the 60 s cut is summed. Worth checking first:

- the cue's gain/role resolution for `synth` at `t ≈ 0` in `capture/lib/mix.mjs`
  against `src/components/FilmAudio.tsx`;
- whether an opening cue is summed **once in one and twice in the other** — a
  doubled cue is +6 dB on the sample and would show as roughly this;
- `alignBy` / `alignOffsetSec` for that cue: an offset applied in one place and
  not the other moves the cue onto or off the bed's own first transient, and
  summing with it rather than beside it is worth about this much.

The 60 s A bed also enters the take at `sourceBodyStartSec: 19.05` where the 15/30
beds enter at 99.81 and the 120 at 9.53, so its first samples are the loudest
entry of the four — which is why this cut is the one where a mis-summed opening
cue shows up.

## What I changed on my side

`tools/package-masters.ps1` now asserts **true peak ≤ −1.5 dBTP and integrated
−16 ± 0.5 LUFS on the delivered file**, records `verified` + `reason` per film in
the MANIFEST, prints `thresholds` beside the verdict, and exits non-zero if any
film fails. Reality is the final gate; the offline prediction is the early
warning. 30 of 32 films are `verified: true`.
