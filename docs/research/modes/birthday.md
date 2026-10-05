# Birthday mode (fork)

> survev's "Birthday" map (`birthday`, mapId 8) is a fork-only mode added for the game's anniversary in October 2025. It recreates the look of surviv.io's early access (October–November 2017): no ocean, no rivers, no buildings, only trees, stones, crates, barrels and silos. The original game never had a "Birthday" map, so everything here is tagged (fork).
> The original anniversary events were Halloween (1st, Oct 2018) and a potato week (2nd, Oct 2019); see `modes/halloween.md`, `modes/potato.md`.

## Identity and history

- Added in fork v0.1.3 (October 21, 2025): "New mode: Birthday"; first commit 2025-10-06 (fork) [src:survev/client/public/changelogRec.html:385-386] [src:derived/survev-git-1b2c8cb3] [H]
- wiki.gg: "Straight reproduction of Surviv.io early access … one of first versions of Classic mode (in the first version crates were decorative)" (fork) [src:wikigg/Birthday_mode] [M]
- `MapId.Birthday` = 8; name "Birthday", icon `img/gui/birthday.svg` (first a cupcake emote), CSS `btn-mode-birthday`; atlases loadout, shared, main; no extra sounds (fork) [src:survev/shared/defs/maps/birthdayDefs.ts:7-17] [src:survev/shared/gameConfig.ts:97-109] [src:derived/survev-git-409f1a18] [H]
- 80 players, kill leader enabled; merges the Main def (fork) [src:survev/shared/defs/maps/birthdayDefs.ts:40-43] [src:survev/shared/defs/maps/birthdayDefs.ts:187] [H]
- The relaunch (v0.8.82) client defines map ids 0–7 only; there is no Birthday map in the original [src:kong/relaunch-client-defs] [H]
- The game's birthday: first early-access release Oct 11, 2017 (0.0.2); surviv.io "debuted late on Oct. 31, 2017" per the first-anniversary post; Wikipedia: released October 2017 [src:changelog/0.0.2] [src:fandom/Changelog] [src:wp-en/Surviv.io] [H]

## Early-access content it imitates

| version / date | change | sources |
|---|---|---|
| 0.0.2, Oct 11, 2017 | first early-access release | [src:changelog/0.0.2] [H] |
| 0.0.3, Oct 22, 2017 | armour and skins drop from dead players; scope loot shows the zoom level | [src:changelog/0.0.3] [H] |
| 0.0.5, Nov 1, 2017 | buffed ak47, mp5, m9; shotguns (m870, saiga) weaker; more loot and ammo | [src:changelog/0.0.5] [H] |
| 0.0.8, Nov 5, 2017 | metal barrels and silos added | [src:changelog/0.0.8] [H] |
| 0.0.9, Nov 7, 2017 | crates drop loot on destruction (before: decorative); rare military crate added | [src:changelog/0.0.9] [src:fandom/Changelog] [H] |
| 0.1.3, Nov 24, 2017 | bushes added | [src:changelog/0.1.3] [H] |
| 0.1.5, Dec 6, 2017 | first buildings: warehouse and container | [src:changelog/0.1.5] [H] |
| 0.1.7, Dec 19, 2017 | barrels start exploding | [src:changelog/0.1.7] [H] |
| 0.2.0, Jan 17, 2018 | duos; map size increased; Key Lime and Cobalt Shell skins | [src:changelog/0.2.0] [H] |
| 0.2.2, Jan 23, 2018 | ocean added to the map border; hedgehog; treasure chest | [src:changelog/0.2.2] [H] |
| 0.6.0, Sep 7, 2018 | rivers added | [src:changelog/0.6.0] [H] |

## Map (survev `birthday`, fork)

- No ocean: shoreInset −1 and grassInset 0; water and beach colours are set to the grass colour 0x80af49 and border 0x719644 to hide the shore ("because of the bug") (fork) [src:survev/shared/defs/maps/birthdayDefs.ts:18-29] [src:survev/shared/defs/maps/birthdayDefs.ts:105-113] [H]
- Other colours: background 0x20536e, riverbank 0x905e24, underground 0x1b0d03, submerge 0x2b8ca4, ghillie 0x83af50; no camera particles (fork) [src:survev/shared/defs/maps/birthdayDefs.ts:18-39] [H]
- Size: base 512 × 1.1875 (solo/duo) or 1.21875 (squad) + 112 = 720 / 736 (fork) [src:survev/shared/defs/maps/birthdayDefs.ts:105-111] [src:derived/survev-git-309b26a3] [H]
- No rivers (weights `[{ weight: 1, widths: [] }]`), no lakes, no cabins, no bridges (fork) [src:survev/shared/defs/maps/birthdayDefs.ts:113-119] [src:survev/shared/defs/maps/birthdayDefs.ts:151-155] [H]
- Places: The Killpit (0.53, 0.64), Sweatbath (0.84, 0.18), Tarkhany (0.15, 0.11), Ytyk-Kyuyol (0.25, 0.42), Cordial Creek (0.81, 0.85), Pineapple (0.21, 0.79), Fowl Forest (0.73, 0.47); Ranchito Pollo was removed in a correction (fork) [src:survev/shared/defs/maps/birthdayDefs.ts:121-150] [src:derived/survev-git-6a4ac969] [H]
- Density only: stone_01 250, barrel_01bd 70, silo_01 16, crate_01 120, tree_01 300, loot_tier_1 100 (fork) [src:survev/shared/defs/maps/birthdayDefs.ts:160-169] [H]
- No fixed spawns ("none lol"), no random building rotation, no place or location spawns, no important spawns (fork) [src:survev/shared/defs/maps/birthdayDefs.ts:156-183] [H]
- `barrel_01bd` is a barrel without explosion, matching barrels before 0.1.7 (fork) [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:494-496] [src:changelog/0.1.7] [H]
- No air drops (`planes.timings` empty) (fork) [src:survev/shared/defs/maps/birthdayDefs.ts:45-49] [src:derived/survev-git-15479786] [H]

## Loot (survev `birthday`, fork)

> survev's comments mark these tables as not original: "?" = guess from statistics, "!" = uncertain leak data.

| table | entries | sources |
|---|---|---|
| tier_world | tier_guns 0.4, tier_scopes 0.15 (?), tier_armor 0.15 (?), tier_medical 0.15 (?), tier_packs 0.2 (?), tier_outfits 0.01 (?) — no ammo or throwables | [src:survev/shared/defs/maps/birthdayDefs.ts:53-61] [M] |
| tier_scopes | 2x 24, 4x 8, 8x 2 (?), 15x 0.08 (?) | [src:survev/shared/defs/maps/birthdayDefs.ts:62-67] [M] |
| tier_armor | helmet01 10 (!), helmet02 6, helmet03 0.2, chest01 15 (!), chest02 6, chest03 0.2 | [src:survev/shared/defs/maps/birthdayDefs.ts:68-75] [M] |
| tier_packs | backpack01 15 (!), backpack02 7, backpack03 0.7 | [src:survev/shared/defs/maps/birthdayDefs.ts:76-80] [M] |
| tier_medical | bandage ×5 16, healthkit 4, soda 15, painkiller 5 | [src:survev/shared/defs/maps/birthdayDefs.ts:81-86] [H] |
| tier_guns | ak47 8, mosin 1, m39 0.5, saiga 0.5, mp5 10, m870 9, m9 10 | [src:survev/shared/defs/maps/birthdayDefs.ts:87-95] [M] |
| tier_outfits | Arctic Avenger (`outfitWhite`) 0.2, Woodland 0.1, Key Lime 0.15, Target Practice (`outfitRed`) 0.1, Forest Camo 0.1 | [src:survev/shared/defs/maps/birthdayDefs.ts:96-103] [src:l10n/ko:game-outfitWhite] [M] |

- The gun list matches the guns named in the 2017 changelog (ak47, mp5, m9, m870, saiga, mosin, m39) before the OT-38 (0.1.3), MP220 (0.1.4), DP-28 (0.1.6) and MAC-10 (0.1.7) arrived (fork) [src:changelog/0.0.5] [src:changelog/0.0.95] [src:changelog/0.1.0] [src:changelog/0.1.3] [src:changelog/0.1.4] [src:changelog/0.1.6] [src:changelog/0.1.7] [src:survev/shared/defs/maps/birthdayDefs.ts:87-95] [H]
- Ammo is not in `tier_world`; guns come with their ammo spawn count only (fork) [src:survev/shared/defs/maps/birthdayDefs.ts:53-61] [M]

## Conflicts

- CONFLICT birthday-crates: early-access crates were decorative until 0.0.9 [src:changelog/0.0.9] [src:wikigg/Birthday_mode] vs survev Birthday `crate_01` dropping normal loot [src:survev/shared/defs/maps/birthdayDefs.ts:160-169]; proposed: keep loot (playable) but note it as a fork choice [M]
- CONFLICT birthday-key-lime: Key Lime only arrived in 0.2.0 (Jan 17, 2018) [src:changelog/0.2.0] vs Birthday's tier_outfits including it [src:survev/shared/defs/maps/birthdayDefs.ts:96-103]; proposed: drop Key Lime if a faithful early-access table is wanted [M]
- CONFLICT birthday-silo-barrel-era: silos and metal barrels arrived in 0.0.8 (Nov 5, 2017), after the first release [src:changelog/0.0.8] vs Birthday spawning both [src:survev/shared/defs/maps/birthdayDefs.ts:160-169]; proposed: keep (it imitates early-to-mid November 2017) [L]

## Open questions

- Early-access map size before the 0.2.0 increase is unknown; survev uses 720 / 736 [src:changelog/0.2.0] [src:survev/shared/defs/maps/birthdayDefs.ts:105-111] [L]
- Whether the fork runs Birthday only around Oct 31 or as a regular mode is not stated in the sources [src:survev/client/public/changelogRec.html:385-386] [L]
