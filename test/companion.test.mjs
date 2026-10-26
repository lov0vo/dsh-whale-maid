/*
 * dsh-whale-maid — headless tests for the 1.1.0 companion features.
 *
 * These tests load the *generated* `client.js` into a stub DOM, run its real
 * `apply()` against a stub slot registry, and drive the public API. That covers
 * the two failure modes that a build-time syntax check cannot see:
 *
 *   1. a `ReferenceError` at load time (a companion module calling something
 *      that only exists after the pet mounts);
 *   2. the work-status detector mis-reading the DOM contract.
 *
 * What is deliberately NOT covered here: rendering. React never mounts, so the
 * sprite, the bubble, the chip and the particle layer are verified in the live
 * app instead (see the verification section of README.md).
 *
 * Usage: node --test test/
 */

import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const bundle = readFileSync(join(root, 'client.js'), 'utf8');

/* --- stub environment ---------------------------------------------------- */

function makeElement(tag) {
	return {
		tagName: tag,
		textContent: '',
		style: {},
		setAttribute() {},
		remove() {},
		appendChild() {},
		addEventListener() {},
		removeEventListener() {},
		getBoundingClientRect() {
			return { left: 0, top: 0, width: 110, height: 110, right: 110, bottom: 110 };
		}
	};
}

function createHarness() {
	const listeners = new Map();
	const store = new Map();
	/* selector -> number of matching nodes, driven per test */
	const dom = { matches: {}, text: {} };
	const styleTags = [];
	const cleanups = [];
	const registrations = [];

	class FakeCustomEvent {
		constructor(type, init) {
			this.type = type;
			this.detail = init && init.detail;
		}
	}

	const windowStub = {
		innerWidth: 1440,
		innerHeight: 900,
		devicePixelRatio: 1,
		localStorage: {
			getItem(key) {
				return store.has(key) ? store.get(key) : null;
			},
			setItem(key, value) {
				store.set(key, String(value));
			},
			removeItem(key) {
				store.delete(key);
			}
		},
		matchMedia() {
			return { matches: false };
		},
		addEventListener(type, fn) {
			if (!listeners.has(type)) listeners.set(type, []);
			listeners.get(type).push(fn);
		},
		removeEventListener(type, fn) {
			const list = listeners.get(type);
			if (!list) return;
			const index = list.indexOf(fn);
			if (index >= 0) list.splice(index, 1);
		},
		dispatchEvent(event) {
			const list = listeners.get(event.type);
			if (list) for (const fn of list.slice()) fn(event);
			return true;
		}
	};

	const documentStub = {
		visibilityState: 'visible',
		head: {
			appendChild(element) {
				styleTags.push(element);
			}
		},
		documentElement: { appendChild() {} },
		body: { addEventListener() {}, removeEventListener() {} },
		createElement: makeElement,
		querySelector(selector) {
			return (dom.matches[selector] || 0) > 0 ? makeElement('div') : null;
		},
		querySelectorAll(selector) {
			const count = dom.matches[selector] || 0;
			const nodes = [];
			for (let i = 0; i < count; i++) {
				const node = makeElement('div');
				node.textContent = dom.text[selector] || '';
				nodes.push(node);
			}
			return nodes;
		},
		addEventListener() {},
		removeEventListener() {}
	};

	const ReactStub = {
		createElement(type, props, ...children) {
			return { type, props, children };
		},
		Fragment: 'Fragment',
		useState(initial) {
			return [typeof initial === 'function' ? initial() : initial, () => {}];
		},
		useEffect() {},
		useLayoutEffect() {},
		useRef(initial) {
			return { current: initial };
		},
		useMemo(factory) {
			return factory();
		},
		useCallback(fn) {
			return fn;
		}
	};

	let descriptor = null;
	windowStub.__ModuleLoader__ = {
		load(next) {
			descriptor = next;
		}
	};

	const previous = new Map();
	/* `navigator` is intentionally left alone: Node 24 defines it as a getter-only
	 * global, and the plugin only reads `navigator.language` to resolve "auto". */
	const globals = {
		window: windowStub,
		document: documentStub,
		CustomEvent: FakeCustomEvent,
		MutationObserver: class {
			observe() {}
			disconnect() {}
		},
		requestAnimationFrame() {
			return 0;
		},
		cancelAnimationFrame() {}
	};
	for (const [key, value] of Object.entries(globals)) {
		previous.set(key, Object.prototype.hasOwnProperty.call(globalThis, key) ? globalThis[key] : undefined);
		globalThis[key] = value;
	}

	runInThisContext(bundle, { filename: 'client.js' });
	assert.ok(descriptor, 'client.js must call window.__ModuleLoader__.load');
	assert.equal(descriptor.id, 'dsh-whale-maid');

	const plugin = descriptor.factory((id) => {
		if (id === 'react') return ReactStub;
		throw new Error('unexpected require: ' + id);
	});

	const ctx = {
		effect(fn, label) {
			const disposer = fn();
			cleanups.push({ label, disposer });
			return () => {
				if (typeof disposer === 'function') disposer();
			};
		},
		slots: {
			inject(name, callback) {
				return callback();
			},
			register(declaration, component) {
				registrations.push({ declaration, component });
				return () => {};
			}
		}
	};

	plugin.apply(ctx);

	return {
		plugin,
		api: windowStub.dshWhaleMaid,
		window: windowStub,
		dom,
		store,
		styleTags,
		cleanups,
		registrations,
		dispose() {
			for (const entry of cleanups) {
				if (typeof entry.disposer === 'function') {
					try {
						entry.disposer();
					} catch (error) {
						/* cleanup must never throw during unload */
					}
				}
			}
			for (const [key, value] of previous) {
				if (value === undefined) delete globalThis[key];
				else globalThis[key] = value;
			}
		}
	};
}

const harness = createHarness();
const api = harness.api;

test.after(() => harness.dispose());

/* --- registration -------------------------------------------------------- */

test('registers the overlay and both settings sections', () => {
	assert.deepEqual(
		harness.registrations.map((entry) => entry.declaration.name),
		['shell.overlay', 'settings.section', 'settings.section']
	);
	assert.deepEqual(
		harness.registrations.map((entry) => entry.declaration.id),
		['dsh-whale-maid', 'dsh-whale-maid', 'dsh-whale-maid-companion']
	);
	for (const entry of harness.registrations) {
		assert.equal(typeof entry.component, 'function');
	}
});

test('injects exactly one stylesheet and disposes it', () => {
	assert.equal(harness.styleTags.length, 1);
	assert.match(harness.styleTags[0].textContent, /\.dwm-root/);
	assert.match(harness.styleTags[0].textContent, /@keyframes dwm-sway/);
});

test('keeps the 1.0.0 public API and its defaults', () => {
	for (const name of ['getOptions', 'setOptions', 'say', 'resetPosition', 'feeds', 'forget']) {
		assert.equal(typeof api[name], 'function', name + ' must stay available');
	}
	const options = api.getOptions();
	assert.deepEqual(Object.keys(options).sort(), [
		'bubbleDuration',
		'greeting',
		'greetings',
		'language',
		'size',
		'sleep',
		'speed',
		'typewriter',
		'walk'
	]);
	assert.equal(options.size, null);
	assert.equal(options.speed, 1);
	assert.equal(options.bubbleDuration, 4500);
	assert.equal(options.language, 'auto');
	assert.equal(options.typewriter, true);
});

test('the typewriter reveal can be switched off', () => {
	api.setOptions({ typewriter: false });
	assert.equal(api.getOptions().typewriter, false);
	api.setOptions({ typewriter: true });
	assert.equal(api.getOptions().typewriter, true);
});

/* --- companion switches -------------------------------------------------- */

test('companion switches default to on and persist', () => {
	const defaults = api.companion();
	assert.equal(defaults.workLink, true);
	assert.equal(defaults.workHold, 6000);
	assert.equal(defaults.workSpeech, 'chatty');
	assert.equal(defaults.care, true);
	assert.equal(defaults.zones, true);

	api.setCompanion({ workHold: 8000, idleChat: false });
	assert.equal(api.companion().workHold, 8000);
	assert.equal(api.companion().idleChat, false);
	const stored = JSON.parse(harness.store.get('dsh-whale-maid:companion'));
	assert.equal(stored.workHold, 8000);
	assert.equal(stored.idleChat, false);
});

test('companion writes ignore unknown keys', () => {
	api.setCompanion({ notARealSwitch: 1 });
	assert.equal(api.companion().notARealSwitch, undefined);
});

/* --- growth -------------------------------------------------------------- */

test('growth snapshot has the documented shape', () => {
	const growth = api.growth();
	assert.equal(growth.level, 1);
	assert.ok(growth.mood > 0 && growth.mood <= 100, 'mood is a 0..100 gauge');
	assert.ok(growth.satiety >= 0 && growth.satiety <= 100, 'satiety is a 0..100 gauge');
	assert.ok(growth.affinity >= 0);
	assert.equal(growth.quests.length, 3);
	assert.ok(growth.achievements.length >= 40, 'achievement wall is populated');
	assert.ok(growth.unlockedCount <= growth.totalCount);
	assert.equal(growth.totalCount, growth.achievements.length);
	assert.ok(Array.isArray(growth.diary));
	assert.equal(typeof growth.bondZh, 'string');
	assert.equal(typeof growth.bondEn, 'string');
});

test('checking in happens once per day', () => {
	/* the care loop checks in on load */
	assert.equal(api.growth().signinDays.length, 1);
	assert.equal(api.growth().signinStreak, 1);
	/* and a second attempt the same day is a no-op */
	assert.equal(api.signin(), null);
});

test('quests only pay out when finished', () => {
	const quests = api.growth().quests;
	assert.equal(quests.length, 3);
	for (const quest of quests) {
		assert.equal(quest.claimed, false);
		assert.ok(quest.target > 0);
		assert.equal(typeof quest.zh, 'string');
		assert.equal(typeof quest.en, 'string');
	}
	if (!quests[0].ready) assert.equal(api.claimQuest(0), null);
	assert.equal(api.claimQuest(99), null);
});

/* --- hit zones and text probing ------------------------------------------ */

test('hit zones follow the artwork layout', () => {
	assert.equal(api.zoneAt(0.9, 0.7), 'tail');
	assert.equal(api.zoneAt(0.5, 0.2), 'head');
	assert.equal(api.zoneAt(0.5, 0.6), 'belly');
	/* outside every rectangle falls back to the head, never to null */
	assert.equal(api.zoneAt(0.02, 0.99), 'head');
});

test('topics and keyword reactions', () => {
	assert.deepEqual(api.probe('这段代码报错了，帮我看看'), { topic: 'debug', keyword: 'broken' });
	assert.deepEqual(api.probe('谢谢你'), { topic: 'thanks', keyword: 'thanks' });
	assert.deepEqual(api.probe('晚安，我去睡了'), { topic: 'night', keyword: 'night' });
	assert.deepEqual(api.probe('帮我写个测试用例'), { topic: 'test', keyword: null });
	assert.deepEqual(api.probe('今天天气不错'), { topic: 'general', keyword: null });
});

/* --- work-status detector ------------------------------------------------ */

const CHAT_RUNNING = '[data-chat-running]';
const TOOL_RUNNING = '[data-tool][data-state="running"]';
const TOOL_ERROR = '[data-tool][data-state="error"]';

test('detects thinking, then a running tool, then the end of the turn', () => {
	api.setCompanion({ workLink: true, workHold: 0 });
	harness.dom.matches = {};
	assert.equal(api.scanNow().active, false);

	const before = api.growth().counts.success;

	harness.dom.matches = { [CHAT_RUNNING]: 1 };
	const thinking = api.scanNow();
	assert.equal(thinking.active, true);
	assert.equal(thinking.phase, 'thinking');
	assert.equal(api.work().sessions, 1);

	harness.dom.matches = { [CHAT_RUNNING]: 1, [TOOL_RUNNING]: 1 };
	assert.equal(api.scanNow().phase, 'tool');

	harness.dom.matches = {};
	const done = api.scanNow();
	assert.equal(done.active, false);
	assert.ok(api.growth().counts.success > before, 'a clean turn is recorded as a success');
});

test('a tool gap is pinned for workHold instead of flickering to idle', () => {
	api.setCompanion({ workHold: 6000 });
	harness.dom.matches = { [CHAT_RUNNING]: 1 };
	api.scanNow();
	harness.dom.matches = {};
	const pinned = api.scanNow();
	assert.equal(pinned.active, true, 'the session is still open during the grace period');
	assert.equal(pinned.held, true);

	/* let the session end so the next test starts clean */
	api.setCompanion({ workHold: 0 });
	harness.dom.matches = {};
	assert.equal(api.scanNow().active, false);
});

test('a finished error card left in the DOM is not a new failure', () => {
	/* old error card is already there when the turn starts: baseline = 1 */
	harness.dom.matches = { [CHAT_RUNNING]: 1, [TOOL_ERROR]: 1 };
	api.scanNow();
	const failures = api.growth().counts.failure;

	harness.dom.matches = { [CHAT_RUNNING]: 1, [TOOL_ERROR]: 1 };
	api.scanNow();
	harness.dom.matches = {};
	api.scanNow();

	assert.equal(api.growth().counts.failure, failures, 'a pre-existing error card must not count');
});

test('a new error card during the turn counts as a failure', () => {
	harness.dom.matches = { [CHAT_RUNNING]: 1, [TOOL_ERROR]: 1 };
	api.scanNow();
	const failures = api.growth().counts.failure;

	harness.dom.matches = { [CHAT_RUNNING]: 1, [TOOL_ERROR]: 2 };
	api.scanNow();
	harness.dom.matches = {};
	api.scanNow();

	assert.equal(api.growth().counts.failure, failures + 1);
});

/* The work link must reach for the dedicated poses added in 1.2.0 instead of
   borrowing the play / drag sheets. */
test('a running tool shows the dedicated work pose', () => {
	const seen = [];
	const onState = (event) => seen.push(event.detail.state);
	harness.window.addEventListener('dsh-whale-maid:state', onState);

	api.setCompanion({ workLink: true, workHold: 0 });
	harness.dom.matches = { [CHAT_RUNNING]: 1 };
	api.scanNow();
	harness.dom.matches = { [CHAT_RUNNING]: 1, [TOOL_RUNNING]: 1 };
	api.scanNow();
	harness.dom.matches = {};
	api.scanNow();

	harness.window.removeEventListener('dsh-whale-maid:state', onState);
	assert.ok(seen.indexOf('work') >= 0, 'expected the work pose, saw: ' + seen.join(', '));
	assert.equal(seen.indexOf('play'), -1, 'the work pose must not borrow play, saw: ' + seen.join(', '));
});

test('a new failure shows the dedicated sad pose', () => {
	const seen = [];
	const onState = (event) => seen.push(event.detail.state);
	harness.window.addEventListener('dsh-whale-maid:state', onState);

	harness.dom.matches = { [CHAT_RUNNING]: 1, [TOOL_ERROR]: 1 };
	api.scanNow();
	harness.dom.matches = { [CHAT_RUNNING]: 1, [TOOL_ERROR]: 2 };
	api.scanNow();
	harness.dom.matches = {};
	api.scanNow();

	harness.window.removeEventListener('dsh-whale-maid:state', onState);
	assert.ok(seen.indexOf('sad') >= 0, 'expected the sad pose, saw: ' + seen.join(', '));
	assert.equal(seen.indexOf('drag'), -1, 'the failure pose must not borrow drag, saw: ' + seen.join(', '));
});

test('the detector stands down when the work link is switched off', () => {
	api.setCompanion({ workLink: false });
	harness.dom.matches = { [CHAT_RUNNING]: 1 };
	const verdict = api.scanNow();
	assert.equal(verdict.active, false);
	api.setCompanion({ workLink: true, workHold: 6000 });
	harness.dom.matches = {};
});

/* --- diagnostics and cleanup --------------------------------------------- */

test('diagnose reports a coherent snapshot', () => {
	const report = api.diagnose();
	assert.equal(typeof report.ready, 'boolean');
	assert.equal(typeof report.pose, 'string');
	assert.equal(typeof report.work.phase, 'string');
	assert.equal(typeof report.options.speed, 'number');
	assert.equal(typeof report.companion.workHold, 'number');
	assert.ok(Array.isArray(report.growth.quests));
});

test('forget clears every key this plugin owns', () => {
	api.setOptions({ speed: 2 });
	api.setCompanion({ workHold: 5000 });
	assert.ok(harness.store.has('dsh-whale-maid:options'));
	assert.ok(harness.store.has('dsh-whale-maid:companion'));

	api.forget();

	for (const key of [
		'dsh-whale-maid:pos',
		'dsh-whale-maid:feeds',
		'dsh-whale-maid:greeted',
		'dsh-whale-maid:options',
		'dsh-whale-maid:companion',
		'dsh-whale-maid:growth'
	]) {
		assert.equal(harness.store.has(key), false, key + ' must be cleared');
	}
	assert.equal(api.getOptions().speed, 1);
});

test('every registered effect exposes a cleanup that does not throw', () => {
	assert.ok(harness.cleanups.length >= 4);
	for (const entry of harness.cleanups) {
		assert.equal(typeof entry.disposer, 'function', entry.label + ' must return a disposer');
		assert.doesNotThrow(() => entry.disposer());
	}
});
