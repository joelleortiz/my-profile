import { Player } from './player';

let instance: Player | undefined;

export function player(): Player {
	return (instance ??= new Player());
}

export function currentPlayer(): Player | undefined {
	return instance;
}
