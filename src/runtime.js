/*
 * dsh-whale-maid — shared runtime (added in 1.1.0).
 *
 * The companion features (work-status link, growth, proactive care, hit zones,
 * status chip, particle FX) all live in their own files but must talk to each
 * other and to the pet component. build.mjs concatenates every src/*.js into one
 * closure, so they can simply share declarations — no globals, no module table.
 *
 * This file only holds the shared state object and small pure helpers. It is
 * concatenated FIRST, so nothing here may call into pet.js at load time; the
 * helpers are only invoked after the pet has mounted.
 */

/** Cross-module state. The pet fills in `api` when it mounts. */
var DWM_RUNTIME = {
	/** true once the pet component has mounted and published `api`. */
	ready: false,
	/** mirror of the pet's live pose / frame, kept up to date by pet.js. */
	state: 'idle',
	frame: 0,
	flip: 1,
	/** handle bundle exposed by pet.js (say / runSequence / setState / root …). */
	api: null,
	/** work-status detector output, maintained by signals.js. */
	work: {
		active: false,
		phase: 'idle',
		kind: '',
		since: 0,
		changedAt: 0,
		goneAt: 0,
		sessions: 0,
		held: false
	},
	/** timestamps used by the cooldown rules, all in ms since epoch. */
	startedAt: 0,
	lastSayAt: 0,
	lastChipAt: 0,
	lastInteractionAt: 0,
	lastCareAt: 0,
	lastIdleChatAt: 0,
	lastWorkSpeechAt: 0,
	lastSeenAt: 0,
	/** tap history for the triple-click easter egg. */
	taps: []
};

/** New window events. All namespaced under dsh-whale-maid: and additive. */
var DWM_EVENT_CHIP = 'dsh-whale-maid:chip';
var DWM_EVENT_FX = 'dsh-whale-maid:fx';
var DWM_EVENT_STATE = 'dsh-whale-maid:state';
var DWM_EVENT_GROWTH = 'dsh-whale-maid:growth';
var DWM_EVENT_COMPANION = 'dsh-whale-maid:companion';

/** Companion-feature preferences (separate key, the original options are untouched). */
var KEY_COMPANION = 'dsh-whale-maid:companion';

var DWM_COMPANION_DEFAULTS = {
	workLink: true,
	workHold: 6000,
	workSpeech: 'chatty',
	idleChat: true,
	care: true,
	chip: true,
	zones: true,
	achievements: true,
	lateNight: true
};

function dwmNow() {
	return Date.now();
}

function dwmPad2(value) {
	return value < 10 ? '0' + value : String(value);
}

function dwmClamp(value, min, max) {
	if (!Number.isFinite(value)) return min;
	if (value < min) return min;
	if (value > max) return max;
	return value;
}

function dwmReadCompanion() {
	var stored = readJSON(KEY_COMPANION);
	var out = {};
	var key;
	for (key in DWM_COMPANION_DEFAULTS) {
		if (!Object.prototype.hasOwnProperty.call(DWM_COMPANION_DEFAULTS, key)) continue;
		out[key] = DWM_COMPANION_DEFAULTS[key];
	}
	if (stored && typeof stored === 'object') {
		for (key in out) {
			if (!Object.prototype.hasOwnProperty.call(out, key)) continue;
			if (stored[key] === undefined) continue;
			out[key] = stored[key];
		}
	}
	out.workHold = dwmClamp(Number(out.workHold), 0, 60000);
	if (out.workSpeech !== 'chatty' && out.workSpeech !== 'quiet' && out.workSpeech !== 'off') out.workSpeech = 'chatty';
	return out;
}

function dwmWriteCompanion(patch) {
	var next = dwmReadCompanion();
	var key;
	if (patch && typeof patch === 'object') {
		for (key in patch) {
			if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
			if (next[key] === undefined) continue;
			next[key] = patch[key];
		}
	}
	next.workHold = dwmClamp(Number(next.workHold), 0, 60000);
	writeJSON(KEY_COMPANION, next);
	if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(DWM_EVENT_COMPANION));
	return next;
}

/** yyyy-mm-dd in local time. */
function dwmDayKey(at) {
	var date = new Date(typeof at === 'number' ? at : dwmNow());
	return date.getFullYear() + '-' + dwmPad2(date.getMonth() + 1) + '-' + dwmPad2(date.getDate());
}

/** yyyy-mm-dd of the Monday that starts the week containing `at`. */
function dwmWeekKey(at) {
	var date = new Date(typeof at === 'number' ? at : dwmNow());
	var start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	var offset = (start.getDay() + 6) % 7;
	start.setDate(start.getDate() - offset);
	return dwmDayKey(start.getTime());
}

/** True between 23:00 and 05:59 local time. */
function dwmIsLateNight(at) {
	var hour = new Date(typeof at === 'number' ? at : dwmNow()).getHours();
	return hour >= 23 || hour < 6;
}

/** Tiny deterministic PRNG (mulberry32 seeded by a string) for daily quests. */
function dwmSeededRandom(seed) {
	var hash = 2166136261 >>> 0;
	var text = String(seed);
	for (var i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 16777619) >>> 0;
	}
	return function () {
		hash = (hash + 0x6d2b79f5) >>> 0;
		var t = hash;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function dwmShuffle(list, rng) {
	var out = list.slice();
	for (var i = out.length - 1; i > 0; i--) {
		var j = Math.floor(rng() * (i + 1));
		var tmp = out[i];
		out[i] = out[j];
		out[j] = tmp;
	}
	return out;
}

/** Speak through the pet's bubble, tolerating "not mounted yet". */
function dwmSpeak(message) {
	if (typeof message !== 'string' || message === '') return false;
	DWM_RUNTIME.lastSayAt = dwmNow();
	if (DWM_RUNTIME.api && typeof DWM_RUNTIME.api.say === 'function') {
		DWM_RUNTIME.api.say(message);
		return true;
	}
	if (typeof window !== 'undefined' && typeof SAY_EVENT === 'string') {
		window.dispatchEvent(new CustomEvent(SAY_EVENT, { detail: { text: message } }));
		return true;
	}
	return false;
}

/** Show the small status chip (separate from the speech bubble on purpose). */
function dwmChip(text, tone, ms) {
	if (!text) return;
	DWM_RUNTIME.lastChipAt = dwmNow();
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent(DWM_EVENT_CHIP, { detail: { text: text, tone: tone || 'info', ms: ms || 2200 } }));
}

/** Spawn particles in the FX layer: kind = heart | star | sparkle | note. */
function dwmFx(kind, count) {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent(DWM_EVENT_FX, { detail: { kind: kind || 'heart', count: count || 1 } }));
}

/** Force the pet into a pose; hold = keep it until released. */
function dwmForceState(state, ms, hold) {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(
		new CustomEvent(DWM_EVENT_STATE, { detail: { state: state, ms: ms || 1200, hold: hold === true } }),
	);
}

/** Notify listeners that growth data changed. */
function dwmEmitGrowth() {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent(DWM_EVENT_GROWTH));
}
