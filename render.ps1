# The eight masters. H.264, yuv420p so the files play everywhere.
#
# Usage: .\render.ps1                     renders all eight, in order
#        .\render.ps1 -Only 15l           renders one  (15l 15v 30l 30v 60l 60v 120l 120v)
#        .\render.ps1 -Only 15            renders both aspect ratios of one cut
#        .\render.ps1 -Scale 0.5          half-size proof renders, for looking at
#        .\render.ps1 -Concurrency 1      one browser tab; slower, least memory
#        .\render.ps1 -ListOnly           print the plan and the orphan scan, render nothing
#        .\render.ps1 -MusicVersion B-x   assert the music version and file the masters under it
#        .\render.ps1 -Bundle <dir>       render from a bundle built once (see -ListOnly output)
#
# Masters are NOT committed -- tens of MB each, eight of them, and git keeps every
# version forever. They ship as GitHub Release assets. Only the MANIFEST.json
# beside them is committed. See .gitignore.
#
# ── The masters are filed by MUSIC VERSION ───────────────────────────────────
#
#   out/masters/<version>/archcanvas-studio-...mp4
#
# The film's edit is snapped to the music: `timeline.ts` pulls every scene
# boundary onto the nearest downbeat of the cut's own bed, so a master is the
# picture AND the take, and two takes are two sets of eight. `-MusicVersion` is
# NOT a switch -- `src/data/music.json`'s `active` field decides which take the
# film is cut to, and this only says which one you BELIEVE is active. If the two
# disagree the run stops, because a master filed under the wrong music is worse
# than no master: it looks like a deliverable. Change the active version with
# `node tools/use-music.mjs <version>`, and read docs/release.md.
#
# SEQUENTIAL, ALWAYS. Eight renders on a 16 GB box that is also running the
# founder's browser is not a place to be clever. Each finishes before the next
# starts, and the orphan scan runs between them.

param(
  [ValidateSet("all", "15", "30", "60", "120", "15l", "15v", "30l", "30v", "60l", "60v", "120l", "120v")]
  [string] $Only = "all",

  [double] $Scale = 1.0,

  # Defaults to whatever `src/data/music.json` says is active, so the ordinary
  # run needs no argument and still files its output correctly. Passing it is an
  # ASSERTION, checked below.
  [string] $MusicVersion,

  # A pre-built bundle directory (`npx remotion bundle`). Eight renders bundle
  # the same sources eight times otherwise -- about a minute each, on the box
  # that is also doing the rendering.
  [string] $Bundle,

  # Remotion's default concurrency is roughly half the core count, which on this
  # 16 GB machine is 4+ and gets renders KILLED. Each worker is a headless Chrome
  # holding a full replica of a product interface, and the box is shared. 2 is the
  # number the sibling film settled on after 4 did not work. Raise it only on a
  # machine with memory to spare, and watch the first minute.
  [ValidateRange(1, 16)] [int] $Concurrency = 2,

  [switch] $ListOnly
)

# ffmpeg and the Remotion CLI write progress to stderr, which PowerShell turns
# into terminating error records under the default "Stop". Exit codes are checked
# by hand below instead.
$ErrorActionPreference = "Continue"

$repo = $PSScriptRoot
$stamp = "2026-09"
$base  = "archcanvas-studio-$stamp"

# --- which take is this film cut to? ----------------------------------------
#
# Read, never assumed, and read from the one field `src/audio.ts` reads. A
# second copy of "which version is active" is how a master ends up in the wrong
# folder with nothing going red.
$musicPath = Join-Path $repo "src\data\music.json"
if (-not (Test-Path $musicPath)) { Write-Host "no src/data/music.json -- run ``npm run audio:beds``" -ForegroundColor Red; exit 1 }
$musicDoc = Get-Content $musicPath -Raw | ConvertFrom-Json
$activeVersion = $musicDoc.active
if (-not $activeVersion) { Write-Host "src/data/music.json names no active version -- run ``npm run audio:beds``" -ForegroundColor Red; exit 1 }
$activeEntry = $musicDoc.versions.$activeVersion
if (-not $activeEntry) { Write-Host "src/data/music.json names '$activeVersion' as active, which is not one of its versions" -ForegroundColor Red; exit 1 }

if ($MusicVersion -and $MusicVersion -ne $activeVersion) {
  Write-Host ""
  Write-Host "-MusicVersion $MusicVersion, but the film is cut to $activeVersion." -ForegroundColor Red
  Write-Host "  The edit snaps to the ACTIVE take's downbeats, so rendering now would produce"
  Write-Host "  $activeVersion masters in a $MusicVersion folder. Pick one:"
  Write-Host "    node tools/use-music.mjs $MusicVersion   # switch, then re-run ``npm run verify``"
  Write-Host "    ./render.ps1 -MusicVersion $activeVersion"
  Write-Host ""
  exit 1
}
$MusicVersion = $activeVersion

# ── The release gate ────────────────────────────────────────────────────────
#
# Masters may only be rendered from audio the film is allowed to publish, and
# that is not something to remember: `elevenlabs-audition` was generated on a
# free plan whose terms withhold commercial rights from anything created
# outside a paid subscription -- before or after -- so upgrading later would not
# license it. A quarantined set looks exactly like a releasable one to the
# renderer: same manifest, same paths.
#
# `verify-release.mjs` reads `releaseBlockers()` out of `src/audio.ts`, so this
# check and the film cannot disagree. It runs HERE, before a two-hour render,
# rather than at ship time -- finding out afterwards costs the render.
#
# An audition render is still allowed; it just does not go in this folder.
Write-Host ""
& node (Join-Path $repo "capture\verify-release.mjs")
if ($LASTEXITCODE -ne 0) {
  Write-Host "Refusing to render masters. Audition previews belong in out/previews/AUDITION-not-for-release/." -ForegroundColor Red
  Write-Host ""
  exit 1
}

$outDir = Join-Path $repo "out\masters\$MusicVersion"
$reviewDir = Join-Path $outDir "review"

$targets = @(
  @{ tag = "15l";  cut = "15";  comp = "Studio-15-Landscape-16x9";  file = "${base}_15s_landscape_1920x1080.mp4";  note = "the What cut -- YouTube, LinkedIn, the website" },
  @{ tag = "15v";  cut = "15";  comp = "Studio-15-Vertical-9x16";   file = "${base}_15s_vertical_1080x1920.mp4";   note = "the What cut -- Reels, Stories, TikTok, Shorts" },
  @{ tag = "30l";  cut = "30";  comp = "Studio-30-Landscape-16x9";  file = "${base}_30s_landscape_1920x1080.mp4";  note = "What + Why, with the receipt beat" },
  @{ tag = "30v";  cut = "30";  comp = "Studio-30-Vertical-9x16";   file = "${base}_30s_vertical_1080x1920.mp4";   note = "What + Why, vertical" },
  @{ tag = "60l";  cut = "60";  comp = "Studio-60-Landscape-16x9";  file = "${base}_60s_landscape_1920x1080.mp4";  note = "all seven chapters" },
  @{ tag = "60v";  cut = "60";  comp = "Studio-60-Vertical-9x16";   file = "${base}_60s_vertical_1080x1920.mp4";   note = "all seven chapters, vertical" },
  @{ tag = "120l"; cut = "120"; comp = "Studio-120-Landscape-16x9"; file = "${base}_120s_landscape_1920x1080.mp4"; note = "the long form, two briefs" },
  @{ tag = "120v"; cut = "120"; comp = "Studio-120-Vertical-9x16";  file = "${base}_120s_vertical_1080x1920.mp4";  note = "the long form, vertical" }
)

if ($Only -ne "all") {
  # @(...) is load-bearing. A pipeline that matches ONE target returns the
  # hashtable itself rather than a one-element array, and `.Count` on a
  # hashtable is the number of KEYS -- so `-Only 15l` announced a plan of "5
  # master(s)" and then listed one. A wrong count in the banner of a script
  # whose whole job is to say what it actually did is not a cosmetic bug.
  if ($Only -match '^\d+$') { $targets = @($targets | Where-Object { $_.cut -eq $Only }) }
  else                      { $targets = @($targets | Where-Object { $_.tag -eq $Only }) }
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# --- orphans ---------------------------------------------------------------
#
# A killed Remotion render does not clean up after itself. Each one leaves a
# remotion.exe, a node.exe and a handful of chrome-headless-shell.exe processes
# still holding their memory. Three killed renders had accumulated 5.3 GB across
# 18 orphans on this 16 GB box, which then caused the NEXT render to be killed
# for memory -- a loop that reads as "this film is too heavy to render" and is
# not. So look before rendering, and between renders, and say what was found.
#
# Two filters, and both are load-bearing. The PATH is THIS project's own
# node_modules, so the founder's own Chrome -- and the sibling film's renders --
# can never appear in this list. The NAME list keeps out anything that merely
# mentions that path on its command line: a terminal grepping for it, or the kill
# command printed below, both match the path glob and are not renders.
#
# NOTHING IS EVER KILLED AUTOMATICALLY. A human decides, because one of these
# could be a render someone else started on purpose -- which is also why the
# wording says "already running" rather than asserting they are orphans.
$projectGlob = "*archcanvas-promo-studio\node_modules*"
$remotionNames = @("remotion.exe", "chrome-headless-shell.exe", "node.exe", "esbuild.exe")

function Show-Orphans {
  param([string] $When)

  $found = @(
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
      Where-Object { $remotionNames -contains $_.Name } |
      Where-Object { $_.CommandLine -like $projectGlob -or $_.ExecutablePath -like $projectGlob }
  )

  Write-Host ""
  if ($found.Count -eq 0) {
    Write-Host "no Remotion processes from this project ($When)"
    return
  }

  $gb = [math]::Round((($found | Measure-Object -Property WorkingSetSize -Sum).Sum) / 1GB, 2)
  Write-Host "$($found.Count) Remotion process(es) from this project ($When), holding $gb GB:" -ForegroundColor Yellow
  $found |
    Group-Object Name |
    Sort-Object { ($_.Group | Measure-Object -Property WorkingSetSize -Sum).Sum } -Descending |
    ForEach-Object {
      $sum = [math]::Round((($_.Group | Measure-Object -Property WorkingSetSize -Sum).Sum) / 1MB, 0)
      Write-Host ("  {0,-28} x{1,-3} {2,6} MB   pids: {3}" -f $_.Name, $_.Count, $sum, (($_.Group.ProcessId | Sort-Object) -join ", "))
    }
  Write-Host "  If no render is meant to be running, these are orphans from a killed one." -ForegroundColor Yellow
  Write-Host "  Nothing has been killed. To clear them yourself:" -ForegroundColor Yellow
  Write-Host "    Get-CimInstance Win32_Process | Where-Object { `$_.Name -in @('$($remotionNames -join "','")') -and `$_.CommandLine -like '$projectGlob' } | ForEach-Object { Stop-Process -Id `$_.ProcessId -Force }"
  Write-Host "  Leaving them in place is how the next render gets killed for memory."
}

Write-Host ""
Write-Host "plan: $($targets.Count) master(s), sequential, concurrency $Concurrency, scale $Scale"
Write-Host ("  music   {0}  --  {1}, {2} BPM, bar {3}s" -f $MusicVersion, $activeEntry.track, $activeEntry.bpm, $activeEntry.barSec)
Write-Host ("  out     {0}" -f (Resolve-Path -Relative $outDir))
if ($Bundle) { Write-Host ("  bundle  {0}" -f $Bundle) }
foreach ($t in $targets) { Write-Host ("  {0,-6} {1,-26} {2}" -f $t.tag, $t.comp, $t.note) }

Show-Orphans -When "before"

if ($ListOnly) {
  Write-Host ""
  Write-Host "-ListOnly: nothing rendered."
  Write-Host "  To bundle once and render all eight from it:"
  Write-Host "    npx remotion bundle --out-dir out/bundle"
  Write-Host "    ./render.ps1 -Bundle out/bundle"
  exit 0
}

# The entry point: a pre-built bundle if one was named, otherwise the sources
# (which Remotion then bundles itself, once per master).
$entry = if ($Bundle) {
  if (-not (Test-Path $Bundle)) { Write-Host "no bundle at $Bundle -- build one with ``npx remotion bundle --out-dir $Bundle``" -ForegroundColor Red; exit 1 }
  (Resolve-Path $Bundle).Path
} else { "src/index.ts" }

foreach ($t in $targets) {
  Write-Host ""
  Write-Host "-> $($t.comp)  --  $($t.note)"

  # A proof render must never be able to land on the master's own filename. It
  # would overwrite an uncommitted master with a quarter-size one, silently, and
  # the only way back is a full re-render.
  $file = if ($Scale -ne 1.0) { $t.file -replace '\.mp4$', "_proof$($Scale.ToString().Replace('.', '-')).mp4" } else { $t.file }
  $outPath = Join-Path $outDir $file
  $started = Get-Date

  # NOT $args. `$args` is an automatic variable, and `@args` in a native-command
  # call splats the AUTOMATIC one -- which, in a script whose arguments all bound
  # to param(), is empty. `& npx @args` therefore ran npx with no command at all,
  # npx answered by opening an interactive shell, that shell exited 0, and the
  # summary below then reported the master left over from a PREVIOUS render as if
  # this one had produced it. A green run that rendered nothing. Any name but
  # $args works; the variable still reads back as assigned, so this is invisible
  # from a `Write-Host $args`.
  $renderArgs = @(
    "remotion", "render", $entry, $t.comp, $outPath,
    "--codec=h264", "--crf=18", "--pixel-format=yuv420p", "--log=error",
    "--concurrency=$Concurrency"
  )
  if ($Scale -ne 1.0) { $renderArgs += "--scale=$Scale" }

  & npx @renderArgs
  if ($LASTEXITCODE -ne 0) {
    Write-Host "render failed for $($t.comp) (exit $LASTEXITCODE)" -ForegroundColor Red
    Show-Orphans -When "after the failure"
    exit 1
  }

  Write-Host ("   {0} in {1:N1} min" -f $t.tag, ((Get-Date) - $started).TotalMinutes)
  Show-Orphans -When "after $($t.tag)"
}

# Report what actually came out, rather than trusting that it did. `written N min
# ago` is here because a file existing is not evidence THIS run wrote it -- see
# the $renderArgs note above, where a run that rendered nothing reported a
# previous master as its own output.
Write-Host ""
Write-Host "rendered:"
$reported = @()
foreach ($t in $targets) {
  $file = if ($Scale -ne 1.0) { $t.file -replace '\.mp4$', "_proof$($Scale.ToString().Replace('.', '-')).mp4" } else { $t.file }
  $p = Join-Path $outDir $file
  if (-not (Test-Path $p)) { Write-Host "  MISSING  $file" -ForegroundColor Red; continue }

  $item = Get-Item $p
  $mb   = [math]::Round($item.Length / 1MB, 1)
  $age  = [math]::Round(((Get-Date) - $item.LastWriteTime).TotalMinutes, 1)
  $when = $item.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")

  # Resolution, duration AND whether there is an audio stream at all. A silent
  # master is a thing this project has shipped before: @remotion/media's <Audio>
  # previewed fine and rendered -91 dB across the whole file.
  $v = & ffprobe -v error -select_streams v:0 -show_entries stream=width,height -show_entries format=duration -of csv=p=0 $p
  $a = & ffprobe -v error -select_streams a -show_entries stream=codec_name -of csv=p=0 $p
  $audio = if ([string]::IsNullOrWhiteSpace($a)) { "NO AUDIO" } else { "audio=$($a.Trim())" }

  Write-Host ("  {0,-52} {1,6} MB   {2}   {3}   modified {4} ({5} min ago)" -f $file, $mb, ($v -join " "), $audio, $when, $age)
  $reported += $file
}

if ($reported.Count -gt 0) {
  $rel = (Resolve-Path -Relative $outDir) -replace '\\', '/'
  Write-Host ""
  Write-Host "next: screen EVERY master, not one of them --"
  foreach ($f in $reported) { Write-Host "  npm run verify:flash $rel/$f" }
}
