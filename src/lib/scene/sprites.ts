export interface AseRect {
	x: number;
	y: number;
	w: number;
	h: number;
}

interface AseFrame {
	filename?: string;
	frame: AseRect;
	rotated?: boolean;
	trimmed?: boolean;
	spriteSourceSize?: AseRect;
	sourceSize?: { w: number; h: number };
	duration?: number;
}

interface AseTag {
	name: string;
	from: number;
	to: number;
	direction?: string;
	repeat?: string | number;
	data?: string;
}

interface AseSliceKey {
	frame: number;
	bounds: AseRect;
	pivot?: { x: number; y: number };
}

interface AseSlice {
	name: string;
	keys: AseSliceKey[];
}

export interface AseSheetJson {
	frames: AseFrame[] | Record<string, AseFrame>;
	meta: {
		image: string;
		size: { w: number; h: number };
		frameTags?: AseTag[];
		slices?: AseSlice[];
	};
}

export interface SheetFrame {
	sx: number;
	sy: number;
	w: number;
	h: number;
	ox: number;
	oy: number;
	duration: number;
}

export interface Tag {
	name: string;
	from: number;
	to: number;
	direction: 'forward' | 'reverse' | 'pingpong' | 'pingpong_reverse';
	repeat: number;
	events: Map<number, string[]>;
}

export interface Sheet {
	name: string;
	image: string;
	width: number;
	height: number;
	frames: SheetFrame[];
	tags: Map<string, Tag>;
	slices: Map<string, AseSliceKey[]>;
}

const DEFAULT_DURATION = 100;

export function parseSheet(name: string, json: AseSheetJson): Sheet {
	const list = Array.isArray(json.frames) ? json.frames : Object.values(json.frames);
	if (list.length === 0) throw new Error(`Sprite sheet "${name}" has no frames`);
	const frames = list.map((f) => ({
		sx: f.frame.x,
		sy: f.frame.y,
		w: f.frame.w,
		h: f.frame.h,
		ox: f.spriteSourceSize?.x ?? 0,
		oy: f.spriteSourceSize?.y ?? 0,
		duration: f.duration ?? DEFAULT_DURATION
	}));
	const tags = new Map<string, Tag>();
	for (const t of json.meta.frameTags ?? []) {
		const direction = (
			['forward', 'reverse', 'pingpong', 'pingpong_reverse'].includes(t.direction ?? '')
				? t.direction
				: 'forward'
		) as Tag['direction'];
		tags.set(t.name, {
			name: t.name,
			from: t.from,
			to: t.to,
			direction,
			repeat: Number(t.repeat ?? 0) || 0,
			events: parseEvents(t.data)
		});
	}
	const slices = new Map<string, AseSliceKey[]>();
	for (const s of json.meta.slices ?? []) {
		slices.set(
			s.name,
			[...s.keys].sort((a, b) => a.frame - b.frame)
		);
	}
	const size = list[0].sourceSize ?? { w: list[0].frame.w, h: list[0].frame.h };
	return {
		name,
		image: json.meta.image,
		width: size.w,
		height: size.h,
		frames,
		tags,
		slices
	};
}

function parseEvents(data: string | undefined): Map<number, string[]> {
	const events = new Map<number, string[]>();
	for (const pair of data?.split(/\s+/) ?? []) {
		const match = /^(\d+):([\w-]+)$/.exec(pair);
		if (!match) continue;
		const frame = Number(match[1]);
		events.set(frame, [...(events.get(frame) ?? []), match[2]]);
	}
	return events;
}

function sliceKey(sheet: Sheet, name: string, frame: number): AseSliceKey | null {
	const keys = sheet.slices.get(name);
	if (!keys) return null;
	let found: AseSliceKey | null = null;
	for (const k of keys) if (k.frame <= frame) found = k;
	return found ?? keys[0] ?? null;
}

export function sliceAt(sheet: Sheet, name: string, frame = 0): AseRect | null {
	return sliceKey(sheet, name, frame)?.bounds ?? null;
}

export function anchorAt(sheet: Sheet, frame = 0): [number, number] {
	const key = sliceKey(sheet, 'anchor', frame);
	if (!key) return [Math.floor(sheet.width / 2), sheet.height];
	if (key.pivot) return [key.bounds.x + key.pivot.x, key.bounds.y + key.pivot.y];
	return [key.bounds.x + Math.floor(key.bounds.w / 2), key.bounds.y + key.bounds.h];
}

export function tagSequence(tag: Tag): number[] {
	const up: number[] = [];
	for (let i = tag.from; i <= tag.to; i++) up.push(i);
	const down = [...up].reverse();
	switch (tag.direction) {
		case 'reverse':
			return down;
		case 'pingpong':
			return up.length > 2 ? [...up, ...down.slice(1, -1)] : up;
		case 'pingpong_reverse':
			return down.length > 2 ? [...down, ...up.slice(1, -1)] : down;
		default:
			return up;
	}
}

export class Player {
	readonly sheet: Sheet;
	tag: Tag;
	done = false;
	onFrame: ((offsetInTag: number) => void) | null = null;
	private seq: number[];
	private pos = 0;
	private elapsed = 0;
	private plays = 0;
	private once = false;

	constructor(sheet: Sheet, tagName?: string) {
		this.sheet = sheet;
		this.tag = this.resolve(tagName);
		this.seq = tagSequence(this.tag);
	}

	private resolve(tagName?: string): Tag {
		const tag = tagName ? this.sheet.tags.get(tagName) : undefined;
		if (tagName && !tag) console.warn(`Sprite "${this.sheet.name}" has no tag "${tagName}"`);
		return (
			tag ?? {
				name: '',
				from: 0,
				to: this.sheet.frames.length - 1,
				direction: 'forward',
				repeat: 0,
				events: new Map()
			}
		);
	}

	get frame(): number {
		return this.seq[this.pos];
	}

	play(tagName: string, { once = false } = {}): void {
		this.tag = this.resolve(tagName);
		this.seq = tagSequence(this.tag);
		this.pos = 0;
		this.elapsed = 0;
		this.plays = 0;
		this.once = once;
		this.done = false;
		this.onFrame?.(this.frame - this.tag.from);
	}

	seek(offsetInTag: number): void {
		const pos = this.seq.indexOf(this.tag.from + offsetInTag);
		this.pos = pos < 0 ? 0 : pos;
		this.elapsed = 0;
	}

	update(dt: number): boolean {
		if (this.done) return false;
		const before = this.frame;
		this.elapsed += dt;
		for (;;) {
			const duration = Math.max(1, this.sheet.frames[this.frame].duration);
			if (this.elapsed < duration) break;
			this.elapsed -= duration;
			if (this.pos + 1 < this.seq.length) {
				this.pos++;
			} else if (this.finishesThisPlay()) {
				this.done = true;
				break;
			} else {
				this.pos = 0;
			}
			this.onFrame?.(this.frame - this.tag.from);
		}
		return this.frame !== before;
	}

	private finishesThisPlay(): boolean {
		const limit = this.once ? 1 : this.tag.repeat;
		return limit > 0 && ++this.plays >= limit;
	}
}
