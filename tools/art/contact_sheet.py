"""Build a contact sheet: one row per pose, one column per frame.

Lets a human (or a model reading the PNG) confirm at a glance that the three
frames are the same character in the same pose but genuinely different drawings,
and that the character is not drifting between poses.

Usage:
    python contact_sheet.py <out.png> <sheet.png> [<sheet.png> ...]

Writes exactly one PNG, the one you name - nothing else is touched.
"""
import os
import sys

from PIL import Image, ImageDraw

CELL = 256
SCALE = 0.5
LABEL = 16

USAGE = 'usage: python contact_sheet.py <out.png> <sheet.png> [<sheet.png> ...]'


def main(argv):
    if '-h' in argv or '--help' in argv:
        print(__doc__.strip())
        return 0
    if len(argv) < 3:
        raise SystemExit(USAGE)
    out, sheets = argv[1], argv[2:]

    rows = []
    for path in sheets:
        image = Image.open(path).convert('RGBA')
        frames = image.size[0] // CELL
        rows.append((os.path.splitext(os.path.basename(path))[0],
                     [image.crop((i * CELL, 0, (i + 1) * CELL, CELL)) for i in range(frames)]))

    columns = max(len(frames) for _, frames in rows)
    cell_w = int(CELL * SCALE)
    cell_h = int(CELL * SCALE)
    width = cell_w * columns
    height = (cell_h + LABEL) * len(rows)
    sheet = Image.new('RGB', (width, height), (24, 26, 32))
    draw = ImageDraw.Draw(sheet)

    for row, (name, frames) in enumerate(rows):
        top = row * (cell_h + LABEL)
        draw.text((2, top + 2), f'{name}  ({len(frames)} frames)', fill=(210, 216, 226))
        for column, frame in enumerate(frames):
            # checkerboard so transparent areas read as transparent, not black
            tile = Image.new('RGB', (cell_w, cell_h), (40, 42, 48))
            for y in range(0, cell_h, 8):
                for x in range(0, cell_w, 8):
                    if (x // 8 + y // 8) % 2 == 0:
                        tile.paste((52, 54, 62), (x, y, min(x + 8, cell_w), min(y + 8, cell_h)))
            scaled = frame.resize((cell_w, cell_h), Image.LANCZOS)
            tile.paste(scaled, (0, 0), scaled)
            sheet.paste(tile, (column * cell_w, top + LABEL))

    sheet.save(out)
    print(f'wrote {out} {sheet.size[0]}x{sheet.size[1]} ({len(rows)} rows)')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
