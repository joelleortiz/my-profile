import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { AseSheetJson } from '../../src/lib/scene/sprites.ts';
import type { SceneLayout } from '../../src/lib/scene/layout.ts';
import { ART_DIR, KEY_PALETTE_JSON, ROOT, type KeyPaletteFile } from './lib/paths.ts';

const SPEC = `${ROOT}ART_SPEC.md`;

type SheetMeta = AseSheetJson;

function readSheets(): [string, SheetMeta][] {
	return readdirSync(ART_DIR)
		.filter((f) => f.endsWith('.json') && f !== 'scene.json' && f !== 'key-palette.json')
		.map((f) => [
			f.replace(/\.json$/, ''),
			JSON.parse(readFileSync(ART_DIR + f, 'utf8')) as SheetMeta
		]);
}

function frameList(json: SheetMeta) {
	return Array.isArray(json.frames) ? json.frames : Object.values(json.frames);
}

const rect = (r: { x: number; y: number; w: number; h: number }) => `${r.x}, ${r.y}, ${r.w}×${r.h}`;

function durations(json: SheetMeta, from: number, to: number): string {
	const ms = frameList(json)
		.slice(from, to + 1)
		.map((f) => f.duration ?? 100);
	return ms.every((d) => d === ms[0]) ? `${ms.length} × ${ms[0]} ms` : ms.join(', ') + ' ms';
}

function anchorOf(json: SheetMeta): string {
	const key = json.meta.slices?.find((s) => s.name === 'anchor')?.keys[0];
	if (!key) return 'bottom centre';
	const p = key.pivot ?? { x: Math.floor(key.bounds.w / 2), y: key.bounds.h };
	return `${key.bounds.x + p.x}, ${key.bounds.y + p.y}`;
}

function slicesOf(json: SheetMeta): string {
	const slices = (json.meta.slices ?? []).filter((s) => s.name !== 'anchor');
	if (!slices.length) return '–';
	return slices
		.map((s) => {
			const shown = s.keys.filter((k) => k.bounds.w > 0);
			const unique = new Set(shown.map((k) => rect(k.bounds)));
			if (unique.size === 1 && shown.length === s.keys.length)
				return `\`${s.name}\` ${[...unique][0]}`;
			return `\`${s.name}\` per frame (${shown.length} of ${s.keys.length} frames)`;
		})
		.join('<br>');
}

function tagsOf(json: SheetMeta): string {
	const tags = json.meta.frameTags ?? [];
	if (!tags.length) return `(no tags) ${durations(json, 0, frameList(json).length - 1)}`;
	return tags
		.map((t) => {
			const extras = [
				t.direction && t.direction !== 'forward' ? t.direction : '',
				t.repeat ? `plays ${t.repeat}×` : '',
				t.data ? `events ${t.data}` : ''
			].filter(Boolean);
			return `\`${t.name}\` ${t.from}–${t.to}: ${durations(json, t.from, t.to)}${extras.length ? ` (${extras.join(', ')})` : ''}`;
		})
		.join('<br>');
}

function placements(scene: SceneLayout, name: string): string {
	const items = scene.draw.filter((d) => 'sprite' in d && d.sprite === name);
	if (!items.length) return '–';
	return items
		.map((d) => {
			if (!('sprite' in d)) return '';
			const where = d.attach
				? `on \`${d.attach[0]}\` slice \`${d.attach[1]}\`${d.at ? `, else ${d.at.join(', ')}` : ''}`
				: d.at?.join(', ');
			const notes = [
				d.tag ? `tag \`${d.tag}\`` : '',
				d.dark ? `\`${d.dark}\` after dark` : '',
				d.weight ? `shown by \`${d.weight}\`` : '',
				d.requires ? `needs \`${d.requires}\`` : ''
			].filter(Boolean);
			return `${d.layer}: ${where}${notes.length ? ` (${notes.join(', ')})` : ''}`;
		})
		.join('<br>');
}

function spriteTable(): string {
	const scene = JSON.parse(readFileSync(ART_DIR + 'scene.json', 'utf8')) as SceneLayout;
	const order = scene.draw.flatMap((d) => ('sprite' in d ? [d.sprite] : []));
	const sheets = readSheets().sort(([a], [b]) => order.indexOf(a) - order.indexOf(b));
	const rows = sheets.map(([name, json]) => {
		const f = frameList(json)[0];
		const size = f.sourceSize ?? { w: f.frame.w, h: f.frame.h };
		return `| \`${name}\` | ${size.w}×${size.h} | ${anchorOf(json)} | ${frameList(json).length} | ${tagsOf(json)} | ${slicesOf(json)} | ${placements(scene, name)} |`;
	});
	return [
		'| Sprite | Frame | Anchor | Frames | Tags (frames: durations) | Slices (x, y, w×h) | Placement (layer: scene x, y) |',
		'|---|---|---|---|---|---|---|',
		...rows
	].join('\n');
}

function paletteTable(): string {
	const key = JSON.parse(readFileSync(KEY_PALETTE_JSON, 'utf8')) as KeyPaletteFile;
	const rows = key.materials.map((m, i) => {
		const cells = key.keys[m].map((hex, s) => `\`${hex}\` (${1 + i * 4 + s})`);
		return `| \`${m}\` | ${cells.join(' | ')} |`;
	});
	const fixed = Object.entries(key.fixed).map(
		([name, hex], i) =>
			`| \`${name}\` (fixed) | | | \`${hex}\` (${1 + key.materials.length * 4 + i}) | |`
	);
	return ['| Material | d2 (index) | d | b | l |', '|---|---|---|---|---|', ...rows, ...fixed].join(
		'\n'
	);
}

function replaceBetween(text: string, marker: string, content: string): string {
	const start = `<!-- ${marker}:start -->`;
	const end = `<!-- ${marker}:end -->`;
	const a = text.indexOf(start);
	const b = text.indexOf(end);
	if (a < 0 || b < 0) throw new Error(`ART_SPEC.md is missing the ${marker} markers`);
	return text.slice(0, a + start.length) + '\n\n' + content + '\n\n' + text.slice(b);
}

let spec = readFileSync(SPEC, 'utf8');
spec = replaceBetween(spec, 'sprites', spriteTable());
spec = replaceBetween(spec, 'palette', paletteTable());
writeFileSync(SPEC, spec);
console.log('Updated the sprite and key-palette tables in ART_SPEC.md.');
