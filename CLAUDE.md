# surviv.io-rebirth

From-scratch TypeScript recreation of the browser battle royale surviv.io, targeting the original **v0.8.82** (Dec 2019).

## Layout

| Path | What |
|---|---|
| `packages/core` | math (`v2`, `math`), colliders, spatial `Grid`, seeded `createRng`, `BitWriter`/`BitReader` |
| `packages/defs` | game data: types + `src/generated/*.json` produced by `tools/port-survev` (do not hand-edit generated files) |
| `packages/protocol` | network messages and object serialization |
| `packages/sim` | authoritative, deterministic game simulation (no `node:*`, no DOM) |
| `packages/bots` | bot AI and headless clients |
| `apps/server` | HTTP + WebSocket game server |
| `apps/client` | Vite + PixiJS v8 client |
| `tools/` | `scrape` (wiki dumps), `research` (original-client extraction and diffs), `port-survev`, `assets`, `kb` |
| `docs/research` | cited knowledge base (`node tools/kb/kb-check.ts`) |
| `docs/adr`, `docs/design` | decisions and design notes |

Dependency direction: core → defs → protocol → sim → {server, client, bots}.

## Data sources and precedence

1. Original client definitions extracted from the 2026 relaunch bundle (`research-cache/live/defs.json`) — authoritative for every client-visible value.
2. survev (`.survev`, GPL-3.0, commit `c6185e31`) for server-only data (loot tables, map generation, gas, roles) and as a behavioural reference/oracle. We write our own code; we port data, not code.
3. Wikis for qualitative facts. See `docs/research/README.md`.

Fork-only survev content (barrett, ash12, sw500, imbel, reserve_* buildings, ...) is excluded.

## Conventions

- Node 22 runs `.ts` directly: relative imports use explicit `.ts` extensions; no `enum`, `namespace` or parameter properties (`erasableSyntaxOnly`); use `as const` objects.
- `packages/sim` and `packages/core` must stay deterministic: never `Math.random`, `Date.now` or `performance.now` there — use the seeded rng and the simulation clock (tests enforce this).
- Keep files under ~600 lines; split systems instead of growing god objects.
- Any change to the wire format in `packages/protocol` must bump `PROTOCOL_SCHEMA_VERSION` in `packages/defs/src/registry.ts`.
- Formatting/lint: Biome (4 spaces, 120 columns, double quotes). Run `pnpm format` before committing.
- Every gameplay rule should cite its source (KB file or survev path) in a short comment when the value is not self-evident.

## Commands

```
pnpm install
pnpm survev:fetch          # clone survev at the pinned commit into .survev (needed by port/assets)
pnpm port                  # regenerate packages/defs/src/generated
pnpm assets                # copy original art/audio into apps/client/public/assets (gitignored)
pnpm verify                # typecheck + lint + unit tests + kb:check
pnpm e2e                   # Playwright (preinstalled Chromium at /opt/pw-browsers)
pnpm dev                   # client dev server on http://127.0.0.1:5173
```

The original art is not committed (the repository is public); `apps/client/public/assets/` and e2e screenshots are gitignored.
