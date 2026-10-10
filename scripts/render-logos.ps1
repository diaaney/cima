param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assets = Join-Path $ProjectRoot 'assets'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path -LiteralPath $chrome)) { throw "Chrome not found at $chrome" }

$nexoSvg = @'
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#17382d"/>
  <path fill="#fbfaf7" d="M 218 785 L 295 240 H 445 L 646 528 L 687 240 H 836 L 759 785 H 610 L 407 496 L 366 785 Z"/>
</svg>
'@

$cimaMark = @'
  <g fill="none" stroke="#ffffff" stroke-width="106" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 446 389 C 402 295 293 264 215 326 C 115 405 128 531 209 591 C 279 643 357 609 356 547"/>
    <path d="M 578 389 C 622 295 731 264 809 326 C 909 405 896 531 815 591 C 745 643 667 609 668 547"/>
  </g>
  <defs>
    <mask id="face">
      <rect width="1024" height="1024" fill="#ffffff"/>
      <path d="M 420 518 Q 448 494 478 519 Q 450 537 420 518 Z" fill="#000000"/>
      <path d="M 604 518 Q 576 494 546 519 Q 574 537 604 518 Z" fill="#000000"/>
      <path d="M 486 650 Q 512 636 538 650 L 512 680 Z" fill="#000000"/>
      <path d="M 476 702 Q 512 724 548 702" fill="none" stroke="#000000" stroke-width="12" stroke-linecap="round"/>
    </mask>
  </defs>
  <path fill="#ffffff" mask="url(#face)" d="M 512 310 C 618 310 682 391 665 518 L 649 632 C 636 704 583 778 512 825 C 441 778 388 704 375 632 L 359 518 C 342 391 406 310 512 310 Z"/>
'@

$cimaSvg = @"
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
$cimaMark
</svg>
"@
$cimaAvatarSvg = @"
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#17382d"/>
$cimaMark
</svg>
"@

$files = @(
    @{ Name = 'nexo-discord-icon'; Svg = $nexoSvg; Transparent = $false },
    @{ Name = 'cima-cimarron-white'; Svg = $cimaSvg; Transparent = $true },
    @{ Name = 'cima-discord-avatar'; Svg = $cimaAvatarSvg; Transparent = $false }
)

foreach ($item in $files) {
    $svgPath = Join-Path $assets ($item.Name + '.svg')
    $pngPath = Join-Path $assets ($item.Name + '.png')
    [System.IO.File]::WriteAllText($svgPath, $item.Svg, [System.Text.UTF8Encoding]::new($false))
    $uri = [System.Uri]::new($svgPath).AbsoluteUri
    $background = if ($item.Transparent) { '00000000' } else { 'ff17382d' }
    $previousErrorAction = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & $chrome --headless --disable-gpu --hide-scrollbars "--default-background-color=$background" --force-device-scale-factor=1 --window-size=1024,1024 "--screenshot=$pngPath" $uri 2>&1 | Out-Null
        $renderExitCode = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previousErrorAction }
    if ($renderExitCode -ne 0 -or -not (Test-Path -LiteralPath $pngPath)) { throw "Could not render $svgPath" }
    $check = [System.Drawing.Bitmap]::FromFile($pngPath)
    try {
        if ($check.Width -ne 1024 -or $check.Height -ne 1024) { throw "Invalid size for $pngPath" }
        if ($item.Transparent -and $check.GetPixel(0, 0).A -ne 0) { throw "Transparency was lost in $pngPath" }
    } finally { $check.Dispose() }
    Write-Output "Rendered $pngPath (1024x1024)"
}
