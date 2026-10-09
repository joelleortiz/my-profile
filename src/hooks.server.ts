import { dev } from '$app/env';
import type { Handle } from '@sveltejs/kit/hooks';
import { bootScript, themeCss } from '#lib/theme/head.ts';

// At the top of <head>, so the visitor's palette and light or dark mode paint first.
const themeHead = `<style id="theme-tokens">${themeCss()}</style><script>${bootScript(dev)}</script>`;

export const handle: Handle = ({ event, resolve }) =>
	resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%theme.head%', themeHead)
	});
