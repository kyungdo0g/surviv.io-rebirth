// Explosion-gated doors for the wave 3 buildings (the owner, 2026-10-10: "a bunker only strong firepower like the M202
// can open"; "an abandoned subway station: no way in, strong firepower must blast its door"). Wall-like slabs that
// block a 4-unit doorway; only explosions damage them (ObstacleDef.explosionGate, sim combat.ts canDamageObstacle):
// bullets, melee, shrapnel and projectile impacts never do; a landing air drop crate still flattens the subway gate,
// never the blast door, which counts launcher hits (BLAST_DOOR_HITS_TO_OPEN, the owner, 2026-10-11). Steel look and sounds
// from survev's metal obstacles (locker_01 / metal_wall_ext_*: barrelChip, wall_bullet, metal_punch). Their sprites
// are rebirth art (tools/assets/rebirthArt/blastDoors.ts, committed under apps/client/public/rebirth/map/).
import type { MapObjectDef, ObstacleDef } from "../../types/index.ts";
import type { RebirthBuildingArt } from "./layout.ts";

export const BLAST_DOOR = "blast_door_01";
export const SUBWAY_GATE = "subway_gate_01";

/**
 * The explosions that open the subway gate: every launcher's and rocket's round and the air strikes' bombs, never a hand
 * grenade or an exploding barrel (explosion ids from rebirth/newGuns.json and rebirth/airstrikeVariants.ts).
 */
export const SUBWAY_GATE_EXPLOSIONS: readonly string[] = [
    "explosion_m202",
    "explosion_rpg7",
    "explosion_nlaw",
    "explosion_panzerfaust",
    "explosion_bazooka",
    "explosion_paw20",
    "explosion_m79",
    "explosion_gl06",
    "explosion_bomb_heavy",
    "explosion_bomb_iron",
];

/**
 * The blast door's gate (the owner, 2026-10-11): one M202 rocket opens it, the NLAW on its 2nd round, the RPG-7 only on
 * its 6th rocket; nothing else does (Panzerfaust, 40 mm grenades, frags, Bazooka, Pvg m/42, air strike bombs). Each
 * listed explosion reaching the door is one hit, whatever its damage, worth 1/n of the door (mixed rounds add up: one
 * NLAW and three RPG-7 rockets open it; sim combat.ts gateHitShare counts them).
 */
export const BLAST_DOOR_HITS_TO_OPEN: Readonly<Record<string, number>> = {
    explosion_m202: 1,
    explosion_nlaw: 2,
    explosion_rpg7: 6,
};

/** Sprite pixels per world unit of the door images (drawn at img.scale 0.25: 16 px per unit on screen, as walls). */
const DOOR_ART_PPU = 64;

/** The two door images: one image each, no roof (the client's sprite entries and tools/assets draw them). */
export const BLAST_DOOR_ART: readonly RebirthBuildingArt[] = [
    { floor: "map-blast-door-01.img", size: [1.5 * DOOR_ART_PPU, 4 * DOOR_ART_PPU] },
    { floor: "map-subway-gate-01.img", size: [1 * DOOR_ART_PPU, 4 * DOOR_ART_PPU] },
];

function slab(halfWidth: number, sprite: string, health: number, gate: ObstacleDef["explosionGate"]): ObstacleDef {
    return {
        type: "obstacle",
        scale: { createMin: 1, createMax: 1, destroy: 1 },
        collision: { type: 1, min: { x: -halfWidth, y: -2 }, max: { x: halfWidth, y: 2 }, height: 0 },
        // as tall as a wall: bullets and blasts stop at it (survev house_wall_int_4 height 10)
        height: 10,
        isWall: false,
        collidable: true,
        destructible: true,
        health,
        hitParticle: "barrelChip",
        explodeParticle: "barrelBreak",
        reflectBullets: false,
        loot: [],
        map: { display: false },
        img: { sprite, scale: 0.25, alpha: 1, tint: 0xffffff, zIdx: 10 },
        sound: { bullet: "wall_bullet", punch: "metal_punch", explode: "barrel_break_01", enter: "none" },
        material: "metal",
        extents: { x: halfWidth, y: 2 },
        explosionGate: gate,
    };
}

/** blast_door_01 (the bunker's armoured hatch door, 1.5 x 4) and subway_gate_01 (the rusted shutter, 1 x 4). */
export function blastDoorDefs(): Record<string, MapObjectDef> {
    return {
        [BLAST_DOOR]: slab(0.75, "map-blast-door-01.img", 2000, { hitsToOpen: BLAST_DOOR_HITS_TO_OPEN }),
        [SUBWAY_GATE]: slab(0.5, "map-subway-gate-01.img", 300, { explosionTypes: SUBWAY_GATE_EXPLOSIONS }),
    };
}
