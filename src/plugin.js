/*
 * dsh-whale-maid — client registration.
 *
 * Three contributions, all through slots:
 *   1. the sprite stylesheet, injected once and removed on unload;
 *   2. the pet itself, registered into `shell.overlay` — the frame-wide overlay
 *      slot, which is the documented seat for an overlay whose placement is
 *      known. The pet is `position: fixed` and wanders the whole viewport, so it
 *      must outlive any single panel;
 *   3. a settings section, so the parameters the extraction exposed are
 *      adjustable in-product.
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
		say: function (message) {
			window.dispatchEvent(new CustomEvent(SAY_EVENT, { detail: { text: String(message) } }));
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
			[KEY_POS, KEY_FEEDS, KEY_GREETED, KEY_OPTIONS].forEach(function (key) {
				try {
					window.localStorage.removeItem(key);
				} catch (error) {
					/* ignore */
				}
			});
			window.dispatchEvent(new CustomEvent(RESET_POS_EVENT));
			window.dispatchEvent(new CustomEvent(OPTIONS_EVENT));
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
				id: 'dsh-whale-maid',
				order: 60,
				label: function () {
					return resolveLanguage(readOptions().language) === 'zh' ? '鲸鱼女仆' : 'Whale girl';
				},
			},
			SettingsSection,
		);
	});

	ctx.effect(function () {
		window.dshWhaleMaid = createPublicApi();
		return function () {
			delete window.dshWhaleMaid;
		};
	}, 'dsh-whale-maid: public API');
}
