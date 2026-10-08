@echo off
rem Local test: server with 100 hard bots (all join at once) + client dev server, then opens the main menu
rem (pick solo / duo / squad / 50v50 there). GUN_BETA=on: the new guns lie around as common loot.
cd /d "%~dp0"
set MAX_PLAYERS=100
set BOT_FILL=100
set BOT_DIFFICULTY=hard
set BOT_FILL_INTERVAL_MS=0
set JOIN_MIN_ALIVE=50
set GUN_BETA=on
start "server" cmd /k node apps/server/src/index.ts
start "client" cmd /k pnpm dev
timeout /t 5 /nobreak >nul
start "" "http://127.0.0.1:5173/?menu=1"
