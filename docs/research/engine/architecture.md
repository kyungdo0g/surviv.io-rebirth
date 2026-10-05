# Engine architecture

> Scope: server tick rate and game loop, match lifecycle, spatial grids, object registry and barns, process model (region game server + one child process per game), API server, client loop, configuration, and what is optional (database, accounts, cache, captcha, ads).
> The original surviv.io server was never published; everything server-side here is survev's reimplementation (`server/src/*`), with client-visible hints from the 0.8.82 client (`derived/survev@8715a605:client/js/app.js`). Netcode details are in `engine/netcode.md`.

## Codebase layout (survev)

| package | role | main tech | sources |
|---|---|---|---|
| `shared/` | code used by client and server: defs (items, map objects, maps), `gameConfig`, net messages, collision/math/terrain utils, API and team types | TypeScript | [src:survev/shared/defs/register.ts:1-80] [src:survev/shared/gameConfig.ts:153-157] [H] |
| `server/` | API server (`src/api/index.ts`), region game server (`src/gameServer.ts`), game process (`src/game/gameProcess.ts`), the `Game` simulation | Node ≥ 22.18, Hono, uWebSockets.js 20.69, Drizzle ORM, zod | [src:survev/server/package.json:6-37] [src:survev/package.json:18-19] [H] |
| `client/` | browser client and stats site | Vite 8, PixiJS 7 legacy, jQuery 3, Bootstrap 4 | [src:survev/client/package.json:6-32] [H] |
| `bot/` | Discord moderation bot (not a game AI) | discord.js 14 | [src:survev/bot/package.json:1-17] [H] |
| `tests/` | vitest suites: boost, game objects, kills, map objects, maps, net, quests, reviving | vitest | [src:survev/tests/vitest.config.ts] [src:survev/tests/src/net.test.ts] [H] |
- `pnpm dev` runs API server, game server and Vite client together; production builds the server with rolldown and runs `dist/index.js` (API) and `dist/gameServer.js` (game) [src:survev/package.json:8-13] [src:survev/server/package.json:6-12] [H]
- Default ports: API 8000, game server 8001, game processes from 9000 (one per game, up to `maxGames` 64), Vite 3000 [src:survev/config.ts:15-30] [H]
- The sample nginx config serves the client build at `/` and proxies `/api` and `/team_v2` to the API server on 8000; game servers are reached directly by their region address [src:survev/nginx.conf:1-43] [src:survev/server/src/gameServer.ts:41-49] [H]
- Code shared between client and server is pruned per target with `STRIP_FROM_PROD_CLIENT` / `STRIP_FROM_PROD_SERVER` blocks (e.g. the client build drops serializers it never calls) [src:survev/shared/utils/stripBlockPlugin.ts:1-45] [src:survev/shared/net/joinedMsg.ts:11-19] [H]
- survev is a recreation: its first commit (2023-12-11) was a server-only prototype, the decompiled original client was added on 2024-02-13 (`8715a605`), multiple game processes on 2024-09-21 (`70c05182`) [src:derived/survev-git-9f64948d] [src:derived/survev-git-8715a605] [src:derived/survev-git-70c05182] [H]

## Process model

- One region = one game server process; it owns a `GameProcessManager` that `fork()`s child processes running `gameProcess.ts`, each with its own uWebSockets.js app on its own port and at most one `Game` at a time [src:survev/server/src/gameServer.ts:33-39] [src:survev/server/src/game/gameProcessManager.ts:60-79] [src:survev/server/src/game/gameProcess.ts:206-225] [H]
- Ports are a pool of `maxGames` ports starting at `firstGamePort`; with no free port the find request fails with `full` [src:survev/server/src/game/gameProcessManager.ts:162-171] [src:survev/server/src/game/gameProcessManager.ts:221-238] [src:survev/server/src/gameServer.ts:68-72] [H]
- Stopped processes are reused for new games (`reusedCount`); at least 3 idle processes are kept warm and extra processes idle for more than 60 s are killed [src:survev/server/src/game/gameProcessManager.ts:173-212] [src:survev/server/src/game/gameProcessManager.ts:221-264] [H]
- IPC messages (Node `advanced` serialization): parent → child `Create {id, config}`, `KeepAlive`, `AddJoinToken {tokens, autoFill}`, `AddSpectateToken`; child → parent `UpdateData` (id, teamMode, mapName, canJoin, aliveCount, startedTime, stopped, timeRunning, living players) or `KeepAlive` [src:survev/server/src/game/ipcTypes.ts:6-63] [src:survev/server/src/game/gameProcess.ts:121-145] [H]
- Watchdogs: the child reports every 5 s and exits if it hears nothing from the parent for 10 s; the parent sends keep-alives every 5 s and kills (SIGQUIT, core dump) a child silent for 10 s; kills escalate from SIGTERM to SIGKILL after 5 s [src:survev/server/src/game/gameProcess.ts:227-240] [src:survev/server/src/game/gameProcessManager.ts:177-195] [src:survev/server/src/game/gameProcessManager.ts:266-277] [H]
- On an uncaught exception the child closes all sockets with `server_crashed`; when the parent disconnects it closes them with `server_restart` [src:survev/server/src/game/gameProcess.ts:27-47] [H]
- The game server reports its player count to the API every 20 s; the API zeroes a region that has been silent for 60 s [src:survev/server/src/gameServer.ts:97-110] [src:survev/server/src/gameServer.ts:293-296] [src:survev/server/src/api/index.ts:216-227] [H]
- Game server HTTP routes: `GET /health`, `GET /private/status` (API key), `POST /api/find_game` and `POST /api/spectate_game` (API key), WebSocket `/ptc` [src:survev/server/src/gameServer.ts:166-291] [H]
- In development the game server immediately creates a game for the first configured mode [src:survev/server/src/gameServer.ts:155-157] [H]
- The 0.8.82 client joins `ws(s)://<host>/play?gameId=<id>`, i.e. one host address serves several games selected by id, unlike survev's one-port-per-game design [src:derived/survev@8715a605:client/js/app.js:107620-107632] [src:survev/server/src/gameServer.ts:41-49] [H]
- Fandom: each region had up to four server zones (e.g. NA: New Jersey, Illinois, California) and small lobbies were merged to fill servers [src:fandom/Servers] [M]

## Tick rate and game loop

- Two independent timers per game process: `game.update()` every 1000/`gameTps` ms (100 Hz) and `game.netSync()` every 1000/`netSyncTps` ms (33 Hz); Windows uses NanoTimer because `setInterval` is imprecise there [src:survev/config.ts:40-41] [src:survev/server/src/game/gameProcess.ts:242-258] [H]
- `update()` measures real elapsed time and clamps dt to [0.001, 0.125] s, then updates in order: gas, players, clients (spectating, culling zoom), map (dynamic obstacles/buildings), loot, bullets, projectiles, explosions, smoke, airdrops, dead bodies, decals, planes [src:survev/server/src/game/game.ts:160-260] [H]
- `netSync()`: serialize dirty objects once, send every client its frame, then flush per-tick lists (new players, bullets, explosions, planes, map indicators, deleted objects, dirty flags, gas dirty) [src:survev/server/src/game/game.ts:302-322] [H]
- Overload handling: a tick slower than 4 × the tick budget logs a warning; after 20 such warnings the threshold doubles; ticks over 1 s log profiler stats [src:survev/server/src/game/game.ts:78-82] [src:survev/server/src/game/game.ts:262-284] [H]
- With debug logs on, average ms/tick and load % are printed every 15 s of game time [src:survev/server/src/game/game.ts:286-299] [H]
- `Game.step(seconds)` advances the simulation in 0.1 s steps for unit tests [src:survev/server/src/game/game.ts:427-438] [H]
- The base `Game` class has no Node imports; network-only behaviour (IPC updates, saving matches, quest progress) lives in the `ServerGame` subclass, so the simulation can also run in a browser or offline [src:survev/server/src/game/game.ts:419-425] [src:survev/server/src/game/gameProcess.ts:118-204] [H]

## Match lifecycle

- A game starts once more than one player (solo), group (duo/squad) or team (50v50) has a member who can no longer despawn; players can despawn during their first 10 s alive (`minActiveTime`) unless downed/dead or holding a 50v50 role [src:survev/server/src/game/gameModeManager.ts:46-63] [src:survev/server/src/game/gameModeManager.ts:135-137] [src:survev/server/src/game/objects/player.ts:3116-3123] [src:survev/shared/gameConfig.ts:192] [H]
- On start the gas advances to its first stage [src:survev/server/src/game/game.ts:182-186] [H]
- A game that has not started and has had no connected player for 30 s stops itself [src:survev/server/src/game/game.ts:187-201] [H]
- New players can join while alive players < map `maxPlayers` (80; 100 for 50v50), the game is not over and less than 60 s have passed since start [src:survev/server/src/game/game.ts:344-350] [src:survev/shared/defs/maps/factionDefs.ts:98] [H]
- Game over when at most one player/group/team is alive: winners get their win emote after 1 s and the game stops 1.8 s after the end; on stop all sockets close and match data is saved [src:survev/server/src/game/game.ts:352-376] [src:survev/server/src/game/game.ts:408-417] [H]
- Game modes in the server: Solo, Team (duo/squad by `teamMode` 1/2/4) and Faction (any faction map) [src:survev/server/src/game/gameModeManager.ts:10-17] [src:survev/shared/gameConfig.ts:133-137] [H]
- Matches with fewer than 2 players are not saved; if the API is unreachable the game process writes `lost_game_data/<gameId>.json`, which the game server retries hourly [src:survev/server/src/game/gameProcess.ts:71-99] [src:survev/server/src/game/gameProcess.ts:196-198] [src:survev/server/src/gameServer.ts:112-150] [src:survev/server/src/gameServer.ts:309-316] [H]

## Spatial structures

- Runtime collision grid: uniform cells of 16 world units, each a `Set` of objects; objects cache the cell range they occupy (`__gridBounds`) and are only re-bucketed when that range changes; a per-query id de-duplicates objects spanning several cells [src:survev/server/src/game/grid.ts:18-90] [src:survev/server/src/game/grid.ts:101-130] [H]
- Grid queries: `intersectCollider` (collider's AABB), `intersectGameObject`, `intersectAABBSet` (used for client visibility), `intersectPos`, `intersectLineSegment` (DDA walk for bullets and rays) [src:survev/server/src/game/grid.ts:101-245] [src:survev/server/src/game/client.ts:497] [H]
- Loot-on-loot pushing uses a separate `HashGrid` rebuilt each update (cell 16) [src:survev/server/src/game/grid.ts:250-361] [src:survev/server/src/game/objects/loot.ts:29-32] [H]
- Map generation uses its own `MapGrid` with 32-unit cells for placement checks [src:survev/server/src/game/map.ts:112-124] [H]
- Collision shapes are only circles and axis-aligned boxes (orientation in 90° steps) [src:survev/shared/utils/coldet.ts:1-60] [src:survev/shared/utils/collider.ts:1-60] [H]
- Map size limit: positions are encoded over 0–1024, so maps must fit in 1024 × 1024 units [src:survev/shared/net/net.ts:11] [src:survev/shared/net/net.ts:98-100] [H]

## Object registry and barns

- Networked object kinds: Player, Obstacle, Loot, DeadBody, Building, Structure, Decal, Projectile, Smoke, Airdrop (the `GameObject` union) [src:survev/server/src/game/objects/gameObject.ts:20-30] [src:survev/shared/net/objectSerializeFns.ts:5-18] [H]
- `ObjectRegister` assigns u16 ids (fresh ids first, then per-type free lists), keeps `idToObj`/`idToType`, the dirty flag arrays and a dense `objects` array (swap-remove on delete), and adds every object to the grid on register [src:survev/server/src/game/objects/gameObject.ts:55-147] [H]
- Deletions are deferred: objects are queued in `deletedObjs` and unregistered during the netsync flush, so clients see the delete in the same frame [src:survev/server/src/game/objects/gameObject.ts:162-169] [src:survev/server/src/game/game.ts:319] [H]
- `BaseGameObject` holds the grid bookkeeping, `pos`, `layer`, cached partial/full bit streams sized from the serializer's declared sizes, and `setDirty`/`setPartDirty` [src:survev/server/src/game/objects/gameObject.ts:172-257] [H]
- Per-kind managers ("barns"): ClientBarn, PlayerBarn, LootBarn, DeadBodyBarn, DecalBarn, ProjectileBarn, BulletBarn, SmokeBarn, AirdropBarn, ExplosionBarn, PlaneBarn, MapIndicatorBarn, plus Gas and GameMap; bullets, explosions, planes and emotes are not registry objects but per-tick lists sent in UpdateMsg [src:survev/server/src/game/game.ts:90-145] [src:survev/shared/net/updateMsg.ts:287-292] [H]
- Group ids come from an `IDAllocator(255)`; team/group ids are u8 on the wire [src:survev/server/src/game/objects/player.ts:92] [src:survev/shared/net/updateMsg.ts:179-189] [H]

## API server

- Hono app on Node: CORS for `/api/*`; routers `/api/user` (profile, loadout, pass/quests), `/api/auth` (Discord, Google, mock in dev), `/api` stats (`user_stats`, `match_history`, `match_data`, `leaderboard`), `/private` (moderation, `save_game`, `update_region`, `set_game_mode`, `set_client_theme`, XP, cache clear) [src:survev/server/src/api/index.ts:43-85] [src:survev/server/src/api/routes/stats/StatsRouter.ts:9-12] [src:survev/server/src/api/routes/user/AuthRouter.ts:24-28] [src:survev/server/src/api/routes/private/private.ts:20-60] [H]
- Public endpoints: `GET /api/site_info`, `POST /api/find_game_v2`, `POST /api/report_error`; the team lobby WebSocket `/team_v2` also lives in the API server [src:survev/server/src/api/index.ts:87-214] [src:survev/server/src/api/apiServer.ts:59-76] [H]
- The API talks to region game servers over HTTP with the shared `survev-api-key` header; game servers call back the API's `/private/*` routes with the same key [src:survev/server/src/api/apiServer.ts:20-41] [src:survev/server/src/api/auth/middleware.ts:77-82] [H]
- Daily cron at midnight deletes old IP logs and expired sessions [src:survev/server/src/api/index.ts:235-244] [H]
- The 0.8.82 client's account API lives under `/api/user/*` (profile, username, loadout, unlock, pass, quests, logout, delete, reset_stats) with auth at `/api/user/auth/{facebook,google,twitch,discord}` [src:derived/survev@8715a605:client/js/app.js:47589-47612] [src:derived/survev@8715a605:client/js/app.js:81861-82313] [H]

## Database and optional services

- PostgreSQL via Drizzle; tables `session`, `users`, `items`, `user_pass`, `user_quest`, `match_data`, `ip_logs`, `banned_ips` [src:survev/server/src/api/db/schema.ts:18-200] [H]
- Accounts are optional: with `database: { enabled: false }` DB-backed routes answer 403 "Database is disabled", sessions resolve to guests and ban checks are skipped [src:survev/README.md:24] [src:survev/server/src/api/auth/middleware.ts:70-75] [src:survev/server/src/api/auth/index.ts:31] [src:survev/server/src/api/routes/private/ModerationRouter.ts:592-593] [H]
- Other optional parts, each off unless configured: Redis cache for leaderboards (`cachingEnabled`), Cloudflare Turnstile captcha (`captchaEnabled` + keys), proxy/VPN detection (`PROXYCHECK_KEY`), Google/Discord OAuth (client id + secret), error webhooks, the Discord bot, ad SDK ids, the battle pass (`passType: ""` disables it), rate limits (`rateLimitsEnabled`, on in production) [src:survev/configType.ts:198-345] [src:survev/server/src/api/cache/index.ts:9-21] [src:survev/server/src/utils/proxyCheck.ts:87-88] [src:survev/config.ts:63-65] [H]
- `uniqueInGameNames` (default true) makes in-game names unique to help moderation [src:survev/configType.ts:346-351] [src:survev/config.ts:66] [H]
- Configuration lives in `survev-config.hjson`, deep-merged over defaults; a missing file is created with random `SURVEV_API_KEY` and `SURVEV_IP_SECRET` [src:survev/config.ts:9-100] [H]
- Modes are configured server-side (`modes`: map + team mode + enabled, up to 3 for the client UI) and exposed through site_info, so event maps can change without a client rebuild; `clientTheme` (splash/music) is build-time [src:survev/configType.ts:119-146] [src:survev/server/src/api/apiServer.ts:63-64] [H]
- Default `defaultItems` override lets a host spawn players with custom gear (dev) [src:survev/configType.ts:381-403] [H]

## Client architecture

- `main.ts` (`Application`) owns menus, config, account, site info, ping test, team menu and the Pixi app; its ticker update clamps dt to [0.001, 0.125] s like the server [src:survev/client/src/main.ts:300-335] [src:survev/client/src/main.ts:920-925] [src:derived/survev@8715a605:client/js/app.js:107676-107680] [H]
- `game.ts` (`Game`) holds the connection, object pools/creator per networked type, client barns (players, loot, bullets, flares, projectiles, explosions, planes, airdrops, smoke, dead bodies, decals, particles, shots, emotes), map, gas, camera, renderer, UI managers and audio [src:survev/client/src/game.ts:207-275] [H]
- Each frame: update players and camera, build/send input, update map objects, loot, effects, UI and emotes, then render [src:survev/client/src/game.ts:395-1000] [H]
- Network messages are applied when they arrive (WebSocket callback) and rendered on the next frame [src:survev/client/src/game.ts:174-186] [src:survev/client/src/game.ts:1057-1150] [H]
- Property names are mangled (`m_` prefix kept from the original obfuscated client) and a codefend plugin obfuscates them in production builds [src:survev/client/src/game.ts:100-130] [src:survev/client/vite.config.mts:8-39] [M]

## Bots and testing

- There is no gameplay AI in survev; `shared/utils/bot.ts` is a stress-test client that joins through find_game and sends random inputs; `stressTest.ts` spawns 79 of them 100 ms apart [src:survev/shared/utils/bot.ts:100-380] [src:survev/server/src/stressTest.ts:7-30] [H]
- `debug.allowBots` (dev default) lets clients flagged `bot` join (they get no custom loadout) [src:survev/configType.ts:365-370] [src:survev/config.ts:69] [H]
- Debug edit messages (zoom, speed, game speed, new map seed, spawn loot, promote role, noclip, god mode, teleport to pings) are accepted only with `debug.allowEditMsg` [src:survev/shared/net/editMsg.ts:3-26] [src:survev/server/src/game/client.ts:160-163] [H]

## Conflicts

- CONFLICT process-per-game: survev runs one OS process and one port per game [src:survev/server/src/game/gameProcessManager.ts:60-79] vs the 0.8.82 client addresses games by `gameId` on a shared host [src:derived/survev@8715a605:client/js/app.js:107620-107632]; proposed: either works; prefer one process hosting several games behind one port if hosting cost matters [L]
- CONFLICT tick-rate-origin: survev's 100 Hz simulation / 33 Hz sync [src:survev/config.ts:40-41] vs no published original value [src:derived/survev@9f64948d:src/config.ts:30-31]; proposed: keep survev values as config knobs [L]

## Open questions

- Original server tick rate, snapshot rate and per-host game capacity are unknown; fandom only says the NA region peaked at over 11k players [src:fandom/Servers] [L]
- Whether the original server separated mobile and desktop players into different games (fandom, namu) cannot be checked in survev, which does not [src:fandom/Surviv.io_Mobile] [src:namu/Surviv.io] [src:survev/shared/types/api.ts:5-13] [L]
