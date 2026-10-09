import { hexToRgb, lerpRgb, type RGB } from './color.ts';
import { createQuantizer, ditherPattern } from './dither.ts';
import {
	NATIVE_H,
	NATIVE_W,
	SCENE,
	type DrawItem,
	type DrawSprite,
	type LayerId,
	type LightDef
} from './layout.ts';
import { computeLighting, renderLight, type Lighting, type LightImage } from './lighting.ts';
import {
	ENDESGA32,
	PALETTES,
	type BaseMaterial,
	type PaletteKey,
	type SceneTime
} from './palettes.ts';
import { colorTable, recolor, type ColorTransform } from './recolor.ts';
import { drawOrb, drawStars, renderSkyGradient } from './sky.ts';
import { anchorAt, parseSheet, Player, sliceAt, type AseSheetJson, type Sheet } from './sprites.ts';
import { CROSSFADE_SECONDS } from './time.ts';

const SHEET_JSON = import.meta.glob<AseSheetJson>(
	['./art/*.json', '!./art/scene.json', '!./art/key-palette.json'],
	{ eager: true, import: 'default' }
);
const SHEET_PNG = import.meta.glob<string>('./art/*.png', {
	eager: true,
	query: '?url',
	import: 'default'
});

const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');

const CROSSFADE_STEPS = 16;
const PARALLAX_EASE_MS = 220;
const DRIFT = { periodX: 41000, periodY: 57000, amount: 0.5 };
const MAX_STEP_MS = 250;

interface LoadedSheet {
	sheet: Sheet;
	keyData: ImageData;
	cache: { key: string; canvas: HTMLCanvasElement } | null;
}

interface SpriteInstance {
	item: DrawSprite;
	loaded: LoadedSheet;
	player: Player;
	darkFrame: number | null;
}

export type Pt = [number, number];

export interface HitArea {
	layer: LayerId;
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface SceneOptions {
	frame: HTMLElement;
	palette: PaletteKey;
	time: SceneTime;
	reducedMotion: boolean;
	flags?: string[];
	onEvent?: (sprite: string, event: string) => void;
	onOffsets?: (offsets: Record<LayerId, Pt>) => void;
}

function canvas2d(w: number, h: number, willRead = false) {
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d', { willReadFrequently: willRead })!;
	ctx.imageSmoothingEnabled = false;
	return { canvas, ctx };
}

async function loadImageData(url: string): Promise<ImageData> {
	const img = new Image();
	img.src = url;
	await img.decode();
	const { ctx } = canvas2d(img.naturalWidth, img.naturalHeight, true);
	ctx.drawImage(img, 0, 0);
	return ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
}

async function loadSheets(names: Set<string>): Promise<Map<string, LoadedSheet>> {
	const pngs = new Map(Object.entries(SHEET_PNG).map(([path, url]) => [basename(path), url]));
	const out = new Map<string, LoadedSheet>();
	await Promise.all(
		Object.entries(SHEET_JSON).map(async ([path, json]) => {
			const name = basename(path);
			if (!names.has(name)) return;
			const url = pngs.get(basename(json.meta.image));
			if (!url) {
				console.warn(`Sprite "${name}": image ${json.meta.image} not found`);
				return;
			}
			try {
				out.set(name, {
					sheet: parseSheet(name, json),
					keyData: await loadImageData(url),
					cache: null
				});
			} catch (error) {
				console.warn(`Sprite "${name}" failed to load`, error);
			}
		})
	);
	return out;
}

export class SceneEngine {
	readonly canvas: HTMLCanvasElement;
	private readonly ctx: CanvasRenderingContext2D;
	private readonly far = canvas2d(NATIVE_W, NATIVE_H);
	private readonly scratch = canvas2d(NATIVE_W, NATIVE_H);
	private readonly lightMask = canvas2d(NATIVE_W, NATIVE_H);
	private readonly frameEl: HTMLElement;
	private readonly sprites: SpriteInstance[] = [];
	private readonly byName = new Map<string, SpriteInstance>();
	private readonly instances = new Map<DrawItem, SpriteInstance>();
	private readonly flags: Set<string>;
	private readonly layerFactor = new Map<LayerId, number>();
	private readonly nudges = new Map<string, Pt>();
	private readonly finishes = new Map<SpriteInstance, () => void>();
	private waits: { at: number; resolve: () => void }[] = [];
	private clock = 0;
	private readonly options: SceneOptions;

	private palette: PaletteKey;
	private reducedMotion: boolean;

	private timeFrom: SceneTime;
	private timeTo: SceneTime;
	private fadeStart = 0;
	private fadeMs = 0;
	private step = CROSSFADE_STEPS;

	private lighting!: Lighting;
	private lightingKey = '';
	private skyCanvas: HTMLCanvasElement | null = null;
	private lightImages = new Map<string, LightImage | null>();
	private quantize: ((img: ImageData) => void) | null = null;

	private target = { x: 0, y: 0 };
	private eased = { x: 0, y: 0 };
	private offsets = new Map<LayerId, [number, number]>();
	private pointerInside = false;
	private readonly touchOnly: boolean;

	private raf = 0;
	private last = 0;
	private visible = true;
	private onScreen = true;
	private dirty = true;
	private destroyed = false;
	private readonly cleanups: (() => void)[] = [];

	private constructor(
		canvas: HTMLCanvasElement,
		options: SceneOptions,
		sheets: Map<string, LoadedSheet>
	) {
		this.canvas = canvas;
		this.options = options;
		this.ctx = canvas.getContext('2d', { willReadFrequently: true })!;
		this.ctx.imageSmoothingEnabled = false;
		this.frameEl = options.frame;
		this.palette = options.palette;
		this.reducedMotion = options.reducedMotion;
		this.timeFrom = this.timeTo = options.time;
		this.touchOnly = matchMedia('(hover: none)').matches;
		this.flags = new Set(options.flags);
		for (const layer of SCENE.layers) this.layerFactor.set(layer.id, layer.parallax);

		for (const item of SCENE.draw) {
			if (!('sprite' in item)) continue;
			const loaded = sheets.get(item.sprite);
			if (!loaded) continue;
			const darkTag = item.dark ? loaded.sheet.tags.get(item.dark) : undefined;
			const instance: SpriteInstance = {
				item,
				loaded,
				player: new Player(loaded.sheet, item.tag),
				darkFrame: darkTag ? darkTag.from : null
			};
			instance.player.onFrame = (offset) => this.frameStarted(instance, offset);
			this.sprites.push(instance);
			this.instances.set(item, instance);
			if (!this.byName.has(item.sprite)) this.byName.set(item.sprite, instance);
		}

		this.updateOffsets();
		this.updateLighting(performance.now());
		this.listen();
		this.render();
		this.resume();
	}

	static async create(canvas: HTMLCanvasElement, options: SceneOptions): Promise<SceneEngine> {
		const names = new Set(
			SCENE.draw.filter((d): d is DrawSprite => 'sprite' in d).map((d) => d.sprite)
		);
		const sheets = await loadSheets(names);
		return new SceneEngine(canvas, options, sheets);
	}

	setPalette(palette: PaletteKey): void {
		if (palette === this.palette) return;
		this.palette = palette;
		this.lightingKey = '';
		this.updateLighting(performance.now());
		this.render();
	}

	setTime(time: SceneTime, { instant = false } = {}): void {
		const now = performance.now();
		const settled = this.timeFrom === this.timeTo;
		if (time === this.timeTo && (settled || !instant)) return;
		if (instant || this.reducedMotion) {
			this.timeFrom = this.timeTo = time;
			this.fadeMs = 0;
		} else {
			this.timeFrom = this.mix(now) >= 0.5 ? this.timeTo : this.timeFrom;
			this.timeTo = time;
			this.fadeStart = now;
			this.fadeMs = CROSSFADE_SECONDS * 1000;
		}
		this.updateLighting(now);
		this.render();
	}

	/** Plays a tag once and resolves when it ends; with `loop` it repeats and resolves at once. */
	play(sprite: string, tag: string, { loop = false } = {}): Promise<void> {
		const s = this.byName.get(sprite);
		if (!s) return Promise.resolve();
		this.finishes.get(s)?.();
		this.finishes.delete(s);
		s.player.play(tag, { once: !loop });
		this.dirty = true;
		if (loop || this.reducedMotion) return Promise.resolve();
		return new Promise((resolve) => this.finishes.set(s, resolve));
	}

	/** Shows one frame of a tag and holds it, without firing its events. */
	pose(sprite: string, tag: string, offsetInTag = 0): void {
		const s = this.byName.get(sprite);
		if (!s) return;
		const onFrame = s.player.onFrame;
		s.player.onFrame = null;
		s.player.play(tag, { once: true });
		s.player.seek(offsetInTag);
		s.player.done = true;
		s.player.onFrame = onFrame;
		this.dirty = true;
	}

	/** Resolves after `ms` of running time: the clock stops while the scene is hidden or off-screen. */
	wait(ms: number): Promise<void> {
		return new Promise((resolve) => this.waits.push({ at: this.clock + ms, resolve }));
	}

	nudge(sprite: string, offset: Pt): void {
		this.nudges.set(sprite, offset);
		this.dirty = true;
	}

	hitArea(sprite: string): HitArea | null {
		const s = this.byName.get(sprite);
		const hit = s && sliceAt(s.loaded.sheet, 'hit', 0);
		if (!s?.item.at || !hit) return null;
		const [ax, ay] = anchorAt(s.loaded.sheet, 0);
		return {
			layer: s.item.layer,
			x: s.item.at[0] - ax + hit.x,
			y: s.item.at[1] - ay + hit.y,
			w: hit.w,
			h: hit.h
		};
	}

	pointerX(): number | null {
		return this.pointerInside ? ((this.target.x + 1) / 2) * NATIVE_W : null;
	}

	private frameStarted(s: SpriteInstance, offsetInTag: number): void {
		const events = s.player.tag.events.get(offsetInTag);
		for (const event of events ?? []) this.options.onEvent?.(s.item.sprite, event);
	}

	setFlag(flag: string, on: boolean): void {
		if (on === this.flags.has(flag)) return;
		if (on) this.flags.add(flag);
		else this.flags.delete(flag);
		this.dirty = true;
	}

	setReducedMotion(reduced: boolean): void {
		this.reducedMotion = reduced;
		if (reduced) {
			this.eased = { x: 0, y: 0 };
			this.target = { x: 0, y: 0 };
			this.updateOffsets();
			for (const resolve of this.finishes.values()) resolve();
			this.finishes.clear();
		}
		this.dirty = true;
	}

	destroy(): void {
		this.destroyed = true;
		this.waits = [];
		this.finishes.clear();
		cancelAnimationFrame(this.raf);
		for (const cleanup of this.cleanups) cleanup();
	}

	private listen(): void {
		const on = <E extends Event>(target: EventTarget, type: string, fn: (e: E) => void) => {
			target.addEventListener(type, fn as EventListener, { passive: true });
			this.cleanups.push(() => target.removeEventListener(type, fn as EventListener));
		};

		on<PointerEvent>(window, 'pointermove', (e) => {
			if (e.pointerType === 'touch') return;
			const r = this.frameEl.getBoundingClientRect();
			if (r.width === 0) return;
			this.pointerInside = true;
			const clamp = (v: number) => Math.max(-1, Math.min(1, v));
			this.target.x = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2));
			this.target.y = clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2));
		});
		on(document.documentElement, 'pointerleave', () => {
			this.pointerInside = false;
			this.target = { x: 0, y: 0 };
		});
		on(document, 'visibilitychange', () => {
			this.visible = document.visibilityState === 'visible';
			this.resume();
		});

		const io = new IntersectionObserver((entries) => {
			this.onScreen = entries.some((e) => e.isIntersecting);
			this.resume();
		});
		io.observe(this.frameEl);
		this.cleanups.push(() => io.disconnect());
	}

	private resume(): void {
		const run = this.visible && this.onScreen && !this.destroyed;
		if (run && !this.raf) {
			this.last = performance.now();
			this.raf = requestAnimationFrame(this.tick);
		} else if (!run && this.raf) {
			cancelAnimationFrame(this.raf);
			this.raf = 0;
		}
	}

	private tick = (now: number): void => {
		this.raf = requestAnimationFrame(this.tick);
		const dt = Math.min(now - this.last, MAX_STEP_MS);
		this.last = now;
		this.clock += dt;

		if (!this.reducedMotion) {
			if (this.touchOnly && !this.pointerInside) {
				this.target.x = DRIFT.amount * Math.sin((now / DRIFT.periodX) * Math.PI * 2);
				this.target.y = DRIFT.amount * Math.sin((now / DRIFT.periodY) * Math.PI * 2 + 1);
			}
			const k = 1 - Math.exp(-dt / PARALLAX_EASE_MS);
			this.eased.x += (this.target.x - this.eased.x) * k;
			this.eased.y += (this.target.y - this.eased.y) * k;
			if (this.updateOffsets()) this.dirty = true;
			for (const s of this.sprites) if (s.player.update(dt)) this.dirty = true;
		}

		if (this.fadeMs && this.updateLighting(now)) this.dirty = true;
		if (this.dirty) this.render();
		this.settleFinishedPlays();
		this.settleWaits();
	};

	private settleFinishedPlays(): void {
		for (const [s, resolve] of this.finishes) {
			if (!s.player.done) continue;
			this.finishes.delete(s);
			resolve();
		}
	}

	private settleWaits(): void {
		const due = this.waits.filter((w) => w.at <= this.clock);
		if (!due.length) return;
		this.waits = this.waits.filter((w) => w.at > this.clock);
		for (const w of due) w.resolve();
	}

	private updateOffsets(): boolean {
		let changed = false;
		for (const [layer, factor] of this.layerFactor) {
			const x = Math.round(factor * SCENE.parallax.maxOffsetX * this.eased.x) || 0;
			const y = Math.round(factor * SCENE.parallax.maxOffsetY * this.eased.y) || 0;
			const prev = this.offsets.get(layer);
			if (!prev || prev[0] !== x || prev[1] !== y) {
				this.offsets.set(layer, [x, y]);
				changed = true;
			}
		}
		if (changed) this.options.onOffsets?.(Object.fromEntries(this.offsets) as Record<LayerId, Pt>);
		return changed;
	}

	private offset(layer: LayerId): [number, number] {
		return this.offsets.get(layer) ?? [0, 0];
	}

	private mix(now: number): number {
		if (!this.fadeMs) return 1;
		return Math.max(0, Math.min(1, (now - this.fadeStart) / this.fadeMs));
	}

	private updateLighting(now: number): boolean {
		const mix = this.mix(now);
		this.step = Math.round(mix * CROSSFADE_STEPS);
		if (this.step >= CROSSFADE_STEPS) {
			this.timeFrom = this.timeTo;
			this.fadeMs = 0;
		}
		const key = `${this.palette}|${this.timeFrom}|${this.timeTo}|${this.step}`;
		if (key === this.lightingKey) return false;
		this.lightingKey = key;
		this.lighting = computeLighting(
			this.palette,
			this.timeFrom,
			this.timeTo,
			this.step / CROSSFADE_STEPS
		);
		this.skyCanvas = null;
		this.lightImages.clear();
		const quantize = 'quantize' in PALETTES[this.palette];
		this.quantize = quantize ? (this.quantize ?? createQuantizer(ENDESGA32)) : null;
		return true;
	}

	private lightImage(name: string, def: LightDef): LightImage | null {
		if (this.lightImages.has(name)) return this.lightImages.get(name)!;
		const L = this.lighting;
		const color: RGB =
			def.color === 'shaft'
				? L.shaftColor
				: hexToRgb(PALETTES[this.palette].base[def.color as BaseMaterial]);
		const img = renderLight(def, color, L.lights[name] ?? 0);
		this.lightImages.set(name, img);
		return img;
	}

	private sheetCanvas(loaded: LoadedSheet, far: boolean): HTMLCanvasElement {
		if (loaded.cache?.key === this.lightingKey) return loaded.cache.canvas;
		const L = this.lighting;
		const transform: ColorTransform = far
			? (rgb) => lerpRgb(rgb, L.skyBottom, L.haze)
			: (rgb) => [rgb[0] * L.tint[0], rgb[1] * L.tint[1], rgb[2] * L.tint[2]];
		const { width, height } = loaded.keyData;
		const target = loaded.cache?.canvas ?? canvas2d(width, height).canvas;
		const ctx = target.getContext('2d')!;
		const out = ctx.createImageData(width, height);
		recolor(loaded.keyData, out, colorTable(this.palette, transform));
		ctx.putImageData(out, 0, 0);
		loaded.cache = { key: this.lightingKey, canvas: target };
		return target;
	}

	private dissolve(
		target: CanvasRenderingContext2D,
		alpha: number,
		draw: (ctx: CanvasRenderingContext2D) => void
	): void {
		const level = Math.round(alpha * 16);
		if (level <= 0) return;
		if (level >= 16) return draw(target);
		const { canvas, ctx } = this.scratch;
		ctx.clearRect(0, 0, NATIVE_W, NATIVE_H);
		draw(ctx);
		ctx.globalCompositeOperation = 'destination-in';
		ctx.fillStyle = ditherPattern(ctx, level);
		ctx.fillRect(0, 0, NATIVE_W, NATIVE_H);
		ctx.globalCompositeOperation = 'source-over';
		target.drawImage(canvas, 0, 0);
	}

	private drawFrame(
		target: CanvasRenderingContext2D,
		s: SpriteInstance,
		frameIndex: number,
		image: HTMLCanvasElement
	): void {
		const origin = this.topLeft(s, frameIndex);
		if (!origin) return;
		const f = s.loaded.sheet.frames[frameIndex];
		target.drawImage(image, f.sx, f.sy, f.w, f.h, origin[0] + f.ox, origin[1] + f.oy, f.w, f.h);
	}

	private topLeft(s: SpriteInstance, frameIndex: number): Pt | null {
		const point = this.anchorPoint(s);
		if (!point) return null;
		const [ax, ay] = anchorAt(s.loaded.sheet, frameIndex);
		return [point[0] - ax, point[1] - ay];
	}

	private anchorPoint(s: SpriteInstance): Pt | null {
		const attached = s.item.attach ? this.slicePoint(...s.item.attach) : null;
		if (attached) return attached;
		if (!s.item.at) return null;
		const [ox, oy] = this.offset(s.item.layer);
		const [nx, ny] = this.nudges.get(s.item.sprite) ?? [0, 0];
		return [s.item.at[0] + ox + nx, s.item.at[1] + oy + ny];
	}

	private slicePoint(parentName: string, sliceName: string): Pt | null {
		const parent = this.byName.get(parentName);
		if (!parent) return null;
		const frame = parent.player.frame;
		const slice = sliceAt(parent.loaded.sheet, sliceName, frame);
		if (!slice || slice.w === 0) return null;
		const origin = this.topLeft(parent, frame);
		return origin && [origin[0] + slice.x, origin[1] + slice.y];
	}

	private drawSprite(s: SpriteInstance): void {
		const far = s.item.layer === 'far';
		const target = far ? this.far.ctx : this.ctx;
		const image = this.sheetCanvas(s.loaded, far);
		const weights = this.lighting.weights;
		const alpha = s.item.weight ? weights[s.item.weight] : 1;
		this.dissolve(target, alpha, (ctx) => this.drawFrame(ctx, s, s.player.frame, image));
		if (s.darkFrame !== null) {
			const frame = s.darkFrame;
			this.dissolve(target, weights.dark * alpha, (ctx) => this.drawFrame(ctx, s, frame, image));
		}
	}

	private drawAgain(name: string, [x, y, w, h]: [number, number, number, number]): void {
		const s = this.byName.get(name);
		if (!s) return;
		this.ctx.save();
		this.ctx.beginPath();
		this.ctx.rect(x, y, w, h);
		this.ctx.clip();
		this.drawSprite(s);
		this.ctx.restore();
	}

	private drawProcedural(kind: 'sky' | 'stars' | 'orb'): void {
		const ctx = this.far.ctx;
		const [ox, oy] = this.offset('far');
		const L = this.lighting;
		const m = SCENE.parallax.maxOffsetY;
		if (kind === 'sky') {
			this.skyCanvas ??= renderSkyGradient(SCENE.sky, L, NATIVE_W, NATIVE_H + 2 * m);
			ctx.drawImage(this.skyCanvas, 0, oy - m);
		} else if (kind === 'stars') {
			const night = PALETTES[this.palette].sky.night.orb;
			drawStars(ctx, SCENE.sky.stars, L.weights.stars, hexToRgb(night), ox, oy);
		} else {
			for (const orb of L.orbs) {
				this.dissolve(ctx, orb.weight, (c) => drawOrb(c, SCENE.sky.orbs[orb.time], orb, ox, oy));
			}
		}
	}

	private applyLight(name: string): void {
		const def = SCENE.lights[name];
		if (!def) return;
		const img = this.lightImage(name, def);
		if (!img) return;
		const [ox, oy] = this.offset(def.layer);
		const x = img.x + ox;
		const y = img.y + oy;
		const { canvas, ctx } = this.lightMask;
		// Masking by what is drawn so far keeps light off the transparent window panes (the sky).
		ctx.clearRect(x, y, img.w, img.h);
		ctx.drawImage(img.canvas, x, y);
		ctx.globalCompositeOperation = 'destination-in';
		ctx.drawImage(this.canvas, x, y, img.w, img.h, x, y, img.w, img.h);
		ctx.globalCompositeOperation = 'source-over';
		this.ctx.globalCompositeOperation = 'screen';
		this.ctx.drawImage(canvas, x, y, img.w, img.h, x, y, img.w, img.h);
		this.ctx.globalCompositeOperation = 'source-over';
	}

	private render(): void {
		this.dirty = false;
		this.clearCanvases();
		for (const item of SCENE.draw as DrawItem[]) this.drawItem(item);
		this.drawFarBehindRoom();
		this.quantizeFrame();
	}

	private clearCanvases(): void {
		this.ctx.globalCompositeOperation = 'source-over';
		this.ctx.clearRect(0, 0, NATIVE_W, NATIVE_H);
		this.far.ctx.clearRect(0, 0, NATIVE_W, NATIVE_H);
	}

	private drawItem(item: DrawItem): void {
		if ('procedural' in item) return this.drawProcedural(item.procedural);
		if ('light' in item) return this.applyLight(item.light);
		if ('again' in item) return this.drawAgain(item.again, item.clip);
		const s = this.instances.get(item);
		if (s && (!item.requires || this.flags.has(item.requires))) this.drawSprite(s);
	}

	private drawFarBehindRoom(): void {
		this.ctx.globalCompositeOperation = 'destination-over';
		this.ctx.drawImage(this.far.canvas, 0, 0);
		this.ctx.globalCompositeOperation = 'source-over';
	}

	private quantizeFrame(): void {
		if (!this.quantize) return;
		const img = this.ctx.getImageData(0, 0, NATIVE_W, NATIVE_H);
		this.quantize(img);
		this.ctx.putImageData(img, 0, 0);
	}
}

export const createScene = SceneEngine.create;
