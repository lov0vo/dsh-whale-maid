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
 * Zone rectangles are measured from this artwork, not eyeballed: see the
 * measurement block below, taken from src/sprites/idle.png frame 0.
 */

/*
 * Measured geometry — src/sprites/idle.png, frame 0 of the horizontal sheet
 * (768x256 = 3 frames of 256x256, frame 0 = source x 0..255). Measured with
 * Pillow from the alpha channel plus colour masks (skin / white cloth / dark
 * navy) on 2026-10-26. All values are frame pixels, 0..255, origin top-left.
 *
 *   alpha bounding box ....... x  29..227   y  31..255   (art never fills the frame)
 *   ahoge ("horn") ........... x  84..112   y  31..47    (topmost ink; only thing above y 43)
 *   headdress white frill .... x  52..155   y  43..79
 *   fin ear, left ............ x  31..50    y 106..128   (tip x 31 at y 116)
 *   fin ear, right ........... x 163..188   y  98..130   (tip x 188 at y 122)
 *   face skin, brow -> chin .. x  69..127   y 102..145
 *   head incl. hair+frill+fins x  31..190   y  43..168
 *   hand, left (skin) ........ x  49..59    y 195..206
 *   hand, right (skin) ....... x 143..159   y 195..209
 *   waist belt (2 buttons) ... x  66..146   y 172..183   (solid dark band at y 174..182)
 *   apron / belly ............ x  54..158   y 179..228
 *   feet (two shoes) ......... x  83..127   y 236..255   (shoes are clipped by the frame edge)
 *   tail (stem + fluke) ...... x 168..227   y 130..205   (fluke tip x 227 at y 148)
 *
 * Each rect below is that band / 256, rounded to 3 decimals, plus 2..6 px of
 * hit padding so thin parts (ahoge, hands, belt) stay tappable at small pet
 * sizes. `horn` and `tail` also take the empty frame margin outside the art:
 * nothing is drawn there, so a tap on the sprite box's top/right edge belongs
 * to the nearest part instead of falling through to the belly default.
 *
 * Order is top-down and the FIRST match wins, so a narrow part must be listed
 * before the broad band that contains it:
 *   - ear / face before head   (both sit inside the head block);
 *   - waist before hand/belly  (the belt is a 12 px band inside the torso; it
 *     used to be listed after belly, which made it unreachable);
 *   - hand before belly        (the hands sit on the belly band's outer edges);
 *   - tail near the end        (no body rect reaches past x 0.625, so the
 *     right-hand sweep cannot be shadowed by the dress).
 * `head` appears three times: the headdress/upper-hair band, then the two long
 * side strands that hang beside the face.
 */
var DWM_ZONES = [
	/* ahoge — the only ink above y 43, padded up to the frame edge */
	{ id: 'horn', x0: 0.300, y0: 0.000, x1: 0.550, y1: 0.200 },
	/* fin ears, left then right */
	{ id: 'ear', x0: 0.115, y0: 0.400, x1: 0.205, y1: 0.520 },
	{ id: 'ear', x0: 0.625, y0: 0.375, x1: 0.745, y1: 0.520 },
	/* face skin oval (brow y 102 -> chin y 145), inside the head block */
	{ id: 'face', x0: 0.265, y0: 0.395, x1: 0.500, y1: 0.575 },
	/* headdress frill + hair above the brow, full head width */
	{ id: 'head', x0: 0.120, y0: 0.155, x1: 0.720, y1: 0.395 },
	/* long side strands hanging beside the face */
	{ id: 'head', x0: 0.115, y0: 0.395, x1: 0.230, y1: 0.660 },
	{ id: 'head', x0: 0.550, y0: 0.395, x1: 0.650, y1: 0.660 },
	/* waist belt, the narrow band between bodice and apron */
	{ id: 'waist', x0: 0.258, y0: 0.656, x1: 0.570, y1: 0.734 },
	/* hands rest at the skirt line, on the belly band's outer edges */
	{ id: 'hand', x0: 0.180, y0: 0.750, x1: 0.245, y1: 0.820 },
	{ id: 'hand', x0: 0.545, y0: 0.750, x1: 0.635, y1: 0.825 },
	/* apron + skirt */
	{ id: 'belly', x0: 0.200, y0: 0.700, x1: 0.625, y1: 0.900 },
	/* whale tail sweeping to the right of the dress */
	{ id: 'tail', x0: 0.650, y0: 0.490, x1: 1.000, y1: 0.900 },
	/* shoes, clipped by the frame's bottom edge */
	{ id: 'feet', x0: 0.320, y0: 0.910, x1: 0.510, y1: 1.000 }
];

var DWM_ZONE_BANK = {
	head: 'patHead', horn: 'patHorn', ear: 'patEar', face: 'patFace',
	belly: 'patBelly', hand: 'patHand', waist: 'patWaist', feet: 'patFeet',
	tail: 'patTail'
};
var DWM_ZONE_FX = {
	head: 'heart', belly: 'sparkle', tail: 'note',
	horn: 'sparkle', ear: 'heart', hand: 'heart',
	feet: 'note', waist: 'heart', face: 'heart'
};

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
	return 'belly';
}

function dwmZoneReact(zone) {
	var companion = dwmReadCompanion();
	if (!companion.zones) return;
	var language = dwmUiLanguage();
	var bank = DWM_ZONE_BANK[zone] || 'patHead';
	var now = dwmNow();
	/* Remember the tap so the pet's own click handler does not talk over it. */
	DWM_RUNTIME.lastZoneAt = now;

	/* triple tap: three taps within 1.2 s */
	var taps = DWM_ZONE_STATE.tapTimes;
	taps.push(now);
	while (taps.length > 0 && now - taps[0] > 1200) taps.shift();
	if (taps.length >= 3) {
		DWM_ZONE_STATE.tapTimes = [];
		dwmGrowthApply('triple');
		dwmFx('star', 5);
		dwmFx('heart', 3);
		dwmSpeak(dwmPickLine('triple', language));
		return;
	}

	var type = 'pat-' + zone;
	dwmGrowthApply(type);
	dwmFx(DWM_ZONE_FX[zone] || 'heart', 2);
	dwmSpeak(dwmPickLine(bank, language));
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
