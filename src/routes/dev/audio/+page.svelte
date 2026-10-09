<script lang="ts">
	import {
		isSoundOn,
		playSceneSound,
		setSoundOn,
		setTimeOfDay,
		type SceneSound,
		type SceneTime
	} from '#lib/audio/index.ts';
	import { audioStatus, type PlayerStatus } from '#lib/audio/debug.ts';

	const sounds: SceneSound[] = [
		'type',
		'pet-start',
		'pet-end',
		'margot-wake',
		'margot-stretch',
		'sip',
		'cup-down',
		'sticker-hover',
		'sticker-click',
		'palette-open',
		'palette-change'
	];
	const times: SceneTime[] = ['morning', 'day', 'dusk', 'night'];
	const BURST_PRESSES = 30;
	const BURST_INTERVAL_MS = 100;
	const METER_FLOOR_DB = -60;

	let soundOn = $state(false);
	let time = $state<SceneTime>('day');
	let crossfadeSeconds = $state(2);
	let bursting = $state(false);
	let status = $state<PlayerStatus>();

	$effect(() => {
		let frame = requestAnimationFrame(function refresh() {
			status = audioStatus();
			frame = requestAnimationFrame(refresh);
		});
		return () => cancelAnimationFrame(frame);
	});

	async function toggleSound() {
		soundOn = !isSoundOn();
		await setSoundOn(soundOn);
	}

	function typeBurst() {
		bursting = true;
		let presses = 0;
		const timer = setInterval(() => {
			playSceneSound('type');
			presses += 1;
			if (presses === BURST_PRESSES) {
				clearInterval(timer);
				bursting = false;
			}
		}, BURST_INTERVAL_MS);
	}

	function chooseTime(next: SceneTime) {
		time = next;
		setTimeOfDay(next, crossfadeSeconds);
	}

	function meterWidth(db: number): string {
		return `${Math.max(0, Math.min(1, 1 - db / METER_FLOOR_DB)) * 100}%`;
	}
</script>

<svelte:head>
	<title>Sound board</title>
</svelte:head>

<main class="mx-auto flex max-w-2xl flex-col gap-8 p-6 text-gray-900">
	<h1 class="text-3xl">Sound board</h1>

	<button
		type="button"
		class="self-start rounded border border-gray-900 px-4 py-2"
		aria-pressed={soundOn}
		data-testid="toggle"
		onclick={toggleSound}
	>
		Sound {soundOn ? 'on' : 'off'}
	</button>

	<section class="flex flex-col gap-2">
		<h2 class="text-xl">Scene sounds</h2>
		<div class="flex flex-wrap gap-2">
			{#each sounds as sound (sound)}
				<button
					type="button"
					class="rounded border border-gray-400 px-3 py-1"
					data-sound={sound}
					onclick={() => playSceneSound(sound)}
				>
					{sound}
				</button>
			{/each}
			<button
				type="button"
				class="rounded border border-gray-400 px-3 py-1 disabled:opacity-50"
				data-testid="type-burst"
				disabled={bursting}
				onclick={typeBurst}
			>
				type burst (10/s for 3 s)
			</button>
		</div>
	</section>

	<fieldset class="flex flex-wrap items-center gap-4">
		<legend class="text-xl">Time of day</legend>
		{#each times as option (option)}
			<label class="flex items-center gap-1">
				<input
					type="radio"
					name="time"
					value={option}
					checked={time === option}
					onchange={() => chooseTime(option)}
				/>
				{option}
			</label>
		{/each}
		<label class="flex items-center gap-2">
			crossfade
			<input
				type="number"
				min="0"
				max="30"
				step="0.5"
				class="w-20 rounded border border-gray-400 px-2"
				bind:value={crossfadeSeconds}
			/>
			s
		</label>
	</fieldset>

	<section class="flex flex-col gap-2" aria-live="polite">
		<h2 class="text-xl">Output</h2>
		{#if status}
			<div class="h-3 w-full rounded bg-gray-200" aria-hidden="true">
				<div class="h-3 rounded bg-gray-900" style:width={meterWidth(status.levelDb.rms)}></div>
			</div>
			<p data-testid="level">
				{status.levelDb.rms.toFixed(1)} dBFS RMS, {status.levelDb.peak.toFixed(1)} dBFS peak
			</p>
			<p>
				context {status.context} · {status.format} · music {status.music} · crackle
				{status.crackle} · purr {status.purring ? 'on' : 'off'} · low-pass
				{Math.round(status.lowpassHz)} Hz
			</p>
			<pre class="text-xs" data-testid="status">{JSON.stringify(status, null, 2)}</pre>
		{:else}
			<p>No audio yet: turn the sound on.</p>
		{/if}
	</section>
</main>
