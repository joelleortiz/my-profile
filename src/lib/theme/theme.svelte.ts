import { dev } from '$app/env';
import { DEFAULT_PALETTE, isPaletteKey, type PaletteKey } from '../scene/palettes.ts';
import { isSceneTime, timeOfDay, uiMode, type SceneTime } from '../scene/time.ts';
import { PALETTE_STORAGE_KEY, TIME_STORAGE_KEY } from './head.ts';

function read(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

class Theme {
	palette = $state<PaletteKey>(DEFAULT_PALETTE);
	override = $state<SceneTime | null>(null);
	clock = $state<SceneTime>(timeOfDay());
	time = $derived<SceneTime>(this.override ?? this.clock);
	mode = $derived(uiMode(this.time));

	start(): () => void {
		const palette = read(PALETTE_STORAGE_KEY);
		if (isPaletteKey(palette)) this.palette = palette;
		const time = read(TIME_STORAGE_KEY);
		if (isSceneTime(time)) this.override = time;
		if (dev) {
			(globalThis as Record<string, unknown>).__theme = this;
			const q = new URLSearchParams(location.search);
			const p = q.get('palette');
			const t = q.get('time');
			if (isPaletteKey(p)) this.palette = p;
			if (isSceneTime(t)) this.override = t;
		}
		this.clock = timeOfDay();

		const tick = () => (this.clock = timeOfDay());
		const timer = setInterval(tick, 60_000);
		const onVisible = () => document.visibilityState === 'visible' && tick();
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', onVisible);
		};
	}
}

export const theme = new Theme();
