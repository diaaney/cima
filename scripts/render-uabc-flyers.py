"""Render print-ready Nexo UABC flyers from the existing banner and mark.

Requires Pillow and qrcode: python -m pip install pillow qrcode
"""

from pathlib import Path

import qrcode
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
OUTPUT = ASSETS / "flyers"
INVITE_URL = "https://discord.gg/uabc"
GREEN = (12, 43, 32)
GREEN_LIGHT = (29, 75, 56)
WHITE = (250, 250, 246)
MUTED = (183, 212, 195)
BLURPLE = (88, 101, 242)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    filename = "segoeuib.ttf" if bold else "segoeui.ttf"
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / filename), size)


def center_text(draw: ImageDraw.ImageDraw, text: str, y: int, face, fill, width: int):
    box = draw.textbbox((0, 0), text, font=face)
    draw.text(((width - (box[2] - box[0])) / 2, y - box[1]), text, font=face, fill=fill)


def background(size: tuple[int, int]) -> Image.Image:
    width, height = size
    strip = Image.new("RGB", (1, height))
    pixels = strip.load()
    for y in range(height):
        t = y / height
        pixels[0, y] = tuple(
            round(GREEN[i] * (1 - t) + (8, 32, 25)[i] * t) for i in range(3)
        )
    return strip.resize((width, height))


def qr_image(modules: int) -> Image.Image:
    qr = qrcode.QRCode(
        error_correction=qrcode.constants.ERROR_CORRECT_Q,
        box_size=1,
        border=4,
    )
    qr.add_data(INVITE_URL)
    qr.make(fit=True)
    code = qr.make_image(fill_color="#102e23", back_color="white").convert("RGB")
    # Nearest-neighbor keeps every module crisp for print and scanning.
    return code.resize((modules, modules), Image.Resampling.NEAREST)


def discord_symbol(size: tuple[int, int]) -> Image.Image:
    """Extract the original Discord symbol from the existing banner."""
    banner = Image.open(ASSETS / "uabc-comunidad-discord-banner.png").convert("RGB")
    crop = banner.crop((1290, 750, 1475, 905))
    pixels = crop.load()
    mask = Image.new("L", crop.size)
    alpha = mask.load()
    for y in range(crop.height):
        for x in range(crop.width):
            red, green, blue = pixels[x, y]
            # The brand's blurple is distinct from the dark green background.
            alpha[x, y] = max(0, min(255, round((blue - max(red, green) - 20) * 3)))
    bounds = mask.getbbox()
    if not bounds:
        raise RuntimeError("Discord symbol could not be extracted from the banner")
    mask = mask.crop(bounds)
    image = Image.new("RGBA", mask.size, (*BLURPLE, 0))
    image.putalpha(mask)
    image.thumbnail(size, Image.Resampling.LANCZOS)
    return image


def paste_center(canvas: Image.Image, image: Image.Image, y: int):
    x = (canvas.width - image.width) // 2
    canvas.paste(image, (x, y), image if image.mode == "RGBA" else None)


def make_poster() -> Path:
    width, height = 2480, 3508  # A4 at 300 dpi
    canvas = background((width, height))
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((118, 109, width - 118, 3330), radius=90, outline=GREEN_LIGHT, width=4)
    center_text(draw, "NEXO UABC  /  COMUNIDAD ESTUDIANTIL", 230, font(51, True), MUTED, width)

    banner = Image.open(ASSETS / "uabc-comunidad-discord-banner.png").convert("RGB")
    banner = banner.resize((2180, 1226), Image.Resampling.LANCZOS)
    canvas.paste(banner, ((width - banner.width) // 2, 345))

    draw = ImageDraw.Draw(canvas)
    center_text(draw, "TU COMUNIDAD, A UN ESCANEO.", 1630, font(88, True), WHITE, width)
    center_text(draw, "Escanea el QR y únete al servidor.", 1760, font(60), MUTED, width)

    qr_size = 1000
    qr_top = 1940
    card = (width // 2 - 570, qr_top - 35, width // 2 + 570, qr_top + 1105)
    draw.rounded_rectangle(card, radius=72, fill="white")
    canvas.paste(qr_image(qr_size), ((width - qr_size) // 2, qr_top + 35))

    draw = ImageDraw.Draw(canvas)
    center_text(draw, "discord.gg/uabc", 3180, font(105, True), WHITE, width)
    draw.rounded_rectangle((1040, 3335, 1440, 3352), radius=8, fill=BLURPLE)
    output = OUTPUT / "uabc-flyer-a4.png"
    canvas.save(output, dpi=(300, 300), optimize=True)
    return output


def make_mini() -> Path:
    width, height = 1240, 1748  # A6 at 300 dpi
    canvas = background((width, height))
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((54, 54, width - 54, height - 54), radius=65, outline=GREEN_LIGHT, width=3)

    mark = Image.open(ASSETS / "uabc-mark-white.png").convert("RGBA")
    mark.thumbnail((660, 360), Image.Resampling.LANCZOS)
    paste_center(canvas, mark, 115)

    draw = ImageDraw.Draw(canvas)
    center_text(draw, "Comunidad UABC", 465, font(91, True), WHITE, width)
    symbol = discord_symbol((150, 130))
    paste_center(canvas, symbol, 565)

    qr_size = 740
    qr_top = 735
    draw.rounded_rectangle((200, 710, 1040, 1550), radius=64, fill="white")
    canvas.paste(qr_image(qr_size), ((width - qr_size) // 2, qr_top + 20))

    draw = ImageDraw.Draw(canvas)
    center_text(draw, "discord.gg/uabc", 1595, font(48, True), WHITE, width)
    output = OUTPUT / "uabc-flyer-mini-a6.png"
    canvas.save(output, dpi=(300, 300), optimize=True)
    return output


if __name__ == "__main__":
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for rendered in (make_poster(), make_mini()):
        print(rendered)
