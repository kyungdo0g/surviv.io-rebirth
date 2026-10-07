# port-survev

Builds the data of `@rebirth/defs` (`packages/defs/src/generated/*.json`) from two sources:

- **The original client** (`research-cache/live/defs.json`): every definition the surviv.io v0.8.82 client
  bundle contains. It is extracted by `tools/research/extract-live-defs.ts` from the 2026 relaunch at surviv.io,
  which is v0.8.82 plus the 2026 bug fixes. This source is authoritative.
- **survev** (`.survev` at commit `c6185e31`, GPL-3.0): an open-source recreation. Only survev has the
  server-only data the client never shipped: map generation, loot tables, plane and role timings, gas stages
  and the server constants in `GameConfig`. Since ADR 0003 (`docs/adr/0003-survev-baseline.md`) survev is the
  gameplay baseline too; the port takes survev-only content in stages, as `policy.json` lists it.

## Running it

```sh
sh tools/port-survev/fetch.sh                                   # clone/verify .survev, extract defs.json if missing
node --experimental-transform-types tools/port-survev/port.ts   # write packages/defs/src/generated/*.json
npx vitest run packages/defs tools/port-survev                  # integrity, original-value and registry tests
```

`--experimental-transform-types` is needed because survev uses TypeScript enums. Without it (`pnpm port`), port.ts
re-runs itself with the flag. The port is deterministic:
running it twice on the same inputs gives byte-identical output.

## Output

| file | contents |
|---|---|
| `gameObjects.json` | guns, bullets, melee, throwables, explosions, gear, perks, roles, outfits, cosmetics: id → def |
| `mapObjects.json` | obstacles, buildings, structures, decals, loot spawners: id → def |
| `maps.json` | map (mode) defs keyed by survev map name (`main`, `desert`, `woods`, `faction`, ...) |
| `gameConfig.json` | `GameConfig` |
| `provenance.json` | where each value came from, and every change the port made (see below) |

Key order follows the original client for game and map objects; the survev-only game objects of `policy.json` and
the survev-only map objects come after them, in survev order. Maps follow survev's order. The id registries in `packages/defs/src/registry.ts` number defs in
this order (0 is the empty type), so every original def keeps the index its position in the client gives it.

## Policy

0. **`policy.json`** (checked in, echoed into `provenance.policy`) lists the survev-only content the port takes as
   survev has it: `survevOnlyGameObjects` (today the survev-only guns, their bullets, `bullet_invis` and the PMG-134's
   `potato_lmgshot` with its explosion), `survevSkins` (skin id -> original base: the base's original def plus every
   field survev's skin changes against survev's base, so `svd_winter`, `sv98_winter` and `awc_winter` keep their
   base's stats with survev's winter world image) and `survevGameConfig` (GameConfig paths from survev, arrays cut to
   the original's length: `bagSizes.50AE` 50 / 100 / 150 / 200). Unknown keys are errors; a listed id that is
   original or not in survev is an error.
1. **Game objects** are the original client defs, unchanged, then the policy's survev-only ids in survev order
   (`provenance.gameObjects`: `"original"` or `"survev-only"`). Other survev-only ids are left out
   (`provenance.excluded.gameObjects`). survev fields the original lacks are not merged into original defs.
   One fixup: `explosion_rounds` and `explosion_rounds_sg` have no `type` in the client, so they get
   `type: "explosion"` (`provenance.fixups`).
2. **Map objects** are the original client defs, unchanged. survev-only map objects are kept only when a ported
   map can spawn them: mapGen spawns, bridges, lake centers, airdrop crates, unlock targets, then everything those
   reference (building children, structure layers, `destroyType`, button `useType`, puzzle targets). They are
   marked `"survev-only"`. For those objects survev's `category` field is renamed back to the original
   `obstacleType` / `structureType`, and `autoLoot` items missing from the game objects are dropped.
3. **Map defs** come from survev `MapDefs`, all of them, including the event variants and the `test_*` maps.
   For the eight maps the original client has (mapId 0–7: main, desert, woods, faction, potato, savannah,
   halloween, cobalt), the client-visible parts (`desc`, `assets`, `biome`, `gameMode`, `mapId`) are the original
   values deep-merged over survev's, with the original winning. `provenance.maps` records `inOriginalClient`,
   which client fields were replaced and which survev-only client fields were kept.
   survev builds some role overrides with closures; the port stores them as data: `{ "$byTeam": { red, blue } }`
   for team-dependent values and `{ "$weighted": [...] }` for `util.weightedRandom` choices.
4. **Balance reverts**: when `docs/research/provenance/balance-revert.json` exists, every entry with a concrete
   `originalValue` is applied to survev-sourced server data (sections `lootTables`, `mapSpawns`, `roles`, `perks`,
   `other`): map loot tables, map generation and map game config, survev-only `GameConfig` keys and survev-only
   map objects. Values from the original client are never changed, so `stats` entries and entries aimed at original
   game objects, map objects or `GameConfig` keys are skipped. Targets look like `main.lootTable.tier_guns[bar]`,
   `faction.mapGen.fixedSpawns.cache_01f` or `cobalt.gameConfig.unlocks.timings[bunker_twins_sublevel_01]`.
   An entry's `maps` list names every map it applies to. Without a map, the entry applies to every map that still
   holds `forkValue`. The `field` may already be part of the target (`bullet_an94.damage` + `damage`) or describe the
   target's own value (`count`, `replacement`, `spawns`). The resolver picks the reading whose current value is
   `forkValue`. `"absent"`, `"removed"`, `"none"` and `"n/a"` (optionally with a note in parentheses) delete the key or
   loot entry. Numeric and JSON-encoded strings are parsed. Any other text is a description and is not concrete.
   A map spawn revert that names a map object neither source defines is rejected. Every entry is logged as
   `{ status: "applied" | "skipped", entry, reason, targets? }` in `provenance.balanceRevert`. If the file is
   missing, the port prints a warning and skips this step. Entries that would undo the loot placement of a ported
   survev-only item are skipped (reason "survev-only item ported as survev places it"), and so is the entry that
   would put a skin's base back where survev swapped the base for the skin (snow's eye block: AWM-S for the winter
   AWM-S), so those tables stay as survev has them (`lib/survevLoot.ts`). After the event-map fixes, tables a fix
   rebuilt (Savannah's pre-fork reconstruction) get survev's entries of the ported items back unless the map's loot
   bans forbid them (`provenance.survevPlacements`).
5. **Loot tables**: entries whose item is not in the final game objects (survev-only items the policy does not take,
   such as the iceaxe, cutlass or coconut) are removed, and so are `xp_*` drops (accounts are out of scope). A table left empty gets a single no-drop
   entry `{ name: "", count: 1, weight: 1 }`. survev's `tier_barn_melee` is renamed to the original
   `tier_sledgehammer`, which the original barn basement's `loot_tier_sledgehammer` drops. Every change is logged
   in `provenance.lootRemovals` / `provenance.fixups`.
6. **GameConfig**: survev's `GameConfig` deep-merged under the original client's. The original wins for every key
   present in both, and arrays are replaced whole, so `bagSizes` keeps the original four backpack levels. TypeScript
   enum reverse mappings are dropped. survev's gas stage table (a private const in
   `server/src/game/objects/gas.ts`) is added as `gas.stages`. The policy's `survevGameConfig` paths take survev's
   value instead. `bagSizes` and `player.defaultItems.inventory` keys for items that don't exist are pruned.
   `provenance.gameConfigDiffs` lists every key that differs, exists on one side only, was pruned or was taken from
   survev by the policy.

The port ends with a reference check (`provenance.problems`, expected to be empty). `provenance.deadRefs` lists
broken references in original defs that no map can spawn: the original client keeps three unused loot spawners
whose tiers no loot table defines.

## Files

- `port.ts`: the pipeline and the summary
- `lib/inputs.ts`: loads `defs.json` and the survev TypeScript, and converts the survev values to JSON
- `lib/maps.ts`: map defs and loot table cleanup
- `lib/objects.ts`: game objects, map objects (with the survev-only closure) and GameConfig
- `lib/balance.ts`: the balance-revert resolver
- `lib/policy.ts`: loads and checks `policy.json`
- `lib/survevLoot.ts`: survev placements of the ported survev-only items (balance-revert skips, restores)
- `policy.json`: which survev-only content the port takes (ADR 0003)
- `lib/validate.ts`: the reference check
- `balance.test.ts`: unit tests of the balance-revert resolver
- `survevLoot.test.ts`: unit tests of the policy, the survev-only ids and skins, and the survev placements
- `fetch.sh`: fetches the inputs
