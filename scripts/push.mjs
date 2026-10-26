#!/usr/bin/env node
/*
 * Push helper that survives GitHub's flaky TLS.
 *
 * `git push` to github.com from this machine intermittently dies with
 *   fatal: unable to access '…': TLS connect error: error:0A000126:SSL
 *   routines::unexpected eof while reading
 * which is a middlebox resetting the HTTP/2 connection, not a repo problem. The
 * ref may or may not have landed, so a bare `git push` is not trustworthy.
 *
 * This script:
 *   1. builds and tests (skippable with --no-build),
 *   2. copies the build into both install directories,
 *   3. commits anything staged/dirty (with --message) or commits nothing,
 *   4. pushes `main` and every tag, retrying with backoff,
 *   5. **verifies** that the remote really has the local commit and the tag,
 *      and exits non-zero with a clear message when it does not.
 *
 * Usage:
 *   node scripts/push.mjs                      # push what is already committed
 *   node scripts/push.mjs -m "fix: something"  # commit everything, then push
 *   node scripts/push.mjs --no-build -m "docs: …"
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const REPO = process.cwd();
const REMOTE = 'origin';
const BRANCH = 'main';
const INSTALLS = [
	'C:/Users/Administrator/.dsh/plugins/dsh-whale-maid',
	'C:/Users/Administrator/.dsh/profiles/desktop/node_modules/dsh-whale-maid',
];
const GIT = [
	'-c', 'user.name=lov0vo',
	'-c', 'user.email=lov0vo@users.noreply.github.com',
	'-c', 'http.version=HTTP/1.1',
	'-c', 'http.postBuffer=524288000',
];
const ATTEMPTS = 5;

const argv = process.argv.slice(2);
const noBuild = argv.includes('--no-build');
const messageIndex = argv.findIndex((a) => a === '-m' || a === '--message');
const message = messageIndex >= 0 ? argv[messageIndex + 1] : '';

function run(command, args, options = {}) {
	return spawnSync(command, args, { cwd: REPO, encoding: 'utf8', ...options });
}

function say(text) {
	process.stdout.write(text + '\n');
}

function fail(text, detail) {
	process.stderr.write('\nFAIL ' + text + '\n');
	if (detail) process.stderr.write(String(detail).trim() + '\n');
	process.exit(1);
}

/* ── 1. build + test ─────────────────────────────────────────────────────── */
if (!noBuild) {
	const build = run('node', ['build.mjs']);
	if (build.status !== 0) fail('build failed', build.stderr || build.stdout);
	say('ok   build');

	const test = run('node', ['--test', '--test-force-exit', 'test/companion.test.mjs']);
	const summary = (test.stdout || '').split('\n').filter((line) => /^ℹ (pass|fail)/.test(line)).join(' ');
	if (test.status !== 0) fail('tests failed', summary + '\n' + (test.stdout || '').slice(-2000));
	say('ok   tests — ' + summary);

	/* ── 2. sync both install directories ─────────────────────────────────── */
	for (const target of INSTALLS) {
		if (!existsSync(target)) {
			say('skip install (missing): ' + target);
			continue;
		}
		for (const file of ['client.js', 'index.js', 'package.json', 'cordis.patch.yml', 'icon.svg']) {
			if (existsSync(join(REPO, file))) copyFileSync(join(REPO, file), join(target, file));
		}
		for (const dir of ['src', 'locale', 'assets']) {
			const from = join(REPO, dir);
			if (!existsSync(from)) continue;
			mkdirSync(join(target, dir), { recursive: true });
			const copy = run('powershell', ['-NoProfile', '-Command', `Copy-Item -Recurse -Force '${from}\\*' '${join(target, dir)}'`]);
			if (copy.status !== 0) say('warn sync ' + dir + ' → ' + target);
		}
		say('ok   synced ' + target);
	}
}

/* ── 3. commit ──────────────────────────────────────────────────────────── */
const dirty = run('git', ['status', '--porcelain']).stdout.trim();
if (message) {
	if (dirty) {
		const add = run('git', ['add', '-A']);
		if (add.status !== 0) fail('git add failed', add.stderr);
		const commit = run('git', [...GIT, 'commit', '-q', '-m', message]);
		if (commit.status !== 0) fail('git commit failed', commit.stderr || commit.stdout);
		say('ok   committed: ' + message);
	} else {
		say('skip commit (nothing to commit)');
	}
} else if (dirty) {
	fail('working tree is dirty — pass -m "message" or commit first', dirty);
}

/* ── 4. push with retries ───────────────────────────────────────────────── */
const localHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();

function attempt(label, args) {
	for (let i = 1; i <= ATTEMPTS; i += 1) {
		const result = run('git', [...GIT, ...args]);
		const text = (result.stdout || '') + (result.stderr || '');
		if (result.status === 0) {
			say(`ok   ${label} (attempt ${i})`);
			return true;
		}
		const reason = text.split('\n').find((line) => /rejected|error|fatal|unable/.test(line)) || text.trim().split('\n')[0];
		say(`retry ${label} ${i}/${ATTEMPTS}: ${reason}`);
		/* the ref may have landed despite the error — check before retrying */
		const remote = run('git', [...GIT, 'ls-remote', REMOTE, 'refs/heads/' + BRANCH]);
		if (remote.status === 0 && (remote.stdout || '').trim().startsWith(localHead)) {
			say(`ok   ${label} (already on remote)`);
			return true;
		}
		const wait = 2000 * i;
		execFileSync('powershell', ['-NoProfile', '-Command', `Start-Sleep -Milliseconds ${wait}`]);
	}
	return false;
}

if (!attempt('push ' + BRANCH, ['push', REMOTE, BRANCH])) {
	fail('push ' + BRANCH + ' failed after ' + ATTEMPTS + ' attempts', 'network/TLS to github.com is unreachable; commit is safe locally');
}
attempt('push --tags', ['push', REMOTE, '--tags']);

/* ── 5. verify ──────────────────────────────────────────────────────────── */
const remoteMain = run('git', [...GIT, 'ls-remote', REMOTE, 'refs/heads/' + BRANCH]);
if (remoteMain.status !== 0) fail('cannot verify remote (ls-remote failed)', remoteMain.stderr);
const remoteHead = (remoteMain.stdout || '').split('\t')[0].trim();
if (remoteHead !== localHead) fail('remote main is not the local commit', 'local ' + localHead + '\nremote ' + remoteHead);
say('ok   verified remote main = ' + localHead.slice(0, 7));

const localTag = run('git', ['describe', '--tags', '--exact-match', 'HEAD']);
if (localTag.status === 0) {
	const tag = (localTag.stdout || '').trim();
	const remoteTag = run('git', [...GIT, 'ls-remote', REMOTE, 'refs/tags/' + tag]);
	const onRemote = remoteTag.status === 0 && (remoteTag.stdout || '').includes('refs/tags/' + tag);
	if (!onRemote) {
		say('warn tag ' + tag + ' is local only — run: git push origin ' + tag);
	} else {
		say('ok   verified remote tag ' + tag);
	}
}

say('\nPUSH OK — ' + localHead.slice(0, 7));
