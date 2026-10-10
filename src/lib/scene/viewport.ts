import {
	applyView as applyViewJs,
	fitView as fitViewJs,
	viewportSize as viewportSizeJs
} from './fit-view.js';

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** Desktop, phone, and phone held sideways: the wall objects sit differently in each. */
export type LayoutId = 'landscape' | 'portrait' | 'short';

export interface Geometry {
	world: { w: number; h: number };
	layouts: Record<LayoutId, { focus: Rect; essentials: Rect }>;
	/** Text never renders below this many CSS px per scene pixel. */
	minCssScale: number;
	/** Share of a phone's spare height that goes above the focus. */
	topShare: number;
}

export interface View {
	layout: LayoutId;
	/** True when even the smallest layout doesn't fit at the minimum scale and the room is cropped. */
	cropped: boolean;
	devicePxPerScenePx: number;
	cssPxPerScenePx: number;
	w: number;
	h: number;
	camX: number;
	camY: number;
}

export const fitView = fitViewJs as (
	cssW: number,
	cssH: number,
	dpr: number,
	g: Geometry,
	fullH?: number
) => View;

/** Width, small viewport height (to fit) and large viewport height (to cover), in CSS px. */
export const viewportSize = viewportSizeJs as () => { w: number; h: number; full: number };

export const applyView: (view: View, root: HTMLElement) => void = applyViewJs;
