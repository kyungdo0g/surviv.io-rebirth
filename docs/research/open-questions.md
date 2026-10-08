# Open questions

> Unresolved questions merged from the `## Open questions` sections of every file under `docs/research`, deduplicated into one `## <id>` entry each.
> Each entry repeats the question lines with their sources, gives the `proposed handling` until the question is answered (usually precedence rule 5: keep the survev value as a config knob), names the related conflict ids in `conflicts.md`, and lists the files that raised it.

> **Korean community**

## ko-clan-tournament-2021

- 2021년 "Surviv.io 아시아 클랜 대회"의 주최자·날짜·참가 팀은 나무위키 스니펫 외 출처가 없다 [src:namu/Surviv.io] [L]
- proposed handling: documentation gap only; no gameplay impact, keep as a research lead [src:derived/kb-crossref] [L]
- files: `community-ko.md` [src:derived/kb-crossref] [H]

## ko-community-channels

- KRNumber1, Surviv Serin, Mk Hero의 실제 채널·기록은 YouTube나 리더보드로 확인하지 못했다 [src:namu/Surviv.io] [L]
- arca.live·네이버 카페·밴드의 surviv.io 커뮤니티는 검색으로 찾지 못했다 (나무위키는 클랜이 네이버 카페·밴드에서 활동한다고만 적음) [src:namu/Surviv.io] [L]
- proposed handling: documentation gap only; no gameplay impact, keep as a research lead [src:derived/kb-crossref] [L]
- files: `community-ko.md` [src:derived/kb-crossref] [H]

## ko-player-stats

- 2018-03-19 갤러리 개설일이 게임의 한국 유입 시점(한국어 지원 2018-01-30) 직후라는 점 외에, 한국 유저 수 추이를 보여 줄 통계는 fandom의 "한국 500~600명(전성기)" 하나뿐이다 [src:fandom/Servers, changelog/0.2.3] [L]
- proposed handling: documentation gap only; no gameplay impact, keep as a research lead [src:derived/kb-crossref] [L]
- files: `community-ko.md` [src:derived/kb-crossref] [H]

> **Engine and netcode**

## server-tick-snapshot-rate

- Original server tick rate, snapshot rate and per-host game capacity are unknown; fandom only says the NA region peaked at over 11k players [src:fandom/Servers] [L]
- The original server's snapshot rate, culling box size and bullet culling rules are unknown; survev's values (33 Hz, zoom + 4 units, 16:9 box) are reconstructions [src:survev/server/src/game/client.ts:486-497] [src:survev/config.ts:40-41] [L]
- proposed handling: rule 5: keep survev's 100 Hz simulation, 33 Hz snapshots and culling box as knobs [src:survev/config.ts:40-41] [L]
- related conflicts: `tick-rate` [src:derived/kb-crossref] [H]
- files: `engine/architecture.md`, `engine/netcode.md` [src:derived/kb-crossref] [H]

## mobile-server-behaviour

- Whether the original server separated mobile and desktop players into different games (fandom, namu) cannot be checked in survev, which does not [src:fandom/Surviv.io_Mobile] [src:namu/Surviv.io] [src:survev/shared/types/api.ts:5-13] [L]
- Whether the original server used `isMobile`/`useTouch` for anything beyond the zoom table (auto-loot, separate matchmaking) cannot be read from the client [src:derived/survev@8715a605:client/js/app.js:43583-43615] [src:fandom/Surviv.io_Mobile] [L]
- proposed handling: keep survev's single shared queue and server-side mobile auto-loot; separate mobile queues as a knob [src:survev/shared/types/api.ts:5-13] [L]
- related conflicts: `mobile-matchmaking-split`, `mobile-auto-loot-location` [src:derived/kb-crossref] [H]
- files: `engine/architecture.md`, `engine/netcode.md` [src:derived/kb-crossref] [H]

## map-place-encoding

- The 0.8.82 client reads map places as 0–1024 vectors while survev writes them as 0–1 normalised positions; which the original server used needs a capture of a real Map message [src:derived/survev@8715a605:client/js/app.js:42978-42981] [src:survev/shared/net/mapMsg.ts:26-29] [L]
- proposed handling: follow survev's 0–1 encoding unless wire compatibility with the original client is a goal; a captured Map message would settle it [src:survev/shared/net/mapMsg.ts:26-29] [L]
- files: `engine/netcode.md` [src:derived/kb-crossref] [H]

> **History**

## early-reskins-2017-2018

- Exact date of the 2017 Christmas tree reskin and of the first public tweet (Oct 31 vs Nov 1, 2017) are not in any dumped source [src:fandom/Removed_Features] [src:fandom/Changelog] [L]
- Whether the 2018 Valentine reskin and the 2017 Christmas trees used separate map defs or only sprite swaps is unknown [src:fandom/Removed_Features] [L]
- proposed handling: documentation gap only; no gameplay impact, keep as a research lead [src:derived/kb-crossref] [L]
- files: `history.md`, `modes/events.md` [src:derived/kb-crossref] [H]

## relaunch-day

- Which day in March 2026 the Kongregate-site relaunch went live (19, 20 or 21) needs the original announcement [src:wp-en/Surviv.io] [src:fandom/Surviv.io] [L]
- proposed handling: record March 26, 2026 (0.9.0) as the surviv.io-domain date; the Kongregate-site day needs the original announcement [src:kong/relaunch-changelog] [L]
- related conflicts: `relaunch-date` [src:derived/kb-crossref] [H]
- files: `history.md` [src:derived/kb-crossref] [H]

## twitch-extension-shutdown

- The Twitch extension shutdown date ("around end-2021") is unknown [src:fandom/Twitch_Extension] [L]
- proposed handling: documentation gap only; no gameplay impact, keep as a research lead [src:derived/kb-crossref] [L]
- files: `history.md` [src:derived/kb-crossref] [H]

## wp-ko-unread

- Ko-wikipedia (`wp-ko`) could not be read (rate-limited), so Korean-language reception beyond namu is missing [src:derived/none] [L]
- proposed handling: retry the ko.wikipedia `api.php` dump when the rate limit allows [src:derived/kb-crossref] [L]
- files: `history.md` [src:derived/kb-crossref] [H]

> **Items**

## bullet-server-reconstruction

- The server-side bullet code (falloff linearity, the reflection rules) is survev's reconstruction from the original client and from Bit Heroes Arena. The distance-jitter and range formulas are confirmed by the original client's own bullet code, but falloff and reflection are confirmed only indirectly, by wiki descriptions of linear falloff and the 3-reflection limit [src:survev/server/src/game/objects/bullet.ts:16-17] [src:derived/survev@8715a605:client/js/app.js:106463-106484] [src:wikigg/Guns] [L]
- proposed handling: keep survev's linear falloff and 3-reflection rule (wiki descriptions agree) [src:wikigg/Guns] [src:survev/server/src/game/objects/bullet.ts:16-17] [L]
- files: `items/bullets.md` [src:derived/kb-crossref] [H]

## distadj-range

- Did the original server roll `distAdjIdx` over 0–15 (the 4-bit range) or 0–16 as survev does? [src:derived/survev@8715a605:client/js/app.js:44034] [src:survev/server/src/game/objects/bullet.ts:225-229] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `items/bullets.md` [src:derived/kb-crossref] [H]

## bonus-bullet-server-effects

- Which original perks changed bullet speed or damage server-side (9mm Overpressure damage, Hollow-points damage) is not in client data; only the bonus-bullet speed and distance (× 1.25) are known [src:derived/survev@9f64948d:src/defs/bulletDefs.js:791-834] [src:l10n/ko:game-bonus_9mm-desc] [L]
- How did the original server apply `bulletTypeBonus` (9mm Overpressure)? The bonus bullets show speed and range × 1.25 with the same damage. The perk text also promises more damage and spread, but those multipliers are not in client data [src:derived/survev@9f64948d:src/defs/bulletDefs.js:791-834] [src:l10n/ko:game-bonus_9mm-desc] [L]
- proposed handling: apply only the client-visible × 1.25 speed/range to bonus bullets; extra damage/spread behind knobs [src:derived/survev@9f64948d:src/defs/bulletDefs.js:791-834] [L]
- files: `items/bullets.md`, `items/guns.md` [src:derived/kb-crossref] [H]

## spud-gun-damage-source

- Fandom puts Spud Gun damage at 13, but bullet_potato does 0 damage, so the damage must come from the `potato_smgshot` projectile; its explosion values need checking in the throwables and explosions docs [src:fandom/Spud_Gun] [src:derived/survev@9f64948d:src/defs/bulletDefs.js:670-683] [L]
- proposed handling: model Spud Gun damage on the `potato_smgshot` projectile explosion (13 by default, see `spud-gun-explosion-damage`) [src:derived/survev@8715a605:client/js/app.js:114912-114914] [L]
- related conflicts: `fandom-spudgun-dmg`, `spud-gun-explosion-damage` [src:derived/kb-crossref] [H]
- files: `items/bullets.md` [src:derived/kb-crossref] [H]

## xp-and-cosmetic-loot

- Original outfit, emote and XP loot tables per map (which skins dropped where and how often) are server-side; survev's tables are estimates [src:survev/shared/defs/maps/baseDefs.ts:394-402] [src:survev/shared/defs/maps/halloweenDefs.ts:179-199] [L]
- Original XP artifact rates (survev: commented guess uncommon 1 / rare 0.1 / mythic 0.001 against "" 40 or 15) [src:survev/shared/defs/maps/baseDefs.ts:709-724] [L]
- proposed handling: strip XP drops while accounts are out of scope; keep survev's outfit/emote tables as knobs [src:survev/shared/defs/maps/baseDefs.ts:709-724] [L]
- files: `items/cosmetics.md`, `mechanics/loot.md` [src:derived/kb-crossref] [H]

## account-side-rules

- Account-side rules (quest rotation timing, re-roll limits, pass XP after level 99) are only known from fandom [src:fandom/Quests] [src:fandom/Survivr_Pass_1] [L]
- proposed handling: accounts are out of scope for the core; use fandom's rules if passes are added [src:fandom/Quests] [L]
- files: `items/cosmetics.md` [src:derived/kb-crossref] [H]

## boost-heal-measurement

- Original adrenaline regen per level and decay are not in client data (only `boostBreakpoints`); survev's values are unverified against the original server [src:derived/survev@9f64948d:src/gameConfig.ts:117-140] [src:fandom/Adrenaline] [L]
- The original per-tier heal amounts were never published. Measure them on the 2026 relaunch (it runs v0.8.82): heal over 10 s at 30, 60 and 95 boost [src:kong/relaunch-client-bundle] [src:derived/boost-formula] [L]
- proposed handling: measure on the 2026 relaunch (it runs v0.8.82 with only 0.9.x fixes) and set the knob default from the measurement: heal over 10 s at 30, 60 and 95 boost; until then survev's 0.5 / 1.25 / 1.5 / 1.75 [src:survev/shared/gameConfig.ts:195] [src:derived/relaunch-measurement] [L]
- related conflicts: `boost-heal-tiers` [src:derived/kb-crossref] [H]
- files: `items/gear.md`, `mechanics/boost.md` [src:derived/kb-crossref] [H]

## loot-table-weights

- Original loot weights for armour, packs, scopes and medical items are survev estimates (`// ?`, `// !`) [src:survev/shared/defs/maps/baseDefs.ts:94-164] [L]
- Original loot weights per tier are unknown: the client shipped no loot tables and survev's weights are estimates. Wiki fractions such as "Hatchet Case Vector 40/83" and "Crimson Ring Groza-S 75/101" are the best evidence [src:derived/survev@9f64948d:src/defs/modes/main.ts:63] [src:wikigg/Vector] [src:wikigg/Groza-S] [L]
- Original melee spawn weights (hatchet bunker, chrysanthemum chest, airdrop melee) are survev estimates marked `// ?` [src:survev/shared/defs/maps/baseDefs.ts:210-214] [src:survev/shared/defs/maps/baseDefs.ts:369-374] [L]
- Original server loot weights inside bunker tiers (tier_hatchet, tier_chrys_03, tier_eye_block) are survev reconstructions [src:survev/shared/defs/maps/baseDefs.ts:90-92] [L]
- Exact original loot tier contents behind obstacle loot (survev's loot tables are reconstructions, see `mechanics/loot`) [src:survev/shared/defs/maps/baseDefs.ts:90-92] [L]
- Real 0.8.82 weights for `tier_world`, `tier_surviv`, `tier_soviet`, `tier_scopes`, `tier_packs`, `tier_leaf_pile` (survev marks them `?`/TODO; fandom lists only rarity words) [src:survev/shared/defs/maps/baseDefs.ts:94-132] [src:fandom/Loot_tables/General] [L]
- Original weights of the main loot tables are unknown; survev's own table is a statistical guess [src:survev/shared/defs/maps/baseDefs.ts:90-92] [M]
- survev's original-era map spawns and loot tables are partly reconstructed (`?`/`!` comments), so original ids are certain but their spawn weights are not [src:survev/shared/defs/maps/baseDefs.ts:90] [M]
- proposed handling: rule 5: survev's (pre-fork, balance-reverted) weights as config tables; wiki fractions (e.g. Hatchet Case Vector 40/83) as checks [src:survev/shared/defs/maps/baseDefs.ts:90-92] [src:wikigg/Vector] [L]
- related conflicts: `loot-baseline-not-original` [src:derived/kb-crossref] [H]
- files: `items/gear.md`, `items/guns.md`, `items/melee.md`, `maps/bunkers.md`, `maps/obstacles.md`, `mechanics/loot.md`, `modes/main.md`, `provenance/fork-vs-original.md` [src:derived/kb-crossref] [H]

## heal-slowdown

- Did the original slow players to half speed while healing (survev: ×0.5), and by how much did Field Medic change it? [src:survev/server/src/game/objects/player.ts:4751-4765] [src:fandom/Med_Kit] [L]
- Was the item-use slowdown a multiplier (survev ×0.5) or a flat penalty (survev's earlier −6) in the original? The 0.0.95 changelog only says the penalty was reduced [src:changelog/0.0.95] [src:derived/survev-git-aa28f360] [L]
- proposed handling: keep survev's × 0.5 multiplier as a knob; Field Medic removes it (see `field-medic-speed`) [src:survev/server/src/game/objects/player.ts:4751-4765] [L]
- related conflicts: `field-medic-speed` [src:derived/kb-crossref] [H]
- files: `items/gear.md`, `mechanics/movement.md` [src:derived/kb-crossref] [H]

## aim-delay

- What did `aimDelay` do? The 0.6.2 changelog says Mosin, SV-98 and AWM-S got "an added delay before the first shot fires". That line sits under the entry's "### Mobile" heading, next to the new mobile aim line, so it is probably a mobile-only delay. The flag is on those three plus scout_elite (barrett in the fork). Nothing in survev reads it, so the delay length is unknown. Neither the decompiled original client in survev `8715a605` nor the 2026 relaunch bundle reads the flag (it appears only inside the gun defs), so the original delay was applied on the server [src:changelog/0.6.2] [src:derived/survev@8715a605:client/js/app.js:101290-102037] [src:kong/relaunch-client-defs] [src:survev/shared/defs/gameObjects/gunDefs.ts:780] [src:derived/grep-aimDelay-no-readers] [L]
- proposed handling: treat `aimDelay` as a server-side first-shot delay knob (default 0); only mobile per the 0.6.2 changelog [src:changelog/0.6.2] [L]
- files: `items/guns.md` [src:derived/kb-crossref] [H]

## single-fire-buffering

- Did the original have single-fire input buffering? Wiki.gg dates it to survev v0.2.0 (fork) [src:wikigg/Guns] [src:survev/server/src/game/weaponManager.ts:373-381] [L]
- proposed handling: off for v0.8.82 (wiki.gg dates it to survev v0.2.0), as a knob [src:wikigg/Guns] [L]
- files: `items/guns.md` [src:derived/kb-crossref] [H]

## vector45-intro-version

- When exactly was the .45 Vector (`vector45`) added? Only wiki.gg's "0.6.5" claim exists; the changelog does not name it [src:wikigg/Vector_45] [L]
- proposed handling: documentation gap only; no gameplay impact, keep as a research lead [src:derived/kb-crossref] [L]
- files: `items/guns.md` [src:derived/kb-crossref] [H]

## melee-headshots

- Did the original server roll headshots for melee (headshotMult 1 skips vest reduction)? No original server code exists; wikis only say melee has no headshot multiplier [src:fandom/Melee_weapons] [src:derived/survev@9f64948d:src/defs/meleeDefs.js:18] [L]
- proposed handling: melee never headshots (see `melee-headshot-roll`) [src:fandom/Melee_weapons] [L]
- related conflicts: `melee-headshot-roll` [src:derived/kb-crossref] [H]
- files: `items/melee.md` [src:derived/kb-crossref] [H]

## knife-damage-history

- Exact knife damage history between 0.5.01 (27) and 0.8.82 (24) [src:fandom/Huntsman] [src:changelog/0.5.01] [L]
- proposed handling: documentation gap only; no gameplay impact, keep as a research lead [src:derived/kb-crossref] [L]
- related conflicts: `knife-nerf-version` [src:derived/kb-crossref] [H]
- files: `items/melee.md` [src:derived/kb-crossref] [H]

## perk-estimated-radii

- Original radii and durations that survev estimated: Last Breath range 60 (fandom: "an unknown range"), bugle range 30; the Windwalk trigger distance 5 is backed by the fandom Perks list [src:survev/shared/defs/gameObjects/perkDefs.ts:48-80] [src:survev/server/src/game/objects/player.ts:4562-4570] [src:fandom/Last_Breath] [src:fandom/Perks] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `items/perks.md` [src:derived/kb-crossref] [H]

## takedown-low-hp-haste

- Fandom says Takedown gives no speed boost when health is below 50; survev always grants it [src:fandom/Takedown] [src:survev/server/src/game/objects/player.ts:2721-2725] [L]
- proposed handling: always grant the haste (survev, wiki.gg), fandom's < 50 HP rule as a knob [src:wikigg/Takedown] [L]
- related conflicts: `takedown-haste-low-hp` [src:derived/kb-crossref] [H]
- files: `items/perks.md` [src:derived/kb-crossref] [H]

## perk-tier-weights

- Exact v0.8.82 contents and weights of `tier_perks` (Savannah, Desert, Potato), `tier_class_crate_mythic` and `tier_halloween_mystery_perks` are unknown; survev's tables are estimates [src:survev/shared/defs/maps/baseDefs.ts:708] [src:derived/survev-git-8491a169] [L]
- Original weights of `tier_halloween_mystery_perks`, `tier_fruit_xp`, `tier_airdrop_xp` and `tier_pumpkin_candy` (survev marks them guessed or unused) [src:survev/shared/defs/maps/baseDefs.ts:691, survev/shared/defs/maps/baseDefs.ts:708-737] [L]
- proposed handling: fandom's weighted Tier Perks table limited to perks that existed in 0.8.82; survev's flat weights as fallback [src:fandom/Loot_tables] [L]
- related conflicts: `potato-tier-perks`, `savannah-perk-pool` [src:derived/kb-crossref] [H]
- files: `items/perks.md`, `modes/halloween.md` [src:derived/kb-crossref] [H]

## explosive-rounds-desert

- Whether Explosive Rounds spawned in v0.8.82 desert golden airdrops (fandom: "very rarely from Air Drops") or only in the Cobalt Mythic Class Pod [src:fandom/Explosive_Rounds] [src:balance/320] [L]
- proposed handling: include `explosive` at a low weight in desert gold airdrops behind a knob [src:fandom/Explosive_Rounds] [L]
- related conflicts: `desert-explosive-rounds` [src:derived/kb-crossref] [H]
- files: `items/perks.md` [src:derived/kb-crossref] [H]

## medic-revived-aoe

- Fandom says reviving the Medic also triggers Mass Medicate's area revive; survev only does so while the medic is reviving [src:fandom/Medic] [src:survev/server/src/game/objects/player.ts:3133-3150] [L]
- proposed handling: also trigger the medic's area revive when a teammate's revive of the medic completes [src:fandom/Mass_Medicate] [L]
- related conflicts: `medic-revived-aoe` [src:derived/kb-crossref] [H]
- files: `items/perks.md` [src:derived/kb-crossref] [H]

## splinter-spread-formula

- How the original Splinter spread was computed (fandom: "40–50 % increased spread (random)"; survev: side bullets at 0.2–0.25 × spread) [src:fandom/Perks] [src:survev/server/src/game/weaponManager.ts:973-1000] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- related conflicts: `splinter-fsa-spread` [src:derived/kb-crossref] [H]
- files: `items/perks.md` [src:derived/kb-crossref] [H]

## lone-survivr-third-perk

- Fandom's Takedown page says Takedown was always given to the Lone Survivr "prior to v0.8.4" and stopped being guaranteed in v0.8.71, but the Lone Survivr itself was added in v0.8.4; the exact v0.8.82 rule for the third perk is uncertain [src:fandom/Takedown] [src:changelog/0.8.4] [L]
- proposed handling: v0.8.82 set: Cast Ironskin + Splinter Rounds + one of Takedown / Windwalk / Combat Medic at 1/3 each [src:derived/survev@9f64948d:src/defs/roleDefs.js:62-68] [L]
- related conflicts: `role-lone-survivr-perks` [src:derived/kb-crossref] [H]
- files: `items/roles.md` [src:derived/kb-crossref] [H]

## commander-flare-rules

- The original Commander's flare-gun rule (could it be dropped before firing?) and the leader ping sound behaviour are only known from survev reconstructions and fandom trivia [src:survev/server/src/game/weaponManager.ts:655-668] [src:fandom/Commander] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- related conflicts: `role-leader-auto-flare` [src:derived/kb-crossref] [H]
- files: `items/roles.md` [src:derived/kb-crossref] [H]

## lone-survivr-windwalk-duration

- The Lone Survivr's Windwalk boost duration on promotion ("??? seconds" on fandom; survev 5 s) [src:fandom/Lone_Survivr] [src:survev/server/src/game/objects/player.ts:926-930] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `items/roles.md` [src:derived/kb-crossref] [H]

## promotion-afk-filter

- Whether the v0.8.82 server filtered AFK players from promotion (fandom only mentions bad connections) [src:fandom/Commander] [src:survev/client/public/changelogRec.html:168] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `items/roles.md` [src:derived/kb-crossref] [H]

## heavy-throwable-cook-time

- How long did the original server require cooking before a snowball/potato became "heavy"? The original client has `heavyType` only on potato and no `changeTime` anywhere; survev's 1 s (5 s from 2024-09 to 2025-03) is its own choice [src:derived/survev@9f64948d:src/defs/throwableDefs.js:353-572] [src:derived/survev-git-90e277a3] [src:derived/survev-git-b3c52086] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `items/throwables.md` [src:derived/kb-crossref] [H]

## freeze-and-drop-effects

- Original slow (freeze) durations and random-drop counts for snowball/potato hits are not in client data; survev's pre-balance values were 0.5 s / 1 s and 1 item [src:derived/survev-git-f1dd66c9] [src:fandom/Snowball] [L]
- Exact original snowball/potato freeze durations (client defs show the sprites but no duration) [src:kong/relaunch-client-defs] [L]
- `frozenSpeedPenalty` −3 and the freeze durations are survev values with no wiki confirmation [src:survev/shared/gameConfig.ts:204] [L]
- The heavy potato `dropRandomLoot` original (1) comes from balance.txt alone; the field did not exist in the original client defs [src:balance/133] [M]
- proposed handling: keep survev's pre-balance values (0.5 s / 1 s slow, 1 random drop, −3 frozen speed) as knobs [src:derived/survev-git-f1dd66c9] [src:balance/133] [L]
- related conflicts: `snow-potato-explosion-damage` [src:derived/kb-crossref] [H]
- files: `items/throwables.md`, `mechanics/explosions.md`, `mechanics/movement.md`, `provenance/balance-revert.md` [src:derived/kb-crossref] [H]

## projectile-physics

- Original projectile gravity (survev: 10.5, derived from potato cannon packets) and ground drag (2.3 / 5 on water, "plotted data") are reconstructions [src:survev/server/src/game/objects/projectile.ts:14-16] [src:survev/server/src/game/objects/projectile.ts:222-229] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `items/throwables.md` [src:derived/kb-crossref] [H]

## strobe-strike-side-order

- Exact original airstrike offset pattern for strobes (survev randomises the side, its comment says the original did not) [src:survev/server/src/game/weaponManager.ts:1342-1346] [L]
- Was the strobe strike side order deterministic in the original (survev randomises it)? [src:survev/server/src/game/weaponManager.ts:1343-1347] [L]
- proposed handling: no side randomisation for v0.8.82 (survev's own comment says the original did not randomise), as a knob [src:survev/server/src/game/weaponManager.ts:1342-1346] [L]
- related conflicts: `strobe-airstrike-offset` [src:derived/kb-crossref] [H]
- files: `items/throwables.md`, `mechanics/airdrop-airstrike.md` [src:derived/kb-crossref] [H]

## snowball-drop-backpacks

- Fandom and survev disagree on whether the snowball's random item drop applies to backpacks: fandom says backpacks can drop when hit by snowballs or potatoes, survev's `dropRandomLoot` lists inventory, weapons, armour and perks [src:fandom/Backpacks] [src:survev/server/src/game/objects/player.ts:4001-4015] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `items/throwables.md` [src:derived/kb-crossref] [H]

> **Korean localisation**

## ko-json-fidelity

- a14ab228의 ko.json("survivreloaded-client"에서 가져옴)이 원작 0.8.82 클라이언트의 ko.json과 바이트 단위로 같은지 확인하지 못했다; 2026 재출시 클라이언트 번들에서 ko.json을 받아 비교하면 확정된다 [src:derived/git-a14ab228, kong/relaunch-client-defs] [L]
- proposed handling: diff the relaunch bundle's ko strings against survev's a14ab228 import [src:kong/relaunch-client-defs] [L]
- files: `l10n-ko.md` [src:derived/kb-crossref] [H]

## ko-emote-names

- 원작에 이모트·조준선 한국어 이름이 있었는지 알 수 없다 (2024 import 시점에도 키가 없었음) [src:derived/git-a14ab228] [L]
- proposed handling: documentation gap only; no gameplay impact, keep as a research lead [src:derived/kb-crossref] [L]
- files: `l10n-ko.md` [src:derived/kb-crossref] [H]

## ko-perk-term

- "특전" vs "퍽": 공식 파일은 설명문 안에서만 "특전"을 쓰고 퍽 목록 제목 문자열은 없다; 리버스 UI에 어느 쪽을 노출할지 사용자 테스트가 필요하다 [src:l10n/ko:game-trick_nothing-desc, namu/Surviv.io/이벤트] [L]
- proposed handling: user-test "특전" vs "퍽" before the Korean UI ships [src:l10n/ko:game-trick_nothing-desc] [L]
- files: `l10n-ko.md` [src:derived/kb-crossref] [H]

## tree-cache-id

- 상자 나무(Tree Cache)의 survev id를 이 조사에서 특정하지 못했다 [src:namu/Surviv.io/오브젝트] [L]
- proposed handling: documentation gap only; no gameplay impact, keep as a research lead [src:derived/kb-crossref] [L]
- files: `l10n-ko.md` [src:derived/kb-crossref] [H]

> **Maps**

## map-spawn-counts

- Exact v0.8.82 spawn counts per map are server-side; survev's numbers (and its pre-fork snapshot) are reconstructions marked `?`/`!` in places [src:survev/shared/defs/maps/baseDefs.ts:90-92] [src:derived/git-ae55c9a8] [L]
- Whether `cache_06` (berry bush cache) density 12 and `tree_02` count 3 match the original; only the survev reconstructions agree [src:survev/shared/defs/maps/baseDefs.ts:898, derived/git-ae55c9a8] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `maps/buildings.md`, `modes/main.md` [src:derived/kb-crossref] [H]

## faction-building-sides

- How the original 50v50 decided which half each team-themed building spawns on (survev uses `teamId` and division rules) [src:survev/server/src/game/map.ts:1540-1605] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- related conflicts: `faction-teamid` [src:derived/kb-crossref] [H]
- files: `maps/buildings.md` [src:derived/kb-crossref] [H]

## savannah-building-rotation

- Whether Savannah originally had the bank/police rotation (pre-fork survev did, HEAD spawns a fixed mansion) [src:derived/git-ae55c9a8] [src:survev/shared/defs/maps/savannahDefs.ts:290] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `maps/buildings.md` [src:derived/kb-crossref] [H]

## snow-building-set

- Whether the snow map in 0.8.82 used the full building set (pre-fork survev: fixed spawns copied from main) or the reduced set fandom describes after 0.9.0 [src:derived/git-ae55c9a8] [src:fandom/Chrysanthemum_Bunker] [L]
- Original Snow (0.6.9 / 0.8.x) spawn counts beyond the replacements in the import, e.g. stone_04x count [src:derived/survev@33832ffe:src/defs/maps/snowDefs.ts:87-148] [src:balance/201] [L]
- Whether the 2018 snow map spawned the alternate barn, teahouse complex or club at all (all three post-date it; survev adds them via the 0.8.82 main def) [src:changelog/0.7.3, changelog/0.7.7, survev/shared/defs/maps/snowDefs.ts:237-261] [L]
- proposed handling: 2-of-3 rotation as on the 0.8.82 main map, all three as a knob (see `snow-random-buildings`) [src:changelog/0.7.7] [L]
- related conflicts: `snow-random-buildings`, `snow-hardstone-count` [src:derived/kb-crossref] [H]
- files: `maps/buildings.md`, `maps/generation.md`, `modes/snow.md` [src:derived/kb-crossref] [H]

## halloween-eye-vault-loot

- Exact v0.8.82 Halloween Eye vault loot: Stone Hammer (survev, 2019 Halloween) or the 2018 hardstone list [src:fandom/Eye_Bunker] [src:survev/shared/defs/maps/baseDefs.ts:220] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `maps/bunkers.md` [src:derived/kb-crossref] [H]

## snow-chrysanthemum-contents

- Snow-map Chrysanthemum contents (rusted katana, snowballs, winter wheel) are described by fandom but absent from the client defs survev imported [src:fandom/Chrysanthemum_Bunker] [src:kong/relaunch-client-defs] [L]
- proposed handling: documentation gap only; no gameplay impact, keep as a research lead [src:derived/kb-crossref] [L]
- files: `maps/bunkers.md` [src:derived/kb-crossref] [H]

## terrain-gen-fields

- Original river path algorithm (survev's is a 2025 rewrite) and what `rivers.smoothness` controlled [src:derived/survev-git-c4841f72] [src:survev/shared/defs/maps/baseDefs.ts:834] [L]
- Semantics of the original `spawnPriority`, `river.centerWeight` and `nearbyRiver.radMin/radMax` terrain fields [src:kong/relaunch-client-defs] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `maps/generation.md` [src:derived/kb-crossref] [H]

## mode-spawn-tables

- Original Cobalt, Savannah and Turkey spawn tables (survev's are reconstructions) [src:derived/survev@33832ffe:src/defs/maps/cobaltDefs.ts:1-48] [src:derived/survev@33832ffe:src/defs/maps/savannahDefs.ts:1-32] [L]
- All Savannah spawn counts and most gun weights are fork reconstructions marked "?"; the original numbers are unknown [src:survev/shared/defs/maps/savannahDefs.ts:47-103] [L]
- survev had no own Savannah loot table until 2025-08 (`367a7b3d`) and no own Turkey spawns until fork 0.1.3, so Savannah and Turkey originals in this list are survev's first versions, not verified originals [src:derived/git-367a7b3d, survev/client/public/changelogRec.html:387] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- related conflicts: `savannah-crate-counts`, `cobalt-pod-count` [src:derived/kb-crossref] [H]
- files: `maps/generation.md`, `modes/savannah.md`, `provenance/balance-revert.md` [src:derived/kb-crossref] [H]

## placement-rng

- Whether the original server used `Math.random` for object placement (survev does), i.e. whether a seed reproduced a full map [src:survev/server/src/game/map.ts:1637-1646] [L]
- proposed handling: seeded RNG for reproducible maps (a new choice, harmless for gameplay) [src:survev/server/src/game/map.ts:1637-1646] [L]
- files: `maps/generation.md` [src:derived/kb-crossref] [H]

## water-edge-distances

- The survev waterEdge distance hacks (hut −16, docks −(shoreInset − 6.5), conch −24) replace unknown original uses of `distMin/distMax` [src:survev/server/src/game/map.ts:1495-1503] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `maps/generation.md` [src:derived/kb-crossref] [H]

## small-river-bridges

- Whether original width-4 rivers carried bridges: survev's size thresholds give them none, while namu.wiki describes small wooden bridges on small rivers [src:survev/server/src/game/map.ts:820-838] [src:namu/Surviv.io] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `maps/generation.md` [src:derived/kb-crossref] [H]

## orphan-original-obstacles

- What the original `tire_01` (1500 HP) was used for; no original map def or building references it in survev [src:kong/relaunch-client-defs] [L]
- Original `house_door_06` and `glass_wall_18` users (buildings that were removed before survev's import) [src:kong/relaunch-client-defs] [L]
- proposed handling: documentation gap only; no gameplay impact, keep as a research lead [src:derived/kb-crossref] [L]
- files: `maps/obstacles.md` [src:derived/kb-crossref] [H]

## smart-loot-ownership

- Whether original airdrops and class shells used `smartLoot` ownership exactly as survev implements (8-unit owner radius) [src:survev/server/src/game/objects/obstacle.ts:586-606] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `maps/obstacles.md` [src:derived/kb-crossref] [H]

## halloween-place-labels

- Coordinates of the Halloween 2019 labels (assumed identical to Main's) and whether 2019's Haunted Hollow replaced Fowl Forest [src:fandom/Halloween_Map] [src:fandom/Maps] [L]
- Whether the Halloween place renames (2019) should be implemented; no source gives their coordinates beyond reusing main's places [src:fandom/Maps] [L]
- proposed handling: use the 2019 Halloween names at Main's coordinates (see `halloween-place-names`) [src:fandom/Halloween_Map] [L]
- related conflicts: `halloween-place-names` [src:derived/kb-crossref] [H]
- files: `maps/places.md`, `modes/halloween.md` [src:derived/kb-crossref] [H]

## place-spawns

- Whether the original server tied buildings to place labels as survev's `placeSpawns` does, beyond fandom's Los Perdidos remark [src:fandom/Desert_Town] [src:survev/server/src/game/map.ts:586-648] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `maps/places.md` [src:derived/kb-crossref] [H]

## todesfelde-rename

- When "Cordial Creek" was renamed to Todesfelde (fandom gives no version) [src:fandom/Maps] [L]
- proposed handling: documentation gap only; no gameplay impact, keep as a research lead [src:derived/kb-crossref] [L]
- files: `maps/places.md` [src:derived/kb-crossref] [H]

## mode-place-names

- Place names for original Savannah, Cobalt and Turkey (survev inherits Main's) [src:derived/mapdefs-dump] [L]
- proposed handling: inherit Main's place names (survev) [src:derived/mapdefs-dump] [L]
- files: `maps/places.md` [src:derived/kb-crossref] [H]

## puzzle-reset-timing

- The original server's idle-reset and error-reset timing is only known from the client puzzle blocks; survev's ticker logic is a reconstruction [src:survev/server/src/game/objects/building.ts:247-290] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `maps/puzzles.md` [src:derived/kb-crossref] [H]

## scheduled-unlock-system

- Whether the original scheduled-unlock system was generic (survev `unlocks.timings`) or special-cased for the Twins bunker [src:survev/shared/defs/mapDefs.ts:168-176] [L]
- proposed handling: implement a generic scheduled-unlock list (survev style); behaviour is identical for the Twins bunker [src:survev/shared/defs/mapDefs.ts:168-176] [L]
- files: `maps/puzzles.md` [src:derived/kb-crossref] [H]

## woods-eye-bunker

- Exact v0.8.82 Woods Eye recorders: survev swaps recorder_01/02 for 08/09; fandom also lists log_07 near the entrance before the tree switches were removed [src:survev/shared/defs/maps/woodsDefs.ts:262-263] [src:wikigg/Recorders] [L]
- Does survev's 10-panel Woods Eye-bunker order (`bunker_eye_02_woods`) match the original? Only wiki.gg documents it [src:survev/shared/defs/puzzles.ts:3, wikigg/Eye_Bunker] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- related conflicts: `woods-eye-code-era` [src:derived/kb-crossref] [H]
- files: `maps/puzzles.md`, `provenance/fork-vs-original.md` [src:derived/kb-crossref] [H]

> **Mechanics**

## crush-damage-original

- Original crush damage: the fandom Dec 4, 2019 fix entry only mentions the red zone, while both perk pages' trivia say Flak Jacket / Cast Ironskin users survive crushing, so 0.8.82 may have applied a finite, reducible crush damage [src:fandom/Flak_Jacket] [src:fandom/Cast_Ironskin] [L]
- Order of perk and armour reductions in the original: multiplicative order does not change the result, but `armorPenetration` and the original Lone Survivr airdrop note ("lose half (50) health") depend on how crush damage interacts with perks [src:fandom/Lone_Survivr] [L]
- proposed handling: finite `crushDamage` 100 through perk reduction; armour behaviour as a knob (see `airdrop-crush-damage`) [src:derived/survev@9f64948d:src/gameConfig.ts:145] [L]
- related conflicts: `airdrop-crush-damage`, `steelskin-zone-bug` [src:derived/kb-crossref] [H]
- files: `mechanics/airdrop-airstrike.md`, `mechanics/damage-armor.md` [src:derived/kb-crossref] [H]

## faction-gold-drop-time

- The exact time of the original 50v50 golden military drop and how it chose its position (fandom gives neither; wiki.gg's "far away from player activity" describes the fork) [src:fandom/50v50_Map] [src:wikigg/50v50_mode] [L]
- Exact time of the v0.8.82 scheduled gold military drop (fandom marks it unknown) [src:fandom/50v50_Map] [L]
- The 50v50 gold airdrop rule (one `airdrop_crate_04` dropped near the losing team's furthest player plus a special airstrike) is survev's own design from fork 0.0.17/0.0.19; the gold military airdrop existed in the original 50v50, but its spawn rule is undocumented [src:survev/server/src/game/objects/plane.ts:233, survev/client/public/changelogRec.html:519, survev/client/public/changelogRec.html:497, fandom/Military_Air_Drop] [L]
- proposed handling: scheduled single drop, time as a knob (see `faction-gold-drop`) [src:fandom/50v50_Map] [L]
- related conflicts: `faction-gold-drop` [src:derived/kb-crossref] [H]
- files: `mechanics/airdrop-airstrike.md`, `modes/faction.md`, `provenance/balance-revert.md` [src:derived/kb-crossref] [H]

## turkey-gold-airdrop

- Did the original turkey (Thanksgiving) map drop `airdrop_crate_02tr`, and on what schedule? It exists in the client, but survev's turkey map inherits Main's crates [src:kong/relaunch-client-defs] [src:fandom/Air_Drop] [L]
- proposed handling: use `airdrop_crate_02tr` as the gold crate on the 2019 turkey map, schedule as Main [src:kong/relaunch-client-defs] [L]
- related conflicts: `turkey-gold-airdrop` [src:derived/kb-crossref] [H]
- files: `mechanics/airdrop-airstrike.md` [src:derived/kb-crossref] [H]

## boost-min-decay

- Did the original decay also stop at `minBoost`, or did Leadership simply refill to 100 each tick? Same result either way, except for the edge-case tier at exactly 100 [src:survev/server/src/game/objects/player.ts:1534] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `mechanics/boost.md` [src:derived/kb-crossref] [H]

## headshot-roll-granularity

- Was the 15 % headshot roll per pellet, per shot or per bullet in the original? survev rolls per bullet hit [src:survev/server/src/game/objects/player.ts:2463] [src:fandom/Headshot] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `mechanics/damage-armor.md` [src:derived/kb-crossref] [H]

## downed-damage-buffer

- Does `downedDamageBuffer` (0.1 s of invulnerability after a down) exist in the original? It was added to survev in 2025 with no cited source [src:derived/survev-git-ad3d7ca7] [src:derived/survev-git-decfabdd] [L]
- Does the original have the 0.1 s post-down invulnerability, and does it pause bleeding for players in a medic's revive aura? [src:survev/shared/gameConfig.ts:209] [src:survev/server/src/game/objects/player.ts:1603] [L]
- proposed handling: keep survev's 0.1 s buffer as a knob (default off for strict v0.8.82 fidelity is also defensible) [src:survev/shared/gameConfig.ts:209] [L]
- files: `mechanics/damage-armor.md`, `mechanics/downed-revive.md` [src:derived/kb-crossref] [H]

## door-swing-rule

- Is the "swing away from the player" rule identical to the original's, including the default side when a door is opened with no player (survev uses −1)? [src:survev/server/src/game/objects/obstacle.ts:833-847] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `mechanics/doors-layers-ceilings.md` [src:derived/kb-crossref] [H]

## lab-door-autoclose

- Exact original auto-close retry rule for automatic lab doors (survev postpones while a player overlaps the closed footprint) [src:survev/server/src/game/objects/obstacle.ts:384-419] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `mechanics/doors-layers-ceilings.md` [src:derived/kb-crossref] [H]

## stairs-bullet-layer

- How did the original pick the bullet layer when aiming diagonally on stairs (survev requires an exact quarter-turn match)? [src:survev/server/src/game/objects/player.ts:2272-2290] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `mechanics/doors-layers-ceilings.md` [src:derived/kb-crossref] [H]

## reviver-speed

- Original reviver movement speed (survev's 6 is a self-declared estimate) [src:survev/server/src/game/objects/player.ts:4697] [L]
- proposed handling: reviver speed = normal formula × 0.5 (fandom), survev's 6 as fallback [src:fandom/Knocked_Out] [L]
- related conflicts: `reviver-speed` [src:derived/kb-crossref] [H]
- files: `mechanics/downed-revive.md` [src:derived/kb-crossref] [H]

## faction-knock-credit

- Did the original give knock credit or assists for downs that end in a team wipe in 50v50, where the "group" is the whole faction? [src:survev/server/src/game/gameModeManager.ts:281] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `mechanics/downed-revive.md` [src:derived/kb-crossref] [H]

## explosion-ray-obstacles

- Did the original stop explosion rays at obstacles taller than 0.5, or use another rule (e.g. `collidable` plus `isWall`)? [src:survev/server/src/game/objects/explosion.ts:131-137] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `mechanics/explosions.md` [src:derived/kb-crossref] [H]

## flak-explosion-stack

- Fandom gives Flak Jacket "91 % reduction from grenades and shrapnel" (0.9 + 0.1 stacked multiplicatively). survev applies 0.9 to explosions and shrapnel, but the general 0.1 only to non-explosion hits; which did the original do? [src:fandom/Flak_Jacket] [src:survev/server/src/game/objects/player.ts:2470-2476] [L]
- proposed handling: stack 0.9 with the general 0.1 behind a knob (see `flak-explosion-reduction`) [src:fandom/Flak_Jacket] [L]
- related conflicts: `flak-explosion-reduction` [src:derived/kb-crossref] [H]
- files: `mechanics/explosions.md` [src:derived/kb-crossref] [H]

## gas-stage-table

- The real 0.8.82 server stage table is unknown. survev's table matches fandom but may itself be derived from the wiki; there are no packet captures in the sources [src:fandom/Red_Zone] [src:survev/server/src/game/objects/gas.ts:14-117] [L]
- proposed handling: use survev's stage table (matches fandom), configurable [src:fandom/Red_Zone] [src:survev/server/src/game/objects/gas.ts:14-117] [L]
- files: `mechanics/gas.md` [src:derived/kb-crossref] [H]

## gas-center-distribution

- Did the original apply the 0.75-radius edge clamp, and what distribution produced "more likely to move towards the edges" (0.4.1)? [src:changelog/0.4.1] [src:survev/server/src/game/objects/gas.ts:284-289] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `mechanics/gas.md` [src:derived/kb-crossref] [H]

## faction-gas-durations

- Did 50v50 (880-unit map) use different gas durations? No source says so [src:fandom/50v50_Map] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `mechanics/gas.md` [src:derived/kb-crossref] [H]

## disconnected-in-gas

- How did the original treat disconnected players' bodies in gas (normal stage damage or a special rule)? [src:wikigg/Red_Zone] [L]
- proposed handling: normal stage damage for v0.8.82 (survev's flat 22 is a 2026 fork change, see `gas-escalation`) [src:derived/survev-git-a39e9ea8] [L]
- related conflicts: `gas-escalation` [src:derived/kb-crossref] [H]
- files: `mechanics/gas.md` [src:derived/kb-crossref] [H]

## bandage-full-health-check

- Was the bandage refusal at full health exact (`health == maxHeal`) in the original, or `health >= maxHeal`? With fractional HP from boost the difference matters [src:survev/server/src/game/objects/player.ts:3255] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `mechanics/heal-actions.md` [src:derived/kb-crossref] [H]

## reload-cancels-heal

- Did reload input cancel a heal in the original? survev silently ignores it [src:survev/server/src/game/objects/player.ts:3501-3505] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `mechanics/heal-actions.md` [src:derived/kb-crossref] [H]

## loot-despawn

- Did original ground loot ever despawn? [src:survev/server/src/game/objects/loot.ts:233-311] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `mechanics/loot.md` [src:derived/kb-crossref] [H]

## stack-redrop

- Exact original rule for re-dropping the remainder of a partially picked-up stack (survev pushes it 4–4.5 u/s opposite the player's facing) [src:survev/server/src/game/objects/player.ts:3983-3994] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `mechanics/loot.md` [src:derived/kb-crossref] [H]

## original-only-tiers

- The contents of the original-only tiers `tier_eye_01`, `tier_chrys_02b`, `tier_sledgehammer`, `tier_potato_helmet` (referenced by 0.8.82 loot spawners, absent from survev) [src:kong/relaunch-client-defs] [src:fandom/Loot_Spawners] [L]
- proposed handling: define the four tiers from fandom's Loot Spawners notes; until then reuse the nearest survev tier [src:fandom/Loot_Spawners] [L]
- files: `mechanics/loot.md` [src:derived/kb-crossref] [H]

## mobile-analog-speed

- Original mobile analog movement: did `touchMoveLen` scale speed below full deflection before 0.6.2? [src:changelog/0.6.2] [src:survev/server/src/game/objects/player.ts:1925-1927] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `mechanics/movement.md` [src:derived/kb-crossref] [H]

> **Modes and events**

## beach-2020-unknowns

- The 2020 Tier Beach weights, Ice Box density and whether the 2020 map changed building counts are unknown (fandom stubs) [src:fandom/Ice_Box] [src:fandom/Beach_Map] [L]
- The Water Balloon's capacity and the exact Wet duration ("about 2 seconds") are not documented [src:fandom/Water_Balloon] [src:fandom/Wet_Effect] [L]
- proposed handling: post-0.8.82 optional content; leave unimplemented until sourced [src:fandom/Beach_Map] [L]
- files: `modes/beach.md` [src:derived/kb-crossref] [H]

## birthday-map-size

- Early-access map size before the 0.2.0 increase is unknown; survev uses 720 / 736 [src:changelog/0.2.0] [src:survev/shared/defs/maps/birthdayDefs.ts:105-111] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `modes/birthday.md` [src:derived/kb-crossref] [H]

## birthday-schedule

- Whether the fork runs Birthday only around Oct 31 or as a regular mode is not stated in the sources [src:survev/client/public/changelogRec.html:385-386] [L]
- proposed handling: fork-side question; the v0.8.82 target is unaffected [src:derived/kb-crossref] [L]
- files: `modes/birthday.md` [src:derived/kb-crossref] [H]

## cobalt-timeout-class

- Whether the original assigned a random class or the highlighted one when time ran out (fandom: random; wiki.gg: the selected one) [src:fandom/Cobalt_Map] [src:wikigg/Cobalt_mode] [L]
- proposed handling: 20 s menu timer; assign the highlighted class (wiki.gg) with random as a knob [src:survev/shared/gameConfig.ts:228] [src:wikigg/Cobalt_mode] [L]
- related conflicts: `cobalt-role-timeout` [src:derived/kb-crossref] [H]
- files: `modes/cobalt.md` [src:derived/kb-crossref] [H]

## cobalt-mythic-airdrop-rarity

- How rare the mythic air drop was: survev uses weight 1 of 11 [src:survev/shared/defs/maps/cobaltDefs.ts:40-43] vs fandom "very rarely" [src:fandom/Class_Pod] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `modes/cobalt.md` [src:derived/kb-crossref] [H]

## class-gun-weights

- Exact v0.8.82 class gun weights (fandom shows "???") [src:fandom/Loot_tables/Class_Pod] [L]
- proposed handling: survev's pre-fork class gun tables (fork-only guns removed) [src:derived/survev-git-121958d2] [L]
- related conflicts: `cobalt-class-guns` [src:derived/kb-crossref] [H]
- files: `modes/cobalt.md` [src:derived/kb-crossref] [H]

## desert-mk45g-weight

- Original weight of the Mk45G in desert `tier_guns` and airdrops (fandom lists "???"; survev's 0.1 / 2.5 are marked uncertain) [src:fandom/Desert_Map, survev/shared/defs/maps/desertDefs.ts:116] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `modes/desert.md` [src:derived/kb-crossref] [H]

## desert-alt-barn

- Was the desert alternate barn (`barn_02d`) the 0.8.5 replacement for the removed alternate barn, or was no alternate barn spawned at all in 0.8.82? [src:fandom/Changelog, kong/relaunch-client-defs] [L]
- proposed handling: `barn_02d` behind a knob defaulting to off for 0.8.82 (see `desert-alt-barn`) [src:fandom/Changelog] [L]
- related conflicts: `desert-alt-barn` [src:derived/kb-crossref] [H]
- files: `modes/desert.md` [src:derived/kb-crossref] [H]

## desert-peacemaker-duals

- Whether airdrop Peacemakers come as duals (fandom, 0.8.5) — survev's table holds a single `colt45` [src:fandom/Changelog, survev/shared/defs/maps/desertDefs.ts:115] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `modes/desert.md` [src:derived/kb-crossref] [H]

## event-end-dates

- End dates are unknown for Awesome blossoms (2019), the 2020 spring event, Eggsplosion, both Sinko de Ammo runs, Ultimate Sacrifice 2020 and Storm Mode [src:fandom/Changelog] [L]
- proposed handling: documentation gap only; no gameplay impact, keep as a research lead [src:derived/kb-crossref] [L]
- files: `modes/events.md` [src:derived/kb-crossref] [H]

## event-effect-numbers

- Exact numbers for wind speed change, hail damage per second, Sugar Rush speed per egg, piñata speed and the Phoenix drain rate are not documented [src:fandom/Wind] [src:fandom/Storm_Cloud] [src:fandom/Sugar_Rush] [src:fandom/Phoenix] [L]
- proposed handling: post-0.8.82 event content; leave unimplemented until sourced [src:fandom/Events] [L]
- files: `modes/events.md` [src:derived/kb-crossref] [H]

## namu-meteor-rotation

- Which map namu's "Meteor" (유성) rotation entry refers to is unconfirmed (probably Desert) [src:namu/Surviv.io/이벤트] [L]
- proposed handling: documentation gap only; no gameplay impact, keep as a research lead [src:derived/kb-crossref] [L]
- files: `modes/events.md` [src:derived/kb-crossref] [H]

## faction-minimap-reveal

- Whether v0.8.82 revealed firing enemies on the minimap the way survev's 1 s `timeUntilHidden` does; wiki.gg only says teammates can see if allies are in a fight [src:survev/server/src/game/weaponManager.ts:1013-1024] [src:wikigg/50v50_mode] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- status: resolved for the rebirth by the owner (2026-10-08), who played the original: enemies show only while on screen, so the rebirth shows no reveal (`rules.roles.factionRevealTime` 0 by default); the knob and its code stay, 1 restores survev's 1 s reveal (implemented in the survev parity wave; `rebirth-deviations.md` "Owner's 50v50 feedback") [src:user/2026-10-08-faction-feedback] [src:survev/server/src/game/weaponManager.ts:1013-1024] [H]
- files: `modes/faction.md` [src:derived/kb-crossref] [H]

## faction-crate-count-note

- The fork v0.0.18 note "normal crates increased from 38 to 55" does not match survev's current `crate_01: 38`; which value the fork actually uses over time is unclear [src:survev/client/public/changelogRec.html:508] [src:survev/shared/defs/maps/factionDefs.ts:439] [L]
- proposed handling: fork-side question; the v0.8.82 target is unaffected [src:derived/kb-crossref] [L]
- files: `modes/faction.md` [src:derived/kb-crossref] [H]

## faction-loot-weights

- Original 50v50 loot weights for `tier_guns` / `tier_airdrop_uncommon` are only known from survev's pre-fork reconstruction (marked estimates in places) [src:derived/survev@4b291f4d:shared/defs/maps/factionDefs.ts] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `modes/faction.md` [src:derived/kb-crossref] [H]

## halloween-2018-pumpkins

- Was the 2018 map (before red pumptatos) using `cache_pumpkin_02` jack-o'-lanterns in the slots where 2019 used `cache_pumpkin_03`? [src:changelog/0.6.4, changelog/0.8.7, fandom/Jack-o'-Lantern] [L]
- proposed handling: documentation gap only; no gameplay impact, keep as a research lead [src:derived/kb-crossref] [L]
- files: `modes/halloween.md` [src:derived/kb-crossref] [H]

## main-spring-default

- When did main_spring stop being the default map in 2019 (fandom only implies the summer complex replaced the spring one on Jul 14, 2019)? [src:fandom/Changelog, fandom/Teahouse] [L]
- proposed handling: documentation gap only; no gameplay impact, keep as a research lead [src:derived/kb-crossref] [L]
- files: `modes/main.md` [src:derived/kb-crossref] [H]

## ko-normal-map-name

- Korean community name for the plain normal map (only event names are found in namu.wiki snippets) [src:namu/Surviv.io/이벤트] [L]
- proposed handling: documentation gap only; no gameplay impact, keep as a research lead [src:derived/kb-crossref] [L]
- files: `modes/main.md` [src:derived/kb-crossref] [H]

## spud-gun-weight

- The Spud Gun's original weight in the Red Emblem Case and airdrops ("???" on fandom) [src:fandom/Potato_Map] [L]
- proposed handling: cannon 1, Spud Gun 0.1 (survev pre-fork) as knobs [src:derived/survev-git-70a5d40f] [L]
- related conflicts: `potato-airdrop-rare`, `potato-ring-case` [src:derived/kb-crossref] [H]
- files: `modes/potato.md` [src:derived/kb-crossref] [H]

## silo-shack-placement

- Whether the v0.8.82 silo shack was a fixed centre spawn (survev, namu) or merely "normally near the center" with edge spawns possible [src:survev/shared/defs/maps/potatoDefs.ts:164-173] [src:fandom/Silo_Shack] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `modes/potato.md` [src:derived/kb-crossref] [H]

## potato-kill-rotation

- Whether original kill rotation also triggered for kills by explosives or only for the weapon slot used; survev uses the damage's `weaponSourceType`/`gameSourceType` [src:survev/server/src/game/objects/player.ts:4049-4050] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `modes/potato.md` [src:derived/kb-crossref] [H]

## savannah-lake-centre

- Whether the original large lake was exactly at the map centre (fandom) or only near it [src:fandom/Lake] [src:derived/survev-git-bbe1a377] [L]
- proposed handling: fixed at the centre (fandom), as a knob [src:fandom/Lake] [L]
- related conflicts: `savannah-lakes` [src:derived/kb-crossref] [H]
- files: `modes/savannah.md` [src:derived/kb-crossref] [H]

## savannah-firepower

- Whether Firepower was in the original Savannah perk pool: the 0.8.3 post counts eleven perks and fandom's Savannah list omits it, but fandom's Tier Perks table includes it [src:fandom/Changelog] [src:fandom/Savannah_Map] [src:fandom/Loot_tables] [L]
- proposed handling: leave Firepower out of the Savannah pool (0.8.3 post counts eleven perks), as a knob [src:fandom/Changelog] [L]
- related conflicts: `savannah-perk-pool` [src:derived/kb-crossref] [H]
- files: `modes/savannah.md` [src:derived/kb-crossref] [H]

## snow-trees-and-crates

- Which snow tree (`tree_01x` or `tree_10`) the December 2018 map used, and whether `tree_11` was spawned outside structures [src:kong/relaunch-client-defs, fandom/Festive_Tree] [L]
- The exact original snowball crate density and festive-tree placement [src:fandom/Snowball_Crate, fandom/Festive_Tree] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- related conflicts: `snow-tree-id`, `snowball-crate-count` [src:derived/kb-crossref] [H]
- files: `modes/snow.md` [src:derived/kb-crossref] [H]

## turkey-2019-map

- How many green squashes spawned in 2019 ("scarcely") and whether the 2019 map changed anything besides adding them [src:fandom/Green_Squash, survev/shared/defs/maps/turkeyDefs.ts:52] [L]
- Whether the 2019 Thanksgiving map def had its own biome colours (the 0.8.82 client no longer contains it) [src:kong/relaunch-client-defs, fandom/Changelog] [L]
- proposed handling: main map + `turkeyMode` + green squashes, main palette (see `turkey-map-look`) [src:kong/relaunch-client-defs] [L]
- related conflicts: `turkey-map-look` [src:derived/kb-crossref] [H]
- files: `modes/turkey.md` [src:derived/kb-crossref] [H]

## woods-tree-counts

- Original tree counts on woods before and after 0.8.1's "reduced number of trees" (survev uses 1100/1100/150 + 84 stumps) [src:changelog/0.8.1, survev/shared/defs/maps/woodsDefs.ts:246-249] [L]
- proposed handling: 1100 / 1100 / 150 (post-0.8.1 map message) [src:derived/survev-git-c94e4c39] [L]
- related conflicts: `woods-tree-counts` [src:derived/kb-crossref] [H]
- files: `modes/woods.md` [src:derived/kb-crossref] [H]

## woods-lake-pavilion

- Was the plain autumn `woods` def in 0.8.82 the one with the lake and pavilion (the client's audio suggests yes), and did the snow variant have them? [src:kong/relaunch-client-defs, fandom/Woods_Map] [L]
- proposed handling: autumn woods with the lake and `teapavilion_01w` (see `woods-pavilion`) [src:kong/relaunch-client-defs] [L]
- related conflicts: `woods-pavilion` [src:derived/kb-crossref] [H]
- files: `modes/woods.md` [src:derived/kb-crossref] [H]

## woods-bag-sizes

- Original bag sizes for strobes/MIRVs on woods (only frag and smoke are overridden in survev) [src:survev/shared/defs/maps/woodsDefs.ts:59-62] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `modes/woods.md` [src:derived/kb-crossref] [H]

> **namu.wiki**

## namu-soviet-crate

- 소련 상자 120 vs 140: namu 판 r1913 전후의 상자 표를 브라우저로 직접 확인할 필요가 있다 [src:namu/Surviv.io/오브젝트] [L]
- proposed handling: 140 HP from the defs (see `soviet-crate-hp`) [src:kong/relaunch-client-defs] [L]
- related conflicts: `soviet-crate-hp` [src:derived/kb-crossref] [H]
- files: `namu.md` [src:derived/kb-crossref] [H]

## namu-gold-airdrop-list

- 끝이 금색인 보급 상자의 무기 목록(CZ-3A1, OTs-38, M1 Garand, M249, M4A1-S, AWM-S)이 0.8.82 보급 테이블과 같은지 survev `tier_airdrop_*`와 대조 필요 [src:namu/Surviv.io/오브젝트] [L]
- proposed handling: compare with survev `tier_airdrop_rare` when building the airdrop tables [src:survev/shared/defs/maps/baseDefs.ts:90-92] [L]
- files: `namu.md` [src:derived/kb-crossref] [H]

## namu-bunker-order

- 벙커 퍼즐 "비밀번호 순서"(달걀→히드라→폭풍→소라→건널목→도끼)가 실제 퍼즐 정의인지, 단순 벙커 목록 순서인지 불명확 [src:namu/Surviv.io/건물] [L]
- proposed handling: documentation gap only; no gameplay impact, keep as a research lead [src:derived/kb-crossref] [L]
- files: `namu.md` [src:derived/kb-crossref] [H]

## club-vault-letters

- 크림슨 클럽 금고(к, р, у, г) 서술은 survev `club_01` 퍼즐과 대조 필요 [src:namu/Surviv.io/오브젝트, survev/shared/defs/puzzles.ts:18] [L]
- proposed handling: check against survev's `club_01` puzzle when implementing the club [src:survev/shared/defs/puzzles.ts:18] [L]
- files: `namu.md` [src:derived/kb-crossref] [H]

## namu-spas12-falloff

- SPAS-12 "거리별 피해 감소 85%"가 falloff 값인지 다른 의미인지 스니펫만으로 알 수 없다 [src:namu/Surviv.io/무기] [L]
- proposed handling: use the def falloff; the namu figure needs the full page [src:namu/Surviv.io/무기] [L]
- files: `namu.md` [src:derived/kb-crossref] [H]

> **Provenance (fork vs original)**

## last-breath-fork-buff

- Where is the Last Breath (`final_bugle`) "overall buff" that balance.txt logs for 0.1.2? survev's code just before the change (range 60, 5 s, +0.2 scale, x1.08 damage) equals HEAD, so the buff is either outside these numbers or happened before survev's 2025-07 baseline [src:balance/178, survev/shared/defs/gameObjects/perkDefs.ts:48, derived/git-ae55c9a8:server/src/game/weaponManager.ts:570] [L]
- proposed handling: fork-side question; the v0.8.82 target is unaffected [src:derived/kb-crossref] [L]
- related conflicts: `last-breath-duration` [src:derived/kb-crossref] [H]
- files: `provenance/balance-revert.md` [src:derived/kb-crossref] [H]

## twins-original-unlock

- The original Twins bunker opening time: survev's pre-fork value (circle 2 + 5 s) is itself a reconstruction [src:derived/git-ae55c9a8:shared/defs/maps/cobaltDefs.ts:48] [L]
- How did the original Twins bunker (0.8.8) open before survev's puzzle and 30-second timer? The original sublevel has four `lab_door_locked_01` doors and a `control_panel_03`, which fits a timed server unlock, but the timing itself is server-side and survev's pre-fork value (circle 2 + 5 s) is a reconstruction [src:changelog/0.8.8, survev/client/public/changelogRec.html:210, kong/relaunch-client-defs, derived/git-ae55c9a8] [L]
- proposed handling: timed server unlock at circleIdx 2 + 5 s with the original sublevel layout (see `twins-unlock-time`, `twins-bunker-puzzle`) [src:kong/relaunch-client-defs] [src:derived/git-ae55c9a8] [L]
- related conflicts: `twins-unlock-time`, `twins-bunker-puzzle` [src:derived/kb-crossref] [H]
- files: `provenance/balance-revert.md`, `provenance/fork-vs-original.md` [src:derived/kb-crossref] [H]

## awm-headshot-rule

- The original AWM-S could not headshot in survev's reconstruction (headshots only when headshotMult > 1); no wiki confirms that rule for v0.8.82 [src:derived/git-c30b8d9a] [L]
- proposed handling: headshots only when `headshotMult` > 1, as a knob (see `headshot-mult-1-rule`) [src:fandom/Headshot] [L]
- related conflicts: `headshot-mult-1-rule` [src:derived/kb-crossref] [H]
- files: `provenance/balance-revert.md` [src:derived/kb-crossref] [H]

## redrawn-assets

- The Boffy emote and Fragtastic outfit were re-drawn by survev; asset fidelity to the 2020 originals has not been checked [src:survev/client/public/changelogRec.html:166, survev/client/public/changelogRec.html:389] [L]
- proposed handling: documentation gap only; no gameplay impact, keep as a research lead [src:derived/kb-crossref] [L]
- files: `provenance/fork-vs-original.md` [src:derived/kb-crossref] [H]

## relaunch-def-changes

- whether any 0.9.x (2026) relaunch fix changed a definition value [src:kong/relaunch-changelog] [L]
- proposed handling: diff the relaunch bundle defs against the decompiled 0.8.82 client (e.g. Spud Gun explosion 12 vs 13) [src:kong/relaunch-client-defs] [src:derived/survev@8715a605:client/js/app.js:114914] [L]
- related conflicts: `spud-gun-explosion-damage` [src:derived/kb-crossref] [H]
- files: `provenance/live-vs-survev.md` [src:derived/kb-crossref] [H]

## fandom-infobox-era

- which era each fandom infobox reflects (page timestamps are last-edit dates, not data dates) [src:derived/infobox-diff] [L]
- proposed handling: treat fandom infobox numbers as [M] at best and prefer client defs (rule 1) [src:derived/infobox-diff] [L]
- related conflicts: `wiki-vs-survev-tables` [src:derived/kb-crossref] [H]
- files: `provenance/wiki-vs-survev.md` [src:derived/kb-crossref] [H]

> **UI**

## atlas-density

- Exact original sprite scales per object are in the shared defs (other KB files); whether the original atlases were pre-rendered at a different base density than survev's SVG rasterisation is not verified [src:derived/survev@8715a605:client/assets] [src:survev/client/atlas-builder/atlasDefs.ts:36-40] [L]
- proposed handling: documentation gap only; no gameplay impact, keep as a research lead [src:derived/kb-crossref] [L]
- files: `ui/audiovisual-style.md` [src:derived/kb-crossref] [H]

## asset-licensing

- Asset licensing: the art and audio appear to be the original surviv.io assets; survev's GPL licence covers code, and the repository does not state an asset licence [src:survev/client/public/attribution.txt] [src:survev/LICENSE] [L]
- proposed handling: do not ship survev/original art or audio without a licence; keep the asset pipeline's own art [src:survev/LICENSE] [L]
- files: `ui/audiovisual-style.md` [src:derived/kb-crossref] [H]

## mobile-aim-assist

- Fandom mentions mobile aim assist and an optional crate auto-punch; the 0.8.82 web client has no such code, so these may be native-app or post-0.8.82 features [src:fandom/Surviv.io_Mobile] [src:survev/client/src/ui/touch.ts:580-660] [L]
- Fandom says mobile had aim assist and an option to auto-punch crates; neither exists in the survev or original 0.8.82 web client code, so it is probably native-app or post-0.8.82 behaviour [src:fandom/Surviv.io_Mobile] [src:survev/client/src/ui/touch.ts:580-660] [L]
- proposed handling: out of scope for the v0.8.82 web client (native-app or later feature) [src:fandom/Surviv.io_Mobile] [L]
- files: `ui/controls.md`, `ui/hud.md` [src:derived/kb-crossref] [H]

## equip-grenade-binds

- `EquipFragGrenade` (15) and `EquipSmokeGrenade` (16) exist in the enum but have no bind definition in either client; their intended behaviour is unknown [src:survev/shared/gameConfig.ts:73-74] [src:derived/survev@8715a605:client/js/app.js:77749-77750] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `ui/controls.md` [src:derived/kb-crossref] [H]

## kill-leader-rule

- The original server's exact kill-leader rule (tie-breaking, when the role moves) is not in the client; survev picks the living player with the most kills ≥ 3 [src:survev/server/src/game/objects/player.ts:545-549] [src:fandom/Kill_Leader] [L]
- proposed handling: survev rule (living player with the most kills, at least 3), as a knob [src:survev/server/src/game/objects/player.ts:545-549] [L]
- files: `ui/hud.md` [src:derived/kb-crossref] [H]

## team-room-codes

- The original team-room code format and lobby timeouts are server-side and not in the client; survev's 4-character codes and 8-minute idle kick are reconstructions [src:survev/server/src/teamMenu.ts:345-382] [L]
- proposed handling: rule 5: keep survev's current value or behaviour as a config knob until a primary source settles it [src:derived/readme-precedence] [L]
- files: `ui/menus.md` [src:derived/kb-crossref] [H]

## logged-out-loadout

- Fandom says Survivr Pass quests and the loadout needed an account until July 2020; whether 0.8.82 let logged-out players open the loadout menu is not confirmed by the client code [src:fandom/Loadout] [src:changelog/0.8.0] [L]
- proposed handling: documentation gap only; no gameplay impact, keep as a research lead [src:derived/kb-crossref] [L]
- files: `ui/menus.md` [src:derived/kb-crossref] [H]

## Conflicts

- none found; disagreements are merged in `conflicts.md` [src:derived/none] [L]

## Open questions

- none beyond the entries above [src:derived/none] [L]
