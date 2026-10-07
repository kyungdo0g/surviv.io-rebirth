# survev.io content and new rebirth guns

Status: **proposed** (2026-10-07). This is a plan. Nothing in it is implemented yet.

It covers two user decisions from 2026-10-07 (KB source ids proposed: `user/2026-10-07-survev-baseline`,
`user/2026-10-07-new-guns`). The user wrote in Korean; paraphrased:

1. "Base it mainly on survev.io, because it is the newest. If something exists only on survev.io, add it: the Barrett, the new
   buildings and so on. Search the wiki once more."
2. Add a list of new guns: 26 names, and 6 more added later (`MG42` among them). For these the user will supply loot icons,
   held sprites, ammo icons, and fire and reload sounds. Some held sprites will just be the plain bar shape.

Evidence was gathered on 2026-10-07 in four sweeps: the survev repository, survev.wiki.gg, the user's guns, and our
pipeline. Their findings are folded in below. Paths are repo-relative. `.survev/...` is the pinned survev clone, and
`wikigg:<Page>@<rev>` is a survev.wiki.gg revision. Every proposed number for a new gun is a design value; none of these
guns has survev or original-client data except the M79 (section 4).

---

## 1. Policy change: survev.io becomes the main reference

### 1.1 What "the latest survev" is

| what | value |
|---|---|
| survev default branch `master` (`git ls-remote https://github.com/survev/survev`, 2026-10-07) | **`c6185e31fe25a4a07def77a2bb25b1710bda90ac`**, 2026-09-29 22:38 -03:00, "fix: cachedBgImg default value" (survev release v0.4.3, `wikigg:Changelog@7208`) |
| our pin (`.survev`, `tools/port-survev/lib/inputs.ts:9`) | the same commit. **Re-pinning is a no-op today.** |
| newer survev content | only the unmerged branch `feat/winter-factions` (`ca5fd1a4`, 2026-10-01): `aug` "AUG .300", the Commander's Super 90 and AN-94, the `mace` "Nightfall", the `reinforced` perk ("Reinforced Plating"), the `renegade` role, bugle buffs (`perkDefs.ts`, `roleDefs.ts`), and the `faction_snow` map. **Opt-in; wait for it to merge.** |
| other survev branches (`git ls-remote`, 2026-10-07) | `feat/stu` (`75393b91`): a "nerd" map easter egg, one map object `map-nerd-01` (trivial; take it if it merges). `feat/xp-items` (`a36bfe89`) and `offline-mode` (`34e7f50f`, unlock defs only): accounts/meta, excluded. `feat/oxlint-typechecking`, `feat/webtransport`, `fix/handle-ws-bufferedAmount`, `refactor/{net-msgs,port-to-pixi-v8,stats}`: tooling or engine, no content. So nothing newer than master carries gameplay content except `feat/winter-factions`. |
| survev.wiki.gg | dump of 2026-10-05 (482 pages, all 344 articles), re-checked through the live API on 2026-10-07. Only `Coconut` changed since the dump. The four dot-titled pages the dump had skipped (`.308 Subsonic`, `.45 ACP`, `.45 in the Chamber`, `.50 Caliber`) were fetched. The wiki changelog covers survev v0.0.1 (2024-08-17) to v0.4.3 (2026-09-29); everything tagged with a survev version is newer than 0.8.82. No wiki page mentions any of the user's new guns. |

So "base on survev" is a **change of port policy, not a data refresh**: our pin already holds all of it.

### 1.2 The new policy (proposed ADR 0003, "survev baseline")

1. **survev master is the gameplay baseline.** Every survev gameplay id and map object is ported, together with survev's
   loot tables, map generation, roles and perks, *as survev has them*. survev's own balance changes are no longer
   reverted. `docs/research/provenance/balance-revert.json` stays as the record of the original values, but the port no
   longer applies it.
2. **The original 0.8.82 client stays the presentation source**: sprites and atlas frames, sounds where the original has
   them, HUD and UI, l10n strings, and the `lootImg` / `worldImg` / `particle` fields of shared ids. Original ids keep
   their wire indices: they stay the **prefix** of the registry. survev-only ids follow them, and rebirth ids come last.
3. **Shared ids (184 game objects with survev-changed fields): option B, hybrid (recommended).** Shared ids take survev's
   gameplay fields (damage, spread, fire delay, clip, reload, headshot multiplier, ammo counts, role loadouts) and keep
   the original's presentation fields. Option A would keep the 0.8.82 stats for shared ids and only *add* survev-only
   content; it is smaller, but survev's new guns were balanced against survev's buffed shared guns (section 3). The
   user's wording ("mainly survev") points to B. **The user should confirm B.**
4. **Rebirth additions stay in the rebirth layer** (`packages/defs/src/rebirth/`, on `feat/airstrike-variants` today):
   the airstrike variants, the airdrop tiers, and the new guns in section 4. Each is listed in
   `docs/research/rebirth-deviations.md`.
5. **Still excluded**: survev accounts and meta content (46 quests, `pass_survivr2`, `xp_*` items), and unmerged survev
   branches until they merge.

Prototype (pipeline sweep, run on a scratch copy of the port, survev-only ids appended): 0 port problems; game objects
629 → 723; map objects 886 → 988; all 1264 sprite ids resolve in today's manifest; 19 survev sounds missing (section 2.10);
7 of 41 defs tests fail, all of them policy assertions or the 4-column bag rows. A "survev wins everywhere" variant
(option C) gave 10 port problems, 13 failing tests, `$fn` closures in role perks, `protocolVersion` 1028 and 791
representation diffs, so it is rejected.

### 1.3 What stays from the original 0.8.82 work

- The **look**: the original atlas art, HUD layout, menus, sounds, l10n (`apps/client`), and the visual-diff work of M9.
  Display names stay the original ones, with one exception: `.50 AE` becomes **".50 Caliber"**, because survev made it the
  shared ammo of the Barrett, ASh-12 and S&W 500 (`wikigg:.50_Caliber@7198`). survev's other renames (`SCAR-SSR` → `Mk 20 SSR`,
  `M1014` → `Super 90`, `Steelskin` → `Cast Ironskin`, ...) are a user choice; the default keeps the original names.
- The **wire protocol** and the registry design (original ids first), the server, the sim architecture and its
  determinism rules, the bots, the event modes, and the rebirth deviations already made.
- The **knowledge base**: the provenance files become history ("what survev changed"), not revert instructions.
- Presentation-coupled fields of shared guns, such as `barrelLength` (survev changed it on about 30 guns for its new world
  models; ours are the original sprites).

### 1.4 Documents that must change (describe only; nobody edits them before the user agrees)

| document | change |
|---|---|
| `CLAUDE.md`, "Data sources and precedence" and the line "Fork-only survev content (barrett, ash12, sw500, imbel, reserve_* buildings, ...) is excluded." | Replace with the text below. **Agents must not edit CLAUDE.md on their own**; this text is a proposal for the user. |
| `docs/research/README.md` "Precedence when sources disagree" (lines 23-29) | Point 1 becomes: "Gameplay numbers: survev `shared/defs` at the pinned commit, as survev ships them (balance.txt changes are kept, not reverted; the original value stays in `provenance/balance-revert.json`)." New point 2: "Presentation (sprites, sounds, names, UI): the original client." Old points 2-5 move down. Add the source prefix `user/<date>-<slug>` for user decisions (also in `sources.md`). |
| `docs/adr/0003-survev-baseline.md` (new) | Records 1.2. Supersedes ADR 0002 points 2-4. The era target (point 1) becomes "the 0.8.82 look with survev-era content". |
| `docs/adr/0002-era-and-data.md` | Status: "superseded in part by ADR 0003". |
| `tools/port-survev/README.md` | Rewrite the exclusion policy; document `policy.json` (section 5.1). |
| `docs/research/provenance/{fork-vs-original,live-vs-survev,balance-revert}.md` | Header note: "history; since ADR 0003 the game follows survev". |
| `assets/PROVENANCE.md` | New counts (defs then reference about 400 survev sprites instead of 18) and the new `rebirth-user` source row. |
| `docs/research/rebirth-deviations.md` | One row per new gun and new mechanic, with the user source. |

Proposed `CLAUDE.md` text:

```md
## Data sources and precedence

1. survev (`.survev`, GPL-3.0, master commit `c6185e31`, 2026-09-29) is the gameplay baseline: all gameplay values and all
   survev content (survev-only guns, perks, buildings and maps included), loot tables, map generation, gas and roles.
   We write our own code; we port data, not code. Port policy: `tools/port-survev/policy.json`.
2. Original client definitions extracted from the 2026 relaunch bundle (`research-cache/live/defs.json`) are the
   presentation source (sprites, sounds, UI, names) and fix the wire order of the original ids.
3. Rebirth additions requested by the user live in `packages/defs/src/rebirth` and are listed in
   `docs/research/rebirth-deviations.md`.
4. Wikis for qualitative facts. See `docs/research/README.md`.

Out of scope: survev accounts and meta content (quests, passes, XP items) and unmerged survev branches.
User-supplied art and sound live only in the gitignored `assets-user/`.
```

---

## 2. survev-only content to add

Size: **S** = data only, under half a day; **M** = data plus some sim or client code, 1-2 days; **L** = new systems or a
large building group, 3 days or more. "Assets" means files in `.survev/client/public`, which `pnpm assets` already
copies: **all 243 sprites and 134 sounds referenced by survev-only game objects exist** (asset check of 2026-10-07).
The one gap is in our tooling: survev-only sounds have no entry in `apps/client/src/generated/sound-defs.json`
(section 2.10).

The ids appear in `docs/research/provenance/live-vs-survev.md`, and today in `provenance.excluded` of
`packages/defs/src/generated/provenance.json`.

### 2.1 Guns

| id | what (survev master) | source | assets | dependencies | size |
|---|---|---|---|---|---|
| `barrett` + `bullet_barrett` | Barrett M107: `50AE`, semi, clip 10 (12), reload 3.75, fireDelay 0.925, switch 1, speed equip -1 / attack -4, damage 99, obstacle x3, range 400, speed 214, headshot 1.25, `50cal` casing. Added v0.3.1 (2026-07-16). | `.survev/shared/defs/gameObjects/gunDefs.ts`, `bulletDefs.ts`; `wikigg:Barrett_M107@7220` (stats match the source) | `img/loot/loot-weapon-barrett.svg`, `img/guns/gun-barrett-01.svg`, `audio/guns/barrett_01`, `_reload_01`, `_switch_01` | `50cal` casing particle (client); sounds in sound-defs | S |
| `ash12` + `bullet_ash12` | ASh-12: `50AE`, auto, clip 10 (20), reload 3.1, fireDelay 0.1, damage 31, range 70, speed 85, headshot 2 | same; `wikigg:ASh-12@7221` | `loot-weapon-ash12`, `gun-ash12-01`, `ash12_*` | as Barrett | S |
| `sw500` + `bullet_sw500` | S&W 500 revolver: `50AE`, clip 5, reload 2.7, fireDelay 0.65, damage 64, range 160, speed 150 | same; `wikigg:S&W_500@7223` | `loot-weapon-sw500`, `gun-sw500-01`, `sw500_*` | `tier_revolvers` (wine rack `rack_01`) | S |
| `imbel` + `bullet_imbel` | "IMD-2" (IMBEL MD-2, a 5.56 FAL derivative): `556mm`, auto, clip 40 (50), damage 12, fireDelay 0.092, range 200 | same; `wikigg:IMD-2@6441` | `loot-weapon-imbel`, `gun-imbel-01`, `imbel_*` | Woods `tier_guns` 2.75, Cobalt Tank and Classless crates | S |
| `spas16` | "SPAS-16" (fictional; the wiki calls it the full-auto SPAS-15): `12gauge`, auto, clip 6 (8), 9 flechettes x 8.75, fireDelay 0.35 | same; `wikigg:SPAS-16@5932` | `loot-weapon-spas16`, `gun-spas16-01`, `spas16_*` | `gun_mount_07` (Workshop), Cobalt crates, faction airdrops | S |
| `potato_lmg` | "PMG-134" potato minigun: infinite `potato_ammo`, clip 150, 2 `potato_lmgshot` projectiles per shot, equip -1.5 / attack -6; hits slow the target and shrink its view | same, `gunDefs.ts:3550`; `wikigg:PMG-134@6674` | `loot-weapon-potato-lmg`, `gun-potato-lmg-top-01`, `potato_lmg_*` | `potato_lmgshot`, `explosion_potato_lmgshot`; potato maps | M (view shrink) |
| `svd_winter`, `sv98_winter`, `awc_winter` | winter world-image skins, same stats | `gunDefs.ts` | `gun-svd-02`, `gun-sv98-02`, `gun-awc-02` | snow maps | S |
| `bullet_invis`, `shrapnel_cobalt` | survev's invisible carrier bullet; Cobalt shrapnel | `bulletDefs.ts` | - | `explosion_cobalt` | S |

**Where the Barrett spawns.** On survev master it spawns from `tier_airdrop_crimson` (only the desert crimson airdrop
`airdrop_crate_05` → `crate_17` and the Reserve's `case_07de` use it), from `tier_airdrop_mythic` (only the 50v50 gold
military crates), from faction `tier_airdrop_rare` 0.5, savannah tables, and desert `tier_pirate_rare` 0.3. **It never
spawns on the classic main map.** Because the user asked for the Barrett by name, add a rebirth loot overlay (a
deviation): Barrett in the gold drop `tier_airdrop_rare` of main and its seasonal copies, weight 1 (survev main
`tier_airdrop_rare` totals 22.68). The ASh-12 and S&W 500 keep survev's placement.

### 2.2 Melee

| id | what | source | assets | dependencies | size |
|---|---|---|---|---|---|
| `iceaxe` | Ice Axe: 44 damage, obstacle x2.4, armour- and stone-piercing (breaks safes and iced hardstone) | `.survev/shared/defs/gameObjects/meleeDefs.ts`; `wikigg:Ice_Axe@5181` | `loot-melee-ice_pick.svg` | stone-plated obstacle rule (`safe_01`) | S |
| `cutlass`, `cutlass_gold` | 30 / 35 damage, cleave. The gold one grants `pirate` while carried | `meleeDefs.ts`; `wikigg:Cutlass@5250` | `loot-melee-cutlass(-gold).svg` | new animation pose `cutlass` (`cut` / `cutReverse`); `pirate` perk; "perk while carried" rule | M |
| `naginata_daemon` | Naginata skin | `meleeDefs.ts`; `wikigg:Naginata@5067` | `loot-melee-naginata-daemon.svg` | Cobalt `case_09`, classless crates | S |
| `karambit_borealis` | pass-reward skin | `meleeDefs.ts` | `loot-melee-karambit-borealis.svg` | none (def only, no spawn) | S |

### 2.3 Throwables and explosions

| id | what | source | assets | dependencies | size |
|---|---|---|---|---|---|
| `coconut` + `explosion_coconut` | explodes on impact: 22 damage, 1 s slow, heals the thrower's side 7 HP on a direct hit; carry 3/6/9/12/15. Use the source's `cookable: false` (the wiki says true) | `.survev/shared/defs/gameObjects/throwableDefs.ts`; `wikigg:Coconut@7413` | `loot-throwable-coconut`, `proj-coconut-01` | heal-on-hit rule; `bagSizes` row | M |
| `tomato` + `explosion_tomato` | 11 damage, 0.5 s slow, the target drops 1 random item (`dropRandomLoot` exists in the sim). Source `cookable: true` (the wiki says false) | same; `wikigg:Tomato_(Throwable)@7178` | `loot-throwable-tomato`, `proj-tomato-01` | `bagSizes` row; Potato vs Tomato | S |
| `potato_lmgshot` + `explosion_potato_lmgshot` | the PMG-134 projectile: 8.5 damage, 0.25 s slow. Source velZ 5, radius 1.75 (the wiki says 3 and 1.7) | same; `wikigg:Petite_Potato@4006` | `proj-potato-*` | `potato_lmg` | S |
| `explosion_cobalt` | Cobalt explosion | `explosionDefs.ts` | - | `shrapnel_cobalt` | S |

### 2.4 Ammo and bag sizes

| change | source | dependencies | size |
|---|---|---|---|
| `50AE` renamed ".50 Caliber" (shared by DEagle, S&W 500, ASh-12, Barrett); bag 49/98/147/196 → 50/100/150/200/250 | `wikigg:.50_Caliber@7198`; `.survev/client/src/en.json:391-392` | l10n | S |
| `308sub` bag 10/20/40/80 → 20/40/55/70/85 | `wikigg:.308_Subsonic@7199`; balance-revert stats | - | S |
| **5-column `bagSizes`** (a fifth level for `backpack04`) and new rows `coconut`, `tomato` | `.survev/shared/gameConfig.ts`; `provenance.gameConfigDiffs` | integrity tests assume 4 columns; new rows change the bag layout on the wire (**`PROTOCOL_SCHEMA_VERSION` bump**, section 6) | M |

### 2.5 Gear, perks and roles

| id | what | source | assets | dependencies | size |
|---|---|---|---|---|---|
| `backpack04_cloud` "Experimental Pack" | level-4 pack with `maxPerks: 2`: two loot-perk slots | `.survev/shared/defs/gameObjects/gearDefs.ts:917`; `server/src/game/objects/player.ts:792,3961`; `wikigg:Equipment@7348` | `loot-pack-04-cloud.svg` | 5-column bags; loot-perk slot count = `backpack.maxPerks ?? 1` | M |
| `backpack04` "Tactical Pack" | level-4 pack, no spawn on master | `gearDefs.ts` | `loot-pack-04.svg` | 5-column bags | S |
| `helmet04_captain`, `helmet04_classless` | role helmets (noDrop) | `gearDefs.ts` | `player-helmet-captain.svg`, `player-helmet-classless.svg` | roles | S |
| `ap_rounds` | AP Rounds: ignore 20 % of armour, obstacle damage x1.5, darker tracers (`tracerColors.*.apSaturated`). Reserve safe, Lone Survivr | `server/src/game/objects/bullet.ts:596,636`, `weaponManager.ts:812`; `wikigg:AP_Rounds@7014` | `loot-perk-ap-rounds.svg` | bullet damage hook; tracer colours | M |
| `high_velocity` | High-Velocity Rounds: bullet speed x1.4, range x1.3 | `server/src/game/weaponManager.ts:863`; `wikigg:High-Velocity_Rounds@6474` | `loot-perk-*.svg` | bullet spawn hook | S |
| `amped_explosives` | Hyperfragmentation: throwables x2 speed, +75 % range; shrapnel x2 count, +50 % damage, +40 % speed | `server/src/game/objects/explosion.ts:146-155`; `wikigg:Hyperfragmentation@7217` | yes | explosion and throw hooks; Cobalt Demo role | M |
| `combat_stims` | for 5 s after a consumable: +15 % bullet damage, and hits heal allies 6 % | `server/src/game/objects/player.ts:1692`; `wikigg:Combat_Stimulants@6910` | yes | Cobalt Medic role | M |
| `lifeline` | Indomitable Spirit: adrenaline decays 20 % slower and absorbs fatal damage at 2:1 | `player.ts:1535,2494`; `wikigg:Indomitable_Spirit@5084` | yes | damage pipeline | M |
| `pirate` | Pirate's Bounty: melee kills drop `tier_pirate` items (12 % chance of `tier_pirate_rare`) | `player.ts:2729`; `wikigg:Pirate's_Bounty@5418` | yes | `cutlass_gold` | S |
| `assume_leadership` | adrenaline never below 50 %, +15 % size | `.survev/shared/defs/gameObjects/perkDefs.ts:9`; `wikigg:Assume_Leadership@5022` | yes | `captain` | S |
| role `captain` | 50v50: a Lieutenant alive when the Commander dies is promoted (Firepower + Assume Leadership, 8x scope, level-4 helmet) | `roleDefs.ts`; `wikigg:Captain@3532` | `img/gui/player-captain.svg`, `audio/.../captain_assigned_01` | promotion rule (`roles/roleSystem.ts`) | M |
| role `classless` | Cobalt: interacting with the Augmenting Vat (`vat_03`) adds a class perk; each kill swaps one class perk; classless class crates | `player.ts:936-969,2776`; `wikigg:Classless@6464` | yes | survev spawns the classless crates in server code, not defs | L |
| role perk swaps | Medic `windwalk` → `combat_stims`; Demo `fabricate` → `amped_explosives`; Lone Survivr `steelskin, ap_rounds|splinter, takedown, windwalk|field_medic` | `roleDefs.ts`; balance-revert `roles` | - | `$weighted` role perks (section 5.1) | S |

### 2.6 Outfits and cosmetics

| group | ids | assets | notes | size |
|---|---|---|---|---|
| outfits (22) | `outfitClassless outfitMaintainer outfitGD outfitFragtastic outfitSnow outfitBlackIce outfitBeachCamo outfitCoconut outfitWave outfitParrotfish outfitEvent outfitGold outfitRain outfitCowz outfitChameleon outfitPastel outfitChrys outfitFahrenheit outfitPotatoskin outfitAurora outfitSpringTree outfitHalloweenTree` | `img/player/player-{base,hands,feet,bag}-<id>.svg` | `outfitGold` "Capital Gains" drops from the Reserve's gold toilet; `outfitCoconut` from coconut tiers | S |
| emotes (25) | `emote_boffy sadboffy tomato cake leaf antisocial timeout traumatizedface bruh flatteredface salutingface screamingface` and 13 flag emotes (`flagbosnia flaglibya flagpalestine flagiran flaglebanon flagyemen flagtransgender flagpride flaglesbian flaggay flagasexual flagnonbinary flagbisexual`) | `img/emotes/*.svg` | survev also **removed** the original `emote_flagisrael`. Whether flag emotes ship at all, and which, is a **user decision**; the default ports the data and keeps the original's emote list. | S |
| heal / boost effects (7) | `heal_diamond heal_ankh heal_menacing boost_club boost_hermes boost_lightning boost_gearshift` | `img/particles/part-*.svg` | pass cosmetics; data only, no spawn | S |

### 2.7 Buildings, structures and obstacles

survev adds 55 buildings, 5 structures, 177 obstacles, 3 decals and 1 loot spawner (`diff-latest-vs-live.json`). Of these,
**15 buildings, 1 structure and 33 obstacles are already in `packages/defs/src/generated/mapObjects.json`**: `warehouse_03`,
`hut_01bh`, `hut_04`, `mansion_03`, `mansion_cellar_03`, `logging_complex_03sp`, `cache_01bh/01f/02w/02sp/02f/02bh/06bh/07f/07bh`;
`mansion_structure_03`; and obstacles such as `gun_mount_06`, `rail_4`, `case_08`, `crate_09bh`, `crate_12po`, `crate_12dev`,
`airdrop_crate_03po/03dev`, `barrel_01bh/f/bd`, `barrel_05`, `potato_01f-03f`, `tomato_01-03`, the warehouse and hut walls
and a few seasonal trees and stones. That leaves **40 buildings, 4 structures, 144 obstacles, 3 decals and 1 loot spawner**
to add; the rows below list only those. All use survev map art, which is present.

| group | ids | where (survev master) | source | dependencies | size |
|---|---|---|---|---|---|
| **The Reserve** (desert bank) | `reserve_01`, `reserve_basement_01`, `reserve_armory_01`, `reserve_security_01`, `reserve_vault_01`, `reserve_structure_01`; about 45 `reserve_*` walls, windows and bars; `vault_door_reserve`; `case_07de` (crimson tier), `safe_01de` (crimson perks), `rack_01` (revolvers, S&W 500), `gun_mount_06` (Gold Cutlass; the def is already ported, the Reserve places it), `toilet_05` (gold), `deposit_box_03`, `control_panel_07de`, `switch_01o/p/y`, `button_01/01g/01b`, `chair_01/02`, `table_04-09`, `sink_01` | desert `desert_town_02` (the survev version replaces the old bank); added v0.3.1 | `.survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:1238-3920`; `wikigg:The_Reserve@6560` | survev's `desert_town_02` must win over the original (structure override, section 5.1); vault puzzle (6 switches spelling МИХАИЛ; `world/puzzles.ts` exists); security-room lock 12 s (`useExpiration`, implemented in `world/interact.ts`); stone-plated safe | L |
| **Crimson airdrop** | `airdrop_crate_05` → `crate_17` (`tier_airdrop_crimson`: `deagle_dual`, `ash12`, `sw500`, `barrett`, weight 1 each) | desert planes (with `airdrop_crate_01` at 12) | `baseDefs.ts`; `wikigg:Airdrop_Crate@7242` | today removed by `revertForkReskins`; must agree with the airdrop-tier branch | S |
| **Workshop** | `workshop_01`, `workshop_complex_01` (+`_w`), 11 workshop walls, `gun_mount_07` (SPAS-16), `safe_01`, `vat`s, tables, `woodpile_03` | woods, woods_spring, woods_summer (1 each) | `modeBuildingDefs.ts:4755`; `wikigg:Workshop@5947` | stone-plated safe (`tier_safe`) | M |
| **Camp** | `camp_01`, `camp_01w`, `campfire_01` (heals 2 HP/s within 15 u) | snow, woods_snow (2-3 each) | `modeBuildingDefs.ts:32`; `wikigg:Campfire@2727` | heal regions (implemented: `world/buildings.ts`) | S |
| **Oasis** | `oasis_01` (desert), `oasis_01sv` (savannah): healing lake and island, coconut palms and barrels | desert, savannah lake centre | `modeBuildingDefs.ts:995`; `wikigg:Oasis@7294` | heal regions; coconut; today reverted by `eventMapFixes` | M |
| **Cloud bunker** | `bunker_structure_10`, `bunker_cloud_01`, `bunker_cloud_sublevel_01`, `bunker_cloud_compartment_01/02`, `case_09`, `case_10` (Experimental Pack + perk), `control_panel_07sv` (10 s lock), `vat_04/05`, glass dome | savannah centre | `.survev/shared/defs/mapObjects/buildings/bunkerDefs.ts:1482`, `structureDefs.ts:1076`; `wikigg:Cloud_Bunker@7243` | one-way exits; `backpack04_cloud` | L |
| **Cobalt additions** | `case_09` (Cobalt Case), `vat_03` (Augmenting Vat), coloured switches and buttons inside `bunker_twins_sublevel_01` / `bunker_twins_compartment_01`; `class_crate_common_classless`, `class_crate_rare_classless` | cobalt | `bunkerDefs.ts`; `wikigg:Cobalt_Case@5616` | structure override for the two shared bunker ids; `classless` role | M |
| **Alternate warehouse variants** | `warehouse_03sv`, `warehouse_03x`, `case_08sv` (Construction Case; `case_08` is already ported) | savannah, snow (main already has `warehouse_03`) | `baseBuildingDefs.ts:9763`; `wikigg:Construction_Case@5597` | - | S |
| **Caches and seasonal variants** | `cache_04` (+`x`, `cb`; river stone cache), `cache_01x/cb`, `cache_02x/su/cb/d/h`, `cache_03tr`, `cache_06cb`, `cache_07w`; `barn_02x`, `teahouse_01x`, `teahouse_complex_01x/01cb`, `logging_complex_02x/03x/03su`, `barn_basement_structure_01x`, `mansion_structure_01x`; trees, stones, bushes (`*_x`, `*_sp`, `*_su`, `*_cb`, `*_tr`, `*_bh`, `*_de`); `tree_interior_11` (via `house_red_01x/02x`) | main, snow, turkey, woods_*, event maps | `cacheDefs.ts:386`; `wikigg:Caches@6553` | `revertForkReskins` off | M |
| **Potato vs Tomato and spring** | `egg_01-04`, `crate_13po`, `airdrop_crate_04po`, `squash_02` (the potato, tomato, `crate_12*` and `airdrop_crate_03*` defs are already ported) | faction_potato, potato_spring, turkey | `modeBuildingDefs.ts` | `eventMapFixes` off | S |
| misc | `chest_03sv`, `chest_03tr`, `crate_09de`, `barrel_01w`, `bush_06tr`, `bush_07cb`, `gun_mount_empty`, `stairs_02/03`, decals `decal_camera_01`, `decal_pipe_01`, `decal_caduceus_01`, spawner `loot_tier_barn_melee` | various | survev map object defs | `renameTiers` off | S |

### 2.8 Maps, modes and events

All 21 survev MapDefs are already in `packages/defs/src/generated/maps.json`. The work is to **stop reverting** what survev
added inside them (`provenance.eventMapFixes`, `revertForkReskins`, the balance revert), and to take survev's
`mapGen` and loot tables as they are:

| map | what comes back |
|---|---|
| desert | the Reserve in Small Town, the Oasis, the crimson airdrop, the Saloon cellar .50 guns, Hyperfragmentation in gold drops |
| savannah | Cloud bunker, Oasis, a second river, +40 % crates, the Barrett and S&W 500, its own loot tables (drop or extend our `LOOT_BANS.savannah`) |
| woods, woods_spring, woods_summer | Workshop, `cache_07w`, IMD-2 and SPAS-16, M870 in regular loot |
| snow, woods_snow | Camps, Ice Axe, winter sniper skins, palm trees, 3 iced hardstones |
| beach | Cutlass, Gold Cutlass, Coconut, Pirate's Bounty |
| faction, faction_potato | Captain, Barrett and ASh-12 in military airdrops, SPAS-16; PMG-134 and Tomato in Potato vs Tomato |
| cobalt | Classless, Cobalt Case, Augmenting Vat, the Medic and Demo perk swaps, the unlock at circle 1 + 30 s |
| potato_spring, turkey, birthday | eggs; the updated turkey map; birthday as survev has it |
| main and seasonal copies | `cache_04`, survev loot weights, the Alternate Warehouse in all team modes, +5 outhouses, `high_velocity` in `tier_perks` |
| `faction_snow` (winter branch only) | opt-in after `feat/winter-factions` merges |

The golden `MAIN_12345_HASH` (`packages/sim/test/mapgen.test.ts:10`) and `modes.rules.test.ts` / `mapValidation.ts` change.

### 2.9 Mechanics (survev-era rules)

| rule | source | status in our sim | size |
|---|---|---|---|
| input buffering: a semi-auto shot pressed up to 0.1 s early still fires (desktop) | `wikigg:Guns@7410` (v0.2.0) | not implemented | M |
| downed damage buffer 0.1 s, downed knockback | `wikigg:Changelog@7208` (v0.0.19, v0.3.02) | implemented (`world/downed.ts`, `rules.downedDamageBuffer`) | - |
| Commander flare fires itself after 15 s | v0.1.2; balance-revert `other` | implemented as a rules knob, **off by default** (`roles/roleSystem.ts:137`); turn it on | S |
| faction promotion order (all roles in turn), promotion heals, role inventories (bandages, healthkit) | balance-revert `roles` | the reverted values ship today; the port flip brings survev's | S |
| red zone damage ramp from the 3rd zone; disconnected players take full gas damage; gas starts 10 s after the 2nd player joins | `wikigg:Red_Zone@3924`, Changelog v0.2.31, v0.2.23, v0.1.0 | verify against `world/context.ts` and the gas code; add knobs where missing | S-M |
| airstrikes sometimes target players | Changelog v0.1.22 | check the airstrike code (the rebirth airstrike variants touch it) | S |
| ricochet (3 bounces, damage / (n+1), range / 1.5) and 15 % headshot chance | `.survev/shared/gameConfig.ts:309`, `wikigg:Guns@7410` | implemented (`combat/bullets.ts`, `combat/damage.ts`) | - |
| stone-plated obstacles (only hammers and the Ice Axe break them) | `obstacleDefs` `stonePlated`; `wikigg:Safe@6771` | new obstacle field | S |
| "perk while carried" (Gold Cutlass) | `meleeDefs.ts` `perk: "pirate"` | new | S |

`packages/sim/src/world/coverage.ts` lists every def field and where it is implemented. Each new survev field
(`stonePlated`, `maxPerks`, melee `perk`, heal-on-hit, view shrink, ...) gets a row there.

### 2.10 Pipeline work that all of section 2 needs

| item | file | size |
|---|---|---|
| port policy file and the hybrid merge (section 5.1) | `tools/port-survev/**` | L |
| survev-only sounds (19 today: `barrett_01`, `ash12_*`, `sw500_*`, `imbel_*`, `spas16_*`, `potato_lmg_*`, `captain_assigned_01`) | `apps/client/scripts/sound-defs.ts` also reads `.survev/client/src/soundDefs.ts` (marked `source: "survev"`) | S |
| English names | `apps/client/scripts/l10n-items.ts` fills gaps from `.survev/client/src/en.json` | S |
| Korean names | `apps/client/src/l10n/ko.ts`; survev's `client/public/l10n/ko.json` has `iceaxe`, `cutlass`, `spas16`, `imbel`; write the rest (Barrett M107 → "바렛 M107", ...) and add glossary rows to `docs/research/l10n-ko.md` | S |
| client effects | `50cal` casing (`.survev/client/src/objects/particles.ts:1953`), explosion effects for coconut, tomato, PMG shot and Cobalt (`apps/client/src/fx/explosions.ts`), cutlass animations (`apps/client/src/objects/anims.ts`), AP tracer colours, a fifth bag level and two perk slots in the HUD | M |

**Total for section 2:** roughly 15-20 agent-days, most of it in the Reserve, the Cloud bunker, Classless and the perks.

---

## 3. Balance: survev changes to items we already have

Under option B these all come in with the port, because the port stops applying `balance-revert.json`. The numbers below
are original 0.8.82 → survev master (`docs/research/provenance/balance-revert.json`, `.survev/balance.txt`).

| group | changes | recommendation |
|---|---|---|
| DMRs | headshot x2 → x1.5 (Mk45G x1.75) with damage up: VSS 22 → 24 (speed 95 → 110, falloff 0.85, quality 0), Mk 12 22.5 → 23, M39 27 → 28, SVD 36 → 37, Mk45G 28 → 29; L86 26.5 → 25 | **Adopt.** Coherent set (v0.4.3); our new DMRs (section 4) are tuned against these values. |
| heavy marksman and snipers | Mk 20 SSR 60 → 81 (headshot 1.25); M1 Garand 35 → 44 (spread 0.4, speed 144, range 444, falloff 0.94, headshot 1.44); SV-98, Mosin and M1014 headshot 1.5 → 1.25; the AWM-S may headshot (x1, the helmet's armour counts) | **Adopt.** These are survev's answer to its .50 guns; the Barrett and the new .50 rifles (Hecate, Lynx) sit on this scale. |
| assault rifles and SMGs | AN-94 17.5 → 20 damage, speed 110 → 120; UMP-9 fireDelay 0.35 → 0.3, burst 0.07 → 0.06, damage 15 → 14.5; FAMAS burst 0.07 → 0.05; Groza and P30L quality 1 → 0; QBB-97 quality 1 and bullpup | **Adopt.** Quality affects potato swaps and Cobalt rolls; check `weapons/potatoSwap.ts`. |
| pistols | M9 12 → 13 damage, spread 8 → 3-5 (cursed 3); M1911 14 → 16, spread 6-7 → 2-3; dual spreads tighter; dual pistols spawn with twice the ammo; `dualOffset` 0.6 → 0.55 | **Adopt** the gameplay fields. `dualOffset` is presentation-coupled: keep 0.6. |
| melee | Spade obstacle damage 1 → 1.3, cooldown 0.35 → 0.3 (also `spade_assault`); melee `headshotMult` removed | **Adopt.** |
| throwables | Snowball 2 → 6 (heavy 5 → 28, freeze 2 s), speed 40 → 52; Potato 2 → 8 (heavy 5 → 15, two random drops); heavy fuse 5 → never; Strobe strike delay 2.5 → 3 | **Adopt** (event-mode feel only). |
| perks | Flak Jacket size x0.2 → x0.1 plus +3 frag / +2 MIRV carry; Ironskin 50 % → 45 %; Hollow-Points +10 % speed; .45 in the Chamber: a 1-in-6 empowered shot; 9mm Overpressure x1.25 → x1.2 as a multiplier (the original's ten `bullet_*_bonus` ids become unused); ammo perks x1.08 → x1.12; Splinter outer bullets 0.45 → 0.5; Fabricate every 10 s, up to 8 mixed explosives | **Adopt.** Keep the unused `bullet_*_bonus` ids in the registry: they are part of the original prefix. |
| roles | Commander, Lieutenant, Bugler, Grenadier, Marksman, Recon and Lone Survivr get bandages, healthkits and sodas; Bugler gets a pan; Grenadier MP220 → Saiga-12 with 15 frags and 10 MIRVs; Lone Survivr perks as in 2.5; faction promotion order; Medic and Demo perk swaps | **Adopt**, with the `$weighted` conversion of role perks (section 5.1). |
| game config | bag sizes (2.4), downed damage buffer 0.1 s, Cobalt unlock at circle 1 + 30 s | **Adopt**, including 5 columns. Keep `protocolVersion` 78. |
| loot tables (313 entries) and map spawns (192 entries) | tier_guns reweights (v0.2.2: IMD-2 2.75, M870 2.5, DP-28 and BAR 2.75, MP220 2, Saiga 0.15, SPAS-12 2.5, QBB-97 0.125, PKP 0.007, M249 0.011), new `tier_armor`, airdrop counts (v0.2.3), **faction (50v50) gold drop** additions (Groza-S 3, SPAS-16 2, SV-98 2, Dual P30L 0.3, Dual DEagle 0.3, Barrett 0.5, ASh-12 0.5; `.survev/shared/defs/maps/factionDefs.ts:343`; the classic main `tier_airdrop_rare` is still garand 6, awc 3, pkp 0.08, m249 0.1, m4a1 4, scorpion 5, ots38_dual 4.5 = 22.68, `baseDefs.ts:612`, so classic gold drops get none of these without the rebirth overlay), Cobalt class-crate reweights, the map-spawn additions of 2.8 | **Adopt wholesale**: this *is* "survev's map generation". The airdrop-tier overlay is applied on top (section 6). |
| presentation | `barrelLength` on about 30 guns (survev's new world models); display renames | **Keep original**, except ".50 Caliber". |

What adopting costs: the oracle fixtures (`tools/oracle`) and the map golden must be regenerated, and
`packages/defs/test/original-values.test.ts` changes from "original values" to "original presentation fields, survev
gameplay fields". Under option B survev's own simulation becomes a closer oracle than before.

---

## 4. The user's guns

The first list has 26 names. One of them, the Glock 18, is already in the game, which leaves **25 new guns**. Six names
came later: Honey Badger, DBS, M202 and MG42 are new; Abakan and Tommy gun already exist. That makes **29 new gun ids**
(the M79 included), plus `tec9_dual` and `vz61_dual`, plus an optional `m1928`. None of them is in survev master, in
`feat/winter-factions`, or on the wiki.

Conventions:
- Every gun gets a `bullet_<id>`. Launchers also get a projectile or explosion def.
- "Ref" is the existing gun the stats are scaled from (`packages/defs/src/generated/gameObjects.json`, or survev for the
  Barrett and ASh-12).
- DPS = damage / fireDelay.
- Loot columns: **floor** is main `tier_guns`, or `tier_shotguns` where marked. **T1** and **T2** are the airdrop-tier
  tables of the feature branch (`tier_airdrop_tier1/2`, `packages/defs/src/rebirth/airdropLoot.ts`). **Gold** is
  `tier_airdrop_rare` (`airdrop_crate_02` → `crate_11`) and each mode's gold-equivalent table.
- Bot tiers use the format of `packages/bots/src/knowledge/gunTiers.ts` (`[id, tier, forgiveness, mainMap]`). They are
  estimates.

### 4.1 One row per gun

| # | id | real weapon | class / mode | ammo | mag (ext) | key stats vs ref | mechanics | floor / T1 / T2 / Gold | bot |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `aa12` | MPS AA-12, **slug only** | shotgun, auto | `12gauge` | 8 (10) | ref M1014 slug: dmg 60 (x0.78), fireDelay 0.25, box reload 3.0, spread 5/5, attack -1; DPS 240 | `bullet_aa12` from `bullet_slug`, `bulletCount 1` | shotguns 0.05 / - / 1.0 / 0.5 | A+ 0.55 |
| 2 | `wa2000` | Walther WA 2000 (.300 Win Mag) | DMR, semi, bullpup | `762mm` | 6 (8) | ref SVD: dmg 48 (x1.33), fireDelay 0.33, reload 2.9, range 450, speed 150, headshot 1.75; DPS 145 | - | - / - / 1.5 / 0.5 | A 0.28 |
| 3 | `hecate` | PGM Hécate II (.50 BMG) | sniper, bolt | `50AE` | 7 (9) | ref Barrett / AWM-S: dmg 165 (between the Barrett 99 and the AWM-S 180, which also has fireDelay 1.5 and is gold; at 130 the AWM-S strictly beat it), obstacle 2.5, fireDelay 1.5, reload 4.0, range 500, speed 200, headshot 1.25, equip -1 / attack -4 | `50cal` casing, bolt cycle sound | **Gold only** 1.0 | S-aim 0.16 |
| 4 | `lynx` | "링스": PUBG's Lynx AMR = the Hungarian **SERO/Gepárd GM6 Lynx**, a semi-auto bullpup .50 BMG (**flag**) | anti-materiel, semi | `50AE` | 5 (6) | ref Barrett: dmg 118, **obstacle 6** (breaks cover), fireDelay 1.1, reload 4.2, equip -1.5 / attack -5 | optional `speed.carry -0.5` | **Gold only** 0.75 | S-aim 0.18 |
| 5 | `spas15` | Franchi SPAS-15 | shotgun, semi | `12gauge` buckshot | 6 (8) | ref Saiga-12: fireDelay 0.3, spread 8 (x0.8), box reload 2.6 | distinct from survev `spas16` (auto flechette) | shotguns 0.1 / 1.5 / 1.0 / - | A 0.7 |
| 6 | `m60` | M60 GPMG | LMG, auto | `762mm` | 100 (150) | ref PKP: dmg 16, fireDelay 0.105, reload 5.5, obstacle 2, attack -4; DPS 152 (below M249 175 / PKP 180, so **not gold**) | - | 0.02 / - / 1.0 / - | A- 0.52 |
| 7 | `mk14` | Mk 14 EBR (the existing `m39` is its USMC variant) | DMR, **auto** | `762mm` | 20 (30) | ref M39: dmg 24, fireDelay 0.14, spread 2.5/5, reload 2.8; DPS 171 | full auto keeps it distinct from `m39` | - / - / 1.5 / 0.5 | A+ 0.33 |
| 8 | `dshk` | DShK, carried and hip-fired | heavy MG, auto | `50AE` | **30** (30; the user asked for a 30-round box, so Firepower does not extend it) | ref PKP / ASh-12: dmg 34, obstacle 3, fireDelay 0.115, **reload 7.5**, range 300, `ammoSpawnCount` 30; DPS 296 | **`speed.carry -1`**, equip -2, attack -5: 11 / 9 / 2 u/s carried / held / firing | - / - / 0.2 / 0.5 | A+ 0.5 |
| 9 | `m79` | M79 "Thumper" (original surviv **v0.9.1**, after 0.8.82) | launcher, single | `40mm` (new) | 1 | fandom infobox (`research-cache/fandom/pages/M79.json`) gives only: reload 2.3, switch 0.9, `ammoSpawnCount` 10, damage 125, obstacle x1.1, shrapnel type `shrapnel_frag`, effect `frag`, player collision, no fuse. **Design values:** grenade speed 40, velZ 6.8, fuse 1.3 s (about 52 u), radius 5-12, 12 shrapnel, in its own `explosion_m79` | `projType` lob (exists) | 0.02 / 1.0 / 1.0 / - (50v50 gold military 0.5) | A 0.6, launcher |
| 10 | `panzerfaust` | Panzerfaust 60/100, single use (**flag**) | launcher, single | none | 1 charge | rocket bullet: 40 direct, speed 55, range 60; explosion 160, radius 4-10, obstacle 4 | **`charges 1` + discard** | 0.02 / 1.0 / - / - | B+ 0.55, launcher |
| 11 | `rpg7` | RPG-7 | launcher, single | `rocket` (new) | 1 | reload 3.0, `ammoSpawnCount` 4 (two side stacks of 2); rocket bullet: 50 direct, speed 70, range 120; explosion 150, radius 5-12, obstacle 3 | **gun and rockets only from gold drops** | **Gold only** 1.5 | S 0.6, launcher |
| 12 | `asval` | AS Val (the VSS's sibling) | assault, auto, suppressed | `9mm` (as the VSS) | 20 (30) | ref VSS: dmg 13, fireDelay 0.075, reload 2.2, range 120; DPS 173 (at 15 dmg it was 200, above every AR) | suppressed tracer | 0.05 / 1.5 / - / - | A- 0.5 |
| 13 | (`glock`) | Glock 18: **already in the game** as `glock` "G18C" (+ `glock_dual`) | - | - | - | no new gun | - | unchanged | existing |
| 14 | `tec9` (+ `tec9_dual`) | Intratec TEC-9 | pistol, semi | `9mm` | 32 (36) | ref M9: dmg 11, fireDelay 0.1, reload 2.0, spread 6/6, range 90; DPS 110; dual: 64 rounds, fireDelay 0.07 | `dualWieldType` | 3 / - / - / - | C+ 0.6 (dual B-) |
| 15 | `boys` | Boys anti-tank rifle Mk II (**flag**) | sniper, bolt | none | **10 charges** | ref SV-98 / Barrett: dmg 110, obstacle 4, fireDelay 1.25, range 450, speed 195, headshot 1.25, equip -1 / attack -3 | **`charges 10` + discard**, `ignoreEndlessAmmo`; a dropped rifle keeps its shots | 0.01 / 1.0 / 1.0 / - | A 0.25 |
| 16 | `ak74` | AK-74 | assault, auto | `556mm` (for 5.45) | 30 | ref AK-47: dmg 12, fireDelay 0.092, spread 2/6, speed 108; DPS 130 | - | 1.5 / - / - / - | B 0.44 |
| 17 | `m16a4` | M16A4 | assault, 3-round burst | `556mm` | 30 | ref FAMAS: dmg 16, burst 0.065, fireDelay 0.32, range 220 | - | 0.7 / 1.0 / - / - | A- 0.38 |
| 18 | `g36c` | HK G36C | assault, auto | `556mm` | 30 | ref M416: dmg 12, fireDelay 0.08, spread 3/5, range 150, reload 2.2; DPS 150 | - | 1.2 / - / - / - | B 0.45 |
| 19 | `vz61` (+ `vz61_dual`) | "Scorpion": the **vz. 61 Škorpion** (**flag**; the existing `scorpion` is the CZ-3A1, a CZ Scorpion EVO 3) | machine pistol, auto | `9mm` (for .32 ACP) | 20 (30) | ref G18C: dmg 9.5, fireDelay 0.07, spread 7/7, range 55, reload 1.7 | - | 2 / - / - / - | C+ 0.65 |
| 20 | `bizon` | PP-19 Bizon | SMG, auto | `9mm` | 64 (80) | ref MP5: dmg 10, fireDelay 0.088, reload 2.9; DPS 114, 640 per magazine | - | 3 / - / - / - | B 0.6 |
| 21 | `fal` | FN FAL (survev's `imbel` is a 5.56 FAL derivative, a different gun) | DMR, semi | `762mm` | 20 (30) | ref Mk 12 / M39: dmg 25, fireDelay 0.17, range 300, spread 1.5/4; DPS 147 | - | 0.1 / 2.0 / - / - | A- 0.32 |
| 22 | `g3` | HK G3 | assault, auto | `762mm` | 20 | ref SCAR-H: dmg 16.5, fireDelay 0.1, reload 2.8; DPS 165 (AK 135, Groza 160, Groza-S and SCAR-H 167) | - | 0.2 / 1.5 / - / - | B+ 0.42 |
| 23 | `sig550` | SIG SG 550 | assault, auto | `556mm` | 30 | ref M4A1-S: dmg 13, fireDelay 0.085, spread 1.5/4, range 200, reload 2.4; DPS 153 | not suppressed | 0.1 / 1.5 / - / - | A- 0.37 |
| 24 | `p90` | FN P90 | SMG, auto, bullpup | `9mm` (for 5.7) | 50 (60) | ref Vector: dmg 10, fireDelay 0.06, range 100, reload 2.6; DPS 167 (T2 sits with the Vector 197 and CZ-3A1 195; at 136 it was MP5-level) | - | 0.02 / - / 1.5 / - | A- 0.55 |
| 25 | `mgl` | Milkor MGL (6-shot revolver launcher) | launcher, semi | `40mm` | 6 | ref M79: fireDelay 0.55, shell-by-shell reload 0.8 each, `ammoSpawnCount` 12; same grenade as the M79 | `projType` (exists) | **Gold only** 1.0 | S 0.6, launcher |
| 26 | `gl06` | B&T GL06, 40x46 mm single shot (**flag**) | launcher, single | `40mm` | 1 | ref M79: reload 2.0, switch 0.6; the round **bursts at the cursor**: bullet speed 55, range 60; explosion 100, radius 4-10 | `toMouseHit` + `onHit` (exists, as the USAS-12) | 0.02 / 1.0 / - / - | A- 0.6, launcher |
| 27 | `honeybadger` | AAC Honey Badger (.300 BLK, suppressed) | assault, auto, suppressed | `762mm` (as survev's winter-branch `aug` "AUG .300") | 30 | ref M4A1-S: dmg 13, fireDelay 0.075, range 120, reload 2.3; DPS 173 | - | 0.02 / 1.0 / 0.5 / - | A- 0.45 |
| 28 | (`an94`) | Abakan: **already in the game** as `an94` "AN-94" | - | - | - | no new gun; optional: add to T1 at 1.0 | - | optional T1 1.0 | existing A (set `mainMap` true if added) |
| 29 | (`m1a1`), optional `m1928` | Tommy gun: **already in the game** as `m1a1` (Thompson M1A1). Optional variant: Thompson M1928 with a 50-round drum | SMG, auto | `45acp` | 50 (100) | ref M1A1: dmg 12.5, fireDelay 0.075, reload 3.4; DPS 167 | - | desert floor 0.5 / 1.0 / - / - (classic maps carry no .45) | B+ 0.6 |
| 30 | `dbs` | DBS = Standard Manufacturing DP-12 | shotgun, double-barrel pump | `12gauge` buckshot | 14 | ref M870: two shots 0.2 s apart, then a 0.75 s pump; reload 2 shells per 0.9 s; spread 9 | **`pumpEvery 2`, `pumpDelay 0.75`** (new, 5.6) | shotguns 0.05 / - / 1.0 / 0.3 | A+ 0.62 |
| 31 | `m202` | M202 FLASH | launcher, single | none | 1 charge = 4 rockets | `bulletCount 4`, spread 8; each rocket: 20 direct, speed 65, range 90; explosion 70, radius 3.5-8 (280 if all four hit one spot) | **`charges 1` + discard**; the 4-rocket volley uses `bulletCount` (exists); incendiary burning deferred | - / - / 0.2 / 0.75 | A+ 0.6, launcher |
| 32 | `mg42` | MG 42 (7.92x57) | LMG, auto | `762mm` | 50 (75) | ref PKP: dmg 12, **fireDelay 0.05** (1200 rpm), reload 4.5, spread 4/10, equip -0.5 / attack -5; DPS 240, only 600 per drum | - | 0.005 / - / 0.75 / 0.5 | A+ 0.5 |

Map rules (`packages/defs/src/gunClasses.ts` `LOOT_BANS` and survev's per-map tables, `wikigg:Guns@7410` "Map restriction"):
- Woods: only shotguns and LMGs on the floor.
- Savannah: only pistols, SMGs, DMRs and snipers (plus the SCAR-H).
- Desert: no 9mm, so TEC-9, vz. 61, Bizon, P90 and AS Val stay off the desert floor.
- Classic and Factions: no .45, so the M1928 is desert-only on the floor.
- Launchers: from airdrops on every map; on the floor only on main and desert.

### 4.2 Gold drop share

survev's main `tier_airdrop_rare` totals 22.68. The gold weights above, plus the Barrett overlay (section 2.1), add
about 8.8 (the M60 is no longer gold), so the original gold guns fall to about 72 % of gold rolls. That is acceptable for "more gold guns". The
alternative keeps the original share by scaling every new gold weight by 0.5. The new floor guns add about 15 to main
`tier_guns` (85.6 today); scale them by 0.5, or put them in a `tier_guns_rebirth` sub-table with a fixed share, if the
classic floor feel must stay. Decide in the wave-5 balance pass using bot matches.

### 4.3 Ambiguous identifications (flagged; defaults chosen so work can start)

| request | default assumption | alternative | question for the user |
|---|---|---|---|
| 링스 / Lynx | PUBG's **Lynx AMR** = the Hungarian **SERO/Gepárd GM6 Lynx**: a semi-auto bullpup .50 BMG (IMFDB "GM6 Lynx"; PUBG wiki "Lynx AMR": semi-auto, 118 damage, .50, care package only, 5 rounds at launch, raised later). Default: semi, 5 (6) rounds | low probability: the Steyr HS .50 (bolt-action, single shot or 5 rounds) | "링스 = 배그 Lynx AMR(헝가리 GM6 Lynx, 반자동 .50) 맞나요?" |
| Scorpion | new id **`vz61`**, the vz. 61 Škorpion machine pistol | the existing `scorpion` "CZ-3A1" (CZ Scorpion EVO 3); then no new gun | "스콜피온 = vz.61 맞나요? (기존 CZ-3A1은 EVO 3)" |
| GL-06 | **Brügger & Thomet GL06**, a 40x46 mm single-shot launcher | - | confirm |
| Boys "II" | **Boys Mk II**, the shortened airborne .55 Boys | - | confirm; 10 shots, then discarded |
| Panzerfaust | the WWII **single-use** Panzerfaust 60/100 | the reloadable Panzerfaust 3 (then like the RPG, with `rocket` ammo) | confirm |
| Mk 14 EBR | full-auto DMR, distinct from `m39` (which is the USMC Mk 14) | - | none |
| SPAS-15 | semi-auto buckshot, distinct from survev's `spas16` (auto flechette) | skip it, since `spas16` arrives with the port | confirm |
| FN FAL | 7.62 semi DMR, distinct from survev's `imbel` (5.56 FAL-derived LMG) | - | none |
| Glock 18 / Abakan / Tommy gun | existing `glock`, `an94`, `m1a1` | variants: a 33-round `glock18`, `m1928` (drum) | "이미 있는 총이에요. 그대로 둘까요, 변형을 추가할까요?" |
| .50 ammo (Hecate, Lynx, DShK) | survev's convention: everything .50 uses `50AE` ".50 Caliber" | a new `50bmg` ammo (bag 20/40/60/80/100), one more HUD slot and wire row | confirm |
| M202 | explosion only | incendiary burning area (a new mechanic) | confirm |

### 4.4 Asset checklist for the user

Put the files in **`assets-user/`** at the repo root. The folder is gitignored, so the files never reach the public
repository (section 5.8). The layout mirrors survev's `client/public`.

Rules for every gun:
- **Loot icon**: `assets-user/img/loot/loot-weapon-<id>.png` (or `.svg`). 128x128 canvas, the gun centred and diagonal
  like the originals. The ring is drawn separately.
- **Held sprite**: `assets-user/img/guns/gun-<id>-01.png`. Top-down, barrel pointing **up**, transparent background.
  Reference logical sizes: pistol `gun-short-01` 32x100, SMG `gun-med-01` 32x128, rifle `gun-long-01` 32x188,
  `gun-awc-01` 60x236, survev `gun-barrett-01` 70x250, launcher `gun-potato-cannon-01` 56x248. A **"plain bar"** gun sends
  no file: it uses `gun-short-01` / `gun-med-01` / `gun-long-01` with a tint colour (tell us the colour, or we pick one).
- **Sounds**: `assets-user/audio/guns/<id>_01.mp3` (fire), `<id>_reload_01.mp3` (reload; for shell-by-shell guns, one
  shell), optional `<id>_switch_01.mp3` (deploy; otherwise a similar gun's), `<id>_cycle_01.mp3` for bolt and pump
  actions, optional `<id>_discard_01.mp3` for single-use guns. Short mono mp3.
- Anything missing falls back to the donor gun's art and sound, so the game always runs.

| id | loot icon | held sprite (bar = plain bar proposed) | sounds | extra |
|---|---|---|---|---|
| aa12 | `loot-weapon-aa12` | `gun-aa12-01` | `aa12_01`, `aa12_reload_01`, (`aa12_switch_01`) | |
| wa2000 | `loot-weapon-wa2000` | `gun-wa2000-01` | `wa2000_01`, `wa2000_reload_01`, (`_switch_01`) | |
| hecate | `loot-weapon-hecate` | `gun-hecate-01` (long, about 70x250) | `hecate_01`, `hecate_reload_01`, `hecate_cycle_01`, (`_switch_01`) | |
| lynx | `loot-weapon-lynx` | `gun-lynx-01` | `lynx_01`, `lynx_reload_01`, (`_switch_01`) | |
| spas15 | `loot-weapon-spas15` | `gun-spas15-01` | `spas15_01`, `spas15_reload_01`, (`_switch_01`) | |
| m60 | `loot-weapon-m60` | `gun-m60-top-01` + optional magazine layer `gun-m60-bot-01` (LMG convention, as `gun-m249-top-01` / `gun-m249-bot-01`), or bar | `m60_01`, `m60_reload_01`, (`_switch_01`) | |
| mk14 | `loot-weapon-mk14` | `gun-mk14-01` | `mk14_01`, `mk14_reload_01`, (`_switch_01`) | |
| dshk | `loot-weapon-dshk` | `gun-dshk-top-01` (big, about 70x260) + optional box layer `gun-dshk-bot-01` | `dshk_01`, `dshk_reload_01` (long), (`_switch_01`, `_cycle_01`) | |
| m79 | (fandom original: `loot-weapon-m79.img`) | (fandom original: `gun-m79-01.img`) | `m79_01`, `m79_reload_01`, (`_switch_01`) | art only if the user prefers it over the originals; the sounds are needed |
| panzerfaust | `loot-weapon-panzerfaust` | `gun-panzerfaust-01` | `panzerfaust_01`, (`_switch_01`, `_discard_01`) | no reload sound, no ammo icon |
| rpg7 | `loot-weapon-rpg7` | `gun-rpg7-01` (optional warhead layer `gun-rpg7-top-01`) | `rpg7_01`, `rpg7_reload_01`, (`_switch_01`) | **ammo icon `img/emotes/ammo-rocket.png`** (128x128); optional `img/loot/loot-ammo-rocket.png` |
| asval | `loot-weapon-asval` | `gun-asval-01` or bar | `asval_01` (suppressed), `asval_reload_01` | |
| tec9 | `loot-weapon-tec9` | `gun-tec9-01` or bar (`gun-short-01`) | `tec9_01`, `tec9_reload_01` | dual: optional `loot-weapon-tec9-dual` and `tec9_reload_02` (as `glock_dual` uses `loot-weapon-glock-dual.img` and `glock_reload_02`); the singles are the fallback |
| boys | `loot-weapon-boys` | `gun-boys-01` (long, top magazine) | `boys_01`, `boys_cycle_01`, (`_switch_01`, `_discard_01`) | no reload sound, no ammo icon |
| ak74 | `loot-weapon-ak74` | bar (`gun-long-01`) or `gun-ak74-01` | `ak74_01`, `ak74_reload_01` | |
| m16a4 | `loot-weapon-m16a4` | bar or `gun-m16a4-01` | `m16a4_01`, `m16a4_reload_01` | |
| g36c | `loot-weapon-g36c` | bar (`gun-med-01`) or `gun-g36c-01` | `g36c_01`, `g36c_reload_01` | |
| vz61 | `loot-weapon-vz61` | bar (`gun-short-01`) or `gun-vz61-01` | `vz61_01`, `vz61_reload_01` | dual: optional `loot-weapon-vz61-dual` and `vz61_reload_02`; the singles are the fallback |
| bizon | `loot-weapon-bizon` | `gun-bizon-01` (helical magazine) or bar | `bizon_01`, `bizon_reload_01` | |
| fal | `loot-weapon-fal` | bar or `gun-fal-01` | `fal_01`, `fal_reload_01` | |
| g3 | `loot-weapon-g3` | bar or `gun-g3-01` | `g3_01`, `g3_reload_01` | |
| sig550 | `loot-weapon-sig550` | bar or `gun-sig550-01` | `sig550_01`, `sig550_reload_01` | |
| p90 | `loot-weapon-p90` | `gun-p90-01` or bar (`gun-med-01`) | `p90_01`, `p90_reload_01` | |
| mgl | `loot-weapon-mgl` | `gun-mgl-01` (cylinder) | `mgl_01`, `mgl_reload_01` (one shell), (`_cycle_01`) | |
| gl06 | `loot-weapon-gl06` | `gun-gl06-01` | `gl06_01`, `gl06_reload_01` | |
| honeybadger | `loot-weapon-honeybadger` | bar or `gun-honeybadger-01` | `honeybadger_01` (suppressed), `honeybadger_reload_01` | |
| dbs | `loot-weapon-dbs` | `gun-dbs-01` | `dbs_01`, `dbs_reload_01` (shell), `dbs_cycle_01` (pump) | |
| m202 | `loot-weapon-m202` | `gun-m202-01` (four-tube box) | `m202_01` (salvo), (`_switch_01`, `_discard_01`) | no reload sound |
| mg42 | `loot-weapon-mg42` | `gun-mg42-top-01` + optional drum layer `gun-mg42-bot-01` | `mg42_01`, `mg42_reload_01` | |
| m1928 (optional) | `loot-weapon-m1928` | `gun-m1928-01` (drum) | `m1928_01`, `m1928_reload_01` (or reuse `m1a1_*`) | |

Shared files for the new ammo:
- **40mm needs nothing from the user.** `tools/assets/import.ts:128-150` gap-fills missing sprite refs from
  `research-cache/fandom/images.json`, which holds the original renders `Ammo-40mm.img.png`, `Loot-ammo-40mm.png`,
  `Shell-40mm.png` (the projectile), `Gun-m79-01.img.png` and `Loot-weapon-m79.img.png`. The rebirth defs reference
  `ammo-40mm.img`, `loot-ammo-40mm`, `shell-40mm`, `gun-m79-01.img` and `loot-weapon-m79.img`, so the gap-fill supplies
  them once `collectSpriteRefs` also reads the rebirth defs (5.8). The user may still send replacements.
- `img/emotes/ammo-rocket.png` (128x128): needed, there is no original.
- Optional `img/proj/proj-rocket-01.png`, used only if rockets get a sprite (section 5.4).

---

## 5. New mechanics and ammo

### 5.1 Port policy (survev content)

- `tools/port-survev/policy.json`, checked in and echoed into `provenance.json`:
  `{ baseline: "survev", sharedGameObjects: "survev-gameplay" | "original", balanceRevert: {all sections: false},
  reskinRevert: false, eventMapFixes: [], renameTiers: false, excludeTypes: ["quest","pass","xp"], excludeIds: [...],
  survevStructureOverrides: [...] }`.
- `lib/objects.ts` `portGameObjects`: append survev-only ids after the original ids, in survev order.
  `provenance.gameObjects` gets the value `"survev-only"`.
- Option B: merge survev gameplay fields over each shared def through a per-type field allowlist.
  - gun: `ammo maxClip maxReload extendedClip extendedReload reloadTime reloadTimeAlt fireDelay switchDelay shotSpread
    moveSpread headshotMult speed fireMode burst* ammoSpawnCount quality bulletCount jitter recoilTime`
  - bullet: `damage obstacleDamage falloff distance speed variance onHit`
  - The same idea for melee, throwables, explosions, perks and roles.
  - Log every merged field in `provenance.survevValues`.
- `lib/inputs.ts:120`: convert zero-arity closures of the form `() => util.weightedRandom([...]).type` into
  `{ "$weighted": [...] }`. The sim's role code must resolve `$weighted` in `perks` too (it already does in `roleOverrides`).
- `survevStructureOverrides`: for these shared ids take survev's `mapObjects`, `loot` and `stairs`, and keep the
  original images: `desert_town_02` (pulls in the Reserve), `bunker_twins_sublevel_01`, `bunker_twins_compartment_01`,
  `barn_basement_floor_01/01d`, `house_red_01x/02x`. The scratch check that found them should become a port warning on
  every re-pin.
- `portGameConfig`: take survev's 5-column `bagSizes`. Append survev-only rows after the original rows, so original
  bag indices stay. Keep `protocolVersion` 78.
- **Original-only ids that survev removed stay in the registry prefix** (`liveOnly` in `diff-latest-vs-live.json`):
  `tire_01`, `house_door_06`, `glass_wall_18`, `loot_tier_sledgehammer`, `loot_tier_eye_01`, `loot_tier_chrys_02b`,
  `loot_tier_helmet_potato`, `outfitTree`, `emote_flagisrael`, the ten `bullet_*_bonus`, `bullet_potato`, `bullet_bugle`.
  Placements lost under survev map generation: only `loot_tier_sledgehammer`, which the original `barn_basement_floor_01`
  / `01d` place; survev's version places `loot_tier_barn_melee` → `tier_barn_melee` (sledgehammer, weight 1) instead, so
  the loot is the same. No building in the original defs places `loot_tier_eye_01`, `loot_tier_chrys_02b`,
  `loot_tier_helmet_potato`, `tire_01`, `house_door_06` or `glass_wall_18`; they were already unplaced in 0.8.82. The port
  warns for every original-only id that no def or map places after the merge, so a future re-pin cannot drop a placement
  silently.

### 5.2 New GunDef fields (contract for the new guns)

`packages/defs/src/types/weapons.ts`, all optional, documented as rebirth deviations:

```ts
charges?: number;            // total shots the gun carries: no reload, no bag ammo (ammo = an id with no bag row, like bugle_ammo)
discardWhenEmpty?: boolean;  // after the last shot's fireDelay the slot is cleared and the next weapon is selected
pumpEvery?: number;          // DBS: shots per pump; fireDelay inside a pair
pumpDelay?: number;          // DBS: wait after the pumpEvery-th shot, with sound.cycle (the defs' pullDelay is not read by the sim; do not reuse it)
noReflect?: boolean;         // bullet def: never ricochets; explodes on metal like on any other hit (rockets, GL-06 round)
speed?: { equip?: number; attack?: number; carry?: number }; // carry: applies while the gun is in any gun slot
sound?: { /* existing fields */ discard?: string };
goldOnly?: boolean;          // integrity test: appears only in gold tables
```

`packages/defs/src/gunClasses.ts` gets a **`launcher`** class: `m79 gl06 mgl rpg7 panzerfaust m202`, and the potato
cannon moves there from `special`.

### 5.3 Single-use guns: charges and discard (Boys 10, Panzerfaust 1, M202 1)

- `weaponManager.tryReload` refuses a `charges` gun. The HUD shows `clip / -`.
- A new gun spawns with `clip = charges`. When it is dropped, the remaining clip is stored on the loot object
  **server-side** and restored on pickup (`loot/loot.ts`, `loot/pickup.ts`; today a picked-up gun starts empty).
- The last shot schedules `setWeapon(slot, "", 0)` after its `fireDelay` and switches weapon, as when the last
  throwable is used. No item drops; `sound.discard` plays, and an optional spent-tube particle.
- `ignoreEndlessAmmo: true`, so the Endless Ammo perk cannot refill charges.
- Firepower (Lieutenant, Cobalt roles) switches `ammoStats` to `extendedClip` (`weaponManager.ts:186-190`). A defs
  integrity test requires `extendedClip === maxClip === charges` for `boys`, `panzerfaust` and `m202`, so the perk never
  adds shots.
- No wire change: the weapon slot already sends `ammo u8` (`packages/protocol/src/local.ts:5`).

### 5.4 Launchers (M79, MGL, GL-06, RPG, Panzerfaust, M202)

| kind | path | exists? |
|---|---|---|
| 40 mm lob (M79, MGL) | `projType: "m79_grenade"`: a throwable with `explodeOnImpact`, `playerCollision`, `fuseTime 1.3`, speed 40, velZ 6.8 (flight about 1.3 s and 52 u with gravity 10.5), and its own `explosion_m79` (125 and effect `frag`, `shrapnel_frag` from the fandom infobox; radius 5-12 and 12 shrapnel are design values; the original had no fuse) | yes: `packages/sim/src/weapons/gun.ts:113,175-187`, `combat/projectiles.ts` (the potato cannon) |
| cursor airburst (GL-06) | flat bullet with `toMouseHit: true` and `onHit: "explosion_gl06"`; it explodes at the cursor or at max range | yes: the USAS-12 path, `combat/bullets.ts:182,187,268-273` |
| rockets (RPG, Panzerfaust, M202) | **exploding bullets**: slow (speed 55-70), flat, a thick `rocket` tracer, `onHit` explosion on a hit **and at max range** | mostly: same path (only `explosion_rounds` peters out at max range), but **missing the no-reflect rule** below |
| 4-rocket volley (M202) | `bulletCount 4` with `shotSpread 8` | yes: the loop in `gun.ts:119` |
| rocket look (client) | `rocket` tracer colour and width, a smoke-trail particle, the explosion effect `barrel` / `frag` | client work in `apps/client/src/fx` |

Optional later: if the user supplies `proj-rocket-01`, rockets become gravity-free projectiles with a sprite. That needs a
`throwPhysics.gravity` flag (today `p.velZ -= GRAVITY * dt` always runs, `combat/projectiles.ts:229`) and a range limit.
Bullets are enough for v1.

**No ricochet for exploding rounds.** Today `combat/bullets.ts:216` sets `canReflect: onHitFx !== "explosion_rounds"`,
`:430` reflects whenever `canReflect`, and `:273` explodes only `if (!b.alive && !b.reflected && b.onHitFx)`. A rocket or
GL-06 round that hits a metal wall would therefore ricochet and never explode where it hit. The original 40mm "explodes upon
impact, including metal walls (does not reflect)" (`research-cache/fandom/pages/Launchers.json`; the M79 page: "does not
bounce off reflective obstacles and walls"). Fix: the bullet def field `noReflect` (5.2), set on `bullet_rpg7`,
`bullet_panzerfaust`, `bullet_m202` and `bullet_gl06`, and `canReflect = !def.noReflect && onHitFx !== "explosion_rounds"`.
The 40mm lob is a projectile, which already explodes on impact. Sim test: a rocket fired at a metal wall explodes at the wall.

`explosion_m79` is its **own def** (values copied from `explosion_frag` at the time of writing), not an alias, so the
frag radius x1.3 of `feat/airstrike-variants` does not carry over to the M79 and MGL silently.

All launchers: `isLauncher` (the client already has a "launcher" pose, `apps/client/src/objects/player.ts:75`),
`deployGroup 3`, `noSplinter`, `noPotatoSwap`. Explosions hurt the shooter, so bots need a minimum firing distance (5.9).

**Endless Ammo on launchers** (`weaponManager.ts:194`, `isInfinite`): without `ignoreEndlessAmmo` an Endless Ammo holder
would have unlimited rockets or grenades. Decision (documented as a rebirth deviation): `rpg7` and `mgl` (gold-only) get
`ignoreEndlessAmmo: true`; the charges guns have it anyway (5.3). `m79` and `gl06` keep the original behaviour (the original
M79 had no such flag). Both the Firepower rule and the Endless Ammo rule get rows in `packages/sim/src/world/coverage.ts`.

### 5.5 Carry weight (DShK)

`speed.carry` is summed over gun slots 0-1 in `Player.computeSpeed` (`packages/sim/src/world/player.ts:351-385`), before
the equip term and the `BUSY_SPEED_MULT` 0.5. Small Arms replaces only the equip term, never carry. With `moveSpeed` 12,
the DShK (carry -1, equip -2, attack -5) gives 11 u/s carried, 9 held, and (12-1-2-5) x 0.5 = 2 while firing (the PKP
gives 3.5). No wire change: speed is server-authoritative and the client has no movement prediction.

### 5.6 Pump every N shots (DBS)

The weapon manager counts shots since the last pump. Shots inside a pair use `fireDelay` 0.2. After the `pumpEvery`-th
shot, the next shot waits the new `pumpDelay` 0.75 and `sound.cycle` plays. (`pullDelay` exists in the original GunDef
type but nothing in `packages/sim/src` reads it; pump guns there use `fireDelay` alone, M870 0.9.) The reload is shell by shell with `maxReload 2`.
Small change in `packages/sim/src/weapons/weaponManager.ts`.

### 5.7 New ammo: `40mm` and `rocket`

| id | used by | bagSizes (5 levels) | tint | tracer | casing | notes |
|---|---|---|---|---|---|---|
| `40mm` | m79, mgl, gl06 | 10 / 20 / 30 / 40 / 50 (the original surviv 40mm row was 10/20/30/40) | `0x0CDDAB` mint (original surviv) | `40mm` (GL-06 bullet only) | `part-shell-03` scaled, or the user's `part-shell-40mm` | also in `tier_airdrop_ammo` only if wanted |
| `rocket` | rpg7 | 4 / 6 / 8 / 10 / 12 | olive `0x556B2F` | `rocket` | none | **gold only**: it enters the game only with the RPG, `ammoSpawnCount` 4 as two side stacks of 2 (`loot/loot.ts:137`) |

Each new ammo touches:
- `GameConfig.bagSizes` (appended through the rebirth GameConfig hook)
- `tracerColors`
- the ammo loot def, `special: true`
- HUD order and colour (`apps/client/src/ui/uiLayout.ts:18-19` holds 8 fixed slots; `ui/hud.ts:80-90`). The phone layout
  needs room for 10.
- the ping emote `emote_ammo<id>` (`ui/emoteWheel.ts`)
- casings (`fx/particleDefs.ts`)
- l10n ("40mm 유탄", "로켓")

The bag order on the wire is the `bagSizes` key order (`packages/protocol/src/local.ts:24-25`), so this is a wire change:
**bump `PROTOCOL_SCHEMA_VERSION`**. The .50 guns reuse `50AE` (default; section 4.3).

### 5.8 Gold-only placement and the asset drop folder

- Gold-only placement:
  - `rpg7` and `mgl` (and `hecate`, `lynx`) carry `goldOnly: true` and sit only in the gold tables.
  - `rocket` is in no loot table at all, including ammo crates and `tier_airdrop_ammo`; the RPG's `ammoSpawnCount 4`
    (two side stacks of 2) is its only source.
  - A defs integrity test asserts both, for every map and every table (also the ammo tables and the crate loot lists).
  - Potato swaps, Cobalt rolls and role loadouts must never produce gold-only guns (`weapons/potatoSwap.ts`).
- One rebirth MapDefs hook places the loot (`applyRebirthMapDefs`), shared with the airdrop-tier branch, so the two
  features never edit the same table twice.
- **Order against the airdrop-tier derivation** (`.claude/worktrees/features/packages/defs/src/rebirth/airdropLoot.ts`).
  There, `tier_airdrop_tier2` = the map's `tier_airdrop_uncommon` minus `TIER1_FROM_UNCOMMON`, and `tier_airdrop_tier1` =
  the moved low end + `TIER1_ADDED_GUNS` (filtered by `LOOT_BANS` and by `groundClasses.has(gunClass(g))`, the classes of
  the map's `tier_guns`) + a 10 % roll of tier 2. `applyAirdropTierTables` throws `rebirth loot table "…" exists` if
  `tier_airdrop_tier1/2` are already present. `maps.json` holds a full 117-entry `lootTable` per map, so an edit to main's
  table does not reach the other 20 maps. `applyRebirthMapDefs` therefore runs in four steps, per map:
  1. **Floor and T2 guns, before the derivation**: floor guns are appended to the map's `tier_guns` (or `tier_shotguns`),
     T2 guns to the map's `tier_airdrop_uncommon`. T2 guns then land in tier 2 and in tier 1's 10 % roll.
  2. `applyAirdropTierTables` (unchanged).
  3. **T1 guns, after the derivation**: appended to the `tier_airdrop_tier1` output with their own per-map ban check
     (`LOOT_BANS` plus the map rules of 4.1). They are **not** routed through `TIER1_ADDED_GUNS`, whose class filter would
     drop every `launcher` (no map's `tier_guns` holds one; m79, panzerfaust, gl06 would vanish from T1).
  4. Gold guns go into each map's gold table (`tier_airdrop_rare`, or the mode's gold equivalent) in the same hook.
  The hook names the tables of **all 21 maps** explicitly: `main`, `main_spring`, `main_summer`, `desert`, `faction`,
  `faction_potato`, `halloween`, `potato`, `potato_spring`, `snow`, `woods`, `woods_snow`, `woods_spring`, `woods_summer`,
  `savannah`, `cobalt`, `turkey`, `birthday`, `beach`, `test_normal`, `test_faction`. A test checks that every map got the
  rows the plan gives it, or is listed as skipped with a reason.
- Assets:
  - `/assets-user/` goes into `.gitignore` **before** the user drops any file.
  - `tools/assets/rebirth-assets.json` (committed, names only) lists each expected file with its fallback sprite or sound.
  - `tools/assets/import.ts` gets a step that copies `assets-user/**` into the gitignored
    `apps/client/public/assets`, with a new manifest source `rebirth-user`. A missing file gets the fallback entry plus a
    `MISSING USER ASSET` line. `pnpm assets` deletes the asset dest first (`import.ts:55`), which is why the drop folder
    lives outside it.
  - `collectSpriteRefs` (`import.ts:121`) must also read the rebirth defs.
  - `apps/client/scripts/sound-defs.ts` merges the rebirth and survev sound lists, aliasing a missing mp3 to the fallback
    sound.
  - A test fails if `git ls-files` lists any `png/svg/mp3/ogg/webp/jpg` (none is tracked today).

### 5.9 Bots

`packages/bots/src/knowledge/gunTiers.ts` must class and tier every survev gun and every new gun. Its test
(`packages/bots/test/gunTiers.test.ts:97-106`) asserts `hasDef(id) === false` for `pkm barrett ash12 sw500 imbel spas16
potato_lmg m134 m79`, and requires every gun in `GameObjectDefs` to have a class and, unless `useless`, a tier. So
**`pnpm verify` goes red the moment any survev gun def or new gun def exists**: W1-PORT and every W2/W3 merge must carry
the matching minimal `gunTiers.ts` edit (one tier row per new gun id) and test edit. The forbidden list shrinks to
`["pkm", "m134"]`: those are original post-0.8.82 guns that neither survev nor the user adds, so they stay forbidden (do
not invert the whole list). Rows with `mainMap: true` must also be reachable on main (the test's reachability check), so
gold-only and T1/T2-only guns get `mainMap` from their actual placement. Because bot workflows edit `packages/bots` now,
these edits are coordinated with them: one owner, or the bot workflows land first (section 6). Also needed:
- a `launcher` `WeaponClass` in `knowledge/weapons.ts`: ideal range 15-50 u; fire only when the target is farther than
  `explosion.rad.max + 4` and no teammate is within `rad.max`; lead the aim for slow rockets
- desire scaled by `clip / charges` for single-use guns
- no change for carry weight (`computeSpeed` applies it)

Other workflows are editing `packages/bots` now. The minimal tier rows above travel with each merge (coordinated); the
launcher class and the charges desire (W3-BOTS) land after the bot workflows.

---

## 6. Implementation waves

Work is ordered so that all survev content (no user assets needed) starts before the user's files arrive. The new guns
run on fallback art (plain bars, tinted ammo boxes, donor sounds) until then.

**Order.** Wave 0 is serial. After it, **waves 1, 2 and 3 run in parallel**: wave 2 needs only the wave-0 contracts
(GunDef fields, the `launcher` class, the rebirth hooks), and its balance refs are existing 0.8.82 guns (survev values only
under option B, which still awaits the user). Wave 3 needs the same contracts. New-gun balance is tuned in wave 5 against
whichever option (A or B) the user confirms.

**Schema versions** must stay monotonic across branches:
- main has 8 today; `feat/airstrike-variants` has 9.
- Numbers are allocated **at merge time**: whichever change lands next with a wire change (survev bag rows and 5 columns
  in W1; `40mm` and `rocket` in W3; the airdrop-tier branch) takes the next free number. No wave owns a fixed number.
- Wave 2 adds ids only: no schema bump (the hash changes by itself).
- `PROTOCOL_HASH` changes by itself whenever ids are added (`packages/defs/src/registry.ts`).
- Registry headroom: about 815 of 1023 game-object ids after all of this; map objects about 1000 of 4095.

### Wave 0: contracts (one owner, serial, about 1-2 days)

| step | files (owner: contracts) |
|---|---|
| merge `feat/airstrike-variants` (rebirth layer) to main; agree the order with the airdrop-tier branch | `packages/defs/src/rebirth/**`, `data.ts`, `index.ts` |
| rebirth hooks `applyRebirthGameConfig` and `applyRebirthMapDefs` (empty), keeping the `tsc` structural check on `GameConfig` | `packages/defs/src/rebirth/{gameConfig,mapDefs}.ts`, `index.ts` |
| GunDef fields of 5.2 and the `launcher` class (no users yet) | `packages/defs/src/types/weapons.ts`, `gunClasses.ts` |
| `policy.json` schema and loader with today's behaviour (no output change) | `tools/port-survev/policy.json`, `lib/policy.ts` |
| `/assets-user/` in `.gitignore`; empty `rebirth-assets.json` with its schema; the no-binaries test | `.gitignore`, `tools/assets/rebirth-assets.json`, a test under `tools/assets/` |
| ADR 0003 (status proposed); the CLAUDE.md text of 1.4 handed to the user | `docs/adr/0003-survev-baseline.md` |

### Wave 1: survev baseline (no user assets; parallel packages, about 15-20 agent-days)

| package | owns (exclusive) | work | tests |
|---|---|---|---|
| W1-PORT | `tools/port-survev/**`, `packages/defs/src/generated/**` (regenerated only), provenance doc headers; **plus the minimal `packages/bots/src/knowledge/gunTiers.ts` + `packages/bots/test/gunTiers.test.ts` edit**, coordinated with the bot workflows | policy survev and option B, `$weighted`, structure overrides, 5-column bags, all reverts off, the original-only-id port warning (5.1). Bump the schema to the next free number in `registry.ts` at merge (coordinate the single edit). Tier rows for the survev guns; forbidden list reduced to `pkm`, `m134`. | `tools/port-survev/*.test.ts`; 0 port problems; the original ids form a prefix; `pnpm verify` green |
| W1-DEFS-TESTS | `packages/defs/test/**` | invert the fork-only assertions (`helpers.ts` `FORK_ONLY_GUNS`), prefix-order test, one bag-row length, survev values instead of original values for gameplay fields | `pnpm verify` |
| W1-ASSETS | `tools/assets/**` (except wave 0's files), `apps/client/scripts/{sound-defs,l10n-items}.ts`, `apps/client/src/generated/*`, `apps/client/src/l10n/ko.ts`, `assets/PROVENANCE.md`, `docs/research/l10n-ko.md` | survev sounds, English and Korean names, re-run `pnpm assets` | `apps/client/test/{spriteManifest,l10n}.test.ts` |
| W1-SIM-COMBAT | `packages/sim/src/perks/**`, `combat/{bullets,explosions,damage}.ts` (W3-LAUNCHERS's `noReflect` edit to `bullets.ts` is serialised with it), `items/**` | the 7 perks, loot-perk slots from `backpack.maxPerks`, coconut heal-on-hit, PMG view shrink, stone-plated obstacles, melee perk while carried, `coverage.ts` rows | a sim test per perk, citing the survev path |
| W1-SIM-WORLD | `packages/sim/src/{world,mapgen,match,roles}/**` except `world/player.ts` speed code | Reserve vault and security lock, Cloud bunker one-way exits and panel, crimson airdrop, `captain` promotion, `classless` (vat, perk swap, crates), `$weighted` role perks, rule knobs flipped to survev (auto flare, ...) | `mapgen.test.ts` golden regenerated, `modes.rules.test.ts`, `mapValidation.ts` |
| W1-CLIENT | `apps/client/src/{fx,objects,ui}/**` | `50cal` casing, explosion effects, cutlass animations, AP tracer, fifth bag level, two perk slots, outfits and effects | client unit tests; e2e `/?gallery=loot-` and `/?gallery=map-building` pages for the new sprites |
| W1-BOTS | `packages/bots/src/knowledge/gunTiers.ts` + test | refine the survev gun tiers that W1-PORT added minimally. **Starts only after the current bot workflows land.** | `gunTiers.test.ts` |
| W1-ORACLE | `tools/oracle/fixtures/**` | regenerate (`node --experimental-transform-types tools/oracle/run.ts`) | oracle suite |
| W1-DOCS | `docs/research/**`, `docs/adr/**` | ADR 0003 accepted, README precedence, provenance notes, rebirth-deviations rows | `node tools/kb/kb-check.ts` |

`world/player.ts` is shared with wave 3 (carry weight). Only one package edits it at a time.

### Wave 2: hitscan user guns on fallback art (no sim change, about 3 agent-days; parallel with wave 1)

The defs go in `packages/defs/src/rebirth/guns/<class>.ts` files, each under 600 lines. Each is built from a donor def
(as `bomb_heavy` is built from `bomb_iron`), so it inherits pose, particles and casing.

| package | owns | guns |
|---|---|---|
| W2-RIFLES | `rebirth/guns/rifles.ts` | ak74, m16a4, g36c, sig550, g3, asval, honeybadger |
| W2-SMG | `rebirth/guns/smgPistols.ts` | tec9 (+dual), vz61 (+dual), bizon, p90, m1928 (if wanted) |
| W2-MARKSMAN | `rebirth/guns/marksman.ts` | wa2000, mk14, fal, hecate, lynx |
| W2-HEAVY | `rebirth/guns/shotgunsLmgs.ts` | aa12, spas15, m60, mg42 |
| W2-INTEGRATE (one owner) | `rebirth/index.ts` registration, `gunClasses.ts`, `rebirth/mapDefs.ts` (floor, T1, T2, Gold, in the 5.8 order for all 21 maps), `rebirth-assets.json` entries, `ko.ts` rows, the minimal `gunTiers.ts` rows with each merge (coordinated with the bot workflows) | merges each package's exported `defs`, `loot` and `assets` lists |

Tests:
- every new gun has a bullet, a class and a tier
- every sprite resolves through its fallback
- a headless sim smoke test fires and reloads each gun
- the original ammo bag indices are unchanged
- the gold-only test

### Wave 3: new mechanics, ammo and launchers (sim; about 5 agent-days; parallel with wave 1)

| package | owns | work | tests |
|---|---|---|---|
| W3-WEAPONS | `packages/sim/src/weapons/{weaponManager,gun}.ts`, `loot/{loot,pickup,drops}.ts` | charges and discard, the server-side loot clip, `pumpEvery` / `pumpDelay`, `ignoreEndlessAmmo` on rpg7 and mgl | Boys discards after 10 shots; a dropped Boys keeps 4 of 10 shots; Endless Ammo ignores charges and the RPG/MGL; Firepower adds no charges (`extendedClip === maxClip === charges`); DBS pair and pump timing |
| W3-SPEED | `packages/sim/src/world/player.ts` (`computeSpeed`), `perks/effects.ts` (Small Arms) | carry weight | DShK gives 11 / 9 / 2 u/s; Small Arms does not cancel carry |
| W3-AMMO | `rebirth/ammo.ts`, `rebirth/gameConfig.ts`, `registry.ts` (next free schema number at merge), `apps/client/src/ui/{uiLayout,hud,emoteWheel}.ts`, `fx/particleDefs.ts` | `40mm` and `rocket` | rows appended last; HUD layout test for phone portrait |
| W3-LAUNCHERS | `rebirth/guns/launchers.ts`, `rebirth/guns/special.ts` (boys, dshk, dbs, m202), `rebirth/projectiles.ts`, `apps/client/src/fx/explosions.ts`, `objects/projectiles.ts` | m79, mgl, gl06, rpg7, panzerfaust, m202 (with `noReflect` on the exploding bullets and its `bullets.ts` check) and the rocket look; `explosion_m79` as its own def; boys, dshk, dbs | M202 makes 4 explosions; a rocket explodes at max range; **a rocket fired at a metal wall explodes at the wall**; the GL-06 bursts at the cursor; MGL shell reload; `rocket` reachable only with the gold-drop RPG (no ammo table) |
| W3-BOTS | `packages/bots/src/knowledge/weapons.ts` and the fire gate | the launcher class, the charges desire | bots never fire a launcher inside the explosion radius |

### Wave 4: user assets (when the files arrive; about 1-2 agent-days)

- The user copies files into `assets-user/` and runs `pnpm assets`. The `MISSING USER ASSET` lines list what is still
  missing.
- Tune per gun: the manifest `size`, `worldImg.scale`, `leftHandOffset`, `lootImg.scale`, sound volume.
- Review screenshots in `tests/e2e/__screens__/` (gitignored) and through the sprite gallery (`/?gallery=loot-weapon`).

### Wave 5: balance, verification, docs (about 3 agent-days)

- Bot matches (the population harness in `packages/bots`): gold-drop shares, time to kill per new gun, launcher
  self-damage rate, how often the DShK is picked over an LMG. Apply the scaling of 4.2 if needed.
- e2e (Playwright, the loopback sandbox `/?sandbox=1&map=<map>&seed=<n>`):
  - new specs `tests/e2e/survev-content.spec.ts`: desert Reserve vault opens; cloud bunker lock; Experimental Pack holds
    2 perks; Barrett fires and reloads
  - `tests/e2e/rebirth-guns.spec.ts`: one gun per class fires and reloads; DShK slows; Boys disappears after 10 shots;
    RPG explodes; the HUD shows the `40mm` and `rocket` slots in landscape and portrait
- Docs: `rebirth-deviations.md` rows, `docs/research/items/guns.md`, and the user's go-ahead on the CLAUDE.md text.

---

## 7. Risks

1. **Public repository, art licences.** survev and original art are already gitignored. User art and sound have unknown
   licences: they live only in the gitignored `assets-user/` and the gitignored asset dest. Mitigations: the
   `.gitignore` entry lands before the first drop, the no-binaries test, names-only manifests, and e2e screenshots only
   in `tests/e2e/__screens__/`. A built `apps/client/dist/` contains the assets; deploying it is the user's call.
2. **`pnpm assets` deletes `apps/client/public/assets`** (`tools/assets/import.ts:55`). Files placed there by hand are lost
   on the next import, which is why the drop folder is separate.
3. **Balance coherence.** Under option A, survev's guns (Barrett 99, ASh-12 31 per shot) sit next to 0.8.82 values. Under
   option B the classic feel of shared guns changes (DMR headshots, Garand 44, AN-94 20). The gold pool gets diluted
   (4.2). Mitigation: option B plus the wave-5 bot-match pass.
4. **Shadowed containers.** With "original wins for shared ids", survev additions inside shared containers disappear
   silently (the Reserve inside `desert_town_02`). The override allowlist has to be reviewed on every re-pin, and the
   shadowing check should be a port warning.
5. **Event-map fixes become wrong, not merely redundant**, once the balance revert is off (the Savannah reconstruction
   repaired a Main copy that the revert itself produced). Remove them together with the revert.
6. **Concurrent work.**
   - Bot workflows are editing `packages/bots` now. `gunTiers.test.ts` forbids the survev ids and `m79` and requires a
     tier for every gun def, so W1-PORT and each W2/W3 merge carry a minimal tier-row edit, coordinated with those
     workflows (one owner); the larger bot work (W1-BOTS, W3-BOTS) waits for them.
   - The airdrop-tier branch edits the same airdrop tables: one shared MapDefs hook, gold-only rules tested.
   - `feat/airstrike-variants` (schema 9) must merge before anything stacks on the rebirth layer.
7. **Wire and ids.** Two schema bumps (numbers allocated at merge). survev-only ids sit between the original and rebirth blocks, so a future
   survev re-pin that adds or removes ids shifts the rebirth ids. The hash change rejects old clients, which is intended,
   but any recording keyed by type id breaks. Headroom is about 815 of 1023.
8. **Sim work hidden behind "just data".** Porting survev data does not implement survev's perks, roles, packs, heal-on-hit
   or view shrink: the sim has no code for them today. A survev-only item without its rule looks present but does nothing.
   `world/coverage.ts` rows and per-perk tests guard this.
9. **Launchers and griefing.** Explosions hurt the shooter and teammates. MGL bursts (6 x 125 in under 3 s) and M202
   volleys can wipe squads, and eight bots with rockets can stall a match. Hence gold-only for the strongest ones, the bot
   minimum-distance gate, and a check of explosion counts per tick in the bot matches.
10. **Ambiguous requests** (4.3): if the user picks the alternatives (Panzerfaust 3, Steyr HS .50, the CZ Scorpion), the
    defs change but the mechanics do not. Defaults let the work start.
11. **Content policy for cosmetics.** survev adds 13 flag emotes and removes one of the original's. Shipping them is a user
    decision; the default keeps the original emote list.
12. **survev moves on.** `feat/winter-factions` may merge with the `aug`, the `mace` and `faction_snow`. A re-pin follows
    the procedure of the pipeline sweep: update the commit in the about 25 files that mention it, `pnpm port`, assets,
    sounds, l10n, goldens, the oracle. KB `survev/...:line` refs (10,378 of them) are checked for path only, so their line
    numbers drift.
13. **Wiki versus source.** The wiki has a few known errors: the Coconut and Tomato `cookable` flags are inverted, PMG-134
    and Petite Potato numbers differ, and the Barrett page's armour example is wrong (54.45, not 45.5). The source wins;
    each case goes to `docs/research/conflicts.md`.

## 8. Owner decisions, 2026-10-07 (supersede the defaults above where they differ)

Ammo colours follow the game's convention: yellow 9mm, blue 7.62mm, green 5.56mm, red 12 gauge, black .50 AE, purple
.45 ACP, olive .308 Subsonic, orange flare; new: teal 40mm (M79 family), pink 5.7×28mm (P90 only), brown rocket.

| Gun | id | Ammo (colour) | Notes |
|---|---|---|---|
| DP-12 (was "DBS") | `dp12` | 12 gauge (red) | renamed by the owner |
| M202 FLASH | `m202` | none | single use, 4 rockets |
| Panzerfaust | `panzerfaust` | none | single use |
| Thompson M1928 drum | `m1928` | .45 ACP (purple) | same ammo as the existing M1A1 |
| M200 Intervention | `m200` | 7.62mm (blue) | added 2026-10-07; bolt-action sniper, gold + rare tier 2 |
| MG42 | `mg42` | 7.62mm (blue) | |
| G3 | `g3` | 7.62mm (blue) | |
| SIG SG 550 | `sig550` | 5.56mm (green) | |
| P90 | `p90` | 5.7×28mm (pink, new) | its own ammo |
| Milkor MGL | `mgl` | 40mm (teal) | gold only |
| GL-06 | `gl06` | 40mm (teal) | |
| Honey Badger | `honeybadger` | 5.56mm (green) | |
| M60 | `m60` | 7.62mm (blue) | |
| Mk 14 EBR | `mk14` | 7.62mm (blue) | |
| DShK | `dshk` | 7.62mm (blue) | |
| RPG-7 | `rpg7` | rocket (brown, new) | gun and rockets gold only |
| PP-19 Bizon | `bizon` | 9mm (yellow) | |
| FN FAL | `fal` | 7.62mm (blue) | |
| Boys AT rifle | `boys` | none | **7 shots** (was 10), then discarded |
| M16A4 | `m16a4` | 5.56mm (green) | |
| AK-74 | `ak74` | 5.56mm (green) | 5.45×39 has no own ammo |
| G36C | `g36c` | 5.56mm (green) | |
| Škorpion vz. 61 | `vz61` | 9mm (yellow) | |
| SPAS-15 | `spas15` | 12 gauge (red) | |
| AA-12 | `aa12` | 12 gauge (red) | slugs only |
| WA2000 | `wa2000` | .50 AE (black) | |
| Hécate II | `hecate` | .50 AE (black) | |
| Lynx | `lynx` | .50 AE (black) | |
| AS Val | `asval` | 9mm (yellow) | |
| TEC-9 | `tec9` | 9mm (yellow) | |

Art received: five sheets of side-view line drawings, one per gun (stored in the gitignored `assets-user/source/`), usable
as loot icons after cutting, label removal and transparency; held (top-down) sprites still fall back to the bar shape.
The FN FAL and SPAS-15 drawings are the same picture.
