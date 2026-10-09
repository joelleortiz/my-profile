import { Pixels, type Ink, type Pt, type SpriteDef, type TagDef } from '../lib/sheet.ts';

type EyeState = 'open' | 'half' | 'closed' | 'happy';
type Gaze = -1 | 0 | 1;

interface MylesPose {
	eyes?: EyeState;
	gaze?: Gaze;
	headShift?: Pt;
	tailTip?: Pt;
	earFlick?: boolean;
	breath?: number;
}

const MYLES_W = 64;
const MYLES_H = 68;

function mylesBody(p: Pixels, breath: number) {
	const body = new Pixels(MYLES_W, MYLES_H);
	body.ellipse(23, 35, 29, 33, 'tabby.b');
	body.ellipse(10, 20 - breath, 19, 30 + breath, 'tabby.b');
	body.rect(11, 38, 6, 26, 'tabby.b').rect(18, 38, 6, 26, 'tabby.b');
	body.ellipse(9, 61, 9, 6, 'tabby.b').ellipse(16, 61, 9, 6, 'tabby.b');
	body.map((ink, x, y) => {
		if (!ink) return undefined;
		const wave = Math.round(2 * Math.sin(y / 5));
		const mackerel = x > 26 && y > 36 && y < 63 && (x + wave) % 6 === 0 && (y + x) % 9 !== 0;
		const necklace = x < 26 && (y === 30 || y === 35) && x > 10;
		const legStripe = x < 25 && y > 44 && y < 60 && y % 5 === 0;
		const spine = x > 24 && body.get(x, y - 1) === null;
		if (mackerel || legStripe) return 'tabby.d2';
		if (necklace) return 'tabby.d';
		if (spine) return 'tabby.d';
		if (body.get(x + 1, y) === null || body.get(x + 2, y) === null) return 'tabby.d';
		if (body.get(x - 1, y) === null) return 'tabby.l';
		return undefined;
	});
	body.line(17, 44, 17, 64, 'tabby.d');
	body.outline();
	p.blit(body, 0, 0);
}

function mylesTail(p: Pixels, tip: Pt) {
	const tail = new Pixels(MYLES_W, MYLES_H);
	const base: Pt = [50, 62];
	const mid: Pt = [Math.round((base[0] + tip[0]) / 2 + 4), Math.round((base[1] + tip[1]) / 2 + 3)];
	const points: Pt[] = [];
	for (let i = 0; i <= 20; i++) {
		const t = i / 20;
		const x = (1 - t) ** 2 * base[0] + 2 * (1 - t) * t * mid[0] + t * t * tip[0];
		const y = (1 - t) ** 2 * base[1] + 2 * (1 - t) * t * mid[1] + t * t * tip[1];
		points.push([x, y]);
	}
	points.forEach(([x, y], i) => {
		const ring = i % 4 === 2 || i >= 19;
		const r = i > 16 ? 4 : 5;
		tail.ellipse(Math.round(x) - 2, Math.round(y) - 2, r, r, ring ? 'tabby.d2' : 'tabby.b');
	});
	tail.outline();
	p.blit(tail, 0, 0);
}

interface CatHead {
	layer: Pixels;
	ox: number;
	oy: number;
	turn: number;
}

function earShape(head: CatHead, outer: Pt[], inner: Pt[]) {
	const at = (pts: Pt[]) => pts.map(([x, y]) => [x + head.ox, y + head.oy] as Pt);
	head.layer.poly(at(outer), 'tabby.b');
	head.layer.poly(at(inner), 'nose.l');
}

function mylesEars(head: CatHead, flick: number) {
	const t = head.turn;
	earShape(
		head,
		[
			[3 + t, 12],
			[5 + t, 0],
			[13 + t, 8]
		],
		[
			[6 + t, 9],
			[6 + t, 3],
			[10 + t, 8]
		]
	);
	earShape(
		head,
		[
			[17 + t, 7],
			[26 + t + flick, 0 + flick],
			[26 + t, 13]
		],
		[
			[20 + t, 8],
			[24 + t + flick, 3 + flick],
			[24 + t, 10]
		]
	);
}

function mylesSkull({ layer, ox, oy, turn }: CatHead) {
	layer.ellipse(2 + ox + turn, 6 + oy, 24, 19, 'tabby.b');
	layer.map((ink, x, y) => {
		if (ink !== 'tabby.b') return undefined;
		const lx = x - ox - turn;
		const ly = y - oy;
		if (layer.get(x - 1, y) === null || layer.get(x, y - 1) === null) return 'tabby.l';
		if (layer.get(x + 1, y) === null) return 'tabby.d';
		if (ly < 11 && (lx === 7 || lx === 21) && ly > 6) return 'tabby.d';
		return undefined;
	});
}

function mylesMarkings({ layer, turn }: CatHead, fx: number, fy: number) {
	layer.ellipse(fx + 4 - turn, fy + 11, 12, 7, 'tabby.l');
	layer.grid(fx + 8, fy + 1, ['#...#', '##.##', '#.#.#', '#...#'], { '#': 'tabby.d2' });
	layer
		.line(fx + 10, fy, fx + 10, fy - 1, 'tabby.d')
		.line(fx + 14, fy + 1, fx + 18, fy + 4, 'tabby.d');
	layer.line(fx + 18, fy + 9, fx + 22, fy + 8, 'tabby.d2');
	layer.line(fx + 18, fy + 11, fx + 22, fy + 11, 'tabby.d2');
}

function mylesFace(p: Pixels, fx: number, fy: number, eyes: EyeState, gaze: Gaze) {
	drawCatEye(p, fx + 5, fy + 7, eyes, gaze);
	drawCatEye(p, fx + 14, fy + 7, eyes, gaze);
	const nx = fx + 9 - (gaze === 1 ? -1 : 0);
	p.rect(nx, fy + 11, 3, 1, 'nose.b').set(nx + 1, fy + 12, 'nose.d');
	p.set(nx + 1, fy + 13, 'tabby.d2')
		.set(nx, fy + 14, 'tabby.d2')
		.set(nx + 2, fy + 14, 'tabby.d2');
	p.line(fx - 1, fy + 12, fx + 3, fy + 12, 'catWhite.d');
	p.line(fx + 17, fy + 12, fx + 21, fy + 11, 'catWhite.d');
}

function mylesHead(p: Pixels, pose: MylesPose) {
	const [ox, oy] = pose.headShift ?? [0, 0];
	const gaze = pose.gaze ?? -1;
	const head: CatHead = { layer: new Pixels(MYLES_W, MYLES_H), ox, oy, turn: gaze === 1 ? 2 : 0 };
	const fx = 2 + ox + head.turn;
	const fy = 6 + oy;
	mylesEars(head, pose.earFlick ? 3 : 0);
	mylesSkull(head);
	mylesMarkings(head, fx, fy);
	head.layer.outline();
	p.blit(head.layer, 0, 0);
	mylesFace(p, fx, fy, pose.eyes ?? 'open', gaze);
}

function drawCatEye(p: Pixels, x: number, y: number, state: EyeState, gaze: Gaze) {
	if (state === 'closed') {
		p.line(x, y + 1, x + 3, y + 1, 'tabby.d2');
		return;
	}
	if (state === 'happy') {
		p.set(x, y + 1, 'tabby.d2')
			.set(x + 1, y, 'tabby.d2')
			.set(x + 2, y, 'tabby.d2')
			.set(x + 3, y + 1, 'tabby.d2');
		return;
	}
	p.rect(x, y, 4, 3, 'eye.b')
		.set(x, y, 'tabby.d2')
		.set(x + 3, y, 'tabby.d2');
	p.line(x, y - 1, x + 3, y - 1, 'tabby.d2');
	const px = gaze === -1 ? x + 1 : gaze === 1 ? x + 2 : x + 1;
	p.rect(px, y, 1, 3, 'hair.d2').set(px + (gaze === 1 ? -1 : 1), y, 'eye.l');
	if (state === 'half') p.rect(x, y, 4, 2, 'tabby.b').line(x, y + 1, x + 3, y + 1, 'tabby.d2');
}

function drawMyles(p: Pixels, pose: MylesPose) {
	mylesTail(p, pose.tailTip ?? TAIL_REST);
	mylesBody(p, pose.breath ?? 0);
	mylesHead(p, pose);
}

interface CatFrame<P> {
	pose: P;
	duration: number;
}

function sheet<P>(groups: [string, CatFrame<P>[], Omit<TagDef, 'name' | 'from' | 'to'>?][]) {
	const frames: CatFrame<P>[] = [];
	const tags: TagDef[] = [];
	for (const [name, list, extra] of groups) {
		tags.push({ name, from: frames.length, to: frames.length + list.length - 1, ...extra });
		frames.push(...list);
	}
	return { frames, tags };
}

const TAIL_REST: Pt = [60, 44];
const swishTips: Pt[] = [
	[60, 44],
	[62, 41],
	[61, 38],
	[58, 37],
	[56, 39],
	[58, 42]
];

const myles = sheet<MylesPose>([
	[
		'idle',
		[
			{ pose: {}, duration: 1400 },
			{ pose: { breath: 1 }, duration: 1400 }
		]
	],
	['swish', swishTips.map((tailTip) => ({ pose: { tailTip }, duration: 130 }))],
	[
		'blink',
		[
			{ pose: { eyes: 'half' }, duration: 120 },
			{ pose: { eyes: 'closed' }, duration: 500 },
			{ pose: { eyes: 'half' }, duration: 160 }
		]
	],
	[
		'ear',
		[
			{ pose: { earFlick: true }, duration: 90 },
			{ pose: {}, duration: 120 },
			{ pose: { earFlick: true }, duration: 90 }
		]
	],
	[
		'look',
		[
			{ pose: { gaze: 0 }, duration: 120 },
			{ pose: { gaze: 1, headShift: [1, 0] }, duration: 1600 },
			{ pose: { gaze: 0 }, duration: 120 }
		]
	],
	[
		'pet',
		[
			{ pose: { eyes: 'happy', headShift: [-1, -1], tailTip: [61, 38] }, duration: 300 },
			{ pose: { eyes: 'happy', headShift: [-2, -1], tailTip: [62, 36] }, duration: 300 },
			{ pose: { eyes: 'happy', headShift: [-2, 0], tailTip: [61, 37] }, duration: 300 },
			{ pose: { eyes: 'happy', headShift: [-1, 0], tailTip: [60, 38] }, duration: 300 }
		]
	]
]);

export const mylesSprite: SpriteDef = {
	name: 'myles',
	width: MYLES_W,
	height: MYLES_H,
	anchor: [32, 68],
	tags: myles.tags,
	slices: { hit: { x: 2, y: 0, w: 60, h: 68 }, hearts: { x: 10, y: 0, w: 1, h: 1 } },
	frames: myles.frames.map((f) => ({
		duration: f.duration,
		draw: (p: Pixels) => drawMyles(p, f.pose)
	}))
};

interface MargotPose {
	breath?: number;
	eyes?: 'closed' | 'half' | 'open';
	headLift?: number;
	earFlick?: boolean;
	pawOut?: number;
	stretch?: number;
	yawn?: boolean;
}

const MARGOT_W = 116;
const OX = 20;
const MARGOT_H = 44;

function margotTail(p: Pixels) {
	const tail = new Pixels(MARGOT_W, MARGOT_H);
	for (let x = OX + 30; x <= OX + 84; x++) {
		const y = Math.round(40 - Math.max(0, x - OX - 74) * 0.6);
		const ring = (x - OX - 30) % 6 < 2 || x < OX + 34;
		tail.ellipse(x - 2, y - 2, 5, 5, ring ? 'tabby.d2' : 'tabby.b');
	}
	tail.map((ink, x, y) =>
		ink === 'tabby.b' && tail.get(x, y - 1) === null ? 'tabby.l' : undefined
	);
	tail.outline();
	p.blit(tail, 0, 0);
}

function margotBody(p: Pixels, breath: number, stretch: number) {
	const body = new Pixels(MARGOT_W, MARGOT_H);
	body.ellipse(OX + 24 - stretch * 2, 12 - breath, 64 + stretch * 2, 31 + breath, 'tabby.b');
	body.ellipse(OX + 60, 18 - breath, 26, 24, 'tabby.b');
	body.map((ink, x, y) => {
		if (!ink) return undefined;
		const wave = Math.round(2 * Math.sin(x / 6));
		if (body.get(x, y - 1) === null || body.get(x, y - 2) === null) return 'tabby.l';
		if ((y + wave) % 6 === 0 && x > OX + 34 && y < 36) return 'tabby.d2';
		if (body.get(x + 1, y) === null) return 'tabby.d';
		if (y > 34) return 'tabby.d';
		return undefined;
	});
	body.outline();
	p.blit(body, 0, 0);
}

function margotChestAndPaws(p: Pixels, pawOut: number, stretch: number) {
	const front = new Pixels(MARGOT_W, MARGOT_H);
	const nearPaw = OX + 6 - pawOut - stretch * 8;
	const farPaw = OX + 16 - stretch * 6;
	front.ellipse(OX + 14, 26, 22, 16, 'catWhite.b');
	front.rect(nearPaw + 5, 36, OX + 20 - nearPaw, 4, 'catWhite.b');
	front.rect(farPaw + 5, 37, OX + 24 - farPaw, 4, 'catWhite.b');
	front.ellipse(nearPaw, 34, 11, 8, 'catWhite.l');
	front.ellipse(farPaw, 35, 11, 8, 'catWhite.l');
	front.map((ink, x, y) => (ink && front.get(x + 1, y) === null ? 'catWhite.d' : undefined));
	front.outline();
	p.blit(front, 0, 0);
}

function margotEars(head: CatHead, flick: number) {
	earShape(
		head,
		[
			[3, 8],
			[5, -4],
			[12, 3]
		],
		[
			[5, 5],
			[6, -1],
			[10, 3]
		]
	);
	earShape(
		head,
		[
			[19, 3],
			[27 + flick, -4 + flick],
			[28, 9]
		],
		[
			[21, 3],
			[26 + flick, -1 + flick],
			[26, 6]
		]
	);
}

function margotSkull({ layer, ox, oy }: CatHead) {
	layer.ellipse(ox, oy, 31, 25, 'tabby.b');
	layer.map((ink, x, y) => {
		if (ink !== 'tabby.b') return undefined;
		if (layer.get(x - 1, y) === null || layer.get(x, y - 1) === null) return 'tabby.l';
		if (layer.get(x + 1, y) === null) return 'tabby.d';
		const lx = x - ox;
		const ly = y - oy;
		if (ly > 1 && ly < 8 && (lx === 10 || lx === 21 || lx === 8 || lx === 23)) return 'tabby.d2';
		if (ly > 12 && ly < 17 && (lx < 5 || lx > 26) && ly % 2 === 0) return 'tabby.d2';
		return undefined;
	});
}

function margotBlazeAndMuzzle({ layer, ox, oy }: CatHead) {
	layer.rect(ox + 14, oy + 2, 3, 10, 'catWhite.l');
	layer.rect(ox + 13, oy + 7, 5, 6, 'catWhite.l');
	layer.ellipse(ox + 7, oy + 13, 17, 11, 'catWhite.l');
	layer.map((ink, x, y) =>
		ink === 'catWhite.l' && layer.get(x + 1, y)?.startsWith('tabby') ? 'catWhite.b' : undefined
	);
}

function margotEye(p: Pixels, x: number, y: number, eyes: MargotPose['eyes']) {
	if (eyes === 'open') {
		p.rect(x, y - 1, 5, 3, 'eye.b').line(x, y - 2, x + 4, y - 2, 'tabby.d2');
		p.rect(x + 2, y - 1, 1, 3, 'hair.d2');
	} else if (eyes === 'half') {
		p.rect(x, y, 5, 2, 'eye.d').line(x, y - 1, x + 4, y - 1, 'tabby.d2');
	} else {
		p.set(x, y, 'tabby.d2')
			.set(x + 1, y + 1, 'tabby.d2')
			.set(x + 2, y + 1, 'tabby.d2');
		p.set(x + 3, y + 1, 'tabby.d2').set(x + 4, y, 'tabby.d2');
	}
}

function margotFace(p: Pixels, ox: number, oy: number, pose: MargotPose) {
	margotEye(p, ox + 7, oy + 10, pose.eyes);
	margotEye(p, ox + 19, oy + 10, pose.eyes);
	p.rect(ox + 14, oy + 15, 3, 2, 'nose.b').set(ox + 15, oy + 17, 'nose.d');
	if (pose.yawn) p.rect(ox + 13, oy + 18, 5, 3, 'nose.d').rect(ox + 14, oy + 19, 3, 1, 'nose.l');
	else p.set(ox + 14, oy + 18, 'catWhite.d').set(ox + 16, oy + 18, 'catWhite.d');
}

function margotHead(p: Pixels, pose: MargotPose) {
	const ox = OX + 4 - (pose.stretch ?? 0) * 3;
	const oy = 8 - (pose.headLift ?? 0);
	const head: CatHead = { layer: new Pixels(MARGOT_W, MARGOT_H), ox, oy, turn: 0 };
	margotEars(head, pose.earFlick ? 2 : 0);
	margotSkull(head);
	margotBlazeAndMuzzle(head);
	head.layer.outline();
	p.blit(head.layer, 0, 0);
	margotFace(p, ox, oy, pose);
}

function drawMargot(p: Pixels, pose: MargotPose) {
	const stretch = pose.stretch ?? 0;
	margotBody(p, pose.breath ?? 0, stretch);
	margotTail(p);
	margotChestAndPaws(p, pose.pawOut ?? 0, stretch);
	margotHead(p, pose);
}

const margot = sheet<MargotPose>([
	[
		'sleep',
		[
			{ pose: {}, duration: 900 },
			{ pose: { breath: 1 }, duration: 700 },
			{ pose: { breath: 1 }, duration: 900 },
			{ pose: {}, duration: 700 }
		]
	],
	[
		'ear',
		[
			{ pose: { earFlick: true }, duration: 80 },
			{ pose: {}, duration: 90 },
			{ pose: { earFlick: true }, duration: 80 }
		]
	],
	[
		'paw',
		[
			{ pose: { pawOut: 2 }, duration: 160 },
			{ pose: { pawOut: 3 }, duration: 240 },
			{ pose: { pawOut: 1 }, duration: 160 }
		]
	],
	[
		'wake',
		[
			{ pose: { headLift: 2 }, duration: 200 },
			{ pose: { headLift: 3, eyes: 'half' }, duration: 600 },
			{ pose: { headLift: 3, eyes: 'closed' }, duration: 260 },
			{ pose: { headLift: 3, eyes: 'half' }, duration: 700 },
			{ pose: { headLift: 2 }, duration: 240 },
			{ pose: { headLift: 1 }, duration: 240 }
		]
	],
	[
		'stretch',
		[
			{ pose: { headLift: 2 }, duration: 220 },
			{ pose: { headLift: 3, stretch: 1, eyes: 'half' }, duration: 220 },
			{ pose: { headLift: 4, stretch: 2, yawn: true }, duration: 260 },
			{ pose: { headLift: 4, stretch: 3, yawn: true }, duration: 900 },
			{ pose: { headLift: 3, stretch: 2, eyes: 'half' }, duration: 260 },
			{ pose: { headLift: 2, stretch: 1 }, duration: 240 },
			{ pose: { headLift: 1 }, duration: 300 }
		],
		{ events: { 0: 'margot-stretch' } }
	]
]);

function reactionTo(
	tags: TagDef[],
	source: string,
	name: string,
	events: TagDef['events']
): TagDef {
	const tag = tags.find((t) => t.name === source)!;
	return { name, from: tag.from, to: tag.to, events };
}

export const margotSprite: SpriteDef = {
	name: 'margot',
	width: MARGOT_W,
	height: MARGOT_H,
	anchor: [OX + 48, 44],
	tags: [...margot.tags, reactionTo(margot.tags, 'ear', 'ear-react', { 0: 'margot-wake' })],
	slices: { hit: { x: OX, y: 2, w: 92, h: 42 }, zzz: { x: OX + 6, y: 0, w: 1, h: 1 } },
	frames: margot.frames.map((f) => ({
		duration: f.duration,
		draw: (p: Pixels) => drawMargot(p, f.pose)
	}))
};

export const cushion: SpriteDef = {
	name: 'cushion',
	width: 100,
	height: 30,
	anchor: [50, 30],
	tags: [
		{ name: 'back', from: 0, to: 0 },
		{ name: 'front', from: 1, to: 1 }
	],
	frames: [0, 1].map((front) => ({
		duration: 1000,
		draw: (p: Pixels) => {
			const c = new Pixels(100, 30);
			c.ellipse(0, 4, 100, 26, 'cushion.d');
			c.ellipse(2, 2, 96, 22, 'cushion.b');
			c.ellipse(10, 4, 80, 14, 'cushion.l');
			c.ellipse(16, 6, 68, 10, 'cushion.b');
			for (let x = 8; x < 92; x += 7) c.set(x, 20 + Math.round(Math.sin(x) * 1), 'cushion.d');
			c.outline();
			if (front) c.map((ink, _x, y) => (ink && y < 15 ? null : undefined));
			p.blit(c, 0, 0);
		}
	}))
};

function heart(p: Pixels, x: number, y: number, ink: Ink) {
	p.grid(x, y, ['##.##', '#####', '.###.', '..#..'], { '#': ink });
}

export const hearts: SpriteDef = {
	name: 'hearts',
	width: 18,
	height: 24,
	anchor: [9, 24],
	tags: [{ name: 'float', from: 0, to: 6, repeat: 1 }],
	frames: Array.from({ length: 7 }, (_, i) => ({
		duration: 150,
		draw: (p: Pixels) => {
			const fade: Ink = i > 4 ? 'nose.d' : 'nose.b';
			if (i < 6) heart(p, 2, 18 - i * 3, fade);
			if (i > 1) heart(p, 10, 20 - (i - 2) * 3, i > 5 ? 'nose.d' : 'nose.l');
		}
	}))
};

function zee(p: Pixels, x: number, y: number, size: 3 | 4, ink: Ink) {
	const rows = size === 4 ? ['####', '..#.', '.#..', '####'] : ['###', '.#.', '###'];
	p.grid(x, y, rows, { '#': ink });
}

export const zzz: SpriteDef = {
	name: 'zzz',
	width: 20,
	height: 22,
	anchor: [0, 22],
	tags: [{ name: 'float', from: 0, to: 5 }],
	frames: Array.from({ length: 6 }, (_, i) => ({
		duration: 450,
		draw: (p: Pixels) => {
			zee(p, 2 + Math.floor(i / 2), 16 - i * 2, 3, i > 3 ? 'catWhite.d' : 'catWhite.b');
			const j = (i + 3) % 6;
			zee(p, 9 + Math.floor(j / 2), 15 - j * 2, 4, j > 3 ? 'catWhite.d' : 'catWhite.l');
		}
	}))
};
