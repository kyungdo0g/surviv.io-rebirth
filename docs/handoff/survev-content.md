# Handoff: survev content wave (branch `claude/survev-content`)

Second-worker log for wave 1 of `docs/design/survev-content-and-new-guns.md` section 6 (everything survev-only except
the guns). The lead merges this branch. This file lists what is done, what the lead must change in files this branch
may not touch, the schema number used and open questions.

## Schema

- The wave shipped as `PROTOCOL_SCHEMA_VERSION` 14 ("survev content wave"; 11 hit feedback, 12 new guns beta, 13
  variant strobes are the lead's). The lead's merge (2acdac0) took the base to **15** (AP Rounds tracer and last-stand
  bits); stage 4b (loadouts in Join) is 16.
- Merged: PR #2 (3b98364) into `claude/relaxed-fermat-hcg1fo` at aa63e93; the lead applied items 1-14 below in 2acdac0.

## Stages

| stage | content | state | commit |
|---|---|---|---|
| 1 | melee `iceaxe`, `cutlass`, `cutlass_gold`, skins `naginata_daemon`, `karambit_borealis`; throwables `coconut`, `tomato` + explosions; `pirate` perk | done | be03cb6 |
| 2 | gear / perks / roles (backpack04, 5-level bags, 6 more perks, captain, classless) | done | see `git log --grep "stage 2"` |
| 3 | buildings and map objects (Reserve, Workshop, Camp, Oasis, Cloud bunker, ...) + a buildings-only test map | done | see `git log --grep "stage 3"` |
| 3d | 50v50 buildings and structures (added scope from the lead, owner priority) | done | see `git log --grep "50v50"` |
| 4 | cosmetics (outfits, emotes, heal / boost effects) | 4a defs + loot done; 4b loadout done (everything unlocked) | see `git log --grep "stage 4"` |
| 5 | balance option B (no balance revert for shared gameplay fields) | done (5a port, kits, heavy throwables; 5b perk numbers, faction outfits) | see `git log --grep "stage 5"` |

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

### Stage 5 details (survev balance, design option B)

- Port (`policy.json` `survevBalance: true`): `balance-revert.json` is no longer applied (all 625 entries logged as
  skipped) and the event-map fixes are gone with it (design risk 5); `LOOT_BANS` stay. Original game objects take
  survev's gameplay fields per type (`lib/objects.ts SURVEV_GAMEPLAY_FIELDS`, 122 values in `provenance.survevValues`:
  bullets' damage / speed / falloff / range, guns' fire and burst delays, spreads, headshot multipliers, quality,
  dual ammo; melee obstacle damage and attack; throwables' strike delay, snowball speed, heavy variants; explosions'
  damage / freeze / drops; role perks and kits; outfit faction sides). Presentation stays original (sprites, sounds,
  names, `barrelLength`, `dualOffset`, `bulletType` of the potato guns and the bugle). The winter sniper skins take
  survev's values like their bases. survev's `() => util.weightedRandom([...]).type` role perks become `$weighted`
  (`lib/inputs.ts`).
- Sim: role kits come from the role def's survev `defaultItems` (healing items on promotion, the Bugler's pan, the
  Grenadier's Saiga-12 with 15 frags / 10 MIRVs, the excess dropped), role perks resolve `$weighted` (the Lone
  Survivr's four perks; `lastManExtraPerks` now empty); a snowball or potato held 1 s (`changeTime`) leaves as its heavy
  variant (survev weaponManager.ts:1229).
- Client: the role menu and HUD show a role's fixed perks only (`perks` may hold weighted entries).
- 5b (sim perk numbers, survev `PerkProperties`): Cast Ironskin 45 %, Flak Jacket size +10 % with +3 frags / +2 MIRVs
  of bag room (excess drops when it goes; the Grenadier now keeps survev's 15 / 10), Gift of the Woods +20 % and
  1 HP/s, Splinter sides x0.5, ammo perks x1.12 multiplied with Hollow-points / OKAMI Bar x1.08 and Last Breath,
  9mm Overpressure x1.2, Hollow-points x1.1 bullet speed, .45 in the Chamber's 1-in-6 empowered rounds, Fabricate's 8
  weighted explosives every 10 s. 50v50 outfits with a `teamId` fit their faction only (`loot/pickup.ts
  wearableOutfit`). Each knob stays in `rules` / `rules.perks`; `conflicts.md` notes the survev resolution under each
  conflict. The original perk descriptions stay (Fabricate's "fill your pack with frag grenades" is now loose).
- 5c (from the wiki description audit, second half): original obstacles take survev's `loot`, `explosion` and
  `health` (`lib/objects.ts SURVEV_MAP_GAMEPLAY_FIELDS`, provenance `survevMapValues`; loot of unported items
  dropped); `mapObstacleBounds` joins the map-generation fields; `bunker_structure_09` is survev's (its stairs match the
  survev Twins stairs we already took); `explosion_cobalt` / `shrapnel_cobalt` ported, so the Twins walls blow when the
  class code is entered. Sim: Augmenting Vat needs the player fully inside and refuses a Classless player; Spud Gun
  hits no longer enlarge teammates; Cobalt's unlock follows the def (`rules.unlockOverrides` empty). Client minimap:
  an object is drawn only when its own `map.display` is set, as its `map.displayType` (survev's map message rule; the
  children of a disguised building are still drawn: our map message carries no parent ids). main 12345 golden
  `ce7c0c634070da85`; `combatViews.test.ts` finds an outdoor spot instead of a fixed one.
- Oracle fixtures regenerated with the new defs (`tools/oracle`); main golden unchanged.
- Tests changed: `original-values.test.ts` (original presentation + survev gameplay, each survev value checked against
  the original it replaced), `integrity.test.ts` (weighted role perks, role kits), `survevGuns.test.ts` (defs: winter
  gaps closed by option B; sim: chi-square critical values up to 14 degrees of freedom for survev's larger 50v50 gold
  drop table), `roles.test.ts` (survev kits and Lone Survivr perks), `throwables.test.ts` (strike delay and snowball
  damage from the defs, heavy snowball), `modes.rules.test.ts` (no event-map fix), `tools/oracle/oracle.test.ts`.

### Stage 4 details

- 4a (defs): the port takes survev's 21 survev-only outfits, 25 emotes and 7 heal / boost effects
  (`policy.json`); their survev world loot comes back (Fragtastic, egg outfits, Coconut Frenzy, snow / beach outfits,
  the Reserve's gold toilet). survev's `outfitHalloweenTree` is the original `outfitTree` renamed: not ported, the
  Halloween loot entry is renamed back (`lib/maps.ts ITEM_RENAMES`). Classless now wears `outfitClassless`. Outfit,
  emote and effect names come from the defs, like the original cosmetics (no `game-<id>` keys, no ko table entries).
  `NOT_PORTED_IDS` (defs test helpers) now lists survev meta content (quests, passes). Tests:
  `packages/defs/test/survevContent.test.ts` "survev cosmetics", `tools/port-survev/survevLoot.test.ts` renames,
  `survevPerksRoles.test.ts` (Classless outfit).
- 4b (loadout; the lead's decision 2026-10-07: everything unlocked, no accounts): the main menu's Loadout button opens
  `apps/client/src/menu/loadoutMenu.ts` (tabs: outfit, melee skin, emotes with the six slots, heal and boost
  particles, crosshair with colour / size / stroke). The loadout lives in localStorage `rebirth.loadout`
  (`menu/loadoutStore.ts`), goes out in Join (survev's layout, schema 16) and is validated again in the sim
  (`packages/sim/src/match/loadout.ts`: unknown or wrong-type ids take the default; role uniforms, loot melee weapons
  and `noCustom` emotes are not loadout items). `match/playerLoadout.ts` applies it at join: outfit (worn, never
  dropped; a faction outfit of the other side falls back to the base outfit; a costume brings its disguise), melee
  skin, emotes (Joined returns them), heal / boost particles in PlayerInfo. The death emote goes 0.3 s after dying,
  the win emotes 1 s after the game over (`match/emotes.ts updateSlotEmotes`). The crosshair is the CSS cursor over
  the game canvas (`menu/crosshair.ts`, set in `game/sandbox.ts`). v0.8.82 has no death-effect loadout: the death
  slot is the death emote. Tests: `packages/sim/test/loadout.test.ts`, `packages/protocol/test/messages.test.ts`
  (Join), `apps/client/test/loadout.test.ts`, `tests/e2e/survev-loadout.spec.ts`. Lead patches: section 15.

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
- Wiki description audit (first half): `vault_door_chrys_01` opened by hand, so the Chrysanthemum planter puzzle was
  pointless; `tree_13` (Oasis palms) and `tree_01x` (snow trees) drew at twice survev's size (original defs, survev-only
  art). All three now take survev's def (`survevMapObjects`); main 12345 golden `e6817bd488ca1b1a`. Test:
  `survevBuildings.test.ts` "the Chrysanthemum bunker's planter vault". Loot differences the audit found (saloon
  crimson .50s, hatchet case, cattle crate, chrys scopes, DEagle cases) are balance reverts: stage 5.
- Wiki description audit (second half): `perch_01`'s roof residue named `map-perch-res.img`, which the original
  client lacks (the collapsed perch drew nothing); survev's def names the original `map-perch-res-01.img`, so
  `perch_01` takes survev's def too (`survevMapObjects`).
- Cloud Bunker flooded spots: `world.ts isOnWater` kept the first matching floor surface, survev the last; both
  water patches of `bunker_cloud_sublevel_01` lie inside corridor tiles, so the sim saw tile (no slow) while the
  client drew wading. Last match wins now; test "the Cloud bunker's flooded corridor spots are water".
- Obstacle disguises (Junkyard audit: Spoopy Barkskin, every Halloween costume): wearing an outfit with an
  `obstacleType` only changed the tint. Now `packages/sim/src/world/disguise.ts` (`setOutfit`, used by pickups and role
  kits) puts a non-collidable copy of the obstacle over the wearer (`Obstacle.skinPlayerId`): it follows them, shows
  their health, takes no hits (`canDamageObstacle`, melee skip) and dies with them through the obstacle kill (loot and
  explosion: the Barrel Costume's barrel blows up). Snapshots show it exactly when its wearer is seen. Wire: the
  obstacle record gains the original's static `isSkin` + `skinPlayerId` u16 (schema 14 since the merge of the base at 63b4464). Client:
  drawn over the wearer at the wearer's interpolated position (`objects/world.ts anchorOf`, `objects/obstacle.ts`),
  no sight or aim-line blocking. Tests: `packages/sim/test/disguise.test.ts`, `packages/protocol/test/disguise.test.ts`,
  `tests/e2e/survev-disguise.spec.ts`. Lead patch: section 11.
- Wiki audit finished (32 pages of the Buildings navbox, every tab and linked page): what is left is wiki-vs-survev
  (survev wins: Oven count, Potato spring hardstone, river cache modes, Camp on Winter classic), quest-only data (River
  Town `goreRegion`, hardstone quest tracking: out of scope) and the Cloud Bunker lab door's unlock sound (the original
  def has none; presentation stays the original's).
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

## Survev parity wave (the lead's tasks, 2026-10-07)

- 1. Potato-faction gold drop: done. survev drops `airdrop_crate_04po` (inner `crate_13po`: `crate_13` plus 2
  tier_airdrop_potato rolls) on potato faction maps (survev plane.ts:273-278). No map def names it, so the port gained
  `policy.json` `survevServerMapObjects` (roots for objects only survev's server spawns; `lib/policy.ts`,
  `lib/objects.ts portMapObjects`). The scheduled gold drop and the comeback drop pick `rules.roles.potatoGoldCrate` on
  potatoMode maps (`match/faction.ts goldCrate`). Schema 17: the two map types take ids in survev order, map ids from
  `crate_17` (926 -> 927) on move up by one or two. Test: `faction.test.ts` "Potato vs Tomato: the gold drop and the
  comeback drop are the potato gold crate".
- 2. survev server audit: done (commits "survev parity 2a" to "2g"). Five read-only audits compared survev's server
  (`.survev/server`, c6185e31) with `packages/sim` for planes and air drops, gas, mode rules and swaps, role and perk
  timing, map spawns and events. Tests: `packages/sim/test/survevParity.test.ts` unless named. The list:

  | # | survev behaviour | status |
  |---|---|---|
  | 1 | heavy snowball slows 2 s, heavy potato drops 2 items (explosion defs) | fixed: `rules.modes.throwableHits` built from the defs' `freezeDuration` / `dropRandomLoot` |
  | 2 | potato swaps use `weaponSourceType \|\| gameSourceType` (the potato in hand for a heavy potato, the MIRV for its bomblets, the gun that shot a barrel) | fixed: `DamageParams.weaponSourceType`, projectiles carry the thrown item |
  | 3 | no kill swap when the victim's own hit kills it; Lone Survivr keeps its weapons | fixed |
  | 4 | the Crowbar can be potato-swapped (survev's def has no `noPotatoSwap`) | fixed in the port: survev leaving a gameplay flag out turns it off (`lib/objects.ts SURVEV_ABSENT_IS_OFF`, provenance `survevValues` "absent") |
  | 5 | a promotion never drops the kit's leftover 1x scope | fixed |
  | 6 | an empty kit slot fills the gun from the bag (free only with endless ammo or non-bag ammo); the Captain's guns too | fixed: `keepWeapons` removed (`roles.test.ts`) |
  | 7 | a worn role helmet refuses a helmet picked up by hand | fixed |
  | 8 | a role of 4+ perks drops the loot perks | knob `rules.perks.roleDropsLootPerks`, off (conflicts.md perk-max-perks-rule) |
  | 9 | Lone Survivr pings reach the whole faction | fixed |
  | 10 | any kill credit (a teamkill too) re-checks the kill leader | fixed |
  | 11 | `canDespawn`: 50v50 role holders never despawn; the start counts downed players, dead teammates of a living side and role holders; no Captain check on player removal | fixed (`match.ts canDespawn`) |
  | 12 | spawns on beach sand and river banks (only water is refused); 16 u from another group's ground-layer projectile | fixed (`match/spawn.ts`) |
  | 13 | scheduled drops are not re-rolled into the circle; opened shells still block drops; box pushes take the larger overlap axis; round crates clamp by radius; landing crates crush trees by their canopy box | fixed (`match/planes.ts`, `survevBoxPush`) |
  | 14 | strike zone centres count players by survev's grid cells (`grid.intersectCollider` has no exact test; the audit's "rad + player radius" was wrong) | fixed (`airstrikes.ts inGridCells`) |
  | 15 | 50v50: a shot in an enemy's view shows the shooter on the enemy minimap for 1 s | fixed: `rules.roles.factionRevealTime` 1 (0 off; the default is 0 since the owner's 2026-10-08 feedback, rebirth-deviations.md); FactionStatus lists revealed enemies after the own faction (schema 18, no layout change); client dots in the enemy colour, 0.1 s fade in, gone 2-2.5 s after they leave the list |
  | 16 | gas hits inside each player's update, after boost, perks, the downed buffer and bleeding; disconnected players take a flat 22 | fixed / knob `rules.gasDisconnectedDamage` null (conflicts.md gas-escalation) |
  | 17 | Cobalt: the server's random class waits 25 s, the client confirms the highlighted one at 20 s | fixed (`modes.cobalt.test.ts`, `roles.test.ts`) |
  | 18 | the Commander's automatic flare fires the flare gun (dual too), indoors too | fixed under the knob, still off (`leaderAutoFlare`) |
  | 19 | the comeback drop skips circle 0 only | fixed under the knob, still off (`helpLosingTeam`) |

  Decided (conflicts.md; most predate ADR 0003, so worth re-confirming against the survev baseline; each is one rules
  value away from survev): crush damage 100 through perks (`airdropCrushInstantKill`, survev 1e10); a scheduled gold
  drop at circle 3 + 2 s and no comeback drop (`factionGoldDrop`, `helpLosingTeam`; survev has only the comeback drop);
  faction strike waits 24 / 18 s (survev 30 / 21); no time-in-gas ramp (`gasDamageRamp`); 100 HP knocks after the zone
  closed (`downHealthFinalCircle`, survev 50); no free Savannah 2x scope; the 50v50 promotion schedule
  (`factionSchedule: "map"` gives survev's seven roles at 50-74 s); Mass Medicate x0.8 (survev x0.75); the loot perk
  cap at 3 (survev refuses at 4). Done since (owner, 2026-10-08): survev's 50v50 MVP in the game over with the client's
  Commander stars and MVP ribbon; kept: GameOver goes to every player, 50v50 is squads only (survev also has solo
  50v50).

  survev bugs not ported: round crates (Cobalt pods, `airdrop_crate_02h`) pulled into boxes by a sign error in its
  collider push; Trick or Treat? checking `halloween_mystery` instead of the rolled perk and deleting a held loot perk;
  Combat Stimulants ending also ends Last Breath; the potato Grenadier's Saiga / potato cannon rolled once per server
  process; a promotion dropping a copy of a same-type backpack or chest; the comeback drop's winners' centre summing
  connected players but dividing by all living ones (ours: connected players throughout, knob off); the spawn fallback
  keeping the last invalid candidate (ours: the first valid crowded point). Negligible and left: one-tick offsets of the
  zone and strobe timers, plane ids 1-255 instead of 1-254.

  For the bots (lead-owned): `Snapshot.factionStatus` now also carries revealed enemies; nothing in `packages/bots`
  reads it today, but any future reader has to check the member's team.
- 3. Missing sprites: done; `pnpm assets` reports none. `map-crate-13x` (the snow air drops' opened image): neither
  client ships it; survev opens them on `map-airdrop-02x`, which they now take for `button.useImg` only (new policy key
  `survevSpriteFixes`, provenance `survevSpriteFixes`; the closed images stay the original's). `map-tire-01`,
  `map-wall-glass-18`, `map-bathhouse-column-02`: their defs (`tire_01`, `glass_wall_18`, `bathhouse_column_2`) are never
  spawned (no map, building, game object, sim or server code names them) and neither client has the image, so
  `tools/assets/unspawned-defs.json` lists them and the import records them as drawing nothing without a warning;
  `tools/assets/sources.test.ts` checks the list stays true.
- 4. Building visual parity: no discrepancy found, nothing changed in defs or rendering. Every survev-only or
  survev-overridden showcase entry (49 buildings, structures and caches) was shot with roofs, with every roof open and
  underground, plus close-ups of Reserve and its basement, the Cloud and Twins sublevels, mansion_03 and its cellar and
  the snow barn basement (`tests/e2e/survev-building-parity.spec.ts`; `PARITY_ALL=1` shoots all, default 5 + 1
  close-up; screenshots in `__screens__/survev-parity`). Client test hooks: `window.__rebirth.hideRoofs` (every
  ceiling open) and `window.__rebirth.cameraAt` (camera centred there, not on the player). The ported defs equal
  survev's raw data (only `category` → `obstacleType` renamed); compared with the survev.wiki.gg layout and roof images:
  workshop, alt warehouse, pirate hut, hunting perch, Twins and Cloud bunkers and sublevels, Reserve and basement,
  oasis, camps, logging complexes, mansions, teahouses, the snow, spring, summer and Halloween variants. The showcase
  keeps only the structure, so the Cloud bunker there lacks its lake dressing (stones, lily pads, island brush); the real
  savannah map has it. The wiki's Cloud ground image shows a light circle around the lake: that is the savannah grass
  (`0xb4b02e`) with the rest of the image darkened to 70 % by the wiki author to mark the footprint, not a map feature.

## Owner request (2026-10-08): two rebirth buildings

The owner asked for a building of the worker's own design for the normal map and one only for 50v50. Done as rebirth
additions (`packages/defs/src/rebirth/buildings.ts`, `docs/research/rebirth-deviations.md` "Rebirth buildings"):

- `clinic_01` on `main` (1 fixed spawn): lobby, two treatment rooms that heal 2 HP/s (`healRegions`), a pharmacy with
  medical loot (new rebirth-only spawner `loot_tier_medical`).
- `outpost_01r` / `outpost_01b` on `faction` (1 each, on its faction's side by `teamId`): armory with the faction's
  crate, an M870 mount and ammo, a command room with the blueprint table, bunks; roof in the faction's colour.
- Floors and roofs are rebirth art: SVGs drawn by `tools/assets/rebirthBuildingArt.ts` (`pnpm assets:buildings`) from
  the same layouts as the wall obstacles, committed under `apps/client/public/rebirth/map/` and served from there
  (manifest entries in `apps/client/src/assets/rebirthSprites.ts`; `assetUrl` takes absolute paths). They are the
  rebirth's own drawings, not original or survev art, so they can be committed; `tools/assets/rebirthBuildingArt.test.ts`
  keeps them in step with the layouts.
- Schema 18 (unreleased): the four map types take ids after the air drop tier crates. The main 12345 golden hash moved.
- Tests: `packages/sim/test/rebirthBuildings.test.ts` (layouts clear of walls, healing, faction sides and crates),
  map validation counts, `tests/e2e/rebirth-buildings.spec.ts` (screenshots in `__screens__/rebirth-buildings`).
- For the bots (lead-owned): the 50v50 map gains two buildings, one per side; nothing in `packages/bots` names them.

## Changes needed in the lead's files

All closed: applied by the lead in 2acdac0 (2026-10-07). Two items differ from the patch here: the coconut and tomato
particles keep survev's grey tint instead of 0xffffff (item 1), and a disguise lets a client bullet through but still
plays its chip particle and sound, as survev's client does (item 11). The sections stay as the record.
- Sprites: `map-building-reserve-*`, `map-crate-17` and `map-airdrop-05` come in with a fresh `pnpm assets` (checked
  after the merge); `tools/assets` needs no change. The import's four sprites without a file (`map-crate-13x`,
  `map-tire-01`, `map-wall-glass-18`, `map-bathhouse-column-02`) belong to original defs and are missing in survev too.

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
then `e856eb5e71684e02`, `e6817bd488ca1b1a` and `ce7c0c634070da85` in later stages; the ids below still hold),
so the bot tests that pin object ids or coordinates of that map fail:
- `walk.test.ts`, `nav.test.ts`, `nav.follower.test.ts`: `house_red_02` id 1391 no longer exists. The main 12345
  `house_red_02`s are now ids 1402 (610.1, 583.7, ori 0), 1440 (491.3, 144.5, ori 1) and 1478 (127.3, 501.2, ori 3).
  Re-pin, or better find the first `house_red_02` by type.
- `nav.basements.test.ts` "plans through narrow doorways": the storm-bunker hut cells (x 564-567, y 562-565) moved;
  the storm bunker (`bunker_structure_03`) is now id 1287 at (344.3, 569.2) (the crossing bunker
  `bunker_structure_05` is id 209).
- 50v50 stage: faction maps changed too (team crates on their sides, 32 apart); bot tests pinning faction coordinates
  need the same re-pin.
- Stage 5 (survev balance): `perception.intel.test.ts` (3 tests) hard-codes the M9 round at 12 damage; survev's
  `bullet_m9.damage` is 13 (the misses are exactly 13/12). Patch: `m9Hit` uses `13 * (1 - 0.3 * (dist / 100))` (or
  `getDef("bullet_m9").damage`) and line 39 expects `13 * (0.85 + 0.15 * 2)`.
- After merging the base's bot overhaul (51c2c4b): `gunTiers.test.ts` "every gun reachable on the main map" fails on
  `bar`: survev's main loot tables drop the BAR (stage 5), so `packages/bots/src/knowledge/gunTiers.ts:79`
  `["bar", "A-", 0.45, false]` needs `true` (main-map flag). `move-scenarios.test.ts` "an unarmed bot chased out of a
  house" fails for house index 4 (seed 4: the bot never flees): the red houses of main 12345 moved with survev's map
  generation, so the scenario's house pick needs re-checking. With these, 12 bot tests fail on this branch, all listed
  here.

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

### 9. Winter sniper gaps closed by survev balance (`packages/defs/src/rebirth/survevGuns.ts`)

Under `survevBalance` the bases take survev's numbers, so three `SKIN_WIKI_GAPS` entries are closed: drop
`svd_winter.headshotMult`, `svd_winter.bullet.damage` and `sv98_winter.headshotMult` (keep the three `barrelLength`
gaps: presentation stays original). `packages/defs/test/survevGuns.test.ts` accepts closed gaps today (it lists them);
after the edit, remove the `closed` handling there. Also `rebirth-deviations.md` rows for these three gaps.

### 10. e2e expectations moved by survev balance (`tests/e2e/m7-modes.spec.ts`, lead's spec)

survev's Medic class perks are Field Medic + Combat Stimulants (survev roleDefs.ts healer; Windwalk before), so
`m7-modes.spec.ts:213` (korean) should expect `["전투 의무병", "전투 각성제"]`. Every other m7 / m7-modes test passes.

### 11. Obstacle disguises pass bullets and melee on the client (`apps/client/src/fx/bullets.ts`, `fx/effects.ts`)

The sim lets everything through a disguise (survev client obstacle.ts: `collidable = def.collidable && !isSkin`), but
the client's predicted bullets and melee hits still stop at it and chip it (a barrel costume eats tracers):
- `fx/bullets.ts` obstacle collection (~line 290): `if (view.dead || view.skinPlayerId !== undefined || ...) return;`
- `fx/effects.ts firstBlocker` and the melee obstacle list: skip `o.view.skinPlayerId !== undefined` (survev
  client player.ts:2353 `if (obstacle.dead || obstacle.isSkin) continue;`).

### 12. New ammo bag rows need survev's fifth level (`packages/defs/src/rebirth/newGuns.json`, lead-owned)

This branch takes survev's five-level `bagSizes` (stage 2, backpack04), but `newGuns.json` cuts the sheet's rows to
four, so `packages/defs/test/gameConfig.test.ts` "bag sizes are survev's five levels" fails on `40mm` and a level-4
pack holds only the level-3 amount (`Inventory.capacity` clamps to the last entry). Patch, the sheet's own five values
(docs/design/new-gun-stats.md section 4.5):
- `newGuns.json` `bagSizes`: `"40mm": [10, 20, 30, 40, 50]`, `"rocket": [4, 6, 8, 10, 12]`, `"57mm": [100, 200, 300,
  400, 500]`; and the `newGuns.ts:32` comment ("cut to the game's four") becomes "the sheet's five pack sizes".

### 13. Id shifts from the merges of the base (62930da, 63b4464; schema 14)

Every id keeps its relative order (original, then survev-only in survev order, then rebirth-only); the survev content
wave's survev-only ids sit among the existing survev-only ones in survev order, so:
- Game types: original ids 1-633 unchanged; the survev-only guns move (e.g. `explosion_potato_lmgshot` 634 -> 667,
  11 ids in all); the rebirth-only ids move up by 77 (`bomb_heavy` 646 -> 723, then the new guns beta and the variant strobes: `strobe_heavy` 721 -> 798);
  802 of 1024.
- Map types: original ids unchanged; 49 survev-only ids move (first `hut_wall_int_7` 837 -> 842); the rebirth-only ids
  move up by 179 (`crate_10t1` 889 -> 1068); 1072 of 4096.

### 14. Variant strobe tests after survev balance (`packages/defs/test/strobes.test.ts`, edited minimally)

Stage 5 already ports survev's 3 s strike delay and stage 2 survev's five-level bags, so two pins in the lead's test
moved: `bagSizes.strobe` is `[2, 3, 4, 5, 6]` (Pack04 6, the wiki's own value), and the generated strobe's
`strikeDelay` is 3, so the `strobe` deviation now reads original 3 -> rebirth 3. Optional patch in
`packages/defs/src/rebirth/strobes.ts applySurvevStrobe`: return `[]` when `strobe.strikeDelay === STROBE_STRIKE_DELAY`
(no deviation left), and the test's deviation pin goes.

### 15. Loadout wiring in lead files (closed: applied by the lead in 23c1936)

The lead wired `effectsOf` (`setLoadout` runs whenever a player's heal / boost changes, so a late PlayerInfo still
applies), draws both hands of the per-hand outfits (`OutfitDef.skinImg.handSprite` is `string | { left, right }`),
added the deviation entry and an e2e join in `outfitAurora`. The patch notes below stay as the record.

- Heal / boost particles: `apps/client/src/game/client.ts` view deps (both places that set `teamOf` / `nameOf`) add
  `effectsOf: (id) => this.match.effectsOf(id)` (`ViewDeps.effectsOf` exists, `game/match.ts effectsOf` reads
  PlayerInfo); in `apps/client/src/objects/player.ts`, when the emitters are created or the player view is set up,
  `const fx = this.deps.effectsOf?.(view.id); if (fx) this.emitters?.setLoadout(fx.heal, fx.boost);`.
- Left / right hand outfits: survev's `outfitAurora` and `outfitSpringTree` give `skinImg.handSprite` as
  `{ left, right }`, so `objects/player.ts:331` passes an object to the texture store (console
  "TypeError: id.endsWith is not a function", no hands). Patch as survev player.ts:1530-1532: apply
  `typeof hs === "string" ? hs : hs.left` to `handLSprite` and `hs.right` to `handRSprite`, and type
  `packages/defs/src/types/meta.ts OutfitDef.skinImg.handSprite` as `string | { left: string; right: string }`.
  The preload (`assets/spriteSets.ts`) already takes both. Both outfits are loot since stage 4a and loadout items now.
- `docs/research/rebirth-deviations.md`: "Loadout: everything unlocked (no accounts; the original and survev unlock
  only `unlock_default` for a guest). Role uniforms, loot melee weapons and `noCustom` emotes stay out
  (packages/sim/src/match/loadout.ts)."

## Owner requests (2026-10-07, while stage 2 ran)

- Buildings first: stage 3 is top priority. Go through every building of the survev.wiki.gg Buildings navbox
  (https://survev.wiki.gg/wiki/Buildings), follow each link and check every infobox tab (Roof, Layout, Alt.Roof,
  Alt.Layout, Basement, Basement Layout, ...) and its picture against our buildings. A loot icon on a layout picture
  (a pill on the Hunting Perch) is only the loot spawner's position (`loot_tier_*`), not a fixed item; fixed items are
  what the page's "Special loot" lists.
- When the buildings are done: a building test mode, a map with only buildings that can be cycled through. Done:
  the building showcase (stage 3 details).

## Shared hotspots touched (minimal)

- `packages/defs/src/registry.ts`: schema 14, then 16 (stage 4b) + history lines (11 hit feedback, 12 new guns beta, 13
  variant strobes and 15 the AP Rounds / last-stand bits are the lead's); the next bump is 17.
- `packages/defs/src/index.ts`, `packages/defs/src/data.ts`: export and apply the survev wiki-spec layer.
- `packages/defs/src/types/weapons.ts`: `MeleeDef.perk`, `ExplosionDef.healTeam / healAmount / dropRandomLoot`.
- `packages/defs/test/helpers.ts` (`NOT_PORTED_IDS`), `packages/defs/test/survevGuns.test.ts` (policy pins now
  `arrayContaining`), `packages/sim/test/perks.core.test.ts` (perk count: 41 original + survev-only).
- `apps/client/src/net/loopback.ts`: `give=` melee, `spawnSpots` (showcase).
- `apps/client/src/main.ts` (`building` route key), `apps/client/src/game/sandbox.ts` (`building` option),
  `apps/client/src/game/gasStages.ts` (`noGasStages`), `packages/sim/src/index.ts` (showcase exports).
- Obstacle disguises: `packages/protocol/src/objects.ts` (ObstacleCodec), `packages/sim/src/game.ts` (tick, snapshot,
  removePlayer), `apps/client/src/objects/world.ts` (`anchorOf`), `objects/worldQuery.ts` (`skin`),
  `input/aimLine.ts`.
- Loadouts (stage 4b): `packages/protocol/src/messages.ts` (Join), `match.ts` (PlayerInfos heal / boost),
  `connection.ts` (`loadout` option); `apps/server/src/session.ts`, `room.ts` (Join loadout, Joined emotes);
  `packages/sim/src/game.ts` (applyLoadout, PlayerInfo, slot emotes), `viewTeams.ts` (`AddPlayerOptions.loadout`),
  `view.ts` (`PlayerInfoView.heal / boost`), `combat/combat.ts` (death emote ticker); `apps/client/src/menu/mainMenu.ts`
  (Loadout button), `game/sandbox.ts` (Join loadout, cursor), `net/loopback.ts`, `game/match.ts` (`effectsOf`),
  `objects/types.ts` (`ViewDeps.effectsOf`), `assets/spriteSets.ts` (left / right hands), `l10n/menu.ts`;
  `packages/sim/test/match.test.ts` (PlayerInfo heal / boost).

## Open questions

- Cookable flags: the plan (section 2.3) proposed survev's source values; ADR 0003 point 4 and this wave's brief say
  the wiki wins, so the wiki's apply. Flip `WIKI_SPEC_OVERRIDES` if the owner prefers the source.
- English name of `cutlass_gold` (closed): "Gold Cutlass" as its def name and the wiki have it, fixed in
  `apps/client/scripts/l10n-items.ts` NAME_FIXES (survev's en.json says "Cutlass Gold").
