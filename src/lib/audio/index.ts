import { currentPlayer, player } from './session';

export type SceneTime = 'morning' | 'day' | 'dusk' | 'night';
export type SceneSound =
	| 'type'
	| 'pet-start'
	| 'pet-end'
	| 'margot-wake'
	| 'margot-stretch'
	| 'sip'
	| 'cup-down'
	| 'sticker-hover'
	| 'sticker-click'
	| 'palette-open'
	| 'palette-change';

const DEFAULT_CROSSFADE_SECONDS = 2;

let soundOn = false;
let sceneTime: SceneTime = 'day';

/** Called from the sound toggle's click handler (a user gesture). Starts or stops music, crackle and effects. */
export async function setSoundOn(on: boolean): Promise<void> {
	if (on === soundOn) return;
	soundOn = on;
	await (on ? player().start(sceneTime) : currentPlayer()?.stop());
}

export function isSoundOn(): boolean {
	return soundOn;
}

/** Fire-and-forget. Does nothing while sound is off. */
export function playSceneSound(sound: SceneSound): void {
	if (soundOn) currentPlayer()?.play(sound);
}

/** Called whenever the scene's time of day changes. `seconds` matches the lighting crossfade. */
export function setTimeOfDay(time: SceneTime, seconds = DEFAULT_CROSSFADE_SECONDS): void {
	sceneTime = time;
	currentPlayer()?.setTimeOfDay(time, seconds);
}
