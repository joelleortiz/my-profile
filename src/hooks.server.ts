import { dev } from '$app/env';
import type { Handle } from '@sveltejs/kit/hooks';
import { bootScript, themeCss } from '#lib/theme/head.ts';

// At the top of <head>, so the visitor's palette and light or dark mode paint first. Only the
// room (the homepage) needs its layout fitted before paint.
const themeHead = (room: boolean) =>
	`<style id="theme-tokens">${themeCss()}</style><script>${bootScript(dev, room)}</script>`;
const roomHead = themeHead(true);
const pageHead = themeHead(false);

export const handle: Handle = ({ event, resolve }) => {
	const head = event.route.id === '/' ? roomHead : pageHead;
	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%theme.head%', head)
	});
};
