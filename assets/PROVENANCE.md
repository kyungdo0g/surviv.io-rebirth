# Asset provenance

The art and audio under `apps/client/public/assets/` are the original surviv.io artwork and sound. `pnpm assets`
(`tools/assets/import.ts`) builds that directory locally from two copies of them:

- **Original v0.8.82 atlas frames** (`img/original/*.png`): cut by `tools/assets/atlas.ts` out of the texture atlases
  of the original client as served by the 2026 relaunch (https://surviv.io/assets/`<family>-<n>-100-<hash>`.png). The
  TexturePacker sheets inlined in the original bundle (`research-cache/live/app.<hash>.js`) give each frame's rectangle,
  trim and logical size; the pages are downloaded once into `research-cache/live/atlases/` and the cut frames go to
  `research-cache/atlas/sprites/`.
- **survev's files** (`img/**/*.svg`, `audio/`): the reference clone of survev (`client/public/img`,
  `client/public/audio`) at commit `c6185e31fe25a4a07def77a2bb25b1710bda90ac`, copied verbatim. survev's own branding,
  promo and social icons are excluded (`EXCLUDE` in `tools/assets/sources.ts`). The original client of the relaunch
  loads the same audio paths (`audio/guns/ak47_01.mp3`, ...).

The sprite manifest (`apps/client/src/generated/sprite-manifest.json`, committed: names, paths and sizes only) records
for every sprite id its file, its source and the size the definitions' sprite scales are relative to (the original
frame's sourceSize divided by its atlas scale). Sources, as of the original bundle `app.e5465b46.js`:

| Source | Sprites | What |
|---|---:|---|
| `original-0.8.82` | 1145 | the original atlas frame, for every sprite the original atlases hold, except below |
| `survev` | 493 | 110 kept over an original frame (`tools/assets/keep-survev.json`, with a reason each); 383 the original atlases do not hold: survev or fork content, of which the definitions reference 33: the survev-only guns' loot icons and held sprites and the PMG-134's potato (`proj-potato-03`; `tools/port-survev/policy.json`, ADR 0003), fork objects such as `tomato_01`, and `map-door-06`, `map-plane-01x`, `map-tree-01x`, `map-tree-13`, named by the original client but packed in none of its atlases |
| `fandom` | 0 | wiki PNG gap fills (`assets/fandom-gapfill.json`); the 16 earlier ones are now original frames |
| `none` | 5 | named by the original client too, but in none of its atlases, so it drew nothing: `map-bathhouse-column-02`, `map-crate-13x`, `map-perch-res`, `map-tire-01`, `map-wall-glass-18` |

Most of the 110 survev keeps are defects of the relaunch's rebuilt atlases (dithered palette pages; see the 0.9.0
changelog "Fixed several broken art assets"): outer dark borders and strokes at the canvas edge trimmed away (crates,
chests, cases, walls, doors, bars, building ceilings and floors, the air drop lid particles), checked against 2018-2019
wiki cuts of the live atlas, which have them like survev's SVGs. Six building frames are on another canvas than the one
the definitions place (`ownCanvas` in keep-survev.json): `map-building-bank-floor-02` and
`map-bunker-hydra-compartment-ceiling-02` are cropped, and the chrys compartment floors `01b`/`01c` and the hatchet
chamber and compartment floors are survev's canvas cut short at the right and bottom, which moves the centred art 5-18 px
off the wall colliders. survev's file is drawn at its own logical size for those (file size x survev's atlas scale).

The DOM HUD shows survev's SVG of a sprite (the manifest's `svg` field): the original HUD loaded `img/loot/*.svg`
files rather than atlas frames. Where survev's SVG is a later redraw (nine weapon loot icons and three emotes,
`tools/assets/survev-redrawn.json`), the HUD shows the original frame instead, the same picture as on the ground.

Rights to this artwork belong to its owners (surviv.io / Kongregate). It is **not** covered by this repository's GPL-3.0
license, which applies to the code. Because this repository is public, the asset files are **never committed**:
`apps/client/public/assets/` and `research-cache/` are gitignored and rebuilt locally with
`pnpm survev:fetch && pnpm assets` (the original bundle in `research-cache/live/` comes from
`node tools/research/extract-live-defs.ts --fetch`).
