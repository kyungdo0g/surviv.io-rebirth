# surviv.io rebirth

A from-scratch recreation of [surviv.io](https://en.wikipedia.org/wiki/Surviv.io), the 2D top-down browser battle royale,
targeting the original v0.8.82 (December 2019).

- Research knowledge base with citations: [`docs/research`](docs/research/README.md)
- Original-vs-survev data provenance: [`docs/research/provenance`](docs/research/provenance)
- Decisions: [`docs/adr`](docs/adr)
- Deploying a server (Docker, environment variables, TLS, regions, moderation, anti-cheat): [`docs/deploy.md`](docs/deploy.md)
- Contributor/agent guide and commands: [`CLAUDE.md`](CLAUDE.md)

## Play locally

Requirements: Node 22.18+ and pnpm 10 (`corepack enable`).

```sh
pnpm install
pnpm survev:fetch && pnpm assets   # the original art and audio (optional, not in this repository; needs git + network)
pnpm server                        # game server on http://127.0.0.1:8001 (restarts on changes)
pnpm dev                           # client dev server on http://127.0.0.1:5173 (proxies /api, /play, /team_v2)
```

Then open:

- <http://127.0.0.1:5173/> — the start page: name, region, Play Solo / Duo / Squad, Create Team / Join Team (party
  lobby; share the `/#CODE` link), settings (language, volumes, screen shake, anonymous names) and keybinds.
- <http://127.0.0.1:5173/?net=1&name=alice> — straight into a solo game on the server (`&mode=2` or `&mode=4` for duo /
  squad, `&server=http://host:8001` for another server).

Open a second browser tab to have an opponent, or let bots fill the games: `BOT_FILL=20 BOT_DIFFICULTY=mixed pnpm server`
(bots join one by one until a game holds 20 players; a human takes a bot's seat when it joins). A match starts when
two players (`MIN_PLAYERS`) have been alive for 10 seconds.

Without `pnpm assets` everything works with placeholder graphics and no sound.

### Sandbox (no server)

The client runs a loopback simulation when any sandbox parameter (`sandbox`, `map`, `seed`, `give`, `dummies`, `loot`,
`team`, `teammates`, `gas`, `zoom`, `debug`) is given:

- <http://127.0.0.1:5173/?sandbox=1> — sandbox on the main map (the match starts at once and never ends)
- `?map=desert&seed=7` — another map or seed (`main`, `desert`, `woods`, `woods_snow`, `halloween`, `faction`,
  `potato`, `savannah`, `cobalt`, ...)
- `&dummies=4&give=mosin,frag,bandage` — standing dummies and items; `&loot=0` no map loot
- `&sandbox=0&gas=fast` — a real match with a fast red zone; `&team=4&teammates=3` — squad play with idle teammates
- `&debug=1` — debug HUD (F3), `&zoom=60` camera radius, `&lang=ko` Korean HUD
- `&touch=1` — touch controls on a desktop browser (they turn on by themselves on phones and tablets; `&touch=0` off)
- `?gallery=` — sprite gallery, `?fixture=1` — renderer fixture

### Controls

The original defaults: WASD move, mouse aim and fire, R reload, F interact, 1-4 weapons, Q last weapon, E stow, 7-0
heals and boosts, T swap guns, M (or G) map, hold right mouse for emotes, C team ping, L full screen, Esc the in-game
menu (settings, keybinds, quit). Every action can be rebound, and binds are shared as the original's bind codes. On
touch devices the left half of the screen is the move stick and the right half the aim stick (pull past the edge to
fire); tap a weapon slot, the ammo counter or an item to use it, hold an item to drop it.

### Modes and maps

The server's three play buttons default to Solo, Duo and Squad on `MAP_NAME` (default `main`). `MODES` sets them like
the original events did, e.g. `MODES=main:1,main:2,desert:4 pnpm server`; `MAP_NAME=faction` runs 50v50 (squads
inside two factions of `FACTION_MAX_PLAYERS`, default 100). Every variable is listed in
[`docs/deploy.md`](docs/deploy.md#environment-variables).

## Run a server

```sh
pnpm start                          # builds the client and serves it with the game on http://127.0.0.1:8001
HOST=0.0.0.0 PORT=8001 ADMIN_TOKEN=$(openssl rand -hex 24) BOT_FILL=40 pnpm start
docker compose up -d --build        # or the Docker image (without the original art unless WITH_ORIGINAL_ASSETS=1)
```

A served client opens the start page at `/`. Put a TLS reverse proxy in front for a public server (WebSockets on
`/play` and `/team_v2`), set `TRUST_PROXY=1`, and see [`docs/deploy.md`](docs/deploy.md) for regions (`REGION`,
`REGION_SERVERS`; Seoul hosting for Korean players), player reports, bans, the name filter, the anti-cheat telemetry
and the admin API (`/api/admin/*`).

Checks: `pnpm verify` (typecheck, lint, unit tests, knowledge base), `pnpm e2e` (Playwright), `pnpm check:bundle`
(client bundle-size budget).

## License

Code is GPL-3.0-or-later (game data is ported from the GPL-3.0 [survev](https://github.com/survev/survev) project and the
original client). The original artwork and audio are not included in this repository; see
[`assets/PROVENANCE.md`](assets/PROVENANCE.md).
