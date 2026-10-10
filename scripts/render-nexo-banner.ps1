param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$assets = Join-Path $ProjectRoot 'assets'
$source = Join-Path $assets 'nexo-uabc-banner-verde.png'
$mark = Join-Path $assets 'uabc-mark-white.png'
$discordSymbol = Join-Path $assets 'discord-symbol-white.svg'
$svg = Join-Path $assets 'uabc-comunidad-discord-banner.svg'
$png = Join-Path $assets 'uabc-comunidad-discord-banner.png'

if (-not (Test-Path -LiteralPath $source)) { throw "Missing source isotipo: $source" }
if (-not (Test-Path -LiteralPath $discordSymbol)) { throw "Missing Discord symbol: $discordSymbol" }

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

if (-not ('UabcMarkExtractor' -as [type])) {
    Add-Type -TypeDefinition $extractor -ReferencedAssemblies System.Drawing
}
[UabcMarkExtractor]::Extract($source, $mark)
$markData = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($mark))

$textOutliner = @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Globalization;
using System.Text;

public static class BannerTaglineOutliner {
    private static string Coord(float value) { return value.ToString("0.###", CultureInfo.InvariantCulture); }

    public static float Width(string fontPath, string value, float height) {
        using (var fonts = new PrivateFontCollection()) {
            fonts.AddFontFile(fontPath);
            using (var path = new GraphicsPath()) {
                path.AddString(value, fonts.Families[0], (int)FontStyle.Regular, 300f,
                    new PointF(0, 0), StringFormat.GenericTypographic);
                var bounds = path.GetBounds();
                return bounds.Width * height / bounds.Height;
            }
        }
    }

    public static string Make(string fontPath, string value, float x, float centerY, float height) {
        using (var fonts = new PrivateFontCollection()) {
            fonts.AddFontFile(fontPath);
            using (var path = new GraphicsPath()) {
                path.AddString(value, fonts.Families[0], (int)FontStyle.Regular, 300f,
                    new PointF(0, 0), StringFormat.GenericTypographic);
                var bounds = path.GetBounds();
                float scale = height / bounds.Height;
                float top = centerY - height / 2f;
                var points = path.PathPoints;
                var types = path.PathTypes;
                var svg = new StringBuilder();
                for (int i = 0; i < points.Length; i++) {
                    int type = types[i] & 7;
                    if (type == 0) {
                        svg.Append("M ").Append(Coord(x + (points[i].X - bounds.X) * scale)).Append(' ')
                            .Append(Coord(top + (points[i].Y - bounds.Y) * scale)).Append(' ');
                    } else if (type == 1) {
                        svg.Append("L ").Append(Coord(x + (points[i].X - bounds.X) * scale)).Append(' ')
                            .Append(Coord(top + (points[i].Y - bounds.Y) * scale)).Append(' ');
                    } else if (type == 3 && i + 2 < points.Length) {
                        for (int j = 0; j < 3; j++) {
                            svg.Append(j == 0 ? "C " : " ")
                                .Append(Coord(x + (points[i + j].X - bounds.X) * scale)).Append(' ')
                                .Append(Coord(top + (points[i + j].Y - bounds.Y) * scale));
                        }
                        i += 2;
                        svg.Append(' ');
                    }
                    if ((types[i] & 128) != 0) svg.Append("Z ");
                }
                return svg.ToString();
            }
        }
    }
}
'@
if (-not ('BannerTaglineOutliner' -as [type])) {
    Add-Type -TypeDefinition $textOutliner -ReferencedAssemblies System.Drawing
}
$taglineFont = Join-Path $assets 'fonts\Poppins-Medium.ttf'
$tagline = 'Comunidad de'
$taglineHeight = 82
$taglineWidth = [BannerTaglineOutliner]::Width($taglineFont, $tagline, $taglineHeight)
$symbolWidth = 122
$symbolHeight = 91.5
$gap = 32
$taglineX = (1920 - $taglineWidth - $gap - $symbolWidth) / 2
$symbolX = $taglineX + $taglineWidth + $gap
$taglinePath = [BannerTaglineOutliner]::Make($taglineFont, $tagline, $taglineX, 850, $taglineHeight)
$symbolData = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($discordSymbol))
$symbolXText = $symbolX.ToString('0.###', [System.Globalization.CultureInfo]::InvariantCulture)

$svgContent = @'
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <rect width="1920" height="1080" fill="#17382d"/>
  <image href="data:image/png;base64,__MARK_DATA__" x="410" y="180" width="1100" height="544"/>
  <path d="__TAGLINE_PATH__" fill="#fbfaf7"/>
  <image href="data:image/svg+xml;base64,__SYMBOL_DATA__" x="__SYMBOL_X__" y="804" width="122" height="91.5"/>
</svg>
'@
$svgContent = $svgContent.Replace('__TAGLINE_PATH__', $taglinePath).Replace('__MARK_DATA__', $markData).Replace('__SYMBOL_DATA__', $symbolData).Replace('__SYMBOL_X__', $symbolXText)
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
