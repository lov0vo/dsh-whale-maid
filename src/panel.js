/*
 * dsh-whale-maid — companion panel (added in 1.1.0).
 *
 * A second settings section, registered next to the original "whale girl"
 * section instead of inside it: the original section only ever described the
 * extraction (size, speed, language, idle life) and must keep working exactly as
 * it did. Everything the companion features added — stats, quests, sign-in,
 * achievements, diary and their switches — lives here.
 *
 * Every control writes to localStorage and dispatches an event, so the running
 * pet picks the change up without a reload.
 *
 * A11: every user-visible string goes through `dwmT(key, zh, en)` (see
 * src/locale-table.js, generated from locale/zh.json + locale/en.json). The
 * inline zh/en pair stays as the fallback so a missing key still renders text;
 * `dwmFill()` interpolates the {name} placeholders of the templated keys.
 */

function dwmFormatDuration(ms) {
	var total = Math.max(0, Math.floor(Number(ms) || 0) / 1000);
	var days = Math.floor(total / 86400);
	var hours = Math.floor((total - days * 86400) / 3600);
	var minutes = Math.floor((total - days * 86400 - hours * 3600) / 60);
	if (days > 0) return dwmFill(dwmT('panel.duration.dayHour', '{d} 天 {h} 小时', '{d}d {h} h'), { d: days, h: hours });
	if (hours > 0)
		return dwmFill(dwmT('panel.duration.hourMinute', '{h} 小时 {m} 分', '{h} h {m} m'), { h: hours, m: minutes });
	return dwmFill(dwmT('panel.duration.minute', '{m} 分钟', '{m} min'), { m: minutes });
}

/* Export / import the whole save. Kept in its own component so the panel
   stays readable and the textarea state cannot re-render the whole tree. */
function SaveBlock() {
	var textState = useState("");
	var text = textState[0];
	var setText = textState[1];
	var statusState = useState("");
	var status = statusState[0];
	var setStatus = statusState[1];
	return h(
		'div',
		{ className: 'dwm-panel-save' },
		h('h4', { className: 'dwm-panel-title' }, dwmT('panel.save.title', '存档', 'Save file')),
		h(
			'p',
			{ className: 'dwm-panel-muted' },
			dwmT(
				'panel.save.hint',
				'导出全部数据（位置、投喂、配置、成长、天气），或粘贴一份存档导入。',
				'Export everything (position, feeds, options, growth, weather), or paste a save to import.',
			),
		),
		h(
			'textarea',
			{
				className: 'dwm-panel-textarea',
				rows: 4,
				value: text,
				placeholder: dwmT(
					'panel.save.placeholder',
					'点「导出」生成存档，或在此粘贴存档 JSON',
					'Press export, or paste a save JSON here',
				),
				onChange: function (event) {
					setText(event.target.value);
				},
			},
		),
		h(
			'div',
			{ className: 'dwm-settings-actions' },
			h(
				'button',
				{
					type: 'button',
					onClick: function () {
						setText(dwmSaveExport());
						setStatus(dwmT('panel.save.exported', '已导出到下面的文本框', 'Exported into the box below'));
					},
				},
				dwmT('panel.save.export', '导出', 'Export'),
			),
			h(
				'button',
				{
					type: 'button',
					onClick: function () {
						var result = dwmSaveImport(text);
						setStatus(
							result.ok
								? dwmFill(dwmT('panel.save.imported', '已导入 {n} 项', 'Imported {n} entries'), {
										n: result.imported,
									})
								: dwmFill(
										dwmT('panel.save.importFailed', '导入失败：{reason}', 'Import failed: {reason}'),
										{ reason: result.reason },
									),
						);
					},
				},
				dwmT('panel.save.import', '导入', 'Import'),
			),
			h(
				'button',
				{
					type: 'button',
					onClick: function () {
						var cleared = dwmSaveClear();
						setText('');
						setStatus(dwmFill(dwmT('panel.save.cleared', '已清空 {n} 项', 'Cleared {n} entries'), { n: cleared }));
					},
				},
				dwmT('panel.save.clear', '清空存档', 'Clear save'),
			),
		),
		status ? h('p', { className: 'dwm-panel-muted' }, status) : null,
	);
}

function CompanionPanel(props) {
	var React_ = React;
	var useState = React_.useState;
	var useEffect = React_.useEffect;

	var snapshotState = useState(function () {
		return dwmGrowthSnapshot();
	});
	var snapshot = snapshotState[0];
	var setSnapshot = snapshotState[1];

	var companionState = useState(dwmReadCompanion);
	var companion = companionState[0];
	var setCompanion = companionState[1];

	var weatherState = useState(dwmWeatherRead);
	var weather = weatherState[0];
	var setWeather = weatherState[1];

	useEffect(function () {
		function refresh() {
			setSnapshot(dwmGrowthSnapshot());
			setCompanion(dwmReadCompanion());
			setWeather(dwmWeatherRead());
		}
		window.addEventListener(DWM_EVENT_GROWTH, refresh);
		window.addEventListener(DWM_EVENT_COMPANION, refresh);
		var timer = setInterval(refresh, 30000);
		if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', refresh);
		return function () {
			window.removeEventListener(DWM_EVENT_GROWTH, refresh);
			window.removeEventListener(DWM_EVENT_COMPANION, refresh);
			clearInterval(timer);
		};
	}, []);

	var language = dwmUiLanguage();

	function commitCompanion(patch) {
		var next = dwmWriteCompanion(patch);
		setCompanion(next);
		return next;
	}

	function bar(value, max, tone) {
		var percent = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
		return h(
			'div',
			{ className: 'dwm-panel-bar' },
			h('span', { className: 'dwm-panel-bar-fill dwm-panel-bar-' + tone, style: { width: percent.toFixed(1) + '%' } }),
		);
	}

	function statRow(key, zh, en, value, extra) {
		return h(
			'div',
			{ className: 'dwm-panel-stat' },
			h('span', { className: 'dwm-panel-stat-label' }, dwmT(key, zh, en)),
			h('span', { className: 'dwm-panel-stat-value' }, value),
			extra || null,
		);
	}

	/* --- quests --------------------------------------------------------- */
	function questList() {
		if (snapshot.quests.length === 0)
			return h('p', { className: 'dwm-panel-muted' }, dwmT('panel.quests.empty', '今天没有任务', 'No quests today'));
		return h(
			'ul',
			{ className: 'dwm-panel-quests' },
			snapshot.quests.map(function (quest) {
				return h(
					'li',
					{ key: quest.id, className: 'dwm-panel-quest' + (quest.claimed ? ' is-claimed' : '') },
					h(
						'span',
						{ className: 'dwm-panel-quest-text' },
						/* data-driven text from src/growth.js: no table entry, so the
						   zh/en pair is selected by the active language. */
						dwmT(null, quest.zh, quest.en) + ' ' + quest.progress + '/' + quest.target,
					),
					h(
						'button',
						{
							type: 'button',
							disabled: quest.claimed || !quest.ready,
							onClick: function () {
								var result = dwmGrowthClaimQuest(quest.index);
								if (result) {
									setSnapshot(dwmGrowthSnapshot());
									dwmChip(
										dwmT('panel.quests.done', '任务完成！', 'Quest done!'),
										'ok',
										2400,
									);
									dwmFx('star', 3);
								}
							}
						},
						quest.claimed
							? dwmT('panel.quests.claimed', '已领取', 'Claimed')
							: quest.ready
								? dwmT('panel.quests.claim', '领取', 'Claim')
								: dwmT('panel.quests.progress', '进行中', 'In progress'),
					),
				);
			}),
		);
	}

	/* --- weekly sign-in board -------------------------------------------- */
	function signinBoard() {
		var cells = [];
		for (var i = 0; i < 7; i++) {
			var filled = i < snapshot.signinDays.length;
			cells.push(h('span', { key: i, className: 'dwm-panel-cell' + (filled ? ' is-on' : '') }, filled ? '🐟' : '·'));
		}
		return h(
			'div',
			{ className: 'dwm-panel-board' },
			cells,
			h(
				'button',
				{
					type: 'button',
					onClick: function () {
						var result = dwmGrowthSignin();
						if (result) {
							setSnapshot(dwmGrowthSnapshot());
							dwmChip(dwmT('panel.signin.success', '签到成功', 'Checked in'), 'ok', 2400);
							dwmFx('heart', 2);
						} else {
							dwmChip(
								dwmT('panel.signin.already', '今天已经签过了', 'Already checked in today'),
								'info',
								2200,
							);
						}
					}
				},
				dwmT('panel.signin.button', '打卡签到', 'Check in'),
			),
		);
	}

	/* --- achievements ----------------------------------------------------- */
	function achievementGrid() {
		return h(
			'div',
			{ className: 'dwm-panel-achievements' },
			snapshot.achievements.map(function (entry) {
				var name = dwmT(null, entry.zh, entry.en);
				return h(
					'span',
					{
						key: entry.id,
						className: 'dwm-ach' + (entry.unlocked ? ' is-on' : ''),
						title: name + (entry.unlocked ? '' : dwmT('panel.achievements.locked', '（未解锁）', ' (locked)'))
					},
					h('span', { className: 'dwm-ach-icon' }, entry.icon),
					h('span', { className: 'dwm-ach-name' }, name),
				);
			}),
		);
	}

	/* --- diary ------------------------------------------------------------ */
	function diaryList() {
		if (snapshot.diary.length === 0)
			return h('p', { className: 'dwm-panel-muted' }, dwmT('panel.diary.empty', '还没有记录', 'Nothing recorded yet'));
		return h(
			'ul',
			{ className: 'dwm-panel-diary' },
			snapshot.diary.slice(0, 6).map(function (entry) {
				return h('li', { key: entry.at + '-' + entry.kind }, dwmT(null, entry.zh, entry.en));
			}),
		);
	}

	function commitCity(raw) {
	// 2.1.0: validate before trusting a hand-typed city, and say why when it fails.
	var typed = typeof raw === 'string' ? raw.trim() : '';
	if (typed !== '' && typeof dwmWeatherValidateCity === 'function') {
		dwmWeatherValidateCity(typed).then(function (result) {
			if (!result || !result.ok) {
				var reason = result && result.reason;
				dwmSpeak(
					reason === 'network'
						? '网络不通，先保留原来的城市'
						: '找不到「' + typed + '」，试试加省份或区（例如「杭州市西湖区」）',
					'important',
				);
				return;
			}
			var next = normalizeOptions(Object.assign({}, readOptions(), { city: result.label }));
			writeJSON(KEY_OPTIONS, next);
			if (typeof window !== "undefined" && window.dispatchEvent) window.dispatchEvent(new CustomEvent(OPTIONS_EVENT));
			if (typeof dwmWeatherRefresh === "function") dwmWeatherRefresh();
			dwmSpeak('已识别：' + result.label, 'important');
		});
		return;
	}

		var next = String(raw === undefined || raw === null ? '' : raw).trim();
		if (next === '') next = DWM_WEATHER_DEFAULT_CITY;
		if (next === readOptions().city) return;
		var merged = normalizeOptions(Object.assign({}, readOptions(), { city: next }));
		writeJSON(KEY_OPTIONS, merged);
		window.dispatchEvent(new CustomEvent(OPTIONS_EVENT));
		dwmWeatherRefresh('city');
	}

	function weatherBlock() {
		var candState = useState([]);
		var candidates = candState[0];
		var setCandidates = candState[1];

		function searchCity(text) {
			var query = typeof text === 'string' ? text.trim() : '';
			if (query === '' || typeof dwmWeatherCandidates !== 'function') { setCandidates([]); return; }
			dwmWeatherCandidates(query).then(function (rows) { setCandidates(rows); });
		}

		function pickCity(candidate) {
			var next = normalizeOptions(Object.assign({}, readOptions(), { city: candidate.label }));
			writeJSON(KEY_OPTIONS, next);
			if (typeof window !== 'undefined' && window.dispatchEvent) window.dispatchEvent(new CustomEvent(OPTIONS_EVENT));
			if (typeof dwmWeatherRefresh === 'function') dwmWeatherRefresh('manual');
			setCandidates([]);
			dwmSpeak('已切换到 ' + candidate.label, 'important');
		}

		var rows = candidates.map(function (candidate) {
			return h('button', {
				key: 'cand-' + candidate.label + candidate.lat,
				type: 'button',
				className: 'dwm-panel-weather-candidate',
				onClick: function () { pickCity(candidate); },
				style: { display: 'block', width: '100%', textAlign: 'left', margin: '4px 0 0', padding: '6px 10px', cursor: 'pointer', font: 'inherit', borderRadius: '8px', border: '1px solid var(--dsw-alias-border-l2, #e2e4ea)', background: 'var(--dsw-alias-bg-layer-2, #fff)', color: 'var(--dsw-alias-label-primary, #1c1f26)' },
			}, candidate.label);
		});

		return h(
			'div',
			{ className: 'dwm-panel-weather' },
			h('div', { className: 'dwm-panel-weather-line' }, dwmWeatherDescribe(weather, language)),
			h(
				'div',
				{ className: 'dwm-panel-weather-row' },
				h('input', {
					className: 'dwm-panel-weather-input',
					type: 'text',
					defaultValue: readOptions().city,
					placeholder: dwmT('panel.weather.cityPlaceholder', '城市，例如 北京', 'City, e.g. Beijing'),
					'aria-label': dwmT('panel.weather.city', '城市', 'City'),
					onKeyDown: function (event) {
						if (event.key !== 'Enter') return;
						searchCity(event.currentTarget.value);
					},
					onBlur: function (event) {
						commitCity(event.currentTarget.value);
					}
				}),
				h(
					'button',
					{
						type: 'button',
						className: 'dwm-panel-weather-button',
						onClick: function () {
							dwmWeatherRefresh('manual');
						},
					},
					dwmT('panel.weather.refresh', '刷新天气', 'Refresh'),
				),
			),
			rows,
		);
	}


	function check(key, zh, en) {
		return h(
			'label',
			{ className: 'dwm-settings-check' },
			h('input', {
				type: 'checkbox',
				checked: companion[key] === true,
				onChange: function (event) {
					var patch = {};
					patch[key] = event.target.checked;
					commitCompanion(patch);
				}
			}),
			h('span', null, dwmT('panel.switches.' + key, zh, en)),
		);
	}

	return h(
		'div',
		{ className: 'dwm-settings dwm-panel' },
		h(
			'p',
			{ className: 'dwm-settings-hint' },
			dwmT(
				'panel.intro',
				'陪伴与成长：她会跟着你的工作状态换姿势、在合适的时候开口，也会记住你们一起写代码的每一天。所有数据只存在本机。',
				'Companion mode: she follows what the Harness is doing, speaks up at the right moments, and remembers the days you spent coding together. All data stays on this machine.',
			),
		),

		h(
			'div',
			{ className: 'dwm-panel-hero' },
			h('div', { className: 'dwm-panel-level' }, 'Lv' + snapshot.level),
			h(
				'div',
				{ className: 'dwm-panel-hero-text' },
				h('strong', null, dwmT(null, snapshot.bondZh, snapshot.bondEn)),
				h(
					'span',
					null,
					dwmT('panel.hero.achievements', '成就 ', 'Achievements ') +
						snapshot.unlockedCount + '/' + snapshot.totalCount,
				),
			),
		),

		statRow('panel.stats.mood', '心情', 'Mood', Math.round(snapshot.mood) + ' / 100', bar(snapshot.mood, 100, 'mood')),
		statRow('panel.stats.satiety', '饱食', 'Satiety', Math.round(snapshot.satiety) + ' / 100', bar(snapshot.satiety, 100, 'satiety')),
		statRow('panel.stats.affinity', '好感', 'Affinity', Math.round(snapshot.affinity) + ' / 10000', bar(snapshot.affinity, 10000, 'affinity')),
		statRow('panel.stats.companionship', '陪伴时长', 'Time together', dwmFormatDuration(snapshot.companionshipMs)),
		statRow(
			'panel.stats.signinStreak',
			'连续签到',
			'Sign-in streak',
			snapshot.signinStreak + dwmT('panel.stats.days', ' 天', ' d'),
		),

		h('h4', { className: 'dwm-panel-title' }, dwmT('panel.weather.title', '天气陪伴', 'Weather')),
		weatherBlock(),

		h('h4', { className: 'dwm-panel-title' }, dwmT('panel.quests.title', '每日任务', 'Daily quests')),
		questList(),

		h('h4', { className: 'dwm-panel-title' }, dwmT('panel.signin.title', '本周签到', 'This week')),
		signinBoard(),

		h('h4', { className: 'dwm-panel-title' }, dwmT('panel.achievements.title', '成就', 'Achievements')),
		achievementGrid(),

		h('h4', { className: 'dwm-panel-title' }, dwmT('panel.diary.title', '成长日记', 'Diary')),
		diaryList(),

		h('h4', { className: 'dwm-panel-title' }, dwmT('panel.switches.title', '陪伴开关', 'Companion switches')),
		h(
			'div',
			{ className: 'dwm-settings-checks' },
			check('workLink', '工作状态联动', 'Follow the work status'),
			check('chip', '状态提示条', 'Status chip'),
			check('zones', '分区点击与关键词反应', 'Hit zones and keyword reactions'),
			check('care', '主动关怀', 'Proactive care'),
			check('idleChat', '主动闲聊', 'Small talk'),
			check('lateNight', '深夜晚安提醒', 'Late-night reminder'),
		),

		h(
			'div',
			{ className: 'dwm-settings-row' },
			h('span', { className: 'dwm-settings-label' }, dwmT('panel.workSpeech', '工作台词频率', 'Work chatter')),
			h(
				'select',
				{
					value: companion.workSpeech,
					'aria-label': dwmT('panel.workSpeech', '工作台词频率', 'Work chatter'),
					onChange: function (event) {
						commitCompanion({ workSpeech: event.target.value });
					}
				},
				h('option', { value: 'chatty' }, dwmT('panel.workSpeech.chatty', '话痨（15–40 秒）', 'Chatty (15–40 s)')),
				h('option', { value: 'quiet' }, dwmT('panel.workSpeech.quiet', '安静（90–240 秒）', 'Quiet (90–240 s)')),
				h('option', { value: 'off' }, dwmT('panel.workSpeech.off', '关闭', 'Off')),
			),
		),

		h(
			'div',
			{ className: 'dwm-settings-row' },
			h(
				'div',
				{ className: 'dwm-settings-row-head' },
				h('span', { className: 'dwm-settings-label' }, dwmT('panel.workHold', '信号中断钉住', 'Hold after a signal drops')),
				h('span', { className: 'dwm-settings-value' }, formatNumber(companion.workHold / 1000, 1) + ' s'),
			),
			h('input', {
				type: 'range',
				min: 0,
				max: 20000,
				step: 500,
				value: companion.workHold,
				'aria-label': dwmT('panel.workHold', '信号中断钉住', 'Hold after a signal drops'),
				onChange: function (event) {
					commitCompanion({ workHold: Number(event.target.value) });
				}
			}),
		),

		h('h4', { className: 'dwm-panel-title' }, dwmT('panel.try.title', '试一试', 'Try it')),
		h(SaveBlock, { key: 'dwm-save' }),
		h(
			'div',
			{ className: 'dwm-settings-actions' },
			h(
				'button',
				{
					type: 'button',
					onClick: function () {
						dwmForceState('think', 0, true);
						dwmChip(dwmWorkChipText('thinking', language), 'work', 2400);
					}
				},
				dwmT('panel.try.thinking', '思考中', 'Thinking'),
			),
			h(
				'button',
				{
					type: 'button',
					onClick: function () {
						dwmForceState('play', 0, true);
						dwmChip(dwmWorkChipText('tool', language), 'work', 2400);
					}
				},
				dwmT('panel.try.working', '工作中的陪伴', 'Companion while working'),
			),
			h(
				'button',
				{
					type: 'button',
					onClick: function () {
						dwmForceState('joy', 1500);
						dwmChip(dwmWorkChipText('success', language), 'ok', 2200);
						dwmFx('star', 3);
					}
				},
				dwmT('panel.try.done', '完成', 'Done'),
			),
			h(
				'button',
				{
					type: 'button',
					onClick: function () {
						dwmForceState('drag', 2000);
						dwmChip(dwmWorkChipText('failure', language), 'error', 2600);
						dwmFx('sparkle', 2);
					}
				},
				dwmT('panel.try.error', '出错', 'Error'),
			),
			h(
				'button',
				{
					type: 'button',
					onClick: function () {
						dwmSpeak(dwmPickLine('chat' + DWM_CARE.topic.charAt(0).toUpperCase() + DWM_CARE.topic.slice(1), language) || dwmPickLine('chatGeneral', language));
					}
				},
				dwmT('panel.try.chat', '说一句闲聊', 'Say something'),
			),
			h(
				'button',
				{
					type: 'button',
					onClick: function () {
						dwmSpeak(dwmPickLine('careLongSit', language));
					}
				},
				dwmT('panel.try.care', '试一句关怀', 'Try a care line'),
			),
			h(
				'button',
				{
					type: 'button',
					onClick: function () {
						dwmGrowthReset();
						setSnapshot(dwmGrowthSnapshot());
						dwmChip(dwmT('panel.try.growthReset', '成长数据已重置', 'Growth data reset'), 'info', 2400);
					}
				},
				dwmT('panel.try.resetGrowth', '重置成长数据', 'Reset growth data'),
			),
		),
	);
}
