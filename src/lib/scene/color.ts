export type RGB = [number, number, number];

export interface Ramp {
	d2: string;
	d: string;
	b: string;
	l: string;
}

export const SHADES = ['d2', 'd', 'b', 'l'] as const;
export type Shade = (typeof SHADES)[number];

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

export function hexToRgb(hex: string): RGB {
	const n = parseInt(hex.slice(1, 7), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: RGB): string {
	const to = (v: number) =>
		Math.max(0, Math.min(255, Math.round(v)))
			.toString(16)
			.padStart(2, '0');
	return `#${to(r)}${to(g)}${to(b)}`;
}

export const rgbKey = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b;

export function rgbToHsl([r, g, b]: RGB): [number, number, number] {
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	let h = 0;
	let s = 0;
	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
		else if (max === g) h = (b - r) / d + 2;
		else h = (r - g) / d + 4;
		h *= 60;
	}
	return [h, s, l];
}

export function hslToHex(h: number, s: number, l: number): string {
	h = ((h % 360) + 360) % 360;
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;
	let rgb: RGB;
	if (h < 60) rgb = [c, x, 0];
	else if (h < 120) rgb = [x, c, 0];
	else if (h < 180) rgb = [0, c, x];
	else if (h < 240) rgb = [0, x, c];
	else if (h < 300) rgb = [x, 0, c];
	else rgb = [c, 0, x];
	return rgbToHex([(rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255]);
}

function towards(h: number, target: number, amount: number): number {
	const diff = ((target - h + 540) % 360) - 180;
	return h + Math.sign(diff) * Math.min(Math.abs(diff), amount);
}

export function ramp(base: string, shadowHue: number, lightHue: number): Ramp {
	const [h, s, l] = rgbToHsl(hexToRgb(base));
	const grey = s < 0.12;
	const lD = Math.max(l - 0.13, l * 0.55);
	const lD2 = Math.max(l - 0.27, l * 0.3);
	return {
		d2: grey
			? hslToHex(shadowHue, Math.min(0.25, s + 0.1), lD2)
			: hslToHex(towards(h, shadowHue, 26), clamp(s + 0.06), lD2),
		d: grey
			? hslToHex(shadowHue, Math.min(0.2, s + 0.06), lD)
			: hslToHex(towards(h, shadowHue, 13), clamp(s + 0.03), lD),
		b: base.toLowerCase(),
		l: grey
			? hslToHex(lightHue, Math.min(0.2, s + 0.04), clamp(l + 0.1, 0, 0.97))
			: hslToHex(towards(h, lightHue, 10), clamp(s - 0.02), clamp(l + 0.1, 0, 0.97))
	};
}

export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

export function lerpRgb(a: RGB, b: RGB, t: number): RGB {
	return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export function lerpHex(a: string, b: string, t: number): string {
	return rgbToHex(lerpRgb(hexToRgb(a), hexToRgb(b), t));
}

export function colorDistance(a: RGB, b: RGB): number {
	const rm = (a[0] + b[0]) / 2;
	const dr = a[0] - b[0];
	const dg = a[1] - b[1];
	const db = a[2] - b[2];
	return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
}

export function nearestIndex(c: RGB, list: RGB[]): number {
	let best = 0;
	let bestD = Infinity;
	for (let i = 0; i < list.length; i++) {
		const d = colorDistance(c, list[i]);
		if (d < bestD) {
			bestD = d;
			best = i;
		}
	}
	return best;
}

export function luminance(hex: string): number {
	const lin = hexToRgb(hex).map((v) => {
		const c = v / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

export function contrastRatio(a: string, b: string): number {
	const la = luminance(a);
	const lb = luminance(b);
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
