# oracle

Golden fixtures for `packages/sim`, recorded by running the **survev** reference server simulation
(`.survev`, GPL-3.0, commit `c6185e31`) in-process with **our** definitions
(`packages/defs/src/generated/gameObjects.json` and `gameConfig.json`). Milestone M2+ tests (weapons, bullets,
damage, reload, gas, boost, revive) compare our simulation against these files.

survev is a behavioural reference, not a source of truth: where survev guesses (see [Caveats](#caveats)) the
fixtures record survev's guess. We port data and observed behaviour, never survev code.

## Setup

```sh
sh tools/port-survev/fetch.sh            # clone .survev at the pinned commit (once)
cd .survev && pnpm install --frozen-lockfile --ignore-scripts --filter survev --filter @survev/shared && cd ..
```

A `.survev` that is a symlink (a worktree sharing the main checkout's clone) works: `lib/paths.ts` resolves it to
its real path, which is the path Node loads survev's modules by, so the module hooks below still match them.

Only the root and `shared` workspaces are installed (`hjson`, `zod`). The `server` workspace is skipped on
purpose: it depends on `uWebSockets.js` from a GitHub tarball (fails behind the proxy) and the in-process `Game`
does not need sockets. The two server imports that are still reachable are handled by module hooks
(`lib/hooks.ts`):

- `server/src/utils/badWords.ts` (imports `obscenity`) is replaced by a passthrough `validateUserName` stub;
- `zod` (kept by Node's type stripping in `server/src/utils/types.ts`) is resolved from `shared/node_modules`;
- `.survev/config.ts` is loaded with its file access disabled, so a local `survev-config.hjson` can never change
  the results and nothing is written into `.survev`.

## Regenerating

```sh
node --experimental-transform-types tools/oracle/run.ts            # every fixture (~2 min)
node --experimental-transform-types tools/oracle/run.ts weapons ttk # some of them
npx vitest run tools/oracle                                          # fixture shape and sanity checks
```

`--experimental-transform-types` is required because survev uses TypeScript enums. `run.ts` formats the written
files with Biome, so `pnpm lint` accepts them unchanged. Output is deterministic: two runs, or a run of a single
fixture versus a full run, produce byte-identical files. Regenerate whenever `packages/defs/src/generated` changes;
every fixture's `meta.defs` holds `PROTOCOL_HASH` and the SHA-256 of both JSON inputs, so stale fixtures are easy to
spot.

## How it works

### Running survev with our data (`lib/patch.ts`)

Before any game is created, every id in our `gameObjects.json` **replaces** survev's definition in place
(keys deleted, ours deep-copied in). survev's `GunDefs`, `BulletDefs`, ... exports and the `GameObjectDefs` registry
share these objects, so all survev code sees our values. survev-only ids (fork content) are untouched. Exceptions:

- survev-only fields kept after the replace (`KEEP_SURVEV_ONLY_FIELDS`): `bullet.noDistAdj` and
  `bullet.useExplosiveRoundsAlt` on `bullet_buckshot`, `bullet_flechette`, `bullet_frag`, `bullet_birdshot`. They are
  server-side flags the client never shipped; `noDistAdj` turns off the ±1 m bullet distance jitter for pellets.
- ids we have and survev lacks (`bullet_potato`, `bullet_bugle`, the `*_bonus` bullets, `emote_flagisrael`,
  `outfitTree`) are added and registered, so the potato guns and the bugle can fire.
- `GameConfig`: in the gameplay sections (`player`, `bullet`, `gas`, `bagSizes`, ...) every key present in both
  takes our value (only the 4-level `bagSizes` arrays differ today). `gas.stages` exists only in our config (survev
  keeps the table private in `objects/gas.ts`); `gas.json` checks that survev's stages equal ours.
- survev's `PerkProperties` (steelskin 0.45, flak jacket 0.1 / 0.9 explosions, ...) stay survev's: our defs have no
  such numbers.

The patch is verified through survev's own accessors (`GameObjectDefs.typeToDef("bullet_an94").damage === 17.5`,
`GunDefs.mosin.headshotMult === 1.5`, and a full comparison of every replaced id); a failed check aborts the run.
`fixtures/patch.json` lists every gameplay value where survev differs from our data (`changed`), survev fields that
were dropped (`survevOnly`) and fields only we have (`oursOnly`).

### Simulation loop (`lib/harness.ts`)

- `game.update(0.01)` per tick: survev's `Config.gameTps` is 100 and so is our `TICK_HZ`. Tick numbers count
  completed updates; an event during the update that completes tick N happens at time N × 0.01 s. An input sent
  before tick N + 1 and an event in tick M are `(M - N) × dt` apart.
- `game.netSync()` at survev's 33 Hz, like the game process (it resets per-tick flags such as `actionDirty` and
  lets the bullet pool recycle). It is paused while a health cap is raised (the wire format holds health 0–100).
- Players are survev test players (`playerBarn.addTestPlayer`) driven by real `InputMsg`s through `handleInput`.
  Auto and burst guns hold the trigger; single-fire weapons also send `shootStart` every tick (spam clicking, the
  fastest possible rate).
- The map is `oracle_flat`: survev's `test_normal` (no rivers, lakes, buildings or obstacles) enlarged to 1024
  base units (1328 m). Scenario rows start 150 m from the border because the outer ~50 m are ocean and beach.
  `gas.json` uses the real `main` map.
- Games are created with `game.preventStart = true` (no gas, planes or game over) except for `gas.json`.
- Unclamped damage: when a fixture needs the damage of a hit regardless of remaining health, survev's
  `GameConfig.player.health` cap is raised for that call (`withHealthCap`), so `health -= damage` is never clamped.
- Shooters in weapon scenarios have `debug.godMode` (flare airdrops and explosive bullets cannot interrupt them).

### Determinism and random modes (`lib/rng.ts`)

`Math.random` is replaced for the whole run (survev's `util.random(min, max, rand = Math.random)` evaluates the
default on every call, so the global swap reaches every use):

| mode | Math.random() | effect |
|---|---|---|
| `seeded(n)` | mulberry32(n) | game creation (map generation, spawn layout) and natural-randomness runs (gas placement) |
| `centered` | 0.5 | `util.random(a, b)` = midpoint: spread deviation `util.random(-0.5, 0.5) * spread` = 0, pellet start jitter = 0, bullet distance jitter index `floor(0.5 * 17)` = 8 → distAdj 0 m |
| `low` | 0 | deviation −spread/2, pellet jitter −jitter, distAdj −1 m |
| `high` | 1 − 2⁻⁵³ | deviation +spread/2, pellet jitter +jitter, distAdj +1 m |

Headshots are controlled separately by overwriting `GameConfig.player.headshotChance`, which `Player.damage`
compares with `Math.random() < headshotChance`: **never** = 0 (no value in [0, 1) is below 0), **always** = 1 (every
value is below 1), **random** = survev's 0.15. Constant modes are installed only after a game exists (map
generation uses rejection sampling). Every harness reseeds, so each fixture is independent of run order.

"No headshots / zero deviation" = `centered` + `never` (used by `ttk.json`, `weapons.json`, the body rows of
`melee.json`); "headshot" = `centered` + `always`. In `centered` mode all pellets of a shotgun shell fly along the
aim line and hit together, which is the upper bound of shotgun damage.

## Fixtures

| file | contents |
|---|---|
| `patch.json` | the defs patch: replaced/added ids, kept survev-only fields, every value survev changed, verification |
| `weapons.json` | all 65 guns: shot times over one magazine, interval histogram, shots per magazine, pellets per shot, every reload action after an empty magazine (single-shell sequences, mosin's alternate reload), a partial reload, low-reserve reload (alt-reload guns), switch delays (free switch, rapid switch, pickup into the active slot), bullet speed, travel distance and flight time in `centered`/`low`/`high` modes; timings at 100 Hz **and** 1000 Hz; a quick-switch table (deploy groups) |
| `ttk.json` | 26 guns × armor {none, lvl1, lvl2, lvl3} × distance {5, 20, 50} m, no headshots, plus a headshot variant for 11 guns: damage per hit after falloff and armor, hits and shots to kill a 100 HP target, TTK from the first shot, flight time |
| `damage.json` | `Player.damage` called directly: 9 raw amounts × {body, head, explosion} × helmet 0–4 × chest 0–4 × perk {none, steelskin, flak_jacket}, plus gas/bleeding rows (armor ignored); rows `[amount, hit, helmetLevel, chestLevel, perk, damage]` |
| `melee.json` | all 42 melee ids: damage per hit per armor set (body and headshot), hits/TTK to kill, first-hit delay, swing interval, equip delay from a gun |
| `movement.json` | speed with every gun, melee and throwable equipped; diagonal, water, boost levels, firing, healing, cooking, downed crawl, reviving, being revived |
| `gas.json` | main map, solo: every stage (time, mode, duration, radius, damage, centre), samples every 5 s, and gas damage taken by a probe standing outside the safe zone |
| `boost.json` | boost 0–100 in steps of 5 plus breakpoint edges: regen/s, decay/s, speed; one-second natural evolution; full decay from 100 |
| `heal.json` | bandage/healthkit/soda/painkiller: use time and effect from several health/boost levels, refusal at full health, cancel behaviour (cancel input, weapon switch, firing, melee swing, damage, second item, reload input, walking, knock-down, heal during reload) |
| `revive.json` | duo: knock-down, bleed-out timeline, revive duration and health, second knock, revive cancelled by distance, damage buffer after a knock |

## Caveats

- **Fixed-step float residue.** survev decrements cooldowns and action timers by `dt` every tick and compares with
  `<= 0` / `< 0` / `>=`. With a fixed `dt = 0.01` the residue of repeated subtraction often adds one tick:
  ak47 `fireDelay 0.1` fires every 0.11 s, a 2.5 s reload takes 2.51 s, gas stage boundaries drift by a few
  hundredths of a second over a game. The
  real survev server uses wall-clock `dt` (jittering around 10 ms), so it has the same quantization on average.
  `weapons.json` also records every timing at 1000 Hz to show the underlying values.
- **Burst guns:** every shot sets `cooldown = fireDelay`, so the burst cycle is
  `(burstCount - 1)` burst gaps + `fireDelay`, not `burstCount × burstDelay + fireDelay`.
- **Falloff** uses the bullet's `distanceTraveled` at the end of the tick in which it hits, not the contact point.
- **Estimated in survev:** the reviver's move speed is `downedMoveSpeed + 2` ("not specified in game config so i
  just estimated", `player.ts` `recalculateSpeed`). The gas damage ramp `damage × (1 + timeInsideGas × 0.025)`
  (only while `circleIdx > 2`) has no cited source either.
- survev does not implement melee `armorPiercing`; armor reduces melee damage like any non-explosion hit.
- A reload requested while healing is dropped (`tryReload` refuses during `UseItem` and clears the request).
- Bullet speed and distance use `1 + variance` (survev's `varianceT` defaults to 1); every gun bullet in our defs
  has `variance` 0.
- survev's `PerkProperties` and other server constants are survev's numbers, not original data.

## Files

- `run.ts`: entry point; loads survev, patches it, runs the scenarios, writes and formats the fixtures
- `lib/hooks.ts`, `lib/survev.ts`: loading survev in-process
- `lib/patch.ts`: defs/GameConfig patch and its verification
- `lib/rng.ts`: random modes; `lib/harness.ts`: game driver and recorders; `lib/measure.ts`: helpers
- `lib/meta.ts`, `lib/json.ts`: fixture metadata and stable JSON output
- `scenarios/*.ts`: one module per fixture (`gunCycle.ts` holds the per-gun timing runs of `weapons.json`)
- `oracle.test.ts`: vitest checks of the committed fixtures (no `.survev` needed)
