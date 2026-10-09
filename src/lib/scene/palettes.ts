export const DEFAULT_PALETTE = 'moody';
// prettier-ignore
export const ENDESGA32 = ['#be4a2f','#d77643','#ead4aa','#e4a672','#b86f50','#733e39','#3e2731','#a22633','#e43b44','#f77622','#feae34','#fee761','#63c74d','#3e8948','#265c42','#193c3e','#124e89','#0099db','#2ce8f5','#ffffff','#c0cbdc','#8b9bb4','#5a6988','#3a4466','#262b44','#181425','#ff0044','#68386c','#b55088','#f6757a','#e8b796','#c28569'];

// prettier-ignore
export const PALETTES = {
  moody: {
    name: 'Cool & moody', shadowHue: 245, lightHue: 190,
    base: { wall:'#3d4268', floor:'#2c2f4d', desk:'#4d4669', chair:'#2f2a47', rug:'#5a4a7d', plant:'#3f7d76', pot:'#6f5b8f', frame:'#5a6090', poster:'#4f5584', curtain:'#4a3d78', skin:'#d6a68c', hair:'#141226', glasses:'#e3a0b2', sweater:'#6b7fd4', laptop:'#9da6c8', tabby:'#8e8ba3', catWhite:'#e8e5f3', nose:'#e08aa2', eye:'#8fd8b2', coffee:'#5a3a3c', milk:'#c9a390', straw:'#e070a4', lamp:'#f0c26e', lampGlow:'#ffd383', cushion:'#5b4a8c', screen:'#8fe4ff' },
    books: ['#7b5dc6','#3c909b','#c65d8c'], stickers: ['#ff70a9','#5ae0d0','#ffd36e','#9c8cff'], building: '#262a52',
    sky: { morning:{top:'#6f7fb8',bottom:'#e7b0bf',orb:'#ffe6d0'}, day:{top:'#7aa7d6',bottom:'#c4dcef',orb:'#f6f4ff'}, dusk:{top:'#33285f',bottom:'#d06f8a',orb:'#ffc28a'}, night:{top:'#0b0d22',bottom:'#1f2350',orb:'#e9e6ff'} },
    tint: { morning:['#a7a8d8',.14], day:['#c3c8ea',.08], dusk:['#5b3f8f',.32], night:['#15183a',.58] },
    ui: { light:{bg:'#e3e5f1',surface:'#f1f2f9',ink:'#1f2241',soft:'#555a85',accent:'#5655d2',line:'#c8cbe1'}, dark:{bg:'#11122a',surface:'#1b1d39',ink:'#e3e5f1',soft:'#9aa2c6',accent:'#a092ff',line:'#2f3257'} }
  },
  pastel: {
    name: 'Soft pastel', shadowHue: 268, lightHue: 52,
    base: { wall:'#e9def2', floor:'#d8b7c6', desk:'#f0c4b0', chair:'#a9d6cb', rug:'#c5e4d3', plant:'#93cba1', pot:'#f2a9b8', frame:'#fffaff', poster:'#d6e9f7', curtain:'#f6c3d2', skin:'#efc6a2', hair:'#3b3245', glasses:'#e7a3b3', sweater:'#b4cff0', laptop:'#ddd7ea', tabby:'#a89a98', catWhite:'#fdf8fb', nose:'#f29bae', eye:'#9fd1a6', coffee:'#a87e70', milk:'#f1dbc9', straw:'#f497b0', lamp:'#f6d58a', lampGlow:'#ffe3a3', cushion:'#cab7ee', screen:'#d4f0ff' },
    books: ['#c3aeea','#9ed6c8','#ffc2a1'], stickers: ['#ff9fb4','#8fd8c8','#ffd889','#b6a3f2'], building: '#a395c4',
    sky: { morning:{top:'#ffcfdd',bottom:'#fff1df',orb:'#fff8e8'}, day:{top:'#aedcf4',bottom:'#e9f7fc',orb:'#fffbe8'}, dusk:{top:'#c99ad6',bottom:'#ffc6a8',orb:'#ffe6b8'}, night:{top:'#3f3f78',bottom:'#776aa8',orb:'#fff2d6'} },
    tint: { morning:['#ffe3ea',.15], day:null, dusk:['#e7a9c9',.28], night:['#47427f',.55] },
    ui: { light:{bg:'#f6eff6',surface:'#fffafd',ink:'#43395a',soft:'#736788',accent:'#8354c4',line:'#e3d3e9'}, dark:{bg:'#231f3a',surface:'#2e2949',ink:'#f3ebf7',soft:'#b9acd1',accent:'#c7a3f3',line:'#433b63'} }
  },
  warm: {
    name: 'Warm & cozy', shadowHue: 345, lightHue: 48,
    base: { wall:'#ead5b8', floor:'#a8744f', desk:'#8f5d3d', chair:'#5e7d78', rug:'#cf8a5a', plant:'#6f9150', pot:'#c06d45', frame:'#f6ead8', poster:'#eccb98', curtain:'#e2a95f', skin:'#e0b08c', hair:'#2a201d', glasses:'#d69a94', sweater:'#d08a5c', laptop:'#bdb6ad', tabby:'#8e806e', catWhite:'#f6f0e6', nose:'#de8474', eye:'#93b06a', coffee:'#6d4027', milk:'#dcb790', straw:'#3a302b', lamp:'#d9b05a', lampGlow:'#ffd27e', cushion:'#b9604a', screen:'#cfe6ff' },
    books: ['#a9553d','#5f7f5b','#d7a64e'], stickers: ['#e07a5f','#81b29a','#f2cc8f','#5b5f86'], building: '#7a5a55',
    sky: { morning:{top:'#f6c89f',bottom:'#fbe6c8',orb:'#fff3d0'}, day:{top:'#8fc1dc',bottom:'#d6ecf3',orb:'#fff8e0'}, dusk:{top:'#a85a6a',bottom:'#f2a865',orb:'#ffd27a'}, night:{top:'#1c2038',bottom:'#3b3355',orb:'#f3e7c4'} },
    tint: { morning:['#ffe1bd',.18], day:null, dusk:['#e6a07a',.32], night:['#2b2a52',.6] },
    ui: { light:{bg:'#f1e4d1',surface:'#f9f0e3',ink:'#3b2a22',soft:'#76594a',accent:'#a14e2a',line:'#dcc4a5'}, dark:{bg:'#221915',surface:'#2e231d',ink:'#f1e4d1',soft:'#c7aa90',accent:'#ea9466',line:'#4b3a2f'} }
  },
  retro: {
    name: 'Retro 32', shadowHue: 250, lightHue: 50, quantize: 'ENDESGA32',
    base: { wall:'#c0cbdc', floor:'#b86f50', desk:'#733e39', chair:'#3a4466', rug:'#a22633', plant:'#3e8948', pot:'#be4a2f', frame:'#ead4aa', poster:'#ead4aa', curtain:'#b55088', skin:'#e8b796', hair:'#181425', glasses:'#f6757a', sweater:'#0099db', laptop:'#c0cbdc', tabby:'#8b9bb4', catWhite:'#ffffff', nose:'#f6757a', eye:'#63c74d', coffee:'#733e39', milk:'#e4a672', straw:'#e43b44', lamp:'#feae34', lampGlow:'#fee761', cushion:'#68386c', screen:'#2ce8f5' },
    books: ['#a22633','#124e89','#feae34'], stickers: ['#e43b44','#2ce8f5','#fee761','#63c74d'], building: '#3a4466',
    sky: { morning:{top:'#e8b796',bottom:'#fee761',orb:'#ffffff'}, day:{top:'#0099db',bottom:'#2ce8f5',orb:'#fee761'}, dusk:{top:'#68386c',bottom:'#f77622',orb:'#feae34'}, night:{top:'#181425',bottom:'#262b44',orb:'#c0cbdc'} },
    tint: { morning:['#feae34',.12], day:null, dusk:['#b55088',.3], night:['#262b44',.62] },
    ui: { light:{bg:'#ead4aa',surface:'#f3e2c0',ink:'#181425',soft:'#3a4466',accent:'#a22633',line:'#c28569'}, dark:{bg:'#181425',surface:'#262b44',ink:'#ead4aa',soft:'#8b9bb4',accent:'#feae34',line:'#3a4466'} }
  }
} as const;

export type PaletteKey = keyof typeof PALETTES;
export type Palette = (typeof PALETTES)[PaletteKey];
export type BaseMaterial = keyof Palette['base'];
export type SceneTime = keyof Palette['sky'];
export type UiMode = keyof Palette['ui'];
export type UiTokens = Palette['ui'][UiMode];

export const PALETTE_KEYS = Object.keys(PALETTES) as PaletteKey[];

export function isPaletteKey(value: unknown): value is PaletteKey {
	return typeof value === 'string' && Object.hasOwn(PALETTES, value);
}
