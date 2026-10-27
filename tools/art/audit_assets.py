"""Audit every shipped sprite sheet: geometry, baseline, green fringe, frame independence.

Usage:
    python audit_assets.py [repo]

Checks each 256-wide cell for height consistency, feet on y=256 and leftover
chroma-key green, then cross-checks the sheet names referenced by src/pose-map.js
and src/pet.js against the files on disk.

Read-only. `repo` defaults to the checkout this script lives in (two levels up
from tools/art/).
"""
import json
import os
import re
import sys
from pathlib import Path

from PIL import Image

FRAME = 256
MEDIAN_TOLERANCE = 12

DEFAULT_REPO = Path(__file__).resolve().parents[2]


def bbox_of(image):
    alpha = image.getchannel('A')
    box = alpha.getbbox()
    if box is None:
        return None
    return box


def green_pixels(image):
    count = 0
    for r, g, b, a in image.getdata():
        if a > 40 and g - max(r, b) > 24:
            count += 1
    return count


def audit_sheet(path):
    sheet = Image.open(path).convert('RGBA')
    width, height = sheet.size
    if height != FRAME or width % FRAME != 0:
        return {'error': 'size %dx%d' % (width, height)}
    frames = width // FRAME
    rows = []
    for index in range(frames):
        frame = sheet.crop((index * FRAME, 0, (index + 1) * FRAME, FRAME))
        box = bbox_of(frame)
        if box is None:
            rows.append({'frame': index, 'empty': True})
            continue
        rows.append({
            'frame': index,
            'x0': box[0], 'y0': box[1], 'x1': box[2], 'y1': box[3],
            'height': box[3] - box[1],
            'bottom': box[3],
            'green': green_pixels(frame),
        })
    return {'frames': frames, 'rows': rows}


def main(argv):
    if '-h' in argv or '--help' in argv:
        print(__doc__.strip())
        return 0
    if '--repo' in argv:
        repo = argv[argv.index('--repo') + 1]
    else:
        positional = [a for a in argv if not a.startswith('--')]
        repo = positional[0] if positional else str(DEFAULT_REPO)
    sprites = os.path.join(repo, 'src', 'sprites')
    poses = os.path.join(sprites, 'poses')
    if not os.path.isdir(sprites):
        raise SystemExit('no src/sprites under %s (pass repo as the first argument)' % repo)

    def report(title, folder):
        print('\n== %s ==' % title)
        issues = []
        if not os.path.isdir(folder):
            print('(missing: %s)' % folder)
            return issues
        for name in sorted(os.listdir(folder)):
            if not name.endswith('.png'):
                continue
            path = os.path.join(folder, name)
            result = audit_sheet(path)
            if 'error' in result:
                issues.append('%s: %s' % (name, result['error']))
                continue
            rows = result['rows']
            heights = [r['height'] for r in rows if not r.get('empty')]
            bottoms = [r['bottom'] for r in rows if not r.get('empty')]
            median = sorted(heights)[len(heights) // 2] if heights else 0
            flags = []
            for row in rows:
                if row.get('empty'):
                    flags.append('f%d EMPTY' % row['frame'])
                    continue
                if abs(row['height'] - median) > MEDIAN_TOLERANCE:
                    flags.append('f%d h=%d off median %d' % (row['frame'], row['height'], median))
                if row['bottom'] != FRAME:
                    flags.append('f%d bottom=%d (not %d)' % (row['frame'], row['bottom'], FRAME))
                if row['green'] > 0:
                    flags.append('f%d green=%d' % (row['frame'], row['green']))
            status = 'OK  ' if not flags else 'WARN'
            print('%s %-16s %d frames  h=%s  bot=%s  %s' % (
                status, name, result['frames'],
                '/'.join(str(h) for h in heights),
                '/'.join(str(b) for b in bottoms),
                '; '.join(flags) if flags else '',
            ))
            if flags:
                issues.append('%s: %s' % (name, '; '.join(flags)))
        return issues

    action_issues = report('action sheets (src/sprites/*.png)', sprites)
    pose_issues = report('pose sheets (src/sprites/poses/*.png)', poses)

    # cross-check code references
    pose_map = os.path.join(repo, 'src', 'pose-map.js')
    missing = []
    if os.path.exists(pose_map):
        with open(pose_map, 'r', encoding='utf-8') as fh:
            text = fh.read()
        names = set(re.findall(r"pose:\s*'([A-Za-z]+)'", text))
        names |= set(re.findall(r'pose:\s*"([A-Za-z]+)"', text))
        for name in sorted(names):
            if name == 'null':
                continue
            if not os.path.exists(os.path.join(poses, name + '.png')):
                missing.append(name)
        print('\n== pose names referenced by src/pose-map.js ==')
        print('referenced: %d, missing files: %s' % (len(names), ', '.join(missing) or 'none'))

    pet = os.path.join(repo, 'src', 'pet.js')
    if os.path.exists(pet):
        with open(pet, 'r', encoding='utf-8') as fh:
            text = fh.read()
        sheets = re.findall(r"sheet:\s*'([A-Za-z]+)'", text)
        absent = [s for s in sheets if not os.path.exists(os.path.join(sprites, s + '.png'))]
        print('\n== ANIM sheets referenced by src/pet.js ==')
        print('referenced: %d, missing files: %s' % (len(sheets), ', '.join(absent) or 'none'))

    print('\nSUMMARY: %d sheet issue(s), %d missing pose file(s)' % (
        len(action_issues) + len(pose_issues), len(missing)))
    print(json.dumps({'action': action_issues, 'pose': pose_issues, 'missing': missing},
                     ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
