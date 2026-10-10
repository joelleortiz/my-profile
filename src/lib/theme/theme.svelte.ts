import { dev } from '$app/env';
import { DEFAULT_PALETTE, isPaletteKey, PALETTE_KEYS, type PaletteKey } from '../scene/palettes.ts';
import { isSceneTime, timeOfDay, TIMES, uiMode, type SceneTime } from '../scene/time.ts';
import { PALETTE_STORAGE_KEY, TIME_STORAGE_KEY } from './keys.ts';

function read(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function write(key: string, value: string | null): void {
	try {
		if (value === null) localStorage.removeItem(key);
		else localStorage.setItem(key, value);
	} catch {
		// Private mode or storage blocked: the choice lasts for this visit only.
	}
}

/** The clock's steps: following the visitor's clock (null), then each time of day. */
const TIME_STEPS: readonly (SceneTime | null)[] = [null, ...TIMES];

class Theme {
	palette = $state<PaletteKey>(DEFAULT_PALETTE);
	override = $state<SceneTime | null>(null);
	clock = $state<SceneTime>(timeOfDay());
	time = $derived<SceneTime>(this.override ?? this.clock);
	mode = $derived(uiMode(this.time));

	/** Sets and remembers the palette. The head script reads it back before the next paint. */
	setPalette(palette: PaletteKey): void {
		this.palette = palette;
		write(PALETTE_STORAGE_KEY, palette);
	}

	/** Sets and remembers a chosen time of day; null follows the visitor's clock again. */
	setOverride(time: SceneTime | null): void {
		this.override = time;
		write(TIME_STORAGE_KEY, time);
	}

	nextPalette(): void {
		const i = PALETTE_KEYS.indexOf(this.palette);
		this.setPalette(PALETTE_KEYS[(i + 1) % PALETTE_KEYS.length]);
	}

	nextTime(): void {
		const i = TIME_STEPS.indexOf(this.override);
		this.setOverride(TIME_STEPS[(i + 1) % TIME_STEPS.length]);
	}

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
