/*
 * dsh-whale-maid — status chip and particle layer (added in 1.1.0).
 *
 * Two tiny presentational components, mounted as extra children of the existing
 * `.dwm-root` node so they inherit its position and never escape the overlay:
 *
 *   DwmFxLayer   the particle layer (hearts / stars / sparkles / notes).
 *
 * 1.3.0 removed the separate status chip: every line the pet says now goes
 * through the single speech bubble, so there is never more than one bubble
 * on screen.
 *
 * Both subscribe to window events and keep their own state, so the pet component
 * does not have to re-render when a particle spawns.
 */

var DWM_FX_GLYPH = { heart: '♥', star: '★', sparkle: '✦', note: '♪', rain: '☔', snow: '❄' };
var DWM_FX_LIFETIME = 1500;

function DwmFxLayer() {
	var React_ = React;
	var useState = React_.useState;
	var useEffect = React_.useEffect;

	var listState = useState([]);
	var list = listState[0];
	var setList = listState[1];

	useEffect(function () {
		if (prefersReducedMotion()) return undefined;
		var timers = [];
		function onFx(event) {
			var detail = event && event.detail ? event.detail : {};
			var kind = DWM_FX_GLYPH[detail.kind] ? detail.kind : 'heart';
			var count = Math.max(1, Math.min(8, Number(detail.count) || 1));
			var batch = [];
			for (var i = 0; i < count; i++) {
				batch.push({
					id: dwmNow() + Math.random() + i,
					kind: kind,
					left: Math.round(Math.random() * 44 - 22),
					drift: Math.round(Math.random() * 30 - 15),
					delay: Math.round(Math.random() * 120)
				});
			}
			setList(function (current) {
				var next = current.concat(batch);
				while (next.length > 24) next.shift();
				return next;
			});
			timers.push(
				setTimeout(function () {
					setList(function (current) {
						var ids = {};
						for (var b = 0; b < batch.length; b++) ids[batch[b].id] = true;
						return current.filter(function (item) {
							return !ids[item.id];
						});
					});
				}, DWM_FX_LIFETIME),
			);
		}
		window.addEventListener(DWM_EVENT_FX, onFx);
		return function () {
			window.removeEventListener(DWM_EVENT_FX, onFx);
			for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
		};
	}, []);

	if (list.length === 0) return null;
	return h(
		'span',
		{ className: 'dwm-fx-layer', 'aria-hidden': 'true' },
		list.map(function (item) {
			return h(
				'span',
				{
					key: item.id,
					className: 'dwm-fx dwm-fx-' + item.kind,
					style: {
						left: 'calc(50% + ' + item.left + 'px)',
						'--dwm-fx-drift': item.drift + 'px',
						animationDelay: item.delay + 'ms'
					}
				},
				DWM_FX_GLYPH[item.kind],
			);
		}),
	);
}
