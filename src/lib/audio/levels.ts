export const DEFAULT_LEVELS = {
	music: -9.1,
	crackle: -9.1,
	sfxBus: -14,
	typing: -9,
	blips: 0,
	stickerHover: -8,
	stickerClick: 0,
	foley: -3,
	cats: -3,
	purr: -3
};

export const PITCH_SPREAD = 0.03;
export const GAIN_SPREAD_DB = 2;

export type LevelName = keyof typeof DEFAULT_LEVELS;
export type Levels = Record<LevelName, number>;
export type SoundGroup = Exclude<LevelName, 'music' | 'crackle' | 'sfxBus'>;

export function dbToGain(db: number): number {
	return 10 ** (db / 20);
}
