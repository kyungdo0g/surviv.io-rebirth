# surviv.io rebirth

A from-scratch recreation of [surviv.io](https://en.wikipedia.org/wiki/Surviv.io), the 2D top-down browser battle royale,
targeting the original v0.8.82 (December 2019).

- Research knowledge base with citations: [`docs/research`](docs/research/README.md)
- Original-vs-survev data provenance: [`docs/research/provenance`](docs/research/provenance)
- Decisions: [`docs/adr`](docs/adr)
- Deploying a server (Docker, environment variables, TLS, regions, moderation, anti-cheat): [`docs/deploy.md`](docs/deploy.md)
- Contributor/agent guide and commands: [`CLAUDE.md`](CLAUDE.md)

## Play locally

Requirements: Node 22.18+, pnpm 10 (`corepack enable`, on Windows in a terminal run as administrator, or
`npm install -g pnpm@10`) and git for the original art. The commands are the same in bash, zsh, PowerShell and cmd.exe:

```sh
pnpm install
pnpm survev:fetch   # optional, with the next line: the original art and audio (not in this repository; git + network)
pnpm assets         # copies them into apps/client/public/assets
pnpm server         # game server on http://127.0.0.1:8001 (restarts on changes)
pnpm dev            # in a second terminal: client dev server on http://127.0.0.1:5173 (proxies /api, /play, /team_v2)
```

Then open:

- <http://127.0.0.1:5173/> — the start page: name, region, Play Solo / Duo / Squad, Create Team / Join Team (party
  lobby; share the `/#CODE` link), settings (language, volumes, screen shake, anonymous names) and keybinds.
- <http://127.0.0.1:5173/?net=1&name=alice> — straight into a solo game on the server (`&mode=2` or `&mode=4` for duo /
  squad, `&server=http://host:8001` for another server).

Open a second browser tab to have an opponent, or let bots fill the games: `BOT_FILL=20 pnpm server`
(bots join one by one until a game holds 20 players; a human takes a bot's seat when it joins; on Windows see
[Environment variables on Windows](#environment-variables-on-windows)). Bots default to `BOT_DIFFICULTY=mixed`: 35%
beginner, 45% intermediate and 20% expert bots, each with a persona; `BOT_SKILL_MIX`, `BOT_PERSONAS`, the single tiers
and the legacy `easy`/`normal`/`hard` presets are in docs/deploy.md. A match starts when two players (`MIN_PLAYERS`)
have been alive for 10 seconds.

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
inside two factions of `FACTION_MAX_PLAYERS`, default 100). Its scheduled air strikes come in three rebirth variants,
normal, heavy shells (a much larger blast) and carpet bombing (6 planes over a wider area), weighted by
`AIRSTRIKE_VARIANTS` (default `normal:60,heavy:25,carpet:15`; `normal` turns them off). Normal air drops are tier 1 or
tier 2 drops whose opened crate shows its tier (one silver or two blue stars), the gold drop unchanged;
`AIRDROP_TIERS=off` restores the original drops. The owner's 30 new guns (a beta: AK-74, P90, DP-12, DShK, the
M79 / RPG-7 / Panzerfaust / M202 launchers and more) spawn per their balance sheet; `GUN_BETA=on` also makes them and
the survev-only guns (Barrett M107, ASh-12, S&W 500, IMD-2, SPAS-16) common floor loot on every map for testing, each
at least twice per map
(`/?beta=1` in the dev sandbox, `/?give=rpg7,dshk` to hold any gun). They are held as plain bars for now; their loot
icons and sounds come from the owner's gitignored `assets-user/` (`pnpm assets`, or `node tools/assets/newGuns.ts`
alone), with original guns' icons and sounds wherever a file is missing. Every variable is listed in
[`docs/deploy.md`](docs/deploy.md#environment-variables).

### Environment variables on Windows

The examples here set server variables the POSIX way, in front of the command (`BOT_FILL=20 pnpm server`). PowerShell
and cmd.exe set them for the terminal window first, then run the command:

```powershell
# PowerShell
$env:BOT_FILL = 20; $env:BOT_DIFFICULTY = "mixed"
pnpm server
Remove-Item Env:BOT_FILL, Env:BOT_DIFFICULTY   # back to the defaults
```

```bat
:: cmd.exe (the quotes keep a trailing space out of the value)
set "BOT_FILL=20" & set "BOT_DIFFICULTY=mixed"
pnpm server
```

## Run a server

```sh
pnpm start                          # builds the client and serves it with the game on http://127.0.0.1:8001
HOST=0.0.0.0 PORT=8001 ADMIN_TOKEN=$(openssl rand -hex 24) BOT_FILL=40 pnpm start
docker compose up -d --build        # or the Docker image (without the original art unless WITH_ORIGINAL_ASSETS=1)
```

The second line on Windows (Node makes the admin token, Windows has no `openssl`). The token is optional: without
`ADMIN_TOKEN` the admin API answers 403 and the game runs the same.

```powershell
# PowerShell
$env:HOST = "0.0.0.0"; $env:PORT = 8001; $env:BOT_FILL = 40
$env:ADMIN_TOKEN = node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
pnpm start
```

```bat
:: cmd.exe, typed at the prompt (write %%t instead of %t in a .bat file)
set "HOST=0.0.0.0" & set "PORT=8001" & set "BOT_FILL=40"
for /f "usebackq" %t in (`node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`) do set "ADMIN_TOKEN=%t"
pnpm start
```

With `HOST=0.0.0.0` other machines join at `http://<this computer's address>:8001` (`ipconfig` on Windows, `ip addr`
on Linux); on Windows allow Node.js through the Windows Defender Firewall prompt (private networks), and forward TCP
port 8001 on the router for players outside your network. Docker needs Docker Desktop on Windows and macOS.

A served client opens the start page at `/`. Put a TLS reverse proxy in front for a public server (WebSockets on
`/play` and `/team_v2`), set `TRUST_PROXY=1`, and see [`docs/deploy.md`](docs/deploy.md) for regions (`REGION`,
`REGION_SERVERS`; Seoul hosting for Korean players), player reports, bans, the name filter, the anti-cheat telemetry
and the admin API (`/api/admin/*`).

Checks: `pnpm verify` (typecheck, lint, unit tests, knowledge base), `pnpm e2e` (Playwright; `npx playwright install
chromium` once on a new machine), `pnpm check:bundle` (client bundle-size budget).

## License

Code is GPL-3.0-or-later (game data is ported from the GPL-3.0 [survev](https://github.com/survev/survev) project and the
original client). The original artwork and audio are not included in this repository; see
[`assets/PROVENANCE.md`](assets/PROVENANCE.md).
