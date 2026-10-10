// Prints the scene positions of the study's projected sprites, for scene.json.
import { EYES, PROPS, placed } from './sprites/study.ts';

const rows: [string, [number, number]][] = [
	['me (eyes)', EYES],
	...Object.entries(placed).map(([name, p]) => [name, p.at] as [string, [number, number]]),
	...Object.entries(PROPS).map(
		([name, at]) => [`${name} (anchor)`, at] as [string, [number, number]]
	)
];
for (const [name, [x, y]] of rows) console.log(`${name.padEnd(18)} ${x}, ${y}`);
