import { ENDESGA32, PALETTES, type PaletteKey } from './palettes.ts';
import { SHADES, hexToRgb, nearestIndex, ramp, type Ramp, type RGB } from './color.ts';

export const MATERIALS = [
	'wall',
	'floor',
	'desk',
	'chair',
	'rug',
	'plant',
	'pot',
	'frame',
	'poster',
	'curtain',
	'skin',
	'hair',
	'glasses',
	'sweater',
	'laptop',
	'tabby',
	'catWhite',
	'nose',
	'eye',
	'coffee',
	'milk',
	'straw',
	'lamp',
	'lampGlow',
	'cushion',
	'screen',
	'book0',
	'book1',
	'book2',
	'sticker0',
	'sticker1',
	'sticker2',
	'sticker3',
	'building',
	'hoodie',
	'jeans',
	'cork',
	'wood',
	'paper',
	'radio'
] as const;

export type Material = (typeof MATERIALS)[number];
export type Ramps = Record<Material, Ramp>;

/** The paint-swatch card's chips, top to bottom; the CV's header swatches repeat them. */
export const SWATCH_CHIPS: readonly Material[] = ['sweater', 'sticker1', 'sticker0', 'lamp'];

export function materialBase(key: PaletteKey, material: Material): string {
	const p = PALETTES[key];
	if (material === 'building') return p.building;
	const book = /^book(\d)$/.exec(material);
	if (book) return p.books[Number(book[1])];
	const sticker = /^sticker(\d)$/.exec(material);
	if (sticker) return p.stickers[Number(sticker[1])];
	return p.base[material as keyof typeof p.base];
}

const ENDESGA_RGB: RGB[] = ENDESGA32.map(hexToRgb);

function snapToEndesga(hex: string): string {
	return ENDESGA32[nearestIndex(hexToRgb(hex), ENDESGA_RGB)];
}

const rampCache = new Map<PaletteKey, Ramps>();

export function paletteRamps(key: PaletteKey): Ramps {
	const cached = rampCache.get(key);
	if (cached) return cached;
	const p = PALETTES[key];
	const quantize = 'quantize' in p && p.quantize === 'ENDESGA32';
	const out = {} as Ramps;
	for (const m of MATERIALS) {
		const fixed = 'ramps' in p ? (p.ramps as Partial<Ramps>)[m] : undefined;
		const r = fixed ? { ...fixed } : ramp(materialBase(key, m), p.shadowHue, p.lightHue);
		if (quantize) for (const s of SHADES) r[s] = snapToEndesga(r[s]);
		out[m] = r;
	}
	rampCache.set(key, out);
	return out;
}
