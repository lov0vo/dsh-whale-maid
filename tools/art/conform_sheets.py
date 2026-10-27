"""Bring outlier frames of a sheet back onto the sprite spec.

key_pose.py scales by whatever the generator happened to draw, so a frame whose
character came out smaller (drag f1 h=198, sad f1 h=196) sits low and shrinks
for one frame - the sprite visibly "breathes" on that frame.

A blanket "make every frame 225px tall" rule is wrong, because some poses are
legitimately shorter: the sleeping whale is curled up at ~195px on every frame.
So this compares frames **within a sheet** and only corrects the outlier:

  * median silhouette height of the sheet's frames = H
  * a frame more than 12px shorter than H is scaled up to H and re-flushed
  * a frame whose feet sit more than 3px above y=256 is shifted down
  * everything else is left untouched, so shipped artwork is not resampled

Usage:
    python conform_sheets.py <dir-or-file> [...] [--dry-run]

Without --dry-run the sheets are rewritten in place, so point it at the files
you mean to touch.
"""
import os
import statistics
import sys

from PIL import Image

CELL = 256
OUTLIER = 12
SHIFT_MIN = 4
ALPHA = 16
MAX_W = 246

USAGE = 'usage: python conform_sheets.py <dir-or-file> [...] [--dry-run]'


def frames_of(image):
    return [image.crop((i * CELL, 0, (i + 1) * CELL, CELL)) for i in range(image.size[0] // CELL)]


def metrics(frame):
    mask = frame.split()[3].point(lambda a: 255 if a > ALPHA else 0)
    bounds = mask.getbbox()
    if bounds is None:
        return None
    return bounds, bounds[3] - bounds[1]


def rebuild(body, width, height):
    out = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    out.alpha_composite(body, ((CELL - width) // 2, CELL - height))
    return out


def process(path, dry):
    name = os.path.basename(path)
    image = Image.open(path).convert('RGBA')
    if image.size[1] != CELL or image.size[0] % CELL != 0:
        print(f'{name:<14} SKIP bad size {image.size}')
        return False
    frames = frames_of(image)
    info = [metrics(frame) for frame in frames]
    heights = [item[1] for item in info if item is not None]
    if not heights:
        print(f'{name:<14} SKIP all frames empty')
        return False
    median = statistics.median(heights)

    out_frames = []
    touched = False
    for index, (frame, item) in enumerate(zip(frames, info)):
        if item is None:
            out_frames.append(frame)
            continue
        bounds, height = item
        body = frame.crop(bounds)
        width = body.size[0]
        if height < median - OUTLIER:
            scale = median / height
            width = min(MAX_W, max(1, round(width * scale)))
            body = body.resize((width, int(round(median))), Image.LANCZOS)
            out_frames.append(rebuild(body, width, body.size[1]))
            print(f'  {name} f{index}: h={height} bottom={bounds[3]} → h={body.size[1]} bottom={CELL} (scaled {scale:.3f} to sheet median {median:.0f})')
            touched = True
        elif CELL - bounds[3] >= SHIFT_MIN:
            shift = CELL - bounds[3]
            out_frames.append(rebuild(body, width, height))
            print(f'  {name} f{index}: feet {shift}px above the bottom → shifted down')
            touched = True
        else:
            out_frames.append(frame)

    if touched and not dry:
        sheet = Image.new('RGBA', (CELL * len(out_frames), CELL), (0, 0, 0, 0))
        for index, frame in enumerate(out_frames):
            sheet.alpha_composite(frame, (index * CELL, 0))
        sheet.save(path)
        print(f'{name:<14} rewritten')
    elif not touched:
        print(f'{name:<14} ok (no change)')
    return touched


def main(argv):
    if '-h' in argv or '--help' in argv:
        print(__doc__.strip())
        return 0
    dry = '--dry-run' in argv
    targets = [a for a in argv if not a.startswith('--')]
    if not targets:
        raise SystemExit(USAGE)
    files = []
    for target in targets:
        if os.path.isdir(target):
            files.extend(sorted(os.path.join(target, n) for n in os.listdir(target) if n.endswith('.png')))
        else:
            files.append(target)
    changed = sum(1 for path in files if process(path, dry))
    print(f'\n{changed}/{len(files)} sheets adjusted' + (' (dry run)' if dry else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
