import sceneJson from './art/scene.json';
import type { SceneTime } from './palettes.ts';
import type { Geometry, LayoutId, Rect } from './viewport.ts';

export type { LayoutId, Rect };

export type LayerId = 'far' | 'wall' | 'near';

export type WeightName = 'day' | 'dark' | 'night' | 'stars';

/** A spot on the back wall; it moves between layouts. Width and height are given for boxes. */
export interface Place {
	x: number;
	y: number;
	w?: number;
	h?: number;
}

export interface DrawSprite {
	sprite: string;
	layer: LayerId;
	/** Fixed scene position of the anchor. */
	at?: [number, number];
	/** Or a place in the current layout, plus an optional offset from it. */
	place?: string;
	offset?: [number, number];
	attach?: [string, string];
	/** Show the same frame as another sprite with the same frames (Joelle's forearms follow the body). */
	follow?: string;
	/** A flag that must be set, or with a leading "!", must not be. */
	requires?: string;
	tag?: string;
	dark?: string;
	weight?: WeightName;
}

export interface DrawLight {
	light: string;
}

/** Clears a place's box from what is drawn so far, so the sky shows through (window glass). */
export interface DrawCut {
	cut: string;
}

export interface DrawProcedural {
	procedural: 'sky' | 'stars' | 'orb' | 'clockHands';
	layer: LayerId;
}

export type DrawItem = DrawSprite | DrawLight | DrawProcedural | DrawCut;

export interface GlowLight {
	kind: 'glow';
	color: string;
	x: number;
	y: number;
	rx: number;
	ry: number;
	/** Light only inside this box, so it stays off faces and cats that should not be dithered. */
	clip?: Rect;
}

export interface ShaftLight {
	kind: 'shaft';
	color: string;
	/** Corners clockwise from top left; relative to `place` when given. */
	polygon: [number, number][];
	place?: string;
}

/** An even pool of light over a place's box, with a short dithered edge. */
export interface PoolLight {
	kind: 'pool';
	color: string;
	place: string;
}

export type LightDef = GlowLight | ShaftLight | PoolLight;

export interface Orb {
	/** Position as a share of the window glass. */
	u: number;
	v: number;
	r: number;
	moon?: boolean;
}

export interface SceneLayoutDef {
	focus: Rect;
	places: Record<string, Place>;
}

export interface SceneLayout {
	native: { w: number; h: number };
	/** How far the view outside the window shifts, at most, as the pointer crosses the scene. */
	parallax: { maxOffsetX: number; maxOffsetY: number };
	layouts: Record<LayoutId, SceneLayoutDef>;
	/**
	 * Boxes relative to a place: the sign's text and the corkboard notes on their boards, and the
	 * radio's clickable box around its anchor on the desk.
	 */
	insets: { signText: Rect; radio: Rect; notes: Rect[] };
	/** The wall clock's hands, drawn by code: centre on the clock sprite, and lengths in pixels. */
	clock: { centre: [number, number]; hour: number; minute: number; second: number };
	sky: {
		bands: number;
		orbs: Record<SceneTime, Orb>;
		/** Positions as a share of the window glass. */
		stars: [number, number][];
	};
	lights: Record<string, LightDef>;
	draw: DrawItem[];
}

export const SCENE = sceneJson as unknown as SceneLayout;
const LAYOUT_IDS = Object.keys(SCENE.layouts) as LayoutId[];
export const NATIVE_W = SCENE.native.w;
export const NATIVE_H = SCENE.native.h;

/** A place's box in a layout; null when that layout leaves the object out. */
export function placeBox(layout: LayoutId, name: string): Rect | null {
	const p = SCENE.layouts[layout].places[name];
	return p ? { x: p.x, y: p.y, w: p.w ?? 0, h: p.h ?? 0 } : null;
}

/**
 * CSS custom properties that place an in-room element over a place in every layout
 * (`--landscape-x` …); layout.css picks the set for the current layout.
 */
export function placeVars(name: string, inset?: Rect): string {
	return LAYOUT_IDS.map((id) => {
		const b = placeBox(id, name);
		if (!b) return `--${id}-x:-999;--${id}-y:-999;--${id}-w:0;--${id}-h:0`;
		const r = inset ? { x: b.x + inset.x, y: b.y + inset.y, w: inset.w, h: inset.h } : b;
		return `--${id}-x:${r.x};--${id}-y:${r.y};--${id}-w:${r.w};--${id}-h:${r.h}`;
	}).join(';');
}

/** The text and switchers: what a cropped view must keep whole. */
function essentials(layout: LayoutId): Rect {
	const boxes = ['sign', 'cork', 'clock', 'swatch'].flatMap((n) => {
		const b = placeBox(layout, n);
		return b ? [b] : [];
	});
	const x0 = Math.min(...boxes.map((b) => b.x)) - 6;
	const y0 = Math.min(...boxes.map((b) => b.y)) - 10;
	const x1 = Math.max(...boxes.map((b) => b.x + b.w)) + 6;
	const y1 = Math.max(...boxes.map((b) => b.y + b.h)) + 6;
	return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export const GEOMETRY: Geometry = {
	world: SCENE.native,
	layouts: Object.fromEntries(
		LAYOUT_IDS.map((id) => [id, { focus: SCENE.layouts[id].focus, essentials: essentials(id) }])
	) as Geometry['layouts'],
	minCssScale: 2,
	topShare: 0.3
};
