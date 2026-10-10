import { readFileSync, writeFileSync } from 'node:fs';
import { hexToRgb, type Shade } from '../../../src/lib/scene/color.ts';
import type { Material } from '../../../src/lib/scene/materials.ts';
import { encodeIndexed } from './png.ts';
import { ART_DIR, KEY_PALETTE_JSON, type KeyPaletteFile } from './paths.ts';

export type Ink = `${Material}.${Shade}` | `fixed.${string}`;

const keyPalette: KeyPaletteFile = JSON.parse(readFileSync(KEY_PALETTE_JSON, 'utf8'));

export const PNG_PALETTE: [number, number, number][] = [[0, 0, 0]];
const INK_INDEX = new Map<string, number>();
for (const m of keyPalette.materials) {
	keyPalette.shades.forEach((s, i) => {
		INK_INDEX.set(`${m}.${s}`, PNG_PALETTE.length);
		PNG_PALETTE.push(hexToRgb(keyPalette.keys[m][i]));
	});
}
for (const [name, hex] of Object.entries(keyPalette.fixed)) {
	INK_INDEX.set(`fixed.${name}`, PNG_PALETTE.length);
	PNG_PALETTE.push(hexToRgb(hex));
}

export function inkIndex(ink: Ink | null): number {
	if (ink === null) return 0;
	const i = INK_INDEX.get(ink);
	if (i === undefined) throw new Error(`Unknown ink "${ink}"`);
	return i;
}

const INDEX_INK: (Ink | null)[] = [null];
for (const [ink, i] of INK_INDEX) INDEX_INK[i] = ink as Ink;

export const inkAt = (index: number): Ink | null => INDEX_INK[index] ?? null;

const SHADE_ORDER: Shade[] = ['d2', 'd', 'b', 'l'];

export function shift(ink: Ink, steps: number): Ink {
	const [m, s] = ink.split('.') as [string, Shade];
	if (m === 'fixed') return ink;
	const i = Math.max(0, Math.min(3, SHADE_ORDER.indexOf(s) + steps));
	return `${m}.${SHADE_ORDER[i]}` as Ink;
}

export type Pt = [number, number];

export class Pixels {
	readonly w: number;
	readonly h: number;
	readonly data: Uint8Array;
	constructor(w: number, h: number) {
		this.w = w;
		this.h = h;
		this.data = new Uint8Array(w * h);
	}

	set(x: number, y: number, ink: Ink | null): this {
		x = Math.round(x);
		y = Math.round(y);
		if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.data[y * this.w + x] = inkIndex(ink);
		return this;
	}

	rect(x: number, y: number, w: number, h: number, ink: Ink | null): this {
		for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, ink);
		return this;
	}

	ellipse(x: number, y: number, w: number, h: number, ink: Ink | null): this {
		const rx = w / 2;
		const ry = h / 2;
		for (let j = 0; j < h; j++) {
			for (let i = 0; i < w; i++) {
				const dx = (i + 0.5 - rx) / rx;
				const dy = (j + 0.5 - ry) / ry;
				if (dx * dx + dy * dy <= 1) this.set(x + i, y + j, ink);
			}
		}
		return this;
	}

	grid(x: number, y: number, rows: string[], legend: Record<string, Ink | null>): this {
		rows.forEach((row, j) => {
			[...row].forEach((ch, i) => {
				if (ch === '.' || ch === ' ') return;
				if (!(ch in legend)) throw new Error(`No ink for "${ch}" in legend`);
				this.set(x + i, y + j, legend[ch]);
			});
		});
		return this;
	}

	box(x: number, y: number, w: number, h: number, material: Material): this {
		this.rect(x, y, w, h, `${material}.d2`);
		if (w > 2 && h > 2) {
			this.rect(x + 1, y + 1, w - 2, h - 2, `${material}.b`);
			this.rect(x + 1, y + 1, w - 2, 1, `${material}.l`);
			this.rect(x + 1, y + 1, 1, h - 2, `${material}.l`);
			this.rect(x + 1, y + h - 2, w - 2, 1, `${material}.d`);
			this.rect(x + w - 2, y + 2, 1, h - 3, `${material}.d`);
		}
		return this;
	}

	copy(): Pixels {
		const p = new Pixels(this.w, this.h);
		p.data.set(this.data);
		return p;
	}

	get(x: number, y: number): Ink | null {
		x = Math.round(x);
		y = Math.round(y);
		if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
		return inkAt(this.data[y * this.w + x]);
	}

	line(x0: number, y0: number, x1: number, y1: number, ink: Ink | null): this {
		x0 = Math.round(x0);
		y0 = Math.round(y0);
		x1 = Math.round(x1);
		y1 = Math.round(y1);
		const dx = Math.abs(x1 - x0);
		const dy = -Math.abs(y1 - y0);
		const sx = x0 < x1 ? 1 : -1;
		const sy = y0 < y1 ? 1 : -1;
		let err = dx + dy;
		for (;;) {
			this.set(x0, y0, ink);
			if (x0 === x1 && y0 === y1) break;
			const e2 = 2 * err;
			if (e2 >= dy) {
				err += dy;
				x0 += sx;
			}
			if (e2 <= dx) {
				err += dx;
				y0 += sy;
			}
		}
		return this;
	}

	path(points: Pt[], ink: Ink | null): this {
		for (let i = 1; i < points.length; i++) this.line(...points[i - 1], ...points[i], ink);
		return this;
	}

	poly(points: Pt[], ink: Ink | null): this {
		const ys = points.map((p) => p[1]);
		const top = Math.floor(Math.min(...ys));
		const bottom = Math.ceil(Math.max(...ys));
		for (let y = top; y <= bottom; y++) {
			const cy = y + 0.5;
			const xs: number[] = [];
			for (let i = 0; i < points.length; i++) {
				const [ax, ay] = points[i];
				const [bx, by] = points[(i + 1) % points.length];
				if (ay <= cy !== by <= cy) xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax));
			}
			xs.sort((a, b) => a - b);
			for (let i = 0; i + 1 < xs.length; i += 2) {
				for (let x = Math.ceil(xs[i] - 0.5); x <= Math.floor(xs[i + 1] - 0.5); x++)
					this.set(x, y, ink);
			}
		}
		return this;
	}

	map(fn: (ink: Ink | null, x: number, y: number) => Ink | null | undefined, area?: Rect): this {
		const { x: ax, y: ay, w, h } = area ?? { x: 0, y: 0, w: this.w, h: this.h };
		for (let y = ay; y < ay + h; y++) {
			for (let x = ax; x < ax + w; x++) {
				const next = fn(this.get(x, y), x, y);
				if (next !== undefined) this.set(x, y, next);
			}
		}
		return this;
	}

	outline(ink?: Ink, area?: Rect): this {
		const snapshot = this.copy();
		const { x: ax, y: ay, w, h } = area ?? { x: 0, y: 0, w: this.w, h: this.h };
		for (let y = ay; y < ay + h; y++) {
			for (let x = ax; x < ax + w; x++) {
				if (snapshot.get(x, y)) continue;
				const n = [
					snapshot.get(x - 1, y),
					snapshot.get(x + 1, y),
					snapshot.get(x, y - 1),
					snapshot.get(x, y + 1)
				].find((v) => v !== null);
				if (n) this.set(x, y, ink ?? (n.startsWith('fixed.') ? n : shift(n, -3)));
			}
		}
		return this;
	}

	blit(src: Pixels, dx: number, dy: number, flipX = false): this {
		for (let y = 0; y < src.h; y++) {
			for (let x = 0; x < src.w; x++) {
				const v = src.data[y * src.w + (flipX ? src.w - 1 - x : x)];
				if (v) this.set(dx + x, dy + y, inkAt(v));
			}
		}
		return this;
	}
}

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface TagDef {
	name: string;
	from: number;
	to: number;
	direction?: 'forward' | 'reverse' | 'pingpong' | 'pingpong_reverse';
	repeat?: number;
	events?: Record<number, string>;
}

export interface FrameDef {
	draw: (p: Pixels) => void;
	duration: number;
}

export interface SpriteDef {
	name: string;
	width: number;
	height: number;
	anchor: [number, number];
	frames: FrameDef[];
	tags?: TagDef[];
	slices?: Record<string, Rect | Rect[]>;
}

const SHEET_MAX_WIDTH = 2048;

export function writeSheet(def: SpriteDef): number {
	const { name, width: w, height: h } = def;
	// Identical frames share one cell, like Aseprite's "merge duplicates" export option.
	const drawn = def.frames.map((f) => {
		const p = new Pixels(w, h);
		f.draw(p);
		return p;
	});
	const cellOf = new Map<string, number>();
	const cells: Pixels[] = [];
	const frameCell = drawn.map((p) => {
		const key = Buffer.from(p.data).toString('base64');
		let cell = cellOf.get(key);
		if (cell === undefined) {
			cell = cells.length;
			cells.push(p);
			cellOf.set(key, cell);
		}
		return cell;
	});
	const cols = Math.max(1, Math.min(cells.length, Math.floor(SHEET_MAX_WIDTH / w)));
	const rows = Math.ceil(cells.length / cols);
	const sheet = new Uint8Array(cols * w * rows * h);
	const sheetW = cols * w;
	cells.forEach((p, i) => {
		const fx = (i % cols) * w;
		const fy = Math.floor(i / cols) * h;
		for (let y = 0; y < h; y++)
			sheet.set(p.data.subarray(y * w, y * w + w), (fy + y) * sheetW + fx);
	});

	const frames = def.frames.map((f, i) => {
		const fx = (frameCell[i] % cols) * w;
		const fy = Math.floor(frameCell[i] / cols) * h;
		return {
			filename: `${name} ${i}.aseprite`,
			frame: { x: fx, y: fy, w, h },
			rotated: false,
			trimmed: false,
			spriteSourceSize: { x: 0, y: 0, w, h },
			sourceSize: { w, h },
			duration: f.duration
		};
	});

	const slices = [
		{
			name: 'anchor',
			color: '#0000ffff',
			keys: [
				{ frame: 0, bounds: { x: 0, y: 0, w, h }, pivot: { x: def.anchor[0], y: def.anchor[1] } }
			]
		},
		...Object.entries(def.slices ?? {}).map(([sliceName, rect]) => ({
			name: sliceName,
			color: '#ff0000ff',
			keys: (Array.isArray(rect) ? rect : [rect]).map((r, frame) => ({
				frame,
				bounds: { x: r.x, y: r.y, w: r.w, h: r.h }
			}))
		}))
	];

	const json = {
		frames,
		meta: {
			app: 'https://www.aseprite.org/',
			version: '1.3',
			image: `${name}.png`,
			format: 'I8',
			size: { w: sheetW, h: rows * h },
			scale: '1',
			frameTags: (def.tags ?? []).map((t) => ({
				name: t.name,
				from: t.from,
				to: t.to,
				direction: t.direction ?? 'forward',
				...(t.repeat ? { repeat: String(t.repeat) } : {}),
				color: '#000000ff',
				...(t.events
					? {
							data: Object.entries(t.events)
								.map(([frame, name]) => `${frame}:${name}`)
								.join(' ')
						}
					: {})
			})),
			layers: [{ name: 'Layer 1', opacity: 255, blendMode: 'normal' }],
			slices
		}
	};

	const png = encodeIndexed(sheetW, rows * h, sheet, PNG_PALETTE);
	writeFileSync(`${ART_DIR}${name}.png`, png);
	writeFileSync(`${ART_DIR}${name}.json`, JSON.stringify(json, null, '\t') + '\n');
	return png.length;
}

export function frames(
	count: number,
	duration: number,
	draw: (p: Pixels, i: number) => void
): FrameDef[] {
	return Array.from({ length: count }, (_, i) => ({ duration, draw: (p: Pixels) => draw(p, i) }));
}
