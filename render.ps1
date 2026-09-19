# The eight masters. H.264, yuv420p so the files play everywhere.
#
# Usage: .\render.ps1                     renders all eight, in order
#        .\render.ps1 -Only 15l           renders one  (15l 15v 30l 30v 60l 60v 120l 120v)
#        .\render.ps1 -Only 15            renders both aspect ratios of one cut
#        .\render.ps1 -Scale 0.5          half-size proof renders, for looking at
#        .\render.ps1 -Concurrency 1      one browser tab; slower, least memory
#        .\render.ps1 -ListOnly           print the plan and the orphan scan, render nothing
#
# Masters are NOT committed -- tens of MB each, eight of them, and git keeps every
# version forever. They ship as GitHub Release assets. See .gitignore.
#
# SEQUENTIAL, ALWAYS. Eight renders on a 16 GB box that is also running the
# founder's browser is not a place to be clever. Each finishes before the next
# starts, and the orphan scan runs between them.

param(
  [ValidateSet("all", "15", "30", "60", "120", "15l", "15v", "30l", "30v", "60l", "60v", "120l", "120v")]
  [string] $Only = "all",

  [double] $Scale = 1.0,

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

$stamp = "2026-09"
$base  = "archcanvas-studio-$stamp"

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
  if ($Only -match '^\d+$') { $targets = $targets | Where-Object { $_.cut -eq $Only } }
  else                      { $targets = $targets | Where-Object { $_.tag -eq $Only } }
}

if (-not (Test-Path "out")) { New-Item -ItemType Directory "out" | Out-Null }

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
foreach ($t in $targets) { Write-Host ("  {0,-6} {1,-26} {2}" -f $t.tag, $t.comp, $t.note) }

Show-Orphans -When "before"

if ($ListOnly) {
  Write-Host ""
  Write-Host "-ListOnly: nothing rendered."
  exit 0
}

foreach ($t in $targets) {
  Write-Host ""
  Write-Host "-> $($t.comp)  --  $($t.note)"

  # A proof render must never be able to land on the master's own filename. It
  # would overwrite an uncommitted master with a quarter-size one, silently, and
  # the only way back is a full re-render.
  $file = if ($Scale -ne 1.0) { $t.file -replace '\.mp4$', "_proof$($Scale.ToString().Replace('.', '-')).mp4" } else { $t.file }
  $outPath = Join-Path "out" $file

  # NOT $args. `$args` is an automatic variable, and `@args` in a native-command
  # call splats the AUTOMATIC one -- which, in a script whose arguments all bound
  # to param(), is empty. `& npx @args` therefore ran npx with no command at all,
  # npx answered by opening an interactive shell, that shell exited 0, and the
  # summary below then reported the master left over from a PREVIOUS render as if
  # this one had produced it. A green run that rendered nothing. Any name but
  # $args works; the variable still reads back as assigned, so this is invisible
  # from a `Write-Host $args`.
  $renderArgs = @(
    "remotion", "render", "src/index.ts", $t.comp, $outPath,
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
  $p = Join-Path "out" $file
  if (-not (Test-Path $p)) { Write-Host "  MISSING  $file" -ForegroundColor Red; continue }

  $item = Get-Item $p
  $mb   = [math]::Round($item.Length / 1MB, 1)
  $age  = [math]::Round(((Get-Date) - $item.LastWriteTime).TotalMinutes, 1)

  # Resolution, duration AND whether there is an audio stream at all. A silent
  # master is a thing this project has shipped before: @remotion/media's <Audio>
  # previewed fine and rendered -91 dB across the whole file.
  $v = & ffprobe -v error -select_streams v:0 -show_entries stream=width,height -show_entries format=duration -of csv=p=0 $p
  $a = & ffprobe -v error -select_streams a -show_entries stream=codec_name -of csv=p=0 $p
  $audio = if ([string]::IsNullOrWhiteSpace($a)) { "NO AUDIO" } else { "audio=$($a.Trim())" }

  Write-Host ("  {0,-52} {1,6} MB   {2}   {3}   written {4} min ago" -f $file, $mb, ($v -join " "), $audio, $age)
  $reported += $file
}

if ($reported.Count -gt 0) {
  Write-Host ""
  Write-Host "next: screen EVERY master, not one of them --"
  foreach ($f in $reported) { Write-Host "  npm run verify:flash out/$f" }
}
