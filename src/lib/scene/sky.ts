import { lerpRgb, rgbToHex, type RGB } from './color.ts';
import { bayer } from './dither.ts';
import type { Lighting, OrbState } from './lighting.ts';

const BAND_DITHER_SHARE = 0.4;

export function renderSkyGradient(
	sky: { top: number; bottom: number; bands: number },
	lighting: Lighting,
	w: number,
	h: number
): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d')!;
	const img = ctx.createImageData(w, h);
	const n = Math.max(2, sky.bands);
	const colors: RGB[] = Array.from(
		{ length: n },
		(_, i) => lerpRgb(lighting.skyTop, lighting.skyBottom, i / (n - 1)).map(Math.round) as RGB
	);
	for (let y = 0; y < h; y++) {
		const t = Math.max(0, Math.min(1, (y + 0.5 - sky.top) / (sky.bottom - sky.top)));
		for (let x = 0; x < w; x++) {
			const f = t * (n - 1) + 0.5 + (bayer(x, y) - 0.5) * BAND_DITHER_SHARE;
			const c = colors[Math.max(0, Math.min(n - 1, Math.floor(f)))];
			const i = (y * w + x) * 4;
			img.data[i] = c[0];
			img.data[i + 1] = c[1];
			img.data[i + 2] = c[2];
			img.data[i + 3] = 255;
		}
	}
	ctx.putImageData(img, 0, 0);
	return canvas;
}

function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
	for (let dy = -r; dy <= r; dy++) {
		const half = Math.round(Math.sqrt(Math.max(0, (r + 0.5) ** 2 - dy * dy)) - 0.5);
		ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
	}
}

export function drawOrb(
	ctx: CanvasRenderingContext2D,
	orb: { x: number; y: number; r: number; moon?: boolean },
	state: OrbState,
	ox: number,
	oy: number
): void {
	const cx = orb.x + ox;
	const cy = orb.y + oy;
	if (orb.moon) {
		ctx.fillStyle = rgbToHex(state.color);
		const r = orb.r;
		for (let dy = -r; dy <= r; dy++) {
			for (let dx = -r; dx <= r; dx++) {
				const inMoon = dx * dx + dy * dy <= (r + 0.3) ** 2;
				const sx = dx - Math.round(r * 0.55);
				const sy = dy + Math.round(r * 0.25);
				const inShadow = sx * sx + sy * sy <= (r - 0.5) ** 2;
				if (inMoon && !inShadow) ctx.fillRect(cx + dx, cy + dy, 1, 1);
			}
		}
		return;
	}
	ctx.fillStyle = rgbToHex(state.halo);
	disc(ctx, cx, cy, orb.r + 2);
	ctx.fillStyle = rgbToHex(state.color);
	disc(ctx, cx, cy, orb.r);
}

export function drawStars(
	ctx: CanvasRenderingContext2D,
	stars: [number, number][],
	weight: number,
	color: RGB,
	ox: number,
	oy: number
): void {
	if (weight <= 0) return;
	ctx.fillStyle = rgbToHex(color);
	stars.forEach(([x, y], i) => {
		const threshold = (((i * 5 + 3) % 16) + 0.5) / 16;
		if (threshold < weight) ctx.fillRect(x + ox, y + oy, 1, 1);
	});
}
