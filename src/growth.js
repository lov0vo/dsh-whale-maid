/*
 * dsh-whale-maid — growth, quests, sign-in and achievements (added in 1.1.0).
 *
 * The pet keeps a small, purely local save: mood / affinity / satiety / level,
 * companionship time, a daily quest board, a weekly sign-in board, achievements
 * and a short diary. Nothing leaves the machine and nothing is timed against a
 * server — all day/week boundaries are computed from the local clock.
 *
 * Storage is one extra key (`dsh-whale-maid:growth`); the original keys for
 * position / feeds / options / greeted are untouched.
 *
 * Achievement ids and quest ids are written into the save file, so they are
 * append-only: rename one and existing saves lose that entry.
 */

var KEY_GROWTH = 'dsh-whale-maid:growth';

var DWM_GROWTH_RULES = {
	moodMax: 100,
	affinityMax: 10000,
	satietyMax: 100,
	levelStep: 500,
	satietyDecayPerMin: 0.15,
	moodDriftPerMin: 0.35,
	moodTarget: 55,
	satietyLow: 25,
	companionCapMs: 120000
};

var DWM_QUEST_REWARD_ALL = { affinity: 20, mood: 5 };

function dwmDefaultCounts() {
	return {
		pat: 0,
		feed: 0,
		play: 0,
		click: 0,
		triple: 0,
		tools: 0,
		code: 0,
		success: 0,
		failure: 0,
		messages: 0,
		keywords: 0,
		walks: 0,
		sleeps: 0,
		chat: 0,
		quests: 0,
		signin: 0
	};
}

function dwmDefaultGrowth() {
	return {
		mood: 70,
		affinity: 0,
		satiety: 80,
		level: 1,
		firstSeenAt: 0,
		lastSeenAt: 0,
		lastTickAt: 0,
		companionshipMs: 0,
		lastSignin: '',
		signinStreak: 0,
		signinWeek: '',
		signinDays: [],
		counts: dwmDefaultCounts(),
		achievements: [],
		quests: { day: '', slots: [], base: null },
		diary: [],
		flags: {}
	};
}

function dwmNormalizeGrowth(raw) {
	var base = dwmDefaultGrowth();
	var source = raw && typeof raw === 'object' ? raw : {};
	var out = base;
	var key;
	for (key in base) {
		if (!Object.prototype.hasOwnProperty.call(base, key)) continue;
		if (source[key] === undefined || source[key] === null) continue;
		out[key] = source[key];
	}
	out.mood = dwmClamp(Number(out.mood), 0, DWM_GROWTH_RULES.moodMax);
	out.affinity = dwmClamp(Number(out.affinity), 0, DWM_GROWTH_RULES.affinityMax);
	out.satiety = dwmClamp(Number(out.satiety), 0, DWM_GROWTH_RULES.satietyMax);
	out.level = Math.max(1, Math.floor(Number(out.level) || 1));
	out.companionshipMs = Math.max(0, Number(out.companionshipMs) || 0);
	out.signinStreak = Math.max(0, Math.floor(Number(out.signinStreak) || 0));

	var defaults = dwmDefaultCounts();
	var counts = {};
	for (key in defaults) {
		if (!Object.prototype.hasOwnProperty.call(defaults, key)) continue;
		counts[key] = Math.max(0, Math.floor(Number(out.counts && out.counts[key]) || 0));
	}
	out.counts = counts;

	if (!Array.isArray(out.achievements)) out.achievements = [];
	if (!Array.isArray(out.signinDays)) out.signinDays = [];
	if (!Array.isArray(out.diary)) out.diary = [];
	if (!out.flags || typeof out.flags !== 'object') out.flags = {};
	if (!out.quests || typeof out.quests !== 'object') out.quests = { day: '', slots: [], base: null };
	if (!Array.isArray(out.quests.slots)) out.quests.slots = [];
	return out;
}

function dwmLevelFor(affinity) {
	var step = DWM_GROWTH_RULES.levelStep;
	return dwmClamp(Math.floor(Number(affinity) / step) + 1, 1, 99);
}

function dwmGrowthRead() {
	return dwmNormalizeGrowth(readJSON(KEY_GROWTH));
}

function dwmGrowthWrite(growth) {
	writeJSON(KEY_GROWTH, growth);
	dwmEmitGrowth();
	return growth;
}

function dwmGrowthDiary(growth, zh, en, kind) {
	growth.diary.push({ at: dwmNow(), zh: zh, en: en, kind: kind || 'info' });
	while (growth.diary.length > 12) growth.diary.shift();
}

/* --- achievements ------------------------------------------------------ */

var DWM_ACHIEVEMENTS = [
	{ id: 'pat-1', icon: '🫳', zh: '初次摸头', en: 'First Pat', test: function (g) { return g.counts.pat >= 1; } },
	{ id: 'pat-10', icon: '🖐️', zh: '摸头十连', en: 'Ten Pats', test: function (g) { return g.counts.pat >= 10; } },
	{ id: 'pat-50', icon: '💯', zh: '摸头五十连', en: 'Fifty Pats', test: function (g) { return g.counts.pat >= 50; } },
	{ id: 'feed-1', icon: '🐟', zh: '投喂成功', en: 'First Feed', test: function (g) { return g.counts.feed >= 1; } },
	{ id: 'feed-20', icon: '🍱', zh: '投喂二十次', en: 'Fed Twenty Times', test: function (g) { return g.counts.feed >= 20; } },
	{ id: 'play-1', icon: '🎮', zh: '一起玩', en: 'Play Time', test: function (g) { return g.counts.play >= 1; } },
	{ id: 'play-20', icon: '🪀', zh: '玩伴', en: 'Playmate', test: function (g) { return g.counts.play >= 20; } },
	{ id: 'triple-1', icon: '🎉', zh: '三连击', en: 'Triple Tap', test: function (g) { return g.counts.triple >= 1; } },
	{ id: 'click-100', icon: '👆', zh: '点了一百下', en: 'A Hundred Taps', test: function (g) { return g.counts.click >= 100; } },
	{ id: 'tool-1', icon: '🛠️', zh: '开工啦', en: 'Work Started', test: function (g) { return g.counts.tools >= 1; } },
	{ id: 'tool-10', icon: '🔧', zh: '工具十连', en: 'Ten Tool Runs', test: function (g) { return g.counts.tools >= 10; } },
	{ id: 'tool-50', icon: '🏭', zh: '工具五十连', en: 'Fifty Tool Runs', test: function (g) { return g.counts.tools >= 50; } },
	{ id: 'code-1', icon: '💻', zh: '代码初体验', en: 'First Code Block', test: function (g) { return g.counts.code >= 1; } },
	{ id: 'code-20', icon: '📟', zh: '代码狂人', en: 'Code Fiend', test: function (g) { return g.counts.code >= 20; } },
	{ id: 'success-1', icon: '✅', zh: '旗开得胜', en: 'First Success', test: function (g) { return g.counts.success >= 1; } },
	{ id: 'success-10', icon: '🏆', zh: '任务十连', en: 'Ten Successes', test: function (g) { return g.counts.success >= 10; } },
	{ id: 'failure-1', icon: '🩹', zh: '初次翻车', en: 'First Crash', test: function (g) { return g.counts.failure >= 1; } },
	{ id: 'failure-10', icon: '🚑', zh: '翻车十连', en: 'Ten Crashes', test: function (g) { return g.counts.failure >= 10; } },
	{ id: 'night-1', icon: '🌙', zh: '深夜陪伴', en: 'Night Companion', test: function (g) { return g.flags.nightOwl === true; } },
	{ id: 'comeback-1', icon: '👋', zh: '欢迎回来', en: 'Welcome Back', test: function (g) { return g.flags.comeBack === true; } },
	{ id: 'day-1', icon: '💞', zh: '一日之缘', en: 'One Day Together', test: function (g) { return g.companionshipMs >= 86400000; } },
	{ id: 'day-7', icon: '💎', zh: '一周相伴', en: 'A Week Together', test: function (g) { return g.companionshipMs >= 7 * 86400000; } },
	{ id: 'day-30', icon: '🏛️', zh: '三十日契约', en: 'Thirty Day Pact', test: function (g) { return g.companionshipMs >= 30 * 86400000; } },
	{ id: 'day-100', icon: '🌊', zh: '百日之约', en: 'Hundred Day Promise', test: function (g) { return g.companionshipMs >= 100 * 86400000; } },
	{ id: 'lv-5', icon: '⭐', zh: '五级', en: 'Level Five', test: function (g) { return g.level >= 5; } },
	{ id: 'lv-10', icon: '👑', zh: '十级', en: 'Level Ten', test: function (g) { return g.level >= 10; } },
	{ id: 'quest-first', icon: '🎯', zh: '任务初体验', en: 'First Quest', test: function (g) { return g.counts.quests >= 1; } },
	{ id: 'quest-all', icon: '🎟️', zh: '一日全勤', en: 'Full House', test: function (g) { return g.flags.questAll === true; } },
	{ id: 'signin-3', icon: '📅', zh: '常客', en: 'Regular', test: function (g) { return g.signinStreak >= 3; } },
	{ id: 'signin-7', icon: '🗓️', zh: '一周之约', en: 'Weekly Promise', test: function (g) { return g.signinStreak >= 7; } },
	{ id: 'signin-board', icon: '🏅', zh: '周常满勤', en: 'Board Full', test: function (g) { return g.flags.signinBoard === true; } },
	{ id: 'chat-10', icon: '💬', zh: '聊了十次', en: 'Ten Chats', test: function (g) { return g.counts.chat >= 10; } },
	{ id: 'chat-100', icon: '📖', zh: '无话不谈', en: 'Long Talks', test: function (g) { return g.counts.chat >= 100; } },
	{ id: 'keyword-5', icon: '🎭', zh: '懂梗的人', en: 'Gets The Joke', test: function (g) { return g.counts.keywords >= 5; } },
	{ id: 'keyword-50', icon: '🃏', zh: '梗王', en: 'Meme Lord', test: function (g) { return g.counts.keywords >= 50; } },
	{ id: 'walk-10', icon: '🐾', zh: '一起散步', en: 'Ten Strolls', test: function (g) { return g.counts.walks >= 10; } },
	{ id: 'sleep-10', icon: '😴', zh: '睡美人', en: 'Sound Sleeper', test: function (g) { return g.counts.sleeps >= 10; } },
	{ id: 'msg-100', icon: '✉️', zh: '百条消息', en: 'A Hundred Messages', test: function (g) { return g.counts.messages >= 100; } },
	{ id: 'tool-200', icon: '🏗️', zh: '工具两百连', en: 'Two Hundred Tool Runs', test: function (g) { return g.counts.tools >= 200; } },
	{ id: 'lv-20', icon: '🌟', zh: '二十级', en: 'Level Twenty', test: function (g) { return g.level >= 20; } },
	{ id: 'signin-30', icon: '🏵️', zh: '一月之约', en: 'A Month Together', test: function (g) { return g.signinStreak >= 30; } }
];

function dwmAchievementById(id) {
	for (var i = 0; i < DWM_ACHIEVEMENTS.length; i++) {
		if (DWM_ACHIEVEMENTS[i].id === id) return DWM_ACHIEVEMENTS[i];
	}
	return null;
}

/** Unlock everything whose condition now holds; returns the new ids. */
function dwmUnlockAchievements(growth) {
	var unlocked = [];
	for (var i = 0; i < DWM_ACHIEVEMENTS.length; i++) {
		var entry = DWM_ACHIEVEMENTS[i];
		if (growth.achievements.indexOf(entry.id) !== -1) continue;
		var hit = false;
		try {
			hit = entry.test(growth) === true;
		} catch (error) {
			hit = false;
		}
		if (!hit) continue;
		growth.achievements.push(entry.id);
		unlocked.push(entry);
	}
	return unlocked;
}

/* --- daily quests ------------------------------------------------------ */

var DWM_QUEST_POOL = [
	{ id: 'pat-5', metric: 'pat', target: 5, zh: '摸她 5 次头', en: 'Pat her head 5 times', affinity: 8, mood: 2 },
	{ id: 'feed-1', metric: 'feed', target: 1, zh: '投喂 1 条小鱼干', en: 'Feed her one fish', affinity: 8, mood: 2 },
	{ id: 'play-1', metric: 'play', target: 1, zh: '陪她玩 1 次', en: 'Play with her once', affinity: 8, mood: 2 },
	{ id: 'tools-3', metric: 'tools', target: 3, zh: '看她工作 3 次', en: 'Watch her work 3 times', affinity: 8, mood: 2 },
	{ id: 'click-10', metric: 'click', target: 10, zh: '点她 10 次', en: 'Tap her 10 times', affinity: 8, mood: 2 },
	{ id: 'triple-1', metric: 'triple', target: 1, zh: '触发 1 次三连击', en: 'Trigger one triple tap', affinity: 10, mood: 3 },
	{ id: 'success-2', metric: 'success', target: 2, zh: '见证 2 次任务完成', en: 'See two task successes', affinity: 10, mood: 3 },
	{ id: 'keyword-2', metric: 'keywords', target: 2, zh: '命中 2 次关键词', en: 'Hit two keyword reactions', affinity: 8, mood: 2 },
	{ id: 'walk-1', metric: 'walks', target: 1, zh: '让她散步 1 次', en: 'Let her wander once', affinity: 6, mood: 2 },
	{ id: 'chat-1', metric: 'chat', target: 1, zh: '和她闲聊 1 次', en: 'Have one small talk', affinity: 6, mood: 2 }
];

/** Three deterministic quests per local day (same day => same board). */
function dwmQuestSlotsFor(day) {
	var rng = dwmSeededRandom('quests:' + day);
	var shuffled = dwmShuffle(DWM_QUEST_POOL, rng);
	var slots = [];
	for (var i = 0; i < 3 && i < shuffled.length; i++) {
		slots.push({ id: shuffled[i].id, claimed: false });
	}
	return slots;
}

function dwmQuestById(id) {
	for (var i = 0; i < DWM_QUEST_POOL.length; i++) {
		if (DWM_QUEST_POOL[i].id === id) return DWM_QUEST_POOL[i];
	}
	return null;
}

/** Roll the quest board over when the local day changes. */
function dwmEnsureQuests(growth, at) {
	var day = dwmDayKey(at);
	if (growth.quests.day === day && growth.quests.slots.length > 0) return growth;
	growth.quests = { day: day, slots: dwmQuestSlotsFor(day), base: JSON.parse(JSON.stringify(growth.counts)) };
	return growth;
}

function dwmQuestProgress(growth, quest) {
	if (!growth.quests.base) return 0;
	var now = Number(growth.counts[quest.metric]) || 0;
	var base = Number(growth.quests.base[quest.metric]) || 0;
	return Math.max(0, now - base);
}

/* --- sign-in board ----------------------------------------------------- */

function dwmEnsureSigninWeek(growth, at) {
	var week = dwmWeekKey(at);
	if (growth.signinWeek === week) return growth;
	growth.signinWeek = week;
	growth.signinDays = [];
	return growth;
}

/* --- ticks ------------------------------------------------------------- */

/** Decay / drift since the last tick. Safe to call often. */
function dwmGrowthTick(at) {
	var now = typeof at === 'number' ? at : dwmNow();
	var growth = dwmGrowthRead();
	if (!growth.firstSeenAt) growth.firstSeenAt = now;
	var last = growth.lastTickAt || now;
	var minutes = (now - last) / 60000;
	if (minutes > 0.01) {
		if (minutes > 60 * 24 * 7) minutes = 60 * 24 * 7;
		growth.satiety = dwmClamp(growth.satiety - DWM_GROWTH_RULES.satietyDecayPerMin * minutes, 0, DWM_GROWTH_RULES.satietyMax);
		if (growth.satiety < DWM_GROWTH_RULES.satietyLow) {
			growth.mood = dwmClamp(growth.mood - DWM_GROWTH_RULES.moodDriftPerMin * 0.6 * minutes, 0, DWM_GROWTH_RULES.moodMax);
		} else if (growth.mood < DWM_GROWTH_RULES.moodTarget) {
			growth.mood = dwmClamp(growth.mood + DWM_GROWTH_RULES.moodDriftPerMin * minutes, 0, DWM_GROWTH_RULES.moodMax);
		}
	}
	growth.lastTickAt = now;
	dwmEnsureQuests(growth, now);
	dwmEnsureSigninWeek(growth, now);
	return dwmGrowthWrite(growth);
}

/** Accumulate companionship while the window is visible. */
function dwmGrowthHeartbeat(at) {
	var now = typeof at === 'number' ? at : dwmNow();
	var growth = dwmGrowthRead();
	var delta = growth.lastSeenAt ? now - growth.lastSeenAt : 0;
	if (delta > 0 && delta < DWM_GROWTH_RULES.companionCapMs) {
		growth.companionshipMs += delta;
	}
	growth.lastSeenAt = now;
	if (!growth.firstSeenAt) growth.firstSeenAt = now;
	return dwmGrowthWrite(growth);
}

/* --- the one entry point every feature calls --------------------------- */

var DWM_GROWTH_DELTAS = {
	'pat-head': { mood: 2, affinity: 2, count: 'pat' },
	'pat-belly': { mood: 3, affinity: 2, count: 'pat' },
	'pat-tail': { mood: 2, affinity: 3, count: 'pat' },
	triple: { mood: 10, affinity: 10, count: 'triple' },
	click: { mood: 1, affinity: 1, count: 'click' },
	feed: { mood: 4, affinity: 3, satiety: 12, count: 'feed' },
	play: { mood: 5, affinity: 3, satiety: -4, count: 'play' },
	'tool-seen': { mood: 1, affinity: 1, count: 'tools' },
	'code-seen': { mood: 0, affinity: 1, count: 'code' },
	success: { mood: 4, affinity: 3, count: 'success' },
	failure: { mood: -3, affinity: 1, count: 'failure' },
	keyword: { mood: 2, affinity: 2, count: 'keywords' },
	walk: { mood: 1, affinity: 1, count: 'walks' },
	chat: { mood: 1, affinity: 1, count: 'chat' }
};

/**
 * Apply one growth event.
 * type: a key of DWM_GROWTH_DELTAS, or 'quest' / 'quest-all' / 'signin' / 'sleep'.
 * Returns { growth, unlocks, leveledUp }.
 */
function dwmGrowthApply(type, payload) {
	var now = dwmNow();
	var growth = dwmGrowthRead();
	if (!growth.firstSeenAt) growth.firstSeenAt = now;
	growth.lastSeenAt = now;
	dwmEnsureQuests(growth, now);
	dwmEnsureSigninWeek(growth, now);

	var delta = DWM_GROWTH_DELTAS[type] || null;
	if (delta) {
		if (delta.mood) growth.mood = dwmClamp(growth.mood + delta.mood, 0, DWM_GROWTH_RULES.moodMax);
		if (delta.affinity) growth.affinity = dwmClamp(growth.affinity + delta.affinity, 0, DWM_GROWTH_RULES.affinityMax);
		if (delta.satiety) growth.satiety = dwmClamp(growth.satiety + delta.satiety, 0, DWM_GROWTH_RULES.satietyMax);
		if (delta.count) growth.counts[delta.count] = (Number(growth.counts[delta.count]) || 0) + 1;
	} else if (type === 'quest') {
		growth.affinity = dwmClamp(growth.affinity + 8, 0, DWM_GROWTH_RULES.affinityMax);
		growth.mood = dwmClamp(growth.mood + 2, 0, DWM_GROWTH_RULES.moodMax);
		growth.counts.quests += 1;
	} else if (type === 'quest-all') {
		growth.affinity = dwmClamp(growth.affinity + DWM_QUEST_REWARD_ALL.affinity, 0, DWM_GROWTH_RULES.affinityMax);
		growth.mood = dwmClamp(growth.mood + DWM_QUEST_REWARD_ALL.mood, 0, DWM_GROWTH_RULES.moodMax);
		growth.flags.questAll = true;
	} else if (type === 'signin') {
		growth.affinity = dwmClamp(growth.affinity + 5, 0, DWM_GROWTH_RULES.affinityMax);
		growth.mood = dwmClamp(growth.mood + 3, 0, DWM_GROWTH_RULES.moodMax);
		growth.counts.signin += 1;
	} else if (type === 'sleep') {
		growth.counts.sleeps += 1;
	}

	if (type === 'pat-head' || type === 'pat-belly' || type === 'pat-tail') {
		if (dwmIsLateNight(now)) growth.flags.nightOwl = true;
	}
	if (payload && payload.awayMs && payload.awayMs > 2 * 3600000) growth.flags.comeBack = true;

	var previousLevel = growth.level;
	growth.level = dwmLevelFor(growth.affinity);
	var leveledUp = growth.level > previousLevel;
	if (leveledUp) {
		dwmGrowthDiary(
			growth,
			'羁绊升到 Lv' + growth.level + '（' + dwmBondTitle(growth.level, 'zh') + '）',
			'Bond reached Lv' + growth.level + ' (' + dwmBondTitle(growth.level, 'en') + ')',
			'level'
		);
	}

	var unlocks = dwmUnlockAchievements(growth);
	for (var i = 0; i < unlocks.length; i++) {
		dwmGrowthDiary(growth, '解锁成就「' + unlocks[i].zh + '」', 'Achievement unlocked: ' + unlocks[i].en, 'achievement');
	}

	dwmGrowthWrite(growth);
	return { growth: growth, unlocks: unlocks, leveledUp: leveledUp };
}

/* --- sign in ----------------------------------------------------------- */

function dwmGrowthSignin(at) {
	var now = typeof at === 'number' ? at : dwmNow();
	var day = dwmDayKey(now);
	var growth = dwmGrowthRead();
	dwmEnsureSigninWeek(growth, now);
	if (growth.lastSignin === day) return null;
	var yesterday = dwmDayKey(now - 86400000);
	growth.signinStreak = growth.lastSignin === yesterday ? growth.signinStreak + 1 : 1;
	growth.lastSignin = day;
	if (growth.signinDays.indexOf(day) === -1) growth.signinDays.push(day);
	growth.affinity = dwmClamp(growth.affinity + 5, 0, DWM_GROWTH_RULES.affinityMax);
	growth.mood = dwmClamp(growth.mood + 3, 0, DWM_GROWTH_RULES.moodMax);
	growth.counts.signin += 1;
	dwmGrowthDiary(growth, '签到成功（连续 ' + growth.signinStreak + ' 天）', 'Checked in (streak ' + growth.signinStreak + ')', 'signin');

	if (growth.signinDays.length >= 7 && growth.flags.signinBoard !== true) {
		growth.flags.signinBoard = true;
		growth.affinity = dwmClamp(growth.affinity + 40, 0, DWM_GROWTH_RULES.affinityMax);
		dwmGrowthDiary(growth, '本周签到板集满 7 格！', 'The weekly board is full!', 'signin');
	} else if (growth.signinDays.length === 3) {
		growth.affinity = dwmClamp(growth.affinity + 15, 0, DWM_GROWTH_RULES.affinityMax);
		dwmGrowthDiary(growth, '连续签到 3 天，好感 +15', 'Three-day streak, affinity +15', 'signin');
	}

	growth.level = dwmLevelFor(growth.affinity);
	var unlocks = dwmUnlockAchievements(growth);
	for (var i = 0; i < unlocks.length; i++) {
		dwmGrowthDiary(growth, '解锁成就「' + unlocks[i].zh + '」', 'Achievement unlocked: ' + unlocks[i].en, 'achievement');
	}
	dwmGrowthWrite(growth);
	return { growth: growth, unlocks: unlocks };
}

/* --- quests ------------------------------------------------------------ */

function dwmGrowthClaimQuest(index) {
	var now = dwmNow();
	var growth = dwmGrowthRead();
	dwmEnsureQuests(growth, now);
	var slot = growth.quests.slots[index];
	if (!slot || slot.claimed) return null;
	var quest = dwmQuestById(slot.id);
	if (!quest) return null;
	if (dwmQuestProgress(growth, quest) < quest.target) return null;
	slot.claimed = true;
	growth.affinity = dwmClamp(growth.affinity + quest.affinity, 0, DWM_GROWTH_RULES.affinityMax);
	growth.mood = dwmClamp(growth.mood + quest.mood, 0, DWM_GROWTH_RULES.moodMax);
	growth.counts.quests += 1;
	dwmGrowthDiary(growth, '完成任务「' + quest.zh + '」', 'Quest done: ' + quest.en, 'quest');
	var allClaimed = true;
	for (var i = 0; i < growth.quests.slots.length; i++) {
		if (!growth.quests.slots[i].claimed) allClaimed = false;
	}
	var bonus = false;
	if (allClaimed && growth.flags['questAll:' + growth.quests.day] !== true) {
		growth.flags['questAll:' + growth.quests.day] = true;
		growth.affinity = dwmClamp(growth.affinity + DWM_QUEST_REWARD_ALL.affinity, 0, DWM_GROWTH_RULES.affinityMax);
		growth.mood = dwmClamp(growth.mood + DWM_QUEST_REWARD_ALL.mood, 0, DWM_GROWTH_RULES.moodMax);
		growth.flags.questAll = true;
		bonus = true;
		dwmGrowthDiary(growth, '今日三个任务全部领取，好感 +20', 'All three quests claimed, affinity +20', 'quest');
	}
	growth.level = dwmLevelFor(growth.affinity);
	var unlocks = dwmUnlockAchievements(growth);
	for (var u = 0; u < unlocks.length; u++) {
		dwmGrowthDiary(growth, '解锁成就「' + unlocks[u].zh + '」', 'Achievement unlocked: ' + unlocks[u].en, 'achievement');
	}
	dwmGrowthWrite(growth);
	return { quest: quest, bonus: bonus, growth: growth, unlocks: unlocks };
}

/* --- read-only snapshot for the panel ---------------------------------- */

/* --- bond titles ---------------------------------------------------------
 * One title per level band, so the panel can show a word instead of a number.
 * Levels are unbounded (1..99), so the table clamps at both ends. */

var DWM_BOND_TITLES = [
	{ zh: '初次见面', en: 'Just met' },
	{ zh: '有点眼熟', en: 'Familiar' },
	{ zh: '常来的客人', en: 'Regular guest' },
	{ zh: '朋友', en: 'Friend' },
	{ zh: '亲近的人', en: 'Close one' },
	{ zh: '信赖的女仆', en: 'Trusted maid' },
	{ zh: '默契搭档', en: 'In sync' },
	{ zh: '深深的羁绊', en: 'Deeply bonded' },
	{ zh: '一起同行', en: 'Side by side' },
	{ zh: '不可或缺', en: 'Irreplaceable' },
	{ zh: '像家人一样', en: 'Like family' }
];

function dwmBondTitle(level, language) {
	var index = dwmClamp(Math.floor(Number(level) || 1) - 1, 0, DWM_BOND_TITLES.length - 1);
	var entry = DWM_BOND_TITLES[index];
	return language === 'en' ? entry.en : entry.zh;
}

function dwmGrowthSnapshot(at) {
	var now = typeof at === 'number' ? at : dwmNow();
	var growth = dwmGrowthRead();
	dwmEnsureQuests(growth, now);
	dwmEnsureSigninWeek(growth, now);
	var quests = [];
	for (var i = 0; i < growth.quests.slots.length; i++) {
		var slot = growth.quests.slots[i];
		var quest = dwmQuestById(slot.id);
		if (!quest) continue;
		quests.push({
			index: i,
			id: quest.id,
			zh: quest.zh,
			en: quest.en,
			target: quest.target,
			progress: Math.min(dwmQuestProgress(growth, quest), quest.target),
			claimed: slot.claimed === true,
			ready: slot.claimed !== true && dwmQuestProgress(growth, quest) >= quest.target,
			affinity: quest.affinity,
			mood: quest.mood
		});
	}
	var achievements = [];
	for (var a = 0; a < DWM_ACHIEVEMENTS.length; a++) {
		var entry = DWM_ACHIEVEMENTS[a];
		achievements.push({
			id: entry.id,
			icon: entry.icon,
			zh: entry.zh,
			en: entry.en,
			unlocked: growth.achievements.indexOf(entry.id) !== -1
		});
	}
	return {
		growth: growth,
		level: growth.level,
		bondZh: dwmBondTitle(growth.level, 'zh'),
		bondEn: dwmBondTitle(growth.level, 'en'),
		quests: quests,
		achievements: achievements,
		unlockedCount: growth.achievements.length,
		totalCount: DWM_ACHIEVEMENTS.length,
		signinDays: growth.signinDays.slice(),
		diary: growth.diary.slice().reverse(),
		satiety: growth.satiety,
		mood: growth.mood,
		affinity: growth.affinity,
		companionshipMs: growth.companionshipMs,
		signinStreak: growth.signinStreak,
		counts: growth.counts
	};
}

/** Wipe only the growth save (the original forget() is untouched). */
function dwmGrowthReset() {
	try {
		window.localStorage.removeItem(KEY_GROWTH);
	} catch (error) {
		/* ignore */
	}
	dwmEmitGrowth();
}
