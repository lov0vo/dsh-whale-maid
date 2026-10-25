/*
 * dsh-whale-maid — settings panel.
 *
 * The store site had no configuration UI: the pet was hard-wired. This panel is
 * the one place the plugin adds behaviour of its own, so the parameters the
 * extraction exposed (size, animation speed, language, idle life, bubble
 * duration) are adjustable in-product instead of only from the dev console.
 *
 * It registers into the `settings.section` slot, so it appears as a section in
 * the Harness settings page. Every change is written to localStorage and a
 * `dsh-whale-maid:options` event is dispatched, which the live pet listens to —
 * adjustments apply immediately, without a reload.
 */

var SIZE_AUTO = 'auto';

function formatNumber(value, digits) {
	var rounded = Math.round(value * Math.pow(10, digits)) / Math.pow(10, digits);
	return String(rounded);
}

function SettingsSection() {
	var React_ = React;
	var useState = React_.useState;
	var useEffect = React_.useEffect;

	var optionsState = useState(readOptions);
	var options = optionsState[0];
	var setOptions = optionsState[1];

	var feedsState = useState(function () {
		var value = Number(readRaw(KEY_FEEDS));
		return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
	});
	var feeds = feedsState[0];
	var setFeeds = feedsState[1];

	useEffect(function () {
		function sync() {
			setOptions(readOptions());
			var value = Number(readRaw(KEY_FEEDS));
			setFeeds(Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);
		}
		window.addEventListener(OPTIONS_EVENT, sync);
		return function () {
			window.removeEventListener(OPTIONS_EVENT, sync);
		};
	}, []);

	var language = resolveLanguage(options.language);
	var text = TEXTS[language];
	var isZh = language === 'zh';
	function label(zh, en) {
		return isZh ? zh : en;
	}

	function commit(patch) {
		var next = normalizeOptions(Object.assign({}, readOptions(), patch));
		writeJSON(KEY_OPTIONS, next);
		setOptions(next);
		window.dispatchEvent(new CustomEvent(OPTIONS_EVENT));
	}

	var autoSize = options.size === null;
	var sizeValue = options.size === null ? 110 : options.size;

	function sizeRow() {
		return h(
			'div',
			{ className: 'dwm-settings-row' },
			h(
				'div',
				{ className: 'dwm-settings-row-head' },
				h('span', { className: 'dwm-settings-label' }, label('尺寸', 'Size')),
				h(
					'span',
					{ className: 'dwm-settings-value' },
					autoSize ? label('自动（110px，窄屏 72px）', 'Auto (110px, 72px when narrow)') : sizeValue + ' px',
				),
			),
			h('input', {
				type: 'range',
				min: 24,
				max: 320,
				step: 2,
				value: sizeValue,
				disabled: autoSize,
				'aria-label': label('尺寸', 'Size'),
				onChange: function (event) {
					commit({ size: Number(event.target.value) });
				},
			}),
			h(
				'label',
				{ className: 'dwm-settings-check' },
				h('input', {
					type: 'checkbox',
					checked: autoSize,
					onChange: function (event) {
						commit({ size: event.target.checked ? null : sizeValue });
					},
				}),
				h('span', null, label('跟随响应式默认值', 'Use the responsive default')),
			),
		);
	}

	function rangeRow(key, zhTitle, enTitle, min, max, step, digits, format) {
		var value = options[key];
		return h(
			'div',
			{ className: 'dwm-settings-row' },
			h(
				'div',
				{ className: 'dwm-settings-row-head' },
				h('span', { className: 'dwm-settings-label' }, label(zhTitle, enTitle)),
				h('span', { className: 'dwm-settings-value' }, format ? format(value) : formatNumber(value, digits)),
			),
			h('input', {
				type: 'range',
				min: min,
				max: max,
				step: step,
				value: value,
				'aria-label': label(zhTitle, enTitle),
				onChange: function (event) {
					var patch = {};
					patch[key] = Number(event.target.value);
					commit(patch);
				},
			}),
		);
	}

	function check(key, zhTitle, enTitle) {
		return h(
			'label',
			{ className: 'dwm-settings-check' },
			h('input', {
				type: 'checkbox',
				checked: options[key] === true,
				onChange: function (event) {
					var patch = {};
					patch[key] = event.target.checked;
					commit(patch);
				},
			}),
			h('span', null, label(zhTitle, enTitle)),
		);
	}

	return h(
		'div',
		{ className: 'dwm-settings' },
		h(
			'p',
			{ className: 'dwm-settings-hint' },
			label(
				'鲸鱼女仆桌宠取自 1024Store 插件市场的角色动画。拖动可移动，单击打招呼并展开「喂食 / 玩耍」，闲置会自动发呆、漫步并睡着。',
				'The whale girl is ported from the 1024Store plugin-market character. Drag to move, click to greet and open Feed / Play; left alone she thinks, wanders and falls asleep.',
			),
		),
		sizeRow(),
		rangeRow('speed', '动画速度', 'Animation speed', 0.2, 3, 0.1, 1, function (value) {
			return formatNumber(value, 1) + '×';
		}),
		rangeRow('bubbleDuration', '气泡停留', 'Bubble duration', 1000, 10000, 250, 0, function (value) {
			return formatNumber(value / 1000, 2) + ' s';
		}),
		h(
			'div',
			{ className: 'dwm-settings-row' },
			h('span', { className: 'dwm-settings-label' }, label('气泡语言', 'Bubble language')),
			h(
				'select',
				{
					value: options.language,
					'aria-label': label('气泡语言', 'Bubble language'),
					onChange: function (event) {
						commit({ language: event.target.value });
					},
				},
				h('option', { value: 'auto' }, label('跟随界面', 'Follow the interface')),
				h('option', { value: 'zh' }, '中文'),
				h('option', { value: 'en' }, 'English'),
			),
		),
		h(
			'div',
			{ className: 'dwm-settings-checks' },
			check('greeting', '首次出现时打招呼', 'Greet on first appearance'),
			check('walk', '自己散步', 'Wander on her own'),
			check('sleep', '闲置后打瞌睡', 'Doze off when idle'),
		),
		h(
			'div',
			{ className: 'dwm-settings-actions' },
			h(
				'button',
				{
					type: 'button',
					onClick: function () {
						window.dispatchEvent(
							new CustomEvent(SAY_EVENT, { detail: { text: pick(options.greetings || text.greeting) } }),
						);
					},
				},
				label('预览一句台词', 'Preview a line'),
			),
			h(
				'button',
				{
					type: 'button',
					onClick: function () {
						window.dispatchEvent(new CustomEvent(RESET_POS_EVENT));
					},
				},
				label('回到右下角', 'Send her back to the corner'),
			),
			h(
				'button',
				{
					type: 'button',
					onClick: function () {
						commit(DEFAULT_OPTIONS);
					},
				},
				label('恢复默认参数', 'Reset options'),
			),
			h(
				'button',
				{
					type: 'button',
					onClick: function () {
						try {
							window.localStorage.removeItem(KEY_FEEDS);
						} catch (error) {
							/* ignore */
						}
						setFeeds(0);
					},
				},
				label('清零投喂计数（当前 ' + feeds + '）', 'Clear the feed counter (now ' + feeds + ')'),
			),
		),
	);
}
