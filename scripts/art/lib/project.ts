// A one-camera projector so the room, desk, laptop and chair share one viewpoint.
// World units are centimetres: x right, y up, z toward the camera; the back wall is z = 0.
// Quads are ray-cast per pixel into a canvas with a depth buffer; flat layers (characters,
// props) are drawn at the depth of their anchor.
import { Canvas } from './canvas.ts';
import { shift, type Ink } from './sheet.ts';

export type V3 = [number, number, number];

export interface Camera {
	x: number;
	y: number;
	z: number;
	/** Focal length in pixels. */
	f: number;
	/** Screen position of the vanishing point. */
	cx: number;
	cy: number;
}

export type Texture = (u: number, v: number) => string | null;

export class View {
	readonly px: Canvas;
	readonly depth: Float32Array;
	readonly ids: Int32Array;
	readonly cam: Camera;
	private nextId = 1;

	constructor(w: number, h: number, cam: Camera) {
		this.px = new Canvas(w, h);
		this.depth = new Float32Array(w * h).fill(Infinity);
		this.ids = new Int32Array(w * h);
		this.cam = cam;
	}

	id(): number {
		return this.nextId++;
	}

	project([x, y, z]: V3): [number, number, number] {
		const c = this.cam;
		const d = c.z - z;
		return [c.cx + (c.f * (x - c.x)) / d, c.cy - (c.f * (y - c.y)) / d, d];
	}

	/**
	 * Parallelogram p0, p1 = p0 + e1, p3 = p0 + e2, filled with a texture over u along e1 and
	 * v along e2 (both 0..1). Returns the object id it drew with.
	 */
	quad(p0: V3, p1: V3, p3: V3, tex: Texture | string, id = this.id()): number {
		const c = this.cam;
		const e1: V3 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
		const e2: V3 = [p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]];
		const corners = [p0, p1, p3, [p1[0] + e2[0], p1[1] + e2[1], p1[2] + e2[2]] as V3].map((p) =>
			this.project(p)
		);
		if (corners.some((k) => k[2] <= 1)) return id;
		const xs = corners.map((k) => k[0]);
		const ys = corners.map((k) => k[1]);
		const x0 = Math.max(0, Math.floor(Math.min(...xs)));
		const x1 = Math.min(this.px.w - 1, Math.ceil(Math.max(...xs)));
		const y0 = Math.max(0, Math.floor(Math.min(...ys)));
		const y1 = Math.min(this.px.h - 1, Math.ceil(Math.max(...ys)));
		const o: V3 = [c.x - p0[0], c.y - p0[1], c.z - p0[2]];
		const det3 = (a: V3, b: V3, d: V3) =>
			a[0] * (b[1] * d[2] - b[2] * d[1]) -
			a[1] * (b[0] * d[2] - b[2] * d[0]) +
			a[2] * (b[0] * d[1] - b[1] * d[0]);
		for (let sy = y0; sy <= y1; sy++)
			for (let sx = x0; sx <= x1; sx++) {
				const dir: V3 = [(sx + 0.5 - c.cx) / c.f, -(sy + 0.5 - c.cy) / c.f, -1];
				// Solve o + t·dir = u·e1 + v·e2  →  u·e1 + v·e2 − t·dir = o
				const nd: V3 = [-dir[0], -dir[1], -dir[2]];
				const D = det3(e1, e2, nd);
				if (Math.abs(D) < 1e-9) continue;
				const u = det3(o, e2, nd) / D;
				const v = det3(e1, o, nd) / D;
				const t = det3(e1, e2, o) / D;
				if (u < 0 || u >= 1 || v < 0 || v >= 1 || t <= 0) continue;
				const i = sy * this.px.w + sx;
				if (t >= this.depth[i]) continue;
				const ink = typeof tex === 'string' ? tex : tex(u, v);
				if (!ink) continue;
				this.depth[i] = t;
				this.ids[i] = id;
				this.px.set(sx, sy, ink === 'hole' ? null : ink);
			}
		return id;
	}

	/** Axis-aligned box (optionally rotated about a vertical axis) with per-face inks. */
	box(
		min: V3,
		max: V3,
		inks: {
			top?: string | Texture;
			front?: string | Texture;
			left?: string | Texture;
			right?: string | Texture;
			back?: string | Texture;
		},
		rot?: { angle: number; pivot: [number, number] }
	): number {
		const id = this.id();
		const r = (p: V3): V3 => {
			if (!rot) return p;
			const [px, pz] = rot.pivot;
			const s = Math.sin(rot.angle);
			const k = Math.cos(rot.angle);
			const dx = p[0] - px;
			const dz = p[2] - pz;
			return [px + dx * k + dz * s, p[1], pz - dx * s + dz * k];
		};
		const [x0, y0, z0] = min;
		const [x1, y1, z1] = max;
		if (inks.back) this.quad(r([x1, y1, z0]), r([x0, y1, z0]), r([x1, y0, z0]), inks.back, id);
		if (inks.top) this.quad(r([x0, y1, z0]), r([x1, y1, z0]), r([x0, y1, z1]), inks.top, id);
		if (inks.front) this.quad(r([x0, y1, z1]), r([x1, y1, z1]), r([x0, y0, z1]), inks.front, id);
		if (inks.left) this.quad(r([x0, y1, z0]), r([x0, y1, z1]), r([x0, y0, z0]), inks.left, id);
		if (inks.right) this.quad(r([x1, y1, z1]), r([x1, y1, z0]), r([x1, y0, z1]), inks.right, id);
		return id;
	}

	/** Draws a layer at a fixed depth (used for flat things on the wall). */
	flat(src: Canvas, dx: number, dy: number, d: number, flipX = false): number {
		const id = this.id();
		for (let y = 0; y < src.h; y++)
			for (let x = 0; x < src.w; x++) {
				const ink = src.get(flipX ? src.w - 1 - x : x, y);
				if (!ink) continue;
				const tx = dx + x;
				const ty = dy + y;
				if (tx < 0 || ty < 0 || tx >= this.px.w || ty >= this.px.h) continue;
				const i = ty * this.px.w + tx;
				if (d >= this.depth[i]) continue;
				this.depth[i] = d;
				this.ids[i] = id;
				this.px.set(tx, ty, ink);
			}
		return id;
	}

	/** Darkens the edge pixels of the given objects where they sit in front of something else. */
	outline(objects: number[], steps = -2): void {
		const set = new Set(objects);
		const { w, h } = this.px;
		const mark: number[] = [];
		for (let y = 0; y < h; y++)
			for (let x = 0; x < w; x++) {
				const i = y * w + x;
				if (!set.has(this.ids[i])) continue;
				for (const [dx, dy] of [
					[1, 0],
					[-1, 0],
					[0, 1],
					[0, -1]
				]) {
					const nx = x + dx;
					const ny = y + dy;
					if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
					const j = ny * w + nx;
					if (this.ids[j] !== this.ids[i] && this.depth[j] > this.depth[i] + 4) {
						mark.push(i);
						break;
					}
				}
			}
		for (const i of mark) {
			const ink = this.px.get(i % w, Math.floor(i / w));
			if (ink) this.px.set(i % w, Math.floor(i / w), shift(ink as Ink, steps));
		}
	}
}

/**
 * Shades everything seen through the space under a box (the knee space under a desk): pixels whose
 * ray enters the box volume before reaching what was drawn there.
 */
export function shadowUnder(
	v: View,
	min: V3,
	max: V3,
	rot: { angle: number; pivot: [number, number] },
	steps = -1
): void {
	const c = v.cam;
	const sn = Math.sin(-rot.angle);
	const k = Math.cos(-rot.angle);
	const [px, pz] = rot.pivot;
	const toLocal = (x: number, z: number): [number, number] => {
		const dx = x - px;
		const dz = z - pz;
		return [px + dx * k + dz * sn, pz - dx * sn + dz * k];
	};
	const [ox, oz] = toLocal(c.x, c.z);
	const marks: number[] = [];
	for (let sy = 0; sy < v.px.h; sy++)
		for (let sx = 0; sx < v.px.w; sx++) {
			const dir: V3 = [(sx + 0.5 - c.cx) / c.f, -(sy + 0.5 - c.cy) / c.f, -1];
			const dx = dir[0] * k + dir[2] * sn;
			const dz = -dir[0] * sn + dir[2] * k;
			const o: V3 = [ox, c.y, oz];
			const d: V3 = [dx, dir[1], dz];
			let t0 = 0;
			let t1 = Infinity;
			let hit = true;
			for (let a = 0; a < 3; a++) {
				if (Math.abs(d[a]) < 1e-9) {
					if (o[a] < min[a] || o[a] > max[a]) hit = false;
					continue;
				}
				let ta = (min[a] - o[a]) / d[a];
				let tb = (max[a] - o[a]) / d[a];
				if (ta > tb) [ta, tb] = [tb, ta];
				t0 = Math.max(t0, ta);
				t1 = Math.min(t1, tb);
			}
			if (!hit || t0 > t1) continue;
			const i = sy * v.px.w + sx;
			if (v.depth[i] > t0 + 1.5) marks.push(i);
		}
	for (const i of marks) {
		const x = i % v.px.w;
		const y = Math.floor(i / v.px.w);
		const ink = v.px.get(x, y);
		if (ink) v.px.set(x, y, shift(ink as Ink, steps));
	}
}
