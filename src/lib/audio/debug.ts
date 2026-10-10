import { DEFAULT_LEVELS, type LevelName, type Levels } from './levels';
import type { PlayerStatus } from './player';
import { currentPlayer, levels } from './session';

export { DEFAULT_LEVELS };
export type { LevelName, Levels, PlayerStatus };

export function audioStatus(): PlayerStatus | undefined {
	return currentPlayer()?.status();
}

export function currentLevels(): Levels {
	return { ...levels };
}

export function setLevel(name: LevelName, db: number): void {
	levels[name] = db;
	currentPlayer()?.applyLevels();
}

export function resetLevels(): void {
	Object.assign(levels, DEFAULT_LEVELS);
	currentPlayer()?.applyLevels();
}
