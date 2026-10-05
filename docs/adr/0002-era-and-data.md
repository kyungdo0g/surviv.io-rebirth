# ADR 0002: Target era and data sources

Status: accepted (2026-10-05)

## Decision

1. Target the original surviv.io **v0.8.82** (December 30, 2019).
2. Client-visible definitions (guns, bullets, melee, throwables, gear, perks, roles, outfits, obstacles, buildings, structures, loot spawners) come from the **original client** served by the 2026 relaunch at https://surviv.io, whose changelog is v0.8.82 followed only by 0.9.0–0.9.3 bug fixes (March–September 2026). They are extracted by `tools/research/extract-live-defs.ts`.
3. Server-only data that the client does not contain (map generation, loot tables, gas stages, game modes, role schedules) comes from survev, with fork balance changes listed in survev's `balance.txt` reverted (`docs/research/provenance/balance-revert.*`).
4. Content that exists only in survev (fork additions such as barrett, ash12, sw500, imbel, `reserve_*`) is excluded. Content added to the original game after 0.8.82 is out of scope unless explicitly added later.
5. Disagreements are logged in `docs/research/conflicts.md`; undecidable values become config knobs.

## Evidence

- `docs/research/provenance/live-vs-survev.md`: 141 game objects and 241 map objects exist only in survev; 184 / 291 shared definitions have survev-changed gameplay fields (e.g. AN-94 damage 17.5 → 20, Mosin headshot multiplier 1.5 → 1.25).
- `docs/research/provenance/wiki-vs-survev.md`: the fandom wiki's datamined stat boxes agree with the original client where survev differs.
