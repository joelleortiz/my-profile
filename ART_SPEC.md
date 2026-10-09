# Art spec

Everything needed to redraw any sprite of the desk scene in Aseprite and drop it in without touching code.

## The canvas

- Native resolution **480 × 270**. The page scales it by whole numbers only (1×, 2×, 3× … device pixels per scene pixel) with nearest-neighbour sampling, so draw at 1:1 and never anti-alias against transparency.
- Light comes from the window, top left. Shade surfaces facing away from it with the `d` and `d2` shades.
- Sprite positions are whole pixels. Parallax offsets are rounded to whole pixels too.

## Layers and parallax

Back to front. The parallax factor is the share of the maximum offset (6 px across, 3 px down) a layer moves as the pointer crosses the scene; negative moves against the pointer.

| Layer        | Parallax | Contents                                                                                                                  |
| ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| `far`        | +1.0     | Sky gradient, sun, moon and stars (drawn by code), `clouds`, `city`. Visible only through the window's transparent panes. |
| `wall`       | +0.35    | `wall`, `window`, `curtains`, `poster`, `shelf`, `floor-plant`. The window shaft light moves with this layer.             |
| `near`       | 0        | `floor`, `rug`, `chair`, `me`, `me-face`, `desk`, `laptop`, the stickers, `coffee`, `lamp`, `myles`, `hearts`.            |
| `front`      | −0.5     | `cushion`, `margot`, `zzz`.                                                                                               |
| `foreground` | −1.0     | `leaves`.                                                                                                                 |

Sprites that sit at a layer edge are drawn a few pixels wider than the scene (the wall is 492 px wide from x −6) so parallax never shows a gap.

## The wall

Plain `wall.b`, with a picture rail near the ceiling (`frame` shades) and a skirting board above the floor. Joelle decided against a sayagata wallpaper; the old site's tile is still in `src/lib/assets/sayagata-400px.png` but nothing uses it.

## The key palette

Every sprite is drawn in the **key palette**: 34 materials with four shades each, ordered dark to light: `d2` (deep shadow), `d` (shadow), `b` (base), `l` (highlight). At runtime each key colour is replaced by the same material and shade from the active palette, so one drawing works in all four palettes.

- Load `src/lib/scene/art/key-palette.gpl` in Aseprite (Palette → Load palette) and draw only with those colours. Index 0 is transparent.
- `white` is a fixed colour: it never changes with the palette (sticker die-cut borders, glints).
- Any colour that is not in the key palette passes through unchanged, which is almost never what you want.
- The key palette is frozen. `scripts/art/key-palette.ts` will not overwrite it unless run with `--force`, which would break every existing sheet.
- Each palette's ramps come from its base colours in `src/lib/scene/palettes.ts`: `d2` moves up to 26° toward the palette's shadow hue (saturation +0.06, lightness −0.27), `d` up to 13° (+0.03, −0.13), `l` up to 10° toward its light hue (−0.02, +0.10). Near-greys take the shadow and light hues with low saturation. Retro 32 then snaps every shade to Endesga 32 and dithers the finished frame.

<!-- palette:start -->

| Material        | d2 (index)      | d               | b               | l               |
| --------------- | --------------- | --------------- | --------------- | --------------- |
| `wall`          | `#121121` (1)   | `#252340` (2)   | `#3d4268` (3)   | `#526186` (4)   |
| `floor`         | `#0d0c18` (5)   | `#19172b` (6)   | `#2c2f4d` (7)   | `#404b6c` (8)   |
| `desk`          | `#151321` (9)   | `#2c2a43` (10)  | `#4d4669` (11)  | `#5e5d85` (12)  |
| `chair`         | `#0c0c16` (13)  | `#181628` (14)  | `#2f2a47` (15)  | `#3f3f65` (16)  |
| `rug`           | `#171528` (17)  | `#332f55` (18)  | `#5a4a7d` (19)  | `#685f9b` (20)  |
| `plant`         | `#112027` (21)  | `#274e53` (22)  | `#3f7d76` (23)  | `#52999d` (24)  |
| `pot`           | `#25233e` (25)  | `#463f69` (26)  | `#6f5b8f` (27)  | `#8278a5` (28)  |
| `frame`         | `#24223e` (29)  | `#423e6a` (30)  | `#5a6090` (31)  | `#7784a6` (32)  |
| `poster`        | `#1b1930` (33)  | `#37345d` (34)  | `#4f5584` (35)  | `#6676a0` (36)  |
| `curtain`       | `#121126` (37)  | `#28254e` (38)  | `#4a3d78` (39)  | `#545197` (40)  |
| `skin`          | `#a6323c` (41)  | `#c86758` (42)  | `#d6a68c` (43)  | `#e2cbb3` (44)  |
| `hair`          | `#05050c` (45)  | `#0a0915` (46)  | `#141226` (47)  | `#232648` (48)  |
| `glasses`       | `#c8319b` (49)  | `#d76a9f` (50)  | `#e3a0b2` (51)  | `#eec8d9` (52)  |
| `sweater`       | `#2d2392` (53)  | `#3935c8` (54)  | `#6b7fd4` (55)  | `#94aede` (56)  |
| `laptop`        | `#4e4893` (57)  | `#706fb3` (58)  | `#9da6c8` (59)  | `#bfc9d9` (60)  |
| `tabby`         | `#434064` (61)  | `#65618b` (62)  | `#8e8ba3` (63)  | `#a4b9bd` (64)  |
| `catWhite`      | `#8882cd` (65)  | `#bab6e0` (66)  | `#e8e5f3` (67)  | `#f5f5fa` (68)  |
| `nose`          | `#b8288f` (69)  | `#d55293` (70)  | `#e08aa2` (71)  | `#eab3cc` (72)  |
| `eye`           | `#33aba0` (73)  | `#5bcaa8` (74)  | `#8fd8b2` (75)  | `#b6e4d4` (76)  |
| `coffee`        | `#1c1016` (77)  | `#331f24` (78)  | `#5a3a3c` (79)  | `#775059` (80)  |
| `milk`          | `#923e46` (81)  | `#b76a60` (82)  | `#c9a390` (83)  | `#d9c6b3` (84)  |
| `straw`         | `#a91d9b` (85)  | `#d836a4` (86)  | `#e070a4` (87)  | `#e89bcc` (88)  |
| `lamp`          | `#c7350e` (89)  | `#ed802f` (90)  | `#f0c26e` (91)  | `#f4e49d` (92)  |
| `lampGlow`      | `#f83500` (93)  | `#ff9241` (94)  | `#ffd383` (95)  | `#fef1b7` (96)  |
| `cushion`       | `#1a1834` (97)  | `#353163` (98)  | `#5b4a8c` (99)  | `#6861a8` (100) |
| `screen`        | `#0557ff` (101) | `#4dadff` (102) | `#8fe4ff` (103) | `#c3f4fe` (104) |
| `book0`         | `#2a2376` (105) | `#4137aa` (106) | `#7b5dc6` (107) | `#8e84d2` (108) |
| `book1`         | `#13253a` (109) | `#27566d` (110) | `#3c909b` (111) | `#52a7b8` (112) |
| `book2`         | `#76236c` (113) | `#aa3783` (114) | `#c65d8c` (115) | `#d284b4` (116) |
| `sticker0`      | `#e500bf` (117) | `#ff2eae` (118) | `#ff70a9` (119) | `#fea4d7` (120) |
| `sticker1`      | `#17719a` (121) | `#23c3d4` (122) | `#5ae0d0` (123) | `#86e2e7` (124) |
| `sticker2`      | `#e33c00` (125) | `#ff912c` (126) | `#ffd36e` (127) | `#fef1a2` (128) |
| `sticker3`      | `#1702ff` (129) | `#594aff` (130) | `#9c8cff` (131) | `#c0c1fe` (132) |
| `building`      | `#0c0a1a` (133) | `#16142e` (134) | `#262a52` (135) | `#384773` (136) |
| `white` (fixed) |                 |                 | `#ffffff` (137) |                 |

<!-- palette:end -->

## Sprite sheets

Each sprite is a PNG sheet plus Aseprite JSON in `src/lib/scene/art/`, named after the sprite (`me.png`, `me.json`). The loader reads everything from the JSON; no frame coordinates live in the code.

Export from Aseprite with **File → Export Sprite Sheet**:

- Layout: any (by rows, horizontal strip or packed). Trim and padding are fine; trimmed frames are placed using `spriteSourceSize`.
- Output: JSON data, **Array** or **Hash**, with **Tags** and **Slices** ticked. Keep the image indexed with the key palette.
- Keep the sprite's name, its tags and its slices exactly as listed below.

The sheets in the repo are generated by `npm run art` from `scripts/art/sprites/*.ts` (drawing code plus small pixel grids). Once a sprite is replaced with a hand-drawn Aseprite export, remove it from the list in `scripts/art/sprites/index.ts` so the build stops overwriting it. `npm run art` also refreshes the tables in this file.

### Anchors and slices

- **Anchor:** the pivot of the slice named `anchor` (in Aseprite: the slice's pivot point). Without a pivot, the bottom centre of that slice; without the slice, the bottom centre of the frame. `at` in `scene.json` is where the anchor goes, in scene pixels.
- **Slices** are rectangles in frame pixels. A slice can have a key per frame; an empty key (0 × 0) means "not in this frame".
  - `hit`: the clickable area of `myles`, `margot`, `coffee` and each sticker. In scene pixels it is the sprite's top left plus the slice.
  - `face` (on `me`): where `me-face` is drawn, so blinks and the screen glint follow the head.
  - `cup` (on `me`): where the coffee's anchor goes while I hold it. Frames without it leave the cup on the desk.
  - `hearts` (on `myles`) and `zzz` (on `margot`): where the floating hearts and z's start.

### Tags and events

Tags name the actions. Frame durations come from the sheet. A tag's **user data** lists events fired when a frame of that tag starts, as `frame:event` pairs counted from the tag's first frame, for example `0:type 2:type`. The scene uses them for sounds: `type`, `pet-start`, `pet-end`, `sip`, `cup-down`, `margot-wake` and `margot-stretch`.

| Sprite          | Tag                                            | Meaning                                                                                                             |
| --------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `me`            | `type`                                         | Default loop; elbows bob, key presses on frames 0 and 2.                                                            |
|                 | `pet-reach`, `pet-stroke`, `pet-return`        | Reach to Myles (hand touches on the last frame), stroke loop, return.                                               |
|                 | `sip`                                          | Reach for the cup, lift it, sip (event on the first sip frame), put it down (`cup-down`), come back.                |
|                 | `stretch`, `glance`                            | Arms overhead; look out of the window.                                                                              |
| `me-face`       | `none`, `blink`, `happy`, `glint`              | Overlays for the eyes: nothing, a blink, closed happy eyes, and the screen's glint on the lenses after dark.        |
| `myles`         | `idle`, `swish`, `blink`, `ear`, `look`, `pet` | Breathing; tail swish; slow blink; ear flick; turns his head toward the viewer; eyes closed, leaning into the hand. |
| `margot`        | `sleep`, `ear`, `paw`, `wake`, `stretch`       | Breathing loop; ear twitch; dreaming paw twitch; lifts her head and blinks sleepily; full stretch and resettle.     |
| `coffee`        | `level5` … `level0`                            | Fill level, full to just ice; one step per sip.                                                                     |
| `lamp`, `city`  | `off`/`on`, `unlit`/`lit`                      | The second tag dissolves in after dark.                                                                             |
| `cushion`       | `back`, `front`                                | Drawn behind and in front of Margot so she sits in it.                                                              |
| `hearts`, `zzz` | `float`                                        | Hearts play once when Myles is petted; z's loop while Margot sleeps.                                                |

<!-- sprites:start -->

| Sprite           | Frame   | Anchor  | Frames | Tags (frames: durations)                                                                                                                                                                                                                                                                                                                                        | Slices (x, y, w×h)                                                                            | Placement (layer: scene x, y)                                 |
| ---------------- | ------- | ------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `clouds`         | 120×30  | 0, 0    | 1      | (no tags) 1 × 1000 ms                                                                                                                                                                                                                                                                                                                                           | –                                                                                             | far: 40, 30 (shown by `day`)                                  |
| `city`           | 160×36  | 0, 0    | 2      | `unlit` 0–0: 1 × 1000 ms<br>`lit` 1–1: 1 × 1000 ms                                                                                                                                                                                                                                                                                                              | –                                                                                             | far: 20, 90 (tag `unlit`, `lit` after dark)                   |
| `wall`           | 492×214 | 0, 0    | 1      | (no tags) 1 × 1000 ms                                                                                                                                                                                                                                                                                                                                           | –                                                                                             | wall: -6, 0                                                   |
| `window`         | 136×110 | 0, 0    | 1      | (no tags) 1 × 1000 ms                                                                                                                                                                                                                                                                                                                                           | –                                                                                             | wall: 30, 20                                                  |
| `curtains`       | 160×132 | 0, 0    | 1      | (no tags) 1 × 1000 ms                                                                                                                                                                                                                                                                                                                                           | –                                                                                             | wall: 18, 12                                                  |
| `poster`         | 70×52   | 0, 0    | 1      | (no tags) 1 × 1000 ms                                                                                                                                                                                                                                                                                                                                           | –                                                                                             | wall: 266, 30                                                 |
| `shelf`          | 104×70  | 0, 0    | 1      | (no tags) 1 × 1000 ms                                                                                                                                                                                                                                                                                                                                           | –                                                                                             | wall: 360, 64                                                 |
| `floor-plant`    | 64×100  | 0, 0    | 1      | (no tags) 1 × 1000 ms                                                                                                                                                                                                                                                                                                                                           | –                                                                                             | wall: -4, 108                                                 |
| `floor`          | 480×64  | 0, 0    | 1      | (no tags) 1 × 1000 ms                                                                                                                                                                                                                                                                                                                                           | –                                                                                             | near: 0, 206                                                  |
| `rug`            | 270×34  | 0, 0    | 1      | (no tags) 1 × 1000 ms                                                                                                                                                                                                                                                                                                                                           | –                                                                                             | near: 127, 226                                                |
| `chair`          | 62×72   | 0, 0    | 1      | (no tags) 1 × 1000 ms                                                                                                                                                                                                                                                                                                                                           | –                                                                                             | near: 222, 104                                                |
| `me`             | 152×132 | 76, 132 | 27     | `type` 0–3: 4 × 110 ms (events 0:type 2:type)<br>`pet-reach` 4–6: 120, 120, 160 ms (events 2:pet-start)<br>`pet-stroke` 7–10: 4 × 300 ms<br>`pet-return` 11–12: 2 × 120 ms (events 0:pet-end)<br>`sip` 13–20: 120, 160, 130, 500, 700, 130, 160, 120 ms (events 3:sip 6:cup-down)<br>`stretch` 21–25: 150, 220, 900, 200, 150 ms<br>`glance` 26–26: 1 × 1800 ms | `face` per frame (27 of 27 frames)<br>`cup` per frame (6 of 27 frames)<br>`hit` 44, 28, 64×70 | near: 254, 166 (tag `type`)                                   |
| `me-face`        | 32×32   | 0, 0    | 6      | `blink` 0–2: 50, 90, 50 ms<br>`happy` 3–3: 1 × 1000 ms<br>`glint` 4–4: 1 × 1000 ms<br>`none` 5–5: 1 × 1000 ms                                                                                                                                                                                                                                                   | –                                                                                             | near: on `me` slice `face` (tag `none`, `glint` after dark)   |
| `desk`           | 276×52  | 0, 0    | 1      | (no tags) 1 × 1000 ms                                                                                                                                                                                                                                                                                                                                           | –                                                                                             | near: 108, 160                                                |
| `laptop`         | 60×40   | 30, 40  | 1      | (no tags) 1 × 1000 ms                                                                                                                                                                                                                                                                                                                                           | –                                                                                             | near: 254, 164                                                |
| `sticker-github` | 19×14   | 0, 0    | 1      | (no tags) 1 × 1000 ms                                                                                                                                                                                                                                                                                                                                           | `hit` 0, 0, 18×13                                                                             | near: 229, 129                                                |
| `sticker-name`   | 20×15   | 0, 0    | 1      | (no tags) 1 × 1000 ms                                                                                                                                                                                                                                                                                                                                           | `hit` 0, 0, 19×14                                                                             | near: 251, 127                                                |
| `sticker-cats`   | 19×10   | 0, 0    | 1      | (no tags) 1 × 1000 ms                                                                                                                                                                                                                                                                                                                                           | `hit` 0, 0, 18×9                                                                              | near: 261, 142                                                |
| `sticker-code`   | 16×12   | 0, 0    | 1      | (no tags) 1 × 1000 ms                                                                                                                                                                                                                                                                                                                                           | `hit` 0, 0, 15×11                                                                             | near: 231, 145                                                |
| `sticker-scroll` | 19×10   | 0, 0    | 1      | (no tags) 1 × 1000 ms                                                                                                                                                                                                                                                                                                                                           | `hit` 0, 0, 18×9                                                                              | near: 247, 149 (needs `cv`)                                   |
| `coffee`         | 20×46   | 10, 46  | 6      | `level5` 0–0: 1 × 1000 ms<br>`level4` 1–1: 1 × 1000 ms<br>`level3` 2–2: 1 × 1000 ms<br>`level2` 3–3: 1 × 1000 ms<br>`level1` 4–4: 1 × 1000 ms<br>`level0` 5–5: 1 × 1000 ms                                                                                                                                                                                      | `hit` 1, 0, 18×46                                                                             | near: on `me` slice `cup`, else 194, 163 (tag `level5`)       |
| `lamp`           | 56×66   | 14, 66  | 2      | `off` 0–0: 1 × 1000 ms<br>`on` 1–1: 1 × 1000 ms                                                                                                                                                                                                                                                                                                                 | –                                                                                             | near: 140, 164 (tag `off`, `on` after dark)                   |
| `myles`          | 64×68   | 32, 68  | 21     | `idle` 0–1: 2 × 1400 ms<br>`swish` 2–7: 6 × 130 ms<br>`blink` 8–10: 120, 500, 160 ms<br>`ear` 11–13: 90, 120, 90 ms<br>`look` 14–16: 120, 1600, 120 ms<br>`pet` 17–20: 4 × 300 ms                                                                                                                                                                               | `hit` 2, 0, 60×68<br>`hearts` 10, 0, 1×1                                                      | near: 326, 164 (tag `idle`)                                   |
| `hearts`         | 18×24   | 9, 24   | 7      | `float` 0–6: 7 × 150 ms (plays 1×)                                                                                                                                                                                                                                                                                                                              | –                                                                                             | near: on `myles` slice `hearts` (tag `float`, needs `hearts`) |
| `cushion`        | 100×30  | 50, 30  | 2      | `back` 0–0: 1 × 1000 ms<br>`front` 1–1: 1 × 1000 ms                                                                                                                                                                                                                                                                                                             | –                                                                                             | front: 378, 258 (tag `back`)<br>front: 378, 258 (tag `front`) |
| `margot`         | 116×44  | 68, 44  | 23     | `sleep` 0–3: 900, 700, 900, 700 ms<br>`ear` 4–6: 80, 90, 80 ms (events 0:margot-wake)<br>`paw` 7–9: 160, 240, 160 ms<br>`wake` 10–15: 200, 600, 260, 700, 240, 240 ms (events 0:margot-wake)<br>`stretch` 16–22: 220, 220, 260, 900, 260, 240, 300 ms (events 0:margot-stretch)                                                                                 | `hit` 20, 2, 92×42<br>`zzz` 26, 0, 1×1                                                        | front: 378, 246 (tag `sleep`)                                 |
| `zzz`            | 20×22   | 0, 22   | 6      | `float` 0–5: 6 × 450 ms                                                                                                                                                                                                                                                                                                                                         | –                                                                                             | front: on `margot` slice `zzz` (tag `float`)                  |
| `leaves`         | 96×70   | 0, 0    | 1      | (no tags) 1 × 1000 ms                                                                                                                                                                                                                                                                                                                                           | –                                                                                             | foreground: -10, 206                                          |

<!-- sprites:end -->

## The scene file

`src/lib/scene/art/scene.json` places everything. The `draw` list is the drawing order, back to front:

- `{ "sprite", "layer", "at" }` draws a sprite with its anchor at `at`. Optional: `tag` (the tag to play), `dark` (a tag dissolved in after dark), `weight` (dissolve the whole sprite by `day`, `dark`, `night` or `stars`), `attach: [sprite, slice]` (place the anchor at another sprite's slice, falling back to `at`) and `requires` (only drawn while that flag is on, for example `cv` for the scroll sticker until the CV page exists).
- `{ "light" }` screens a light over everything drawn so far; lights are defined under `lights` (a glow ellipse or a shaft polygon, with the layer they move with).
- `{ "procedural" }` draws the sky, stars or sun and moon.
- `{ "again", "clip" }` draws an earlier sprite again inside a scene rectangle, so part of it (my hand on Myles) can overlap sprites drawn after it.

Sky colours, the ambient tint and light strengths per time of day come from the palette and `src/lib/scene/lighting.ts`.

## Mobile crop

Under 640 px wide the frame is 4:3 and centres on this rectangle, in scene pixels: **x 172, y 62, 248 × 186**. It holds me, both cats, the laptop and the coffee. At whole-number scales slightly more or less than the rectangle may show; keep anything important a few pixels inside it.

## Budget

All sprite PNGs together must stay under 500 KB.
