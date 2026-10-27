"""Generate sprite frames from a JSON job file: submit, poll, key, compose.

This is the only script here that talks to the network. Everything else in
tools/art/ is local image work, so you can re-run the rest of the pipeline
against frames you drew yourself.

The identity lock in MASTER is the wording that produced on-model results: one
pristine reference (idle.png frame 0, composited onto flat green) plus the
costume spelled out in words. Per-frame pose text is data, not code, so a new
sheet is a JSON edit rather than a new script.

Job file:

    {
      "reference": "src/sprites/idle.png",   optional, repo-relative or absolute
      "reference_frame": 0,                  optional, which cell of that sheet
      "jobs": [
        {"sheet": "poses/waiting", "frame": 1, "pose": "she leans forward..."},
        {"sheet": "poses/waiting", "frame": 2, "pose": "...", "band": [0, 1024]}
      ]
    }

`sheet` is a repo-relative path under src/sprites, without `.png`. `frame` is
0-based. Frames you do not list are kept from the sheet already on disk, so a
two-frame repair of a three-frame sheet is just two jobs. `band` is optional and
is passed to key_pose.normalise() when a floating effect above her head would
otherwise be measured as part of her height.

Usage:
    python gen.py jobs.json --dry-run          # print the plan, touch nothing
    python gen.py jobs.json                    # submit, poll, key, compose
    python gen.py jobs.json --only poses/waiting
    python gen.py jobs.json --repo PATH --work-dir PATH

Options:
    --dry-run              print the plan (reference, targets, prompts) and exit
    --repo PATH            checkout to write into (default: two levels up)
    --work-dir PATH        scratch space (default: <repo>/tools/art/.work)
    --reference PNG        identity reference (default: src/sprites/idle.png)
    --reference-frame N    which cell of that sheet (default: 0)
    --only SHEET           run a single sheet from the job file
    --credentials PATH     credential file (default: $DSH_CREDENTIALS, else
                           ~/.dsh/.credentials.yaml)
    --base-url URL         OpenAI-compatible endpoint (default: $DSH_IMAGE_GEN_BASE_URL)
    --model NAME           image model (default: $DSH_IMAGE_GEN_MODEL)
    --poll SECONDS         job poll interval (default: 6)
    --timeout SECONDS      give up on a queued job after this long (default: 1800)

The API key is read from the credential file's DSH_IMAGE_GEN_OPENAI_COMPAT_KEY
line, or straight from that environment variable if it is set.
"""
import base64
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import compose_frames  # noqa: E402
import key_pose  # noqa: E402

DEFAULT_REPO = HERE.parents[1]
DEFAULT_BASE = 'https://nezhagate.com/v1'
DEFAULT_MODEL = 'gpt-image-2.5-flare'
KEY_NAME = 'DSH_IMAGE_GEN_OPENAI_COMPAT_KEY'

USAGE = 'usage: python gen.py <jobs.json> [--dry-run] [--repo PATH] [--help]'

# The identity lock. One reference frame, the costume spelled out in words, and
# an explicit "do not redesign" - this is the combination that produced the 19
# pose portraits and the 2.1.1 sheet rebuilds on-model.
MASTER = (
    'Keep the exact same character as the reference image. Do not redesign her, '
    'do not change the outfit, the palette, the line width or the proportions. '
    'She is a chibi whale maid, 2.5 heads tall, soft cel shading with thin clean outlines, cool blue palette. '
    '\n\nIDENTITY LOCK, must match the reference exactly:\n'
    '- hair: cobalt blue chin-length bob with a soft inward curl and long side locks to the waist.\n'
    '- headdress: a WHITE LACE-EDGED MAID CAP with a scalloped border, plus ONE small navy-blue ribbon bow '
    'on the LEFT side of her head (viewer left).\n'
    '- ahoge: exactly ONE thin curl of hair rising from the crown, about 12 percent of the head height, '
    'curling to the right. It is a thin wisp. Do NOT draw a horn, a cone, a triangle, a spike or a large '
    'triangular shape. Nothing else may rise above the cap.\n'
    '- ears: two small blue WHALE-FIN ears sticking out sideways from under the cap, one on each side, same size.\n'
    '- outfit: navy blue maid dress, white apron with a small whale emblem at its centre, white lace trim on '
    'the hem and collar.\n'
    '- legs: PALE blue-white over-knee stockings, roughly RGB 151,153,169 in shadow. They must be pale, the same '
    'tone as the reference. Do NOT paint the stockings navy or dark blue.\n'
    '- shoes: navy blue, one small bow on each.\n'
    '- tail: one blue whale tail behind her, the same size as in the reference.\n'
    '- eyes: large, deep blue, glossy.\n'
    '\nRENDERING:\n'
    '- full body, feet close to the bottom edge, horizontally centred, generous empty margin all around.\n'
    '- character height about 900 px on a 1024x1024 canvas, feet baseline about 60 px above the bottom edge.\n'
    '- flat pure green chroma-key background, exactly #00FF00, no gradient, no ground shadow, no props, '
    'no text, no watermark, no border.\n'
    '\nPOSE:\n'
)


# --- configuration ---------------------------------------------------------

def opt(argv, name, default=None):
    if name in argv:
        index = argv.index(name)
        if index + 1 >= len(argv):
            raise SystemExit('%s needs a value' % name)
        return argv[index + 1]
    return default


def credentials_path(argv):
    explicit = opt(argv, '--credentials')
    if explicit:
        return Path(explicit)
    env = os.environ.get('DSH_CREDENTIALS')
    if env:
        return Path(env)
    return Path.home() / '.dsh' / '.credentials.yaml'


def load_key(path):
    env = os.environ.get(KEY_NAME)
    if env:
        return env
    if not path.exists():
        raise SystemExit('no credentials at %s (pass --credentials or set DSH_CREDENTIALS)' % path)
    with open(path, 'r', encoding='utf-8') as fh:
        for line in fh:
            if KEY_NAME in line:
                return line.split(':', 1)[1].strip().strip('"\'')
    raise SystemExit('%s has no %s line' % (path, KEY_NAME))


def sheet_target(repo, sheet):
    """`poses/waiting` -> <repo>/src/sprites/poses/waiting.png, refusing escapes."""
    relative = Path(sheet)
    if relative.is_absolute() or '..' in relative.parts:
        raise SystemExit('sheet must be relative to src/sprites: %s' % sheet)
    return repo / 'src' / 'sprites' / relative.with_suffix('.png')


def green_reference(repo, work, reference=None, index=0):
    source = Path(reference) if reference else repo / 'src' / 'sprites' / 'idle.png'
    if not source.is_absolute():
        source = repo / source
    if not source.exists():
        raise SystemExit('reference not found: %s' % source)
    frame = Image.open(source).convert('RGBA')
    if frame.size[0] > key_pose.TARGET and frame.size[0] % key_pose.TARGET == 0:
        frame = frame.crop((index * key_pose.TARGET, 0, (index + 1) * key_pose.TARGET, key_pose.TARGET))
    canvas = Image.new('RGBA', frame.size, (0, 255, 0, 255))
    canvas.alpha_composite(frame)
    out = work / 'reference-green.png'
    canvas.convert('RGB').save(out)
    return out, source, frame.size


# --- HTTP ------------------------------------------------------------------

class Client:
    def __init__(self, base, key, model):
        self.base = base.rstrip('/')
        self.key = key
        self.model = model

    def call(self, path, method='GET', body=None, timeout=240):
        data = None if body is None else json.dumps(body, ensure_ascii=True).encode('utf-8')
        request = urllib.request.Request(self.base + path, data=data, method=method)
        request.add_header('Authorization', 'Bearer ' + self.key)
        if data is not None:
            request.add_header('Content-Type', 'application/json')
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as err:
            return err.code, err.read()

    def submit(self, source, prompt):
        with open(source, 'rb') as fh:
            encoded = base64.b64encode(fh.read()).decode()
        status, raw = self.call('/images/edits', 'POST', {
            'model': self.model,
            'images': [{'image_url': 'data:image/png;base64,' + encoded}],
            'prompt': prompt,
            'n': 1,
            'size': 'auto',
            'response_format': 'url',
        })
        if status not in (200, 201, 202):
            raise RuntimeError('submit failed %s: %s' % (status, raw[:300]))
        payload = json.loads(raw)
        if payload.get('data'):
            return ('done', payload['data'][0]['url'])
        if not payload.get('id'):
            raise RuntimeError('no job id: %s' % raw[:300])
        return ('job', payload['id'])

    def job(self, job_id):
        status, raw = self.call('/images/jobs/' + job_id)
        try:
            return json.loads(raw)
        except Exception:
            return {}

    def save(self, url, out_dir, tag):
        blob = urllib.request.urlopen(url, timeout=300).read()
        digest = hashlib.sha256(blob).hexdigest()[:8]
        out = out_dir / ('image-%s.png' % digest)
        with open(out, 'wb') as fh:
            fh.write(blob)
        print('SAVED %s -> %s' % (tag, out), flush=True)
        return out


def wait_for(client, pending, poll, timeout):
    deadline = time.time() + timeout
    while any(kind == 'job' for kind, _ in pending.values()) and time.time() < deadline:
        time.sleep(poll)
        for tag, (kind, value) in list(pending.items()):
            if kind != 'job':
                continue
            state = client.job(value)
            name = state.get('status')
            if name == 'succeeded':
                pending[tag] = ('url', state['data'][0]['url'])
            elif name in ('failed', 'error'):
                print('FAILED %s %s' % (tag, json.dumps(state)[:200]), flush=True)
                pending[tag] = ('failed', None)


# --- pipeline --------------------------------------------------------------

def load_jobs(path):
    with open(path, 'r', encoding='utf-8') as fh:
        payload = json.load(fh)
    jobs = payload.get('jobs') if isinstance(payload, dict) else payload
    if not jobs:
        raise SystemExit('%s has no jobs' % path)
    for job in jobs:
        for field in ('sheet', 'frame', 'pose'):
            if field not in job:
                raise SystemExit('job missing %r: %s' % (field, json.dumps(job)[:120]))
    return payload if isinstance(payload, dict) else {}, jobs


def plan(repo, jobs):
    """Group jobs per sheet and work out which frames each sheet will end up with."""
    grouped = {}
    for job in jobs:
        grouped.setdefault(job['sheet'], []).append(job)
    out = []
    for sheet, items in grouped.items():
        target = sheet_target(repo, sheet)
        existing = 0
        if target.exists():
            existing = Image.open(target).width // key_pose.TARGET
        indices = sorted(item['frame'] for item in items)
        total = max([existing] + [i + 1 for i in indices])
        missing = [i for i in range(total) if i not in indices and i >= existing]
        if missing:
            raise SystemExit('%s: frame(s) %s would be left empty - add them to the job file'
                             % (sheet, ', '.join(map(str, missing))))
        out.append({'sheet': sheet, 'target': target, 'existing': existing,
                    'indices': indices, 'total': total, 'jobs': items})
    return out


def run(argv):
    if '-h' in argv or '--help' in argv:
        print(__doc__.strip())
        return 0

    # first bare argument that is not the value of a flag is the job file
    valued = {'--repo', '--work-dir', '--reference', '--reference-frame', '--only',
              '--credentials', '--base-url', '--model', '--poll', '--timeout'}
    positional = []
    skip = False
    for arg in argv:
        if skip:
            skip = False
            continue
        if arg in valued:
            skip = True
            continue
        if not arg.startswith('--'):
            positional.append(arg)
    if not positional:
        raise SystemExit(USAGE)

    jobs_path = Path(positional[0])
    dry = '--dry-run' in argv
    repo = Path(opt(argv, '--repo', str(DEFAULT_REPO))).resolve()
    work = Path(opt(argv, '--work-dir', str(repo / 'tools' / 'art' / '.work'))).resolve()
    only = opt(argv, '--only')
    base = opt(argv, '--base-url', os.environ.get('DSH_IMAGE_GEN_BASE_URL', DEFAULT_BASE))
    model = opt(argv, '--model', os.environ.get('DSH_IMAGE_GEN_MODEL', DEFAULT_MODEL))
    poll = float(opt(argv, '--poll', 6))
    timeout = float(opt(argv, '--timeout', 1800))
    reference = opt(argv, '--reference')
    reference_frame = int(opt(argv, '--reference-frame', 0))

    if not (repo / 'src' / 'sprites').is_dir():
        raise SystemExit('no src/sprites under %s (pass --repo)' % repo)

    payload, jobs = load_jobs(jobs_path)
    if payload.get('reference'):
        reference = payload['reference']
    if 'reference_frame' in payload:
        reference_frame = int(payload['reference_frame'])
    if only:
        jobs = [job for job in jobs if job['sheet'] == only]
        if not jobs:
            raise SystemExit('no jobs for sheet %r' % only)

    sheets = plan(repo, jobs)
    reference_path = Path(reference) if reference else repo / 'src' / 'sprites' / 'idle.png'
    if not reference_path.is_absolute():
        reference_path = repo / reference_path

    print('repo        %s' % repo)
    print('jobs        %s (%d generation(s))' % (jobs_path, len(jobs)))
    print('reference   %s frame %d' % (reference_path, reference_frame))
    print('endpoint    %s model=%s' % (base, model))
    for entry in sheets:
        print('  %-18s %s -> %d frame(s), regenerating %s' % (
            entry['sheet'], entry['target'].relative_to(repo),
            entry['total'], ', '.join('f%d' % i for i in entry['indices'])))
    if dry:
        for entry in sheets:
            for job in entry['jobs']:
                print('\n[%s f%d] %s' % (job['sheet'], job['frame'], (MASTER + job['pose'])[-160:]))
        print('\ndry run: nothing submitted, nothing written')
        return 0

    key = load_key(credentials_path(argv))
    work.mkdir(parents=True, exist_ok=True)
    (work / 'raw').mkdir(exist_ok=True)
    (work / 'frames').mkdir(exist_ok=True)

    source, source_used, size = green_reference(repo, work, reference, reference_frame)
    print('reference ready: %s (%dx%d) from %s' % (source, size[0], size[1], source_used), flush=True)

    client = Client(base, key, model)
    pending = {}
    for entry in sheets:
        for job in entry['jobs']:
            tag = '%s-f%d' % (entry['sheet'].replace('/', '-'), job['frame'])
            kind, value = client.submit(source, MASTER + job['pose'])
            pending[tag] = ('url' if kind == 'done' else 'job', value)
            print(('DONE  ' if kind == 'done' else 'QUEUED') + ' %s %s' % (tag, value), flush=True)

    wait_for(client, pending, poll, timeout)

    raw_of = {}
    for tag, (kind, value) in pending.items():
        if kind == 'url':
            raw_of[tag] = client.save(value, work / 'raw', tag)
        elif kind == 'file':
            raw_of[tag] = Path(value)
    missing = [tag for tag, (kind, _) in pending.items() if kind not in ('url', 'file')]
    if missing:
        raise SystemExit('no image for: ' + ', '.join(missing))

    for entry in sheets:
        keyed = {}
        for job in entry['jobs']:
            tag = '%s-f%d' % (entry['sheet'].replace('/', '-'), job['frame'])
            keyed_path = work / 'frames' / ('%s-keyed.png' % tag)
            out = work / 'frames' / ('%s.png' % tag)
            key_pose.key_out(raw_of[tag], keyed_path)
            canvas = key_pose.normalise(keyed_path, out, tuple(job['band']) if job.get('band') else None)
            green = sum(1 for r, g, b, a in canvas.getdata() if a > 40 and g - max(r, b) > 24)
            print('KEYED %s bbox=%s green_left=%d' % (tag, canvas.getbbox(), green), flush=True)
            keyed[job['frame']] = Image.open(out).convert('RGBA')

        existing = []
        if entry['target'].exists():
            sheet = Image.open(entry['target']).convert('RGBA')
            existing = [sheet.crop((i * key_pose.TARGET, 0, (i + 1) * key_pose.TARGET, key_pose.TARGET))
                        for i in range(sheet.width // key_pose.TARGET)]
        frames = []
        for index in range(entry['total']):
            if index in keyed:
                frames.append(keyed[index])
            elif index < len(existing):
                frames.append(existing[index])
            else:
                raise SystemExit('%s f%d has no frame' % (entry['sheet'], index))

        temp = work / 'frames' / (entry['sheet'].replace('/', '-') + '-sheet.png')
        compose_frames.compose(frames, temp)
        entry['target'].parent.mkdir(parents=True, exist_ok=True)
        os.replace(temp, entry['target'])
        print('COMPOSED %s' % entry['target'], flush=True)

    print('DONE %d generation(s) across %d sheet(s)' % (len(jobs), len(sheets)), flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(run(sys.argv[1:]))
