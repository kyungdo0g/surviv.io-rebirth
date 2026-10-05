# Cosmetics, passes, quests and unlocks

> Summary-level inventory of everything in survev that is a loadout cosmetic or account progression: outfits, emotes, crosshairs, heal/boost particles, death effects, passes, quests, unlocks and XP artifacts. Accounts and the loadout menu are out of scope until the rebirth has accounts, so this file lists ids and counts and only goes into detail where a cosmetic changes gameplay (Ghillie Suit, faction tints and patches, obstacle disguises, no-drop role outfits).
> "orig" files are survev's first commit `9f64948d` (decompiled v0.8.82 client defs), cited `derived/survev@9f64948d:<path>:<line>`. Status per id (original / post-0.8.82 / fork) follows `docs/research/provenance/fork-vs-original.json`, cited `derived/fork-vs-original-json`. Rarity numbers use `Rarity` = Stock 0, Common 1, Uncommon 2, Rare 3, Epic 4, Mythic 5.

## Counts

| kind | v0.8.82 client | survev total | survev split (original / post-0.8.82 / fork) | sources |
|---|---|---|---|---|
| outfit | 70 | 90 | 69 / 1 / 20 (orig `outfitTree` renamed `outfitHalloweenTree`) | [src:derived/survev@9f64948d:src/defs/outfitDefs.js:1-1060] [src:survev/shared/defs/gameObjects/outfitDefs.ts:1-1503] [src:derived/fork-vs-original-json] [H] |
| emote | 165 | 189 | 164 / 1 / 24 (orig `emote_flagisrael` removed) | [src:derived/survev@9f64948d:src/defs/emoteDefs.js:1-1624] [src:survev/shared/defs/gameObjects/emoteDefs.ts:1-1880] [src:derived/fork-vs-original-json] [H] |
| crosshair | 30 | 30 | 30 / 0 / 0 | [src:derived/survev@9f64948d:src/defs/crosshairDefs.js:1-213] [src:survev/shared/defs/gameObjects/crosshairDefs.ts:1-253] [H] |
| heal effect | 4 | 7 | 4 / 0 / 3 | [src:derived/survev@9f64948d:src/defs/healEffectDefs.js:1-58] [src:survev/shared/defs/gameObjects/healEffectDefs.ts:11-62] [H] |
| boost effect | 4 | 8 | 4 / 0 / 4 | [src:derived/survev@9f64948d:src/defs/healEffectDefs.js:1-58] [src:survev/shared/defs/gameObjects/healEffectDefs.ts:63-122] [H] |
| pass | 1 | 2 | 1 / 0 / 1 | [src:derived/survev@9f64948d:src/defs/passDefs.js:1-76] [src:survev/shared/defs/gameObjects/passDefs.ts:10-292] [H] |
| quest | 24 | 70 | 25 / 0 / 45 (`quest_top_duo` judged original) | [src:derived/survev@9f64948d:src/defs/questDefs.js:1-151] [src:survev/shared/defs/gameObjects/questDefs.ts:1-1375] [src:derived/fork-vs-original-json] [H] |
| unlock | 2 | 2 | 2 / 0 / 0 | [src:derived/survev@9f64948d:src/defs/unlockDefs.js:1-13] [src:survev/shared/defs/gameObjects/unlockDefs.ts:9-208] [H] |
| XP artifact | 14 | 14 | 14 / 0 / 0 | [src:derived/survev@9f64948d:src/defs/xpDefs.js:1-132] [src:survev/shared/defs/gameObjects/xpDefs.ts:1-143] [H] |
| death effect | 0 | 0 | — (death animations are a post-0.8.82 Survivr Pass 4 loadout slot) | [src:fandom/Death_Animation] [src:survev/client/src/objects/player.ts:3011-3041] [H] |

- The relaunch client confirms the same original sets: 164 matching emotes plus `emote_flagisrael`, 68 + `outfitTree` outfits matching, 30 crosshairs, 14 XP artifacts, 1 pass, 24 quests [src:kong/relaunch-client-defs] [src:derived/live-vs-survev] [H]
- Loadout customisation (outfit, emotes, crosshair, player icon) arrived in v0.8.0; emote loadout (wheel + on-win and on-death emotes) in v0.2.6; heal/boost particles, pass and quests in v0.8.6 [src:changelog/0.8.0] [src:changelog/0.2.6] [src:changelog/0.8.6] [H]
- Original default emote loadout: `emote_happyface`, `emote_thumbsup`, `emote_surviv`, `emote_sadface` plus two empty slots [src:derived/survev@9f64948d:src/gameConfig.ts:141] [H]

## Outfits

- Default and account outfits: `outfitBase` "Basic Outfit" (r0, never drops on death); `outfitDarkShirt` "The Semi-Pro" (granted by `unlock_new_account`) [src:survev/shared/defs/gameObjects/outfitDefs.ts:29] [src:survev/shared/defs/gameObjects/unlockDefs.ts:202-207] [H]
- Cobalt class outfits (all "Basic Outfit", `noDrop`): `outfitDemo`, `outfitTank`, `outfitMedic`, `outfitScout`, `outfitSniper`, `outfitAssault`; fork `outfitClassless` [src:survev/shared/defs/gameObjects/outfitDefs.ts:65-169] [src:derived/survev@9f64948d:src/defs/outfitDefs.js:47-140] [H]
- 50v50 Commander outfits (`noDrop`, given by the role): `outfitRedLeader` "Red Leader", `outfitBlueLeader` "Blue Leader"; their droppable desert loot twins are `outfitRedLeaderAged` "Red Victorious" and `outfitBlueLeaderAged` "Stifled Blue" [src:survev/shared/defs/gameObjects/outfitDefs.ts:288-377] [src:fandom/Red_Leader] [H]
- Outfits with a rarity (account / pass / loot): `outfitTurkey` Fowl Facade (r3), `outfitDev` Developer Swag (r5), `outfitMod` Game Moderatr (r4; orig name "Discord Moderatr"), `outfitKhaki` The Initiative (r1), `outfitParma` PARMA Jumpsuit (r1), `outfitParmaPrestige` The Core Jumpsuit (r3), `outfitWoodland` Woodland Combat (r1), `outfitRoyalFortune` Royal Fortune (r3), `outfitKeyLime` Key Lime (r1), `outfitCobaltShell` Cobalt Shell (r1), `outfitCarbonFiber` Carbon Fiber (r2), `outfitDarkGloves` The Professional (r2), `outfitDarkShirt` The Semi-Pro (r1), `outfitDesertCamo` Desert Camo (r1), `outfitCamo` Forest Camo (r1), `outfitRed` Target Practice (r1), `outfitWhite` Arctic Avenger (r1) [src:survev/shared/defs/gameObjects/outfitDefs.ts:186-983] [src:derived/survev@a14ab228:client/l10n/en.json:387] [src:survev/client/src/en.json:478] [H]
- World/loot outfits without a rarity: `outfitWheat` Splintered Wheat, `outfitNoir` Neo Noir, `outfitSpetsnaz` Siberian Assault, `outfitWoodsCloak` Greencloak, `outfitElf` Tallow's Little Helper, `outfitImperial` Imperial Seal, `outfitLumber` Woodcutter's Wrap, `outfitVerde` Poncho Verde, `outfitPineapple` Valiant Pineapple, `outfitTarkhany` Tarkhany Regal, `outfitWaterElem` Water Elemental, `outfitHeaven` Celestial Garb, `outfitMeteor` Falling Star, `outfitIslander` Island Time, `outfitAqua` Aquatic Avenger, `outfitCoral` Coral Guise, `outfitCasanova` Casanova Silks, `outfitPrisoner` The New Black, `outfitJester` Jester's Folly, `outfitGhillie` Ghillie Suit [src:survev/shared/defs/gameObjects/outfitDefs.ts:288-907] [H]
- Obstacle disguises (21 original, `obstacleType` + `baseScale`): `outfitBarrel` Fish in a Barrel (barrel_01, 0.8), `outfitWoodBarrel` Fish in a Wood Barrel (barrel_02), `outfitStone` Stoneskin (stone_01, 0.9), `outfitHalloweenTree` Barkskin (tree_07; orig id `outfitTree`), `outfitTreeSpooky` Spoopy Barkskin (tree_05), `outfitStump` Dead Wood (tree_09), `outfitBush` Bush Wookie (bush_01b), `outfitLeafPile` Sneaky Leaf (bush_06b), `outfitCrate` Guy in a Box (crate_01), `outfitTable` Yard Sale (table_01), `outfitSoviet` Comrade in a Box (crate_02), `outfitAirdrop` Hot Drop (crate_10), `outfitOven` Half-baked (oven_01), `outfitRefrigerator` Cold Fusion (refrigerator_01b), `outfitVending` OKAMI Cola Machine (vending_01), `outfitPumpkin` Pumpkin Head (pumpkin_01), `outfitWoodpile` Deader Wood (woodpile_01), `outfitToilet` Size Two (toilet_02), `outfitBushRiver` Lilyveil (bush_04), `outfitCrab` Crabby Camo (crate_20), `outfitStumpAxe` Axe-querade (tree_02h); fork adds `outfitSpringTree` Barkskin (tree_07sp) [src:survev/shared/defs/gameObjects/outfitDefs.ts:1325-1493] [src:derived/survev@9f64948d:src/defs/outfitDefs.js:914-922] [H]
- Post-0.8.82 outfit re-created by survev: `outfitFragtastic` Fragtastic (r1, Survivr Pass 3, June 2020) (post-0.8.82) [src:survev/shared/defs/gameObjects/outfitDefs.ts:828] [src:fandom/Fragtastic] [M]
- Fork outfits (20): `outfitClassless`, `outfitMaintainer` Maintainer Swag (r5), `outfitGD` Game Designr (r4), `outfitSnow` Snowed Over (r2), `outfitBlackIce` Black Ice (r1), `outfitBeachCamo` Beach Shored, `outfitCoconut` Coconut Frenzy (r1), `outfitWave` Tidal Wave (r1), `outfitParrotfish` Parrotfish (r3), `outfitEvent` Event Winnr (r3), `outfitGold` Capital Gains, `outfitRain` Rainy Day (r1), `outfitCowz` Cowz Cloak (r1), `outfitChameleon` The Chameleon (r2), `outfitPastel` Pastel Sky (r2), `outfitChrys` Chrysanthemum Garb (r3), `outfitFahrenheit` Fahrenheit 5182 (r3), `outfitPotatoskin` Potatoskin (r4), `outfitAurora` Auroric Ascension (r5), `outfitSpringTree` Barkskin (fork) [src:survev/shared/defs/gameObjects/outfitDefs.ts:169-1349] [src:derived/fork-vs-original-json] [H]
- Outfit flags: `noDrop` (class and Commander outfits) never drop; `noDropOnDeath` (base, account, pass and staff outfits) stay with the player on death; everything else drops on death and can be looted [src:survev/shared/defs/gameObjects/outfitDefs.ts:29-377] [src:changelog/0.0.3] [H]
- Outfit loot tables (survev estimates): normal-map `tier_outfits` Cobalt Shell 0.3, Key Lime 0.25, Woodland 0.3, Forest Camo 0.2, Ghillie Suit 0.01; building floors give Casanova (mansion), Jester's Folly (vault), The New Black (police), Imperial Seal (chrysanthemum bunker); 50v50 golden airdrops give Ghillie Suits [src:survev/shared/defs/maps/baseDefs.ts:195-202] [src:survev/shared/defs/maps/baseDefs.ts:394-402] [src:survev/shared/defs/maps/baseDefs.ts:744] [src:fandom/Ghillie_Suit] [L]

### Gameplay-relevant outfits

- Ghillie Suit (`outfitGhillie`, flag `ghillie`): body, hands and feet take the map's `playerGhillie` colour, and the vest, helmet, backpack, class visor, Flak Jacket outline and Cast Ironskin pan are hidden [src:survev/client/src/objects/player.ts:1465-1470] [src:survev/client/src/objects/player.ts:1527-1620] [src:survev/client/src/objects/player.ts:1789-1793] [src:derived/survev@9f64948d:src/defs/outfitDefs.js:795-797] [src:fandom/Ghillie_Suit] [H]
- `playerGhillie` per map: main 0x83af50, desert 0xdfa761, faction 0x4c6024, woods 0x91852c, savannah 0xb0ac2b, cobalt 0x4b5866 (4937830 in the original def), snow 0xbbbbbb, spring 0x5b8e0a, summer 0x659825, turkey 0xa48e2e, woods spring 0x41630a, woods summer 0x659825 [src:survev/shared/defs/maps/baseDefs.ts:44] [src:survev/shared/defs/maps/desertDefs.ts:41] [src:survev/shared/defs/maps/factionDefs.ts:94] [src:survev/shared/defs/maps/woodsDefs.ts:33] [src:survev/shared/defs/maps/savannahDefs.ts:30] [src:survev/shared/defs/maps/cobaltDefs.ts:33] [src:survev/shared/defs/maps/snowDefs.ts:32] [src:survev/shared/defs/maps/mainSpringDefs.ts:23] [src:survev/shared/defs/maps/mainSummerDefs.ts:32] [src:survev/shared/defs/maps/turkeyDefs.ts:43] [src:survev/shared/defs/maps/woodsSpringDefs.ts:35] [src:survev/shared/defs/maps/woodsSummerDefs.ts:18] [src:derived/survev-git-33832ffe] [H]
- survev notes that surviv never had a snow ghillie colour (keeps 0xbbbbbb); fandom says the Woods-map Ghillie kept the normal-map colour, and that map-dependent colour replaced the separate Desert/Vernal/Verdant/Incursion ghillies in v0.8.3 [src:survev/shared/defs/maps/snowDefs.ts:32] [src:fandom/Ghillie_Suit] [M]
- Ghillie Suit is a 1 % roll of `tier_outfits` in survev and very common in 50v50 golden airdrops (fandom); the Commander cannot pick it up [src:survev/shared/defs/maps/baseDefs.ts:396-402] [src:fandom/Ghillie_Suit] [src:fandom/Commander] [M]
- Faction tints: in 50v50 every non-ghillie player wears a team arm patch (`player-patch-01.img` / `-02.img`, potato-faction `-01po` / `-02po`) tinted with `teamColors` red 0xcc0000 / blue 0x007eff, and helmets use their `baseTintRed` / `baseTintBlue` [src:survev/client/src/objects/player.ts:1493-1517] [src:survev/client/src/objects/player.ts:1603-1611] [src:derived/survev@9f64948d:src/gameConfig.ts:167] [H]
- Fork restriction: outfits with a `teamId` (red 1 / blue 2) cannot be picked up or worn by the other faction in 50v50 (commit 4648cc17, 2026-04-10); the original outfit defs have no `teamId` (fork) [src:survev/server/src/game/objects/player.ts:743-748] [src:survev/server/src/game/objects/player.ts:3898-3903] [src:derived/survev-git-4648cc17] [src:derived/survev@9f64948d:src/defs/outfitDefs.js:1-1060] [H]
- Obstacle disguises: wearing one spawns a non-collidable copy of the obstacle (scale `baseScale`) that follows the player, shows the player's health as damage, and is destroyed on death; the wearer's own bullets pass through it [src:survev/server/src/game/objects/player.ts:743-756] [src:survev/server/src/game/map.ts:1930-1951] [src:survev/server/src/game/objects/obstacle.ts:170-171] [src:survev/server/src/game/objects/player.ts:647-662] [src:survev/server/src/game/objects/player.ts:2909-2911] [src:survev/server/src/game/weaponManager.ts:945] [H]
- Halloween map `tier_outfits` (survev): the 19 Halloween disguises (Barrel, Wood Barrel, Stone, Tree, Stump, Bush, Leaf Pile, Crate, Table, Soviet, Oven, Fridge, Vending, Pumpkin, Woodpile, Toilet, River Bush, Crab Pot, Stump Axe) at weight 1 each; the original changelog adds "halloween map skins" in 0.6.4 and 0.8.7 [src:survev/shared/defs/maps/halloweenDefs.ts:179-199] [src:changelog/0.6.4] [src:changelog/0.8.7] [H]
- Role outfits block outfit pickups while the role is held (`noDropOutfit`, e.g. Commander) [src:survev/server/src/game/objects/player.ts:3904-3911] [src:survev/shared/defs/gameObjects/roleDefs.ts:154] [H]

## Emotes

- Categories in survev (`EmoteCategory`: Locked, Faces, Food, Animals, Logos, Other, Flags, Default): Locked 21, Faces 24, Food 14, Animals 5, Logos 14, Other 31, Flags 80 [src:survev/shared/defs/gameObjects/emoteDefs.ts:4-13] [src:survev/shared/defs/gameObjects/emoteDefs.ts:1-1880] [H]
- Locked (in-game only, not equippable): `emote_medical`, `emote_ammo`, `emote_ammo9mm`, `emote_ammo12gauge`, `emote_ammo762mm`, `emote_ammo556mm`, `emote_ammo50ae`, `emote_ammo308sub`, `emote_ammoflare`, `emote_ammo45acp`, `emote_loot`, `emote_trick_nothing`, `emote_trick_size`, `emote_trick_m9`, `emote_trick_chatty`, `emote_trick_drain`, `emote_treat_9mm`, `emote_treat_12g`, `emote_treat_556`, `emote_treat_762`, `emote_treat_super` [src:survev/shared/defs/gameObjects/emoteDefs.ts:1-1880] [H]
- Faces: sadface, happyface, joyface, sobface, thinkingface, angryface, upsidedownface, alienface, dabface, impface, monocleface, sunglassface, headshotface, disappointface, heartface, bandagedface, picassoface, pooface; post-0.8.82 boffy; fork sadboffy, traumatizedface, flatteredface, salutingface, screamingface (all `emote_` prefixed) [src:survev/shared/defs/gameObjects/emoteDefs.ts:1-1880] [src:derived/fork-vs-original-json] [H]
- Food: potato, leek, eggplant, baguette, pineapple, coconut, chickendinner, icecream, cupcake, donut, acorn, candycorn; fork tomato, cake [src:survev/shared/defs/gameObjects/emoteDefs.ts:1-1880] [src:derived/fork-vs-original-json] [H]
- Animals: crab, whale, fish, cattle, turkeyanimal [src:survev/shared/defs/gameObjects/emoteDefs.ts:1-1880] [H]
- Logos: surviv, logosurviv, logoegg, logoswine, logohydra, logostorm, logocaduceus, logoconch, logometeor, logocrossing, logohatchet, logochrysanthemum, logocloud, logotwins [src:survev/shared/defs/gameObjects/emoteDefs.ts:1-1880] [H]
- Other: bugle_inspiration_red, bugle_final_red, bugle_inspiration_blue, bugle_final_blue, thumbsup, gg, question, tombstone, heart, sleepy, flex, teabag, egg, police, chick, salt, campfire, trunk, forest, pumpkin, pilgrimhat, santahat, snowman, snowflake, ghost_base, ok, rainbow; fork leaf, antisocial, timeout, bruh [src:survev/shared/defs/gameObjects/emoteDefs.ts:1-1880] [src:derived/fork-vs-original-json] [H]
- Flags (67 original kept by survev, plus the removed `flagisrael` = 68 in v0.8.82): us, thailand, germany, france, southkorea, brazil, canada, spain, russia, mexico, poland, uk, colombia, ukraine, turkey, philippines, czechia, peru, austria, argentina, japan, venezuela, vietnam, switzerland, netherlands, china, taiwan, chile, australia, denmark, italy, sweden, ecuador, slovakia, hungary, romania, hongkong, indonesia, finland, norway, belarus, belgium, kazakhstan, malaysia, newzealand, honduras, bolivia, croatia, india, georgia, greece, guatemala, portugal, serbia, singapore, trinidad, uruguay, morocco, estonia, algeria, egypt, azerbaijan, albania, lithuania, latvia, uae, dominicanrepublic, israel (removed by survev) [src:survev/shared/defs/gameObjects/emoteDefs.ts:1-1880] [src:derived/survev@9f64948d:src/defs/emoteDefs.js:1064-1073] [H]
- Fork flags (13): bosnia, libya, palestine, iran, lebanon, yemen, transgender, pride, lesbian, gay, asexual, nonbinary, bisexual (fork) [src:survev/shared/defs/gameObjects/emoteDefs.ts:757-767] [src:survev/shared/defs/gameObjects/emoteDefs.ts:1617-1717] [src:derived/fork-vs-original-json] [H]
- survev removed `emote_flagisrael` (original, in the original default unlock list) in commit 663bdd6e (2026-06-08) (fork) [src:derived/survev-git-663bdd6e] [src:derived/survev@9f64948d:src/defs/unlockDefs.js:5] [H]
- Emote rarities in survev: 152 Common, 7 Uncommon, 5 Rare, 25 without rarity (locked/role emotes) [src:survev/shared/defs/gameObjects/emoteDefs.ts:1-1880] [H]
- Survivr Pass 1 emotes: Bandaged Face, Picasso Face, Poo Face, Ok, Ghost, Rainbow (v0.8.6) [src:changelog/0.8.6] [src:survev/shared/defs/gameObjects/passDefs.ts:10-111] [H]
- Emote rate limits: soft cooldown 2 s, hard cooldown 6 s, threshold 6 emotes (original client config) [src:derived/survev@9f64948d:src/gameConfig.ts:130-132] [src:survev/server/src/game/objects/player.ts:1583-1598] [H]

## Crosshairs

- 30 crosshairs, identical in the original client and survev: `crosshair_default` (r0) and `crosshair_001`, `005`, `007`, `010`, `022`, `027`, `038`, `040`, `045`, `051`, `064`, `080`, `086`, `094`, `098`, `101`, `102`, `109`, `118`, `124`, `125`, `136`, `158`, `160`, `173`, `176`, `177`, `181`, `184` ("Style NNN", r1) [src:survev/shared/defs/gameObjects/crosshairDefs.ts:1-253] [src:derived/survev@9f64948d:src/defs/crosshairDefs.js:1-213] [H]
- The original default unlock gave 15 of them (default, 001, 005, 007, 027, 080, 086, 094, 098, 101, 118, 136, 158, 160, 176); the rest were added in v0.8.6 ("additional crosshairs"); survev unlocks all 30 by default (commit 90c96422 "RIP free skins") (fork) [src:derived/survev@9f64948d:src/defs/unlockDefs.js:5] [src:changelog/0.8.6] [src:derived/survev-git-90c96422] [H]

## Heal and boost particles

| id | name | rarity | status | sources |
|---|---|---|---|---|
| `heal_basic` | Basic Healing | 0 | original | [src:survev/shared/defs/gameObjects/healEffectDefs.ts:11] [src:derived/survev@9f64948d:src/defs/healEffectDefs.js:2-8] [H] |
| `heal_heart` | Healing Hearts | 1 | original (Pass 1 level 3) | [src:survev/shared/defs/gameObjects/healEffectDefs.ts:18] [src:changelog/0.8.6] [H] |
| `heal_moon` | Blood Moon | 2 | original (Pass 1 level 9) | [src:survev/shared/defs/gameObjects/healEffectDefs.ts:25] [src:changelog/0.8.6] [H] |
| `heal_tomoe` | Tomoe | 3 | original (Pass 1 level 15) | [src:survev/shared/defs/gameObjects/healEffectDefs.ts:32] [src:changelog/0.8.6] [H] |
| `heal_diamond` | Crazy Diamond | 1 | fork (Pass 2) | [src:survev/shared/defs/gameObjects/healEffectDefs.ts:39] [src:derived/survev-git-18d34661] [H] |
| `heal_ankh` | Ankh Charm | 2 | fork (Pass 2) | [src:survev/shared/defs/gameObjects/healEffectDefs.ts:47] [src:derived/survev-git-18d34661] [H] |
| `heal_menacing` | Phantom Blood | 3 | fork (Pass 2) | [src:survev/shared/defs/gameObjects/healEffectDefs.ts:55] [src:derived/survev-git-18d34661] [H] |
| `boost_basic` | Basic Boost | 0 | original | [src:survev/shared/defs/gameObjects/healEffectDefs.ts:63] [H] |
| `boost_star` | Starboost | 1 | original (Pass 1 level 6) | [src:survev/shared/defs/gameObjects/healEffectDefs.ts:70] [src:changelog/0.8.6] [H] |
| `boost_naturalize` | Naturalize | 2 | original (Pass 1 level 12) | [src:survev/shared/defs/gameObjects/healEffectDefs.ts:77] [src:changelog/0.8.6] [H] |
| `boost_shuriken` | Shuriken | 3 | original (Pass 1 level 18) | [src:survev/shared/defs/gameObjects/healEffectDefs.ts:84] [src:changelog/0.8.6] [H] |
| `boost_club` | Club Cola | 1 | fork (Pass 2) | [src:survev/shared/defs/gameObjects/healEffectDefs.ts:91] [H] |
| `boost_hermes` | Winged Grace | 2 | fork (Pass 2) | [src:survev/shared/defs/gameObjects/healEffectDefs.ts:99] [H] |
| `boost_lightning` | Surged | 3 | fork (Pass 2) | [src:survev/shared/defs/gameObjects/healEffectDefs.ts:107] [H] |
| `boost_gearshift` | Gearshift | 4 | fork (Pass 2) | [src:survev/shared/defs/gameObjects/healEffectDefs.ts:115] [H] |

- The equipped particles are also used by Mass Medicate's area heal (fandom) [src:fandom/Mass_Medicate] [M]

## Death effects

- v0.8.82 has no death-effect loadout: the only death effect is Perky Shoot's (a kill by a holder plays a cluck plus `feather_01` and spawns 30–35 `turkeyFeathersDeath` particles) [src:survev/client/src/objects/player.ts:3011-3041] [src:fandom/Perky_Shoot] [H]
- Death animations were introduced with Survivr Pass 4 (Sept 2020) (post-0.8.82) [src:fandom/Death_Animation] [M]

## Passes

- `pass_survivr1` (Survivr Pass 1, v0.8.6, Oct 18 2019): rewards at levels 2 PARMA Jumpsuit, 3 Healing Hearts, 4 Bandaged Face, 5 Arctic Avenger, 6 Starboost, 7 Ok, 8 Target Practice, 9 Blood Moon, 10 Poo Face, 11 Knuckles Rusted, 12 Naturalize, 13 Ghost, 14 The Professional, 15 Tomoe, 16 Picasso Face, 17 Carbon Fiber, 18 Shuriken, 19 Rainbow, 20 The Core Jumpsuit, 21 Knuckles Heroic, 30 Fowl Facade, 50 Bayonet Rugged, 99 Bayonet Woodland [src:derived/survev@9f64948d:src/defs/passDefs.js:1-76] [src:survev/shared/defs/gameObjects/passDefs.ts:10-111] [src:changelog/0.8.6] [src:fandom/Survivr_Pass_1] [H]
- Pass 1 XP per level (original client): 50 × 8, 75 × 6, 100 × 3, 125, 125, 150, then 75 (23 entries; later levels reuse the last value); survev extended the table to 50 entries and changed the last to 50 (commit 1356d208) (fork) [src:derived/survev@9f64948d:src/defs/passDefs.js:4] [src:survev/shared/defs/gameObjects/passDefs.ts:13-17] [src:derived/survev-git-1356d208] [src:fandom/Survivr_Pass_1] [H]
- Fandom: Pass 1 had 23 unlockable items; levels past 21 without a reward still need 75 XP; no level-up after 99 [src:fandom/Survivr_Pass_1] [M]
- `pass_survivr2` "Survevr Pass 2" is fork-only (commit 18d34661, 2026-08-28): Rainy Day, Crazy Diamond, Timeout, Club Cola, Cowz Cloak, Saluting Face, The Chameleon, Bruh, Ankh Charm, Winged Grace, Flattered Face, Pastel Sky, Phantom Blood, Screaming Face, Chrysanthemum Garb, Surged, Traumatized Face, Gearshift, Huntsman Rugged (20), Fahrenheit 5182 (25), Huntsman Burnished (30), Potatoskin (40), Karambit Rugged (50), Karambit Borealis (75), Auroric Ascension (99) (fork) [src:survev/shared/defs/gameObjects/passDefs.ts:114-292] [src:derived/survev-git-18d34661] [src:wikigg/Survevr_Passes] [H]
- The original Survivr Pass 2 (v0.9.2, March 2020) is post-0.8.82 and unrelated to survev's pass 2 (post-0.8.82) [src:fandom/Survivr_Pass_1] [src:fandom/Survivr_Pass_2] [M]

## Quests

- v0.8.82 quests (24, client `questDefs.js`; `category`, target, XP): `quest_top_solo` top 2/30, `quest_top_squad` top 2/30, `quest_kills` pvp 5/30, `quest_kills_hard` 10/40, `quest_damage` 750/30, `quest_damage_hard` 1500/40, `quest_survived` 900 s/30 (timed), `quest_damage_9mm` / `_762mm` / `_556mm` / `_12gauge` damage 250/30, `quest_damage_grenade` 100/40, `quest_damage_melee` 150/40, `quest_heal` item 10/30, `quest_boost` 10/30, `quest_airdrop` 1/30, `quest_crates` destruction 25/30, `quest_toilets` 5/30, `quest_furniture` 10/30, `quest_barrels` 10/30, `quest_lockers` 10/30, `quest_pots` 8/30, `quest_vending` 1/40, `quest_club_kills` location 2/40 [src:derived/survev@9f64948d:src/defs/questDefs.js:1-151] [H]
- `quest_top_duo` "Top 8 in Duos" is missing from the client file but existed in the target era (removed in a March 2020 update per fandom); survev re-added it in commit 2b6d1265 [src:survev/shared/defs/gameObjects/questDefs.ts:139] [src:derived/survev-git-2b6d1265] [src:derived/fork-vs-original-json] [L]
- Quest rules (fandom): two quests per day, worth 30 (normal) or 40 (hard) XP; one free re-roll per cycle (500 Golden Potatoes for more, post-0.8.82); guests can complete quests but lose progress [src:fandom/Quests] [src:fandom/XP] [M]
- Fork quest changes: survev's quest system rewrite (commit 0c58cdba, 2026-08-21) added 45 quests and raised the ammo-damage targets 250 → 350, grenade 100 → 200, melee 150 → 250 (fork) [src:survev/shared/defs/gameObjects/questDefs.ts:254] [src:survev/shared/defs/gameObjects/questDefs.ts:496] [src:survev/shared/defs/gameObjects/questDefs.ts:537] [src:derived/survev-git-0c58cdba] [H]
- Fork quests (45): `quest_win_any`, `quest_kills_harder`, `quest_damage_harder`, `quest_damage_9mm_ltm`, `quest_damage_762mm_ltm`, `quest_damage_556mm_ltm`, `quest_damage_12gauge_ltm`, `quest_damage_45acp`, `quest_damage_potato_ammo`, `quest_damage_rare_ammo`, `quest_damage_rare_ammo_ltm`, `quest_damage_woods_king`, `quest_damage_grenade_ltm`, `quest_damage_melee_ltm`, `quest_airdrop_ltm`, `quest_airdrop_ltm_hard`, `quest_airdrop_rare`, `quest_hardstone`, `quest_soviet_crate`, `quest_initiative_crate`, `quest_pvt_swappers`, `quest_potatoes`, `quest_docks_kills`, `quest_river_town_kills`, `quest_desert_town_kills`, `quest_reserve_kills`, `quest_logging_complex_kills`, `quest_be_mvp`, `quest_promote_hunted`, `quest_factions_damage`, `quest_last_man_damage_hard`, `quest_factions_kills`, `quest_healer_kills`, `quest_tank_kills`, `quest_sniper_kills`, `quest_scout_kills`, `quest_demo_kills`, `quest_assault_kills`, `quest_healer_damage`, `quest_tank_damage`, `quest_sniper_damage`, `quest_scout_damage`, `quest_demo_damage`, `quest_assault_damage`, `quest_classless_damage` (fork) [src:survev/shared/defs/gameObjects/questDefs.ts:1-1375] [src:derived/fork-vs-original-json] [H]

## Unlocks

- `unlock_default` "standard-issue": in v0.8.82 it unlocked `outfitBase`, `fists`, `heal_basic`, `boost_basic`, 15 crosshairs and 134 emotes for every player [src:derived/survev@9f64948d:src/defs/unlockDefs.js:1-13] [H]
- survev's `unlock_default` unlocks all 30 crosshairs and 152 emotes (adds the fork emotes, drops `emote_flagisrael`) (fork) [src:survev/shared/defs/gameObjects/unlockDefs.ts:10-201] [src:derived/survev-git-90c96422] [H]
- `unlock_new_account` "new-account" (`free`): `outfitDarkShirt` The Semi-Pro [src:survev/shared/defs/gameObjects/unlockDefs.ts:202-207] [src:derived/survev@9f64948d:src/defs/unlockDefs.js:7-12] [H]

## XP artifacts

| id | name | XP | base / emitter | sources |
|---|---|---|---|---|
| `xp_10` | XP | 8 | `xp_common` | [src:survev/shared/defs/gameObjects/xpDefs.ts:19-35] [H] |
| `xp_25` | XP | 24 | `xp_rare` | [src:survev/shared/defs/gameObjects/xpDefs.ts:36-52] [H] |
| `xp_100` | XP | 96 | `xp_mythic` | [src:survev/shared/defs/gameObjects/xpDefs.ts:53-69] [H] |
| `xp_book_tallow` | Tallow's Journal | 8 | xp_10 | [src:survev/shared/defs/gameObjects/xpDefs.ts:70-143] [H] |
| `xp_book_greene` | Greene's Infinite Wisdom | 8 | xp_10 | [src:survev/shared/defs/gameObjects/xpDefs.ts:70-143] [H] |
| `xp_book_parma` | The PARMA Papers | 8 | xp_10 | [src:survev/shared/defs/gameObjects/xpDefs.ts:70-143] [H] |
| `xp_book_nevelskoy` | The Nevelskoy Report | 8 | xp_10 | [src:survev/shared/defs/gameObjects/xpDefs.ts:70-143] [H] |
| `xp_book_rinzo` | Rinzō's Log | 8 | xp_10 | [src:survev/shared/defs/gameObjects/xpDefs.ts:70-143] [H] |
| `xp_book_kuga` | Memoirs of Kuga Kairyū | 8 | xp_10 | [src:survev/shared/defs/gameObjects/xpDefs.ts:70-143] [H] |
| `xp_glasses` | Lenz's Spectacles | 24 | xp_25 | [src:survev/shared/defs/gameObjects/xpDefs.ts:70-143] [H] |
| `xp_compass` | Amélie's True Compass | 24 | xp_25 | [src:survev/shared/defs/gameObjects/xpDefs.ts:70-143] [H] |
| `xp_stump` | Ravenstone's Bloody Stump | 24 | xp_25 | [src:survev/shared/defs/gameObjects/xpDefs.ts:70-143] [H] |
| `xp_bone` | Bone of Gordon | 24 | xp_25 | [src:survev/shared/defs/gameObjects/xpDefs.ts:70-143] [src:changelog/0.8.73] [H] |
| `xp_donut` | Cake Donut | 96 | xp_100 | [src:survev/shared/defs/gameObjects/xpDefs.ts:70-143] [H] |

- XP artifacts are loot (sounds `xp_drop_01` / `xp_pickup_01`, border `loot-circle-outer-05.img`) that add Survivr Pass progress; added in v0.8.7 on the Halloween map, removed with it on Nov 1 2019 and re-added in v0.8.73 [src:survev/shared/defs/gameObjects/xpDefs.ts:19-35] [src:changelog/0.8.7] [src:fandom/XP] [H]
- survev's XP tables (`tier_xp_uncommon` 6 books, `tier_xp_rare` 4 relics at 0.1, `tier_xp_mythic` donut 0.01) are guesses and their drops are commented out "until we have a pass" [src:survev/shared/defs/maps/baseDefs.ts:693-724] [L]
- Fandom: following surviv on Facebook, Twitter, Instagram and YouTube gave 15 XP each per season [src:fandom/XP] [M]

## Conflicts

- CONFLICT cosmetic-flag-israel: `emote_flagisrael` is an original emote in the default unlock list [src:derived/survev@9f64948d:src/defs/unlockDefs.js:5] [src:kong/relaunch-client-defs] vs survev having removed it [src:derived/survev-git-663bdd6e]; proposed: keep it for the v0.8.82 target [H]
- CONFLICT cosmetic-outfit-tree-id: original id `outfitTree` [src:derived/survev@9f64948d:src/defs/outfitDefs.js:914] vs survev `outfitHalloweenTree` with the same def [src:survev/shared/defs/gameObjects/outfitDefs.ts:1357]; proposed: use `outfitTree` [H]
- CONFLICT cosmetic-faction-outfit-teamid: original outfits have no faction restriction [src:derived/survev@9f64948d:src/defs/outfitDefs.js:1-1060] vs fork `teamId` pickup restriction [src:derived/survev-git-4648cc17]; proposed: no restriction [H]
- CONFLICT cosmetic-default-unlocks: 15 default crosshairs and 134 emotes [src:derived/survev@9f64948d:src/defs/unlockDefs.js:5] vs survev 30 and 152 [src:survev/shared/defs/gameObjects/unlockDefs.ts:10-201]; proposed: original list (accounts are out of scope anyway) [M]
- CONFLICT cosmetic-quest-targets: original ammo-damage 250, grenade 100, melee 150 [src:derived/survev@9f64948d:src/defs/questDefs.js:1-151] vs fork 350 / 200 / 250 [src:survev/shared/defs/gameObjects/questDefs.ts:254-550]; proposed: original values [H]
- CONFLICT cosmetic-pass1-quest-count: fandom says Pass 1 had 26 quests [src:fandom/Survivr_Pass_1] vs 24 in the client defs (25 with Top 8 in Duos) [src:derived/survev@9f64948d:src/defs/questDefs.js:1-151] [src:fandom/Quests]; proposed: 25 [L]

## Open questions

- Original outfit, emote and XP loot tables per map (which skins dropped where and how often) are server-side; survev's tables are estimates [src:survev/shared/defs/maps/baseDefs.ts:394-402] [src:survev/shared/defs/maps/halloweenDefs.ts:179-199] [L]
- Account-side rules (quest rotation timing, re-roll limits, pass XP after level 99) are only known from fandom [src:fandom/Quests] [src:fandom/Survivr_Pass_1] [L]
