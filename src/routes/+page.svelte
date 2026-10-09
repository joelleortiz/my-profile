<script lang="ts">
	import Contacts from '#lib/components/Contacts.svelte';
	import Intro from '#lib/components/Intro.svelte';
	import Scene from '#lib/components/Scene.svelte';
	import SoundToggle from '#lib/components/SoundToggle.svelte';
</script>

<svelte:head>
	<title>Joelle Ortiz</title>
	<meta
		name="description"
		content="Joelle Ortiz — programmer, traveler, foodie, dreamer, audiophile."
	/>
</svelte:head>

<main class="page">
	<article class="card" aria-labelledby="intro-heading">
		<Intro />
		<Scene />
		<Contacts />
		<SoundToggle />
	</article>
</main>

<style>
	.page {
		--extra: calc(var(--frame-border) * 2 + var(--frame-shadow));
		--step: calc(480 * var(--u));
		--column: calc(480px + var(--extra));
		box-sizing: border-box;
		display: grid;
		place-items: center;
		min-height: 100svh;
		padding: clamp(16px, 3vh, 40px) var(--gutter);
	}

	.card {
		box-sizing: border-box;
		container-type: inline-size;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		width: min(100%, var(--column));
	}

	/* Whole multiples of 480 device pixels, capped at 480 CSS px: the art never scales by a fraction. */
	.card {
		--scene-w: calc(100cqi - var(--extra));
	}

	@media (min-width: 640px) {
		.card {
			--card-pad: clamp(24px, 3vw, 32px);
			--scene-w: round(down, min(100cqi - var(--extra), 480px), var(--step));
			width: min(100%, calc(var(--column) + 2 * var(--card-pad) + 4px));
			padding: var(--card-pad);
			border: 2px solid var(--line);
			background: var(--surface);
		}
	}
</style>
