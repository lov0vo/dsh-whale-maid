/**
 * dsh-whale-maid — Host half.
 *
 * Every contribution of this bundle is client-side: the pet is a React component
 * registered into the `shell.overlay` slot, and its options panel into
 * `settings.section`. See `client.js` (generated from `src/` by `build.mjs`).
 *
 * This row therefore mounts nothing on the Host. It exists so the Loader mounts
 * the package and the Client module loader can read the `dsh.client` section of
 * the manifest, exactly like the official `templates/decoration` bundle.
 *
 * No Cordis `Config` schema is declared on purpose: the pet's tunables are user
 * preferences (size, speed, language, idle behaviour), they live in the
 * renderer's localStorage, and they are edited from the settings section rather
 * than from a bundle patch. Declaring a Host schema for them would give the same
 * values two sources of truth.
 */

export const name = 'dsh-whale-maid';

export function apply() {
	/* Intentionally empty — the Client module owns all behaviour. */
}
