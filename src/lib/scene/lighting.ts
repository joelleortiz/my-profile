import { hexToRgb, lerp, lerpRgb, type RGB } from './color.ts';
import { bayer } from './dither.ts';
import type { Rect, WeightName } from './layout.ts';
import { PALETTES, type PaletteKey, type SceneTime } from './palettes.ts';

interface TimeLight {
	lights: Record<string, number>;
	haze: number;
	weights: Record<WeightName, number>;
}

export const TIME_LIGHT: Record<SceneTime, TimeLight> = {
	morning: {
		lights: { shaft: 0.24, lamp: 0, screen: 0, signPool: 0, corkPool: 0 },
		haze: 0.45,
		weights: { day: 1, dark: 0, night: 0, stars: 0 }
	},
	day: {
		lights: { shaft: 0.16, lamp: 0, screen: 0, signPool: 0, corkPool: 0 },
		haze: 0.45,
		weights: { day: 1, dark: 0, night: 0, stars: 0 }
	},
	dusk: {
		lights: { shaft: 0.2, lamp: 0.32, screen: 0.14, signPool: 0.4, corkPool: 0.4 },
		haze: 0.25,
		weights: { day: 0, dark: 1, night: 0, stars: 0.3 }
	},
	night: {
		lights: { shaft: 0, lamp: 0.5, screen: 0.26, signPool: 0.62, corkPool: 0.62 },
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

/** A light with its geometry resolved for the current layout, in scene pixels. */
export type ResolvedLight =
	| { kind: 'glow'; x: number; y: number; rx: number; ry: number; clip?: Rect }
	| { kind: 'shaft'; polygon: [number, number][] }
	| { kind: 'pool'; box: Rect };

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

function ellipseFalloff(
	x: number,
	y: number,
	cx: number,
	cy: number,
	rx: number,
	ry: number
): number {
	const dx = (x + 0.5 - cx) / rx;
	const dy = (y + 0.5 - cy) / ry;
	return 1 - Math.sqrt(dx * dx + dy * dy);
}

const inside = (r: Rect, x: number, y: number) =>
	x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

function glowLevels(def: Extract<ResolvedLight, { kind: 'glow' }>, x: number, y: number): number {
	if (def.clip && !inside(def.clip, x, y)) return 0;
	const f = ellipseFalloff(x, y, def.x, def.y, def.rx, def.ry);
	return f > 0 ? quantize(f ** 1.4, x, y) : 0;
}

/** Fully lit inside, with a short dithered edge, so text on the lit surface stays even. */
function poolLevels(box: Rect, x: number, y: number): number {
	if (!inside(box, x, y)) return 0;
	const f = ellipseFalloff(x, y, box.x + box.w / 2, box.y + box.h / 2, box.w * 0.75, box.h * 0.8);
	return f > 0 ? quantize(Math.min(1, f * 4), x, y) : 0;
}

function shaftLevels(polygon: [number, number][], x: number, y: number): number {
	const [tl, tr, br, bl] = polygon;
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

function bounds(def: ResolvedLight): Rect {
	if (def.kind === 'glow') {
		const r = {
			x: Math.floor(def.x - def.rx),
			y: Math.floor(def.y - def.ry),
			w: Math.ceil(def.rx * 2) + 1,
			h: Math.ceil(def.ry * 2) + 1
		};
		if (!def.clip) return r;
		const x = Math.max(r.x, def.clip.x);
		const y = Math.max(r.y, def.clip.y);
		return {
			x,
			y,
			w: Math.max(1, Math.min(r.x + r.w, def.clip.x + def.clip.w) - x),
			h: Math.max(1, Math.min(r.y + r.h, def.clip.y + def.clip.h) - y)
		};
	}
	if (def.kind === 'pool') return def.box;
	const xs = def.polygon.map((p) => p[0]);
	const ys = def.polygon.map((p) => p[1]);
	const x = Math.floor(Math.min(...xs));
	const y = Math.floor(Math.min(...ys));
	return { x, y, w: Math.ceil(Math.max(...xs)) - x, h: Math.ceil(Math.max(...ys)) - y };
}

export function renderLight(def: ResolvedLight, color: RGB, strength: number): LightImage | null {
	if (strength <= 0.004) return null;
	const { x: x0, y: y0, w, h } = bounds(def);
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
			const level =
				def.kind === 'glow'
					? glowLevels(def, sx, sy)
					: def.kind === 'pool'
						? poolLevels(def.box, sx, sy)
						: shaftLevels(def.polygon, sx, sy);
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
