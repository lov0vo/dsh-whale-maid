/*
 * dsh-whale-maid — the whale girl pet, ported from the store site's React
 * component (`function Sa()` in https://deepseek1024.com/assets/index-FXCvsbOr.js).
 *
 * The port is behavioural, not visual-only: every state, timer, rAF loop,
 * pointer gesture and localStorage key of the original is reproduced here, so
 * the pet blinks, idles, thinks, sleeps, wakes, wanders across the viewport,
 * tilts while being dragged, eats, plays and pops hearts exactly as it does on
 * the site.
 *
 * This file is a plain script (no import/export): `build.mjs` wraps it into the
 * DSH client-module bundle, which is where `React`, `h` and `SPRITES` come from.
 */

/* ---------------------------------------------------------------- tunables */
/* Names in comments are the original minified identifiers. */

var DRAG_THRESHOLD = 6; // ea   px of pointer travel before a press becomes a drag
/* Release physics (added in 1.5.0). Values mirror the reference plugin:
 * one discrete nudge of velocity * 2.4 capped at 70px, a 420ms spring-back
 * rotation capped at 20deg, and a squash-only reaction below 6px/event. */
var DRAG_RELEASE_GAIN = 2.4;
var DRAG_RELEASE_CAP = 70;
var DRAG_LIGHT_SPEED = 6;
var DRAG_TILT_GAIN = 1.25;
var DRAG_TILT_CAP = 20;
var SQUASH_MS = 320; //      how long `.is-squash` stays on after a light release
var CLICK_GUARD_MS = 400; // how long a release swallows the synthesised click
var BUBBLE_MS = 4500; // ta   how long a speech bubble stays up
var SLEEP_MS = 60000; // na   idle time before the pet falls asleep
var THINK_MIN_MS = 15000; // t    think-event interval base
var THINK_JITTER_MS = 20000;
var WALK_INTERVAL_MIN_MS = 25000; // ra   wander interval base
var WALK_INTERVAL_JITTER_MS = 20000;
var WALK_SPEED = 70; // ia   px per second while wandering
var WALK_MIN_DISTANCE = 60; // aa   shortest wander leg
var WALK_MAX_EXTRA = 140; //      random extra distance on top of the minimum
var WALK_MIN_SPACE = 16; //      less room than this and the pet gives up
var EDGE_GAP = 12; // oa   keep-out margin at the viewport edge
var RESIZE_GAP = 28; // sa   margin used when clamping after a resize
var MAX_TILT = 10; // ca   degrees of 3D tilt at the edge of the body
var HEART_MS = 1300; //      heart particle lifetime
var HEART_SPREAD = 14; //      heart horizontal jitter, px

/* The twelve animation states: sheet, frame count, fps and playback mode.
   The original ten (idle..walk) are unchanged; `work` and `sad` are additive
   single-frame poses so the work-status link no longer borrows `play` / `drag`. */
var ANIM = {
	idle: { sheet: 'idle', frames: 3, fps: 2, playback: 'blink' },
	joy: { sheet: 'joy', frames: 2, fps: 5, playback: 'loop' },
	eat: { sheet: 'eat', frames: 3, fps: 8, playback: 'loop' },
	play: { sheet: 'play', frames: 3, fps: 3, playback: 'loop' },
	welcome: { sheet: 'welcome', frames: 2, fps: 3, playback: 'loop' },
	/* `drag` used to run at 5 fps with the `tilt` motion on top. Its three frames
	 * are drawn 20 px apart, so 5 fps meant a 100 px/s jump, and the CSS tilt
	 * (±6 deg) fought the rotation already inside the frames. Slower, and the
	 * motion is off. */
	drag: { sheet: 'drag', frames: 3, fps: 2, playback: 'loop' },
	think: { sheet: 'think', frames: 3, fps: 2, playback: 'loop', motion: 'float' },
	work: { sheet: 'work', frames: 3, fps: 2, playback: 'loop', motion: 'float' },
	/* Two frames since 2.2.0: the middle drawing was 196 px tall against 226/225
	 * for its neighbours, which read as a 13% size pop once per loop. */
	sad: { sheet: 'sad', frames: 2, fps: 2, playback: 'loop' },
	/* Added in 1.5.1 for the bond Lv3 unlock; never entered by the idle loop.
	 * Three frames since 2.1.0; 1.5 fps since 2.2.0, the frames sit 20 px apart. */
	wink: { sheet: 'wink', frames: 3, fps: 1.5, playback: 'loop' },
	sleep: { sheet: 'sleep', frames: 2, fps: 1, playback: 'loop' },
	wake: { sheet: 'wake', frames: 2, fps: 3, playback: 'once' },
	walk: { sheet: 'walk', frames: 3, fps: 6, playback: 'pingpong' },
};

var KEY_POS = 'dsh-whale-maid:pos';
var KEY_FEEDS = 'dsh-whale-maid:feeds';
var KEY_GREETED = 'dsh-whale-maid:greeted';
var KEY_OPTIONS = 'dsh-whale-maid:options';
var OPTIONS_EVENT = 'dsh-whale-maid:options';
var SAY_EVENT = 'dsh-whale-maid:say';
var RESET_POS_EVENT = 'dsh-whale-maid:reset-position';

/* Copy lines, verbatim from the site (zh), with an English rendering. */
var DWM_RECALL_LABEL = { zh: '唤回桌宠', en: 'Bring her back' };

var TEXTS = {
	zh: {
		petLabel: '鲸鱼女仆',
		petFeed: '喂一条小鱼干',
		petPlay: '和鲸鱼女仆玩',
		petGreeting: '欢迎回来！我是你的鲸鱼女仆～',
		greeting: [
			'嘿嘿，欢迎常来逛插件市场～',
			'今天也要元气满满哦！',
			'右上角搜一搜，可能有惊喜～',
			'我每天都在这里等你呢。',
			'装个桌宠插件陪陪我嘛？',
		],
		feed: ['谢谢投喂小鱼干！', '小鱼干真好吃～', '吃饱了继续帮你看店！'],
		play: ['来玩抛接球！', '接住啦，再高点！', '和你玩真开心～'],
		milestone: function (n) {
			return '第 ' + n + ' 条小鱼干啦，最爱你了！';
		},
	},
	en: {
		petLabel: 'Whale girl',
		petFeed: 'Feed a fish',
		petPlay: 'Play with the whale girl',
		petGreeting: "Welcome back! I'm your whale girl~",
		greeting: [
			'Hehe, welcome to the plugin market~',
			'Stay full of energy today too!',
			'Try the search box up top — there might be a surprise~',
			'I wait for you here every day.',
			'Install a desktop pet to keep me company?',
		],
		feed: ['Thanks for the dried fish!', 'This dried fish is delicious~', 'Full now — back to watching the store for you!'],
		play: ["Let's play catch!", 'Got it — higher!', 'I love playing with you~'],
		milestone: function (n) {
			return "That's " + n + ' dried fish — I love you most!';
		},
	},
};

/* ------------------------------------------------------------- utilities */

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

function pick(list) {
	return list[Math.floor(Math.random() * list.length)];
}

function readRaw(key) {
	try {
		return window.localStorage.getItem(key);
	} catch (error) {
		return null;
	}
}

function writeRaw(key, value) {
	try {
		window.localStorage.setItem(key, value);
	} catch (error) {
		/* private mode: the pet still works, it just forgets */
	}
}

function readJSON(key) {
	var raw = readRaw(key);
	if (raw === null) return null;
	try {
		return JSON.parse(raw);
	} catch (error) {
		return null;
	}
}

function writeJSON(key, value) {
	writeRaw(key, JSON.stringify(value));
}

var DEFAULT_OPTIONS = {
	size: null, // null = responsive (110px, 72px on narrow screens)
	speed: 1, // multiplier for frame rate and wander speed
	language: 'auto', // 'auto' | 'zh' | 'en'
	greeting: true, // greet once on first ever mount
	sleep: true, // doze off after a while when idle
	dragPhysics: true, // release inertia + squash (1.5.0)
	walk: true, // wander across the viewport on its own
	bubbleDuration: BUBBLE_MS,
	typewriter: true, // reveal bubble text one character at a time
	city: '北京', // weather fallback city when geolocation is unavailable
	hidden: false, // hide the pet, leave a small 🐋 button to bring her back
	greetings: null, // override the greeting lines
};

function normalizeOptions(input) {
	var options = Object.assign({}, DEFAULT_OPTIONS, input || {});
	var speed = Number(options.speed);
	options.speed = Number.isFinite(speed) && speed > 0 ? clamp(speed, 0.1, 8) : 1;
	var size = options.size;
	options.size = typeof size === 'number' && Number.isFinite(size) && size > 0 ? clamp(Math.round(size), 24, 480) : null;
	if (options.language !== 'zh' && options.language !== 'en') options.language = 'auto';
	var bubble = Number(options.bubbleDuration);
	options.bubbleDuration = Number.isFinite(bubble) && bubble > 0 ? bubble : BUBBLE_MS;
	options.greeting = options.greeting !== false;
	options.sleep = options.sleep !== false;
	options.walk = options.walk !== false;
	options.typewriter = options.typewriter !== false;
	options.dragPhysics = options.dragPhysics !== false;

	options.hidden = options.hidden === true;
	var city = typeof options.city === 'string' ? options.city.trim() : '';
	options.city = city === '' ? '北京' : city;
	if (!Array.isArray(options.greetings) || options.greetings.length === 0) options.greetings = null;
	return options;
}

function readOptions() {
	var stored = readJSON(KEY_OPTIONS);
	var fromGlobal = typeof window !== 'undefined' ? window.__DSH_WHALE_GIRL__ : null;
	return normalizeOptions(Object.assign({}, fromGlobal || {}, stored || {}));
}

function resolveLanguage(option) {
	if (option === 'zh' || option === 'en') return option;
	var nav = typeof navigator !== 'undefined' ? navigator : null;
	var tag = (nav && (nav.language || (nav.languages && nav.languages[0]))) || 'en';
	return String(tag).toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
}

function prefersReducedMotion() {
	try {
		return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
	} catch (error) {
		return false;
	}
}

/* --------------------------------------------------------- sub-components */

/* One sprite layer. `layer === 'depth'` renders the blurred parallax copy. */
function Sprite(props) {
	var anim = ANIM[props.state] || ANIM.idle;
	var depth = props.layer === 'depth';
	var className = 'dwm-sprite';
	if (!depth && anim.motion) className += ' is-' + anim.motion;
	if (depth) className += ' dwm-depth';
	var position = anim.frames > 1 ? (props.frame / (anim.frames - 1)) * 100 : 0;
	return h('span', {
		className: className,
		'aria-hidden': 'true',
		style: {
			backgroundImage: 'url(' + SPRITES[anim.sheet] + ')',
			backgroundSize: anim.frames * 100 + '% 100%',
			backgroundPosition: position + '% 0',
		},
	});
}

/* The store's glare layer. The original paints a plain radial-gradient over the whole
 * 110px box, which is invisible on the store's light page but shows up as a pale rounded
 * rectangle on a dark theme. Masking the glare with the current sprite frame keeps the
 * exact same highlight while confining it to the character's own silhouette. */
function Shine(props) {
	var anim = ANIM[props.state] || ANIM.idle;
	var position = anim.frames > 1 ? (props.frame / (anim.frames - 1)) * 100 : 0;
	var size = anim.frames * 100 + '% 100%';
	var mask = 'url(' + SPRITES[anim.sheet] + ')';
	return h('span', {
		className: 'dwm-shine',
		'aria-hidden': 'true',
		style: {
			WebkitMaskImage: mask,
			maskImage: mask,
			WebkitMaskSize: size,
			maskSize: size,
			WebkitMaskPosition: position + '% 0',
			maskPosition: position + '% 0',
			WebkitMaskRepeat: 'no-repeat',
			maskRepeat: 'no-repeat',
		},
	});
}

/* Lucide `fish` glyph (ISC) — the feed button. */
function FishIcon() {
	return h(
		'svg',
		{
			width: 18,
			height: 18,
			viewBox: '0 0 24 24',
			fill: 'none',
			stroke: 'currentColor',
			strokeWidth: 2,
			strokeLinecap: 'round',
			strokeLinejoin: 'round',
			'aria-hidden': 'true',
		},
		h('path', { d: 'M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z' }),
		h('path', { d: 'M18 12v.5' }),
		h('path', { d: 'M16 17.93a9.77 9.77 0 0 1 0-11.86' }),
		h('path', { d: 'M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33' }),
		h('path', { d: 'M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4' }),
		h('path', { d: 'M10.46 16.74C10.2 18.12 9.17 19.76 8 21h5.8a2 2 0 0 0 1.98-1.67l.23-1.4' }),
	);
}

/* Lucide `gamepad-2` glyph (ISC) — the play button. */
function GamepadIcon() {
	return h(
		'svg',
		{
			width: 18,
			height: 18,
			viewBox: '0 0 24 24',
			fill: 'none',
			stroke: 'currentColor',
			strokeWidth: 2,
			strokeLinecap: 'round',
			strokeLinejoin: 'round',
			'aria-hidden': 'true',
		},
		h('line', { x1: 6, x2: 10, y1: 11, y2: 11 }),
		h('line', { x1: 8, x2: 8, y1: 9, y2: 13 }),
		h('line', { x1: 15, x2: 15.01, y1: 12, y2: 12 }),
		h('line', { x1: 18, x2: 18.01, y1: 10, y2: 10 }),
		h('path', {
			d: 'M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z',
		}),
	);
}

/* ------------------------------------------------------------- component */

/* React hooks, shared by every component in this module. */
var React_ = React;
var useState = React_.useState;
var useRef = React_.useRef;
var useEffect = React_.useEffect;

/* Typing cadence, copied verbatim from dsh-whale-musume so both pets read
 * at the same speed: 64ms per character, 260ms after CJK punctuation,
 * 90ms after a space, and a 130ms beat every fifth character. */
var DWM_TYPE_PAUSE = '，。！？～…、；：';

/* --- speech bubble with an optional typewriter reveal ------------------ */
function Bubble(props) {
	var text = props.text || '';
	var instant = props.instant === true;
	var speed = props.speed > 0 ? props.speed : 1;
	var pair = useState(instant ? text.length : 0);
	var shown = pair[0];
	var setShown = pair[1];
	useEffect(
		function () {
			if (instant || text.length === 0) {
				setShown(text.length);
				return undefined;
			}
			var step = 0;
			var timer = null;
			function delayFor(character, index) {
				if (DWM_TYPE_PAUSE.indexOf(character) !== -1) return 260;
				if (character === ' ') return 90;
				if (index % 5 === 0) return 130;
				return 64;
			}
			function tick() {
				if (step >= text.length) {
					timer = null;
					setShown(text.length);
					return;
				}
				var character = text.charAt(step);
				step += 1;
				setShown(step);
				timer = setTimeout(tick, Math.round(delayFor(character, step) / speed));
			}
			timer = setTimeout(tick, 0);
			return function () {
				if (timer !== null) clearTimeout(timer);
			};
		},
		[text, instant, speed],
	);
	var typing = shown < text.length;
	var tone = props.tone ? ' dwm-bubble-' + String(props.tone) : '';
	return h(
		'p',
		{ className: 'dwm-bubble' + tone, role: 'status', 'aria-label': text },
		h('span', { 'aria-hidden': 'true' }, text.slice(0, shown)),
		typing ? h('span', { className: 'dwm-caret', 'aria-hidden': 'true' }) : null,
	);
}

function WhaleGirl() {

	var optionsState = useState(readOptions);
	var options = optionsState[0];
	var setOptions = optionsState[1];

	var posState = useState(function () {
		var stored = readJSON(KEY_POS);
		if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) return { x: stored.x, y: stored.y };
		return null;
	});
	var pos = posState[0];
	var setPos = posState[1];

	var feedsState = useState(function () {
		var stored = readRaw(KEY_FEEDS);
		var value = stored === null ? NaN : Number(stored);
		return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
	});
	var feeds = feedsState[0];
	var setFeeds = feedsState[1];

	var bubbleState = useState(null);
	var bubble = bubbleState[0];
	var setBubble = bubbleState[1];

	var menuState = useState(false);
	var workGlowState = useState(false);
	var workGlow = workGlowState[0];
	var setWorkGlow = workGlowState[1];
	var menuOpen = menuState[0];
	var setMenuOpen = menuState[1];

	var heartsState = useState([]);
	var hearts = heartsState[0];
	var setHearts = heartsState[1];

	var stateState = useState('idle');
	var animState = stateState[0];
	var setAnimState = stateState[1];

	var frameState = useState(0);
	var frame = frameState[0];
	var setFrame = frameState[1];

	var flipState = useState(1);
	var flip = flipState[0];
	var setFlip = flipState[1];

	var rootRef = useRef(null);
	var bodyRef = useRef(null);
	var bubbleTimer = useRef(undefined);
	/* `squash` is the single source of truth for `.is-squash`: the class is
	 * rendered from this boolean and nothing else writes it. */
	var squashState = useState(false);
	var squash = squashState[0];
	var setSquash = squashState[1];
	var releaseTimers = useRef([]);
	var squashTimer = useRef(undefined);
	var clickGuard = useRef(undefined);
	var dragRef = useRef(null);
	var suppressClick = useRef(false);
	var stateRef = useRef('idle');
	stateRef.current = animState;
	var sequenceTimers = useRef([]);
	var sleepTimer = useRef(undefined);
	var thinkTimer = useRef(undefined);
	var walkTimer = useRef(undefined);
	var walkRef = useRef(null);
	var rafRef = useRef(undefined);
	var reducedMotion = useRef(prefersReducedMotion());
	var latest = useRef({});

	var language = resolveLanguage(options.language);
	var text = TEXTS[language];

	/* Live option changes (the public setOptions API dispatches this event). */
	useEffect(function () {
		function onOptions() {
			setOptions(readOptions());
		}
		function onSay(event) {
			var message = event && event.detail && event.detail.text;
			if (typeof message === 'string' && message !== '') say(message, event.detail.tone);
		}
		function onResetPos() {
			try {
				window.localStorage.removeItem(KEY_POS);
			} catch (error) {
				/* ignore */
			}
			setPos(null);
		}
		window.addEventListener(OPTIONS_EVENT, onOptions);
		window.addEventListener(SAY_EVENT, onSay);
		window.addEventListener(DWM_EVENT_WORK, onWorkGlow);
		window.addEventListener(RESET_POS_EVENT, onResetPos);
		return function () {
			window.removeEventListener(OPTIONS_EVENT, onOptions);
			window.removeEventListener(SAY_EVENT, onSay);
			window.removeEventListener(DWM_EVENT_WORK, onWorkGlow);
			window.removeEventListener(RESET_POS_EVENT, onResetPos);
		};
	}, []);

	/* --- speech bubble ------------------------------------------------- */
	function onWorkGlow(event) {
		setWorkGlow(!!(event && event.detail && event.detail.active));
	}

	function say(message, tone) {
		if (bubbleTimer.current !== undefined) clearTimeout(bubbleTimer.current);
		setBubble({ id: Date.now(), text: message, tone: tone || '' });
		bubbleTimer.current = setTimeout(function () {
			setBubble(null);
		}, options.bubbleDuration);
	}

	/* --- timed state sequence, then fall back to `idle` ----------------- */
	function runSequence(steps, fallback) {
		var last = fallback === undefined ? 'idle' : fallback;
		var timers = sequenceTimers.current;
		for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
		sequenceTimers.current = [];
		var offset = 0;
		for (var s = 0; s < steps.length; s++) {
			(function (next, at) {
				sequenceTimers.current.push(
					setTimeout(function () {
						setAnimState(next);
					}, at),
				);
			})(steps[s][0], offset);
			offset += steps[s][1];
		}
		sequenceTimers.current.push(
			setTimeout(function () {
				setAnimState(last);
			}, offset),
		);
	}

	/* --- doze off when nothing happens for a while ---------------------- */
	function resetSleep() {
		if (sleepTimer.current !== undefined) clearTimeout(sleepTimer.current);
		if (!options.sleep) return;
		sleepTimer.current = setTimeout(function () {
			setAnimState(function (current) {
				return current === 'idle' || current === 'think' ? 'sleep' : current;
			});
		}, SLEEP_MS);
	}

	/* --- stop a wander in progress -------------------------------------- */
	function stopWalk() {
		if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
		rafRef.current = undefined;
		var wasWalking = walkRef.current !== null;
		walkRef.current = null;
		/* Aborting a wander must not leave her frozen in the walk frames. */
		if (wasWalking) {
			setAnimState(function (current) {
				return current === 'walk' ? 'idle' : current;
			});
		}
	}

	function persistPos(x, y) {
		setPos({ x: x, y: y });
		writeJSON(KEY_POS, { x: x, y: y });
	}

	/* --- wander animation loop ------------------------------------------ */
	function walkStep(now) {
		var walk = walkRef.current;
		if (!walk) return;
		var delta = Math.min(50, now - walk.last);
		walk.last = now;
		walk.progress += (WALK_SPEED * options.speed * delta) / 1000;
		if (walk.progress >= walk.distance) {
			stopWalk();
			setAnimState('idle');
			persistPos(walk.target, walk.y);
			return;
		}
		var x = walk.dir === 1 ? walk.from - walk.progress : walk.from + walk.progress;
		setPos({ x: x, y: walk.y });
		rafRef.current = requestAnimationFrame(walkStep);
	}

	/* --- pick a direction and wander there ------------------------------ */
	function startWalk() {
		var root = rootRef.current;
		if (!root) return;
		if (dragRef.current !== null) return;
		if (walkRef.current !== null) return;
		var rect = root.getBoundingClientRect();
		var width = rect.width;
		var left = rect.left;
		var top = rect.top;
		var maxLeft = Math.max(EDGE_GAP, window.innerWidth - width - EDGE_GAP);
		function roomFor(dir) {
			return dir === 1 ? left - EDGE_GAP : maxLeft - left;
		}
		var dir = Math.random() < 0.5 ? 1 : -1;
		var room = roomFor(dir);
		if (room < WALK_MIN_SPACE) {
			dir = dir === 1 ? -1 : 1;
			room = roomFor(dir);
			if (room < WALK_MIN_SPACE) return;
		}
		var distance = Math.max(0, Math.min(WALK_MIN_DISTANCE + Math.random() * WALK_MAX_EXTRA, room));
		/* A degenerate distance would only flash the walk frames for one tick. */
		if (distance < 8) return;
		var target = dir === 1 ? left - distance : left + distance;
		setPos({ x: left, y: top });
		setFlip(dir === 1 ? 1 : -1);
		setAnimState('walk');
		walkRef.current = {
			from: left,
			target: target,
			y: top,
			distance: distance,
			dir: dir,
			progress: 0,
			last: performance.now(),
		};
		rafRef.current = requestAnimationFrame(walkStep);
	}

	/* --- 3D tilt that follows the pointer over the body ------------------ */
	function tiltTo(clientX, clientY) {
		if (reducedMotion.current) return;
		var body = bodyRef.current;
		var root = rootRef.current;
		if (!body || !root) return;
		var rect = root.getBoundingClientRect();
		var dx = (clientX - rect.left) / rect.width - 0.5;
		var dy = (clientY - rect.top) / rect.height - 0.5;
		body.style.setProperty('--dwm-tilt-x', (-dy * 2 * MAX_TILT).toFixed(2) + 'deg');
		body.style.setProperty('--dwm-tilt-y', (dx * 2 * MAX_TILT).toFixed(2) + 'deg');
	}

	function resetTilt() {
		var body = bodyRef.current;
		if (!body) return;
		body.style.setProperty('--dwm-tilt-x', '0deg');
		body.style.setProperty('--dwm-tilt-y', '0deg');
	}

	/* --- heart particles ------------------------------------------------- */
	function spawnHeart() {
		var id = Date.now() + Math.random();
		var x = Math.round(Math.random() * (HEART_SPREAD * 2) - HEART_SPREAD);
		setHearts(function (current) {
			return current.slice(-4).concat([{ id: id, x: x }]);
		});
		setTimeout(function () {
			setHearts(function (current) {
				return current.filter(function (heart) {
					return heart.id !== id;
				});
			});
		}, HEART_MS);
	}

	/* --- click: greet, toggle the action menu, wake up ------------------- */
	/* Alt + arrow keys move her; Shift makes it a bigger step. */
function onBodyKeyDown(event) {
		if (!event || !event.altKey) return;
		var step = event.shiftKey ? 32 : 8;
		var dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
		var dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
		if (dx === 0 && dy === 0) return;
		var element = bodyRef.current;
		if (!element) return;
		event.preventDefault();
		var rect = element.getBoundingClientRect();
		var next = {
			x: clamp(rect.left + dx, RESIZE_GAP, window.innerWidth - rect.width - RESIZE_GAP),
			y: clamp(rect.top + dy, RESIZE_GAP, window.innerHeight - rect.height - RESIZE_GAP),
		};
		setPos(next);
		writeJSON(KEY_POS, next);
	}

function onRecall() {
		var next = normalizeOptions(Object.assign({}, readOptions(), { hidden: false }));
		writeJSON(KEY_OPTIONS, next);
		if (typeof setOptions === "function") setOptions(next);
		window.dispatchEvent(new CustomEvent(OPTIONS_EVENT));
	}

	/* --- click ------------------------------------------------------------ */
	/* The browser fires this right after `pointerup`, so a drag has already set
	 * `suppressClick`; consume it here (and drop its guard timer) instead of
	 * letting a drag end up toggling the menu. */
	function onClick() {
		if (suppressClick.current) {
			clearClickGuard();
			return;
		}
		restoreSprite();
		stopWalk();
		setMenuOpen(function (open) {
			return !open;
		});
		/* A zone reaction already spoke for this click — do not talk over it. */
		if (dwmNow() - (DWM_RUNTIME.lastZoneAt || 0) > 400) say(pick(options.greetings || text.greeting));
		resetSleep();
		if (stateRef.current === 'sleep') {
			runSequence([
				['wake', 1200],
				['joy', 1200],
			]);
		} else {
			runSequence([['joy', 1500]]);
		}
	}

	/* --- feed a fish ----------------------------------------------------- */
	function onFeed() {
		var next = feeds + 1;
		setFeeds(next);
		writeRaw(KEY_FEEDS, String(next));
		spawnHeart();
		resetSleep();
		stopWalk();
		if (next > 0 && next % 5 === 0) say(text.milestone(next));
		else say(pick(text.feed));
		runSequence([
			['eat', 1300],
			['joy', 1300],
		]);
	}

	/* --- play ------------------------------------------------------------ */
	function onPlay() {
		spawnHeart();
		resetSleep();
		stopWalk();
		say(pick(text.play));
		runSequence([
			['play', 1700],
			['joy', 1100],
		]);
	}

	/* --- release physics (added in 1.5.0) -------------------------------- */
	/* A single discrete nudge in the direction of the last pointer movement,
	 * plus a spring-back rotation — the same shape the reference plugin uses
	 * (no animation loop, no friction): a slow release only squashes. */
	function releasePhysics(drag, base) {
		var speed = Math.hypot(drag.vx || 0, drag.vy || 0);
		/* `dragPhysics: false` means the pet simply stays where it was dropped. */
		if (options.dragPhysics === false) return base;
		if (speed < DRAG_LIGHT_SPEED) {
			squashOnce();
			return base;
		}
		var width = (rootRef.current && rootRef.current.offsetWidth) || 0;
		var stepX = clamp((drag.vx || 0) * DRAG_RELEASE_GAIN, -DRAG_RELEASE_CAP, DRAG_RELEASE_CAP);
		var stepY = clamp((drag.vy || 0) * DRAG_RELEASE_GAIN, -DRAG_RELEASE_CAP, DRAG_RELEASE_CAP);
		var maxX = Math.max(0, window.innerWidth - width);
		var maxY = Math.max(0, window.innerHeight - width);
		var nextX = clamp(base.x + stepX, 0, maxX);
		var nextY = clamp(base.y + stepY, 0, maxY);
		var hitEdge =
			(nextX <= 0 && stepX < 0) || (nextX >= maxX && stepX > 0) ||
			(nextY <= 0 && stepY < 0) || (nextY >= maxY && stepY > 0);
		var angle = hitEdge ? 0 : clamp((drag.vx || 0) * DRAG_TILT_GAIN, -DRAG_TILT_CAP, DRAG_TILT_CAP);
		spinRelease(angle);
		return { x: nextX, y: nextY };
	}

	/* Every pending release timer, so a second fling replaces the first instead
	 * of stacking on top of it — and so unmount can drop them all. */
	function clearReleaseTimers() {
		var timers = releaseTimers.current;
		for (var i = 0; i < timers.length; i += 1) clearTimeout(timers[i]);
		releaseTimers.current = [];
	}

	function spinRelease(angle) {
		var body = bodyRef.current;
		if (!body || reducedMotion.current) return;
		clearReleaseTimers();
		body.style.setProperty('--dwm-drag-angle', angle.toFixed(1) + 'deg');
		body.style.transition = 'transform 420ms cubic-bezier(.2,.9,.3,1)';
		var settle = setTimeout(function () {
			var target = bodyRef.current || body;
			target.style.setProperty('--dwm-drag-angle', '0deg');
			var clear = setTimeout(function () {
				var node = bodyRef.current || body;
				node.style.transition = '';
			}, 480);
			releaseTimers.current.push(clear);
		}, 30);
		releaseTimers.current.push(settle);
	}

	/* A light release only squashes. `squash` (squashState[0]) is the single
	 * writer of `.is-squash`; the class is rendered from it and cleared by the
	 * timer below after SQUASH_MS. */
	function squashOnce() {
		if (reducedMotion.current) return;
		if (squashTimer.current !== undefined) clearTimeout(squashTimer.current);
		setSquash(true);
		squashTimer.current = setTimeout(function () {
			squashTimer.current = undefined;
			setSquash(false);
		}, SQUASH_MS);
	}

	/* --- drag geometry --------------------------------------------------- */
	function dragPosition(drag, clientX, clientY) {
		var width = (rootRef.current && rootRef.current.offsetWidth) || 0;
		return {
			x: clamp(drag.baseX + (clientX - drag.startX), 0, Math.max(0, window.innerWidth - width)),
			y: clamp(drag.baseY + (clientY - drag.startY), 0, Math.max(0, window.innerHeight - width)),
		};
	}

	/* A pose command, a tap or a grab must take the sprite back from a static
	 * portrait: `dwmPortraitShow` hides the `.dwm-3d` layers, so without this the
	 * next ANIM state would play on an invisible body. */
	function restoreSprite() {
		if (typeof dwmHidePose === 'function') dwmHidePose();
	}

	/* Drop a pending "swallow the click" guard (new gesture, or unmount). */
	function clearClickGuard() {
		if (clickGuard.current !== undefined) clearTimeout(clickGuard.current);
		clickGuard.current = undefined;
		suppressClick.current = false;
	}

	function onPointerDown(event) {
		var body = bodyRef.current;
		var root = rootRef.current;
		if (!body || !root) return;
		/* One drag at a time: a second pointer (second finger, a synthetic
		 * pointerdown) must never replace the active drag or steal its capture. */
		if (dragRef.current !== null) return;
		clearClickGuard();
		restoreSprite();
		var rect = root.getBoundingClientRect();
		dragRef.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			baseX: rect.left,
			baseY: rect.top,
			moved: false,
			lastX: event.clientX,
			lastY: event.clientY,
			vx: 0,
			vy: 0,
		};
		try {
			body.setPointerCapture(event.pointerId);
		} catch (error) {
			/* capture is a nicety, not a requirement */
		}
		body.classList.add('is-dragging');
		if (stateRef.current === 'sleep') runSequence([['wake', 1200]]);
		resetSleep();
		stopWalk();
	}

	function onPointerMove(event) {
		var drag = dragRef.current;
		if (drag && event.pointerId === drag.pointerId) {
			if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD) return;
			drag.moved = true;
			for (var i = 0; i < sequenceTimers.current.length; i++) clearTimeout(sequenceTimers.current[i]);
			sequenceTimers.current = [];
			drag.vx = event.clientX - drag.lastX;
			drag.vy = event.clientY - drag.lastY;
			drag.lastX = event.clientX;
			drag.lastY = event.clientY;
			setAnimState('drag');
			setPos(dragPosition(drag, event.clientX, event.clientY));
			return;
		}
		tiltTo(event.clientX, event.clientY);
	}

	function onPointerUp(event) {
		var drag = dragRef.current;
		if (!drag || event.pointerId !== drag.pointerId) return;
		dragRef.current = null;
		/* Every exit path (pointerup, pointercancel, unmount) frees the capture
		 * and the cursor class before anything else can throw. */
		var body = bodyRef.current;
		if (body) {
			body.classList.remove('is-dragging');
			try {
				body.releasePointerCapture(event.pointerId);
			} catch (error) {
				/* already released */
			}
		}
		/* A tap keeps the click; a drag swallows exactly the click the browser is
		 * about to synthesise for this gesture. The guard is a tracked timer, so
		 * a missing click cannot leave the flag stuck on forever. */
		clearClickGuard();
		if (!drag.moved) return;
		suppressClick.current = true;
		clickGuard.current = setTimeout(function () {
			clickGuard.current = undefined;
			suppressClick.current = false;
		}, CLICK_GUARD_MS);
		var released = releasePhysics(drag, dragPosition(drag, event.clientX, event.clientY));
		setPos(released);
		setAnimState('idle');
		resetTilt();
		writeJSON(KEY_POS, released);
	}

	/* --- frame playback -------------------------------------------------- */
	useEffect(
		function () {
			var anim = ANIM[animState] || ANIM.idle;
			var timers = [];
			setFrame(0);
			if (reducedMotion.current) return function () {};
			var step = Math.round(1000 / (anim.fps * options.speed));
			function later(fn, ms) {
				var id = setTimeout(fn, ms);
				timers.push(id);
				return id;
			}
			if (anim.playback === 'blink') {
				var blink = function () {
					later(function () {
						later(function () {
							setFrame(1);
						}, step);
						later(function () {
							setFrame(2);
						}, step * 2);
						later(function () {
							setFrame(0);
							blink();
						}, step * 3);
					}, 2200 + Math.random() * 3800);
				};
				blink();
			} else if (anim.playback === 'once') {
				var cursor = 0;
				var advance = function () {
					setFrame(cursor);
					cursor += 1;
					if (cursor < anim.frames) later(advance, step);
				};
				advance();
			} else if (anim.playback === 'pingpong') {
				var frameIndex = 0;
				var direction = 1;
				var bounce = function () {
					setFrame(frameIndex);
					frameIndex += direction;
					if (frameIndex >= anim.frames) {
						frameIndex = anim.frames - 2;
						direction = -1;
					} else if (frameIndex < 0) {
						frameIndex = 1;
						direction = 1;
					}
					later(bounce, step);
				};
				later(bounce, step);
			} else {
				var tick = function () {
					setFrame(function (current) {
						return (current + 1) % anim.frames;
					});
					later(tick, step);
				};
				later(tick, step);
			}
			return function () {
				for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
			};
		},
		[animState, options.speed],
	);

	/* --- greet once, ever ------------------------------------------------ */
	useEffect(function () {
		if (!options.greeting) return;
		if (readRaw(KEY_GREETED) !== null) return;
		writeRaw(KEY_GREETED, '1');
		var id = setTimeout(function () {
			latest.current.say(text.petGreeting);
			latest.current.runSequence([['welcome', 2600]]);
		}, 800);
		return function () {
			clearTimeout(id);
		};
	}, []);

	/* --- keep the state machine reachable from the mount-only effects ---- */
	latest.current = {
		startWalk: startWalk,
		runSequence: runSequence,
		resetSleep: resetSleep,
		stopWalk: stopWalk,
		say: say,
		/* 1.1.0 — reached by the companion modules through DWM_RUNTIME.api */
		spawnHeart: spawnHeart,
		setState: setAnimState,
	};

	/* --- 1.1.0: bridge for the companion modules -------------------------
	 * The work-status link, the proactive care loop and the hit zones all live
	 * in their own files and need to drive this component from outside it. They
	 * go through `latest.current`, which is refreshed on every render, so the
	 * bridge never holds a stale closure over `options`. */
	useEffect(function () {
		DWM_RUNTIME.api = {
			say: function (message) {
				latest.current.say(message);
			},
			runSequence: function (steps, fallback) {
				latest.current.runSequence(steps, fallback);
			},
			resetSleep: function () {
				latest.current.resetSleep();
			},
			stopWalk: function () {
				latest.current.stopWalk();
			},
			spawnHeart: function () {
				latest.current.spawnHeart();
			},
			setState: function (next) {
				latest.current.setState(next);
			},
			state: function () {
				return stateRef.current;
			},
			root: function () {
				return rootRef.current;
			}
		};
		DWM_RUNTIME.ready = true;
		DWM_RUNTIME.startedAt = dwmNow();

		/* a forced pose: `hold` keeps it until the next command */
		function onForceState(event) {
			var detail = event && event.detail ? event.detail : {};
			var next = typeof detail.state === 'string' ? detail.state : 'idle';
			if (!ANIM[next]) return;
			/* A state command always wins over a static portrait: otherwise the new
			 * frames would play behind the hidden `.dwm-3d` layers. */
			restoreSprite();
			if (detail.hold === true) {
				var timers = sequenceTimers.current;
				for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
				sequenceTimers.current = [];
				latest.current.setState(next);
			} else {
				latest.current.runSequence([[next, Math.max(400, Number(detail.ms) || 1200)]]);
			}
		}
		window.addEventListener(DWM_EVENT_STATE, onForceState);
		if (typeof dwmAttachZones === 'function') dwmAttachZones(rootRef.current);

		return function () {
			window.removeEventListener(DWM_EVENT_STATE, onForceState);
			if (typeof dwmDetachZones === 'function') dwmDetachZones();
			DWM_RUNTIME.ready = false;
			DWM_RUNTIME.api = null;
		};
	}, []);

	/* --- 1.1.0: mirror the live pose for the companion modules ----------- */
	useEffect(function () {
		DWM_RUNTIME.state = animState;
		DWM_RUNTIME.frame = frame;
		DWM_RUNTIME.flip = flip;
	}, [animState, frame, flip]);

	/* --- idle life: think now and then, wander now and then -------------- */
	useEffect(function () {
		latest.current.resetSleep();
		if (reducedMotion.current) return;
		var timers = [];
		function scheduleThink() {
			var id = setTimeout(function () {
				if (stateRef.current === 'idle') latest.current.runSequence([['think', 2600]]);
				scheduleThink();
			}, THINK_MIN_MS + Math.random() * THINK_JITTER_MS);
			timers.push(id);
		}
		function scheduleWalk() {
			var id = setTimeout(function () {
				if (!options.walk) {
					scheduleWalk();
					return;
				}
				if (stateRef.current === 'idle' || stateRef.current === 'think') latest.current.startWalk();
				scheduleWalk();
			}, WALK_INTERVAL_MIN_MS + Math.random() * WALK_INTERVAL_JITTER_MS);
			timers.push(id);
		}
		scheduleThink();
		scheduleWalk();
		return function () {
			for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
			if (sleepTimer.current !== undefined) clearTimeout(sleepTimer.current);
			if (thinkTimer.current !== undefined) clearTimeout(thinkTimer.current);
			latest.current.stopWalk();
		};
	}, []);

	/* --- full cleanup on unmount ----------------------------------------- */
	useEffect(function () {
		return function () {
			if (bubbleTimer.current !== undefined) clearTimeout(bubbleTimer.current);
			for (var i = 0; i < sequenceTimers.current.length; i++) clearTimeout(sequenceTimers.current[i]);
			sequenceTimers.current = [];
			if (sleepTimer.current !== undefined) clearTimeout(sleepTimer.current);
			if (thinkTimer.current !== undefined) clearTimeout(thinkTimer.current);
			if (walkTimer.current !== undefined) clearTimeout(walkTimer.current);
			if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
			/* release physics: drop the spring-back chain and the squash timer so
			 * neither can setState on an unmounted component. */
			clearReleaseTimers();
			if (squashTimer.current !== undefined) {
				clearTimeout(squashTimer.current);
				squashTimer.current = undefined;
			}
			clearClickGuard();
			/* an unmount in the middle of a drag must not leave the pointer capture
			 * (or the grabbing cursor) behind on a node React is about to drop. */
			var body = bodyRef.current;
			var drag = dragRef.current;
			dragRef.current = null;
			if (body) {
				body.classList.remove('is-dragging');
				body.style.setProperty('--dwm-drag-angle', '0deg');
				body.style.transition = '';
				if (drag) {
					try {
						body.releasePointerCapture(drag.pointerId);
					} catch (error) {
						/* already released */
					}
				}
			}
		};
	}, []);

	/* --- keep the pet inside the viewport when the window changes -------- */
	useEffect(function () {
		function reclamp() {
			var size = (rootRef.current && rootRef.current.offsetWidth) || 0;
			if (size === 0) return;
			setPos(function (current) {
				if (!current) return current;
				if (
					current.x >= RESIZE_GAP - size &&
					current.x <= window.innerWidth - RESIZE_GAP &&
					current.y >= RESIZE_GAP - size &&
					current.y <= window.innerHeight - RESIZE_GAP
				) {
					return current;
				}
				var next = {
					x: clamp(current.x, 0, Math.max(0, window.innerWidth - size)),
					y: clamp(current.y, 0, Math.max(0, window.innerHeight - size)),
				};
				if (next.x === current.x && next.y === current.y) return current;
				writeJSON(KEY_POS, next);
				return next;
			});
		}
		reclamp();
		window.addEventListener('resize', reclamp);
		return function () {
			window.removeEventListener('resize', reclamp);
		};
	}, []);

	/* --- close the menu on outside click / Escape ------------------------ */
	useEffect(
		function () {
			if (!menuOpen) return;
			function onOutside(event) {
				if (rootRef.current && !rootRef.current.contains(event.target)) setMenuOpen(false);
			}
			function onKey(event) {
				if (event.key === 'Escape') setMenuOpen(false);
			}
			document.addEventListener('pointerdown', onOutside);
			document.addEventListener('keydown', onKey);
			return function () {
				document.removeEventListener('pointerdown', onOutside);
				document.removeEventListener('keydown', onKey);
			};
		},
		[menuOpen],
	);

	/* --- position ------------------------------------------------------- */
	var style = pos ? { left: pos.x, top: pos.y } : { right: 16, bottom: 16 };
	/* Inline, because the overlay layer's `.overlayLayer > *` rule sets
	   `pointer-events:auto` on every direct child and inline style outranks it. */
	style.pointerEvents = 'none';
	if (options.size !== null) style['--dwm-pet-size'] = options.size + 'px';

	return h(
		'div',
		{
			ref: rootRef,
			className: options.hidden ? 'dwm-root dwm-root-hidden' : 'dwm-root',
			style: style,
			'data-dwm-pet-size': options.size !== null ? String(options.size) : undefined,
			'data-dwm-lang': language,
			'data-dwm-work': workGlow ? '1' : undefined,
		},
		h(
			'div',
			{ className: 'dwm-pop' },
			bubble !== null
				? h(Bubble, {
						key: bubble.id,
						text: bubble.text,
						tone: bubble.tone,
						instant: options.typewriter === false || (reducedMotion.current && options.typewriter !== true),
						speed: options.speed,
					})
				: null,
			menuOpen
				? h(
						'div',
						{ className: 'dwm-menu' },
						h(
							'button',
							{
								type: 'button',
								className: 'dwm-action',
								'aria-label': text.petFeed,
								title: text.petFeed,
								onClick: onFeed,
							},
							h(FishIcon, null),
						),
						h(
							'button',
							{
								type: 'button',
								className: 'dwm-action',
								'aria-label': text.petPlay,
								title: text.petPlay,
								onClick: onPlay,
							},
							h(GamepadIcon, null),
						),
					)
				: null,
		),
		h(
			'button',
			{
				ref: bodyRef,
				onKeyDown: onBodyKeyDown,
				type: 'button',
				className: 'dwm',
				'aria-label': text.petLabel,
				onClick: onClick,
				onPointerDown: onPointerDown,
				onPointerMove: onPointerMove,
				onPointerUp: onPointerUp,
				onPointerCancel: onPointerUp,
				onPointerLeave: resetTilt,
			},
			h(
				'span',
				{ className: 'dwm-flip', style: { transform: 'scaleX(' + flip + ')' } },
				h(
					'span',
					{ className: squash ? 'dwm-3d is-squash' : 'dwm-3d' },
					h(Sprite, { state: animState, frame: frame, layer: 'depth' }),
					h(Sprite, { state: animState, frame: frame }),
					h(Shine, { state: animState, frame: frame }),
				),
			),
		),
		h('div', { className: 'dwm-shadow', 'aria-hidden': 'true' }),
		h('span', { className: 'dwm-bubble-dot', 'aria-hidden': 'true' }),
		h('span', { className: 'dwm-bubble-dot', 'aria-hidden': 'true' }),
		h('span', { className: 'dwm-bubble-dot', 'aria-hidden': 'true' }),
		hearts.map(function (heart) {
			return h(
				'span',
				{
					key: heart.id,
					className: 'dwm-heart',
					style: { left: 'calc(50% + ' + heart.x + 'px)' },
					'aria-hidden': 'true',
				},
				'♥',
			);
		}),
		/* 1.1.0 — companion layers. Both render nothing until they are asked to,
		 * so with every companion switch off the DOM is identical to 1.0.0. */
		options.hidden
			? h(
					'button',
					{
						type: 'button',
						className: 'dwm-recall',
						style: { pointerEvents: 'auto' },
						'aria-label': DWM_RECALL_LABEL[language],
						title: DWM_RECALL_LABEL[language],
						onClick: onRecall,
					},
					'🐋',
				)
			: null,
		h(DwmFxLayer, null),
	);
}
