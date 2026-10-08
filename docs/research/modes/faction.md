# 50v50 (Faction) mode

> The 50v50 team mode on the Faction map (survev `faction`, mapId 3) and the fork-only Potato vs Tomato variant (`faction_potato`, mapId 10).
> Role gear, role perks and the promotion code are detailed in `items/roles.md`; River Town and other building layouts are in `maps/buildings.md`. This file covers what is specific to the mode: teams, map layout, schedules, air drops, air strikes and loot overrides.
> "pre-fork" = survev's first reconstruction of the faction def (commit `4b291f4d`, 2024-02-18), cited `derived/survev@4b291f4d:...`. Its values come from the original client and the survev authors' estimates; the fork changed several of them later.
> Countdown times on the fandom schedule are seconds left in a gas "wait" stage; they convert to survev `wait` values as stage length minus countdown (stage lengths 80, 65, 50, 40, 30, 25 s for circles 0–5).

## Identity

| field | value | sources |
|---|---|---|
| survev id / mapId | `faction`, `GameConfig.MapId.Faction` = 3 | [src:survev/shared/defs/mapDefs.ts:42-61] [src:survev/shared/gameConfig.ts:97-109] [H] |
| UI name / button | "50v50", icon `img/gui/star.svg`, CSS `btn-mode-faction`, button text "50v50", splash `img/splashes/faction.webp` (fork webp) | [src:survev/shared/defs/maps/factionDefs.ts:8-15] [src:kong/relaunch-client-defs] [H] |
| players | 100, two factions (`factionMode: true`, `factions: 2`), kill leader still enabled (inherited) | [src:survev/shared/defs/maps/factionDefs.ts:97-101] [src:survev/shared/defs/maps/baseDefs.ts:62-65] [src:kong/relaunch-client-defs] [H] |
| atlases | relaunch client: gradient, loadout, shared, faction; survev drops `gradient` (fork refactor 2026-08-17) | [src:kong/relaunch-client-defs] [src:survev/shared/defs/maps/factionDefs.ts:82] [src:derived/survev-git-137d28ad] [H] |
| Play button (ko) | "Play 50v50" = "50v50 플레이" | [src:survev/client/src/en.json:728] [src:l10n/ko:index-play-50v50] [H] |
| team names (ko) | Red Team 홍 팀, Blue Team 청 팀; Red Commander 홍팀 지휘관, Blue Commander 청팀 지휘관 | [src:survev/client/src/en.json:730-733] [src:l10n/ko:game-red-team] [src:l10n/ko:game-blue-leader] [H] |
| Korean wiki names | 50vs50 mode; River Town = 강 마을; air strike = 공습; military air drop = 군용 보급 | [src:namu/Surviv.io/이벤트] [M] |
| internal names | called the "Faction Map" internally; renamed in-game to "50v50 Map" in 0.7.9 (June 2019) | [src:fandom/50v50_Map] [src:fandom/Changelog] [M] |

## History (original surviv.io)

> The run list is in `modes/events.md`. Version entries below are the changes to the mode itself.

| version / date | change | sources |
|---|---|---|
| 0.7.0 "Incursion recursion", Jan 31, 2019 | mode added: air strikes, extra large bridge, military air drop, Initiative crate, faction statues, Super 90, AN-94, Machete Taiga, Tallow's Kukri; one Leader per side | [src:changelog/0.7.0] [src:fandom/Changelog] [H] |
| Feb 5, 2019 (secret) | faction loot tiers changed to unique items: Cobalt Shell in the Chrysanthemum Bunker, Key Lime in Tier Conch, The Professional in the Mansion; Water Elemental replaced by The Initiative in River Chests | [src:fandom/Changelog] [M] |
| 0.7.2 "Great clips", Mar 14, 2019 | Lieutenant role (two per side), Firepower perk, perk slot in HUD; Leader helmet becomes level 4; gold military drops now include 3 strobes | [src:changelog/0.7.2] [src:fandom/Changelog] [H] |
| 0.7.6 "Pills here", May 10, 2019 | Medic role, Mass Medicate | [src:changelog/0.7.6] [src:fandom/Changelog] [H] |
| 0.7.9, Jun 25, 2019 | per-mode stats (50v50 = `mapId=3`); "Faction Map" renamed "50v50 Map" | [src:changelog/0.7.9] [src:fandom/Changelog] [H] |
| 0.8.4 "One man army", Sep 18, 2019 | Marksman and Lone Survivr; only one Lieutenant per side; Leader renamed Commander; Level 4 Vest added; Blue Lieutenant gets Groza-S | [src:changelog/0.8.4] [src:fandom/Changelog] [H] |
| 0.8.71 "Full meal deal", Nov 5, 2019 | guns in 50v50 air drops come packaged with their ammo; Medic gets Revivify; two Lone Survivrs per side; loadout skins Target Practice and Discord Moderatr replaced with Basic Outfit | [src:changelog/0.8.71] [src:fandom/Changelog] [H] |
| 0.8.81 "Sound the charge", Dec 15, 2019 | Bugler, Grenadier, Recon; second promotion is one random pick of Lieutenant / Marksman / Grenadier / Recon | [src:changelog/0.8.81] [src:fandom/Changelog] [src:wikigg/50v50_mode] [H] |
| post-0.8.82 | daily Event Rotation slot (Wed and Sat in 0.9.2); "Ultimate Sacrifice" 50v50 events (May 2020, Jun 2021); re-release Oct 16, 2020 per namu | [src:fandom/Event_Rotation] [src:fandom/Changelog] [src:namu/Surviv.io/이벤트] [M] |

## Teams and match rules

- Players are drafted into the Red Army (team 1, `FactionTeam.Red`) or the Blue Group (team 2, `FactionTeam.Blue`); the news post calls them "Red Army" and "Blue Group" [src:survev/shared/gameConfig.ts:139-142] [src:fandom/Changelog] [H]
- Lore: Red is the Soviets/Russians, Blue is PARMA [src:fandom/50v50_Map] [src:fandom/Game_Modes] [M]
- The game creates one team per faction at start (`factions` = 2) [src:survev/server/src/game/game.ts:147-151] [H]
- A solo joiner always goes to the team with fewer living players; a joining group gets the smaller team too, and later members of an existing group join that group's team [src:survev/server/src/game/objects/player.ts:151-154] [src:survev/server/src/game/objects/player.ts:475-482] [src:survev/server/src/game/objects/player.ts:526-529] [H]
- Each faction is split into sub-squads of up to 4 (the queue's team size); regular pings only reach the sub-squad, while Commander pings reach the whole faction [src:wikigg/50v50_mode] [src:fandom/Changelog] [H]
- The whole faction is shown on the minimap, alive, knocked or dead; faction player-status updates are sent every 0.5 s instead of 0.25 s [src:wikigg/50v50_mode] [src:survev/shared/net/updateMsg.ts:726-731] [H]
- Enemies appear on your minimap for 1 s (`timeUntilHidden`) after they fire while an enemy is within that enemy's view distance (fork reconstruction) [src:survev/server/src/game/weaponManager.ts:1013-1024] [src:survev/server/src/game/objects/player.ts:3654] [M]
- The rebirth shows no such reveal: the owner, who played the original, says enemies are visible only while on screen; `rules.roles.factionRevealTime` defaults to 0 and 1 restores survev's reveal (`rebirth-deviations.md` "Owner's 50v50 feedback") [src:user/2026-10-08-faction-feedback] [H]
- Win condition: last faction with living players; the alive counter shows two numbers, one per faction [src:survev/server/src/game/gameModeManager.ts:128-131] [src:survev/server/src/game/gameModeManager.ts:145-150] [H]
- Game-over screen lists the player, both Commanders and (fork) a match MVP = most kills, ties broken by damage dealt [src:survev/server/src/game/gameModeManager.ts:230-249] [src:survev/server/src/game/gameModeManager.ts:253-276] [M]
- The rebirth lists the MVP too, with survev's badges (red star, blue star, the MVP's ribbon in its faction colour): the owner's screenshot of the original 50v50 win screen shows these four cards (`rebirth-deviations.md` "Owner's 50v50 feedback") [src:user/2026-10-08-faction-feedback] [src:survev/client/src/ui/ui.ts:1493-1522] [H]
- Grenades stopped damaging teammates in the same update that added 50v50 (0.7.0) [src:changelog/0.7.0] [H]
- Bleeding out escalates per knock: survev multiplies the 2 HP/s bleed by `downedCount × 1.25` (2.5, 5, 7.5 … HP per 1 s tick) only on maps with `bleedDamageMult` ≠ 1, i.e. Faction [src:survev/shared/defs/maps/factionDefs.ts:245-246] [src:survev/server/src/game/objects/player.ts:1614-1621] [src:survev/shared/gameConfig.ts:206] [H]
- Fandom only says you bleed out faster the more times you were downed; wiki.gg says each knock drains 25 % faster than the previous one [src:fandom/50v50_Map] [src:wikigg/50v50_mode] [M]
- A round always counted as "Top 5" for squad quests because there are only two teams [src:fandom/50v50_Map] [M]
- Outfits: loot tables avoid red or blue skins; Aquatic Avenger, Coral Guise and Casanova Silks cannot drop; from 0.8.71 loadout Target Practice and Discord Moderatr were replaced by Basic Outfit [src:fandom/50v50_Map] [src:fandom/Changelog] [src:wikigg/50v50_mode] [M]
- survev instead refuses to equip any outfit whose `teamId` is the other faction (team leader outfits), and has no loadout-skin block (gap) [src:survev/server/src/game/objects/player.ts:740-748] [H]
- Promoted players cannot pick up perks; role perks cannot be dropped or looted [src:fandom/Game_Modes] [src:fandom/50v50_Map] [M]
- Fireball outfit hid the team colours until fixed in 0.9.8 (post-0.8.82) [src:fandom/50v50_Map] [M]

## Map

### Size, biome, rivers, places

- Map size: base 512 × scale 1.5 + extension 112 = 880 × 880 units (55 × 55 grid cells), for every team size; normal maps are 720 (solo/duo) and 768 (squad) [src:survev/shared/defs/maps/factionDefs.ts:400-407] [src:fandom/50v50_Map] [src:fandom/Game_Modes] [H]
- shoreInset 48, grassInset 18 (same as Main) [src:survev/shared/defs/maps/factionDefs.ts:405-407] [src:wikigg/50v50_mode] [H]
- Rebirth: 1034 × 1034 (1.2 times per side) with 9 colour warehouses and 6 of each red house and barn instead of 6 / 4 / 4; the team crates' density gives about 17 per side, counting those inside buildings (`docs/research/rebirth-deviations.md` "Bigger maps") [src:user/2026-10-08-bigger-maps] [src:derived/rebirth-map-scale-density] [H]
- Biome colours: background 0x051624, water 0x071b36, water ripple 0xb3f0ff, beach 0x8e5632, riverbank 0x653313, grass 0x4e6128, underground 0x1b0d03, player submerge 0x123049, ghillie 0x4c6024 [src:survev/shared/defs/maps/factionDefs.ts:84-96] [src:kong/relaunch-client-defs] [src:fandom/50v50_Map] [H]
- Rivers: widths [20], [20, 4] or [20, 8, 4], each 1/3; smoothness 0.15 [src:survev/shared/defs/maps/factionDefs.ts:408-415] [src:wikigg/50v50_mode] [H]
- The map picks a random split orientation (`factionModeSplitOri` 0 = river runs left→right, red bottom / blue top; 1 = river runs top→bottom, red left / blue right); faction rivers run from the middle of one edge to the middle of the opposite edge [src:survev/server/src/game/map.ts:350-352] [src:survev/server/src/game/riverCreator.ts:20-42] [src:survev/server/src/game/map.ts:1474-1484] [H]
- survev treats every river as a faction river (doubled outside-point tolerance, 4× spline smoothing) [src:survev/server/src/game/map.ts:709-722] [src:survev/server/src/game/riverCreator.ts:156] [src:survev/server/src/game/riverCreator.ts:179] [H]
- Places: Riverside (0.51, 0.5), Pineapple (0.84, 0.18), Tarkhany (0.21, 0.79) [src:survev/shared/defs/maps/factionDefs.ts:417-424] [src:wikigg/50v50_mode] [H]
- No place-anchored building spawns (`placeSpawns` empty) and no location spawns [src:survev/shared/defs/maps/factionDefs.ts:430-433] [H]
- Bridges: `bridge_md_structure_01`, `bridge_lg_structure_01`, `bridge_xlg_structure_01` (extra large, added in 0.7.0) [src:survev/shared/defs/maps/factionDefs.ts:425-429] [src:changelog/0.7.0] [H]

### River Town, faction bridges and statues

- On the main river survev places `river_town_01` (Riverside) and two extra-large bridges at spline ranges t ∈ [0.45, 0.55] (main), [0.2, 0.3] and [0.7, 0.85]; River Town takes the centre slot if possible, else a side slot; if any fails, the whole map is regenerated (fork 0.2.3 "faction bridges will now always generate") [src:survev/server/src/game/map.ts:728-769] [src:survev/server/src/game/map.ts:866-881] [src:survev/client/public/changelogRec.html:256] [H]
- Pre-fork survev spawned `river_town_01` as a fixed spawn instead [src:derived/survev@4b291f4d:shared/defs/maps/factionDefs.ts] [M]
- Fandom: River Town is usually at the exact centre but sometimes near the top or bottom; the river has one River Chest, 2 extra-large bridges plus the town bridge, river stones and lily-pad bushes; 2 Fisherman's Shacks and 2–3 Cabins on the shore [src:fandom/50v50_Map] [src:fandom/River_Town] [M]
- River Town orientation: the town part (barn, Red House, dark Red House, sandbags) faces Red, the dock part (containers, 2 Blue Warehouses, 2 Green Shacks) faces Blue; survev forces `ori = splitOri ^ 1` for this [src:fandom/50v50_Map] [src:fandom/River_Town] [src:survev/server/src/game/map.ts:783-788] [H]
- survev `river_town_01` children: centre `bridge_xlg_structure_01`; west `barn_01`, `house_red_01`, `house_red_02`, `sandbags_02`, crates incl. a red `crate_02f`; east 2 × `warehouse_02`, 2 × `shack_02`, crates incl. a blue `crate_22`; `statue_structure_01` at x −50 and `statue_structure_02` at x +50 [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:6795-7139] [H]
- namu: the blue side has harbour-like green shacks, warehouses and containers, the red side three houses [src:namu/Surviv.io/이벤트] [M]
- Faction statues (0.7.0): one per side at the town bridge ends, Red (`statue_top_01`) and Blue (`statue_top_02`) Commander; base `statue_01` indestructible, top 500 HP, height 10, destroyable by frags, USAS-12 or long melee [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:854-881] [src:fandom/Faction_Statue] [src:kong/relaunch-client-defs] [H]
- Fork 0.2.3: statues can be hit by melee and were reshaped "to better match their corresponding role"; fork 0.2.0 updated their world images (fork) [src:survev/client/public/changelogRec.html:257-258] [src:survev/client/public/changelogRec.html:354] [H]
- survev adds a `goreRegion` to River Town for "kill at River Town" quests (fork) [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:6938] [src:kong/relaunch-client-defs] [M]

### Team sides

- Players spawn in the outermost tenth of their own half (division 0 for Red, 9 for Blue of 10 slices across the split) [src:survev/server/src/game/map.ts:2160-2172] [H]
- Fandom: each faction spawns on the sixth of the map farthest from the centre [src:fandom/50v50_Map] [M]
- Buildings with `teamId` go to the outermost slice of that team: `bank_01` and `mansion_structure_01` on Red, `police_01`, `warehouse_complex_01` (Docks) and fork `shilo_01` on Blue [src:survev/server/src/game/map.ts:1564-1620] [src:fandom/50v50_Map] [H]
- `warehouse_01f`, `house_red_01`, `house_red_02` and `barn_01` go to the outermost slice of a random side; `greenhouse_01` and `bunker_structure_03` (Storm Bunker) to the inner eight slices [src:survev/server/src/game/map.ts:1567-1590] [H]
- Fandom per side: 3 warehouses in the team colour, 2 barns, 3 Red Houses (each may be the darker Second Red House) [src:fandom/50v50_Map] [M]
- Team crates: red Soviet `crate_02f` and blue Initiative `crate_22` (140 HP, loot 3 × tier_guns + 2 × tier_armor + 1 × tier_packs), density 5 each ≈ 12 per side on the 880 map; fandom/wiki.gg count 11 per side plus one each in River Town [src:survev/shared/defs/maps/factionDefs.ts:440-441] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:418-432] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:978-994] [src:fandom/50v50_Map] [src:wikigg/Faction_Crates] [H]
- Density counts scale by shore area / 250 000 (≈ 784² ≈ 614 656 on Faction, ×2.46) [src:survev/server/src/game/map.ts:1127-1129] [src:derived/faction-density-880] [M]
- Fork: team crates pre-load their guns (0.1.2) and keep 32 units from each other (0.4.1); the relaunch crates have neither [src:survev/client/public/changelogRec.html:437] [src:survev/client/public/changelogRec.html:84] [src:kong/relaunch-client-defs] [H]
- Middle ground: almost no structures except the Greenhouse, Egg Bunker and Storm Bunker; most air strikes and fights happen there [src:fandom/50v50_Map] [M]
- Fandom (2019-20, the original game) already has the team crates on their own side: 11 Soviet crates on the red side, 11 Initiative crates on the blue side [src:fandom/50v50_Map] [src:wikigg/Faction_Crates] [M]
- In the game (survev content wave, 50v50 stage): the port gives the original map objects survev's `teamId` and `terrain` (policy `survevMapGen`), so `crate_02f` / `crate_22` spawn in their team's outermost tenth 32 units apart and `shilo_01` on Blue, as survev places them [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:418-432] [src:survev/server/src/game/map.ts:1424-1438] [src:survev/server/src/game/map.ts:1564-1620] [H]
- Beach: 5 huts (one gold, one Scout Hut), 3 Fisherman's Shacks, Conch Bunker, containers, hedgehogs, crates, one Treasure Chest; Docks always on the blue half [src:fandom/50v50_Map] [M]

### Spawn tables (survev)

| kind | entries | sources |
|---|---|---|
| density | stone_01 350, barrel_01 76, silo_01 8, crate_01 38, crate_02f 5, crate_22 5, crate_03 8, bush_01 78, tree_08f 320, hedgehog_01 24, container_01–04 5 each, shack_01 7, outhouse_01 5, loot_tier_1 24, loot_tier_beach 4 | [src:survev/shared/defs/maps/factionDefs.ts:434-455] [H] |
| fixed | warehouse_01f 6, house_red_01 4, house_red_02 4, barn_01 4, bank_01 1, police_01 1, hut_01 4, hut_02 1, shack_03a 2, shack_03b 3, greenhouse_01 1, cache_01f/02f/07f 1 each, mansion_structure_01 1, bunker_structure_01 (odds 1), bunker_structure_03 1, bunker_structure_04 1, warehouse_complex_01 1, chest_01 1, chest_03f 1, mil_crate_02 (odds 1), tree_02 3 | [src:survev/shared/defs/maps/factionDefs.ts:456-482] [H] |
| replacements | bush_01→bush_01f, crate_02→crate_01, stone_01→stone_01f, stone_03→stone_03f, tree_01→tree_08f | [src:survev/shared/defs/maps/factionDefs.ts:484-492] [H] |
| important | river_town_01, police_01, bank_01, mansion_structure_01, warehouse_complex_01 | [src:survev/shared/defs/maps/factionDefs.ts:493-499] [H] |

- Fandom structure list: Bank, Mansion, Police Station, Docks, River Town, Shack, Green Shack, Warehouse, Blue Warehouse, Barn, Cabin, Outhouse, Red House, Containers, Greenhouse, bridges; bunkers Egg, Storm, Chrysanthemum, Conch; caches Tree, Stone, Barrel, Berry Bush [src:fandom/50v50_Map] [M]
- Pre-fork caches were the standard `cache_01`, `cache_02`, `cache_07`; the fork's faction caches drop more (tree cache + 4x scope + level 2 helmet; stone cache level 2 vest/helmet, 5 bandages, 2x scope, 1 tier_surviv; barrel cache 4 MIRV + 6 frags + level 2 vest) (fork) [src:derived/survev@4b291f4d:shared/defs/maps/factionDefs.ts] [src:balance/158-165] [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:484-493] [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:953-963] [H]

## Role schedule

> Full role kits: `items/roles.md`. Times are seconds after gas circle 0 (the 80 s first wait) starts.

| slot | v0.8.82 (fandom countdown → wait) | survev pre-fork (2024-09) | survev fork (since v0.0.18, 2025-01-21) | sources |
|---|---|---|---|---|
| Commander (`leader`) | 0:29 left → 50 s | 50 s | 50 s | [src:fandom/50v50_Map] [src:derived/survev-git-42f052d8] [src:survev/shared/defs/maps/factionDefs.ts:196-200] [H] |
| second role | 0:25 → 54 s: one random of Lieutenant / Marksman / Grenadier / Recon | 54 s, same random pick | Lieutenant 54, Marksman 58, Recon 62, Grenadier 66 (all four) | [src:fandom/50v50_Map] [src:fandom/Game_Modes] [src:derived/survev-git-4a45bce2] [src:survev/shared/defs/maps/factionDefs.ts:201-231] [H] |
| Medic | 0:21 → 58 s | 58 s | 70 s | [src:fandom/50v50_Map] [src:derived/survev-git-42f052d8] [src:survev/shared/defs/maps/factionDefs.ts:232-236] [H] |
| Bugler | 0:17 → 62 s | 62 s | 74 s | [src:fandom/50v50_Map] [src:derived/survev-git-42f052d8] [src:survev/shared/defs/maps/factionDefs.ts:237-241] [H] |

- Each scheduled role goes to one random eligible player per team (alive, connected, not downed, no role) [src:survev/server/src/game/objects/player.ts:321-375] [H]
- The relaunch client def has the assign sounds `lt_assigned_01`, `medic_assigned_01`, `marksman_assigned_01`, `recon_assigned_01`, `grenadier_assigned_01`, `bugler_assigned_01`, `last_man_assigned_01`, `ping_leader_01` and `bugle_01`–`03`; survev adds `captain_assigned_01` (fork Captain) [src:kong/relaunch-client-defs] [src:survev/shared/defs/maps/factionDefs.ts:16-81] [src:derived/survev-git-e128e232] [H]
- Lone Survivr: the last 2 non-downed, connected players of a team (2 since 0.8.71), checked on every knock or kill once joins are closed [src:survev/server/src/game/group.ts:144-158] [src:survev/server/src/game/objects/player.ts:2826-2830] [src:changelog/0.8.71] [H]
- Fork Captain: the Lieutenant is promoted when the team's Commander is gone (fork v0.1.2) [src:survev/server/src/game/group.ts:160-175] [src:survev/client/public/changelogRec.html:431] [H]
- Promotion refills the held weapon's magazine instantly (fandom trivia) [src:fandom/50v50_Map] [M]
- namu lists seven roles per team (Commander, Lieutenant, Marksman, Grenadier, Recon, Medic, Bugler), describing the fork-era all-roles schedule [src:namu/Surviv.io/이벤트] [L]

## Air drops and air strikes

### Plane schedule

| circle (wait length) | v0.8.82 per fandom | survev pre-fork | survev fork | sources |
|---|---|---|---|---|
| 1 (65 s) | air strike #1 at 0:55 → wait 10 | strike, wait 10, 3/4/5 planes weights 5/1/0.1, zone radius 60 | same | [src:fandom/50v50_Map] [src:survev/shared/defs/maps/factionDefs.ts:106-120] [H] |
| 2 (50 s) | military air drop #1 at 0:44 → wait 6; strike #2 at 0:26 → wait 24 | drop wait 6; strike wait 24, weights 4/1/0.1, radius 55 | strike moved to wait 30 (2024-09-22) | [src:fandom/50v50_Map] [src:derived/survev-git-42f052d8] [src:survev/shared/defs/maps/factionDefs.ts:121-140] [H] |
| 3 (40 s) | strike #3 at 0:32 → wait 8 | strike wait 8, weights 3/1/0.1, radius 50 | same | [src:fandom/50v50_Map] [src:survev/shared/defs/maps/factionDefs.ts:141-155] [H] |
| 4 (30 s) | drop #2 at 0:27 → wait 3; strike #4 at 0:12 → wait 18 | drop wait 3; strike wait 18, weights 2/1/0.1, radius 45 | strike moved to wait 21 | [src:fandom/50v50_Map] [src:derived/survev-git-42f052d8] [src:survev/shared/defs/maps/factionDefs.ts:156-175] [H] |
| 5 (25 s) | strike #5 at 0:19 → wait 6 | strike wait 6, weights 1/1/0.1, radius 40 | same | [src:fandom/50v50_Map] [src:survev/shared/defs/maps/factionDefs.ts:176-190] [H] |

- Every scheduled air strike: 1.5 s before the first plane, 1 s between planes [src:survev/shared/defs/maps/factionDefs.ts:116-118] [H]
- Scheduled drops are always the normal military crate `airdrop_crate_03` (weight 1); flare-gun drops can only be normal military drops [src:survev/shared/defs/maps/factionDefs.ts:192] [src:fandom/50v50_Map] [H]
- Air-strike zones are centred on the densest player cluster (first player whose radius covers more than 1/3 of the living players, else the best found, else the safe-zone centre), ±3 units [src:survev/server/src/game/objects/plane.ts:128-163] [src:fandom/Air_Strike] [H]
- Each plane drops a line of 20 iron bombs (offset 2, jitter 4); half of the bomb lines are aimed at a random above-ground player inside the zone [src:survev/shared/gameConfig.ts:293-305] [src:survev/server/src/game/objects/plane.ts:520-560] [src:fandom/Air_Strike] [H]
- Fandom: natural air strikes use 2 to 5 jets, show a large yellow circle with a bomb ping on the minimap, and nobody gets kill credit; the kill feed reads "The air strike killed <name>" [src:fandom/Air_Strike] [M]
- wiki.gg: usually 3 bombers, rarely 4 or 5 [src:wikigg/50v50_mode] [M]
- The Commander's flare gun calls one extra military drop (the fork fires it automatically after 15 s) [src:fandom/Game_Modes] [src:survev/server/src/game/objects/player.ts:1478-1494] [src:survev/client/public/changelogRec.html:436] [H]

### Military air drop contents

- `airdrop_crate_03` / `airdrop_crate_04`: 8 × 8 collision (normal drops 5 × 5), reflects bullets, opened like a normal drop; fandom gives 500 HP [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:1034-1047] [src:fandom/Military_Air_Drop] [H]
- Normal military crate `crate_12` (500 HP), v0.8.82: 2 × tier_airdrop_rare + 4–6 × tier_airdrop_uncommon (guns pre-loaded since 0.8.71), 4–5 × tier_airdrop_armor, 12–15 × tier_medical, 6–8 × tier_airdrop_scopes, 3–4 × tier_airdrop_outfits, 5–7 × tier_airdrop_melee, 10–12 × tier_airdrop_ammo, 6–8 × tier_airdrop_throwables, 1 × tier_katanas [src:kong/relaunch-client-defs] [src:changelog/0.8.71] [H]
- Gold military crate `crate_13` (200 HP), v0.8.82: 3–4 × tier_airdrop_mythic + 3–4 × tier_airdrop_rare (pre-loaded), 6–8 armor, 12–15 medical, 6–8 scopes, 1–2 × tier_airdrop_faction_outfits (Ghillie Suit), 3–4 × tier_airdrop_faction_melee (pan), 10–12 ammo, 6–8 throwables, 1 × tier_katanas, 3 strobes [src:kong/relaunch-client-defs] [src:survev/shared/defs/maps/baseDefs.ts:744-745] [src:fandom/Changelog] [H]
- Fork 0.2.3 airdrop overhaul: normal uncommon 7–8, armor 5–6, scopes 7–8, melee 6–7, no katana roll; gold rare 5, faction melee 3, plus 2–3 × tier_airdrop_melee, no katana roll (fork) [src:balance/263-274] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:741-766] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:813-842] [H]
- Fandom: the gold military drop follows its own schedule, at the same time every match; its exact time is unknown (roughly 0:02 into some shrink) [src:fandom/50v50_Map] [L]
- wiki.gg (fork): one guaranteed gold military drop lands mid-game far from player activity; gold drops cannot be called by flare guns [src:wikigg/50v50_mode] [M]
- Fork "special airdrop" (`helpLosingTeam`, added v0.0.17, reworked v0.0.19): after circle 0, on a kill, if the alive gap is ≥ 10 % of all living players or ≥ 5, once per match a gold `airdrop_crate_04` lands within 5 units of the losing team's player farthest from the winners' centroid (not in the gas), and a 5-plane, radius-50 air strike hits the densest cluster (fork) [src:survev/server/src/game/objects/plane.ts:212-299] [src:survev/server/src/game/objects/player.ts:2831-2834] [src:survev/client/public/changelogRec.html:519] [src:survev/client/public/changelogRec.html:497] [H]

## Loot overrides (survev `faction`)

| table | entries (weight) | sources |
|---|---|---|
| tier_guns | famas 0.9, hk416 4, mk12 0.1, pkp 0.005, m249 0.006, ak47 2.7, scar 0.01, dp28 0.5, bar 0.05 (fork), mosin 0.05 (pre-fork 0.1), m39 0.1, mp5 10, mac10 6, ump9 3, m870 9, m1100 6, mp220 2, saiga 0.1, ot38 8, m9 19, m93r 5, glock 7, deagle 0.05, vector 0.01, sv98 0.01, spas12 1, qbb97 0.01, flare_gun 0.1 (pre-fork 0.01), groza 0.8, scout_elite 0.1 (pre-fork 0.05), vss 0.1 (fork, "?") | [src:survev/shared/defs/maps/factionDefs.ts:249-281] [src:derived/survev@4b291f4d:shared/defs/maps/factionDefs.ts] [H] |
| tier_toilet | tier_guns 0.1, tier_scopes 0.05, tier_medical 0.6, tier_throwables 0.05, tier_faction_outfits 0.025 | [src:survev/shared/defs/maps/factionDefs.ts:282-296] [H] |
| tier_container | tier_guns 0.29, ammo 0.04, scopes 0.15, armor 0.1, medical 0.17, throwables 0.05, packs 0.09, tier_faction_outfits 0.035 | [src:survev/shared/defs/maps/factionDefs.ts:297-318] [H] |
| tier_faction_outfits | Poncho Verde, Woodland, Key Lime, Forest Camo (1 each) | [src:survev/shared/defs/maps/baseDefs.ts:738-743] [H] |
| tier_medical | bandage ×5 16, healthkit 4, soda 15, painkiller 5, frag 2 | [src:survev/shared/defs/maps/factionDefs.ts:319-325] [H] |
| tier_airdrop_uncommon | pre-fork: mk12 2.5, scar 0.75, mosin 2.5, m39 2.5, saiga 1, deagle 1, vector 1, sv98 0.5, qbb97 1.5, m9 0.01, scout 1.5; fork: vector 2, vss 2, m39 2, mk12 2, saiga 2, scout_elite 2, bar 2, scar 1.5, mosin 1, qbb97 1, deagle 1, ots38_dual 1, garand 0.5, sv98 0.5, m9 0.01 | [src:derived/survev@4b291f4d:shared/defs/maps/factionDefs.ts] [src:survev/shared/defs/maps/factionDefs.ts:326-342] [src:balance/282-283] [H] |
| tier_airdrop_rare (fork) | scorpion 3, m4a1 3, grozas 3, awc 2.25, garand 2, ots38_dual 2, spas16 2, sv98 2, barrett 0.5, ash12 0.5, p30l_dual 0.3, deagle_dual 0.3, pkp 0.1, m249 0.1 (pre-fork used the Main table) | [src:survev/shared/defs/maps/factionDefs.ts:343-358] [src:balance/280-281] [src:balance/329] [H] |
| tier_airdrop_melee (fork) | none 2, tier_katanas 3, naginata 1, fireaxe 1, sledgehammer 1, pan 0.5 | [src:survev/shared/defs/maps/factionDefs.ts:359-366] [src:balance/278-279] [H] |
| tier_airdrop_outfits | none 25, Heaven 1, Ghillie 0.5 (pre-fork Incursion/Dark Ghillie) | [src:survev/shared/defs/maps/factionDefs.ts:367-375] [src:derived/survev@4b291f4d:shared/defs/maps/factionDefs.ts] [H] |
| tier_airdrop_scopes (fork 0.2.31) | none 12, 4x 5, 8x 1, 15x 0.01 | [src:survev/shared/defs/maps/factionDefs.ts:376-381] [src:survev/client/public/changelogRec.html:249] [H] |
| tier_ammo_crate | 9mm 60, 7.62 60, 5.56 60, 12 gauge 10 (weight 3 each), .50 AE 21, .308 5 (weight 1) — no .45 ACP | [src:survev/shared/defs/maps/factionDefs.ts:382-389] [H] |
| single-item tiers | tier_mansion_floor Forest Camo, tier_conch Key Lime, tier_chrys_01 Carbon Fiber | [src:survev/shared/defs/maps/factionDefs.ts:390-398] [H] |
| tier_airdrop_mythic (shared) | usas 1, scarssr 1, sv98 1 (fork), p30l_dual 1, pkp 1, m249 1, barrett 1 (fork), awc 0.75; fork raised USAS 0.5→1, AWM-S 0.1→0.75, PKP/M249 0.3→1 | [src:survev/shared/defs/maps/baseDefs.ts:627-636] [src:balance/276-277] [src:balance/330] [H] |

- Fandom: rare guns are easier to get on this map through military drops, role promotions, caches and bunker crates [src:fandom/50v50_Map] [M]

## Fork-only changes to 50v50 (summary)

- Captain role (v0.1.2), automatic Commander flare (v0.1.2), healing items on promotion (v0.1.2/v0.1.22), Lone Survivr immune to potato swap (v0.2.31) and faction-wide pings (v0.3.03), AFK filter for promotions (v0.3.1) (fork) [src:survev/client/public/changelogRec.html:431-443] [src:survev/client/public/changelogRec.html:417] [src:survev/client/public/changelogRec.html:248] [src:survev/client/public/changelogRec.html:188] [src:survev/client/public/changelogRec.html:168] [H]
- Barrett M107 and ASh-12 in faction drops (v0.4.0), BAR M1918 in faction loot (v0.1.2) (fork) [src:survev/client/public/changelogRec.html:105] [src:survev/client/public/changelogRec.html:434] [H]
- Fork 0.4.1 fixed air strikes over River Town not dropping bombs (fork) [src:survev/client/public/changelogRec.html:80] [H]

## Potato vs Tomato (`faction_potato`, fork)

> Fork-only hybrid of 50v50 and Potato mode, first released in fork v0.2.3 (April 1, 2026). Potato rules (weapon swap, obstacles) are in `modes/potato.md`.

- Added in fork v0.2.3 "Potato vs. Tomato" (Apr 1, 2026) with the PMG-134 (`potato_lmg`) and the Tomato obstacle and throwable (fork) [src:survev/client/public/changelogRec.html:252-254] [src:wikigg/50v50_mode] [src:derived/survev-git-2255ceef] [H]
- Own `MapId.FactionPotato` = 10 since 2026-09-08; name "Potato vs Tomato", button text "50v50", CSS `btn-mode-faction-potato`, star icon; merges the Faction def (fork) [src:survev/shared/defs/maps/factionPotatoDefs.ts:8-15] [src:survev/shared/defs/maps/factionPotatoDefs.ts:385] [src:derived/survev-git-b82a315b] [H]
- 100 players, `factionMode` + `potatoMode`; camera particle `falling_pvt`; extra atlas `potato`; sounds for tomato breaks (fork) [src:survev/shared/defs/maps/factionPotatoDefs.ts:16-99] [H]
- Blue = potatoes, Red = tomatoes: `potato_01f`–`03f` (teamId 2) and `tomato_01`–`03` (teamId 1), 40 each, spawn anywhere on their own half (slices 0–4 Red, 5–9 Blue) (fork) [src:survev/shared/defs/maps/factionPotatoDefs.ts:316-344] [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:688-724] [src:survev/server/src/game/map.ts:1575-1600] [H]
- Tomatoes behave like potatoes (100 HP, swap on break, regrow 60 s, tier_potato_perks loot) but cannot spawn on river shores (fork) [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:145-178] [H]
- Silo Shack (`shilo_01`, teamId 2) spawns on the blue side and is an important spawn (fork) [src:survev/shared/defs/maps/factionPotatoDefs.ts:361] [src:survev/shared/defs/maps/factionPotatoDefs.ts:373-380] [src:wikigg/50v50_mode] [H]
- Emote wheel locked: Red players always emote `emote_tomato`, Blue `emote_potato` (ping requests unaffected) (fork) [src:survev/server/src/game/objects/player.ts:4629-4635] [src:wikigg/50v50_mode] [H]
- The Tomato throwable is only in the swap pool on faction maps (fork 0.3.13 fix) [src:survev/server/src/game/objects/player.ts:4065] [src:survev/client/public/changelogRec.html:129] [H]
- Role overrides: Lieutenant Red M4A1-S 80 % / Spud Gun 20 %, Blue Groza-S 80 % / Spud Gun 20 % (40 rounds); Grenadier Saiga-12 80 % / Potato Cannon 20 %, katana, 8 MIRVs; Lone Survivr M249 30 % / PKP 30 % / PMG-134 40 %, 8 MIRVs (fork) [src:survev/shared/defs/maps/factionPotatoDefs.ts:108-227] [src:wikigg/50v50_mode] [H]
- The Grenadier's override calls `util.weightedRandom` once when the def module loads, so one server process gives every Grenadier the same gun (survev bug) (fork) [src:survev/shared/defs/maps/factionPotatoDefs.ts:153-169] [src:derived/factionpotato-grenadier-roll] [M]
- Air drops: normal military `airdrop_crate_03po` (→ `crate_12po`, same loot as `crate_12`) weight 1110 vs troll `airdrop_crate_03dev` weight 1 (1/1111, was 1/111 before fork v0.4.0) (fork) [src:survev/shared/defs/maps/factionPotatoDefs.ts:101-107] [src:balance/331] [src:survev/client/public/changelogRec.html:106] [H]
- Troll crate `crate_12dev` (1100 HP): 20 × tier_dev_guns (M1100 11, M9 9, M1911 3, Garand 1, M9 Cursed 0.1), 6–7 × tier_dev_melee (8 knife skins), 100 snowballs, 1 bandage, 1 smoke (fork) [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:793-812] [src:survev/shared/defs/maps/baseDefs.ts:781-797] [src:wikigg/50v50_mode] [H]
- The special gold drop is `airdrop_crate_04po` → `crate_13po` = `crate_13` plus 2 × tier_airdrop_potato (one of the three potato guns each) (fork) [src:survev/server/src/game/objects/plane.ts:273-278] [src:survev/shared/defs/mapObjects/obstacles/crateDefs.ts:843-870] [src:survev/shared/defs/maps/baseDefs.ts:776-780] [H]
- In the rebirth both gold drops of a potato faction map (the scheduled one and the comeback drop) are `airdrop_crate_04po`; no map def names it, so the port takes it as a server-spawned object (`tools/port-survev/policy.json` survevServerMapObjects; `rules.roles.potatoGoldCrate`) [src:survev/server/src/game/objects/plane.ts:273-278] [H]
- Loot: tier_throwables frag ×2 1, smoke 1, MIRV ×2 0.1, potato ×10 1, tomato ×10 1; .45 ACP in ammo tables; K-pot-ato (`helmet03_potato`) 0.1 in tier_armor, tier_police and tier_airdrop_armor; tier_airdrop_rare adds tier_airdrop_potato 2.25; airdrop throwables add potato ×30 and tomato ×30 (fork) [src:survev/shared/defs/maps/factionPotatoDefs.ts:229-315] [H]
- Fork 0.2.31: tomato speed and range reduced; PMG-134 and Spud Gun no longer hit teammates; more scopes in military drops (fork) [src:survev/client/public/changelogRec.html:238-249] [H]
- Every player can hold one droppable perk from potatoes; the Lone Survivr (4 role perks) drops it on promotion (fork) [src:wikigg/50v50_mode] [M]

## Conflicts

- CONFLICT faction-second-role: v0.8.82 promotes one random of Lieutenant/Marksman/Grenadier/Recon at 54 s, Medic at 58 s and Bugler at 62 s [src:fandom/50v50_Map] [src:derived/survev-git-42f052d8] vs fork promoting all four (54–66 s) and moving Medic/Bugler to 70/74 s [src:survev/shared/defs/maps/factionDefs.ts:194-242]; proposed: v0.8.82 schedule, fork schedule as a config flag [H]
- CONFLICT faction-airstrike-timing: strikes #2 and #4 at wait 24 and 18 s [src:fandom/50v50_Map] [src:derived/survev-git-42f052d8] vs fork 30 and 21 s [src:survev/shared/defs/maps/factionDefs.ts:127-163]; proposed: 24 / 18 s [H]
- CONFLICT faction-gold-drop-timing: v0.8.82 gold military drop "on its own schedule, same time each match" (time unknown) [src:fandom/50v50_Map] vs fork comeback drop triggered by alive-count imbalance [src:survev/server/src/game/objects/plane.ts:212-231]; proposed: a scheduled gold drop as config knob (default: during a mid-game circle), fork trigger as a flag [L]
- CONFLICT faction-military-crate-counts: v0.8.82 `crate_12` uncommon 4–6 / armor 4–5 / scopes 6–8 / melee 5–7 + katana and `crate_13` rare 3–4 / faction melee 3–4 + katana [src:kong/relaunch-client-defs] vs fork 7–8 / 5–6 / 7–8 / 6–7 and rare 5 / melee 3 + 2–3 airdrop melee [src:balance/263-274]; proposed: relaunch values [H]
- CONFLICT faction-unique-outfits: Feb 2019 secret update put Cobalt Shell in the Chrysanthemum Bunker and The Professional in the Mansion [src:fandom/Changelog] vs survev Carbon Fiber (`tier_chrys_01`) and Forest Camo (`tier_mansion_floor`) [src:survev/shared/defs/maps/factionDefs.ts:390-398]; proposed: keep survev (later state unknown), log for verification [L]
- CONFLICT faction-team-crate-count: about 12 per side from density 5 on the 880 map [src:survev/shared/defs/maps/factionDefs.ts:440-441] [src:derived/faction-density-880] vs 11 per side [src:fandom/50v50_Map] [src:wikigg/Faction_Crates]; proposed: keep density 5 (rounding gives 11–12) [M]
- CONFLICT faction-bleed-escalation: 2 × downedCount × 1.25 HP per tick [src:survev/server/src/game/objects/player.ts:1614-1621] vs "25 % faster than the previous time" [src:wikigg/50v50_mode]; proposed: survev formula, exposed as a knob [M]
- CONFLICT faction-spawn-band: players spawn in the outermost tenth of their half [src:survev/server/src/game/map.ts:2160-2172] vs "the sixth farthest from the center" [src:fandom/50v50_Map]; proposed: survev tenth [M]
- CONFLICT faction-airdrop-crate-hp: military air drop listed with 500 HP [src:fandom/Military_Air_Drop] vs 200 HP in the original obstacle def (the 500 HP is the inner `crate_12`) [src:kong/relaunch-client-defs]; proposed: 200 HP shell, 500 HP crate [M]

## Open questions

- Exact time of the v0.8.82 scheduled gold military drop (fandom marks it unknown) [src:fandom/50v50_Map] [L]
- Whether v0.8.82 revealed firing enemies on the minimap the way survev's 1 s `timeUntilHidden` does; wiki.gg only says teammates can see if allies are in a fight [src:survev/server/src/game/weaponManager.ts:1013-1024] [src:wikigg/50v50_mode] [L]
- resolved for the rebirth by the owner (2026-10-08), who played the original: no reveal, enemies show only on screen; `rules.roles.factionRevealTime` 0 by default, the knob stays (open-questions.md `faction-minimap-reveal`) [src:user/2026-10-08-faction-feedback] [H]
- The fork v0.0.18 note "normal crates increased from 38 to 55" does not match survev's current `crate_01: 38`; which value the fork actually uses over time is unclear [src:survev/client/public/changelogRec.html:508] [src:survev/shared/defs/maps/factionDefs.ts:439] [L]
- Original 50v50 loot weights for `tier_guns` / `tier_airdrop_uncommon` are only known from survev's pre-fork reconstruction (marked estimates in places) [src:derived/survev@4b291f4d:shared/defs/maps/factionDefs.ts] [L]
