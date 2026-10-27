"""Animation consistency pass: within-sheet height equalisation, frame ordering,
and regeneration of the click hot-zone registration table.

Three jobs, in this order (each one changes the artwork the next one measures):

1. HEIGHT. Every frame of a sheet is drawn into the same 256px cell, but the
   model redraws each frame independently, so a three-frame sheet can breathe:
   `play` measured 222/224/216 and `sleep` 201/193 before 2.1.1. Frames are
   scaled so the tallest ink matches the SHORTEST frame of the same sheet (only
   ever shrink, so nothing gains softness), anchored on the feet and the
   horizontal ink centre. Sheets whose spread is <= 2px are left untouched -
   that 1-2px bounce is the hand-drawn charm of the original art.

2. ORDER. Frames inside a loop should read as a smooth cycle. For each sheet
   with three frames, all six orderings are scored by the total mask IoU along
   the loop (f0->f1->f2->f0) and the best one wins. Two-frame sheets are left
   alone (swapping ping-pong frames is a no-op).

3. HOT ZONES. `DWM_HIT_REG` maps the current pose back onto the idle reference
   frame so one set of rects keeps working for every drawing. It is derived from
   the alpha centroid, not the bounding box: on `walk` the bbox edge travels
   27px because the tail tucks in, while the body itself barely moves. The table
   is rewritten between the BEGIN/END markers in src/zones.js.

Usage:
    python fix_anim.py --dry-run [--repo PATH]
    python fix_anim.py [--repo PATH]

`--repo` defaults to the checkout this script lives in (two levels up from
tools/art/). `--dry-run` prints what would change, including the generated
DWM_HIT_REG block, and writes nothing.
"""
import itertools
import os
import re
import sys
from pathlib import Path

from PIL import Image

CELL = 256
ALPHA_INK = 8
HEIGHT_TOLERANCE = 2

BEGIN = '// BEGIN DWM_HIT_REG'
END = '// END DWM_HIT_REG'

DEFAULT_REPO = Path(__file__).resolve().parents[2]
REPO = DEFAULT_REPO
SPRITES = os.path.join(str(REPO), 'src', 'sprites')
POSES = os.path.join(SPRITES, 'poses')
ZONES = os.path.join(str(REPO), 'src', 'zones.js')


def configure(repo):
    """Point every derived path at another checkout."""
    global REPO, SPRITES, POSES, ZONES
    REPO = Path(repo).resolve()
    SPRITES = os.path.join(str(REPO), 'src', 'sprites')
    POSES = os.path.join(SPRITES, 'poses')
    ZONES = os.path.join(str(REPO), 'src', 'zones.js')


def sheet_paths():
    out = []
    for name in sorted(os.listdir(SPRITES)):
        if name.endswith('.png'):
            out.append(('sprites', name[:-4], os.path.join(SPRITES, name)))
    # `src/sprites/poses/wink.png` is a leftover copy of the `wink` animation
    # sheet; a second entry under the same `state#frame` key would silently
    # shadow the real one, so poses never overwrite an animation state name.
    animations = {stem for folder, stem, _ in out if folder == 'sprites'}
    for name in sorted(os.listdir(POSES)):
        if name.endswith('.png') and name[:-4] not in animations:
            out.append(('poses', name[:-4], os.path.join(POSES, name)))
    return out


def load_frames(path):
    sheet = Image.open(path).convert('RGBA')
    count = sheet.width // CELL
    return [sheet.crop((i * CELL, 0, (i + 1) * CELL, CELL)) for i in range(count)]


def ink_box(frame):
    mask = frame.getchannel('A').point(lambda a: 255 if a > ALPHA_INK else 0)
    return mask.getbbox()


def ink_metrics(frame):
    """height, centre x and alpha centroid of one cell."""
    box = ink_box(frame)
    if box is None:
        return {'height': 0, 'cx': 128.0, 'cy': 128.0, 'area': 0.0}
    x0, y0, x1, y1 = box
    alpha = frame.getchannel('A')
    total = 0.0
    sum_x = 0.0
    sum_y = 0.0
    data = list(alpha.getdata())
    for index, value in enumerate(data):
        if value <= ALPHA_INK:
            continue
        total += value
        sum_x += (index % CELL) * value
        sum_y += (index // CELL) * value
    if total <= 0:
        return {'height': y1 - y0, 'cx': (x0 + x1) / 2.0, 'cy': (y0 + y1) / 2.0, 'area': 0.0}
    return {'height': y1 - y0, 'cx': sum_x / total, 'cy': sum_y / total, 'area': total / 255.0}


def mask_of(frame):
    return frame.getchannel('A').point(lambda a: 255 if a > 64 else 0)


def iou(a, b):
    pa = a.load()
    pb = b.load()
    both = 0
    either = 0
    for y in range(CELL):
        for x in range(CELL):
            va = pa[x, y] > 0
            vb = pb[x, y] > 0
            if va and vb:
                both += 1
            if va or vb:
                either += 1
    return both / float(either) if either else 1.0


def resize_frame(frame, scale):
    if abs(scale - 1.0) < 0.002:
        return frame
    box = ink_box(frame)
    width = max(1, int(round(CELL * scale)))
    height = max(1, int(round(CELL * scale)))
    scaled = frame.resize((width, height), Image.LANCZOS)
    # anchor: feet on the bottom edge, ink centre on x=128
    cx = (box[0] + box[2]) / 2.0
    left = int(round(128 - cx * scale))
    top = CELL - height
    out = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    out.paste(scaled, (left, top), scaled)
    return out


def equalise_heights(name, frames):
    metrics = [ink_metrics(f) for f in frames]
    heights = [m['height'] for m in metrics]
    target = max(heights)
    spread = target - min(heights)
    if spread <= HEIGHT_TOLERANCE:
        return frames, '%s heights %s (spread %dpx, kept)' % (name, '/'.join(map(str, heights)), spread)
    if target <= 0:
        return frames, '%s empty sheet, skipped' % name
    if target / float(min(heights)) > 1.20:
        return frames, '%s heights %s (spread %dpx > 20%%, needs a redraw, kept)' % (
            name, '/'.join(map(str, heights)), spread)
    fixed = []
    for frame, metric in zip(frames, metrics):
        if metric['height'] <= 0:
            fixed.append(frame)
            continue
        fixed.append(resize_frame(frame, target / float(metric['height'])))
    after = [ink_metrics(f)['height'] for f in fixed]
    return fixed, '%s heights %s -> %s (target %d)' % (
        name, '/'.join(map(str, heights)), '/'.join(map(str, after)), target)


def best_order(name, frames):
    if len(frames) != 3:
        return frames, None
    masks = [mask_of(f) for f in frames]
    scores = {}
    for order in itertools.permutations(range(3)):
        total = 0.0
        for i in range(3):
            total += iou(masks[order[i]], masks[order[(i + 1) % 3]])
        scores[order] = total
    current = scores[(0, 1, 2)]
    best = max(scores, key=lambda k: scores[k])
    if best == (0, 1, 2) or scores[best] - current < 0.02:
        # ties are common (symmetric poses); reordering on a tie is pure churn
        return frames, '%s order kept (loop IoU %.3f)' % (name, current)
    return [frames[i] for i in best], '%s order %s -> %s (loop IoU %.3f -> %.3f)' % (
        name, '012', ''.join(map(str, best)), current, scores[best])


def write_sheet(path, frames):
    sheet = Image.new('RGBA', (CELL * len(frames), CELL), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.paste(frame, (index * CELL, 0))
    sheet.save(path)


def rebuild_hit_reg(dry):
    idle = load_frames(os.path.join(SPRITES, 'idle.png'))[0]
    base = ink_metrics(idle)
    lines = []
    for folder, stem, path in sheet_paths():
        frames = load_frames(path)
        for index, frame in enumerate(frames):
            metric = ink_metrics(frame)
            if metric['area'] <= 0 or base['area'] <= 0:
                continue
            scale = (metric['area'] / base['area']) ** 0.5
            dx = metric['cx'] - scale * base['cx']
            dy = metric['cy'] - scale * base['cy']
            lines.append('\t"%s#%d": [%.3f, %.1f, %.1f],' % (stem, index, scale, dx, dy))
    lines.sort()
    block = '%s (regenerated by tools/art/fix_anim.py - do not hand-edit)\n' % BEGIN
    block += 'var DWM_HIT_REG = {\n' + '\n'.join(lines) + "\n\t'*': [1, 0, 0],\n};\n" + END
    if dry:
        print(block)
        return len(lines)
    with open(ZONES, 'r', encoding='utf-8') as fh:
        source = fh.read()
    pattern = re.compile(re.escape(BEGIN) + r'.*?' + re.escape(END), re.S)
    if not pattern.search(source):
        raise SystemExit('markers not found in zones.js')
    with open(ZONES, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(pattern.sub(block, source))
    return len(lines)


def main(argv):
    if '-h' in argv or '--help' in argv:
        print(__doc__.strip())
        return 0
    dry = '--dry-run' in argv
    if '--repo' in argv:
        configure(argv[argv.index('--repo') + 1])
    if not os.path.isdir(SPRITES):
        raise SystemExit('no src/sprites under %s (pass --repo)' % REPO)

    changed = 0
    for folder, stem, path in sheet_paths():
        frames = load_frames(path)
        frames, note = equalise_heights(stem, frames)
        frames, order_note = best_order(stem, frames)
        touched = 'kept' not in note or order_note is not None
        if touched:
            print(note)
            if order_note:
                print(order_note)
        if not dry and touched:
            write_sheet(path, frames)
            changed += 1
    print('sheets rewritten: %d' % changed)
    rows = rebuild_hit_reg(dry)
    print('hit-reg rows: %d' % rows)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
