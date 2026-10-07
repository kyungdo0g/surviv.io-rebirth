# Doors, windows, ceilings and layers

> Doors, windows and walls are obstacles inside building defs. Ceilings and zoom regions belong to building defs, while stairs and multi-floor layouts belong to structure defs. All these definitions are client-visible; the 0.8.82 relaunch bundle contains every door id survev uses except the fork-only `vault_door_reserve`. Door behaviour (open direction, auto open/close, unlock timing) and layer switching are survev server code.

## Door kinds

| id | material / HP | kind | interaction rad | flags | used in | status | sources |
|---|---|---|---|---|---|---|---|
| `house_door_01` | wood, 150 HP, destructible | hinged | 0.75 | — (does not switch layer near stairs) | houses, barns, police, mansion, club … | original | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:243-248] [src:kong/relaunch-client-defs] [src:fandom/Door] [H] |
| `house_door_02` | metal, indestructible | hinged | 0.75 | reflects bullets | barns, bunkers, candy store | original | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:249-262] [src:kong/relaunch-client-defs] [src:fandom/Metal_Door] [H] |
| `house_door_03` | wood, 150 HP | hinged (wider collider) | 0.75 | — | — | original | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:263-269] [src:kong/relaunch-client-defs] [H] |
| `house_door_05` | glass, 150 HP | hinged | 0.75 | — | — | original | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:270-276] [src:kong/relaunch-client-defs] [H] |
| `house_door_06` | wood, 150 HP, destructible (sprite `map-door-06.img`, hinge (0,1.25), 2.5 u long) | hinged | 0.75 | — | no 0.8.82 building places it | original, client only (absent from survev) | [src:kong/relaunch-client-defs] [M] |
| `crossing_door_01` | metal | hinged, button-only | 0.75 | `canUse false`, `openOnce` | crossing bunker storage (`control_panel_04`, 4.25 s) | original | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:277-291] [src:kong/relaunch-client-defs] [src:fandom/Bunkers] [H] |
| `cell_door_01` | metal | hinged, button-only | 0.75 | `canUse false`, `openOnce` | police cells (`control_panel_01`, 1.1 s) | original | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:292-306] [src:kong/relaunch-client-defs] [H] |
| `eye_door_01` | metal | hinged, puzzle | 0.75 | `canUse false`, `openOnce`, `openOneWay −1` | eye bunker entrance | original | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:307-322] [src:kong/relaunch-client-defs] [H] |
| `lab_door_01` | concrete, indestructible | sliding, automatic | 2 | `autoOpen`, `autoClose` (1 s), slide 3.75, `openSpeed 7` | hydra/storm/hatchet/crossing/conch bunkers | original | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:82-113] [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:323-330] [src:kong/relaunch-client-defs] [src:fandom/Sliding_Door] [H] |
| `lab_door_02` / `lab_door_03` | concrete | sliding, automatic, one-way | 2 | `openOneWay 1` (`_02` slides −3.75) | hydra bunker one-way doors | original | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:331-342] [src:kong/relaunch-client-defs] [src:fandom/Sliding_Door] [H] |
| `lab_door_locked_01` | concrete | sliding, automatic, locked | 2 | `locked`, `openOnce`, no auto-close | twins bunker (cobalt), opened by schedule | original | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:343-351] [src:kong/relaunch-client-defs] [src:fandom/Sliding_Door] [H] |
| `lab_door_chrys` | concrete | sliding, puzzle | 0.75 | `canUse false`, `openOnce` | chrysanthemum bunker (`bunker_chrys_01` code) | original | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:352-381] [src:kong/relaunch-client-defs] [H] |
| `vault_door_main` | metal | heavy hinged | 1.5 | `openOneWay −1`, `openDelay 4.1` s, `openOnce`, `openSpeed 0.23` | bank vault | original | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:382-401] [src:kong/relaunch-client-defs] [src:fandom/Vault_Door] [H] |
| `vault_door_chrys_01` | metal | heavy hinged | 1.5 | original: `canUse true`, `openOneWay −1`, `openDelay 4.1`, `openOnce`, `openSpeed 0.23` (opened by hand like the bank vault); (fork) `canUse false`, opened only by the `bunker_chrys_02` code since 2026-05-30 (`7d063420`) | chrysanthemum compartment `bunker_chrys_compartment_01` | original object, fork behaviour | [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:402-422] [src:derived/survev-git-7d063420] [src:fandom/Chrysanthemum_Bunker] [H] |
| `vault_door_chrys_02` | metal | heavy hinged, puzzle | 0.75 | `canUse false` | `bunker_chrys_compartment_01b` | original | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:423-433] [src:kong/relaunch-client-defs] [H] |
| `vault_door_eye` | metal | heavy hinged, puzzle | 1.5 | `canUse false`, delay 0.1, `openSpeed 10` | eye bunker vault (`bunker_eye_02` code) | original | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:455-475] [src:kong/relaunch-client-defs] [src:fandom/Vault_Door] [H] |
| `saloon_door_secret` | wood | sliding, puzzle | 0.75 | `canUse false`, `openOnce`, slide 4.5, `openSpeed 36`; does not switch layer | saloon cellar (bottle colour code) | original | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:476-501] [src:kong/relaunch-client-defs] [H] |
| `teahouse_door_01` | concrete | sliding, manual | 2 | not automatic (`autoOpen false`) | teahouse, pavilion | original | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:502-526] [src:kong/relaunch-client-defs] [src:fandom/Sliding_Door] [H] |
| `secret_door_club` | concrete | sliding, puzzle | 0.75 | `canUse false`, `openOnce` | crimson ring club (`club_01` code) | original | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:527-556] [src:kong/relaunch-client-defs] [H] |
| `vault_door_bathhouse` | metal | sliding, puzzle | 0.75 | `canUse false`, `openOnce` | club bathhouse (`club_02` code) | original | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:557-586] [src:kong/relaunch-client-defs] [H] |
| `vault_door_reserve` | metal | heavy hinged, puzzle | 1.5 | `canUse false`, delay 4.1 | The Reserve vault | (fork) | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:434-454] [src:kong/relaunch-client-defs] [M] |

- Base door (`createDoor`): height 10, collidable, destructible, 150 HP, AABB extending 4 u from the hinge (`hinge (0,2)`, `extents (0.3,2)`). Defaults: `openSpeed 2`, `autoCloseDelay 1`, `slideOffset 3.5`; sounds `door_open_01` / `door_close_01`. Material defaults are merged in: metal is indestructible and reflects bullets; concrete is indestructible but does not reflect; wood and glass are destructible [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:21-80] [src:survev/shared/defs/mapObjects/mapObjectHelpers.ts:28-90] [src:kong/relaunch-client-defs] [H]
- Lab doors add `door_open_03` / `door_close_03` / `door_error_01` sounds and a dark door-slot casing sprite [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:82-113] [M]
- Doors drop nothing when destroyed [src:fandom/Door] [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:59] [H]

## Door behaviour (server `Obstacle`)

- Interacting (F / "Open Door" / "Close Door", `game-open-door` / `game-close-door`) toggles the door. Refused if `canUse` is false, or for auto doors unless triggered automatically. A 0.1 s cooldown follows a player interaction [src:survev/server/src/game/objects/obstacle.ts:704-740] [src:l10n/en:game-open-door] [src:l10n/en:game-close-door] [H]
- Punching or meleeing a door also interacts with it (changelog 0.2.6: "Doors can be opened by pressing F, or by punching them") [src:survev/server/src/game/weaponManager.ts:1174-1183] [src:changelog/0.2.6] [src:fandom/Door] [H]
- Downed players can use doors and buttons (changelog 0.7.1) [src:changelog/0.7.1] [H]
- Hinged opening: the door rotates one quarter-turn (`ori −= side`) away from the side the opener stands on. `side = −1` if the player is on the door's +x side (`dot(door − player, rotate((1,0), rot)) < 0`), otherwise +1, so the panel swings away from the player [src:survev/server/src/game/objects/obstacle.ts:808-848] [src:fandom/Door] [M]
- Overrides of that rule: `useDir.x` from a button first, then `openOneWay` (vault doors swing a fixed way regardless of the player). A door opened with no player swings with side −1 [src:survev/server/src/game/objects/obstacle.ts:833-847] [M]
- Closing restores the stored closed orientation [src:survev/server/src/game/objects/obstacle.ts:828-830] [H]
- Sliding: position shifts by `slideOffset` along the door's local y axis (−offset when opening, +offset when closing) [src:survev/server/src/game/objects/obstacle.ts:825-827] [H]
- The collider changes instantly; the client animates at `openSpeed`. Fandom notes the vault door's collision "will be immediately changed to the opened position" [src:survev/server/src/game/objects/obstacle.ts:850-856] [src:fandom/Vault_Door] [H]
- Nearby loot is re-simulated whenever a door moves (`forceLootUpdates`) [src:survev/server/src/game/objects/obstacle.ts:852-853] [M]
- `openDelay`: the toggle is deferred (bank vault 4.1 s; fandom "takes about 3 seconds to open"). `openOnce` sets `canUse = false` on first use, so vault doors cannot be closed again [src:survev/server/src/game/objects/obstacle.ts:725-736] [src:fandom/Vault_Door] [M]
- Automatic doors: each tick a player on the same layer within `rad + interactionRad` of an unlocked, closed `autoOpen` door opens it. For `openOneWay` doors the player must be on the matching side [src:survev/server/src/game/objects/player.ts:2206-2229] [src:fandom/Sliding_Door] [H]
- Auto-close fires `autoCloseDelay` (1 s) after opening. If any living player on the same layer still overlaps the closed-door footprint (plus `interactionRad`) the close is postponed by another delay [src:survev/server/src/game/objects/obstacle.ts:236-288] [src:survev/server/src/game/objects/obstacle.ts:384-419] [src:survev/server/src/game/objects/obstacle.ts:821-823] [M]
- Mobile: clients flagged mobile auto-open closed doors they are touching (changelog 0.6.2 under Mobile: "All doors automatically open.") [src:survev/server/src/game/objects/player.ts:2093-2099] [src:changelog/0.6.2] [H]
- Doors near stairs take layer 2/3 if their interaction circle touches a stair's down or up half (except `house_door_01` and `saloon_door_secret`), so they work from both floors [src:survev/server/src/game/objects/obstacle.ts:434-456] [M]
- Destroying a wall also destroys any door whose hinge (0.5 u circle) or broken window (height 0.2, indestructible wall) it overlaps on the same layer [src:survev/server/src/game/objects/obstacle.ts:671-693] [M]

## Buttons, codes and timed unlocks

- Buttons (`button` field) toggle every door of type `useType` in the same building after `useDelay`, with `useStyle` toggle/open/close and optional `useLock` lock/unlock. `useOnce` buttons disable themselves; `useCooldown` re-enables them [src:survev/server/src/game/objects/obstacle.ts:756-806] [src:survev/server/src/game/objects/obstacle.ts:309-326] [M]
- `useExpiration` (fork panels) restores the door's previous state after the timer [src:survev/server/src/game/objects/obstacle.ts:328-337] [src:survev/server/src/game/objects/obstacle.ts:774-782] [M]
- Original door buttons: `control_panel_01` → `cell_door_01` (1.1 s, once); `control_panel_04` → `crossing_door_01` (4.25 s, once). (fork) `control_panel_07de` / `07sv` lock-close doors for 12 / 10 s [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:276] [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:318] [src:survev/shared/defs/mapObjects/obstacles/interactableDefs.ts:338] [src:kong/relaunch-client-defs] [M]
- Code doors: buildings with a `puzzle` collect `puzzlePiece` button presses in order. A full correct sequence solves it, and after `completeUseDelay` the `completeUseType` door is toggled (or a button used, or an obstacle killed) [src:survev/server/src/game/objects/building.ts:247-291] [src:survev/server/src/game/objects/building.ts:435-475] [M]
- A wrong full-length sequence increments `errSeq` (error sound `door_error_01`) and locks pieces for `errorResetDelay` (1 s). An idle `pieceResetDelay` (2–10 s) also resets [src:survev/server/src/game/objects/building.ts:283-290] [src:survev/server/src/game/objects/building.ts:486-522] [M]
- Codes (server-only, so every sequence is survev's reconstruction): `bunker_eye_02` egg-hydra-storm-conch-crossing-hatchet (woods variant `bunker_eye_02_woods`, 10 pieces), `bunker_chrys_01` ichi-ni-san-shi, `saloon` red→violet, `club_01` 1-2-3-4, `club_02` 1; (fork) `bunker_chrys_02` flower-leaves-moon-frost (2026-05-30), (fork) `bunker_twins` scout-sniper-medic-demo-assault-tank (2026-04-17), (fork) `reserve_vault` 1-2-3-4-2-5. Details belong in the maps/puzzles notes [src:survev/shared/defs/puzzles.ts:1-22] [src:derived/survev-git-7d063420] [src:derived/survev-git-f0107b35] [src:fandom/Bunkers] [M]
- The 0.8.82 client defines the `bunker_chrys_02` puzzle on `bunker_chrys_compartment_01/01b` but places no puzzle pieces there, and `bunker_twins_sublevel_01` has no puzzle at all; survev added the planter pieces (chrys) and switch/button pieces (twins). `bunker_eye_01` (eye entrance → `eye_door_01`, 2 s) has a puzzle def but no pieces or code in either [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/buildings/bunkerDefs.ts:6816-6880] [src:derived/survev-git-7d063420] [M]
- Puzzle doors by building: `bunker_eye_sublevel_01` → `vault_door_eye` (5.25 s); `bunker_chrys_sublevel_01` → `lab_door_chrys` (2 s); `bunker_chrys_compartment_01/01b` → `vault_door_chrys_01/02` (5.5 s, unreachable in the original for lack of pieces); `saloon_01` → `saloon_door_secret` (2 s); `club_01` → `secret_door_club`; `bathhouse_01` → `vault_door_bathhouse`. (fork) `bunker_twins_sublevel_01` → `cobalt_wall_int_4` [src:survev/shared/defs/mapObjects/buildings/bunkerDefs.ts] [src:survev/shared/defs/mapObjects/buildings/buildingDefs.ts] [src:kong/relaunch-client-defs] [M]
- Fandom: after the eye-bunker code the vault "will instantly open after 6 seconds", with a different sound [src:fandom/Vault_Door] [M]
- Timed unlocks (`mapDef.gameConfig.unlocks`): on a `circleIdx` change, after `wait` s, every locked door in the named building is unlocked one by one every `stagger` s. Each `unlock()` auto-opens the door and pings `ping_unlock` (cyan `0x00d8ff`, sound `ping_unlock_01`) [src:survev/server/src/game/map.ts:439-503] [src:survev/server/src/game/objects/obstacle.ts:751-754] [src:survev/shared/defs/gameObjects/pingDefs.ts:94-106] [src:fandom/Twins_Bunker] [H]
- Cobalt twins bunker: survev unlocks `bunker_twins_sublevel_01` at circleIdx 1 + 30 s with stagger 0.2 (fork change). Original: wait timer 0:45 of the third cooldown per the Twins Bunker page (0:44 of step 2 wait per the Cobalt page), i.e. circleIdx 2 + ~5–6 s [src:survev/shared/defs/maps/cobaltDefs.ts:45-54] [src:balance/301] [src:fandom/Twins_Bunker] [src:fandom/Cobalt_Map] [H]

## Windows and low walls

| id | HP | behaviour | → destroyed | status | sources |
|---|---|---|---|---|---|
| `house_window_01` | 1 | glass, `isWindow`, height 10, blocks movement and bullets until broken | `house_window_broken_01` (low wall, height 0.2, indestructible) | original | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:209-240] [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:587-589] [src:kong/relaunch-client-defs] [src:fandom/Window] [H] |
| `lab_window_01` | 1 | glass | `lab_window_broken_01` | original | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:591-594] [src:kong/relaunch-client-defs] [H] |
| `club_window_01` (boarded window) | 1 | wood, `isWindow false` (opaque) | `club_window_broken_01` | original (0.7.7) | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:605-620] [src:kong/relaunch-client-defs] [src:fandom/Boarded_Window] [src:changelog/0.7.7] [H] |
| `bank_window_01` | 75 | thick glass, leaves a residue sprite | — | original | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:622-649] [src:kong/relaunch-client-defs] [H] |
| `reserve_window_01` | 1 | glass | `reserve_window_broken_01` | (fork) | [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:650-662] [M] |

- Changelog 0.2.6: "Windows can be broken and shot through, but cannot be moved through." After breaking, the residue is a 0.2-high low wall that bullets (height 0.25) pass over and players cannot cross [src:changelog/0.2.6] [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:145-174] [src:survev/server/src/game/objects/bullet.ts:300] [H]
- Fandom: one hit from any weapon breaks a window, but the first bullet does not pass through [src:fandom/Window] [M]
- Other low walls: bridge rails, saloon/club/reserve bar counters, hut/teahouse open windows (`hut_window_open_01`, `teahouse_window_open_01`), `brick_wall_ext_*_low` (height 0.2) [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:717] [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:1973-2299] [M]
- `stairs_01` / `stairs_02` / `stairs_03` are broken-stairs props (height 0.5, non-collidable, 100–150 HP) that players hide under; they are not layer stairs [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:595-604] [src:fandom/Broken_Stairs] [H]

## Ceilings, zoom regions and roofs

- Each building def has `ceiling.zoomRegions`: `zoomIn` AABBs (inside the roof), optional `zoomOut` AABBs (doorway buffers), optional `zoom` override and `noZoom` [src:survev/server/src/game/objects/building.ts:196-225] [M]
- Server: a player whose circle overlaps a `zoomIn` of a building on the same layer (any building when on stairs) with a live ceiling is `indoors` [src:survev/server/src/game/objects/player.ts:2165-2193] [M]
- Indoors, the zoom is forced to the 1x radius (28 desktop / 32 mobile) unless the region sets `zoom` (e.g. bathhouse 48; fork Reserve 36). `zoomOut` keeps that zoom while walking out through the door area [src:survev/server/src/game/objects/player.ts:2105-2257] [src:survev/shared/gameConfig.ts:399-414] [src:fandom/Scopes] [src:wikigg/Buildings] [H]
- Smoke and being downed also force the 1x radius [src:survev/server/src/game/objects/player.ts:2259-2261] [src:fandom/Scopes] [H]
- Buildings with no zoom regions (e.g. the hunting perch `perch_01`) never change the scope [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts:4514-4515] [src:fandom/Hunting_Perch] [H]
- `outsideOnly` guns (flare gun) cannot fire while indoors [src:survev/server/src/game/weaponManager.ts:731-736] [M]
- Client roof fade: each frame the client scans from the player toward each `zoomIn` region with `ceiling.vision` (defaults `dist 5.5`, `width 2.75`, `linger 0`, `fadeRate 12`). If it can see inside (same layer or on stairs), `visionTicker` is set to `linger` [src:survev/client/src/objects/building.ts:261-299] [src:survev/client/src/objects/building.ts:463-496] [M]
- The ceiling alpha steps toward 0 at 12/s when visible and back to 1 at `fadeRate`/s when not. Many large buildings use `linger 0.5`, `fadeRate 6`; warehouses `dist 8`, `width 5`; huts and shacks `width 4` [src:survev/client/src/objects/building.ts:503-509] [src:survev/shared/defs/mapObjects/buildings/buildingDefs.ts] [M]
- While `noCeilingRevealTicker > 0` (underground near stairs with `noCeilingReveal`) ceilings stay closed. On stairs looking into the other layer they open instantly [src:survev/client/src/objects/building.ts:497-520] [M]
- Building interior sound emitters are muffled by the ceiling (`visibilityMult = lerp(fadeAlpha, 1, 0.25)`) [src:survev/client/src/objects/building.ts:530-560] [M]
- Changelog 0.7.3: "Fixed tree obstacle sorting with building ceilings." [src:changelog/0.7.3] [H]

## Roof collapse (destructible ceilings)

- `ceiling.destroy.wallCount` sets `wallsToDestroy`. Each destroyed `isWall` child decrements it, and at 0 the ceiling is dead: the client plays a destroy effect and shows the residue sprite [src:survev/server/src/game/objects/building.ts:178] [src:survev/server/src/game/objects/building.ts:335-356] [src:survev/client/src/objects/building.ts:437-461] [H]
- A dead ceiling no longer makes the player indoors and is always see-through [src:survev/server/src/game/objects/player.ts:2166] [src:survev/client/src/objects/building.ts:490-494] [M]
- Original destructible roofs: `shack_01`/`02` (2 walls), `shack_03a`/`03b` (3), `hut_01`/`02`/`03` (2), `outhouse_01`/`02` (2), `greenhouse_01`/`02` (7), `teahouse_01` (3), `teapavilion_01`/`01w` (3), `archway_01` (1), `perch_01` (5), snow `_x` variants, and the entrance huts of `bunker_storm_01` and `bunker_hatchet_01` (2) [src:survev/shared/defs/mapObjects/buildings/buildingDefs.ts] [src:survev/shared/defs/mapObjects/buildings/modeBuildingDefs.ts] [src:kong/relaunch-client-defs] [src:fandom/Shack] [src:fandom/Hut] [H]
- (fork) `hut_01bh`, `hut_04` (5 walls) and `teahouse_01x` [src:kong/relaunch-client-defs] [M]
- Fandom: a shack's roof collapses after 2 walls are destroyed, "which causes no damage to its surroundings" [src:fandom/Shack] [M]
- Air drops landing on a destructible-ceiling building kill its ceiling outright. Air drops avoid indestructible roofs, and iron bombs fizzle inside them [src:survev/server/src/game/objects/airdrop.ts:93-106] [src:survev/server/src/game/objects/plane.ts:353-371] [src:survev/server/src/game/objects/projectile.ts:362-394] [M]
- `damageCeiling` obstacles (stoves) set `ceilingDamaged` on destruction: a roof hole and no more chimney smoke (fandom: cabin, saloon) [src:survev/server/src/game/objects/building.ts:338-341] [src:fandom/Obstacles] [M]
- `occupiedEmitters` (chimney smoke and similar) run while any living player on the layer is inside a `zoomIn` region. They stop permanently after a `disableBuildingOccupied` obstacle is destroyed [src:survev/server/src/game/objects/building.ts:293-332] [src:survev/server/src/game/objects/building.ts:343-346] [M]

## Layers

| layer | meaning | sources |
|---|---|---|
| 0 | ground | [src:survev/shared/utils/util.ts:47-66] [src:wikigg/Buildings] [H] |
| 1 | underground (bunker, cellar, basement, under-bridge) | [src:survev/shared/utils/util.ts:47-66] [src:wikigg/Buildings] [H] |
| 2 | stairs, ground half (bit 1 set: "on stairs") | [src:survev/server/src/game/objects/gameObject.ts:269-315] [M] |
| 3 | stairs, underground half | [src:survev/server/src/game/objects/gameObject.ts:269-315] [M] |

- `sameLayer(a, b) = (a & 1) == (b & 1) || (a & 2 && b & 2)`. A stair layer sees its own floor and the other stair layer, but not the opposite floor [src:survev/shared/utils/util.ts:47-51] [H]
- `sameAudioLayer(a, b) = a == b || a & 2 || b & 2`, so players on stairs hear both floors [src:survev/shared/utils/util.ts:53-55] [M]
- `toGroundLayer(a) = a & 1` [src:survev/shared/utils/util.ts:57-60] [M]
- `GameConfig.structureLayerCount = 2`: a structure has exactly two floors, `layers[0]` (ground building) and `layers[1]` (underground building) [src:survev/shared/gameConfig.ts:317] [src:survev/server/src/game/objects/structure.ts:42-103] [H]

## Stairs and layer transitions

- Structure `stairs[]` entries have a `collision` AABB and a `downDir`. The AABB is split along `downDir` into `downAabb` and `upAabb` halves. `downOri` / `upOri` are the quarter-turn orientations of down and up [src:survev/server/src/game/objects/structure.ts:72-101] [M]
- Each tick (`checkStructureStairs`), an object whose circle touches a stair AABB takes layer 3 if it overlaps only the down half, 2 if only the up half, and the deeper-penetrated half if both [src:survev/server/src/game/objects/gameObject.ts:269-309] [M]
- When an object leaves all stairs, layer 2 becomes 0 and 3 becomes 1. Walking down a staircase therefore moves 0 → 2 → 3 → 1 [src:survev/server/src/game/objects/gameObject.ts:310-313] [M]
- Players, projectiles (thrown grenades go down stairs) and loot all use this. `lootOnly` stairs (bridges) move only loot, letting river-borne loot float under bridges [src:survev/server/src/game/objects/gameObject.ts:276] [src:survev/server/src/game/objects/projectile.ts:355-356] [src:survev/server/src/game/objects/loot.ts:433-446] [src:wikigg/Buildings] [H]
- Aim layer: on stairs, a player facing exactly `downOri` shoots on layer 3, facing `upOri` on layer 2, otherwise on their own layer. Bullets spawn on `aimLayer` [src:survev/server/src/game/objects/player.ts:2272-2290] [src:survev/server/src/game/weaponManager.ts:749] [M]
- Bullets hit any player standing on stairs (`2 & layer`) regardless of the bullet's floor [src:survev/server/src/game/objects/bullet.ts:446-452] [M]
- wiki.gg: a bullet fired on one layer into a staircase travels to the end of the staircase and does not change layer, while a player standing on the stairs can shoot into either layer. Throwables and projectiles pass between layers freely [src:wikigg/Buildings] [M]
- Air-strike zones and aimed strikes ignore underground (layer 1) players [src:survev/server/src/game/objects/plane.ts:144-150] [src:survev/server/src/game/objects/plane.ts:543-545] [M]

## Bunkers and multi-floor structures

| structure | ground / underground building | stairs | status | sources |
|---|---|---|---|---|
| `bunker_structure_01` / `01b` / `01sv` | `bunker_egg_01` / `bunker_egg_sublevel_01` (`_02`, `_01sv`) | 1 | original | [src:survev/shared/defs/mapObjects/structureDefs.ts:653-690] [src:kong/relaunch-client-defs] [src:fandom/Bunkers] [H] |
| `bunker_structure_02` | hydra | 3 | original (0.3.6) | [src:survev/shared/defs/mapObjects/structureDefs.ts] [src:kong/relaunch-client-defs] [src:changelog/0.3.6] [H] |
| `bunker_structure_03` | storm | 1 | original | [src:survev/shared/defs/mapObjects/structureDefs.ts] [src:kong/relaunch-client-defs] [H] |
| `bunker_structure_04` | conch | 2 | original (0.4.2) | [src:survev/shared/defs/mapObjects/structureDefs.ts] [src:kong/relaunch-client-defs] [src:changelog/0.4.2] [H] |
| `bunker_structure_05` | crossing | 4 | original (0.6.0) | [src:survev/shared/defs/mapObjects/structureDefs.ts] [src:kong/relaunch-client-defs] [src:changelog/0.6.0] [H] |
| `bunker_structure_06` | hatchet | 1 | original (0.6.3) | [src:survev/shared/defs/mapObjects/structureDefs.ts] [src:kong/relaunch-client-defs] [src:changelog/0.6.3] [H] |
| `bunker_structure_07` | eye | 1 | original (0.6.4) | [src:survev/shared/defs/mapObjects/structureDefs.ts] [src:kong/relaunch-client-defs] [src:changelog/0.6.4] [H] |
| `bunker_structure_08` / `08b` | chrysanthemum | 1 | original | [src:survev/shared/defs/mapObjects/structureDefs.ts] [src:kong/relaunch-client-defs] [H] |
| `bunker_structure_09` | twins | 4 | original (0.8.8) | [src:survev/shared/defs/mapObjects/structureDefs.ts] [src:kong/relaunch-client-defs] [src:changelog/0.8.8] [H] |
| `bunker_structure_10` | cloud | 2 | (fork) 2026-09-15 | [src:survev/shared/defs/mapObjects/structureDefs.ts:1066] [src:derived/survev-git-24275240] [M] |
| `mansion_structure_01` / `02` | mansion / cellar (stairs `noCeilingReveal`) | 2 | original (`_01x`, `_03` fork) | [src:survev/shared/defs/mapObjects/structureDefs.ts:358] [src:kong/relaunch-client-defs] [M] |
| `barn_basement_structure_01` / `01d` | barn stairs / basement floor | 1 | original (`_01x` fork) | [src:survev/shared/defs/mapObjects/structureDefs.ts:262] [src:kong/relaunch-client-defs] [M] |
| `club_structure_01` | club / bathhouse (`noCeilingReveal`), interior music swapping to `club_music_02` after the `club_02` code | 2 | original | [src:survev/shared/defs/mapObjects/structureDefs.ts:598] [src:kong/relaunch-client-defs] [src:fandom/Crimson_Ring_Club] [H] |
| `saloon_structure_01` | saloon / cellar, piano music | 1 | original | [src:survev/shared/defs/mapObjects/structureDefs.ts] [src:kong/relaunch-client-defs] [M] |
| `statue_structure_03` / `04` | faction statue / underground | 1 | original | [src:survev/shared/defs/mapObjects/structureDefs.ts] [src:kong/relaunch-client-defs] [M] |
| `bridge_lg/xlg/md_structure_01` | bridge deck / under-bridge, `lootOnly` stairs | 2 | original | [src:survev/shared/defs/mapObjects/structureDefs.ts] [src:kong/relaunch-client-defs] [M] |
| `reserve_structure_01` | The Reserve / basement | 2 | (fork) | [src:survev/shared/defs/mapObjects/structureDefs.ts] [src:kong/relaunch-client-defs] [M] |

- Bunker walls are metal: bullets ricochet. Most bunker interiors force 1x zoom [src:fandom/Bunkers] [src:wikigg/Bunkers] [src:wikigg/Buildings] [H]
- Structure `mask` AABBs are cut out of the client's layer mask so the other floor is visible through the stairwell [src:survev/client/src/renderer.ts:133-190] [M]
- Client rendering: four render groups (layers 0–3). Objects on stairs go to group 2, or 3 if `zOrd ≥ 100`. Group 1 (underground) fades in at 12/s when the active layer is > 0. The backdrop is filled with the biome's `underground` colour (`0x1b0d03` on main) [src:survev/client/src/renderer.ts:86-131] [src:survev/client/src/renderer.ts:230-239] [src:survev/shared/defs/maps/baseDefs.ts:42] [M]
- Render groups 2 and 3 are always drawn; group 0 is hidden once the underground fill fully covers it, which happens only while the viewer is on layer 1 inside a structure layer not marked `underground: false` [src:survev/client/src/renderer.ts:229-244] [src:survev/client/src/objects/player.ts:2598-2614] [src:survev/client/src/game.ts:1165-1166] [M]
- Things standing over the floor (smoke clouds, flares, planes, falling air drops and their landing smoke) are lifted to the stairs groups only when the viewer's floor sees them: `(sameLayer(layer, viewer) || viewer & 2) && (layer == 1 || !(viewer & 2) || !insideStructureMask(pos))`; otherwise they stay on their own layer and are hidden with it, so a viewer in a bunker sees no surface air drop, plane, flare or smoke, and a viewer on the surface no bunker smoke [src:survev/client/src/objects/smoke.ts:145-159] [src:survev/client/src/objects/airdrop.ts:108-115] [src:survev/client/src/objects/plane.ts:268-276] [src:survev/client/src/objects/flare.ts:158-168] [H]
- The air drop's chute, fall and crash sounds and the plane's engine use that same layer, so underground they play as another floor's sounds, at half volume (the crash also muffled) [src:survev/client/src/objects/airdrop.ts:144-185] [src:survev/client/src/objects/plane.ts:309-348] [src:survev/client/src/audioManager.ts:211-228] [M]
- The plane sprite also fades to alpha 0 while the viewer is on layer 1 and to 0.15 indoors or on the underground stairs half [src:survev/client/src/objects/plane.ts:351-362] [M]
- An emote is drawn on group 3 when the emoter shares the viewer's layer, otherwise on the emoter's own layer [src:survev/client/src/emote.ts:1088-1092] [H]
- Changelog 0.3.6: "Added a reverb sound filter when underground." [src:changelog/0.3.6] [H]
- Player spawn and loot logic treat `layer & 1` as the floor. Air strikes and zones skip underground players. Explosions and bullets use `sameLayer`, so grenades thrown on the ground do not hurt players underground except those on the stairs [src:survev/server/src/game/objects/explosion.ts:59-61] [src:survev/server/src/game/objects/plane.ts:144-150] [M]

## Conflicts

- CONFLICT twins-bunker-unlock-time: survev unlocks the twins bunker at circleIdx 1 + 30 s [src:survev/shared/defs/maps/cobaltDefs.ts:45-54] [src:balance/301] vs the original at ~0:45 of the third cooldown (circleIdx 2 + ~5 s) [src:fandom/Twins_Bunker] [src:fandom/Cobalt_Map] (fandom's Bunkers page says "0:44 … on the second red zone shrink cooldown" [src:fandom/Bunkers]); proposed: circleIdx 2, wait 5–6 s (survev's own pre-fork value was circleIdx 2 wait 5) [M]
- CONFLICT vault-open-time: bank vault `openDelay 4.1` s [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:382-401] vs "takes about 3 seconds to open" [src:fandom/Vault_Door]; proposed: 4.1 s (client-visible def; the fandom estimate likely excludes the swing animation) [M]
- CONFLICT door-height: door obstacle height 10 [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:32] [src:kong/relaunch-client-defs] vs fandom infobox height 0 [src:fandom/Door]; proposed: 10 [H]
- CONFLICT chrys-vault-door-use: `vault_door_chrys_01` opens by hand (`canUse true`, 4.1 s delay) [src:kong/relaunch-client-defs] [src:fandom/Chrysanthemum_Bunker] vs `canUse false`, opened only by survev's added planter code [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:402-422] [src:derived/survev-git-7d063420]; proposed: client behaviour (hand-opened vault; no compartment code) [H]
- CONFLICT teahouse-door-destructible: manual sliding door `teahouse_door_01` is concrete and indestructible [src:kong/relaunch-client-defs] [src:survev/shared/defs/mapObjects/obstacles/buildingObjsDefs.ts:502-526] vs fandom infobox "hp 150, destroy: Yes" [src:fandom/Sliding_Door]; proposed: client def (indestructible) [H]

## Open questions

- Is the "swing away from the player" rule identical to the original's, including the default side when a door is opened with no player (survev uses −1)? [src:survev/server/src/game/objects/obstacle.ts:833-847] [L]
- Exact original auto-close retry rule for automatic lab doors (survev postpones while a player overlaps the closed footprint) [src:survev/server/src/game/objects/obstacle.ts:384-419] [L]
- How did the original pick the bullet layer when aiming diagonally on stairs (survev requires an exact quarter-turn match)? [src:survev/server/src/game/objects/player.ts:2272-2290] [L]
