<script lang="ts">
	import {
		isSoundOn,
		playSceneSound,
		setSoundOn,
		setTimeOfDay,
		type SceneSound,
		type SceneTime
	} from '#lib/audio/index.ts';
	import {
		DEFAULT_LEVELS,
		audioStatus,
		currentLevels,
		resetLevels,
		setLevel,
		type LevelName,
		type PlayerStatus
	} from '#lib/audio/debug.ts';

	interface Slider {
		name: LevelName;
		label: string;
		plays: string;
		min: number;
		max: number;
	}

	const sliders: Slider[] = [
		{ name: 'sfxBus', label: 'SFX bus', plays: 'every effect below', min: -40, max: 0 },
		{ name: 'typing', label: 'Typing', plays: 'type', min: -30, max: 10 },
		{ name: 'blips', label: 'Blips', plays: 'sound on and off, palette-change', min: -30, max: 10 },
		{ name: 'stickerHover', label: 'Sticker hover', plays: 'sticker-hover', min: -30, max: 10 },
		{ name: 'stickerClick', label: 'Sticker click', plays: 'sticker-click', min: -30, max: 10 },
		{ name: 'foley', label: 'Foley', plays: 'sip, cup-down', min: -30, max: 10 },
		{
			name: 'cats',
			label: 'Cats',
			plays: 'pet-start trill, margot-wake, margot-stretch',
			min: -30,
			max: 10
		},
		{ name: 'purr', label: 'Purr', plays: 'pet-start to pet-end', min: -30, max: 10 }
	];
	const SCENE_TAPS_PER_LOOP = 2;
	const SCENE_TYPING_LOOP_MS = 440;
	const SCENE_TYPING_SECONDS = 6;

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
	let levels = $state(currentLevels());

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
		typeFor(BURST_PRESSES, BURST_INTERVAL_MS);
	}

	function typeLikeTheScene() {
		const interval = SCENE_TYPING_LOOP_MS / SCENE_TAPS_PER_LOOP;
		typeFor(Math.round((SCENE_TYPING_SECONDS * 1000) / interval), interval);
	}

	function typeFor(presses: number, intervalMs: number) {
		bursting = true;
		let pressed = 0;
		const timer = setInterval(() => {
			playSceneSound('type');
			pressed += 1;
			if (pressed === presses) {
				clearInterval(timer);
				bursting = false;
			}
		}, intervalMs);
	}

	function changeLevel(name: LevelName, db: number) {
		setLevel(name, db);
		levels = currentLevels();
	}

	function resetToDefaults() {
		resetLevels();
		levels = currentLevels();
	}

	function decibels(db: number): string {
		return `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`;
	}

	function asCode(values: Record<LevelName, number>): string {
		return Object.entries(values)
			.map(([name, db]) => `\t${name}: ${db},`)
			.join('\n');
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
			<button
				type="button"
				class="rounded border border-gray-400 px-3 py-1 disabled:opacity-50"
				data-testid="type-like-scene"
				disabled={bursting}
				onclick={typeLikeTheScene}
			>
				type like the scene (4.5/s for 6 s)
			</button>
		</div>
	</section>

	<section class="flex flex-col gap-3">
		<div class="flex items-center justify-between">
			<h2 class="text-xl">Levels</h2>
			<button
				type="button"
				class="rounded border border-gray-400 px-3 py-1"
				data-testid="reset-levels"
				onclick={resetToDefaults}
			>
				Reset to defaults
			</button>
		</div>
		<p class="text-sm">
			Effects play at the SFX bus plus their group's level. Changes apply straight away; send these
			numbers to update <code>src/lib/audio/levels.ts</code>.
		</p>
		{#each sliders as slider (slider.name)}
			<label class="grid grid-cols-[8rem_1fr_6rem] items-center gap-3">
				<span>
					{slider.label}
					<span class="block text-xs text-gray-500">{slider.plays}</span>
				</span>
				<input
					type="range"
					min={slider.min}
					max={slider.max}
					step="0.5"
					value={levels[slider.name]}
					data-level={slider.name}
					oninput={(event) => changeLevel(slider.name, Number(event.currentTarget.value))}
				/>
				<span class="text-right tabular-nums">
					{decibels(levels[slider.name])}
					<span class="block text-xs text-gray-500">
						default {decibels(DEFAULT_LEVELS[slider.name])}
					</span>
				</span>
			</label>
		{/each}
		<pre class="rounded bg-gray-100 p-3 text-xs" data-testid="levels-code">{asCode(levels)}</pre>
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
