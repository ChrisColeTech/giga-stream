# Renders pages in headless Chrome (old mode, JS executed) and saves the DOM per URL.
param(
  [Parameter(Mandatory = $true)][string[]]$Urls,
  [string]$OutDir = "$env:TEMP\embed-docs"
)
$CHROME = "C:\Program Files\Google\Chrome\Application\chrome.exe"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
foreach ($url in $Urls) {
  $name = ($url -replace '^https?://', '' -replace '[^a-zA-Z0-9.-]', '_') + ".html"
  $prof = "$env:TEMP\cdp-$(Get-Random)"
  $out = Join-Path $OutDir $name
  & $CHROME --headless --disable-gpu --user-data-dir="$prof" --virtual-time-budget=20000 --dump-dom $url 2>$null | Out-File $out -Encoding utf8
  $size = (Get-Item $out).Length
  Write-Host "$size`t$url"
  Remove-Item $prof -Recurse -Force -ErrorAction SilentlyContinue
}
