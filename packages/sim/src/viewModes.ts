// Contract notes of the M7b event-map work (split from view.ts, which links here). Everything is backward compatible:
// new fields are optional in the types, always filled by the simulation and by the network decoder.
//
// - PlayerView `frozen` / `frozenOri` (the original Player record's `frozen` bit and 2-bit `frozenOri`): a snowball or
//   potato hit slows an enemy (rules.modes.throwableHits from the explosion defs: 0.5 s, 2 s for a heavy snowball, 1 s
//   for a heavy potato and Spud Gun shots) and makes it drop random items. While `frozen`, draw the frozen sprite over
//   the body turned by `frozenOri` quarter turns: the map def's `biome.frozenSprites` (potato: player-mash-01..03), else
//   the snow sprites player-snow-01..03 (the snow map is not in the v0.8.82 client; its pre-fork def listed those,
//   modes/snow.md). `frozenOri` is 0 while not frozen.
// - Cobalt (perkMode maps): a joining player has no class (`role` ""), sits at the Twins bunker
//   (`bunker_twins_sublevel_01`, layer 1) and cannot move, act, emote, drop or be hurt; show the class menu (the original
//   client opens it on map load when the active player has no role, survev game.ts). `Game.selectRole` (the
//   PerkModeRoleSelect message) or the 20 s timeout gives the class: the player then appears on the surface (layer 0)
//   at a spawn point, next to its group in team modes, and its RoleAnnouncementEvent arrives (close the menu then).
//   rules.modes.cobaltWaitingRoom false keeps players at their spawn point while choosing.
// - Potato maps (`potatoMode`): every wheel emote request shows as `emote_potato` (EmoteEvent.type); pings and
//   team-only emotes are unchanged (rules.modes.potatoEmotes).
// - `Game.dropItem(playerId, item, weapIdx)` and the DropItem message (client -> server: item game type, weapIdx u8):
//   drops worn armour, the gun of slot `weapIdx` (not an unfired Commander flare gun), the melee weapon, the droppable
//   loot perk, or part of a bag stack (half, at least 1; small ammo stacks whole; one scope). Use it for the HUD's
//   right-click drop.
// - Event flags stay client-side data: read `getMapDef(mapData.mapName).gameMode` for `spookyKillSounds` (Halloween
//   kill-leader voice lines and grenade sprites), `turkeyMode` ("Winner winner turkey dinner!", Perky Shoot feathers),
//   `perkMode` / `perkModeRoles` (class menu), `potatoMode`, `woodsMode`, `sniperMode`, `desertMode`. The night darkness
//   some wikis describe for Halloween is not in the original code (halloween.md CONFLICT halloween-night): only
//   `biome.valueAdjust`.
// - Event-map corrections (Savannah's own spawns and loot, Turkey's squashes, no fork Oasis on Desert, ...) are baked
//   into the ported MapDefs by tools/port-survev (lib/eventMaps.ts), so client and server read the same corrected defs.
// - GenerateMapResult gains `skipped` (spawns a placement rule left out, e.g. the crossing bunker without a river wider
//   than 8), and maps whose landmark buildings did not fit are regenerated (warnings mention it).
// - Woods bag capacities: frags and smokes hold 6/12/15/18 per backpack level on woods maps (`mapBagSizes`); the HUD's
//   maximum should use the map's gameConfig.bagSizes row when present.
export {};
