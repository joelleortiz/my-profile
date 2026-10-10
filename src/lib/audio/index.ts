import { savedChoice, saveChoice } from './choice';
import { onGesturesOutside } from './gesture';
import { preloadLoopWhenIdle } from './preload';
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
	| 'palette-change';

const DEFAULT_CROSSFADE_SECONDS = 2;

let soundOn = false;
let sceneTime: SceneTime = 'day';
let choice: boolean | undefined;
let stopWaitingForGesture = (): void => {};
let cancelPreload = (): void => {};

/** Called from the sound toggle's click handler (a user gesture). Starts or stops music, crackle and effects. */
export async function setSoundOn(on: boolean): Promise<void> {
	if (on === soundOn) return;
	soundOn = on;
	await (on ? player().start(sceneTime) : currentPlayer()?.stop());
}

export function isSoundOn(): boolean {
	return soundOn;
}

/** The visitor's last choice from the sound toggle, or on if they never made one. */
export function wantsSound(): boolean {
	return choice ?? savedChoice() ?? true;
}

/** Applies the visitor's choice from the sound toggle and remembers it for their next visit. */
export function chooseSound(on: boolean): Promise<void> {
	choice = on;
	stopWaitingForGesture();
	cancelPreload();
	saveChoice(on);
	return setSoundOn(on);
}

/** Downloads the music once the page is idle, so the first gesture only has to decode it. Call it after the page's own assets have loaded. */
export function preloadMusic(): void {
	if (wantsSound() && !soundOn) cancelPreload = preloadLoopWhenIdle();
}

/**
 * Turns sound on at the first click, tap or key press outside `toggle`, since browsers block audio until then.
 * Gestures on the toggle are left to its own handler. Returns a function that stops waiting.
 */
export function startSoundAtFirstGesture(toggle: Element): () => void {
	stopWaitingForGesture();
	if (soundOn) return stopWaitingForGesture;
	stopWaitingForGesture = onGesturesOutside(toggle, startAtGesture);
	return stopWaitingForGesture;
}

function startAtGesture(): void {
	const starting = soundOn ? player().unlock() : setSoundOn(true);
	// A gesture the browser doesn't count leaves the context locked, so the next one tries again.
	starting.catch(() => {});
	void player().unlocked.then(stopWaitingForGesture);
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
