"""Verify that every sprite sheet really has independent frames.

Two frames can differ in most of their pixels and still be the same drawing:
scaling by 2% and rotating by 1 degree moves every edge, so a raw pixel diff
reports 60-70% "different" for a pseudo frame. What actually distinguishes a
redrawn frame is the **silhouette**: a new arm position changes the alpha mask,
a geometric transform barely does.

So this reports, per frame pair:
  * mask IoU  - overlap of the two alpha silhouettes (pseudo frames sit ~0.95+)
  * shape change - 1 - IoU, i.e. how much of the silhouette moved
and flags a pair as SUSPECT when the silhouette barely changes.

Usage:
    python verify_frames.py <dir-or-file> [...]

Read-only. Exits 1 when any sheet has a pseudo frame, so it can gate a release.
"""
import os
import sys

from PIL import Image

CELL = 256
MIN_SHAPE_CHANGE = 0.05  # silhouettes must differ by at least 5% of their union

USAGE = 'usage: python verify_frames.py <dir-or-file> [...]'


def load_sheet(path):
    image = Image.open(path).convert('RGBA')
    width, height = image.size
    if height != CELL or width % CELL != 0:
        return None, f'bad size {width}x{height}'
    return [image.crop((i * CELL, 0, (i + 1) * CELL, CELL)) for i in range(width // CELL)], width // CELL


def mask_of(frame):
    return frame.split()[3].point(lambda a: 255 if a > 24 else 0)


def iou(a, b):
    pa, pb = a.load(), b.load()
    inter = union = 0
    for y in range(CELL):
        for x in range(CELL):
            va = pa[x, y] > 0
            vb = pb[x, y] > 0
            if va or vb:
                union += 1
                if va and vb:
                    inter += 1
    return 1.0 if union == 0 else inter / union


def check(path):
    frames, info = load_sheet(path)
    name = os.path.basename(path)
    if frames is None:
        print(f'{name:<14} SKIP {info}')
        return False
    for index, frame in enumerate(frames):
        box = frame.getbbox()
        height = 0 if box is None else box[3] - box[1]
        bottom = 0 if box is None else box[3]
        print(f'{name:<14} frame{index} bbox={box} h={height} bottom={bottom}')
    if len(frames) < 2:
        print(f'{name:<14} SUSPECT only {len(frames)} frame(s)')
        return False
    masks = [mask_of(frame) for frame in frames]
    ok = True
    for i in range(len(frames)):
        for j in range(i + 1, len(frames)):
            overlap = iou(masks[i], masks[j])
            change = 1.0 - overlap
            verdict = 'ok' if change >= MIN_SHAPE_CHANGE else 'SUSPECT pseudo (silhouette barely moves)'
            if change < MIN_SHAPE_CHANGE:
                ok = False
            print(f'{name:<14} f{i}~f{j} silhouette IoU {overlap:.3f}  shape change {change * 100:4.1f}%  {verdict}')
    return ok


def main(argv):
    if '-h' in argv or '--help' in argv:
        print(__doc__.strip())
        return 0
    targets = [a for a in argv if not a.startswith('--')]
    if not targets:
        raise SystemExit(USAGE)
    files = []
    for target in targets:
        if os.path.isdir(target):
            files.extend(sorted(os.path.join(target, n) for n in os.listdir(target) if n.endswith('.png')))
        else:
            files.append(target)
    good, bad = 0, []
    for path in files:
        if check(path):
            good += 1
        else:
            bad.append(os.path.basename(path))
    print(f'\n{good}/{len(files)} sheets have independent frames')
    if bad:
        print('needs work: ' + ', '.join(bad))
    return 0 if not bad else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
