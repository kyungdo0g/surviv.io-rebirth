# ADR 0003: survev master as the gameplay baseline

Status: accepted (2026-10-07). Supersedes points 2-4 of ADR 0002 in part; implemented in stages (below).

## Context

The project owner decided on 2026-10-07 (KB source `user/2026-10-07-survev-baseline`): "base it mainly on survev.io,
because it is the newest; if something exists only on survev.io, add it: the Barrett, the new buildings and so on".
Later the same day: "did you add the guns that only exist in the sequel? If not, add them, with specs following the
wiki" (`user/2026-10-07-survev-guns`). survev master at our pin (`c6185e31`, 2026-09-29, release v0.4.3) is already
the latest survev; nothing newer carries gameplay content except the unmerged `feat/winter-factions` branch. So this
is a change of port policy, not a data refresh. The evidence and the full plan are in
`docs/design/survev-content-and-new-guns.md` (sections 1 and 5.1).

## Decision

1. **survev master becomes the gameplay baseline**, in stages (see Stages). The target: every survev gameplay id and
   map object is ported, together with survev's loot tables, map generation, roles and perks, as survev has them, and
   survev's own balance changes are no longer reverted. Today the port takes only the content listed in
   `tools/port-survev/policy.json` as survev has it (with its loot placements); every other id keeps the reverted
   0.8.82 values until wave 1. `docs/research/provenance/balance-revert.json` stays as the record of the original
   values.
2. **The original 0.8.82 client stays the presentation source**: sprites and atlas frames, sounds where the original
   has them, HUD and UI, l10n strings, and the `lootImg` / `worldImg` / `particle` fields of shared ids. Original ids
   keep their wire indices: they stay the prefix of the registry; survev-only ids follow them, rebirth-only ids come
   last. One display name follows survev: `.50 AE` becomes ".50 Caliber" (Korean ".50 구경"), the shared ammo of the
   DEagle, Barrett, ASh-12 and S&W 500.
3. **Shared ids: option B (hybrid).** Shared ids take survev's gameplay fields (damage, spread, fire delay, clip,
   reload, headshot multiplier, ammo counts, role loadouts) and keep the original's presentation fields. The owner's
   instruction (2026-10-07: "base it only on survev.io, it is the newest") covers it; it lands with wave 1.
4. **Specs of survev-only items follow survev.wiki.gg** where the wiki and survev's source differ (the owner's words);
   each case is applied in the rebirth layer with both sources cited (`packages/defs/src/rebirth/survevGuns.ts`) and
   pinned by a test. The winter skins (`svd_winter`, `sv98_winter`, `awc_winter`) are the exception: survev defines a
   skin as its base gun plus a world image, so they share their base's stats, and six fields differ from the base
   pages of the wiki until point 3 moves the base guns (`SKIN_WIKI_GAPS`, `docs/research/rebirth-deviations.md`).
5. **Rebirth additions stay in the rebirth layer** (`packages/defs/src/rebirth/`): the air strike variants, the air
   drop tiers, the Barrett in the gold drop of the classic map and its seasons (spring, summer, snow) and the owner's
   new guns. Each is listed in `docs/research/rebirth-deviations.md`.
6. **Still excluded**: survev accounts and meta content (quests, passes, `xp_*` items) and unmerged survev branches.

## Stages

| stage | content | state |
|---|---|---|
| survev-only guns | `barrett`, `ash12`, `sw500`, `imbel`, `spas16`, `potato_lmg` with their bullets, `bullet_invis`, `potato_lmgshot` and its explosion, the winter skins `svd_winter` / `sv98_winter` / `awc_winter`, survev's `.50` bag sizes, survev's loot placements for them, the PMG-134's slow and view shrink; protocol schema 10 | done (2026-10-07): `tools/port-survev/policy.json` lists exactly these |
| survev baseline (W1) | every other survev-only id and map object, structure overrides (the Reserve), no balance revert, survev loot and map generation, 5-column bags, perks, roles, buildings, option B | planned (plan section 6) |

The port reads `tools/port-survev/policy.json`: `survevOnlyGameObjects` (taken as survev has them, after every original
id, in survev order), `survevSkins` (the original base def plus the fields survev's skin changes) and
`survevGameConfig` (GameConfig paths from survev, arrays cut to the original's length). Later stages extend it.

## Consequences

- The wire registry grows between the original and the rebirth blocks; every such change bumps
  `PROTOCOL_SCHEMA_VERSION` and changes `PROTOCOL_HASH`, so older clients are rejected at join.
- Tests that asserted "no fork content" now assert the policy's content instead (`packages/defs/test/integrity.test.ts`,
  `survevGuns.test.ts`, `survevGunLoot.test.ts`).
- `CLAUDE.md` "Data sources and precedence" now reads:

```md
## Data sources and precedence

1. survev (`.survev`, GPL-3.0, master commit `c6185e31`, 2026-09-29) is the gameplay baseline: gameplay values and
   survev content (survev-only guns, perks, buildings and maps included), loot tables, map generation, gas and roles.
   The switch is staged (`docs/adr/0003-survev-baseline.md`): the port takes what `tools/port-survev/policy.json`
   lists as survev has it; everything else keeps the reverted 0.8.82 values until its stage lands. We write our own
   code; we port data, not code.
2. Original client definitions extracted from the 2026 relaunch bundle (`research-cache/live/defs.json`) are the
   presentation source (sprites, sounds, UI, names) and fix the wire order of the original ids.
3. Rebirth additions requested by the user live in `packages/defs/src/rebirth` and are listed in
   `docs/research/rebirth-deviations.md`.
4. Wikis for qualitative facts, and survev.wiki.gg for the specs of survev-only items where it differs from the source.
   See `docs/research/README.md`.

Out of scope: survev accounts and meta content (quests, passes, XP items) and unmerged survev branches.
User-supplied art and sound live only in the gitignored `assets-user/`.
```
