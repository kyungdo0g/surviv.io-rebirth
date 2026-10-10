# Main session handoff (2026-10-08, end of day)

Head when written: `014639c` on `claude/relaxed-fermat-hcg1fo` (pushed). Protocol schema 23. The clone session
(`session_01TqsHMvL19R8fcPNuQnQ81U`, branch `claude/survev-content`) is idle with nothing open; its PRs #11-#13 are merged.

## Done on 2026-10-10 (session_0155uKqQzUgmUurS5imUMVYt)

The 2026-10-08 patch was used in full and deleted.

1. **Early mass deaths**: `1a4263b` (BrainFeatures.earlyPace, sane fist rush and fist fights, `scripts/earlyDeaths.ts`).
   Seeds 1-3, normal gas, alive before -> after: 80 players 41% -> 58% when the first gas moves (80 s), 26% -> 44% at
   the end of the second stage (110 s), 7% -> 14% when the second circle closes (200 s); 200 players 32% -> 58%,
   18% -> 43%, 5% -> 17%. Fist and melee deaths in the first 2 minutes 20 -> 6 (80) and 141 -> 98 (200): an unarmed
   bot punched once while hurt still punches back (round-5 tests), so a hurt bot still mostly loses a fist fight.
2. **50v50 river and rally**: `ce29661` (`scripts/factionRally.ts`). Seeds 1-6: water bot-seconds 4.2% -> 2.6%
   (standing in water 2.1% -> 0.3%), members within 40 u of their Commander 22-28% -> 53-56% (rallying bots 67-72%),
   red wins 2/6 -> 2/6.
3. **Bots break what blocks them indoors + the house rule**: `24b73b5` (BrainFeatures.breakThrough,
   `nav/breakThrough.ts`, `brain/breakThrough.ts`, `scripts/breakThrough.ts`). 80 bots, first 150 s: house-rule
   obstacles destroyed 9 -> 46, stuck events 0.209 -> 0.220 per bot-minute.

Known red test: `packages/bots/test/determinism.test.ts` "bot source files stay under 600 lines" fails on HEAD since
`0313583` (`src/bot.ts` 607 lines, `src/perception/world.ts` 601), not from these commits.

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
