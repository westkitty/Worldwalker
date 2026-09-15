import os
import sys
import subprocess
import math
from PIL import Image, ImageDraw, ImageFilter, ImageFont

def create_worldwalker_icon(output_icns_path):
    size = 1024
    icon = Image.new('RGBA', (size, size), (0, 0, 0, 0))

    # Base squircle geometry (Apple icon grid: 824x824 at (100, 96), r=185)
    sq_x, sq_y = 100, 96
    sq_w, sq_h = 824, 824
    radius = 185

    # 1. Drop shadow
    shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    s_draw.rounded_rectangle(
        [sq_x, sq_y + 16, sq_x + sq_w, sq_y + sq_h + 16],
        radius=radius,
        fill=(0, 0, 0, 140)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    icon.paste(shadow, (0, 0), shadow)

    # 2. Main squircle content
    squircle = Image.new('RGBA', (size, size), (0, 0, 0, 0))

    # Mask for the squircle
    mask = Image.new('L', (size, size), 0)
    m_draw = ImageDraw.Draw(mask)
    m_draw.rounded_rectangle([sq_x, sq_y, sq_x + sq_w, sq_y + sq_h], radius=radius, fill=255)

    # Create gradient background
    bg = Image.new('RGBA', (size, size), (6, 11, 20, 255))
    bg_draw = ImageDraw.Draw(bg)
    # Radial glow in center
    cx, cy = size // 2, size // 2 - 20
    for r in range(480, 0, -12):
        factor = 1.0 - (r / 480.0)
        # Deep navy (#070d18) -> Rich Meridian Blue (#132a4a) -> Bright Core (#224a78)
        red = int(7 + factor * 22)
        green = int(13 + factor * 48)
        blue = int(24 + factor * 90)
        alpha = int(factor * 210)
        bg_draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(red, green, blue, alpha))

    # Add celestial star / rune specks
    import random
    rng = random.Random(42)
    for _ in range(75):
        sx = sq_x + int(rng.random() * sq_w)
        sy = sq_y + int(rng.random() * sq_h)
        sr = rng.choice([1, 2, 2, 3])
        s_col = rng.choice([(246, 198, 91, 160), (72, 183, 232, 160), (242, 230, 197, 180)])
        bg_draw.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=s_col)

    # Concentric gold cartographic dials
    for ring_r in [180, 240, 310, 370]:
        bg_draw.ellipse(
            [cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
            outline=(246, 198, 91, 45 if ring_r != 310 else 90),
            width=2 if ring_r != 310 else 3
        )

    # Celestial cross lines (Orrery / Compass style)
    for angle_deg in [0, 45, 90, 135]:
        rad = math.radians(angle_deg)
        x1 = cx + math.cos(rad) * 120
        y1 = cy + math.sin(rad) * 120
        x2 = cx + math.cos(rad) * 360
        y2 = cy + math.sin(rad) * 360
        bg_draw.line([(x1, y1), (x2, y2)], fill=(246, 198, 91, 40), width=1)
        bg_draw.line([(cx - math.cos(rad) * 120, cy - math.sin(rad) * 120),
                      (cx - math.cos(rad) * 360, cy - math.sin(rad) * 360)], fill=(246, 198, 91, 40), width=1)

    # 3. Add Hero Portrait in center
    hero_path = 'public/assets/runtime/portrait_hero_smile.png'
    if os.path.exists(hero_path):
        hero = Image.open(hero_path).convert('RGBA')
        target_h = 460
        aspect = hero.width / hero.height
        target_w = int(target_h * aspect)
        hero_resized = hero.resize((target_w, target_h), Image.Resampling.LANCZOS)

        # Soft glow behind hero
        glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        g_draw = ImageDraw.Draw(glow)
        g_draw.ellipse([cx - 210, cy - 210, cx + 210, cy + 210], fill=(72, 183, 232, 70))
        glow = glow.filter(ImageFilter.GaussianBlur(36))
        bg.paste(glow, (0, 0), glow)

        # Paste hero centered
        hero_x = cx - target_w // 2
        hero_y = cy - target_h // 2 - 10
        bg.paste(hero_resized, (hero_x, hero_y), hero_resized)

    # 4. Add Gold Border inside squircle
    bg_draw.rounded_rectangle(
        [sq_x + 4, sq_y + 4, sq_x + sq_w - 4, sq_y + sq_h - 4],
        radius=radius - 4,
        outline=(246, 198, 91, 230),
        width=8
    )
    bg_draw.rounded_rectangle(
        [sq_x + 14, sq_y + 14, sq_x + sq_w - 14, sq_y + sq_h - 14],
        radius=radius - 14,
        outline=(212, 166, 77, 90),
        width=2
    )

    # 5. Top Rune ✦
    font_path = '/System/Library/Fonts/Supplemental/Georgia Bold.ttf'
    if os.path.exists(font_path):
        font_rune = ImageFont.truetype(font_path, 42)
        font_title = ImageFont.truetype(font_path, 44)
        font_sub = ImageFont.truetype(font_path, 19)
    else:
        font_rune = font_title = font_sub = None

    if font_rune:
        bg_draw.text((cx, sq_y + 54), "✦", font=font_rune, fill=(246, 210, 127, 240), anchor="mm")

    # 6. Bottom Banner: "WORLDWALKER"
    banner_y = sq_y + sq_h - 100
    bg_draw.rectangle([sq_x + 60, banner_y - 28, sq_x + sq_w - 60, banner_y + 36], fill=(5, 9, 16, 235))
    bg_draw.rectangle([sq_x + 60, banner_y - 28, sq_x + sq_w - 60, banner_y + 36], outline=(246, 198, 91, 210), width=2)

    if font_title:
        bg_draw.text((cx, banner_y - 2), "WORLDWALKER", font=font_title, fill=(246, 210, 127, 255), anchor="mm")
        bg_draw.text((cx, banner_y + 22), "REALM OF LIVING PROJECTS", font=font_sub, fill=(155, 175, 198, 220), anchor="mm")

    # Apply squircle mask
    squircle.paste(bg, (0, 0), mask)
    icon.paste(squircle, (0, 0), squircle)

    # Create iconset directory
    iconset_dir = '/tmp/Worldwalker.iconset'
    os.makedirs(iconset_dir, exist_ok=True)

    sizes = [
        (16, 'icon_16x16.png'),
        (32, 'icon_16x16@2x.png'),
        (32, 'icon_32x32.png'),
        (64, 'icon_32x32@2x.png'),
        (128, 'icon_128x128.png'),
        (256, 'icon_128x128@2x.png'),
        (256, 'icon_256x256.png'),
        (512, 'icon_256x256@2x.png'),
        (512, 'icon_512x512.png'),
        (1024, 'icon_512x512@2x.png'),
    ]

    for px, name in sizes:
        resized = icon.resize((px, px), Image.Resampling.LANCZOS)
        resized.save(os.path.join(iconset_dir, name))

    os.makedirs(os.path.dirname(os.path.abspath(output_icns_path)), exist_ok=True)
    subprocess.run(['iconutil', '-c', 'icns', iconset_dir, '-o', output_icns_path], check=True)
    print(f"Generated {output_icns_path} successfully!")

if __name__ == '__main__':
    out_path = sys.argv[1] if len(sys.argv) > 1 else 'macos/Worldwalker.icns'
    create_worldwalker_icon(out_path)
