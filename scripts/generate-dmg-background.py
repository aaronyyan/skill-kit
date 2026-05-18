#!/usr/bin/env python3
"""
Final DMG background: clean white, "all your skills, one view" + hand-drawn arc arrow.

Positions derived from actual screenshot measurements (2x background coords):
- App icon center: approximately (200, 290)
- Folder icon center: approximately (594, 300)
- Text "all your skills, one view": above-left of app icon

Window: 720x440 (1x), background: 1440x880 (2x retina)
"""

from PIL import Image, ImageDraw, ImageFont
import math, random

WIDTH, HEIGHT = 1440, 880

# Measured icon centers in 2x background coords (from screenshot analysis)
APP_CX, APP_CY = 200, 290
FOLDER_CX, FOLDER_CY = 594, 300

FONT_PATH = "/tmp/Caveat.ttf"


def draw_hand_arc(draw, p1, p2, color, width=3):
    """Draw a hand-drawn arc from p1 to p2 curving upward."""
    mx = (p1[0] + p2[0]) / 2
    my = min(p1[1], p2[1]) - 100  # arc peak above the icons
    ctrl = (mx, my)

    steps = 60
    pts = []
    rng = random.Random(42)
    for i in range(steps + 1):
        t = i / steps
        x = (1-t)**2*p1[0] + 2*(1-t)*t*ctrl[0] + t**2*p2[0]
        y = (1-t)**2*p1[1] + 2*(1-t)*t*ctrl[1] + t**2*p2[1]
        pts.append((x + rng.uniform(-1, 1), y + rng.uniform(-1, 1)))

    for i in range(len(pts) - 1):
        w = width + rng.uniform(-0.5, 0.5)
        draw.line([pts[i], pts[i+1]], fill=color, width=max(2, int(w)))

    # Arrowhead
    dx = pts[-1][0] - pts[-5][0]
    dy = pts[-1][1] - pts[-5][1]
    ln = math.sqrt(dx*dx + dy*dy)
    if ln > 0:
        dx, dy = dx/ln, dy/ln
        px, py = -dy, dx
        tip = pts[-1]
        l = (tip[0] - 22*dx + 11*px, tip[1] - 22*dy + 11*py)
        r = (tip[0] - 22*dx - 11*px, tip[1] - 22*dy - 11*py)
        draw.polygon([tip, l, r], fill=color)


def main():
    random.seed(42)
    img = Image.new('RGBA', (WIDTH, HEIGHT), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)

    accent = (94, 106, 210)

    # --- "all your skills, one view" text ---
    font = ImageFont.truetype(FONT_PATH, 48)
    text = "all your skills, one view"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    # Place centered on app icon, left-aligned look
    draw.text((APP_CX - tw // 2, 50), text, fill=(50, 50, 50), font=font)

    # --- Hand-drawn arc from app to folder ---
    # Shorter arrow: stops at folder's left edge, not center
    arc_start = (APP_CX + 40, APP_CY - 30)
    arc_end = (FOLDER_CX - 100, FOLDER_CY - 30)
    draw_hand_arc(draw, arc_start, arc_end, accent, width=3)

    # --- Save ---
    out = "/Users/yanlixing/Documents/New project 4/src-tauri/assets/dmg-background.png"
    img.save(out, "PNG")
    print(f"Saved: {out}")


if __name__ == "__main__":
    main()
