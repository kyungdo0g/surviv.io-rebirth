# Research knowledge base

Facts about surviv.io gathered from wikis, the original changelog and the survev source, used to build surviv.io-rebirth.

## Target era

**surviv.io v0.8.82 (December 2019)** — the build survev reconstructs and the one Kongregate relaunched in March 2026.
Content added after 0.8.82 is documented but marked `optional`. Content that only exists in the survev fork is marked `fork`.

## Line format (enforced by `node tools/kb/kb-check.ts`)

Every non-heading, non-blank line outside code fences and blockquotes is a fact line and must end with:

- one or more source ids: `[src:<prefix>/<ref>]`, several separated by `, ` or in separate brackets
- one confidence tag: `[H]` two independent sources or the survev source itself, `[M]` one wiki page, `[L]` conflicting or unverified

Blockquotes (`> ...`) are for editorial notes and are not checked.

Source prefixes (see `sources.md`): `survev/<path>:<line>`, `fandom/<Page_Title>`, `wikigg/<Page_Title>`, `wp-en/<Page>`, `wp-ko/<Page>`,
`namu/<문서명>` (search snippet only, never `[H]` on its own), `changelog/<version>`, `balance/<line>`, `l10n/<lang>:<key>`,
`kong/<note>`, `web/<url>`, `derived/<note>`.

## Precedence when sources disagree

1. Client-visible numbers in survev `shared/defs`, after reverting fork changes listed in `balance.txt`.
2. survev server logic; parts the survev authors mark as estimates are overridden by wiki evidence rated `[H]`/`[M]`.
3. Wikis win on qualitative questions: what existed, names, event rules.
4. Dates need two independent sources, otherwise `[L]`.
5. Undecidable: keep the survev value, expose it as a config knob, and log it in `open-questions.md`.

Every disagreement goes to `conflicts.md`.

## Layout

| Path | Contents |
|---|---|
| `sources.md` | source registry |
| `conflicts.md`, `open-questions.md` | disagreements and unresolved questions |
| `history.md`, `community-ko.md`, `l10n-ko.md` | history, Korean community, Korean glossary |
| `modes/` | one file per map/mode |
| `items/` | guns, bullets, melee, throwables, gear, perks, roles, cosmetics |
| `mechanics/` | movement, damage, boost, healing, downed/revive, gas, airdrops, explosions, doors/layers, loot |
| `maps/` | generation, places, buildings, bunkers, puzzles, obstacles |
| `ui/` | HUD, controls, menus, audiovisual style |
| `provenance/` | original-vs-fork classification of survev content, balance revert list |
