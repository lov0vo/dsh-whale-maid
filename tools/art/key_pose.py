"""Chroma-key a green-screen render and normalise it to the sprite cell spec.

The image model cannot emit transparency, so every raw frame comes back on a
flat #00FF00 background. This script keys that green out and rescales what is
left onto the cell every other tool here assumes:

    cell              256x256 RGBA, transparent outside the silhouette
    character height  225 px
    feet              flush with the bottom edge (ink bottom == y = 256)
    centring          ink centred on x = 128, width capped at 246 px

Two steps, both importable: `key_out()` writes the despilled cutout,
`normalise()` writes the final cell.

Usage:
    python key_pose.py <raw.png> <out.png> [--band top,bottom]

`--band` measures the height inside a horizontal slice instead of the whole
frame. Use it when a floating effect above her head (sparkles, dots, an anger
mark) would otherwise be counted as part of her height.

This supersedes key_and_normalise.py, whose main() had two hard-coded path
pairs and ignored sys.argv - running it verbatim would silently overwrite two
shipped sprites.
"""

import sys

from PIL import Image

TARGET = 256
CHAR_H = 225
MAX_W = 246
ALPHA_LOW = 8
ALPHA_HIGH = 72

USAGE = 'usage: python key_pose.py <raw.png> <out.png> [--band top,bottom]'


def key_out(src, dst):
    image = Image.open(src).convert('RGBA')
    pixels = image.load()
    width, height = image.size

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            key = g - max(r, b)
            if key <= ALPHA_LOW:
                alpha = 255
            elif key >= ALPHA_HIGH:
                alpha = 0
            else:
                alpha = int(255 * (ALPHA_HIGH - key) / (ALPHA_HIGH - ALPHA_LOW))
            pixels[x, y] = (r, min(g, max(r, b)), b, min(a, alpha))

    image.save(dst)
    return image


def normalise(src, dst, band=None):
    image = Image.open(src).convert('RGBA')
    region = image.crop((0, band[0], image.width, band[1])) if band else image

    bbox = region.getbbox()
    if bbox is None:
        raise SystemExit('empty image after keying')
    left, top, right, bottom = bbox
    box_w, box_h = right - left, bottom - top
    scale = CHAR_H / box_h
    new_w = max(1, min(MAX_W, round(box_w * scale)))
    scaled = region.crop(bbox).resize((new_w, CHAR_H), Image.LANCZOS)

    canvas = Image.new('RGBA', (TARGET, TARGET), (0, 0, 0, 0))
    canvas.paste(scaled, (round((TARGET - new_w) / 2), TARGET - CHAR_H), scaled)
    canvas.save(dst)
    return canvas


def main(argv):
    if '-h' in argv[1:] or '--help' in argv[1:]:
        print(__doc__.strip())
        return 0

    args = [a for a in argv[1:] if not a.startswith('--')]
    if len(args) < 2:
        raise SystemExit(USAGE)
    raw, out = args[0], args[1]
    band = None
    for arg in argv[1:]:
        if arg.startswith('--band='):
            band = tuple(int(v) for v in arg.split('=', 1)[1].split(','))
    keyed = raw[:-4] + '-keyed.png' if raw.endswith('.png') else raw + '-keyed.png'
    key_out(raw, keyed)
    canvas = normalise(keyed, out, band)
    green = sum(1 for r, g, b, a in canvas.getdata() if a > 40 and g - max(r, b) > 24)
    print(f'{out}: bbox={canvas.getbbox()} green_left={green}')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
