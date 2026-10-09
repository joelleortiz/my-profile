<script lang="ts">
	import './layout.css';
	import '@fontsource/pixelify-sans/latin-400.css';
	import '@fontsource/pixelify-sans/latin-600.css';
	import '@fontsource/atkinson-hyperlegible/latin-400.css';
	import '@fontsource/atkinson-hyperlegible/latin-700.css';
	import '@fontsource/dm-mono/latin-400.css';
	import favicon from '#lib/assets/favicon.svg';
	import { theme } from '#lib/theme/theme.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	$effect(() => theme.start());

	$effect(() => {
		const root = document.documentElement.dataset;
		root.palette = theme.palette;
		root.time = theme.time;
		root.mode = theme.mode;
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
