import type { SpriteDef } from '../lib/sheet.ts';
import { hearts, zzz } from './cats.ts';
import { city, clouds } from './room.ts';
import { studySprites } from './study.ts';

/** Sheets the scene draws. */
export const sprites: SpriteDef[] = [clouds, city, ...studySprites, zzz, hearts];
