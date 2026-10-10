// Drawing routines for the study scene (option B of the B1b sketches): Joelle at medium-shot
// scale, the cats, desk props and wall objects. Each returns a canvas or draws into one; the
// sprite definitions that place them are in study.ts.
import { Canvas, limb } from '../lib/canvas.ts';
import type { Pt } from '../lib/sheet.ts';
// Joelle's head at medium-shot scale, drawn from shapes so one routine covers front and
// three-quarter views. turn > 0 turns the face toward the viewer's left. The side part stays
// on the same side of the head whichever way it turns.

export const HEAD = { w: 54, h: 62, cx: 27 };
/** Half the face's width across the cheeks, and the distance from the face's centre to each eye. */
export const FACE_HW = 15;
export const EYE_SPREAD = 8;

/** Where Joelle looks: ahead, down at the screen, toward the window or Myles, or eyes closed. */
export type Gaze = 'ahead' | 'down' | 'left' | 'right' | 'closed';

export interface HeadOptions {
	turn?: number;
	glint?: boolean;
	/** Drop the neck (for looking back over a shoulder). */
	neck?: boolean;
	gaze?: Gaze;
}

export function head({
	turn = 0,
	glint = false,
	neck = true,
	gaze = 'ahead'
}: HeadOptions = {}): Canvas {
	const W = HEAD.w;
	const H = HEAD.h;
	const t = turn;
	const tl = Math.max(t, 0);
	const tr = Math.max(-t, 0);
	const cx = HEAD.cx;
	const fx = cx - 3 * t; // face centre
	const ex = cx - 7 * t; // features centre
	const p = new Canvas(W, H);

	// --- hair behind everything: dome, back panel, side curtains ---
	const hair = new Canvas(W, H);
	hair.ellipse(cx - 22 + Math.round(2 * t), 1, 44, 44, 'hair.b');
	hair.rect(cx - 15, 36, 30, 17, 'hair.b');
	const curtain = (side: -1 | 1) => {
		const grow = side === 1 ? 1 + 0.45 * tl - 0.2 * tr : 1 + 0.45 * tr - 0.2 * tl;
		const outer = cx + side * 22 * Math.min(grow, 1.12);
		const inner = cx + side * 11;
		hair.poly(
			[
				[outer, 22],
				[outer + side * 1.5, 44],
				[outer + side * 0.5, 52],
				[inner + side * (2 + 4 * (grow - 1)), 53],
				[inner, 34]
			],
			'hair.b'
		);
	};
	curtain(-1);
	curtain(1);
	// Ends of the hair resting on the tops of the shoulders: a slight flick.
	hair.remap((ink, x, y) => (ink && y >= 51 && (x + y) % 3 === 0 ? null : undefined));
	hair.outline('hair.d2');
	p.blit(hair, 0, 0);

	// --- neck ---
	if (neck) {
		p.rect(Math.round(fx - 6), 44, 12, 18, 'skin.b');
		p.rect(Math.round(fx + 2), 44, 4, 18, 'skin.d');
		p.hline(Math.round(fx - 5), Math.round(fx + 4), 49, 'skin.d');
	}

	// --- face ---
	const face = new Canvas(W, H);
	const top = 12;
	const chin = 48;
	const hw = (y: number) => {
		if (y < 20) return 11.5 + ((y - top) / 8) * 3.2;
		if (y < 33) return FACE_HW;
		const k = (y - 33) / (chin - 33 + 1);
		return Math.max(5, FACE_HW * Math.sqrt(Math.max(0, 1 - k * k * k)));
	};
	for (let y = top; y <= chin; y++) {
		const w = hw(y);
		const l = fx - w * (1 - 0.24 * tl + 0.06 * tr);
		const r = fx + w * (1 + 0.06 * tl - 0.24 * tr);
		for (let x = Math.ceil(l); x <= Math.floor(r); x++) {
			const shade = x > fx + w * 0.78 - 5 * t || y > chin - 1 ? 'skin.d' : 'skin.b';
			face.set(x, y, shade);
		}
	}
	// Soft highlights: forehead and the lit cheek.
	face.remap((ink, x, y) => {
		if (ink !== 'skin.b') return undefined;
		const lx = ex - 9;
		if ((y === 35 && x >= lx - 1 && x <= lx) || (y >= 14 && y <= 15 && x <= fx - 3))
			return 'skin.l';
		return undefined;
	});
	// Jaw line where the face meets the neck.
	face.remap((ink, x, y) =>
		ink && !face.get(x, y + 1) && y > 40 && Math.abs(x - fx) > 3 ? 'skin.d' : undefined
	);
	p.blit(face, 0, 0);

	// --- fringe and part: hair over the forehead, swept from a side part toward the viewer's right ---
	const part = cx - 7 - 2 * t;
	const fringe = new Canvas(W, H);
	const edge = (x: number) => {
		// Lower edge of the fringe: high at the part, sweeping down to the right temple.
		if (x < part) return top + 1 + Math.max(0, (part - x) * 0.25);
		const k = (x - part) / (fx + 16 - part);
		return top + 1 + Math.pow(Math.min(1, k), 1.5) * 12;
	};
	for (let x = 0; x < W; x++) {
		const e = edge(x);
		for (let y = 2; y < e; y++) if (face.get(x, y)) fringe.set(x, y, 'hair.b');
	}
	// Side curtains in front of the face edges.
	for (let y = top; y < 46; y++) {
		const w = hw(y);
		const l = fx - w * (1 - 0.24 * tl + 0.06 * tr);
		const r = fx + w * (1 + 0.06 * tl - 0.24 * tr);
		const coverL = y < 30 ? 2.5 : 1.5 + (y - 30) * 0.12;
		const coverR = (y < 30 ? 2.5 : 1.5 + (y - 30) * 0.12) + 1.5 * tl;
		for (let x = Math.floor(l) - 1; x < l + coverL; x++) fringe.set(x, y, 'hair.b');
		for (let x = Math.ceil(r - coverR); x <= r + 1; x++) fringe.set(x, y, 'hair.b');
	}
	p.blit(fringe, 0, 0);
	// Shadow cast by the fringe on the forehead.
	for (let x = 0; x < W; x++) {
		const y = Math.ceil(edge(x));
		if (p.get(x, y)?.startsWith('skin')) p.set(x, y, 'skin.d');
	}
	// Part line and sheen.
	p.line(part, 2, part + 1, top, 'hair.d2');
	p.set(part, 3, 'skin.d').set(part, 4, 'skin.d');
	for (let i = 0; i < 9; i++) p.set(part - 3 - i, 4 + Math.round(i * 0.55), 'hair.l');
	for (let i = 0; i < 12; i++)
		p.set(part + 3 + i, 4 + Math.round(i * 0.5), i % 4 === 3 ? 'hair.b' : 'hair.l');
	for (let i = 0; i < 7; i++) p.set(part + 8 + i, 9 + Math.round(i * 0.75), 'hair.l');
	// Strands in the curtains.
	p.line(cx - 19, 26, cx - 18, 49, 'hair.l').line(
		cx + 18 + 3 * tl,
		28,
		cx + 19 + 3 * tl,
		50,
		'hair.d2'
	);

	// --- features ---
	const dL = EYE_SPREAD * (1 - 0.32 * tl);
	const dR = EYE_SPREAD * (1 - 0.32 * tr);
	const eyeL = Math.round(ex - dL);
	const eyeR = Math.round(ex + dR);
	const eyeY = 31;
	// Brows.
	p.hline(eyeL - 3, eyeL + 1, 22, 'hair.l').set(eyeL - 4, 23, 'hair.l');
	p.hline(eyeR - 1, eyeR + 3, 22, 'hair.l').set(eyeR + 4, 23, 'hair.l');
	// Eyes: dark iris, a highlight, a lash line, and a smiling lower lid.
	for (const x of [eyeL, eyeR]) eye(p, x, eyeY, gaze);
	// Round glasses: clear pink-brown frames, a glint on each lens.
	const lens = (x: number, rx: number) => {
		const ring = new Canvas(W, H);
		const w = Math.round(rx * 2 + 1);
		const ox = Math.round(x - rx);
		ring.ellipse(ox, eyeY - 7, w, 13, 'glasses.b');
		ring.ellipse(ox + 1, eyeY - 6, w - 2, 11, null);
		ring.remap((ink, xx, yy) =>
			ink && (yy > eyeY + 2 || xx > x + rx - 1.5) ? 'glasses.d' : undefined
		);
		p.blit(ring, 0, 0);
		p.set(Math.round(x - rx + 2), eyeY - 4, glint ? 'screen.l' : 'catWhite.l');
		p.set(Math.round(x - rx + 3), eyeY - 5, glint ? 'screen.l' : 'catWhite.l');
		if (glint) p.hline(Math.round(x - 1), Math.round(x + 1), eyeY - 4, 'screen.b');
	};
	const rL = 6 * (1 - 0.22 * tl);
	const rR = 6 * (1 - 0.22 * tr);
	lens(ex - dL, rL);
	lens(ex + dR, rR);
	p.hline(Math.round(ex - dL + rL), Math.round(ex + dR - rR), eyeY - 2, 'glasses.b');
	const faceL = Math.round(fx - FACE_HW * (1 - 0.24 * tl + 0.06 * tr));
	const faceR = Math.round(fx + FACE_HW * (1 + 0.06 * tl - 0.24 * tr));
	p.hline(faceL, Math.round(ex - dL - rL), eyeY - 2, 'glasses.d');
	p.hline(Math.round(ex + dR + rR), faceR, eyeY - 2, 'glasses.d');
	// Nose: a lit bridge and a soft shadow under and beside the tip.
	const nx = Math.round(ex - 1.5 * t);
	p.set(nx - 1, 34, 'skin.l').set(nx - 1, 35, 'skin.l');
	p.set(nx + 1, 36, 'skin.d')
		.set(nx + 1, 37, 'skin.d')
		.set(nx, 38, 'skin.d')
		.set(nx - 1, 38, 'skin.d');
	// Blush.
	p.hline(eyeL - 3, eyeL, 37, 'blush.b').hline(eyeL - 2, eyeL + 1, 38, 'blush.b');
	p.hline(eyeR, eyeR + 3, 37, 'blush.b').hline(eyeR - 1, eyeR + 2, 38, 'blush.b');
	// Closed-mouth smile: a soft curve with lifted corners and a shaded lower lip.
	const mx = Math.round(ex - 1.2 * t);
	p.set(mx - 5, 41, 'lips.d').set(mx + 5, 41, 'lips.d');
	p.hline(mx - 4, mx + 4, 42, 'lips.b');
	p.set(mx - 4, 42, 'lips.d').set(mx + 4, 42, 'lips.d');
	p.hline(mx - 2, mx + 2, 43, 'skin.d');
	return p;
}

/** One eye, centred on x, y. Looking down lowers the lid; looking left moves the iris. */
export function eye(p: Canvas, x: number, y: number, gaze: Gaze): void {
	if (gaze === 'closed') {
		p.set(x - 2, y, 'eyeDark.b')
			.hline(x - 1, x + 1, y - 1, 'eyeDark.b')
			.set(x + 2, y, 'eyeDark.b');
		return;
	}
	if (gaze === 'down') {
		p.hline(x - 1, x + 1, y - 1, 'eyeDark.b');
		p.rect(x - 1, y, 3, 2, 'eyeMid.b');
		p.set(x - 2, y, 'eyeDark.b').set(x + 2, y, 'eyeDark.b');
		p.set(x, y + 1, 'hair.b');
		return;
	}
	const ix = gaze === 'left' ? x - 1 : gaze === 'right' ? x + 1 : x;
	p.hline(x - 1, x + 1, y - 2, 'eyeDark.b');
	p.rect(ix - 1, y - 1, 3, 3, 'eyeMid.b');
	p.set(x - 2, y - 1, 'eyeDark.b').set(x + 2, y - 1, 'eyeDark.b');
	p.set(ix - 1, y - 1, 'eyeShine.b');
	p.set(ix, y + 1, 'hair.b');
}

// Joelle (waist up, typing), Myles and Margot at medium-shot scale.

/** The body canvas: `top` rows of headroom above the head for the stretch. */
export const BODY = { w: 116, h: 128, top: 34, neckX: 58 };

export interface JoelleOptions {
	/** 0 faces the viewer; > 0 turns Joelle toward the viewer's left. */
	turn?: number;
	glint?: boolean;
	/** The head's own turn, gaze and lift, when they differ from the body's. */
	head?: { turn?: number; gaze?: Gaze; dy?: number };
	/** How far each upper arm dips (viewer's left, viewer's right): the bob while typing. */
	dip?: [number, number];
	/** Arms raised for the stretch: 0 resting, 1 lifting, 2 overhead, 3 overhead and reaching up. */
	raise?: 0 | 1 | 2 | 3;
}

/**
 * Joelle from the waist up in the black hoodie: head, torso and upper arms, drawn `BODY.top`
 * rows down the canvas so raised hands fit above the head.
 */
export function joelle({
	turn = 0,
	glint = false,
	head: look = {},
	dip = [0, 0],
	raise = 0
}: JoelleOptions = {}): Canvas {
	const W = BODY.w;
	const H = BODY.h;
	const T = BODY.top - (raise === 3 ? 1 : 0);
	const t = turn;
	const nx = BODY.neckX - 4 * t;
	const p = new Canvas(W, H + BODY.top);
	const farL = 1 - 0.3 * Math.max(t, 0);
	const farR = 1 - 0.3 * Math.max(-t, 0);
	const sl = nx - 40 * farL; // outer edge of each upper arm
	const sr = nx + 40 * farR;
	// Torso: sloping shoulders, slightly narrower at the waist.
	const torso = new Canvas(W, H);
	torso.poly(
		[
			[nx - 12, 55],
			[nx - 26 * farL, 60],
			[sl + 12, 66],
			[sl + 16, H],
			[sr - 16, H],
			[sr - 12, 66],
			[nx + 26 * farR, 60],
			[nx + 12, 55]
		],
		'hoodie.b'
	);
	torso.remap((ink, x, y) => (ink && x > nx + 14 * farR && y > 64 ? 'hoodie.d' : undefined));
	torso.outline('hair.d2');
	p.blit(torso, 0, T);
	// Upper arms hanging from rounded shoulders, a dark crease against the body.
	if (raise === 0)
		([-1, 1] as const).forEach((side, i) => {
			const arm = new Canvas(W, H);
			const edge = side < 0 ? sl : sr;
			limb(arm, [edge - side * 13, 70], [edge - side * 9, 112], 19, 17, 'hoodie.b');
			arm.ellipse(Math.round(side < 0 ? sl + 2 : sr - 24), 60, 22, 20, 'hoodie.b');
			arm.remap((ink, x, y) => {
				if (!ink) return undefined;
				if (x > nx) return x > sr - 10 || y > 100 ? 'hoodie.d2' : 'hoodie.d';
				if (x < sl + 8 && y > 60) return 'hoodie.l';
				if (y < 66 && x < sl + 16) return 'hoodie.l';
				return undefined;
			});
			arm.outline('hair.d2');
			p.blit(arm, 0, T + dip[i]);
		});
	// Head.
	p.blit(
		head({ turn: look.turn ?? t, glint, gaze: look.gaze }),
		Math.round(nx - HEAD.cx),
		T + (look.dy ?? 0)
	);
	// The hood, bunched around the back of the neck.
	const hood = new Canvas(W, H);
	hood.ellipse(Math.round(nx - 21), 47, 42, 17, 'hoodie.b');
	hood.ellipse(Math.round(nx - 12), 50, 24, 9, null);
	hood.remap((ink, x, y) => (ink && y < 52 && x > nx - 10 && x < nx + 10 ? null : undefined));
	hood.remap((ink, x, y) => (ink && y < 55 ? (x < nx ? 'hoodie.l' : 'hoodie.d') : undefined));
	hood.outline('hair.d2');
	for (let x = -11; x <= 11; x++) {
		const y = 57 + Math.round(Math.sqrt(Math.max(0, 121 - x * x)) * 0.45);
		hood.rect(Math.round(nx + x), y, 1, 2, 'hoodie.d');
	}
	// Drawstrings with metal tips.
	for (const [dx, len] of [
		[-6, 26],
		[6, 23]
	]) {
		const x0 = Math.round(nx + dx);
		hood.line(x0, 62, x0 + Math.sign(dx), 62 + len, 'catWhite.d');
		hood.rect(x0 + Math.sign(dx), 62 + len, 1, 3, 'metal.l');
	}
	// Folds.
	hood.line(nx - 20, 94, nx - 10, 100, 'hoodie.d').line(nx + 10, 98, nx + 20, 92, 'hoodie.d2');
	p.blit(hood, 0, T);
	if (raise !== 0) p.blit(raisedArms(nx, sl, sr, raise), 0, T - BODY.top);
	return p;
}

/** Both arms lifted for the stretch, in body-canvas rows (negative rows are above the head). */
function raisedArms(nx: number, sl: number, sr: number, raise: 1 | 2 | 3): Canvas {
	const pose: Record<1 | 2 | 3, { elbow: Pt; wrist: Pt }> = {
		1: { elbow: [-4, 56], wrist: [6, 30] },
		2: { elbow: [-1, 24], wrist: [nx - 9 - sl, -8] },
		3: { elbow: [1, 18], wrist: [nx - 3 - sl, -15] }
	};
	const { elbow, wrist } = pose[raise];
	const top = BODY.top;
	const out = new Canvas(BODY.w, BODY.h + top);
	const hands = new Canvas(BODY.w, BODY.h + top);
	const arms = new Canvas(BODY.w, BODY.h + top);
	for (const side of [-1, 1] as const) {
		const edge = side < 0 ? sl : sr;
		const at = ([dx, y]: Pt): Pt => [edge - side * dx, y + top];
		const a = new Canvas(BODY.w, BODY.h + top);
		a.ellipse(Math.round(side < 0 ? sl + 2 : sr - 24), 58 + top, 22, 20, 'hoodie.b');
		limb(a, at([11, 66]), at(elbow), 19, 16, 'hoodie.b');
		limb(a, at(elbow), at(wrist), 16, 12, 'hoodie.b');
		const [ex, ey] = at(elbow);
		const [wx, wy] = at(wrist);
		a.ellipse(Math.round(wx - 6), Math.round(wy - 4), 12, 9, 'hoodie.d');
		// The window lights the outer edge of the near arm; the far arm is in shade.
		a.remap((ink, x, y) =>
			!ink ? undefined : side > 0 ? 'hoodie.d' : !a.get(x - 2, y) ? 'hoodie.l' : undefined
		);
		a.outline('hair.d2');
		arms.blit(a, 0, 0);
		// The hand, just past the cuff along the forearm.
		const len = Math.hypot(wx - ex, wy - ey) || 1;
		const hx = wx + ((wx - ex) / len) * 6;
		const hy = wy + ((wy - ey) / len) * 6;
		hands.ellipse(Math.round(hx - 3.5), Math.round(hy - 3.5), 7, 7, 'skin.b');
	}
	hands.remap((ink, x) => (ink && x > nx + 2 ? 'skin.d' : undefined));
	hands.outline('skin.d');
	out.blit(hands, 0, 0);
	out.blit(arms, 0, 0);
	return out;
}

/**
 * Forearms and hands lying on the desk, drawn after the desk top. Elbows and wrists are in
 * scene pixels; hands are left out when the lid hides them.
 */
export function forearms(p: Canvas, elbows: [Pt, Pt], wrists: [Pt, Pt], hands = true): void {
	const shade = (elbows[0][0] + elbows[1][0]) / 2 + 20;
	elbows.forEach((e, i) => forearm(p, e, wrists[i], shade, hands));
}

/**
 * One hoodie sleeve from elbow to wrist, darker right of `shadeFrom`, with the cuff and the hand
 * past it unless they are drawn elsewhere.
 */
export function forearm(
	p: Canvas,
	elbow: Pt,
	wrist: Pt,
	shadeFrom = Infinity,
	hand = false,
	cuff = true
): void {
	const f = new Canvas(p.w, p.h);
	limb(f, elbow, wrist, 17, 13, 'hoodie.b');
	if (cuff) f.ellipse(Math.round(wrist[0] - 7), Math.round(wrist[1] - 5), 14, 10, 'hoodie.d');
	f.remap((ink, x) => (ink && x > shadeFrom ? 'hoodie.d' : undefined));
	f.outline('hair.d2');
	p.blit(f, 0, 0);
	if (!hand) return;
	const h = new Canvas(p.w, p.h);
	h.ellipse(Math.round(wrist[0] - 5), Math.round(wrist[1] - 1), 11, 7, 'skin.b');
	h.remap((ink, x, y) => (ink && (y > wrist[1] + 3 || x > wrist[0] + 3) ? 'skin.d' : undefined));
	h.outline('skin.d2');
	p.blit(h, 0, 0);
}

/** Joelle's hand resting palm down, fingers to the viewer's right, from the cuff at `wrist`. */
export function pettingHand(p: Canvas, wrist: Pt): void {
	const [x, y] = wrist.map(Math.round);
	const cuff = new Canvas(p.w, p.h);
	cuff.ellipse(x - 5, y - 3, 7, 7, 'hoodie.d');
	cuff.outline('hair.d2');
	const h = new Canvas(p.w, p.h);
	h.ellipse(x, y - 3, 12, 6, 'skin.b');
	h.remap((ink, xx, yy) => {
		if (!ink) return undefined;
		if (yy > y + 1) return 'skin.d';
		if (xx > x + 6 && (xx - x) % 2 === 1 && yy > y - 2) return 'skin.d';
		return undefined;
	});
	h.outline('skin.d');
	p.blit(h, 0, 0);
	p.blit(cuff, 0, 0);
}

/**
 * Joelle's hand around the iced coffee, from behind: fingertips over the cup's right edge and the
 * thumb over its left, drawn on the cup's canvas with the cup's top-left at x, y.
 */
export function grip(p: Canvas, x: number, y: number): void {
	const h = new Canvas(p.w, p.h);
	for (const fy of [18, 21, 24]) h.rect(x + 14, y + fy, 4, 2, 'skin.b');
	h.rect(x + 2, y + 19, 3, 4, 'skin.b');
	h.remap((ink, _x, yy) => (ink && (yy - y) % 3 === 1 && yy - y > 18 ? 'skin.d' : undefined));
	h.outline('skin.d');
	p.blit(h, 0, 0);
}

// ---------- Myles ----------

export const MYLES_FACE = [
	'....K....................K....',
	'....KK..................KK....',
	'....KIK................KIK....',
	'....KIIK..............KIIK....',
	'....KIIIK............KIIIK....',
	'....KMIIMK..........KMIIMK....',
	'...KMMMMMMKKKKKKKKKKMMMMMMK...',
	'...KMMMMMMXMLXXLMXMMMMMMMMK...',
	'..KMMMMMMMMXMLXXLMXMMMMMMMMK..',
	'..KMMMMMXMMMXMXXMXMMMXMMMMMK..',
	'..KMMMMXMMMMMMXXMMMMMMXMMMMK..',
	'.KMMMMXMMMMMMMMMMMMMMMMXMMMMK.',
	'.KMMMKKKKKMMMMMMMMMMKKKKKMMMK.',
	'.KMMKEEEEEKMMMMMMMMKEEEEEKMMK.',
	'.KMMKEEOOEKMMMMMMMMKEOOEEKMMK.',
	'.KMMKEgOOEKMMMMMMMMKEOOgEKMMK.',
	'.KXMMKKKKKMMMLLLLMMMKKKKKMMXK.',
	'.KMXMMMMMMMLLLLLLLLMMMMMMMXMK.',
	'.KXMXMMMMMLLLLPPLLLLMMMMMXMXK.',
	'..KMMMMMMLLLLLPPLLLLLMMMMMMK..',
	'..KMXMMMMLLLLKLLKLLLLMMMMXMK..',
	'...KMMMMMMLLLLKKLLLLMMMMMMK...',
	'....KMMMMMMLLLLLLLLMMMMMMK....',
	'.....KKMMMMMMMMMMMMMMMMKK.....',
	'.......KKKKMMMMMMMMKKKK.......'
];

export const MYLES_INKS = {
	K: 'stripe.d2',
	M: 'tabby.b',
	L: 'tabby.l',
	X: 'stripe.b',
	I: 'ear.b',
	E: 'eye.b',
	g: 'eye.l',
	O: 'eyeDark.b',
	P: 'catNose.b'
};

/** Myles's eyes, 7 × 5 per eye (grid columns 4–10 and 19–25, rows 12–16). `>` is the pupil. */
const MYLES_EYES: Record<MylesEyes, string[]> = {
	open: ['MKKKKKM', 'KEEEEEK', 'KEE>>EK', 'KEg>>EK', 'MKKKKKM'],
	half: ['MMMMMMM', 'MKKKKKM', 'KEE>>EK', 'KEg>>EK', 'MKKKKKM'],
	// Closed and relaxed for the slow blink.
	shut: ['MMMMMMM', 'MMMMMMM', 'KMMMMMK', 'MKKKKKM', 'MMMMMMM'],
	// Closed and content, curved up, while he is petted.
	happy: ['MMMMMMM', 'MMKKKMM', 'MKMMMKM', 'KMMMMMK', 'MMMMMMM']
};

/** His right ear (the viewer's right), grid columns 20–27, rows 0–5: upright, or turned out. */
const MYLES_EAR = {
	up: ['.....K..', '....KK..', '...KIK..', '..KIIK..', '.KIIIK..', 'KMIIMK..'],
	out: ['........', '......KK', '....KKIK', '..KKIIK.', '.KIIIK..', 'KMIIMK..']
};

export type MylesEyes = 'open' | 'half' | 'shut' | 'happy';

export interface MylesPose {
	eyes?: MylesEyes;
	/** Pupils toward the viewer's left (-1) or right (1); with `turn`, the head follows a pixel. */
	look?: -1 | 0 | 1;
	turn?: boolean;
	/** Leaning into a hand: the head a pixel to the viewer's left and down. */
	lean?: boolean;
	/** His right ear turned out to the side. */
	ear?: boolean;
	/** How far the tip of his tail lifts, for the swish. */
	tail?: number;
	/** Breathing in: the haunch a pixel fuller. */
	breath?: boolean;
}

/** The face grid for a pose: eyes, pupils and the turned ear swapped in. */
function mylesFace({ eyes = 'open', look = 0, ear = false }: MylesPose): string[] {
	const rows = MYLES_FACE.map((r) => r.split(''));
	const put = (row: number, col: number, text: string) =>
		text.split('').forEach((ch, i) => (rows[row][col + i] = ch));
	// Pupils move a pixel toward `look`; a highlight they cover moves to the space they leave.
	const glance = (row: string) => {
		const cells = row.split('');
		const pupils = cells.flatMap((c, i) => (c === '>' ? [i] : []));
		if (!look || !pupils.length) return row;
		const lost = pupils.map((i) => cells[i + look]).includes('g');
		for (const i of pupils) cells[i] = 'E';
		for (const i of pupils) cells[i + look] = '>';
		if (lost) cells[look < 0 ? pupils[pupils.length - 1] : pupils[0]] = 'g';
		return cells.join('');
	};
	MYLES_EYES[eyes].forEach((row, i) => {
		const mirrored = row.split('').reverse().join('');
		put(12 + i, 4, glance(row).replace(/>/g, 'O'));
		put(12 + i, 19, glance(mirrored).replace(/>/g, 'O'));
	});
	MYLES_EAR[ear ? 'out' : 'up'].forEach((row, i) => put(i, 20, row));
	return rows.map((r) => r.join(''));
}

/** Myles sitting upright: slender, brown and silver mackerel tabby, "M", striped legs, no white. */
export function myles(pose: MylesPose = {}): Canvas {
	const W = 34;
	const H = 72;
	const p = new Canvas(W, H);
	const b = new Canvas(W, H);
	const cx = 16;
	// Chest and body: narrow and upright, a small haunch behind on the right.
	b.poly(
		[
			[cx - 8, 22],
			[cx + 8, 22],
			[cx + 11, 40],
			[cx + 15, 54],
			[cx + 16, 66],
			[cx - 9, 66],
			[cx - 10, 44]
		],
		'tabby.b'
	);
	if (pose.breath) b.ellipse(cx + 2, 43, 17, 25, 'tabby.b');
	else b.ellipse(cx + 2, 44, 16, 24, 'tabby.b');
	// Front legs.
	for (const lx of [cx - 7, cx + 1]) b.rect(lx, 44, 6, 22, 'tabby.b');
	// Chest lighter, flanks and haunch shaded.
	b.remap((ink, x, y) => {
		if (!ink) return undefined;
		if (x > cx + 10 + (y - 40) * 0.12) return 'tabby.d';
		if (Math.abs(x - cx) < 4 && y < 42) return 'tabby.l';
		return undefined;
	});
	// Mackerel stripes on the flanks and necklaces on the chest.
	b.remap((ink, x, y) => {
		if (!ink || y < 24 || y > 62) return undefined;
		const flank = x < cx - 5 || x > cx + 7;
		if (flank && (x * 3 + Math.round(Math.sin(y / 5) * 2) + 40) % 7 < 2) return 'stripe.b';
		if (!flank && y < 40 && (y === 28 || y === 33 || y === 38) && Math.abs(x - cx) < 6)
			return 'stripe.d';
		return undefined;
	});
	// Bars on the legs, toes.
	for (const lx of [cx - 7, cx + 1]) {
		for (let y = 47; y < 64; y += 4) b.rect(lx, y, 5, 1, 'stripe.b').set(lx + 5, y, 'stripe.d2');
		b.vline(lx + 5, 44, 65, 'tabby.d');
		b.rect(lx - 1, 65, 8, 2, 'tabby.b')
			.set(lx + 2, 66, 'stripe.d')
			.set(lx + 4, 66, 'stripe.d');
	}
	b.vline(cx, 45, 66, 'stripe.d2');
	// Tail curling round the front paws, banded, dark tip; the swish lifts the tip.
	const lift = pose.tail ?? 0;
	for (let i = 0; i <= 26; i++) {
		const tt = i / 26;
		const up = i > 14 ? lift * ((i - 14) / 12) ** 2 : 0;
		const x = cx + 16 - tt * 28 + (i > 14 ? up * 0.3 : 0);
		const y = 66 - Math.sin(tt * Math.PI) * 3 - up;
		b.rect(x, y, 3, 3, i > 22 ? 'stripe.d2' : i % 5 < 2 ? 'stripe.b' : 'tabby.b');
	}
	b.outline('stripe.d2');
	p.blit(b, 0, 0);
	const dx = (pose.turn ? (pose.look ?? 0) : 0) - (pose.lean ? 1 : 0);
	const dy = pose.lean ? 1 : 0;
	p.grid(cx - 15 + dx, dy, mylesFace(pose), MYLES_INKS);
	// Whiskers.
	for (const [x, y] of [
		[0, 17],
		[-1, 19],
		[32, 17],
		[33, 19]
	] as Pt[])
		p.set(x + 1 + dx, y + dy, 'tabby.l');
	p.set(1 + dx, 18 + dy, 'tabby.l').set(32 + dx, 18 + dy, 'tabby.l');
	return p;
}

// ---------- Margot ----------

/**
 * Margot's round face, 24 × 19, as the left half of each row (mirrored for the right): tabby
 * crown and cheeks, a white blaze widening from between the eyes into a white muzzle and chin.
 * K outline, M tabby, X stripe, W white, m mouth, I inner ear, P nose; eyes closed.
 */
const MARGOT_FACE_LEFT = [
	'...K........',
	'...KK.......',
	'...KIK......',
	'..KIIK......',
	'..KIIMKKKKKK',
	'.KMMMMMXMMMM',
	'.KMMXMMMXMMM',
	'KMMXMMMMMMMW',
	'KMMMMMMMMMMW',
	'KXMKMMMKMMWW',
	'KMMMKKKMMWWW',
	'KXMMMMMMWWWW',
	'KMMMMMMWWWWP',
	'.KMMMMWWWWmW',
	'.KMMMWWWWWWm',
	'..KMWWWWWWWW',
	'...KWWWWWWWW',
	'....KKWWWWWW',
	'......KKKKKK'
];

const MARGOT_INKS = {
	K: 'stripe.d2',
	M: 'tabby.b',
	X: 'stripe.b',
	W: 'catWhite.b',
	m: 'tabby.d',
	I: 'ear.b',
	P: 'catNose.b',
	E: 'eye.b',
	O: 'eyeDark.b'
};

export type MargotEyes = 'shut' | 'sleepy';

/** Her face grid: eyes shut or sleepily half open, her right ear upright or flicked out. */
function margotFace(eyes: MargotEyes, flick: boolean): string[] {
	const rows = MARGOT_FACE_LEFT.map((half) => (half + half.split('').reverse().join('')).split(''));
	const put = (row: number, col: number, text: string) =>
		text.split('').forEach((ch, i) => (rows[row][col + i] = ch));
	if (eyes === 'sleepy')
		for (const col of [3, 16]) {
			put(9, col, 'KKKKK');
			put(10, col, 'KEOEK');
		}
	if (flick)
		['........', '......KK', '....KKIK', '..KKIIK.', 'KKMIIK..'].forEach((r, i) => put(i, 16, r));
	return rows.map((r) => r.join(''));
}

/** Margot's canvas, with room for her stretch; `sill` is the row her paws rest on. */
export const MARGOT = { w: 62, h: 36, sill: 34 };

export interface MargotPose {
	/** Curled asleep (head down or lifted), standing, or bowed into a stretch. */
	shape?: 'curled' | 'stand' | 'bow';
	/** How far her head is lifted while curled. */
	lift?: number;
	eyes?: MargotEyes;
	/** Her right ear flicked out, a front paw reaching, a breath in. */
	flick?: boolean;
	paw?: boolean;
	breath?: boolean;
}

/** Tabby fur with mackerel stripes, darker underneath, over whatever `b` already has. */
function margotCoat(b: Canvas, from: number, to: number, belly: number): void {
	b.remap((ink, x, y) => {
		if (ink !== 'tabby.b' || x < from || x > to) return undefined;
		if (y >= belly) return 'tabby.d';
		if ((x + Math.round(Math.sin(y / 3) * 2)) % 6 < 2 && y > 14) return 'stripe.b';
		return undefined;
	});
}

/** Ringed tail through the given points, banded every few pixels, with a dark tip at the end. */
function margotTail(p: Canvas, points: Pt[]): void {
	const b = new Canvas(p.w, p.h);
	const steps = 40;
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const seg = Math.min(points.length - 2, Math.floor(t * (points.length - 1)));
		const k = t * (points.length - 1) - seg;
		const [x0, y0] = points[seg];
		const [x1, y1] = points[seg + 1];
		const ink = i > steps - 4 ? 'stripe.d2' : i % 6 < 2 ? 'stripe.b' : 'tabby.b';
		b.rect(Math.round(x0 + (x1 - x0) * k), Math.round(y0 + (y1 - y0) * k), 3, 3, ink);
	}
	b.outline('stripe.d2');
	p.blit(b, 0, 0);
}

/**
 * Margot: a round-faced tabby-and-white, curled asleep on the sill, lifting her head, or up on
 * her feet for a stretch. White muzzle, blaze, chest, belly and paws; ringed tail, dark tip.
 */
export function margot(pose: MargotPose = {}): Canvas {
	const { shape = 'curled', lift = 0, eyes = 'shut', flick = false, paw = false } = pose;
	const { w: W, h: H, sill: S } = MARGOT;
	const p = new Canvas(W, H);
	const b = new Canvas(W, H);
	let head: Pt;
	if (shape === 'curled') {
		const top = pose.breath ? 15 : 16;
		b.ellipse(16, top, 44, S + 1 - top, 'tabby.b');
		margotCoat(b, 16, W, S - 4);
		margotTail(b, [
			[56, S - 4],
			[46, S - 2],
			[36, S - 2],
			[29, S - 4]
		]);
		b.ellipse(8, S - 12, 20, 13, 'catWhite.b');
		head = [4, 12 - lift];
	} else if (shape === 'stand') {
		b.ellipse(16, 10, 40, 16, 'tabby.b');
		for (const x of [44, 50]) b.rect(x, 20, 5, S - 19, 'tabby.b');
		margotCoat(b, 16, W, 30);
		b.ellipse(22, 19, 28, 7, 'catWhite.b');
		for (const x of [44, 50]) b.rect(x, S - 2, 5, 3, 'catWhite.b');
		for (const x of [17, 23]) b.rect(x, 20, 5, S - 19, 'catWhite.b');
		margotTail(b, [
			[54, 14],
			[58, 8],
			[57, 2],
			[53, 0]
		]);
		b.ellipse(6, 12, 20, 14, 'catWhite.b');
		head = [2, 2];
	} else {
		// The bow: rump up on straight back legs, chest low, front legs flat along the sill.
		b.poly(
			[
				[16, 22],
				[30, 13],
				[44, 5],
				[54, 7],
				[56, 18],
				[54, S],
				[44, S],
				[42, 24],
				[24, S - 3]
			],
			'tabby.b'
		);
		margotCoat(b, 16, W, 40);
		b.poly(
			[
				[18, 25],
				[30, 21],
				[42, 23],
				[40, 27],
				[24, S - 2]
			],
			'catWhite.b'
		);
		for (const x of [44, 50]) b.rect(x, S - 2, 5, 3, 'catWhite.b');
		margotTail(b, [
			[52, 8],
			[57, 3],
			[60, 0],
			[57, 0]
		]);
		b.rect(2, S - 6, 22, 3, 'catWhite.b').rect(0, S - 3, 22, 3, 'catWhite.b');
		b.ellipse(12, S - 12, 16, 10, 'catWhite.b');
		head = [5, 11];
	}
	// White paws tucked under her chin (one reaching out in a dream).
	if (shape === 'curled') {
		b.rect(paw ? 3 : 6, S - 3, 6, 4, 'catWhite.l').rect(13, S - 3, 6, 4, 'catWhite.l');
	}
	b.outline('stripe.d2');
	p.blit(b, 0, 0);
	p.grid(head[0], head[1], margotFace(eyes, flick), MARGOT_INKS);
	return p;
}

/**
 * Joelle's lap, knees and shins seen from the front, under the desk. Knees sit at row 50.
 * turn > 0 swings the knees toward the viewer's left.
 */
export function legs(turn = 0): Canvas {
	const W = 96;
	const H = 150;
	const p = new Canvas(W, H);
	const cx = 48 - Math.round(10 * turn);
	const l = new Canvas(W, H);
	// Hoodie hem and lap.
	l.poly(
		[
			[14, 0],
			[82, 0],
			[80, 14],
			[16, 14]
		],
		'hoodie.d'
	);
	for (const side of [-1, 1]) {
		const kx = cx + side * 13;
		// Thigh, foreshortened, running forward into the knee, then the shin down to the floor.
		l.poly(
			[
				[48 + side * 3, 10],
				[48 + side * 31, 10],
				[kx + side * 12, 46],
				[kx - side * 11, 46]
			],
			'jeans.d'
		);
		l.poly(
			[
				[kx - 12, 44],
				[kx + 12, 44],
				[kx + 10, 56],
				[kx - 10, 56]
			],
			'jeans.d'
		);
		l.hline(kx - 9, kx + 8, 44, 'jeans.b').hline(kx - 7, kx + 6, 45, 'jeans.b');
		l.poly(
			[
				[kx - 10, 54],
				[kx + 10, 54],
				[kx + 8, H],
				[kx - 7, H]
			],
			'jeans.d'
		);
		l.vline(kx + side * 8, 56, H - 1, 'jeans.d2');
	}
	l.remap((ink, _x, y) => (ink === 'jeans.b' && y > 52 ? 'jeans.d' : undefined));
	l.outline('jeans.d2');
	p.blit(l, 0, 0);
	// Seams and the chair's gas lift between the legs.
	p.vline(cx, 50, H - 1, 'metal.d2');
	p.hline(cx - 22, cx - 8, 44, 'jeans.l').hline(cx + 8, cx + 20, 44, 'jeans.l');
	return p;
}

// Desk props at medium-shot scale, each returned as its own sprite.

/** Iced coffee in a clear cup, full at level 5: milk swirl, ice, straw, condensation glints. 20×40. */
export function coffee(level = 5): Canvas {
	const c = new Canvas(20, 40);
	c.poly(
		[
			[2, 10],
			[17, 10],
			[16, 39],
			[3, 39]
		],
		'catWhite.d'
	);
	const top = 38 - Math.round((24 * level) / 5);
	if (level > 0) {
		c.poly(
			[
				[3, top],
				[16, top],
				[15, 38],
				[4, 38]
			],
			'coffee.b'
		);
		c.hline(3, 16, top, 'milk.l').hline(3, 16, top + 1, 'milk.l');
		for (const [x, y, w] of [
			[5, 6, 4],
			[9, 9, 5],
			[6, 13, 4],
			[10, 17, 3],
			[5, 20, 5]
		])
			if (top + y < 37) c.hline(x, x + w, top + y, 'milk.b');
	} else {
		c.hline(4, 15, 38, 'coffee.d');
	}
	const ice = Math.min(top, 30);
	c.rect(4, ice - 2, 4, 4, 'catWhite.l')
		.rect(10, ice - 3, 4, 4, 'catWhite.l')
		.rect(7, ice + 2, 3, 3, 'catWhite.b');
	c.line(11, 0, 13, 13, 'straw.b').line(12, 0, 14, 13, 'straw.d').set(11, 0, 'straw.l');
	c.vline(2, 10, 38, 'catWhite.l').vline(17, 10, 38, 'catWhite.d2');
	c.hline(3, 16, 39, 'catWhite.d2').hline(2, 17, 10, 'catWhite.l');
	c.set(16, 20, 'catWhite.l')
		.set(15, 26, 'catWhite.l')
		.set(16, 31, 'catWhite.l')
		.set(4, 24, 'catWhite.l');
	return c;
}

/** Retro radio, the sound toggle: grille, dial lit when on, two knobs, handle, sound waves. 50×36. */
export function radio(on: boolean): Canvas {
	const r = new Canvas(50, 36);
	const body = new Canvas(50, 36);
	body.rect(1, 10, 40, 25, 'radio.b');
	body
		.rect(1, 10, 40, 3, 'radio.l')
		.vline(1, 10, 34, 'radio.l')
		.hline(1, 40, 34, 'radio.d')
		.vline(40, 10, 34, 'radio.d');
	body.rect(4, 15, 18, 16, 'grille.b');
	for (let y = 16; y < 31; y += 2) body.hline(5, 20, y, 'grille.d2');
	body.rect(25, 15, 13, 7, on ? 'lampGlow.b' : 'radio.d2');
	if (on) body.hline(26, 36, 19, 'lampGlow.d').vline(30, 16, 21, 'sticker0.b');
	body.ellipse(25, 24, 6, 6, 'metal.b').ellipse(32, 24, 6, 6, 'metal.d');
	body.set(26, 25, 'metal.l').set(33, 25, 'metal.b');
	body.path(
		[
			[8, 10],
			[11, 3],
			[31, 3],
			[34, 10]
		],
		'metal.d'
	);
	body.path(
		[
			[9, 10],
			[12, 4],
			[30, 4],
			[33, 10]
		],
		'metal.l'
	);
	body.outline('grille.d2');
	r.blit(body, 0, 0);
	if (on)
		for (const [x, y0, y1] of [
			[44, 17, 23],
			[47, 14, 26]
		])
			for (let y = y0; y <= y1; y++)
				r.set(x + Math.round(Math.sin(((y - y0) / (y1 - y0)) * Math.PI) * 1.5), y, 'lampGlow.l');
	return r;
}

/** Desk lamp with a cone shade, facing left or right. 52×80. */
export function lamp(on: boolean, facing: 1 | -1): Canvas {
	const l = new Canvas(52, 80);
	l.ellipse(4, 72, 22, 7, 'lamp.d');
	l.hline(7, 22, 72, 'lamp.l');
	l.line(14, 72, 8, 40, 'lamp.d2').line(15, 72, 9, 40, 'lamp.b').line(16, 72, 10, 40, 'lamp.b');
	l.line(9, 40, 26, 16, 'lamp.d2').line(10, 41, 27, 17, 'lamp.b').line(11, 41, 28, 17, 'lamp.b');
	l.ellipse(5, 36, 9, 9, 'lamp.l');
	l.poly(
		[
			[24, 8],
			[36, 12],
			[47, 32],
			[30, 34]
		],
		'lamp.b'
	);
	l.line(24, 8, 30, 33, 'lamp.l');
	l.poly(
		[
			[36, 12],
			[47, 32],
			[43, 33],
			[33, 14]
		],
		'lamp.d'
	);
	l.hline(30, 47, 33, 'lamp.d2');
	l.rect(33, 33, 8, 3, on ? 'lampGlow.l' : 'lamp.d');
	l.outline('lamp.d2');
	if (facing === 1) return l;
	const m = new Canvas(52, 80);
	m.blit(l, 0, 0, true);
	return m;
}

export function plant(): Canvas {
	const g = new Canvas(48, 58);
	for (const [bx, by, bw, bh] of [
		[10, 8, 16, 13],
		[20, 2, 16, 16],
		[4, 18, 16, 13],
		[24, 16, 18, 13],
		[14, 16, 16, 14]
	])
		g.shaded(bx, by, bw, bh, 'plant');
	g.outline();
	g.poly(
		[
			[10, 34],
			[38, 34],
			[34, 56],
			[14, 56]
		],
		'pot.b'
	);
	g.hline(9, 38, 34, 'pot.l').hline(9, 38, 35, 'pot.d');
	g.line(33, 37, 31, 55, 'pot.d').hline(14, 34, 56, 'pot.d2');
	return g;
}

/** The sign: a cream painted board in a wooden frame, with a small brass picture light. */
export function sign(p: Canvas, x: number, y: number, w: number, h: number, lit: boolean): Pt {
	frame(p, x, y, w, h, 'paper.b', 5);
	p.rect(x + 5, y + h - 9, w - 10, 4, 'paper.d');
	p.hline(x + 6, x + w - 7, y + 6, 'paper.l');
	// Picture light: a little arm and a brass hood above the frame.
	const lx = x + Math.round(w / 2);
	p.rect(lx - 1, y - 7, 3, 7, 'lamp.d');
	p.rect(lx - 20, y - 9, 40, 4, 'lamp.b')
		.hline(lx - 20, lx + 19, y - 9, 'lamp.l')
		.hline(lx - 20, lx + 19, y - 6, 'lamp.d2');
	if (lit) p.hline(lx - 18, lx + 17, y - 5, 'bulb.l');
	return [lx, y - 4];
}

/**
 * The laptop lid as seen from behind (64×40), with the stickers. The radio stands in front of the
 * lower-left corner, so that corner stays bare. Two stickers overlap and one corner peels.
 */
export function stickerSheet(): Canvas {
	const s = new Canvas(64, 40);
	s.rect(0, 0, 64, 40, 'laptop.b');
	s.rect(0, 0, 64, 2, 'laptop.l');
	// GitHub contribution graph.
	s.rect(3, 3, 22, 14, 'catWhite.l');
	for (let i = 0; i < 5; i++)
		for (let j = 0; j < 3; j++)
			s.rect(
				5 + i * 4,
				5 + j * 4,
				3,
				3,
				['plant.l', 'sticker1.b', 'plant.d', 'sticker1.l'][(i * 3 + j) % 4]
			);
	// HELLO my name is (Joelle).
	s.rect(27, 2, 25, 17, 'catWhite.l');
	s.rect(28, 3, 23, 6, 'sticker0.b');
	s.hline(30, 48, 6, 'catWhite.l');
	s.path(
		[
			[31, 14],
			[34, 11],
			[36, 15],
			[39, 11],
			[42, 14],
			[46, 12]
		],
		'hair.b'
	);
	s.set(51, 2, 'laptop.b').set(50, 2, 'catWhite.d');
	// </> code tag, overlapping the name tag's corner.
	s.rect(44, 14, 19, 11, 'sticker3.b');
	s.grid(
		46,
		16,
		['..#.....#.#....', '.#.....#...#...', '#.....#.....#..', '.#...#.....#...', '..#.#.....#....'],
		{ '#': 'catWhite.l' }
	);
	// Myles & Margot.
	s.rect(37, 26, 19, 12, 'catWhite.l');
	s.grid(39, 28, ['t.t..m.m.', 'ttt..mmm.', 'tgt..mwm.', '.t....m..'], {
		t: 'tabby.b',
		g: 'eye.b',
		m: 'tabby.b',
		w: 'catWhite.b'
	});
	s.grid(44, 31, ['...', '...'], {});
	// Rolled-up scroll (the CV), hidden until the CV exists.
	s.rect(57, 26, 6, 12, 'paper.b').rect(57, 26, 6, 2, 'paper.d').rect(57, 36, 6, 2, 'paper.d');
	s.vline(59, 28, 35, 'paper.d');
	return s;
}

export function texture(src: Canvas): (u: number, v: number) => string | null {
	return (u, v) =>
		src.get(Math.min(src.w - 1, Math.floor(u * src.w)), Math.min(src.h - 1, Math.floor(v * src.h)));
}

/** Window opening (transparent so the sky shows) with frame, sill and mullions. */
export function windowFrame(
	p: Canvas,
	x: number,
	y: number,
	w: number,
	h: number,
	opts: { mullion?: boolean } = {}
): void {
	p.rect(x - 5, y - 5, w + 10, h + 10, 'frame.b');
	p.rect(x - 5, y - 5, w + 10, 1, 'frame.l').rect(x - 5, y - 5, 1, h + 10, 'frame.l');
	p.rect(x + w + 4, y - 5, 1, h + 10, 'frame.d2');
	p.rect(x, y, w, h, null);
	p.rect(x - 1, y - 1, w + 2, 1, 'frame.d').rect(x - 1, y - 1, 1, h + 2, 'frame.d');
	if (opts.mullion !== false) {
		const mx = x + Math.floor(w / 2) - 1;
		p.rect(mx, y, 3, h, 'frame.b')
			.set(mx, y, 'frame.l')
			.vline(mx, y, y + h - 1, 'frame.l')
			.vline(mx + 2, y, y + h - 1, 'frame.d');
		const my = y + Math.floor(h * 0.45);
		p.rect(x, my, w, 3, 'frame.b')
			.hline(x, x + w - 1, my, 'frame.l')
			.hline(x, x + w - 1, my + 2, 'frame.d');
	}
	// Sill.
	p.rect(x - 9, y + h + 5, w + 18, 4, 'frame.b')
		.hline(x - 9, x + w + 8, y + h + 5, 'frame.l')
		.hline(x - 9, x + w + 8, y + h + 8, 'frame.d2');
	p.rect(x - 6, y + h + 9, w + 12, 2, 'wall.d');
}

/** Picture frame / board frame in wood. */
export function frame(
	p: Canvas,
	x: number,
	y: number,
	w: number,
	h: number,
	inner: string,
	thick = 4
): void {
	p.rect(x, y, w, h, 'wood.d2');
	p.rect(x + 1, y + 1, w - 2, h - 2, 'wood.b');
	p.hline(x + 1, x + w - 2, y + 1, 'wood.l').vline(x + 1, y + 1, y + h - 2, 'wood.l');
	p.hline(x + 1, x + w - 2, y + h - 2, 'wood.d').vline(x + w - 2, y + 1, y + h - 2, 'wood.d');
	p.rect(x + thick, y + thick, w - 2 * thick, h - 2 * thick, inner);
	p.hline(x + thick, x + w - thick - 1, y + thick, 'wood.d2').vline(
		x + thick,
		y + thick,
		y + h - thick - 1,
		'wood.d2'
	);
	// Shadow on the wall.
	p.hline(x + 2, x + w, y + h, 'wall.d').vline(x + w, y + 2, y + h, 'wall.d');
}

/** Corkboard; returns nothing, notes are drawn by the caller as HTML over paper rectangles. */
export function corkboard(p: Canvas, x: number, y: number, w: number, h: number): void {
	frame(p, x, y, w, h, 'cork.b', 4);
	for (let yy = y + 5; yy < y + h - 4; yy++)
		for (let xx = x + 5; xx < x + w - 4; xx++) {
			const n = (xx * 37 + yy * 61 + ((xx * yy) % 7)) % 23;
			if (n === 0) p.set(xx, yy, 'cork.d');
			else if (n === 5) p.set(xx, yy, 'cork.l');
			else if (n === 11) p.set(xx, yy, 'cork.d2');
		}
}

/** Paper note with a slight curl; the pin colour index picks a sticker colour. */
export function note(
	p: Canvas,
	x: number,
	y: number,
	w: number,
	h: number,
	paper: string,
	pin: number
): void {
	p.rect(x + 1, y + 1, w, h, 'cork.d2');
	p.rect(x, y, w, h, `${paper}.b`);
	p.hline(x, x + w - 1, y + h - 1, `${paper}.d`).vline(x + w - 1, y, y + h - 1, `${paper}.d`);
	p.set(x + w - 1, y + h - 1, `${paper}.d2`).set(x + w - 2, y + h - 1, `${paper}.d`);
	const px = x + Math.floor(w / 2);
	p.rect(px - 1, y - 2, 3, 3, `sticker${pin}.b`)
		.set(px - 1, y - 2, `sticker${pin}.l`)
		.set(px + 1, y, `sticker${pin}.d2`);
}

export function stringLights(
	p: Canvas,
	x0: number,
	x1: number,
	y: number,
	sag: number,
	bulbs: number
): Pt[] {
	const pts: Pt[] = [];
	for (let x = x0; x <= x1; x++) {
		const t = (x - x0) / (x1 - x0);
		const yy = y + Math.sin(t * Math.PI) * sag;
		p.set(x, Math.round(yy), 'hair.b');
	}
	for (let i = 0; i < bulbs; i++) {
		const t = (i + 0.5) / bulbs;
		const bx = Math.round(x0 + t * (x1 - x0));
		const by = Math.round(y + Math.sin(t * Math.PI) * sag) + 1;
		p.rect(bx, by, 2, 3, 'bulb.b').set(bx, by, 'bulb.l');
		pts.push([bx + 1, by + 1]);
	}
	return pts;
}

/** A wall clock: wooden rim, face and quarter marks. The engine draws the hands. */
export function clock(p: Canvas, x: number, y: number, d: number): void {
	p.ellipse(x, y, d, d, 'wood.d2');
	p.ellipse(x + 1, y + 1, d - 2, d - 2, 'wood.b');
	p.ellipse(x + 3, y + 3, d - 6, d - 6, 'catWhite.b');
	p.ring(x + 3, y + 3, d - 6, d - 6, 'catWhite.d');
	const c = x + d / 2 - 0.5;
	const cy = y + d / 2 - 0.5;
	for (let i = 0; i < 12; i += 3) {
		const a = (i / 12) * Math.PI * 2;
		p.set(
			Math.round(c + Math.sin(a) * (d / 2 - 5)),
			Math.round(cy - Math.cos(a) * (d / 2 - 5)),
			'hair.b'
		);
	}
	p.hline(x + 3, x + d - 1, y + d, 'wall.d');
}

/** Paint-swatch card: four stacked chips (moody, pastel, warm, retro). */
/** A paint-swatch card; its chips are palette materials, so they show the current palette. */
export function swatchCard(p: Canvas, x: number, y: number, w = 14, h = 30): void {
	p.rect(x + 1, y + 1, w, h, 'wall.d');
	p.rect(x, y, w, h, 'catWhite.l');
	const chips = ['sweater', 'sticker1', 'sticker0', 'lamp'];
	const ch = Math.floor((h - 4) / 4);
	chips.forEach((c, i) => {
		const cy = y + 2 + i * ch;
		p.rect(x + 2, cy, w - 4, ch - 1, `${c}.b`).hline(x + 2, x + w - 3, cy, `${c}.l`);
	});
	p.rect(x + w / 2 - 1, y - 2, 3, 3, 'sticker2.b');
}

export function bookshelf(
	p: Canvas,
	x: number,
	y: number,
	w: number,
	h: number,
	flip = false
): void {
	const s = new Canvas(w, h);
	s.rect(0, 0, w, h, 'desk.d2');
	s.rect(2, 2, w - 4, h - 4, 'desk.d');
	const shelves = Math.floor((h - 4) / 26);
	for (let i = 0; i < shelves; i++) {
		const sy = 2 + i * 26;
		s.rect(2, sy + 24, w - 4, 2, 'desk.b').hline(2, w - 3, sy + 24, 'desk.l');
		let bx = 4;
		let k = i * 3;
		while (bx < w - 8) {
			const bw = 3 + (k % 3);
			const bh = 14 + ((k * 7) % 8);
			const m = `book${k % 3}`;
			if ((k + i) % 7 === 5) {
				bx += 6;
			} else {
				s.rect(bx, sy + 24 - bh, bw, bh, `${m}.b`)
					.vline(bx, sy + 24 - bh, sy + 23, `${m}.l`)
					.hline(bx, bx + bw - 1, sy + 27 - bh, `${m}.d`);
				bx += bw;
			}
			k++;
		}
	}
	s.rect(0, h - 2, w, 2, 'desk.d2');
	p.blit(s, x, y, flip);
}
