import { hexToRgb, lerp, lerpRgb, type RGB } from './color.ts';
import { bayer } from './dither.ts';
import type { GlowLight, LightDef, ShaftLight, WeightName } from './layout.ts';
import { PALETTES, type PaletteKey, type SceneTime } from './palettes.ts';

interface TimeLight {
	lights: Record<string, number>;
	haze: number;
	weights: Record<WeightName, number>;
}

export const TIME_LIGHT: Record<SceneTime, TimeLight> = {
	morning: {
		lights: { shaft: 0.24, lamp: 0, screen: 0 },
		haze: 0.45,
		weights: { day: 1, dark: 0, night: 0, stars: 0 }
	},
	day: {
		lights: { shaft: 0.16, lamp: 0, screen: 0 },
		haze: 0.45,
		weights: { day: 1, dark: 0, night: 0, stars: 0 }
	},
	dusk: {
		lights: { shaft: 0.2, lamp: 0.34, screen: 0.22 },
		haze: 0.25,
		weights: { day: 0, dark: 1, night: 0, stars: 0.3 }
	},
	night: {
		lights: { shaft: 0, lamp: 0.55, screen: 0.45 },
		haze: 0.08,
		weights: { day: 0, dark: 1, night: 1, stars: 1 }
	}
};

const GLOW_LEVELS = 4;

export interface OrbState {
	time: SceneTime;
	weight: number;
	color: RGB;
	halo: RGB;
}

export interface Lighting {
	palette: PaletteKey;
	skyTop: RGB;
	skyBottom: RGB;
	orbs: OrbState[];
	tint: RGB;
	haze: number;
	lights: Record<string, number>;
	shaftColor: RGB;
	weights: Record<WeightName, number>;
}

const WHITE: RGB = [255, 255, 255];

function tintOf(palette: PaletteKey, time: SceneTime): [RGB, number] {
	const t = PALETTES[palette].tint[time];
	return t ? [hexToRgb(t[0]), t[1]] : [WHITE, 0];
}

function shaftColorOf(palette: PaletteKey, time: SceneTime): RGB {
	const sky = PALETTES[palette].sky[time];
	return hexToRgb(time === 'dusk' ? sky.orb : sky.bottom);
}

export function computeLighting(
	palette: PaletteKey,
	from: SceneTime,
	to: SceneTime,
	mix: number
): Lighting {
	const p = PALETTES[palette];
	const a = TIME_LIGHT[from];
	const b = TIME_LIGHT[to];
	const [tintA, strengthA] = tintOf(palette, from);
	const [tintB, strengthB] = tintOf(palette, to);
	const tintColor = lerpRgb(tintA, tintB, mix);
	const strength = lerp(strengthA, strengthB, mix);
	const tint = tintColor.map((c) => 1 - strength + (strength * c) / 255) as RGB;

	const lights: Record<string, number> = {};
	for (const name of new Set([...Object.keys(a.lights), ...Object.keys(b.lights)])) {
		lights[name] = lerp(a.lights[name] ?? 0, b.lights[name] ?? 0, mix);
	}
	const weights = {} as Record<WeightName, number>;
	for (const name of Object.keys(a.weights) as WeightName[]) {
		weights[name] = lerp(a.weights[name], b.weights[name], mix);
	}

	const orb = (time: SceneTime, weight: number): OrbState => {
		const sky = p.sky[time];
		return {
			time,
			weight,
			color: hexToRgb(sky.orb),
			halo: lerpRgb(hexToRgb(sky.orb), hexToRgb(sky.bottom), 0.55)
		};
	};

	return {
		palette,
		skyTop: lerpRgb(hexToRgb(p.sky[from].top), hexToRgb(p.sky[to].top), mix),
		skyBottom: lerpRgb(hexToRgb(p.sky[from].bottom), hexToRgb(p.sky[to].bottom), mix),
		orbs: from === to ? [orb(to, 1)] : [orb(from, 1 - mix), orb(to, mix)],
		tint,
		haze: lerp(a.haze, b.haze, mix),
		lights,
		shaftColor: lerpRgb(shaftColorOf(palette, from), shaftColorOf(palette, to), mix),
		weights
	};
}

export interface LightImage {
	canvas: HTMLCanvasElement;
	x: number;
	y: number;
	w: number;
	h: number;
}

function quantize(f: number, x: number, y: number): number {
	return Math.min(GLOW_LEVELS, Math.floor(f * GLOW_LEVELS + bayer(x, y))) / GLOW_LEVELS;
}

function glowLevels(def: GlowLight, x: number, y: number): number {
	const dx = (x + 0.5 - def.x) / def.rx;
	const dy = (y + 0.5 - def.y) / def.ry;
	const f = 1 - Math.sqrt(dx * dx + dy * dy);
	return f > 0 ? quantize(f ** 1.4, x, y) : 0;
}

function shaftLevels(def: ShaftLight, x: number, y: number): number {
	const [tl, tr, br, bl] = def.polygon;
	const top = Math.min(tl[1], tr[1]);
	const bottom = Math.max(bl[1], br[1]);
	if (y < top || y >= bottom) return 0;
	const t = (y + 0.5 - top) / (bottom - top);
	const left = lerp(tl[0], bl[0], t);
	const right = lerp(tr[0], br[0], t);
	if (x + 0.5 < left || x + 0.5 > right) return 0;
	const s = (x + 0.5 - left) / (right - left);
	const edge = Math.min(1, Math.min(s, 1 - s) * 5);
	return quantize((1 - 0.6 * t) * edge, x, y);
}

export function renderLight(def: LightDef, color: RGB, strength: number): LightImage | null {
	if (strength <= 0.004) return null;
	let x0: number, y0: number, x1: number, y1: number;
	if (def.kind === 'glow') {
		x0 = Math.floor(def.x - def.rx);
		y0 = Math.floor(def.y - def.ry);
		x1 = Math.ceil(def.x + def.rx);
		y1 = Math.ceil(def.y + def.ry);
	} else {
		const xs = def.polygon.map((p) => p[0]);
		const ys = def.polygon.map((p) => p[1]);
		x0 = Math.floor(Math.min(...xs));
		y0 = Math.floor(Math.min(...ys));
		x1 = Math.ceil(Math.max(...xs));
		y1 = Math.ceil(Math.max(...ys));
	}
	const w = x1 - x0;
	const h = y1 - y0;
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d')!;
	const img = ctx.createImageData(w, h);
	const d = img.data;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const sx = x0 + x;
			const sy = y0 + y;
			const level = def.kind === 'glow' ? glowLevels(def, sx, sy) : shaftLevels(def, sx, sy);
			if (level <= 0) continue;
			const k = level * strength;
			const i = (y * w + x) * 4;
			d[i] = color[0] * k;
			d[i + 1] = color[1] * k;
			d[i + 2] = color[2] * k;
			d[i + 3] = 255;
		}
	}
	ctx.putImageData(img, 0, 0);
	return { canvas, x: x0, y: y0, w, h };
}
