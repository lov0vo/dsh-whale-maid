"""Compose sprite cells into one horizontal sheet: frames * 256 x 256.

The shipped sheets are 768x256 (three 256x256 cells). Frame 0 is normally kept
as-is and only the new cells are appended, so a frame that already looked right
is not re-normalised and shifted.

Usage:
    python compose_frames.py <existing-sheet.png> <new1.png> [<new2.png> ...] <out.png>

`<existing-sheet.png>` is read as frame 0 (a 768x256 sheet contributes its first
cell, a 256x256 cell is taken whole). Everything else is appended in order, so
the output is (1 + n_new) * 256 wide. New cells must already be 256x256 and
bottom-flush - that is what key_pose.py produces.

`compose(frames, out)` is the importable form: pass the finished 256x256 cells
in order and get the sheet back.
"""
import sys

from PIL import Image

CELL = 256
FRAMES = 3

USAGE = 'usage: python compose_frames.py <existing-sheet.png> <new1.png> [<new2.png> ...] <out.png>'


def load_cell(path, label):
    image = Image.open(path).convert('RGBA')
    if image.size == (CELL, CELL):
        return image
    if image.size[1] == CELL and image.size[0] % CELL == 0:
        return image.crop((0, 0, CELL, CELL))
    raise SystemExit(f'{label}: expected {CELL}x{CELL} or {CELL * FRAMES}x{CELL}, got {image.size}')


def compose(frames, out):
    sheet = Image.new('RGBA', (CELL * len(frames), CELL), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        # alpha_composite, not paste(frame, box, frame): using the frame as its own
        # mask squares the alpha of every soft edge, which shaved 1-2px off the
        # silhouette (h 225 -> 223) and pulled the feet off the bottom edge.
        cell = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
        cell.alpha_composite(frame)
        sheet.alpha_composite(cell, (index * CELL, 0))

    # Report the per-frame bounding boxes so the caller can spot a broken frame.
    for index, frame in enumerate(frames):
        box = frame.getbbox()
        height = 0 if box is None else box[3] - box[1]
        bottom = 0 if box is None else box[3]
        print(f'  frame{index}: bbox={box} h={height} bottom={bottom}')
        if box is None:
            raise SystemExit(f'frame{index} is empty')

    sheet.save(out)
    print(f'wrote {out} {sheet.size[0]}x{sheet.size[1]}')
    return sheet


def main(argv):
    if '-h' in argv[1:] or '--help' in argv[1:]:
        print(__doc__.strip())
        return 0
    if len(argv) < 4:
        raise SystemExit(USAGE)
    existing, new, out = argv[1], argv[2:-1], argv[-1]
    frames = [load_cell(existing, 'existing')]
    for index, path in enumerate(new):
        frames.append(load_cell(path, f'frame{index + 1}'))
    compose(frames, out)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
