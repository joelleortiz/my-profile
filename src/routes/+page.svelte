<script lang="ts">
	import Corkboard from '#lib/components/Corkboard.svelte';
	import Scene from '#lib/components/Scene.svelte';
	import Sign from '#lib/components/Sign.svelte';

	const SITE = 'https://joelleortiz.me/';
	const TITLE = 'Joelle Ortiz';
	const DESCRIPTION = 'Joelle Ortiz — programmer, traveler, foodie, dreamer, audiophile.';
	const OG_ALT =
		"Pixel-art scene at dusk: Joelle at a desk by a window under a sign that reads “Hi, I'm Joelle.”, with the tabby Myles on the desk and Margot asleep on the windowsill.";
</script>

<svelte:head>
	<title>{TITLE}</title>
	<meta name="description" content={DESCRIPTION} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={SITE} />
	<meta property="og:title" content={TITLE} />
	<meta property="og:description" content={DESCRIPTION} />
	<!-- Captured by scripts/still/capture.mjs. -->
	<meta property="og:image" content="{SITE}og.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={OG_ALT} />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<main>
	<div class="objects">
		<Sign />
		<Corkboard />
	</div>
	<Scene />
</main>

<style>
	/* Without JavaScript, layout.css places these on the still of the scene or stacks them. */
	.objects {
		position: relative;
		z-index: 1;
	}
</style>
