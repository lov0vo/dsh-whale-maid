/*
 * dsh-whale-maid —client registration.
 *
 * Contributions, all through slots:
 *   1. the sprite stylesheet, injected once and removed on unload;
 *   2. the pet itself, registered into `shell.overlay` —the frame-wide overlay
 *      slot, which is the documented seat for an overlay whose placement is
 *      known. The pet is `position: fixed` and wanders the whole viewport, so it
 *      must outlive any single panel;
 *   3. a settings section, so the parameters the extraction exposed are
 *      adjustable in-product;
 *   4. (1.1.0) a second settings section for the companion features —kept
 *      separate so the original section keeps its exact behaviour and layout;
 *   5. (1.1.0) two long-lived observers: the work-status link and the proactive
 *      care loop. Both are registered with `ctx.effect`, so unloading the plugin
 *      removes every timer and listener.
 *
 * Plus a small public API on `window.dshWhaleMaid` for scripting.
 */

var STYLE_ATTR = 'data-dsh-whale-maid';

function injectStyles() {
	var tag = document.createElement('style');
	tag.setAttribute(STYLE_ATTR, '');
	tag.textContent = STYLESHEET;
	(document.head || document.documentElement).appendChild(tag);
	return function () {
		tag.remove();
	};
}

function createPublicApi() {
	return {
		/** Current resolved options (defaults + stored overrides). */
		getOptions: readOptions,
		/** Merge a partial options object and apply it live. */
		setOptions: function (patch) {
			var next = normalizeOptions(Object.assign({}, readOptions(), patch || {}));
			writeJSON(KEY_OPTIONS, next);
			window.dispatchEvent(new CustomEvent(OPTIONS_EVENT));
			return next;
		},
		/** Show a speech bubble with arbitrary text. */
		say: function (message, tone) {
			window.dispatchEvent(new CustomEvent(SAY_EVENT, { detail: { text: String(message), tone: tone || '' } }));
		},
		/** Move the pet back to its default bottom-right corner. */
		resetPosition: function () {
			window.dispatchEvent(new CustomEvent(RESET_POS_EVENT));
		},
		/** How many dried fish she has been fed. */
		feeds: function () {
			var value = Number(readRaw(KEY_FEEDS));
			return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
		},
		/** Forget everything this plugin stored (position, feeds, options, greeting). */
		forget: function () {
			[KEY_POS, KEY_FEEDS, KEY_GREETED, KEY_OPTIONS, KEY_GROWTH, KEY_COMPANION, KEY_WEATHER].forEach(function (key) {
				try {
					window.localStorage.removeItem(key);
				} catch (error) {
					/* ignore */
				}
			});
			window.dispatchEvent(new CustomEvent(RESET_POS_EVENT));
			window.dispatchEvent(new CustomEvent(OPTIONS_EVENT));
			window.dispatchEvent(new CustomEvent(DWM_EVENT_GROWTH));
			window.dispatchEvent(new CustomEvent(DWM_EVENT_COMPANION));
		},

		/* --- 1.4.0 save file + mood ---------------------------------------- */

		/** The whole save as a formatted JSON string. */
		exportSave: dwmSaveExport,
		/** Import a save; returns { ok, imported, skipped, reason }. */
		importSave: dwmSaveImport,
		/** Wipe every key the plugin owns. */
		clearSave: dwmSaveClear,
		/** Mood tier 0..4 (0 = lowest). */
		moodTier: function () {
			return dwmMoodTier(dwmGrowthRead().mood);
		},

		/* --- 1.1.0 companion API (additive) --------------------------------- */

		/** Companion switches (work link, care, chip, zones, chatter —. */
		companion: dwmReadCompanion,
		/** Merge a partial companion object and apply it live. */
		setCompanion: function (patch) {
			return dwmWriteCompanion(patch);
		},
		/** Read-only snapshot of the growth state (level, mood, quests, achievements —. */
		growth: function () {
			return dwmGrowthSnapshot();
		},
		/** Check in for today. Returns null when it was already done today. */
		signin: function () {
			return dwmGrowthSignin();
		},
		/** Claim a finished daily quest by index. */
		claimQuest: function (index) {
			return dwmGrowthClaimQuest(index);
		},
		/** Wipe growth data (level, mood, quests, achievements, diary). */
		resetGrowth: function () {
			return dwmGrowthReset();
		},
		/** What the work-status detector currently sees. */
		work: function () {
			var work = DWM_RUNTIME.work;
			return {
				active: work.active,
				phase: work.phase,
				held: work.held,
				sessions: work.sessions,
				since: work.since,
				changedAt: work.changedAt
			};
		},
		/**
		 * Re-run the work-status detector right now and return its verdict.
		 * Handy when she does not seem to react: if this stays `idle` while a turn
		 * is clearly running, the host changed its DOM contract.
		 */
		scanNow: function () {
			dwmScanSignals();
			return {
				active: DWM_RUNTIME.work.active,
				phase: DWM_RUNTIME.work.phase,
				held: DWM_RUNTIME.work.held
			};
		},
		/** Everything the companion modules know about the current state. */
		diagnose: function () {
			return {
				ready: DWM_RUNTIME.ready,
				pose: DWM_RUNTIME.state,
				frame: DWM_RUNTIME.frame,
				work: {
					active: DWM_RUNTIME.work.active,
					phase: DWM_RUNTIME.work.phase,
					held: DWM_RUNTIME.work.held,
					sessions: DWM_RUNTIME.work.sessions
				},
				options: readOptions(),
				companion: dwmReadCompanion(),
				growth: dwmGrowthSnapshot()
			};
		},
		/** Which hit zone a tap at normalised (0..1) coordinates falls in. */
		zoneAt: function (nx, ny) {
			return dwmHitZone(Number(nx) || 0, Number(ny) || 0);
		},
		/** What she would make of a message: coarse topic + keyword reaction id. */
		probe: function (text) {
			var keyword = dwmMatchKeyword(String(text || ''));
			return { topic: dwmClassifyTopic(String(text || '')), keyword: keyword ? keyword.id : null };
		},
		/** Show a status chip without going through the pet. */
		chip: function (text, tone, ms) {
			dwmSpeak(String(text || ''), tone);
		},
		/** Spawn particles: kind = heart | star | sparkle | note. */
		fx: function (kind, count) {
			dwmFx(kind, count);
		},
		/* --- 1.3.0 weather API (additive) ---------------------------------- */

		/** The cached weather record, or null before the first successful fetch. */
		weather: function () {
			return dwmWeatherRead();
		},
		/** Fetch the weather again right now (same path as the panel button). */
		refreshWeather: function () {
			return dwmWeatherRefresh('api');
		},
		/** Change the fallback city used when geolocation is unavailable. */
		setCity: function (city) {
			var next = normalizeOptions(Object.assign({}, readOptions(), { city: String(city || '') }));
			writeJSON(KEY_OPTIONS, next);
			window.dispatchEvent(new CustomEvent(OPTIONS_EVENT));
			dwmWeatherRefresh('api-city');
			return next.city;
		},

		/** Force a pose from the ten-state table; hold=true keeps it. */
		pose: function (state, ms, hold) {
			dwmForceState(state, ms, hold);
		},
	};
}

function apply(ctx) {
	ctx.effect(injectStyles, 'dsh-whale-maid: sprite pet stylesheet');

	ctx.slots.inject('shell.overlay', function () {
		return ctx.slots.register({ name: 'shell.overlay', id: 'dsh-whale-maid', order: 100 }, WhaleGirl);
	});

	ctx.slots.inject('settings.section', function () {
		return ctx.slots.register(
			{
				name: 'settings.section',
				locale: 'dsh-whale-maid',
				id: 'dsh-whale-maid',
				order: 60,
				label: function () {
					return resolveLanguage(readOptions().language) === 'zh' ? '鲸鱼女仆' : 'Whale girl';
				},
			},
			SettingsSection,
		);
	});

	/* 1.1.0 —companion settings sit right after the original section. */
	ctx.slots.inject('settings.section', function () {
		return ctx.slots.register(
			{
				name: 'settings.section',
				locale: 'dsh-whale-maid',
				id: 'dsh-whale-maid-companion',
				order: 61,
				label: function () {
					return resolveLanguage(readOptions().language) === 'zh' ? '鲸鱼女仆 · 成长' : 'Whale girl · Companion';
				},
			},
			CompanionPanel,
		);
	});

	/* 1.1.0 —the two observers. Both return their own cleanup function. */
	ctx.effect(dwmStartSignals, 'dsh-whale-maid: work-status link');
	ctx.effect(dwmStartCare, 'dsh-whale-maid: companion care loop');

	/* 1.3.0 — the weather companion refreshes itself and cleans up on unload. */
	ctx.effect(dwmWeatherStart, 'dsh-whale-maid: weather companion');

	ctx.effect(function () {
		window.dshWhaleMaid = createPublicApi();
		return function () {
			delete window.dshWhaleMaid;
		};
	}, 'dsh-whale-maid: public API');
}

