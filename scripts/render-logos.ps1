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

$files = @(
    @{ Name = 'nexo-discord-icon'; Svg = $nexoSvg; Transparent = $false }
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

$mascotPath = Join-Path $assets 'cima-cimarron-white.png'
if (-not (Test-Path -LiteralPath $mascotPath)) { throw "Missing mascot image: $mascotPath" }
$avatarPath = Join-Path $assets 'cima-discord-avatar.png'
$mascot = [System.Drawing.Image]::FromFile($mascotPath)
$avatar = [System.Drawing.Bitmap]::new(1024, 1024)
$graphics = [System.Drawing.Graphics]::FromImage($avatar)
try {
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#17382d'))
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($mascot, [System.Drawing.Rectangle]::new(87, 87, 850, 850))
    $avatar.Save($avatarPath, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
    $graphics.Dispose()
    $avatar.Dispose()
    $mascot.Dispose()
}
Write-Output "Rendered $avatarPath (1024x1024)"
