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

4. **Point blank**: `c377365` (`brain/pointBlank.ts`, `scripts/hugging.ts`): no shots whose bullets spawn past the body;
   back off or swing (persona and skill), swing when cornered or still hugged after 1.2 s.
5. **Grenades**: `a389f0e`: no dodging a teammate's frag (no friendly fire in any mode) nor a frag behind a wall.
6. **Knocked bots crawl**: `ec1a52d` (`brain/downed.ts`, `scripts/downed.ts`): standing still while knocked 12% -> 7%
   (squads), revives 44/206 -> 64/230.
7. **Third parties**: `57d0d96` (`brain/newcomer.ts`, `scripts/thirdParty.ts`): a persona-driven tunnel-vision minority,
   the others turn on the newcomer or take cover from it. The probe is noisy (60-90 events per 8 matches).
8. **Famous basements**: `f94f061`: military base, Chrysanthemum (greenhouse) and club bathhouse draw more bots
   (military base 12 -> 18-22 bots in 3 matches). In the probe they were already visited every match.
9. **Outhouses**: `6d521d2`: toilets count 3 in the loot potential, a building is reached only inside its roof; outhouse
   toilets opened 7 -> 11 of 30.
10. **Molotov and flashbang**: `573139d` (`brain/rebirthThrows.ts`), and `208bf54` split `bot.ts` / `world.ts` (the
    600-line test is green again).
11. **HQ archive**: `78af98a`: between a puzzle's pieces a gun shoots the blocking table down; 6/6 seeds solve it.
12. `6cfd4f0`: `explosionGate` obstacles are never broken through (the launcher holder's case is still to do).

## Still to do

- **Infirmary narcotics store** (not fixed): the pharmacy's house door (`defs/src/rebirth/buildings/military/infirmary.ts`
  `op("house_door_01", -29, 26.5, 1)`, world id 918 on main 12345) opened from the triage hall swings across the store's
  vault doorway, so the grid has no way in and the bot gives the room up every 10 s. A bot that closes it from the hall
  reopens it on the way in; closing it from inside needs the way in. Likely fix: hinge that door at the other end of its
  doorway (or swing it the other way) so it never covers the vault door; then re-stage the golden hash.
- **When the clone's next wave lands**: a launcher holder may break an `explosionGate` obstacle; stay out of a building
  near collapse (`rebirth_wall_brk_*`, DamageType.Collapse).

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
