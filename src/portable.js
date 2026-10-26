/*
 * dsh-whale-maid — save export / import (added in 1.4.0).
 *
 * A save is a plain JSON envelope holding every localStorage key this plugin
 * owns. It is deliberately boring: schema tag + version + timestamp + data.
 * Importing validates the tag, the version and every value before writing, and
 * refuses anything it does not recognise instead of half-applying it.
 */

var DWM_SAVE_SCHEMA = 'dsh-whale-maid/save';
var DWM_SAVE_VERSION = 1;
var DWM_SAVE_MAX_CHARS = 200000;

/** Every storage key the plugin owns, with the reader/writer used to validate it. */
function dwmSaveKeys() {
	return [
		{ key: KEY_POS, kind: 'object' },
		{ key: KEY_FEEDS, kind: 'number' },
		{ key: KEY_GREETED, kind: 'string' },
		{ key: KEY_OPTIONS, kind: 'object' },
		{ key: KEY_GROWTH, kind: 'object' },
		{ key: KEY_COMPANION, kind: 'object' },
		{ key: KEY_WEATHER, kind: 'object' },
	];
}

function dwmSaveReadRaw(key) {
	try {
		if (typeof window === 'undefined' || !window.localStorage) return null;
		return window.localStorage.getItem(key);
	} catch (error) {
		return null;
	}
}

/** Export the whole save as a formatted JSON string. */
function dwmSaveExport() {
	var data = {};
	var keys = dwmSaveKeys();
	for (var i = 0; i < keys.length; i += 1) {
		var raw = dwmSaveReadRaw(keys[i].key);
		if (raw === null) continue;
		try {
			data[keys[i].key] = JSON.parse(raw);
		} catch (error) {
			/* a corrupt entry is skipped rather than poisoning the export */
		}
	}
	return JSON.stringify(
		{
			schema: DWM_SAVE_SCHEMA,
			version: DWM_SAVE_VERSION,
			exportedAt: new Date().toISOString(),
			plugin: 'dsh-whale-maid',
			data: data,
		},
		null,
		2,
	);
}

function dwmSaveTypeOf(value) {
	if (value === null) return 'null';
	if (Array.isArray(value)) return 'array';
	return typeof value;
}

function dwmSaveMatchesKind(value, kind) {
	var actual = dwmSaveTypeOf(value);
	if (kind === 'object') return actual === 'object';
	if (kind === 'array') return actual === 'array';
	return actual === kind;
}

/**
 * Import a save. Returns `{ ok, imported, skipped, reason }`.
 * Nothing is written unless the envelope is valid, so a bad paste is a no-op.
 */
function dwmSaveImport(text) {
	if (typeof text !== 'string' || text.trim() === '') {
		return { ok: false, imported: 0, skipped: 0, reason: 'empty' };
	}
	if (text.length > DWM_SAVE_MAX_CHARS) {
		return { ok: false, imported: 0, skipped: 0, reason: 'too-large' };
	}
	var parsed;
	try {
		parsed = JSON.parse(text);
	} catch (error) {
		return { ok: false, imported: 0, skipped: 0, reason: 'not-json' };
	}
	if (!parsed || typeof parsed !== 'object' || parsed.schema !== DWM_SAVE_SCHEMA) {
		return { ok: false, imported: 0, skipped: 0, reason: 'wrong-schema' };
	}
	if (parsed.version !== DWM_SAVE_VERSION) {
		return { ok: false, imported: 0, skipped: 0, reason: 'wrong-version' };
	}
	var data = parsed.data;
	if (!data || typeof data !== 'object') {
		return { ok: false, imported: 0, skipped: 0, reason: 'no-data' };
	}

	var keys = dwmSaveKeys();
	var imported = 0;
	var skipped = 0;
	for (var i = 0; i < keys.length; i += 1) {
		var entry = keys[i];
		if (!Object.prototype.hasOwnProperty.call(data, entry.key)) continue;
		if (!dwmSaveMatchesKind(data[entry.key], entry.kind)) {
			skipped += 1;
			continue;
		}
		try {
			window.localStorage.setItem(entry.key, JSON.stringify(data[entry.key]));
			imported += 1;
		} catch (error) {
			skipped += 1;
		}
	}

	/* let every consumer re-read what just changed */
	if (typeof window !== 'undefined') {
		window.dispatchEvent(new CustomEvent(OPTIONS_EVENT));
		window.dispatchEvent(new CustomEvent(DWM_EVENT_GROWTH));
		window.dispatchEvent(new CustomEvent(DWM_EVENT_COMPANION));
	}
	return { ok: imported > 0, imported: imported, skipped: skipped, reason: imported > 0 ? null : 'nothing-usable' };
}

/** Wipe every key the plugin owns (the save-file version of `forget()`). */
function dwmSaveClear() {
	var keys = dwmSaveKeys();
	var cleared = 0;
	for (var i = 0; i < keys.length; i += 1) {
		try {
			window.localStorage.removeItem(keys[i].key);
			cleared += 1;
		} catch (error) {
			/* ignore */
		}
	}
	return cleared;
}
