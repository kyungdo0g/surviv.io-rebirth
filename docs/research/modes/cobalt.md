# Cobalt mode

> The Cobalt map (survev `cobalt`, mapId 7): pick one of six classes, loot class pods, fight over the Twins Bunker. Released in 0.8.8 (Dec 2, 2019), the last new mode before 0.8.82.
> Class definitions (perks, starting items, colours, the selection menu) are in `items/roles.md` → "Cobalt classes"; perk effects in `items/perks.md`; the Twins Bunker layout and the fork's puzzle rooms in `maps/bunkers.md` / `maps/puzzles.md`.

## Identity

| field | value | sources |
|---|---|---|
| survev id / mapId | `cobalt`, MapId.Cobalt = 7 | [src:survev/shared/defs/maps/cobaltDefs.ts:6-7] [src:survev/shared/gameConfig.ts:97-109] [H] |
| UI | name "Cobalt", icon `img/gui/cobalt.svg`, CSS `btn-mode-cobalt`; survev reuses the desert splash | [src:survev/shared/defs/maps/cobaltDefs.ts:8-13] [src:kong/relaunch-client-defs] [H] |
| game mode | 80 players, `perkMode: true`, `perkModeRoles` scout, sniper, healer, demo, assault, tank; kill leader enabled | [src:survev/shared/defs/maps/cobaltDefs.ts:195-199] [src:kong/relaunch-client-defs] [H] |
| sounds / atlases | `spawn_01`, `ping_unlock_01`, ambient `ambient_lab_01`, recorders `log_13`, `log_14`; atlases loadout, shared, cobalt (relaunch also gradient) | [src:survev/shared/defs/maps/cobaltDefs.ts:14-23] [src:kong/relaunch-client-defs] [H] |
| biome | background 0x020e18, water 0x003571, beach 0x684836, riverbank 0x443d3a, grass 0x4d5a68, underground 0x1b0d03, submerge 0x123049, ghillie 0x4b5866 | [src:survev/shared/defs/maps/cobaltDefs.ts:24-36] [src:kong/relaunch-client-defs] [src:fandom/Cobalt_Map] [H] |
| news / event name | "Stay classy" (0.8.8); namu: "Class Warfare" (코발트 이벤트) | [src:changelog/0.8.8] [src:fandom/Changelog] [src:namu/Surviv.io/이벤트] [H] |
| Korean names | class menu "SELECT A CLASS" = 클래스를 선택하세요; Scout 정찰병, Sniper 저격수, Medic 메딕, Demo 폭파병, Assault 돌격병, Tank 장갑병; Master Scavenger 숙련된 수집가 | [src:survev/client/src/en.json:750-756] [src:l10n/ko:game-select-class] [src:l10n/ko:game-healer] [src:l10n/ko:game-tank] [src:l10n/ko:game-scavenger_adv] [H] |

## History

- 0.8.8 "Stay classy", Dec 2, 2019: six classes (cobalt map only), Hollow-points and Master Scavenger perks, Twins Bunker, class pods, synthetic tree, bushes and stones; One in the Chamber stops working with shotguns [src:changelog/0.8.8] [src:fandom/Changelog] [H]
- Launch post: "Class warfare comes to the Island with the release of the new COBALT map. Choose from one of six classes and drop in with preset perks and items" [src:fandom/Changelog] [M]
- Same update (secret): class melees The Separator, Hakai no Katana, Panzerhammer, Scouting Crowbar, Marksman's Recurve, Trench Spade; class outfits all named "Basic Outfit"; Twins Bunker logo emote; Cast Ironskin buffed to +40 % size / −50 % damage [src:fandom/Changelog] [M]
- The mode ended with the Dec 10, 2019 post "Declassified" ("The cloning vats have exhausted their fluids") [src:fandom/Changelog] [M]
- namu: Cobalt ran Dec 2–9, 2019; in the rotation era it appeared on Mondays and Thursdays [src:namu/Surviv.io/이벤트] [M]
- Post-0.8.82 it was Monday's mode in the 0.9.2 Event Rotation; the Mar 23, 2020 spring event overrode a Cobalt day when "Cobalt had only ever happened once before" [src:fandom/Event_Rotation] [src:fandom/Changelog] [M]
- Fork: class pod and puzzle work 2025-03 onward; v0.3.0 "Cobalt & Pass" (May 11, 2026) expanded the Twins Bunker and added Classless; v0.3.01 and v0.3.13 rebalanced pods (fork) [src:derived/survev-git-4ee8362b] [src:survev/client/public/changelogRec.html:216-236] [src:survev/client/public/changelogRec.html:203-214] [src:balance/285-313] [H]

## Class selection and spawning

- Joining players are placed at the Twins Bunker (`bunker_twins_sublevel_01`) while a class menu is open; after choosing they are moved to a normal spawn point on the surface [src:survev/server/src/game/objects/player.ts:158-163] [src:survev/server/src/game/objects/player.ts:1086-1103] [src:fandom/Cobalt_Map] [H]
- Choice time 20 s (`perkModeRoleSelectDuration`); without a choice a random class is given (survev server timer 25 s); wiki.gg (fork): the currently highlighted class is used [src:survev/shared/gameConfig.ts:228] [src:survev/server/src/game/objects/player.ts:231] [src:survev/server/src/game/objects/player.ts:1497-1504] [src:fandom/Cobalt_Map] [src:wikigg/Cobalt_mode] [H]
- While choosing, players take no damage and cannot act [src:survev/server/src/game/objects/player.ts:1507] [src:survev/server/src/game/objects/player.ts:2416] [src:fandom/Cobalt_Map] [H]
- In squads, teammates can be seen choosing in the bunker on the map before teleporting to their spawn [src:fandom/Twins_Bunker] [M]
- Classes start with 2 perks (3 for the Demo, whose Martyrdom is hidden) and preset items (see `items/roles.md`) [src:fandom/Perks] [src:fandom/Classes] [M]
- Outfits are disabled: every outfit tier is replaced (tier_outfits → helmet02 / chest02; mansion, vault, police, conch, noir, khaki, islander, imperial and club-melee tiers → tier_outfits), the Fragtastic tier is empty and air-drop outfits are always the Ghillie Suit [src:survev/shared/defs/maps/cobaltDefs.ts:56-83] [H]
- Fandom: skins and melee weapons are only available from class pods, except the Ghillie Suit (rare pods / Master Scavenger), the Wood Axe in the Crossing Bunker and the Sledgehammer in the Alternate Barn [src:fandom/Cobalt_Map] [src:fandom/Class_Pod] [M]
- Fandom Loot tables: on Cobalt, Tier Club Melee and Tier Conch drop Level 2 Helmet / Level 2 Vest [src:fandom/Loot_tables/Specific] [M]

## Class pods

- Three shells, opened like an air drop (200 HP shell, 2.25 radius): common `class_shell_01` scattered on the map, rare `class_shell_02` from air drops, mythic `class_shell_03` in the Twins Bunker and very rarely as an air drop [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1209-1257] [src:kong/relaunch-client-defs] [src:fandom/Class_Pod] [H]
- Common and rare shells are `smartLoot`: the opener's class picks the crate (`class_crate_common_<class>` / `class_crate_rare_<class>`, 150 HP); the mythic crate is the same for everyone [src:survev/server/src/game/objects/obstacle.ts:531-551] [src:kong/relaunch-client-defs] [src:fandom/Class_Pod] [H]
- Fork 0.3.0: loot from a pod is reserved for the opener first, and common pods keep 32 units apart (fork) [src:survev/server/src/game/objects/obstacle.ts:545-550] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1209-1215] [src:survev/client/public/changelogRec.html:230] [H]
- Class pods count as air drops for the "Unlock air drops" quest [src:fandom/Class_Pod] [M]

| crate | v0.8.82 contents (relaunch client / fandom) | survev changes (fork) | sources |
|---|---|---|---|
| common scout | tier_guns_common_scout, Scouting Crowbar, Level 1 Helmet, Small Pack, 3 sodas | 2 sodas (0.3.01) | [src:kong/relaunch-client-defs] [src:fandom/Class_Pod] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1259-1268] [src:balance/303] [H] |
| common sniper | tier_guns_common_sniper, Marksman's Recurve, Level 1 Helmet, Small Pack, 4x scope | same | [src:kong/relaunch-client-defs] [src:fandom/Class_Pod] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1269-1278] [H] |
| common healer | tier_guns_common_healer, The Separator, Level 1 Helmet, Small Pack, med kit, pills, 3 smokes | med kit → tier_health_healer (bandages ×5 4 / med kit 6) (0.3.13) | [src:kong/relaunch-client-defs] [src:fandom/Class_Pod] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1279-1290] [src:balance/323-324] [H] |
| common demo | tier_guns_common_demo, Hakai no Katana, Level 1 Helmet, Regular Pack, 6 MIRVs | + Level 1 Vest, + 2x scope, MIRVs → 3–4 × tier_throwables_demo (frag ×3 / MIRV ×2) (0.3.0/0.3.01) | [src:kong/relaunch-client-defs] [src:fandom/Class_Pod] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1291-1302] [src:balance/293] [src:balance/304-305] [H] |
| common assault | 2 × tier_guns_common_assault, Trench Spade, Level 1 Helmet, Small Pack | + 5 bandages, + Level 1 Vest (0.3.01) | [src:kong/relaunch-client-defs] [src:fandom/Class_Pod] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1303-1313] [src:balance/306-307] [H] |
| common tank | tier_guns_common_tank, Panzerhammer, Level 2 Helmet, Level 2 Vest, Small Pack | same (fandom lists a Regular Pack) | [src:kong/relaunch-client-defs] [src:fandom/Class_Pod] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1314-1323] [M] |
| rare (all six) | class gun tier ×1 (assault ×2), class melee, 1 × tier_airdrop_armor, 1 × tier_medical, 1 × tier_airdrop_scopes, 2 × tier_airdrop_ammo, 1 × tier_airdrop_throwables | rare demo: 4–5 × tier_throwables_demo instead of the air-drop throwable (0.3.0) | [src:kong/relaunch-client-defs] [src:fandom/Class_Pod] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1334-1405] [src:balance/295] [H] |
| mythic | 1 × tier_class_crate_mythic: Master Scavenger, Explosive Rounds or Splinter Rounds | + Indomitable Spirit (`lifeline`) (0.3.0) | [src:kong/relaunch-client-defs] [src:survev/shared/defs/maps/baseDefs.ts:529-534] [src:fandom/Loot_tables/Class_Pod] [src:fandom/Cobalt_Map] [src:balance/294] [H] |
| common / rare classless (fork) | — | classless gun tiers, Naginata Daemon, medical, throwables (rare: Level 3 Vest) | [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1324-1333] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1406-1417] [H] |

- Mythic pods always drop a perk that no class has; namu also lists Broken Arrow among the bunker's perks [src:fandom/Class_Pod] [src:namu/Surviv.io/이벤트] [M]

### Class gun tables

| class | common (pre-fork survev / fandom) | rare (pre-fork survev / fandom) | sources |
|---|---|---|---|
| scout | dual G18C 0.5, dual OT-38 0.5 | dual OTs-38 0.4, dual P30L 0.3, dual DEagle 0.3 | [src:derived/survev@121958d2:shared/defs/maps/baseDefs.ts:359-389] [src:fandom/Loot_tables/Class_Pod] [H] |
| sniper | BLR 81 0.85, Mosin 0.15 | Mosin 0.8, SV-98 0.1, AWM-S 0.1 | [src:derived/survev@121958d2:shared/defs/maps/baseDefs.ts:363-394] [src:fandom/Loot_tables/Class_Pod] [H] |
| healer | Mk 12 0.5, M39 0.5 | SVD-63 0.35, L86A2 0.35, Garand 0.3 | [src:derived/survev@121958d2:shared/defs/maps/baseDefs.ts:367-404] [src:fandom/Loot_tables/Class_Pod] [H] |
| demo | M870 0.75, SPAS-12 0.25 | MP220 0.4, Saiga-12 0.525, USAS-12 0.075 | [src:derived/survev@121958d2:shared/defs/maps/baseDefs.ts:371-399] [src:fandom/Loot_tables/Class_Pod] [H] |
| assault | HK416 0.35, AK-47 0.35, Groza 0.15, FAMAS 0.15 | SCAR-H 0.3, Groza-S 0.3, M4A1-S 0.3, AN-94 0.1 | [src:derived/survev@121958d2:shared/defs/maps/baseDefs.ts:375-410] [src:fandom/Loot_tables/Class_Pod] [H] |
| tank | DP-28 0.85, QBB-97 0.15 | QBB-97 0.85, PKP 0.1, M249 0.05 (fandom also lists M134, post-0.8.82) | [src:derived/survev@121958d2:shared/defs/maps/baseDefs.ts:381-415] [src:fandom/Loot_tables/Class_Pod] [M] |

- Fandom gives the gun lists only ("???" weights, "WIP"); the weights are survev's reconstruction [src:fandom/Loot_tables/Class_Pod] [src:derived/survev-git-121958d2] [M]
- Current survev tables (fork 2025-10 to 2026-05): scout common + dual M93R 1, DEagle 0.3; sniper common + Scout Elite; healer common + VSS; demo common SPAS-12 1, M870 1, MP220 0.5; assault common + SCAR-H 0.4; tank common + IMBEL 0.5, BAR 0.5, QBB-97 0.25; demo rare + SPAS-16, M1014; healer rare + Mk 20 SSR; tank rare QBB-97 1, PKP 0.1, M249 0.2 (fork) [src:survev/shared/defs/maps/baseDefs.ts:434-514] [src:balance/182-193] [src:balance/285-292] [src:balance/308-313] [H]

## Air drops

- Air drops are class shells: `class_shell_02` (rare) 10 : `class_shell_03` (mythic) 1; Main plane timings [src:survev/shared/defs/maps/cobaltDefs.ts:38-44] [src:fandom/Class_Pod] [H]
- Fandom schedule: air drop #1 at 0:55 of the circle 1 wait (dropped 0:41–0:35), air drop #2 at 0:38 of the circle 3 wait (dropped 0:24–0:18) — i.e. wait 10 and 2 s, matching Main [src:fandom/Cobalt_Map] [src:survev/shared/defs/maps/baseDefs.ts:68-80] [H]

## Twins Bunker

- Bunker 11 "the Twins" (`bunker_structure_09`): location spawn at the map centre (radius 50, retried) and an important spawn; fandom: always a little off the middle, near The Killpit [src:survev/shared/defs/maps/cobaltDefs.ts:109-118] [src:survev/shared/defs/maps/cobaltDefs.ts:188-192] [src:fandom/Twins_Bunker] [H]
- Four locked entrances (diamond layout); the main room has the Mythic class pod over the Twins logo under an air vent, vats, barrels, a computer terminal and recorder `log_14` ("Welcome to Bunker 11, the Twins … Parmaste, and … thank you") [src:fandom/Twins_Bunker] [src:survev/shared/defs/maps/cobaltDefs.ts:19-20] [M]
- v0.8.82 unlock: at 0:45 left in the third gas wait (circle 2) the four doors open together with four sky-blue lock pings and map-wide sounds; fandom's map schedule says 0:44, namu "45 seconds before the third safe zone shrinks" [src:fandom/Twins_Bunker] [src:fandom/Cobalt_Map] [src:namu/Surviv.io/이벤트] [H]
- survev unlocks are data-driven (`gameConfig.unlocks`): doors of the named building open one after another with a 0.2 s stagger; current setting circle 1 + 30 s ("30s after the first zone closure", fork v0.3.01); wiki.gg says it was "6s after the second zone closure" before that [src:survev/shared/defs/maps/cobaltDefs.ts:45-54] [src:survev/server/src/game/map.ts:439-500] [src:survev/client/public/changelogRec.html:210] [src:wikigg/Cobalt_mode] [H]
- survev history of that timing: circle 0 + 5 s (testing), circle 2 + 0 s, later circle 2 + 5 s, then circle 1 + 30 s [src:derived/survev-git-7eef4d94] [src:derived/survev-git-9946aa18] [src:derived/survev-git-a04c6e00] [M]
- The side rooms were inaccessible ceiling-only spaces in the original; the fork's v0.3.0 opened them as puzzle rooms with a Cobalt Case and an Augmenting Vat (Classless promotion), unlocked by 6 coloured switches in class order (fork) [src:fandom/Twins_Bunker] [src:wikigg/Twins_Bunker] [src:survev/client/public/changelogRec.html:219-220] [H]
- A bug let players enter before the doors opened until Kongregate fixed it (post-0.8.82) [src:fandom/Twins_Bunker] [M]

## Map

- Size and scale as Normal; seven rivers of widths 16, 14, 12, 10, 8, 6, 4 every game (survev comment: the only set seen in deserialized original map messages); no cabins [src:survev/shared/defs/maps/cobaltDefs.ts:84-92] [src:fandom/Cobalt_Map] [H]
- River masks: radius 100 at the map centre and two radius-100 masks generated on the shore [src:survev/shared/defs/maps/cobaltDefs.ts:93-106] [H]
- "The Cobalt Map has the most rivers" and many bridges [src:fandom/Cobalt_Map] [src:wikigg/Cobalt_mode] [M]
- Synthetic obstacles replace natural ones: tree_01→`tree_01cb` (175 HP), stone_01→`stone_01cb` (250 HP), bush_01→`bush_01cb`, bush_04→`bush_04cb`, stone_03→`stone_03cb`; synthetic caches `cache_01cb`, `cache_02cb` (mosin tree), `cache_04cb`, `cache_06cb`; chests `chest_01cb`, `chest_03cb` [src:survev/shared/defs/maps/cobaltDefs.ts:119-187] [src:kong/relaunch-client-defs] [src:changelog/0.8.8] [H]
- density: stone_01cb 350, barrel_01 76, silo_01 8, crate_01 50, crate_02 4, crate_03 8, bush_01cb 78, cache_06cb 12, tree_01cb 320, hedgehog_01 24, container_01–04 5 each, shack_01 7, outhouse_01 5, loot_tier_1 24, loot_tier_beach 4 [src:survev/shared/defs/maps/cobaltDefs.ts:119-140] [H]
- fixed: warehouse_01 2, house_red_01 3/4, house_red_02 3/4, barn_01 1/3, barn_02 1, hut_01 3, hut_02 1 (SPAS hut), hut_03 1 (Scout Hut), shack_03a 2, shack_03b 2/3, cache_01cb/02cb/04cb/07 1 each, bunker_structure_01 (odds 0.05), bunker_structure_02–05 1 each, warehouse_complex_01 1, chest_01cb 1, chest_03cb (odds 0.2), mil_crate_02 (odds 0.25), teahouse_complex_01cb 1/2, stone_04 1, club_complex_01 1, class_shell_01 45/55, cache_log_13 1 (recorder crate) [src:survev/shared/defs/maps/cobaltDefs.ts:141-178] [H]
- Random building rotation from Main (2 of mansion, police, bank) [src:survev/shared/defs/maps/baseDefs.ts:944-949] [src:fandom/Cobalt_Map] [H]
- Fandom specials: Bank, Police Station, Mansion, Hydra Bunker, Docks, Teahouse Complex, Crimson Ring Club, Twins Bunker; no Greenhouse [src:fandom/Cobalt_Map] [M]
- A beach crate cache holds recorder Log 13 [src:fandom/Cobalt_Map] [src:wikigg/Cobalt_mode] [src:survev/shared/defs/maps/cobaltDefs.ts:176] [H]
- Common class pod count in survev: 15 (first version), 40 (2025-04-21), 45 solo/duo / 55 squad (2026-05-10, fork v0.3.0 "slightly increased") [src:derived/survev-git-a8a082cd] [src:derived/survev-git-0b6cb06b] [src:survev/client/public/changelogRec.html:231] [src:wikigg/Class_Pod] [M]
- balance.txt describes the v0.3.0 change as "+5–15 class pods (30 → 35–45)" [src:balance/296] [L]

## Conflicts

- CONFLICT cobalt-twins-unlock: v0.8.82 doors open at about 0:45 left in the circle-2 wait (wait ≈ 5–6 s) [src:fandom/Twins_Bunker] [src:fandom/Cobalt_Map] [src:namu/Surviv.io/이벤트] vs fork circle 1 + 30 s [src:survev/shared/defs/maps/cobaltDefs.ts:45-54]; proposed: circle 2, wait 6 s [H]
- CONFLICT cobalt-pod-count: original count unknown; survev 45/55 [src:survev/shared/defs/maps/cobaltDefs.ts:172-175] vs balance.txt "30 → 35–45" [src:balance/296] vs survev git 40 before v0.3.0 [src:derived/survev-git-a8a082cd]; proposed: 40 (pre-v0.3.0 survev) as a config knob [L]
- CONFLICT cobalt-pod-loot: v0.8.82 pods (3 sodas scout, 6 MIRVs demo, no vest/bandages assault, med kit healer) [src:kong/relaunch-client-defs] [src:fandom/Class_Pod] vs fork pod changes [src:balance/293-307]; proposed: relaunch contents [H]
- CONFLICT cobalt-mythic-perks: Master Scavenger / Explosive Rounds / Splinter Rounds [src:fandom/Loot_tables/Class_Pod] [src:derived/survev-git-121958d2] vs namu adding Broken Arrow [src:namu/Surviv.io/이벤트] vs fork adding Indomitable Spirit [src:balance/294]; proposed: the three perks [M]
- CONFLICT cobalt-tank-common-pack: Small Pack (`backpack01`) [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1314-1323] vs Regular Pack [src:fandom/Class_Pod]; proposed: Small Pack (client def) [H]
- CONFLICT cobalt-class-guns: pre-fork class gun tables [src:derived/survev-git-121958d2] vs fork-extended tables with IMBEL, BAR, Scout Elite, VSS, Mk 20 SSR, SPAS-16, M1014 etc. [src:balance/182-193] [src:balance/285-292]; proposed: pre-fork tables (fork-only guns removed) [H]
- CONFLICT cobalt-role-timeout: 20 s on the client menu [src:survev/shared/gameConfig.ts:228] [src:fandom/Cobalt_Map] vs survev server fallback after 25 s [src:survev/server/src/game/objects/player.ts:231]; proposed: 20 s, assign the highlighted or a random class [M]

## Open questions

- Whether the original assigned a random class or the highlighted one when time ran out (fandom: random; wiki.gg: the selected one) [src:fandom/Cobalt_Map] [src:wikigg/Cobalt_mode] [L]
- How rare the mythic air drop was: survev uses weight 1 of 11 [src:survev/shared/defs/maps/cobaltDefs.ts:40-43] vs fandom "very rarely" [src:fandom/Class_Pod] [L]
- Exact v0.8.82 class gun weights (fandom shows "???") [src:fandom/Loot_tables/Class_Pod] [L]
