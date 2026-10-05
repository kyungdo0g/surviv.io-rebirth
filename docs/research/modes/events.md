# Limited-time events

> Every limited-time event, seasonal reskin and event-only mechanic of surviv.io, with dates and rules.
> Maps that have their own file are only listed in the chronology here: `modes/main.md`, `desert.md`, `woods.md`, `faction.md`, `potato.md`, `halloween.md`, `snow.md`, `savannah.md`, `cobalt.md`, `beach.md`, `birthday.md`, `turkey.md`. This file gives full detail for everything else: Egg-stravaganza, Meteor Shower, the Desert Rain series schedule, the spring/summer Classic variants, and the post-0.8.82 events (Frenemies, St. Patrick's, Eggsplosion, Sinko de Ammo, Lasr Swrds, Ultimate Sacrifice, Storm, Contact, Inferno, Event Rotation).
> Start dates come from the changelog file when an update started the event ([H]). End dates come from the in-game news posts copied into the fandom Changelog ([M]).
> Nothing from the post-0.8.82 events exists in the relaunch client or in survev: none of their item, obstacle or effect ids are defined there. All their numbers come from the wikis.

## How events were run (up to 0.8.82)

- Events changed loot, introduced new weapons and often a new map; most were Squad-only, but Egg-stravaganza, Happy Spookiversary and other seasonal events used other team sizes [src:fandom/Events] [M]
- An event replaced one core queue: e.g. on Feb 5, 2019 normal duos were swapped for squads until the end of the 50v50 event [src:fandom/Changelog] [src:fandom/Game_Modes] [M]
- 50v50 is the only event with its own team mode (100 players, 2 factions); every other event map uses an 80-player battle royale [src:fandom/Game_Modes] [src:kong/relaunch-client-defs] [H]
- The relaunch (0.8.82) client defines event maps by mapId with a play-button icon and CSS class: 1 Desert (flare gun icon, `btn-mode-desert`, `desertMode`), 2 Woods (King of the Woods icon, `btn-mode-woods`, `woodsMode`), 3 50v50 (star, `btn-mode-faction`, `factionMode`, 100 players), 4 Potato (potato icon, `btn-mode-potato`, `potatoMode`), 5 Savannah (The Hunted icon, `btn-mode-savannah`, `sniperMode`), 6 Halloween (pumpkin, `btn-mode-halloween`, `spookyKillSounds`), 7 Cobalt (`btn-mode-cobalt`, `perkMode`) [src:kong/relaunch-client-defs] [H]
- Seasonal variants reuse a base map id; survev registers them as separate map defs: `main_spring`, `main_summer`, `potato_spring`, `woods_snow`, `woods_spring`, `woods_summer`, `turkey`, plus fork-only `birthday`, `beach`, `faction_potato` [src:survev/shared/defs/mapDefs.ts:42-61] [H]
- 0.7.0 (Jan 31, 2019) secretly "Added Somewhat Better Event Support" and renamed the Default map to Main and the Autumn map to Woods [src:fandom/Changelog] [M]
- "Better event mode support" was still in the changelog's [Unreleased] list at 0.8.82 [src:changelog/Unreleased] [H]
- Game-mode stats were tracked separately per mode from 0.7.9 (June 25, 2019), with stats URLs using `mapId` (1 = desert, 2 = woods, 3 = 50v50) [src:changelog/0.7.9] [src:fandom/Changelog] [H]
- survev (fork) has no automatic rotation: the operator lists active `modes` as `{ mapName, teamMode, enabled }` entries; the default config runs `main` on Solo, Duo and Squad [src:survev/config.ts:33-37] [H]

## Chronology of limited-time events

> Map column: the map def the event used. "→ file" means the map has its own mode file.

| event (news title) | start | end | map / mode | queue | notes | sources |
|---|---|---|---|---|---|---|
| Christmas 2017 trees | Dec 2017 | – | normal map | all | all trees replaced by decorated, more transparent Christmas trees | [src:fandom/Removed_Features] [M] |
| Valentine's Day 2018 reskin | Feb 14, 2018 | Feb 14, 2018 | normal map | all | crate texture and consumable reskins (see below) | [src:fandom/Removed_Features] [M] |
| Egg-stravaganza / Egg-pocalypse | Apr 1, 2018 (0.3.2) | Apr 2, 2018 (0.3.21) | normal map | all | seasonal egg obstacle dropping disguise outfits | [src:changelog/0.3.2, changelog/0.3.21, fandom/Events] [H] |
| Meteor Shower | Aug 9, 2018 | Aug 11, 2018 | normal map | squad | massively increased flare gun spawns | [src:fandom/Changelog, fandom/Events] [M] |
| Desert rain | Sep 22, 2018 (0.6.1) | Sep 24, 2018 | desert → `desert.md` | squad | first desert map | [src:changelog/0.6.1, fandom/Events] [H] |
| Into the woods | Oct 18, 2018 (0.6.3) | Oct 22, 2018 | woods (autumn) → `woods.md` | squad | LMGs and shotguns only | [src:changelog/0.6.3, fandom/Events] [H] |
| Happy Spookiversary | Oct 29, 2018 (0.6.4) | Nov 1, 2018 | halloween → `halloween.md` | solo | first solo-only event; 1st anniversary | [src:changelog/0.6.4, fandom/Events] [H] |
| Gunfight at the Deadeye Saloon | Nov 8–9, 2018 (0.6.5) | Nov 13, 2018 | desert → `desert.md` | squad | saloon, M1911, M1A1, Vector .45 | [src:changelog/0.6.5, fandom/Events] [H] |
| Turkey shoot | Nov 19, 2018 (0.6.6) | Nov 24, 2018 | normal map (see `turkey.md`) | all | M1100 turkey-feather hits; "Winner winner turkey dinner!" | [src:changelog/0.6.6, fandom/Changelog] [H] |
| If a bunker opens in a forest ... | Dec 6, 2018 (0.6.71) | Dec 10, 2018 | woods → `woods.md` | squad | stone hammer, hardstone blocks, eye bunker on woods | [src:changelog/0.6.71, fandom/Changelog] [H] |
| Frozen deserts | Dec 12–13, 2018 (0.6.8) | Dec 19, 2018 | desert → `desert.md` | solo | first solo flare gun mode | [src:changelog/0.6.8, fandom/Changelog] [H] |
| Snow-covered Island | Dec 19, 2018 (0.6.9) | Jan 1, 2019 | snow → `snow.md` | all | snowballs, OTs-38 | [src:changelog/0.6.9, fandom/Changelog] [H] |
| Two survivrs walk into a BAR | Jan 10, 2019 (0.6.95) | Jan 14, 2019 | woods_snow → `woods.md` | duo | duos-only snowy woods mode | [src:changelog/0.6.95, fandom/Changelog] [H] |
| Incursion recursion | Jan 31, 2019 (0.7.0) | Feb 10, 2019 | faction → `faction.md` | 50v50 | extended to Feb 10; duos replaced by squads from Feb 5 | [src:changelog/0.7.0, fandom/Changelog] [H] |
| Danger close | Feb 22, 2019 (0.7.1) | Mar 3, 2019 | desert → `desert.md` | squad | strobes, aged faction statues | [src:changelog/0.7.1, fandom/Changelog] [H] |
| Great clips | Mar 14, 2019 (0.7.2) | Mar 18, 2019 | faction → `faction.md` | 50v50 | lieutenant role | [src:changelog/0.7.2, fandom/Changelog] [H] |
| Awesome blossoms (Spring Fever) | Mar 21, 2019 (0.7.3) | unknown | main_spring (see below) | all | teahouse, naginata, cherry trees | [src:changelog/0.7.3, fandom/Events] [H] |
| Rotato potato | Apr 1, 2019 (0.7.4) | Apr 2, 2019 | potato_spring → `potato.md` | all | April Fools | [src:changelog/0.7.4, changelog/0.7.41, fandom/Changelog] [H] |
| Hunt or be hunted (King of the Woods) | Apr 15, 2019 (0.7.5) | Apr 22, 2019 | woods_spring → `woods.md` | solo, squad from Apr 19 | Woods King, pavilion, PKP | [src:changelog/0.7.5, fandom/Changelog] [H] |
| Firepower-up | Apr 25, 2019 (0.7.51) | Apr 29, 2019 | desert → `desert.md` | squad | Firepower on aged Lieutenant Helmets | [src:changelog/0.7.51, fandom/Changelog] [H] |
| Potatoheaded | Apr 29, 2019 (0.7.52) | May 1, 2019 | potato (main version) → `potato.md` | all | Rare Potato, K-pot-ato | [src:changelog/0.7.52, fandom/Changelog] [H] |
| Pills here | May 10, 2019 (0.7.6) | May 18, 2019 | faction → `faction.md` | 50v50 | medic role | [src:changelog/0.7.6, fandom/Changelog] [H] |
| Your tuber is here | Jun 7, 2019 (0.7.8) | Jun 11, 2019 | potato → `potato.md` | all | potato cannon | [src:changelog/0.7.8, fandom/Changelog] [H] |
| Scouting ahead (Desert Rain) | Jun 25, 2019 (0.7.9) | Jul 2, 2019 | desert → `desert.md` | squad | P30L from hardstone boulders | [src:changelog/0.7.9, fandom/Changelog] [H] |
| Summer Bloom | Jun 25, 2019 (0.7.9) | Jul 14, 2019 | main_summer (see below) | solo, duo | Scout Elite in the scout hut | [src:changelog/0.7.9, fandom/Events] [H] |
| Take the throne | Jul 7, 2019 | Jul 14, 2019 | woods_summer → `woods.md` | solo, squad | Woods King returns | [src:fandom/Changelog] [M] |
| They see me role-in | Jul 21, 2019 | Jul 28, 2019 | faction → `faction.md` | 50v50 | dual P30L in gold military drops | [src:fandom/Changelog, fandom/Events] [M] |
| Potato, potahto, rotato, rotahto | Jul 29, 2019 | Jul 31, 2019 | potato → `potato.md` | all | "until the end of the month" | [src:fandom/Changelog] [M] |
| All you can shoot | Aug 9, 2019 (0.7.95) | Aug 14, 2019 | desert → `desert.md` | squad | savannah patch, cloud crate, Endless Ammo helmet | [src:changelog/0.7.95, fandom/Changelog] [H] |
| Splinter shell | Aug 21, 2019 (0.8.1) | Aug 27, 2019 | woods → `woods.md` | solo, then squad | fewer trees, Splinter Rounds helmet | [src:changelog/0.8.1, fandom/Changelog] [H] |
| Small potatoes | Aug 28, 2019 (0.8.2) | Aug 31, 2019 | potato → `potato.md` | all | Small Arms helmet | [src:changelog/0.8.2, fandom/Changelog] [H] |
| The perks of being a survivr (All Perked Up) | Sep 12, 2019 (0.8.3) | Sep 17, 2019 | savannah → `savannah.md` | all | lootable perks | [src:changelog/0.8.3, changelog/0.8.35, fandom/Changelog] [H] |
| One man army | Sep 18, 2019 (0.8.4) | Sep 22, 2019 | faction → `faction.md` | 50v50 | marksman, lone survivr | [src:changelog/0.8.4, fandom/Changelog] [H] |
| Perky potatoes | Sep 23, 2019 | Sep 30, 2019 | potato → `potato.md` | all | potatoes drop perks | [src:fandom/Changelog] [M] |
| .45 in the chamber | Oct 7–8, 2019 (0.8.5) | Oct 13, 2019 | desert → `desert.md` | squad | Mk45G, desert perks | [src:changelog/0.8.5, fandom/Changelog] [H] |
| Knuckle down | Oct 14, 2019 | Oct 18, 2019 | woods → `woods.md` | – | alternate barn removed from woods | [src:fandom/Changelog] [M] |
| Proxy party (Savannah) | Oct 22, 2019 (0.8.65) | unknown | savannah → `savannah.md` | – | Revivify, 9mm Overpressure | [src:changelog/0.8.65, fandom/Changelog] [H] |
| Trick or treat | Oct 26, 2019 (0.8.7) | Nov 1, 2019 | halloween → `halloween.md` | – | red pumptatos, trick/treat perks | [src:changelog/0.8.7, fandom/Changelog] [H] |
| Two years and counting ... | Oct 29, 2019 | Nov 1, 2019 | potato → `potato.md` | squad | 2nd anniversary; squad queue switched to potato | [src:fandom/Changelog, fandom/Events] [M] |
| Full meal deal | Nov 5, 2019 (0.8.71) | Nov 11, 2019 | faction → `faction.md` | 50v50 | airdrop guns with ammo | [src:changelog/0.8.71, fandom/Changelog] [H] |
| Bombshells | Nov 12, 2019 (0.8.72) | Nov 18, 2019 | desert → `desert.md` | – | Flak Jacket, Explosive Rounds | [src:changelog/0.8.72, fandom/Changelog] [H] |
| Quickswitch | Nov 18, 2019 | Nov 25, 2019 | potato → `potato.md` | – | same as previous potato | [src:fandom/Changelog] [M] |
| Fowl Play | Nov 26, 2019 (0.8.73) | Dec 2, 2019 | turkey → `turkey.md` | – | green squashes, Perky Shoot | [src:changelog/0.8.73, fandom/Changelog] [H] |
| Stay classy | Dec 2, 2019 (0.8.8) | Dec 10, 2019 | cobalt → `cobalt.md` | – | classes | [src:changelog/0.8.8, fandom/Changelog] [H] |
| Sound the charge | Dec 15, 2019 (0.8.81) | Dec 23, 2019 | faction → `faction.md` | 50v50 | bugler, grenadier, recon | [src:changelog/0.8.81, fandom/Changelog] [H] |
| Free Fryer | Dec 30, 2019 (0.8.82) | Jan 5, 2020 (solo); squad resumed Jan 6, planned for 2 weeks | potato → `potato.md` | solo 1 week, squad 2 weeks | Spud Gun, silo shack | [src:changelog/0.8.82, fandom/Changelog] [H] |
| Stay frosty (post-0.8.82) | Jan 13, 2020 | Jan 22, 2020 | snow → `snow.md` | – | footprints, idle freeze, Polar Bear, Snow Fox | [src:fandom/Changelog] [M] |
| Dodge This (post-0.8.82) | Jan 27, 2020 | Feb 10, 2020 | woods → `woods.md` | – | PKM, Hawk 12G | [src:fandom/Changelog] [M] |
| Keep Your Enemies Closer: Frenemies (post-0.8.82) | Feb 10, 2020 | Feb 17, 2020 | Valentines map | – | heart weapons | [src:fandom/Changelog] [M] |
| Curveball (post-0.8.82) | Feb 24, 2020 | Mar 2, 2020 | savannah → `savannah.md` | – | Closer perk | [src:fandom/Changelog] [M] |
| St. Patrick's + White Day (post-0.8.82) | Mar 9, 2020 | Mar 18, 2020 | Saint Patrick map | – | Rainbow Blaster, Growler | [src:fandom/Changelog] [M] |
| Spring event (post-0.8.82) | Mar 23, 2020 | unknown | main_spring | – | rotation paused | [src:fandom/Changelog] [M] |
| Eggsplosion (post-0.8.82) | Apr 6, 2020 | unknown | normal map | – | easter eggs, Sugar Rush | [src:fandom/Changelog, fandom/Egg] [M] |
| Sinko de Ammo (post-0.8.82) | Apr 20, 2020 | unknown | Cinco de Mayo map | – | piñatas, gunchiladas | [src:fandom/Changelog] [M] |
| Lasr Swrds (post-0.8.82) | May 4, 2020 | May 11, 2020 | May 4th map | – | Star Wars theme | [src:fandom/Changelog, namu/Surviv.io/이벤트] [H] |
| Ultimate Sacrifice (post-0.8.82) | May 18, 2020 (re-released May 19) | unknown | 50v50 Last Sacrifice map | 50v50 | Memorial Day | [src:fandom/Changelog] [M] |
| Storm Mode (post-0.8.82) | Jun 1, 2020 | unknown | Storm map | – | wind, lightning, storm clouds | [src:fandom/Changelog, fandom/Storm_Map] [M] |
| Beach Party (post-0.8.82) | Jun 15–16, 2020 | Jun 23, 2020 | Beach map → `beach.md` | – | Water Gun, Wet, Popsicle | [src:fandom/Changelog, namu/Surviv.io/이벤트] [H] |
| Contact Mode (post-0.8.82) | Jul 13, 2020 | Jul 20, 2020 | Contact map | squad | Mothrship, Skittrs | [src:fandom/Changelog, namu/Surviv.io/이벤트] [H] |
| Inferno (post-0.8.82) | Nov 3, 2020 1 pm PST | Nov 17, 2020 1 pm PST | Inferno map | – | lava, Burning, flamethrower | [src:fandom/Inferno_Mode, namu/Surviv.io/이벤트] [H] |
| Winter Classic (post-0.8.82) | Dec 21, 2020 | Jan 5, 2021 | snow map on all Classic queues | all | Holiday Crate, double XP week | [src:fandom/Changelog] [M] |
| Spring Classic (post-0.8.82) | Apr 14, 2021 | unknown | main_spring | Classic | Tiki skin | [src:fandom/Changelog] [M] |
| Sinko de Ammo (post-0.8.82) | May 6, 2021 | unknown | Cinco de Mayo map | – | Macho Lucha 40% off | [src:fandom/Changelog] [M] |
| Ultimate Sacrifice (post-0.8.82) | Jun 29, 2021 | Jul 2, 2021 (announced "for a week") | 50v50 Last Sacrifice map | 50v50 | Chromesis 50% off | [src:fandom/Changelog, fandom/50v50_Last_Sacrifice_Map] [M] |
| Happy Spookiversary (post-0.8.82) | Oct 26, 2021 | unknown | halloween → `halloween.md` | – | – | [src:fandom/Changelog] [M] |
| Snow map (post-0.8.82) | Dec 14, 2021 | Jan 4, 2022 | snow → `snow.md` | – | Holiday Crate Dec 16 – Jan 4 | [src:fandom/Changelog] [M] |
| Frenemies map (post-0.8.82) | Feb 14, 2022 | Feb 22, 2022 | Valentines map | – | last limited-time run listed in the changelog | [src:fandom/Changelog] [M] |

- Inferno ran Nov 4–17, 2020 according to namu.wiki, which also says long events (Inferno, Summer, Contact) blocked the regular daily events while active (post-0.8.82) [src:namu/Surviv.io/이벤트] [M]

## Pre-0.8.82 seasonal reskins

### Christmas 2017

- All trees on the map were replaced with decorated Christmas trees (red, blue, yellow and green circles), more transparent than normal trees [src:fandom/Removed_Features] [M]
- A "Happy holidays ... enjoy the winter wonderland!" promo was posted on Discord [src:fandom/Changelog] [M]

### Valentine's Day 2018

- Crates got a Valentine texture (`map-crate-01-vday.svg`) with unchanged loot, rarity and durability, only on Valentine's Day [src:fandom/Removed_Features] [M]
- Consumables were re-textured and renamed: Bandage → Chocolate Smooch, Med Kit → Chocolate Rose, Pill → Candy Necklace, Soda → Candy Heart [src:fandom/Removed_Features] [M]
- The 2020 Valentines map is described as this event's successor [src:fandom/Valentines_Map] [M]

## Egg-stravaganza / Egg-pocalypse (Apr 1–2, 2018)

- 0.3.2 (Apr 1, 2018) "Added seasonal obstacle: egg"; 0.3.21 (Apr 2, 2018) "Removed seasonal obstacle: egg" [src:changelog/0.3.2] [src:changelog/0.3.21] [H]
- The news post: "The surviv.io easter bunnies have spread their colorful eggs across the island"; the removal post was titled "Hard boiled" ("Farewell, Egg-pocalypse") [src:fandom/Changelog] [src:wikigg/Changelog] [H]
- Discord promo line: "Egg-pocalypse Now." [src:fandom/Changelog] [M]
- Played on the normal map [src:fandom/Events] [M]
- Egg obstacles: `egg_01` pink/red, `egg_02` blue, `egg_03` yellow, `egg_04` green; 80 HP; spawn on grass and beach; collidable; height 0.5 [src:fandom/Egg/Before_Eggsplosion] [src:wikigg/Eggs] [H]
- Each egg always drops one disguise outfit (fandom: `Tier Outfits` ×1) [src:fandom/Egg/Before_Eggsplosion] [M]
- Outfits dropped (fandom list): Stoneskin (`outfitStone`), Guy in a Box (`outfitCrate`), Comrade in a Box (`outfitSoviet`), All Naded Up (grenade crate), Barkskin (tree), Bush Wookie (`outfitBush`), Fish in a Barrel (`outfitBarrel`), Yard Sale (`outfitTable`) [src:fandom/Removed_Features] [src:survev/client/src/en.json:484-495] [M]
- A disguised player makes that obstacle's hit sound when shot and dies with that obstacle's destruction effect (barrel explodes, crate drops extra loot); the barrel skin reflects bullets and smokes near death [src:fandom/Egg/Before_Eggsplosion] [M]
- All Naded Up (turns the wearer into a grenade crate) existed only Apr 1–2, 2018 [src:fandom/Removed_Features] [M]
- Frag and smoke grenades were re-skinned as eggs (HUD icon and thrown sprite) during the event [src:fandom/Removed_Features] [M]
- The original 0.8.82 client has no `egg_01`; the 2018 eggs were removed in 0.3.21 [src:kong/relaunch-client-defs] [src:changelog/0.3.21] [H]
- namu.wiki describes the Egg-pocalypse eggs as dropping weapons and limited outfits and stacking a movement-speed boost; that matches the 2020 Eggsplosion eggs, not the 2018 ones [src:namu/Surviv.io/이벤트] [src:fandom/Egg] [L]
- Fork: survev v0.0.22 "Boiled potato" (Apr 1, 2025) re-added `egg_01`–`egg_04` on the `potato_spring` map, 15 of each (fork) [src:survev/shared/defs/maps/potatoSpringDefs.ts:79-82] [src:derived/survev-git-929cee54] [src:wikigg/Eggs] [H]
- Fork egg def: radius-1 circle collider, health 80, height 0.5, hit sound `egg_hit`, break sound `egg_break_01`, hidden on the minimap, hit particles pink/light blue/yellow/green (fork) [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:181-222] [src:survev/shared/defs/mapObjects/obstacles/mapObstacleDefs.ts:725-740] [H]
- Fork egg loot: one roll of `tier_egg_outfits`, 14 equal-weight disguises (outfitBarrel, outfitWoodBarrel, outfitStone, outfitSpringTree, outfitBush, outfitCrate, outfitTable, outfitSoviet, outfitOven, outfitRefrigerator, outfitVending, outfitToilet, outfitBushRiver, outfitCrab), i.e. 7.14% each (fork) [src:survev/shared/defs/maps/baseDefs.ts:403-418] [src:wikigg/Eggs] [H]
- `outfitSpringTree` (Barkskin) is a fork addition from the same commit [src:derived/survev-git-929cee54] [src:kong/relaunch-client-defs] [H]

## Meteor Shower (Aug 9–11, 2018)

- Squad-only event: "An unexpected surplus at the PARMA supply depot means EVERYTHING MUST GO!" with massively increased flare gun spawns "until supplies run out" [src:fandom/Changelog] [src:fandom/Events] [M]
- It ran on the normal map; the only change was the increased flare gun spawns; it promoted the new air drops and was a prelude to Desert Rain [src:fandom/Events] [M]
- It ended with the 0.5.03 "Burnout" post (Aug 11, 2018); top squad (Not d0bu, Aimbot, 1337 ChefDo, Chisp official) got a 48-kill game [src:fandom/Changelog] [src:changelog/0.5.03] [M]
- namu.wiki's rotation list includes a "Meteor" (유성) event; it most likely means the flare-gun Desert mode [src:namu/Surviv.io/이벤트] [L]

## Desert Rain series (schedule)

> Map rules (no 9mm, .45 ACP guns, more flare guns, desert towns, saloon) are in `modes/desert.md`. This is the run list.

| # | news title | dates | queue | what changed | sources |
|---|---|---|---|---|---|
| 1 | Desert rain | Sep 22–24, 2018 | squad | first desert map; Model 94, Peacemaker; cattle crate; Poncho Verde; top squad 35 kills | [src:changelog/0.6.1, fandom/Changelog, fandom/Events] [H] |
| 2 | Gunfight at the Deadeye Saloon | Nov 9–13, 2018 | squad | saloon; M1911, M1A1, .45 Vector; "you won't find any [9mm guns] in the desert this week"; desert town with police station, bank, two cabins and a barn | [src:changelog/0.6.5, fandom/Changelog, fandom/Events] [H] |
| 3 | Frozen deserts | Dec 12/13, 2018 | solo only | hardstone boulder; Desert Camo, Desert Ghillie; two towns; run-down chrysanthemum bunker | [src:changelog/0.6.8, fandom/Changelog, fandom/Events] [H] |
| 4 | Danger close | Feb 22 – Mar 3, 2019 | squad | strobes call air strikes; massively increased flare guns; aged faction statues, meteor case | [src:changelog/0.7.1, fandom/Changelog] [H] |
| 5 | Firepower-up | Apr 25–29, 2019 | squad | aged Lieutenant Helmet grants Firepower; PKP much more common in golden air drops | [src:changelog/0.7.51, fandom/Changelog] [H] |
| 6 | Scouting ahead | Jun 25 – Jul 2, 2019 | squad | P30L in hardstone boulders; 9mm in the golden eye chest | [src:changelog/0.7.9, fandom/Events] [H] |
| 7 | All you can shoot | Aug 9–14, 2019 | squad | savannah patch with cloud crate; Marksman Helmet grants Endless Ammo | [src:changelog/0.7.95, fandom/Events] [H] |
| 8 | .45 in the chamber | Oct 7/8–13, 2019 | squad | Mk45G; perks .45 In The Chamber, Broken Arrow, Fabricate; gold air drops drop one perk | [src:changelog/0.8.5, fandom/Changelog] [H] |
| 9 | Bombshells | Nov 12–18, 2019 | – | perks Flak Jacket, Explosive Rounds | [src:changelog/0.8.72, fandom/Changelog] [H] |

- The fandom Events page counts Firepower-up as the fifth and All you can shoot as the sixth Desert Rain event; it skips Danger close or Scouting ahead in its count [src:fandom/Events] [L]
- In the first Desert Rain the water was still the normal blue and all 9mm guns could spawn; later runs blocked 9mm guns except rare M9 from hardstone blocks [src:fandom/Removed_Features] [M]

## Spring and summer Classic variants

### Awesome blossoms / Spring Fever (`main_spring`)

- 0.7.3 (Mar 21, 2019) "Spring has sprung and so have the Island cherry trees!", adding the teahouse (golden chrysanthemum chest) and the naginata [src:changelog/0.7.3] [src:fandom/Changelog] [H]
- The event is mostly a re-texture of the main map with more trees and the Tsukuyomi no Kabuto helmet [src:fandom/Events] [src:fandom/Main_Spring_Map] [M]
- survev `main_spring`: grass `0x5c910a`, riverbank `0x8a8a8a`, ghillie `0x5b8e0a`, camera particle `falling_leaf_spring`, river-shore sound "stone" [src:survev/shared/defs/maps/mainSpringDefs.ts:13-27] [H]
- survev `main_spring` density: 300 `tree_07sp`, 30 `tree_08sp`, 30 `tree_08spb`, 160 `tree_07spr`, 80 `tree_08spr` (cherry trees) instead of 320 `tree_01`; `tree_01` is replaced by `tree_07sp` [src:survev/shared/defs/maps/mainSpringDefs.ts:40-62] [src:survev/shared/defs/maps/mainSpringDefs.ts:97] [H]
- survev `main_spring` fixed spawns: `teahouse_01` small 2 / large 3, `cache_02sp`, red houses 2/3 each; survev's `tier_chrys_case` override there is marked "not from the leak" (estimate) [src:survev/shared/defs/maps/mainSpringDefs.ts:30-36] [src:survev/shared/defs/maps/mainSpringDefs.ts:64-95] [M]
- Later spring runs: Mar 23, 2020 (rotation paused) and Apr 14, 2021 "Spring Update" (teahouse and naginata on Classic; Tiki skin) (post-0.8.82) [src:fandom/Changelog] [M]

### Summer Bloom (`main_summer`)

- 0.7.9 (Jun 25, 2019): "In solos and duos, bask in the summer bloom" with the Scout Elite and scout hut, while squads played desert [src:changelog/0.7.9] [src:fandom/Changelog] [H]
- Summer Bloom lasted until the "Dethroned" post (Jul 14, 2019); a summer teahouse complex was added Jul 14 and a scout hut replaced one normal-map hut on Jul 17 [src:fandom/Events] [src:fandom/Changelog] [M]
- The summer map has greener trees, always a scout hut (Scout Elite) and a green pot with Island Time; 5 huts incl. one gold and one scout hut; 2 of bank/police/mansion; teahouse complex 2 (3 in squads) [src:fandom/Events] [src:fandom/Main_Summer_Map] [M]
- survev `main_summer`: grass `0x629522`, beach `0xdc9e28`, riverbank `0xa37119`; 320 `tree_01` replaced by `tree_08su`, `bush_01` by `bush_01f`; `teahouse_complex_01su` small 1 / large 2; `cache_02su`; red houses 3/4 each [src:survev/shared/defs/maps/mainSummerDefs.ts:29] [src:survev/shared/defs/maps/mainSummerDefs.ts:47-94] [H]
- CONFLICT note: fandom says 2 teahouse complexes (3 in squads) but the 0.7.9 secret updates say 1 in solo/duo and 2 in squad, matching survev's 1/2 [src:fandom/Main_Summer_Map] [src:fandom/Changelog] [src:survev/shared/defs/maps/mainSummerDefs.ts:87-90] [L]

## Event Rotation (post-0.8.82)

- Introduced in 0.9.2 (Mar 9, 2020): when no seasonal event or LTM runs, the mode cycles daily and replaces one core queue [src:fandom/Event_Rotation] [src:fandom/Changelog] [M]
- Changeover at 8:00 PM UTC (4 PM EDT, 1 PM PDT) [src:fandom/Event_Rotation] [M]
- 0.9.2 schedule (1-week): Mon Cobalt (squads), Tue Potato (duos), Wed 50v50, Thu Woods (solos), Fri Desert (duos), Sat 50v50, Sun Savannah (solos) [src:fandom/Event_Rotation] [src:fandom/Changelog] [M]
- 0.9.6 (Jun 29, 2020) switched to a 2-week cycle; week 1 Mon 50v50, Tue Desert, Wed Cobalt, Thu Potato, Fri Woods, Sat 50v50, Sun Cobalt; week 2 Mon Potato, Tue Savannah, Wed Woods, Thu 50v50, Fri Desert, Sat Potato, Sun Cobalt [src:fandom/Event_Rotation] [M]
- 0.9.8 (Sep 8, 2020) table: week A Mon Savannah duo, Tue Desert solo, Wed Cobalt squad, Thu Potato solo, Fri Woods duo, Sat 50v50 squad, Sun Cobalt duo; week B Mon Potato duo, Tue Savannah solo, Wed Woods squad, Thu 50v50 squad, Fri Desert duo, Sat Potato solo, Sun Cobalt squad [src:fandom/Event_Rotation] [M]
- From 0.9.8 Classic stayed available on Solo, Duo and Squad alongside one queue for the active mode, so rotation no longer removed a core mode [src:fandom/Event_Rotation] [src:fandom/Game_Modes] [src:fandom/Changelog] [M]
- The rotation first started with 50v50 on Mar 18, 2020 (after St. Patrick's ended) and was paused Mar 23, 2020 for the spring event [src:fandom/Changelog] [M]
- namu.wiki: after Kongregate took over, the event changed once a day on a 2-week cycle starting Mondays, rotating Potato, Cobalt, 50v50, Woods (King of the Woods), Meteor and Savannah [src:namu/Surviv.io/이벤트] [M]
- namu.wiki's 7-day example: Mon Cobalt (duo), Tue Potato (duo), Wed Savannah (solo), Thu Woods (squad), Fri 50v50 (squad), Sat Meteor (duo), Sun Potato (solo) [src:namu/Surviv.io/이벤트] [L]
- namu says daily events drew players while classic solo emptied out [src:namu/Surviv.io/이벤트] [M]

## Frenemies (Valentines map, Feb 10–17, 2020; Feb 14–22, 2022) (post-0.8.82)

- News: "PARMA recognizes this season of togetherness": Heart Cannon and Heart Grenade spread damage reduction; eating a box of chocolates counters it [src:fandom/Changelog] [M]
- Valentines map: Candy Store, rose bushes, Valentines trees, cherry-blossom particles; more flare guns, air drops always golden, no building rotation; red hearts fly out of dead players [src:fandom/Valentines_Map] [M]
- Frenemies effect: a player hit by a heart weapon deals 30% less melee and bullet damage to enemies for 20 s (40 s if the attacker has Cupid) [src:fandom/Frenemies] [M]
- `heart_frag` Heart Frag: frag clone (fuse 4 s, cookable) with 125 explosion damage, radius 5–12, obstacle ×1.1, 12 shrapnel of 20 damage, plus the Frenemies effect; capacity 3/6/9/12; called "Heart Grenade" in the changelog [src:fandom/Heart_Frag] [M]
- `heart_cannon` Heart Cannon: potato-cannon clone using `heart_ammo` (infinite), clip 4, fire delay 1.2 s, reload 1 s, switch 0.9 s, equip speed −3; projectile explodes on impact for 95 damage, radius 3.5–6.5, obstacle ×1.3 [src:fandom/Heart_Cannon] [src:fandom/Heart_Ammo] [M]
- `cupid` perk doubles the Frenemies duration from 20 s to 40 s [src:fandom/Cupid] [M]
- `chocolateBox` Chocolate Box replaces soda: +25 boost, 3 s use, capacity 2/5/10/15, and 20 s immunity to heart weapons [src:fandom/Chocolate_Box] [src:fandom/Frenemies] [M]
- Candy Store (one per game; light indigo on the minimap): 6 display cases, chocolate-box vending machine, baskets, front desk, control panel; basement with bookshelf, crates, bed, bottles, toilet and the Frenemies Metal Crate; based on avika's "OKAMI Candy Store" contest entry [src:fandom/Candy_Store] [M]
- `crate_frenemies_metal` Frenemies Metal Crate: 350 HP, reflects bullets, drops Tier Soviet ×3–5 and a guaranteed Flare Gun [src:fandom/Frenemies_Metal_Crate] [M]
- On the Valentines map every air drop contains a Heart Cannon [src:fandom/Candy_Store] [M]
- Added in the same update for general play: `m134` M134 minigun (7.62mm, clip 200, fire delay 0.055 s, reload 8 s, 10 damage, obstacle ×5, equip −3 / firing −6 speed) and `m79` M79 grenade launcher (40mm, clip 1, reload 2.3 s, 125 explosion damage) [src:fandom/M134] [src:fandom/M79] [src:fandom/40mm] [M]
- Winter onesie (`outfitWinter`) was added in this update and later sold in the Holiday Crate (Dec 2020) [src:fandom/Winter_Onesie] [M]

## St. Patrick's + White Day (Saint Patrick map, Mar 9–18, 2020) (post-0.8.82)

- Saint Patrick map: green and teal ground; shamrock bushes, shamrock wood barrels and bushes everywhere; exclusive Marshmallow Suit [src:fandom/Saint_Patrick_Map] [M]
- `rainbow_blaster` Rainbow Blaster ("R. Blaster"): from shamrock bushes; hold to charge, one shot, 1000 explosion damage (1000× vs obstacles), discarded after firing; uses `rainbow_ammo` (capacity 1 in every pack) [src:fandom/Rainbow_Blaster] [src:fandom/Rainbow_Ammo] [src:fandom/Changelog] [M]
- `growler` Growler: 3 s use, capacity 2/5/10/15; gives the Lucky effect for 20 s: a lethal hit leaves you at 1 HP instead [src:fandom/Growler] [src:fandom/Changelog] [M]
- `leprechaun` perk: when Lucky saves you, you also teleport a short distance inside the safe zone [src:fandom/Leprechaun] [M]
- `outfitWhiteDay` Marshmallow Suit from shamrock bushes and barrels; the id names the White Day half of the event [src:fandom/Marshmallow_Suit] [M]

## Eggsplosion (Easter 2020, from Apr 6, 2020) (post-0.8.82)

- 0.9.3 (Apr 6, 2020) news: "Eggs randomly spawn throughout the map, and can be broken for loot, as well as a brief Sugar Rush that bestows a speed boost (the boost stacks with other eggs broken soon after)" [src:fandom/Changelog] [M]
- Easter eggs `easteregg_01`–`easteregg_06`: 1 HP, regrow after 60 s, grass and beach; loot `Tier Guns` ×1 (`_01`), ×1–2 (`_02`, `_03`, `_05`, `_06`) or ×1–3 (`_04`) plus `Tier Easter` ×1 (Survivr Pass 2 skins); variants 1–5 also spawn in egg bunkers [src:fandom/Egg] [M]
- Sugar Rush stacks per egg and each new egg resets the timer of earlier boosts; stacking let players clip through walls [src:fandom/Egg] [src:fandom/Sugar_Rush] [M]
- An unreleased "Lucky Bunny" perk image (`loot-perk-luckyBunny`) appears to be the Sugar Rush test perk [src:fandom/Lucky_Bunny] [M]

## Sinko de Ammo (Cinco de Mayo map; Apr 20, 2020 and May 6, 2021) (post-0.8.82)

- 0.9.3a (Apr 20, 2020): "R&D efforts in AI and Robotics have given birth to The Piñata ... can be hunted and broken, for a stash of valuable loot and Gunchiladas (which briefly negate the need to reload)" [src:fandom/Changelog] [M]
- Cinco de Mayo map: a modified desert map (desert towns, ruined river town, .45 ACP guns, no 9mm, more flare guns, strobes, savannah patch, storm bunker, greenhouse) where piñatas spawn [src:fandom/Cinco_de_Mayo_Map] [M]
- Air drop schedule on that map: #1 at 0:55 left in the step-1 wait, #2 at 0:38 left in the step-3 wait [src:fandom/Cinco_de_Mayo_Map] [M]
- `pinata_01` Piñata: moving crate, 200 HP, drops `Tier Cinco Mayo` ×3–5 (gunchiladas and golden-air-drop guns); 2 spawn at the start of the first shrink near the aged faction statues, regrow 30 s after breaking, speed up when damaged, push players, turn before obstacles [src:fandom/Piñata] [src:fandom/Events] [M]
- `gunchilada` Gunchilada: 2 s use, capacity 2/5/10/15; for 2.5–3 s the gun keeps firing without reloading, taking ammo straight from the inventory (prototype lasted 5 s) [src:fandom/Gunchilada] [M]
- The unreleased "Party Time" perk image and `gunchiladaParticles` were the Gunchilada test assets [src:fandom/Party_Time] [M]
- 2021 return (v1.6.0b, May 6, 2021): "the island has been invaded by mobile, automated, robotic Pinatas"; Macho Lucha skin 40% off [src:fandom/Changelog] [M]

## Lasr Swrds (May 4th map, May 4–11, 2020) (post-0.8.82)

- Released with 0.9.4 "Fairly Lethal" on May 4, 2020 (rolled back twice for login issues, final release May 5) [src:fandom/Changelog] [M]
- Star Wars Day theme; namu.wiki dates it May 4–11, 2020 and calls it the most popular non-regular event; a June 20, 2020 Discord poll also ranked it the most popular LTM [src:namu/Surviv.io/이벤트] [src:fandom/May_4th_Map] [H]
- May 4th map: cobalt-blue/purple biome; the ghillie colour exactly matches the grass; `killCommanderEnabled` flag in its def [src:fandom/May_4th_Map] [M]
- `crate_23` Space Crate: 150 HP, reflects bullets, drops `Tier Space` (Lasr Swrd, Lasr Gun or 2 Pulse Boxes) [src:fandom/Space_Crate] [M]
- `lasr_gun` Lasr Gun: 12 gauge pistol, 42 damage, clip 7, reload 2.3 s, fire delay 0.16 s, first-shot accurate, 2× headshot multiplier, ricochets off objects; `lasr_gun_dual`: clip 14, reload 4 s, fire delay 0.12 s [src:fandom/Lasr_Gun] [M]
- `lasr_swrd` Lasr Swrd: melee (green, blue, red variants) that passively reflects bullets from the front while held, not while swinging or at point-blank; slower than a katana [src:fandom/Lasr_Swrd] [src:fandom/Changelog] [M]
- `pulseBox` Pulse Box: 0.2 s use (fastest consumable), capacity 2/5/10/15, knocks nearby players and items away [src:fandom/Pulse_Box] [M]
- Lasr Swrds and Lasr Guns were excluded from potato swaps (May 12, 2020) [src:fandom/Changelog] [M]
- Mines were added in the same update to all normal modes: 5 s arming, explode 1 s after a player, bullet or grenade comes near, frag-type 125-damage explosion [src:fandom/Mine] [src:fandom/Changelog] [M]
- namu.wiki lists the new objects as a space crate and a sky-blue crate, the laser gun, the lightsaber and the Pulse Box [src:namu/Surviv.io/이벤트] [M]

## Ultimate Sacrifice (50v50 Last Sacrifice map; May 18, 2020 and Jun 29 – Jul 2, 2021) (post-0.8.82)

- The map def was added in 0.9.4 (May 4, 2020) as "50v50 Last Sacrifice"; the event launched May 18, 2020 and was re-released May 19 after connectivity fixes [src:fandom/Changelog] [src:fandom/50v50_Last_Sacrifice_Map] [M]
- Rules: same layout as 50v50; poppy bushes on every riverbank; only military air drops; red/blue loadout skins blocked [src:fandom/50v50_Last_Sacrifice_Map] [src:fandom/Events] [M]
- The Commander spawns with a DEagle 50 (7 rounds) instead of a flare gun [src:fandom/Events] [src:fandom/50v50_Last_Sacrifice_Map] [M]
- A Good Cause: the Commander's death fires a flare and calls a military air drop (no flare if the death is indoors or underground, but the drop still comes) [src:fandom/Changelog] [src:fandom/Bubbleshield] [M]
- `bubble_shield` Bubbleshield: a red or blue shield (150 HP) for 10 s where the Commander died; it deflects enemy bullets, pushes items out, and lets allied bullets through [src:fandom/Bubbleshield] [M]
- Poppy `bush_10a`–`bush_10d`: 120 HP, heals about 5 HP when broken, walk-through [src:fandom/Poppy] [M]
- Schedule: Commander promoted at 0:30 left in step-0 wait, Lieutenant/Marksman/Grenadier/Recon at 0:26, Medic 0:22, Bugler 0:18; air strikes at step-1 0:55, step-2 0:26, step-3 0:32, step-4 0:12, step-5 0:19; military drops at step-2 0:44 and step-4 0:27 [src:fandom/50v50_Last_Sacrifice_Map] [M]
- Memorial Day theme: v1.7.0b (Jun 29, 2021) ran it "for a week" with Chromesis at 50% off until Jul 2 [src:fandom/Changelog] [src:fandom/Poppy] [M]

## Storm Mode (Storm map, from Jun 1, 2020) (post-0.8.82)

- 0.9.5 (Jun 1, 2020): "Driving wind, rushing rivers, hail, and lightning strikes now pose mortal threats" [src:fandom/Changelog] [src:fandom/Storm_Map] [M]
- Base map is Woods: LMGs and shotguns only, more frag/smoke capacity, logging complex, eye bunker, teahouse, pavilion, Woods King [src:fandom/Storm_Map] [src:fandom/Events] [M]
- Wind speeds up movement with it and slows movement against it, changes direction at random, and affects grenade throw distance; indoors ignores wind [src:fandom/Wind] [src:fandom/Storm_Map] [M]
- Rivers push harder: wading is slower and floating items move faster [src:fandom/Storm_Map] [src:namu/Surviv.io/이벤트] [H]
- `cloud_01`–`cloud_04` Storm Clouds: moving, non-colliding obstacles (125 HP) that deal armor-reduced hail damage each second to players below; death cause "Weather" [src:fandom/Storm_Cloud] [src:fandom/Storm_Map] [M]
- Lightning: sparks for a few seconds, then 1–3 strikes about every 20 s, biased toward the safe zone; 200 damage to players, ×150 vs obstacles, radius 10–20; can hit players indoors [src:fandom/Lightning] [src:fandom/Storm_Map] [M]
- A cosmetic black overlay at 20% opacity (`rgba(0,0,0,0.2)`) covers the map outdoors [src:fandom/Storm_Map] [M]

## Beach Party (Jun 15–23, 2020) (post-0.8.82)

> Full detail in `modes/beach.md`; survev's Beach is a fork reconstruction (fork).

- Ice Box (`crate_IceBox`, 100 HP, `Tier Beach` ×3–5), Water Gun (`waterGun`, 7.62mm, 5.5 + 2 explosion damage, clip 30, reload 2.5 s, fire delay 0.1 s), Water Balloon, Popsicle (internal `watermelon`, +10% speed for 10 s, stacks) and Speedo (`outfitSpeedo`, normal speed in water); Wet slows movement, firing and reloading 30% for about 2 s [src:fandom/Ice_Box] [src:fandom/Water_Gun] [src:fandom/Popsicle] [src:fandom/Wet_Effect] [src:fandom/Speedo] [M]

## Contact Mode (Contact map, Jul 13–20, 2020) (post-0.8.82)

- 0.9.6c (Jul 13, 2020): "Mothrships have begun to appear – often dropping hosts of Skittrs, and eggs containing alien technology" [src:fandom/Changelog] [src:fandom/Contact_Map] [M]
- namu.wiki: squad mode, Jul 13–20, 2020; spiky thin leaves, the egg crate, and the Mothrship as the "first vehicle" that only floats [src:namu/Surviv.io/이벤트] [M]
- Contact map: normal-map layout (bank, police station, mansion, hydra, docks, club, chrysanthemum bunker) with purple biome, Mothrships and crop circles; 80 players [src:fandom/Contact_Map] [M]
- Mothrship: moves toward the storm centre; spawns Skittrs every 25 s, every 15 s after stage 2 (4 min after spawning); its cannon locks on a player (red crosshair for 2 s) and hits for 100 damage with heavy falloff; no-fire zone under the ship [src:fandom/Changelog] [src:fandom/Mothrship] [M]
- Skittr: AI bug with 50 HP; locks onto the nearest player, bites at close range, cannot enter buildings, randomly phases to 80% transparency; spawns from the Mothrship and from 50% of egg crates [src:fandom/Skittr] [src:fandom/Changelog] [M]
- Contacted: +20% movement speed and +20% damage taken, random phasing; cured only by Skittrnade damage [src:fandom/Contacted] [src:fandom/Changelog] [M]
- `skitternade` Skittrnade: smoke-like grenade whose toxic green smoke deals damage and gives a 10 s Contacted; capacity 10/20/30/40 [src:fandom/Skittrnade] [src:fandom/Changelog] [M]
- Egg Crate (drops `Tier World` ×1 or a Skittr or Skittrnade) and crop circles `crop-circle-01`–`03` (decals, usually with an egg crate) [src:fandom/Egg_Crate] [src:fandom/Crop_Circle] [M]

## Inferno (Inferno map, Nov 3–17, 2020) (post-0.8.82)

- 1.0.0 (Nov 3, 2020): first community-concept mode (by CaptainPoultry and JustARoamingMeower), running Nov 3, 1 pm PST to Nov 17, 1 pm PST [src:fandom/Inferno_Mode] [src:fandom/Changelog] [M]
- Inferno map: almost all water replaced by lava (water remains in the conch bunker and club pool, and extinguishes Burning); charred ground, withered trees; central woods-style lake without the pavilion; desert-style greenhouse and chrysanthemum bunker; teahouses and cabins removed; burnt bridges [src:fandom/Inferno_Map] [src:fandom/Inferno_Mode] [M]
- Burning: damage over time for 5 s, refreshed by new hits; kills by Burning give nobody credit [src:fandom/Burning] [src:fandom/Changelog] [M]
- Flamethrower: 9mm, 4 damage, clip 60, reload 4 s, fire delay 0.015 s, short range, inflicts Burning; spawns at the island centre; fandom gives internal id `m9A17` [src:fandom/Flamethrower] [src:fandom/Changelog] [L]
- `antiFire` Foam Grenade: a ring of foam puffs that removes Burning [src:fandom/Foam_Grenade] [src:fandom/Changelog] [M]
- `phoenix` perk: heals while Burning, takes the same small damage over time when not burning, immune to burn damage [src:fandom/Phoenix] [src:fandom/Changelog] [M]
- Pyro perk: +20% range and damage for fire weapons, including Nitro-laced guns [src:fandom/Pyro] [src:fandom/Changelog] [M]
- Nitro Lace: 2 s use, capacity 2/4/6/8; makes your bullets inflict Burning for 10 s [src:fandom/Nitro_Lace] [src:fandom/Changelog] [M]
- Pyro Crate: 120 HP, drops 2 from `Tier Pyro` (60 9mm, flamethrower with 60 9mm, Nitro Lace, foam grenades), or 1 of those plus Phoenix or Pyro [src:fandom/Pyro_Crate] [M]
- namu.wiki: ash-coloured ground, trees with only branches, lava rivers and lakes; fire keeps burning a while after leaving lava [src:namu/Surviv.io/이벤트] [M]

## Fork-only events (survev)

- Potato spring eggs, v0.0.22 "Boiled potato" (Apr 1, 2025): see Egg-stravaganza above (fork) [src:wikigg/Changelog] [src:derived/survev-git-929cee54] [H]
- "Potato vs. Tomato", v0.2.3 (Apr 1, 2026): 50v50 on the `faction_potato` map with PMG-134 and a Tomato obstacle/throwable (fork) [src:wikigg/Changelog] [src:balance/259] [src:derived/survev-git-2255ceef] [H]
- Birthday mode ("Anniversary Harvest", v0.1.3, Oct 21, 2025) simulates the 2017 early-access game; see `modes/birthday.md` (fork) [src:wikigg/Changelog] [src:derived/survev-git-1b2c8cb3] [H]
- Beach mode (v0.2.0 "The Palms Sway", Jan 18, 2026; map def added Dec 25, 2025); see `modes/beach.md` (fork) [src:wikigg/Changelog] [src:derived/survev-git-aa37de9c] [H]

## Conflicts

- CONFLICT egg-pocalypse-speed-boost: namu says Egg-pocalypse eggs drop weapons and limited outfits and give a stacking speed boost [src:namu/Surviv.io/이벤트] [src:fandom/Events] vs the 2018 eggs only dropping a disguise outfit, with Sugar Rush first appearing in the 2020 Eggsplosion [src:fandom/Egg/Before_Eggsplosion] [src:fandom/Egg] [src:changelog/0.3.2]; proposed: namu and the fandom Events page merged the 2018 and 2020 events; 2018 eggs = outfit only [L]
- CONFLICT egg-2018-outfit-pool: 2018 eggs dropped 8 disguises incl. All Naded Up [src:fandom/Removed_Features] vs survev's fork pool of 14 disguises without All Naded Up [src:survev/shared/defs/maps/baseDefs.ts:403-418]; proposed: for a 2018 egg event use the fandom 8-outfit list; survev's list is fork [L]
- CONFLICT rotation-schedule: fandom 0.9.2/0.9.6/0.9.8 tables [src:fandom/Event_Rotation] vs namu's 7-day example (Mon Cobalt duo, Tue Potato duo, Wed Savannah solo, Thu Woods squad, Fri 50v50 squad, Sat Meteor duo, Sun Potato solo) [src:namu/Surviv.io/이벤트]; proposed: schedules changed several times; keep the fandom tables per version and treat namu's as an undated snapshot [L]
- CONFLICT inferno-dates: Nov 3–17, 2020 [src:fandom/Inferno_Mode] vs Nov 4–17, 2020 [src:namu/Surviv.io/이벤트]; proposed: Nov 3, 1 pm PST = Nov 4 in Korea [L]
- CONFLICT beach-party-start: Jun 15, 2020 [src:fandom/Changelog] vs Jun 16, 2020 [src:namu/Surviv.io/이벤트]; proposed: same moment in different time zones [L]
- CONFLICT contact-start: Jul 13, 2020 [src:fandom/Changelog] [src:namu/Surviv.io/이벤트] vs Jul 14, 2020 for the Mothrship in another namu snippet [src:namu/Surviv.io/이벤트]; proposed: Jul 13 US time [L]
- CONFLICT summer-teahouse-count: Main Summer map has 2 teahouse complexes (3 in squads) [src:fandom/Main_Summer_Map] vs 1 in solo/duo and 2 in squad [src:fandom/Changelog] [src:survev/shared/defs/maps/mainSummerDefs.ts:87-90]; proposed: 1/2 (survev, changelog secret update) [L]
- CONFLICT desert-rain-count: fandom Events numbers Firepower-up as the 5th and All you can shoot as the 6th Desert Rain [src:fandom/Events] vs 9 desert runs from 0.6.1 to 0.8.72 in the changelog [src:changelog/0.6.1] [src:changelog/0.8.72]; proposed: use the 9-run list above [L]
- CONFLICT poppy-version: Poppy page says added in "v0.9.4 update on April 6, 2020" [src:fandom/Poppy] vs 0.9.4 on May 4, 2020 (Apr 6 was 0.9.3) [src:fandom/Changelog]; proposed: May 4, 2020 [L]
- CONFLICT flamethrower-id: fandom infobox gives internal id `m9A17` [src:fandom/Flamethrower]; no other source (not in survev or the relaunch client) [src:kong/relaunch-client-defs]; proposed: treat the id as unverified [L]

## Open questions

- End dates are unknown for Awesome blossoms (2019), the 2020 spring event, Eggsplosion, both Sinko de Ammo runs, Ultimate Sacrifice 2020 and Storm Mode [src:fandom/Changelog] [L]
- Exact numbers for wind speed change, hail damage per second, Sugar Rush speed per egg, piñata speed and the Phoenix drain rate are not documented [src:fandom/Wind] [src:fandom/Storm_Cloud] [src:fandom/Sugar_Rush] [src:fandom/Phoenix] [L]
- Whether the 2018 Valentine reskin and the 2017 Christmas trees used separate map defs or only sprite swaps is unknown [src:fandom/Removed_Features] [L]
- Which map namu's "Meteor" (유성) rotation entry refers to is unconfirmed (probably Desert) [src:namu/Surviv.io/이벤트] [L]
