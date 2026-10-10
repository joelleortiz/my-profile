// The study scene (option B of the B1b sketches): one camera square to the back wall, the desk
// set turned toward the viewer's left, Joelle typing toward the window, Margot on the sill and
// Myles on the desk. Projected pieces are rendered into world-sized canvases and cropped, so
// `at` positions in scene.json are the crop origins printed by `node scripts/art/study-positions.ts`.
import { Canvas } from '../lib/canvas.ts';
import { View, shadowUnder, type Camera, type V3 } from '../lib/project.ts';
import {
	shift,
	type Ink,
	type Pixels,
	type Pt,
	type SpriteDef,
	type TagDef
} from '../lib/sheet.ts';
import {
	BODY,
	EYE_SPREAD,
	HEAD,
	bookshelf,
	clock,
	coffee,
	corkboard,
	forearm,
	forearms,
	grip,
	head,
	joelle,
	lamp,
	legs,
	margot,
	myles,
	note,
	pettingHand,
	plant,
	radio,
	sign,
	stickerSheet,
	stringLights,
	swatchCard,
	texture,
	windowFrame,
	MARGOT,
	type Gaze,
	type MargotPose,
	type MylesPose
} from './parts.ts';

export const WORLD = { w: 880, h: 480 };
export const CAMERA: Camera = { x: 0, y: 125, z: 500, f: 968, cx: 440, cy: 225 };

const TURN = 0.45;
/** Joelle's eye height in cm: seated low and comfortable in the chair. */
const EYE_HEIGHT = 118;
const SET = {
	angle: -0.38,
	jx: 10,
	desk: [-58, 58] as [number, number],
	laptop: [-20, 12] as [number, number]
};
const PIVOT: [number, number] = [SET.jx, 60];
const ROT = { angle: SET.angle, pivot: PIVOT };
const DESK_BOX: [V3, V3] = [
	[SET.jx + SET.desk[0], 0, 75],
	[SET.jx + SET.desk[1], 70.5, 135]
];

/** Rotates a point given relative to Joelle (x) into the room. */
function R([x, y, z]: V3): V3 {
	const dz = z - 60;
	const s = Math.sin(SET.angle);
	const k = Math.cos(SET.angle);
	return [SET.jx + x * k + dz * s, y, 60 - x * s + dz * k];
}

const local = (x: number) => x + SET.jx;
const view = (w = WORLD.w, h = WORLD.h, dx = 0, dy = 0) =>
	new View(w, h, { ...CAMERA, cx: CAMERA.cx + dx, cy: CAMERA.cy + dy });

export interface Placed {
	def: SpriteDef;
	/** Scene position of the sprite's anchor. */
	at: [number, number];
}

function still(
	name: string,
	p: Canvas,
	anchor: [number, number] = [0, 0],
	extra: Partial<SpriteDef> = {}
): SpriteDef {
	return {
		name,
		width: p.w,
		height: p.h,
		anchor,
		frames: [{ duration: 1000, draw: (q) => q.blit(p, 0, 0) }],
		...extra
	};
}

/** Crops a world-sized canvas to its opaque pixels and records where the crop sits. */
function cropped(name: string, world: Canvas, extra: Partial<SpriteDef> = {}): Placed {
	const b = world.bounds()!;
	const p = world.crop(b.x, b.y, b.w, b.h);
	return { def: still(name, p, [0, 0], extra), at: [b.x, b.y] };
}

// ---------- the room shell ----------

function roomCanvas(): Canvas {
	const v = view();
	const room = { w: 480, h: 228, depth: 470 };
	const hw = room.w / 2;
	v.quad([-hw, room.h, 0], [hw, room.h, 0], [-hw, 0, 0], (_u, vv) => {
		const y = vv * room.h;
		if (y > room.h - 10)
			return y > room.h - 1.5 ? 'frame.d2' : y > room.h - 3 ? 'frame.l' : 'frame.b';
		if (y < 3) return 'frame.d2';
		if (y < 6) return 'frame.b';
		if (y < 7) return 'frame.l';
		return 'wall.b';
	});
	const side = (_u: number, vv: number) => (vv * room.h > room.h - 10 ? 'frame.d' : 'wall.d');
	v.quad([-hw, room.h, room.depth], [-hw, room.h, 0], [-hw, 0, room.depth], side);
	v.quad([hw, room.h, 0], [hw, room.h, room.depth], [hw, 0, 0], side);
	v.quad([-hw, 0, 0], [hw, 0, 0], [-hw, 0, room.depth], (u, vv) => {
		const board = Math.floor(u * 18);
		const seam = (u * 18) % 1 < 0.06;
		const cross = (vv * 30 + board * 7.3) % 9 < 0.18;
		return seam || cross ? 'floor.d' : board % 3 === 0 ? 'floor.l' : 'floor.b';
	});
	v.quad([-hw, room.h, room.depth], [hw, room.h, room.depth], [-hw, room.h, 0], 'ceiling.b');
	// The desk itself is a separate sprite; here it only casts its shadow on the wall and floor.
	shadowUnder(v, DESK_BOX[0], DESK_BOX[1], ROT, -1);
	// Wallpaper over the back wall's plain base, outside the desk's shadow.
	v.px.remap((ink, x, y) => (ink === 'wall.b' && wallpaper(x, y) ? 'wall.l' : undefined));
	return v.px;
}

/**
 * The wallpaper's motif: a tiny four-dot flower on a 12 px diamond lattice, counted from the
 * world's origin so it tiles seamlessly across the back wall. Drawn in the wall's highlight
 * shade, so it stays faint and every palette recolours it.
 */
function wallpaper(x: number, y: number): boolean {
	const petal = (cx: number, cy: number) => {
		const dx = (((x - cx) % 12) + 12) % 12;
		const dy = (((y - cy) % 12) + 12) % 12;
		return (dx === 0 && (dy === 1 || dy === 11)) || (dy === 0 && (dx === 1 || dx === 11));
	};
	return petal(0, 0) || petal(6, 6);
}

export const room: SpriteDef = still('room', roomCanvas());

// ---------- the desk set ----------

function chairCanvas(): Canvas {
	const v = view();
	v.quad(R([-21, 121, 40]), R([21, 121, 40]), R([-21, 72, 40]), (u, vv) => {
		const r = 0.12;
		const cu = Math.min(u, 1 - u);
		if (vv < r && cu < r && (r - cu) ** 2 + (r - vv) ** 2 > r * r) return null;
		return u > 0.82 ? 'chair.d' : vv < 0.06 ? 'chair.l' : 'chair.b';
	});
	return v.px;
}

function deskCanvas(): Canvas {
	const v = view();
	const [l, r] = SET.desk;
	const top = v.box(
		[local(l), 71, 75],
		[local(r), 74, 135],
		{
			top: (u, vv) => {
				if (vv > 0.94) return 'desk.l';
				const grain = Math.floor(vv * 22) % 5 === 0 && (u * 9 + vv * 3) % 1 < 0.7;
				return grain ? 'desk.d' : 'desk.b';
			},
			front: 'desk.d',
			left: 'desk.d2',
			right: 'desk.d2'
		},
		ROT
	);
	const ids = [top];
	for (const [x, z] of [
		[l + 2, 77],
		[r - 6, 77],
		[l + 2, 129],
		[r - 6, 129]
	])
		ids.push(
			v.box(
				[local(x), 0, z],
				[local(x + 4), 71, z + 4],
				{ front: 'desk.d', left: 'desk.b', right: 'desk.d2' },
				ROT
			)
		);
	ids.push(
		v.box(
			[local(l + 2), 63, 126],
			[local(r - 2), 71, 130],
			{ front: 'desk.d', left: 'desk.d2', right: 'desk.d2' },
			ROT
		)
	);
	v.outline(ids);
	// Back legs sit in the shadow under the top.
	shadowUnder(v, DESK_BOX[0], DESK_BOX[1], ROT, -1);
	return v.px;
}

function lidQuad(): [V3, V3, V3] {
	const [a, b] = SET.laptop;
	return [R([a, 76, 114]), R([b, 76, 114]), R([a, 95, 119])];
}

function laptopCanvas(): Canvas {
	const v = view();
	const [a, b] = SET.laptop;
	const base = v.box(
		[local(a), 74, 94],
		[local(b), 76, 114],
		{ top: 'laptop.d', front: 'laptop.d2', left: 'laptop.d2', right: 'laptop.d2' },
		ROT
	);
	const [p0, p1, p3] = lidQuad();
	const lid = v.quad(p0, p1, p3, (_u, vv) => (vv > 0.95 ? 'laptop.l' : 'laptop.b'));
	v.outline([base, lid]);
	return v.px;
}

/** Sticker regions on the lid texture (64×40, origin at the lid's top-left as seen from behind). */
export const STICKERS = {
	'sticker-github': { x: 3, y: 3, w: 22, h: 14 },
	'sticker-name': { x: 27, y: 2, w: 25, h: 17 },
	'sticker-code': { x: 44, y: 14, w: 19, h: 11 },
	'sticker-cats': { x: 37, y: 26, w: 19, h: 12 },
	'sticker-bolt': { x: 3, y: 27, w: 9, h: 12 },
	'sticker-heart': { x: 14, y: 28, w: 11, h: 10 },
	'sticker-scroll': { x: 57, y: 26, w: 6, h: 12 }
} as const;

/** Stickers that are links: GitHub, LinkedIn (the name sticker) and, once it exists, the CV. */
const LINKED: ReadonlySet<string> = new Set(['sticker-github', 'sticker-name', 'sticker-scroll']);

function stickerCanvas(name: keyof typeof STICKERS): Canvas {
	const sheet = stickerSheet();
	const r = STICKERS[name];
	const only = new Canvas(sheet.w, sheet.h);
	for (let y = r.y; y < r.y + r.h; y++)
		for (let x = r.x; x < r.x + r.w; x++) {
			const ink = sheet.get(x, y);
			if (ink && !ink.startsWith('laptop')) only.set(x, y, ink);
		}
	const tex = texture(only);
	const v = view();
	const [p0, p1, p3] = lidQuad();
	v.quad(p0, p1, p3, (u, vv) => tex(u, 1 - vv));
	return v.px;
}

function legsCanvas(): Canvas {
	const v = view();
	const [kx, ky] = v.project(R([0, 52, 98]));
	const l = legs(TURN);
	// In the desk's shadow.
	l.remap((ink) => (ink ? shift(ink as Ink, -1) : undefined));
	v.flat(l, Math.round(kx - 48 + 10 * TURN), Math.round(ky - 50), CAMERA.z - 70);
	return v.px;
}

/**
 * Joelle's forearms for one pose: on the keyboard behind the lid (dipping with the typing bob), in
 * the air for the stretch, or the right one carrying the coffee.
 */
function armsCanvas(pose: MePose): Canvas {
	const v = view();
	if (pose.raise) return v.px;
	const at = (p: V3, dy: number): Pt => {
		const [x, y] = v.project(R(p));
		return [x, y + dy];
	};
	const [a, b] = SET.laptop;
	const [dl, dr] = pose.dip ?? [0, 0];
	const elbows: [Pt, Pt] = [at([-21, 77, 80], dl), at([21, 77, 80], dr)];
	const wrists: [Pt, Pt] = [at([a + 8, 77, 102], dl), at([b - 6, 77, 102], dr)];
	if (!pose.sip && !pose.pet) {
		forearms(v.px, elbows, wrists, false);
		return v.px;
	}
	const shade = (elbows[0][0] + elbows[1][0]) / 2 + 20;
	forearm(v.px, elbows[0], wrists[0], shade);
	if (pose.pet) {
		// Behind Myles: the hand shows here only beside him or behind his head.
		forearm(v.px, ELBOW_R, PET[pose.pet], shade, false, false);
		if (pose.pet === 'lift' || pose.pet === 'back') pettingHand(v.px, PET[pose.pet]);
		return v.px;
	}
	const [cx, cy] = CUP[pose.sip!];
	if (pose.sip === 'reach') forearm(v.px, elbows[1], [cx - 6, cy + 21], shade, true);
	else forearm(v.px, ELBOW_R, [cx + 9, cy + 21], shade);
	return v.px;
}

// ---------- Joelle ----------

/** Joelle's eyes in the scene, the body sprite's anchor. */
export const EYES = (() => {
	const v = view();
	const [x, y] = v.project([SET.jx, EYE_HEIGHT, 60]);
	return [Math.round(x), Math.round(y)] as [number, number];
})();
const NECK_X = BODY.neckX - 4 * TURN;
const ME_ANCHOR: [number, number] = [Math.round(NECK_X), BODY.top + 31];
const FACE_AT = { x: Math.round(NECK_X - HEAD.cx), y: BODY.top };
/** A body-canvas point (rows counted from the top of the head) in scene pixels. */
const fromBody = ([x, y]: Pt): Pt => [EYES[0] - ME_ANCHOR[0] + x, EYES[1] - 31 + y];
/** Where Joelle's mouth and right elbow (the viewer's right) are in the scene. */
const MOUTH = fromBody([FACE_AT.x + Math.round(HEAD.cx - 8.2 * TURN), 42]);
const ELBOW_R = fromBody([Math.round(NECK_X + 31), 107]);

type SipStage = 'reach' | 'grab' | 'lift' | 'mouth';
/** Where Joelle's hand is while petting Myles: lifting toward him, above his head, on it, or behind it. */
type PetStage = 'lift' | 'over' | 'head' | 'top' | 'back';

/** One frame of Joelle, shared by the body (`me`), the forearms (`me-arms`) and the coffee. */
interface MePose {
	/** How far each upper arm dips while typing (viewer's left, viewer's right). */
	dip?: [number, number];
	/** Where Joelle looks; down at the screen unless set. */
	gaze?: Gaze;
	/** The head's turn when Joelle looks away from the screen. */
	turn?: number;
	raise?: 0 | 1 | 2 | 3;
	/** Where the cup is during a sip, and whether this sip has been drunk yet. */
	sip?: SipStage;
	sipped?: boolean;
	pet?: PetStage;
}

/**
 * Joelle's tags, frame by frame. The typing loop keys once every 220 ms, alternating hands. Petting
 * fires `pet-start` as the hand lands on Myles's head and `pet-end` as it lifts off; each stroke
 * runs forehead, crown, the back of his neck and up again. The sip's events fire as the straw
 * reaches Joelle's lips and as the cup touches the desk.
 */
const ME_SPEC: [string, [number, MePose][], TagDef['events']?][] = [
	[
		'type',
		[
			[110, {}],
			[110, { dip: [1, 0] }],
			[110, {}],
			[110, { dip: [0, 1] }]
		],
		{ 1: 'type', 3: 'type' }
	],
	[
		'pet-reach',
		[
			[120, { pet: 'lift', turn: 0.32, gaze: 'right' }],
			[120, { pet: 'over', turn: 0.2, gaze: 'right' }],
			[160, { pet: 'head', turn: 0.2, gaze: 'right' }]
		],
		{ 2: 'pet-start' }
	],
	[
		'pet-stroke',
		[
			[300, { pet: 'head', turn: 0.2, gaze: 'right' }],
			[300, { pet: 'top', turn: 0.2, gaze: 'right' }],
			[300, { pet: 'back', turn: 0.2, gaze: 'right' }],
			[300, { pet: 'top', turn: 0.2, gaze: 'right' }]
		]
	],
	[
		'pet-return',
		[
			[120, { pet: 'over', turn: 0.2, gaze: 'right' }],
			[120, { pet: 'lift', turn: 0.32, gaze: 'right' }]
		],
		{ 0: 'pet-end' }
	],
	[
		'sip',
		[
			[120, { sip: 'reach' }],
			[160, { sip: 'grab' }],
			[130, { sip: 'lift' }],
			[500, { sip: 'mouth', gaze: 'closed' }],
			[700, { sip: 'mouth', gaze: 'closed', sipped: true }],
			[130, { sip: 'lift', sipped: true }],
			[160, { sip: 'grab', sipped: true }],
			[120, { sipped: true }]
		],
		{ 3: 'sip', 6: 'cup-down' }
	],
	[
		'stretch',
		[
			[150, { raise: 1, gaze: 'ahead' }],
			[220, { raise: 2, gaze: 'closed' }],
			[900, { raise: 3, gaze: 'closed' }],
			[200, { raise: 2, gaze: 'closed' }],
			[150, { raise: 1, gaze: 'ahead' }]
		]
	],
	[
		'glance',
		[
			[120, { turn: 0.6, gaze: 'left' }],
			[1600, { turn: 0.78, gaze: 'left' }],
			[120, { turn: 0.6, gaze: 'left' }]
		]
	]
];

const ME_FRAMES = (() => {
	const poses: MePose[] = [];
	const durations: number[] = [];
	const tags: TagDef[] = [];
	for (const [name, frames, events] of ME_SPEC) {
		const from = poses.length;
		for (const [ms, pose] of frames) {
			poses.push(pose);
			durations.push(ms);
		}
		tags.push({ name, from, to: poses.length - 1, ...(events ? { events } : {}) });
	}
	return { poses, durations, tags };
})();

const bodyFor = (pose: MePose) =>
	joelle({
		turn: TURN,
		head: { turn: pose.turn, gaze: pose.gaze ?? 'down' },
		dip: pose.dip,
		raise: pose.raise
	});

const NO_SLICE = { x: 0, y: 0, w: 0, h: 0 };

export const me: SpriteDef = (() => {
	const first = bodyFor({});
	return {
		name: 'me',
		width: first.w,
		height: first.h,
		anchor: ME_ANCHOR,
		tags: ME_FRAMES.tags,
		frames: ME_FRAMES.poses.map((pose, i) => ({
			duration: ME_FRAMES.durations[i],
			draw: (q) => q.blit(bodyFor(pose), 0, 0)
		})),
		slices: {
			// Blinks and the screen's glint fit the head only while it faces the screen.
			face: ME_FRAMES.poses.map((pose) =>
				pose.turn === undefined
					? { x: FACE_AT.x, y: FACE_AT.y - (pose.raise === 3 ? 1 : 0), w: HEAD.w, h: HEAD.h }
					: NO_SLICE
			)
		}
	};
})();

/** Joelle's hand on Myles's head, drawn in front of him. */
function handCanvas(pose: MePose): Canvas {
	const v = view();
	if (pose.pet && pose.pet !== 'lift' && pose.pet !== 'back') pettingHand(v.px, PET[pose.pet]);
	return v.px;
}

/** A sprite that follows `me` frame for frame, cropped to the box all its frames fit in. */
function followsMe(name: string, draw: (pose: MePose) => Canvas): Placed {
	const worlds = ME_FRAMES.poses.map(draw);
	const boxes = worlds.flatMap((w) => w.bounds() ?? []);
	const x0 = Math.min(...boxes.map((b) => b.x));
	const y0 = Math.min(...boxes.map((b) => b.y));
	const w = Math.max(...boxes.map((b) => b.x + b.w)) - x0;
	const h = Math.max(...boxes.map((b) => b.y + b.h)) - y0;
	return {
		def: {
			name,
			width: w,
			height: h,
			anchor: [0, 0],
			tags: ME_FRAMES.tags.map(({ name, from, to }) => ({ name, from, to })),
			frames: worlds.map((world, i) => ({
				duration: ME_FRAMES.durations[i],
				draw: (q) => q.blit(world.crop(x0, y0, w, h), 0, 0)
			}))
		},
		at: [x0, y0]
	};
}

/** Eye centres in head-canvas pixels for the three-quarter turn (matches head()). */
function eyeCentres(): [number, number][] {
	const ex = HEAD.cx - 7 * TURN;
	const dL = EYE_SPREAD * (1 - 0.32 * TURN);
	return [
		[Math.round(ex - dL), 31],
		[Math.round(ex + EYE_SPREAD), 31]
	];
}

type FaceKind = 'blink-half' | 'blink' | 'glint' | 'none';

function faceFrame(kind: FaceKind) {
	return (out: Pixels) => {
		const q = new Canvas(HEAD.w, HEAD.h);
		drawFace(q, kind);
		out.blit(q, 0, 0);
	};
}

function drawFace(q: Canvas, kind: FaceKind): void {
	if (kind === 'none') return;
	if (kind === 'glint') {
		const lit = head({ turn: TURN, glint: true });
		const plain = head({ turn: TURN });
		for (let y = 0; y < lit.h; y++)
			for (let x = 0; x < lit.w; x++)
				if (lit.get(x, y) !== plain.get(x, y)) q.set(x, y, lit.get(x, y));
		return;
	}
	for (const [x, y] of eyeCentres()) {
		q.rect(x - 2, y - 2, 5, 4, 'skin.b');
		if (kind === 'blink-half')
			q.hline(x - 1, x + 1, y - 1, 'eyeDark.b').hline(x - 2, x + 2, y, 'eyeDark.b');
		else q.hline(x - 2, x + 2, y, 'eyeDark.b').set(x - 2, y - 1, 'skin.b');
	}
}

export const meFace: SpriteDef = {
	name: 'me-face',
	width: HEAD.w,
	height: HEAD.h,
	anchor: [0, 0],
	tags: [
		{ name: 'blink', from: 0, to: 2 },
		{ name: 'glint', from: 3, to: 3 },
		{ name: 'none', from: 4, to: 4 }
	],
	frames: [
		{ duration: 50, draw: faceFrame('blink-half') },
		{ duration: 90, draw: faceFrame('blink') },
		{ duration: 50, draw: faceFrame('blink-half') },
		{ duration: 1000, draw: faceFrame('glint') },
		{ duration: 1000, draw: faceFrame('none') }
	]
};

// ---------- the cats ----------

/** Where Myles's anchor sits on his sprite: between his front paws. */
const MYLES_ANCHOR: Pt = [16, 68];

/**
 * His tags, frame by frame: breathing, a tail swish, a slow blink, an ear turned out, a look
 * toward either side, and leaning into Joelle's hand with his eyes closed while being petted.
 */
const MYLES_SPEC: [string, [number, MylesPose][]][] = [
	[
		'idle',
		[
			[1400, {}],
			[1400, { breath: true }]
		]
	],
	[
		'swish',
		[
			[140, { tail: 2 }],
			[140, { tail: 5 }],
			[200, { tail: 8 }],
			[140, { tail: 5 }],
			[140, { tail: 2 }]
		]
	],
	[
		'blink',
		[
			[160, { eyes: 'half' }],
			[700, { eyes: 'shut' }],
			[160, { eyes: 'half' }]
		]
	],
	[
		'ear',
		[
			[100, { ear: true }],
			[900, { ear: true }],
			[100, {}]
		]
	],
	[
		'look-left',
		[
			[140, { look: -1 }],
			[1600, { look: -1, turn: true }],
			[140, { look: -1 }]
		]
	],
	[
		'look-right',
		[
			[140, { look: 1 }],
			[1600, { look: 1, turn: true }],
			[140, { look: 1 }]
		]
	],
	[
		'pet',
		[
			[450, { lean: true, eyes: 'happy' }],
			[450, { lean: true, eyes: 'happy', breath: true }]
		]
	]
];

export const mylesSprite: SpriteDef = (() => {
	const poses: MylesPose[] = [];
	const durations: number[] = [];
	const tags: TagDef[] = [];
	for (const [name, frames] of MYLES_SPEC) {
		const from = poses.length;
		for (const [ms, pose] of frames) {
			poses.push(pose);
			durations.push(ms);
		}
		tags.push({ name, from, to: poses.length - 1 });
	}
	const first = myles();
	return {
		name: 'myles',
		width: first.w,
		height: first.h,
		anchor: MYLES_ANCHOR,
		tags,
		frames: poses.map((pose, i) => ({
			duration: durations[i],
			draw: (q) => q.blit(myles(pose), 0, 0)
		})),
		slices: { hit: { x: 0, y: 0, w: first.w, h: 69 }, hearts: { x: 15, y: 0, w: 1, h: 1 } }
	};
})();

/**
 * Margot's tags, frame by frame: breathing while she sleeps, dream twitches of an ear or a paw,
 * lifting her head for a sleepy blink, and a full stretch along the sill. `margot-wake` fires
 * as her ear flicks when she is clicked, `margot-stretch` as the stretch begins.
 */
const MARGOT_SPEC: [string, [number, MargotPose][], TagDef['events']?][] = [
	[
		'sleep',
		[
			[1600, {}],
			[1600, { breath: true }]
		]
	],
	[
		'ear',
		[
			[90, { flick: true }],
			[120, {}],
			[90, { flick: true }]
		]
	],
	[
		'paw',
		[
			[160, { paw: true }],
			[200, { paw: true, breath: true }],
			[160, {}]
		]
	],
	[
		'wake',
		[
			[200, { lift: 3 }],
			[600, { lift: 6, eyes: 'sleepy' }],
			[260, { lift: 6 }],
			[700, { lift: 6, eyes: 'sleepy' }],
			[240, { lift: 3 }],
			[240, {}]
		]
	],
	[
		'stretch',
		[
			[220, { lift: 6, eyes: 'sleepy' }],
			[220, { shape: 'stand', eyes: 'sleepy' }],
			[260, { shape: 'bow', eyes: 'sleepy' }],
			[900, { shape: 'bow' }],
			[260, { shape: 'stand', eyes: 'sleepy' }],
			[240, { lift: 6, eyes: 'sleepy' }],
			[300, {}]
		],
		{ 0: 'margot-stretch' }
	]
];

export const margotSprite: SpriteDef = (() => {
	const poses: MargotPose[] = [];
	const durations: number[] = [];
	const tags: TagDef[] = [];
	for (const [name, frames, events] of MARGOT_SPEC) {
		const from = poses.length;
		for (const [ms, pose] of frames) {
			poses.push(pose);
			durations.push(ms);
		}
		tags.push({ name, from, to: poses.length - 1, ...(events ? { events } : {}) });
	}
	// A click flicks her ear with the same frames as the dream twitch, and a sound.
	const ear = tags.find((t) => t.name === 'ear')!;
	tags.push({ name: 'ear-react', from: ear.from, to: ear.to, events: { 0: 'margot-wake' } });
	return {
		name: 'margot',
		width: MARGOT.w,
		height: MARGOT.h,
		// The same point on the sill as before she could stretch: her curled body's middle.
		anchor: [31, MARGOT.sill - 1],
		tags,
		frames: poses.map((pose, i) => ({
			duration: durations[i],
			draw: (q) => q.blit(margot(pose), 0, 0)
		})),
		slices: {
			hit: { x: 4, y: 12, w: 56, h: MARGOT.sill + 1 - 12 },
			zzz: { x: 10, y: 12, w: 1, h: 1 }
		}
	};
})();

// ---------- desk props ----------

export const radioSprite: SpriteDef = {
	name: 'radio',
	width: 50,
	height: 36,
	anchor: [20, 35],
	tags: [
		{ name: 'off', from: 0, to: 0 },
		{ name: 'on', from: 1, to: 1 }
	],
	frames: [
		{ duration: 1000, draw: (q) => q.blit(radio(false), 0, 0) },
		{ duration: 1000, draw: (q) => q.blit(radio(true), 0, 0) }
	]
};

/** Scene points (projected) for the free-standing desk props and Myles. */
export const PROPS = (() => {
	const v = view();
	const p = (pt: V3) => {
		const [x, y] = v.project(pt);
		return [Math.round(x), Math.round(y)] as [number, number];
	};
	return {
		// The radio stands on the left of the desk, clear of the laptop; on phones, where only the
		// middle of the desk is in view, it stands at the laptop's front corner.
		radio: p(R([-44, 74, 116])),
		radioPhone: p([-24, 74, 124]),
		// Beside the laptop, in reach of Joelle's right hand (the viewer's right).
		coffee: p(R([30, 74, 124])),
		// On the desk's back right corner.
		lamp: p(R([52, 74, 82])),
		myles: p([28, 74, 115])
	};
})();

/** Joelle's wrist at each stage of petting, placed from the top-left of Myles's sprite. */
const PET: Record<PetStage, Pt> = (() => {
	const mx = PROPS.myles[0] - MYLES_ANCHOR[0];
	const my = PROPS.myles[1] - MYLES_ANCHOR[1];
	return {
		lift: [mx - 6, my + 22],
		over: [mx + 4, my - 2],
		head: [mx + 6, my + 6],
		top: [mx + 9, my + 3],
		back: [mx + 20, my + 8]
	};
})();

/** Where the cup's top-left corner is at each stage of a sip: on the desk, halfway, at Joelle's lips. */
const CUP: Record<SipStage, Pt> = (() => {
	const desk: Pt = [PROPS.coffee[0] - 10, PROPS.coffee[1] - 39];
	return {
		reach: desk,
		grab: desk,
		lift: [desk[0] - 9, desk[1] - 36],
		mouth: [MOUTH[0] - 11, MOUTH[1] - 1]
	};
})();

/** The coffee sprite's box in the scene: the cup on the desk and everywhere a sip takes it. */
const COFFEE_BOX = (() => {
	const xs = Object.values(CUP).map(([x]) => x);
	const ys = Object.values(CUP).map(([, y]) => y);
	const x = Math.min(...xs) - 1;
	const y = Math.min(...ys) - 1;
	return { x, y, w: Math.max(...xs) + 21 - x, h: Math.max(...ys) + 41 - y };
})();

/** The cup at a level, on the desk or (during a sip) wherever Joelle's hand has it. */
function cupFrame(level: number, stage?: SipStage): (q: Pixels) => void {
	return (q) => {
		const c = new Canvas(COFFEE_BOX.w, COFFEE_BOX.h);
		const [x, y] = CUP[stage ?? 'grab'];
		const ox = x - COFFEE_BOX.x;
		const oy = y - COFFEE_BOX.y;
		c.blit(coffee(level), ox, oy);
		if (stage && stage !== 'reach') grip(c, ox, oy);
		q.blit(c, 0, 0);
	};
}

/**
 * The iced coffee: `level5` to `level0` on the desk, and `sip5` to `sip0`, which carry the cup
 * frame for frame with Joelle's `sip` tag (the level drops while the straw is at Joelle's lips).
 */
export const coffeeSprite: SpriteDef = (() => {
	const levels = [5, 4, 3, 2, 1, 0];
	const sip = ME_FRAMES.tags.find((t) => t.name === 'sip')!;
	const sipPoses = ME_FRAMES.poses.slice(sip.from, sip.to + 1);
	const sipDurations = ME_FRAMES.durations.slice(sip.from, sip.to + 1);
	const frames: SpriteDef['frames'] = levels.map((level) => ({
		duration: 1000,
		draw: cupFrame(level)
	}));
	const tags: TagDef[] = levels.map((level, i) => ({ name: `level${level}`, from: i, to: i }));
	for (const level of levels) {
		const from = frames.length;
		sipPoses.forEach((pose, i) =>
			frames.push({
				duration: sipDurations[i],
				draw: cupFrame(pose.sipped ? Math.max(0, level - 1) : level, pose.sip)
			})
		);
		tags.push({ name: `sip${level}`, from, to: frames.length - 1 });
	}
	const [dx, dy] = CUP.grab;
	return {
		name: 'coffee',
		width: COFFEE_BOX.w,
		height: COFFEE_BOX.h,
		anchor: [PROPS.coffee[0] - COFFEE_BOX.x, PROPS.coffee[1] - COFFEE_BOX.y],
		tags,
		frames,
		slices: { hit: { x: dx - COFFEE_BOX.x + 1, y: dy - COFFEE_BOX.y, w: 18, h: 40 } }
	};
})();

export const lampSprite: SpriteDef = {
	name: 'lamp',
	width: 52,
	height: 80,
	anchor: [38, 76],
	tags: [
		{ name: 'off', from: 0, to: 0 },
		{ name: 'on', from: 1, to: 1 }
	],
	frames: [
		{ duration: 1000, draw: (q) => q.blit(lamp(false, -1), 0, 0) },
		{ duration: 1000, draw: (q) => q.blit(lamp(true, -1), 0, 0) }
	]
};

// ---------- wall objects ----------

export const WINDOW = { w: 78, h: 96 };

export const windowSprite: SpriteDef = (() => {
	const p = new Canvas(WINDOW.w + 18, WINDOW.h + 20);
	windowFrame(p, 9, 5, WINDOW.w, WINDOW.h);
	return still('window', p, [9, 5]);
})();

export const SIGN = { w: 178, h: 60 };

export const signSprite: SpriteDef = {
	name: 'sign',
	width: SIGN.w,
	height: SIGN.h + 10,
	anchor: [0, 10],
	tags: [
		{ name: 'unlit', from: 0, to: 0 },
		{ name: 'lit', from: 1, to: 1 }
	],
	frames: [false, true].map((lit) => ({
		duration: 1000,
		draw: (q: Pixels) => {
			const c = new Canvas(SIGN.w, SIGN.h + 10);
			sign(c, 0, 10, SIGN.w, SIGN.h, lit);
			q.blit(c, 0, 0);
		}
	}))
};

export const CORK = { w: 108, h: 66 };
/** Paper notes on the corkboard, relative to its top-left; the link text is HTML laid over them. */
export const NOTES = [
	{ x: 7, y: 7, w: 86, h: 12 },
	{ x: 13, y: 21, w: 70, h: 12 },
	{ x: 7, y: 35, w: 42, h: 12 },
	{ x: 52, y: 35, w: 48, h: 12 }
];

export const corkSprite: SpriteDef = (() => {
	const p = new Canvas(CORK.w + 6, CORK.h + 6);
	const ox = 2;
	const oy = 3;
	corkboard(p, ox, oy, CORK.w, CORK.h);
	const papers = ['paper', 'catWhite', 'paper', 'catWhite'];
	NOTES.forEach((n, i) => note(p, ox + n.x, oy + n.y, n.w, n.h, papers[i], i));
	stringLights(p, ox - 2, ox + CORK.w + 2, oy - 1, 5, 7);
	return still('corkboard', p, [ox, oy]);
})();

/** The CV's note, alone at the bottom: its own sprite, drawn only while the CV has content. */
export const CV_NOTE = { x: 36, y: 49, w: 30, h: 12 };

export const cvNoteSprite: SpriteDef = (() => {
	const p = new Canvas(CV_NOTE.w + 1, CV_NOTE.h + 3);
	note(p, 0, 2, CV_NOTE.w, CV_NOTE.h, 'paper', 0);
	return still('note-cv', p, [0, 2]);
})();

export const CLOCK = { d: 40 };
export const clockSprite: SpriteDef = (() => {
	const p = new Canvas(CLOCK.d + 2, CLOCK.d + 2);
	clock(p, 0, 0, CLOCK.d);
	return still('clock', p);
})();

export const SWATCH = { w: 16, h: 34 };
export const swatchSprite: SpriteDef = (() => {
	const p = new Canvas(SWATCH.w + 2, SWATCH.h + 4);
	swatchCard(p, 1, 3, SWATCH.w, SWATCH.h);
	return still('swatch', p, [1, 3]);
})();

export const bookcaseSprite: SpriteDef = (() => {
	const p = new Canvas(96, 300);
	bookshelf(p, 0, 0, 96, 300);
	return still('bookcase', p);
})();

export const plantSprite: SpriteDef = still('plant', plant(), [24, 57]);

// ---------- placed, cropped sprites ----------

export const placed = {
	chair: cropped('chair', chairCanvas()),
	'me-legs': cropped('me-legs', legsCanvas()),
	desk: cropped('desk', deskCanvas()),
	'me-arms': followsMe('me-arms', armsCanvas),
	'me-hand': followsMe('me-hand', handCanvas),
	laptop: cropped('laptop', laptopCanvas()),
	...(Object.fromEntries(
		(Object.keys(STICKERS) as (keyof typeof STICKERS)[]).map((name) => {
			const c = cropped(name, stickerCanvas(name));
			// Only the stickers that link somewhere are clickable; the rest are plain art.
			const def = c.def;
			if (LINKED.has(name)) def.slices = { hit: { x: 0, y: 0, w: def.width, h: def.height } };
			return [name, c];
		})
	) as Record<keyof typeof STICKERS, Placed>)
};

export const studySprites: SpriteDef[] = [
	room,
	windowSprite,
	bookcaseSprite,
	plantSprite,
	signSprite,
	corkSprite,
	cvNoteSprite,
	clockSprite,
	swatchSprite,
	margotSprite,
	...Object.values(placed).map((p) => p.def),
	me,
	meFace,
	radioSprite,
	coffeeSprite,
	lampSprite,
	mylesSprite
];
