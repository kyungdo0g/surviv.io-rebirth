# Deploying surviv.io rebirth

One Node process runs everything: the HTTP API, the game and party WebSockets, the game loop and the static client.
There is no build step for the server (Node 22.18+ runs the TypeScript sources directly); only the client is built
with Vite.

- [Run it locally](#run-it-locally)
- [Docker](#docker)
- [Environment variables](#environment-variables)
- [Reverse proxy, TLS and WebSockets](#reverse-proxy-tls-and-websockets)
- [Regions: Korea and Asia](#regions-korea-and-asia)
- [Moderation: reports, bans, name filter](#moderation-reports-bans-name-filter)
- [Anti-cheat telemetry](#anti-cheat-telemetry)
- [Admin API](#admin-api)
- [Bundle budget](#bundle-budget)
- [Operations](#operations)

## Run it locally

```sh
pnpm install
pnpm survev:fetch                  # the original art and audio (not in the repository): needed for any sound
pnpm assets                        # run again after every pull: it installs the new guns' icons and sounds too
pnpm start                         # builds the client, then serves it and the game on http://127.0.0.1:8001
```

`pnpm start` is `pnpm build && node apps/server/src/index.ts`; set variables in front of it
(`HOST=0.0.0.0 BOT_FILL=40 pnpm start`; PowerShell and cmd.exe set them first, see the README's "Environment variables
on Windows"). Every package script runs in cmd.exe, PowerShell and POSIX shells alike. Without `pnpm assets` the client
runs with placeholder graphics and no sound.
The served client opens the offline sandbox at `/`; players start from `/?menu=1` (the start page with the play
buttons and the party lobby).
`pnpm survev:fetch` clones survev at the pinned commit into `.survev` and extracts the original client definitions
into `research-cache/` (needs git and network access to github.com and surviv.io).

The owner's art and sound for the new guns (beta) live in the gitignored `assets-user/` (copy that folder into the
repository root; git never brings it): the line-art sheets in `assets-user/source/2026-10-07-sheets/`, the
second-wave sheets in `assets-user/source/2026-10-10-sheets/` (exactly these file names: `second-wave-icons.webp`, the
loot icons of the eleven second-wave guns plus the Molotov and the flashbang, `second-wave-decals.png`, the
throwables' and launchers' decals, and the top-down held sprites `second-wave-topdown.png` and
`second-wave-topdown-alt.webp`) and the recorded clips in `assets-user/audio/guns/` (see its `MANIFEST.md`). Run `pnpm assets` after every pull: it installs them last
(`tools/assets/newGuns.ts`): it cuts each gun's loot icon out of the sheets (label removed, white background made
transparent, fitted like the original icons) and levels each clip to the original guns of its class (reload clips are
fitted to the reload time). Reading the WebP sheets and levelling the clips need `ffmpeg` and `ffprobe` on the PATH
(Windows: `winget install ffmpeg`, then a new terminal); without them the clips are copied as they are. Whatever is
missing gets a stand-in, so the game never shows a placeholder or plays nothing for them: the launchers our own drawn
icons, the other guns an original gun's icon of the same class, and an original gun's sound of the same kind. The last
lines of the output say what came from where (also `apps/client/public/assets/rebirth-new-guns.json`) and warn when
`assets-user/` or ffmpeg is missing. After adding or changing files there, `node tools/assets/newGuns.ts` reinstalls
just those.

## Docker

```sh
docker build -t surviv-rebirth .                                     # no original art: placeholders
docker build --build-arg WITH_ORIGINAL_ASSETS=1 -t surviv-rebirth .  # runs pnpm survev:fetch && pnpm assets in the build
docker run -d -p 8001:8001 -v rebirth-data:/app/data -e ADMIN_TOKEN=change-me-to-a-long-secret surviv-rebirth
```

or with compose (`docker-compose.yml`; every variable below can be set in the shell or an `.env` file):

```sh
ADMIN_TOKEN=$(openssl rand -hex 24) BOT_FILL=40 docker compose up -d --build
WITH_ORIGINAL_ASSETS=1 docker compose build   # image with the original art
```

The `Dockerfile` has four stages: `manifests` (workspace `package.json` files and the lockfile, so dependency layers
are cached), `build` (`pnpm install --frozen-lockfile`, optional art, `pnpm build`), `prod-deps`
(`pnpm install --prod --filter "@rebirth/server..."`) and `runtime` (node_modules trees, the workspace sources, the
server and `apps/client/dist`; runs as `node`, `HOST=0.0.0.0`, `PORT=8001`, a `/health` health check, `/app/data` as
a volume for reports, bans and flags).

The original art is **never** copied from the build context (`.dockerignore` excludes `apps/client/public/assets`, so
a developer checkout with art still produces an image without it). `WITH_ORIGINAL_ASSETS=1` fetches it inside the
build (and installs `ffmpeg` there, so the new guns' loot icons are cut from `assets-user/` when the build context has
it); mind that the original art is not redistributable, so do not push such an image to a public registry.

Behind a TLS-intercepting proxy, build a base image that trusts your CA and pass it in:
`docker build --build-arg NODE_IMAGE=my-node-with-ca:22 .` (the image must be Node 22.18+ on Debian; set
`NODE_EXTRA_CA_CERTS` in it).

## Environment variables

Empty values count as unset. Booleans take `1`, `0`, `true` or `false`. Relative paths are relative to the working
directory (`/app` in the image).

### Network

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8001` | HTTP / WebSocket port (`0` picks a free one) |
| `HOST` | `127.0.0.1` | listen address; `0.0.0.0` to accept outside connections (the image sets it) |
| `PUBLIC_URL` | — | public `http(s)://` origin used to build the `ws(s)://.../play` URL find_game returns; unset: derived from `Host` / `X-Forwarded-Host` / `X-Forwarded-Proto` |
| `TRUST_PROXY` | `0` | take the client IP from `X-Forwarded-For` (set it behind a reverse proxy, never without one) |
| `CLIENT_DIST` | `apps/client/dist` | directory of the built client served at `/` (not served when missing) |
| `LOG` | `1` | log joins, leaves, game lifecycle, reports, bans and anti-cheat flags |

### Games and modes

| Variable | Default | Meaning |
|---|---|---|
| `MAP_NAME` | `main` | map of games when find_game names none, and of party games |
| `MODES` | Solo, Duo, Squad of `MAP_NAME` | the three play buttons, `map:teamMode,...` (e.g. `main:1,main:2,desert:4`; a map without `:n` plays its event queue) |
| `MAX_PLAYERS` | `80` | players per game; above a map's design count (80) the game plays on a larger map, √(cap / 80) times per side up to √2 (from 160), with its gas and schedules stretched as much, and lets that many play, never more than 255 (docs/research/rebirth-deviations.md "Maps follow the player cap"). The bot fill (`BOT_FILL`) goes up to the cap as well; at or below the design count nothing changes |
| `FACTION_MAX_PLAYERS` | `100` | players per 50v50 game; above 100 the map grows the same way (√2 from 200) |
| `AIRSTRIKE_VARIANTS` | `normal:60,heavy:25,carpet:15` | rebirth: roll weights of each scheduled 50v50 air strike zone's variant, `variant[:weight],...` (`normal` the v0.8.82 strike; `heavy` 5 heavy shells per plane with a 17.5-47.5 u blast over a zone 30 u larger; `carpet` 6 planes instead of 3-5, aiming over 1.4x the radius under a marker that covers every blast). Weights are plain decimals from 0 to 1000000; unlisted variants get 0, a variant without a weight gets 1; `normal` turns the variants off. The original strobe's strikes are always normal; the rebirth variant strobes (`strobe_heavy`, `strobe_carpet`) are loot and call their own variant whatever this says (no knob; docs/research/rebirth-deviations.md "Variant strobes") |
| `AIRDROP_TIERS` | `on` | rebirth: `on` makes every normal air drop a tier 1 or a tier 2 drop (the same grey shell; once opened its crate shows one silver star or two blue stars), early drops mostly tier 1 and late drops mostly tier 2, the gold drop as rare as in v0.8.82; `off` restores the v0.8.82 drops. Snow and savannah split their normal shells too; 50v50, Cobalt and every gold or special crate are unchanged (docs/research/rebirth-deviations.md "Air drop tiers") |
| `GUN_BETA` | `off` | rebirth: `on` (or `1` / `true`, in any case) makes the owner's new guns (beta: AK-74 ... DShK, launchers included) and survev's Barrett M107, ASh-12, S&W 500, IMD-2 and SPAS-16 common floor loot on every map, so they can be found and tried: every gun the map allows lies on its floor at least twice, and they also take half of the floor gun rolls; the map's loot bans still hold (Savannah: no shotguns, LMGs or assault rifles; Woods: only shotguns, LMGs and launchers). The new guns' own placements (air drop tiers, gold drop) apply either way. Read when a game is created. In the dev sandbox the same is `/?beta=1`, and `/?give=<gun id>` gives any gun (docs/research/rebirth-deviations.md "New guns (beta)") |
| `MAX_GAMES` | `16` | games this process runs at once (find_game answers 503 `full` beyond) |
| `MIN_PLAYERS` | `2` | living players (groups in team modes) a game needs to start |
| `START_WHEN_FULL` | `1` | rebirth: a game that reaches its player cap (`MAX_PLAYERS`, `FACTION_MAX_PLAYERS` for 50v50) starts at once; `0` restores survev's rule, which waits until two players (groups, factions) have been alive for 10 s however full the game is (docs/research/rebirth-deviations.md "Start when full") |
| `GAME_OVER_GRACE_MS` | `1800` | a finished game closes this long after the winner is decided |
| `EMPTY_GAME_GRACE_MS` | `30000` | a game without human players is removed after this long |
| `DEBUG_SPAWN_TOGETHER` | `0` | testing aid: joiners spawn next to the game's first player |

### Regions (M8)

Each region is its own server. `/api/site_info` reports this server's player count under `REGION` (`pops`) and every
region's server origin (`regions`: `""` for the answering server), and the client calls the chosen region's
`/api/find_game`.

| Variable | Default | Meaning |
|---|---|---|
| `REGION` | `local` | this server's region id (`a-z`, `0-9`, `-`, `_`; the original ids are `na`, `sa`, `eu`, `as`, `kr`) |
| `REGION_SERVERS` | — | the other regions' servers, `id=origin,...` (e.g. `kr=https://kr.example.com,eu=https://eu.example.com`); origins are `http(s)://host[:port]` without a path; an entry for `REGION` itself is ignored, so every server can share one list. The browser calls these origins cross-site: they must be reachable over `https://` from an `https://` page |

### Bots

| Variable | Default | Meaning |
|---|---|---|
| `BOT_FILL` | `0` | fill games with in-process bots up to this many players while they are joinable (`0`: off); humans take a bot's seat |
| `FACTION_BOT_FILL` | `BOT_FILL` scaled to `FACTION_MAX_PLAYERS` | bot fill target of 50v50 games |
| `BOT_DIFFICULTY` | `mixed` | `mixed`: each bot's skill tier is drawn from `BOT_SKILL_MIX` (shuffle bags of 20, so small games get the mix too) and each bot draws its own skill inside the tier's band; `beginner`, `intermediate` or `expert`: every bot in that tier; `easy`, `normal` or `hard`: the legacy fixed presets (a beginner now misses clearly more than `easy`; see docs/design/bot-population.md) |
| `BOT_SKILL_MIX` | `35,45,20` | weights of beginner, intermediate and expert bots for `BOT_DIFFICULTY=mixed` |
| `BOT_PERSONAS` | `on` | `on` / `off` (also `1`/`0`, `true`/`false`): fill bots get personas (rusher 22%, rifleman 30%, marksman 14%, camper 10%, looter 14%, rat 10%) that shape their weapon taste, range, aggression, chasing, looting and risk; `off`: every bot plays the neutral persona |
| `BOT_FILL_INTERVAL_MS` | `250` | time between two bot joins once the game started (late joins in its 60 s join window) |
| `BOT_FILL_START_INTERVAL_MS` | `0` | time between two bot joins before the game starts; `0` is one bot per tick, so a game the bots fill to its cap is full and started about a second after it opens (2 s at a cap of 200) |

### Limits

| Variable | Default | Meaning |
|---|---|---|
| `MAX_CONNECTIONS_PER_IP` | `5` | simultaneous game sockets per IP |
| `MAX_MSGS_PER_SECOND` | `500` | game socket messages per second before `rate_limited` |
| `JOIN_TOKEN_TTL_MS` | `10000` | lifetime of a find_game join token |
| `JOIN_TIMEOUT_MS` | `10000` | time a socket has to send Join |
| `MAX_CATCH_UP_TICKS` | `5` | ticks a game may run in one timer callback after a stall |
| `MAX_BUFFERED_BYTES` | `1048576` | a congested socket skips updates above this send buffer |
| `PARTY_MAX_CONNECTIONS_PER_IP` | `5` | party lobby sockets per IP |
| `PARTY_MAX_MSGS_PER_SECOND` | `50` | party lobby messages per second |
| `PARTY_JOIN_TIMEOUT_MS` | `5000` | time a party socket has to create or join a room |
| `PARTY_IDLE_MS` | `480000` | silent party members are dropped after this long |

### Moderation and anti-cheat (M8)

| Variable | Default | Meaning |
|---|---|---|
| `ADMIN_TOKEN` | — | bearer token of `/api/admin/*` (at least 16 characters); unset: admin routes answer 403 |
| `ANTICHEAT` | `1` | per-player telemetry and suspicion scores |
| `ANTICHEAT_FLAG_SCORE` | `60` | score (0-100) at which a player is flagged |
| `ANTICHEAT_CONFIG` | — | JSON file overriding any threshold (see [Anti-cheat telemetry](#anti-cheat-telemetry)) |
| `SUSPECTS_FILE` | — | JSONL file every flag is appended to (with its full telemetry); unset: memory and log only |
| `REPORTS_FILE` | `data/reports.jsonl` | JSONL file of player reports |
| `REPORT_MAX_PER_MATCH` | `3` | reports one player may file per match |
| `REPORT_WINDOW_MS` | `900000` | how long after a game closed its players may still report |
| `NAME_FILTER` | `1` | the banned-words name filter |
| `NAME_FILTER_FILE` | `apps/server/data/name-filter.txt` | banned-words list |
| `BAN_FILE` | `data/bans.json` | IP and name bans |

## Reverse proxy, TLS and WebSockets

Browsers on an `https://` page may only open `wss://` sockets, so a public server needs TLS. Terminate it in a reverse
proxy and forward plain HTTP to the server. Three paths are WebSockets and need the upgrade headers: `/play` (games),
`/team_v2` and `/team` (party lobby). Set `TRUST_PROXY=1` so per-IP limits and IP bans see the real client address,
and either `PUBLIC_URL=https://play.example.com` or forward `Host` and `X-Forwarded-Proto` so find_game returns
`wss://play.example.com/play?token=...`.

nginx:

```nginx
map $http_upgrade $connection_upgrade { default upgrade; "" close; }

server {
    listen 443 ssl http2;
    server_name play.example.com;
    ssl_certificate     /etc/letsencrypt/live/play.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/play.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # the server pings every 15 s; idle game sockets must outlive that
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
        # game updates are small and frequent: do not buffer them
        proxy_buffering off;
    }
}
```

Caddy (automatic certificates, WebSockets work out of the box):

```
play.example.com {
    reverse_proxy 127.0.0.1:8001
}
```

With Cloudflare or another CDN in front, enable WebSockets, keep the origin's `X-Forwarded-For` handling consistent
(`TRUST_PROXY=1` trusts the first address of the header, so the proxy chain must overwrite, not append untrusted
values) and do not cache `/api/*`. Disable Nagle-style buffering or "rocket loader" features on the game paths.

## Regions: Korea and Asia

The original game ran one region per server group; 0.7.45 (April 2019) split Korea (Seoul) off the Asia region
(Singapore and Vietnam), and Korean players complained about Asia-server ping for years
(`docs/research/community-ko.md`, "핑·서버 불만"). For a Korean or East-Asian audience:

- Host in Seoul: AWS `ap-northeast-2`, GCP `asia-northeast3`, Azure Korea Central, Oracle Seoul / Chuncheon, Vultr
  Seoul, or a Korean provider. Players inside Korea then see roughly 5-30 ms; Tokyo-hosted servers add ~30-40 ms for
  Korean players, Singapore ~70-90 ms. The simulation is server-authoritative, so ping is felt directly in aim and
  movement feedback.
- One process is one region: run a separate deployment per region (`kr.example.com`, `asia.example.com`). The
  `region` field of find_game and of the party lobby is accepted but a single process serves every request itself;
  `/api/site_info` reports this process's population under `pops.local`.
- Evenings and weekends carried the Korean and Asian populations (namu wiki); off-peak, `BOT_FILL` keeps games alive
  (humans take a bot's seat when they join).
- The name filter ships Korean entries (jamo-aware, see below) and the client bundles Noto Sans KR.
- Bandwidth: a full 80-player game sends roughly 20-40 KB/s per player at the 33 Hz update rate; size the uplink
  for `MAX_GAMES x MAX_PLAYERS` players.

## Moderation: reports, bans, name filter

### Player reports

The client reports a player of its match over HTTP (no game protocol change). The reporter is authenticated by its
**join token**: the `token` of the find_game answer (or of the party `joinGame` message); `GameConnection.joinToken`
in `@rebirth/protocol` holds it. The token stays valid for reports while the game runs and `REPORT_WINDOW_MS` after
it closed, so the game-over screen can still report. `@rebirth/protocol` exports `submitReport(baseUrl, request)`,
`ReportReason` and `REPORT_TEXT_MAX_LENGTH`.

```http
POST /api/report
Content-Type: application/json

{"token": "<join token>", "playerId": 1234, "reason": "cheating", "text": "aimbot, snaps through smoke"}
```

- `playerId`: the reported player's id (kill feed / player infos); `reason`: `cheating`, `teaming`, `name` or
  `other`; `text`: optional, at most 200 characters; `gameId`: optional, must be the token's game when given. The token
  may be sent as `Authorization: Bearer <token>` instead of the body field.
- `200 {"ok": true, "id": "<report id>"}`.
- Errors (`{"error": code}`): `400 invalid_request`, `401 invalid_token` (unknown or expired), `400 game_mismatch`,
  `400 self_report`, `404 unknown_player`, `409 duplicate` (same reporter, same player, same match),
  `429 report_limit` (`REPORT_MAX_PER_MATCH`, default 3, per reporter per match), `429 rate_limited` (10 report
  requests per minute per IP).
- Each report is one JSON line in `REPORTS_FILE`: id, time, game id, map, team mode, reason, cleaned text, and for
  both players their id, name, IP, whether it is a bot, and their anti-cheat telemetry snapshot at the time of the
  report. Reports against fill bots are stored with `"bot": true` (the client is not told who is a bot).

### Bans

`BAN_FILE` (JSON, default `data/bans.json`) holds bans:

```json
{"bans": [
  {"id": "…", "type": "ip", "value": "203.0.113.0/24", "reason": "aimbot", "createdAt": "…", "expiresAt": null},
  {"id": "…", "type": "name", "value": "*cheat*", "reason": "name", "createdAt": "…", "expiresAt": "2026-11-01T00:00:00.000Z"}
]}
```

- `ip`: an address or a CIDR subnet, IPv4 or IPv6 (IPv4-mapped IPv6 addresses match their IPv4 bans).
- `name`: a pattern compared with the normalized name (lower case, letters only, as the name filter folds it); `*`
  matches anything (`*cheat*`, `exactname`).
- Checked at `POST /api/find_game` (IP: `403 {"error": "banned"}`) and at Join (IP and name: the socket gets a
  Disconnect with reason `banned`, `DisconnectReason.Banned` in `@rebirth/protocol`; `GameConnection` also ends with
  `banned` when find_game answers 403 banned). Adding a ban through the admin API disconnects matching players at once.
- The file may be edited by hand; changes are picked up within 5 seconds. Expired bans are ignored and dropped on the
  next write.

### Name filter

Names at Join and party names pass through the banned-words list (`NAME_FILTER_FILE`, default
`apps/server/data/name-filter.txt`: a short list of unambiguous English slurs and common Korean profanity / hate
terms). A matching name is shown as `Player`. Names and entries are normalized: case, accents, full-width and
Cyrillic/Greek look-alike letters; spaces, digits and punctuation are ignored, and a second pass reads leetspeak
(`0 o, 1 i, 3 e, 4 a, 5 s, 7 t, 8 b, 9 g, @ a, $ s, ! i, | l, + t`); each entry letter matches repeated copies
(`niiiggger`); Hangul typed jamo by jamo is recomposed (`ㅅㅣㅂㅏㄹ` = `시발`) and a Hangul-only pass ignores letters
mixed in (`시a발`); entries of bare consonants (`ㅅㅂ`) match consonants typed on their own. Syllables are never split
into jamo for matching (that would make `조조` contain `좆`). An entry prefixed with `=` must be the whole name (short
words such as `spic` that occur inside innocent names like `spicy`). Substring entries can still hit innocent names
in rare cases (`cunt` in "Scunthorpe"); keep the list short and move such words behind `=`.

## Anti-cheat telemetry

The server never trusts the client: positions, hits and damage are computed by the simulation; inputs are validated
and clamped (`apps/server/src/input.ts`); clients only receive what is in view (view culling, smoke hiding, other-floor
culling), so wall hacks and ESP have nothing to show. What remains are aim assistance and scripted inputs, which the
telemetry scores. Bots are never tracked. Per human player and match the server records (from the simulation's
combat observer and the raw input messages): shots, bullets and bullet hits by gun class, headshots, damage, kills and
kill distances, the aim history, input rate and movement key changes.

The suspicion score (0-100) is the weighted sum of five components, each 0..1. A player is flagged when the score
reaches `ANTICHEAT_FLAG_SCORE` (60), and again whenever it rose by `reflagDelta` (10). **No single component can reach
60**: a flag needs two independent signals.

| Component | Weight | Measures | Default thresholds |
|---|---|---|---|
| `snap` | 45 | opening shots (first shot after a 400 ms pause) that hit a player at least 6 units away right after an aim snap: an aim change of 45° or more between two consecutive inputs, among the last 3 inputs and within 120 ms before the shot, with the cursor at least 2.5 units from the player in both inputs (near the player a tiny mouse move swings the direction) | ratio of snapped opening hits: 0 at 30 %, 1 at 70 %; needs 5 opening hits |
| `accuracy` | 30 | bullets that hit an enemy / bullets fired, per weapon group (the most suspicious group counts) | auto (pistols, SMGs, assault rifles, LMGs): 0 at 55 %, 1 at 85 %, needs 60 bullets; precision (DMRs, snipers): 80 % / 97 %, 15 bullets; shotguns (pellets): 75 % / 95 %, 60 pellets |
| `constant_aim` | 25 | runs of 30 consecutive inputs whose aim delta stays within 0.5° of the run's first delta, each at least 1.5° (spin bots, scripted aim, aimbots tracking a target perfectly; human aim varies far more than the wire's ~0.11° direction quantization) | 1 at 3 runs (a long run counts once per 30 inputs) |
| `input_rate` | 15 | seconds with more than 120 Input messages (the client sends at most 60/s plus keep-alives) | 0 at 3 such seconds (a network stall delivers one burst), 1 at 15 |
| `move_spam` | 10 | seconds with more than 20 movement key changes (strafe macros; humans stay well under 15) | 0 at 3 seconds, 1 at 15 |

Not scored, recorded for moderators: headshots (the server rolls them at random, 15 % of eligible hits, so a high
headshot rate means luck, not cheating), kill distances, damage. Movement speed cannot be cheated (the server moves
players), so movement checks only look at input spam.

Synthetic streams in `apps/server/test/anticheat.test.ts` calibrate the defaults: an aimbot that snaps onto targets
and tracks them scores 91-98 (snap 45, accuracy 21-28, constant aim 25); a human-like stream (bell-shaped flicks over
8-15 inputs with overshoot and correction, reaction delay, noisy tracking, 35 % accuracy) scores 0. Known limits:
aimbots with human-like smoothing and humanized accuracy evade `snap` and `accuracy`; very skilled players against
bots can reach high accuracy (one component, never a flag on its own). Treat flags as leads for review together with
reports, not as automatic bans.

Flags are logged as one JSON line on stderr (`{"level":"warn","event":"anticheat_flag","gameId",…,"score",
"components":[{code, value, points, detail}]}`), kept in memory (last 500) for `/api/admin/suspects` and appended
with the full telemetry snapshot to `SUSPECTS_FILE` when set. Telemetry snapshots are also attached to reports.

`ANTICHEAT_CONFIG` names a JSON file with any subset of the thresholds (`apps/server/src/anticheat/thresholds.ts`),
deep-merged over the defaults and validated at startup:

```json
{
  "flagScore": 70,
  "weights": { "snap": 40 },
  "accuracy": { "auto": { "soft": 0.6, "hard": 0.9 } },
  "snap": { "angleDeg": 50, "minHits": 8 },
  "inputRate": { "maxPerSecond": 150 }
}
```

## Admin API

All routes need `Authorization: Bearer $ADMIN_TOKEN` (or `X-Admin-Token: $ADMIN_TOKEN`). Without `ADMIN_TOKEN` they
answer `403 {"error":"admin_disabled"}`, with a wrong token `401 {"error":"unauthorized"}`. Do not expose them without
TLS.

| Route | Answer |
|---|---|
| `GET /api/admin/suspects?limit=100&gameId=&minScore=` | `{antiCheat, flagScore, flags: [flag…] newest first, live: [{gameId, playerId, name, ip, score, components, left}…] (players of running games with a score above 0, highest first, at most 50)}`; a flag is `{time, gameId, mapName, teamMode, playerId, name, ip, score, components, stats}` |
| `GET /api/admin/reports?limit=100&gameId=&playerId=&reason=` | `{reports: [report…]}` newest first (`playerId` filters on the reported player) |
| `GET /api/admin/bans` | `{bans: [ban…]}` (bans in force) |
| `POST /api/admin/bans` `{"type": "ip"\|"name", "value": "…", "reason"?: "…", "durationMinutes"?: n}` | `201 {ban, kicked}` (`kicked`: players disconnected now); `400 invalid_request` / `invalid_ban` |
| `DELETE /api/admin/bans/:id` | `{ok: true}` or `404 not_found` |

```sh
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://play.example.com/api/admin/suspects?minScore=60
curl -H "Authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
     -d '{"type":"ip","value":"203.0.113.7","reason":"aimbot (report 9f1c…)","durationMinutes":10080}' \
     https://play.example.com/api/admin/bans
```

## Bundle budget

`pnpm check:bundle` builds the client and fails when the main JS bundle (the entry chunk `apps/client/dist/index.html`
loads; PixiJS's lazily loaded chunks are not counted) exceeds `scripts/bundle-budget.json`. `--no-build` checks an
existing build. Measured on 2026-10-06: 2,443,176 bytes raw, 368,798 bytes gzip (level 9). Budget, about 20 % above:
**2,930,000 bytes raw, 445,000 bytes gzip**. Raise it deliberately (and note why) when a feature needs the room.

## Operations

- Health: `GET /health` → `{ok, games, players}`; `GET /api/stats` → per-game tick and netsync timings, bytes sent,
  memory. The image's `HEALTHCHECK` polls `/health`.
- Logs are plain lines for lifecycle events and JSON lines for reports (`player_report`), bans (`ban_added`,
  `ban_removed`) and flags (`anticheat_flag`); `LOG=0` silences them.
- Data: `/app/data` (or `./data` locally) holds `reports.jsonl`, `bans.json` and `suspects.jsonl`; back it up. The
  files contain player IP addresses: restrict access and set a retention policy that fits your privacy obligations.
- Scaling: one process uses one core for all its games (`MAX_GAMES`); run more processes or hosts behind a
  load balancer that keeps `/api/find_game` and the following `/play` socket on the same process (sticky sessions, or
  one hostname per process via `PUBLIC_URL`). Bans and reports are per process unless the processes share the data
  directory (the ban file is reloaded when it changes on disk).
- Shutdown: `SIGTERM` / `SIGINT` disconnect players with `server_shutdown` and exit.
