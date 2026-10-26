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
		held: false,
		/** 1.8.0 (A5): the "this turn has been running a long time" pose fired once. */
		longShown: false
	},
	/**
	 * 1.8.0 (A4): what the bubble is currently showing. `dwmSpeak` compares the
	 * priority of a new line against this record so a routine status line can
	 * never clobber an important one while it is still readable.
	 */
	speech: {
		priority: 'normal',
		rank: 0,
		until: 0,
		at: 0,
		text: ''
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
var DWM_EVENT_WORK = 'dsh-whale-maid:work';
/** 1.8.0 (A5): a pose from `src/pose-map.js` was picked. Additive. */
var DWM_EVENT_POSE = 'dsh-whale-maid:pose';

/** Companion-feature preferences (separate key, the original options are untouched). */
var KEY_COMPANION = 'dsh-whale-maid:companion';

/**
 * Tell the pet whether a work phase is running. Drives the soft glow behind
 * her, so the state is visible even when the pose is subtle.
 */
function dwmSetWorkGlow(active) {
	DWM_RUNTIME.workGlow = !!active;
	if (typeof window !== 'undefined') {
		window.dispatchEvent(new CustomEvent(DWM_EVENT_WORK, { detail: { active: !!active } }));
	}
}

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

/**
 * Speech priorities (1.8.0, A4). A desktop pet talks on its own all day long,
 * so the bubble needs a pecking order: routine status lines ('normal'), the
 * work-status narration ('state') and things the user really should read —
 * care, milestones, failures ('important').
 */
var DWM_SPEECH_RANKS = { normal: 0, state: 1, important: 2 };
/** Mirror of `DEFAULT_OPTIONS.bubbleDuration`; used before options are read. */
var DWM_SPEECH_FALLBACK_MS = 4500;

/** Rank of a priority; anything unrecognised behaves like 'normal'. */
function dwmSpeechRank(priority) {
	if (priority === 'important') return DWM_SPEECH_RANKS.important;
	if (priority === 'state') return DWM_SPEECH_RANKS.state;
	return DWM_SPEECH_RANKS.normal;
}

/** How long the bubble stays up, so the priority window matches what is seen. */
function dwmSpeechWindow(extraMs) {
	var windowMs = DWM_SPEECH_FALLBACK_MS;
	try {
		var configured = Number(readOptions().bubbleDuration);
		if (Number.isFinite(configured) && configured > 0) windowMs = configured;
	} catch (error) {
		/* options live in pet.js; a bare runtime keeps the fallback */
	}
	var extra = Number(extraMs);
	if (Number.isFinite(extra) && extra > windowMs) windowMs = extra;
	return windowMs;
}

/**
 * Speak through the pet's bubble, tolerating "not mounted yet".
 *
 * `priority` is 'normal' | 'state' | 'important' (default 'normal'). A new line
 * is dropped while an unexpired line of *strictly higher* priority is still on
 * screen; equal or lower priority replaces it, because a newer line is still
 * the truth. The optional `ms` only widens the window, never shortens it.
 */
function dwmSpeak(message, tone, priority, ms) {
	if (typeof message !== 'string' || message === '') return false;
	var now = dwmNow();
	var rank = dwmSpeechRank(priority);
	var showing = DWM_RUNTIME.speech;
	if (showing && showing.until > now && showing.rank > rank) return false;

	var delivered = false;
	if (DWM_RUNTIME.api && typeof DWM_RUNTIME.api.say === 'function') {
		DWM_RUNTIME.api.say(message, tone);
		delivered = true;
	} else if (typeof window !== 'undefined' && typeof SAY_EVENT === 'string') {
		window.dispatchEvent(new CustomEvent(SAY_EVENT, { detail: { text: message } }));
		delivered = true;
	}
	if (!delivered) return false;

	DWM_RUNTIME.lastSayAt = now;
	DWM_RUNTIME.speech = {
		priority: priority === 'important' || priority === 'state' ? priority : 'normal',
		rank: rank,
		until: now + dwmSpeechWindow(ms),
		at: now,
		text: message
	};
	return true;
}

/**
 * 1.3.0: the status chip was removed. Everything the pet wants to show is now
 * spoken through the one speech bubble, so the old call sites keep working
 * but nothing extra appears on screen.
 *
 * `ms` (already passed by the 1.1.0 call sites) now widens the priority window,
 * and the optional `priority` is forwarded to `dwmSpeak`.
 */
function dwmChip(text, tone, ms, priority) {
	if (!text) return false;
	DWM_RUNTIME.lastChipAt = dwmNow();
	return dwmSpeak(text, tone || 'info', priority, ms);
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

/* --- 1.8.0 (A5): show a pose from src/pose-map.js ------------------------
 *
 * `dwmPoseFor(context)` says *what* belongs to a situation: either a portrait
 * (`image`) or, when that portrait is not shipped, an animation `state`. This
 * block is the *how*:
 *
 *   1. a portrait is painted by a small self-contained layer that covers the
 *      pet's own box exactly, so it never spills over the app behind her and
 *      never depends on the sprite state machine;
 *   2. the same result is broadcast as `dsh-whale-maid:pose`, so a richer
 *      renderer inside the pet component can take over without any caller
 *      changing;
 *   3. when there is no portrait, the animation state is forced exactly the
 *      way the 1.1.0 modules always did it.
 */

/** The live portrait layer: one node at a time, plus its auto-hide timer. */
var DWM_PORTRAIT = { node: null, timer: undefined, held: false };

/** The pet's root element, or null when she has not mounted yet. */
function dwmPortraitHost() {
	if (typeof document === 'undefined' || !document.body) return null;
	if (typeof document.body.appendChild !== 'function') return null;
	var api = DWM_RUNTIME.api;
	if (!api || typeof api.root !== 'function') return null;
	var root = null;
	try {
		root = api.root();
	} catch (error) {
		return null;
	}
	if (!root || typeof root.getBoundingClientRect !== 'function') return null;
	return root;
}

/** Take the portrait down (idempotent). */
function dwmHidePose() {
	dwmPortraitHideSprite(false);
	if (DWM_PORTRAIT.timer !== undefined) clearTimeout(DWM_PORTRAIT.timer);
	DWM_PORTRAIT.timer = undefined;
	DWM_PORTRAIT.held = false;
	var node = DWM_PORTRAIT.node;
	DWM_PORTRAIT.node = null;
	if (!node) return;
	try {
		if (node.parentNode && typeof node.parentNode.removeChild === 'function') node.parentNode.removeChild(node);
		else if (typeof node.remove === 'function') node.remove();
	} catch (error) {
		/* the layer is cosmetic: a DOM hiccup must never break a pose change */
	}
}

/** Paint `result.image` over the pet's box. Returns false when that is impossible. */
function dwmPortraitHideSprite(hidden) {
	if (typeof document === 'undefined' || !document.querySelectorAll) return;
	var layers = document.querySelectorAll('.dwm-root .dwm-3d, .dwm-root .dwm-3d *');
	for (var i = 0; i < layers.length; i += 1) {
		if (layers[i] && layers[i].style) layers[i].style.visibility = hidden ? 'hidden' : '';
	}
}


function dwmPortraitShow(result, ms, hold) {
	var root = dwmPortraitHost();
	if (!root) return false;
	var rect = null;
	try {
		rect = root.getBoundingClientRect();
	} catch (error) {
		return false;
	}
	if (!rect || !(Number(rect.width) > 0)) return false;
	dwmHidePose();
	var strays = document.querySelectorAll ? document.querySelectorAll('[data-dwm-portrait]') : [];
	for (var s = 0; s < strays.length; s += 1) {
		if (strays[s] && strays[s].parentNode) strays[s].parentNode.removeChild(strays[s]);
	}

	var node = null;
	try {
		node = document.createElement('div');
		node.setAttribute('data-dwm-portrait', result.pose || '');
		node.setAttribute('aria-hidden', 'true');
		var style = node.style;
		/* the pose sheet holds three cells side by side: step through them with CSS */
		style.backgroundImage = 'url(' + result.image + ')';
		style.backgroundRepeat = 'no-repeat';
		style.backgroundSize = '300% 100%';
		style.backgroundPosition = '0% 0';
		style.position = 'fixed';
		style.animation = 'dwm-pose-cycle 0.9s steps(1) infinite, dwm-portrait-float 2.8s ease-in-out infinite';
		dwmPortraitHideSprite(true);
		style.left = rect.left + 'px';
		style.top = rect.top + 'px';
		style.width = rect.width + 'px';
		style.height = rect.height + 'px';
		style.objectFit = 'contain';
		style.objectPosition = 'center bottom';
		style.pointerEvents = 'none';
		style.zIndex = '60';
		style.filter = 'drop-shadow(0 12px 10px rgb(18 20 30 / 30%))';
		document.body.appendChild(node);
	} catch (error) {
		return false;
	}
	DWM_PORTRAIT.node = node;
	DWM_PORTRAIT.held = hold === true;
	if (!DWM_PORTRAIT.held) {
		var duration = Number(ms) > 0 ? Number(ms) : 2000;
		DWM_PORTRAIT.timer = setTimeout(dwmHidePose, duration);
	}
	return true;
}

/**
 * Show one pose-map result: the portrait when it exists, the animation state
 * otherwise. `hold` keeps the pose until the next one (used by the work link,
 * where the posture lasts for the whole turn).
 */
function dwmShowPose(result, ms, hold) {
	if (!result) return;
	// Action-first (2.2.0): an animation state always wins over a static
	// portrait, so the pet keeps moving instead of flickering between the
	// two. Portraits are only used when the pose has no state equivalent.
	var state = result.state;
	if (!state && typeof dwmPoseFallbackState === "function") state = dwmPoseFallbackState(result.pose);
	if (state) {
		dwmHidePose();
		dwmForceState(state, ms, hold);
		return;
	}
	if (result.image) dwmPortraitShow(result, ms, hold);
}


/** Notify listeners that growth data changed. */
function dwmEmitGrowth() {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent(DWM_EVENT_GROWTH));
}
