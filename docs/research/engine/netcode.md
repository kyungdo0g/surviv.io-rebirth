# Netcode

> Scope: transport and endpoints, the join flow (find_game API and join tokens), message framing, the bit-level encoding, every message with its fields, object serialization (partial/full) and dirty tracking, visibility culling, update rates, input sending and latency measurement, client interpolation, limits and rate limits.
> Two references: the survev reimplementation (protocol 1028; `shared/net/*`, `server/src/game/client.ts`) and the original 0.8.82 client protocol 78, read from the decompiled client in survev commit `8715a605` (`derived/survev@8715a605:client/js/app.js`) and confirmed by the 2026 Kongregate relaunch bundle (`kong/relaunch-client-bundle`, also protocol 78 with the same message table). The original server was never released, so server-side timing and culling are survev reconstructions.

## Protocol versions

- The original 0.8.82 protocol is version 78; the 2026 relaunch client still reports 78 [src:derived/survev@8715a605:client/js/app.js:77732] [src:kong/relaunch-client-bundle] [H]
- survev's protocol is 1028; it "started with 1000 to distinguish us from the original surviv protocol"; "the protocol we originated from was 78"; it is bumped whenever a serializer or the def list changes (fork) [src:survev/shared/gameConfig.ts:154-158] [H]
- The protocol number is the first field of the Join message (uint32) and is also sent to find_game as `version`; a mismatch returns `invalid_protocol` and the client shows the "new version available" refresh modal [src:survev/shared/net/joinMsg.ts:18-22] [src:survev/server/src/game/client.ts:117-135] [src:survev/server/src/gameServer.ts:51-54] [src:survev/client/src/main.ts:860-883] [H]
- Game type and map type ids are indices into the def registries in definition order (id 0 = ""), so any change to the def lists changes the protocol; survev has 756 game types (10-bit field, max 1024) and 1,071 map types (12-bit field, max 4096) [src:survev/shared/defs/register.ts:5-50] [src:survev/shared/net/net.ts:143-157] [src:derived/survev@8715a605:client/js/app.js:43144] [H]

## Transport and endpoints

| endpoint | protocol | purpose | sources |
|---|---|---|---|
| `POST /api/find_game` (original), `POST /api/find_game_v2` (survev; `/api/find_game` returns `invalid_protocol`) | HTTPS JSON | matchmaking, returns game server URL(s) + token | [src:derived/survev@8715a605:client/js/app.js:107596-107611] [src:survev/server/src/api/index.ts:94-192] [H] |
| `GET /api/site_info` | HTTPS JSON | modes, region player counts, featured streamers, captcha flag, theme | [src:survev/server/src/api/index.ts:87-89] [src:survev/server/src/api/apiServer.ts:78-97] [src:derived/survev@8715a605:client/js/app.js:49607] [H] |
| `ws(s)://<host>/play?gameId=<id>` (original), `ws(s)://<region-address>:<game port>/play` (survev) | WebSocket, binary | the game connection | [src:derived/survev@8715a605:client/js/app.js:107620-107632] [src:survev/server/src/gameServer.ts:41-49] [src:survev/server/src/game/gameProcess.ts:308-310] [H] |
| `wss://<host>/team_v2` | WebSocket, JSON | team lobby (see `ui/menus.md`) | [src:derived/survev@8715a605:client/js/app.js:51913] [src:survev/server/src/teamMenu.ts:403-405] [H] |
| `wss://<zone host>/ptc` | WebSocket, 1-byte echo | region ping test | [src:derived/survev@8715a605:client/js/app.js:105934] [src:survev/server/src/gameServer.ts:243-291] [H] |
- Game WebSockets use `binaryType = "arraybuffer"`; every frame is a sequence of messages (see framing) [src:survev/shared/net/connection.ts:42-60] [H]
- Original ping zones: na (sfo, mia, nyc, chi), sa (sao), eu (fra, waw), as (sgp, nrt, hkg); kr (sel) is commented out in the 0.8.82 client; each test sends a 1-byte message up to 6 times (`recvCountMax` 6) with 125 ms gaps and keeps the minimum round trip [src:derived/survev@8715a605:client/js/app.js:105800-105880] [src:survev/client/src/pingTest.ts:60-110] [H]
- Fandom's server list: NA (NYC, CHI, SFO), SA (SAO), EU (WAW, FRA), AS (VNM, SGP, NRT), KR (SEL); Miami and Narita removed around March 2020 [src:fandom/Servers] [M]

## Join flow

### Original 0.8.82 (client side)

- Body: `{version: 78, region, zones: [zones sorted by ping], playerCount: 1, autoFill: true, gameModeIdx}`; teams send the same via the team socket's `playGame` [src:derived/survev@8715a605:client/js/app.js:107552-107566] [H]
- Up to 2 POST attempts, 500 ms apart, 10 s timeout each; the response is `{res: [{zone, gameId, useHttps, hosts[], addrs[], data}]}` or `{err}` [src:derived/survev@8715a605:client/js/app.js:107587-107611] [H]
- The client tries each host as `ws(s)://<host>/play?gameId=<gameId>` in order; on open it sends Join with `matchPriv` = the `data` token plus the account's `loadoutPriv` and `questPriv` tokens [src:derived/survev@8715a605:client/js/app.js:107613-107640] [src:derived/survev@8715a605:client/js/app.js:43585-43614] [H]

### survev

- Client → API `POST /api/find_game_v2` `{region, zones, version, playerCount, autoFill, gameModeIdx, turnstileToken?}` [src:survev/shared/types/api.ts:5-13] [src:survev/client/src/main.ts:735-787] [H]
- API checks, in order: IP present, find_game rate limit, IP ban, session cookie (banned accounts play as guests), proxy/VPN check, mode enabled, Turnstile captcha for guests when enabled [src:survev/server/src/api/index.ts:98-162] [H]
- The API creates a random UUID join token, gathers player data (user id, loadout, quests) and POSTs `/api/find_game` to the region's game server with the shared `survev-api-key` header [src:survev/server/src/api/index.ts:119-179] [src:survev/server/src/api/apiServer.ts:20-49] [H]
- The game server rejects a wrong `version` or region, then picks the joinable process with the oldest start time for that map/team mode (joinable = `canJoin` or still creating, free slots > 0), or forks/reuses a process for a new game [src:survev/server/src/gameServer.ts:51-77] [src:survev/server/src/game/gameProcessManager.ts:283-323] [H]
- The process registers the token for 10 s; the response is `{type: "success", res: {joinToken, urls}}` or `{type: "error"|"banned", ...}` [src:survev/server/src/game/game.ts:378-398] [src:survev/shared/types/api.ts:69-83] [H]
- The client connects to each URL in turn and sends Join with the token, name, `useTouch`, `isMobile`, `bot` and the loadout ids; the server reads the uint32 protocol before decoding the rest so old clients get `invalid_protocol` instead of a decode error [src:survev/client/src/game.ts:145-172] [src:survev/server/src/game/client.ts:117-135] [H]
- Missing or expired tokens close the socket with `invalid_token`; spectate tokens (Discord bot / moderation) last 60 s [src:survev/server/src/game/client.ts:208-231] [src:survev/server/src/game/game.ts:400-406] [H]
- A game accepts joins while alive players < `maxPlayers` (80, or 100 in 50v50), not over, and less than 60 s after start [src:survev/server/src/game/game.ts:344-350] [src:survev/shared/defs/maps/baseDefs.ts:62-65] [H]
- On the first netsync after joining the client receives, in one frame: Joined, Map, AliveCounts, Update (with all player infos, gas state and kill leader) [src:survev/server/src/game/client.ts:451-490] [src:survev/server/src/game/client.ts:554-558] [src:survev/server/src/game/client.ts:694-698] [H]

## Message framing

- Each message is `uint8 type` + payload, padded to a byte boundary; a WebSocket frame may carry several messages and the reader loops until fewer than 8 bits remain (`MsgType.None`) [src:survev/shared/net/net.ts:249-267] [src:survev/client/src/game.ts:174-186] [src:derived/survev@8715a605:client/js/app.js:43182-43215] [H]
- Server frame per client per netsync: [Joined + Map, first frame only] → [AliveCounts, if changed] → Update → per-client queued messages (PlayerStats, GameOver, Pickup) → broadcast messages shared by all clients (Kill, RoleAnnouncement); UpdatePass is sent at once as its own frame (`sendInstantMsg`) [src:survev/server/src/game/client.ts:442-716] [src:survev/server/src/game/client.ts:276-278] [src:survev/server/src/game/client.ts:367-371] [src:survev/server/src/game/questManager.ts:97] [H]
- The Map message is serialized once per game into a cached stream and copied raw into each new client's first frame [src:survev/server/src/game/map.ts:400-403] [src:survev/server/src/game/client.ts:460-464] [H]
- Client messages are sent one per frame through a fresh `MsgStream` (128 bytes by default, 8192 for Join) [src:survev/client/src/game.ts:1598-1615] [src:survev/client/src/game.ts:172] [H]
- Server per-client stream buffer: 65,536 bytes; broadcast buffer: 4,096 bytes [src:survev/server/src/game/client.ts:344] [src:survev/server/src/game/client.ts:29] [H]

## Message types

| id | name | direction | in 0.8.82 | survev | sources |
|---|---|---|---|---|---|
| 0 | None | — | yes | end-of-frame marker | [src:survev/shared/net/net.ts:270-298] [src:derived/survev@8715a605:client/js/app.js:43557-43579] [H] |
| 1 | Join | C→S | yes | yes (fields changed) | [src:survev/shared/net/joinMsg.ts:18-37] [H] |
| 2 | Disconnect | S→C | yes (reason string) | unused (`_Disconnect`); reasons go in the WebSocket close frame | [src:survev/shared/net/net.ts:276] [src:derived/survev@8715a605:client/js/app.js:43620-43634] [H] |
| 3 | Input | C→S | yes | yes | [src:survev/shared/net/inputMsg.ts:28-52] [H] |
| 4 | Edit | C→S | class exists, empty | debug only (`allowEditMsg`) | [src:survev/shared/net/editMsg.ts:28-61] [src:survev/server/src/game/client.ts:160-163] [H] |
| 5 | Joined | S→C | yes | yes | [src:survev/shared/net/joinedMsg.ts:10-20] [H] |
| 6 | Update | S→C | yes | yes (extended) | [src:survev/shared/net/updateMsg.ts:299-498] [H] |
| 7 | Kill | S→C | yes | yes | [src:survev/shared/net/killMsg.ts:15-27] [H] |
| 8 | GameOver | S→C | yes | yes | [src:survev/shared/net/gameOverMsg.ts:11-24] [H] |
| 9 | Pickup | S→C | yes | yes | [src:survev/shared/net/pickupMsg.ts:8-13] [H] |
| 10 | Map | S→C | yes | yes (river/patch encoding changed) | [src:survev/shared/net/mapMsg.ts:107-132] [H] |
| 11 | Spectate | C→S | yes (4 flags) | yes (1-byte action) | [src:survev/shared/net/spectateMsg.ts:3-15] [src:derived/survev@8715a605:client/js/app.js:44323-44345] [H] |
| 12 | DropItem | C→S | yes | yes | [src:survev/shared/net/dropItemMsg.ts:7-10] [H] |
| 13 | Emote | C→S | yes | yes | [src:survev/shared/net/emoteMsg.ts:9-13] [H] |
| 14 | PlayerStats | S→C | yes | yes | [src:survev/shared/net/playerStatsMsg.ts:13-24] [H] |
| 15 | AdStatus | C→S | yes (ad-block / preroll flags) | unused | [src:derived/survev@8715a605:client/js/app.js:44375-44396] [src:survev/shared/net/net.ts:289] [H] |
| 16 | Loadout | C→S | yes (6 emotes + custom flag) | unused | [src:derived/survev@8715a605:client/js/app.js:44397-44412] [src:survev/shared/net/net.ts:290-291] [H] |
| 17 | RoleAnnouncement | S→C | yes | yes | [src:survev/shared/net/roleAnnouncementMsg.ts:10-18] [H] |
| 18 | Stats | S→C | yes (string, "anti-cheat") | client reads and ignores a string; server never sends | [src:derived/survev@8715a605:client/js/app.js:44413-44432] [src:survev/client/src/game.ts:1514-1517] [H] |
| 19 | UpdatePass | S→C | yes (empty) | yes (empty; triggers a pass refresh) | [src:survev/shared/net/net.ts:310-313] [src:survev/server/src/game/questManager.ts:97] [H] |
| 20 | AliveCounts | S→C | yes | yes | [src:survev/shared/net/aliveCountsMsg.ts:6-11] [H] |
| 21 | PerkModeRoleSelect | C→S | yes | yes | [src:survev/shared/net/perkModeRoleSelectMsg.ts:6-9] [H] |
- The relaunch bundle has the same table: Join 1, Disconnect 2, Input 3, Edit 4, Joined 5, Update 6, Kill 7, GameOver 8, Pickup 9, Map 10, Spectate 11, DropItem 12, Emote 13, PlayerStats 14, AdStatus 15, Loadout 16, RoleAnnouncement 17, Stats 18, UpdatePass 19, AliveCounts 20, PerkModeRoleSelect 21 [src:kong/relaunch-client-bundle] [H]
- Kill and RoleAnnouncement go to every client in the game regardless of distance; PlayerStats/GameOver go to the dying player (and GameOver also to their spectators) [src:survev/server/src/game/objects/player.ts:2628] [src:survev/server/src/game/objects/player.ts:2847] [src:survev/server/src/game/objects/player.ts:2555-2576] [H]

## Bit stream encoding

- `BitStream` is a TypeScript port of inolen/bit-buffer, little-endian only, writing bit by bit; booleans are 1 bit, `uint8/16/32`, `int*` and `float32/64` are written at the current bit offset (not aligned) [src:survev/shared/lib/bitBuffer.ts:1-9] [src:survev/shared/lib/bitBuffer.ts:435-453] [H]
- Quantized float: `writeFloat(f, min, max, bits)` writes `floor(((clamp(f) − min)/(max − min))·(2^bits − 1) + 0.5)`; reading returns `min + v/(2^bits − 1)·(max − min)` [src:survev/shared/net/net.ts:55-77] [src:derived/survev@8715a605:client/js/app.js:43051-43062] [H]
- `writeVec` = two quantized floats; `writeMapPos` = 16 bits per axis over 0–1024 (step ≈ 0.0156 units); `writeUnitVec` = two floats over ±1.0001 [src:survev/shared/net/net.ts:79-112] [H]
- `writeGameType` = 10-bit id; `writeMapType` = 12-bit id [src:survev/shared/net/net.ts:143-157] [src:derived/survev@8715a605:client/js/app.js:43144] [H]
- Strings are ASCII, one byte per char, NUL-terminated; fixed-length strings (player name 16, map name 24) are padded with NULs [src:survev/shared/lib/bitBuffer.ts:266-303] [src:survev/shared/lib/bitBuffer.ts:417-424] [src:survev/shared/net/net.ts:12-13] [H]
- Arrays: length in N bits followed by items (N = 8 for most lists, 16 for map objects and update object lists, 4 for inputs and map indicators) [src:survev/shared/net/net.ts:159-190] [H]
- `writeAlignToNextByte` pads with zero bits; messages and many sub-records end aligned [src:survev/shared/net/net.ts:133-141] [H]
- Constants: MaxPosition 1024, MapNameMaxLen 24, PlayerNameMaxLen 16, MouseMaxDist 64, SmokeMaxRad 10, ActionMaxDuration 8.5, AirstrikeZoneMaxRad 256, AirstrikeZoneMaxDuration 60, PlayerMinScale 0.75, PlayerMaxScale 2, MapObjectMinScale 0.125, MapObjectMaxScale 2.5, MaxPerks 8, MaxMapIndicators 16 (same in 0.8.82) [src:survev/shared/net/net.ts:10-25] [src:derived/survev@8715a605:client/js/app.js:43219-43233] [H]

## Client → server messages

| message | fields in order (bits) | sources |
|---|---|---|
| Join (survev) | protocol u32, joinToken string, name string(16), useTouch b, isMobile b, bot b, outfit/melee/heal/boost game types (10 each), emotes array(8) of game types | [src:survev/shared/net/joinMsg.ts:18-37] [H] |
| Join (0.8.82) | protocol u32, matchPriv string, loadoutPriv string, questPriv string, name string(16), useTouch b, isMobile b, proxy b, otherProxy b, bot b, align | [src:derived/survev@8715a605:client/js/app.js:43583-43615] [H] |
| Input | seq u8, moveLeft/Right/Up/Down b×4, shootStart b, shootHold b, portrait b, touchMoveActive b, [touchMoveDir unitVec 8+8, touchMoveLen u8], toMouseDir unitVec 10+10, toMouseLen float 0–64 (8), inputs array(4) of u8, useItem game type (0.8.82 then pads 6 bits) | [src:survev/shared/net/inputMsg.ts:28-52] [src:derived/survev@8715a605:client/js/app.js:43672-43698] [H] |
| Emote | pos vec 0–1024 (16+16), type game type, isPing b (0.8.82 pads 5 bits) | [src:survev/shared/net/emoteMsg.ts:9-13] [src:derived/survev@8715a605:client/js/app.js:43750-43770] [H] |
| DropItem | item game type, weapIdx u8 | [src:survev/shared/net/dropItemMsg.ts:7-10] [src:derived/survev@8715a605:client/js/app.js:43705-43718] [H] |
| Spectate (survev) | action u8: None 0, Begin 1, Next 2, Prev 3 | [src:survev/shared/net/spectateMsg.ts:3-15] [H] |
| Spectate (0.8.82) | specBegin b, specNext b, specPrev b, specForce b, 4 pad bits | [src:derived/survev@8715a605:client/js/app.js:44323-44345] [H] |
| PerkModeRoleSelect | role game type, 6 pad bits | [src:survev/shared/net/perkModeRoleSelectMsg.ts:6-9] [src:derived/survev@8715a605:client/js/app.js:43720-43735] [H] |
| Edit (survev debug) | zoom (b + u8), speed (b + f32), gameSpeed (b + f32), new map seed (b + u32), spawnLootType, promote role (b + type), toggleLayer, noClip, teleportToPings, godMode, moveObjs, preventGameStart (b each) | [src:survev/shared/net/editMsg.ts:28-61] [H] |
| AdStatus (0.8.82) | blocked b, prerollLoaded b, prerollFreestar b, prerollAIP b, 4 pad bits | [src:derived/survev@8715a605:client/js/app.js:44375-44396] [H] |
| Loadout (0.8.82) | 6 emote game types, custom u8, align | [src:derived/survev@8715a605:client/js/app.js:44397-44412] [H] |
- The client adds at most 7 discrete inputs per message although the 4-bit length allows 15 [src:survev/shared/net/inputMsg.ts:22-26] [src:derived/survev@8715a605:client/js/app.js:43660] [H]
- The server takes `dirNew` from `toMouseDir`, latches `shootStart` until processed, applies discrete inputs in order and then `useItem`; `seq` is echoed back as `ack` [src:survev/server/src/game/objects/player.ts:3357-3385] [src:survev/server/src/game/client.ts:719-727] [H]

## Server → client messages

| message | fields in order (bits) | sources |
|---|---|---|
| Joined | teamMode u8 (1/2/4), playerId u16, started b, emotes array(8) of game types | [src:survev/shared/net/joinedMsg.ts:10-20] [src:derived/survev@8715a605:client/js/app.js:43760-43790] [H] |
| Map | mapName string(24), seed u32, width u16, height u16, shoreInset u16, grassInset u16, rivers array(8), places array(8), objects array(16), groundPatches array(8) | [src:survev/shared/net/mapMsg.ts:107-132] [src:derived/survev@8715a605:client/js/app.js:43791-43855] [H] |
| Map river | survev: width u8, looped u8, points array(8) of mapPos; 0.8.82: width f32, looped u8, points (u8 count) | [src:survev/shared/net/mapMsg.ts:7-14] [src:derived/survev@8715a605:client/js/app.js:42970-42977] [H] |
| Map place | name string, pos vec 0–1 (16+16) (0.8.82 read it as 0–1024) | [src:survev/shared/net/mapMsg.ts:26-29] [src:derived/survev@8715a605:client/js/app.js:42978-42981] [H] |
| Map object | pos mapPos, scale float 0.125–2.5 (8), map type (12), ori (2), align | [src:survev/shared/net/mapMsg.ts:74-81] [src:derived/survev@8715a605:client/js/app.js:42992-43001] [H] |
| Map ground patch | survev: collider (u8 type + circle or AABB); 0.8.82: AABB min/max; then color u32, roughness f32, offsetDist f32, order (7), useAsMapShape b | [src:survev/shared/net/mapMsg.ts:47-54] [src:derived/survev@8715a605:client/js/app.js:42983-42989] [H] |
| Kill | damageType u8, itemSourceType game type, mapSourceType map type, targetId u16, killerId u16, killCreditId u16, killerKills u8, downed b, killed b | [src:survev/shared/net/killMsg.ts:15-27] [src:derived/survev@8715a605:client/js/app.js:44199-44233] [H] |
| PlayerStats | playerId u16, timeAlive u16 (s), kills u8, dead u8, damageDealt u16, damageTaken u16 | [src:survev/shared/net/playerStatsMsg.ts:13-24] [src:derived/survev@8715a605:client/js/app.js:44234-44258] [H] |
| GameOver | teamId u8, teamRank u8, gameOver u8, winningTeamId u8, playerStats array(8) | [src:survev/shared/net/gameOverMsg.ts:11-24] [src:derived/survev@8715a605:client/js/app.js:44259-44292] [H] |
| Pickup | type u8 (Full 0, AlreadyOwned 1, AlreadyEquipped 2, BetterItemEquipped 3, Success 4, GunCannotFire 5; survev adds MaxPerks 6), item game type, count u8 | [src:survev/shared/net/pickupMsg.ts:8-13] [src:survev/shared/net/net.ts:300-308] [src:derived/survev@8715a605:client/js/app.js:44293-44330] [H] |
| RoleAnnouncement | playerId u16, killerId u16, role game type, assigned b, killed b | [src:survev/shared/net/roleAnnouncementMsg.ts:10-18] [src:derived/survev@8715a605:client/js/app.js:44348-44373] [H] |
| AliveCounts | teamAliveCounts array(8) of u8 (1 entry, or 2 in 50v50) | [src:survev/shared/net/aliveCountsMsg.ts:6-11] [src:survev/server/src/game/gameModeManager.ts:139-152] [H] |
| Disconnect (0.8.82) | reason string | [src:derived/survev@8715a605:client/js/app.js:43620-43634] [H] |
- DamageType values: Player 0, Bleeding 1, Gas 2, Airdrop 3, Airstrike 4 [src:survev/shared/gameConfig.ts:25-31] [src:derived/survev@8715a605:client/js/app.js:77789-77795] [H]
- Integer stats are truncated, so survev rounds damage before writing (99.99 would otherwise show as 99) [src:survev/shared/net/playerStatsMsg.ts:19-22] [H]

## Update message

- Layout: `flags u16` (written last), then optional sections in this order [src:survev/shared/net/updateMsg.ts:299-498] [src:derived/survev@8715a605:client/js/app.js:43874-44192] [H]

| flag bit | section | encoding | sources |
|---|---|---|---|
| 0 `DeletedObjects` | object ids that left view or died | array(16) of u16 | [src:survev/shared/net/updateMsg.ts:305-311] [H] |
| 1 `FullObjects` | new or fully dirty objects | array(16) of {type u8, id u16, partial, align, full, align} | [src:survev/shared/net/updateMsg.ts:313-320] [src:survev/shared/net/updateMsg.ts:513-527] [H] |
| (always) | partially dirty objects | array(16) of {type u8 (survev only), id u16, partial, align} | [src:survev/shared/net/updateMsg.ts:322-324] [src:survev/shared/net/updateMsg.ts:529-540] [H] |
| 2 `ActivePlayerId` | id of the player the camera follows (changes when spectating) | u16 | [src:survev/shared/net/updateMsg.ts:326-329] [H] |
| (always) | active player data | per-field dirty bit + value, then align (see below) | [src:survev/shared/net/updateMsg.ts:11-53] [H] |
| 3 `Gas` | gas stage | mode u8 (Inactive 0, Waiting 1, Moving 2), duration f32, posOld/posNew mapPos, radOld/radNew float 0–2048 (16) | [src:survev/shared/net/updateMsg.ts:211-218] [src:survev/shared/gameConfig.ts:43-47] [H] |
| 4 `GasCircle` | gas interpolation t | float 0–1 (16) | [src:survev/shared/net/updateMsg.ts:338-341] [H] |
| 5 `PlayerInfos` | new players | array(8) of {playerId u16, teamId u8, groupId u8, name string, heal type, boost type, align} | [src:survev/shared/net/updateMsg.ts:179-189] [H] |
| 6 `DeletePlayerIds` | removed players | array(8) of u16 | [src:survev/shared/net/updateMsg.ts:351-357] [H] |
| 7 `PlayerStatus` | team/minimap positions | array(8) of {hasData b, [pos mapPos 11+11 bits, visible b, dead b, downed b, hasRole b, [role type]]}, align | [src:survev/shared/net/updateMsg.ts:107-125] [H] |
| 8 `GroupStatus` | group health | array(8) of {health float 0–100 (7), disconnected b} | [src:survev/shared/net/updateMsg.ts:151-156] [H] |
| 9 `Bullets` | new bullets near the viewer | array(8) of bullet records, align | [src:survev/shared/net/updateMsg.ts:369-414] [H] |
| 10 `Explosions` | new explosions | array(8) of {pos mapPos, type game type, layer (2), align} | [src:survev/shared/net/updateMsg.ts:416-425] [H] |
| 11 `Emotes` | emotes and pings | array(8) of {playerId u16, type, itemType, isPing b, [pos mapPos], align} | [src:survev/shared/net/updateMsg.ts:427-441] [H] |
| 12 `Planes` | airdrop/airstrike planes in view | array(8) of {id u8, pos vec (10+10), dir unitVec 8, actionComplete b, action (3)} | [src:survev/shared/net/updateMsg.ts:443-460] [H] |
| 13 `AirstrikeZones` | new airstrike zones | array(8) of {pos mapPos 12+12, rad float 0–256 (8), duration float 0–60 (8)}, align | [src:survev/shared/net/updateMsg.ts:462-471] [H] |
| 14 `MapIndicators` | woods king helmet, the hunted, etc. | array(4) of {id (4), dead b, equipped b, type, pos mapPos}, align | [src:survev/shared/net/updateMsg.ts:473-484] [H] |
| 15 `KillLeader` | kill leader | id u16, kills u8 | [src:survev/shared/net/updateMsg.ts:486-490] [H] |
| (always, last) | ack | u8 = last input `seq` received | [src:survev/shared/net/updateMsg.ts:492] [src:derived/survev@8715a605:client/js/app.js:44192] [H] |
- Active player data: health (b + float 0–100, 8), boost (b + float 0–100, 8), zoom (b + u8 radius), action (b + time float 0–8.5 (8), duration float 0–8.5 (8), targetId u16), inventory (b + scope type + for each of the 25 `bagSizes` keys: has b + count (9)), weapons (b + curWeapIdx (2) + 4×{type, ammo u8}), spectatorCount (b + u8), align — identical in 0.8.82 [src:survev/shared/net/updateMsg.ts:11-53] [src:survev/shared/gameConfig.ts:415-441] [src:derived/survev@8715a605:client/js/app.js:42877-42935] [H]
- Bullet record: playerId u16, startPos mapPos, dir unitVec 8, bulletType, layer (2), varianceT float 0–1 (4), distAdjIdx (4), clipDistance b [+ distance float 0–1024 (16)], shotFx b [+ shotSourceType, shotOffhand b, lastShot b], reflected b [+ reflectCount (2), reflectObjId u16], hasSpecialFx b [+ flags] [src:survev/shared/net/updateMsg.ts:369-410] [src:derived/survev@8715a605:client/js/app.js:44010-44075] [H]
- Bullet differences: 0.8.82 special-fx flags are shotAlt, splinter, trailSaturated, trailSmall, trailThick (5 bits); survev inserts apRounds, highVelocity, combatStims and adds a `hasModifier` block (speedMult, distanceMult floats 0.5–2, 8 bits each) (fork) [src:derived/survev@8715a605:client/js/app.js:44058-44072] [src:survev/shared/net/updateMsg.ts:393-409] [H]
- Plane position range: 0.8.82 reads a 10-bit vec over 0–2048 and subtracts 512 (−512…1536, 2-unit steps); survev writes −256…1280 (fork) [src:derived/survev@8715a605:client/js/app.js:44119-44135] [src:survev/shared/net/updateMsg.ts:446-453] [H]
- Emote records in 0.8.82 end with 3 pad bits instead of an align; map-indicator count is a u8 in 0.8.82 vs 4 bits in survev [src:derived/survev@8715a605:client/js/app.js:44095-44112] [src:derived/survev@8715a605:client/js/app.js:44165-44183] [src:survev/shared/net/updateMsg.ts:473-484] [H]
- PlayerStatus is sent every 0.25 s (0.5 s in faction mode) or when the active player changes, and contains only your group (team modes) or all players (50v50; enemies only while revealed); solo sends none [src:survev/shared/net/updateMsg.ts:726-731] [src:survev/server/src/game/client.ts:558-565] [src:survev/server/src/game/gameModeManager.ts:172-181] [src:derived/survev@8715a605:client/js/app.js:42866] [H]

## Object serialization

- Object types: Invalid 0, Player 1, Obstacle 2, Loot 3, LootSpawner 4 (unused), DeadBody 5, Building 6, Structure 7, Decal 8, Projectile 9, Smoke 10, Airdrop 11 [src:survev/shared/net/objectSerializeFns.ts:5-18] [H]
- Every networked object has a partial part (changes often) and a full part (changes rarely); a full update always carries both [src:survev/shared/net/objectSerializeFns.ts:182-192] [src:survev/server/src/game/objects/gameObject.ts:231-249] [H]

| type | partial | full | sources |
|---|---|---|---|
| Player | pos mapPos, dir unitVec 8 (6 bytes) | outfit, backpack, helmet, chest, activeWeapon (types), layer (2), dead b, downed b, animType (4 in survev / 3 in 0.8.82), animSeq (3), actionType (3), actionSeq (3), wearingPan b, healEffect b, lastStandEffect b (survev), frozen b [+ frozenOri (2) + frozenType (survev)], haste b [+ type (2/3), seq (3)], actionItem b [+ type], scale b [+ float 0.75–2 (8)], role b [+ type], perks b [+ array(3) of {type, droppable b}] | [src:survev/shared/net/objectSerializeFns.ts:193-330] [src:derived/survev@8715a605:client/js/app.js:43236-43298] [H] |
| Obstacle | pos mapPos, ori (2), scale float 0.125–2.5 (8) (0.8.82 + 6 pad bits) | healthT float 0–1 (8), map type, layer (2), dead b, isDoor b [+ open, canUse, locked b, seq (5)], isButton b [+ onOff, canUse b, seq (6)], isPuzzlePiece b [+ parentBuildingId u16], isSkin b [+ skinPlayerId u16] | [src:survev/shared/net/objectSerializeFns.ts:331-411] [src:derived/survev@8715a605:client/js/app.js:43299-43349] [H] |
| Building | ceilingDead b, occupied b, ceilingDamaged b, hasPuzzle b [+ solved b, errSeq (7)] | pos mapPos, map type, ori (2), layer (2) | [src:survev/shared/net/objectSerializeFns.ts:412-452] [src:derived/survev@8715a605:client/js/app.js:43350-43371] [H] |
| Structure | — | pos mapPos, map type, ori (2), interiorSoundEnabled b, interiorSoundAlt b, 2 × layerObjId u16 | [src:survev/shared/net/objectSerializeFns.ts:453-483] [H] |
| Loot | pos mapPos | type, count u8, layer (2), isOld b, isPreloadedGun b, hasOwner b [+ ownerId u16] | [src:survev/shared/net/objectSerializeFns.ts:503-537] [src:derived/survev@8715a605:client/js/app.js:43416-43445] [H] |
| DeadBody | pos mapPos | layer u8, playerId u16 | [src:survev/shared/net/objectSerializeFns.ts:538-558] [H] |
| Decal | — | pos mapPos, scale (8), map type, ori (2), layer (2), goreKills u8 | [src:survev/shared/net/objectSerializeFns.ts:559-592] [H] |
| Projectile | pos mapPos, posZ float 0–5 (10), dir unitVec 7 | type, layer (2) | [src:survev/shared/net/objectSerializeFns.ts:593-617] [H] |
| Smoke | pos mapPos, rad float 0–10 (8) | layer (2), interior (6) | [src:survev/shared/net/objectSerializeFns.ts:618-640] [H] |
| Airdrop | fallT float 0–1 (7), landed b | pos mapPos | [src:survev/shared/net/objectSerializeFns.ts:641-661] [H] |
- In 0.8.82 partial updates carried only `id u16` and the client looked the type up from its own object table; survev added a `type u8` byte to every partial record in commit `76372e44` (2026-04-03, "workaround updateMsg partDirty issues") and checks it against the client's object (fork) [src:derived/survev@8715a605:client/js/app.js:43947-43956] [src:survev/server/src/game/objects/gameObject.ts:209-229] [src:survev/client/src/game.ts:1129-1146] [src:derived/survev-git-76372e44] [H]
- The 0.8.82 Player full record has no `lastStandEffect` and no `frozenType`, always writes `frozenOri`, and uses 3-bit anim and haste fields; survev's `Anim` enum adds DeployMelee and IdleMelee (fork) [src:derived/survev@8715a605:client/js/app.js:43256-43298] [src:survev/shared/gameConfig.ts:12-23] [src:derived/survev@8715a605:client/js/app.js:77803-77812] [H]
- Object ids are u16 (max 65,535); survev pre-allocates id pools for players (128), loot (256), dead bodies (128), decals (256), projectiles (128), smoke (64) and airdrops (64) for reuse once fresh ids run out [src:survev/server/src/game/objects/gameObject.ts:53-108] [H]

## Dirty tracking

- Objects call `setDirty()` (full) or `setPartDirty()` (partial); the register keeps `dirtyFull`/`dirtyPart` flag arrays indexed by id [src:survev/server/src/game/objects/gameObject.ts:58-62] [src:survev/server/src/game/objects/gameObject.ts:251-257] [H]
- Once per netsync, `serializeObjs` re-serializes each dirty object once into its own cached partial/full streams; all clients copy those bytes, so serialization cost does not grow with the number of viewers [src:survev/server/src/game/objects/gameObject.ts:149-160] [src:survev/shared/net/updateMsg.ts:313-324] [H]
- After sending, `flush` unregisters deleted objects and clears all dirty flags, new-bullet/explosion/emote lists and gas dirty flags [src:survev/server/src/game/game.ts:311-322] [src:survev/server/src/game/objects/gameObject.ts:162-169] [H]
- Newly registered objects start fully dirty [src:survev/server/src/game/objects/gameObject.ts:115-127] [H]

## Visibility culling (survev)

- The view box is centred on the player (or spectated player): half-width = culling zoom + 4 units, half-height = that / (16/9); width and height swap for portrait clients after a 0.5 s delay [src:survev/server/src/game/client.ts:486-497] [src:survev/server/src/game/client.ts:719-724] [H]
- The culling zoom follows the player's zoom radius with a lerp at rate 4 per second (snaps within 0.1) [src:survev/server/src/game/client.ts:427-432] [H]
- Objects intersecting the box are found with the grid; objects that left the box are deleted on the client; objects new to the client or fully dirty are sent full, partially dirty ones partial; the active player is always included because the client crashes without it [src:survev/server/src/game/client.ts:498-518] [H]
- Bullets are sent if their start or client end point is within 1.1 × the view radius or their path crosses that circle; explosions within explosion radius + 1.1 × view radius; planes when inside the view box and inside the plane bounds; airstrike zones and map indicators go to everyone [src:survev/server/src/game/client.ts:634-696] [H]
- Emote rules: regular emotes go to clients that can see the emoter; team-only emotes and player pings to the same group; team emotes to the same team; faction leader/captain/last-man pings to the whole team; map-event pings to everyone [src:survev/server/src/game/client.ts:584-630] [H]
- Player info (name, team, group, heal/boost cosmetics) for every player goes to new clients, and new players are announced to everyone [src:survev/server/src/game/client.ts:554-558] [H]

## Rates and timing

- survev runs the simulation at 100 ticks/s (`gameTps`) and sends network updates at 33 per second (`netSyncTps`) on separate timers; state changes between netsyncs accumulate into the next update [src:survev/config.ts:40-41] [src:survev/configType.ts:153-164] [src:survev/server/src/game/gameProcess.ts:252-258] [H]
- Simulation dt is real elapsed time clamped to 0.001–0.125 s [src:survev/server/src/game/game.ts:164-166] [H]
- survev history: the first server prototype ran at `tps: 30`; game tick and net sync were split on 2024-06-30 (fork reconstruction, not original data) [src:derived/survev@9f64948d:src/config.ts:30-31] [src:derived/survev-git-dc008638] [L]
- The client sends an InputMsg when input changed or after 1 s, with `seq` incremented (mod 256) only when no earlier seq is still unacknowledged; RTT = time until an Update with `ack == seq` arrives [src:survev/client/src/game.ts:731-771] [src:survev/client/src/game.ts:1057-1070] [src:derived/survev@8715a605:client/js/app.js:78612-78624] [src:derived/survev@8715a605:client/js/app.js:78929-78933] [H]
- No client-side prediction: the local player is drawn where the server says, so input latency equals the round trip (namu: about 0.3 s on far servers) [src:survev/client/src/objects/player.ts:795-820] [src:namu/Surviv.io] [M]
- The 0.8.82 client applies positions as they arrive (no entity interpolation); survev added client interpolation in commit `cb16c592` (2025-03-04, default on since `d26c0569`) using the measured interval between updates, and an optional local-rotation mode in `8471b2b8` (2025-07-05) (fork) [src:derived/survev@8715a605:client/js/app.js:78929-78933] [src:survev/client/src/game.ts:1071-1075] [src:survev/client/src/objects/player.ts:799-820] [src:derived/survev-git-cb16c592] [src:derived/survev-git-d26c0569] [src:derived/survev-git-8471b2b8] [H]
- The 0.8.82 client already interpolated teammate minimap positions (`posInterp`) [src:derived/survev@8715a605:client/js/app.js:81527-81538] [H]
- Player status for team HUD: every 0.25 s (0.5 s in faction mode), same constant in 0.8.82 [src:survev/shared/net/updateMsg.ts:726-731] [src:derived/survev@8715a605:client/js/app.js:42866] [H]

## Limits and rate limits (survev)

| limit | value | sources |
|---|---|---|
| game WebSocket max incoming message | 1,024 bytes | [src:survev/server/src/game/gameProcess.ts:308-310] [H] |
| game WebSocket idle timeout | 30 s | [src:survev/server/src/game/gameProcess.ts:309] [H] |
| game WebSocket messages | 500 per second per socket, else closed with `rate_limited` | [src:survev/server/src/game/gameProcess.ts:306] [src:survev/server/src/game/gameProcess.ts:395-399] [H] |
| game WebSocket connections | 5 simultaneous per IP; upgrades 5 per second per IP (HTTP 429) | [src:survev/server/src/game/gameProcess.ts:305-306] [src:survev/server/src/game/gameProcess.ts:334-344] [H] |
| players per game from one source | 5 per IP, find-game IP or account | [src:survev/server/src/game/client.ts:55-66] [H] |
| `find_game_v2` | 5 requests per 3 s per IP | [src:survev/server/src/api/index.ts:92] [src:survev/server/src/api/index.ts:105-107] [H] |
| team socket | 50 msgs/s, 5 connections per IP, upgrades 5 per 2 s | [src:survev/server/src/teamMenu.ts:400-401] [H] |
| ping socket `/ptc` | payload ≤ 2 bytes, idle 10 s, 50 msgs/s, 10 connections, 1 upgrade per 3 s per IP | [src:survev/server/src/gameServer.ts:235-247] [H] |
| `report_error` | 5 per minute | [src:survev/server/src/api/index.ts:194] [H] |
| join token / spectate token TTL | 10 s / 60 s | [src:survev/server/src/game/game.ts:388] [src:survev/server/src/game/game.ts:403] [H] |
| rate limits switch | `rateLimitsEnabled` (on in production only) | [src:survev/config.ts:65] [src:survev/server/src/utils/rateLimit.ts:41-49] [H] |
- Rate limiting uses coarse per-interval counters (a counter per IP or socket reset each interval) [src:survev/server/src/utils/rateLimit.ts:5-135] [H]
- IP bans and proxy/VPN detection (proxycheck.io key) are checked at WebSocket upgrade and at find_game; bad packets close the socket with `invalid_packet` [src:survev/server/src/game/gameProcess.ts:346-354] [src:survev/server/src/game/client.ts:186-199] [src:survev/configType.ts:286-289] [H]
- Close reasons (WebSocket close code 3000 + reason): behind_proxy, full, host_closed, invalid_packet, invalid_protocol, invalid_token, ip_banned, player_not_found, rate_limited, server_crashed, server_restart [src:survev/shared/types/api.ts:56-67] [src:survev/server/src/game/gameProcess.ts:291-295] [H]
- Edit messages are ignored unless `debug.allowEditMsg` (dev builds) [src:survev/server/src/game/client.ts:160-163] [src:survev/config.ts:70] [H]
- Client-side find-game throttle: repeated Play presses within 30 s wait `min(2.5 s × attempts, 7.5 s)` (same in 0.8.82) [src:survev/client/src/main.ts:670-680] [src:derived/survev@8715a605:client/js/app.js:107545-107551] [H]

## Conflicts

- CONFLICT net-tick-rate: survev sends 33 updates/s from a 100 Hz simulation [src:survev/config.ts:40-41] vs no original figure exists; survev's own first prototype used 30 tps [src:derived/survev@9f64948d:src/config.ts:30-31]; proposed: keep 100/33 as config knobs [L]
- CONFLICT partial-type-byte: 0.8.82 partial object records have no type byte [src:derived/survev@8715a605:client/js/app.js:43947-43956] vs survev writes `type u8` before the id [src:survev/server/src/game/objects/gameObject.ts:218-221]; proposed: follow 0.8.82 only if wire compatibility with the original/relaunch client matters, otherwise keep survev's safer form [L]
- CONFLICT join-auth: 0.8.82 Join carries API-signed `matchPriv`/`loadoutPriv`/`questPriv` strings [src:derived/survev@8715a605:client/js/app.js:43583-43615] vs survev carries one `joinToken` plus raw loadout ids [src:survev/shared/net/joinMsg.ts:18-37]; proposed: survev scheme [L]
- CONFLICT client-interpolation: 0.8.82 has no entity interpolation [src:derived/survev@8715a605:client/js/app.js:78929-78933] vs survev interpolates by default [src:survev/client/src/config.ts:100]; proposed: interpolation on as an optional setting (it does not change gameplay) [L]
- CONFLICT bullet-fx-bits: 0.8.82 bullet special-fx has 5 flags and no modifier block [src:derived/survev@8715a605:client/js/app.js:44058-44072] vs survev 8 flags + speed/distance multipliers [src:survev/shared/net/updateMsg.ts:393-409]; proposed: 0.8.82 layout for the target, survev fields only with fork perks [L]

## Open questions

- The original server's snapshot rate, culling box size and bullet culling rules are unknown; survev's values (33 Hz, zoom + 4 units, 16:9 box) are reconstructions [src:survev/server/src/game/client.ts:486-497] [src:survev/config.ts:40-41] [L]
- The 0.8.82 client reads map places as 0–1024 vectors while survev writes them as 0–1 normalised positions; which the original server used needs a capture of a real Map message [src:derived/survev@8715a605:client/js/app.js:42978-42981] [src:survev/shared/net/mapMsg.ts:26-29] [L]
- Whether the original server used `isMobile`/`useTouch` for anything beyond the zoom table (auto-loot, separate matchmaking) cannot be read from the client [src:derived/survev@8715a605:client/js/app.js:43583-43615] [src:fandom/Surviv.io_Mobile] [L]
