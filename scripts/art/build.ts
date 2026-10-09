import { writeSheet } from './lib/sheet.ts';
import { sprites } from './sprites/index.ts';

const only = process.argv.slice(2);
let total = 0;
for (const def of sprites) {
	if (only.length && !only.includes(def.name)) continue;
	const bytes = writeSheet(def);
	total += bytes;
	console.log(`${def.name.padEnd(16)} ${String(def.frames.length).padStart(3)} frames  ${bytes} B`);
}
console.log(`${(total / 1024).toFixed(1)} KB of PNG written (budget for all sheets: 500 KB).`);
