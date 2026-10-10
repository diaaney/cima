param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$assets = Join-Path $ProjectRoot 'assets'
$source = Join-Path $assets 'nexo-uabc-banner-verde.png'
$mark = Join-Path $assets 'uabc-mark-white.png'
$svg = Join-Path $assets 'nexo-uabc-banner-phantom.svg'
$png = Join-Path $assets 'nexo-uabc-banner-phantom.png'

if (-not (Test-Path -LiteralPath $source)) { throw "Missing source isotipo: $source" }

$extractor = @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class UabcMarkExtractor {
    public static void Extract(string sourcePath, string outputPath) {
        using (var original = new Bitmap(sourcePath))
        using (var source = new Bitmap(original.Width, original.Height, PixelFormat.Format32bppArgb)) {
            using (var graphics = Graphics.FromImage(source)) graphics.DrawImage(original, 0, 0);
            var rect = new Rectangle(0, 0, source.Width, source.Height);
            var data = source.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            var pixels = new byte[data.Stride * source.Height];
            Marshal.Copy(data.Scan0, pixels, 0, pixels.Length);
            source.UnlockBits(data);

            int minX = source.Width, minY = source.Height, maxX = 0, maxY = 0;
            for (int y = 250; y < Math.Min(820, source.Height); y++) {
                for (int x = 900; x < Math.Min(1800, source.Width); x++) {
                    int i = y * data.Stride + x * 4;
                    if (pixels[i] > 170 && pixels[i + 1] > 170 && pixels[i + 2] > 170) {
                        minX = Math.Min(minX, x); maxX = Math.Max(maxX, x);
                        minY = Math.Min(minY, y); maxY = Math.Max(maxY, y);
                    }
                }
            }
            if (minX >= maxX || minY >= maxY) throw new Exception("Could not locate the white UABC mark");

            using (var result = new Bitmap(maxX - minX + 1, maxY - minY + 1, PixelFormat.Format32bppArgb)) {
                var outputRect = new Rectangle(0, 0, result.Width, result.Height);
                var outputData = result.LockBits(outputRect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
                var output = new byte[outputData.Stride * result.Height];
                for (int y = 0; y < result.Height; y++) {
                    for (int x = 0; x < result.Width; x++) {
                        int inputIndex = (y + minY) * data.Stride + (x + minX) * 4;
                        int outputIndex = y * outputData.Stride + x * 4;
                        int red = pixels[inputIndex + 2];
                        int alpha = Math.Max(0, Math.Min(255, (red - 30) * 255 / 215));
                        output[outputIndex] = 255;
                        output[outputIndex + 1] = 255;
                        output[outputIndex + 2] = 255;
                        output[outputIndex + 3] = (byte)alpha;
                    }
                }
                Marshal.Copy(output, 0, outputData.Scan0, output.Length);
                result.UnlockBits(outputData);
                result.Save(outputPath, ImageFormat.Png);
            }
        }
    }
}
'@

Add-Type -TypeDefinition $extractor -ReferencedAssemblies System.Drawing
[UabcMarkExtractor]::Extract($source, $mark)

$svgContent = @'
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <style>
    @font-face {
      font-family: "Poppins Local";
      src: url("fonts/Poppins-Medium.ttf") format("truetype");
      font-weight: 500;
    }
  </style>
  <rect width="1920" height="1080" fill="#17382d"/>
  <text x="300" y="625" fill="#fbfaf7" font-family="Poppins Local, Poppins, sans-serif" font-size="232" font-weight="500" letter-spacing="-8">Nexo</text>
  <image href="uabc-mark-white.png" x="927" y="357" width="770" height="376"/>
</svg>
'@
[System.IO.File]::WriteAllText($svg, $svgContent, [System.Text.UTF8Encoding]::new($false))

$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path -LiteralPath $chrome)) { throw "Chrome not found at $chrome" }
$uri = [System.Uri]::new($svg).AbsoluteUri
$previousErrorAction = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
    & $chrome --headless --disable-gpu --hide-scrollbars --allow-file-access-from-files --force-device-scale-factor=1 --window-size=1920,1080 --virtual-time-budget=1500 "--screenshot=$png" $uri 2>&1 | Out-Null
    $renderExitCode = $LASTEXITCODE
} finally { $ErrorActionPreference = $previousErrorAction }
if ($renderExitCode -ne 0 -or -not (Test-Path -LiteralPath $png)) { throw 'Could not render SVG to PNG' }

$check = [System.Drawing.Image]::FromFile($png)
try {
    if ($check.Width -ne 1920 -or $check.Height -ne 1080) {
        throw "Rendered image is $($check.Width)x$($check.Height), expected 1920x1080"
    }
} finally { $check.Dispose() }
Write-Output "Rendered $png (1920x1080)"
