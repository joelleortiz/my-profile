<script lang="ts">
	import { dev } from '$app/env';
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { playSceneSound, preloadMusic, type SceneSound } from '#lib/audio/index.ts';
	import { Director, type Target } from '#lib/scene/director.ts';
	import { createScene, type HitArea, type SceneEngine, type ViewPort } from '#lib/scene/engine.ts';
	import { GEOMETRY } from '#lib/scene/layout.ts';
	import { CLOCK_TIMES } from '#lib/scene/time.ts';
	import { fitView, type View } from '#lib/scene/viewport.ts';
	import { theme } from '#lib/theme/theme.svelte.ts';
	import { view } from '#lib/theme/view.svelte.ts';
	import Radio from './Radio.svelte';
	import Switchers from './Switchers.svelte';

	const LABEL =
		"Pixel-art scene: Joelle, in a black hoodie and round glasses, typing on a sticker-covered laptop at a desk by a window, with an iced coffee, a desk lamp and a radio on the desk. Joelle's slender tabby cat Myles sits on the desk alongside, and Margot, a round-faced tabby-and-white cat, sleeps on the windowsill.";

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

	let backdrop: HTMLElement;
	let canvas: HTMLCanvasElement;
	let engine = $state<SceneEngine | null>(null);
	let director: Director | null = null;
	let synced = false;
	let spots = $state<(Hotspot & { area: HitArea })[]>([]);
	let tapped = $state<string | null>(null);
	let soundOn = $state(true);

	const current = $derived<View>(view.current ?? fitView(1440, 900, 1, GEOMETRY));

	function viewPort(v: View): ViewPort {
		return {
			layout: v.layout,
			w: v.w,
			h: v.h,
			camX: v.camX,
			camY: v.camY,
			cssPxPerScenePx: v.cssPxPerScenePx
		};
	}

	function sound(event: string) {
		if (SCENE_SOUNDS.has(event)) playSceneSound(event as SceneSound);
	}

	function placeHotspots(created: SceneEngine) {
		spots = HOTSPOTS.filter((h) => !h.requires || FLAGS.includes(h.requires)).flatMap((h) => {
			const area = created.hitArea(h.sprite);
			return area ? [{ ...h, area }] : [];
		});
	}

	// Objects outside the camera's view get no hotspot, so keyboard focus never lands off screen.
	const shown = $derived(
		spots.filter(
			({ area: a }) =>
				a.x < current.camX + current.w &&
				a.x + a.w > current.camX &&
				a.y < current.camY + current.h &&
				a.y + a.h > current.camY
		)
	);

	/** Touch or mouse, for the tooltips: a tap leaves :hover stuck, so taps don't open them. */
	function noteInput(e: PointerEvent) {
		document.documentElement.dataset.input = e.pointerType === 'touch' ? 'touch' : 'mouse';
	}

	/** Tooltips centre over their object; near the edge of the screen they slide back inside. */
	function fitTip(e: Event) {
		const tip = (e.target as Element).querySelector?.<HTMLElement>(':scope > .scene-tip');
		if (!tip) return;
		tip.style.removeProperty('--tip-shift');
		requestAnimationFrame(() => {
			const r = tip.getBoundingClientRect();
			if (!r.width) return;
			const margin = 4;
			const shift = Math.max(margin - r.left, Math.min(0, innerWidth - margin - r.right));
			if (shift) tip.style.setProperty('--tip-shift', `${Math.round(shift)}px`);
		});
	}

	onMount(() => {
		let alive = true;
		const stopView = view.start();
		const motion = matchMedia('(prefers-reduced-motion: reduce)');
		const onMotion = () => {
			engine?.setReducedMotion(motion.matches);
			director?.setReducedMotion(motion.matches);
		};
		motion.addEventListener('change', onMotion);
		document.addEventListener('pointerover', fitTip, { passive: true });
		document.addEventListener('focusin', fitTip);
		document.addEventListener('pointerdown', noteInput, { passive: true });
		document.addEventListener('pointermove', noteInput, { passive: true });

		createScene(canvas, {
			frame: backdrop,
			view: viewPort(current),
			palette: theme.palette,
			time: theme.time,
			reducedMotion: motion.matches,
			flags: FLAGS,
			onEvent: (_sprite, event) => director?.handleEvent(event)
		}).then((created) => {
			if (!alive) return created.destroy();
			engine = created;
			director = new Director(created, { reducedMotion: motion.matches, sound });
			placeHotspots(created);
			preloadMusic();
			if (dev) (globalThis as Record<string, unknown>).__scene = created;
		});

		return () => {
			alive = false;
			stopView();
			motion.removeEventListener('change', onMotion);
			document.removeEventListener('pointerover', fitTip);
			document.removeEventListener('focusin', fitTip);
			document.removeEventListener('pointerdown', noteInput);
			document.removeEventListener('pointermove', noteInput);
			director?.destroy();
			engine?.destroy();
		};
	});

	$effect(() => {
		engine?.setView(viewPort(current));
	});

	// Wall objects (and Margot on the sill) move between layouts, so their hit areas do too.
	$effect(() => {
		void current.layout;
		if (engine) placeHotspots(engine);
	});

	$effect(() => {
		engine?.setFlag('sound', soundOn);
	});

	$effect(() => {
		engine?.setClock(theme.override ? CLOCK_TIMES[theme.override] : null);
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

	const box = (a: HitArea) => `--x:${a.x};--y:${a.y};--w:${a.w};--h:${a.h}`;
</script>

<div class="backdrop" bind:this={backdrop}>
	<!-- Without JavaScript, a still of the scene at dusk; browsers running scripts never fetch it. -->
	<noscript><img class="still" src="/scene-dusk.png" alt="" width="880" height="480" /></noscript>
	<!-- The canvas only paints, so screen readers get it as a described picture. -->
	<!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
	<canvas
		bind:this={canvas}
		role="img"
		aria-label={LABEL}
		style:width="{current.w * current.cssPxPerScenePx}px"
		style:height="{current.h * current.cssPxPerScenePx}px"
	></canvas>
	{#each shown as spot (spot.sprite)}
		{#if spot.href}
			<!-- External profile links, not app routes, so resolve() does not apply. -->
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				class="hotspot in-scene"
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
				<span class="scene-tip" aria-hidden="true">{spot.label}</span>
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{:else}
			<button
				type="button"
				class="hotspot in-scene"
				class:tapped={tapped === spot.sprite}
				style={box(spot.area)}
				aria-label={spot.label}
				onpointerenter={() => lift(spot, true)}
				onpointerleave={() => lift(spot, false)}
				onfocus={() => lift(spot, true)}
				onblur={() => lift(spot, false)}
				onclick={() => activate(spot)}
			>
				<span class="scene-tip" aria-hidden="true">{spot.label}</span>
			</button>
		{/if}
	{/each}
	<Radio onchange={(on) => (soundOn = on)} />
	<Switchers lift={(sprite, on) => engine?.nudge(sprite, on ? [0, -1] : [0, 0])} />
</div>

<style>
	/* As tall as the screen with the address bar hidden, so the bar sliding away uncovers more
	   floor rather than resizing anything (the fit uses the height with the bar shown). */
	.backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100vh;
		height: 100lvh;
		/* Clip, not hidden: a hidden overflow can still be scrolled by focus, which would slide the
		   canvas out from under the HTML placed over it. */
		overflow: clip;
		background: var(--surface);
	}

	.still {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 50% 75%;
		image-rendering: pixelated;
	}

	canvas {
		position: absolute;
		top: 0;
		left: 0;
		display: block;
		max-width: none;
		image-rendering: pixelated;
	}

	.hotspot {
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
</style>
