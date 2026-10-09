import { frames, Pixels, type Ink, type SpriteDef } from '../lib/sheet.ts';

const still = (draw: (p: Pixels) => void, duration = 1000) => [{ duration, draw }];

export const desk: SpriteDef = {
	name: 'desk',
	width: 276,
	height: 52,
	anchor: [0, 0],
	frames: still((p) => {
		for (const x of [8, 260]) {
			p.rect(x, 9, 8, 43, 'desk.b')
				.rect(x, 9, 2, 43, 'desk.l')
				.rect(x + 6, 9, 2, 43, 'desk.d');
			p.rect(x - 1, 9, 1, 43, 'desk.d2').rect(x + 8, 9, 1, 43, 'desk.d2');
		}
		p.rect(16, 40, 244, 3, 'desk.d').rect(16, 40, 244, 1, 'desk.d2');
		p.rect(180, 9, 74, 25, 'desk.d2');
		p.rect(181, 10, 72, 23, 'desk.b').rect(181, 10, 72, 1, 'desk.l').rect(181, 32, 72, 1, 'desk.d');
		p.rect(185, 13, 64, 17, 'desk.d')
			.rect(186, 14, 62, 15, 'desk.b')
			.rect(186, 14, 62, 1, 'desk.l');
		p.rect(206, 20, 22, 3, 'desk.d2').rect(207, 20, 20, 1, 'desk.l');
		p.rect(0, 0, 276, 4, 'desk.l');
		p.rect(0, 4, 276, 6, 'desk.b').rect(0, 9, 276, 1, 'desk.d').rect(0, 10, 276, 1, 'desk.d2');
		for (let x = 6; x < 270; x += 23)
			p.line(x, 6, x + 9, 6, 'desk.d').line(x + 13, 8, x + 17, 8, 'desk.d');
		p.rect(0, 0, 1, 11, 'desk.d2').rect(275, 0, 1, 11, 'desk.d2');
	})
};

export const chair: SpriteDef = {
	name: 'chair',
	width: 62,
	height: 72,
	anchor: [0, 0],
	frames: still((p) => {
		const back = new Pixels(62, 72);
		back.ellipse(0, 0, 62, 20, 'chair.b');
		back.rect(1, 9, 60, 63, 'chair.b');
		back.map((ink, x, y) => {
			if (!ink) return undefined;
			if (x < 4 || (y < 6 && x < 30)) return 'chair.l';
			if (x > 55) return 'chair.d';
			if ((y - 14) % 16 === 0 && y > 10) return 'chair.d';
			return undefined;
		});
		back.line(31, 4, 31, 71, 'chair.d');
		back.outline();
		p.blit(back, 0, 0);
	})
};

export const laptop: SpriteDef = {
	name: 'laptop',
	width: 60,
	height: 40,
	anchor: [30, 40],
	frames: still((p) => {
		p.rect(2, 2, 56, 34, 'laptop.b');
		p.map((ink, x, y) => {
			if (ink !== 'laptop.b') return undefined;
			if (y < 4 || x < 4) return 'laptop.l';
			if (x > 54 || y > 33) return 'laptop.d';
			return (x + y) % 23 === 0 && x < 30 ? 'laptop.l' : undefined;
		});
		p.outline();
		p.set(1, 1, null).set(58, 1, null).set(2, 1, 'laptop.d2').set(57, 1, 'laptop.d2');
		p.set(1, 2, 'laptop.d2').set(58, 2, 'laptop.d2');
		p.rect(3, 36, 54, 2, 'laptop.d').rect(1, 37, 58, 1, 'laptop.d2');
		p.rect(0, 38, 60, 1, 'desk.d').rect(2, 39, 56, 1, 'desk.d2');
	})
};

const WHITE: Ink = 'fixed.white';

interface StickerArt {
	name: string;
	w: number;
	h: number;
	draw: (p: Pixels) => void;
	tiltFrom?: number;
	peel?: boolean;
}

function sticker({ name, w, h, draw, tiltFrom, peel }: StickerArt): SpriteDef {
	const width = w + 3;
	const height = h + 3 + (tiltFrom === undefined ? 0 : 1);
	return {
		name,
		width,
		height,
		anchor: [0, 0],
		slices: { hit: { x: 0, y: 0, w: width - 1, h: height - 1 } },
		frames: still((p) => {
			const art = new Pixels(w + 2, h + 2);
			const inner = new Pixels(w, h);
			draw(inner);
			art.blit(inner, 1, 1);
			art.outline(WHITE);
			if (peel) {
				const x = w;
				art
					.set(x + 1, 0, null)
					.set(x + 1, 1, null)
					.set(x, 0, null);
				art
					.set(x, 1, 'catWhite.b')
					.set(x - 1, 0, WHITE)
					.set(x + 1, 2, WHITE)
					.set(x, 2, 'laptop.d');
			}
			const layer = new Pixels(width, height);
			const shadow = new Pixels(width, height);
			shadow.blit(art, 1, 1);
			shadow.map((ink) => (ink ? 'laptop.d' : undefined));
			layer.blit(shadow, 0, 0).blit(art, 0, 0);
			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					const drop = tiltFrom !== undefined && x >= tiltFrom ? 1 : 0;
					const ink = layer.get(x, y);
					if (ink) p.set(x, y + drop, ink);
				}
			}
		})
	};
}

export const stickerGithub = sticker({
	name: 'sticker-github',
	w: 16,
	h: 10,
	tiltFrom: 10,
	draw: (p) => {
		p.rect(0, 0, 16, 10, 'catWhite.l');
		const levels: Ink[] = [
			'catWhite.d',
			'plant.d',
			'eye.d',
			'sticker1.d',
			'plant.l',
			'sticker1.b',
			'eye.b'
		];
		const pattern = [
			[1, 4, 0, 5, 2],
			[3, 6, 2, 1, 5],
			[5, 1, 6, 4, 0]
		];
		pattern.forEach((row, r) =>
			row.forEach((level, c) => p.rect(1 + c * 3, 1 + r * 3, 2, 2, levels[level]))
		);
	}
});

export const stickerName = sticker({
	name: 'sticker-name',
	w: 17,
	h: 12,
	draw: (p) => {
		p.rect(0, 0, 17, 12, 'catWhite.l');
		p.rect(0, 0, 17, 5, 'sticker0.b');
		p.grid(0, 1, ['#.#.###.#..#..###', '###.##..#..#..#.#', '#.#.###.##.##.###'], {
			'#': 'catWhite.l'
		});
		p.rect(3, 5, 11, 1, 'sticker0.d');
		p.grid(
			1,
			7,
			['..#......#.#.....', '..#.##.##.#.#.##.', '#.#.#.#.##.#.#.#.', '.#..##..##.#.#.##'],
			{ '#': 'hair.b' }
		);
	}
});

export const stickerCats = sticker({
	name: 'sticker-cats',
	w: 16,
	h: 7,
	draw: (p) => {
		p.grid(
			0,
			0,
			[
				't.....t..m.....m',
				'tt...tt..mm...mm',
				'tMtMtMt..mMmwmMm',
				'tgtttgt..mgmwmgm',
				'ttlnltt..mmwnwmm',
				'tlllllt..mwwwwwm',
				'.ttttt....mwwwm.'
			],
			{
				t: 'tabby.b',
				M: 'tabby.d2',
				g: 'eye.b',
				n: 'nose.b',
				l: 'tabby.l',
				m: 'tabby.d',
				w: 'catWhite.l'
			}
		);
	}
});

export const stickerCode = sticker({
	name: 'sticker-code',
	w: 13,
	h: 9,
	peel: true,
	draw: (p) => {
		p.rect(0, 0, 13, 9, 'sticker3.b').rect(0, 8, 13, 1, 'sticker3.d');
		p.grid(
			1,
			1,
			[
				'......#....',
				'..#...#.#..',
				'.#...#...#.',
				'#....#....#',
				'.#...#...#.',
				'..#.#...#..',
				'....#......'
			],
			{ '#': 'catWhite.l' }
		);
	}
});

export const stickerScroll = sticker({
	name: 'sticker-scroll',
	w: 16,
	h: 7,
	draw: (p) => {
		p.grid(
			0,
			0,
			[
				'.oo..........oo.',
				'oOOoppppppppoOOo',
				'oOoompmmppmpoOoo',
				'oOOopppppppooOOo',
				'oOoommpmpmmpoOoo',
				'oOOoppppppppoOOo',
				'.oo..........oo.'
			],
			{ o: 'milk.d', O: 'milk.l', p: 'milk.l', m: 'milk.d' }
		);
		p.rect(7, 1, 2, 5, 'sticker0.b').set(7, 6, 'sticker0.d');
	}
});

function drawCoffee(p: Pixels, level: number) {
	const top = 16;
	const bottom = 45;
	const halfWidth = (y: number) => 7 - Math.round(((y - top) / (bottom - top)) * 2);
	const cx = 10;
	const surface = bottom - 2 - Math.round((level / 5) * 23);
	for (let y = top + 1; y < bottom; y++) {
		const hw = halfWidth(y) - 1;
		for (let x = cx - hw; x < cx + hw; x++) {
			if (y < surface) continue;
			const depth = y - surface;
			let ink: Ink = depth < 3 ? 'milk.b' : y > bottom - 5 ? 'coffee.d' : 'coffee.b';
			const swirl = Math.round(Math.sin(depth / 2.2) * (hw - 1));
			if (depth >= 3 && Math.abs(x - cx - swirl) <= 1 && y < bottom - 4) {
				ink = depth < 9 ? 'milk.l' : 'milk.b';
			}
			p.set(x, y, ink);
		}
	}
	const iceY = level === 0 ? bottom - 7 : Math.max(top + 2, surface - 2);
	for (const [dx, dy] of [
		[-4, 0],
		[1, -1],
		[-1, 3]
	]) {
		const x = cx + dx;
		const y = iceY + dy;
		p.rect(x, y, 3, 3, 'catWhite.b')
			.set(x, y, 'catWhite.l')
			.set(x + 2, y + 2, 'catWhite.d');
	}
	for (let y = top; y <= bottom; y++) {
		const hw = halfWidth(y);
		p.set(cx - hw, y, 'catWhite.l').set(cx + hw - 1, y, 'catWhite.d');
	}
	p.line(cx - 7, top, cx + 6, top, 'catWhite.l');
	p.line(cx - 5, bottom, cx + 4, bottom, 'catWhite.d');
	for (const [x, y] of [
		[cx - 5, top + 6],
		[cx - 4, top + 13],
		[cx - 6, top + 3],
		[cx + 4, top + 9]
	]) {
		p.set(x, y, 'fixed.white');
	}
	p.line(cx + 1, bottom - 4, cx + 3, top, 'straw.d');
	p.line(cx + 3, top, cx + 4, 1, 'straw.b').line(cx + 4, top, cx + 5, 1, 'straw.d');
	p.line(cx + 3, top - 1, cx + 4, 2, 'straw.l');
}

export const coffee: SpriteDef = {
	name: 'coffee',
	width: 20,
	height: 46,
	anchor: [10, 46],
	tags: [5, 4, 3, 2, 1, 0].map((level, i) => ({ name: `level${level}`, from: i, to: i })),
	slices: { hit: { x: 1, y: 0, w: 18, h: 46 } },
	frames: [5, 4, 3, 2, 1, 0].map((level) => ({
		duration: 1000,
		draw: (p: Pixels) => drawCoffee(p, level)
	}))
};

export const lamp: SpriteDef = {
	name: 'lamp',
	width: 56,
	height: 66,
	anchor: [14, 66],
	tags: [
		{ name: 'off', from: 0, to: 0 },
		{ name: 'on', from: 1, to: 1 }
	],
	frames: frames(2, 1000, (p, on) => {
		p.ellipse(2, 59, 24, 7, 'lamp.d');
		p.ellipse(3, 59, 22, 5, 'lamp.b');
		p.rect(6, 59, 10, 1, 'lamp.l');
		p.line(13, 60, 9, 34, 'lamp.d').line(14, 60, 10, 34, 'lamp.b');
		p.line(10, 34, 28, 14, 'lamp.d').line(11, 34, 29, 14, 'lamp.b').line(10, 33, 28, 13, 'lamp.l');
		p.ellipse(7, 31, 6, 6, 'lamp.d').set(9, 33, 'lamp.l');
		p.ellipse(26, 11, 5, 5, 'lamp.d');
		const shade = new Pixels(56, 66);
		shade.poly(
			[
				[26, 9],
				[36, 4],
				[54, 24],
				[44, 32]
			],
			'lamp.b'
		);
		shade.map((ink, x, y) =>
			ink && x + y < 44 ? 'lamp.l' : ink && x - y > 26 ? 'lamp.d' : undefined
		);
		shade.outline();
		p.blit(shade, 0, 0);
		p.line(44, 32, 54, 24, on ? 'lampGlow.l' : 'lamp.d2');
		p.line(45, 31, 53, 25, on ? 'lampGlow.b' : 'lamp.d');
		if (on) p.set(48, 29, 'fixed.white').set(49, 28, 'lampGlow.l');
	})
};
