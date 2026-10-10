<script lang="ts">
	import './layout.css';
	import '@fontsource/pixelify-sans/latin-400.css';
	import '@fontsource/pixelify-sans/latin-600.css';
	import '@fontsource/atkinson-hyperlegible/latin-400.css';
	import '@fontsource/atkinson-hyperlegible/latin-700.css';
	import '@fontsource/dm-mono/latin-400.css';
	import bodyFont from '@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2?url';
	import signFont from '@fontsource/pixelify-sans/files/pixelify-sans-latin-600-normal.woff2?url';
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
	<!-- Myles's head, drawn by scripts/art/icons.ts. -->
	<link rel="icon" href="/favicon.ico" sizes="16x16 32x32" />
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<!-- The ceiling at the top of the scene in Cool & moody. -->
	<meta name="theme-color" content="#121121" />
	<!-- The sign's lettering, fetched with the page so it doesn't swap in late and shift the text. -->
	<link rel="preload" href={signFont} as="font" type="font/woff2" crossorigin="anonymous" />
	<link rel="preload" href={bodyFont} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

{@render children()}
