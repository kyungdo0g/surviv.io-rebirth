# Asset provenance

All art and audio under `apps/client/public/assets/` is the original surviv.io artwork and sound, as preserved in the
survev reference clone (`client/public/img`, `client/public/audio`) at commit
`c6185e31fe25a4a07def77a2bb25b1710bda90ac`. It is copied verbatim by `node tools/assets/import.ts`.

- The original client of the 2026 relaunch (https://surviv.io) loads the same audio paths (`audio/guns/ak47_01.mp3`, ...).
- survev's own branding, promo and social icons are excluded (see `EXCLUDE` in `tools/assets/import.ts`).
- Rights to this artwork belong to its owners (surviv.io / Kongregate). It is **not** covered by this repository's
  GPL-3.0 license, which applies to the code.
- Because this repository is public, the asset files are **not committed**: `apps/client/public/assets/` is gitignored and
  rebuilt locally with `pnpm survev:fetch && pnpm assets`. Only the sprite manifest (names → paths) is committed.

Gaps (sprites referenced by the definitions without a file) are listed by `node tools/assets/import.ts --check-only`
and will be filled from the fandom / wiki.gg image dumps, recorded here per file.
