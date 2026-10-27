#!/usr/bin/env python3
"""
Generate SEO image assets for Boing Observer:
  - og-image.png (1200×630) — Open Graph / Twitter Card
  - favicon.ico (16, 32, 48px)
  - apple-touch-icon.png (180×180)

Requires: pip install Pillow

Usage: python scripts/generate-seo-assets.py
"""

import os
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Error: Pillow is required. Install with: pip install Pillow")
    sys.exit(1)

# Boing design tokens
BG_DARK = "#050b16"
BG_NAVY = "#071222"
ACCENT_CYAN = "#ffe14a"
ACCENT_PURPLE = "#ffe14a"
TEXT_PRIMARY = "#f4f7fb"
TEXT_MUTED = "#8b9bb0"

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "public"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def get_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """Try to load a suitable font; fall back to default."""
    candidates = []
    if sys.platform == "win32":
        candidates = [
            "C:/Windows/Fonts/arial.ttf",
            "C:/Windows/Fonts/arialbd.ttf",
            "C:/Windows/Fonts/segoeui.ttf",
        ]
    else:
        candidates = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/System/Library/Fonts/Helvetica.ttc",
        ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def draw_og_image() -> None:
    """Create 1200×630 OG image for social sharing."""
    w, h = 1200, 630
    img = Image.new("RGB", (w, h), hex_to_rgb(BG_DARK))
    draw = ImageDraw.Draw(img)

    # Accent circle (bottom-right)
    draw.ellipse([w - 280, h - 280, w + 20, h + 20], outline=hex_to_rgb(ACCENT_CYAN), width=4, fill=None)

    font_large = get_font(72, bold=True)
    font_small = get_font(36)

    title = "Boing Observer"
    subtitle = "See what happens on-chain"

    # Title with slight glow
    bbox = draw.textbbox((0, 0), title, font=font_large)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (w - tw) // 2
    y = h // 2 - th - 20

    draw.text((x + 2, y + 2), title, fill=hex_to_rgb(BG_NAVY), font=font_large)
    draw.text((x, y), title, fill=hex_to_rgb(TEXT_PRIMARY), font=font_large)

    # Subtitle
    bbox2 = draw.textbbox((0, 0), subtitle, font=font_small)
    tw2 = bbox2[2] - bbox2[0]
    x2 = (w - tw2) // 2
    draw.text((x2, y + th + 30), subtitle, fill=hex_to_rgb(ACCENT_CYAN), font=font_small)

    # Tagline
    tagline = "Public testnet — mainnet not live"
    bbox3 = draw.textbbox((0, 0), tagline, font=font_small)
    tw3 = bbox3[2] - bbox3[0]
    draw.text(((w - tw3) // 2, h - 80), tagline, fill=hex_to_rgb(TEXT_MUTED), font=font_small)

    out = OUTPUT_DIR / "og-image.png"
    img.save(out, "PNG", optimize=True)
    print(f"Created {out}")


def draw_favicon() -> None:
    """Create favicon.ico with 16, 32, 48px sizes."""
    s = 48
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([0, 0, s - 1, s - 1], radius=s // 6, fill=hex_to_rgb(BG_DARK))
    inset = s // 5
    draw.rounded_rectangle(
        [inset, inset, s - 1 - inset, s - 1 - inset],
        radius=max(2, s // 10),
        fill=hex_to_rgb(ACCENT_CYAN),
    )

    out = OUTPUT_DIR / "favicon.ico"
    img.save(out, "ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"Created {out}")


def draw_apple_touch_icon() -> None:
    """Create 180×180 Apple Touch Icon."""
    s = 180
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    draw.rounded_rectangle([0, 0, s - 1, s - 1], radius=s // 6, fill=hex_to_rgb(BG_DARK))
    inset = s // 5
    draw.rounded_rectangle(
        [inset, inset, s - 1 - inset, s - 1 - inset],
        radius=max(4, s // 10),
        fill=hex_to_rgb(ACCENT_CYAN),
    )

    out = OUTPUT_DIR / "apple-touch-icon.png"
    img.save(out, "PNG", optimize=True)
    print(f"Created {out}")


def main() -> None:
    os.chdir(OUTPUT_DIR.parent)
    print("Generating SEO assets...")
    draw_og_image()
    draw_favicon()
    draw_apple_touch_icon()
    print("Done. Assets saved to public/")


if __name__ == "__main__":
    main()
