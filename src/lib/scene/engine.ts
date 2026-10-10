import { hexToRgb, lerpRgb, type RGB } from './color.ts';
import { createQuantizer, ditherPattern } from './dither.ts';
import {
	NATIVE_H,
	NATIVE_W,
	placeBox,
	SCENE,
	type DrawItem,
	type DrawSprite,
	type LayerId,
	type LayoutId,
	type LightDef,
	type Rect
} from './layout.ts';
import {
	computeLighting,
	renderLight,
	type Lighting,
	type LightImage,
	type ResolvedLight
} from './lighting.ts';
import {
	ENDESGA32,
	PALETTES,
	type BaseMaterial,
	type PaletteKey,
	type SceneTime
} from './palettes.ts';
import { paletteRamps } from './materials.ts';
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
	/** The sprite whose frame this one shows (forearms drawn in front of the desk, say). */
	leader: SpriteInstance | null;
}

export type Pt = [number, number];

export interface HitArea {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface ViewPort {
	layout: LayoutId;
	w: number;
	h: number;
	camX: number;
	camY: number;
	cssPxPerScenePx: number;
}

export interface SceneOptions {
	frame: HTMLElement;
	view: ViewPort;
	palette: PaletteKey;
	time: SceneTime;
	reducedMotion: boolean;
	flags?: string[];
	onEvent?: (sprite: string, event: string) => void;
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
	private readonly viewCtx: CanvasRenderingContext2D;
	private readonly worldCanvas: HTMLCanvasElement;
	private readonly ctx: CanvasRenderingContext2D;
	private view: ViewPort;
	private pointerClientX = 0;
	private readonly far = canvas2d(NATIVE_W, NATIVE_H);
	private readonly scratch = canvas2d(NATIVE_W, NATIVE_H);
	private readonly lightMask = canvas2d(NATIVE_W, NATIVE_H);
	private readonly frameEl: HTMLElement;
	private readonly sprites: SpriteInstance[] = [];
	private readonly byName = new Map<string, SpriteInstance>();
	private readonly instances = new Map<DrawItem, SpriteInstance>();
	private readonly flags: Set<string>;
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

	/** The clock's hands: a fixed time of day, or null to follow the visitor's clock. */
	private clockFixed: { hour: number; minute: number } | null = null;
	private clockKey = '';

	private target = { x: 0, y: 0 };
	private eased = { x: 0, y: 0 };
	/** How far the view outside the window has shifted; the room itself never moves. */
	private outside: Pt = [0, 0];
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
		this.viewCtx = canvas.getContext('2d', { willReadFrequently: true })!;
		const world = canvas2d(NATIVE_W, NATIVE_H, true);
		this.worldCanvas = world.canvas;
		this.ctx = world.ctx;
		this.view = options.view;
		this.resizeView();
		this.frameEl = options.frame;
		this.palette = options.palette;
		this.reducedMotion = options.reducedMotion;
		this.timeFrom = this.timeTo = options.time;
		this.touchOnly = matchMedia('(hover: none)').matches;
		this.flags = new Set(options.flags);

		for (const item of SCENE.draw) {
			if (!('sprite' in item)) continue;
			const loaded = sheets.get(item.sprite);
			if (!loaded) continue;
			const darkTag = item.dark ? loaded.sheet.tags.get(item.dark) : undefined;
			const instance: SpriteInstance = {
				item,
				loaded,
				player: new Player(loaded.sheet, item.tag),
				darkFrame: darkTag ? darkTag.from : null,
				leader: null
			};
			instance.player.onFrame = (offset) => this.frameStarted(instance, offset);
			this.sprites.push(instance);
			this.instances.set(item, instance);
			if (!this.byName.has(item.sprite)) this.byName.set(item.sprite, instance);
		}
		for (const s of this.sprites) {
			if (!s.item.follow) continue;
			s.leader = this.byName.get(s.item.follow) ?? null;
			if (s.leader && s.leader.loaded.sheet.frames.length !== s.loaded.sheet.frames.length)
				console.warn(`"${s.item.sprite}" follows "${s.item.follow}" but has other frames`);
		}

		this.updateOutside();
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
		const base = s && this.basePoint(s.item);
		if (!s || !hit || !base) return null;
		const [ax, ay] = anchorAt(s.loaded.sheet, 0);
		return {
			x: base[0] - ax + hit.x,
			y: base[1] - ay + hit.y,
			w: hit.w,
			h: hit.h
		};
	}

	pointerX(): number | null {
		return this.pointerInside
			? this.view.camX + this.pointerClientX / this.view.cssPxPerScenePx
			: null;
	}

	private resizeView(): void {
		const { w, h } = this.view;
		if (this.canvas.width === w && this.canvas.height === h) return;
		this.canvas.width = w;
		this.canvas.height = h;
		this.viewCtx.imageSmoothingEnabled = false;
	}

	private frameStarted(s: SpriteInstance, offsetInTag: number): void {
		const events = s.player.tag.events.get(offsetInTag);
		for (const event of events ?? []) this.options.onEvent?.(s.item.sprite, event);
	}

	/** Shows a chosen time on the wall clock, or null to follow the visitor's clock. */
	setClock(fixed: { hour: number; minute: number } | null): void {
		this.clockFixed = fixed;
		this.dirty = true;
	}

	setFlag(flag: string, on: boolean): void {
		if (on === this.flags.has(flag)) return;
		if (on) this.flags.add(flag);
		else this.flags.delete(flag);
		this.dirty = true;
	}

	setView(view: ViewPort): void {
		if (view.layout !== this.view.layout) {
			this.skyCanvas = null;
			this.lightImages.clear();
		}
		this.view = view;
		this.resizeView();
		this.dirty = true;
	}

	setReducedMotion(reduced: boolean): void {
		this.reducedMotion = reduced;
		if (reduced) {
			this.eased = { x: 0, y: 0 };
			this.target = { x: 0, y: 0 };
			this.updateOutside();
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
			this.pointerClientX = e.clientX - r.left;
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
			if (this.updateOutside()) this.dirty = true;
			for (const s of this.sprites) if (!s.leader && s.player.update(dt)) this.dirty = true;
		}

		if (this.fadeMs && this.updateLighting(now)) this.dirty = true;
		if (this.clockTicked()) this.dirty = true;
		if (this.dirty) this.render();
		this.settleFinishedPlays();
		this.settleWaits();
	};

	/** While following the visitor's clock, the second hand moves (the minute hand with reduced motion). */
	private clockTicked(): boolean {
		if (this.clockFixed) return false;
		const d = new Date();
		const key = this.reducedMotion
			? `${d.getHours()}:${d.getMinutes()}`
			: `${d.getMinutes()}:${d.getSeconds()}`;
		if (key === this.clockKey) return false;
		this.clockKey = key;
		return true;
	}

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

	private updateOutside(): boolean {
		const x = Math.round(SCENE.parallax.maxOffsetX * this.eased.x) || 0;
		const y = Math.round(SCENE.parallax.maxOffsetY * this.eased.y) || 0;
		if (x === this.outside[0] && y === this.outside[1]) return false;
		this.outside = [x, y];
		return true;
	}

	/** Only the far layer, seen through the window, moves with the pointer. */
	private offset(layer: LayerId): Pt {
		return layer === 'far' ? this.outside : [0, 0];
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
		const resolved = this.resolveLight(def);
		const img = resolved && renderLight(resolved, color, L.lights[name] ?? 0);
		this.lightImages.set(name, img);
		return img;
	}

	/** Light geometry in scene pixels for the current layout; null if its place isn't in it. */
	private resolveLight(def: LightDef): ResolvedLight | null {
		if (def.kind === 'glow') return def;
		const box = def.place ? placeBox(this.view.layout, def.place) : null;
		if (def.kind === 'pool') return box && { kind: 'pool', box };
		if (def.place && !box) return null;
		const [dx, dy] = box ? [box.x, box.y] : [0, 0];
		return { kind: 'shaft', polygon: def.polygon.map(([x, y]) => [x + dx, y + dy]) };
	}

	private windowBox(): Rect | null {
		return placeBox(this.view.layout, 'window');
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

	/** Where an item's anchor sits before parallax: fixed, or a place in the current layout. */
	private basePoint(item: DrawSprite): Pt | null {
		if (item.place) {
			const box = placeBox(this.view.layout, item.place);
			if (!box) return null;
			const [dx, dy] = item.offset ?? [0, 0];
			return [box.x + dx, box.y + dy];
		}
		return item.at ?? null;
	}

	private anchorPoint(s: SpriteInstance): Pt | null {
		const attached = s.item.attach ? this.slicePoint(...s.item.attach) : null;
		if (attached) return attached;
		const base = this.basePoint(s.item);
		if (!base) return null;
		const [ox, oy] = this.offset(s.item.layer);
		const [nx, ny] = this.nudges.get(s.item.sprite) ?? [0, 0];
		return [base[0] + ox + nx, base[1] + oy + ny];
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
		const frame = (s.leader ?? s).player.frame;
		this.dissolve(target, alpha, (ctx) => this.drawFrame(ctx, s, frame, image));
		const dark = s.darkFrame;
		if (dark !== null)
			this.dissolve(target, weights.dark * alpha, (ctx) => this.drawFrame(ctx, s, dark, image));
	}

	/** The sky is laid out on the window glass of the current layout; parallax slides it inside. */
	private drawProcedural(kind: 'sky' | 'stars' | 'orb' | 'clockHands'): void {
		if (kind === 'clockHands') return this.drawClockHands();
		const win = this.windowBox();
		if (!win) return;
		const ctx = this.far.ctx;
		const [ox, oy] = this.outside;
		const L = this.lighting;
		const m = SCENE.parallax.maxOffsetY;
		const at = (u: number, v: number): Pt => [
			Math.round(win.x + u * win.w),
			Math.round(win.y + v * win.h)
		];
		if (kind === 'sky') {
			const bands = { top: win.y, bottom: win.y + win.h, bands: SCENE.sky.bands };
			this.skyCanvas ??= renderSkyGradient(bands, L, NATIVE_W, NATIVE_H + 2 * m);
			ctx.drawImage(this.skyCanvas, 0, oy - m);
		} else if (kind === 'stars') {
			const night = PALETTES[this.palette].sky.night.orb;
			const stars = SCENE.sky.stars.map(([u, v]) => at(u, v));
			drawStars(ctx, stars, L.weights.stars, hexToRgb(night), ox, oy);
		} else {
			for (const orb of L.orbs) {
				const def = SCENE.sky.orbs[orb.time];
				const [x, y] = at(def.u, def.v);
				this.dissolve(ctx, orb.weight, (c) =>
					drawOrb(c, { x, y, r: def.r, moon: def.moon }, orb, ox, oy)
				);
			}
		}
	}

	/** Pixel hands on the wall clock: hour, minute and, while following the real clock, seconds. */
	private drawClockHands(): void {
		const box = placeBox(this.view.layout, 'clock');
		if (!box) return;
		const [nx, ny] = this.nudges.get('clock') ?? [0, 0];
		const c = SCENE.clock;
		const cx = box.x + nx + c.centre[0];
		const cy = box.y + ny + c.centre[1];
		const now = new Date();
		const fixed = this.clockFixed;
		const hour = fixed ? fixed.hour : now.getHours();
		const minute = fixed ? fixed.minute : now.getMinutes();
		const second = fixed || this.reducedMotion ? null : now.getSeconds();
		const ramps = paletteRamps(this.palette);
		const tint = this.lighting.tint;
		const ink = (hex: string) => {
			const [r, g, b] = hexToRgb(hex);
			return `rgb(${Math.round(r * tint[0])},${Math.round(g * tint[1])},${Math.round(b * tint[2])})`;
		};
		const hand = (turns: number, length: number, color: string) => {
			const a = turns * Math.PI * 2;
			const x1 = Math.round(cx + Math.sin(a) * length);
			const y1 = Math.round(cy - Math.cos(a) * length);
			this.ctx.fillStyle = color;
			let [x, y] = [cx, cy];
			const dx = Math.abs(x1 - x);
			const dy = -Math.abs(y1 - y);
			const sx = x < x1 ? 1 : -1;
			const sy = y < y1 ? 1 : -1;
			let err = dx + dy;
			for (;;) {
				this.ctx.fillRect(x, y, 1, 1);
				if (x === x1 && y === y1) break;
				const e2 = 2 * err;
				if (e2 >= dy) {
					err += dy;
					x += sx;
				}
				if (e2 <= dx) {
					err += dx;
					y += sy;
				}
			}
		};
		const dark = ink(ramps.hair.b);
		hand(((hour % 12) + minute / 60) / 12, c.hour, dark);
		hand(minute / 60, c.minute, dark);
		if (second !== null) hand(second / 60, c.second, ink(ramps.sticker0.b));
		this.ctx.fillStyle = ink(ramps.sticker0.d);
		this.ctx.fillRect(cx, cy, 1, 1);
	}

	/** Clears a place's box from the room so only the sky shows there. */
	private cut(place: string): void {
		const box = placeBox(this.view.layout, place);
		if (box) this.ctx.clearRect(box.x, box.y, box.w, box.h);
	}

	private applyLight(name: string): void {
		const def = SCENE.lights[name];
		if (!def) return;
		const img = this.lightImage(name, def);
		if (!img) return;
		const { x, y } = img;
		const { canvas, ctx } = this.lightMask;
		// Masking by what is drawn so far keeps light off the transparent window panes (the sky).
		ctx.clearRect(x, y, img.w, img.h);
		ctx.drawImage(img.canvas, x, y);
		ctx.globalCompositeOperation = 'destination-in';
		ctx.drawImage(this.worldCanvas, x, y, img.w, img.h, x, y, img.w, img.h);
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
		this.present();
		this.quantizeFrame();
	}

	/** Copies the world through the camera; past the world's edges, its edge pixels repeat. */
	private present(): void {
		const ctx = this.viewCtx;
		const { width: vw, height: vh } = this.canvas;
		const x0 = -this.view.camX;
		const y0 = -this.view.camY;
		const right = x0 + NATIVE_W;
		const bottom = y0 + NATIVE_H;
		ctx.drawImage(this.worldCanvas, x0, y0);
		if (x0 > 0) ctx.drawImage(this.worldCanvas, 0, 0, 1, NATIVE_H, 0, y0, x0, NATIVE_H);
		if (right < vw) {
			ctx.drawImage(
				this.worldCanvas,
				NATIVE_W - 1,
				0,
				1,
				NATIVE_H,
				right,
				y0,
				vw - right,
				NATIVE_H
			);
		}
		if (y0 > 0) ctx.drawImage(this.canvas, 0, y0, vw, 1, 0, 0, vw, y0);
		if (bottom < vh) ctx.drawImage(this.canvas, 0, bottom - 1, vw, 1, 0, bottom, vw, vh - bottom);
	}

	private clearCanvases(): void {
		this.ctx.globalCompositeOperation = 'source-over';
		this.ctx.clearRect(0, 0, NATIVE_W, NATIVE_H);
		this.far.ctx.clearRect(0, 0, NATIVE_W, NATIVE_H);
	}

	private drawItem(item: DrawItem): void {
		if ('procedural' in item) return this.drawProcedural(item.procedural);
		if ('light' in item) return this.applyLight(item.light);
		if ('cut' in item) return this.cut(item.cut);
		const s = this.instances.get(item);
		if (s && this.required(item.requires)) this.drawSprite(s);
	}

	private required(flag: string | undefined): boolean {
		if (!flag) return true;
		return flag.startsWith('!') ? !this.flags.has(flag.slice(1)) : this.flags.has(flag);
	}

	/** The sky goes behind the room, but only through the window glass. */
	private drawFarBehindRoom(): void {
		const win = this.windowBox();
		if (!win) return;
		this.ctx.save();
		this.ctx.beginPath();
		this.ctx.rect(win.x, win.y, win.w, win.h);
		this.ctx.clip();
		this.ctx.globalCompositeOperation = 'destination-over';
		this.ctx.drawImage(this.far.canvas, 0, 0);
		this.ctx.restore();
	}

	private quantizeFrame(): void {
		if (!this.quantize) return;
		const { width, height } = this.canvas;
		const img = this.viewCtx.getImageData(0, 0, width, height);
		this.quantize(img);
		this.viewCtx.putImageData(img, 0, 0);
	}
}

export const createScene = SceneEngine.create;
