# Halloween map ("Happy Spookiversary", "Trick or treat")

> survev id `halloween` (mapId 6). The 0.8.82 relaunch client (`kong/relaunch-client-defs`) contains the Halloween map def (desc, audio, biome incl. `valueAdjust` 0.3, gameMode), so client-visible fields can be checked directly.
> "orig" spawn/loot values come from survev's pre-fork snapshot `ae55c9a8` (`derived/git-ae55c9a8`). survev's own comment says its XP and Halloween-perk tables are "guessed with no base on real data".
> **Night darkness:** survev has no night, vision-radius or lighting-overlay code. The "night" look is only the very dark biome colours plus `biome.valueAdjust = 0.3`, which multiplies the RGB of obstacle, building, particle and decal tints by 0.3; light decals under pumpkins and candles are exempt and so appear to glow. A real lighting system would be new design work.

## Identity

- `MapId.Halloween = 6`; survev def `Halloween = mergeDeep({}, Main, overrides)` [src:survev/shared/gameConfig.ts:104, survev/shared/defs/maps/halloweenDefs.ts:7, survev/shared/defs/maps/halloweenDefs.ts:280] [H]
- `desc`: name "Halloween", icon `img/gui/pumpkin-play.svg` (pumpkin play button), buttonCss `btn-mode-halloween` — same as the original client [src:survev/shared/defs/maps/halloweenDefs.ts:9-14, kong/relaunch-client-defs] [H]
- Splash `img/splashes/halloween.webp` is a survev field (the original splash is "Main splash halloween") [src:survev/shared/defs/maps/halloweenDefs.ts:13, fandom/Halloween_Map] [M]
- Names: fandom "Halloween Map" / "Spookiversary Map"; survev.wiki.gg "Halloween mode" [src:fandom/Halloween_Map, fandom/Maps, wikigg/Halloween_mode] [H]
- Korean community name: 할로윈 이벤트 ("Night Falls On") [src:namu/Surviv.io/이벤트] [M]

## Dates and versions

| event | start | end | queue | notes | src |
|---|---|---|---|---|---|
| Happy Spookiversary (1st anniversary) | 0.6.4, Oct 29–30, 2018 | Nov 1, 2018 | solo only (first solo-only event) | eye bunker, pumpkin, jack-o'-lantern, withered tree, Halloween skins, emotes; "an Island cloaked in darkness" | [src:changelog/0.6.4, fandom/Changelog, fandom/Events] [H] |
| Trick or treat | 0.8.7, Oct 26, 2019 | Nov 1, 2019 | – | red pumptato, golden pumpkin air drop, XP artifacts (Survivr Pass, Halloween map only), 10 trick/treat perks, more Halloween skins; "Night falls once more upon the Island" | [src:changelog/0.8.7, fandom/Changelog] [H] |

- The changelog file dates 0.6.4 to Oct. 29, 2018; fandom's changelog header says Oct 30 and survev.wiki.gg says Oct 30 [src:changelog/0.6.4, fandom/Changelog, wikigg/Halloween_mode] [M]
- namu.wiki: the Halloween event runs about three days, from two days before Halloween until it ends [src:namu/Surviv.io/이벤트] [M]
- 2019 secret changes: M9 Cursed added; frags and MIRV bomblets reskinned (Oct 26); red pumptatos removed from the minimap (Oct 28); menu music set to the previous year's Halloween theme (Oct 29); music and grenade skins reverted when the event ended (Nov 1) [src:fandom/Changelog] [M]
- From Oct 29, 2019 the squad queue switched to potato mode for the 2nd anniversary while Halloween continued [src:fandom/Changelog, fandom/Events] [M]
- The map returned in 2021 (post-0.8.82) without the grenade reskin and menu music [src:fandom/Halloween_Map] [M]

## Size and terrain

- scale small = large = 1.1875 → 720 × 720 in every team mode [src:survev/shared/defs/maps/halloweenDefs.ts:203, survev/server/src/game/map.ts:283-287] [H]
- Shore/grass insets inherited from main (48 / 18) [src:survev/shared/defs/maps/baseDefs.ts:818-819, survev/shared/defs/maps/halloweenDefs.ts:202-218] [H]
- River width sets capped at 8: 0.1:[4], 0.15:[8], 0.25:[8,4], 0.21:[8], 0.09:[8,8], 0.2:[8,8,4], 0.0001:[8,8,8,6,4] [src:survev/shared/defs/maps/halloweenDefs.ts:204-216] [H]
- No club: `locationSpawns: []` [src:survev/shared/defs/maps/halloweenDefs.ts:219-221, wikigg/Halloween_mode] [H]
- Place names in survev are main's; in 2019 the original renamed all except The Killpit: Tarscary (Tarkhany), Bloodbath (Sweatbath), Fields of Death (Todesfelde), Pumpkin (Pineapple), Ranchito Muerto (Ranchito Pollo), Haunted Hollow (Fowl Forest), Strashnyy Prizrak "scary ghost" (Ytyk-Kyuyol) [src:survev/shared/defs/maps/baseDefs.ts:839-872, fandom/Halloween_Map, fandom/Maps] [M]
- fandom: the 2018 Halloween map used the normal place names [src:fandom/Maps] [M]

## Biome, darkness, audio

| field | value | src |
|---|---|---|
| background | 0x170000 (dark red) | [src:survev/shared/defs/maps/halloweenDefs.ts:86, kong/relaunch-client-defs, fandom/Halloween_Map] [H] |
| water / waterRipple | 0x280000 (blood red) / 0x100101 | [src:survev/shared/defs/maps/halloweenDefs.ts:87-88, kong/relaunch-client-defs] [H] |
| beach / riverbank | 0x64410e / 0x3c1b05 | [src:survev/shared/defs/maps/halloweenDefs.ts:89-90, kong/relaunch-client-defs] [H] |
| grass | 0x212404 (dark enough to hide .308 subsonic tracers) | [src:survev/shared/defs/maps/halloweenDefs.ts:91, kong/relaunch-client-defs, fandom/Halloween_Map] [H] |
| underground / playerSubmerge | 0x120801 / 0x140000 | [src:survev/shared/defs/maps/halloweenDefs.ts:92-93, kong/relaunch-client-defs] [H] |
| playerGhillie | original 0x212404 (= grass); survev omits it and inherits main's 0x83af50 | [src:kong/relaunch-client-defs, survev/shared/defs/maps/halloweenDefs.ts:85-94, survev/shared/defs/maps/baseDefs.ts:44] [H] |
| camera particles | `falling_leaf_halloween` | [src:survev/shared/defs/maps/halloweenDefs.ts:95-97, kong/relaunch-client-defs] [H] |
| valueAdjust | 0.3 (every other map: 1) | [src:survev/shared/defs/maps/halloweenDefs.ts:101, kong/relaunch-client-defs] [H] |
| airdrop plane / chute | normal `map-plane-01` / `map-chute-01` | [src:kong/relaunch-client-defs, survev/shared/defs/maps/baseDefs.ts:56-60] [H] |

- `valueAdjust < 1` darkens obstacle sprites, building floor/ceiling sprites, particles and decals by multiplying each RGB channel of the tint (`util.adjustValue`) [src:survev/client/src/objects/obstacle.ts:303-306, survev/client/src/objects/building.ts:215-218, survev/client/src/objects/particles.ts:118-139, survev/client/src/objects/decal.ts:185, survev/client/src/objects/decal.ts:214-215, survev/shared/utils/util.ts:203-211] [H]
- Particles with `ignoreValueAdjust` and decals with `ignoreAdjust` keep full brightness; all four light decals (`decal_light_01`–`04`, sprite `map-light-01`, alpha 0.5, tints 0xff9c00 / 0xffbe4d / 0x830000 / 0xff5824) ignore it [src:survev/client/src/objects/particles.ts:118, survev/shared/defs/mapObjects/decalDefs.ts:330-399] [H]
- No other darkness mechanism exists in survev: no night, light-radius, flashlight or vignette code [src:survev/client/src/objects/obstacle.ts:303, derived/grep-night-darkness-none] [H]
- Wikis describe it as night: "the only event to actually happen at night", "the darkest map in the game, taking place at night" [src:fandom/Halloween_Map, fandom/Maps] [M]
- Audio preload (16 sounds, identical to the original): `log_01`, `log_02`, `pumpkin_break_01`, `vault_change_02` (sfx), kill-leader voice lines `kill_leader_assigned_01/02`, `kill_leader_dead_01/02` (ui), `trick_01`–`03`, `treat_01` (ui), `xp_pickup_01/02` (ui), `xp_drop_01/02` (sfx) [src:survev/shared/defs/maps/halloweenDefs.ts:16-81, kong/relaunch-client-defs] [H]
- Menu music: survev sets `ambience.music` to `menu_music_02` (Halloween theme, also used as the victory jingle); the original changed the menu music for the event but `menu_music_02` is not in the 0.8.82 client [src:survev/shared/defs/maps/halloweenDefs.ts:98-100, survev/client/src/game.ts:1552, fandom/Halloween_Map, fandom/Changelog, kong/relaunch-client-defs] [H]
- Atlases: loadout, shared, halloween (original also `gradient`) [src:survev/shared/defs/maps/halloweenDefs.ts:82, kong/relaunch-client-defs] [H]

## Game mode and rules

- `gameMode: { maxPlayers: 80, killLeaderEnabled: true, spookyKillSounds: true }` [src:survev/shared/defs/maps/halloweenDefs.ts:103-107, kong/relaunch-client-defs] [H]
- `spookyKillSounds` (client): kill-leader assignment/death play the voice groups `kill_leader_assigned` / `kill_leader_dead` instead of the normal drum and scrape sounds [src:survev/client/src/game.ts:1424-1431, survev/client/src/game.ts:1494-1497] [H]
- The voice lines say "A new kill leader has approached" and "rest in pieces, kill leader"; the Halloween map was the first to use them [src:fandom/Halloween_Map] [M]
- `spookyKillSounds` also swaps grenade sprites through `halloweenSpriteMap`: `proj-frag-pin-01` / `-nopin-01` / `-nopin-nolever-01` → `-02` (face on the grenade) and `proj-mirv-mini-01` → `-02`, both in flight and in the player's hands [src:survev/client/src/objects/projectile.ts:21-26, survev/client/src/objects/projectile.ts:146-148, survev/client/src/objects/player.ts:1722-1724, fandom/Halloween_Map] [H]
- Airdrops: circle 1 + 10 s normal crate (`airdrop_crate_01` 10 : `airdrop_crate_02` 1); circle 3 + 2 s always the golden pumpkin air drop `airdrop_crate_02h` [src:survev/shared/defs/maps/halloweenDefs.ts:110-130] [H]
- fandom schedule: 0:55 air drop on step 1, 0:38 Golden Pumpkin Air Drop on step 3 [src:fandom/Halloween_Map] [M]
- The golden pumpkin air drop (circular, `map-airdrop-01h`) opens into `cache_pumpkin_airdrop_02` = crate `crate_11h` on an orange light decal [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1156-1169, survev/shared/defs/mapObjects/buildings/cacheDefs.ts:646-662, kong/relaunch-client-defs] [H]
- `crate_11h` (original): 1 airdrop rare, 1 airdrop armor, 2 medical, 1 airdrop scope, 1 airdrop outfit, 1 `tier_outfits`, 1 airdrop melee, 3 airdrop ammo, 1 airdrop throwable and 2 `tier_airdrop_xp` [src:kong/relaunch-client-defs] [H]
- The 2019 announcement: the golden pumpkin air drop arrives near the end of each game and "has a very high chance of containing an Island artifact" [src:fandom/Changelog] [M]
- XP artifacts grant Survivr Pass XP and existed only on the Halloween map (and from Nov 26, 2019 green squashes); survev disables them: `tier_fruit_xp` = nothing 40, `tier_airdrop_xp` = nothing 15, real entries commented out "until we have a pass" [src:changelog/0.8.7, survev/shared/defs/maps/baseDefs.ts:708-724, fandom/XP_Artifacts] [H]

## Spawns

### Fixed spawns

| id | building / object | survev (s / l) | orig | src |
|---|---|---|---|---|
| `junkyard_01` | Junkyard (ovens, soda machines, toilets, tables, fridges around a loot withered tree with 5 candles) | 1 | 1 | [src:survev/shared/defs/maps/halloweenDefs.ts:241, fandom/Junkyard] [H] |
| `mansion_structure_02` | Halloween Mansion (pumpkins in the cellar instead of wood barrels) | 1 | 1 | [src:survev/shared/defs/maps/halloweenDefs.ts:249, fandom/Pumpkin] [H] |
| `warehouse_01h` | Warehouse (Halloween) | 4 | 4 | [src:survev/shared/defs/maps/halloweenDefs.ts:242] [H] |
| `house_red_01h` | Red House (Halloween) | 2 / 3 | 7 | [src:survev/shared/defs/maps/halloweenDefs.ts:243, derived/git-ae55c9a8] [M] |
| `house_red_02h` | Second Red House (Halloween) | 2 / 3 | absent (fork fix 2026-08; both red houses were replaced by `house_red_01b`) | [src:survev/shared/defs/maps/halloweenDefs.ts:244, derived/git-ae55c9a8, kong/relaunch-client-defs] [M] |
| `barn_01h` | Barn (Halloween) | 1 | 1 | [src:survev/shared/defs/maps/halloweenDefs.ts:245] [H] |
| `cache_03` | leaf-pile cache | 36 | 36 | [src:survev/shared/defs/maps/halloweenDefs.ts:246] [H] |
| `cache_01` | stone cache | 1 | 1 | [src:survev/shared/defs/maps/halloweenDefs.ts:247] [H] |
| `cache_02h` | Mosin tree cache, Halloween skin (fork id; orig `cache_02`) | 1 | 1 (`cache_02`) | [src:survev/shared/defs/maps/halloweenDefs.ts:248, derived/git-ae55c9a8] [M] |
| `bunker_structure_01` | Egg bunker (always, not 5 %) | 1 | 1 | [src:survev/shared/defs/maps/halloweenDefs.ts:250] [H] |
| `bunker_structure_03` | Storm bunker | 1 | 1 | [src:survev/shared/defs/maps/halloweenDefs.ts:251] [H] |
| `bunker_structure_07` | Eye bunker (first released here) | 1 | 1 | [src:survev/shared/defs/maps/halloweenDefs.ts:252, changelog/0.6.4] [H] |
| `mil_crate_02` | OT-38 crate | p = 0.25 | p = 0.25 | [src:survev/shared/defs/maps/halloweenDefs.ts:253] [H] |
| `tree_02h` | wood-axe stump with the bloodstained wood axe | 6 / 8 (fork placement) | absent | [src:survev/shared/defs/maps/halloweenDefs.ts:254, derived/git-ae55c9a8, kong/relaunch-client-defs] [M] |
| `tree_05` | withered tree (400 HP) | 72 | 72 | [src:survev/shared/defs/maps/halloweenDefs.ts:255, fandom/Withered_Tree] [H] |
| `tree_07` / `tree_08` | yellow-green / orange trees | 700 / 200 | same | [src:survev/shared/defs/maps/halloweenDefs.ts:256-257] [H] |
| `tree_09` | stump | 36 | 36 | [src:survev/shared/defs/maps/halloweenDefs.ts:258] [H] |
| `barrel_02`, `oven_01`, `refrigerator_01`, `table_01`, `vending_01`, `woodpile_01` | wood barrel, oven, fridge, table, soda machine, wood pile scattered outdoors (disguise props) | 24 each | 24 each | [src:survev/shared/defs/maps/halloweenDefs.ts:259-264, fandom/Halloween_Map, namu/Surviv.io/이벤트] [H] |
| `stone_04` | Hardstone Block | 1 | 1 | [src:survev/shared/defs/maps/halloweenDefs.ts:265] [H] |

- No random-rotation buildings (`randomSpawns: []`): no bank, police station or normal mansion; no docks, hydra, conch or crossing bunker, no greenhouse, huts or fisherman's shacks [src:survev/shared/defs/maps/halloweenDefs.ts:239-268, fandom/Maps, wikigg/Halloween_mode] [H]
- Spawn replacements: `tree_01` → `tree_07`, river stone `stone_03` → `stone_01`, `cabin_01` → `cabin_02` (Halloween cabin with pumpkin porch) [src:survev/shared/defs/maps/halloweenDefs.ts:269-275, survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:7551-7564] [H]
- fandom: soda machines and toilets spawning outdoors make the map unusually rich in adrenaline items [src:fandom/Halloween_Map] [M]

### Density spawns

| id | object | value | src |
|---|---|---|---|
| `stone_01` | stone | 125 | [src:survev/shared/defs/maps/halloweenDefs.ts:224] [H] |
| `barrel_01` | barrel | 76 | [src:survev/shared/defs/maps/halloweenDefs.ts:225] [H] |
| `crate_01` / `crate_02` / `crate_03` | crate / Soviet crate / grenade crate | 120 / 6 / 8 | [src:survev/shared/defs/maps/halloweenDefs.ts:226-228] [H] |
| `bush_01` | bush | 90 | [src:survev/shared/defs/maps/halloweenDefs.ts:229] [H] |
| `hedgehog_01` | hedgehog | 12 | [src:survev/shared/defs/maps/halloweenDefs.ts:230] [H] |
| `cache_pumpkin_01` | Pumpkin on an orange light decal (`decal_light_01`) | 32 | [src:survev/shared/defs/maps/halloweenDefs.ts:231, survev/shared/defs/mapObjects/buildings/cacheDefs.ts:595-611] [H] |
| `cache_pumpkin_03` | Red Pumptato on a red-orange light decal (`decal_light_04`) | 32 | [src:survev/shared/defs/maps/halloweenDefs.ts:232, survev/shared/defs/mapObjects/buildings/cacheDefs.ts:629-645] [H] |
| `shack_01` / `outhouse_01` | shack / outhouse | 6 / 6 | [src:survev/shared/defs/maps/halloweenDefs.ts:233-234] [H] |
| `loot_tier_1` / `loot_tier_beach` | ground loot / beach loot (double main) | 48 / 8 | [src:survev/shared/defs/maps/halloweenDefs.ts:235-236] [H] |

## Pumpkins and obstacles

| id | name | HP / radius | loot | src |
|---|---|---|---|---|
| `pumpkin_01` | Pumpkin (0.6.4) | 100 / r1.9 | 1 `tier_outfits` (disguise) + 1 `tier_pumpkin_candy` (empty in survev) | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:742-744, survev/shared/defs/maps/baseDefs.ts:691, kong/relaunch-client-defs] [H] |
| `pumpkin_02` | Jack-o'-Lantern (0.6.4) | 140 / r1.9 | 1–2 `tier_guns`, 1–2 candy, 1 `tier_outfits` | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:745-753, fandom/Jack-o'-Lantern, kong/relaunch-client-defs] [H] |
| `pumpkin_03` | Red Pumptato (0.8.7) | 100 / r1.25, hidden on the minimap | 1 `tier_pumpkin_perks` (= Trick or Treat?) + 1 `tier_fruit_xp` | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:754-762, fandom/Red_Pumptato, kong/relaunch-client-defs] [H] |

- Pumpkins break with `pumpkin_break_01`, chips `pumpkinChip`, map dot 0xf27503 [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:224-256] [H]
- The original red pumptato uses sprite `map-pumpkin-03` / residue `-res-03`; survev uses `map-pumpkin-04` [src:kong/relaunch-client-defs, survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:757-760] [H]
- Red pumptatos do not regrow (unlike potatoes) and have a red light decal so they look like they glow [src:fandom/Red_Pumptato] [M]
- In survev, `pumpkin_02` (jack-o'-lantern) only appears on the Halloween cabin porch (`cache_pumpkin_02`); fandom says jack-o'-lanterns are "usually found scattered around the island" [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:7551-7558, fandom/Jack-o'-Lantern] [L]
- Candles (non-colliding, orange light) decorate the mansion and eye bunker; a pumpkin's light "goes out" when it breaks [src:fandom/Candle] [M]
- Junkyard centre tree `tree_05b` (500 HP) drops 1 `tier_shotguns`, 1 `tier_lmgs` and the Spooky Barkskin [src:fandom/Withered_Tree] [M]

## Loot overrides

| tier | survev | src |
|---|---|---|
| `tier_outfits` | 19 obstacle disguises at weight 1: barrel, wood barrel, stone, Halloween tree, stump, bush, leaf pile, crate, table, Soviet crate, oven, refrigerator, vending machine, pumpkin, woodpile, toilet, river bush, crab, stump-with-axe | [src:survev/shared/defs/maps/halloweenDefs.ts:179-199] [H] |
| `tier_throwables` | frag ×2 0.5, smoke 1, MIRV ×2 0.05 (half the frags of main) | [src:survev/shared/defs/maps/halloweenDefs.ts:133-137] [H] |
| `tier_airdrop_outfits` | nothing 4, Hot Drop (`outfitAirdrop`) 1 | [src:survev/shared/defs/maps/halloweenDefs.ts:138-141] [H] |
| `tier_toilet` / `tier_container` | as main but `tier_outfits` weight 0 (no disguises from toilets/containers) | [src:survev/shared/defs/maps/halloweenDefs.ts:142-170] [H] |
| `tier_scopes` | 2x 24, 4x 5 (no 8x or 15x in world loot) | [src:survev/shared/defs/maps/halloweenDefs.ts:171-174] [H] |
| `tier_airdrop_scopes` | nothing 18, 4x weight 0 (airdrops give no scope) | [src:survev/shared/defs/maps/halloweenDefs.ts:175-178] [H] |
| `tier_guns` / `tier_chest` | main tables (incl. survev's fork BAR) | [src:survev/shared/defs/maps/baseDefs.ts:253-323, balance/146] [H] |

- The disguise list is identical in the pre-fork def; survev's `outfitHalloweenTree` ("Tree Costume", obstacle `tree_07`) is the original `outfitTree` under a fork id; the original also has `outfitTreeSpooky` ("Spooky Tree Costume", obstacle `tree_05`), which survev keeps but leaves out of this table [src:derived/git-ae55c9a8, kong/relaunch-client-defs, survev/shared/defs/gameObjects/outfitDefs.ts:1357-1368] [H]
- The original Stump Axe Costume (`outfitStumpAxe`) disguises as `tree_02h`, the bloodstained wood-axe stump, which supports survev placing `tree_02h` on this map [src:kong/relaunch-client-defs, survev/shared/defs/maps/halloweenDefs.ts:254] [M]
- Disguise outfits turn the wearer into a static copy of the obstacle; the event was played like hide-and-seek [src:fandom/Halloween_Map, namu/Surviv.io/이벤트] [M]
- 2019 skins added: Lilyveil, Crabby Camo, Axe-querade [src:fandom/Changelog] [M]

## Perks (Trick or Treat?)

- `tier_pumpkin_perks` = `halloween_mystery` ("Trick or Treat?"); on pickup the server replaces it with a random entry of `tier_halloween_mystery_perks` and marks it `replaceOnDeath: halloween_mystery` [src:survev/shared/defs/maps/baseDefs.ts:692, survev/server/src/game/objects/player.ts:3925-3976] [H]
- Mystery perks cannot be dropped ("Looter beware") and drop on death [src:fandom/Changelog, fandom/Trick_or_Treat?] [M]
- survev weights: tricks `trick_nothing`, `trick_size`, `trick_m9`, `trick_chatty`, `trick_drain` and treats `treat_9mm`, `treat_12g`, `treat_556`, `treat_762` at 1 each, `treat_super` 0.1 — guessed, not original data [src:survev/shared/defs/maps/baseDefs.ts:708, survev/shared/defs/maps/baseDefs.ts:725-737] [M]

| id | name | Korean | effect (en description) | src |
|---|---|---|---|---|
| `halloween_mystery` | Trick or Treat? | 트릭 오어 트리트? | "Could be either." | [src:survev/shared/defs/gameObjects/perkDefs.ts:691, l10n/en:game-halloween_mystery-desc, l10n/ko:game-halloween_mystery] [H] |
| `trick_nothing` | One With Nothing | 아무것도 아닌 것 | does nothing | [src:survev/shared/defs/gameObjects/perkDefs.ts:705, l10n/en:game-trick_nothing-desc, l10n/ko:game-trick_nothing] [H] |
| `trick_size` | Feedership | 피더십 | grow in size (scale +0.25) | [src:survev/shared/defs/gameObjects/perkDefs.ts:45-47, l10n/en:game-trick_size-desc, l10n/ko:game-trick_size] [H] |
| `trick_m9` | Dev Troll Special | 개발자의 스페셜 트롤링 | cursed with a developer "treat" (M9 Cursed) | [src:survev/server/src/game/objects/player.ts:1185, l10n/en:game-trick_m9-desc, l10n/ko:game-trick_m9, fandom/Changelog] [H] |
| `trick_chatty` | Gabby Ghost | 수다스러운 유령 | emote randomly | [src:survev/server/src/game/objects/player.ts:1634-1637, l10n/en:game-trick_chatty-desc, l10n/ko:game-trick_chatty] [H] |
| `trick_drain` | That Sucks | 그거 형편없군 | bleed very slowly | [src:survev/server/src/game/objects/player.ts:1604-1611, l10n/en:game-trick_drain-desc, l10n/ko:game-trick_drain] [H] |
| `treat_9mm` | Candy Corn | 캔디 콘 | 9mm bullets darker and deadlier | [src:l10n/en:game-treat_9mm-desc, l10n/ko:game-treat_9mm] [H] |
| `treat_12g` | Red Jelly Beans | 레드 젤리빈 | 12 gauge darker and deadlier | [src:l10n/en:game-treat_12g-desc, l10n/ko:game-treat_12g] [H] |
| `treat_556` | Sour Apple Belt | 사우어 애플 벨트 | 5.56mm darker and deadlier | [src:l10n/en:game-treat_556-desc, l10n/ko:game-treat_556] [H] |
| `treat_762` | Blueberry Taffy | 블루베리 태피 | 7.62mm darker and deadlier | [src:l10n/en:game-treat_762-desc, l10n/ko:game-treat_762] [H] |
| `treat_super` | Full Size OKAMI Bar | 풀사이즈 오카미 바 | all bullets darker and deadlier | [src:l10n/en:game-treat_super-desc, l10n/ko:game-treat_super, survev/server/src/game/weaponManager.ts:701] [H] |

- Each trick/treat perk fires an emote on pickup with sound `trick_01`–`03` or `treat_01` [src:survev/shared/defs/gameObjects/emoteDefs.ts:125-200] [H]
- Ammo-perk damage bonus: survev 1.12×, original 1.08× (applies to the treat perks) [src:balance/336, survev/shared/defs/gameObjects/perkDefs.ts:165] [H]
- Perk mechanics are documented in `items/perks.md` [src:survev/shared/defs/gameObjects/perkDefs.ts:690-855] [H]

## Trivia

- Obstacles (tables, soda machines, ovens...) are scattered around the map for players to camp in obstacle skins; the map is also the best one for "destroy furniture" quests [src:fandom/Halloween_Map] [M]
- The Eye bunker was first released on this map; its code is the "Riddle of Six" (egg, hydra, storm, conch, crossing, hatchet) [src:fandom/Changelog, survev/shared/defs/puzzles.ts:2, wikigg/Halloween_mode] [H]
- The 2018 Halloween mode was solo-only and "wickedly familiar" (a prop-hunt twist) [src:fandom/Changelog] [M]
- survev.wiki.gg says Halloween was the first mode reintroduced in survev.io (survev v0.0.15) (fork history) [src:wikigg/Halloween_mode] [M]
- Korean: 펌킨 헤드 (Pumpkin Head), 웃기면서 무서운 나무껍질 (Spoopy Barkskin), 사자들의 숲 (Deader Wood), 핫 드롭 (Hot Drop) [src:l10n/ko:game-outfitPumpkin, l10n/ko:game-outfitTreeSpooky, l10n/ko:game-outfitWoodpile, l10n/ko:game-outfitAirdrop] [H]

## Conflicts

- CONFLICT halloween-ghillie: playerGhillie 0x212404 [src:kong/relaunch-client-defs] vs survev inherits 0x83af50 [src:survev/shared/defs/maps/halloweenDefs.ts:85-94]; proposed: 0x212404 [H]
- CONFLICT halloween-night: wikis say the event happens "at night" [src:fandom/Halloween_Map, fandom/Maps] vs survev and the original client implement only dark colours plus `valueAdjust` 0.3, no lighting system [src:survev/shared/defs/maps/halloweenDefs.ts:101, kong/relaunch-client-defs]; proposed: reproduce the valueAdjust tint; any extra night overlay is new design, mark optional [M]
- CONFLICT halloween-red-houses: 2/3 × `house_red_01h` + 2/3 × `house_red_02h` [src:survev/shared/defs/maps/halloweenDefs.ts:243-244] vs 7 × `house_red_01h` [src:derived/git-ae55c9a8]; proposed: keep survev's split (both Halloween houses exist in the original client), counts as a config knob [L]
- CONFLICT halloween-jack-o-lantern-spawns: jack-o'-lanterns only on cabin porches [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:7551-7558] vs "usually found scattered around the island" [src:fandom/Jack-o'-Lantern]; proposed: open question; optionally add `cache_pumpkin_02` to density spawns [L]
- CONFLICT halloween-date-2018: Oct 29, 2018 [src:changelog/0.6.4] vs Oct 30, 2018 [src:fandom/Changelog, wikigg/Halloween_mode]; proposed: Oct 29 (changelog file) [M]

## Open questions

- Original weights of `tier_halloween_mystery_perks`, `tier_fruit_xp`, `tier_airdrop_xp` and `tier_pumpkin_candy` (survev marks them guessed or unused) [src:survev/shared/defs/maps/baseDefs.ts:691, survev/shared/defs/maps/baseDefs.ts:708-737] [L]
- Was the 2018 map (before red pumptatos) using `cache_pumpkin_02` jack-o'-lanterns in the slots where 2019 used `cache_pumpkin_03`? [src:changelog/0.6.4, changelog/0.8.7, fandom/Jack-o'-Lantern] [L]
- Whether the Halloween place renames (2019) should be implemented; no source gives their coordinates beyond reusing main's places [src:fandom/Maps] [L]
