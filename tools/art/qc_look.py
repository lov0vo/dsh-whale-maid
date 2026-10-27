"""Look-consistency QC, calibrated on the original artwork.

The first version of this check used bands derived from each frame's own bounding
box. That does not work: `walk` is a side view and `sleep` is a curled ball, so a
bbox-relative band lands on a different body part per pose and the eight original
sheets (which define "on-model" by construction) scored 60-110 dE against
themselves. The check below is built the other way round:

  1. every frame is already normalised to the same 256x256 cell (height 225, feet
     on y=256, centre on x=128), so absolute rects are valid across poses - the
     same premise the click hot zones rely on;
  2. the tolerance envelope is measured on the EIGHT ORIGINAL SHEETS, i.e. on
     frames that were never regenerated, so the thresholds describe "normal
     variation caused by pose", not "costume drift";
  3. a frame is only flagged when it leaves that envelope.

Stockings get an extra rule that needs no envelope: in the strip between the
skirt hem and the shoes the design has PALE stockings, so a frame whose leg strip
is dominated by navy is wearing the wrong colour no matter what the envelope says.

Usage:
    python qc_look.py [--repo PATH]            # report + exit 1 on any fail
    python qc_look.py --sheet drag [--repo PATH]

`--repo` defaults to the checkout this script lives in (two levels up from
tools/art/). Read-only: it prints a table and never writes.
"""
import os
import sys
from pathlib import Path

from PIL import Image

CELL = 256

# Rects in the normalised cell, mirroring the hot-zone geometry in src/zones.js.
LEGS = (0.40, 0.74, 0.60, 0.90)
EAR_L = (0.115, 0.400, 0.205, 0.520)
EAR_R = (0.625, 0.375, 0.745, 0.520)
HORN = (0.300, 0.000, 0.550, 0.200)

ORIGINAL = ('idle', 'joy', 'eat', 'play', 'welcome', 'sleep', 'wake', 'walk')
ENVELOPE_MARGIN = 1.15
NAVY_DOMINANT = 0.55
PALE_MIN = 0.15

DEFAULT_REPO = Path(__file__).resolve().parents[2]
REPO = DEFAULT_REPO
SPRITES = os.path.join(str(REPO), 'src', 'sprites')
POSES = os.path.join(SPRITES, 'poses')


def configure(repo):
    """Point every derived path at another checkout."""
    global REPO, SPRITES, POSES
    REPO = Path(repo).resolve()
    SPRITES = os.path.join(str(REPO), 'src', 'sprites')
    POSES = os.path.join(SPRITES, 'poses')


def frames_of(path):
    sheet = Image.open(path).convert('RGBA')
    return [sheet.crop((i * CELL, 0, (i + 1) * CELL, CELL)) for i in range(sheet.width // CELL)]


def box_of(rect):
    return (int(round(rect[0] * CELL)), int(round(rect[1] * CELL)),
            int(round(rect[2] * CELL)), int(round(rect[3] * CELL)))


def pixels(frame, rect):
    return [p for p in frame.crop(box_of(rect)).getdata() if p[3] > 120]


def mean_rgb(frame, rect):
    px = pixels(frame, rect)
    if not px:
        return None
    n = float(len(px))
    return (sum(p[0] for p in px) / n, sum(p[1] for p in px) / n, sum(p[2] for p in px) / n)


def coverage(frame, rect):
    box = box_of(rect)
    data = list(frame.crop(box).getchannel('A').getdata())
    return sum(1 for a in data if a > 60) / float(len(data))


def stocking_ratio(frame, reference_legs):
    """Share of leg-strip pixels that are navy vs pale-blue (the design colour)."""
    px = pixels(frame, LEGS)
    if not px:
        return 0.0, 0.0
    navy = 0
    pale = 0
    for pixel in px:
        r, g, b = pixel[0], pixel[1], pixel[2]
        if b > r + 18 and b < 150 and (r + g + b) < 380:
            navy += 1
        elif abs(r - reference_legs[0]) + abs(g - reference_legs[1]) + abs(b - reference_legs[2]) <= 60:
            pale += 1
    n = float(len(px))
    return navy / n, pale / n


def metrics(frame, reference_legs):
    legs = mean_rgb(frame, LEGS)
    de = 0.0 if legs is None else sum(abs(legs[i] - reference_legs[i]) for i in range(3))
    ear = max(coverage(frame, EAR_L), coverage(frame, EAR_R))
    horn = coverage(frame, HORN)
    navy, pale = stocking_ratio(frame, reference_legs)
    return {'dE': de, 'ear': ear, 'horn': horn, 'navy': navy, 'pale': pale, 'legs': legs}


def main(argv):
    if '-h' in argv or '--help' in argv:
        print(__doc__.strip())
        return 0
    if '--repo' in argv:
        configure(argv[argv.index('--repo') + 1])
    if not os.path.isdir(SPRITES):
        raise SystemExit('no src/sprites under %s (pass --repo)' % REPO)

    only = None
    if '--sheet' in argv:
        only = argv[argv.index('--sheet') + 1]

    ref_frame = frames_of(os.path.join(SPRITES, 'idle.png'))[0]
    reference_legs = mean_rgb(ref_frame, LEGS)
    print('design reference idle#0  legs=(%.0f,%.0f,%.0f)' % reference_legs)

    # --- calibrate on the sheets that were never regenerated -------------------
    base = {'dE': [], 'ear': [], 'horn': [], 'navy': []}
    for name in ORIGINAL:
        for frame in frames_of(os.path.join(SPRITES, name + '.png')):
            m = metrics(frame, reference_legs)
            base['dE'].append(m['dE'])
            base['ear'].append(m['ear'])
            base['horn'].append(m['horn'])
            base['navy'].append(m['navy'])
    envelope = {
        'dE': max(base['dE']) * ENVELOPE_MARGIN,
        'ear': min(base['ear']) / ENVELOPE_MARGIN,
        'horn': (min(base['horn']) / ENVELOPE_MARGIN, max(base['horn']) * ENVELOPE_MARGIN),
        'navy': max(base['navy']) * ENVELOPE_MARGIN,
    }
    print('envelope from %d original frames: dE<=%.0f  ear>=%.3f  horn %.3f..%.3f  navy<=%.2f' % (
        len(base['dE']), envelope['dE'], envelope['ear'], envelope['horn'][0], envelope['horn'][1], envelope['navy']))
    print('')

    fails = []
    print('%-14s %-4s %-16s %-5s %-6s %-6s %-6s %-6s %s' % (
        'sheet', 'frm', 'legs rgb', 'dE', 'ear', 'horn', 'navy', 'pale', 'verdict'))

    for folder in (SPRITES, POSES):
        for name in sorted(os.listdir(folder)):
            if not name.endswith('.png'):
                continue
            stem = name[:-4]
            if only and stem != only:
                continue
            for index, frame in enumerate(frames_of(os.path.join(folder, name))):
                if frame.getchannel('A').getbbox() is None:
                    fails.append('%s#%d empty' % (stem, index))
                    continue
                m = metrics(frame, reference_legs)
                notes = []
                if m['dE'] > envelope['dE']:
                    notes.append('legs')
                if m['ear'] < envelope['ear']:
                    notes.append('ears')
                if m['horn'] < envelope['horn'][0] or m['horn'] > envelope['horn'][1]:
                    notes.append('crown')
                if m['navy'] > NAVY_DOMINANT and m['pale'] < PALE_MIN:
                    notes.append('navy stockings')
                verdict = 'PASS' if not notes else 'FAIL ' + ','.join(notes)
                if notes:
                    fails.append('%s#%d %s (dE=%.0f ear=%.2f horn=%.2f navy=%.2f)' % (
                        stem, index, ','.join(notes), m['dE'], m['ear'], m['horn'], m['navy']))
                print('%-14s %-4d %-16s %-5.0f %-6.2f %-6.2f %-6.2f %-6.2f %s' % (
                    stem, index, '(%.0f,%.0f,%.0f)' % m['legs'] if m['legs'] else 'none',
                    m['dE'], m['ear'], m['horn'], m['navy'], m['pale'], verdict))

    print('')
    print('fail %d' % len(fails))
    if fails:
        print('failures:')
        for line in fails:
            print('  ' + line)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
