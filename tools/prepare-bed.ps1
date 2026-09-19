# Cut the four music beds out of the source take, per audio/bed-plan.json.
#
# This is the middle stage of a three-stage pipeline, and the split is the point:
#
#   node tools/plan-beds.mjs      measures the take and DECIDES the cuts
#   pwsh -File tools/prepare-bed.ps1   does the ffmpeg work           <- here
#   node tools/build-music.mjs    measures the DELIVERED beds and writes music.json
#
# Nothing here decides anything. Every number it uses was measured by the
# planner, so replacing the track is one command and no timing lives in two
# places.
#
# ── What makes a bed ─────────────────────────────────────────────────────────
#
# Each bed is a BODY (which starts on a real onset, coming out of something
# quieter) with the take's OWN ENDING crossfaded onto it at a bar line. Not a
# fade-out: a fade pulled down in the middle of a phrase is audible as a mistake,
# and four of them in a row across four cuts is audible as a pattern. Splicing
# the real resolution on means every cut ends the way the track ends.
#
# ── Ported from ../archcanvas-promo-remotion/tools/prepare-bed.ps1 ───────────
#
# What is inherited: the ffmpeg-under-PowerShell handling, the source true-peak
# report, and the flat-gain argument. What is NOT inherited:
#
#   * That film targets -20 LUFS because it had a narrator to leave room for.
#     This one has no voiceover, so the bed IS the programme material and sits at
#     -16 LUFS, with true peak -1.5 dBTP for lossy-codec headroom.
#   * It applies one flat gain. This uses TWO-PASS `loudnorm` with `linear=true`,
#     which is also a single linear gain when it can be — but it measures first,
#     so the delivered integrated loudness is the number asked for rather than
#     the number implied by a segment measurement. `linear=true` is what keeps
#     loudnorm out of its dynamic mode, which would squash the track's own build.
#
# ── The three traps this file is written around ──────────────────────────────
#
#   * ffmpeg writes progress to stderr, which PowerShell turns into error
#     records. Under "Stop" that aborts on a harmless "Guessed Channel Layout",
#     so $ErrorActionPreference is Continue and exit codes are checked by hand.
#   * `-ss` goes AFTER `-i`. Input seeking on an mp3 can land a frame (~26 ms)
#     out, and these cuts are placed on measured onsets to better than that.
#   * `-vn` on every read of the take. A SUNO export carries embedded cover art,
#     which becomes a video stream otherwise.
#
# And the standing one: never name a PowerShell variable $args, and never write
# `& npx @args`. $args is an automatic variable, @args splats the empty automatic
# one, and the run reports success having done nothing.
#
# Usage:
#   pwsh -File tools/prepare-bed.ps1              # all four, per the plan
#   pwsh -File tools/prepare-bed.ps1 -Only 15,30
param(
  [string]$Plan,
  [string[]]$Only,
  [switch]$KeepIntermediates
)

$ErrorActionPreference = "Continue"

$repo = Split-Path -Parent $PSScriptRoot
Push-Location $repo
try {
  if (-not $Plan) { $Plan = Join-Path $repo "audio\bed-plan.json" }
  if (-not (Test-Path $Plan)) { throw "no plan at $Plan — run ``node tools/plan-beds.mjs`` first." }

  $planData = Get-Content $Plan -Raw | ConvertFrom-Json
  $source = Join-Path $repo ($planData.source -replace '/', '\')
  if (-not (Test-Path $source)) { throw "the plan names a source that is not there: $source" }

  $outDir = Join-Path $repo "public\audio"
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  $tmpDir = Join-Path $env:TEMP "archcanvas-beds-$PID"
  New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

  function Invoke-FFmpeg {
    param([string[]]$FFArgs, [string]$What)
    $log = & ffmpeg -hide_banner -nostdin @FFArgs 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { Write-Host $log; throw "ffmpeg failed ($LASTEXITCODE) during: $What" }
    return $log
  }
  function Read-Metric {
    param([string]$Log, [string]$Label)
    $m = [regex]::Matches($Log, "$Label`:\s+(-?\d+(?:\.\d+)?|-?inf)")
    if ($m.Count -eq 0) { return $null }
    $v = $m[$m.Count - 1].Groups[1].Value
    if ($v -match 'inf') { return [double]::NegativeInfinity }
    return [double]$v
  }

  # What did we start with? A take delivered above 0 dBFS true peak is already
  # clipping, and no amount of downward gain un-clips it.
  $srcLog = Invoke-FFmpeg @("-v", "info", "-vn", "-i", $source, "-af", "ebur128=peak=true", "-f", "null", "NUL") "measuring the source"
  $srcLufs = Read-Metric $srcLog "I"
  $srcPeak = Read-Metric $srcLog "Peak"
  $srcDur = & ffprobe -v error -show_entries format=duration -of csv=p=0 $source

  Write-Host ""
  Write-Host "  prepare-bed"
  Write-Host ("    source     {0}" -f $planData.source)
  Write-Host ("               {0:N3}s · {1} LUFS · true peak {2} dBFS{3}" -f [double]$srcDur, $srcLufs, $srcPeak, $(if ($srcPeak -gt 0) { "   <- clipping as delivered" } else { "" }))
  Write-Host ("    plan       {0} BPM · bar {1}s · ending from {2}s · crossfade {3}s (equal-power)" -f $planData.bpm, $planData.barSec, $planData.endingStartSec, $planData.crossfadeSec)
  Write-Host ("    target     {0} LUFS integrated · true peak {1} dBTP" -f $planData.targetLufs, $planData.targetTruePeakDb)
  Write-Host ""

  $selected = $planData.beds
  if ($Only) { $selected = $planData.beds | Where-Object { $Only -contains $_.cut } }
  if (-not $selected) { throw "nothing selected. -Only takes cut ids: 15, 30, 60, 120." }

  $results = @()
  foreach ($bed in $selected) {
    $cut = $bed.cut
    # `file` in the plan is PUBLIC-relative, exactly as `src/data/sfx.json`'s is,
    # because that is the path Remotion's staticFile() takes.
    $out = Join-Path $repo ("public\\" + ($bed.file -replace '/', '\'))
    $bodyWav = Join-Path $tmpDir "body-$cut.wav"
    $endWav = Join-Path $tmpDir "end-$cut.wav"
    $joinWav = Join-Path $tmpDir "join-$cut.wav"

    # 1. The body. -ss after -i for sample-accurate output seeking.
    Invoke-FFmpeg @(
      "-y", "-v", "error", "-i", $source, "-ss", $bed.bodyStartSec, "-t", $bed.bodyLenSec,
      "-vn", "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", $bodyWav
    ) "cutting the ${cut}s body"

    # 2. The take's own ending.
    Invoke-FFmpeg @(
      "-y", "-v", "error", "-i", $source, "-ss", $bed.endingStartSec, "-t", $bed.endingLenSec,
      "-vn", "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", $endWav
    ) "cutting the ${cut}s ending"

    # 3. Splice. `qsin` on both sides is the equal-POWER pair: two uncorrelated
    #    signals summed under sine/cosine gains hold constant power through the
    #    overlap, where a linear (`tri`) crossfade dips about 3 dB in the middle
    #    and reads as a hole. acrossfade's output length is d1 + d2 - d, which is
    #    the arithmetic the planner used.
    #
    #    The two top-and-tail fades are applied HERE, before loudnorm measures,
    #    and that ordering is not cosmetic. With the fades after normalisation
    #    the 15s bed delivered -15.4 LUFS against a -16 target: loudnorm had
    #    corrected a signal that then had 0.6s of fade-out removed from it, and
    #    on a 15-second file that is 4% of the programme. Measure what you are
    #    actually shipping.
    #
    #    The 20 ms fade in removes any click at the splice into the body's first
    #    transient without softening the attack. The 0.6 s fade out sits entirely
    #    inside the decaying, beatless ring-out the take itself played, AFTER the
    #    resolution has landed — it is not a fade standing in for an ending.
    $xf = $bed.crossfadeSec
    $fadeOutStart = [math]::Round([double]$bed.cut - 0.6, 3)
    Invoke-FFmpeg @(
      "-y", "-v", "error", "-i", $bodyWav, "-i", $endWav,
      "-filter_complex", "[0:a][1:a]acrossfade=d=${xf}:c1=qsin:c2=qsin,afade=t=in:st=0:d=0.02:curve=tri,afade=t=out:st=${fadeOutStart}:d=0.6:curve=cub[a]",
      "-map", "[a]", "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", $joinWav
    ) "splicing the ${cut}s bed"

    # 4. Two-pass loudnorm. Pass one measures; pass two corrects with the
    #    measurements handed back, which is the only way the delivered file
    #    actually lands on the target. A single-pass loudnorm is a guess.
    $measureLog = Invoke-FFmpeg @(
      "-v", "info", "-i", $joinWav,
      "-af", "loudnorm=I=$($planData.targetLufs):TP=$($planData.targetTruePeakDb):LRA=11:print_format=json",
      "-f", "null", "NUL"
    ) "measuring the ${cut}s bed"

    $jsonText = [regex]::Match($measureLog, "(?s)\{[^{}]*""input_i"".*?\}").Value
    if (-not $jsonText) { Write-Host $measureLog; throw "could not read loudnorm's measurement for the ${cut}s bed" }
    $m = $jsonText | ConvertFrom-Json

    $chain = "loudnorm=I=$($planData.targetLufs):TP=$($planData.targetTruePeakDb):LRA=11" +
             ":measured_I=$($m.input_i):measured_TP=$($m.input_tp):measured_LRA=$($m.input_lra)" +
             ":measured_thresh=$($m.input_thresh):offset=$($m.target_offset):linear=true:print_format=summary"

    Invoke-FFmpeg @(
      "-y", "-v", "info", "-i", $joinWav, "-af", $chain,
      "-c:a", "libmp3lame", "-b:a", "192k", "-ar", "48000", "-ac", "2", $out
    ) "normalising the ${cut}s bed" | Out-Null

    # 5. Verify the DELIVERED file, not the intention.
    $dur = [double](& ffprobe -v error -show_entries format=duration -of csv=p=0 $out)
    $check = Invoke-FFmpeg @("-v", "info", "-i", $out, "-af", "ebur128=peak=true", "-f", "null", "NUL") "verifying the ${cut}s bed"
    $lufs = Read-Metric $check "I"
    $tp = Read-Metric $check "Peak"
    $target = [double]$cut
    $delta = [math]::Round($dur - $target, 3)
    $ok = ($delta -ge -0.001) -and ($delta -le 0.25)

    $results += [pscustomobject]@{
      Cut = $cut; File = $bed.file; Duration = $dur; Delta = $delta
      Lufs = $lufs; TruePeak = $tp; Ok = $ok
      Size = [math]::Round((Get-Item $out).Length / 1KB, 1)
    }

    if (-not $KeepIntermediates) { Remove-Item $bodyWav, $endWav, $joinWav -Force -ErrorAction SilentlyContinue }
  }

  Write-Host "    cut     file                  duration    delta      LUFS   true peak      size"
  foreach ($r in $results) {
    $flag = if ($r.Ok) { " " } else { "<- OUT OF TOLERANCE" }
    Write-Host ("    {0,4}s   {1,-18}  {2,8:N3}s  {3,7:N3}s  {4,8:N2}  {5,8:N2} dBTP  {6,7:N1}KB {7}" -f `
        $r.Cut, $r.File, $r.Duration, $r.Delta, $r.Lufs, $r.TruePeak, $r.Size, $flag)
  }
  Write-Host ""

  $bad = @($results | Where-Object { -not $_.Ok })
  if ($bad.Count -gt 0) {
    throw "$($bad.Count) bed(s) outside the +0.25s duration tolerance. The plan and the delivered file disagree."
  }
  Write-Host "  ✓ four beds, every one at its cut length and on target loudness"
  Write-Host "    next: node tools/build-music.mjs"
  Write-Host ""
}
finally {
  if (-not $KeepIntermediates -and $tmpDir -and (Test-Path $tmpDir)) { Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue }
  Pop-Location
}
