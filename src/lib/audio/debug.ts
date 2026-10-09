import type { PlayerStatus } from './player';
import { currentPlayer } from './session';

export type { PlayerStatus };

export function audioStatus(): PlayerStatus | undefined {
	return currentPlayer()?.status();
}
