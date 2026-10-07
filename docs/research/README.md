# Research knowledge base

Facts about surviv.io gathered from wikis, the original changelog and the survev source, used to build surviv.io-rebirth.

## Target era

**surviv.io v0.8.82 (December 2019)** — the build survev reconstructs and the one Kongregate relaunched in March 2026.
Content added after 0.8.82 is documented but marked `optional`. Content that only exists in the survev fork is marked `fork`;
since ADR 0003 (2026-10-07) the game takes survev's content too, in stages (the survev-only guns first).

## Line format (enforced by `node tools/kb/kb-check.ts`)

Every non-heading, non-blank line outside code fences and blockquotes is a fact line and must end with:

- one or more source ids: `[src:<prefix>/<ref>]`, several separated by `, ` or in separate brackets
- one confidence tag: `[H]` two independent sources or the survev source itself, `[M]` one wiki page, `[L]` conflicting or unverified

Blockquotes (`> ...`) are for editorial notes and are not checked.

Source prefixes (see `sources.md`): `survev/<path>:<line>`, `fandom/<Page_Title>`, `wikigg/<Page_Title>`, `wp-en/<Page>`, `wp-ko/<Page>`,
`namu/<문서명>` (search snippet only, never `[H]` on its own), `changelog/<version>`, `balance/<line>`, `l10n/<lang>:<key>`,
`kong/<note>`, `web/<url>`, `derived/<note>`, `user/<date>-<topic>` (a deliberate rebirth deviation the project owner asked for).

## Precedence when sources disagree

Since `docs/adr/0003-survev-baseline.md` (2026-10-07) the game follows survev master for gameplay; the facts below
about v0.8.82 stay the record of the original game.

1. Gameplay numbers: survev `shared/defs` at the pinned commit, as survev ships them (balance.txt changes are kept, not
   reverted; the original value stays in `provenance/balance-revert.json`). The switch is staged: content the port
   policy (`tools/port-survev/policy.json`) does not take yet still carries the reverted original values.
2. Presentation (sprites, sounds, names, UI): the original client.
3. Specs of survev-only items: survev.wiki.gg where it differs from survev's source (the owner's decision,
   `user/2026-10-07-survev-guns`), applied in `packages/defs/src/rebirth/` with both sources cited. Reskins such as
   the winter snipers share their base gun's stats, so they follow the base (gaps listed in `rebirth-deviations.md`).
4. survev server logic; parts the survev authors mark as estimates are overridden by wiki evidence rated `[H]`/`[M]`.
5. Wikis win on qualitative questions: what existed, names, event rules.
6. Dates need two independent sources, otherwise `[L]`.
7. Undecidable: keep the survev value, expose it as a config knob, and log it in `open-questions.md`.

Every disagreement goes to `conflicts.md`.

## Layout

| Path | Contents |
|---|---|
| `README.md` | this file: scope, era target, line format, precedence, layout |
| `sources.md` | source registry (prefixes, snapshots, maximum confidence) |
| `conflicts.md` | every disagreement, merged and deduplicated: one `## <id>` entry with sides, proposed resolution and the files that raise it |
| `rebirth-deviations.md` | deliberate deviations from v0.8.82 the project owner asked for (frag radius, 50v50 air strike variants, air drop tiers, the survev guns' wiki stats and the classic gold-drop Barrett), applied by `packages/defs/src/rebirth/` |
| `open-questions.md` | every unresolved question, merged and deduplicated: one `## <id>` entry with proposed handling, related conflicts and files |
| `history.md` | timeline from 2017 development to the 2026 Kongregate relaunch and the survev revival |
| `community-ko.md` | Korean community: servers, clans, creators, DC Inside gallery |
| `l10n-ko.md` | Korean glossary keyed to `ko.json` / `en.json` |
| `namu.md` | namu.wiki Surviv.io pages, from search snippets |
| `engine/architecture.md` | server tick and game loop, match lifecycle, grids, object registry, process model |
| `engine/netcode.md` | transport, join flow, bit encoding, every message and its fields |
| `items/guns.md` | every gun def, original vs fork values |
| `items/bullets.md` | every bullet def and the server bullet logic |
| `items/melee.md` | every melee def |
| `items/throwables.md` | every throwable def and its explosions |
| `items/gear.md` | ammo, backpacks, armour, scopes, heals, boosts, bag sizes |
| `items/perks.md` | every perk def with names, effects and fork changes |
| `items/roles.md` | 50v50, map and Cobalt class roles |
| `items/cosmetics.md` | outfits, emotes, crosshairs, passes, quests, unlocks |
| `maps/generation.md` | map size, terrain, rivers, lakes, bridges, spawn pipeline |
| `maps/places.md` | minimap place labels and landmarks per map |
| `maps/buildings.md` | every building and structure def |
| `maps/bunkers.md` | every bunker structure, layout, loot and puzzle |
| `maps/puzzles.md` | puzzles, buttons, doors and scheduled unlocks |
| `maps/obstacles.md` | every obstacle def: health, collision, flags, loot |
| `mechanics/movement.md` | movement speed, modifiers, position update |
| `mechanics/damage-armor.md` | damage pipeline, armour, headshots, perk reductions |
| `mechanics/boost.md` | boost (adrenaline) decay, heal tiers, speed bonus |
| `mechanics/heal-actions.md` | healing items and the timed-action system |
| `mechanics/downed-revive.md` | knocked-out state, bleeding, reviving |
| `mechanics/gas.md` | red zone stages, damage, movement |
| `mechanics/airdrop-airstrike.md` | air drops, air strikes, flare guns, strobes |
| `mechanics/explosions.md` | explosion defs and the explosion damage model |
| `mechanics/doors-layers-ceilings.md` | doors, windows, ceilings, stairs and layers |
| `mechanics/loot.md` | loot tiers, spawners, drops and pickup rules |
| `modes/main.md` | Main (Normal/Classic), Main Spring, Main Summer |
| `modes/desert.md` | Desert map |
| `modes/woods.md` | Woods map and its Snow, Spring and Summer variants |
| `modes/faction.md` | 50v50 (Faction) and the fork's Potato vs Tomato |
| `modes/potato.md` | Potato map and Potato Spring |
| `modes/savannah.md` | Savannah map |
| `modes/halloween.md` | Halloween map |
| `modes/cobalt.md` | Cobalt map and classes |
| `modes/snow.md` | Snow map (Winter Classic) |
| `modes/turkey.md` | Turkey (Thanksgiving) events |
| `modes/beach.md` | 2020 Beach Party event and the fork's Beach map |
| `modes/birthday.md` | the fork's Birthday map |
| `modes/events.md` | every limited-time event and seasonal reskin |
| `ui/hud.md` | in-game HUD |
| `ui/controls.md` | desktop and mobile controls, keybinds |
| `ui/menus.md` | start page, lobby, settings, loadout and account menus |
| `ui/audiovisual-style.md` | renderer, scale, atlases, palettes, particles, sound |
| `provenance/fork-vs-original.md` | original-vs-fork classification of every survev id |
| `provenance/balance-revert.md` | every `balance.txt` line as a revert entry, plus unlogged fork changes |
| `provenance/live-vs-survev.md` | generated diff: relaunch (v0.8.82) client defs vs survev |
| `provenance/wiki-vs-survev.md` | generated diff: fandom infobox stats vs survev |
