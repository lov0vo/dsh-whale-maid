/*
 * dsh-whale-maid — client bundle builder.
 *
 * The DSH browser artifact must be a single classic script that calls
 * `window.__ModuleLoader__.load({ id, factory })`. There is no bundler in the
 * Harness, and the renderer runs sandboxed (`nodeIntegration: false`), so the
 * client cannot read files from the plugin directory at runtime.
 *
 * What ships inside the bundle:
 *   - `src/pet.css`            -> a JS string, injected into <head> by the plugin
 *   - `src/runtime.js`         -> shared state, events, small helpers (1.1.0)
 *   - `src/lines.js`           -> companion text banks + keyword topics (1.1.0)
 *   - `src/lines-more.js`      -> 403 extra lines per language, appended (1.3.0)
 *   - `src/growth.js`          -> growth / quests / achievements / sign-in (1.1.0)
 *   - `src/fx.js`              -> status chip + particle layer (1.1.0)
 *   - `src/pet.js`             -> the ported pet component
 *   - `src/settings.js`        -> the original settings section
 *   - `src/panel.js`           -> the companion settings section (1.1.0)
 *   - `src/signals.js`         -> work-status DOM detector (1.1.0)
 *   - `src/care.js`            -> proactive care + small talk (1.1.0)
 *   - `src/zones.js`           -> hit zones + triple tap (1.1.0)
 *   - `src/plugin.js`          -> slot registration + public API
 *
 * What does NOT ship inside the bundle (A7): the PNG art. Base64-inlining 13
 * sprite sheets + 19 pose portraits pushed `client.js` to 4.78 MB. Instead every
 * `src/sprites/*.png` and `src/sprites/poses/*.png` is *copied* to `assets/` at
 * the package root, and the bundle only holds URL strings built from
 * `ASSET_BASE`. The Host half (`index.js`) serves that directory over
 * `/api/dsh-whale-maid/assets/`. The variable names `SPRITES` / `POSES` and the
 * shape of their values (a string usable as a CSS `url()` / `<img>` source) are
 * unchanged, so `src/pet.js` and `src/pose-map.js` need no edits.
 *
 * Every file is plain script (no import/export); they share one closure, so a
 * `function` declaration in any of them is visible to all the others.
 *
 * Usage: node build.mjs
 */

import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const MODULE_ID = pkg.name;

/** Concatenation order. runtime first (shared state), plugin last (apply). */
const SOURCES = [
	'src/runtime.js',
	'src/portable.js',
	'src/lines.js',
	'src/lines-more.js',
	'src/lines-weather.js',
	'src/pose-map.js',
	'src/lines-mood.js',
	'src/growth.js',
	'src/fx.js',
	'src/pet.js',
	'src/locale-table.js',
	'src/settings.js',
	'src/panel.js',
	'src/preview.js',
	'src/signals.js',
	'src/care.js',
	'src/zones.js',
	'src/weather.js',
	'src/plugin.js',
];

/** Sheet name -> expected frame count. Must mirror the ANIM table in src/pet.js. */
const SHEETS = {
	wink: 1,
	idle: 3,
	joy: 2,
	eat: 3,
	play: 3,
	welcome: 2,
	drag: 3,
	think: 3,
	work: 3,
	sad: 3,
	sleep: 2,
	wake: 2,
	walk: 3,
};

const FRAME_SIZE = 256;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Where the Host half serves the art from. Mirrors `ROUTE` in index.js. */
const ASSET_BASE = '/api/dsh-whale-maid/assets/';
const ASSET_DIR = join(root, 'assets');
const ASSET_POSE_DIR = join(ASSET_DIR, 'poses');
const POSE_SRC_DIR = join(root, 'src', 'sprites', 'poses');

function fail(message) {
	console.error('build failed: ' + message);
	process.exit(1);
}

function readText(relative) {
	const path = join(root, relative);
	if (!existsSync(path)) fail('missing ' + relative);
	return readFileSync(path, 'utf8');
}

/** Read a PNG's pixel dimensions straight out of its IHDR chunk. */
function pngSize(buffer, name) {
	if (buffer.length < 24) fail(name + ': truncated PNG');
	if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) fail(name + ': not a PNG');
	const width = buffer.readUInt32BE(16);
	const height = buffer.readUInt32BE(20);
	return { width, height };
}

/**
 * Copy one source PNG into `assets/` (the HTTP-served tree) and return its
 * public URL. Verifies the copy landed with the same byte length, so a broken
 * or half-written asset fails the build instead of 404ing at runtime.
 */
function publishAsset(sourcePath, targetPath, publicPath, label) {
	copyFileSync(sourcePath, targetPath);
	const copied = statSync(targetPath).size;
	if (copied !== statSync(sourcePath).size) {
		fail(label + ': copy into assets/ is ' + copied + ' B, expected ' + statSync(sourcePath).size + ' B');
	}
	return ASSET_BASE + publicPath;
}

mkdirSync(ASSET_DIR, { recursive: true });
mkdirSync(ASSET_POSE_DIR, { recursive: true });

const sprites = {};
const report = [];
let totalBytes = 0;

for (const [name, frames] of Object.entries(SHEETS)) {
	const relative = 'src/sprites/' + name + '.png';
	const path = join(root, relative);
	if (!existsSync(path)) fail('missing ' + relative);
	const buffer = readFileSync(path);
	const { width, height } = pngSize(buffer, name);
	if (height !== FRAME_SIZE) fail(name + '.png: expected ' + FRAME_SIZE + 'px tall, got ' + height);
	if (width !== frames * FRAME_SIZE) {
		fail(name + '.png: expected ' + frames + ' frames (' + frames * FRAME_SIZE + 'px wide), got ' + width + 'px');
	}
	sprites[name] = publishAsset(path, join(ASSET_DIR, name + '.png'), name + '.png', name + '.png');
	totalBytes += buffer.length;
	report.push('  ' + name.padEnd(8) + frames + ' frame(s)  ' + width + 'x' + height + '  ' + buffer.length + ' B');
}

const stylesheet = readText('src/pet.css');

// A3: pose portraits ship too, so the pose map can use them. A7: served over
// HTTP like the sheets, not inlined.
const poses = {};
let poseBytes = 0;
if (existsSync(POSE_SRC_DIR)) {
	const names = readdirSync(POSE_SRC_DIR)
		.filter((name) => name.endsWith('.png'))
		.sort();
	for (const name of names) {
		const source = join(POSE_SRC_DIR, name);
		poses[name.slice(0, -4)] = publishAsset(source, join(ASSET_POSE_DIR, name), 'poses/' + name, 'poses/' + name);
		poseBytes += statSync(source).size;
	}
}

const sources = [];
for (const relative of SOURCES) {
	const source = readText(relative);
	if (/^\s*(import|export)\s/m.test(source)) {
		fail(relative + ': must not use import/export; the bundle is a classic script');
	}
	sources.push({ relative, source: source.trim() });
}

const out = [
	'/*',
	' * ' + MODULE_ID + ' —generated by build.mjs. Do not edit by hand;',
	' * edit src/*.js or src/pet.css and run `node build.mjs`.',
	' *',
	' * The stylesheet is inlined so the sandboxed renderer needs no filesystem',
	' * access. Sprite sheets and pose portraits are NOT inlined: they are served by',
	' * the Host half (index.js) from assets/ over ASSET_BASE, which keeps this',
	' * bundle small. SPRITES / POSES still hold one string per entry — a URL,',
	' * usable wherever a CSS url() or an <img> source is expected.',
	' */',
	'window.__ModuleLoader__.load({',
	'  id: ' + JSON.stringify(MODULE_ID) + ',',
	'  factory(require) {',
	"    'use strict';",
	'',
	"    var React = require('react');",
	'    var h = React.createElement;',
	'',
	'    /* ---- src/pet.css ---- */',
	'    var STYLESHEET = ' + JSON.stringify(stylesheet) + ';',
	'',
	'    /* ---- assets: served by index.js, see ASSET_BASE below ---- */',
	'    var ASSET_BASE = ' + JSON.stringify(ASSET_BASE) + ';',
	'',
	'    /* ---- src/sprites/*.png ---- */',
	'    var SPRITES = {',
	...Object.entries(sprites).map(([name, url]) => '      ' + name + ': ASSET_BASE + ' + JSON.stringify(url.slice(ASSET_BASE.length)) + ','),
	'    };',
	'',
	'    /* ---- src/sprites/poses/*.png ---- */',
	'    var POSES = {',
	...Object.entries(poses).map(([name, url]) => '      ' + name + ': ASSET_BASE + ' + JSON.stringify(url.slice(ASSET_BASE.length)) + ','),
	'    };',
	'',
	...sources.flatMap((entry) => ['    /* ---- ' + entry.relative + ' ---- */', entry.source, '']),
	"    return { inject: ['slots'], apply: apply };",
	'  },',
	'});',
	'',
].join('\n');

try {
	new Function(out);
} catch (error) {
	fail('generated bundle does not parse: ' + error.message);
}

const target = join(root, 'client.js');
writeFileSync(target, out, 'utf8');

const kb = (bytes) => (bytes / 1024).toFixed(1) + ' KiB';
console.log('sheets:');
console.log(report.join('\n'));
console.log('');
console.log('  sprite bytes   ' + totalBytes + ' B (' + kb(totalBytes) + ')');
console.log('  client.js      ' + Buffer.byteLength(out) + ' B (' + kb(Buffer.byteLength(out)) + ')');
console.log('  written to     ' + target);
console.log('  assets         ' + Object.keys(sprites).length + ' sheet(s) + ' + Object.keys(poses).length + ' pose(s), ' + kb(totalBytes + poseBytes) + ' -> ' + ASSET_DIR);
