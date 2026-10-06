# Visual diff: recorded survev.io gameplay vs the rebirth client

> Ten desktop recordings of survev.io (the survev client: the original 0.8.82 client plus fork additions; its menu shows the SURVEV.IO logo), 1704 x 1066 at 60 fps, about 36 minutes, with the Korean UI. The game area is the frame below the 163 px browser bar (1704 x 903).
> Method: keyframe contact sheets of every video, full-resolution crops and frame steps around the player, then the same situation in the rebirth loopback sandbox with the original assets, screenshotted by Playwright at 1704 x 903 (device pixel ratio 1, and 2 where text size depends on it) and compared side by side. Animation timing was compared by stepping a faked clock frame by frame. Images stay in the session scratchpad; nothing here embeds them.
> Video evidence is cited as `[src:web/<file>@<m:ss>]`; a recording alone is rated `[M]` (one observation of the fork client), `[H]` needs the original client or survev source next to it.
> The recorder's browser ran at a device pixel ratio above 1 (teammate and dead-body names use the original's 30 px high-density font), with the CSS viewport equal to the captured size.
> Classes: (a) rebirth bug against the original 0.8.82 behaviour, fixed; (b) survev fork addition or change, rebirth keeps the original; (c) unclear or deliberate, left as is and noted.

## Recordings

| file | length | map / mode | notable scenes | sources |
|---|---|---|---|---|
| play.mkv | 4:04 | Normal (main), squad | red house doors, club pool room, club vault, smoke grenade, big map, emote wheel, downed enemy and loot pile, 8x scope, frag explosion, heal timer, squad win | [src:web/play.mkv@0:00] [src:web/play.mkv@4:00] [M] |
| v2040-05.mkv | 5:55 | Normal, squad | waiting for players, pier hut, mansion and cellar, barn, river wading, lab bunker with smoke, club pool room in the red zone, team eliminated (rank #3) | [src:web/v2040-05.mkv@0:08] [src:web/v2040-05.mkv@5:50] [M] |
| v2046-11.mkv | 3:03 | Normal, squad | mansion and cellar, most of the match inside the red zone, big map, death | [src:web/v2046-11.mkv@0:16] [src:web/v2046-11.mkv@1:15] [M] |
| v2049-22.mkv | 6:42 | Normal, squad | greenhouse and its basement, lab bunker, woods, club, vault and pool, smoke grenades, heal timer with tooltip, emote wheel, last circles | [src:web/v2049-22.mkv@0:08] [src:web/v2049-22.mkv@6:40] [M] |
| v2056-08.mkv | 3:04 | Normal, squad | house, river and containers, basement, club, vault, big map, red zone, frag explosion, bunker stairs, house fight with blood and loot | [src:web/v2056-08.mkv@0:08] [src:web/v2056-08.mkv@3:03] [M] |
| v2059-17.mkv | 0:32 | Normal, squad | red zone announcement, container yard, warehouse fight, downed | [src:web/v2059-17.mkv@0:04] [src:web/v2059-17.mkv@0:29] [M] |
| v2100-13.mkv | 3:55 | Normal, squad | waiting, cabin, big map, bunker hatch, red house and cellar, pickup messages, club bar and bathrooms, smoke, loot piles, squad win (team kills 8) | [src:web/v2100-13.mkv@0:00] [src:web/v2100-13.mkv@3:53] [M] |
| v2104-13.mkv | 0:55 | Normal, squad | bunker stairs, lab bunker, ping, smoke, downed, death screen | [src:web/v2104-13.mkv@0:12] [src:web/v2104-13.mkv@0:54] [M] |
| v2105-13.mkv | 0:51 | Normal, squad | red house with teammates, woods, emote wheel, river with bushes and pings, downed, death screen | [src:web/v2105-13.mkv@0:04] [src:web/v2105-13.mkv@0:50] [M] |
| v2106-08.mkv | 7:15 | Savannah, solo (three games) | "Searching for the Hunted", rivers and fork oasis lakes, big map, 8x and 15x scopes, warehouse heal, dead body, spectating, solo death (rank #15), fork Cloud Bunker, kill leader | [src:web/v2106-08.mkv@0:04] [src:web/v2106-08.mkv@5:25] [src:web/v2106-08.mkv@5:58] [M] |

## Scene catalogue

| scene | recording | compared with | sources |
|---|---|---|---|
| HUD at rest: team rows, kill leader, alive count, inventory column, gear, health and boost bars, weapon slots, minimap with gas timer | play.mkv 3:20, v2049-22.mkv 4:05, v2040-05.mkv 3:02 | squad sandbox with gear and guns, Korean UI | [src:web/play.mkv@3:20] [src:web/v2049-22.mkv@4:05] [src:web/v2040-05.mkv@3:02] [M] |
| shooting a pot in a pier hut: muzzle, casings, pot chips and break | v2040-05.mkv 0:24-0:26 | groza at the same distance in hut_01, frame-stepped | [src:web/v2040-05.mkv@0:24] [M] |
| frag explosion: burst, scatter streaks, scorch decal, shake | v2056-08.mkv 2:46 | `explosion_frag` in the open, frame-stepped | [src:web/v2056-08.mkv@2:46] [M] |
| smoke grenade cloud | v2049-22.mkv 4:05, play.mkv 2:24 | thrown smoke after full growth | [src:web/v2049-22.mkv@4:05] [src:web/play.mkv@2:24] [M] |
| heal timer and cancel prompt | play.mkv 1:04, v2049-22.mkv 4:05 | soda use in Korean and English | [src:web/play.mkv@1:04] [src:web/v2049-22.mkv@4:05] [M] |
| loot rings and pickup prompt | v2056-08.mkv 1:40, play.mkv 2:54 | 9mm, M4A1, vest, frag and 12 gauge on the ground | [src:web/v2056-08.mkv@1:40] [src:web/play.mkv@2:54] [M] |
| kill feed (white, team-victim red) and kill leader | v2040-05.mkv 3:02, play.mkv 3:20 | three scripted kills in a squad sandbox | [src:web/v2040-05.mkv@3:02] [src:web/play.mkv@3:20] [M] |
| teammate names, downed teammate, team ping | v2056-08.mkv 1:40, play.mkv 2:54 | two teammates, one knocked, a danger ping | [src:web/v2056-08.mkv@1:40] [src:web/play.mkv@2:54] [M] |
| emote wheel | v2105-13.mkv 0:33 | right-mouse wheel (M6 screenshot) | [src:web/v2105-13.mkv@0:33] [M] |
| big map | v2056-08.mkv 0:12, v2106-08.mkv 0:45 | M key in a squad sandbox | [src:web/v2056-08.mkv@0:12] [src:web/v2106-08.mkv@0:45] [M] |
| red zone overlay | v2046-11.mkv 1:15 | M4 gas screenshot | [src:web/v2046-11.mkv@1:15] [M] |
| dead body | v2106-08.mkv 2:57 | killed dummy (M9 screenshot) | [src:web/v2106-08.mkv@2:57] [M] |
| spectating | v2106-08.mkv 3:03 | M4 spectate screenshot | [src:web/v2106-08.mkv@3:03] [M] |
| team death screen | v2105-13.mkv 0:50 | M6 team death | [src:web/v2105-13.mkv@0:50] [M] |
| squad win screen | play.mkv 4:00, v2100-13.mkv 3:53 | scripted squad win | [src:web/play.mkv@4:00] [src:web/v2100-13.mkv@3:53] [M] |
| Savannah terrain and HUD | v2106-08.mkv 6:44 | Savannah sandbox near an acacia | [src:web/v2106-08.mkv@6:44] [M] |
| club pool room | play.mkv 1:04 | club basement pool | [src:web/play.mkv@1:04] [M] |

## Differences

| id | element | recording | rebirth before | original 0.8.82 | class and resolution | sources |
|---|---|---|---|---|---|---|
| armour-level | gear level label ("레벨 2") | above the helmet, chest and backpack boxes | inside the box at its bottom edge; 13 px in Korean | in-flow label moved up 24 px, 16 px for every language | (a) fixed: 24 px above the box, no Korean override (`apps/client/src/ui/hud.css`) | [src:web/v2049-22.mkv@4:05] [src:survev/client/css/game.css:2649-2657] [src:kong/relaunch-client-bundle] [H] |
| gear-boxes | gear box spacing | boxes 4 px apart with transparent 2 px outlines | no margin, no outline border | `.ui-armor-counter` margin-left 4 px, helmet and chest carry `ui-outline-hover`, backpack a transparent 2 px border | (a) fixed on the large layout; the small layout keeps its offsets (`hud.css`, `hud.ts`, `hudSmBottom.css`) | [src:survev/client/index.html:625-651] [src:survev/client/css/game.css:2629-2648] [src:web/v2049-22.mkv@4:05] [H] |
| weapon-width | equipped weapon slot | equipped slot as wide as the others (160 px) | stayed 100 % (192 px) while equipped | sine pulse 83.33 → 100 → 83.33 % over 0.09 x π s after equipping | (a) fixed: `slotPulseWidth` in `apps/client/src/ui/uiLayout.ts`, driven per frame by `hud.ts`; CSS width transition removed | [src:web/play.mkv@3:20] [src:survev/client/src/ui/ui2.ts:847-856] [src:survev/client/src/ui/ui2.ts:1211-1214] [H] |
| hud-shadows | weapon names, slot numbers, item counts | plain white text | 1 px black text shadow | no text shadow on these (only the gear level, bullet counter and messages have one) | (a) fixed (`hud.css`) | [src:web/play.mkv@3:20] [src:survev/client/css/game.css:2782-2797] [src:survev/client/css/game.css:1865-1871] [src:kong/relaunch-client-bundle] [H] |
| map-buttons | minimap magnifier and minimize buttons | both drawn over the minimap's bottom corners | missing | `#ui-settings-container-desktop` with `mag-glass.svg` and `minimize.svg`; the magnifier toggles the big map, minimize the minimap | (a) fixed: `apps/client/src/ui/minimapButtons.ts` / `.css`, wired in `game/clientControls.ts` (desktop only) | [src:web/play.mkv@3:20] [src:survev/client/index.html:447-454] [src:survev/client/src/ui/ui.ts:289-307] [H] |
| view-rect | minimap camera rectangle | none | a white 60 % rectangle of the camera view | the minimap container has no such shape | (a) fixed: removed (`apps/client/src/ui/minimap.ts`) | [src:web/play.mkv@3:20] [src:survev/client/src/ui/ui.ts:476-481] [H] |
| map-labels | place names on the big map | about 22 px tall | about 30 px (texture fixed at 1333 px with 22 px labels, then scaled up) | texture as tall as the screen, labels 22 px at that size | (a) fixed: labels sized as on the original's screen-height texture (22 px on the big map); the texture itself is rendered at the device resolution and at least 1333 px so the minimap stays sharp (`apps/client/src/ui/minimap.ts`) | [src:web/v2056-08.mkv@0:12] [src:survev/client/src/map.ts:536-544] [src:survev/client/src/map.ts:629-656] [H] |
| name-font | teammate names in the world | 15 px cyan text | always 11 px (22 px at half scale) | 30 px at half scale when devicePixelRatio > 1, else 22 px | (a) fixed (`apps/client/src/objects/teamNames.ts`; dead-body names already did this) | [src:web/v2056-08.mkv@1:40] [src:survev/client/src/objects/player.ts:59-80] [H] |
| stats-header | end screen rank and team kills | 32 px labels, 48 px values, blocks about 100 px apart | 24 px labels and values, 32 px apart | `span.ui-stats-header-stat` 32 px, `-value` 48 px bold with 24 px margin, 100 px between blocks | (a) fixed (`apps/client/src/ui/gameOver.css`, phone sizes too) | [src:web/play.mkv@4:00] [src:web/v2100-13.mkv@3:53] [src:survev/client/css/game.css:2922-2944] [H] |
| stats-logo | logo on the end screen | SURVEV.IO logo in the top-left corner | no logo | `#ui-stats-logo` with `surviv_logo_full.png`, hidden on the team "You died." screen | (a) fixed with the original surviv.io logo; the SURVEV.IO artwork itself is (b) (`gameOver.ts`, `gameOver.css`) | [src:web/play.mkv@4:00] [src:survev/client/css/game.css:894-920] [src:survev/client/src/ui/ui.ts:1398] [src:survev/client/src/ui/ui.ts:1638] [H] |
| leader-style | kill leader box text | "cat ⌖ 5" without text shadow, a space-wide gap on each side of the icon | 1 px text shadow, 4 px margins around the icon | no shadow; the 2019 markup has line breaks (spaces) between name, icon and count, the 2026 relaunch index.html is minified | (a) shadow removed, margins replaced by the markup's spaces (`apps/client/src/ui/match.css`, `matchHud.ts`); (c) the relaunch's minified markup would have no gaps | [src:web/play.mkv@3:20] [src:derived/survev@8715a605:client/index.html:406-410] [src:survev/client/css/game.css:1712-1735] [H] |
| ko-leader | Korean "waiting for new leader" | "새로운 킬 리더 대기 중" | "새 지휘관 대기 중" | the original ko.json said "새로운 리더 대기 중"; survev rewrote it on 2026-03-24 | (b) kept the KB choice (`l10n-ko.md` FIX leader-killleader) | [src:web/v2040-05.mkv@3:02] [src:survev/client/public/l10n/ko.json:264] [src:derived/survev-git-4d5acbc8] [H] |
| branding | menu, logo, Ko-fi panel, SURVEVR PASS 2 | survev menu at every video start | original-style start page | survev fork menu | (b) kept the original | [src:web/play.mkv@0:00] [src:survev/client/index.html:1719] [H] |
| savannah-fork | Savannah oasis ring lakes, second river, Cloud Bunker | ring lakes on the big map, a dark red bunker interior | absent | fork v0.4.2 (Cloud Bunker) and v0.4.3 (oasis, second river) | (b) kept the original map | [src:web/v2106-08.mkv@0:45] [src:web/v2106-08.mkv@5:58] [src:survev/client/public/changelogRec.html:36-48] [H] |
| solo-spectate | spectate buttons in solo | only "매치 현황 보기" and "게임 떠나기" | adds Next Player and Previous Player | hidden in solo (`hideSpec = teamMode == Solo`) | (c) deliberate rebirth addition documented in `matchHud.ts`; not changed, flagged for a decision | [src:web/v2106-08.mkv@3:03] [src:survev/client/src/ui/ui.ts:1760-1768] [H] |
| reload-alt | Mosin full reload sound | (not compared in a recording; raised in review) | the view collapsed the sim's "reloadAlt" to "reload", so every Mosin reload played `sound.reload` | Action.ReloadAlt plays `sound.reloadAlt` (`mosin_reload_02`) | (a) fixed: `PlayerView.action.alt` (type stays "reload" so HUD, timers and bot perception keep treating it as a reload), one wire bit, schema version 8, `apps/client/src/fx/effects.ts` picks `reloadAlt` | [src:survev/client/src/objects/player.ts:1915-1930] [src:survev/server/src/game/weaponManager.ts:530-541] [src:derived/sim-weapons-test] [H] |
| scorch-frame | first frame of an explosion | burst and scorch decal appear together | the scorch decal shows one frame before the burst particle | same frame (decal under the burst) | (c) one 16 ms frame; not changed | [src:web/v2056-08.mkv@2:46] [src:derived/frame-step-60fps] [L] |

## No difference found

- Shooting: muzzle flash, brass casings ejected to the right and tumbling about 0.5 s, pot chips and the pot's break debris match in size, colour and lifetime at the same zoom [src:web/v2040-05.mkv@0:24] [src:derived/frame-step-60fps] [M]
- Frag explosion: a small dark-centred burst grows with long grey streaks for about 0.4 s and leaves a black scorch decal; the camera shakes [src:web/v2056-08.mkv@2:46] [src:survev/client/src/objects/explosion.ts:358] [H]
- Red zone: the red overlay over grass reads orange, the gas timer box and the minimap gas and safe-zone line match [src:web/v2046-11.mkv@1:15] [src:survev/client/src/game.ts:229] [H]
- Smoke grenade: soft light grey clouds about 12 units across, drawn above players, growing from three start clouds [src:web/v2049-22.mkv@4:05] [src:survev/server/src/game/objects/smoke.ts:10-44] [H]
- Pie timer: a 35 px white arc on a 27 % black disc with a one-decimal countdown, and the "X 취소" cancel prompt with the same boxes [src:web/play.mkv@1:04] [src:survev/client/src/ui/pieTimer.ts:98-117] [H]
- Loot rings, the "F 9mm (45)" pickup prompt, pickup messages ("충분한 공간이 없습니다!", "아이템을 이미 보유하고 있습니다!") [src:web/v2056-08.mkv@1:40] [src:web/v2100-13.mkv@1:10] [M]
- Kill feed: 16 px bold lines on 40 % black, white for others, red `#d1777c` when the victim is on the active team, 35 px apart under the kill leader [src:web/v2040-05.mkv@3:02] [src:survev/client/src/ui/ui2.ts:1487-1503] [H]
- Knock-out message stays half English like the original ("Lag vai dai knocked 당신 out 을(를). 사용무기: M416") [src:web/v2105-13.mkv@0:50] [src:survev/client/src/ui/ui2.ts:1600-1626] [H]
- Team HUD rows (name, colour dot, health bar), dead body (grey skull and name), emote wheel quadrants, big map hiding the HUD except the team rows, alive count and kills [src:web/play.mkv@3:20] [src:web/v2106-08.mkv@2:57] [src:web/v2105-13.mkv@0:33] [src:web/v2056-08.mkv@0:12] [M]
- Squad win and team death screens: title, card layout and button match once the header sizes and the logo were fixed [src:web/play.mkv@4:00] [src:web/v2105-13.mkv@0:50] [M]
- Camera zoom: 1x inside the pier hut's zoom region, scopes 2x to 15x in the open; the player body spans the same pixels at the same scope [src:web/v2040-05.mkv@0:25] [src:survev/client/src/game.ts:428-446] [H]

## Tests

- `tests/e2e/m9-visual.spec.ts` checks the armour label position, the slot pulse and final width, the minimap buttons (position, big map toggle, minimize toggle), the big map's 22 px place names, the name font at pixel ratio 1 and 2, and the end screen's 32 / 48 px header and logo [src:derived/m9-visual-spec] [H]
- `apps/client/test/layout.test.ts` checks `slotPulseWidth` [src:derived/layout-test] [H]
