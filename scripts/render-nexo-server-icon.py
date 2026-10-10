"""Render the Nexo UABC ram as a static and animated Discord server icon.

Requires Pillow: python -m pip install Pillow
"""

from collections import deque
from math import cos, pi
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
MASTER = ASSETS / "nexo-cimarron-segmented-master.png"
PNG = ASSETS / "nexo-server-icon.png"
GIF = ASSETS / "nexo-server-icon-animated.gif"

SIZE = 1024
RAM_WIDTH = 720
FRAMES = 24
BACKGROUND = (16, 42, 34, 255)


def find_sections(image):
    """Identify the white islands enclosed by the ram's dark segment lines."""
    width, height = image.size
    pixels = image.load()
    eligible = bytearray(width * height)
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            if alpha > 180 and min(red, green, blue) > 125:
                eligible[y * width + x] = 1

    visited = bytearray(width * height)
    sections = []
    for start in range(width * height):
        if not eligible[start] or visited[start]:
            continue

        visited[start] = 1
        queue = deque([start])
        points = []
        while queue:
            index = queue.popleft()
            x, y = index % width, index // width
            points.append((x, y))
            for neighbor in (index - 1, index + 1, index - width, index + width):
                if neighbor < 0 or neighbor >= width * height:
                    continue
                if abs(neighbor % width - x) + abs(neighbor // width - y) != 1:
                    continue
                if eligible[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)

        if len(points) < 90:
            continue

        mask = Image.new("L", image.size)
        ImageDraw.Draw(mask).point(points, fill=255)
        center_x = sum(point[0] for point in points) / len(points)
        center_y = sum(point[1] for point in points) / len(points)
        sections.append((mask, center_x, center_y))

    return sections


def main():
    source = Image.open(MASTER).convert("RGBA")
    source = source.crop(source.getchannel("A").getbbox())
    source.thumbnail((RAM_WIDTH, RAM_WIDTH), Image.Resampling.LANCZOS)
    sections = find_sections(source)
    if len(sections) < 5:
        raise RuntimeError(f"Could only identify {len(sections)} ram sections")

    offset = ((SIZE - source.width) // 2, (SIZE - source.height) // 2)
    frames = []
    for frame_index in range(FRAMES):
        ram = source.copy()
        for mask, x, y in sections:
            # The phase follows the actual enclosed panels from horn to tail.
            phase = (x / source.width) * 1.4 + (y / source.height) * 0.25
            wave = (1 + cos(2 * pi * (frame_index / FRAMES - phase))) / 2
            shade = round(206 + 49 * wave)
            color = Image.new("RGBA", source.size, (shade, shade, min(255, shade + 2), 255))
            ram.paste(color, (0, 0), mask)

        canvas = Image.new("RGBA", (SIZE, SIZE), BACKGROUND)
        canvas.alpha_composite(ram, offset)
        frames.append(canvas.convert("RGB"))

    frames[0].save(PNG, optimize=True)
    animated = [frame.resize((512, 512), Image.Resampling.LANCZOS) for frame in frames]
    animated[0].save(
        GIF,
        save_all=True,
        append_images=animated[1:],
        duration=90,
        loop=0,
        optimize=True,
    )
    print(f"Rendered {PNG} and {GIF} with {len(sections)} animated sections")


if __name__ == "__main__":
    main()
