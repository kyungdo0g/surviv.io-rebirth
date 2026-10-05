# Beach mode

> Two different things share the name. (1) The original "Beach Party" event of June 2020 (post-0.8.82, Kongregate era): Water Gun, Water Balloon, Popsicle, Wet effect, Ice Box, Speedo. None of its items exist in survev or in the relaunch client. (2) survev's "Beach" map (`beach`, mapId 9), a fork creation of December 2025 with coconuts, a pirate hut and a beach mansion; it is not a reconstruction of the 2020 map.
> Both are outside the v0.8.82 target. The 2020 event is tagged (post-0.8.82); the survev map is tagged (fork).

## Original "Beach Party" event (post-0.8.82)

### Dates and identity

- Released in v0.9.5b "Beach Party" on June 15, 2020, alongside the in-game Store (post-0.8.82) [src:fandom/Changelog] [src:fandom/Beach_Map] [M]
- News post: "Summer is here! Island staff have generously distributed Ice Boxes containing goodies: Cool off (and slow down) fellow Survivrs with water balloons and water guns, or find some refreshing Popsicles for a speed boost." (post-0.8.82) [src:fandom/Changelog] [M]
- Events list: Beach Party ran Jun 15–16 to Jun 23, 2020 (post-0.8.82) [src:fandom/Changelog] [src:namu/Surviv.io/이벤트] [H]
- namu calls it the summer event (여름 이벤트), Jun 16–23, 2020, on a map with colours similar to the basic map; items 물총 (Water Gun), 물풍선 (Water Balloon), 아이스박스 (Ice Box) (post-0.8.82) [src:namu/Surviv.io/이벤트] [M]
- namu: long events such as Summer blocked the daily rotation events while active (post-0.8.82) [src:namu/Surviv.io/이벤트] [M]
- Fandom map flag `beachMode = True`; 80 players (post-0.8.82) [src:fandom/Beach_Map] [M]

### Map

- Bushes and trees replaced by palm trees: smaller dark-green bushes and larger, brighter trees; berry bushes still present (post-0.8.82) [src:fandom/Beach_Map] [M]
- Biome (fandom tints): background 0x20536e, water 0x3576c8, beach 0xcfab88 ("dull pink"), riverbank 0xb4895f, grass 0xa5b85d, underground 0x1b0d03, player submerge 0x2b8ca4, ghillie 0x83af50 (the Normal map's) (post-0.8.82) [src:fandom/Beach_Map] [src:derived/beach-tint-hex] [M]
- Special buildings: Crimson Ring Club, Docks, Mansion, Police Station, Bank, Greenhouse (post-0.8.82) [src:fandom/Beach_Map] [M]

### Event items (post-0.8.82)

| item | id | facts | sources |
|---|---|---|---|
| Water Gun | `waterGun`, bullet `bullet_water` | 7.62mm, auto, 30-round magazine (40 extended), fire delay 0.1 s, reload 2.5 s, switch 0.75 s, 5.5 damage + water-balloon splash on hit (2 more, total 7.5), range 200, speed 100, spawns with 90 rounds; coded as an assault rifle copied from the AK-47; inflicts Wet | [src:fandom/Water_Gun] [M] |
| Water Balloon | `water_balloon` | throwable, explosion 2 damage, radius 1.24–1.25, inflicts Wet; found in Ice Boxes | [src:fandom/Water_Balloon] [M] |
| Popsicle | `watermelon` | consumable, 2 s use, capacity 2/5/10/15, +10 % speed for 10 s, stacks and refreshes; eaten instantly while Wet; the id comes from a planned watermelon | [src:fandom/Popsicle] [src:fandom/Changelog] [M] |
| Wet effect | – | movement, firing and reload 30 % slower for about 2 s | [src:fandom/Wet_Effect] [src:fandom/Changelog] [M] |
| Ice Box | `crate_IceBox` | 100 HP crate on grass and beach, not on the minimap, drops 3–5 × Tier Beach (Popsicles, Water Guns with 90 7.62mm, Water Balloons, Speedo) | [src:fandom/Ice_Box] [src:namu/Surviv.io/이벤트] [M] |
| Speedo | `outfitSpeedo` | outfit, only from Ice Boxes, lets the wearer move at normal speed in water, not dropped on death | [src:fandom/Speedo] [src:fandom/Changelog] [M] |

- namu: the water gun was essential in the summer event (AK-47-like damage plus slow); water balloons were weak early but useful late (post-0.8.82) [src:namu/Surviv.io/이벤트] [M]
- The Water Gun stayed in the potato rotation pool until it was removed from potato mode on Jul 6, 2020; the later Beach Ballin' skin (Survivr Pass 7, Jun 8, 2021) is unrelated to the event (post-0.8.82) [src:fandom/Potato_Map] [src:fandom/Beach_Ballin'] [M]
- None of `waterGun`, `water_balloon`, `watermelon`, `crate_IceBox` or `outfitSpeedo` is defined in the relaunch client or in survev [src:kong/relaunch-client-defs] [src:derived/survev-grep-beach2020] [H]

## survev "Beach" map (fork)

### Identity and history

- Added in fork v0.2.0 (January 18, 2026; balance log "Winter + Beach Update" 2025/12/30): new mode Beach, Pirate Hut, Palm Tree, Coconut Palm, Coconut Barrel, Gold Cutlass Mount, Cutlass, Cutlass Gold, Coconut throwable, Pirate's Bounty perk, outfits Beach Shored, Coconut Frenzy, Tidal Wave, Parrotfish (fork) [src:survev/client/public/changelogRec.html:342-349] [src:balance/200] [src:derived/survev-git-aa37de9c] [H]
- Fork v0.2.01 (Jan 20, 2026): Beach loot redistributed, Cutlass from air drops, three natural air drops instead of two; the [Unreleased] list mentions a further "Beach mode update" (fork) [src:survev/client/public/changelogRec.html:332-338] [src:survev/client/public/changelogRec.html:29] [H]
- `MapId.Beach` = 9; name "Beach", icon `img/loot/loot-throwable-coconut.svg`, CSS `btn-mode-beach`; atlases loadout, shared, main, beach; sounds `coconut_01`, `potato_pickup_01` (fork) [src:survev/shared/defs/maps/beachDefs.ts:7-20] [src:survev/shared/gameConfig.ts:97-109] [H]
- wiki.gg summary: coconuts and the Gold Cutlass, huts with Coconut Barrels, a Pirate Hut, a bigger beach, chests on the beach, unique skins (fork) [src:wikigg/Beach_mode] [M]
- Korean: Coconut 코코넛, Cutlass 커틀러스, Hook 후크, Parrotfish 앵무물고기, Tidal Wave 타이덜 웨이브, Beach Shored 해변가 (key misspelt `game-outifitBeachCamo`) [src:l10n/ko:game-coconut] [src:l10n/ko:game-cutlass] [src:l10n/ko:game-hook] [src:l10n/ko:game-outfitParrotfish] [src:l10n/ko:game-outfitWave] [src:l10n/ko:game-outifitBeachCamo] [H]

### Map generation (fork)

- Biome: background 0x20536e, water 0x42b0ba, beach 0xffe7ba, riverbank 0xa37119, grass 0x7ba865, submerge 0x2b8ca4, ghillie 0x7dac66 (fork) [src:survev/shared/defs/maps/beachDefs.ts:21-33] [H]
- Size: base 512, scale 1.1875 / 1.28125, extension 112 (720 / 768 like Normal), but shoreInset 72 and grassInset 48 give a much wider beach (fork) [src:survev/shared/defs/maps/beachDefs.ts:127-133] [H]
- Rivers: weights 0.25 each for [20, 16], [18, 18, 4], [18, 4, 4], [16, 16, 10], [16, 16, 6, 4], [16, 10, 10] and 1e-4 for [16, 10, 10, 4, 4]; smoothness 0.45; cabins on; only medium bridges (`bridge_md_structure_01`) (fork) [src:survev/shared/defs/maps/beachDefs.ts:134-151] [src:survev/shared/defs/maps/beachDefs.ts:187-191] [H]
- Places: The Sandpit (0.53, 0.64), Sunburn (0.84, 0.18), Okhotsk (0.15, 0.11), Ytyk-Plaz (0.25, 0.42), Todesinsel (0.81, 0.85), Coconut (0.21, 0.79), Sandy Shores (0.73, 0.47), Playa Pollo (0.53, 0.25) (fork) [src:survev/shared/defs/maps/beachDefs.ts:153-186] [H]
- The Crimson Ring Club still comes from Main's centre location spawn and is an important spawn (fork) [src:survev/shared/defs/maps/baseDefs.ts:878-887] [src:survev/shared/defs/maps/beachDefs.ts:265] [H]
- density: stone_01 275, barrel_01 76, silo_01 3, crate_01 50, crate_03 8, crate_09bh 6, bush_01 78, cache_06bh 12, tree_01 75, tree_13bh 195 (palm), tree_14 35 (coconut palm), hedgehog_01 10, container_01–04 5 each, shack_01 7, outhouse_01 5, loot_tier_1 24, loot_tier_beach 24, barrel_05 10 (coconut barrel) (fork) [src:survev/shared/defs/maps/beachDefs.ts:192-216] [H]
- fixed: warehouse_01 1, house_red_01 2/3, house_red_02 2/3, barn_01 2/3, barn_02 1, hut_01bh 5/6, hut_02 1, hut_03 1, hut_04 1 (pirate hut), shack_03a 2, shack_03b 4/6, cache_01bh/02bh/07bh 1 each, bunker_structure_01 (odds 0.25), bunker_structure_02–05 1 each, warehouse_complex_01 1, chest_01 1, chest_02 2, chest_03 (odds 0.5), mil_crate_02 (odds 0.25), tree_02 3, teahouse_complex_01su 1/2, stone_04 1, mansion_structure_03 1 (beach mansion); no random building rotation (fork) [src:survev/shared/defs/maps/beachDefs.ts:217-258] [H]
- Replacements: bush_01→bush_03, stone_03→stone_03bh (fork) [src:survev/shared/defs/maps/beachDefs.ts:259-264] [H]
- Huts (`hut_01bh`) hold a pot, a Coconut Barrel (2/4) or nothing; Coconut Palm `tree_14` (175 HP) drops 3 coconuts and a 1/20 Coconut Frenzy roll; Coconut Barrel `barrel_05` (80 HP, beach only); chest_02 drops 2 × tier_chest (fork) [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:5252-5256] [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:1573-1586] [src:survev/shared/defs/maps/baseDefs.ts:427-430] [src:survev/shared/defs/mapObjects/obstacles/furnitureDefs.ts:673-690] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:325-329] [src:wikigg/Coconut_Palm] [src:wikigg/Coconut_Barrel] [H]

### Air drops and loot (fork)

- Three natural drops: circle 0 + 25 s, circle 1 + 10 s, circle 3 + 2 s; crates `airdrop_crate_01` 10 : `airdrop_crate_02` 1 (fork) [src:survev/shared/defs/maps/beachDefs.ts:34-58] [src:survev/client/public/changelogRec.html:338] [H]

| table | entries | sources |
|---|---|---|
| tier_soviet | tier_guns 1.75, tier_surviv 2.5, tier_chest 0.75 | [src:survev/shared/defs/maps/beachDefs.ts:61-65] [H] |
| tier_throwables | frag ×2 1, smoke 1, MIRV ×2 0.05, coconut ×3 0.4 | [src:survev/shared/defs/maps/beachDefs.ts:66-71] [H] |
| tier_chest | hk416 4, ak47 4, mp220 1.75, groza 1.25, famas 1, spas12/mk12/m39/dp28 0.77, scar/bar/scout_elite/saiga 0.27, mosin/deagle 0.15, vector 0.1, m249/sv98 0.05, helmet02 1, helmet03 0.3, chest02 1, chest03 0.3, 4x 0.5, 8x 0.25 | [src:survev/shared/defs/maps/beachDefs.ts:72-97] [H] |
| tier_airdrop_throwables | coconut ×4 | [src:survev/shared/defs/maps/beachDefs.ts:98] [H] |
| tier_pirate_melee | hook 1, cutlass 2 | [src:survev/shared/defs/maps/beachDefs.ts:99-102] [H] |
| tier_outfits | Aquatic Avenger 0.3, Coral Guise 0.3, Island Time 0.3, Beach Shored 0.25, Ghillie Suit 0.01 | [src:survev/shared/defs/maps/beachDefs.ts:103-109] [H] |
| tier_airdrop_melee | none 15, cutlass 4, pan 1 | [src:survev/shared/defs/maps/beachDefs.ts:110-114] [H] |
| tier_airdrop_outfits | none 10, Valiant Pineapple 8, Tidal Wave 8, Ghillie Suit 0.5 | [src:survev/shared/defs/maps/beachDefs.ts:115-120] [H] |
| tier_pirate_outfits | Royal Fortune 1, Parrotfish 1 | [src:survev/shared/defs/maps/beachDefs.ts:121-124] [H] |

- The Coconut (`coconut`, fork): impact throwable, 22 explosion damage, 1 s slow, heals the thrower or allies it hits by 7 HP, capacity 3/6/9/12/15, cannot be potato-swapped (fork) [src:wikigg/Coconut] [src:survev/shared/defs/gameObjects/throwableDefs.ts:838] [M]
- Of the outfits above, Aquatic Avenger, Coral Guise, Island Time, Valiant Pineapple and Royal Fortune are original items; Tidal Wave, Beach Shored, Parrotfish and Coconut Frenzy, the Cutlass and the Coconut are fork-only [src:kong/relaunch-client-defs] [src:survev/client/public/changelogRec.html:345-349] [H]

## Conflicts

- CONFLICT beach-identity: the 2020 Beach Party map (palm-reskinned normal map with Water Gun, Water Balloon, Popsicle, Ice Box, Speedo) [src:fandom/Beach_Map] [src:fandom/Changelog] vs survev's 2025 "Beach" map with coconuts, pirate hut and beach mansion [src:survev/shared/defs/maps/beachDefs.ts:7-268]; proposed: treat survev Beach as fork content, document the 2020 event as post-0.8.82 optional content (neither in the v0.8.82 core) [H]
- CONFLICT beach-biome-colours: 2020 water 0x3576c8, beach 0xcfab88, riverbank 0xb4895f, grass 0xa5b85d, ghillie 0x83af50 [src:fandom/Beach_Map] vs survev water 0x42b0ba, beach 0xffe7ba, riverbank 0xa37119, grass 0x7ba865, ghillie 0x7dac66 [src:survev/shared/defs/maps/beachDefs.ts:21-33]; proposed: fandom values for any 2020 recreation [M]
- CONFLICT beach-event-start: Jun 15, 2020 (v0.9.5b post date) [src:fandom/Changelog] vs Jun 16, 2020 [src:namu/Surviv.io/이벤트]; proposed: Jun 15 US time = Jun 16 KST [M]

## Open questions

- The 2020 Tier Beach weights, Ice Box density and whether the 2020 map changed building counts are unknown (fandom stubs) [src:fandom/Ice_Box] [src:fandom/Beach_Map] [L]
- The Water Balloon's capacity and the exact Wet duration ("about 2 seconds") are not documented [src:fandom/Water_Balloon] [src:fandom/Wet_Effect] [L]
