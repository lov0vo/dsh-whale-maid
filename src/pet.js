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

/* The ten animation states: sheet, frame count, fps and playback mode. */
var ANIM = {
	idle: { sheet: 'idle', frames: 3, fps: 2, playback: 'blink' },
	joy: { sheet: 'joy', frames: 2, fps: 5, playback: 'loop' },
	eat: { sheet: 'eat', frames: 3, fps: 8, playback: 'loop' },
	play: { sheet: 'play', frames: 3, fps: 4, playback: 'loop' },
	welcome: { sheet: 'welcome', frames: 2, fps: 3, playback: 'loop' },
	drag: { sheet: 'drag', frames: 1, fps: 5, playback: 'loop', motion: 'tilt' },
	think: { sheet: 'think', frames: 1, fps: 2, playback: 'loop', motion: 'float' },
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
	walk: true, // wander across the viewport on its own
	bubbleDuration: BUBBLE_MS,
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

function WhaleGirl() {
	var React_ = React;
	var useState = React_.useState;
	var useRef = React_.useRef;
	var useEffect = React_.useEffect;

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
			if (typeof message === 'string' && message !== '') say(message);
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
		window.addEventListener(RESET_POS_EVENT, onResetPos);
		return function () {
			window.removeEventListener(OPTIONS_EVENT, onOptions);
			window.removeEventListener(SAY_EVENT, onSay);
			window.removeEventListener(RESET_POS_EVENT, onResetPos);
		};
	}, []);

	/* --- speech bubble ------------------------------------------------- */
	function say(message) {
		if (bubbleTimer.current !== undefined) clearTimeout(bubbleTimer.current);
		setBubble({ id: Date.now(), text: message });
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
		walkRef.current = null;
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
	function onClick() {
		if (suppressClick.current) {
			suppressClick.current = false;
			return;
		}
		stopWalk();
		setMenuOpen(function (open) {
			return !open;
		});
		say(pick(options.greetings || text.greeting));
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

	/* --- drag geometry --------------------------------------------------- */
	function dragPosition(drag, clientX, clientY) {
		var width = (rootRef.current && rootRef.current.offsetWidth) || 0;
		return {
			x: clamp(drag.baseX + (clientX - drag.startX), 0, Math.max(0, window.innerWidth - width)),
			y: clamp(drag.baseY + (clientY - drag.startY), 0, Math.max(0, window.innerHeight - width)),
		};
	}

	function onPointerDown(event) {
		var body = bodyRef.current;
		var root = rootRef.current;
		if (!body || !root) return;
		var rect = root.getBoundingClientRect();
		dragRef.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			baseX: rect.left,
			baseY: rect.top,
			moved: false,
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
		var body = bodyRef.current;
		if (body) {
			body.classList.remove('is-dragging');
			try {
				body.releasePointerCapture(event.pointerId);
			} catch (error) {
				/* already released */
			}
		}
		suppressClick.current = drag.moved;
		if (drag.moved) {
			setTimeout(function () {
				suppressClick.current = false;
			}, 0);
			var next = dragPosition(drag, event.clientX, event.clientY);
			setPos(next);
			setAnimState('idle');
			resetTilt();
			writeJSON(KEY_POS, next);
		}
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
	};

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
			className: 'dwm-root',
			style: style,
			'data-dwm-pet-size': options.size !== null ? String(options.size) : undefined,
			'data-dwm-lang': language,
		},
		h(
			'div',
			{ className: 'dwm-pop' },
			bubble !== null
				? h('p', { key: bubble.id, className: 'dwm-bubble', role: 'status' }, bubble.text)
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
					{ className: 'dwm-3d' },
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
	);
}
