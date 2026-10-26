/*
 * dsh-whale-maid — work-status link (added in 1.1.0).
 *
 * The pet reacts to what the Harness is doing. There is no host-side event for
 * "a tool is running" (the client bus only carries session-level channels), so
 * this is a pure DOM observer. Every selector below was verified against the
 * DSH 0.2.1-rc.3 client bundles:
 *
 *   [data-chat-running]                       mounted only while a session runs
 *                                             (dsh-client-ui-chat, RunningStatus)
 *   [data-tool][data-state=running|preparing] a tool card is live
 *                                             (dsh-client-ui-tool, ToolRow)
 *   [data-tool][data-state=ok|error|stopped]  a finished card — it STAYS in the
 *                                             DOM, so it can never be a busy signal
 *   [data-variant=think][data-state=running]  a reasoning block is streaming
 *   [data-process-activity=thinking]          fallback when there is no reasoning
 *
 * Two consequences drive the design:
 *
 *   1. Finished cards persist, so "is there an error card?" is useless as an
 *      error signal. We compare counts against a baseline taken when the session
 *      started instead, which also survives history paging.
 *   2. `data-chat-running` belongs to the *mounted* session view: opening the
 *      settings page unmounts it while the session may still be running. The
 *      `workHold` grace period (default 6 s) papers over that and over the gap
 *      between two tool cards.
 *
 * 1.8.0 (A5) revisited both consequences:
 *
 *   - The 1.5 s interval was pure waste: a turn lasts minutes, and the mutation
 *     observer already catches every relevant DOM change. The interval is now
 *     `DWM_SIGNAL_POLL_MS` (3 s) and only acts as a floor, not as the detector.
 *   - A missing running marker is no longer read as "the turn ended" when the
 *     document is hidden or the settings view is mounted: both unmount the chat
 *     view without ending the turn. Those two cases HOLD instead of ending, and
 *     `visibilitychange` forces an immediate rescan the moment the tab comes
 *     back. `workHold` stays as the final safety net.
 *
 * Nothing here writes to the host DOM, so a future attribute change can break
 * the link but can never break the UI.
 */

var DWM_SIGNAL_SELECTORS = {
	running: ['[data-chat-running]'],
	tool: ['[data-tool][data-state="running"]', '[data-tool][data-state="preparing"]'],
	thinking: ['[data-variant="think"][data-state="running"]', '[data-streaming][data-variant="think"]'],
	activity: ['[data-process-activity="thinking"]'],
	error: ['[data-tool][data-state="error"]'],
	code: ['pre'],
	/**
	 * The settings view. Opening it replaces the session view, so
	 * `[data-chat-running]` disappears even though the turn is still running.
	 * Both selectors are the ones this repo already relies on for the settings
	 * surface (`settings.section` is registered in plugin.js, and
	 * `[data-shortcut-modal="settings"]` is the modal route into it).
	 */
	settings: ['[data-shortcut-modal="settings"]', '[data-slot="settings.header"]']
};

/** 1.8.0 (A5): the poll floor. The mutation observer does the real work. */
var DWM_SIGNAL_POLL_MS = 3000;
/** A turn running longer than this gets the "long" pose / line. */
var DWM_WORK_LONG_MS = 12 * 60000;

var DWM_SIGNAL_TIMERS = { interval: undefined, debounce: undefined, observer: null, visibility: null };

function dwmCountAny(selectorList) {
	var total = 0;
	for (var i = 0; i < selectorList.length; i++) {
		try {
			total += document.querySelectorAll(selectorList[i]).length;
		} catch (error) {
			/* an invalid selector must never throw out of the scan */
		}
	}
	return total;
}

function dwmQueryAny(selectorList) {
	return dwmCountAny(selectorList) > 0;
}

function dwmWorkPose(phase) {
	if (phase === 'thinking') return 'think';
	if (phase === 'tool') return 'work';
	if (phase === 'failure') return 'sad';
	if (phase === 'success') return 'joy';
	return 'idle';
}

/**
 * 1.8.0 (A5): the same phases, as keys of the pose map in `src/pose-map.js`.
 * 'long' is not a phase of its own — it is the tool phase once the turn has
 * been running past `DWM_WORK_LONG_MS`.
 */
function dwmWorkPoseContext(phase) {
	if (phase === 'thinking') return 'workThinking';
	if (phase === 'tool') {
		var since = DWM_RUNTIME.work.since;
		if (since && dwmNow() - since > DWM_WORK_LONG_MS) return 'workLong';
		return 'workTool';
	}
	if (phase === 'failure') return 'workFailure';
	if (phase === 'success') return 'workSuccess';
	return '';
}

/** True while the document is in a background tab. */
function dwmDocumentHidden() {
	return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

/** True while the settings view is mounted over the session. */
function dwmSettingsViewOpen() {
	return dwmQueryAny(DWM_SIGNAL_SELECTORS.settings);
}

function dwmWorkChipText(phase, language) {
	var zh = language === 'zh';
	if (phase === 'thinking') return zh ? '思考中 · 正在琢磨你的问题' : 'Thinking · working out your question';
	if (phase === 'tool') {
		var busyMs = DWM_RUNTIME.work.since ? dwmNow() - DWM_RUNTIME.work.since : 0;
		if (busyMs > DWM_WORK_LONG_MS) {
			return zh ? '还在忙 · 这个任务有点大，我在盯着' : 'Still busy · this task is a big one, I am watching it';
		}
		return zh ? '工作中 · 正在调用工具处理' : 'Working · running tools for you';
	}
	if (phase === 'failure') return zh ? '出错 · 需要你看一眼' : 'Error · needs your eyes';
	if (phase === 'success') return zh ? '完成 · 交给你了' : 'Done · handing it over';
	return '';
}

/**
 * Push the current phase onto the pet unless the user is dragging her.
 *
 * 1.8.0: the phase now goes through the pose map. Every work portrait is still
 * pending art, so `dwmPoseFor` returns the same animation state the 1.1.0 code
 * forced (`think` / `work` / `joy` / `sad`) and nothing changes on screen; the
 * moment a portrait ships, that portrait takes over instead.
 */
function dwmApplyWorkPose(phase) {
	dwmSetWorkGlow(phase !== 'idle');
	if (DWM_RUNTIME.state === 'drag') return;
	if (phase === 'idle') return;
	var context = dwmWorkPoseContext(phase);
	if (context !== '' && typeof dwmPoseFor === 'function') {
		var pose = dwmPoseFor(context);
		if (pose && (pose.image || pose.state)) {
			dwmShowPose(pose, 0, true);
			return;
		}
	}
	dwmForceState(dwmWorkPose(phase), 0, true);
}

function dwmResetWork(work) {
	dwmSetWorkGlow(false);
	dwmHidePose();
	work.active = false;
	work.phase = 'idle';
	work.held = false;
	work.longShown = false;
	work.hadError = false;
	work.hadTool = false;
	work.hadCode = false;
	work.base = null;
}

function dwmScanSignals() {
	var companion = dwmReadCompanion();
	var work = DWM_RUNTIME.work;
	var now = dwmNow();

	if (!companion.workLink) {
		dwmResetWork(work);
		return;
	}

	var hasTool = dwmQueryAny(DWM_SIGNAL_SELECTORS.tool);
	var hasThinking = dwmQueryAny(DWM_SIGNAL_SELECTORS.thinking) || dwmQueryAny(DWM_SIGNAL_SELECTORS.activity);
	var hasRunning = dwmQueryAny(DWM_SIGNAL_SELECTORS.running);

	var phase = 'idle';
	if (hasTool) phase = 'tool';
	else if (hasThinking && (hasRunning || work.active)) phase = 'thinking';
	else if (hasRunning) phase = 'thinking';

	if (phase !== 'idle') {
		if (!work.active) {
			/* a new work session begins — take the baselines first */
			work.active = true;
			work.sessions += 1;
			work.since = now;
			work.hadError = false;
			work.hadTool = false;
			work.hadCode = false;
			work.base = {
				error: dwmCountAny(DWM_SIGNAL_SELECTORS.error),
				code: dwmCountAny(DWM_SIGNAL_SELECTORS.code)
			};
			dwmGrowthApply('tool-seen');
			dwmApplyWorkPose(phase);
			if (companion.chip) dwmChip(dwmWorkChipText(phase, dwmUiLanguage()), 'work', 2400, 'state');
			if (DWM_RUNTIME.api && DWM_RUNTIME.api.resetSleep) DWM_RUNTIME.api.resetSleep();
			if (DWM_RUNTIME.api && DWM_RUNTIME.api.stopWalk) DWM_RUNTIME.api.stopWalk();
		}
		if (phase === 'tool') work.hadTool = true;

		/* errors are counted against the baseline, never against bare presence */
		if (work.base && dwmCountAny(DWM_SIGNAL_SELECTORS.error) > work.base.error) work.hadError = true;

		if (phase !== work.phase) {
			work.phase = phase;
			work.changedAt = now;
			dwmApplyWorkPose(phase);
			if (companion.chip && phase !== 'thinking') {
				dwmChip(dwmWorkChipText(phase, dwmUiLanguage()), 'work', 2400, 'state');
			}
		} else if (phase === 'tool' && !work.longShown && now - work.since > DWM_WORK_LONG_MS) {
			/*
			 * A5: the turn crossed the "long" threshold without changing phase, so
			 * nothing above would repaint. Do it once, and only once, per session.
			 */
			work.longShown = true;
			dwmApplyWorkPose('tool');
			if (companion.chip) dwmChip(dwmWorkChipText('tool', dwmUiLanguage()), 'work', 2400, 'state');
		}
		work.goneAt = now;
		work.held = false;

		/* keep her awake and still while a turn is running */
		if (DWM_RUNTIME.api && DWM_RUNTIME.api.resetSleep) DWM_RUNTIME.api.resetSleep();
		if (DWM_RUNTIME.api && DWM_RUNTIME.api.stopWalk) DWM_RUNTIME.api.stopWalk();

		if (!work.hadCode && work.base && dwmCountAny(DWM_SIGNAL_SELECTORS.code) > work.base.code) {
			work.hadCode = true;
			dwmGrowthApply('code-seen');
		}
		return;
	}

	/* no busy marker right now */
	if (!work.active) {
		work.phase = 'idle';
		return;
	}
	/*
	 * A5: an unmounted session view is not a finished turn. Both the settings
	 * page and a background tab unmount `[data-chat-running]` while the turn
	 * keeps running, so hold the phase instead of ending it. `workHold` below
	 * still ends the turn if neither condition ever clears.
	 */
	if (dwmSettingsViewOpen() || dwmDocumentHidden()) {
		work.held = true;
		return;
	}
	if (now - work.goneAt < companion.workHold) {
		work.held = true;
		return;
	}

	/* the session is over */
	var failed = work.hadError === true;
	dwmResetWork(work);
	if (failed) {
		dwmGrowthApply('failure');
		dwmPlayWorkOutcome('workFailure', 'sad', 2000);
		if (companion.chip) dwmChip(dwmWorkChipText('failure', dwmUiLanguage()), 'error', 2600, 'state');
		dwmFx('sparkle', 2);
		if (companion.workSpeech !== 'off') dwmSpeak(dwmPickLine('workFailure', dwmUiLanguage()), undefined, 'state');
	} else {
		dwmGrowthApply('success');
		dwmPlayWorkOutcome('workSuccess', 'joy', 1500);
		if (companion.chip) dwmChip(dwmWorkChipText('success', dwmUiLanguage()), 'ok', 2200, 'state');
		dwmFx('star', 3);
		if (companion.workSpeech !== 'off') dwmSpeak(dwmPickLine('workSuccess', dwmUiLanguage()), undefined, 'state');
	}
}

/**
 * The closing pose of a turn. A portrait wins when one is shipped; otherwise the
 * 1.1.0 sequence runs unchanged, so the outcome looks exactly as it always did.
 */
function dwmPlayWorkOutcome(context, state, ms) {
	if (typeof dwmPoseFor === 'function') {
		var pose = dwmPoseFor(context);
		if (pose && (pose.image || pose.state)) {
			dwmShowPose(pose, ms);
			return;
		}
	}
	dwmPlaySequence([[state, ms]]);
}

/**
 * Play a short pose sequence. Before the pet mounts there is no sequence
 * runner yet, so fall back to announcing the first state on the same event
 * channel the pet listens to.
 */
function dwmPlaySequence(steps) {
	if (!steps || !steps.length) return;
	var api = DWM_RUNTIME.api;
	if (api && typeof api.runSequence === 'function') {
		api.runSequence(steps);
		return;
	}
	dwmForceState(steps[0][0], steps[0][1]);
}

/** Which language the visible text should use (mirrors resolveLanguage). */
function dwmUiLanguage() {
	try {
		return resolveLanguage(readOptions().language);
	} catch (error) {
		return 'zh';
	}
}

function dwmScheduleScan() {
	if (DWM_SIGNAL_TIMERS.debounce !== undefined) clearTimeout(DWM_SIGNAL_TIMERS.debounce);
	DWM_SIGNAL_TIMERS.debounce = setTimeout(function () {
		DWM_SIGNAL_TIMERS.debounce = undefined;
		dwmScanSignals();
	}, 200);
}

function dwmStartSignals() {
	dwmStopSignals();
	dwmScheduleScan();
	DWM_SIGNAL_TIMERS.interval = setInterval(dwmScanSignals, DWM_SIGNAL_POLL_MS);
	if (typeof MutationObserver === 'function' && document.body) {
		DWM_SIGNAL_TIMERS.observer = new MutationObserver(dwmScheduleScan);
		DWM_SIGNAL_TIMERS.observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['data-chat-running', 'data-tool', 'data-state', 'data-variant', 'data-streaming', 'data-process-activity']
		});
	}
	/*
	 * A5: a hidden tab stops mutating, so the interval is the only thing that
	 * could notice the turn ending — and it is now 3 s. Coming back to the tab is
	 * the one moment where being late is visible, so rescan right away instead of
	 * waiting for the next tick.
	 */
	if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
		DWM_SIGNAL_TIMERS.visibility = function () {
			if (dwmDocumentHidden()) return;
			if (DWM_SIGNAL_TIMERS.debounce !== undefined) clearTimeout(DWM_SIGNAL_TIMERS.debounce);
			DWM_SIGNAL_TIMERS.debounce = undefined;
			dwmScanSignals();
		};
		document.addEventListener('visibilitychange', DWM_SIGNAL_TIMERS.visibility);
	}
	return dwmStopSignals;
}

function dwmStopSignals() {
	if (DWM_SIGNAL_TIMERS.interval !== undefined) clearInterval(DWM_SIGNAL_TIMERS.interval);
	if (DWM_SIGNAL_TIMERS.debounce !== undefined) clearTimeout(DWM_SIGNAL_TIMERS.debounce);
	DWM_SIGNAL_TIMERS.interval = undefined;
	DWM_SIGNAL_TIMERS.debounce = undefined;
	if (DWM_SIGNAL_TIMERS.visibility) {
		if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
			try {
				document.removeEventListener('visibilitychange', DWM_SIGNAL_TIMERS.visibility);
			} catch (error) {
				/* ignore */
			}
		}
		DWM_SIGNAL_TIMERS.visibility = null;
	}
	if (DWM_SIGNAL_TIMERS.observer) {
		try {
			DWM_SIGNAL_TIMERS.observer.disconnect();
		} catch (error) {
			/* ignore */
		}
		DWM_SIGNAL_TIMERS.observer = null;
	}
}
