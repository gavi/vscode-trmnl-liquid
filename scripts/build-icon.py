#!/usr/bin/env python3
"""Generate a 1-bit style icon: e-paper screen with a magnifier glass overlay."""
from PIL import Image, ImageDraw

SIZE = 256
BLACK = (0, 0, 0, 255)
WHITE = (255, 255, 255, 255)

img = Image.new("RGBA", (SIZE, SIZE), WHITE)
d = ImageDraw.Draw(img)

# ---- e-paper screen (back, slightly off-center top-left) ----
sx, sy = 28, 44
sw, sh = 168, 112
border = 6
d.rectangle([sx, sy, sx + sw, sy + sh], outline=BLACK, width=border)

# inside content: a "value" block (large bar) + label rows
inner_x = sx + border + 8
inner_y = sy + border + 8
inner_w = sw - 2 * (border + 8)
# big value bar (simulated number)
d.rectangle([inner_x, inner_y, inner_x + 70, inner_y + 26], fill=BLACK)
# two label/data rows
row_y = inner_y + 38
for i in range(2):
    d.rectangle(
        [inner_x, row_y + i * 16, inner_x + inner_w - 20 - i * 18, row_y + i * 16 + 6],
        fill=BLACK,
    )
# 1-bit dither dots in lower right of screen
for px in range(inner_x + 90, sx + sw - 12, 6):
    for py in range(inner_y + 38, sy + sh - 12, 6):
        if (px // 6 + py // 6) % 2 == 0:
            d.rectangle([px, py, px + 2, py + 2], fill=BLACK)

# ---- magnifier glass (front, lower-right, overlapping the screen) ----
cx, cy = 168, 168
r = 50
ring = 10
# outer black ring
d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BLACK)
# inner white (glass)
d.ellipse(
    [cx - r + ring, cy - r + ring, cx + r - ring, cy + r - ring],
    fill=WHITE,
)

# ---- handle: thick rectangle rotated 45deg ----
# create the handle on a transparent layer, rotate, paste
handle_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
hd = ImageDraw.Draw(handle_layer)
handle_w = 18
# vertical handle stub starting at glass edge, going down
# we'll rotate the whole layer 45deg about (cx, cy)
hd.rectangle(
    [cx - handle_w // 2, cy + r - 2, cx + handle_w // 2, cy + r + 56],
    fill=BLACK,
)
# rotate around (cx, cy)
handle_rotated = handle_layer.rotate(-45, resample=Image.NEAREST, center=(cx, cy))
img.alpha_composite(handle_rotated)

# ---- save ----
import os
out = os.path.join(os.path.dirname(__file__), "..", "media", "icon.png")
out = os.path.normpath(out)
# also output a 128 version (some marketplaces sample at 128)
img.save(out)
print(f"wrote {out} (256×256)")
