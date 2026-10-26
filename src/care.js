/*
 * dsh-whale-maid — proactive care and small talk (added in 1.1.0).
 *
 * The store pet only ever spoke when clicked. This module gives her a sense of
 * time and of your work: she notices a long unbroken session, a stuck step, a
 * late night, an empty stomach, or that you were away for a while, and she keeps
 * a slow stream of small talk going while the conversation is idle.
 *
 * Everything is throttled and can be switched off per feature from the settings
 * panel. All timings are generous on purpose: a desktop pet that talks every
 * minute is a bug, not a feature.
 *
 * 1.8.0: two additions that both serve "care should not get lost in the noise".
 *
 *   - Care and milestone lines speak with priority 'important' (see
 *     `dwmSpeak`), so a routine work-status line can no longer talk over the
 *     one line that actually asks the user to stop working.
 *   - Every care moment now asks `src/pose-map.js` for its pose. When a
 *     portrait is shipped it is shown; when none is, the previous behaviour is
 *     kept exactly (`careComeBack` still plays `welcome`).
 */

var DWM_CARE = {
	heartbeat: undefined,
	idleChat: undefined,
	workSpeech: undefined,
	lastNightAt: 0,
	lastLongSitAt: 0,
	lastStuckAt: 0,
	lastHungryAt: 0,
	lastText: '',
	lastTextAt: 0,
	lastReactAt: 0,
	topic: 'general',
	signinDone: false,
	/** pending "put the work pose back" timer after a care pose */
	poseRestore: undefined
};

var DWM_CARE_RULES = {
	heartbeatMs: 30000,
	awayMs: 3 * 60000,
	longSitMs: 25 * 60000,
	longSitGapMs: 30 * 60000,
	stuckMs: 8 * 60000,
	stuckGapMs: 15 * 60000,
	hungryGapMs: 2 * 3600000,
	careGapMs: 15 * 60000,
	idleChatMinMs: 5 * 60000,
	idleChatJitterMs: 3 * 60000,
	workChattyMinMs: 15000,
	workChattyJitterMs: 25000,
	workQuietMinMs: 90000,
	workQuietJitterMs: 150000,
	speakGapMs: 12000,
	textReactGapMs: 20000
};

function dwmCareCanSpeak() {
	if (!DWM_RUNTIME.ready) return false;
	if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
	return dwmNow() - DWM_RUNTIME.lastSayAt > DWM_CARE_RULES.speakGapMs;
}

/**
 * Show the pose for a care moment.
 *
 * When the pose map names an animation state, that is an explicit instruction
 * and `dwmShowPose` handles it. When it names only a portrait, the portrait is
 * painted and a failed paint stays invisible on purpose: most care moments never
 * changed her animation before 1.8.0, and forcing a fallback state here would
 * clobber whatever she is legitimately doing — `careLongSit` fires *during* a
 * running turn, where the work pose must survive.
 */
function dwmCarePose(context, ms) {
	if (typeof dwmPoseFor !== 'function') return false;
	var pose = null;
	try {
		pose = dwmPoseFor(context);
	} catch (error) {
		return false;
	}
	if (!pose) return false;
	if (pose.state) {
		var shown = dwmShowPose(pose, ms);
		/*
		 * A care pose is a moment, but the work pose lasts a turn: without this
		 * the pet would finish her worried 3 s and then sit in `idle` for the rest
		 * of a long session, because the work pose is only repainted on a phase
		 * change. Put the turn's pose back when the care moment is over.
		 */
		if (shown && DWM_RUNTIME.work.active) {
			if (DWM_CARE.poseRestore !== undefined) clearTimeout(DWM_CARE.poseRestore);
			DWM_CARE.poseRestore = setTimeout(function () {
				DWM_CARE.poseRestore = undefined;
				if (!DWM_RUNTIME.work.active) return;
				if (typeof dwmApplyWorkPose === 'function') dwmApplyWorkPose(DWM_RUNTIME.work.phase);
			}, (Number(ms) > 0 ? Number(ms) : 2000) + 100);
		}
		return shown;
	}
	if (!pose.image) return false;
	return dwmPortraitShow(pose, ms);
}

function dwmCareMoodLine(language) {
	var growth = dwmGrowthRead();
	var tier = dwmMoodTier(growth.mood);
	if (tier === 2) return '';
	return dwmPickLine(dwmMoodBank(growth.mood), language);
}

/** Read the newest chat node's text, if the client exposes one. */
function dwmReadChatText() {
	var selectors = ['[data-slot="conversation.chat.node"]', '[data-role="user"]', '[data-message-role="user"]'];
	for (var i = 0; i < selectors.length; i++) {
		var nodes = null;
		try {
			nodes = document.querySelectorAll(selectors[i]);
		} catch (error) {
			nodes = null;
		}
		if (!nodes || nodes.length === 0) continue;
		var last = nodes[nodes.length - 1];
		var text = last && typeof last.textContent === 'string' ? last.textContent : '';
		text = text.replace(/\s+/g, ' ').trim();
		if (text !== '') return text.slice(-400);
	}
	return '';
}

/** Keyword reactions + topic tracking, driven by the newest chat text. */
function dwmReactToText() {
	var companion = dwmReadCompanion();
	var text = dwmReadChatText();
	if (text === '' || text === DWM_CARE.lastText) return;
	DWM_CARE.lastText = text;
	DWM_CARE.lastTextAt = dwmNow();
	DWM_CARE.topic = dwmClassifyTopic(text);
	var keyword = dwmMatchKeyword(text);
	if (!keyword) return;
	if (dwmNow() - DWM_CARE.lastReactAt < DWM_CARE_RULES.textReactGapMs) return;
	DWM_CARE.lastReactAt = dwmNow();
	dwmGrowthApply('keyword');
	if (companion.zones !== false) {
		dwmForceState(keyword.pose, 1800);
		dwmFx(keyword.fx || 'note', 2);
	}
	if (companion.chip) dwmChip(dwmKeywordChip(keyword, dwmUiLanguage()), 'mood', 2600);
}

function dwmKeywordChip(keyword, language) {
	var zh = language === 'zh';
	var table = {
		thanks: zh ? '嘿嘿，不客气～' : 'Hehe, welcome~',
		cute: zh ? '诶…说我可爱？' : 'Eh… cute?',
		slack: zh ? '摸鱼时间到！' : 'Slack time!',
		cheer: zh ? '一起冲！' : 'Let us go!',
		tired: zh ? '那就歇一会儿…' : 'Then rest a bit…',
		broken: zh ? '翻车了？我陪你。' : 'It broke? I am here.',
		yay: zh ? '好耶！' : 'Yay!',
		why: zh ? '唔…为什么呀？' : 'Hmm, why?',
		morning: zh ? '早上好！' : 'Good morning!',
		night: zh ? '晚安，做个好梦。' : 'Good night, sweet dreams.',
		laugh: zh ? '你笑了！' : 'You laughed!',
		pat: zh ? '要摸摸头吗？' : 'Head pats?',
		overtime: zh ? '又在加班吗…' : 'Overtime again…'
	};
	return table[keyword.id] || (zh ? '嗯嗯。' : 'Mm-hm.');
}

function dwmCareCheck() {
	var companion = dwmReadCompanion();
	var now = dwmNow();
	var work = DWM_RUNTIME.work;
	var language = dwmUiLanguage();

	/* 1. check in once per local day */
	if (!DWM_CARE.signinDone) {
		DWM_CARE.signinDone = true;
		var result = dwmGrowthSignin(now);
		if (result) {
			var streak = result.growth.signinStreak;
			if (companion.chip) {
				dwmChip(
					language === 'zh' ? '签到成功 · 连续 ' + streak + ' 天' : 'Checked in · ' + streak + ' day streak',
					'ok',
					3000,
					'important',
				);
			}
		}
	}

	/* 2. keyword / topic tracking is cheap and independent of the cooldowns */
	if (companion.zones !== false) dwmReactToText();

	if (!companion.care) return;
	if (now - DWM_RUNTIME.lastCareAt < DWM_CARE_RULES.careGapMs) return;

	/* 3. a long unbroken work session */
	if (work.active && now - work.since > DWM_CARE_RULES.longSitMs && now - DWM_CARE.lastLongSitAt > DWM_CARE_RULES.longSitGapMs) {
		if (dwmCareCanSpeak()) {
			DWM_CARE.lastLongSitAt = now;
			DWM_RUNTIME.lastCareAt = now;
			dwmSpeak(dwmPickLine('careLongSit', language), undefined, 'important');
			dwmCarePose('careLongSit', 3000);
			dwmFx('note', 1);
			return;
		}
	}

	/* 4. the same step has been running for a long time */
	if (work.active && work.changedAt && now - work.changedAt > DWM_CARE_RULES.stuckMs && now - DWM_CARE.lastStuckAt > DWM_CARE_RULES.stuckGapMs) {
		if (dwmCareCanSpeak()) {
			DWM_CARE.lastStuckAt = now;
			DWM_RUNTIME.lastCareAt = now;
			dwmSpeak(dwmPickLine('careStuck', language), undefined, 'important');
			dwmCarePose('careStuck', 3000);
			return;
		}
	}

	/* 5. late night, once per night */
	if (companion.lateNight && dwmIsLateNight(now) && now - DWM_CARE.lastNightAt > 6 * 3600000) {
		if (dwmCareCanSpeak()) {
			DWM_CARE.lastNightAt = now;
			DWM_RUNTIME.lastCareAt = now;
			dwmSpeak(dwmPickLine('careLateNight', language), undefined, 'important');
			dwmCarePose('careLateNight', 3000);
			return;
		}
	}

	/* 6. hungry */
	var growth = dwmGrowthRead();
	if (growth.satiety < 22 && now - DWM_CARE.lastHungryAt > DWM_CARE_RULES.hungryGapMs) {
		if (dwmCareCanSpeak()) {
			DWM_CARE.lastHungryAt = now;
			DWM_RUNTIME.lastCareAt = now;
			dwmSpeak(dwmPickLine('careSatiety', language), undefined, 'important');
			dwmCarePose('careSatiety', 3000);
			return;
		}
	}
}

function dwmCareHeartbeat() {
	var now = dwmNow();
	var previous = DWM_RUNTIME.lastSeenAt || now;
	var awayMs = now - previous;

	dwmGrowthTick(now);
	dwmGrowthHeartbeat(now);

	/* came back after a real absence */
	if (awayMs > DWM_CARE_RULES.awayMs) {
		dwmGrowthApply('click', { awayMs: awayMs });
		if (dwmReadCompanion().care && dwmCareCanSpeak()) {
			dwmSpeak(dwmPickLine('careComeBack', dwmUiLanguage()), undefined, 'important');
			dwmFx('heart', 2);
			/* a greeting portrait when one is shipped, otherwise the usual 'welcome' */
			var greet = typeof dwmPoseFor === 'function' ? dwmPoseFor('careComeBack') : null;
			if (greet) dwmShowPose(greet, 1600);
			else dwmForceState('welcome', 1600);
		}
	}

	dwmCareCheck();
	dwmScheduleIdleChat();
	dwmScheduleWorkSpeech();
}

function dwmScheduleIdleChat() {
	if (DWM_CARE.idleChat !== undefined) clearTimeout(DWM_CARE.idleChat);
	var companion = dwmReadCompanion();
	if (!companion.idleChat) return;
	var delay = DWM_CARE_RULES.idleChatMinMs + Math.random() * DWM_CARE_RULES.idleChatJitterMs;
	DWM_CARE.idleChat = setTimeout(function () {
		DWM_CARE.idleChat = undefined;
		dwmIdleChatTick();
		dwmScheduleIdleChat();
	}, delay);
}

function dwmIdleChatTick() {
	var companion = dwmReadCompanion();
	if (!companion.idleChat) return;
	if (!DWM_RUNTIME.ready) return;
	if (DWM_RUNTIME.work.active) return;
	if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
	if (DWM_RUNTIME.state === 'sleep' || DWM_RUNTIME.state === 'drag') return;
	if (!dwmCareCanSpeak()) return;
	var language = dwmUiLanguage();
	var growth = dwmGrowthRead();
	var mood = dwmCareMoodLine(language);
	var line = mood !== '' ? mood : dwmPickLine('chat' + DWM_CARE.topic.charAt(0).toUpperCase() + DWM_CARE.topic.slice(1), language);
	if (line === '') line = dwmPickLine('chatGeneral', language);
	dwmSpeak(line);
	/* the mood line gets its own pose, so a low or high mood is visible, not just read */
	if (mood !== '') dwmCarePose(dwmMoodTier(growth.mood) <= 1 ? 'moodLow' : 'moodHigh', 3000);
	dwmGrowthApply('chat');
	DWM_RUNTIME.lastIdleChatAt = dwmNow();
}

function dwmScheduleWorkSpeech() {
	if (DWM_CARE.workSpeech !== undefined) clearTimeout(DWM_CARE.workSpeech);
	var companion = dwmReadCompanion();
	if (companion.workSpeech === 'off') return;
	var chatty = companion.workSpeech === 'chatty';
	var delay = chatty
		? DWM_CARE_RULES.workChattyMinMs + Math.random() * DWM_CARE_RULES.workChattyJitterMs
		: DWM_CARE_RULES.workQuietMinMs + Math.random() * DWM_CARE_RULES.workQuietJitterMs;
	DWM_CARE.workSpeech = setTimeout(function () {
		DWM_CARE.workSpeech = undefined;
		dwmWorkSpeechTick();
		dwmScheduleWorkSpeech();
	}, delay);
}

function dwmWorkSpeechTick() {
	var companion = dwmReadCompanion();
	if (companion.workSpeech === 'off') return;
	if (!DWM_RUNTIME.work.active) return;
	/* Work speech keeps its own 8s gap instead of the global care gate. */
	if (dwmNow() - (DWM_RUNTIME.lastWorkSpeechAt || 0) < 8000) return;
	var language = dwmUiLanguage();
	var phase = DWM_RUNTIME.work.phase;
	var busyMs = DWM_RUNTIME.work.since ? dwmNow() - DWM_RUNTIME.work.since : 0;
	var banks;
	if (busyMs > 12 * 60000) banks = ['workLong', 'careLongSit', 'workTool'];
	else if (phase === 'tool') banks = ['workTool', 'workThinking', 'chatGeneral'];
	else if (phase === 'thinking') banks = ['workThinking', 'workTool', 'chatGeneral'];
	else if (phase === 'failure') banks = ['workFailure', 'careStuck', 'chatDebug'];
	else if (phase === 'success') banks = ['workSuccess', 'chatGeneral'];
	else banks = ['workThinking', 'chatGeneral'];
	var line = dwmPickLineFrom(banks, language);
	/* work narration is 'state': it may replace itself, never a care line */
	if (line) dwmSpeak(line, undefined, 'state');
	DWM_RUNTIME.lastWorkSpeechAt = dwmNow();
}

function dwmCareGreetFirstMeet() {
	if (!DWM_RUNTIME.ready) return;
	var growth = dwmGrowthRead();
	if (growth.counts.click > 0 || growth.firstSeenAt === 0) return;
	if (!dwmCareCanSpeak()) return;
	dwmSpeak(dwmPickLine('hello', dwmUiLanguage()), undefined, 'important');
}

function dwmStartCare() {
	dwmStopCare();
	dwmCareHeartbeat();
	DWM_CARE.heartbeat = setInterval(dwmCareHeartbeat, DWM_CARE_RULES.heartbeatMs);
	dwmScheduleIdleChat();
	dwmScheduleWorkSpeech();
	return dwmStopCare;
}

function dwmStopCare() {
	if (DWM_CARE.heartbeat !== undefined) clearInterval(DWM_CARE.heartbeat);
	if (DWM_CARE.idleChat !== undefined) clearTimeout(DWM_CARE.idleChat);
	if (DWM_CARE.workSpeech !== undefined) clearTimeout(DWM_CARE.workSpeech);
	if (DWM_CARE.poseRestore !== undefined) clearTimeout(DWM_CARE.poseRestore);
	DWM_CARE.heartbeat = undefined;
	DWM_CARE.idleChat = undefined;
	DWM_CARE.workSpeech = undefined;
	DWM_CARE.poseRestore = undefined;
}
