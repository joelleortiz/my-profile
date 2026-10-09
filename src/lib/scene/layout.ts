import sceneJson from './art/scene.json';
import type { SceneTime } from './palettes.ts';

export type LayerId = 'far' | 'wall' | 'near' | 'front' | 'foreground';

export type WeightName = 'day' | 'dark' | 'night' | 'stars';

export interface DrawSprite {
	sprite: string;
	layer: LayerId;
	at?: [number, number];
	attach?: [string, string];
	requires?: string;
	tag?: string;
	dark?: string;
	weight?: WeightName;
}

export interface DrawLight {
	light: string;
}

export interface DrawAgain {
	again: string;
	clip: [number, number, number, number];
}

export interface DrawProcedural {
	procedural: 'sky' | 'stars' | 'orb';
	layer: LayerId;
}

export type DrawItem = DrawSprite | DrawLight | DrawProcedural | DrawAgain;

export interface GlowLight {
	kind: 'glow';
	layer: LayerId;
	color: string;
	x: number;
	y: number;
	rx: number;
	ry: number;
}

export interface ShaftLight {
	kind: 'shaft';
	layer: LayerId;
	color: string;
	polygon: [number, number][];
}

export type LightDef = GlowLight | ShaftLight;

export interface Orb {
	x: number;
	y: number;
	r: number;
	moon?: boolean;
}

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface SceneLayout {
	native: { w: number; h: number };
	parallax: { maxOffsetX: number; maxOffsetY: number };
	layers: { id: LayerId; parallax: number }[];
	crop: Rect;
	sky: {
		top: number;
		bottom: number;
		bands: number;
		orbs: Record<SceneTime, Orb>;
		stars: [number, number][];
	};
	lights: Record<string, LightDef>;
	draw: DrawItem[];
}

export const SCENE = sceneJson as unknown as SceneLayout;
export const NATIVE_W = SCENE.native.w;
export const NATIVE_H = SCENE.native.h;
