import keyPalette from './art/key-palette.json';
import { hexToRgb, SHADES, type RGB } from './color.ts';
import { paletteRamps, type Material } from './materials.ts';
import type { PaletteKey } from './palettes.ts';

// Matches a little-endian Uint32Array view of ImageData, with alpha in the top byte.
const pack = (r: number, g: number, b: number) => (b << 16) | (g << 8) | r;

const MATERIAL_COUNT = keyPalette.materials.length;

const KEY_INDEX = new Map<number, number>();
keyPalette.materials.forEach((m, mi) => {
	const shades = keyPalette.keys[m as keyof typeof keyPalette.keys];
	shades.forEach((hex, si) => {
		const [r, g, b] = hexToRgb(hex);
		KEY_INDEX.set(pack(r, g, b), mi * 4 + si);
	});
});

export type ColorTransform = (rgb: RGB) => RGB;

export interface ColorTable {
	keys: Uint32Array;
	transform: ColorTransform | null;
}

/** Materials that give off light: the tint after dark leaves them as they are. */
export const EMISSIVE: ReadonlySet<string> = new Set(['lampGlow', 'screen']);

export function colorTable(palette: PaletteKey, transform: ColorTransform | null): ColorTable {
	const ramps = paletteRamps(palette);
	const keys = new Uint32Array(MATERIAL_COUNT * 4);
	keyPalette.materials.forEach((m, mi) => {
		SHADES.forEach((s, si) => {
			let rgb = hexToRgb(ramps[m as Material][s]);
			if (transform && !EMISSIVE.has(m)) rgb = transform(rgb);
			keys[mi * 4 + si] = pack(Math.round(rgb[0]), Math.round(rgb[1]), Math.round(rgb[2]));
		});
	});
	return { keys, transform };
}

export function recolor(src: ImageData, out: ImageData, table: ColorTable): void {
	const s32 = new Uint32Array(src.data.buffer, src.data.byteOffset, src.data.length >> 2);
	const o32 = new Uint32Array(out.data.buffer, out.data.byteOffset, out.data.length >> 2);
	const memo = new Map<number, number>();
	for (let i = 0; i < s32.length; i++) {
		const v = s32[i];
		const a = v >>> 24;
		if (a === 0) {
			o32[i] = 0;
			continue;
		}
		const rgb = v & 0xffffff;
		let mapped = memo.get(rgb);
		if (mapped === undefined) {
			const k = KEY_INDEX.get(rgb);
			if (k !== undefined) {
				mapped = table.keys[k];
			} else if (table.transform) {
				const t = table.transform([rgb & 255, (rgb >> 8) & 255, (rgb >> 16) & 255]);
				mapped = pack(Math.round(t[0]), Math.round(t[1]), Math.round(t[2]));
			} else {
				mapped = rgb;
			}
			memo.set(rgb, mapped);
		}
		o32[i] = (mapped | (a << 24)) >>> 0;
	}
}
