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
 */

function dwmFormatDuration(ms) {
	var total = Math.max(0, Math.floor(Number(ms) || 0) / 1000);
	var days = Math.floor(total / 86400);
	var hours = Math.floor((total - days * 86400) / 3600);
	var minutes = Math.floor((total - days * 86400 - hours * 3600) / 60);
	if (days > 0) return days + (dwmUiLanguage() === 'zh' ? ' 天 ' : 'd ') + hours + (dwmUiLanguage() === 'zh' ? ' 小时' : ' h');
	if (hours > 0) return hours + (dwmUiLanguage() === 'zh' ? ' 小时 ' : ' h ') + minutes + (dwmUiLanguage() === 'zh' ? ' 分' : ' m');
	return minutes + (dwmUiLanguage() === 'zh' ? ' 分钟' : ' min');
}

function CompanionPanel() {
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
		var timer = setInterval(refresh, 5000);
		return function () {
			window.removeEventListener(DWM_EVENT_GROWTH, refresh);
			window.removeEventListener(DWM_EVENT_COMPANION, refresh);
			clearInterval(timer);
		};
	}, []);

	var language = dwmUiLanguage();
	var isZh = language === 'zh';
	function label(zh, en) {
		return isZh ? zh : en;
	}

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

	function statRow(zh, en, value, extra) {
		return h(
			'div',
			{ className: 'dwm-panel-stat' },
			h('span', { className: 'dwm-panel-stat-label' }, label(zh, en)),
			h('span', { className: 'dwm-panel-stat-value' }, value),
			extra || null,
		);
	}

	/* --- quests --------------------------------------------------------- */
	function questList() {
		if (snapshot.quests.length === 0) return h('p', { className: 'dwm-panel-muted' }, label('今天没有任务', 'No quests today'));
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
						label(quest.zh, quest.en) + ' ' + quest.progress + '/' + quest.target,
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
										label('任务完成！', 'Quest done!'),
										'ok',
										2400,
									);
									dwmFx('star', 3);
								}
							}
						},
						quest.claimed ? label('已领取', 'Claimed') : quest.ready ? label('领取', 'Claim') : label('进行中', 'In progress'),
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
							dwmChip(label('签到成功', 'Checked in'), 'ok', 2400);
							dwmFx('heart', 2);
						} else {
							dwmChip(label('今天已经签过了', 'Already checked in today'), 'info', 2200);
						}
					}
				},
				label('打卡签到', 'Check in'),
			),
		);
	}

	/* --- achievements ----------------------------------------------------- */
	function achievementGrid() {
		return h(
			'div',
			{ className: 'dwm-panel-achievements' },
			snapshot.achievements.map(function (entry) {
				return h(
					'span',
					{
						key: entry.id,
						className: 'dwm-ach' + (entry.unlocked ? ' is-on' : ''),
						title: label(entry.zh, entry.en) + (entry.unlocked ? '' : label('（未解锁）', ' (locked)'))
					},
					h('span', { className: 'dwm-ach-icon' }, entry.icon),
					h('span', { className: 'dwm-ach-name' }, label(entry.zh, entry.en)),
				);
			}),
		);
	}

	/* --- diary ------------------------------------------------------------ */
	function diaryList() {
		if (snapshot.diary.length === 0) return h('p', { className: 'dwm-panel-muted' }, label('还没有记录', 'Nothing recorded yet'));
		return h(
			'ul',
			{ className: 'dwm-panel-diary' },
			snapshot.diary.slice(0, 6).map(function (entry) {
				return h('li', { key: entry.at + '-' + entry.kind }, label(entry.zh, entry.en));
			}),
		);
	}

	function commitCity(raw) {
		var next = String(raw === undefined || raw === null ? '' : raw).trim();
		if (next === '') next = DWM_WEATHER_DEFAULT_CITY;
		if (next === readOptions().city) return;
		var merged = normalizeOptions(Object.assign({}, readOptions(), { city: next }));
		writeJSON(KEY_OPTIONS, merged);
		window.dispatchEvent(new CustomEvent(OPTIONS_EVENT));
		dwmWeatherRefresh('city');
	}

	function weatherBlock() {
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
					placeholder: label('城市，例如 北京', 'City, e.g. Beijing'),
					'aria-label': label('城市', 'City'),
					onKeyDown: function (event) {
						if (event.key !== 'Enter') return;
						commitCity(event.currentTarget.value);
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
						}
					},
					label('刷新天气', 'Refresh'),
				)
			)
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
			h('span', null, label(zh, en)),
		);
	}

	return h(
		'div',
		{ className: 'dwm-settings dwm-panel' },
		h(
			'p',
			{ className: 'dwm-settings-hint' },
			label(
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
				h('strong', null, label(snapshot.bondZh, snapshot.bondEn)),
				h('span', null, label('成就 ', 'Achievements ') + snapshot.unlockedCount + '/' + snapshot.totalCount),
			),
		),

		statRow('心情', 'Mood', Math.round(snapshot.mood) + ' / 100', bar(snapshot.mood, 100, 'mood')),
		statRow('饱食', 'Satiety', Math.round(snapshot.satiety) + ' / 100', bar(snapshot.satiety, 100, 'satiety')),
		statRow('好感', 'Affinity', Math.round(snapshot.affinity) + ' / 10000', bar(snapshot.affinity, 10000, 'affinity')),
		statRow('陪伴时长', 'Time together', dwmFormatDuration(snapshot.companionshipMs)),
		statRow('连续签到', 'Sign-in streak', snapshot.signinStreak + label(' 天', ' d')),

		h('h4', { className: 'dwm-panel-title' }, label('天气陪伴', 'Weather')),
		weatherBlock(),

		h('h4', { className: 'dwm-panel-title' }, label('每日任务', 'Daily quests')),
		questList(),

		h('h4', { className: 'dwm-panel-title' }, label('本周签到', 'This week')),
		signinBoard(),

		h('h4', { className: 'dwm-panel-title' }, label('成就', 'Achievements')),
		achievementGrid(),

		h('h4', { className: 'dwm-panel-title' }, label('成长日记', 'Diary')),
		diaryList(),

		h('h4', { className: 'dwm-panel-title' }, label('陪伴开关', 'Companion switches')),
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
			h('span', { className: 'dwm-settings-label' }, label('工作台词频率', 'Work chatter')),
			h(
				'select',
				{
					value: companion.workSpeech,
					'aria-label': label('工作台词频率', 'Work chatter'),
					onChange: function (event) {
						commitCompanion({ workSpeech: event.target.value });
					}
				},
				h('option', { value: 'chatty' }, label('话痨（15–40 秒）', 'Chatty (15–40 s)')),
				h('option', { value: 'quiet' }, label('安静（90–240 秒）', 'Quiet (90–240 s)')),
				h('option', { value: 'off' }, label('关闭', 'Off')),
			),
		),

		h(
			'div',
			{ className: 'dwm-settings-row' },
			h(
				'div',
				{ className: 'dwm-settings-row-head' },
				h('span', { className: 'dwm-settings-label' }, label('信号中断钉住', 'Hold after a signal drops')),
				h('span', { className: 'dwm-settings-value' }, formatNumber(companion.workHold / 1000, 1) + ' s'),
			),
			h('input', {
				type: 'range',
				min: 0,
				max: 20000,
				step: 500,
				value: companion.workHold,
				'aria-label': label('信号中断钉住', 'Hold after a signal drops'),
				onChange: function (event) {
					commitCompanion({ workHold: Number(event.target.value) });
				}
			}),
		),

		h('h4', { className: 'dwm-panel-title' }, label('试一试', 'Try it')),
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
				label('思考中', 'Thinking'),
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
				label('工作中', 'Working'),
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
				label('完成', 'Done'),
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
				label('出错', 'Error'),
			),
			h(
				'button',
				{
					type: 'button',
					onClick: function () {
						dwmSpeak(dwmPickLine('chat' + DWM_CARE.topic.charAt(0).toUpperCase() + DWM_CARE.topic.slice(1), language) || dwmPickLine('chatGeneral', language));
					}
				},
				label('说一句闲聊', 'Say something'),
			),
			h(
				'button',
				{
					type: 'button',
					onClick: function () {
						dwmSpeak(dwmPickLine('careLongSit', language));
					}
				},
				label('试一句关怀', 'Try a care line'),
			),
			h(
				'button',
				{
					type: 'button',
					onClick: function () {
						dwmGrowthReset();
						setSnapshot(dwmGrowthSnapshot());
						dwmChip(label('成长数据已重置', 'Growth data reset'), 'info', 2400);
					}
				},
				label('重置成长数据', 'Reset growth data'),
			),
		),
	);
}
