<script lang="ts">
	import { isSoundOn, setSoundOn, setTimeOfDay } from '#lib/audio/index.ts';
	import { CROSSFADE_SECONDS } from '#lib/scene/time.ts';
	import { theme } from '#lib/theme/theme.svelte.ts';
	import PixelIcon from './PixelIcon.svelte';

	let on = $state(false);
	let firstTime = true;

	$effect(() => {
		setTimeOfDay(theme.time, firstTime ? 0 : CROSSFADE_SECONDS);
		firstTime = false;
	});

	async function toggle() {
		const request = setSoundOn(!on);
		on = isSoundOn();
		await request.catch(() => {});
		on = isSoundOn();
	}
</script>

<button type="button" class="sound" aria-pressed={on} onclick={toggle}>
	<PixelIcon name={on ? 'speaker' : 'speaker-off'} />
	<span>Sound</span>
	<span class="state" aria-hidden="true">{on ? 'on' : 'off'}</span>
</button>

<style>
	.sound {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		align-self: flex-start;
		padding: 0.35rem 0.75rem;
		font-family: var(--font-pixel);
		font-size: 1rem;
		color: var(--ink);
		background: var(--bg);
		border: 2px solid var(--ink);
		box-shadow: 3px 3px 0 var(--ink);
		cursor: pointer;
	}

	.sound:hover {
		translate: -1px -1px;
		box-shadow: 4px 4px 0 var(--ink);
	}

	.sound:active {
		translate: 2px 2px;
		box-shadow: 1px 1px 0 var(--ink);
	}

	.sound[aria-pressed='true'] {
		color: var(--bg);
		background: var(--accent);
	}

	.state {
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
</style>
