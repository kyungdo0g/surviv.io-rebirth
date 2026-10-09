# Main session handoff (2026-10-08, end of day)

Head when written: `014639c` on `claude/relaxed-fermat-hcg1fo` (pushed). Protocol schema 23. The clone session
(`session_01TqsHMvL19R8fcPNuQnQ81U`, branch `claude/survev-content`) is idle with nothing open; its PRs #11-#13 are merged.

## Unfinished work (saved as a patch, not applied)

`docs/handoff/wip/2026-10-08-unfinished.patch` holds two half-done bot tasks, interrupted by a container restart and
then the usage limit. They are untested, so they were left out of the branch. To resume: `git apply --index
docs/handoff/wip/2026-10-08-unfinished.patch`, then finish, measure and review each one before committing.

1. **Early mass deaths** (the owner's most serious report: "they die from the very start, many at once; 200 players
   were down to 40 before long, mostly punched to death").
   - Files: `brain/earlyPace.ts` (new), `early.ts`, `fists.ts`, `fightScore.ts`, `assess.ts`, `danger.ts`,
     `earlyMemory.ts`, `scripts/earlyDeaths*.ts` (probe), `test/early-pace.test.ts`.
   - Measured before (`docs/handoff/wip/early-deaths-before.md`, the `earlyDeaths.ts` probe): at 80 players about 33
     deaths per minute in the first 2 minutes, and 80 % of early deaths fall within 5 s of two others somewhere on the
     map. Spatial bursts are 2 % of early deaths at 80 players and 17 % at 200 (fist rushes and brawls at drop spots,
     one barrel chain).
   - Target: at 80 players most players are still alive when the first gas moves, and about half remain around the end
     of the second stage. Keep the owner's early behaviours (fist rush with jukes, melee answer, crate-first,
     high-value routing) but make them sane.
2. **50v50: bots out of the river and rallying to the Commander** (owner).
   - Files: `brain/factionRally.ts`, `brain/factionRiver.ts` (new), the `faction*` brain and perception files, `guard.ts`,
     `position.ts`, `scripts/factionRally*.ts` (probe), `test/faction-rally.test.ts`.
   - Asks:
     - Never idle in the water. Hold from the banks, cover and bridges.
     - Most bots go to their Commander, a loose group that follows it and goes with it to the flare drop.
     - A persona-driven 20-30 % stays out.
   - Keep `test/faction.test.ts` (seeds 11 and 12) green.

## Still to do

- **Full verification** in a clean worktree, with its own `pnpm install --offline --frozen-lockfile`. Symlinked
  `node_modules` resolve the workspace packages to the main checkout and give bogus type errors. Run it with the machine
  idle: under load, timing tests time out. The last full run at load ~28 failed only on timeouts.
- **Faction A/B rerun**: the faction brain against the baseline was 24/40 wins (p = 0.27), with gas deaths -19 %, before
  today's merges. The script and settings are in the scratchpad notes (lost if the container is reclaimed); look in
  `packages/bots/scripts/`.
- **Lag** (owner: "it lags; can it use multiple cores?"):
  - Profile first, server tick split into sim, bot brains and serialization, and client frame time, at 40-200 players
    on an idle machine. The script is `lag-profile` in this session's workflow scripts, or rewrite it.
  - Expected fix: a Node `worker_threads` pool for bot brains (bots act only on snapshots and send inputs), plus a Web
    Worker for the loopback sandbox if it runs on the main thread.
- **Bots at big player caps** (from the PR #13 review): the endgame hold uses absolute radius thresholds and starts one
  circle late on grown maps, and the A* budget is per game, so 200 bots starve.
- **survevGunLoot test**: `LATER_WAVES` pins "Cobalt Classless crates" as a future source of imbel/spas16, but survev
  never spawns them (ADR 0003).
- **Guns, left over**: drawn held sprites for the AK-74 and Honey Badger; an e2e test that sounds actually play and HUD
  images load; rerun `tests/e2e/new-guns-beta.spec.ts` when the machine is idle.
- **Owner decisions pending**: the "Decided" list in `docs/handoff/survev-content.md` (nine values that differ from
  survev), the owner's own rarity list and tier list, and an M16A4 shortening (offered).
- **50v50 seed-11 endgame**: fixed (`2585deb`, knock at 50 HP once the zone has closed). The 50v50 test runs seeds 11
  and 12.

## Owner setup notes

- The owner's art and recordings live only in the gitignored `assets-user/` (the repository is public). They were sent
  to the owner as a zip. On their machine: unzip at the repo root, install ffmpeg, run `pnpm assets` after every pull.
- After a schema bump, restart both the client and the server.

## Lessons from this session

- Never `SendMessage` an agent that runs inside a workflow. It resumes a second copy from the same transcript, and the
  two then race on the same files. Stop the extra copy with `TaskStop <agentId>`.
- Agents that commit through a temporary index must build it from the current `HEAD`. One commit built from an old tree
  silently dropped three other commits. After committing, check `git diff --stat HEAD~1 HEAD`.
- With 4 cores, run at most about three heavy agents at once. Simulations and Playwright at load above 20 give
  meaningless timings.
