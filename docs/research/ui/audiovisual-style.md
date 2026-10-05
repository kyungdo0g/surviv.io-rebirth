# Audiovisual style

> Scope: rendering stack, scale (pixels per world unit), sprite atlases, colour palette per map, particles and effects, sound engine, sound categories and counts, ambience and music.
> survev counts come from its current defs; "original" counts come from the decompiled 0.8.82 client in survev commit `8715a605` (`derived/survev@8715a605:client/js/app.js`) and the asset files of that commit.

## Rendering stack

- The original 0.8.82 client bundles Pixi.js 4.8.2; survev uses `pixi.js-legacy` 7.4.3 (v7 with a Canvas2D fallback) (fork upgrade) [src:derived/survev@8715a605:client/js/vendor.bd0cb293.js] [src:survev/client/package.json:18] [H]
- The renderer is created with WebGL first and falls back to canvas on failure; antialiasing off; resolution 2 when devicePixelRatio > 1, else 1; iOS forces high fragment precision [src:survev/client/src/main.ts:305-330] [H]
- Menu background colour `0x709645` (7378501); in game the renderer clears to the map's grass colour (default `0x80af49`) [src:survev/client/src/main.ts:330] [src:survev/client/src/game.ts:986] [src:derived/survev@8715a605:client/js/app.js:78776-78779] [H]
- Scene order (back to front): map ground, layer 0, ground mask, layers 1–3, debug, gas, touch pads, emotes, HUD map container, pie timer, emote indicators, debug HUD [src:survev/client/src/game.ts:281-297] [H]
- Four render layers sorted by `(zOrd, zIdx)`; objects on stairs go to layer 2 (or 3 if `zOrd ≥ 100`) so trees and smoke stay above bunker masks; a layer mask fades between ground and underground [src:survev/client/src/renderer.ts:36-56] [src:survev/client/src/renderer.ts:86-100] [src:survev/client/src/renderer.ts:278-298] [H]
- Building ceilings fade out while the local player is inside [src:survev/client/src/objects/building.ts:1-80] [M]

## Scale and camera

- 16 pixels per world unit (`ppu`) at zoom 1; default zoom 1.5 [src:survev/client/src/camera.ts:5-8] [src:derived/survev@8715a605:client/js/app.js:41888] [H]
- The visible half-width is the scope zoom radius (1x: 28 units on desktop) because zoom = `max(minDim·16/9, maxDim)·0.5 / (radius·16)` [src:survev/client/src/game.ts:430-447] [src:survev/shared/gameConfig.ts:399-406] [H]
- Example: on a 1920-px-wide 16:9 screen with a 1x scope, zoom = 1920·0.5 / (28·16) ≈ 2.14, so a radius-1 player is ≈ 69 px across [src:derived/arithmetic-from-camera-formula] [M]
- World y points up: `pointToScreen` flips y [src:survev/client/src/camera.ts:22-34] [H]
- Objects are scaled by the camera zoom (`container.scale = zoom`) and sprites carry their own scale; the player body SVG is 140 px drawn at 0.25 (35 px at zoom 1, close to the 32 px diameter of a radius-1 player at 16 px/unit) [src:survev/client/src/objects/player.ts:1328-1333] [src:survev/client/src/objects/player.ts:1470] [src:survev/client/public/img/player/player-base-01.svg] [M]
- Player gear sprite scales: body/backpack patch/chest 0.25, helmet 0.15, flak 0.215, steelskin 0.4 [src:survev/client/src/objects/player.ts:1470-1603] [H]
- Screen shake from explosions: intensity falls from full at 10 units to 0 at 40 units; can be disabled ("Screen shake" setting) [src:survev/client/src/camera.ts:56-67] [src:survev/client/src/config.ts:103] [H]
- The ground grid is drawn every 16 units with black lines at 15 % alpha [src:survev/client/src/map.ts:442-450] [src:survev/shared/gameConfig.ts:182] [H]

## Art assets and atlases

- Art is vector: survev's `client/public/img` holds 1,664 files (map 759, loot 259, emotes 182, gui 119, particles 89, guns 61, player 54, proj 42, crosshairs 30, ui 13, splashes 10, melee 9, intro 4, pass 3) [src:survev/client/public/img] [H]
- The original client shipped 1,392 image files (map 627, loot 231, emotes 219, gui 85, particles 72, player 32, proj 38, guns 31, crosshairs 30, melee 9, intro 4, pass 3, plus splash PNGs) and 22 pre-baked atlas PNGs at 100 % and 50 % (e.g. `main-0-100`, `main-0-50`, `shared-0..3`, `loadout`, `desert`, `woods`, `snow`, `savannah`, `potato`, `halloween`, `faction`, `cobalt`, `gradient`) [src:derived/survev@8715a605:client/img] [src:derived/survev@8715a605:client/assets] [H]
- survev rebuilds atlases from the SVGs at build time: 13 atlases (loadout, shared, main, desert, faction, halloween, potato, snow, woods, cobalt, savannah, turkey, beach), max 4096×4096, high = scale 1, low = 0.5; large building ceilings are pre-shrunk to 0.75 or 0.5 [src:survev/client/atlas-builder/atlasDefs.ts:20-60] [src:survev/client/atlas-builder/atlasWorker.ts:56] [H]
- Each map def loads `loadout` + `shared` + its own atlas (e.g. main → `main`, desert → `desert`, potato → `main` + `potato`) [src:survev/shared/defs/maps/baseDefs.ts:32] [H]
- Low-res textures are forced on screens smaller than 1366×768 (device pixels), phones, canvas mode or GPUs with `MAX_TEXTURE_SIZE` < 4096; otherwise the "High resolution" setting decides [src:survev/client/src/resources.ts:59-88] [H]
- The SVGs carry Inkscape 0.92.2 metadata and original surviv.io file names, and `attribution.txt` credits game-icons.net icons (Skoll, Lorc, Delapouite, sbed, …, CC BY 3.0): the art is surviv.io's own, not a free asset pack [src:survev/client/public/attribution.txt] [src:survev/client/public/img/player/player-base-01.svg] [H]
- UI font: Roboto Condensed 400/700 (also used by the pie timer); map place names use Arial bold [src:survev/client/public/fonts] [src:survev/client/src/ui/pieTimer.ts:33-48] [src:survev/client/src/map.ts:633-647] [H]

## Palette per map

> Colours are `biome.colors` in each map def. Every palette for map ids 0–7 also appears with the same numbers in the 0.8.82 client; Turkey's own palette, Birthday, Beach and Potato-vs-Tomato are not in it.

| map def (id) | background | water | water ripple | beach | riverbank | grass | underground | submerged player | ghillie | in 0.8.82 | sources |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `main` (0) | `#20536e` | `#3282ab` | `#b3f0ff` | `#cdb35b` | `#905e24` | `#80af49` | `#1b0d03` | `#2b8ca4` | `#83af50` | yes | [src:survev/shared/defs/maps/baseDefs.ts:34-45] [src:derived/survev@8715a605:client/js/app.js:112241-112249] [H] |
| `main_spring` (0) | `#20536e` | `#3282ab` | `#b3f0ff` | `#f4ae48` | `#8a8a8a` | `#5c910a` | `#1b0d03` | `#2b8ca4` | `#5b8e0a` | yes | [src:survev/shared/defs/maps/mainSpringDefs.ts:15-25] [src:derived/survev@8715a605:client/js/app.js:54716-54724] [H] |
| `main_summer` (0) | `#20536e` | `#3282ab` | `#b3f0ff` | `#dc9e28` | `#a37119` | `#629522` | `#1b0d03` | `#2b8ca4` | `#659825` | yes | [src:survev/shared/defs/maps/mainSummerDefs.ts:24-34] [src:derived/survev@8715a605:client/js/app.js:31367-31375] [H] |
| `desert` (1) | `#6a7543` | `#8a9b4e` | `#d1e685` | `#c9843a` | `#b25e24` | `#dfa757` | `#3d0d03` | `#4e9b8f` | `#dfa761` | yes | [src:survev/shared/defs/maps/desertDefs.ts:30-40] [src:derived/survev@8715a605:client/js/app.js:115117-115124] [H] |
| `woods` (2) | `#20536e` | `#3282ab` | `#b3f0ff` | `#efb35b` | `#77360b` | `#8e832a` | `#1b0d03` | `#2b8ca4` | `#91852c` | yes | [src:survev/shared/defs/maps/woodsDefs.ts:25-35] [src:derived/survev@8715a605:client/js/app.js:48260-48267] [H] |
| `woods_spring` (2) | `#20536e` | `#3282ab` | `#b3f0ff` | `#efb35b` | `#8a8a8a` | `#426609` | `#1b0d03` | `#2b8ca4` | `#41630a` | yes | [src:survev/shared/defs/maps/woodsSpringDefs.ts:27-37] [src:derived/survev@8715a605:client/js/app.js:103992-103999] [H] |
| `woods_summer` (2) | `#20536e` | `#3282ab` | `#b3f0ff` | `#dc9e28` | `#a37119` | `#629522` | `#1b0d03` | `#2b8ca4` | `#659825` | yes | [src:survev/shared/defs/maps/woodsSummerDefs.ts:10-20] [src:derived/survev@8715a605:client/js/app.js:109254-109261] [H] |
| `snow` / `woods_snow` (0 / 2) | `#093639` | `#0c4d51` | `#b3f0ff` | `#cdb35b` | `#905e24` | `#bdbdbd` | `#1b0d03` | `#2b8ca4` | `#bbbbbb` | yes | [src:survev/shared/defs/maps/snowDefs.ts:24-34] [src:survev/shared/defs/maps/woodsSnowDefs.ts:21-31] [src:derived/survev@8715a605:client/js/app.js:49792-49799] [H] |
| `faction` (3) | `#051624` | `#071b36` | `#b3f0ff` | `#8e5632` | `#653313` | `#4e6128` | `#1b0d03` | `#123049` | `#4c6024` | yes | [src:survev/shared/defs/maps/factionDefs.ts:86-96] [src:derived/survev@8715a605:client/js/app.js:77613-77621] [H] |
| `potato` (4) | same as `main` | | | | | | | | | yes | [src:survev/shared/defs/maps/potatoDefs.ts:37-47] [src:derived/survev@8715a605:client/js/app.js:117019-117026] [H] |
| `potato_spring` (4) | same as `main_spring` | | | | | | | | | yes | [src:survev/shared/defs/maps/potatoSpringDefs.ts:31-41] [src:derived/survev@8715a605:client/js/app.js:117370-117377] [H] |
| `savannah` (5) | `#1c5b5f` | `#41a4aa` | `#96f0f6` | `#cb7132` | `#b25e24` | `#b4b02e` | `#3d0d03` | `#4e9b8f` | `#b0ac2b` | yes | [src:survev/shared/defs/maps/savannahDefs.ts:22-32] [src:derived/survev@8715a605:client/js/app.js:54689-54697] [H] |
| `halloween` (6) | `#170000` | `#280000` | `#100101` | `#64410e` | `#3c1b05` | `#212404` | `#120801` | `#140000` | `#83af50` | yes | [src:survev/shared/defs/maps/halloweenDefs.ts:86-96] [src:derived/survev@8715a605:client/js/app.js:79332-79339] [H] |
| `cobalt` (7) | `#020e18` | `#003571` | (main) | `#684836` | `#443d3a` | `#4d5a68` | `#1b0d03` | `#123049` | `#4b5866` | yes | [src:survev/shared/defs/maps/cobaltDefs.ts:26-36] [src:derived/survev@8715a605:client/js/app.js:56161-56168] [H] |
| `turkey` (0) | `#474d4a` | `#707b76` | `#7e8984` | `#cc975b` | `#bd5c21` | `#a08b2f` | `#1b0d03` | `#2b8ca4` | `#a48e2e` | no: 0.8.82 turkey inherits main colours (fork/post-0.8.82) | [src:survev/shared/defs/maps/turkeyDefs.ts:35-45] [src:derived/survev@8715a605:client/js/app.js:105528-105552] [H] |
| `birthday` (8) | `#20536e` | `#80af49` (grass-coloured) | `#b3f0ff` | `#719644` | `#905e24` | `#80af49` | `#1b0d03` | `#2b8ca4` | `#83af50` | no (post-0.8.82) | [src:survev/shared/defs/maps/birthdayDefs.ts:20-30] [H] |
| `beach` (9) | `#20536e` | `#42b0ba` | `#b3f0ff` | `#ffe7ba` | `#a37119` | `#7ba865` | `#1b0d03` | `#2b8ca4` | `#7dac66` | no (fork reconstruction) | [src:survev/shared/defs/maps/beachDefs.ts:23-33] [H] |
| `faction_potato` (10) | same as `faction` | | | | | | | | | no (post-0.8.82) | [src:survev/shared/defs/maps/factionPotatoDefs.ts:1-40] [H] |
- `valueAdjust` is 1 everywhere except Halloween (0.3), which darkens particle and decal colours [src:survev/shared/defs/maps/halloweenDefs.ts:101] [src:survev/shared/defs/maps/baseDefs.ts:46] [H]
- Camera particle emitters per map: snow `falling_snow_fast`, woods_snow `falling_snow_slow`, woods `falling_leaf`, woods_spring/main_spring `falling_leaf_spring`, woods_summer `falling_leaf_summer`, halloween `falling_leaf_halloween`, potato `falling_potato`, potato_spring `falling_leaf_potato`, faction_potato `falling_pvt` [src:survev/shared/defs/maps/snowDefs.ts:34] [src:survev/shared/defs/maps/woodsSnowDefs.ts:31] [src:survev/shared/defs/maps/woodsDefs.ts:35] [src:survev/shared/defs/maps/potatoDefs.ts:46] [src:survev/shared/defs/maps/factionPotatoDefs.ts:92] [src:survev/shared/defs/maps/halloweenDefs.ts:96-98] [H]
- Snow maps use the winter plane and chute sprites `map-plane-01x.img` / `map-chute-01x.img` [src:survev/shared/defs/maps/snowDefs.ts:35-39] [H]
- HUD colours: group colours yellow `#ffff00`, magenta `#ff00ff`, cyan `#00ffff`, orange `#ff5400`; faction team colours red `#cc0000`, blue `#007eff` (same in 0.8.82) [src:survev/shared/gameConfig.ts:306-307] [src:derived/survev@8715a605:client/js/app.js:77860-77861] [H]
- In-world gas is red `#ff0000` at 60 % alpha; on the map it is black at 60 % [src:survev/client/src/gas.ts:34] [src:survev/client/src/gas.ts:187] [src:survev/client/src/ui/ui.ts:401] [H]
- Tracer colours per ammo (regular / saturated / chambered): 9mm `#fee2c6/#ffd9b3/#ff7f00`, 7.62 `#c5d6fe/#abc4ff/#004cff`, 12 gauge `#fedcdc/#fedcdc/#ff0000`, 5.56 `#a9ff92/#a9ff92/#36ff00`, .50 AE `#fff088/#fff088/#ffdf00`, .308 sub `#252b00/#465000/#131600`, flare `#e2e2e2/#e2e2e2/#c4c4c4`, .45 `#ecbeff/#e7acff/#b500ff`; `apSaturated` variants are fork additions [src:survev/shared/gameConfig.ts:318-398] [src:derived/survev@8715a605:client/js/app.js:77867-77950] [H]

## Particles and effects

- survev defines 144 particle defs, 38 emitter defs and 20 explosion effect defs; the original client has 122 particle defs, 28 emitters and 17 explosion effects [src:survev/client/src/objects/particles.ts:422] [src:survev/client/src/objects/particles.ts:3501] [src:survev/client/src/objects/explosion.ts:355] [src:derived/survev@8715a605:client/js/app.js:36867-38930] [src:derived/survev@8715a605:client/js/app.js:38943-39200] [H]
- Original emitters (28): `smoke_barrel`, `cabin_smoke_parent`, `bathhouse_steam`, `bunker_bubbles_01`, `bunker_bubbles_02`, `falling_leaf`, `falling_leaf_halloween`, `falling_leaf_spring`, `falling_leaf_summer`, `falling_leaf_potato`, `falling_potato`, `falling_snow_fast`, `falling_snow_slow`, `heal_basic`, `heal_heart`, `heal_moon`, `heal_tomoe`, `boost_basic`, `boost_star`, `boost_naturalize`, `boost_shuriken`, `revive_basic`, `windwalk`, `takedown`, `inspire`, `xp_common`, `xp_rare`, `xp_mythic` [src:derived/survev@8715a605:client/js/app.js:38943-39200] [src:survev/client/src/objects/particles.ts:3501-3900] [H]
- survev-only emitters (10): `campfire_smoke`, `falling_pvt`, `heal_diamond`, `heal_ankh`, `heal_menacing`, `boost_club`, `boost_lightning`, `boost_hermes`, `boost_gearshift_01`, `boost_gearshift_02` (fork or post-0.8.82) [src:survev/client/src/objects/particles.ts:3501-3900] [H]
- Explosion effects in the original (17): frag, smoke, strobe, barrel, usas, rounds, rounds_sg, mirv, mirv_mini, martyr_nade, snowball, snowball_heavy, potato, potato_heavy, potato_cannonball, potato_smgshot, bomb_iron; survev adds potato_lmgshot, coconut, tomato [src:derived/survev@8715a605:client/js/app.js:51200-51600] [src:survev/client/src/objects/explosion.ts:355-700] [H]
- Explosion effects combine a particle burst, physics debris, ground ripples (`rippleCount`, e.g. 10 for frag), camera shake strength/duration and a lifetime [src:survev/client/src/objects/explosion.ts:355-380] [src:derived/survev@8715a605:client/js/app.js:51222] [H]
- Heal/boost/revive emitters double as cosmetic "heal effect" and "boost effect" loadout items [src:survev/client/src/ui/loadoutMenu.ts:158-167] [src:fandom/Loadout] [H]
- Muzzle flashes and shell casings come from gun defs (`shot.ts`), tracers and hit effects from `bullet.ts`; smoke grenades use `part-smoke-02/03` particles [src:survev/client/src/objects/shot.ts:1-60] [src:survev/client/src/objects/smoke.ts:1-60] [M]
- Decals (44 defs) such as explosion scorch marks and blood fade and lerp colours [src:survev/shared/defs/mapObjects/decalDefs.ts:1-40] [src:survev/client/src/objects/decal.ts:1-60] [M]

## Sound engine

- WebAudio engine modelled on SoundJS (`createJS.ts`): up to 128 simultaneous instances, equal-power panner, compressor, convolution reverb send [src:survev/client/src/lib/createJS.ts:27] [src:survev/client/src/lib/createJS.ts:55-70] [src:survev/client/src/lib/createJS.ts:455-465] [H]
- Positional volume = channel volume × `(1 − d/range)^(1 + 2·fallOff)` × master; stereo pan from the horizontal offset; sounds on another layer are halved (`DiffLayerMult` 0.5) and get the muffled EQ [src:survev/client/src/audioManager.ts:8] [src:survev/client/src/audioManager.ts:205-250] [H]
- EQ presets: `muffled` (10 peaking bands, up to −30 dB) for other floors, `club` (heavy high cut) for club interior music [src:survev/client/src/lib/createJS.ts:465-490] [H]
- Underground reverb: `cathedral` reverb volume by layer (0, 1, 1/3, 2/3) while underground; reverbs `cathedral` (volume 0.7, stereo spread 0.004) and `cave` (0.7, echo 0.5 at 0.25 s, low-pass 800 Hz) — same defs in the original; underground reverb added 0.3.6 [src:survev/client/src/audioManager.ts:176-185] [src:survev/client/src/soundDefs.ts:2161-2176] [src:derived/survev@8715a605:client/js/app.js:36586-36600] [src:changelog/0.3.6] [H]
- Channels (volume, range in world units): activePlayer 0.5/48, otherPlayers 0.5/48, hits 0.4/48, sfx 1/48, ambient 1/1, ui 0.75/48, music 1/1 (type music) — identical in the original [src:survev/client/src/soundDefs.ts:2117-2160] [src:derived/survev@8715a605:client/js/app.js:36543-36584] [H]
- Airdrop and airstrike sounds carry extra range: airdrop `soundRangeMult` 2.5 (max 92), airstrike 18 (max 48, falloff 1.25) [src:survev/shared/gameConfig.ts:282-305] [H]
- Volume sliders: master, SFX ("sound") and music, each 0–1 (added 0.3.1) [src:survev/client/src/config.ts:105-107] [src:changelog/0.3.1] [H]

## Sound inventory

| category | survev defs | original 0.8.82 defs | sources |
|---|---|---|---|
| players (guns, melee, footsteps, heals) | 196 | 178 | [src:survev/client/src/soundDefs.ts:26-876] [src:derived/survev@8715a605:client/js/app.js:34582-35355] [H] |
| hits | 39 | 38 | [src:survev/client/src/soundDefs.ts:877-1088] [src:derived/survev@8715a605:client/js/app.js:35355-35562] [H] |
| sfx | 122 | 116 | [src:survev/client/src/soundDefs.ts:1089-1617] [src:derived/survev@8715a605:client/js/app.js:35562-36062] [H] |
| ambient | 11 | 9 | [src:survev/client/src/soundDefs.ts:1618-1674] [src:derived/survev@8715a605:client/js/app.js:36062-36109] [H] |
| ui | 51 | 50 | [src:survev/client/src/soundDefs.ts:1675-1920] [src:derived/survev@8715a605:client/js/app.js:36109-36349] [H] |
| music | 2 (`menu_music_01`, `menu_music_02`) | 1 (`menu_music` = `menu_music_01.mp3`) | [src:survev/client/src/soundDefs.ts:1921-1933] [src:derived/survev@8715a605:client/js/app.js:36349-36356] [H] |
| total | 421 | 392 | [src:derived/sum-of-rows] [H] |
- Random sound groups: 45 in survev (footsteps per surface: grass, container, warehouse, house, shack, sand, water, tile, asphalt, brick, bunker, stone, carpet; impact groups per material; `player_bullet_grunt`, `bullet_whiz`, frag per surface, kill-leader groups, `cluck`, `egg_hit`); 44 in the original (no `egg_hit`) [src:survev/client/src/soundDefs.ts:1935-2116] [src:derived/survev@8715a605:client/js/app.js:36356-36540] [H]
- Audio files: survev 422 MP3 (guns 191, sfx 120, ui 57, hits 39, ambient 13, reverb 2; 9.4 MB); original 396 (guns 173, sfx 115, ui 56, hits 39, ambient 11, reverb 2) [src:survev/client/public/audio] [src:derived/survev@8715a605:client/audio] [H]
- Fandom: 214 sound files as of 0.5.0 "Air drop it like it's hot" [src:fandom/Sound] [M]
- Every weapon has fire, reload and (for bolt/pump guns) cycle/pull sounds; there are also footstep, break, hit, pickup, use, emote and ping sounds (fandom sub-pages: Bullet Hit, Melee Hit, Footstep, Breaking, Gunshot sounds) [src:fandom/Sound] [src:survev/client/src/soundDefs.ts:26-876] [H]
- Role sounds: `leader_assigned_01`, `leader_dead_01`, `lt_assigned_01`, `captain_assigned_01`, `medic_assigned_01`, `marksman_assigned_01`, `recon_assigned_01`, `grenadier_assigned_01`, `bugler_assigned_01`, `last_man_assigned_01`; Halloween kill-leader variants `kill_leader_assigned_01/02`, `kill_leader_dead_01/02` [src:survev/shared/defs/maps/factionDefs.ts:20-45] [src:survev/shared/defs/maps/halloweenDefs.ts:20-45] [src:fandom/Kill_Leader] [H]
- Ping sounds: `ping_danger_01`, `ping_coming_01`, `ping_help_01`, `ping_airdrop_01`, `ping_airstrike_01`, `ping_unlock_01`, leader pings `ping_leader_01` [src:survev/shared/defs/gameObjects/pingDefs.ts:21-106] [H]

## Ambience and music

- Ambience tracks (crossfaded by weight, volumes updated every 0.2 s): `music` (menu music), `wind` (`ambient_wind_01`), `river` (`ambient_stream_01`), `waves` (`ambient_waves_01`), plus two interior tracks for buildings/structures; the same six tracks exist in the original [src:survev/client/src/ambiance.ts:48-54] [src:survev/client/src/ambiance.ts:107-112] [src:derived/survev@8715a605:client/js/app.js:32442-32448] [H]
- Menu music plays on the main menu and stops when a match starts (wind weight 1 at game start; river and interiors drop to 0 at game end) [src:survev/client/src/ambiance.ts:88-105] [H]
- Wind, river and wave weights follow the camera's distance to rivers and the shore [src:survev/client/src/game.ts:1010-1045] [H]
- Interior ambience: `club_music_01/02` in the Crimson Ring Club (main map), `piano_music_01`, `ambient_steam_01` (bathhouse), `ambient_lab_01` (Cobalt), `reserve_music_01/02` (desert reserve, fork) [src:survev/shared/defs/maps/baseDefs.ts:21-31] [src:survev/shared/defs/maps/desertDefs.ts:15-28] [src:survev/shared/defs/maps/cobaltDefs.ts:15-25] [H]
- Victory music: the original plays `menu_music` 1.3 s after a win; survev plays `biome.ambience.music` (`menu_music_02` on Halloween) (fork) [src:derived/survev@8715a605:client/js/app.js:79226-79233] [src:survev/client/src/game.ts:1550-1557] [src:survev/shared/defs/maps/halloweenDefs.ts:99] [H]
- The music channel has range 1 (non-positional) and ignores distance [src:survev/client/src/soundDefs.ts:2153-2158] [H]

## Conflicts

- CONFLICT reverb-files-unused: fandom calls `cave_mono_01` and `cathedral_01` unused sound files [src:fandom/Sound] vs both are registered reverbs and the underground reverb was added in 0.3.6 [src:survev/client/src/soundDefs.ts:2161-2176] [src:changelog/0.3.6]; proposed: they are impulse responses, used [L]
- CONFLICT turkey-palette: survev gives the Turkey map its own grey/brown palette [src:survev/shared/defs/maps/turkeyDefs.ts:35-45] vs the 0.8.82 turkey def only adds audio and `turkeyMode` on top of main [src:derived/survev@8715a605:client/js/app.js:105528-105552]; proposed: main palette for the 0.8.82 target, survev palette optional [L]
- CONFLICT pixi-version: original Pixi 4.8.2 [src:derived/survev@8715a605:client/js/vendor.bd0cb293.js] vs survev Pixi 7.4.3 legacy [src:survev/client/package.json:18]; proposed: irrelevant to gameplay; use a modern renderer [L]

## Open questions

- Exact original sprite scales per object are in the shared defs (other KB files); whether the original atlases were pre-rendered at a different base density than survev's SVG rasterisation is not verified [src:derived/survev@8715a605:client/assets] [src:survev/client/atlas-builder/atlasDefs.ts:36-40] [L]
- Asset licensing: the art and audio appear to be the original surviv.io assets; survev's GPL licence covers code, and the repository does not state an asset licence [src:survev/client/public/attribution.txt] [src:survev/LICENSE] [L]
