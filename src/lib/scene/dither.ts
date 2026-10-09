import { colorDistance, hexToRgb, type RGB } from './color.ts';

// prettier-ignore
export const BAYER4 = [
	0, 8, 2, 10,
	12, 4, 14, 6,
	3, 11, 1, 9,
	15, 7, 13, 5
];

export function bayer(x: number, y: number): number {
	return (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}

const patterns = new Map<number, CanvasPattern>();

export function ditherPattern(ctx: CanvasRenderingContext2D, level: number): CanvasPattern {
	const cached = patterns.get(level);
	if (cached) return cached;
	const tile = document.createElement('canvas');
	tile.width = 4;
	tile.height = 4;
	const tctx = tile.getContext('2d')!;
	const img = tctx.createImageData(4, 4);
	for (let i = 0; i < 16; i++) if (BAYER4[i] < level) img.data[i * 4 + 3] = 255;
	tctx.putImageData(img, 0, 0);
	const pattern = ctx.createPattern(tile, 'repeat')!;
	patterns.set(level, pattern);
	return pattern;
}

export function createQuantizer(colors: readonly string[], spread = 28) {
	const pal: RGB[] = colors.map(hexToRgb);
	// A 5-bit-per-channel lookup keeps quantising a full frame to a couple of milliseconds.
	const lut = new Uint8Array(32 * 32 * 32);
	const probe: RGB = [0, 0, 0];
	for (let r = 0; r < 32; r++) {
		for (let g = 0; g < 32; g++) {
			for (let b = 0; b < 32; b++) {
				probe[0] = r * 8 + 4;
				probe[1] = g * 8 + 4;
				probe[2] = b * 8 + 4;
				let best = 0;
				let bestD = Infinity;
				for (let i = 0; i < pal.length; i++) {
					const d = colorDistance(probe, pal[i]);
					if (d < bestD) {
						bestD = d;
						best = i;
					}
				}
				lut[(r << 10) | (g << 5) | b] = best;
			}
		}
	}
	const offsets = BAYER4.map((v) => ((v + 0.5) / 16 - 0.5) * spread);

	return (img: ImageData) => {
		const { data, width, height } = img;
		for (let y = 0; y < height; y++) {
			const row = (y & 3) * 4;
			for (let x = 0; x < width; x++) {
				const i = (y * width + x) * 4;
				if (data[i + 3] === 0) continue;
				const o = offsets[row + (x & 3)];
				const r = Math.max(0, Math.min(255, data[i] + o)) >> 3;
				const g = Math.max(0, Math.min(255, data[i + 1] + o)) >> 3;
				const b = Math.max(0, Math.min(255, data[i + 2] + o)) >> 3;
				const c = pal[lut[(r << 10) | (g << 5) | b]];
				data[i] = c[0];
				data[i + 1] = c[1];
				data[i + 2] = c[2];
				data[i + 3] = 255;
			}
		}
	};
}
