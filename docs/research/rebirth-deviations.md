# Rebirth deviations

> Deliberate differences from v0.8.82 that the project owner asked for. They are not research findings: the original values stay in the other KB files and in the generated defs, and the rebirth applies these on top through the defs layer in `packages/defs/src/rebirth/` (rebirth-only defs and balance deviations), so the simulation, the client and the bots read the same values. Source `user/<date>-<topic>` is the owner's request (see `sources.md`).

## Frag grenade blast radius

| def | field | v0.8.82 | rebirth | sources |
|---|---|---|---|---|
| `explosion_frag` | `rad.min` – `rad.max` | 5–12 | 6.5–15.6 (×1.3) | [src:user/2026-10-07-grenade-radius] [src:survev/shared/defs/gameObjects/explosionsDefs.ts:31-40] [src:kong/relaunch-client-defs] [H] |
| `explosion_frag` | `decalType` | `decal_frag_explosion` | `decal_frag_large_explosion` (rebirth-only: `decal_frag_explosion` with `img.scale` 0.2 × 1.3 = 0.26) | [src:user/2026-10-07-grenade-radius] [src:survev/shared/defs/gameObjects/explosionsDefs.ts:31-40] [H] |

- The owner's reason: the frag grenade's radius is too small, even in the original game [src:user/2026-10-07-grenade-radius] [H]
- Only the frag grenade changes: its damage (125), the 12 `shrapnel_frag` bullets (range 8, shared with the MIRV's main charge) and the MIRV, Martyrdom, barrel and stove explosions keep their original values [src:user/2026-10-07-grenade-radius] [src:survev/shared/defs/gameObjects/explosionsDefs.ts:31-140] [H]
- The frag's scorch mark grows with its blast: a new decal rather than a resized `decal_frag_explosion`, because the MIRV's main charge leaves that decal too and keeps its original size [src:user/2026-10-07-grenade-radius] [src:survev/shared/defs/gameObjects/explosionsDefs.ts:31-140] [H]

## 50v50 air strike variants

- Every scheduled 50v50 air strike zone rolls a variant: `normal` 60, `heavy` 25, `carpet` 15 by default (server `AIRSTRIKE_VARIANTS`, `rules.roles.factionAirstrikeVariants`); strobe strikes and other maps stay normal [src:user/2026-10-07-airstrike-variants] [H]
- The roll uses its own seeded stream, so a zone that rolls `normal` behaves exactly like v0.8.82 (planes, aim points and bombs) [src:user/2026-10-07-airstrike-variants] [src:survev/server/src/game/objects/plane.ts:520-562] [H]

| variant | planes | bombs per plane | bomb | zone radius | sources |
|---|---|---|---|---|---|
| `normal` | the map's `numPlanes` roll (3–5) | 20 × `bomb_iron`, 2 u apart, jitter 4 | `explosion_bomb_iron`: 40 damage, radius 5–14 | `airstrikeZoneRad` (60 → 40) | [src:survev/shared/gameConfig.ts:293-305] [src:survev/shared/defs/maps/factionDefs.ts:104-193] [src:kong/relaunch-client-defs] [H] |
| `heavy` | the map's `numPlanes` roll (3–5) | 5 × `bomb_heavy` (rebirth-only), 8 u apart, jitter 4 | `explosion_bomb_heavy` (rebirth-only): 50 damage, ×2 vs obstacles, radius 14–38, 4 × `shrapnel_bomb_iron`, scorch `decal_bomb_heavy_explosion` (rebirth-only) | `airstrikeZoneRad` + 24 (at most 84, under the 256 limit); planes still aim inside `airstrikeZoneRad` | [src:user/2026-10-07-airstrike-variants] [src:derived/explosion_bomb_iron-x2.75-radius] [H] |
| `carpet` | 6 | 20 × `bomb_iron` (as normal) | `explosion_bomb_iron` | `airstrikeZoneRad` | [src:user/2026-10-07-airstrike-variants] [H] |

- Heavy shell radius 14–38 is about 2.75× the iron bomb's 5–14, keeping its min/max ratio; the zone grows by the extra reach 38 − 14 = 24 u so the marker covers the danger like a normal marker [src:user/2026-10-07-airstrike-variants] [src:derived/explosion_bomb_iron-x2.75-radius] [H]
- The heavy shell's scorch mark `decal_bomb_heavy_explosion` is `decal_bomb_iron_explosion` (same sprite, 6–10 s lifetime, 60 % fade chance) with `img.scale` grown by the radius ratio, 0.2 × 38 / 14 ≈ 0.543 [src:user/2026-10-07-airstrike-variants] [src:derived/explosion_bomb_iron-x2.75-radius] [H]
- Fewer, wider spaced shells (a 32 u strip against the iron strip's 38 u) keep a heavy strike survivable away from the strip. Summed over one plane's 5 shells at the worst point along the strip, by the distance from the strip line to the player's centre (default `step` falloff, `damage × (1 − d / rad.max)` past `rad.min`, measured to the body surface 1 u closer): about 230 damage on the line, 200 at 10 u, 150 at 15 u, 105 at 20 u, 75 at 25 u, 45 at 30 u, 15 at 35 u, none past 39 u, so one plane is lethal about 20 u to each side of its line; the iron strip deals about 360 on its line, 100 at 10 u, 50 at 12 u and none past 15 u [src:derived/explosion_bomb_iron-x2.75-radius] [M]
- Carpet's 6 planes follow the owner's words: a normal strike makes 3 passes, the carpet strike 6; the zone lasts 1.5 + 2.5 + 6 + 2.5 = 12.5 s, inside the 60 s zone limit [src:user/2026-10-07-airstrike-variants] [src:survev/server/src/game/objects/plane.ts:176-191] [H]
- The client receives each zone's variant with the zone (protocol schema 9); the rebirth-only game types (`bomb_heavy`, `explosion_bomb_heavy`) and decal map types (`decal_bomb_heavy_explosion`, `decal_frag_large_explosion`) take ids after every generated one, so original ids are unchanged [src:user/2026-10-07-airstrike-variants] [H]

## Client presentation

- Each zone is drawn in its variant's style on the minimap and on the ground: `normal` keeps the original yellow circle (`0xeaff00`, 1.5 px outline, 20 % fill on the map); `heavy` is red (`0xff3c1e`) with a thicker outline and an inner ring at the planes' aim radius, the outer ring being the shells' reach; `carpet` is magenta (`0xe040ff`) with a blinking double outline (`apps/client/src/ui/airstrikeVariantStyle.ts`) [src:user/2026-10-07-airstrike-variants] [src:survev/client/src/objects/plane.ts:162-167] [H]
- The `ping_airstrike` map marker and its edge indicator take the zone's colour for heavy and carpet zones [src:user/2026-10-07-airstrike-variants] [H]
- A HUD announcement names the rebirth variant when a heavy or carpet zone appears: "Heavy shell strike incoming" / "고폭탄 공습 경보", "Carpet bombing incoming" / "대공습 경보" (rebirth l10n keys `game-airstrike-*`); a normal zone stays silent as in v0.8.82, and a zone first seen past half its time (joining mid-strike) is not announced [src:user/2026-10-07-airstrike-variants] [H]
- The falling heavy shell is drawn 1.5× the iron bomb (`worldImg.scale` 0.18 against 0.12) [src:user/2026-10-07-airstrike-variants] [src:kong/relaunch-client-defs] [H]
- Explosion bursts follow the def's blast radius, and so do the scorch decals of the frag and the heavy shell (above): the frag burst is drawn ×1.3 over the original effect; the heavy shell has its own effect (`bomb_heavy`), the iron bomb's burst grown by 38 / 14 in a warm tint and lasting longer, more water ripples, the iron bomb's boom 7 semitones lower, 1.5× as loud and heard 1.5× as far, and a camera shake about twice as strong and long that reaches 1.75× as far (still off with the Screen shake setting) [src:user/2026-10-07-grenade-radius] [src:user/2026-10-07-airstrike-variants] [H]
- The client has no throw-range or blast-radius indicator for grenades (the touch aim line only shows the throw direction, 30 u for anything but guns), so nothing else follows the frag radius [src:survev/client/src/ui/touch.ts] [H]
