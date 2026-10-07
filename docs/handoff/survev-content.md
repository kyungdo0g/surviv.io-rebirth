# Handoff: survev content wave (branch `claude/survev-content`)

Second-worker log for wave 1 of `docs/design/survev-content-and-new-guns.md` section 6 (everything survev-only except
the guns). The lead merges this branch. This file lists what is done, what the lead must change in files this branch
may not touch, the schema number used and open questions.

## Schema

- `PROTOCOL_SCHEMA_VERSION` = **12** ("survev content wave"; history comment in `packages/defs/src/registry.ts` leaves
  11 to the lead's branch). Renumber at merge if needed: the tests pinning it are
  `packages/defs/test/registry.test.ts`, `packages/protocol/test/survevGuns.test.ts` and
  `packages/protocol/test/airstrikeVariants.test.ts` (each `toBe(12)`).

## Stages

| stage | content | state | commit |
|---|---|---|---|
| 1 | melee `iceaxe`, `cutlass`, `cutlass_gold`, skins `naginata_daemon`, `karambit_borealis`; throwables `coconut`, `tomato` + explosions; `pirate` perk | done | be03cb6 |
| 2 | gear / perks / roles (backpack04, 5-level bags, 6 more perks, captain, classless) | done | see `git log --grep "stage 2"` |
| 3 | buildings and map objects (Reserve, Workshop, Camp, Oasis, Cloud bunker, ...) + a buildings-only test map | done | see `git log --grep "stage 3"` |
| 3d | 50v50 buildings and structures (added scope from the lead, owner priority) | done | see `git log --grep "50v50"` |
| 4 | cosmetics (outfits, emotes, heal / boost effects) | 4a defs + loot done; 4b loadout on hold (open question) | see `git log --grep "stage 4"` |
| 5 | balance option B (no balance revert for shared gameplay fields) | planned | |

### Stage 1 details

- Port: `tools/port-survev/policy.json` lists the new ids; survev-only bag rows (`coconut`, `tomato`) are cut to the
  four original levels in `lib/objects.ts portGameConfig` (stage 2 lifts the cut with backpack04).
- Wiki specs: `packages/defs/src/survev/wikiSpecs.ts` (new survev layer, applied in `data.ts` before the rebirth
  layer): coconut `cookable` true (source false), tomato `cookable` false (source true). Every other infobox field
  matches the source (`packages/defs/test/survevContent.test.ts`).
- Sim: melee `perk` held while carried (`weapons/weaponManager.ts setWeapon`), Pirate's Bounty drops on melee kills
  (`perks/effects.ts onKillCredited`, `loot/drops.ts dropPirateBounty`, `rules.perks.pirate`), coconut heal on the
  thrower's side with the 0.5 s heal effect (`combat/explosions.ts`, `Player.healEffectTicker`), coconut / tomato slow
  and drop rules (`modes/modeRules.ts throwableHits`). Tests: `packages/sim/test/survevMeleeThrowables.test.ts`.
- Client: sandbox `?give=` accepts melee weapons (`apps/client/src/net/loopback.ts`); en names from survev's en.json
  (perk descriptions too, `apps/client/scripts/l10n-items.ts`), ko names in `apps/client/src/l10n/ko.ts` /
  `modes.ts` (glossary `docs/research/l10n-ko.md`). E2E: `tests/e2e/survev-melee-throwables.spec.ts`.
- KB: `docs/research/items/{melee,throwables,perks}.md` "In the game (survev content wave, stage 1)",
  `conflicts.md#survev-throwable-cookable`. ADR 0003 stage table has a row.

### Stage 2 details

- Port: policy adds `backpack04`, `backpack04_cloud`, the six perks, roles `captain` / `classless`, skins
  `helmet04_captain` / `helmet04_classless`; `survevGameConfig` is now `["bagSizes"]` (survev's whole 5-level table,
  original row order first). `308sub` takes survev's 20/40/55/70/85.
- Sim: AP Rounds / High-Velocity (`perks/shotPerks.ts`, `combat/bullets.ts`, `combat/damage.ts armorPenetration`),
  Hyperfragmentation (`weapons/throwable.ts`, `combat/explosions.ts fireShrapnel`), Combat Stimulants
  (`world/consumables.ts`, `combat/combat.ts combatStimsHeal`), Indomitable Spirit (`combat/combat.ts`,
  `world/consumables.ts`), Assume Leadership (`rules.perks.minBoost / scales`), Experimental Pack two perk slots
  (`loot/pickup.ts`), Captain succession on by default (`rules.roles.commanderSuccession`, promotes to `captain`,
  checked on knocks too), Classless (`roles/roles.ts`, `roleSystem.ts`), buttons with `roleToPromote`
  (`world/interact.ts`). Tests: `packages/sim/test/survevPerksRoles.test.ts`, `faction.test.ts` (Captain).
- Changed tests (not bot tests): `faction.test.ts` succession test, `protocol/test/game.m7.test.ts` (role
  `captain`), `modes.rules.test.ts` (woods bag rows 5 levels), `modes.cobalt.test.ts` (mythic pod has `lifeline`),
  `gameConfig.test.ts`, `integrity.test.ts`, `survevGuns.test.ts` (5-level bags).

### Stage 3 details

- Port: `policy.json` `survevMapGen: true` (survev's map generation: map-spawn balance reverts, the fork-reskin revert
  and the map-generation parts of the event-map fixes are off; loot parts stay) and `survevMapObjects` (nine original
  structures take survev's def: desert_town_02 = the Reserve's town, house_red_01x/02x, mansion_01x,
  bunker_chrys_compartment_01/03, bunker_twins_01, bunker_twins_sublevel_01, bunker_twins_compartment_01; provenance
  status `survev-override`). `lib/policy.ts`, `lib/objects.ts portMapObjects`, `lib/eventMaps.ts` (`lootOnly`),
  `lib/survevLoot.ts splitMapGenEntries`, `port.ts`.
- Sim: puzzle codes `bunker_chrys_02`, `bunker_twins`, `reserve_vault` (`world/puzzles.ts`); building children with
  their own layer (`mapgen/generator.ts`); field triage (`world/coverage.ts`). Tests:
  `packages/sim/test/survevBuildings.test.ts` (Reserve vault + security panel, camp and Oasis heal, Workshop mount,
  Augmenting Vat, Cloud bunker panel); mapValidation cases, mapgen golden and event-map tests moved to survev's
  generation.
- Client: `apps/client/scripts/sound-defs.ts` also collects map-object sounds and survev-only groups (Reserve music,
  egg and tomato breaks).
- Building showcase (owner request): `/?building=<type>` (or `building=1` for the first) boots the loopback sandbox
  on a map holding only that building or structure (and its children), on the first map that spawns it, with its lake
  (Oasis, tea pavilion, Cloud bunker), river (bridges, river shacks, cabins) or beach (huts, docks, waterfront
  warehouse) and no gas; the player stands beside it. `[` / `]` or the bar at the top step through all 140 buildings
  and structures the maps spawn at the top level (grouped by map); other query keys stay (`&zoom=`, `&give=`,
  `&loot=0`, `&lang=ko`). Sim `packages/sim/src/mapgen/showcase.ts` (`generateShowcase`, `showcaseEntries`,
  `showcaseSpawnSpots`), client `apps/client/src/dev/showcase.ts`, `game/sandbox.ts` (`building`),
  `game/gasStages.ts` (`noGasStages`), `net/loopback.ts` (`spawnSpots`), `main.ts` (`building` route key). Tests:
  `packages/sim/test/showcase.test.ts`, `tests/e2e/survev-buildings.spec.ts` (`SHOWCASE_ALL=1` screenshots every
  building into `__screens__/survev-buildings/all/`).

### Stage 4 details

- 4a (defs): the port takes survev's 21 survev-only outfits, 25 emotes and 7 heal / boost effects
  (`policy.json`); their survev world loot comes back (Fragtastic, egg outfits, Coconut Frenzy, snow / beach outfits,
  the Reserve's gold toilet). survev's `outfitHalloweenTree` is the original `outfitTree` renamed: not ported, the
  Halloween loot entry is renamed back (`lib/maps.ts ITEM_RENAMES`). Classless now wears `outfitClassless`. Outfit,
  emote and effect names come from the defs, like the original cosmetics (no `game-<id>` keys, no ko table entries).
  `NOT_PORTED_IDS` (defs test helpers) now lists survev meta content (quests, passes). Tests:
  `packages/defs/test/survevContent.test.ts` "survev cosmetics", `tools/port-survev/survevLoot.test.ts` renames,
  `survevPerksRoles.test.ts` (Classless outfit).

### Stage 3d details (50v50)

- Inventory: survev `factionDefs.ts` / `factionPotatoDefs.ts` spawn lists vs our `maps.json` (identical: survev's map
  generation), every object in the closure of River Town (`river_town_01`), the Faction Bridge
  (`bridge_xlg_structure_01`), the 50v50 warehouse (`warehouse_01f`), the Silo Shack (`shilo_01`), the faction caches,
  crates, river chest, statues, potatoes and tomatoes, original client defs vs survev (`live` vs `.survev`). Layouts,
  children, layers, stairs and masks match; the differences that mattered were survev's map-generation fields:
  `teamId` (crate_02f Red, crate_22 Blue, shilo_01 Blue; bank / mansion / police / docks were already handled by a
  side table) and `terrain.minDistanceFromSameType` (faction crates 32 apart, Cobalt's class shells too), plus terrain
  tweaks (tree_13 palms beach-only, lakeCenter flags gone).
- Fix: the port copies survev's `teamId` and `terrain` onto original map objects when `survevMapGen` is on
  (`tools/port-survev/lib/objects.ts applySurvevMapGenFields`, logged in provenance `survevMapGenFields`); the sim's
  side table is gone (`mapgen/placement.ts teamIdOf` reads `teamId`) and `canSpawn` enforces
  `minDistanceFromSameType` (`mapgen/generator.ts`). Before, the Soviet / Initiative crates and the Silo Shack spawned
  anywhere. main seed 12345 golden hash: `7f48d105692eadcd` -> `e856eb5e71684e02` (tree_13 on the beach).
- Showcase: `river_town_01` added (faction, on a 20-wide river); 140 entries. Spawn spots now start at the object's
  bounds (front first), so wide buildings are on screen.
- Checked and left as is: River Town's `goreRegion` (survev uses it only for quests: out of scope); faction crates'
  `preloadGuns` (loot, stage 5 balance); fandom's Scout Hut and 3 houses per side (survev's counts win: hut_01 x4,
  hut_02, 4 + 4 red houses, 4 barns, 6 warehouses).
- Tests: `packages/sim/test/survevFaction.test.ts` (sides, crate spacing, River Town orientation and statues, river
  chest, Potato vs Tomato sides), showcase test, `tests/e2e/survev-faction-buildings.spec.ts` (River Town, Faction
  Bridge, warehouse, Silo Shack, cache in the showcase; crates on a real 50v50 map; full-map screenshot). KB:
  `modes/faction.md` Team sides, `conflicts.md#faction-teamid`.
- Visual reference: if the owner has 50v50 gameplay video (River Town, bridges, team-side crates), the lead can ask for
  it; the screenshots in `tests/e2e/__screens__/survev-faction/` are what to compare.

## Changes needed in the lead's files

### 1. Coconut and tomato explosion effects (`apps/client/src/fx/explosions.ts`, `apps/client/src/fx/particleDefs.ts`)

Without these the coconut and tomato explode silently with no particles (gameplay is fine). Values from survev
`client/src/objects/explosion.ts:672-715` and `client/src/objects/particles.ts:2855-2890`. Patch for `EFFECTS`:

```ts
    // survev-only coconut and tomato (survev client explosion.ts:672-715)
    coconut: fx("", 0.75, "coconut_01", "frag_water_01", 1, [0, 0], 1, { scatter: scatter("coconut_impact", 6) }),
    tomato: fx("", 0.75, "tomato_01", "frag_water_01", 1, [0, 0], 1, { scatter: scatter("tomato_impact", 4) }),
```

and two particle defs shaped like `snowball_impact` / `potato_impact`:

```ts
    // survev particles.ts:2855-2890
    coconut_impact: { image: ["part-coconut-01.img", "part-coconut-02.img", "part-coconut-03.img"], life: [0.5, 1],
        drag: [0, 0], rotVel: [PI * 0.25, PI * 0.5], scale: { start: [0.13, 0.23], end: [0.07, 0.14], lerp: [0, 1] },
        alpha: { start: 1, end: 0, lerp: [0.9, 1] }, tint: 0xffffff },
    tomato_impact: { same as coconut_impact with image ["part-tomato-01.img"] },
```

The sounds `coconut_01` and `tomato_01` exist in `.survev/client/public/audio/sfx/` but are not in
`apps/client/src/generated/sound-defs.json` (the generator only collects sounds the game object defs name). Either
add them to the effect (and list them in `apps/client/scripts/sound-defs.ts`'s extra names, which this branch can do
if you prefer: say so) or keep the effect silent.

### 2. `docs/research/rebirth-deviations.md`

The guns' wiki-vs-source fields are listed there. If the two `cookable` overrides (coconut true, tomato false;
`packages/defs/src/survev/wikiSpecs.ts WIKI_SPEC_OVERRIDES`) should be listed too, add a row under the survev guns'
wiki stats: "survev-only throwables: coconut `cookable` true (wikigg/Coconut rev 7413; survev throwableDefs.ts:846
false), tomato `cookable` false (wikigg/Tomato_(Throwable) rev 7178; survev throwableDefs.ts:913 true)". They are
already recorded in `docs/research/conflicts.md#survev-throwable-cookable`.

### 3. Stage 2 client presentation (lead-owned rendering)

- AP Rounds tracer colour: survev draws AP bullets with `tracerColors.<ammo>.apSaturated`
  (`.survev/client/src/objects/bullet.ts:165-166`). The sim marks bullets `apRounds` (`combat/bullets.ts`) but the
  bullet wire record has no flag for it; adding one is a protocol change (bump the schema) plus the tracer tint in the
  bullet renderer. Hyperfragmentation shrapnel already uses the existing `saturated` flag.
- Indomitable Spirit's last-stand effect: the sim sets `Player.lastStandTicker` (1 s) when the perk absorbs a fatal
  hit; survev shows `lastStandEffect` on the player (`.survev/client/src/objects/player.ts`). Needs a player flag on
  the wire and an effect in `apps/client/src/objects/player*.ts`.
- HUD: a fifth backpack level needs no change (bag counts come from GameConfig); two loot perks show as two perk
  slots like role perks.

### 4. Bot tests broken by survev's map generation (stage 3) — `packages/bots/test/**` (lead-owned, not touched)

survev's map generation moves every object of `main` seed 12345 (golden hash `555953c84482c164` -> `7f48d105692eadcd`,
then `e856eb5e71684e02` in the 50v50 stage; the ids below still hold),
so the bot tests that pin object ids or coordinates of that map fail:
- `walk.test.ts`, `nav.test.ts`, `nav.follower.test.ts`: `house_red_02` id 1391 no longer exists. The main 12345
  `house_red_02`s are now ids 1402 (610.1, 583.7, ori 0), 1440 (491.3, 144.5, ori 1) and 1478 (127.3, 501.2, ori 3).
  Re-pin, or better find the first `house_red_02` by type.
- `nav.basements.test.ts` "plans through narrow doorways": the storm-bunker hut cells (x 564-567, y 562-565) moved;
  the storm bunker (`bunker_structure_03`) is now id 1287 at (344.3, 569.2) (the crossing bunker
  `bunker_structure_05` is id 209).
- 50v50 stage: faction maps changed too (team crates on their sides, 32 apart); bot tests pinning faction coordinates
  need the same re-pin.

### 5. Survev building particles (`apps/client/src/fx/particleDefs*.ts`, lead-owned)

`apps/client/test/particles.test.ts` allowlists these until they exist (`PARTICLE_PENDING`, `campfire_smoke`):
- `depositBoxSilverBreak` (survev `client/src/objects/particles.ts:772`: part-plate-01, life 0.5-1, drag 6-8, rotVel
  0-3π, scale 0.2-0.35 -> 0.18-0.25, grey hsv(0, 0, 0.68-0.72)), `toiletGoldChip` (:1613, part-spark-02, life 0.5,
  drag 1-10, scale 0.04-0.08 -> 0.01-0.02, gold hsv(0.14, 0.72-0.86, 0.71-0.85)), `toiletGoldBreak` (:1632, same
  colour, life 0.8-1, drag 4-5, scale 0.07-0.12 -> 0.05-0.1), `leafSynthetic` (:992, part-leaf-01, hsv(0.44, 0.8,
  0.2-0.3)), and the emitter `campfire_smoke` (:3520: particle cabinSmoke, rate 2-4, speed 1-1.5, angle 0.1π).
  Remove the allowlist entries when they land.

### 6. Air drop tier tests (lead's rebirth feature, test files edited minimally)

Desert's crimson air drop (`airdrop_crate_05` -> `crate_17`, `tier_airdrop_crimson`) is back with survev's map
generation. `AIRDROP_TIER_SPLITS` already leaves it unsplit (special crate). Two assertions now name it:
`packages/defs/test/airdropTiers.test.ts` (excluded from the gold-drop checks) and
`packages/sim/test/airdropTiers.test.ts` (desert's crate set gains `airdrop_crate_05:`).

### 7. Held melee sprites

The Cutlass / Gold Cutlass use the existing `cutlass` idle pose and `cut` / `cutReverse` animations
(`apps/client/src/objects/anims.ts`, unchanged); the held sprite comes from `worldImg` like other melee. Nothing to do
unless the held-sprite renderer special-cases melee ids.

### 8. Survev heal and boost effects (`apps/client/src/fx/particleDefs*.ts`, `apps/client/src/objects/playerEmitters.ts`)

Stage 4 ports survev's heal effects `heal_diamond`, `heal_ankh`, `heal_menacing` and boost effects `boost_club`,
`boost_lightning`, `boost_hermes`, `boost_gearshift`. Their emitters and particles are survev
`client/src/objects/particles.ts` (particles 3004-3300, emitters 3685 heal_diamond, 3694 heal_ankh, 3703
heal_menacing, 3751 boost_club, 3760 boost_lightning, 3769 boost_hermes, 3778 / 3787 boost_gearshift_01 / _02); the
sprites are already in the manifest. `apps/client/test/particles.test.ts` allowlists the 8 emitters as pending. The
player emitters still hard-code `heal_basic` / `boost_basic`; once stage 4b sends each player's loadout effect
(PlayerInfo heal / boost ids), `playerEmitters.ts` should run that effect's `emitter` instead.

## Owner requests (2026-10-07, while stage 2 ran)

- Buildings first: stage 3 is top priority. Go through every building of the survev.wiki.gg Buildings navbox
  (https://survev.wiki.gg/wiki/Buildings), follow each link and check every infobox tab (Roof, Layout, Alt.Roof,
  Alt.Layout, Basement, Basement Layout, ...) and its picture against our buildings. A loot icon on a layout picture
  (a pill on the Hunting Perch) is only the loot spawner's position (`loot_tier_*`), not a fixed item; fixed items are
  what the page's "Special loot" lists.
- When the buildings are done: a building test mode, a map with only buildings that can be cycled through. Done:
  the building showcase (stage 3 details).

## Shared hotspots touched (minimal)

- `packages/defs/src/registry.ts`: schema 12 + history line.
- `packages/defs/src/index.ts`, `packages/defs/src/data.ts`: export and apply the survev wiki-spec layer.
- `packages/defs/src/types/weapons.ts`: `MeleeDef.perk`, `ExplosionDef.healTeam / healAmount / dropRandomLoot`.
- `packages/defs/test/helpers.ts` (`NOT_PORTED_IDS`), `packages/defs/test/survevGuns.test.ts` (policy pins now
  `arrayContaining`), `packages/sim/test/perks.core.test.ts` (perk count: 41 original + survev-only).
- `apps/client/src/net/loopback.ts`: `give=` melee, `spawnSpots` (showcase).
- `apps/client/src/main.ts` (`building` route key), `apps/client/src/game/sandbox.ts` (`building` option),
  `apps/client/src/game/gasStages.ts` (`noGasStages`), `packages/sim/src/index.ts` (showcase exports).

## Open questions

- Loadout (stage 4b, on hold): the original and survev both validate a guest's loadout against `unlock_default`
  (survev player.ts:4295-4340 `setLoadout(..., useDefaultUnlocks)`), which unlocks only `outfitBase`, `fists`,
  `heal_basic`, `boost_basic`, 15 crosshairs and the emotes (survev's list adds its 19 new emotes and drops
  `emote_flagisrael`). With no accounts, a loadout menu would only change emotes; survev's outfits stay world loot and
  the heal / boost effects stay unused. Options: (a) guest rules as survev: an emote / crosshair picker only (crosshair
  is the lead's settings UI); (b) rebirth deviation "everything unlocked": a full loadout menu (outfit, melee, heal,
  boost, emotes) with the Join message's survev loadout fields and per-player heal / boost emitters. Needs the owner's
  call (rebirth-deviations.md is the lead's).
- Cookable flags: the plan (section 2.3) proposed survev's source values; ADR 0003 point 4 and this wave's brief say
  the wiki wins, so the wiki's apply. Flip `WIKI_SPEC_OVERRIDES` if the owner prefers the source.
- English name of `cutlass_gold`: survev's en.json says "Cutlass Gold" (used, the presentation source for survev-only
  items); the def name and the wiki say "Gold Cutlass".
