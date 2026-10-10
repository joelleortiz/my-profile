// The view outside the window: clouds and the city skyline.
import { frames, Pixels, type SpriteDef } from '../lib/sheet.ts';

const still = (draw: (p: Pixels) => void) => [{ duration: 1000, draw }];

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
