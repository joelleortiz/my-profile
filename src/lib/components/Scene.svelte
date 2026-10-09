<script lang="ts">
	import { dev } from '$app/env';
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { playSceneSound, type SceneSound } from '#lib/audio/index.ts';
	import { Director, type Target } from '#lib/scene/director.ts';
	import { createScene, type HitArea, type Pt, type SceneEngine } from '#lib/scene/engine.ts';
	import { NATIVE_H, NATIVE_W, SCENE } from '#lib/scene/layout.ts';
	import { theme } from '#lib/theme/theme.svelte.ts';

	const LABEL =
		'Pixel-art scene: Joelle typing on a sticker-covered laptop at her desk by a window, with an iced coffee and a desk lamp beside her. Her tabby cat Myles sits on the desk next to her, and Margot, a white-chested tabby, sleeps on a cushion on the floor.';

	interface Hotspot {
		sprite: string;
		label: string;
		target?: Target;
		href?: string;
		sticker?: boolean;
		requires?: string;
	}

	const HOTSPOTS: Hotspot[] = [
		{ sprite: 'myles', label: 'Pet Myles', target: 'myles' },
		{ sprite: 'margot', label: 'Gently wake Margot', target: 'margot' },
		{ sprite: 'coffee', label: 'Sip coffee', target: 'coffee' },
		{
			sprite: 'sticker-github',
			label: 'GitHub',
			href: 'https://github.com/joelleortiz',
			sticker: true
		},
		{
			sprite: 'sticker-name',
			label: 'LinkedIn',
			href: 'https://www.linkedin.com/in/joelle-ortiz',
			sticker: true
		},
		{ sprite: 'sticker-cats', label: 'Myles & Margot', sticker: true },
		{ sprite: 'sticker-code', label: 'Programmer', sticker: true },
		{ sprite: 'sticker-scroll', label: 'CV', href: '/cv', sticker: true, requires: 'cv' }
	];

	const FLAGS = ['asleep'];

	const SCENE_SOUNDS: ReadonlySet<string> = new Set<SceneSound>([
		'type',
		'pet-start',
		'pet-end',
		'margot-wake',
		'margot-stretch',
		'sip',
		'cup-down',
		'sticker-hover',
		'sticker-click'
	]);

	const crop = SCENE.crop;

	let frame: HTMLElement;
	let canvas: HTMLCanvasElement;
	let engine = $state<SceneEngine | null>(null);
	let director: Director | null = null;
	let synced = false;
	let offsets = $state<Record<string, Pt>>({});
	let spots = $state<(Hotspot & { area: HitArea })[]>([]);
	let tapped = $state<string | null>(null);

	function sound(event: string) {
		if (SCENE_SOUNDS.has(event)) playSceneSound(event as SceneSound);
	}

	function placeHotspots(created: SceneEngine) {
		spots = HOTSPOTS.filter((h) => !h.requires || FLAGS.includes(h.requires)).flatMap((h) => {
			const area = created.hitArea(h.sprite);
			return area ? [{ ...h, area }] : [];
		});
	}

	onMount(() => {
		let alive = true;
		const motion = matchMedia('(prefers-reduced-motion: reduce)');
		const onMotion = () => {
			engine?.setReducedMotion(motion.matches);
			director?.setReducedMotion(motion.matches);
		};
		motion.addEventListener('change', onMotion);

		createScene(canvas, {
			frame,
			palette: theme.palette,
			time: theme.time,
			reducedMotion: motion.matches,
			flags: FLAGS,
			onEvent: (_sprite, event) => director?.handleEvent(event),
			onOffsets: (next) => (offsets = next)
		}).then((created) => {
			if (!alive) return created.destroy();
			engine = created;
			director = new Director(created, { reducedMotion: motion.matches, sound });
			placeHotspots(created);
			if (dev) (globalThis as Record<string, unknown>).__scene = created;
		});

		return () => {
			alive = false;
			motion.removeEventListener('change', onMotion);
			director?.destroy();
			engine?.destroy();
		};
	});

	$effect(() => {
		engine?.setPalette(theme.palette);
	});

	$effect(() => {
		const time = theme.time;
		if (!engine) return;
		engine.setTime(time, { instant: !synced });
		synced = true;
	});

	const offsetVars = $derived(
		Object.entries(offsets)
			.map(([layer, [x, y]]) => `--off-${layer}-x:${x};--off-${layer}-y:${y}`)
			.join(';')
	);

	const lifted = new SvelteSet<string>();

	function lift(spot: Hotspot, on: boolean) {
		if (!spot.sticker || on === lifted.has(spot.sprite)) return;
		if (on) lifted.add(spot.sprite);
		else lifted.delete(spot.sprite);
		engine?.nudge(spot.sprite, on ? [0, -1] : [0, 0]);
		if (on) sound('sticker-hover');
	}

	function activate(spot: Hotspot) {
		if (spot.target) director?.click(spot.target);
		if (!spot.sticker) return;
		sound('sticker-click');
		tapped = spot.sprite;
		setTimeout(() => {
			if (tapped === spot.sprite) tapped = null;
		}, 1600);
	}

	const box = (a: HitArea) =>
		`left:calc((${a.x} + var(--off-${a.layer}-x, 0)) / ${NATIVE_W} * 100%);` +
		`top:calc((${a.y} + var(--off-${a.layer}-y, 0)) / ${NATIVE_H} * 100%);` +
		`width:calc(${a.w} / ${NATIVE_W} * 100%);height:calc(${a.h} / ${NATIVE_H} * 100%)`;
</script>

<figure
	class="scene-frame"
	bind:this={frame}
	style:--crop-x={crop.x}
	style:--crop-y={crop.y}
	style:--crop-w={crop.w}
	style:--crop-h={crop.h}
	style:--native-w={NATIVE_W}
	style:--native-h={NATIVE_H}
>
	<div class="scene-stage" style={offsetVars}>
		<!-- The canvas only paints, so screen readers get it as a described picture. -->
		<!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
		<canvas bind:this={canvas} width={NATIVE_W} height={NATIVE_H} role="img" aria-label={LABEL}
		></canvas>
		{#each spots as spot (spot.sprite)}
			{#if spot.href}
				<!-- External profile links, not app routes, so resolve() does not apply. -->
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					class="hotspot"
					class:tapped={tapped === spot.sprite}
					style={box(spot.area)}
					href={spot.href}
					target="_blank"
					rel="noopener"
					aria-label={spot.label}
					onpointerenter={() => lift(spot, true)}
					onpointerleave={() => lift(spot, false)}
					onfocus={() => lift(spot, true)}
					onblur={() => lift(spot, false)}
					onclick={() => activate(spot)}
				>
					<span class="tip" aria-hidden="true">{spot.label}</span>
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{:else}
				<button
					type="button"
					class="hotspot"
					class:tapped={tapped === spot.sprite}
					style={box(spot.area)}
					aria-label={spot.label}
					onpointerenter={() => lift(spot, true)}
					onpointerleave={() => lift(spot, false)}
					onfocus={() => lift(spot, true)}
					onblur={() => lift(spot, false)}
					onclick={() => activate(spot)}
				>
					<span class="tip" aria-hidden="true">{spot.label}</span>
				</button>
			{/if}
		{/each}
	</div>
</figure>

<style>
	.scene-frame {
		box-sizing: content-box;
		container-type: inline-size;
		position: relative;
		overflow: hidden;
		margin: 0;
		width: var(--scene-w, 100%);
		aspect-ratio: 16 / 9;
		border: var(--frame-border) solid var(--ink);
		box-shadow: var(--frame-shadow) var(--frame-shadow) 0 var(--ink);
		background: var(--surface);
	}

	.scene-stage {
		position: absolute;
		inset: 0;
	}

	canvas {
		display: block;
		width: 100%;
		height: 100%;
		max-width: none;
		image-rendering: pixelated;
	}

	.hotspot {
		position: absolute;
		display: block;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}

	.hotspot:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	.tip {
		position: absolute;
		bottom: calc(100% + 6px);
		left: 50%;
		translate: -50% 0;
		display: none;
		padding: 1px 6px 2px;
		font-family: var(--font-pixel);
		font-size: 0.8125rem;
		line-height: 1.2;
		white-space: nowrap;
		color: var(--bg);
		background: var(--ink);
		box-shadow:
			2px 0 0 var(--ink),
			-2px 0 0 var(--ink),
			0 2px 0 var(--accent);
		pointer-events: none;
	}

	.hotspot:hover .tip,
	.hotspot:focus-visible .tip,
	.hotspot.tapped .tip {
		display: block;
	}

	/* Centre the crop rectangle at the whole-number scale nearest to filling the 4:3 frame. */
	@media (max-width: 639.98px) {
		.scene-frame {
			aspect-ratio: 4 / 3;
		}

		.scene-stage {
			--cw: calc(100cqi * var(--native-w) / var(--crop-w));
			inset: auto;
			width: var(--cw);
			height: calc(var(--cw) * var(--native-h) / var(--native-w));
			left: calc(50cqi - var(--cw) * (var(--crop-x) + var(--crop-w) / 2) / var(--native-w));
			top: calc(37.5cqi - var(--cw) * (var(--crop-y) + var(--crop-h) / 2) / var(--native-w));
		}

		@supports (width: round(nearest, 10px, 1px)) {
			.scene-stage {
				--cw: calc(
					round(nearest, 100cqi, calc(var(--crop-w) * var(--u))) * var(--native-w) / var(--crop-w)
				);
			}
		}
	}
</style>
