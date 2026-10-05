# Menus

> Scope: the main (start) page, mode and region selection, team lobby, how-to-play, settings, keybind modal, loadout (customize) menu, account and pass widgets, in-game Esc menu, error and refresh modals.
> The menus are static HTML in `client/index.html` with Bootstrap-style modals and jQuery logic (`client/src/main.ts`, `ui/menu.ts`, `ui/teamMenu.ts`, `ui/loadoutMenu.ts`, `siteInfo.ts`). The decompiled 0.8.82 page is `derived/survev@8715a605:client/index.html` (single-quoted attributes, same ids).

## Main page layout

| block | DOM id | contents | sources |
|---|---|---|---|
| top-left | `#start-top-left`, `#btn-hamburger` | hamburger (leaderboards link), Discord button (survev), featured streamers (`#featured-streamers`, Twitch list from site_info) and featured YouTuber | [src:survev/client/index.html:755-790] [src:survev/client/src/siteInfo.ts:116-150] [H] |
| top-right | `#start-top-right`, `#account-login` | account login / player name, login options | [src:survev/client/index.html:952-1045] [H] |
| left column | `#social-share-block` | social links | [src:survev/client/index.html:1056] [H] |
| centre | `#start-menu` | name input, customize button, region select, play buttons, team buttons, how to play | [src:survev/client/index.html:1086-1275] [H] |
| centre (alt) | `#team-menu` | team lobby (replaces the start menu while in a team) | [src:survev/client/index.html:1276-1385] [H] |
| right column | `#pass-wrapper`, `#news-wrapper` | pass level, XP bar, quests; news | [src:survev/client/index.html:1386-1712] [H] |
| bottom | `#start-bottom-left`, `#start-bottom-right`, `#btn-start-fullscreen` | version link to `changelog.html`, privacy, attributions, fullscreen | [src:survev/client/index.html:1713-1743] [H] |
- The 0.8.82 footer reads "ver 0.8.82" and links `changelog.html` [src:derived/survev@8715a605:client/index.html:1118] [H]
- The main page background is a per-theme splash image; survev has `main`, `main_easter`, `main_spring`, `desert`, `faction`, `halloween`, `potato_spring`, `snow`, `turkey`, `cobalt` WebP splashes (fork conversion, 2026-09-28); the original shipped PNG splashes such as `main_splash.png`, `main_splash_halloween.png`, `main_splash_easter.png` [src:survev/shared/defs/maps/baseDefs.ts:15-20] [src:derived/survev-git-5fbbef6d] [src:derived/survev@8715a605:client/img] [H]
- Ids only in the original page: cookie consent (`modal-cookie-settings`, `btn-cookie-opt-out`), social-follow unlock buttons (Facebook, Instagram, Twitter, YouTube), the app download link and AdinPlay ad slots (`surviv-io_300x250`, `surviv-io_728x90`, …) [src:derived/survev@8715a605:client/index.html] [src:survev/client/index.html] [H]
- Ids only in survev: interpolation and local-rotation settings, IP-ban modal, Turnstile captcha container, Discord button, Nitro ad slots, debug editor, `ui-perk-3` (fork) [src:survev/client/index.html] [src:derived/survev@8715a605:client/index.html] [H]

## Start menu

- Name field `#player-name-input-solo`, max 16 characters (same limit as the protocol's `PlayerNameMaxLen`), placeholder "Enter your name here" [src:survev/client/index.html:1093-1102] [src:survev/shared/net/net.ts:13] [src:l10n/en:index-enter-name-here] [H]
- `#btn-customize` next to the name opens the loadout menu (in 0.2.6 the emote loadout was "the surviv.io icon next to the name input") [src:survev/client/index.html:1103] [src:changelog/0.2.6] [src:fandom/Loadout] [H]
- Region dropdown `#server-select-main`, each option labelled "<Region> [N players]" from site_info `pops` [src:survev/client/index.html:1106-1112] [src:survev/client/src/siteInfo.ts:100-114] [H]
- Original regions: `na` North America, `sa` South America, `eu` Europe, `as` Asia, `kr` South Korea (South America added 0.6.55, South Korea 0.7.45) [src:derived/survev@8715a605:client/index.html:932-936] [src:changelog/0.6.55] [src:changelog/0.7.45] [H]
- The first visit picks the region with the lowest ping from a WebSocket ping test unless the player chose one (`regionSelected`); URL params `?region=` and `?zone=` override [src:survev/client/src/main.ts:686-696] [src:derived/survev@8715a605:client/js/app.js:107552-107560] [src:fandom/Servers] [H]
- Play buttons `#btn-start-mode-0` (Solo), `#btn-start-mode-1` (Duo), `#btn-start-mode-2` (Squad); in survev each button's text and style come from the configured mode's map (`desc.buttonText`, `icon`, `buttonCss`, e.g. 50v50 star, Woods king, Halloween pumpkin) and at most 3 modes are supported [src:survev/client/index.html:1113-1130] [src:survev/client/src/siteInfo.ts:42-96] [src:survev/configType.ts:119-140] [H]
- Default selected mode index is 2 (squad) and team auto-fill defaults on, in both clients [src:survev/client/src/config.ts:123-124] [src:derived/survev@8715a605:client/js/app.js:74393-74400] [H]
- "Join Team" (`#btn-join-team`) and "Create Team" (`#btn-create-team`) are shown when any enabled mode is a team mode [src:survev/client/index.html:1131-1139] [src:survev/client/src/siteInfo.ts:97-99] [H]
- Pressing Play shows a spinner; repeated attempts within 30 s are delayed by `min(2.5 s × attempts, 7.5 s)` [src:survev/client/src/main.ts:662-680] [src:derived/survev@8715a605:client/js/app.js:107545-107551] [H]
- Join errors appear under the buttons: "Failed finding game.", "Old client version." (with a refresh modal), "Failed joining game.", plus survev-only captcha, proxy/VPN, IP-ban and rate-limit messages [src:survev/client/src/main.ts:836-875] [src:derived/survev@8715a605:client/js/app.js:107654-107670] [src:l10n/en:index-invalid-protocol] [H]

## How to play

- "How to Play" (`#btn-help`) expands `#start-help`: a Controls list and four tips [src:survev/client/index.html:1140-1275] [src:derived/survev@8715a605:client/index.html:873-903] [H]
- Controls entries (desktop text / touch text): Movement W,A,S,D / left stick; Aim Mouse / right stick; Melee/Shoot Left-Click / drag right stick outside its border; Change Weapons 1–4 or scroll wheel / tap slot; Stow Weapons 3 or E; Swap to Previous Weapon Q; Switch Gun Slots T or drag; Reload R / tap ammo counter; Scope Zoom left-click zoom; Pickup/Loot/Revive F / tap button; Use Medical left-click or 7–0 / tap item; Drop Item right-click / touch and hold; Cancel Action X; View Map M or G / tap minimap; Toggle Minimap V; Team Ping Wheel hold C + right-drag / tap map; Emote Wheel right-drag / tap surviv icon [src:l10n/en:index-movement-ctrl] [src:l10n/en:index-change-weapons-ctrl] [src:l10n/en:index-use-ping-ctrl] [src:l10n/en:index-use-emote-ctrl-touch] [src:survev/client/index.html:1143-1240] [H]
- Stow Weapons, Swap to Previous Weapon, Switch Gun Slots and Toggle Minimap are hidden on mobile (`hide-on-mobile`) [src:survev/client/index.html:1170-1190] [H]
- Tip 1: "The goal of surviv.io is to be the last player standing. You only live once per game - there is no respawn!" (survev says survev.io) [src:l10n/en:index-tips-1-desc] [src:l10n/ko:index-tips-1-desc] [H]
- Tip 2 "2D PUBG": "If you've played other battle royale games like PUBG, Fortnite or Apex Legends, then you're already halfway there! Think of surviv.io as 2D PUBG (with slightly less desync and more chicken)." [src:l10n/en:index-tips-2-desc] [src:l10n/ko:index-tips-2-desc] [H]
- Tip 3 "Loot and Kill": start with only a backpack, find weapons, ammo, scopes and medical items, take loot from eliminated players [src:l10n/en:index-tips-3-desc] [H]
- Tip 4 "Red = Bad!": the red zone moves in from the map sides and deals increasingly greater damage [src:l10n/en:index-tips-4-desc] [H]
- Korean labels: 플레이 방법 (How to Play), 조작 (Controls), 개인전 플레이 / 2인 팀전 플레이 / 분대(4명) 플레이 (Play Solo/Duo/Squad), 팀 만들기 / 팀에 합류 (Create/Join Team) [src:l10n/ko:index-how-to-play] [src:l10n/ko:index-controls] [src:l10n/ko:index-play-solo] [src:l10n/ko:index-play-duo] [src:l10n/ko:index-play-squad] [src:l10n/ko:index-create-team] [src:l10n/ko:index-join-team] [H]

## Team lobby

- Creating or joining opens a JSON WebSocket to `/team_v2` on the API host (the original always used `wss://`) [src:survev/client/src/ui/teamMenu.ts:182-200] [src:derived/survev@8715a605:client/js/app.js:51913] [H]
- Client → server messages: `create` (room data + name), `join` (roomUrl + name), `changeName`, `setRoomProps` (region, autoFill, gameModeIdx), `kick` (playerId), `playGame` (version, region, zones, captcha token), `gameComplete`, `keepAlive` [src:survev/shared/types/team.ts:91-195] [src:derived/survev@8715a605:client/js/app.js:52055-52111] [H]
- Server → client messages: `state` (room data, players with name/playerId/isLeader/inGame, localPlayerId), `joinGame` (match urls + join token), `kicked`, `error`, `keepAlive` [src:survev/shared/types/team.ts:38-85] [src:derived/survev@8715a605:client/js/app.js:52055-52085] [H]
- The client sends `keepAlive` every 45 s; survev's server drops players silent for 8 minutes [src:derived/survev@8715a605:client/js/app.js:51892-51902] [src:survev/server/src/teamMenu.ts:375-382] [H]
- The room code is the URL hash (`#code`); the lobby shows an invite link (copy / hide buttons) and the bare code; joining via a pasted link or code uses `#team-link-input` ("Got a team link or code? Paste it here:") [src:survev/client/src/ui/teamMenu.ts:115-160] [src:survev/client/src/ui/teamMenu.ts:474-495] [src:l10n/en:index-join-team-help] [H]
- survev generates 4-character codes from `ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789` (no I, O, l, o, 0) (fork reconstruction; the original server code is not public) [src:survev/server/src/teamMenu.ts:345-354] [L]
- Leader-only controls: queue mode Duo/Squad (`#btn-team-queue-mode-1/2`), Auto Fill / No Fill, region select, Play (`#btn-start-team`) and kick; others see "Waiting for leader to start game", "Joining game" or "Game in progress" [src:survev/client/index.html:1321-1355] [src:survev/client/src/ui/teamMenu.ts:455-565] [src:l10n/en:index-waiting-for-leader] [H]
- Member list shows up to `maxPlayers` rows (2 for duo, 4 for squad), a leader icon and a kick icon for the leader [src:survev/client/src/ui/teamMenu.ts:570-610] [src:survev/server/src/teamMenu.ts:190-198] [H]
- Name changes are allowed in the lobby since 0.7.3 [src:changelog/0.7.3] [src:survev/shared/types/team.ts:119-124] [H]
- Team errors: "Team is full!", "Failed joining team.", "Failed creating team.", "Lost connection to team.", "You were kicked from the team!", plus find-game errors [src:survev/shared/types/team.ts:6-20] [src:l10n/en:index-team-is-full] [src:l10n/en:index-team-kicked] [H]

## Settings modal (main menu)

- `#modal-settings`: language select, "High resolution", "Screen shake", "Anonymize player names", Master / SFX / Music volume sliders, links privacy / attributions / hall of fame [src:survev/client/index.html:1965-2044] [src:derived/survev@8715a605:client/index.html] [H]
- survev adds "Client side interpolation" (default on) and "Client side player rotation" (default off) (fork, 2025) [src:survev/client/src/config.ts:100-101] [src:l10n/en:index-client-side-interp] [src:derived/survev-git-cb16c592] [src:derived/survev-git-8471b2b8] [H]
- Stored config defaults (both clients): muteAudio false, masterVolume 1, soundVolume 1, musicVolume 1, highResTex true, screenShake true, anonPlayerNames false, touchMoveStyle/touchAimStyle "anywhere", touchAimLine true, region "na", gameModeIdx 2, teamAutoFill true [src:survev/client/src/config.ts:97-135] [src:derived/survev@8715a605:client/js/app.js:74384-74407] [H]
- Volume sliders were added in 0.3.1, the anonymized-names option in 0.4.3 [src:changelog/0.3.1] [src:changelog/0.4.3] [H]
- Languages (18): da Dansk, de Deutsch, en English, es Español, fr Français, it Italiano, nl Nederlands, pl Polski, pt Português, ru Русский, sv Svenska, vn Tiếng Việt, tr Türkçe, jp 日本語, ko 한국어, th ภาษาไทย, zh-cn 中文简体, zh-tw 中文繁體; files are fetched lazily from `l10n/<locale>.json` and fall back to English [src:survev/client/src/ui/localization.ts:15-60] [H]
- Localization history: Japanese 0.3.4; German, Spanish, French, Korean, Portuguese, Russian, Thai, Simplified Chinese 0.2.3; Traditional Chinese, Danish, Polish 0.2.4; Italian 0.2.5; Turkish 0.2.6 [src:changelog/0.3.4] [src:changelog/0.2.3] [src:changelog/0.2.4] [src:changelog/0.2.5] [src:changelog/0.2.6] [H]
- Korean (`ko.json`) sets `word-order` to SOV, which flips the pie-timer label order [src:l10n/ko:word-order] [src:survev/client/src/ui/ui.ts:725-736] [H]

## In-game (Esc) menu

- `#ui-game-menu` with two tabs on desktop, Settings and Keybinds (`#btn-game-settings`, `#btn-game-keybinds`); tabs are hidden on the small layout [src:survev/client/index.html:68-120] [src:survev/client/src/ui/touch.ts:431-442] [H]
- Settings tab: Full Screen, touch style buttons (move style, aim style) and Aim Line on touch devices, Sound (mute toggle) with Master/SFX/Music sliders, Quit Game; Resume button on desktop only [src:survev/client/index.html:68-120] [src:survev/client/src/ui/ui.ts:330-370] [H]
- Keybinds tab lists every bindable action with "Restore defaults" (`game-restore-defaults`) [src:survev/client/src/ui/ui.ts:2312-2323] [src:survev/client/src/inputBinds.ts:252-334] [H]
- Esc closes the menu, or the large map first; tapping the game canvas closes it on touch; opening the menu hides the perk-mode role picker until it is closed [src:survev/client/src/ui/ui.ts:2278-2310] [src:survev/client/src/ui/ui.ts:318-323] [H]
- On touch the menu opens from the `#ui-menu-display` button beside the minimap [src:survev/client/index.html:466] [src:survev/client/src/ui/ui.ts:302-305] [H]
- Full screen toggles also exist on the main page and on L in game (added 0.1.76) [src:changelog/0.1.76] [src:survev/client/index.html:1736] [H]

## Keybind modal (main menu)

- `#ui-modal-keybind`: list of binds, a share section with the bind code (`#keybind-link`, copy button) and an input (`#keybind-code-input`) to load a code; see `controls.md` for the format [src:survev/client/index.html:1744-1792] [src:survev/client/src/inputBinds.ts:96-146] [src:changelog/0.5.1] [H]

## Loadout (customize) menu

- `#modal-customize` with category tabs: outfit, melee, emote, heal (`heal_effect` particles), boost (`boost_effect` particles), crosshair (desktop only) and player icon (an emote shown next to the name); the same list exists in the original client [src:survev/client/src/ui/loadoutMenu.ts:138-230] [src:derived/survev@8715a605:client/js/app.js:39973-39995] [src:fandom/Loadout] [H]
- The loadout menu arrived in 0.8.0 (fandom: "Get a loadout", August 17 2019); before July 2020 it required an account (fandom) [src:changelog/0.8.0] [src:fandom/Loadout] [H]
- Item grid sorted by Newest (acquired), Alphabetical, Rarity or Subcategory; stock items always sort first; rarities Stock, Common, Uncommon, Rare, Epic, Mythic [src:survev/client/src/ui/loadoutMenu.ts:39-101] [src:survev/shared/gameConfig.ts:124-131] [src:l10n/en:loadout-rarity] [H]
- Selecting an item shows its name, rarity, source and lore and a live Pixi preview of the player (`LoadoutDisplay` in `opponentDisplay.ts`) [src:survev/client/index.html:1793-1870] [src:survev/client/src/ui/opponentDisplay.ts:1-60] [H]
- Emote tab: drag emotes onto a 6-slot wheel: top, right, bottom, left, win (auto-emote on win, default chicken) and death (auto-emote on death, default skull) [src:survev/client/src/ui/loadoutMenu.ts:20-30] [src:survev/shared/gameConfig.ts:33-41] [src:changelog/0.2.6] [src:fandom/Emotes] [H]
- Crosshair tab: a crosshair style plus colour picker (hex), size and stroke sliders; defaults white, size 1, stroke 0 [src:survev/client/index.html:1839-1876] [src:survev/shared/utils/loadout.ts:45-60] [src:fandom/Crosshairs] [H]
- The chosen loadout is saved in local config (`loadout`) and, when logged in, to the account (`/api/user/loadout`); survev also sends outfit, melee, heal, boost and emotes in the JoinMsg (fork), while the original sent a signed `loadoutPriv` token from the API [src:survev/client/src/config.ts:126] [src:survev/shared/net/joinMsg.ts:29-36] [src:derived/survev@8715a605:client/js/app.js:43585-43614] [src:derived/survev@8715a605:client/js/app.js:82164] [H]

## Account, profile, pass, news

- Login options: Google and Discord (plus a mock account in dev) in survev; the original offered Facebook, Google, Twitch and Discord [src:survev/server/src/api/routes/user/AuthRouter.ts:24-28] [src:derived/survev@8715a605:client/js/app.js:47589-47612] [H]
- Account modals: change account name, reset stats ("Enter RESET STATS"), delete account ("Enter DELETE"), create-account prompt ("Log in to access this feature!") [src:survev/client/index.html:795-951] [src:survev/client/index.html:2128] [src:l10n/en:index-reset-stats-desc] [H]
- The original client calls `/api/user/profile`, `/api/user/username`, `/api/user/loadout`, `/api/user/reset_stats`, `/api/user/delete`, `/api/user/logout`, `/api/user/unlock`, `/api/user/set_item_status`, `/api/user/get_pass`, `/api/user/set_pass_unlock`, `/api/user/refresh_quest`, `/api/user/set_quest`, `/api/user/delete_items` [src:derived/survev@8715a605:client/js/app.js:81861-82313] [H]
- Pass widget: pass name, level, XP bar, next unlock and two quest slots (`#pass-quest-0/1`); the original 0.8.82 pass is `pass_survivr1`, survev defaults to `pass_survivr2` (fork) [src:survev/client/index.html:1386-1504] [src:survev/config.ts:39] [src:derived/survev@8715a605:client/js/app.js:49863] [H]
- A stats site lives at `/stats` (leaderboards and player stats added 0.4.0, match history 0.4.1, mode filter 0.7.9) [src:changelog/0.4.0] [src:changelog/0.4.1] [src:changelog/0.7.9] [src:fandom/Statistics_Site] [H]
- News block `#news-wrapper` shows the latest changelog-style post; `lastNewsTimestamp` in config tracks the unread marker [src:survev/client/index.html:1505-1712] [src:survev/client/src/config.ts:130] [H]

## Other modals

- `#modal-refresh`: "A new version of surviv.io is available! Press OK below to reload the page." (shown on `invalid_protocol`) [src:derived/survev@8715a605:client/index.html:1398] [src:survev/client/src/main.ts:860-883] [H]
- `#modal-ip-banned` with reason and expiry (fork) [src:survev/client/index.html:2113-2127] [src:survev/client/src/main.ts:885-910] [H]
- `#modal-item-confirm` announces newly unlocked items [src:survev/client/index.html:2146-2160] [H]
- Portrait phones see "Rotate to landscape for a better experience." [src:survev/client/index.html:1048] [src:l10n/en:index-rotate-reminder] [H]

## Conflicts

- CONFLICT login-providers: original 0.8.82 offered Facebook, Google, Twitch, Discord [src:derived/survev@8715a605:client/js/app.js:47589-47612] vs survev offers Google, Discord (+ mock) [src:survev/server/src/api/routes/user/AuthRouter.ts:24-28]; proposed: accounts are optional for the rebirth; if added, use providers available today [L]
- CONFLICT loadout-transport: original sends `loadoutPriv`/`questPriv` tokens issued by the API in the JoinMsg [src:derived/survev@8715a605:client/js/app.js:43585-43614] vs survev sends the loadout item ids directly and the server checks unlocks [src:survev/shared/net/joinMsg.ts:29-36]; proposed: survev approach (simpler, no signing service) [L]
- CONFLICT mode-buttons: original buttons are fixed Solo/Duo/Squad with event maps chosen server-side [src:derived/survev@8715a605:client/index.html:864-867] vs survev restyles each button from the configured map def (icon, css, "50v50" text) [src:survev/client/src/siteInfo.ts:42-96]; proposed: survev approach (the original site_info also carried per-mode map info) [L]

## Open questions

- The original team-room code format and lobby timeouts are server-side and not in the client; survev's 4-character codes and 8-minute idle kick are reconstructions [src:survev/server/src/teamMenu.ts:345-382] [L]
- Fandom says Survivr Pass quests and the loadout needed an account until July 2020; whether 0.8.82 let logged-out players open the loadout menu is not confirmed by the client code [src:fandom/Loadout] [src:changelog/0.8.0] [L]
