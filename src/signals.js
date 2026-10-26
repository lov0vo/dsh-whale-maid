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
 * Nothing here writes to the host DOM, so a future attribute change can break
 * the link but can never break the UI.
 */

var DWM_SIGNAL_SELECTORS = {
	running: ['[data-chat-running]'],
	tool: ['[data-tool][data-state="running"]', '[data-tool][data-state="preparing"]'],
	thinking: ['[data-variant="think"][data-state="running"]', '[data-streaming][data-variant="think"]'],
	activity: ['[data-process-activity="thinking"]'],
	error: ['[data-tool][data-state="error"]'],
	code: ['pre']
};

var DWM_SIGNAL_TIMERS = { interval: undefined, debounce: undefined, observer: null };

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

function dwmWorkChipText(phase, language) {
	var zh = language === 'zh';
	if (phase === 'thinking') return zh ? '思考中' : 'Thinking';
	if (phase === 'tool') return zh ? '工作中' : 'Working';
	if (phase === 'failure') return zh ? '出错' : 'Error';
	if (phase === 'success') return zh ? '完成' : 'Done';
	return '';
}

/** Push the current phase onto the pet unless the user is dragging her. */
function dwmApplyWorkPose(phase) {
	dwmSetWorkGlow(phase !== 'idle');
	if (DWM_RUNTIME.state === 'drag') return;
	if (phase === 'idle') return;
	dwmForceState(dwmWorkPose(phase), 0, true);
}

function dwmResetWork(work) {
	dwmSetWorkGlow(false);
	work.active = false;
	work.phase = 'idle';
	work.held = false;
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
			if (companion.chip) dwmChip(dwmWorkChipText(phase, dwmUiLanguage()), 'work', 2400);
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
				dwmChip(dwmWorkChipText(phase, dwmUiLanguage()), 'work', 2400);
			}
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
	if (now - work.goneAt < companion.workHold) {
		work.held = true;
		return;
	}

	/* the session is over */
	var failed = work.hadError === true;
	dwmResetWork(work);
	if (failed) {
		dwmGrowthApply('failure');
		dwmPlaySequence([['sad', 2000]]);
		if (companion.chip) dwmChip(dwmWorkChipText('failure', dwmUiLanguage()), 'error', 2600);
		dwmFx('sparkle', 2);
		if (companion.workSpeech !== 'off') dwmSpeak(dwmPickLine('workFailure', dwmUiLanguage()));
	} else {
		dwmGrowthApply('success');
		dwmPlaySequence([['joy', 1500]]);
		if (companion.chip) dwmChip(dwmWorkChipText('success', dwmUiLanguage()), 'ok', 2200);
		dwmFx('star', 3);
		if (companion.workSpeech !== 'off') dwmSpeak(dwmPickLine('workSuccess', dwmUiLanguage()));
	}
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
	DWM_SIGNAL_TIMERS.interval = setInterval(dwmScanSignals, 1500);
	if (typeof MutationObserver === 'function' && document.body) {
		DWM_SIGNAL_TIMERS.observer = new MutationObserver(dwmScheduleScan);
		DWM_SIGNAL_TIMERS.observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['data-chat-running', 'data-tool', 'data-state', 'data-variant', 'data-streaming', 'data-process-activity']
		});
	}
	return dwmStopSignals;
}

function dwmStopSignals() {
	if (DWM_SIGNAL_TIMERS.interval !== undefined) clearInterval(DWM_SIGNAL_TIMERS.interval);
	if (DWM_SIGNAL_TIMERS.debounce !== undefined) clearTimeout(DWM_SIGNAL_TIMERS.debounce);
	DWM_SIGNAL_TIMERS.interval = undefined;
	DWM_SIGNAL_TIMERS.debounce = undefined;
	if (DWM_SIGNAL_TIMERS.observer) {
		try {
			DWM_SIGNAL_TIMERS.observer.disconnect();
		} catch (error) {
			/* ignore */
		}
		DWM_SIGNAL_TIMERS.observer = null;
	}
}
