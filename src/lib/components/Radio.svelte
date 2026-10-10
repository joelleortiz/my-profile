<script lang="ts">
	import { onMount } from 'svelte';
	import {
		chooseSound,
		isSoundOn,
		setTimeOfDay,
		startSoundAtFirstGesture,
		wantsSound
	} from '#lib/audio/index.ts';
	import { placeVars, SCENE } from '#lib/scene/layout.ts';
	import { CROSSFADE_SECONDS } from '#lib/scene/time.ts';
	import { theme } from '#lib/theme/theme.svelte.ts';

	interface Props {
		/** Tells the scene whether to draw the radio on (lit dial, sound waves) or off. */
		onchange?: (on: boolean) => void;
	}

	let { onchange }: Props = $props();

	// It stands somewhere else on the desk in the phone layout, so it is placed per layout.
	const style = placeVars('radio', SCENE.insets.radio);

	let on = $state(true);
	let firstTime = true;
	let button: HTMLButtonElement;

	onMount(() => {
		on = wantsSound();
		if (on) return startSoundAtFirstGesture(button);
	});

	$effect(() => {
		setTimeOfDay(theme.time, firstTime ? 0 : CROSSFADE_SECONDS);
		firstTime = false;
	});

	$effect(() => onchange?.(on));

	async function toggle() {
		const request = chooseSound(!on);
		on = isSoundOn();
		await request.catch(() => {});
		on = isSoundOn();
	}
</script>

<button
	type="button"
	class="radio in-scene in-room"
	aria-label="Sound"
	aria-pressed={on}
	onclick={toggle}
	bind:this={button}
	{style}
>
	<span class="scene-tip" aria-hidden="true">{on ? 'Turn sound off' : 'Turn sound on'}</span>
</button>

<style>
	.radio {
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}

	.radio:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
