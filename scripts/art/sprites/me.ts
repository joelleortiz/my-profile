import { Pixels, shift, type Ink, type Pt, type SpriteDef, type TagDef } from '../lib/sheet.ts';

export const ME_W = 152;
export const ME_H = 132;

const HEAD: Pt = [60, 32];

export type Eyes = 'open' | 'smile' | 'closed' | 'left' | 'none';
export type Mouth = 'smile' | 'sip' | 'open';

export interface HeadOptions {
	turn?: -1 | 0;
	eyes?: Eyes;
	mouth?: Mouth;
}

export function lensCentres(turn: -1 | 0): [Pt, Pt] {
	return turn === -1
		? [
				[10, 18],
				[19, 18]
			]
		: [
				[11, 18],
				[21, 18]
			];
}

function hairline(x: number, part: number): number {
	return x < part ? 9 + (part - x) * 1.6 : 8 + (x - part) * 0.42;
}

interface Head {
	p: Pixels;
	ox: number;
	oy: number;
	turn: -1 | 0;
	part: number;
}

function drawHairMass({ p, ox, oy }: Head) {
	const hair = new Pixels(32, 40);
	hair.ellipse(1, -1, 30, 33, 'hair.b');
	hair.poly(
		[
			[2, 14],
			[30, 14],
			[31, 33],
			[32, 39],
			[25, 39],
			[22, 34],
			[10, 34],
			[7, 39],
			[0, 39],
			[1, 33]
		],
		'hair.b'
	);
	hair.rect(0, 37, 3, 2, 'hair.b').rect(29, 37, 3, 2, 'hair.b');
	hair.outline();
	hair.map((ink, x, y) => (ink === 'hair.b' && x > 24 && y > 12 ? 'hair.d' : undefined));
	hair.line(4, 16, 4, 33, 'hair.l').line(3, 22, 3, 36, 'hair.d');
	p.blit(hair, ox, oy);
}

function drawNeck({ p, ox, oy }: Head) {
	p.rect(ox + 13, oy + 29, 8, 9, 'skin.b');
	p.rect(ox + 13, oy + 29, 8, 3, 'skin.d').rect(ox + 19, oy + 32, 2, 6, 'skin.d');
}

function drawFace({ p, ox, oy, turn, part }: Head) {
	const fx = 4.5 + turn;
	const face = new Pixels(32, 40);
	face.ellipse(fx, 7, 24, 25, 'skin.b');
	face.map((ink, x, y) => (ink && y < hairline(x, part) ? null : undefined));
	face.map((ink, x, y) => {
		if (ink !== 'skin.b') return undefined;
		const rel = (x - fx) / 24;
		const rightEdge = face.get(x + 2, y) === null || face.get(x + 1, y) === null;
		if (rightEdge && rel > 0.6) return 'skin.d';
		if (y > 29 && rel > 0.5) return 'skin.d';
		if (rel < 0.16 && y > 18 && y < 24) return 'skin.l';
		return undefined;
	});
	face.map((ink, x, y) =>
		ink === 'skin.b' && y < hairline(x, part) + 1.2 && x >= part ? 'skin.d' : undefined
	);
	p.blit(face, ox, oy);
}

function drawFringeAndSheen({ p, ox, oy, turn, part }: Head) {
	for (let x = part; x <= 28; x++) {
		const y = Math.floor(hairline(x, part));
		if ((x - part) % 4 === 1) p.set(ox + x, oy + y - 1, 'hair.d');
	}
	p.path(
		[
			[ox + 5, oy + 8],
			[ox + 7, oy + 4],
			[ox + 10 + turn, oy + 2]
		],
		'hair.l'
	);
	p.path(
		[
			[ox + part + 2, oy + 3],
			[ox + part + 7, oy + 4],
			[ox + part + 12, oy + 7]
		],
		'hair.l'
	);
	p.set(ox + part, oy + 1, 'hair.d').set(ox + part, oy + 2, 'hair.d');
}

function drawBrowsNoseAndCheeks({ p, ox, oy, turn }: Head) {
	const [l, r] = lensCentres(turn);
	p.line(ox + l[0] - 2, oy + 13, ox + l[0] + 1, oy + 13, 'hair.d');
	p.line(ox + r[0] - 1, oy + 13, ox + r[0] + 2, oy + 13, 'hair.d');
	const nx = 16 + turn * 2;
	p.set(ox + nx, oy + 20, 'skin.l')
		.set(ox + nx, oy + 21, 'skin.d')
		.set(ox + nx + 1, oy + 22, 'skin.d');
	p.rect(ox + l[0] - 3, oy + 22, 2, 1, 'nose.l').rect(ox + r[0] + 2, oy + 22, 2, 1, 'nose.l');
}

function drawMouth({ p, ox, oy, turn }: Head, mouth: Mouth) {
	const mx = ox + 12 + turn * 2;
	const my = oy + 24;
	if (mouth === 'sip') {
		p.rect(mx + 3, my + 1, 3, 1, 'nose.d').rect(mx + 3, my + 2, 3, 1, 'skin.d');
		return;
	}
	p.set(mx, my, 'skin.d2').set(mx + 9, my, 'skin.d2');
	p.set(mx + 1, my + 1, 'skin.d2').set(mx + 8, my + 1, 'skin.d2');
	p.rect(mx + 2, my + 1, 6, 1, 'catWhite.l');
	p.rect(mx + 2, my + 2, 6, 1, mouth === 'open' ? 'nose.d' : 'skin.d2');
	p.rect(mx + 3, my + 3, 4, 1, 'skin.d');
}

export function drawHead(p: Pixels, ox: number, oy: number, opts: HeadOptions = {}): void {
	const { turn = 0, eyes = 'open', mouth = 'smile' } = opts;
	const head: Head = { p, ox, oy, turn, part: 11 + turn };
	drawHairMass(head);
	drawNeck(head);
	drawFace(head);
	drawFringeAndSheen(head);
	drawBrowsNoseAndCheeks(head);
	drawMouth(head, mouth);
	drawGlassesAndEyes(p, ox, oy, turn, eyes);
}

export function drawGlassesAndEyes(
	p: Pixels,
	ox: number,
	oy: number,
	turn: -1 | 0,
	eyes: Eyes
): void {
	const [l, r] = lensCentres(turn);
	const ring = (c: Pt, narrow: boolean) => {
		const w = narrow ? 6 : 7;
		const x0 = Math.round(c[0] - w / 2);
		const y0 = c[1] - 3;
		const rows = narrow
			? ['.###..', '#...#.', '#....#', '#....#', '#....#', '#...#.', '.###..']
			: ['..###..', '.#...#.', '#.....#', '#.....#', '#.....#', '.#...#.', '..###..'];
		p.grid(ox + x0, oy + y0, rows, { '#': 'glasses.d' });
		p.set(ox + x0 + 1, oy + y0 + 1, 'glasses.l').set(ox + x0 + 2, oy + y0, 'glasses.l');
		p.set(ox + x0 + w - 2, oy + y0 + 5, 'glasses.d2').set(
			ox + x0 + w - 3,
			oy + y0 + 6,
			'glasses.d2'
		);
		return { x0, y0, w };
	};
	const a = ring(l, false);
	const b = ring(r, turn === 0);
	p.line(ox + a.x0 + a.w, oy + l[1] - 1, ox + b.x0 - 1, oy + r[1] - 1, 'glasses.d');
	p.set(ox + a.x0 - 1, oy + l[1] - 2, 'glasses.d');
	p.set(ox + b.x0 + b.w, oy + r[1] - 2, 'glasses.d');

	if (eyes === 'none') return;
	for (const c of [l, r]) {
		const x = Math.round(c[0]);
		const y = c[1];
		if (eyes === 'open') {
			p.line(ox + x - 2, oy + y, ox + x + 1, oy + y, 'hair.d2');
			p.rect(ox + x - 1, oy + y + 1, 2, 1, 'hair.d2');
		} else if (eyes === 'smile') {
			p.set(ox + x - 2, oy + y + 1, 'hair.d2')
				.set(ox + x - 1, oy + y, 'hair.d2')
				.set(ox + x, oy + y, 'hair.d2')
				.set(ox + x + 1, oy + y + 1, 'hair.d2');
		} else if (eyes === 'closed') {
			p.line(ox + x - 2, oy + y + 1, ox + x + 1, oy + y + 1, 'hair.d2');
		} else if (eyes === 'left') {
			p.rect(ox + x - 2, oy + y, 2, 2, 'hair.d2').set(ox + x, oy + y + 1, 'hair.d2');
		}
	}
}

export interface Arm {
	shoulder: Pt;
	elbow: Pt;
	hand: Pt;
	showHand?: boolean;
	grip?: 'fist' | 'open' | 'cup';
}

export interface Pose {
	head?: HeadOptions;
	headShift?: Pt;
	left: Arm;
	right: Arm;
	lean?: Pt;
}

const SLEEVE = 8;

function capsuleLine(p: Pixels, a: Pt, b: Pt, width: number, ink: Ink) {
	const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
	const r = width / 2;
	for (let i = 0; i <= steps; i++) {
		const cx = a[0] + ((b[0] - a[0]) * i) / steps;
		const cy = a[1] + ((b[1] - a[1]) * i) / steps;
		p.ellipse(Math.round(cx - r), Math.round(cy - r), width, width, ink);
	}
}

function drawArm(p: Pixels, arm: Arm) {
	const layer = new Pixels(ME_W, ME_H);
	capsuleLine(layer, arm.shoulder, arm.elbow, SLEEVE, 'sweater.b');
	capsuleLine(layer, arm.elbow, arm.hand, SLEEVE - 1, 'sweater.b');
	layer.map((ink, x, y) => {
		if (ink !== 'sweater.b') return undefined;
		const lit = layer.get(x - 1, y - 1) === null || layer.get(x - 1, y) === null;
		const dark = layer.get(x + 1, y + 1) === null || layer.get(x + 1, y) === null;
		if (lit) return 'sweater.l';
		if (dark) return 'sweater.d';
		return (x + y * 2) % 6 === 0 ? 'sweater.d' : undefined;
	});
	layer.outline();
	p.blit(layer, 0, 0);
	if (arm.showHand !== false) drawHand(p, arm);
}

function drawHand(p: Pixels, arm: Arm) {
	const [hx, hy] = arm.hand.map(Math.round) as Pt;
	const hand = new Pixels(ME_W, ME_H);
	if (arm.grip === 'open') {
		hand.ellipse(hx - 3, hy - 2, 7, 5, 'skin.b');
		hand
			.rect(hx - 3, hy + 2, 1, 1, 'skin.b')
			.rect(hx - 1, hy + 2, 1, 1, 'skin.b')
			.rect(hx + 1, hy + 2, 1, 1, 'skin.b');
	} else {
		hand.ellipse(hx - 3, hy - 3, 6, 6, 'skin.b');
	}
	hand.map((ink, x, y) => (ink === 'skin.b' && (x > hx || y > hy) ? 'skin.d' : undefined));
	hand.map((ink, x, y) => (ink === 'skin.b' && x < hx - 1 && y < hy - 1 ? 'skin.l' : undefined));
	hand.outline('skin.d2');
	p.blit(hand, 0, 0);
}

function drawTorso(p: Pixels, lean: Pt) {
	const [lx, ly] = lean;
	const torso = new Pixels(ME_W, ME_H);
	torso.poly(
		[
			[70 + lx, 67 + ly],
			[83 + lx, 67 + ly],
			[97 + lx, 72 + ly],
			[101 + lx, 82 + ly],
			[100 + lx, 132],
			[52 + lx, 132],
			[51 + lx, 82 + ly],
			[55 + lx, 72 + ly]
		],
		'sweater.b'
	);
	torso.map((ink, x, y) => {
		if (ink !== 'sweater.b') return undefined;
		const cx = x - lx;
		const d = cx - 74;
		if (d === -3 || d === 3) return 'sweater.d';
		if (d > -3 && d < 3) {
			const phase = Math.floor(y / 3) % 2;
			return (phase ? d === (y % 3) - 1 : d === 1 - (y % 3)) ? 'sweater.l' : undefined;
		}
		return (cx - 74 + 60) % 5 === 0 && y % 2 === 0 ? 'sweater.d' : undefined;
	});
	torso.map((ink, x) =>
		ink && ink.startsWith('sweater') && x - lx > 94 ? shift(ink, -1) : undefined
	);
	torso.outline();
	torso.rect(69 + lx, 67 + ly, 15, 2, 'sweater.d').rect(70 + lx, 66 + ly, 13, 1, 'sweater.l');
	p.blit(torso, 0, 0);
}

export function drawMe(p: Pixels, pose: Pose): void {
	const [hx, hy] = pose.headShift ?? [0, 0];
	const lean = pose.lean ?? [0, 0];
	drawTorso(p, lean);
	drawHead(p, HEAD[0] + hx + lean[0], HEAD[1] + hy + lean[1], pose.head);
	drawArm(p, pose.left);
	drawArm(p, pose.right);
}

export function faceSlice(pose: Pose) {
	const [hx, hy] = pose.headShift ?? [0, 0];
	const lean = pose.lean ?? [0, 0];
	return { x: HEAD[0] + hx + lean[0], y: HEAD[1] + hy + lean[1], w: 32, h: 32 };
}

const L_SHOULDER: Pt = [58, 76];
const R_SHOULDER: Pt = [94, 76];

function typing(i: number): Pose {
	const lDown = i === 0 ? 1 : 0;
	const rDown = i === 2 ? 1 : 0;
	return {
		left: {
			shoulder: L_SHOULDER,
			elbow: [45, 103 + lDown],
			hand: [62, 112 + lDown],
			showHand: false
		},
		right: {
			shoulder: R_SHOULDER,
			elbow: [107, 103 + rDown],
			hand: [90, 112 + rDown],
			showHand: false
		}
	};
}

const TYPE_LEFT = typing(1).left;
const TYPE_RIGHT = typing(1).right;

function lerpPt(a: Pt, b: Pt, t: number): Pt {
	return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t)];
}

function lerpArm(a: Arm, b: Arm, t: number, extra: Partial<Arm> = {}): Arm {
	return {
		shoulder: lerpPt(a.shoulder, b.shoulder, t),
		elbow: lerpPt(a.elbow, b.elbow, t),
		hand: lerpPt(a.hand, b.hand, t),
		...extra
	};
}

const PET_REACH: Arm = { shoulder: [95, 75], elbow: [115, 84], hand: [128, 70], grip: 'open' };
const PET_STROKES: Pt[] = [
	[128, 70],
	[132, 72],
	[136, 76],
	[132, 72]
];

const CUP_REACH: Arm = { shoulder: [57, 77], elbow: [36, 100], hand: [20, 114], grip: 'cup' };
const CUP_MOUTH: Arm = { shoulder: [58, 76], elbow: [47, 98], hand: [69, 82], grip: 'cup' };
const CUP_ON_DESK: Pt = [16, 129];

const STRETCH_L: Arm = { shoulder: [57, 74], elbow: [50, 46], hand: [66, 16], grip: 'fist' };
const STRETCH_R: Arm = { shoulder: [95, 74], elbow: [102, 46], hand: [86, 16], grip: 'fist' };

interface FrameSpec {
	pose: Pose;
	duration: number;
	cup?: Pt;
}

function frame(pose: Pose, duration: number, cup?: Pt): FrameSpec {
	return { pose, duration, cup };
}

const frames: FrameSpec[] = [];
const tags: TagDef[] = [];
function tag(name: string, specs: FrameSpec[], extra: Omit<TagDef, 'name' | 'from' | 'to'> = {}) {
	const from = frames.length;
	frames.push(...specs);
	tags.push({ name, from, to: frames.length - 1, ...extra });
}

tag(
	'type',
	[0, 1, 2, 3].map((i) => frame(typing(i), 110)),
	{ events: { 0: 'type', 2: 'type' } }
);

tag(
	'pet-reach',
	[
		frame(
			{ left: TYPE_LEFT, right: lerpArm(TYPE_RIGHT, PET_REACH, 0.35, { showHand: true }) },
			120
		),
		frame(
			{
				left: TYPE_LEFT,
				right: lerpArm(TYPE_RIGHT, PET_REACH, 0.7, { showHand: true, grip: 'open' })
			},
			120
		),
		frame({ left: TYPE_LEFT, right: PET_REACH, head: { eyes: 'smile' } }, 160)
	],
	{ events: { 2: 'pet-start' } }
);
tag(
	'pet-stroke',
	PET_STROKES.map((hand, i) =>
		frame(
			{
				left: TYPE_LEFT,
				right: { ...PET_REACH, hand, elbow: [115 + (i % 2), 84 + (i === 2 ? 2 : 0)] },
				head: { eyes: 'smile' }
			},
			300
		)
	)
);
tag(
	'pet-return',
	[
		frame(
			{
				left: TYPE_LEFT,
				right: lerpArm(TYPE_RIGHT, PET_REACH, 0.7, { showHand: true, grip: 'open' })
			},
			120
		),
		frame({ left: TYPE_LEFT, right: lerpArm(TYPE_RIGHT, PET_REACH, 0.35, { showHand: true }) }, 120)
	],
	{ events: { 0: 'pet-end' } }
);

tag(
	'sip',
	[
		frame({ left: lerpArm(TYPE_LEFT, CUP_REACH, 0.5, { showHand: true }), right: TYPE_RIGHT }, 120),
		frame({ left: CUP_REACH, right: TYPE_RIGHT }, 160, CUP_ON_DESK),
		frame(
			{ left: lerpArm(CUP_REACH, CUP_MOUTH, 0.5, { grip: 'cup' }), right: TYPE_RIGHT },
			130,
			[42, 110]
		),
		frame({ left: CUP_MOUTH, right: TYPE_RIGHT, head: { mouth: 'sip' } }, 500, [68, 98]),
		frame(
			{ left: CUP_MOUTH, right: TYPE_RIGHT, head: { mouth: 'sip', eyes: 'closed' } },
			700,
			[68, 98]
		),
		frame(
			{ left: lerpArm(CUP_REACH, CUP_MOUTH, 0.5, { grip: 'cup' }), right: TYPE_RIGHT },
			130,
			[42, 110]
		),
		frame({ left: CUP_REACH, right: TYPE_RIGHT }, 160, CUP_ON_DESK),
		frame({ left: lerpArm(TYPE_LEFT, CUP_REACH, 0.5, { showHand: true }), right: TYPE_RIGHT }, 120)
	],
	{ events: { 3: 'sip', 6: 'cup-down' } }
);

tag('stretch', [
	frame(
		{
			left: lerpArm(TYPE_LEFT, STRETCH_L, 0.4, { showHand: true }),
			right: lerpArm(TYPE_RIGHT, STRETCH_R, 0.4, { showHand: true })
		},
		150
	),
	frame(
		{
			left: STRETCH_L,
			right: STRETCH_R,
			head: { eyes: 'closed', mouth: 'open' },
			headShift: [0, -1]
		},
		220
	),
	frame(
		{
			left: { ...STRETCH_L, hand: [68, 13] },
			right: { ...STRETCH_R, hand: [84, 13] },
			head: { eyes: 'closed', mouth: 'open' },
			headShift: [0, -1]
		},
		900
	),
	frame({ left: STRETCH_L, right: STRETCH_R, head: { eyes: 'closed' } }, 200),
	frame(
		{
			left: lerpArm(TYPE_LEFT, STRETCH_L, 0.4, { showHand: true }),
			right: lerpArm(TYPE_RIGHT, STRETCH_R, 0.4, { showHand: true })
		},
		150
	)
]);

tag('glance', [
	frame(
		{ left: TYPE_LEFT, right: TYPE_RIGHT, head: { turn: -1, eyes: 'left' }, headShift: [-1, 0] },
		1800
	)
]);

export const me: SpriteDef = {
	name: 'me',
	width: ME_W,
	height: ME_H,
	anchor: [76, 132],
	tags,
	frames: frames.map((f) => ({ duration: f.duration, draw: (p) => drawMe(p, f.pose) })),
	slices: {
		face: frames.map((f) => faceSlice(f.pose)),
		cup: frames.map((f) =>
			f.cup ? { x: f.cup[0], y: f.cup[1], w: 1, h: 1 } : { x: 0, y: 0, w: 0, h: 0 }
		),
		hit: { x: 44, y: 28, w: 64, h: 70 }
	}
};

function faceFrame(kind: 'blink-half' | 'blink' | 'happy' | 'glint') {
	return (p: Pixels) => {
		const [l, r] = lensCentres(0);
		for (const c of [l, r]) {
			const x = Math.round(c[0]);
			const y = c[1];
			if (kind === 'glint') {
				p.set(x + 1, y - 2, 'screen.l')
					.set(x + 1, y - 1, 'screen.b')
					.set(x - 2, y + 2, 'screen.d');
				continue;
			}
			p.rect(x - 2, y - 1, 5, 4, 'skin.b');
			if (kind === 'blink-half')
				p.line(x - 2, y + 1, x + 1, y + 1, 'hair.d2')
					.set(x - 1, y + 2, 'hair.d2')
					.set(x, y + 2, 'hair.d2');
			else if (kind === 'blink') p.line(x - 2, y + 1, x + 1, y + 1, 'hair.d2');
			else
				p.set(x - 2, y + 1, 'hair.d2')
					.set(x - 1, y, 'hair.d2')
					.set(x, y, 'hair.d2')
					.set(x + 1, y + 1, 'hair.d2');
		}
	};
}

export const meFace: SpriteDef = {
	name: 'me-face',
	width: 32,
	height: 32,
	anchor: [0, 0],
	tags: [
		{ name: 'blink', from: 0, to: 2 },
		{ name: 'happy', from: 3, to: 3 },
		{ name: 'glint', from: 4, to: 4 },
		{ name: 'none', from: 5, to: 5 }
	],
	frames: [
		{ duration: 50, draw: faceFrame('blink-half') },
		{ duration: 90, draw: faceFrame('blink') },
		{ duration: 50, draw: faceFrame('blink-half') },
		{ duration: 1000, draw: faceFrame('happy') },
		{ duration: 1000, draw: faceFrame('glint') },
		{ duration: 1000, draw: () => {} }
	]
};
