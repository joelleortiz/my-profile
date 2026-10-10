// Captures stills of the scene from a running dev server, in the desktop layout, held in the
// typing pose, at dusk in Cool & moody. Needs Google Chrome; not part of the build.
//
//   npm run dev, then: node scripts/still/capture.mjs [base-url]
//
// Writes:
// - static/scene-dusk.png: the whole world at one scene pixel per image pixel, the picture the
//   page shows without JavaScript (its sign and notes are HTML laid over it);
// - static/og.png: the 1200 × 630 Open Graph image, the page itself at 2 CSS px per scene pixel
//   framed on the whole desk scene (the clock to the sign), so the lettering is in the picture.
// Run it again after changing the art or the sign's words.

import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encodeIndexed, encodeRgba } from '../art/lib/png.ts';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9339;
const base = process.argv[2] ?? 'http://localhost:5173/';
const QUERY = 'palette=moody&time=dusk';
/** The Open Graph frame in scene pixels, from the clock to past the sign: 600 × 315 at 2×. */
const OG = { x: 190, y: 80, w: 600, h: 315, scale: 2 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** An indexed PNG when the picture has 256 colours or fewer (the scene usually does), else RGBA. */
function encode(w, h, rgba) {
	const index = new Map();
	const palette = [];
	const indices = new Uint8Array(w * h);
	for (let i = 0; i < w * h; i++) {
		const key = (rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2];
		if (!index.has(key)) {
			if (palette.length === 256) return encodeRgba(w, h, rgba);
			index.set(key, palette.length);
			palette.push([rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]]);
		}
		indices[i] = index.get(key);
	}
	return encodeIndexed(w, h, indices, palette, [255]);
}
const chrome = spawn(
	CHROME,
	[
		'--headless=new',
		`--remote-debugging-port=${PORT}`,
		`--user-data-dir=${mkdtempSync(join(tmpdir(), 'still-'))}`,
		'--force-color-profile=srgb',
		'about:blank'
	],
	{ stdio: 'ignore' }
);

async function pageSocket() {
	for (let i = 0; i < 100; i++) {
		try {
			const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
			const page = list.find((t) => t.type === 'page');
			if (page) return page.webSocketDebuggerUrl;
		} catch {
			// Chrome is still starting.
		}
		await sleep(100);
	}
	throw new Error('Chrome did not start');
}

const ws = new WebSocket(await pageSocket());
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let nextId = 1;
const pending = new Map();
const events = new Set();
ws.addEventListener('message', (e) => {
	const msg = JSON.parse(e.data);
	if (msg.id) pending.get(msg.id)?.(msg);
	else for (const fn of events) fn(msg);
});
const send = (method, params = {}) =>
	new Promise((resolve, reject) => {
		const id = nextId++;
		pending.set(id, (msg) =>
			msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)
		);
		ws.send(JSON.stringify({ id, method, params }));
	});
const loaded = () =>
	new Promise((resolve) => {
		const fn = (msg) => {
			if (msg.method !== 'Page.loadEventFired') return;
			events.delete(fn);
			resolve();
		};
		events.add(fn);
	});

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
	width: 1340,
	height: 720,
	deviceScaleFactor: 1,
	mobile: false
});
// Reduced motion holds Joelle in the typing pose and the cats still.
await send('Emulation.setEmulatedMedia', {
	features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
});
const done = loaded();
await send('Page.navigate', { url: `${base}?${QUERY}` });
await done;
await send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true });
await sleep(2000);

const { result } = await send('Runtime.evaluate', {
	expression: `(() => {
		const c = window.__scene.worldCanvas;
		const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
		let s = '';
		for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode(...d.subarray(i, i + 0x8000));
		return { w: c.width, h: c.height, rgba: btoa(s) };
	})()`,
	returnByValue: true
});
const { w, h } = result.value;
const still = encode(w, h, new Uint8Array(Buffer.from(result.value.rgba, 'base64')));
writeFileSync('static/scene-dusk.png', still);
console.log('static/scene-dusk.png', w, h, `${(still.length / 1024).toFixed(1)} KB`);

// The page at 1340 × 720 shows the desktop layout at exactly 2×; check, then cut the frame.
const view = (
	await send('Runtime.evaluate', {
		expression: `(() => { const s = getComputedStyle(document.documentElement); return { s: +s.getPropertyValue('--s'), x: +s.getPropertyValue('--cam-x'), y: +s.getPropertyValue('--cam-y') }; })()`,
		returnByValue: true
	})
).result.value;
if (view.s !== OG.scale) throw new Error(`Expected ${OG.scale}×, got ${view.s}×`);
const { data } = await send('Page.captureScreenshot', {
	format: 'png',
	clip: {
		x: (OG.x - view.x) * OG.scale,
		y: (OG.y - view.y) * OG.scale,
		width: OG.w * OG.scale,
		height: OG.h * OG.scale,
		scale: 1
	}
});
const og = Buffer.from(data, 'base64');
writeFileSync('static/og.png', og);
console.log(
	'static/og.png',
	OG.w * OG.scale,
	OG.h * OG.scale,
	`${(og.length / 1024).toFixed(1)} KB`
);
ws.close();
chrome.kill();
