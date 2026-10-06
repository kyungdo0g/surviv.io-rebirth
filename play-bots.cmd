@echo off
rem Local test: server with 200 hard bots (all join at once) + client dev server, then opens the game.
cd /d "%~dp0"
set MAX_PLAYERS=200
set BOT_FILL=200
set BOT_DIFFICULTY=hard
set BOT_FILL_INTERVAL_MS=0
start "server" cmd /k node apps/server/src/index.ts
start "client" cmd /k pnpm dev
timeout /t 5 /nobreak >nul
start "" "http://127.0.0.1:5173/?net=1&name=me"
