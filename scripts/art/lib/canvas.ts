import { Pixels, type Ink, type Pt } from './sheet.ts';

/**
 * Short names for inks that are a role rather than a material of their own. Everything else is
 * a key-palette ink ("material.shade") or a fixed colour ("fixed.name").
 */
const ALIASES: Record<string, string> = {
	'stripe.b': 'tabby.d2',
	'stripe.d': 'tabby.d2',
	'stripe.d2': 'hair.b',
	'outline.b': 'hair.d2',
	'grille.b': 'chair.d2',
	'grille.d': 'chair.d2',
	'grille.d2': 'hair.d2',
	'metal.d2': 'laptop.d2',
	'metal.d': 'laptop.d',
	'metal.b': 'laptop.b',
	'metal.l': 'laptop.l',
	'face.b': 'catWhite.b',
	'face.d': 'catWhite.d',
	'bulb.b': 'lampGlow.b',
	'bulb.l': 'lampGlow.l',
	'lips.b': 'skin.d2',
	'lips.d': 'skin.d2',
	'blush.b': 'nose.l',
	'ear.b': 'nose.d',
	'catNose.b': 'nose.b',
	'eyeDark.b': 'hair.d2',
	'eyeMid.b': 'hair.d',
	'eyeShine.b': 'catWhite.l',
	'ceiling.b': 'wall.d2',
	'ceiling.d': 'hair.l'
};

export function ink(name: string): Ink {
	return (ALIASES[name] ?? name) as Ink;
}

/** Pixels that accept ink aliases, with a few extra drawing helpers used by the scene art. */
export class Canvas extends Pixels {
	override set(x: number, y: number, name: string | null): this {
		return super.set(x, y, name === null ? null : ink(name));
	}

	override rect(x: number, y: number, w: number, h: number, name: string | null): this {
		return super.rect(x, y, w, h, name as Ink | null);
	}

	override ellipse(x: number, y: number, w: number, h: number, name: string | null): this {
		return super.ellipse(x, y, w, h, name as Ink | null);
	}

	override line(x0: number, y0: number, x1: number, y1: number, name: string | null): this {
		return super.line(x0, y0, x1, y1, name as Ink | null);
	}

	override path(points: Pt[], name: string | null): this {
		return super.path(points, name as Ink | null);
	}

	override poly(points: Pt[], name: string | null): this {
		return super.poly(points, name as Ink | null);
	}

	override grid(x: number, y: number, rows: string[], legend: Record<string, string | null>): this {
		return super.grid(x, y, rows, legend as Record<string, Ink | null>);
	}

	/** Like map(), with ink names or aliases. */
	remap(
		fn: (name: string | null, x: number, y: number) => string | null | undefined,
		area?: { x: number; y: number; w: number; h: number }
	): this {
		return this.map(fn as (name: Ink | null, x: number, y: number) => Ink | null | undefined, area);
	}

	override outline(name?: string, area?: { x: number; y: number; w: number; h: number }): this {
		return super.outline(name === undefined ? undefined : ink(name), area);
	}

	hline(x0: number, x1: number, y: number, name: string | null): this {
		for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, name);
		return this;
	}

	vline(x: number, y0: number, y1: number, name: string | null): this {
		for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, name);
		return this;
	}

	/** One-pixel ring tracing the edge of an ellipse. */
	ring(x: number, y: number, w: number, h: number, name: string): this {
		const tmp = new Canvas(w + 2, h + 2);
		tmp.ellipse(1, 1, w, h, 'wall.b');
		for (let j = 0; j < h + 2; j++)
			for (let i = 0; i < w + 2; i++) {
				if (!tmp.get(i, j)) continue;
				const edge =
					!tmp.get(i - 1, j) || !tmp.get(i + 1, j) || !tmp.get(i, j - 1) || !tmp.get(i, j + 1);
				if (edge) this.set(x + i - 1, y + j - 1, name);
			}
		return this;
	}

	/** Shaded ellipse lit from the top left, without a rim. */
	shaded(x: number, y: number, w: number, h: number, material: string, bias = 0): this {
		const rx = w / 2;
		const ry = h / 2;
		for (let j = 0; j < h; j++)
			for (let i = 0; i < w; i++) {
				const nx = (i + 0.5 - rx) / rx;
				const ny = (j + 0.5 - ry) / ry;
				if (nx * nx + ny * ny > 1) continue;
				const f = -0.62 * nx - 0.78 * ny + bias;
				const s = f > 0.5 ? 'l' : f > -0.25 ? 'b' : f > -0.7 ? 'd' : 'd2';
				this.set(x + i, y + j, `${material}.${s}`);
			}
		return this;
	}

	override copy(): Canvas {
		const p = new Canvas(this.w, this.h);
		p.data.set(this.data);
		return p;
	}

	/** Copies a rectangle out into a new canvas. */
	crop(x: number, y: number, w: number, h: number): Canvas {
		const out = new Canvas(w, h);
		for (let j = 0; j < h; j++)
			for (let i = 0; i < w; i++) {
				const v = this.get(x + i, y + j);
				if (v) out.set(i, j, v);
			}
		return out;
	}

	/** Bounding box of the opaque pixels. */
	bounds(): { x: number; y: number; w: number; h: number } | null {
		let x0 = Infinity;
		let y0 = Infinity;
		let x1 = -1;
		let y1 = -1;
		for (let y = 0; y < this.h; y++)
			for (let x = 0; x < this.w; x++)
				if (this.data[y * this.w + x]) {
					x0 = Math.min(x0, x);
					y0 = Math.min(y0, y);
					x1 = Math.max(x1, x);
					y1 = Math.max(y1, y);
				}
		return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
	}
}

/** A tapered limb from a to b as a filled quad with round ends. */
export function limb(p: Canvas, a: Pt, b: Pt, wa: number, wb: number, name: string): void {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const len = Math.hypot(dx, dy) || 1;
	const nx = -dy / len;
	const ny = dx / len;
	p.poly(
		[
			[a[0] + (nx * wa) / 2, a[1] + (ny * wa) / 2],
			[b[0] + (nx * wb) / 2, b[1] + (ny * wb) / 2],
			[b[0] - (nx * wb) / 2, b[1] - (ny * wb) / 2],
			[a[0] - (nx * wa) / 2, a[1] - (ny * wa) / 2]
		],
		ink(name)
	);
	p.ellipse(a[0] - wa / 2, a[1] - wa / 2, wa, wa, ink(name));
	p.ellipse(b[0] - wb / 2, b[1] - wb / 2, wb, wb, ink(name));
}
