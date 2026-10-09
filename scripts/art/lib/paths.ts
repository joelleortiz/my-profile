import { fileURLToPath } from 'node:url';
import type { Shade } from '../../../src/lib/scene/color.ts';
import type { Material } from '../../../src/lib/scene/materials.ts';

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const ART_DIR = fileURLToPath(new URL('../../../src/lib/scene/art/', import.meta.url));
export const KEY_PALETTE_JSON = `${ART_DIR}key-palette.json`;
export const KEY_PALETTE_GPL = `${ART_DIR}key-palette.gpl`;

export interface KeyPaletteFile {
	note: string;
	materials: Material[];
	shades: Shade[];
	keys: Record<Material, [string, string, string, string]>;
	fixed: Record<string, string>;
}
