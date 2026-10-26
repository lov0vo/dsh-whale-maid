/*
 * dsh-whale-maid — scene -> pose map (F, added in 1.7.0).
 *
 * The pet has twelve animation states (`ANIM`) and nineteen portrait poses
 * shipped as `POSES` by build.mjs. This file decides which portrait belongs to
 * which situation, and falls back to an animation state when no portrait fits.
 *
 * Resolution order: exact context key -> prefix match -> fallback state.
 */

/* Every scene we can recognise, with the portrait that represents it. */
var DWM_POSE_RULES = {
	// session lifecycle
	sessionStart: 'greet',
	sessionIdle: 'idle-cute',
	// work
	workThinking: 'thinking',
	workTool: 'workRam',
	workLong: 'workSlack',
	workSuccess: 'success',
	workFailure: 'failure',
	workPat: 'workPat',
	workSlack: 'workSlack',
	// interaction
	patHead: 'teasing',
	patBelly: 'blush',
	patTail: 'wink',
	triple: 'celebrate',
	feed: 'eat',
	play: 'star',
	// mood
	moodLow: 'balanceLow',
	moodHigh: 'star',
	// care
	careLongSit: 'afk',
	careStuck: 'curious',
	careComeBack: 'greet',
	careLateNight: 'night',
	careSatiety: 'balanceLow',
	// weather
	weatherClear: 'coolShades',
	weatherCloudy: 'abstract',
	weatherRain: 'night',
	weatherSnow: 'waiting',
	weatherThunder: 'bold',
	weatherFog: 'curious',
	weatherRainyNight: 'night',
	// festival (portraits pending, falls back to a state)
	festivalSpring: 'celebrate',
	festivalMidAutumn: 'night',
	festivalHalloween: 'bold',
	festivalChristmas: 'welcome',
	valentine: 'blush',
}

/* When a portrait is missing, fall back to an animation state instead. */
var DWM_POSE_FALLBACK = {
	greet: 'welcome',
	'idle-cute': 'idle',
	thinking: 'think',
	'workRam': 'work',
	'workSlack': 'work',
	'workPat': 'work',
	success: 'joy',
	failure: 'sad',
	'balanceLow': 'sad',
	night: 'sleep',
	blush: 'joy',
	'coolShades': 'think',
	abstract: 'think',
	bold: 'think',
	curious: 'think',
	waiting: 'idle',
}

/* Resolve a context key (or a prefix of one) to a portrait name. */
function dwmPoseName(context) {
	if (typeof context !== 'string' || context === '') return 'idle-cute';
	if (Object.prototype.hasOwnProperty.call(DWM_POSE_RULES, context)) return DWM_POSE_RULES[context];
	for (var key in DWM_POSE_RULES) {
		if (!Object.prototype.hasOwnProperty.call(DWM_POSE_RULES, key)) continue;
		if (context.indexOf(key) === 0) return DWM_POSE_RULES[key];
	}
	return 'idle-cute';
}

/* The data URL for a portrait, or null when that portrait is not shipped. */
function dwmPoseImage(pose) {
	if (typeof POSES !== 'object' || POSES === null) return null;
	return Object.prototype.hasOwnProperty.call(POSES, pose) ? POSES[pose] : null;
}

/* Which animation state to play when a portrait has no art yet. */
function dwmPoseFallbackState(pose) {
	return Object.prototype.hasOwnProperty.call(DWM_POSE_FALLBACK, pose) ? DWM_POSE_FALLBACK[pose] : 'idle';
}

/* Everything a caller needs: portrait when available, state otherwise. */
function dwmPoseFor(context) {
	var pose = dwmPoseName(context);
	var image = dwmPoseImage(pose);
	return {
		context: context,
		pose: pose,
		image: image,
		state: image ? null : dwmPoseFallbackState(pose),
	};
}

/* Names of every portrait that actually made it into the bundle. */
function dwmPoseList() {
	if (typeof POSES !== 'object' || POSES === null) return [];
	var names = [];
	for (var name in POSES) {
		if (Object.prototype.hasOwnProperty.call(POSES, name)) names.push(name);
	}
	return names.sort();
}
