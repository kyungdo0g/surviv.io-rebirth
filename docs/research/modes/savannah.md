# Savannah mode

> The Savannah map (survev `savannah`, mapId 5): a sniper/DMR map with lootable perks and The Hunted.
> survev had no Savannah map generation until the fork added it in 2025-08 (commits `bbe1a377`, `367a7b3d`); its spawn counts and loot weights are reconstructions, many marked "?" (guess) or "!" (uncertain) in the source. The client-side parts (colours, gameMode flags, obstacle defs) are original and checked against the relaunch client.
> Perk effects are in `items/perks.md`, gun stats in `items/guns.md`, Savannah structures (grassy covers, brush clumps, kopje patch, hunting perch, savannah patch) in `maps/buildings.md`.

## Identity

| field | value | sources |
|---|---|---|
| survev id / mapId | `savannah`, MapId.Savannah = 5 | [src:survev/shared/defs/maps/savannahDefs.ts:6-7] [src:survev/shared/gameConfig.ts:97-109] [H] |
| UI | name "Savannah", icon `img/gui/player-the-hunted.svg`, CSS `btn-mode-savannah` | [src:survev/shared/defs/maps/savannahDefs.ts:8-12] [src:kong/relaunch-client-defs] [H] |
| game mode | 80 players, `sniperMode: true`, kill leader enabled | [src:survev/shared/defs/maps/savannahDefs.ts:34] [src:kong/relaunch-client-defs] [H] |
| news names | "The perks of being a survivr" (0.8.3); namu calls the event "All Perked Up" (사바나 이벤트) | [src:changelog/0.8.3] [src:fandom/Changelog] [src:namu/Surviv.io/이벤트] [H] |
| Korean names | The Hunted (role) 수배자, The Hunted (perk) 수배중, "Searching for the Hunted" 새로운 수배자 대기 중, Propane Tank 프로판 탱크 | [src:l10n/ko:game-the_hunted] [src:l10n/ko:game-hunted] [src:l10n/ko:game-waiting-for-hunted] [src:l10n/ko:game-propane_01] [H] |
| biome | background 0x1c5b5f, water 0x41a4aa, ripple 0x96f0f6, beach 0xcb7132, riverbank 0xb25e24, grass 0xb4b02e, underground 0x3d0d03, submerge 0x4e9b8f, ghillie 0xb0ac2b; no camera particles | [src:survev/shared/defs/maps/savannahDefs.ts:20-33] [src:kong/relaunch-client-defs] [src:fandom/Savannah_Map] [H] |
| atlases / sounds | relaunch: gradient, loadout, shared, savannah and no extra audio; survev adds `coconut_01` and `potato_pickup_01` for its fork oasis | [src:kong/relaunch-client-defs] [src:survev/shared/defs/maps/savannahDefs.ts:13-19] [H] |

## History

| version / date | change | sources |
|---|---|---|
| Aug 2019 (0.7.95–0.8.2) | teaser: Savannah Patches with Cloud Crates on the Desert (0.7.95), Woods and Potato maps (0.8.2) — "the great grass mystery of 2019" | [src:changelog/0.7.95] [src:fandom/Changelog] [H] |
| 0.8.3, Sep 12, 2019 | Savannah released: perk looting, 8 new perks (Cast Ironskin, Combat Medic, Martyrdom, One In The Chamber, One With Nature, Scavenger, Takedown, The Hunted), BLR 81, L86A2, SVD-63, VSS, Mk 20 SSR (savannah only), acacia tree, blue cloud crate, grass-covered wall, yellow PARMA crate, hunting perch, large brush, propane tank, savannah stone, marksman military crate | [src:changelog/0.8.3] [src:fandom/Changelog] [H] |
| 0.8.3 secret | Kopje Patch added; ghillie colour follows the map; river width decreased and cabins disabled (leaked to other maps until fixed Sep 25) | [src:fandom/Changelog] [M] |
| 0.8.35 "Take a breather", Sep 17, 2019 | mode ends; VSS added to the normal map | [src:changelog/0.8.35] [src:fandom/Changelog] [H] |
| 0.8.4, Sep 18, 2019 | Kill Leader added to all maps; Savannah keeps "The Hunted" as a separate role | [src:fandom/Changelog] [M] |
| 0.8.65 "Proxy party", Oct 22, 2019 | Savannah returns with Revivify and 9mm Overpressure; CZ-3A1 spawns on Savannah; the role is renamed "The Hunted"; Martyrdom buffed | [src:changelog/0.8.65] [src:fandom/Changelog] [H] |
| post-0.8.82 | "Curveball", Feb 24 – Mar 2, 2020 with the Closer perk; Sundays in the 0.9.2 Event Rotation | [src:fandom/Changelog] [src:fandom/Event_Rotation] [M] |
| fork | "Reintroduced Savannah mode" in fork v0.2.1 (Feb 2, 2026); Cloud Bunker v0.4.2 (Sep 25, 2026); Oasis, second river, S&W 500 v0.4.3 (Sep 29, 2026) (fork) | [src:survev/client/public/changelogRec.html:318-319] [src:survev/client/public/changelogRec.html:56-57] [src:survev/client/public/changelogRec.html:36-48] [H] |

- namu: Savannah appeared every two weeks on Tuesdays and Wednesdays (rotation era) [src:namu/Surviv.io/이벤트] [L]

## Rules

- Lootable perks: one droppable perk at a time; picking up another swaps it and drops the old one; launch post: "eleven unique perks to find, but you can only have one equipped at a time" [src:fandom/Changelog] [src:fandom/Savannah_Map] [M]
- The Hunted: whoever becomes Kill Leader (at least 3 kills and more than the current leader) is promoted to role `the_hunted` with perk `hunted`, revealing their position to all enemies; the role is removed when they die or are overtaken [src:survev/server/src/game/objects/player.ts:1135-1137] [src:survev/server/src/game/objects/player.ts:2884-2901] [src:survev/shared/gameConfig.ts:226] [src:fandom/Savannah_Map] [H]
- The kill feed tracks the Hunted's kills and death like the Woods King [src:fandom/Savannah_Map] [M]
- Weapon bans: no shotguns, no assault rifles except the SCAR-H, no LMGs, no high-quality SMGs except the CZ-3A1, and no 2x scopes; DMRs and sniper rifles are much more common [src:fandom/Savannah_Map] [src:namu/Surviv.io/이벤트] [src:survev/shared/defs/maps/savannahDefs.ts:45-79] [H]
- Ground ammo stacks hold half the usual amount (30 instead of 60) [src:fandom/Savannah_Map] [src:survev/shared/defs/maps/savannahDefs.ts:115-134] [H]
- Strobes appear as rare loot and in grenade crates [src:fandom/Savannah_Map] [src:survev/shared/defs/maps/savannahDefs.ts:153-162] [H]
- The SV-98 is rarer than the AWM-S on this map [src:fandom/Savannah_Map] [src:namu/Surviv.io/이벤트] [M]
- DEagle / dual DEagle only from the Mansion; ammo crates cannot drop .50 AE here [src:fandom/Savannah_Map] [src:survev/shared/defs/maps/savannahDefs.ts:121-128] [H]
- namu: a 4x or better scope is needed to win, but 4x scopes are very common [src:namu/Surviv.io/이벤트] [M]
- Fork: every player spawns with a 2x scope (v0.2.11) that is not dropped on death (v0.4.2) (fork) [src:survev/server/src/game/objects/player.ts:1449-1451] [src:survev/server/src/game/objects/player.ts:2943] [src:survev/client/public/changelogRec.html:311] [src:survev/client/public/changelogRec.html:60] [H]

## Perks

- Perks found on the map (fandom, through 0.8.65 plus the 2020 Closer): Windwalk, Splinter Rounds, Endless Ammo, Cast Ironskin, Small Arms, Takedown, Combat Medic, One With Nature, Scavenger, One In The Chamber, Martyrdom, 9mm Overpressure, Closer (post-0.8.82), and The Hunted (role only) [src:fandom/Savannah_Map] [src:changelog/0.8.65] [M]
- Perk sources: Cloud Crates `crate_21b` (tier_guns 1–2, tier_snipers 1, tier_cloud_02 1, tier_perks 1), savannah stone caches `stone_02sv` (tier_surviv 2–3, M39 EMR, tier_perks 1) and air drops [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:965-977] [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:916-924] [src:fandom/Savannah_Map] [src:kong/relaunch-client-defs] [H]
- Stone caches stopped dropping perks outside Savannah on Sep 15, 2019 [src:fandom/Changelog] [M]
- Fandom's Tier Perks weights (Savannah, Meteor and Cloud Crates): Firepower 1, Windwalk 0.25, Endless Ammo 1, Cast Ironskin 0.5, Splinter Rounds 0.25, Small Arms 0.25, Takedown 1, Combat Medic 0.5, One With Nature 1, Scavenger 1, One In The Chamber 0.5, Martyrdom 0.1, Revivify 0.5, 9mm Overpressure 0.5, Explosive Rounds 0.25 [src:fandom/Loot_tables] [M]
- survev's Savannah tier_perks (fork, 2026-09-27): 17 perks at weight 1 — firepower, windwalk, endless_ammo, steelskin, splinter, small_arms, takedown, field_medic, tree_climbing, scavenger, chambered, martyrdom, self_revive, bonus_9mm, bonus_45, high_velocity, amped_explosives (fork) [src:survev/shared/defs/maps/savannahDefs.ts:171-189] [src:derived/survev-git-9ae131c9] [H]

## Map

### Terrain and lakes

- Same base size and scale as Normal (512 × 1.1875/1.28125 + 112) but shoreInset 24 and grassInset 12 instead of 48/18, so the island is larger — fandom: "slightly bigger than the one in Normal Map" [src:survev/shared/defs/maps/savannahDefs.ts:192-194] [src:survev/shared/defs/maps/baseDefs.ts:812-818] [src:fandom/Savannah_Map] [H]
- Rivers: one narrow river of width 4 (smoothness 0.45, no cabins); the fork added a second option of two width-4 rivers (v0.4.3) [src:survev/shared/defs/maps/savannahDefs.ts:241-247] [src:derived/survev-git-9ae131c9] [src:survev/client/public/changelogRec.html:48] [H]
- Original lakes: three lakes, smaller than the Woods lake; a larger one "fixed in the center" and two random ones; each island holds a gold Bunker Crate (`crate_02sv_lake`, a Soviet-crate variant) [src:fandom/Savannah_Map] [src:fandom/Lake] [M]
- survev's first reconstruction (2025-08): one lake inner 32 / outer 48 and two lakes 16 / 32, all within 200 units of the map centre; until 2026-03-14 a single `crate_02sv_lake` was a fixed spawn, after that each lake got one in its centre [src:derived/survev-git-bbe1a377] [src:derived/survev-git-e305bb67] [M]
- survev now: the large lake holds the fork Cloud Bunker (`bunker_structure_10`, river mask radius 85), a fork Oasis lake (inner 10 / outer 20, within 300 units, no river objects) and two crate lakes [src:survev/shared/defs/maps/savannahDefs.ts:195-240] [H]
- `crate_02sv_lake` (140 HP, yellow on the minimap): v0.8.82 loot 5–6 × tier_soviet; survev adds 1 × tier_medical [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:403-409] [H]
- If two lakes overlap, a small island can be flooded so its crate spawns in the water [src:fandom/Lake] [M]
- One With Nature (faster in water) is useful around the lakes [src:fandom/Lake] [M]

### Structures and obstacles

- Only Shack, Outhouse, Warehouse, Storm Bunker, Egg Bunker and Mansion of the normal structures spawn [src:fandom/Savannah_Map] [M]
- The savannah Egg Bunker crate (`crate_07sv`) drops 2 × SVD-63 and 2 × BLR 81 (plus tier_surviv and khaki outfits) [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:540-551] [src:fandom/Savannah_Map] [H]
- Map content (fandom): Hunting Perch, Grassy Cover (single loot in the centre, can form a Grassy Cover Complex with destructible walls), Brush Clumps with common loot, Savannah Patches and Kopje Patches with Cloud Crates, propane tanks, savannah trees, savannah stones, Marksman Military Crates (2 random guns) [src:fandom/Savannah_Map] [src:changelog/0.8.3] [M]
- Places, place-anchored houses and location spawns are all cleared (no club) [src:survev/shared/defs/maps/savannahDefs.ts:250-253] [H]

| kind | survev entries (small / large where split) | sources |
|---|---|---|
| density | stone_01 72, barrel_01 48, propane_01 24, stone_07 6, crate_01 70 (pre-fork-v0.4.3 50), crate_02sv 6 (was 4), crate_03 10 (was 8), crate_21b 3 (was 2), bush_01sv 48, tree_01sv 48, hedgehog_01 24, tree_12 24, container_01–04 5 each, shack_01 7, outhouse_01 5, loot_tier_1 30 (was 24), loot_tier_beach 4 | [src:survev/shared/defs/maps/savannahDefs.ts:254-277] [src:balance/342] [H] |
| fixed | grassy_cover_01/02/03 8/9 each, grassy_cover_complex_01 2/3, brush_clump_01/02/03 11/13 each, perch_01 11/13, kopje_patch_01 2/3, savannah_patch_01 4/5, mansion_structure_01 1, warehouse_01 3/4 (was 4/5), warehouse_03sv 1 (fork alt warehouse), cache_01sv 1, cache_02sv 1 (mosin tree), cache_07 1, bunker_structure_01sv 1 (Egg Bunker), bunker_structure_03 1 (Storm Bunker), chest_01 1, chest_03sv 1, mil_crate_05 6/8, tree_02 3 | [src:survev/shared/defs/maps/savannahDefs.ts:278-303] [src:derived/survev-git-a2136d44] [H] |
| replacements | tree_01→tree_01sv, bush_01→bush_01sv, stone_03→stone_03sv | [src:survev/shared/defs/maps/savannahDefs.ts:305-311] [H] |

- Crates: `crate_02sv` (yellow PARMA crate, 140 HP): v0.8.82 loot 4–5 × tier_soviet + 1 × tier_world; survev adds 1 × tier_medical [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:391-402] [H]
- `mil_crate_05` Marksman Military Crate: tier_guns 1–2 + tier_snipers 1–2, shown on the minimap [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1463-1471] [src:fandom/Savannah_Map] [H]
- Cloud Crates spawn mostly in Savannah/Kopje Patches and rarely loose in the grass [src:fandom/Cloud_Crate] [src:fandom/Savannah_Map] [M]
- Fork structures: Cloud Bunker (`bunker_cloud_01` / `bunker_cloud_sublevel_01`, v0.4.2, under the large lake, Experimental Pack, fire axe, 2 perks), Savannah Oasis (`oasis_01sv`, v0.4.3, heals 1 HP/s, central Cloud Crate `crate_21`, outer `crate_02sv_lake`), alternate warehouse `warehouse_03sv` (v0.2.1) (fork) [src:survev/shared/defs/mapObjects/structureDefs.ts:1066-1074] [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:8547-8551] [src:wikigg/Cloud_Bunker] [src:wikigg/Oasis] [H]

## Loot overrides (survev `savannah`)

| table | entries (weight) | sources |
|---|---|---|
| tier_scopes | 4x 5, 8x 1 (?), 15x 0.02 (?) — no 2x | [src:survev/shared/defs/maps/savannahDefs.ts:45-49] [M] |
| tier_guns | scar 1, scorpion 1, mp5 5, mac10 6, ump9 3, m1a1 5, ot38 4, colt45 4, m9 9, m1911 9, flare_gun 0.145, flare_gun_dual 0.0025, model94 6 (?), blr 6 (?), scout_elite 3 (?), mk12 2 (?), m39 2 (?), vss 1.5 (?), mosin 0.75 (?), mkg45 0.75 (?), l86 0.75 (?), svd 0.75 (?), garand 0.45 (?), sw500 0.09 (fork), barrett 0.06 (fork), scarssr 0.06, awc 0.06, sv98 0.09 (?) | [src:survev/shared/defs/maps/savannahDefs.ts:50-79] [M] |
| tier_armor | helmet01 4, helmet02 4, helmet03 0.2, chest01 6, chest02 4, chest03 0.2 (fork v0.2.11) | [src:survev/shared/defs/maps/savannahDefs.ts:80-87] [src:balance/220] [H] |
| tier_airdrop_uncommon | mk12 2.5, scar 0.75, mosin 2.5, m39 2.5, m9 0.01, flare_gun 0.5, mkg45 2.5 (!), vss 2.5 (!), l86 0.75 (?), svd 0.75 (?), sw500 0.25 (fork), barrett 0.075 (fork), scarssr 0.075, awc 0.075, sv98 0.2 (?) | [src:survev/shared/defs/maps/savannahDefs.ts:88-104] [M] |
| tier_airdrop_rare | garand 6, sw500 2 (fork), barrett 1.5 (fork), awc 1.5, scarssr 1.5, sv98 3, scorpion 5 (?), ots38_dual 4.5 | [src:survev/shared/defs/maps/savannahDefs.ts:105-114] [M] |
| tier_ammo / tier_airdrop_ammo | 9mm, .45 ACP, 7.62, 5.56 — 30 rounds each, weight 3 | [src:survev/shared/defs/maps/savannahDefs.ts:115-134] [H] |
| tier_ammo_crate | the four above (30 each, weight 3), .308 ×5 (1), flare ×1 (1) | [src:survev/shared/defs/maps/savannahDefs.ts:121-128] [H] |
| tier_chest | mk12 0.55, scar 0.27, mosin 0.55, m39 0.55, sv98 0.1, helmet02 1, helmet03 0.25, chest02 1, chest03 0.25, 4x 0.5, 8x 0.25 | [src:survev/shared/defs/maps/savannahDefs.ts:135-147] [H] |
| tier_hatchet | vss 1, svd 1, l86 1 | [src:survev/shared/defs/maps/savannahDefs.ts:148-152] [H] |
| tier_throwables | frag ×2 1, smoke 1, strobe 0.2, MIRV ×2 0.05 | [src:survev/shared/defs/maps/savannahDefs.ts:153-158] [H] |
| tier_airdrop_throwables | strobe 1, MIRV ×2 1 | [src:survev/shared/defs/maps/savannahDefs.ts:159-162] [H] |
| crow case (fork alt warehouse) | skin: tier_outfits 0.5 / Splintered Wheat 0.5; melee: crowbar 9 / sledgehammer 1 | [src:survev/shared/defs/maps/savannahDefs.ts:163-170] [H] |

- Fork balance on Savannah: Barrett added (v0.4.2), AWM-S and Mk 20 SSR weights halved (v0.4.2), S&W 500 added (v0.4.3), SV-98 airdrop-uncommon weight 0.1 → 0.2 (v0.4.3), DMR headshot multipliers cut (fork) [src:balance/338-349] [src:survev/client/public/changelogRec.html:70-71] [src:survev/client/public/changelogRec.html:46] [H]
- Pre-fork reconstruction weights: tier_guns scarssr 0.15, awc 0.15, sv98 0.1; tier_airdrop_rare awc 3, scarssr 3 [src:derived/survev-git-367a7b3d] [M]

## Air drops

- Crates: `airdrop_crate_01sv` 10 : `airdrop_crate_02sv` 1; Main plane timings (circle 1 wait 10, circle 3 wait 2) [src:survev/shared/defs/maps/savannahDefs.ts:36-43] [src:survev/shared/defs/maps/baseDefs.ts:68-80] [H]
- `crate_10sv` = normal drop + 1 × tier_perks; `crate_11sv` (gold) v0.8.82 = gold drop + 2 × tier_perks; survev swaps its tier_airdrop_armor roll for a fork Experimental Pack (`backpack04_cloud`) [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:657-698] [src:derived/survev-git-24275240] [H]
- Fandom: Cloud Crates and air drops spawn perk loot [src:fandom/Savannah_Map] [M]

## Conflicts

- CONFLICT savannah-lakes: three crate lakes, the large one fixed at the centre [src:fandom/Savannah_Map] [src:fandom/Lake] vs survev's Cloud Bunker lake + Oasis lake + two crate lakes, all at random positions near the centre [src:survev/shared/defs/maps/savannahDefs.ts:195-240]; proposed: three crate lakes, large one at the centre (fork lakes as flags) [M]
- CONFLICT savannah-rivers: one width-4 river [src:derived/survev-git-bbe1a377] vs fork 1 or 2 rivers [src:survev/client/public/changelogRec.html:48]; proposed: one river [H]
- CONFLICT savannah-crate-counts: crate_01 50, crate_02sv 4, crate_03 8, crate_21b 2, loot_tier_1 24 [src:balance/342] vs fork 70 / 6 / 10 / 3 / 30 [src:survev/shared/defs/maps/savannahDefs.ts:254-277]; proposed: pre-fork counts (themselves estimates) [M]
- CONFLICT savannah-free-scope: no 2x scopes on Savannah [src:fandom/Savannah_Map] vs fork free 2x scope at spawn [src:survev/server/src/game/objects/player.ts:1449-1451]; proposed: no free scope [H]
- CONFLICT savannah-perk-pool: original pool (fandom weights, no Firepower in the map's perk list) [src:fandom/Loot_tables] [src:fandom/Savannah_Map] vs survev 17 perks at equal weight incl. fork perks [src:survev/shared/defs/maps/savannahDefs.ts:171-189]; proposed: fandom-weighted pool restricted to perks existing at 0.8.82 [L]
- CONFLICT savannah-crate-medical: `crate_02sv` and `crate_02sv_lake` without tier_medical [src:kong/relaunch-client-defs] vs survev adding 1 × tier_medical [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:391-409]; proposed: relaunch loot [H]
- CONFLICT savannah-gold-drop-armor: `crate_11sv` with tier_airdrop_armor [src:kong/relaunch-client-defs] vs fork Experimental Pack [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:678-698]; proposed: relaunch loot [H]
- CONFLICT savannah-fork-guns: no Barrett or S&W 500 in v0.8.82 [src:changelog/0.8.3] vs survev Savannah tables with both [src:balance/338] [src:balance/346]; proposed: remove both [H]

- CONFLICT savannah-sv98-vs-awm: the SV-98 is rarer than the AWM-S [src:fandom/Savannah_Map] [src:namu/Surviv.io/이벤트] (pre-fork survev: tier_guns sv98 0.1 vs awc 0.15 [src:derived/survev-git-367a7b3d]) vs fork sv98 0.09 vs awc 0.06 and airdrop rare sv98 3 vs awc 1.5 [src:survev/shared/defs/maps/savannahDefs.ts:77-78] [src:survev/shared/defs/maps/savannahDefs.ts:105-111]; proposed: pre-fork weights (SV-98 rarer) [M]

## Open questions

- All Savannah spawn counts and most gun weights are fork reconstructions marked "?"; the original numbers are unknown [src:survev/shared/defs/maps/savannahDefs.ts:47-103] [L]
- Whether the original large lake was exactly at the map centre (fandom) or only near it [src:fandom/Lake] [src:derived/survev-git-bbe1a377] [L]
- Whether Firepower was in the original Savannah perk pool: the 0.8.3 post counts eleven perks and fandom's Savannah list omits it, but fandom's Tier Perks table includes it [src:fandom/Changelog] [src:fandom/Savannah_Map] [src:fandom/Loot_tables] [L]
