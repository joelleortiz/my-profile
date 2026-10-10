// The cats' floating effects: hearts while Myles is petted, z's while Margot sleeps.
import { Pixels, type Ink, type SpriteDef } from '../lib/sheet.ts';

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
