// The site icons: Myles's head in pixel art, coloured with the Cool & moody palette. Writes
// static/favicon.ico (16 and 32 px), static/favicon.svg (32 px grid) and
// static/apple-touch-icon.png (180 px, his face at 5× on the wall colour). `npm run art` runs it.
import { writeFileSync } from 'node:fs';
import { hexToRgb } from '../../src/lib/scene/color.ts';
import { paletteRamps, type Material } from '../../src/lib/scene/materials.ts';
import { Canvas } from './lib/canvas.ts';
import { encodeRgba } from './lib/png.ts';
import { MYLES_FACE, MYLES_INKS } from './sprites/parts.ts';

const STATIC = new URL('../../static/', import.meta.url);

/** His face simplified for 16 px: ears, the "M", green eyes with slit pupils, pink nose. */
const SMALL = [
	'.K............K.',
	'.KK..........KK.',
	'.KIK........KIK.',
	'.KIIK......KIIK.',
	'.KIIMKKKKKKMIIK.',
	'KMMMMXMXXMXMMMMK',
	'KMMMMXMMMMXMMMMK',
	'KMMEOEMMMMEOEMMK',
	'KMMEOEMMMMEOEMMK',
	'KXMMMMMLLMMMMMXK',
	'KMMMMMLPPLMMMMMK',
	'.KXMMLLLLLLMMXK.',
	'.KMMMLLLLLLMMMK.',
	'..KMMMLLLLMMMK..',
	'...KKMMMMMMKK...',
	'.....KKKKKK.....'
];

const ramps = paletteRamps('moody');
const WALL = hexToRgb(ramps.wall.b);

/** The icon's pixels as RGBA, from ink names through the moody ramps. */
function rgba(c: Canvas, scale = 1, background?: [number, number, number]): Uint8Array {
	const w = c.w * scale;
	const out = new Uint8Array(w * c.h * scale * 4);
	for (let y = 0; y < c.h * scale; y++)
		for (let x = 0; x < w; x++) {
			const ink = c.get(Math.floor(x / scale), Math.floor(y / scale));
			const [m, s] = (ink ?? '').split('.') as [Material, 'd2' | 'd' | 'b' | 'l'];
			const rgb = ink ? hexToRgb(ramps[m][s]) : background;
			if (rgb) out.set([...rgb, 255], (y * w + x) * 4);
		}
	return out;
}

function face(size: 16 | 32): Canvas {
	const c = new Canvas(size, size);
	if (size === 16) c.grid(0, 0, SMALL, MYLES_INKS);
	else c.grid(1, 4, MYLES_FACE, MYLES_INKS);
	return c;
}

/** An .ico holding PNG images (every current browser reads them). */
function ico(images: { size: number; png: Uint8Array }[]): Buffer {
	const head = Buffer.alloc(6 + 16 * images.length);
	head.writeUInt16LE(0, 0);
	head.writeUInt16LE(1, 2);
	head.writeUInt16LE(images.length, 4);
	let offset = head.length;
	images.forEach(({ size, png }, i) => {
		const e = 6 + 16 * i;
		head.writeUInt8(size % 256, e);
		head.writeUInt8(size % 256, e + 1);
		head.writeUInt16LE(1, e + 4);
		head.writeUInt16LE(32, e + 6);
		head.writeUInt32LE(png.length, e + 8);
		head.writeUInt32LE(offset, e + 12);
		offset += png.length;
	});
	return Buffer.concat([head, ...images.map((i) => Buffer.from(i.png))]);
}

/** The 32 px grid as an SVG of one path per colour, crisp at any size. */
function svg(c: Canvas): string {
	const paths = new Map<string, string>();
	const hexAt = (x: number, y: number) => {
		const ink = c.get(x, y);
		if (!ink) return null;
		const [m, s] = ink.split('.') as [Material, 'd2' | 'd' | 'b' | 'l'];
		return ramps[m][s];
	};
	// One rectangle per run of a colour along a row.
	for (let y = 0; y < c.h; y++)
		for (let x = 0; x < c.w;) {
			const hex = hexAt(x, y);
			let n = 1;
			while (hex && hexAt(x + n, y) === hex) n++;
			if (hex) paths.set(hex, `${paths.get(hex) ?? ''}M${x} ${y}h${n}v1h-${n}z`);
			x += n;
		}
	const body = [...paths].map(([hex, d]) => `<path fill="${hex}" d="${d}"/>`).join('');
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${c.w} ${c.h}" shape-rendering="crispEdges"><title>Myles</title>${body}</svg>\n`;
}

export function writeIcons(): void {
	const small = face(16);
	const large = face(32);
	writeFileSync(
		new URL('favicon.ico', STATIC),
		ico([
			{ size: 16, png: encodeRgba(16, 16, rgba(small)) },
			{ size: 32, png: encodeRgba(32, 32, rgba(large)) }
		])
	);
	writeFileSync(new URL('favicon.svg', STATIC), svg(large));
	const touch = new Canvas(36, 36);
	touch.grid(3, 6, MYLES_FACE, MYLES_INKS);
	writeFileSync(
		new URL('apple-touch-icon.png', STATIC),
		encodeRgba(180, 180, rgba(touch, 5, WALL))
	);
	console.log('favicon.ico (16, 32), favicon.svg, apple-touch-icon.png (180) written to static/.');
}
