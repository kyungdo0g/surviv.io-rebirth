# Lag profile (2026-10-09)

Measurement only; no runtime code changes were made for this profile. The server harness exercised `BotFill.update`, `Game.step`, and `ClientEncoder` snapshot serialization for a main-map match. It sampled 1,000 ticks per bot count after warmup; snapshots serialize every third tick. `total tick` includes serialization cost only on those snapshot ticks, matching the configured cadence. Component percentiles are measured independently, so they should not be summed percentile-by-percentile. Per-bot brain time is total brain time divided by bot count.

Machine: 16 logical CPU cores. The load column is sampled host CPU load reported by Node during each scenario; it varied across runs and is not a per-process utilization measurement. Server timings are milliseconds.

| Bots | Map width | Host load | Total tick p50 / p95 / p99 | Bot brains total p50 / p95 / p99 | Brain per bot p50 / p95 / p99 | Sim p50 / p95 / p99 | Serialization on snapshot ticks p50 / p95 / p99 |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 40 | 842 | 27.0% | 3.501 / 7.596 / 9.735 | 2.379 / 3.985 / 5.718 | 0.0595 / 0.0996 / 0.1429 | 0.567 / 1.082 / 1.568 | 2.711 / 4.378 / 5.620 |
| 80 | 842 | 26.4% | 5.654 / 12.103 / 14.842 | 4.076 / 5.944 / 7.275 | 0.0510 / 0.0743 / 0.0909 | 0.826 / 1.414 / 2.038 | 5.120 / 7.604 / 9.091 |
| 120 | 1006 | 27.7% | 7.476 / 16.211 / 20.443 | 5.127 / 7.943 / 10.102 | 0.0427 / 0.0662 / 0.0842 | 1.117 / 1.889 / 2.873 | 6.882 / 10.228 / 12.070 |
| 200 | 1144 | 24.3% | 10.326 / 24.336 / 27.344 | 7.807 / 11.076 / 13.632 | 0.0390 / 0.0554 / 0.0682 | 1.663 / 2.445 / 3.047 | 11.004 / 13.867 / 15.042 |

The tick budget is 10 ms at 100 Hz. The median reaches that budget at 200 bots; p95 exceeds it at 80, 120, and 200 bots. The 40-bot p99 is close to the budget. Serialization is a substantial measured component because each snapshot encodes one view per connected player.

## 200-bot CPU profile

`node --cpu-prof` ran the same 200-bot harness. Profiling overhead raised the observed total tick p50 / p95 / p99 to 14.604 / 35.162 / 42.336 ms; do not compare those values directly with the unprofiled table. The top self-time samples were:

| Rank | Function | Self time | Share |
|---:|---|---:|---:|
| 1 | `packages/sim/src/world/world.ts:94` `query` | 999.8 ms | 6.0% |
| 2 | `packages/sim/src/world/entities.ts:256` `toView` | 900.2 ms | 5.4% |
| 3 | `packages/sim/src/game.ts:521` `getSnapshot` | 889.3 ms | 5.4% |
| 4 | `packages/core/src/grid.ts:128` `collect` | 648.8 ms | 3.9% |
| 5 | `packages/bots/src/perception/world.ts:333` `updateObjects` | 626.2 ms | 3.8% |
| 6 | `packages/protocol/src/update.ts:169` `write` | 554.6 ms | 3.4% |
| 7 | `packages/bots/src/controller.ts:49` `update` | 505.3 ms | 3.1% |
| 8 | `packages/bots/src/perception/world.ts:497` `seeObstacle` | 483.5 ms | 2.9% |
| 9 | `packages/bots/src/brain/brain.ts:165` `think` | 394.3 ms | 2.4% |
| 10 | garbage collector | 336.4 ms | 2.0% |
| 11 | temporary benchmark harness `bench` | 309.8 ms | 1.9% |
| 12 | `packages/protocol/src/update.ts:359` `writeFrame` | 242.4 ms | 1.5% |
| 13 | `packages/sim/src/world/playerView.ts:49` `playerLocalState` | 239.2 ms | 1.4% |
| 14 | `packages/bots/src/nav/astar.ts:127` `findPath` | 225.2 ms | 1.4% |
| 15 | `packages/sim/src/world/player.ts:448` `update` | 206.5 ms | 1.2% |

## Production client

Built with `pnpm build` and served by `vite preview`; measured in headless Microsoft Edge (Chromium), 600 animation frames per scenario. Every dummy player was clustered near the camera. The timing is the ticker callback's CPU duration (`avg`, median and maximum), rather than wall-clock frame interval. No missing sprites or page errors were reported. Host load and core count are recorded alongside each case.

| Players | Rain | Host load | Cores | Callback avg / median / max (ms) | Observed FPS |
|---:|:---:|---:|---:|---:|---:|
| 20 | off | 35.8% | 16 | 0.877 / 0.800 / 2.100 | 166.7 |
| 20 | on | 36.3% | 16 | 1.401 / 1.400 / 2.900 | 163.9 |
| 80 | off | 30.1% | 16 | 2.046 / 1.800 / 3.600 | 166.7 |
| 80 | on | 24.4% | 16 | 2.053 / 2.000 / 4.100 | 163.9 |
| 150 | off | 35.3% | 16 | 2.926 / 2.700 / 4.700 | 166.7 |
| 150 | on | 40.7% | 16 | 3.125 / 3.000 / 5.800 | 163.9 |

The loopback transport advances `Game.step()` from its `requestAnimationFrame` callback, so loopback simulation runs on the browser main thread. The client package does not load the bot AI; the sandbox's extra players are stationary dummies. This browser measurement therefore covers rendering and local simulation, not browser-side bot brains.

## Conclusion

In this setup, the server is the bottleneck under high bot counts: its 80+ bot p95 tick exceeds the 10 ms budget, while even the 150-player client callback remained below 6 ms at its maximum. Both bot perception/simulation and per-client snapshot serialization contribute on the server; the CPU profile identifies view creation, spatial queries, perception, and protocol encoding among the largest sampled functions. The browser result does not include client-side AI because none runs in loopback.

## Review (main session, 2026-10-10)

The numbers hold up, the server conclusion needs a correction.

- **Checked:** every `file:line` in the CPU profile names the function it says at `94ae0a4`; the map widths are the
  solo (small variant) widths `mapDefForPlayers` gives (842 / 842 / 1006 / 1144). A rerun of the same harness shape
  (`BotFill.update` + `Game.step`, then `getSnapshot` + `ClientEncoder.writeFrame` for every living player every third
  tick) on a different machine (4 cores, load average 3.3 to 3.6 from other work) gave, in ms p50 / p95 / p99:

  | Bots | Bot fill | Sim step | Encode every player | Encode one player (p50 / p95) |
  |---:|---:|---:|---:|---:|
  | 80 | 6.45 / 15.66 / 26.45 | 1.09 / 5.57 / 10.26 | 6.99 / 18.40 / 26.22 | 0.121 / 0.210 |
  | 200 | 15.41 / 33.23 / 66.84 | 2.28 / 8.63 / 18.32 | 17.23 / 36.13 / 70.31 | 0.149 / 0.410 |

  About 1.5 to 2 times the table above on a slower, loaded machine, with the same proportions between the parts.
- **Correction:** the real server encodes a frame only for its seats, the connected humans (`apps/server/src/room.ts`
  `netsync`); fill bots are in-process `BotController`s that read `Game.getSnapshot` inside `BotFill.update` and are
  never encoded. The "serialization" column (one frame per bot) and the "total tick" that includes it therefore
  overstate the real server: one human's frame costs about 0.1 to 0.4 ms. The real tick is about bot fill + sim step:
  near 5 ms p50 at 80 bots and 9.5 ms p50 at 200 bots on the 16-core machine above, so the budget is still crossed at
  p95 from about 120 bots and at the median near 200. The bottleneck is the bots (perception: `updateObjects`,
  `seeObstacle`, the snapshots they read through `getSnapshot` / `toView` / `query`) and the sim, not the encoding.
- **Client:** the frame times measure the ticker callback, not GPU time, with the refresh rate capping the frame rate;
  the loopback sandbox does run `Game.step` on the main thread (`apps/client/src/net/loopback.ts`) and loads no bot AI.
