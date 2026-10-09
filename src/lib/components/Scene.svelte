<script lang="ts">
	import { dev } from '$app/env';
	import { onMount } from 'svelte';
	import { createScene, type SceneEngine } from '#lib/scene/engine.ts';
	import { NATIVE_H, NATIVE_W, SCENE } from '#lib/scene/layout.ts';
	import { theme } from '#lib/theme/theme.svelte.ts';

	const LABEL =
		'Pixel-art scene: Joelle typing on a sticker-covered laptop at her desk by a window, with an iced coffee and a desk lamp beside her. Her tabby cat Myles sits on the desk next to her, and Margot, a white-chested tabby, sleeps on a cushion on the floor.';

	const crop = SCENE.crop;

	let frame: HTMLElement;
	let canvas: HTMLCanvasElement;
	let engine = $state<SceneEngine | null>(null);
	let synced = false;

	onMount(() => {
		let alive = true;
		const motion = matchMedia('(prefers-reduced-motion: reduce)');
		const onMotion = () => engine?.setReducedMotion(motion.matches);
		motion.addEventListener('change', onMotion);

		createScene(canvas, {
			frame,
			palette: theme.palette,
			time: theme.time,
			reducedMotion: motion.matches
		}).then((created) => {
			if (!alive) return created.destroy();
			engine = created;
			if (dev) (globalThis as Record<string, unknown>).__scene = created;
		});

		return () => {
			alive = false;
			motion.removeEventListener('change', onMotion);
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
	<div class="scene-stage">
		<!-- The canvas only paints, so screen readers get it as a described picture. -->
		<!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
		<canvas bind:this={canvas} width={NATIVE_W} height={NATIVE_H} role="img" aria-label={LABEL}
		></canvas>
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
