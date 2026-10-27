/*
 * dsh-whale-maid — asset QC.
 *
 * The sprite sheets are the plugin's product, but nothing in the repo checks
 * them: `node build.mjs` only verifies that each sheet's width matches its
 * declared frame count, and the unit tests never look at a pixel. A sheet can
 * therefore ship with a frame that is 6px shorter than its neighbours, a strip
 * of leftover chroma-key green, two frames that are the same drawing twice, or
 * a stale copy in `assets/` that no longer matches `src/sprites/`.
 *
 * This script is that missing gate. It decodes every PNG itself (node:zlib is
 * the only dependency; there is no image library in the toolchain and CI must
 * not install one) and checks six things:
 *
 *   frames   build.mjs SHEETS <-> src/sprites/*.png: every declared sheet is
 *            exactly frames*256 x 256, no missing file, no undeclared sheet
 *   poses    every src/sprites/poses/*.png is 768x256, and every pose name
 *            src/pose-map.js can ask for has art or a usable fallback
 *   ink      per frame: ink bbox bottom on the baseline, horizontal centre on
 *            the 256px midline, frame heights within 2px of each other
 *   chroma   leftover green-screen pixels (a > 40 && g - max(r,b) > 24)
 *   motion   silhouette IoU between adjacent frames: too high means the
 *            "animation" is one drawing repeated, too low means the frames are
 *            unrelated drawings
 *   parity   assets/ is a byte-identical copy of src/sprites/ (SHA-256), which
 *            catches "edited the art, forgot to run node build.mjs"
 *
 * Usage: node tools/asset-qc.mjs   (or `npm run qc`)
 * Exit code is 0 when every check passes, 1 otherwise.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPRITE_DIR = join(root, 'src', 'sprites');
const POSE_DIR = join(SPRITE_DIR, 'poses');
const ASSET_DIR = join(root, 'assets');
const ASSET_POSE_DIR = join(ASSET_DIR, 'poses');

const FRAME = 256;
const POSE_FRAMES = 3;

/* Ink geometry. `alpha > 8` ignores the faintest anti-aliasing fringe, which is
   the part that jitters by a pixel between frames for no visual reason. */
const INK_ALPHA = 8;
const CENTRE_TOLERANCE = 12;
const SPREAD_LIMIT = 2;

/* Bottom edge: the figure stands on the last row (255) or one above it. */
const BOTTOM_MIN = FRAME - 2;

/* Leftover chroma-key green. */
const GREEN_ALPHA = 40;
const GREEN_DELTA = 24;
const GREEN_LIMIT = 4;

/* Frame independence, measured as silhouette IoU at alpha > 64. */
const MASK_ALPHA = 64;
const IOU_FAKE = 0.985;
const IOU_MIN = 0.3;

/*
 * The eight hand-drawn originals were authored frame by frame rather than
 * composed from one base drawing, so a 1–2px vertical bounce is intentional
 * and their frame heights may vary by up to 4px. `drag` is listed as well: the
 * whale dangles from the cursor there, so its top edge genuinely moves ~3px
 * between frames (measured 223/222/225) instead of the 2px a composed sheet
 * gets. Everything else must stay within 2px.
 */
const BOUNCE_SHEETS = new Set(['idle', 'joy', 'eat', 'play', 'welcome', 'sleep', 'wake', 'walk', 'drag']);

/* A hand-drawn loop breathes in place: two adjacent idle frames sit at IoU
   0.99. The near-duplicate ceiling is therefore 0.995 for those sheets — a
   genuinely repeated drawing is 1.0 and is still caught. */
const IOU_FAKE_BOUNCE = 0.995;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/* ------------------------------------------------------------------ report */

const results = [];

function record(name, summary, failures) {
	results.push({ name, summary, failures });
}

function printCheck(result) {
	console.log((result.failures.length ? 'FAIL ' : 'ok   ') + result.name.padEnd(7) + result.summary);
	for (const line of result.failures) console.log('       - ' + line);
}

/* ------------------------------------------------------------ png decoding */

function pngFailure(label, message) {
	return new Error(label + ': ' + message);
}

/**
 * Decode a PNG into an RGBA8 buffer. Only what the sprite pipeline produces is
 * supported — bit depth 8, colour type 6 (RGBA) or 2 (RGB), non-interlaced —
 * and anything else is rejected with the file name instead of guessed at.
 */
function decodePng(path, label) {
	const buffer = readFileSync(path);
	if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw pngFailure(label, 'not a PNG (bad signature)');

	const chunks = [];
	let offset = 8;
	while (offset + 8 <= buffer.length) {
		const length = buffer.readUInt32BE(offset);
		const type = buffer.toString('ascii', offset + 4, offset + 8);
		const end = offset + 8 + length;
		if (end + 4 > buffer.length) throw pngFailure(label, 'truncated ' + type + ' chunk');
		chunks.push({ type, data: buffer.subarray(offset + 8, end) });
		offset = end + 4;
	}

	const ihdr = chunks.find((chunk) => chunk.type === 'IHDR');
	if (!ihdr || ihdr.data.length < 13) throw pngFailure(label, 'missing IHDR chunk');
	const width = ihdr.data.readUInt32BE(0);
	const height = ihdr.data.readUInt32BE(4);
	const bitDepth = ihdr.data[8];
	const colorType = ihdr.data[9];
	const interlace = ihdr.data[12];
	if (bitDepth !== 8) throw pngFailure(label, 'bit depth ' + bitDepth + ' is not supported (only 8)');
	if (colorType !== 6 && colorType !== 2) throw pngFailure(label, 'colour type ' + colorType + ' is not supported (only 6 = RGBA, 2 = RGB)');
	if (interlace !== 0) throw pngFailure(label, 'interlaced PNG is not supported');
	if (width === 0 || height === 0) throw pngFailure(label, 'zero-sized image');

	const idat = chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data);
	if (!idat.length) throw pngFailure(label, 'no IDAT chunk');
	let raw;
	try {
		raw = inflateSync(Buffer.concat(idat));
	} catch (error) {
		throw pngFailure(label, 'IDAT inflate failed: ' + error.message);
	}

	const channels = colorType === 6 ? 4 : 3;
	const stride = width * channels;
	if (raw.length < (stride + 1) * height) {
		throw pngFailure(label, 'IDAT holds ' + raw.length + ' B, expected at least ' + (stride + 1) * height + ' B');
	}

	const pixels = Buffer.alloc(width * height * 4);
	let previous = Buffer.alloc(stride);
	for (let y = 0; y < height; y++) {
		const filter = raw[y * (stride + 1)];
		const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
		if (filter > 4) throw pngFailure(label, 'unknown scanline filter ' + filter + ' on row ' + y);
		for (let x = 0; x < stride; x++) {
			const left = x >= channels ? line[x - channels] : 0;
			const up = previous[x];
			const upLeft = x >= channels ? previous[x - channels] : 0;
			let predictor = 0;
			if (filter === 1) predictor = left;
			else if (filter === 2) predictor = up;
			else if (filter === 3) predictor = (left + up) >> 1;
			else if (filter === 4) {
				const estimate = left + up - upLeft;
				const dLeft = Math.abs(estimate - left);
				const dUp = Math.abs(estimate - up);
				const dUpLeft = Math.abs(estimate - upLeft);
				predictor = dLeft <= dUp && dLeft <= dUpLeft ? left : dUp <= dUpLeft ? up : upLeft;
			}
			line[x] = (line[x] + predictor) & 0xff;
		}
		for (let x = 0; x < width; x++) {
			const source = x * channels;
			const target = (y * width + x) * 4;
			pixels[target] = line[source];
			pixels[target + 1] = line[source + 1];
			pixels[target + 2] = line[source + 2];
			pixels[target + 3] = channels === 4 ? line[source + 3] : 255;
		}
		previous = line;
	}

	return { width, height, pixels };
}

/* ------------------------------------------------------------- measurements */

/** Ink bbox, baseline, horizontal centre and stray-green count for one frame. */
function measureFrame(image, index) {
	const originX = index * FRAME;
	let minX = Infinity;
	let maxX = -1;
	let minY = Infinity;
	let maxY = -1;
	let ink = 0;
	let green = 0;
	for (let y = 0; y < FRAME; y++) {
		for (let x = 0; x < FRAME; x++) {
			const offset = (y * image.width + originX + x) * 4;
			const r = image.pixels[offset];
			const g = image.pixels[offset + 1];
			const b = image.pixels[offset + 2];
			const a = image.pixels[offset + 3];
			if (a > INK_ALPHA) {
				ink++;
				if (x < minX) minX = x;
				if (x > maxX) maxX = x;
				if (y < minY) minY = y;
				if (y > maxY) maxY = y;
			}
			if (a > GREEN_ALPHA && g - Math.max(r, b) > GREEN_DELTA) green++;
		}
	}
	if (maxY < 0) return { empty: true, ink: 0, green: 0 };
	return {
		empty: false,
		ink,
		green,
		top: minY,
		bottom: maxY,
		height: maxY - minY + 1,
		centre: (minX + maxX) / 2,
	};
}

/** Silhouette mask (alpha > MASK_ALPHA) of one frame, for the IoU check. */
function maskFrame(image, index) {
	const originX = index * FRAME;
	const mask = new Uint8Array(FRAME * FRAME);
	let count = 0;
	for (let y = 0; y < FRAME; y++) {
		for (let x = 0; x < FRAME; x++) {
			if (image.pixels[(y * image.width + originX + x) * 4 + 3] > MASK_ALPHA) {
				mask[y * FRAME + x] = 1;
				count++;
			}
		}
	}
	return { mask, count };
}

function intersectionOverUnion(a, b) {
	let intersection = 0;
	let union = 0;
	for (let i = 0; i < a.mask.length; i++) {
		const left = a.mask[i];
		const right = b.mask[i];
		if (left && right) intersection++;
		if (left || right) union++;
	}
	return union === 0 ? 1 : intersection / union;
}

function sha256(path) {
	return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/* ------------------------------------------------------- source of truth */

/** `const SHEETS = { idle: 3, ... };` in build.mjs -> Map(name -> frames). */
function readSheetTable() {
	const path = join(root, 'build.mjs');
	if (!existsSync(path)) throw new Error('build.mjs not found at ' + path);
	const text = readFileSync(path, 'utf8');
	const block = /const SHEETS = \{([\s\S]*?)\n\};?/.exec(text);
	if (!block) throw new Error('build.mjs: could not find `const SHEETS = { ... };`');
	const table = new Map();
	for (const line of block[1].split('\n')) {
		const match = /^\s*'?([A-Za-z][\w-]*)'?\s*:\s*(\d+)\s*,?\s*$/.exec(line.replace(/\/\/.*$/, ''));
		if (match) table.set(match[1], Number(match[2]));
	}
	if (table.size === 0) throw new Error('build.mjs: the SHEETS table is empty');
	return table;
}

/** A `var NAME = { key: 'value', ... };` object in src/pose-map.js. */
function readPoseObject(text, name) {
	const block = new RegExp('var ' + name + ' = \\{([\\s\\S]*?)\\n\\};?').exec(text);
	if (!block) throw new Error('src/pose-map.js: could not find `var ' + name + ' = { ... };`');
	const table = new Map();
	for (const line of block[1].split('\n')) {
		const match = /^\s*'?([A-Za-z][\w-]*)'?\s*:\s*'([^']*)'/.exec(line.replace(/\/\/.*$/, ''));
		if (match) table.set(match[1], match[2]);
	}
	if (table.size === 0) throw new Error('src/pose-map.js: `' + name + '` is empty');
	return table;
}

function listPngs(directory) {
	if (!existsSync(directory)) return [];
	return readdirSync(directory)
		.filter((name) => name.toLowerCase().endsWith('.png'))
		.sort();
}

/* --------------------------------------------------------------- the checks */

function main() {
	const sheets = readSheetTable();
	const poseMapText = readFileSync(join(root, 'src', 'pose-map.js'), 'utf8');
	const poseRules = readPoseObject(poseMapText, 'DWM_POSE_RULES');
	const poseFallbacks = readPoseObject(poseMapText, 'DWM_POSE_FALLBACK');

	const sheetFiles = listPngs(SPRITE_DIR);
	const poseFiles = listPngs(POSE_DIR);
	const sheetNames = new Set(sheetFiles.map((name) => name.slice(0, -4)));
	const poseNames = new Set(poseFiles.map((name) => name.slice(0, -4)));

	/* Decode everything once; a decode failure belongs to the frames check. */
	const decoded = new Map();
	const decodeFailures = [];
	for (const [name, frames] of sheets) {
		const path = join(SPRITE_DIR, name + '.png');
		if (!existsSync(path)) continue;
		try {
			decoded.set(name, decodePng(path, name + '.png'));
		} catch (error) {
			decodeFailures.push(error.message);
		}
	}
	const decodedPoses = new Map();
	for (const name of poseFiles) {
		try {
			decodedPoses.set(name.slice(0, -4), decodePng(join(POSE_DIR, name), 'poses/' + name));
		} catch (error) {
			decodeFailures.push(error.message);
		}
	}

	/* --- a. frame table parity ------------------------------------------- */
	const frameFailures = [...decodeFailures];
	let frameCount = 0;
	for (const [name, frames] of sheets) {
		const image = decoded.get(name);
		if (!image) {
			if (!frameFailures.some((line) => line.startsWith(name + '.png'))) {
				frameFailures.push(name + '.png: declared in build.mjs SHEETS but src/sprites/' + name + '.png is missing');
			}
			continue;
		}
		frameCount += frames;
		const expectedWidth = frames * FRAME;
		if (image.height !== FRAME) frameFailures.push(name + '.png: ' + image.width + 'x' + image.height + ', expected height ' + FRAME);
		if (image.width !== expectedWidth) {
			frameFailures.push(name + '.png: ' + image.width + 'px wide, expected ' + expectedWidth + 'px (' + frames + ' frames x ' + FRAME + ')');
		}
	}
	for (const name of sheetFiles) {
		if (!sheets.has(name.slice(0, -4))) {
			frameFailures.push(name + ': src/sprites/' + name + ' is not declared in build.mjs SHEETS');
		}
	}
	record(
		'frames',
		sheets.size + ' sheets, ' + frameCount + ' frames, every sheet frames*' + FRAME + ' x ' + FRAME,
		frameFailures,
	);

	/* --- b. pose sheets --------------------------------------------------- */
	const poseFailures = [];
	for (const [name, image] of decodedPoses) {
		if (image.width !== POSE_FRAMES * FRAME || image.height !== FRAME) {
			poseFailures.push('poses/' + name + '.png: ' + image.width + 'x' + image.height + ', expected ' + POSE_FRAMES * FRAME + 'x' + FRAME);
		}
	}
	for (const name of poseFiles) {
		if (!decodedPoses.has(name.slice(0, -4))) poseFailures.push('poses/' + name + ': could not be decoded');
	}
	/* Every portrait src/pose-map.js can ask for must exist, or be a name that
	   resolves to an animation state (the map falls back to a sheet when a
	   portrait has no art yet — see dwmPoseFallbackState). */
	const declaredPoses = [...new Set([...poseRules.values()])].sort();
	let withArt = 0;
	const viaFallback = [];
	for (const name of declaredPoses) {
		if (poseNames.has(name)) {
			withArt++;
			continue;
		}
		if (sheets.has(name)) continue; // the name *is* an animation state
		const fallback = poseFallbacks.get(name);
		if (fallback && sheets.has(fallback)) {
			viaFallback.push(name + '->' + fallback);
			continue;
		}
		poseFailures.push(
			'pose-map asks for pose "' + name + '" but src/sprites/poses/' + name + '.png is missing and there is no fallback to a declared sheet',
		);
	}
	const undeclaredPoses = [...poseNames].filter((name) => !declaredPoses.includes(name)).sort();
	record(
		'poses',
		poseNames.size + ' pose sheets at ' + POSE_FRAMES * FRAME + 'x' + FRAME + ', ' + declaredPoses.length + ' declared names (' + withArt + ' with art, ' + viaFallback.length + ' via fallback)',
		poseFailures,
	);

	/* --- c/d. ink geometry + stray green, per frame ----------------------- */
	const inkFailures = [];
	const chromaFailures = [];
	const rows = [];
	let bottomLow = FRAME;
	let bottomHigh = 0;
	let centreLow = Infinity;
	let centreHigh = -Infinity;
	let spreadWorst = 0;
	let greenWorst = 0;

	for (const [name, frames] of sheets) {
		const image = decoded.get(name);
		if (!image || image.width !== frames * FRAME || image.height !== FRAME) continue;
		const bounce = BOUNCE_SHEETS.has(name);
		const stats = [];
		for (let index = 0; index < frames; index++) stats.push(measureFrame(image, index));

		const heights = [];
		for (let index = 0; index < frames; index++) {
			const frame = stats[index];
			if (frame.empty) {
				inkFailures.push(name + ' frame ' + index + ': no ink at all (alpha > ' + INK_ALPHA + ' everywhere)');
				continue;
			}
			heights.push(frame.height);
			const bottomMin = bounce ? BOTTOM_MIN - 2 : BOTTOM_MIN;
			if (frame.bottom < bottomMin) {
				inkFailures.push(name + ' frame ' + index + ': ink bottom at y=' + frame.bottom + ', expected ' + bottomMin + '-' + (FRAME - 1));
			}
			if (Math.abs(frame.centre - FRAME / 2) > CENTRE_TOLERANCE) {
				inkFailures.push(name + ' frame ' + index + ': ink centre x=' + frame.centre + ', expected ' + FRAME / 2 + ' ± ' + CENTRE_TOLERANCE);
			}
			if (frame.green > GREEN_LIMIT) {
				chromaFailures.push(name + ' frame ' + index + ': ' + frame.green + ' stray green pixels (limit ' + GREEN_LIMIT + ')');
			}
			bottomLow = Math.min(bottomLow, frame.bottom);
			bottomHigh = Math.max(bottomHigh, frame.bottom);
			centreLow = Math.min(centreLow, frame.centre);
			centreHigh = Math.max(centreHigh, frame.centre);
			greenWorst = Math.max(greenWorst, frame.green);
		}
		const spread = heights.length ? Math.max(...heights) - Math.min(...heights) : 0;
		spreadWorst = Math.max(spreadWorst, spread);
		const limit = bounce ? SPREAD_LIMIT + 2 : SPREAD_LIMIT;
		if (spread > limit) {
			inkFailures.push(name + ': frame heights ' + heights.join('/') + ' spread ' + spread + 'px, limit ' + limit + 'px');
		}
		rows.push({ name, frames, image, stats, spread, limit });
	}
	record(
		'ink',
		'bottom y=' + bottomLow + '-' + bottomHigh + ', centre x=' + centreLow + '-' + centreHigh + ' (128 ± ' + CENTRE_TOLERANCE + '), height spread ≤ ' + spreadWorst + 'px (limit ' + SPREAD_LIMIT + ', hand-drawn ' + (SPREAD_LIMIT + 2) + ')',
		inkFailures,
	);
	record('chroma', 'worst frame has ' + greenWorst + ' stray green pixels (limit ' + GREEN_LIMIT + ')', chromaFailures);

	/* --- e. frame independence ------------------------------------------- */
	const motionFailures = [];
	let iouLow = Infinity;
	let iouHigh = 0;
	const iouRows = new Map();
	for (const row of rows) {
		if (row.frames < 2) continue;
		const bounce = BOUNCE_SHEETS.has(row.name);
		const ceiling = bounce ? IOU_FAKE_BOUNCE : IOU_FAKE;
		const masks = [];
		for (let index = 0; index < row.frames; index++) masks.push(maskFrame(row.image, index));
		const adjacent = [];
		for (let index = 1; index < row.frames; index++) adjacent.push(intersectionOverUnion(masks[index - 1], masks[index]));
		const ends = intersectionOverUnion(masks[0], masks[row.frames - 1]);
		for (const [pair, value] of adjacent.entries()) {
			if (value > ceiling) {
				motionFailures.push(row.name + ' frames ' + pair + '/' + (pair + 1) + ': silhouette IoU ' + value.toFixed(4) + ' > ' + ceiling + ' — the animation is the same drawing twice');
			}
			if (value < IOU_MIN) {
				motionFailures.push(row.name + ' frames ' + pair + '/' + (pair + 1) + ': silhouette IoU ' + value.toFixed(4) + ' < ' + IOU_MIN + ' — unrelated drawings');
			}
			iouLow = Math.min(iouLow, value);
			iouHigh = Math.max(iouHigh, value);
		}
		if (ends > ceiling) {
			motionFailures.push(row.name + ' frames 0/' + (row.frames - 1) + ': silhouette IoU ' + ends.toFixed(4) + ' > ' + ceiling + ' — the loop does not move');
		}
		if (ends < IOU_MIN) {
			motionFailures.push(row.name + ' frames 0/' + (row.frames - 1) + ': silhouette IoU ' + ends.toFixed(4) + ' < ' + IOU_MIN + ' — unrelated drawings');
		}
		iouLow = Math.min(iouLow, ends);
		iouHigh = Math.max(iouHigh, ends);
		iouRows.set(row.name, { adjacent, ends });
	}
	record(
		'motion',
		'silhouette IoU ' + iouLow.toFixed(4) + '-' + iouHigh.toFixed(4) + ' (fake > ' + IOU_FAKE + ', hand-drawn > ' + IOU_FAKE_BOUNCE + ', unrelated < ' + IOU_MIN + ')',
		motionFailures,
	);

	/* --- f. assets/ parity ------------------------------------------------ */
	const parityFailures = [];
	let parityChecked = 0;
	for (const [directory, assetDirectory, prefix] of [
		[SPRITE_DIR, ASSET_DIR, ''],
		[POSE_DIR, ASSET_POSE_DIR, 'poses/'],
	]) {
		for (const name of listPngs(directory)) {
			parityChecked++;
			const source = join(directory, name);
			const twin = join(assetDirectory, name);
			if (!existsSync(twin)) {
				parityFailures.push(prefix + name + ': missing from assets/ — run `node build.mjs`');
				continue;
			}
			const sourceHash = sha256(source);
			const twinHash = sha256(twin);
			if (sourceHash !== twinHash) {
				parityFailures.push(prefix + name + ': assets/ copy differs from src/sprites/ (' + twinHash.slice(0, 12) + ' vs ' + sourceHash.slice(0, 12) + ') — run `node build.mjs`');
			}
		}
	}
	record('parity', parityChecked + ' files match assets/ byte for byte (SHA-256)', parityFailures);

	/* --- output ---------------------------------------------------------- */
	console.log('');
	for (const result of results) printCheck(result);

	console.log('');
	console.log('sheet    frames  size       ink height          bottom              centre              green  iou-adjacent   iou-ends');
	for (const row of rows) {
		const ious = iouRows.get(row.name);
		const heights = row.stats.map((stat) => (stat.empty ? '-' : stat.height)).join('/');
		const bottoms = row.stats.map((stat) => (stat.empty ? '-' : stat.bottom)).join('/');
		const centres = row.stats.map((stat) => (stat.empty ? '-' : stat.centre)).join('/');
		const greens = row.stats.map((stat) => (stat.empty ? '-' : stat.green)).join('/');
		console.log(
			row.name.padEnd(8) + ' ' +
			String(row.frames).padEnd(7) + ' ' +
			(row.image.width + 'x' + row.image.height).padEnd(10) + ' ' +
			heights.padEnd(19) + ' ' +
			bottoms.padEnd(19) + ' ' +
			centres.padEnd(19) + ' ' +
			greens.padEnd(6) + ' ' +
			(ious ? ious.adjacent.map((value) => value.toFixed(4)).join(' ') : '-').padEnd(14) + ' ' +
			(ious ? ious.ends.toFixed(4) : '-'),
		);
	}
	if (viaFallback.length) console.log('\nposes without art (fall back to an animation state): ' + viaFallback.join(', '));
	if (undeclaredPoses.length) console.log('poses with art but no scene rule: ' + undeclaredPoses.join(', '));

	const failed = results.filter((result) => result.failures.length);
	console.log('');
	if (failed.length) {
		console.log('asset-qc: ' + failed.length + ' of ' + results.length + ' checks FAILED (' + failed.map((result) => result.name).join(', ') + ')');
		process.exitCode = 1;
		return;
	}
	console.log('asset-qc: all ' + results.length + ' checks passed');
}

try {
	main();
} catch (error) {
	console.log('FAIL  setup  ' + error.message);
	console.log('');
	console.log('asset-qc: aborted');
	process.exitCode = 1;
}
