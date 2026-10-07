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
| 2 | gear / perks / roles (backpack04, 5-level bags, 6 more perks, captain, classless) | next | |
| 3 | buildings and map objects (Reserve, Workshop, Camp, Oasis, Cloud bunker, ...) | planned | |
| 4 | cosmetics (outfits, emotes, heal / boost effects) | planned | |
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

### 3. Held melee sprites

The Cutlass / Gold Cutlass use the existing `cutlass` idle pose and `cut` / `cutReverse` animations
(`apps/client/src/objects/anims.ts`, unchanged); the held sprite comes from `worldImg` like other melee. Nothing to do
unless the held-sprite renderer special-cases melee ids.

## Shared hotspots touched (minimal)

- `packages/defs/src/registry.ts`: schema 12 + history line.
- `packages/defs/src/index.ts`, `packages/defs/src/data.ts`: export and apply the survev wiki-spec layer.
- `packages/defs/src/types/weapons.ts`: `MeleeDef.perk`, `ExplosionDef.healTeam / healAmount / dropRandomLoot`.
- `packages/defs/test/helpers.ts` (`NOT_PORTED_IDS`), `packages/defs/test/survevGuns.test.ts` (policy pins now
  `arrayContaining`), `packages/sim/test/perks.core.test.ts` (perk count: 41 original + survev-only).
- `apps/client/src/net/loopback.ts`: `give=` melee.

## Open questions

- Cookable flags: the plan (section 2.3) proposed survev's source values; ADR 0003 point 4 and this wave's brief say
  the wiki wins, so the wiki's apply. Flip `WIKI_SPEC_OVERRIDES` if the owner prefers the source.
- English name of `cutlass_gold`: survev's en.json says "Cutlass Gold" (used, the presentation source for survev-only
  items); the def name and the wiki say "Gold Cutlass".
