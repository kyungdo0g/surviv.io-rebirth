# Tasks for a second assistant (2026-10-09)

These are moderate tasks while the main session is paused. Read `CLAUDE.md` first: its rules apply, and so do the
rules below.

- Work on your own branch: `git fetch origin claude/relaxed-fermat-hcg1fo && git checkout -b gpt/2026-10-09
  origin/claude/relaxed-fermat-hcg1fo`. Commit small and push to `gpt/2026-10-09` only, and open a pull request into
  `claude/relaxed-fermat-hcg1fo`. Never push to `claude/relaxed-fermat-hcg1fo` itself: the main session reviews and
  merges. The backup point is commit `343377c`.
- Before every commit, run `pnpm format`, `npx tsc -p tsconfig.json --noEmit`, `npx biome check .` and the vitest files
  you touched. Run `node tools/kb/kb-check.ts` when docs change.
- Never commit `assets-user/`, `apps/client/public/assets/` or `research-cache/`. They are gitignored and the
  repository is public.
- Any wire change in `packages/protocol` bumps `PROTOCOL_SCHEMA_VERSION` in `packages/defs/src/registry.ts` (now 23),
  with a history line.
- `packages/sim` and `packages/core` stay deterministic: no `Math.random`, `Date.now` or `performance.now`.
- Do not touch `docs/handoff/wip/2026-10-08-unfinished.patch` (early-game deaths, 50v50 rally). The main session
  finishes those.
- Do not skip, delete or loosen a failing test to get green. Find the cause, or write down what you found.

Do them in this order. Each one stands alone.

## 1. Fix a test that pins a source that never arrives (small)

`packages/defs/test/survevGunLoot.test.ts`: `LATER_WAVES` names "Cobalt Classless crates" (`tier_guns_*_classless`)
as the future source of `imbel` / `spas16`. survev never spawns `class_crate_common_classless` or
`class_crate_rare_classless`; `docs/adr/0003-survev-baseline.md` lists them as never spawned.

- Update the entry so the test keeps protecting what it protects, without waiting for a source that will not come.
- Cite the ADR in a comment.

**Done when** the test passes and the diff is limited to that test, plus a doc line if needed.

## 2. Full verification on a clean checkout (medium)

1. On a fresh clone or worktree with its own `pnpm install` (not symlinked `node_modules`), run `pnpm verify` (typecheck,
   lint, all unit tests, kb-check) on an otherwise idle machine.
2. For every failure:
   - **A timeout** that passes on an idle rerun: note it, no change.
   - **A real failure**: find the cause and fix it in a small commit ("Verification: <what>").
3. Write the results to `docs/handoff/verify-2026-10-09.md`: commands, pass and fail counts, what you fixed, and what you
   could not fix, with the error text.

## 3. Bot endgame thresholds relative to the map size (medium)

Maps now grow with the player cap (`packages/defs/src/rebirth/mapScale.ts`, `mapDefForPlayers`; up to 1225 units a side
on main and 1415 on 50v50). `packages/bots/src/brain/endgame.ts` decides when to switch to "hold a strong spot" with
absolute thresholds: next circle radius < 80, or a circle under 150 units (see its header comment). On a grown map the
hold therefore starts one circle late.

- Scale those thresholds by the played map width over the design width. The bot can read the map width from its map
  data (`mapData.width`); find the design width through the defs helpers in `mapScale.ts`.
- At the default player caps (main 80, 50v50 100) the behaviour must stay exactly the same.
- Add a unit test: same thresholds at the design size, proportionally larger on a 1225 map.
- Run `packages/bots/test` files touching endgame, plus `faction.test.ts`.

**Done when** the default-cap behaviour is bit-identical (the existing bots tests pass unchanged) and the new test
passes.

## 4. Lag profile: measurement only, no code changes (medium)

The owner reports lag with many bots. Measure where the time goes, but do not change code.

- **Server:** a main-map game ticking like the real server (`apps/server` `GameRoom.tick`, or `Game.update` plus
  `BotFill.update` plus snapshot serialization) at 40, 80, 120 and 200 bot players. A cap of 200 needs the room's
  `maxPlayers` 200 (`apps/server/src/config.ts` `MAX_PLAYERS`).
  - Per tick report p50, p95 and p99, against the 10 ms budget of 100 Hz.
  - Split the time into sim update, bot brains (total and per bot) and serialization.
  - Run `node --cpu-prof` on the 200-bot case and list the top 15 self-time functions with `file:line`.
- **Client:** Chromium (Edge is Chromium) on a production build (`vite build` + `vite preview`). Measure frame time with
  20, 80 and 150 players near the camera, rain on and off. Also check whether the loopback sandbox (`?sandbox=1`) runs
  the sim and bots on the browser's main thread.
- Write `docs/handoff/lag-profile-2026-10-09.md`: the tables, the hotspots, and a short conclusion on whether the server
  tick or the client is the bottleneck. Record the machine's core count and load next to each timing.

## 5. e2e: the new guns' HUD icons and sounds really load (medium)

`tests/e2e/new-guns-beta.spec.ts` only checks that a sound was requested.

- Add checks that, for a few new guns (an RPG-7, an M202, a rifle such as the AK-74, the DP-12):
  - the HUD weapon slot image actually loaded (`naturalWidth > 0`, no fallback broken image);
  - the shot sound's audio buffer decoded (`apps/client/src/audio/audio.ts` loads buffers; expose a debug hook through
    `window.__rebirth` if one is missing, test-only).
- Run Playwright with `--workers=1` on an idle machine (`PLAYWRIGHT_BROWSERS_PATH`, see `CLAUDE.md` commands).

**Done when** the spec passes and fails if you rename one of those sound files in a scratch copy. Revert the scratch
change.

## Not for this round

These stay with the main session: the early-deaths and 50v50 rally patch, the multi-core bot worker pool, and the drawn
gun sprites.
