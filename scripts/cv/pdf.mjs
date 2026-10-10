// Prints /cv to static/cv/joelle-ortiz-cv.pdf, the CV's download, from a running server. Needs
// Google Chrome; not part of the build.
//
//   npm run dev (or npm run build && npm run preview), then: node scripts/cv/pdf.mjs [base-url]
//
// The page's print stylesheet gives the look and the A4 page. The PDF is only written when it
// fits on one page and has nothing like a phone number in it. Run it again after changing
// src/lib/cv.ts or the page, then restart the dev server or rebuild so /cv offers the download.

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9340;
const OUT = 'static/cv/joelle-ortiz-cv.pdf';
const base = process.argv[2] ?? 'http://localhost:5173/';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
	CHROME,
	[
		'--headless=new',
		`--remote-debugging-port=${PORT}`,
		`--user-data-dir=${mkdtempSync(join(tmpdir(), 'cv-pdf-'))}`,
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

try {
	await send('Page.enable');
	const done = loaded();
	await send('Page.navigate', { url: new URL('cv', base).href });
	await done;
	await send('Emulation.setEmulatedMedia', { media: 'print' });
	await send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true });

	const text = (
		await send('Runtime.evaluate', { expression: 'document.body.innerText', returnByValue: true })
	).result.value;
	if (/\+?\d(?:[\s().-]*\d){7,}/.test(text)) throw new Error('The CV has a phone-like number');

	const { data } = await send('Page.printToPDF', {
		preferCSSPageSize: true,
		printBackground: true,
		generateTaggedPDF: true
	});
	const pdf = Buffer.from(data, 'base64');
	const pages = pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length ?? 0;
	if (pages !== 1) throw new Error(`The CV prints on ${pages} pages, not one`);

	mkdirSync(dirname(OUT), { recursive: true });
	writeFileSync(OUT, pdf);
	console.log(OUT, `${(pdf.length / 1024).toFixed(1)} KB`);
} finally {
	ws.close();
	chrome.kill();
}
