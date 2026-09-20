# Measure the eight masters, write the MANIFEST, and make the review copies.
#
# Run it after render.ps1. One command, so version B costs the same as version A:
#
#   ./tools/package-masters.ps1                       # whatever version is active
#   ./tools/package-masters.ps1 -FilmVersion B-x      # same selector as render.ps1
#
# ── What it produces ─────────────────────────────────────────────────────────
#
#   out/masters/<version>/MANIFEST.json        COMMITTED
#   out/masters/<version>/review/<tag>-720.mp4 not committed
#
# The masters themselves are never touched. A review copy is transcoded FROM the
# master and the master is left exactly as Remotion wrote it.
#
# ── Why the manifest exists ──────────────────────────────────────────────────
#
# The masters ship as GitHub Release assets and are not committed -- tens of MB
# each, eight per version, and git keeps every version forever. A release asset
# with no record in the repo is a file nobody can later prove anything about:
# not which commit rendered it, not which take it is cut to, not whether the
# copy in someone's Downloads folder is the one that was signed off. sha256 and
# the render commit answer all three, and they cost 4 KB.
#
# Every number in it is MEASURED from the delivered file -- duration, frame
# count, pixel format, integrated loudness, true peak. None is copied from what
# the render was asked for. That distinction is this project's oldest lesson:
# every number about the broken sound effects was right while the files were
# wrong (docs/decisions.md D10).
#
# ffmpeg writes progress to stderr, which PowerShell turns into error records,
# so $ErrorActionPreference stays Continue and exit codes are checked by hand.
# And never name a variable $args here.

param(
  [Alias("MusicVersion")]
  [string] $FilmVersion,
  [switch] $SkipReview
)

$ErrorActionPreference = "Continue"

$repo = Split-Path -Parent $PSScriptRoot
$stamp = "2026-09"
$base = "archcanvas-studio-$stamp"

# Same single source as render.ps1: what the version IS and where it writes come
# out of `src/version.ts` and `src/audio.ts` § outDirFor, through
# `tools/version-info.mjs`. A manifest that guessed its own output folder could
# describe files in a folder it was not looking at.
if (-not $FilmVersion) {
  $FilmVersion = if ($env:REMOTION_FILM_VERSION) { $env:REMOTION_FILM_VERSION }
                 elseif ($env:FILM_VERSION) { $env:FILM_VERSION }
                 else { $null }
}
$infoArgs = @((Join-Path $repo "tools\version-info.mjs"))
if ($FilmVersion) { $infoArgs += @("--version", $FilmVersion) }
$infoJson = & node @infoArgs
if ($LASTEXITCODE -ne 0) { Write-Host ($infoJson | Out-String) -ForegroundColor Red; exit 1 }
$info = $infoJson | ConvertFrom-Json
$FilmVersion = $info.version
$entry = $info

$outDir = Join-Path $repo ($info.outDir -replace '/', '\')
if (-not (Test-Path $outDir)) { Write-Host "nothing rendered for $FilmVersion -- $outDir does not exist" -ForegroundColor Red; exit 1 }
$reviewDir = Join-Path $outDir "review"

$targets = @(
  @{ tag = "15l";  cut = 15;  w = 1920; h = 1080; file = "${base}_15s_landscape_1920x1080.mp4" },
  @{ tag = "15v";  cut = 15;  w = 1080; h = 1920; file = "${base}_15s_vertical_1080x1920.mp4" },
  @{ tag = "30l";  cut = 30;  w = 1920; h = 1080; file = "${base}_30s_landscape_1920x1080.mp4" },
  @{ tag = "30v";  cut = 30;  w = 1080; h = 1920; file = "${base}_30s_vertical_1080x1920.mp4" },
  @{ tag = "60l";  cut = 60;  w = 1920; h = 1080; file = "${base}_60s_landscape_1920x1080.mp4" },
  @{ tag = "60v";  cut = 60;  w = 1080; h = 1920; file = "${base}_60s_vertical_1080x1920.mp4" },
  @{ tag = "120l"; cut = 120; w = 1920; h = 1080; file = "${base}_120s_landscape_1920x1080.mp4" },
  @{ tag = "120v"; cut = 120; w = 1080; h = 1920; file = "${base}_120s_vertical_1080x1920.mp4" }
)

function Read-Metric {
  param([string]$Log, [string]$Label)
  $m = [regex]::Matches($Log, "$Label`:\s+(-?\d+(?:\.\d+)?|-?inf)")
  if ($m.Count -eq 0) { return $null }
  $v = $m[$m.Count - 1].Groups[1].Value
  if ($v -match 'inf') { return [double]::NegativeInfinity }
  return [double]$v
}

# The delivered-file thresholds. They mirror `verify:loudness`'s, deliberately:
# the gate predicts against these and this asserts them, so a disagreement
# between the two is visible as one film passing there and failing here rather
# than as two different standards.
$TRUE_PEAK_MAX = -1.5
$LUFS_TARGET = -16
$LUFS_WINDOW = 0.5

# A fingerprint of the RESOLVED cue sheet, per cut. `verify:loudness` has to
# tell a stale master from a wrong model, and its own note says the
# discriminator it wants is exactly this -- until now it asked git what the trim
# was at `renderCommit`, which cannot answer through a dirty tree or a shallow
# clone, and which sees only the per-cut dial. Anything else that moves a cue
# changes the sound without moving that table. A hash of the sheet makes
# staleness a property of THIS FILE.
$cueShaJson = & node (Join-Path $repo "tools\cue-sha.mjs") --version $FilmVersion
$cueSha = if ($LASTEXITCODE -eq 0) { $cueShaJson | ConvertFrom-Json } else { $null }
if (-not $cueSha) { Write-Host "  (could not compute cue-sheet hashes -- rows will omit them)" -ForegroundColor Yellow }

$commit = (& git -C $repo rev-parse HEAD).Trim()

# The manifest cannot meaningfully report on its OWN pending state. Writing it
# is what makes it dirty, so counting it made every manifest say the tree was
# dirty -- which is the same as saying nothing, and worse, because it reads
# like a warning. Everything else still counts: a master rendered from
# uncommitted source is a real thing to know about.
# The pattern covers out/previews/ too: an audition writes a manifest exactly
# as a master does, and a filter that only knew about out/masters/ would have
# reported every audition as rendered from a dirty tree.
$dirty = @(& git -C $repo status --porcelain |
  Where-Object { $_ -notmatch 'out/.*/MANIFEST\.json$' }).Count -gt 0

Write-Host ""
Write-Host "  package-masters · $FilmVersion · edit $($info.edit) · sfx $($info.sfxSet) · $($entry.track)"
Write-Host ("    commit {0}{1}" -f $commit.Substring(0, 12), $(if ($dirty) { "  (working tree DIRTY -- this manifest describes an uncommitted state)" } else { "" }))
Write-Host ""

$rows = @()
$problems = @()

foreach ($t in $targets) {
  $p = Join-Path $outDir $t.file
  if (-not (Test-Path $p)) { $problems += "$($t.tag): MISSING"; Write-Host ("    {0,-5} MISSING" -f $t.tag) -ForegroundColor Red; continue }

  $item = Get-Item $p

  # Stream-level, not container-level. An mp4's format duration is the LONGEST
  # stream, and AAC pads its tail to a whole 1024-sample frame -- so the
  # container reads ~60 ms long on a picture that is exactly right. The picture
  # is what the frame count answers.
  $vraw = & ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,duration,pix_fmt -of json $p | Out-String
  $araw = & ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels,duration -of json $p | Out-String
  $fraw = & ffprobe -v error -show_entries format=duration,bit_rate -of json $p | Out-String
  $v = ($vraw | ConvertFrom-Json).streams[0]
  $a = ($araw | ConvertFrom-Json).streams
  $f = ($fraw | ConvertFrom-Json).format

  $frames = [int]$v.nb_frames
  $fps = [double]($v.r_frame_rate -split '/')[0] / [double]($v.r_frame_rate -split '/')[1]
  $expectedFrames = $t.cut * 30

  # Loudness and true peak, measured on the delivered file. -16 LUFS is the
  # target the beds were normalised to; the effects sit on top, so a master
  # reads a little hotter than its bed and that is expected.
  $eburLog = & ffmpeg -hide_banner -nostdin -v info -i $p -af "ebur128=peak=true" -f null NUL 2>&1 | Out-String
  $lufs = Read-Metric $eburLog "I"
  $lra = Read-Metric $eburLog "LRA"
  $tp = Read-Metric $eburLog "Peak"

  # An actual mean volume, because "there is an audio stream" is not "there is
  # sound in it". @remotion/media's <Audio> once previewed fine and rendered
  # -91 dB across the whole file.
  $volLog = & ffmpeg -hide_banner -nostdin -v info -i $p -af "volumedetect" -f null NUL 2>&1 | Out-String
  $meanVol = Read-Metric $volLog "mean_volume"
  $maxVol = Read-Metric $volLog "max_volume"

  $sha = (Get-FileHash $p -Algorithm SHA256).Hash.ToLower()

  # ── The delivered file is the final gate ──────────────────────────────────
  #
  # `verify:loudness` predicts from an offline mix, and a prediction is an EARLY
  # WARNING, not a verdict. It was shown to be exactly that: the A 60s cut's
  # mix peaks at -2.40 dBTP and the rendered master measures -1.2, so the gate
  # reported green on a film 0.3 dB over its own ceiling. Encoding accounts for
  # 0.1-0.2 dB of that; the rest is the offline mix and the composition
  # disagreeing about the first 64 ms.
  #
  # So these two numbers are asserted HERE, against the bytes that ship, and a
  # film that fails is recorded `verified: false` with the reason rather than
  # quietly listed beside the ones that passed. A manifest is a receipt, and a
  # receipt that cannot say "this one did not pass" is not one.
  $issues = @()
  if ($frames -ne $expectedFrames) { $issues += "$frames frames, expected $expectedFrames" }
  if ($v.width -ne $t.w -or $v.height -ne $t.h) { $issues += "$($v.width)x$($v.height), expected $($t.w)x$($t.h)" }
  if ($v.pix_fmt -ne "yuv420p") { $issues += "pix_fmt $($v.pix_fmt)" }
  if ($fps -ne 30) { $issues += "$fps fps" }
  if (-not $a) { $issues += "NO AUDIO STREAM" }
  elseif ($meanVol -lt -40) { $issues += "mean volume $meanVol dB -- effectively silent" }
  if ($tp -gt $TRUE_PEAK_MAX) { $issues += ("true peak {0} > {1} dBTP" -f $tp, $TRUE_PEAK_MAX) }
  if ([math]::Abs($lufs - $LUFS_TARGET) -gt $LUFS_WINDOW) {
    $issues += ("{0} LUFS, outside {1} +/- {2}" -f $lufs, $LUFS_TARGET, $LUFS_WINDOW)
  }
  foreach ($i in $issues) { $problems += "$($t.tag): $i" }

  $rows += [pscustomobject]@{
    tag = $t.tag
    file = $t.file
    bytes = $item.Length
    sha256 = $sha
    durationSec = [math]::Round([double]$f.duration, 3)
    videoDurationSec = [math]::Round([double]$v.duration, 3)
    frames = $frames
    fps = $fps
    width = $v.width
    height = $v.height
    videoCodec = $v.codec_name
    pixelFormat = $v.pix_fmt
    audioCodec = if ($a) { $a[0].codec_name } else { $null }
    audioSampleRate = if ($a) { [int]$a[0].sample_rate } else { $null }
    audioChannels = if ($a) { [int]$a[0].channels } else { $null }
    lufs = $lufs
    lra = $lra
    truePeakDb = $tp
    meanVolumeDb = $meanVol
    maxVolumeDb = $maxVol
    audioBitrate = if ($a -and $a[0].bit_rate) { [int]$a[0].bit_rate } else { $null }
    audioProfile = if ($a) { $a[0].profile } else { $null }
    bitrate = [int]$f.bit_rate
    modified = $item.LastWriteTime.ToString("s")
    # The resolved cue sheet this film was rendered from, as a hash — so a
    # later run can tell "this master is old" from "the model is wrong" without
    # asking git anything.
    cueSheetSha = if ($cueSha) { $cueSha.($t.cut.ToString()) } else { $null }
    # The verdict, and it is about THIS file rather than a model of it.
    verified = $issues.Count -eq 0
    reason = if ($issues.Count -eq 0) { $null } else { $issues -join "; " }
  }

  $mark = if ($issues.Count -eq 0) { "ok " } else { "NOT" }
  $colour = if ($issues.Count -eq 0) { "Gray" } else { "Red" }
  Write-Host ("    {0,-5} {1,6:N1} MB  {2,4}x{3,-4} {4,5} frames  {5,7:N3}s  {6,7:N1} LUFS  {7,6:N1} dBTP  mean {8,6:N1} dB   {9}" -f `
      $t.tag, ($item.Length / 1MB), $v.width, $v.height, $frames, [double]$v.duration, $lufs, $tp, $meanVol, $mark) -ForegroundColor $colour
  if ($issues.Count -gt 0) { Write-Host ("          ^ $($issues -join '; ')") -ForegroundColor Red }
}

$manifestPath = Join-Path $outDir "MANIFEST.json"

# ── supersession history ────────────────────────────────────────────────────
#
# A re-render REPLACES the mp4s, and the mp4s are not committed -- so without
# this the record of the previous render vanishes with the files, and a release
# asset someone downloaded last week becomes unattributable. Keeping 100 MB of
# stale masters on disk to preserve that is the wrong trade; keeping their
# commit and date in a few lines of JSON is the right one.
#
# Only the render commit, the date and the reason are carried forward, not the
# old per-file hashes: the point is "which build was this, and what replaced
# it", and a hash for a file nobody has is noise.
#
# The trigger is the FILES CHANGING, not the commit changing. Re-running this
# script to re-measure the same masters -- which is an ordinary thing to do,
# and the first thing you do after committing a change to this script -- moves
# the commit without producing a new render. Keying supersession off the commit
# made that log the render as having superseded ITSELF, which is a false
# history entry in the one file whose whole job is to be the true record.
$history = @()
$supersededByHashes = $false
if (Test-Path $manifestPath) {
  $prev = Get-Content $manifestPath -Raw | ConvertFrom-Json
  if ($prev.supersedes) { $history += $prev.supersedes }

  $prevHashes = @($prev.masters | ForEach-Object { $_.sha256 } | Sort-Object)
  $newHashes = @($rows | ForEach-Object { $_.sha256 } | Sort-Object)
  $supersededByHashes = ($prevHashes.Count -gt 0) -and (($prevHashes -join ",") -ne ($newHashes -join ","))

  if ($supersededByHashes -and $prev.renderCommit) {
    $history += [ordered]@{
      renderCommit = $prev.renderCommit
      renderedOn   = $prev.renderedOn
      filmVersion = $prev.filmVersion
      note         = "superseded by $($commit.Substring(0,12))"
    }
  }
}

$manifest = [ordered]@{
  '$comment' = "Generated by tools/package-masters.ps1 — do not hand-edit. Every number is MEASURED from the delivered file, not copied from what the render was asked for. The mp4s are not committed (GitHub Release assets); this is the record of what they were, and `supersedes` is the record of the builds they replaced. See docs/release.md."
  filmVersion = $FilmVersion
  # All three, because a version IS all three and a manifest naming only the
  # music could not tell two films apart. `+el` shares A's take and edit and is
  # a different film.
  music = $info.music
  edit = $info.edit
  sfxSet = $info.sfxSet
  release = $info.release
  outDir = $info.outDir
  track = $entry.track
  bpm = $entry.bpm
  # Copied from the version record rather than asserted here: whether these
  # files may be published is `verify:release`'s answer, and this is its
  # receipt. An audition manifest that did not say so would be the one document
  # able to launder a quarantined render into a release.
  provenance = $info.provenance
  renderCommit = $commit
  workingTreeDirty = $dirty
  renderedOn = (Get-Date).ToString("yyyy-MM-dd")
  fps = 30
  codec = "h264 / yuv420p, crf 18, AAC audio"
  # The thresholds this manifest was judged against, written down beside the
  # verdict so a reader is never left inferring which ceiling was in force.
  thresholds = [ordered]@{
    truePeakMaxDb = $TRUE_PEAK_MAX
    lufsTarget = $LUFS_TARGET
    lufsWindow = $LUFS_WINDOW
    measuredOn = "the delivered file, not the offline mix"
  }
  verifiedCount = @($rows | Where-Object { $_.verified }).Count
  supersedes = $history
  masters = $rows
}

$manifest | ConvertTo-Json -Depth 6 | Set-Content $manifestPath -Encoding utf8
Write-Host ""
Write-Host ("  wrote {0} -- {1} of {2} film(s) verified" -f (Resolve-Path -Relative $manifestPath), $manifest.verifiedCount, $rows.Count)

# --- review copies ----------------------------------------------------------
#
# Small enough to send, and they play anywhere. Landscape goes to 1280 wide,
# portrait to 720 wide, so both land on a 720-tall-ish picture. Transcoded FROM
# the master; the master is never re-encoded in place.
if (-not $SkipReview) {
  New-Item -ItemType Directory -Force -Path $reviewDir | Out-Null
  Write-Host ""
  foreach ($t in $targets) {
    $src = Join-Path $outDir $t.file
    if (-not (Test-Path $src)) { continue }
    $dst = Join-Path $reviewDir "$($t.tag)-720.mp4"
    $width = if ($t.w -ge $t.h) { 1280 } else { 720 }
    & ffmpeg -hide_banner -nostdin -y -v error -i $src `
      -vf "scale=${width}:-2" -c:v libx264 -crf 23 -preset medium -pix_fmt yuv420p `
      -c:a aac -b:a 128k $dst 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { $problems += "$($t.tag): review copy failed"; continue }
    Write-Host ("    review  {0,-14} {1,6:N1} MB" -f "$($t.tag)-720.mp4", ((Get-Item $dst).Length / 1MB))
  }
}

Write-Host ""
if ($problems.Count -gt 0) {
  Write-Host "  $($problems.Count) problem(s):" -ForegroundColor Red
  foreach ($p in $problems) { Write-Host "    $p" -ForegroundColor Red }
  exit 1
}
Write-Host "  ✓ eight masters, every one 30 fps h264/yuv420p at its cut length, with audio in it"
Write-Host "    next: npm run verify:flash on EVERY master, not one of them"
Write-Host ""
