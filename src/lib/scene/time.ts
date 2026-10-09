import type { SceneTime } from './palettes.ts';

export type { SceneTime };

export const TIMES: readonly SceneTime[] = ['morning', 'day', 'dusk', 'night'];

export const TIME_STARTS: Record<SceneTime, number> = { morning: 6, day: 10, dusk: 17, night: 20 };

export const CROSSFADE_SECONDS = 8;

export function timeOfDay(date: Date = new Date()): SceneTime {
	const h = date.getHours();
	if (h >= TIME_STARTS.morning && h < TIME_STARTS.day) return 'morning';
	if (h >= TIME_STARTS.day && h < TIME_STARTS.dusk) return 'day';
	if (h >= TIME_STARTS.dusk && h < TIME_STARTS.night) return 'dusk';
	return 'night';
}

export function isSceneTime(value: unknown): value is SceneTime {
	return typeof value === 'string' && (TIMES as readonly string[]).includes(value);
}

export const isDark = (time: SceneTime) => time === 'dusk' || time === 'night';

export const uiMode = (time: SceneTime) => (isDark(time) ? 'dark' : 'light');
