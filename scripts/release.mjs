// One-command release: build -> test -> sync -> commit -> tag.
// usage: node scripts/release.mjs [patch|minor|major]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bump = process.argv[2] || 'patch';
const run = (cmd, args, cwd = root) =>
	execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });

const pkgPath = join(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const parts = pkg.version.split('.').map(Number);
const next =
	bump === 'major' ? (parts[0] + 1) + '.0.0'
	: bump === 'minor' ? parts[0] + '.' + (parts[1] + 1) + '.0'
	: parts[0] + '.' + parts[1] + '.' + (parts[2] + 1);

console.log('release ->', next);
pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

run(process.execPath, ['build.mjs']);
run(process.execPath, ['--test', '--test-force-exit', 'test/companion.test.mjs']);

const targets = [
	process.env.DSH_PLUGIN_DIR || join(process.env.USERPROFILE || '', '.dsh', 'plugins', 'dsh-whale-maid'),
	join(process.env.USERPROFILE || '', '.dsh', 'profiles', 'desktop', 'node_modules', 'dsh-whale-maid'),
];
for (const target of targets) {
	if (!target || !existsSync(target)) continue;
	for (const rel of ['client.js', 'README.md', 'package.json', 'build.mjs']) {
		copyFileSync(join(root, rel), join(target, rel));
	}
	console.log('synced ->', target);
}

run('git', ['add', '-A']);
run('git', ['commit', '-m', 'chore(release): v' + next]);
run('git', ['tag', '-a', 'v' + next, '-m', 'v' + next]);
console.log('done. push with: git push && git push --tags');
