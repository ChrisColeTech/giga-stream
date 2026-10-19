<#
.SYNOPSIS
  Verify Giga Stream's ffmpeg build (docs/09-FFMPEG-BUILD.md section 4).

.DESCRIPTION
  Runs every job the product and its fixtures ask of ffmpeg, in a scratch folder, and prints one
  PASS/FAIL line per check. Exit code 0 only when every check passes.
  No network unless -HttpsUrl names an HLS or media URL to probe over https.
#>
param(
  [string]$Bin = (Join-Path $PSScriptRoot '..\..\tools\ffmpeg\win32-x64\bin'),
  [string]$HttpsUrl = ''
)
$ErrorActionPreference = 'Stop'
$ffmpeg = Join-Path $Bin 'ffmpeg.exe'
$ffprobe = Join-Path $Bin 'ffprobe.exe'
$work = Join-Path ([IO.Path]::GetTempPath()) ("ffverify-" + [Guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force $work | Out-Null
$failed = 0

function Report([string]$name, [bool]$ok, [string]$fact) {
  $mark = if ($ok) { 'PASS' } else { 'FAIL'; $script:failed++ }
  '{0}  {1,-30} {2}' -f $mark, $name, $fact
}
function Ff([string[]]$ffArgs) {
  & $ffmpeg -hide_banner -loglevel error -y @ffArgs 2>&1 | Out-Null
  return [int]$LASTEXITCODE
}
function Listing([string]$kind) { (& $ffmpeg -hide_banner "-$kind" 2>&1) -join "`n" }
function Has([string]$text, [string]$name) { $text -match "(?m)^\s*\S+\s+$([regex]::Escape($name))\s" }

# 1. The binary runs and reports its version.
$versionText = & $ffmpeg -hide_banner -version 2>&1
$versionCode = $LASTEXITCODE
$version = $versionText | Select-Object -First 1
Report 'version' ($versionCode -eq 0 -and "$version" -match '9\.0\.1') $version

# 2. Required components.
$protocols = (& $ffmpeg -hide_banner -protocols 2>&1) -join ' '
# HLS input is the hls demuxer (checked below); FFmpeg 9 has no separate hls protocol.
$needProtocols = 'file', 'pipe', 'http', 'https', 'tls', 'tcp', 'crypto', 'data'
$missing = $needProtocols | Where-Object { $protocols -notmatch "\b$_\b" }
Report 'protocols' ($missing.Count -eq 0) ("missing: " + ($missing -join ',') + " | have: " + (($needProtocols | Where-Object { $protocols -match "\b$_\b" }) -join ','))
$muxers = Listing 'muxers'; $demuxers = Listing 'demuxers'; $encoders = Listing 'encoders'
$need = @(
  @('muxer', $muxers, 'hls'), @('muxer', $muxers, 'mpegts'), @('muxer', $muxers, 'webvtt'),
  @('muxer', $muxers, 'f32le'), @('muxer', $muxers, 'mp4'), @('muxer', $muxers, 'segment'),
  @('demuxer', $demuxers, 'hls'), @('demuxer', $demuxers, 'webvtt'), @('demuxer', $demuxers, 'srt'),
  @('encoder', $encoders, 'libx264'), @('encoder', $encoders, 'aac'),
  @('encoder', $encoders, 'pcm_f32le'), @('encoder', $encoders, 'webvtt'),
  @('encoder', $encoders, 'png'), @('encoder', $encoders, 'mjpeg'))
$absent = $need | Where-Object { -not (Has $_[1] $_[2]) } | ForEach-Object { "$($_[0]) $($_[2])" }
Report 'components' ($absent.Count -eq 0) ($(if ($absent) { 'missing: ' + ($absent -join ', ') } else { "$($need.Count) present" }))

# 3. A short MP4: H.264 + AAC from the built-in test sources (the fixture recipe).
$mp4 = Join-Path $work 'video.mp4'
$code = Ff @('-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30', '-f', 'lavfi', '-i',
  'sine=frequency=440:sample_rate=48000', '-t', '4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-movflags', '+faststart', $mp4)
$streams = (& $ffprobe -v error -show_entries stream=codec_name -of csv=p=0 $mp4 2>&1) -join ','
Report 'fixture mp4' ($code -eq 0 -and $streams -eq 'h264,aac') $streams

# 4. Decodes the desktop player needs: RGBA frames and f32le audio (1 s = 384000 bytes).
$rgba = Join-Path $work 'f.rgba'; $pcm = Join-Path $work 'a.raw'
$c1 = Ff @('-ss', '1', '-i', $mp4, '-frames:v', '2', '-f', 'rawvideo', '-pix_fmt', 'rgba', $rgba)
$c2 = Ff @('-ss', '1', '-i', $mp4, '-vn', '-t', '1', '-f', 'f32le', '-ac', '2', '-ar', '48000', $pcm)
$rgbaOk = $c1 -eq 0 -and (Get-Item $rgba).Length -eq (640 * 360 * 4 * 2)
$pcmOk = $c2 -eq 0 -and (Get-Item $pcm).Length -eq 384000
Report 'rgba decode' $rgbaOk "$((Get-Item $rgba -ErrorAction SilentlyContinue).Length) bytes"
Report 'f32le decode' $pcmOk "$((Get-Item $pcm -ErrorAction SilentlyContinue).Length) bytes"

# 5. Still for a local file (the poster route's job).
$still = Join-Path $work 'still.jpg'
$c3 = Ff @('-i', $mp4, '-vf', 'thumbnail,scale=320:-2', '-frames:v', '1', $still)
Report 'still' ($c3 -eq 0 -and (Test-Path $still)) "$((Get-Item $still -ErrorAction SilentlyContinue).Length) bytes"

# 5b. Every live fixture channel source renders (docs/10 section 3.2).
$sources = @('testsrc2=size=320x180:rate=30', 'smptehdbars=size=320x180:rate=30',
  'mandelbrot=size=320x180:rate=30', 'testsrc2=size=320x180:rate=30,hflip,hue=h=120')
$bad = @()
foreach ($s in $sources) {
  if ((Ff @('-f', 'lavfi', '-i', $s, '-frames:v', '1', '-f', 'null', '-')) -ne 0) { $bad += $s }
}
Report 'channel sources' ($bad.Count -eq 0) ($(if ($bad) { 'failed: ' + ($bad -join '; ') } else { "$($sources.Count) render" }))

# 6. Multi-variant VOD HLS with an audio group and WebVTT subtitles (docs/09 section 5).
$hls = Join-Path $work 'hls'; New-Item -ItemType Directory -Force $hls | Out-Null
$srt = Join-Path $work 'subs.srt'
Set-Content -Encoding ascii $srt "1`r`n00:00:00,000 --> 00:00:02,000`r`nFixture caption one`r`n`r`n2`r`n00:00:02,000 --> 00:00:04,000`r`nFixture caption two`r`n"
Push-Location $hls
# The hls muxer takes subtitles only inside a video variant (s:N beside v:N); it writes one
# index_vtt.m3u8 per variant and a SUBTITLES group in the master.
$c4 = Ff @('-i', $mp4, '-i', $srt, '-map', '0:v', '-map', '0:v', '-map', '0:a', '-map', '1:s',
  '-map', '1:s', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-s:v:0', '426x240', '-b:v:0', '400k',
  '-s:v:1', '640x360', '-b:v:1', '900k', '-c:a', 'aac', '-c:s', 'webvtt',
  '-var_stream_map', 'v:0,s:0,agroup:aud,sgroup:sub,name:240p v:1,s:1,agroup:aud,sgroup:sub,name:360p a:0,agroup:aud,language:en,name:audio',
  '-master_pl_name', 'master.m3u8', '-hls_time', '2', '-hls_playlist_type', 'vod',
  '-hls_segment_filename', '%v/seg%03d.ts', '%v/index.m3u8')
Pop-Location
$master = Get-Content (Join-Path $hls 'master.m3u8') -Raw -ErrorAction SilentlyContinue
$variants = ([regex]::Matches("$master", 'EXT-X-STREAM-INF')).Count
$media = ([regex]::Matches("$master", 'EXT-X-MEDIA:TYPE=(AUDIO|SUBTITLES)')).Count
Report 'hls vod master' ($c4 -eq 0 -and $variants -ge 2 -and $media -ge 2) "$variants variants, $media media groups"

# 7. Read the HLS back through the hls demuxer.
$c5 = Ff @('-i', (Join-Path $hls 'master.m3u8'), '-map', '0:v:0', '-frames:v', '1', '-f', 'null', '-')
Report 'hls read back' ($c5 -eq 0) "exit $c5"

# 8. A live sliding-window stream: no ENDLIST while running, media sequence advances.
$live = Join-Path $work 'live'; New-Item -ItemType Directory -Force $live | Out-Null
$livePl = Join-Path $live 'index.m3u8'
$proc = Start-Process -FilePath $ffmpeg -PassThru -WindowStyle Hidden -ArgumentList @(
  '-hide_banner', '-loglevel', 'error', '-y', '-re', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30',
  '-re', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '14',
  '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency', '-g', '30', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-f', 'hls', '-hls_time', '1', '-hls_list_size', '4',
  '-hls_flags', 'delete_segments+program_date_time', "`"$livePl`"")
Start-Sleep -Seconds 9
$mid = Get-Content $livePl -Raw -ErrorAction SilentlyContinue
$proc | Wait-Process -Timeout 30 -ErrorAction SilentlyContinue
$sequence = if ("$mid" -match 'EXT-X-MEDIA-SEQUENCE:(\d+)') { [int]$Matches[1] } else { -1 }
$liveOk = "$mid" -notmatch 'EXT-X-ENDLIST' -and $sequence -gt 0 -and "$mid" -match 'PROGRAM-DATE-TIME'
Report 'live hls window' $liveOk "media sequence $sequence mid-run, ENDLIST absent: $("$mid" -notmatch 'EXT-X-ENDLIST')"

# 9. Optional https probe (Schannel), only when a URL is given.
if ($HttpsUrl) {
  $probe = (& $ffprobe -v error -rw_timeout 15000000 -show_entries stream=codec_name -of csv=p=0 $HttpsUrl 2>&1) -join ','
  Report 'https probe' ($LASTEXITCODE -eq 0 -and $probe -match 'h264') $probe
} else {
  'SKIP  https probe                    no -HttpsUrl given (no network by default)'
}

Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
if ($failed -eq 0) { 'all checks passed' } else { "$failed check(s) failed"; exit 1 }
