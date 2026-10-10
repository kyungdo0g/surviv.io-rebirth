// The lights of the rebirth's pitch-dark interiors (the owner's wave 3, 2026-10-10: "the subway station inside is pitch
// dark, so shooting a gun gives a very short flash of light, and grenades can give light too";
// docs/research/rebirth-deviations.md "The abandoned subway station"). Shared by the client's overlay
// (apps/client fx/darkness.ts) and the bots' vision in the dark (packages/bots perception/darkness.ts), so a bot never
// sees more in the dark than the overlay lets a player see. Where it is dark: a structure floor marked
// `layers[i].dark`, under its building's ceiling, a building marked `dark`, and the stairs of a structure with a dark
// floor (types/mapObjects.ts StructureLayerDef.dark, BuildingDef.dark).

/** opacity of the dark shade at full fade */
export const DARK_ALPHA = 0.96;
/** the glow round the followed player: radius (world units) and how much of the shade it takes away at its centre */
export const PLAYER_LIGHT = { radius: 2.5, intensity: 0.8 } as const;
/** a muzzle flash: radius (world units) and life (seconds) */
export const SHOT_LIGHT = { radius: 9, duration: 0.08 } as const;
/** an explosion's light: radius as a multiple of its blast radius (rad.max) and life (seconds) */
export const EXPLOSION_LIGHT = { radiusMult: 1.5, duration: 0.5 } as const;
