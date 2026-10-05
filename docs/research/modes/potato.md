# Potato mode

> The Potato map (survev `potato`, mapId 4) and its spring reskin (`potato_spring`, same mapId). Potato vs Tomato, the fork's 50v50 hybrid, is in `modes/faction.md`.
> Stats of the potato weapons and throwables are in `items/guns.md` and `items/throwables.md`; the Rare Potato perk and K-pot-ato helmet in `items/perks.md` / `items/gear.md`.
> "pre-fork" means survev's reconstruction before the fork's own balance passes (potato loot tables as of commit `70a5d40f`, 2025-03-20), cited `derived/survev-git-<hash>`.

## Identity

| field | value | sources |
|---|---|---|
| survev ids | `potato` (MapId.Potato = 4) and `potato_spring` (same mapId, merges `potato`) | [src:survev/shared/defs/mapDefs.ts:42-61] [src:survev/shared/defs/maps/potatoDefs.ts:7-14] [src:survev/shared/defs/maps/potatoSpringDefs.ts:109] [H] |
| UI | name "Potato", icon `img/loot/loot-throwable-potato.svg`, CSS `btn-mode-potato` | [src:survev/shared/defs/maps/potatoDefs.ts:10-14] [src:kong/relaunch-client-defs] [H] |
| game mode | 80 players, `potatoMode: true`, kill leader enabled | [src:survev/shared/defs/maps/potatoDefs.ts:48] [src:kong/relaunch-client-defs] [H] |
| news name | "Rotato potato" (first run); namu calls the event "Rotato Potatos" (감자 이벤트) | [src:changelog/0.7.4] [src:fandom/Changelog] [src:namu/Surviv.io/이벤트] [H] |
| Korean item names | potato 감자, Potato Cannon 포테이토 캐논, Spud Gun 감자총, K-pot-ato K-포-테토, Rare Potato 희귀한 감자 | [src:l10n/ko:game-potato] [src:l10n/ko:game-potato_cannon] [src:l10n/ko:game-potato_smg] [src:l10n/ko:game-helmet03_potato] [src:l10n/ko:game-rare_potato] [H] |
| lore | PARMA's food science (FSTMS) division and "super" potatoes; potato cannon = "PPP-7 (Probably Propelled Potato)", spud gun = "SMG-8 (Spud Missile Generator)" | [src:fandom/Changelog] [src:wikigg/Potato_mode] [H] |

## History (original surviv.io)

| version / date | change | sources |
|---|---|---|
| 0.7.4 "Rotato potato", Apr 1, 2019 | April Fools: potato obstacle and potato throwable (potato map only); dual flare guns | [src:changelog/0.7.4] [src:fandom/Changelog] [H] |
| 0.7.41 "Later tater", Apr 2, 2019 | potatoes removed ("wipe out the entire crop") | [src:changelog/0.7.41] [src:fandom/Changelog] [H] |
| 0.7.52 "Potatoheaded", Apr 29, 2019 | Rare Potato perk; K-pot-ato helmet; a main-map version of the Potato map added, the first one renamed `potato_spring` | [src:changelog/0.7.52] [src:fandom/Changelog] [H] |
| 0.7.8 "Your tuber is here", Jun 7, 2019 | Potato Cannon (potato map only); Jun 11: cannon throwable damage 100 → 95, obstacle multiplier 1.2 → 1.3 | [src:changelog/0.7.8] [src:fandom/Changelog] [H] |
| 0.7.9 secret, Jun 25, 2019 | "Potato Spring" map renamed to "Potato Map" | [src:fandom/Changelog] [M] |
| 0.8.2 "Small potatoes", Aug 28, 2019 | 3 Savannah Patches, a Scout Hut and the potato Marksman Helmet added to the map (patches removed again Sep 12, 2019) | [src:fandom/Changelog] [src:wikigg/Potato_mode] [H] |
| "Perky potatoes", Sep 23, 2019 | potatoes drop one item from Tier Potato Perks | [src:fandom/Changelog] [src:fandom/Potato_Map] [M] |
| 0.8.82 "Free Fryer", Dec 30, 2019 | Spud Gun and the silo shack (potato map only); M9 Cursed no longer comes from potatoes | [src:changelog/0.8.82] [src:fandom/Changelog] [H] |

| run | dates | notes | sources |
|---|---|---|---|
| Rotato potato | Apr 1 – Apr 2, 2019 | spring map, all queues | [src:changelog/0.7.4] [src:changelog/0.7.41] [src:fandom/Changelog] [H] |
| Potatoheaded | Apr 29 – May 1, 2019 | solo and squad | [src:changelog/0.7.52] [src:fandom/Potato_Map] [H] |
| Your tuber is here | Jun 7 – Jun 11, 2019 | potato cannon | [src:changelog/0.7.8] [src:fandom/Changelog] [H] |
| Potato, potahto, rotato, rotahto | Jul 29 – end of Jul, 2019 | "until the end of the month" | [src:fandom/Changelog] [src:namu/Surviv.io/이벤트] [H] |
| Small potatoes | Aug 28 – Aug 31, 2019 | Small Arms perk in grass areas | [src:changelog/0.8.2] [src:fandom/Changelog] [H] |
| Perky potatoes | Sep 23 – Oct 1, 2019 | lootable perks | [src:fandom/Changelog] [src:namu/Surviv.io/이벤트] [H] |
| Two years and counting | Oct 29 – Nov 1, 2019 | 2nd anniversary; "our most popular mode and the one most frequently requested" | [src:fandom/Changelog] [M] |
| Quickswitch | Nov 18 – Nov 25, 2019 | – | [src:fandom/Changelog] [M] |
| Free Fryer | Dec 30, 2019 – Jan 5, 2020 (solo); squad resumed Jan 6 for two weeks in total | Spud Gun; solo was planned for one week, squad for two | [src:changelog/0.8.82] [src:fandom/Changelog] [M] |

- namu lists the potato event appearances as Apr 1, Apr 29, Jul 29, Aug 28, Sep 23 and Dec 30, 2019 [src:namu/Surviv.io/이벤트] [M]
- Post-0.8.82 the mode was in the daily Event Rotation (Tuesday in 0.9.2); the Water Gun was removed from potato mode on Jul 6, 2020 (post-0.8.82) [src:fandom/Event_Rotation] [src:fandom/Potato_Map] [src:fandom/Changelog] [M]

## Core rule: weapon rotation

- Killing a player with a weapon rotates that weapon: when a player dies from player damage (not bleeding or self-damage), the last player who damaged them gets `randomWeaponSwap` for the weapon that dealt the blow [src:survev/server/src/game/objects/player.ts:2836-2845] [src:fandom/Potato_Map] [src:namu/Surviv.io/이벤트] [H]
- Destroying a potato obstacle rotates the weapon used to break it (melee breaks rotate the melee, guns the gun, throwables the throwable) [src:survev/server/src/game/objects/obstacle.ts:553-556] [src:namu/Surviv.io/이벤트] [src:wikigg/Potato_mode] [H]
- The new weapon is a uniformly random weapon of the same type (gun, melee or throwable) from every def without `noPotatoSwap` [src:survev/server/src/game/objects/player.ts:4046-4069] [src:fandom/Potato_Map] [H]
- With the Rare Potato perk only quality-1 weapons are eligible (`rare_potato.quality` = 1) — "(almost) always" a high-quality weapon, the single M9 being quality 1 [src:survev/server/src/game/objects/player.ts:4062-4067] [src:survev/shared/defs/gameObjects/perkDefs.ts:138-140] [src:changelog/0.7.52] [src:fandom/Potato_Map] [H]
- The swapped slot is the current slot if the weapon in hand caused it, else the slot holding that weapon, else primary / melee / throwable by type; nothing happens if that slot holds a `noPotatoSwap` item [src:survev/server/src/game/objects/player.ts:4071-4098] [H]
- A rotated gun arrives with a full magazine plus max(ammoSpawnCount − maxClip, 0) rounds of its ammo, and the slot's switch cooldown is set to the gun's `switchDelay`; a reload in progress on that slot is cancelled [src:survev/server/src/game/objects/player.ts:4100-4135] [H]
- A rotated throwable also grants ⌊bag capacity / 3⌋ (minimum 1) of the new throwable; fandom: "if it was a throwable, you just get some throwables" [src:survev/server/src/game/objects/player.ts:4136-4145] [src:fandom/Potato_Map] [H]
- The new weapon shows above the player as a loot emote (`emote_loot`), with the weapon's switch sound [src:survev/server/src/game/objects/player.ts:4149] [src:fandom/Potato_Map] [H]
- All emotes are replaced by the potato emote (`emote_potato`); map pings and ammo/heal requests still work (requests show as potatoes) [src:survev/server/src/game/objects/player.ts:4625-4627] [src:fandom/Potato_Map] [H]
- Never rotated to or from (`noPotatoSwap`): guns `m9_cursed`, `potato_cannon`, `potato_smg`, `potato_lmg`, `bugle`; melee `knuckles`, `karambit`, `bayonet`, `huntsman`, `bowie`, `machete`, `saw`, `spade`, `cutlass_gold`; throwables `mirv_mini`, `martyr_nade`, `snowball`, `snowball_heavy`, `potato_heavy`, `potato_cannonball`, `potato_smgshot`, `potato_lmgshot`, `bomb_iron`, `coconut` [src:survev/shared/defs/gameObjects/gunDefs.ts:3406-3580] [src:derived/survev-nopotatoswap-scan] [H]
- survev's rotation pool therefore has 66 guns, 38 melee and 6 throwables (frag, mirv, smoke, strobe, potato, tomato) and includes fork-only guns (imbel, barrett, sw500, ash12) [src:derived/survev-nopotatoswap-scan] [src:survev/shared/defs/gameObjects/gunDefs.ts:3406] [M]
- Fandom (post-0.8.82 list): every weapon can be rolled except Snowball, M9 Cursed, Bugle, Ice Pick, Lasr Gun, Lasr Swrd, Water Gun, Rainbow Blaster, Potato Cannon and Spud Gun [src:fandom/Potato_Map] [M]
- Only on this map can a single OTs-38 spawn, and a player can hold two identical non-dual pistols after a rotation [src:fandom/Potato_Map] [M]
- Fork 0.2.31: a throwable being cooked is not swapped; fork 0.4.2 fixed Karambit Borealis not swapping (fork) [src:survev/server/src/game/objects/player.ts:4115-4118] [src:survev/client/public/changelogRec.html:241] [src:survev/client/public/changelogRec.html:62] [H]
- The Lone Survivr never rotates (fork, faction maps only) [src:survev/server/src/game/objects/player.ts:4048] [src:survev/client/public/changelogRec.html:248] [H]

## Potato obstacles

| id | HP | collision | other | spawn | sources |
|---|---|---|---|---|---|
| `potato_01`, `potato_02`, `potato_03` (three sprites) | 100 | circle r 1.1, height 0.5 | `swapWeaponOnDestroy`, regrows after 60 s, hidden on minimap, loot 1 × tier_potato_perks, hit sound `organic_hit`, break `pumpkin_break_01` | grass, beach, river shore; 50 each on `potato` and `potato_spring` | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:109-143] [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:688-704] [src:survev/shared/defs/maps/potatoDefs.ts:186-188] [src:kong/relaunch-client-defs] [H] |
| `potato_01f`–`03f`, `tomato_01`–`03` (fork) | 100 | same | team-coloured versions for Potato vs Tomato, no river shore | faction_potato only | [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:689-724] [H] |

- namu: potatoes are placed around the map and come back every 60 seconds [src:namu/Surviv.io/이벤트] [M]
- tier_potato_perks: nothing 25 : tier_perks 1, i.e. a 1/26 ≈ 3.8 % chance of one perk per potato [src:survev/shared/defs/maps/baseDefs.ts:772-775] [src:fandom/Loot_tables] [H]
- Perks from potatoes (fandom list): Windwalk, Endless Ammo, Cast Ironskin, Splinter Rounds, Small Arms, Takedown, Combat Medic, One With Nature, Scavenger, One In The Chamber, Martyrdom, Revivify; Rare Potato only from the K-pot-ato [src:fandom/Potato_Map] [M]
- survev's shared tier_perks (pre-fork 14 perks at weight 1: firepower, windwalk, endless_ammo, steelskin, splinter, small_arms, takedown, field_medic, tree_climbing, scavenger, chambered, martyrdom, self_revive, bonus_9mm) gained `high_velocity` (fork 0.2.1) and `bonus_45` (fork 0.2.11) [src:survev/shared/defs/maps/baseDefs.ts:746-763] [src:derived/survev-git-8491a169] [src:derived/survev-git-e6439aa4] [src:survev/client/public/changelogRec.html:322] [H]
- Fandom's Tier Perks weights: Firepower 1, Windwalk 0.25, Endless Ammo 1, Cast Ironskin 0.5, Splinter 0.25, Small Arms 0.25, Takedown 1, Combat Medic 0.5, One With Nature 1, Scavenger 1, One In The Chamber 0.5, Martyrdom 0.1, Revivify 0.5, 9mm Overpressure 0.5, Explosive Rounds 0.25 [src:fandom/Loot_tables] [M]
- Potato cannon and spud gun cannot be rotated, so they can farm potato perks safely [src:fandom/Potato_Map] [src:wikigg/Potato_mode] [M]
- Potatoes do not count for the "Destroy Pots" quest (fork 0.3.03 fix) (fork) [src:survev/client/public/changelogRec.html:183] [H]

## Silo shack and potato weapons

- Silo shack `shilo_01` (0.8.82): a building with reflective walls, one window and one door around a brown silo `silo_01po` (2500 HP, reflects bullets, drops one Spud Gun `potato_smg`, smoke residue, tint 0xff944d) [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:801-810] [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:7776] [src:fandom/Silo_Shack] [src:kong/relaunch-client-defs] [H]
- survev places it as a location spawn at the map centre (radius 50, retried on failure); fandom: "normally spawns near the center", rarely near the edge; namu: a green-roofed house in the centre whose silo takes 97 fist hits [src:survev/shared/defs/maps/potatoDefs.ts:164-173] [src:fandom/Silo_Shack] [src:namu/Surviv.io/이벤트] [H]
- The silo shack was a 2019 building-contest entry by "No#0396" [src:fandom/Silo_Shack] [M]
- Potato weapons (all `noPotatoSwap`, infinite potato ammo): Potato Cannon `potato_cannon` (0.7.8), Spud Gun `potato_smg` (0.8.82), PMG-134 `potato_lmg` (fork 0.2.3; in potato mode since fork 0.3.02) [src:survev/shared/defs/gameObjects/gunDefs.ts:3406] [src:survev/shared/defs/gameObjects/gunDefs.ts:3465-3488] [src:survev/shared/defs/gameObjects/gunDefs.ts:3525] [src:changelog/0.7.8] [src:changelog/0.8.82] [src:survev/client/public/changelogRec.html:193] [H]
- Where they come from in survev `potato`: tier_ring_case (Red Emblem Case in the Crimson Ring Club) potato_cannon 1, potato_smg 0.1, potato_lmg 0.2 (fork); tier_airdrop_rare potato_cannon / potato_smg / potato_lmg 1 each (fork); tier_hatchet (Hydra Bunker hatchet case) 0.1 each (fork) [src:survev/shared/defs/maps/potatoDefs.ts:147-161] [src:derived/survev-git-c3ab6232] [H]
- Pre-fork survev: tier_ring_case and tier_airdrop_rare were potato_cannon 1 + potato_smg 0.1, the cannon-only tables being the original data [src:derived/survev-git-70a5d40f] [src:derived/survev-git-c5cdb375] [M]
- Fandom: Red Emblem Case on potato = Potato Cannon (common), Spud Gun (uncommon); airdrop rare = Potato Cannon (+ Spud Gun at unknown weight) [src:fandom/Loot_tables] [src:fandom/Potato_Map] [M]
- Gold air drops are much more common and almost always hold the Potato Cannon: survev crates `airdrop_crate_01` 1 : `airdrop_crate_02` 1 (Main 10 : 1) [src:survev/shared/defs/maps/potatoDefs.ts:64-67] [src:survev/shared/defs/maps/baseDefs.ts:81-84] [src:fandom/Potato_Map] [H]
- Plane timings are Main's: one drop 10 s into circle 1, one 2 s into circle 3 [src:survev/shared/defs/maps/potatoDefs.ts:51-63] [H]

## Map (survev `potato`)

- Same size and biome as the Normal map (720 solo/duo, 768 squad); colours background 0x20536e, water 0x3282ab, beach 0xcdb35b, riverbank 0x905e24, grass 0x80af49 [src:survev/shared/defs/maps/potatoDefs.ts:35-45] [src:survev/shared/defs/maps/baseDefs.ts:815-818] [src:kong/relaunch-client-defs] [H]
- Camera particle `falling_potato` (small potatoes falling instead of blossoms); the relaunch def lists frozen sprites `player-mash-01`–`03` for this map [src:survev/shared/defs/maps/potatoDefs.ts:46] [src:kong/relaunch-client-defs] [src:fandom/Potato_Map] [H]
- Rivers, places (The Killpit, Sweatbath, Tarkhany, Ytyk-Kyuyol, Todesfelde, Pineapple, Fowl Forest, Ranchito Pollo) and place-anchored houses/barns come from Main [src:survev/shared/defs/maps/baseDefs.ts:820-890] [src:wikigg/Potato_mode] [H]
- density: stone_01 350, barrel_01 76, silo_01 8, crate_01 50, crate_02 4, crate_03 8, bush_01 78, cache_06 12, tree_01 320, hedgehog_01 24, potato_01/02/03 50 each, container_01–04 5 each, shack_01 7, outhouse_01 5, loot_tier_1 24, loot_tier_beach 4 [src:survev/shared/defs/maps/potatoDefs.ts:174-198] [H]
- fixed: warehouse_01 2, house_red_01 3/4, house_red_02 3/4, barn_01 1/3, barn_02 1, hut_01 3, hut_02 1, hut_03 1 (Scout Hut), shack_03a 2, shack_03b 2/3, greenhouse_01 1, cache_01/02/07 1, bunker_structure_01 (odds 0.05), bunker_structure_02–05 1 each, warehouse_complex_01 1, chest_01 1, chest_03 (odds 0.2), mil_crate_02 (odds 0.25), tree_02 3, teahouse_complex_01s 1/2, stone_04 1, club_complex_01 1 [src:survev/shared/defs/maps/potatoDefs.ts:199-229] [H]
- Random building rotation as on Normal: 2 of mansion, police station, bank [src:survev/shared/defs/maps/potatoDefs.ts:230-235] [src:changelog/0.7.7] [H]
- Fandom specials: Bank, Police Station, Mansion, Hydra Bunker, Docks, Greenhouse, Silo Shack, Teahouse Complex [src:fandom/Potato_Map] [M]
- survev's Scout Hut on potato was added by a 2025 fix (`hut_01` 4 → 3 + `hut_03`); the original map got its Scout Hut in 0.8.2 [src:derived/survev-git-563be159] [src:fandom/Changelog] [H]

## Loot overrides (survev `potato`)

| table | entries | sources |
|---|---|---|
| tier_guns | mp5 10, mac10 6, m870 9, m1100 6, ot38 8, m9 19, m93r 5, glock 7 (only common guns; good ones come from rotation) | [src:survev/shared/defs/maps/potatoDefs.ts:71-80] [src:fandom/Potato_Map] [H] |
| tier_throwables | frag ×2 1, smoke 1, MIRV ×2 0.05, potato ×5 2 | [src:survev/shared/defs/maps/potatoDefs.ts:81-86] [src:fandom/Potato_Map] [H] |
| tier_airdrop_throwables | frag ×2 1, MIRV ×2 0.5, potato ×10 2 | [src:survev/shared/defs/maps/potatoDefs.ts:87-91] [src:fandom/Potato_Map] [H] |
| tier_ammo, tier_ammo_crate, tier_airdrop_ammo | 9mm 60 (1), 7.62 60 (3), 5.56 60 (3), 12 gauge 10 (3), .45 ACP 60 (3) | [src:survev/shared/defs/maps/potatoDefs.ts:92-112] [src:fandom/Potato_Map] [H] |
| tier_armor | helmet01 9, helmet02 6, helmet03 0.2, K-pot-ato 0.1, chest01 15, chest02 6, chest03 0.2 | [src:survev/shared/defs/maps/potatoDefs.ts:113-125] [src:fandom/Potato_Map] [H] |
| tier_police | scar 0.5, helmet03 0.15, K-pot-ato 0.1, chest03 0.1, backpack03 0.25 | [src:survev/shared/defs/maps/potatoDefs.ts:126-136] [src:fandom/Potato_Map] [H] |
| tier_airdrop_armor | helmet03 1, K-pot-ato 0.1, chest03 1, backpack03 1 | [src:survev/shared/defs/maps/potatoDefs.ts:137-146] [src:fandom/Potato_Map] [H] |

- Fandom: these tables were confirmed in v0.7.9 and later guns have approximate values only [src:fandom/Potato_Map] [M]
- Potato throwables and .45 ACP ammo spawn from normal sources on this map [src:fandom/Potato_Map] [M]
- Fork balance: potato throwable damage 2 → 8 and heavy potato 5 → 15 with 2 random items (fork 0.2.1) [src:balance/128-133] [src:survev/client/public/changelogRec.html:329] [H]

## Potato Spring (`potato_spring`)

- The April 1, 2019 map was the spring-themed one (cherry trees, some falling blossoms replaced by small potatoes); its internal id became `potato_spring` in 0.7.52 when the main-map version was added [src:fandom/Potato_Map] [src:fandom/Changelog] [M]
- survev `potato_spring`: splash `img/splashes/potato_spring.webp`, beach 0xf4ae48, riverbank 0x8a8a8a, grass 0x5c910a, ghillie 0x5b8e0a, camera particle `falling_leaf_potato` [src:survev/shared/defs/maps/potatoSpringDefs.ts:6-44] [H]
- Fandom's spring biome tints match: beach 16035400 (0xf4ae48), riverbank 9079434 (0x8a8a8a), grass 6066442 (0x5c910a), water 3310251 (0x3282ab) [src:fandom/Potato_Map] [src:survev/shared/defs/maps/potatoSpringDefs.ts:29-40] [H]
- Trees: `tree_07sp` 300, `tree_08sp` 30, `tree_08spb` 30, `tree_07spr` 160, `tree_08spr` 80 instead of `tree_01`; `tree_01` replaced by `tree_07sp`; spring cache `cache_02sp` instead of `cache_02` [src:survev/shared/defs/maps/potatoSpringDefs.ts:59-105] [H]
- Fixed spawns otherwise copy `potato` [src:survev/shared/defs/maps/potatoSpringDefs.ts:93-99] [H]
- tier_chrys_case: nothing 2 (?), Tsukuyomi no Kabuto `helmet03_moon` 3, tier_katanas 3 (?), naginata 1 (?) — "?" marks survev estimates [src:survev/shared/defs/maps/potatoSpringDefs.ts:46-52] [M]
- tier_airdrop_outfits: nothing 4, Hot Drop (`outfitAirdrop`, 핫 드롭) 1 [src:survev/shared/defs/maps/potatoSpringDefs.ts:53-56] [src:l10n/ko:game-outfitAirdrop] [H]
- Eggs `egg_01`–`egg_04` (15 each, dropping disguise outfits) are a fork addition of 2025-04-01 (fork) [src:survev/shared/defs/maps/potatoSpringDefs.ts:79-82] [src:derived/survev-git-929cee54] [src:wikigg/Potato_mode] [H]
- Tsukuyomi no Kabuto was added to spring modes by the fork's 2025-03-14 commit (survev reconstruction) [src:derived/survev-git-c7124061] [M]

## Conflicts

- CONFLICT potato-airdrop-rare: original airdrop rare = Potato Cannon (Spud Gun weight unknown) [src:fandom/Potato_Map] [src:derived/survev-git-70a5d40f] vs fork Potato Cannon / Spud Gun / PMG-134 at 1 each [src:survev/shared/defs/maps/potatoDefs.ts:157-161]; proposed: cannon 1 + spud gun 0.1 (pre-fork), PMG-134 off [M]
- CONFLICT potato-ring-case: Potato Cannon common, Spud Gun uncommon [src:fandom/Loot_tables] vs fork adding PMG-134 0.2 [src:survev/shared/defs/maps/potatoDefs.ts:152-156]; proposed: cannon 1, spud gun 0.1, no PMG-134 [M]
- CONFLICT potato-hatchet: no potato guns in the Hydra Bunker hatchet case in v0.8.82 sources [src:wikigg/Potato_mode] vs fork tier_hatchet with all three potato guns at 0.1 [src:survev/shared/defs/maps/potatoDefs.ts:147-151] [src:derived/survev-git-c3ab6232]; proposed: Main's tier_hatchet [M]
- CONFLICT potato-swap-pool: v0.8.82 pool has no fork guns [src:changelog/0.8.82] vs survev pool containing imbel, barrett, sw500, ash12 [src:derived/survev-nopotatoswap-scan]; proposed: build the pool from v0.8.82 item ids only [H]
- CONFLICT potato-tier-perks: weighted list (Windwalk 0.25 … Martyrdom 0.1) [src:fandom/Loot_tables] vs survev flat weights 1 plus fork perks [src:survev/shared/defs/maps/baseDefs.ts:746-763]; proposed: fandom weights without Explosive Rounds (added later), as a config table [L]
- CONFLICT potato-throwable-damage: potato 2 / heavy 5 damage [src:balance/128-133] vs fork 8 / 15 [src:survev/client/public/changelogRec.html:329]; proposed: 2 / 5 [H]

## Open questions

- The Spud Gun's original weight in the Red Emblem Case and airdrops ("???" on fandom) [src:fandom/Potato_Map] [L]
- Whether the v0.8.82 silo shack was a fixed centre spawn (survev, namu) or merely "normally near the center" with edge spawns possible [src:survev/shared/defs/maps/potatoDefs.ts:164-173] [src:fandom/Silo_Shack] [L]
- Whether original kill rotation also triggered for kills by explosives or only for the weapon slot used; survev uses the damage's `weaponSourceType`/`gameSourceType` [src:survev/server/src/game/objects/player.ts:4049-4050] [L]
