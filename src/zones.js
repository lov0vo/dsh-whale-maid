/*
 * dsh-whale-maid — hit zones and tap easter egg (added in 1.1.0).
 *
 * A tap is resolved to a body zone (head / belly / tail) from normalised
 * coordinates inside the sprite frame, so the reaction stays correct at any
 * pet size. Three quick taps in a row trigger the triple-tap celebration.
 *
 * This module is deliberately read-only with respect to the pet's own click
 * handling: it never calls preventDefault / stopPropagation and never forces a
 * pose, so dragging, the menu, the greet bubble and the sleep timer all keep
 * behaving exactly as before. Zone reactions speak through the status chip and
 * the particle layer instead of the speech bubble, which also avoids two
 * bubbles fighting over the same slot.
 *
 * Zone rectangles are tuned to this artwork (see src/sprites/*.png): the tail
 * sweeps to the right of the body, the headdress occupies the top third.
 */

var DWM_ZONES = [
	{ id: 'tail', x0: 0.55, y0: 0.5, x1: 1.0, y1: 0.92 },
	{ id: 'head', x0: 0.18, y0: 0.0, x1: 0.82, y1: 0.42 },
	{ id: 'belly', x0: 0.18, y0: 0.42, x1: 0.82, y1: 0.76 }
];

var DWM_ZONE_BANK = { head: 'patHead', belly: 'patBelly', tail: 'patTail' };
var DWM_ZONE_FX = { head: 'heart', belly: 'sparkle', tail: 'note' };

var DWM_ZONE_STATE = {
	element: null,
	downAt: 0,
	downX: 0,
	downY: 0,
	tapTimes: [],
	onDown: null,
	onUp: null
};

function dwmHitZone(nx, ny) {
	for (var i = 0; i < DWM_ZONES.length; i++) {
		var zone = DWM_ZONES[i];
		if (nx >= zone.x0 && nx <= zone.x1 && ny >= zone.y0 && ny <= zone.y1) return zone.id;
	}
	return 'head';
}

function dwmZoneReact(zone) {
	var companion = dwmReadCompanion();
	if (!companion.zones) return;
	var language = dwmUiLanguage();
	var bank = DWM_ZONE_BANK[zone] || 'patHead';
	var now = dwmNow();

	/* triple tap: three taps within 1.2 s */
	var taps = DWM_ZONE_STATE.tapTimes;
	taps.push(now);
	while (taps.length > 0 && now - taps[0] > 1200) taps.shift();
	if (taps.length >= 3) {
		DWM_ZONE_STATE.tapTimes = [];
		dwmGrowthApply('triple');
		dwmFx('star', 5);
		dwmFx('heart', 3);
		if (companion.chip) dwmChip(dwmPickLine('triple', language), 'mood', 2600);
		return;
	}

	var type = zone === 'belly' ? 'pat-belly' : zone === 'tail' ? 'pat-tail' : 'pat-head';
	dwmGrowthApply(type);
	dwmFx(DWM_ZONE_FX[zone] || 'heart', 2);
	if (companion.chip) dwmChip(dwmPickLine(bank, language), 'mood', 2400);
}

function dwmAttachZones(element) {
	dwmDetachZones();
	if (!element) return;
	var state = DWM_ZONE_STATE;
	state.element = element;

	state.onDown = function (event) {
		state.downAt = dwmNow();
		state.downX = event.clientX;
		state.downY = event.clientY;
	};

	state.onUp = function (event) {
		if (!state.downAt) return;
		var elapsed = dwmNow() - state.downAt;
		var dx = event.clientX - state.downX;
		var dy = event.clientY - state.downY;
		state.downAt = 0;
		/* a drag must never count as a tap */
		if (elapsed > 600) return;
		if (dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD) return;
		var rect = element.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return;
		var nx = (event.clientX - rect.left) / rect.width;
		var ny = (event.clientY - rect.top) / rect.height;
		DWM_RUNTIME.lastInteractionAt = dwmNow();
		dwmZoneReact(dwmHitZone(nx, ny));
	};

	element.addEventListener('pointerdown', state.onDown, true);
	element.addEventListener('pointerup', state.onUp, true);
}

function dwmDetachZones() {
	var state = DWM_ZONE_STATE;
	if (state.element) {
		if (state.onDown) state.element.removeEventListener('pointerdown', state.onDown, true);
		if (state.onUp) state.element.removeEventListener('pointerup', state.onUp, true);
	}
	state.element = null;
	state.onDown = null;
	state.onUp = null;
	state.downAt = 0;
}
