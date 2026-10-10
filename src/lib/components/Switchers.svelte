<script lang="ts">
	import { playSceneSound } from '#lib/audio/index.ts';
	import { placeVars } from '#lib/scene/layout.ts';
	import { PALETTES } from '#lib/scene/palettes.ts';
	import { theme } from '#lib/theme/theme.svelte.ts';

	interface Props {
		/** Lifts the clock or swatch sprite by a pixel while its button is hovered or focused. */
		lift?: (sprite: 'clock' | 'swatch', on: boolean) => void;
	}

	let { lift }: Props = $props();

	const clockStyle = placeVars('clock');
	const swatchStyle = placeVars('swatch');

	const clockLabel = $derived(
		theme.override
			? `Time of day: ${theme.override}`
			: `Time of day: following your clock (${theme.clock})`
	);
	const swatchLabel = $derived(`Palette: ${PALETTES[theme.palette].name}`);

	// Announced after a click, so screen readers hear the new state without refocusing.
	let announcement = $state('');

	function stepTime() {
		theme.nextTime();
		announcement = clockLabel;
	}

	function stepPalette() {
		theme.nextPalette();
		playSceneSound('palette-change');
		announcement = swatchLabel;
	}

	const hover = (sprite: 'clock' | 'swatch') => ({
		onpointerenter: () => lift?.(sprite, true),
		onpointerleave: () => lift?.(sprite, false),
		onfocus: () => lift?.(sprite, true),
		onblur: () => lift?.(sprite, false)
	});
</script>

<button
	type="button"
	class="switcher in-room"
	style={clockStyle}
	aria-label={clockLabel}
	onclick={stepTime}
	{...hover('clock')}
>
	<span class="scene-tip" aria-hidden="true">{clockLabel}</span>
</button>
<button
	type="button"
	class="switcher in-room"
	style={swatchStyle}
	aria-label={swatchLabel}
	onclick={stepPalette}
	{...hover('swatch')}
>
	<span class="scene-tip" aria-hidden="true">{swatchLabel}</span>
</button>
<span class="sr-only" aria-live="polite">{announcement}</span>

<style>
	.switcher {
		display: block;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}

	.switcher:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	/* Without the scene (no JavaScript) there is nothing to switch. */
	:global(:root:not([data-layout])) .switcher {
		display: none;
	}
</style>
