import type { SpriteDef } from '../lib/sheet.ts';
import { cushion, hearts, margotSprite, mylesSprite, zzz } from './cats.ts';
import {
	chair,
	coffee,
	desk,
	lamp,
	laptop,
	stickerCats,
	stickerCode,
	stickerGithub,
	stickerName,
	stickerScroll
} from './desk.ts';
import { me, meFace } from './me.ts';
import {
	city,
	clouds,
	curtains,
	floor,
	floorPlant,
	leaves,
	poster,
	rug,
	shelf,
	wall,
	windowFrame
} from './room.ts';

export const sprites: SpriteDef[] = [
	clouds,
	city,
	wall,
	windowFrame,
	curtains,
	poster,
	shelf,
	floorPlant,
	floor,
	rug,
	chair,
	me,
	meFace,
	desk,
	laptop,
	stickerGithub,
	stickerName,
	stickerCats,
	stickerCode,
	stickerScroll,
	coffee,
	lamp,
	mylesSprite,
	hearts,
	cushion,
	margotSprite,
	zzz,
	leaves
];
