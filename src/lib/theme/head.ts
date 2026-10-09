import { DEFAULT_PALETTE, PALETTE_KEYS, PALETTES, type UiTokens } from '../scene/palettes.ts';
import { TIME_STARTS } from '../scene/time.ts';

export const PALETTE_STORAGE_KEY = 'scene-palette';
export const TIME_STORAGE_KEY = 'scene-time';

const TOKENS: (keyof UiTokens)[] = ['bg', 'surface', 'ink', 'soft', 'accent', 'line'];

function declarations(tokens: UiTokens): string {
	return TOKENS.map((t) => `--${t}:${tokens[t]}`).join(';');
}

export function themeCss(): string {
	const rules = PALETTE_KEYS.flatMap((key) =>
		(['light', 'dark'] as const).map(
			(mode) =>
				`:root[data-palette="${key}"][data-mode="${mode}"]{${declarations(PALETTES[key].ui[mode])};color-scheme:${mode}}`
		)
	);
	const fallback = PALETTES[DEFAULT_PALETTE].ui;
	return [
		`:root{${declarations(fallback.light)}}`,
		`@media (prefers-color-scheme:dark){:root:not([data-mode]){${declarations(fallback.dark)};color-scheme:dark}}`,
		...rules
	].join('\n');
}

export function bootScript(dev: boolean): string {
	const palettes = JSON.stringify(PALETTE_KEYS);
	const s = TIME_STARTS;
	return `(function(){var d=document.documentElement;d.classList.add('js');function g(k){try{return localStorage.getItem(k)}catch(e){return null}}var P=${palettes},T=['morning','day','dusk','night'],p=g('${PALETTE_STORAGE_KEY}'),t=g('${TIME_STORAGE_KEY}');${
		dev
			? `var q=new URLSearchParams(location.search);if(q.get('palette'))p=q.get('palette');if(q.get('time'))t=q.get('time');`
			: ''
	}if(P.indexOf(p)<0)p='${DEFAULT_PALETTE}';if(T.indexOf(t)<0){var h=new Date().getHours();t=h>=${s.morning}&&h<${s.day}?'morning':h>=${s.day}&&h<${s.dusk}?'day':h>=${s.dusk}&&h<${s.night}?'dusk':'night'}d.dataset.palette=p;d.dataset.time=t;d.dataset.mode=t==='dusk'||t==='night'?'dark':'light'})();`;
}
