# In-game HUD

> Scope: everything drawn over the game view while a match runs: health and boost bars, ammo, weapon slots, inventory, gear and perks, scopes, interaction prompt and action timer, messages, kill feed, kill leader, alive count, minimap and full map, team HUD, pings and emote wheel, spectate, death and win screens, faction role menu.
> Sources: survev client (`client/src/ui/ui.ts`, `ui2.ts`, `emote.ts`, `pieTimer.ts`, `client/index.html`, `client/css/game.css`), the decompiled original 0.8.82 client in survev's commit `8715a605` (`client/js/app.js`, `client/index.html`, cited as `derived/survev@8715a605:<path>:<line>`), the 2026 Kongregate relaunch bundle (`kong/relaunch-client-bundle`, protocol 78 = 0.8.82) and the fandom HUD/Minimap/Kill Leader/Kill Counter/Spectator Mode pages.
> Nearly all HUD widgets are DOM elements styled by `game.css` and driven by jQuery; the minimap, full map, emote/ping indicators, touch pads and the action pie timer are drawn with Pixi.

## Layout (desktop "Lg" layout)

| region | DOM id | contents | position (desktop CSS) | sources |
|---|---|---|---|---|
| top-left | `#ui-top-left` / `#ui-team` | team member list (duo/squad only) | `top:12px; left:12px` | [src:survev/client/index.html:401] [src:survev/client/css/game.css:1338-1343] [H] |
| top-centre | `#ui-top-center-scopes-wrapper` | scope buttons 1x/2x/4x/8x/15x | `top:0; left:50%` | [src:survev/client/index.html:500] [src:survev/client/css/game.css:1065-1070] [H] |
| top-centre | `#ui-top-center`, `#ui-waiting-text`, `#ui-spectate-text` | "Waiting for players", "Spectating <name>" | below scopes | [src:survev/client/index.html:500-520] [H] |
| upper-centre | `#ui-announcement` | gas and role announcements | centre | [src:survev/client/src/ui/ui.ts:1951-1960] [H] |
| top-right | `#ui-leaderboard-wrapper` | alive counter (`#ui-leaderboard-alive`, faction variant `#ui-leaderboard-alive-faction`), kill counter `#ui-kill-counter` | `top:12px; right:12px` | [src:survev/client/index.html:482-499] [src:survev/client/css/game.css:1559-1564] [H] |
| top-right | `#ui-kill-leader-wrapper` | kill leader name + count | `right:112px; top:0` (hidden on mobile) | [src:survev/client/index.html:471] [src:survev/client/css/game.css:1698-1702] [H] |
| top-right | `#ui-killfeed-wrapper` | kill feed, 6 lines | `top:60px; right:12px` (12px when the map has no kill leader) | [src:survev/client/css/game.css:1648-1653] [src:survev/client/src/ui/ui.ts:627-636] [H] |
| right-centre | `#ui-right-center` | medical items (`#ui-medical-interactive`) and ammo (`#ui-ammo-interactive`) | right edge | [src:survev/client/index.html:278] [src:survev/client/css/game.css:672] [H] |
| bottom-centre | `#ui-bottom-center-0` | boost bar + health bar | bottom | [src:survev/client/index.html:570] [H] |
| bottom-centre | `#ui-equipped-ammo-wrapper` | clip / reserve ammo (+ reload button on touch) | above health bar | [src:survev/client/index.html:559] [H] |
| bottom-centre-left | `#ui-bottom-center-left` | perk slots `#ui-perk-0..3` | left of health | [src:survev/client/index.html:594] [H] |
| bottom-centre-right | `#ui-bottom-center-right` | gear: `#ui-armor-helmet`, `#ui-armor-chest`, `#ui-armor-backpack` | right of health | [src:survev/client/index.html:624] [H] |
| bottom-right | `#ui-bottom-right` / `#ui-weapon-container` | weapon slots `#ui-weapon-id-1..4` | `bottom:12px; right:12px` | [src:survev/client/index.html:653] [src:survev/client/css/game.css:2729-2733] [H] |
| bottom-left | `#ui-map-wrapper` | minimap, gas timer (`#ui-map-info`), spectator counter (`#ui-spec-counter`), map expand/minimize/menu buttons | bottom-left | [src:survev/client/index.html:437-470] [src:fandom/Minimap] [H] |
| screen edges | `#ui-team-indicators` | off-screen teammate arrows | clamped 32px from the edge | [src:survev/client/index.html:241] [src:survev/client/src/ui/ui.ts:837] [H] |
| centre | `#ui-game-menu` | Esc menu (see `menus.md`) | centre | [src:survev/client/index.html:68] [H] |
- The original 0.8.82 `index.html` has the same HUD element ids as survev except `#ui-perk-3` (survev added a fourth perk slot), the ad containers and the debug editor (fork) [src:derived/survev@8715a605:client/index.html:529-549] [src:survev/client/index.html:594-623] [H]
- The fandom HUD page numbers 17 HUD parts on PC: scopes, notifications, kill leader, kill counter, alive count, consumables, ammunition, weapons, vest/helmet/backpack, health and adrenaline bar, perks, minimap, minimap expand, minimap hide, red zone timer, teammate direction icons, teammates [src:fandom/HUD] [M]
- Small layout (`UiLayout.Sm`) is used on phones, or when the longer screen side is ≤ 850 px, or ≤ 900 px at devicePixelRatio ≥ 3 [src:survev/client/src/device.ts:60-70] [H]
- On the Sm layout the minimap moves to the top-left (fandom: "maps in the mobile version appear in the top left corner"), the leaderboard block is hidden and the kill feed moves to `top:24px; left:6px` [src:survev/client/src/ui/ui.ts:2243-2247] [src:survev/client/src/ui/touch.ts:421-442] [src:survev/client/css/game.css:3997-4000] [src:fandom/Minimap] [H]
- The HUD scale factor is 0.5626 on Sm, otherwise `min(1, clamp(w/1280, 0.75, 1) * clamp(h/1024, 0.75, 1))`; it scales the minimap container [src:survev/client/src/ui/ui.ts:2143-2150] [H]
- `UiManager2` keeps a `UiState` object, diffs it against last frame's state and only writes changed DOM properties (diff/patch render) [src:survev/client/src/ui/ui2.ts:82-100] [src:survev/client/src/ui/ui2.ts:995-999] [H]

## Health bar

- Element `#ui-health-actual` (fill) over `#ui-health-depleted`; width = health % of the bar; max health is 100 [src:survev/client/src/ui/ui2.ts:1092-1150] [src:survev/shared/gameConfig.ts:190] [H]
- Displayed health is `max(health, 1)` while alive and 0 when dead, so a living player always shows a sliver [src:survev/client/src/ui/ui2.ts:681-684] [H]
- The local bar colour is a piecewise lerp: 100 → grey `[179,179,179]` exactly at full; 100–75 white `[255,255,255]`; 75–25 lerp `[255,158,158]` → `[255,82,82]`; ≤ 25 red `[255,0,0]` plus CSS class `ui-bar-danger` (pulsing); downed always `[255,0,0]` [src:survev/client/src/ui/ui2.ts:1092-1150] [H]
- Teammate bars (`updateHealthBar`) use a different palette: grey `(179,179,179)` at 100, white at ≥ 75, lerp dark pink `(255,45,45)` → light pink `(255,112,112)` above 25, `ui-bar-danger` at ≤ 25, red when downed [src:survev/client/src/ui/ui.ts:186-190] [src:survev/client/src/ui/ui.ts:2029-2080] [H]
- Faction maps show a red or blue arm-patch flair (`#ui-health-flair-left/right`, `img/gui/player-patch-red|blue.svg`) beside the health bar [src:survev/client/src/ui/ui.ts:891-901] [H]
- Health is sent as an 8-bit quantised float over 0–100 (≈ 0.39 HP steps), only when it changed [src:survev/shared/net/updateMsg.ts:12-13] [H]

## Boost (adrenaline) bar

- Four segments `#ui-boost-counter-0..3` above the health bar, widths weighted by `boostBreakpoints = [1, 1, 1.5, 0.5]` (sum 4, so 25 %, 25 %, 37.5 %, 12.5 % of the 0–100 boost range) [src:survev/client/src/ui/ui2.ts:1153-1166] [src:survev/shared/gameConfig.ts:196] [src:derived/survev@8715a605:client/js/app.js:77827] [H]
- The whole boost bar is hidden (opacity 0) when boost is 0 [src:survev/client/src/ui/ui2.ts:1165] [src:fandom/HUD] [H]
- Boost is sent as an 8-bit float 0–100 [src:survev/shared/net/updateMsg.ts:15-16] [H]

## Weapon slots and ammo

- Four slots, `#ui-weapon-id-1..4` = Primary, Secondary, Melee, Throwable (`WeaponSlot` enum 0–3); each shows the bind key's first character, name (`game-hud-<id>` or `game-<id>` l10n), image and, for guns/throwables, an ammo count [src:survev/client/src/ui/ui2.ts:45-50] [src:survev/client/src/ui/ui2.ts:1186-1222] [src:survev/shared/gameConfig.ts:116-122] [H]
- Equipped slot: background `rgba(0,0,0,0.4)`, opacity 1, and width animates from 83.33 % to 100 % (sine pulse over 0.09 s); other slots opacity 0.6; the opacity eases at 1/0.15 per second [src:survev/client/src/ui/ui2.ts:868-890] [src:survev/client/src/ui/ui2.ts:1203-1215] [H]
- An empty bugle slot is drawn at opacity 0.25 [src:survev/client/src/ui/ui2.ts:879-881] [H]
- The throwable slot's count is the inventory count of the equipped throwable type [src:survev/client/src/ui/ui2.ts:861-864] [H]
- Clicking a slot equips it; desktop players can drag slot 1 onto slot 2 (or vice versa) to swap guns, which sends `SwapWeapSlots` (added 0.4.3 together with the T key) [src:survev/client/src/ui/ui.ts:422-460] [src:changelog/0.4.3] [src:changelog/0.1.1] [H]
- Right-click (desktop) or touch-and-hold 750 ms (touch) on a slot drops that weapon (`DropItemMsg` with `weapIdx`) [src:survev/client/src/ui/ui2.ts:34] [src:survev/client/src/game.ts:663-688] [src:changelog/0.2.0] [H]
- Ammo display: `#ui-current-clip` (white, red when 0; hidden for melee) and `#ui-remaining-ammo` (reserve of the gun's ammo type, "∞" for `ammoInfinite` guns or the Endless Ammo perk, red when 0) [src:survev/client/src/ui/ui2.ts:893-910] [src:survev/client/src/ui/ui2.ts:1226-1250] [H]
- Touch devices show a reload button `#ui-reload-button-container`; tapping the clip/reserve/reload elements sends `Reload` [src:survev/client/src/ui/ui.ts:395-399] [src:survev/client/src/ui/ui2.ts:1014] [src:changelog/0.6.2] [H]

## Inventory, gear and perks

- Medical column `#ui-loot-bandage`, `#ui-loot-healthkit`, `#ui-loot-soda`, `#ui-loot-painkiller` and ammo column `#ui-loot-9mm`, `#ui-loot-12gauge`, `#ui-loot-762mm`, `#ui-loot-556mm`, `#ui-loot-50AE`, `#ui-loot-308sub`, `#ui-loot-flare`, `#ui-loot-45acp` [src:survev/client/index.html:278-398] [src:survev/client/src/ui/ui2.ts:1712-1730] [H]
- The item list is built from every heal/boost/ammo def without `hideUi`; count text turns orange `#ff9900` when the stack equals the backpack cap; items with 0 count show at opacity 0.25, and "special" ammo (`special: true`, e.g. .50 AE, .308 Sub, flare, .45 ACP) is hidden entirely at 0 [src:survev/client/src/ui/ui2.ts:102-118] [src:survev/client/src/ui/ui2.ts:1266-1280] [src:fandom/HUD] [H]
- .50 AE ammo started appearing in the loot UI when owned in 0.4.0 [src:changelog/0.4.0] [H]
- Item counts pop (scale 1 → 1.33, sine over 0.05 s) when they increase; disabled on mobile [src:survev/client/src/ui/ui2.ts:847-857] [src:survev/client/src/ui/ui2.ts:920-935] [H]
- Left-click an item = use (`useItem` in InputMsg), right-click = drop half the stack (`DropItemMsg`); keys 7/8/9/0 use bandage/med kit/soda/pills [src:survev/client/src/ui/ui2.ts:52-60] [src:survev/client/src/game.ts:648-656] [src:survev/server/src/game/objects/player.ts:4250-4292] [src:namu/Surviv.io] [H]
- Landscape/tablet layouts reorder ammo as 50AE, 9mm, 308sub, 12gauge, flare, 762mm, 45acp, 556mm; portrait uses 9mm, 12gauge, 762mm, 556mm, 50AE, 308sub, flare, 45acp [src:survev/client/src/ui/touch.ts:538-556] [H]
- Gear slots show helmet, chest and backpack (the default `backpack00` pouch is hidden); the level label is white, orange `#ff9900` for level 3, dark red `#b30000` for level 4; gear with `hasDesc` shows a tooltip [src:survev/client/src/ui/ui2.ts:940-970] [src:survev/client/src/ui/ui2.ts:1296-1312] [H]
- Perk slots: 3 in the original 0.8.82 UI (`ui-perk-0..2`, `perkUiCount` 3; a slot was added in 0.7.2), 4 in survev (commit `1cf4b8fd`, 2025-06-10, "Fourth perk UI") (fork) [src:derived/survev@8715a605:client/js/app.js:110559] [src:derived/survev@8715a605:client/index.html:529-549] [src:survev/client/src/ui/ui2.ts:35] [src:changelog/0.7.2] [src:derived/survev-git-1cf4b8fd] [H]
- New perks pulse (`ui-perk-pulse`) for 4 s on desktop; non-droppable perks get `ui-perk-no-drop` [src:survev/client/src/ui/ui2.ts:989] [src:survev/client/src/ui/ui2.ts:1327-1333] [H]
- Rare-loot / perk message (`#ui-perk-message-wrapper`): queued, shown 4 s (2 s if more are queued), fades over the last 0.2 s; XP loot shows "+N XP" [src:survev/client/src/ui/ui2.ts:624-643] [src:survev/client/src/ui/ui2.ts:1021-1050] [H]

## Scopes and zoom

- Scope buttons `#ui-scope-1xscope`, `2xscope`, `4xscope`, `8xscope`, `15xscope` appear only when owned; the equipped one gets `ui-zoom-active`; clicking one equips it ("Scope Zoom: Left-Click on Zoom") [src:survev/client/index.html:500-525] [src:survev/client/src/ui/ui2.ts:912-917] [src:survev/client/src/ui/ui2.ts:1252-1264] [src:l10n/en:index-scope-zoom-ctrl] [H]
- View radius in world units, desktop / mobile: 1x 28/32, 2x 36/40, 4x 48/48, 8x 68/64, 15x 104/88; the server sends the desktop value and mobile clients remap it [src:survev/shared/gameConfig.ts:399-414] [src:survev/client/src/objects/player.ts:622-633] [src:derived/survev@8715a605:client/js/app.js:77953-77967] [H]
- Camera zoom = `max(minDim·16/9, maxDim)·0.5 / (zoomRadius·16)`, so the zoom radius is the half-width of a 16:9 view; zoom lerps at rate 2 (in) / 1.4 (out), or 3 both ways right after a scope change [src:survev/client/src/game.ts:430-447] [src:derived/survev@8715a605:client/js/app.js:78337-78340] [H]
- The server forces the 1x radius inside buildings' zoom regions (some regions set their own radius), inside smoke (plus 0.5 s recovery) and while downed [src:survev/server/src/game/objects/player.ts:2134-2266] [src:fandom/Scopes] [H]
- Fandom: the bathhouse under the Crimson Ring Club uses the 4x view [src:fandom/Scopes] [M]

## Interaction prompt and action timer

- `#ui-interaction` shows "[key] text": types None, Cancel, Loot, Revive, Object; the key is the bind for Cancel, Loot/Interact, Use/Interact, Revive/Interact, or "<Unbound>" [src:survev/client/src/ui/ui2.ts:37-43] [src:survev/client/src/ui/ui2.ts:1641-1709] [H]
- Loot prompt text is `game-<type>` plus "(count)" when count > 1; a gun is not offered when both gun slots are full and fists are out, except on the small layout [src:survev/client/src/ui/ui2.ts:741-790] [src:survev/client/src/ui/ui2.ts:1669-1677] [H]
- Object prompts use the obstacle's interaction text (e.g. `game-open-door` / `game-close-door` / `game-unlock` + object name) [src:survev/client/src/ui/ui2.ts:1661-1668] [src:l10n/en:game-open-door] [H]
- Revive prompt appears for a downed same-team player within `reviveRange` 5 on the same layer; "Revive Self" with the self-revive perk [src:survev/client/src/ui/ui2.ts:793-830] [src:survev/shared/gameConfig.ts:212] [H]
- Touch devices show a tap icon (`img/gui/tap.svg`) instead of the key; tapping the prompt sends Interact + Cancel [src:survev/client/src/ui/ui2.ts:1005-1010] [src:survev/client/src/game.ts:621-624] [H]
- Action pie timer (Pixi): label "Reloading", "Using <item>" or "Reviving <name>" (word order flips for SOV locales such as Korean), a 6 px white arc on a 50 %-black disc, and a countdown with one decimal [src:survev/client/src/ui/ui.ts:690-745] [src:survev/client/src/ui/pieTimer.ts:98-112] [src:l10n/ko:word-order] [H]
- Action time and duration are each sent as 8-bit floats over 0–8.5 s plus a uint16 target id [src:survev/shared/net/updateMsg.ts:21-26] [src:survev/shared/net/net.ts:16] [H]

## Messages and announcements

- Pickup failure message `#ui-pickup-message` for 3 s: "Not enough space!", "Item already owned!", "Item already equipped!", "Better item equipped!", "Gun cannot be fired here!" (+ "max perks" in survev, fork) [src:survev/client/src/ui/ui2.ts:1352-1357] [src:survev/client/src/ui/ui2.ts:1628-1639] [src:derived/survev@8715a605:client/js/app.js:44294-44301] [H]
- Kill message `#ui-kills` for 7 s: "YOU killed <name> with <weapon>" / "YOU knocked out ..." / "YOU finally killed ..." plus "N kills"; when you are downed: "<killer> knocked YOU out with <weapon>" [src:survev/client/src/ui/ui2.ts:1359-1365] [src:survev/client/src/ui/ui2.ts:1550-1625] [src:survev/client/src/game.ts:1344-1375] [H]
- Announcement `#ui-announcement`: fade in 400 ms, hold 3 s, fade out 800 ms; used for "Red zone advances in N minutes S seconds", "Red zone advancing! Move to the safe zone" and "You've been promoted to <role>!" [src:survev/client/src/ui/ui.ts:1951-1989] [src:survev/client/src/game.ts:1460-1467] [src:l10n/en:game-red-zone-advances] [H]
- Gas timer `#ui-map-info` above the minimap: "m:ss" until the next gas stage; icon `gas-icon` while waiting and pulsing `danger-icon` while the zone moves [src:survev/client/src/ui/ui.ts:656-679] [src:fandom/HUD] [H]
- "Waiting for players" text shows until the game starts (Joined msg `started` false) [src:survev/client/src/game.ts:1243-1245] [src:survev/client/src/ui/ui.ts:1991-1994] [H]
- A notification sound `notification_start_01` plays on join if the tab is not focused (added 0.3.5) [src:survev/client/src/game.ts:1251-1256] [src:changelog/0.3.5] [H]

## Kill feed

- 6 lines (`maxKillFeedLines` 6 in survev and in the original), newest on top; each line fades in over 0.25 s, stays until 6 s and fades out by 6.5 s (no fade on mobile); line spacing 35 px (15 px on phone layout) [src:survev/client/src/ui/ui2.ts:33] [src:survev/client/src/ui/ui2.ts:664-678] [src:survev/client/src/ui/ui2.ts:1079] [src:derived/survev@8715a605:client/js/app.js:110557] [H]
- Texts: "<killer> killed/knocked out <target> with <weapon>", "<target> finally bled out", "<killer> finally killed <target>", "<target> died outside the safe zone", "The red zone knocked out <target>", "The air drop crushed/killed/knocked out <target>", "<killer> killed <target> with an air strike" / "The air strike killed <target>" [src:survev/client/src/ui/ui2.ts:1412-1485] [src:fandom/Kill_Counter] [H]
- Colours: `#d1777c` (red) when the victim is on your team, `#00bfff` (light blue) when your team got the kill, else `#efeeee`; all `#efeeee` in faction mode [src:survev/client/src/ui/ui2.ts:1487-1503] [src:fandom/Kill_Counter] [H]
- Role events also go to the feed: "<name> promoted to <role>!", "<killer> killed <role>!", "<role> is dead!", coloured by the role's `killFeed.color` or the team colour [src:survev/client/src/game.ts:1414-1505] [src:survev/client/src/ui/ui2.ts:1505-1548] [src:fandom/Kill_Counter] [H]
- The fandom "Kill Counter" page describes this kill feed (promotion and death notes) [src:fandom/Kill_Counter] [M]

## Kill counter, kill leader, alive count

- Local kill counter `#ui-kill-counter` (`.js-ui-player-kills`) updates from KillMsg `killerKills` when the local player gets kill credit; it is also shown on the large map (added 0.4.1) [src:survev/client/src/game.ts:1374-1377] [src:survev/client/index.html:493] [src:changelog/0.4.1] [H]
- Kill leader box shows name and kill count of the living player with the most kills, but only once someone has ≥ 3 kills (`killLeaderMinKills` 3); otherwise "Waiting for new leader" (Savannah sniper mode: "Searching for the Hunted") [src:survev/client/src/ui/ui.ts:1839-1851] [src:survev/shared/gameConfig.ts:226] [src:survev/server/src/game/objects/player.ts:545-549] [src:fandom/Kill_Leader] [H]
- The kill leader box is only shown on maps with `gameMode.killLeaderEnabled` (true on every map def) and is hidden on mobile [src:survev/client/src/ui/ui.ts:627-636] [src:survev/shared/defs/maps/baseDefs.ts:62-65] [src:fandom/Kill_Leader] [H]
- Kill leader data travels in UpdateMsg (`KillLeader` flag: uint16 id + uint8 kills) whenever it changes; becoming kill leader is announced with sound `leader_assigned_01` (Halloween: `kill_leader_assigned_01/02`) and dying with `leader_dead_01` (Halloween: `kill_leader_dead_01/02`) [src:survev/shared/net/updateMsg.ts:486-490] [src:survev/client/src/game.ts:1414-1440] [src:fandom/Kill_Leader] [H]
- The kill leader role (`kill_leader`; `the_hunted` on Savannah, which is also shown on the map) posts "<name> promoted to Kill Leader!" and "<killer> killed Kill Leader!" to the kill feed in orange `#ff8400` [src:survev/shared/defs/gameObjects/roleDefs.ts:428-450] [src:survev/client/src/game.ts:1442-1458] [src:fandom/Kill_Leader] [H]
- Alive counter: AliveCounts message with one count (`#ui-leaderboard-alive`) or two counts for faction mode (red/blue, `#ui-leaderboard-alive-faction`); sent on join and whenever the count changes [src:survev/client/src/game.ts:1584-1594] [src:survev/server/src/game/client.ts:467-471] [H]

## Minimap and full map

- Minimap: 256 px square with 16 px margin and 4 px black border on desktop; 192 px, 4 px margin, 1 px border on the small layout [src:survev/client/src/ui/ui.ts:1055-1074] [H]
- On the small layout the minimap size is multiplied by `screenScaleFactor` 0.5626, so the 192 px minimap is drawn about 108 px wide [src:survev/client/src/ui/ui.ts:1218] [src:survev/client/src/ui/ui.ts:2144-2145] [H]
- The map texture is drawn at `1600 / 1.2 ≈ 1333` px (× screen scale) and alpha 0.8, centred on the player, so the minimap shows a window of the map rather than the whole map ("semi-transparent and reveals slightly more of the map" since 0.3.0) [src:survev/client/src/ui/ui.ts:2216-2222] [src:survev/client/src/ui/ui.ts:747-754] [src:changelog/0.3.0] [H]
- Full map (M or G if unbound, click the minimap on desktop, tap on touch): sized to the smaller screen dimension, centred, alpha 1; Esc or the close button exits [src:survev/client/src/ui/ui.ts:2191-2208] [src:survev/client/src/game.ts:451-457] [src:fandom/Minimap] [H]
- V cycles the minimap between visible and hidden (visibility mode 0/1); Hide UI (unbound) toggles the whole HUD [src:survev/client/src/ui/ui.ts:1900-1924] [src:survev/client/src/game.ts:458-468] [H]
- The 0.2.4 "minimal HUD mode" on V was removed again in 0.3.0 [src:changelog/0.2.4] [src:changelog/0.3.0] [H]
- Map texture contents: background, terrain (water, beach, grass), black border, every map object with `map.display` on layer 0 drawn from its `map.shapes`, and place names (Arial bold 22 px, 20 px on mobile, white, alpha 0.75) [src:survev/client/src/map.ts:529-660] [src:survev/server/src/game/map.ts:1921-1923] [H]
- In-world ground draws a 16-unit grid of black lines at 15 % alpha [src:survev/client/src/map.ts:442-450] [src:survev/shared/gameConfig.ts:182] [H]
- Map overlay: gas as black at 60 % alpha outside the current circle, the next safe zone as a 1.5 px white circle, and a 2 px green (`0x00ff00`) line from the player to the safe-zone centre (alpha 0.5 when already inside; hidden on the full map) [src:survev/client/src/ui/ui.ts:1996-2026] [src:survev/client/src/gas.ts:140-155] [src:survev/client/src/ui/ui.ts:401] [src:namu/Surviv.io] [H]
- In the game world the gas is drawn red (`0xff0000`) at 60 % alpha with a 512-segment circular hole [src:survev/client/src/gas.ts:14] [src:survev/client/src/gas.ts:34] [src:survev/client/src/gas.ts:187] [H]
- Player dots: `player-map-inner.img` (scale 0.2, 0.15 on Sm), skull when dead, downed icons, role `mapIcon` overrides; own-group dots use group colours yellow `0xffff00`, magenta `0xff00ff`, cyan `0x00ffff`, orange `0xff5400` plus a white outer ring (`player-map-outer.img`, scale 0.3); other teams use team colours red `0xcc0000` / blue `0x007eff` [src:survev/client/src/ui/ui.ts:948-1052] [src:survev/shared/gameConfig.ts:306-307] [H]
- Teammate positions come from PlayerStatus (11-bit positions) every 0.25 s (0.5 s in faction mode); the client interpolates them and fades dots out 2–2.5 s after the last update [src:survev/shared/net/updateMsg.ts:107-125] [src:survev/shared/net/updateMsg.ts:726-731] [src:survev/client/src/objects/player.ts:2735-2760] [H]
- In 50v50, a player who shoots while within the view radius of at least one living enemy is revealed on the enemy team's map for 1 s; dead teammates and dead leaders stay on the map at 60 % alpha [src:survev/server/src/game/weaponManager.ts:1014-1025] [src:survev/server/src/game/objects/player.ts:3651-3664] [src:survev/client/src/objects/player.ts:2745-2751] [src:fandom/Minimap] [H]
- Map indicators (≤ 16, 4-bit id): pulsing icons for items/roles with `mapIndicator`, e.g. the Woods King helmet `helmet03_forest` (green `0x00ff00`) and The Hunted role (orange `0xff8400`) [src:survev/shared/net/updateMsg.ts:473-484] [src:survev/shared/defs/gameObjects/gearDefs.ts:683-691] [src:survev/shared/defs/gameObjects/roleDefs.ts:437-450] [src:fandom/Minimap] [H]
- Airstrike zones are drawn on the map from AirstrikeZone data (≤ 256 radius, ≤ 60 s) [src:survev/shared/net/updateMsg.ts:462-471] [src:survev/client/src/ui/ui.ts:2026] [H]
- Fandom: the minimap does not show underground areas, the Soviet crate or treasure chest, potatoes on the Potato map, or items and deaths except for teammates (and 50v50 roles) [src:fandom/Minimap] [M]
- The spectator counter (eye + number) sits above the minimap and only shows when someone is spectating you (added 0.3.1) [src:survev/client/src/ui/ui.ts:1873-1890] [src:changelog/0.3.1] [src:fandom/Spectator_Mode] [H]

## Team HUD

- Up to 4 team member rows (`#ui-team` `[data-id=0..3]`) with name, health bar, colour swatch and a status icon: disconnected, dead, or downed (pulsing); names fade to 0.3 opacity when dead or disconnected; rows only appear in duo/squad [src:survev/client/src/ui/ui.ts:509-550] [src:survev/client/src/ui/ui.ts:2082-2130] [src:fandom/HUD] [H]
- Teammate health comes from GroupStatus (7-bit float 0–100 + disconnected flag) whenever it changes [src:survev/shared/net/updateMsg.ts:151-156] [src:survev/server/src/game/client.ts:567-582] [H]
- Off-screen teammate indicators (`.ui-indicator-main`) point from the screen edge toward each teammate, 32 px inset (16 px and half size on Sm); not shown in faction mode [src:survev/client/src/ui/ui.ts:806-860] [H]
- A team member row is 48 px high; the spectate options move down by `rows × 48 + 12` px [src:survev/client/src/ui/ui.ts:243] [src:survev/client/src/ui/ui.ts:904-916] [H]

## Pings and emote wheel

- Emote wheel: hold the Emote Menu bind (right mouse), drag toward a wedge (dead zone 35 px), release to send; 4 wedges top/right/bottom/left plus a middle close button (added 0.2.4; customisation 0.2.6) [src:survev/client/src/emote.ts:330-371] [src:survev/client/src/emote.ts:851-865] [src:survev/client/src/emote.ts:956] [src:changelog/0.2.4] [src:changelog/0.2.6] [H]
- Team ping wheel: hold Team Ping Hold (C) then hold right mouse and drag; 6 wedges: top `ping_danger`, right `ping_coming`, bottom `ping_help`, bottom-left `emote_medical`, top-left ammo emote (switches to `emote_ammo9mm`, `emote_ammo12gauge`, `emote_ammo762mm`, `emote_ammo556mm`, `emote_ammo50ae`, `emote_ammo308sub`, `emote_ammoflare`, `emote_ammo45acp` for the held gun) [src:survev/client/src/emote.ts:374-430] [src:survev/client/src/emote.ts:960-985] [src:l10n/en:index-use-ping-ctrl] [H]
- "Team Ping Menu" (`TeamPingSingle`, unbound by default since 0.6.0) opens the ping wheel with one key [src:survev/client/src/emote.ts:842-849] [src:changelog/0.6.0] [H]
- Team-only emotes (medical and ammo, `teamOnly`) are greyed out in solo [src:survev/client/src/emote.ts:938-941] [src:survev/shared/defs/gameObjects/emoteDefs.ts:26-31] [H]
- The wheel closes by itself after 10 s; the cursor aim is frozen while the wheel is open [src:survev/client/src/emote.ts:31] [src:survev/client/src/emote.ts:920-926] [src:survev/client/src/game.ts:484-487] [H]
- Emote throttle (client and server): each emote/ping adds 1 to a counter; at 6 (`emoteThreshold`) emotes are blocked for 9 s (`emoteHardCooldown` 6 × 1.5); otherwise the counter decays by 1 every 3 s (`emoteSoftCooldown` 2 × 1.5); wheels grey to 50 % while blocked [src:survev/shared/gameConfig.ts:215-217] [src:survev/client/src/emote.ts:886-934] [src:survev/server/src/game/objects/player.ts:1586-1598] [src:survev/server/src/game/objects/player.ts:4344-4390] [H]
- Emote display over a player: 0.75 s in, 1 s hold, 0.1 s out; world pings fade in 0.5 s and last 4.25 s [src:survev/client/src/emote.ts:184-188] [H]
- Ping defs: `ping_danger` (map 4 s), `ping_coming` (map 300 s), `ping_help` (map 4 s) are player pings; map-event pings `ping_airdrop` (orange `0xff6600`, 10 s), `ping_airstrike` (`0xeaff00`, 2 s), `ping_woodsking` (`0x12ff00`, 10 s), `ping_unlock` (`0x00d8ff`, 10 s) [src:survev/shared/defs/gameObjects/pingDefs.ts:21-106] [H]
- Player pings use the pinger's group colour, team colour for other teams, and green `0x00ff00` for a faction leader; each new ping replaces that player's previous map ping [src:survev/client/src/ui/ui.ts:1110-1160] [src:namu/Surviv.io] [H]
- Off-screen ping/airdrop indicators show at the screen edge (4 group slots + airdrop + airstrike slots, indices 4 and 5) [src:survev/client/src/emote.ts:29-30] [src:survev/client/src/emote.ts:524-545] [H]
- Default emote loadout: `emote_happyface`, `emote_thumbsup`, `emote_surviv`, `emote_sadface`, win and death slots empty [src:survev/shared/gameConfig.ts:274-281] [src:derived/survev@8715a605:client/js/app.js:77845-77852] [src:fandom/Emotes] [H]
- The server rejects non-team emotes that are not in the player's 4 wheel slots and player pings of `mapEvent` types; regular emotes reach everyone who can see the player, pings reach the group (faction leaders' reach the whole team) [src:survev/server/src/game/objects/player.ts:4341-4382] [src:survev/server/src/game/client.ts:584-630] [H]
- On touch the emote wheel opens from the "surviv icon" button `#ui-emote-button`; pings are placed by opening the map and tapping [src:survev/client/src/ui/ui2.ts:1015] [src:l10n/en:index-use-ping-ctrl-touch] [src:l10n/en:index-use-emote-ctrl-touch] [H]

## Spectate

- After death the stats screen offers "Spectate"; in solo you first watch your killer (if alive), in teams your living teammates, then other players once your team is out (opponent spectating added 0.6.7) [src:survev/server/src/game/client.ts:776-835] [src:changelog/0.6.7] [src:fandom/Spectator_Mode] [H]
- When the watched player dies the server switches target after 2 s, except when watching your own fully dead team (so the "team eliminated" screen stays) [src:survev/server/src/game/client.ts:383-405] [H]
- Next/Prev buttons (`#btn-spectate-next-player`, `#btn-spectate-prev-player`, hidden in solo) and the Left/Right arrow keys (arrows since 0.3.1) send SpectateMsg; cooldown 0.1 s while spectating teammates, 1 s otherwise [src:survev/client/src/ui/ui.ts:1760-1775] [src:survev/client/src/game.ts:707-722] [src:survev/server/src/game/client.ts:762-765] [src:changelog/0.3.1] [H]
- "View Match Stats"/"Hide Match Stats" toggles a table of your kills, damage dealt, damage taken and survival time; "Leave Game" quits [src:survev/client/src/ui/ui.ts:1777-1808] [src:l10n/en:game-view-match-stats] [src:changelog/0.2.0] [H]
- "Spectating <name>" text shows at the top centre [src:survev/client/src/ui/ui.ts:1741-1758] [src:l10n/en:game-spectating] [H]
- Fandom: mobile solo spectators cannot switch players [src:fandom/Spectator_Mode] [M]

## Death and win screens

- On death in a team game that is still running you get PlayerStats: header "You died.", kills, buttons "Play New Game" and "Spectate" fading in from ≈ 4.4 s [src:survev/client/src/ui/ui.ts:1633-1720] [src:survev/client/src/game.ts:1507-1512] [H]
- GameOver (your team is out, or the game ended) shows the full stats screen after 1.75 s (win) or 2.5 s (loss) with a 1 s fade [src:survev/client/src/ui/ui.ts:1372-1613] [src:survev/client/src/game.ts:1518-1560] [H]
- Titles: win "Winner winner chicken dinner!" (Turkey map: "Winner winner turkey dinner!"), solo loss "You died.", team loss "Your team was eliminated.", spectating another team "<name> won the game." / "<name> died." [src:survev/client/src/ui/ui.ts:1304-1335] [src:l10n/en:game-chicken] [src:l10n/ko:game-chicken] [H]
- Header overview: "<Solo|Duo|Squad> Rank #N" and, in teams, "Team Kills N"; in faction mode the red and blue team alive counts [src:survev/client/src/ui/ui.ts:1337-1364] [H]
- One card per team member (250 px apart, 125 px on phones): name, Kills, Damage Dealt, Damage Taken, Survived (h m s); dead members get a status style [src:survev/client/src/ui/ui.ts:1458-1492] [H]
- Faction game-over cards add badges: red leader (2nd card), blue leader (3rd), team ribbon (4th) [src:survev/client/src/ui/ui.ts:1493-1522] [H]
- Buttons: "Play New Game" always; "Spectate" only while players remain [src:survev/client/src/ui/ui.ts:1524-1552] [H]
- The winner hears victory music 1.3 s after the screen: `menu_music` in the original client, the map's `biome.ambience.music` in survev (fork) [src:derived/survev@8715a605:client/js/app.js:79226-79233] [src:survev/client/src/game.ts:1550-1557] [H]
- The server sends the win emote 1 s after the last opponent dies and closes the game 1.8 s later [src:survev/server/src/game/game.ts:360-363] [H]

## Faction role menu (perk mode, Cobalt)

- On perk-mode maps a role picker (`#ui-role-menu`) opens on join with the map's `perkModeRoles` (Cobalt: scout, sniper, healer, demo, assault, tank); it shows each role's image, name and perks and auto-confirms after 20 s (`perkModeRoleSelectDuration`), playing `ambient_lab_01` meanwhile [src:survev/client/src/game.ts:1282-1294] [src:survev/client/src/ui/ui.ts:919-945] [src:survev/client/src/ui/ui.ts:2325-2443] [src:survev/shared/gameConfig.ts:228] [H]
- The choice is sent as PerkModeRoleSelectMsg and saved as `perkModeRole` in local config [src:survev/client/src/game.ts:690-699] [H]
- Emotes are disabled on perk-mode maps until a role is chosen [src:survev/client/src/emote.ts:881-883] [src:survev/server/src/game/objects/player.ts:4342] [H]

## Conflicts

- CONFLICT perk-slot-count: 3 perk slots in the original 0.8.82 client and the 2026 relaunch [src:derived/survev@8715a605:client/js/app.js:110559] [src:kong/relaunch-client-bundle] vs 4 in survev [src:survev/client/src/ui/ui2.ts:35]; proposed: 3 for the 0.8.82 target, 4 as an optional fork setting [L]
- CONFLICT victory-music: original plays `menu_music` (menu_music_01) on every win [src:derived/survev@8715a605:client/js/app.js:79226-79233] vs survev plays the map's `biome.ambience.music` (Halloween: `menu_music_02`) [src:survev/client/src/game.ts:1550-1557]; proposed: original behaviour [L]
- CONFLICT kill-leader-location: fandom says the kill leader shows top right on PC and top left on mobile [src:fandom/Kill_Leader] vs survev hides `#ui-kill-leader-wrapper` on mobile (`hide-on-mobile`) [src:survev/client/index.html:471]; proposed: follow the code (fandom notes that many mobile devices did not show it) [L]
- CONFLICT minimap-toggle-keys: fandom Controls lists "M, G" for the map and the l10n how-to-play says "M or G" [src:fandom/Controls] [src:l10n/en:index-view-map-ctrl] vs the bind table only binds M; G works only while unbound [src:survev/client/src/game.ts:451-457]; proposed: both are true, keep G as an unbound fallback [L]

## Open questions

- Fandom says mobile had aim assist and an option to auto-punch crates; neither exists in the survev or original 0.8.82 web client code, so it is probably native-app or post-0.8.82 behaviour [src:fandom/Surviv.io_Mobile] [src:survev/client/src/ui/touch.ts:580-660] [L]
- The original server's exact kill-leader rule (tie-breaking, when the role moves) is not in the client; survev picks the living player with the most kills ≥ 3 [src:survev/server/src/game/objects/player.ts:545-549] [src:fandom/Kill_Leader] [L]
