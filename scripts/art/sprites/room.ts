import { frames, Pixels, type Ink, type Pt, type SpriteDef } from '../lib/sheet.ts';

const still = (draw: (p: Pixels) => void) => [{ duration: 1000, draw }];

const WINDOW_HOLE = { x: 46, y: 24, w: 116, h: 96 };

export const wall: SpriteDef = {
	name: 'wall',
	width: 492,
	height: 214,
	anchor: [0, 0],
	frames: still((p) => {
		p.rect(0, 0, 492, 214, 'wall.b');
		p.rect(0, 0, 492, 2, 'wall.d');
		p.rect(0, 8, 492, 1, 'wall.l').rect(0, 9, 492, 2, 'frame.b').rect(0, 11, 492, 1, 'frame.d');
		p.rect(0, 192, 492, 2, 'wall.d');
		p.rect(0, 194, 492, 1, 'frame.l')
			.rect(0, 195, 492, 10, 'frame.b')
			.rect(0, 204, 492, 2, 'frame.d');
		p.rect(0, 199, 492, 1, 'frame.d');
		const { x, y, w, h } = WINDOW_HOLE;
		p.rect(x, y, w, h, null);
	})
};

export const windowFrame: SpriteDef = {
	name: 'window',
	width: 136,
	height: 110,
	anchor: [0, 0],
	frames: still((p) => {
		p.rect(6, 0, 124, 104, 'frame.b');
		p.rect(6, 0, 124, 1, 'frame.l').rect(6, 0, 1, 104, 'frame.l').rect(129, 0, 1, 104, 'frame.d2');
		p.rect(10, 4, 116, 96, null);
		p.rect(9, 3, 118, 1, 'frame.d').rect(9, 3, 1, 98, 'frame.d');
		p.rect(66, 4, 4, 96, 'frame.b').rect(66, 4, 1, 96, 'frame.l').rect(69, 4, 1, 96, 'frame.d');
		p.rect(10, 50, 116, 4, 'frame.b')
			.rect(10, 50, 116, 1, 'frame.l')
			.rect(10, 53, 116, 1, 'frame.d');
		p.rect(62, 46, 3, 4, 'lamp.d').set(62, 46, 'lamp.l');
		p.rect(0, 100, 136, 6, 'frame.b')
			.rect(0, 100, 136, 2, 'frame.l')
			.rect(0, 105, 136, 1, 'frame.d2');
		p.rect(3, 106, 130, 4, 'wall.d');
	})
};

function curtainPanel(p: Pixels, x: number, width: number, tieY: number, side: 'left' | 'right') {
	const panel = new Pixels(p.w, p.h);
	for (let y = 4; y < 130; y++) {
		const pinch =
			y < tieY ? 1 - ((y - 4) / (tieY - 4)) * 0.45 : 0.55 + ((y - tieY) / (130 - tieY)) * 0.5;
		const w = Math.max(4, Math.round(width * Math.min(1, pinch)));
		const x0 = side === 'left' ? x : x + width - w;
		for (let i = 0; i < w; i++) {
			const fold = Math.sin((i / w) * Math.PI * 3.2 + (side === 'left' ? 0 : 1));
			const ink: Ink =
				fold > 0.55
					? 'curtain.l'
					: fold > -0.2
						? 'curtain.b'
						: fold > -0.75
							? 'curtain.d'
							: 'curtain.d2';
			panel.set(x0 + i, y, ink);
		}
	}
	panel.outline();
	p.blit(panel, 0, 0);
	const tx = side === 'left' ? x : x + width - 12;
	p.rect(tx, tieY, 12, 3, 'curtain.d2').rect(tx + 1, tieY, 10, 1, 'curtain.l');
}

export const curtains: SpriteDef = {
	name: 'curtains',
	width: 160,
	height: 132,
	anchor: [0, 0],
	frames: still((p) => {
		curtainPanel(p, 3, 22, 84, 'left');
		curtainPanel(p, 135, 22, 84, 'right');
		p.rect(2, 2, 156, 2, 'frame.d').rect(2, 2, 156, 1, 'frame.l');
		p.rect(0, 1, 3, 4, 'frame.d2').rect(157, 1, 3, 4, 'frame.d2');
		for (let x = 5; x < 26; x += 4) p.set(x, 4, 'frame.d2');
		for (let x = 137; x < 158; x += 4) p.set(x, 4, 'frame.d2');
	})
};

export const poster: SpriteDef = {
	name: 'poster',
	width: 70,
	height: 52,
	anchor: [0, 0],
	frames: still((p) => {
		p.rect(0, 0, 70, 52, 'desk.d2').rect(1, 1, 68, 50, 'desk.d').rect(1, 1, 68, 1, 'desk.b');
		p.rect(3, 3, 64, 46, 'poster.d');
		p.rect(3, 3, 64, 14, 'poster.b').rect(3, 17, 64, 1, 'poster.d');
		for (const ax of [4, 24, 44]) {
			p.ellipse(ax, 31, 22, 14, 'poster.d2');
			p.rect(ax, 38, 22, 11, 'poster.d2');
			p.ellipse(ax + 4, 35, 14, 10, 'poster.b');
			p.rect(ax + 4, 40, 14, 9, 'poster.b');
		}
		const spine: Pt[] = [];
		for (let i = 0; i <= 50; i++) {
			const t = i / 50;
			spine.push([7 + t * 44, 9 + Math.sin(t * Math.PI * 0.85) * 9 + t * 14]);
		}
		spine.forEach(([x, y], i) => {
			p.rect(x, y, 1, 2, 'poster.l');
			if (i % 2 === 0) p.set(x, y - 1, 'catWhite.d');
			if (i % 3 === 0 && i > 14 && i < 40) {
				const len = 8 - Math.abs(i - 26) / 3;
				p.line(x, y + 2, x - 2, y + 1 + len, 'poster.l');
			}
		});
		p.poly(
			[
				[48, 30],
				[56, 30],
				[66, 37],
				[64, 40],
				[50, 36]
			],
			'catWhite.b'
		);
		p.line(50, 30, 65, 37, 'poster.l').set(55, 33, 'poster.d2');
		p.line(50, 37, 63, 44, 'catWhite.b').line(51, 38, 62, 44, 'poster.l');
		p.line(32, 26, 30, 34, 'poster.l')
			.line(30, 34, 26, 38, 'poster.l')
			.line(31, 34, 28, 39, 'poster.l');
		p.line(7, 9, 3, 5, 'poster.l').line(7, 9, 4, 13, 'poster.l');
		p.rect(3, 3, 64, 1, 'poster.l');
	})
};

export const shelf: SpriteDef = {
	name: 'shelf',
	width: 104,
	height: 70,
	anchor: [0, 0],
	frames: still((p) => {
		const books: [number, number, number, 0 | 1 | 2][] = [
			[5, 4, 24, 0],
			[10, 5, 26, 1],
			[16, 4, 22, 2],
			[21, 5, 25, 0],
			[27, 4, 20, 1]
		];
		for (const [x, w, h, c] of books) {
			const m = `book${c}` as const;
			p.rect(x, 28 - h, w, h, `${m}.b`)
				.rect(x, 28 - h, 1, h, `${m}.l`)
				.rect(x + w - 1, 28 - h, 1, h, `${m}.d`);
			p.rect(x, 28 - h + 3, w, 1, `${m}.d`).rect(x, 28 - 5, w, 1, `${m}.l`);
			p.rect(x, 28 - h, w, 1, `${m}.d2`);
		}
		p.poly(
			[
				[31, 27],
				[38, 8],
				[42, 9],
				[35, 28]
			],
			'book2.b'
		);
		p.line(38, 8, 31, 27, 'book2.l').line(42, 9, 35, 28, 'book2.d2');
		p.rect(46, 9, 22, 19, 'frame.d').rect(47, 10, 20, 17, 'frame.l');
		p.rect(49, 12, 16, 13, 'wall.l');
		p.grid(50, 15, ['t...t.m...m', 'ttttt.mmmmm', 'tgtgt.mgwgm', 'ttntt.mmnmm', '.ttt...mwm.'], {
			t: 'tabby.b',
			g: 'eye.b',
			n: 'nose.b',
			m: 'tabby.d',
			w: 'catWhite.l'
		});
		p.rect(49, 23, 16, 2, 'sweater.d');
		const plant = new Pixels(104, 70);
		for (const [x, y, w, h] of [
			[72, 4, 9, 7],
			[79, 1, 8, 9],
			[85, 5, 9, 7],
			[76, 9, 8, 6],
			[83, 10, 8, 5]
		]) {
			plant.blob(x, y, w, h, 'plant', { rim: false });
		}
		plant.outline();
		p.blit(plant, 0, 0);
		p.poly(
			[
				[74, 16],
				[90, 16],
				[88, 28],
				[76, 28]
			],
			'pot.b'
		);
		p.rect(74, 16, 16, 2, 'pot.l').line(88, 18, 87, 27, 'pot.d').rect(76, 27, 12, 1, 'pot.d2');
		p.rect(0, 28, 104, 4, 'desk.b').rect(0, 28, 104, 1, 'desk.l').rect(0, 31, 104, 1, 'desk.d2');
		p.rect(2, 32, 100, 2, 'wall.d');
		for (const bx of [8, 92]) p.rect(bx, 32, 3, 7, 'frame.d').rect(bx, 32, 1, 7, 'frame.l');
		let vx = 86;
		for (let y = 32; y < 68; y++) {
			vx += Math.round(Math.sin(y / 3.5) * 0.8);
			p.set(vx, y, 'plant.d');
			if (y % 4 === 0) p.rect(vx + 1, y, 2, 2, 'plant.b').set(vx + 2, y, 'plant.l');
			if (y % 4 === 2) p.rect(vx - 2, y, 2, 2, 'plant.b').set(vx - 2, y, 'plant.l');
		}
	})
};

function leaf(p: Pixels, base: Pt, tip: Pt, width: number, material: 'plant', dark = false) {
	const [bx, by] = base;
	const [tx, ty] = tip;
	const len = Math.hypot(tx - bx, ty - by);
	const nx = -(ty - by) / len;
	const ny = (tx - bx) / len;
	const pts: Pt[] = [];
	for (let i = 0; i <= 10; i++) {
		const t = i / 10;
		const w = Math.sin(t * Math.PI) * width;
		pts.push([bx + (tx - bx) * t + nx * w, by + (ty - by) * t + ny * w]);
	}
	for (let i = 10; i >= 0; i--) {
		const t = i / 10;
		const w = Math.sin(t * Math.PI) * width;
		pts.push([bx + (tx - bx) * t - nx * w, by + (ty - by) * t - ny * w]);
	}
	const layer = new Pixels(p.w, p.h);
	layer.poly(pts, dark ? `${material}.d` : `${material}.b`);
	layer.map((ink, x, y) => {
		if (!ink) return undefined;
		const side = (x - bx) * nx + (y - by) * ny;
		return side > 0 ? (dark ? `${material}.d2` : `${material}.d`) : undefined;
	});
	layer.line(bx, by, tx, ty, dark ? `${material}.d2` : `${material}.l`);
	layer.outline();
	p.blit(layer, 0, 0);
}

export const floorPlant: SpriteDef = {
	name: 'floor-plant',
	width: 64,
	height: 100,
	anchor: [0, 0],
	frames: still((p) => {
		const stems: [Pt, Pt, number][] = [
			[[30, 70], [6, 18], 7],
			[[30, 70], [22, 2], 7],
			[[32, 70], [46, 8], 7],
			[[32, 70], [60, 30], 6],
			[[30, 70], [2, 46], 6],
			[[31, 70], [36, 26], 6],
			[[32, 72], [54, 52], 5]
		];
		for (const [base, tip] of stems)
			p.line(base[0], base[1], (base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2, 'plant.d');
		for (const [base, tip, w] of stems) {
			const mid: Pt = [(base[0] + tip[0] * 2) / 3, (base[1] + tip[1] * 2) / 3];
			leaf(p, mid, tip, w, 'plant');
		}
		p.poly(
			[
				[14, 70],
				[50, 70],
				[46, 99],
				[18, 99]
			],
			'pot.b'
		);
		p.rect(12, 68, 40, 4, 'pot.l').rect(12, 71, 40, 1, 'pot.d');
		p.map((ink, x) => (ink === 'pot.b' && x > 40 ? 'pot.d' : undefined), {
			x: 0,
			y: 72,
			w: 64,
			h: 28
		});
		p.line(14, 72, 18, 99, 'pot.d2').line(50, 72, 46, 99, 'pot.d2').rect(18, 99, 29, 1, 'pot.d2');
		p.rect(15, 68, 34, 1, 'pot.d2');
	})
};

export const floor: SpriteDef = {
	name: 'floor',
	width: 480,
	height: 64,
	anchor: [0, 0],
	frames: still((p) => {
		p.rect(0, 0, 480, 64, 'floor.b');
		p.rect(0, 0, 480, 2, 'floor.d2').rect(0, 2, 480, 2, 'floor.d');
		const rows = [4, 12, 22, 34, 48];
		rows.forEach((y, r) => {
			p.rect(0, y, 480, 1, 'floor.d').rect(0, y + 1, 480, 1, 'floor.l');
			const next = rows[r + 1] ?? 64;
			for (let x = (r * 53) % 97; x < 480; x += 97) p.rect(x, y + 1, 1, next - y - 1, 'floor.d');
			for (let x = (r * 31) % 41; x < 480; x += 41) p.line(x, y + 4, x + 12, y + 4, 'floor.d');
		});
	})
};

export const rug: SpriteDef = {
	name: 'rug',
	width: 270,
	height: 34,
	anchor: [0, 0],
	frames: still((p) => {
		p.ellipse(0, 0, 270, 34, 'rug.d2');
		p.ellipse(2, 1, 266, 31, 'rug.l');
		p.ellipse(6, 3, 258, 27, 'rug.d');
		p.ellipse(10, 4, 250, 24, 'rug.b');
		p.ellipse(40, 9, 190, 15, 'rug.l');
		p.ellipse(44, 10, 182, 13, 'rug.b');
		for (let x = 60; x < 212; x += 10) p.set(x, 16, 'rug.l').set(x + 5, 18, 'rug.d');
		p.map((ink, x, y) => (ink && y > 26 ? 'rug.d2' : undefined));
	})
};

export const leaves: SpriteDef = {
	name: 'leaves',
	width: 96,
	height: 70,
	anchor: [0, 0],
	frames: still((p) => {
		leaf(p, [0, 70], [40, 12], 11, 'plant', true);
		leaf(p, [8, 70], [70, 34], 10, 'plant', true);
		leaf(p, [0, 66], [12, 2], 8, 'plant', true);
		leaf(p, [14, 70], [90, 60], 8, 'plant', true);
	})
};

export const clouds: SpriteDef = {
	name: 'clouds',
	width: 120,
	height: 30,
	anchor: [0, 0],
	frames: still((p) => {
		const cloud = (x: number, y: number, w: number) => {
			const c = new Pixels(120, 30);
			c.ellipse(x, y + 4, w, 8, 'catWhite.b');
			c.ellipse(x + w * 0.2, y, w * 0.45, 10, 'catWhite.l');
			c.ellipse(x + w * 0.45, y + 1, w * 0.35, 8, 'catWhite.l');
			c.map((ink, _x, yy) => (ink && yy > y + 9 ? null : undefined));
			c.map((ink, _x, yy) => (ink && yy === y + 9 ? 'catWhite.d' : undefined));
			p.blit(c, 0, 0);
		};
		cloud(2, 4, 38);
		cloud(66, 14, 46);
	})
};

export const city: SpriteDef = {
	name: 'city',
	width: 160,
	height: 36,
	anchor: [0, 0],
	tags: [
		{ name: 'unlit', from: 0, to: 0 },
		{ name: 'lit', from: 1, to: 1 }
	],
	frames: frames(2, 1000, (p, lit) => {
		const blocks: [number, number, number][] = [
			[0, 16, 14],
			[14, 8, 12],
			[26, 20, 18],
			[44, 4, 14],
			[58, 14, 10],
			[68, 10, 20],
			[88, 22, 12],
			[100, 6, 16],
			[116, 16, 14],
			[130, 12, 18],
			[148, 18, 12]
		];
		blocks.forEach(([x, top, w], b) => {
			p.rect(x, top, w, 36 - top, b % 2 ? 'building.b' : 'building.d');
			p.rect(x, top, w, 1, 'building.l');
			for (let y = top + 3; y < 34; y += 3) {
				for (let wx = x + 2; wx < x + w - 1; wx += 3) {
					const on = (wx * 7 + y * 13 + b * 5) % 9 < 3;
					if (lit && on) p.set(wx, y, 'lampGlow.l');
					else if ((wx + y) % 2 === 0) p.set(wx, y, 'building.d2');
				}
			}
		});
		p.rect(48, 0, 1, 4, 'building.l').rect(46, 1, 5, 1, 'building.b');
		p.rect(104, 1, 6, 4, 'building.b')
			.rect(105, 5, 1, 1, 'building.d')
			.rect(108, 5, 1, 1, 'building.d');
		p.rect(72, 7, 2, 3, 'building.b');
	})
};
