# Controls

> Scope: desktop input (keyboard and mouse), default keybinds, rebinding and bind sharing, how inputs reach the server, and mobile touch controls.
> The default bind table is identical in survev (`client/src/inputBinds.ts`), the decompiled 0.8.82 client (`derived/survev@8715a605:client/js/app.js`) and the 2026 Kongregate relaunch (`kong/relaunch-client-bundle`).

## Input plumbing

- `InputHandler` listens on `window` for keydown, keyup, mousemove, mousedown, mouseup, wheel, touchstart, touchmove, touchend, touchcancel, focus and blur; there is no gamepad support [src:survev/client/src/input.ts:46-60] [H]
- Keys are identified by legacy `keyCode` numbers (`Key` enum: Backspace 8, Enter 13, Shift 16, Escape 27, Space 32, arrows 37–40, digits 48–57, letters 65+, F1–F12 112–123, Tilde 192, …); mouse buttons Left/Middle/Right/Thumb1/Thumb2; wheel Up/Down [src:survev/client/src/input.ts:319-392] [H]
- A bind value is `{type, code}` with `InputType` None 0, Key 1, MouseButton 2, MouseWheel 3, so any action can sit on a key, a mouse button or a wheel direction [src:survev/client/src/input.ts:393-398] [src:survev/client/src/inputBinds.ts:16-24] [H]
- Game actions are the 36-value `Input` enum (ids 0–35, `Count` 36), the same list and order as the original protocol-78 client [src:survev/shared/gameConfig.ts:57-95] [src:derived/survev@8715a605:client/js/app.js:77733-77770] [H]
- While the Esc menu is open and the pointer is over it (`menuHovered`), binds on mouse buttons and the wheel are ignored so clicks on the menu do not fire [src:survev/client/src/inputBinds.ts:206-227] [src:survev/client/src/ui/ui.ts:2295-2303] [H]

## Default keybinds

| Input id | action (bind label) | default | sent to server as | sources |
|---|---|---|---|---|
| 0–3 | Move Left / Right / Up / Down | A / D / W / S (arrow keys also work while unbound) | `moveLeft/Right/Up/Down` booleans | [src:survev/client/src/inputBinds.ts:27-30] [src:survev/client/src/game.ts:534-548] [src:fandom/Controls] [H] |
| 4 | Fire | left mouse | `shootStart` / `shootHold` | [src:survev/client/src/inputBinds.ts:31] [src:survev/client/src/game.ts:562-563] [H] |
| 5 | Reload | R | input 5 | [src:survev/client/src/inputBinds.ts:32] [H] |
| 6 | Cancel | X | input 6 | [src:survev/client/src/inputBinds.ts:33] [H] |
| 7 | Interact | F | input 7 (or Revive/Use/Loot, see below) | [src:survev/client/src/inputBinds.ts:34] [H] |
| 8 | Revive | unbound | input 8 | [src:survev/client/src/inputBinds.ts:35] [H] |
| 9 | Open/Use | unbound | input 9 | [src:survev/client/src/inputBinds.ts:36] [H] |
| 10 | Loot | unbound | input 10 | [src:survev/client/src/inputBinds.ts:37] [H] |
| 11 | Equip Primary | 1 | input 11 | [src:survev/client/src/inputBinds.ts:38] [H] |
| 12 | Equip Secondary | 2 | input 12 | [src:survev/client/src/inputBinds.ts:39] [H] |
| 13 | Equip Melee | 3 | input 13 | [src:survev/client/src/inputBinds.ts:40] [H] |
| 14 | Equip Throwable | 4 (pressing again cycles throwable types) | input 14 | [src:survev/client/src/inputBinds.ts:41] [src:survev/server/src/game/objects/player.ts:3398-3410] [src:fandom/Controls] [H] |
| 15, 16 | EquipFragGrenade, EquipSmokeGrenade | no bind def (not rebindable, never sent) | — | [src:survev/shared/gameConfig.ts:73-74] [src:survev/client/src/inputBinds.ts:26-61] [H] |
| 17 | Equip Next Weapon | mouse wheel down | input 17 | [src:survev/client/src/inputBinds.ts:42] [src:changelog/0.2.3] [H] |
| 18 | Equip Previous Weapon | mouse wheel up | input 18 | [src:survev/client/src/inputBinds.ts:43] [H] |
| 19 | Equip Last Weapon | Q | input 19 | [src:survev/client/src/inputBinds.ts:44] [H] |
| 20 | Equip Other Gun | unbound | input 20 | [src:survev/client/src/inputBinds.ts:57] [H] |
| 21 | Equip Previous Scope | unbound | input 21 | [src:survev/client/src/inputBinds.ts:46] [H] |
| 22 | Equip Next Scope | unbound | input 22 | [src:survev/client/src/inputBinds.ts:47] [H] |
| 23 | Use Bandage | 7 | `useItem = "bandage"` | [src:survev/client/src/inputBinds.ts:48] [src:survev/client/src/game.ts:648-656] [H] |
| 24 | Use Med Kit | 8 | `useItem = "healthkit"` | [src:survev/client/src/inputBinds.ts:49] [H] |
| 25 | Use Soda | 9 | `useItem = "soda"` | [src:survev/client/src/inputBinds.ts:50] [H] |
| 26 | Use Pills | 0 | `useItem = "painkiller"` | [src:survev/client/src/inputBinds.ts:51] [H] |
| 27 | Stow Weapons | E (same as Equip Melee on the server) | input 27 | [src:survev/client/src/inputBinds.ts:45] [src:survev/server/src/game/objects/player.ts:3387-3391] [H] |
| 28 | Switch Gun Slots | T | input 28 | [src:survev/client/src/inputBinds.ts:52] [src:changelog/0.4.3] [H] |
| 29 | Toggle Map | M (G also works while unbound) | client only | [src:survev/client/src/inputBinds.ts:53] [src:survev/client/src/game.ts:451-457] [H] |
| 30 | Toggle Minimap (`CycleUIMode`) | V | client only | [src:survev/client/src/inputBinds.ts:54] [src:changelog/0.0.81] [H] |
| 31 | Emote Menu | right mouse | client only (EmoteMsg on release) | [src:survev/client/src/inputBinds.ts:55] [H] |
| 32 | Team Ping Hold (`TeamPingMenu`) | C | client only (EmoteMsg with `isPing`) | [src:survev/client/src/inputBinds.ts:56] [src:changelog/0.2.4] [H] |
| 33 | Full Screen | L | client only | [src:survev/client/src/inputBinds.ts:58] [src:changelog/0.1.76] [H] |
| 34 | Hide UI | unbound | client only | [src:survev/client/src/inputBinds.ts:59] [src:changelog/0.5.1] [H] |
| 35 | Team Ping Menu (`TeamPingSingle`) | unbound | client only | [src:survev/client/src/inputBinds.ts:60] [src:changelog/0.6.0] [H] |
- The original 0.8.82 client's bind table matches survev line for line (same names, same defaults, same unbound actions) [src:derived/survev@8715a605:client/js/app.js:109686-109722] [src:kong/relaunch-client-bundle] [H]
- Fandom's default list and the in-game how-to-play text agree: WASD move, mouse aim, left click shoot, 1–4 or scroll wheel weapons, 3 or E stow, Q previous weapon, T or drag to switch gun slots, R reload, F pickup/loot/revive, 7–0 medical, right-click item to drop, X cancel, M or G map, V minimap, C + right-drag team ping, right-drag emote [src:fandom/Keybinds] [src:l10n/en:index-change-weapons-ctrl] [src:l10n/en:index-stow-weapons-ctrl] [src:l10n/en:index-use-ping-ctrl] [src:namu/Surviv.io] [H]
- Fandom's "not bound by default" list also names "Use Event Item", which is not in the 0.8.82 or survev bind tables (post-0.8.82 or a later relaunch feature) [src:fandom/Keybinds] [src:survev/client/src/inputBinds.ts:26-61] [L]

## Hard-coded keys and mouse behaviour

- Esc toggles the in-game menu (closes the large map first; also restores a hidden HUD) [src:survev/client/src/game.ts:449-468] [src:survev/client/src/ui/ui.ts:2278-2310] [H]
- Left/Right arrow keys pick the next/previous spectate target while spectating (since 0.3.1) [src:survev/client/src/game.ts:707-714] [src:changelog/0.3.1] [H]
- Tilde toggles debug overlays in dev builds only (fork) [src:survev/client/src/game.ts:386-390] [H]
- Aim follows the mouse: the client sends `toMouseDir` (unit vector) and `toMouseLen` (world distance from player to cursor, clamped to 64) every input message [src:survev/client/src/game.ts:470-482] [src:survev/client/src/game.ts:550-556] [src:survev/shared/net/net.ts:14] [H]
- Throwables use `toMouseLen` as throw strength up to `throwableMaxMouseDist` 18 world units [src:survev/shared/gameConfig.ts:218] [src:survev/client/src/game.ts:529-532] [H]
- Holding Fire repeats `auto` and `burst` guns (`shootHold`); `single` guns fire once per press (`shootStart`, with a press buffered if it comes < 0.1 s before the cooldown ends); melee swings once per press unless the def has `autoAttack` [src:survev/server/src/game/weaponManager.ts:365-395] [src:survev/server/src/game/weaponManager.ts:404-416] [src:survev/server/src/game/objects/player.ts:3371-3375] [H]
- HUD mouse actions: left-click a weapon slot, scope or item to use/equip it; right-click an item, gear piece, perk or weapon slot to drop it; drag gun slot 1 ↔ 2 to swap (desktop only) [src:survev/client/src/ui/ui2.ts:52-60] [src:survev/client/src/ui/ui.ts:422-460] [src:changelog/0.2.0] [src:changelog/0.1.1] [H]
- Dropping ammo, meds, boosts or throwables drops half the stack (at least 1; ammo stacks of ≤ 5 or ≤ `minStackSize` drop whole), scopes drop one at a time [src:survev/server/src/game/objects/player.ts:4250-4292] [src:namu/Surviv.io] [H]
- The custom crosshair replaces the cursor on `#game-area-wrapper` (64×64 SVG scaled by size, recoloured, stroke width) and is also used over the zoom, medical, settings and weapon-switch buttons [src:survev/client/src/crosshair.ts:5-57] [src:fandom/Crosshairs] [H]

## Interact, revive, loot, use

- F (Interact) is split client-side: if any of Revive, Open/Use or Loot has its own bind, Interact sends only the unbound ones; if none are bound it sends `Interact` [src:survev/client/src/game.ts:590-608] [H]
- Server Interact order: revive a nearby downed teammate, else pick up the closest loot (not while downed), and use every interactable obstacle in range (doors, buttons) [src:survev/server/src/game/objects/player.ts:3452-3480] [H]
- While downed only Interact, Use, Revive (self-revive perk) and Cancel (own revive) are accepted [src:survev/server/src/game/objects/player.ts:3345-3355] [H]
- Equip Other Gun swaps to the first non-empty of primary, secondary, melee other than the current slot; Equip Last Weapon returns to the previous slot [src:survev/server/src/game/objects/player.ts:3431-3450] [src:fandom/Quickswitching] [H]
- Next/Previous Scope step through owned scopes in the order 1x, 2x, 4x, 8x, 15x [src:survev/server/src/game/objects/player.ts:3512-3537] [H]
- Fandom and namu both recommend binding Equip Other Gun to Space (or right click) for quickswitching and a separate Loot key [src:fandom/Keybinds] [src:namu/Surviv.io] [M]

## How inputs are sent

- The client builds an InputMsg every frame but only sends it when something changed or after 1 s without sending (keep-alive) [src:survev/client/src/game.ts:731-771] [src:derived/survev@8715a605:client/js/app.js:78585-78624] [H]
- "Changed" means: any discrete input queued, aim or touch direction rotated by more than 0.1 degrees, `toMouseLen` changed by more than 0.5, `shootStart` true, or any boolean differs [src:survev/client/src/game.ts:731-758] [src:derived/survev@8715a605:client/js/app.js:78585-78612] [H]
- At most 7 distinct discrete inputs per message (`addInput` drops duplicates and extras), although the wire format allows 15 [src:survev/shared/net/inputMsg.ts:22-26] [src:survev/shared/net/inputMsg.ts:47-49] [src:derived/survev@8715a605:client/js/app.js:43660] [H]
- Only one `useItem` per message; keys 7/8/9/0 are checked in that priority order [src:survev/client/src/game.ts:648-656] [H]
- Map toggle, minimap, emote and ping wheels, fullscreen and Hide UI never reach the server; emotes and pings go out as separate EmoteMsg messages [src:survev/client/src/game.ts:451-468] [src:survev/client/src/game.ts:908-928] [H]

## Rebinding and bind sharing

- Rebinding was added in 0.5.1 "Low-key update" (August 13 2018) together with the Equip Previous/Next Scope, Equip Other Gun and Hide UI actions; desktop only [src:changelog/0.5.1] [src:fandom/Keybinds] [H]
- The keybind screen exists in two places: the main-menu modal `#ui-modal-keybind` and the in-game menu "Keybinds" tab [src:survev/client/index.html:1744-1792] [src:survev/client/src/ui/ui.ts:2312-2323] [H]
- Click an action, then press a key, mouse button or wheel; Escape cancels, Backspace clears the bind; Ctrl, Alt, Windows, ContextMenu and F1–F12 are refused; binding a value already used elsewhere unbinds the old action [src:survev/client/src/inputBinds.ts:285-325] [src:survev/client/src/inputBinds.ts:184-202] [H]
- "Restore defaults" (`.js-btn-keybind-restore`) reloads the default table [src:survev/client/src/inputBinds.ts:246-250] [H]
- Storage format: byte 1 = version (1), then per action 2 bits type + 8 bits code, then a CRC-16 of the data (big-endian, 2 bytes); the result is base64 and saved in the `binds` config key [src:survev/client/src/inputBinds.ts:75-95] [src:survev/client/src/inputBinds.ts:144-146] [H]
- The base64 string is shown as a share code (`#keybind-link`) and can be pasted into `#keybind-code-input` to load someone else's binds; a bad CRC is rejected (sharing added 0.5.1) [src:survev/client/src/inputBinds.ts:96-128] [src:survev/client/src/inputBinds.ts:333] [src:changelog/0.5.1] [H]
- Fandom: since the 0.8.0 "Get a Loadout" update keybinds were saved to the account [src:fandom/Controls] [M]

## Mobile and touch controls

- Touch mode is on for phones (Android/iOS UA, iPad) and tablets; mobile web play arrived in 0.3.3 (April 2018) and the native apps in October/November 2018 [src:survev/client/src/device.ts:3-47] [src:changelog/0.3.3] [src:fandom/Surviv.io_Mobile] [H]
- Two virtual sticks (Pixi sprites `pad.img`, alpha 0.2): touches on the left half of the screen drive movement, the right half aims [src:survev/client/src/ui/touch.ts:90-110] [src:survev/client/src/ui/touch.ts:272-274] [src:l10n/en:index-movement-ctrl-touch] [src:l10n/en:index-aim-ctrl-touch] [H]
- Stick styles per stick: "anywhere" (the stick centres on the first touch) or "locked" (fixed centre); the default is anywhere for both; toggles in the in-game menu (`#btn-game-move-style`, `#btn-game-aim-style`) [src:survev/client/src/config.ts:109-111] [src:survev/client/src/ui/touch.ts:294-346] [src:changelog/0.6.2] [H]
- Locked stick centres: landscape 126 px in from the side and 100 px up from the bottom, portrait 96/160 px; iOS Safari raises them to 120 (landscape) / 240 (portrait) px; iPhone X adds 56 px sideways and scales height by 0.9 [src:survev/client/src/ui/touch.ts:83-86] [src:survev/client/src/ui/touch.ts:352-415] [H]
- Stick range `padPosRange` = 48 px × pad scale (1 landscape, 0.8 portrait); dead zone 2 px; the knob is clamped to the range circle [src:survev/client/src/ui/touch.ts:35] [src:survev/client/src/ui/touch.ts:75] [src:survev/client/src/ui/touch.ts:402-403] [src:survev/client/src/ui/touch.ts:276-288] [H]
- Movement is analog: `touchMoveDir` (8-bit unit vector) and `touchMoveLen` (0–255) are sent with `touchMoveActive`; the server uses the direction and ignores the length for speed [src:survev/client/src/game.ts:516-528] [src:survev/shared/net/inputMsg.ts:39-43] [src:survev/server/src/game/objects/player.ts:1925-1928] [H]
- Shooting: dragging the aim stick beyond range / 1.075 fires; `shootStart` is sent every frame while held, which auto-fires semi-automatic weapons ("auto shoot" on mobile) [src:survev/client/src/ui/touch.ts:218-222] [src:survev/client/src/game.ts:562-563] [src:fandom/Surviv.io_Mobile] [src:l10n/en:index-shoot-ctrl-touch] [H]
- Throwables: once cooking starts, dragging back inside the circle does not cancel; lifting the finger throws; throw distance = stick pull / range × 18 [src:survev/client/src/ui/touch.ts:224-229] [src:survev/client/src/game.ts:529-532] [H]
- When only the move stick is touched the player turns toward the walking direction after 0.5 s [src:survev/client/src/ui/touch.ts:79] [src:survev/client/src/game.ts:502-515] [H]
- Aim line: dotted line (`dot.img`, first dot 3.5 units out, every 1.5 units) up to the gun's barrel length + bullet range (30 for non-guns), clipped by the view and by the first blocking obstacle; on by default (since 0.6.2), toggle `#btn-game-aim-line` [src:survev/client/src/ui/touch.ts:590-650] [src:survev/client/src/config.ts:111] [src:changelog/0.6.2] [src:fandom/Surviv.io_Mobile] [H]
- Touch HUD actions: tap a weapon slot to switch, tap the ammo counter to reload, tap a scope, tap a medical item to use it, touch-and-hold an item for 0.75 s to drop it, tap the interaction button to pick up / cancel, tap the minimap to open the map, tap the map to ping, tap the surviv icon for emotes [src:survev/client/src/ui/ui2.ts:34] [src:survev/client/src/ui/ui.ts:385-399] [src:l10n/en:index-reload-ctrl-touch] [src:l10n/en:index-drop-item-ctrl-touch] [src:l10n/en:index-use-ping-ctrl-touch] [H]
- Touch players loot from 1.4 × the normal pickup radius (`touchLootRadMult`) and see a wider 1x/2x view (mobile zoom table) [src:survev/shared/gameConfig.ts:222] [src:survev/server/src/game/objects/player.ts:3585-3587] [src:survev/shared/gameConfig.ts:407-413] [H]
- survev's server auto-loots for `isMobile` players every frame (guns into empty non-active slots, melee over fists, perks if none droppable, better armour/packs, other items until full) with a 3 s pause after dropping something, and opens closed doors in reach [src:survev/server/src/game/objects/player.ts:2024-2099] [src:survev/server/src/game/objects/player.ts:4153] [src:fandom/Surviv.io_Mobile] [H]
- Fandom lists auto pickup (except outfits, which need a manual pickup icon), auto shoot and auto-opening doors as mobile features [src:fandom/Surviv.io_Mobile] [M]
- Fandom and namu say mobile and PC players were matched separately (mobile players could still join a PC team lobby) [src:fandom/Surviv.io_Mobile] [src:namu/Surviv.io] [M]

## Conflicts

- CONFLICT melee-key-3-or-e: fandom Controls lists "3, E" as Equip melee/fists [src:fandom/Controls] vs the bind table names E "Stow Weapons" [src:survev/client/src/inputBinds.ts:45]; proposed: both, because the server treats StowWeapons as EquipMelee [src:survev/server/src/game/objects/player.ts:3387-3391] [L]
- CONFLICT mobile-matchmaking-split: fandom/namu describe separate mobile and PC matchmaking [src:fandom/Surviv.io_Mobile] [src:namu/Surviv.io] vs survev's find_game has no device field and puts everyone in the same games [src:survev/shared/types/api.ts:5-13]; proposed: keep survev behaviour, expose a config knob for separate queues [L]
- CONFLICT mobile-auto-loot-location: survev implements mobile auto-loot on the server keyed on `isMobile` [src:survev/server/src/game/objects/player.ts:2024-2099] vs the original server code is unknown (the protocol-78 JoinMsg carries `isMobile`, so the original server could do the same) [src:derived/survev@8715a605:client/js/app.js:43585-43614]; proposed: keep server-side auto-loot [L]

## Open questions

- Fandom mentions mobile aim assist and an optional crate auto-punch; the 0.8.82 web client has no such code, so these may be native-app or post-0.8.82 features [src:fandom/Surviv.io_Mobile] [src:survev/client/src/ui/touch.ts:580-660] [L]
- `EquipFragGrenade` (15) and `EquipSmokeGrenade` (16) exist in the enum but have no bind definition in either client; their intended behaviour is unknown [src:survev/shared/gameConfig.ts:73-74] [src:derived/survev@8715a605:client/js/app.js:77749-77750] [L]
