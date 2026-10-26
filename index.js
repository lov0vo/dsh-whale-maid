/**
 * dsh-whale-maid — Host half.
 *
 * The pet itself is a React component registered into the `shell.overlay` slot,
 * and its options panel into `settings.section` — see `client.js` (generated
 * from `src/` by `build.mjs`).
 *
 * The Host half has exactly one job: serve the sprite sheets and pose portraits
 * that `build.mjs` copies into `assets/`, so the Client bundle can reference
 * them as plain URLs instead of carrying ~4.7 MB of base64 (`client.js` used to
 * inline every PNG as a `data:` URL). The renderer is sandboxed, so it cannot
 * read the plugin directory from disk; an HTTP route is the only way to hand it
 * the files, and it keeps the JS bundle a few hundred KB instead of 4.78 MB.
 *
 * Route:  GET/HEAD /api/dsh-whale-maid/assets/<name>.png
 *         GET/HEAD /api/dsh-whale-maid/assets/poses/<name>.png
 *
 * No Cordis `Config` schema is declared on purpose: the pet's tunables are user
 * preferences (size, speed, language, idle behaviour), they live in the
 * renderer's localStorage, and they are edited from the settings section rather
 * than from a bundle patch. Declaring a Host schema for them would give the same
 * values two sources of truth.
 */

import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'dsh-whale-maid';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** `build.mjs` copies `src/sprites/**` here; `package.json#files` ships it. */
const ASSETS_DIR = path.join(HERE, 'assets');
/** Must match `ASSET_BASE` emitted into `client.js` by `build.mjs`. */
const ROUTE = '/api/dsh-whale-maid/assets';

const MIME = {
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml',
	'.json': 'application/json; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
};

/**
 * Resolve a request-relative path inside `assets/`. Returns `null` for anything
 * that escapes the directory (`..`, absolute paths, NUL bytes).
 */
function safeResolve(relative) {
	if (typeof relative !== 'string' || relative.length === 0) return null;
	if (relative.includes('\0')) return null;
	const target = path.normalize(path.join(ASSETS_DIR, relative));
	if (target !== ASSETS_DIR && !target.startsWith(ASSETS_DIR + path.sep)) return null;
	return target;
}

/** The portion of `req.url` below the route prefix, decoded, without slashes. */
function relativeFromUrl(rawUrl) {
	const url = new URL(typeof rawUrl === 'string' && rawUrl ? rawUrl : '/', 'http://127.0.0.1');
	let pathname = url.pathname;
	// The route is registered as a prefix, so `req.url` normally still carries it.
	// Strip it when present and tolerate a server that already trimmed it.
	if (pathname === ROUTE || pathname.startsWith(ROUTE + '/')) pathname = pathname.slice(ROUTE.length);
	let decoded;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		return null;
	}
	return decoded.replace(/^\/+/, '');
}

function sendPlain(res, status, body, extraHeaders) {
	res.writeHead(status, {
		'Content-Type': 'text/plain; charset=utf-8',
		'Cache-Control': 'no-store',
		...extraHeaders,
	});
	res.end(body);
}

export function apply(ctx) {
	if (!existsSync(ASSETS_DIR)) {
		// Only true before the first `node build.mjs`; the route then 404s everything.
		ctx.logger?.warn?.('dsh-whale-maid: ' + ASSETS_DIR + ' is missing — run `node build.mjs` to publish the sprite art');
	}

	// Must go through `inject`: when `apply` runs, the webServer fiber may not
	// exist yet. `effect` ties the route's disposer to this plugin's fiber so a
	// reload unregisters it before registering again.
	ctx.inject(['webServer'], (wctx) => {
		const webServer = wctx.webServer ?? wctx.get?.('webServer');
		if (!webServer?.register) {
			ctx.logger?.warn?.('dsh-whale-maid: webServer unavailable, sprite assets are not served');
			return;
		}

		const register = () => {
			try {
				return webServer.register({
					kind: 'prefix',
					path: ROUTE,
					handler: (req, res) => {
						try {
							if (req.method !== 'GET' && req.method !== 'HEAD') {
								sendPlain(res, 405, 'method not allowed', { Allow: 'GET, HEAD' });
								return;
							}
							const file = safeResolve(relativeFromUrl(req.url));
							if (file === null || !existsSync(file) || !statSync(file).isFile()) {
								sendPlain(res, 404, 'not found');
								return;
							}
							const stat = statSync(file);
							const etag = 'W/"' + stat.size.toString(16) + '-' + stat.mtimeMs.toString(16) + '"';
							if (req.headers?.['if-none-match'] === etag) {
								res.writeHead(304, { ETag: etag, 'Cache-Control': 'public, max-age=3600' });
								res.end();
								return;
							}
							const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
							res.writeHead(200, {
								'Content-Type': type,
								'Content-Length': stat.size,
								'Cache-Control': 'public, max-age=3600',
								ETag: etag,
							});
							if (req.method === 'HEAD') {
								res.end();
								return;
							}
							createReadStream(file).pipe(res);
						} catch (error) {
							sendPlain(res, 400, String(error?.message ?? error));
						}
					},
				});
			} catch (error) {
				// A duplicate prefix registration must not take the whole row down.
				ctx.logger?.warn?.('dsh-whale-maid: sprite route not registered: ' + String(error?.message ?? error));
				return () => {};
			}
		};

		wctx.effect(register, 'dsh-whale-maid: sprite asset route');
	});

	ctx.logger?.info?.('dsh-whale-maid: mounted (sprite assets at ' + ROUTE + '/)');
}
