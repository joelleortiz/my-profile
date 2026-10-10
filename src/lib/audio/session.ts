import { DEFAULT_LEVELS, type Levels } from './levels';
import { Player } from './player';

let instance: Player | undefined;

export const levels: Levels = { ...DEFAULT_LEVELS };

export function player(): Player {
	return (instance ??= new Player(levels));
}

export function currentPlayer(): Player | undefined {
	return instance;
}
