import {
	DEFAULT_PALETTE,
	PALETTE_KEYS,
	PALETTES,
	type PaletteKey,
	type UiTokens
} from '../scene/palettes.ts';
import fitViewSource from '../scene/fit-view.js?raw';
import { GEOMETRY } from '../scene/layout.ts';
import { paletteRamps, SWATCH_CHIPS } from '../scene/materials.ts';
import { TIME_STARTS } from '../scene/time.ts';
import { PALETTE_STORAGE_KEY, TIME_STORAGE_KEY } from './keys.ts';

const TOKENS: (keyof UiTokens)[] = ['bg', 'surface', 'ink', 'soft', 'accent', 'line'];

function declarations(tokens: UiTokens): string {
	return TOKENS.map((t) => `--${t}:${tokens[t]}`).join(';');
}

/**
 * The same in either mode: ink for text on paper in the room (sign, notes), the light-mode ink
 * whatever the time of day, and the paint-swatch card's chips as the room draws them.
 */
function paletteDeclarations(key: PaletteKey): string {
	const ramps = paletteRamps(key);
	return [
		`--paper-ink:${PALETTES[key].ui.light.ink}`,
		...SWATCH_CHIPS.map((chip, i) => `--swatch-${i + 1}:${ramps[chip].b}`)
	].join(';');
}

export function themeCss(): string {
	const rules = PALETTE_KEYS.flatMap((key) =>
		(['light', 'dark'] as const).map(
			(mode) =>
				`:root[data-palette="${key}"][data-mode="${mode}"]{${declarations(PALETTES[key].ui[mode])};${paletteDeclarations(key)};color-scheme:${mode}}`
		)
	);
	const fallback = PALETTES[DEFAULT_PALETTE].ui;
	return [
		`:root{${declarations(fallback.light)};${paletteDeclarations(DEFAULT_PALETTE)}}`,
		`@media (prefers-color-scheme:dark){:root:not([data-mode]){${declarations(fallback.dark)};color-scheme:dark}}`,
		...rules
	].join('\n');
}

function layoutScript(): string {
	const source = fitViewSource.replace(/^export /gm, '');
	const geometry = JSON.stringify(GEOMETRY);
	return `(function(){${source}\nvar v=viewportSize();applyView(fitView(v.w,v.h,devicePixelRatio||1,${geometry},v.full),document.documentElement)})();`;
}

/** Sets the palette, time of day and mode; with `room`, also fits the scene's layout before paint. */
export function bootScript(dev: boolean, room: boolean): string {
	const palettes = JSON.stringify(PALETTE_KEYS);
	const s = TIME_STARTS;
	return `(function(){var d=document.documentElement;d.classList.add('js');function g(k){try{return localStorage.getItem(k)}catch(e){return null}}var P=${palettes},T=['morning','day','dusk','night'],p=g('${PALETTE_STORAGE_KEY}'),t=g('${TIME_STORAGE_KEY}');${
		dev
			? `var q=new URLSearchParams(location.search);if(q.get('palette'))p=q.get('palette');if(q.get('time'))t=q.get('time');`
			: ''
	}if(P.indexOf(p)<0)p='${DEFAULT_PALETTE}';if(T.indexOf(t)<0){var h=new Date().getHours();t=h>=${s.morning}&&h<${s.day}?'morning':h>=${s.day}&&h<${s.dusk}?'day':h>=${s.dusk}&&h<${s.night}?'dusk':'night'}d.dataset.palette=p;d.dataset.time=t;d.dataset.mode=t==='dusk'||t==='night'?'dark':'light'})();${room ? layoutScript() : ''}`;
}
