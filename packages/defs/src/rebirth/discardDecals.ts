// Ground decals of the rebirth (the owner, 2026-10-10; deliberate additions, docs/research/rebirth-deviations.md
// "Discarded launchers"):
// - a single-use launcher fired empty (the NLAW, Bazooka, Pvg m/42, M202 FLASH and Panzerfaust) drops its body at the
//   shooter's feet: a decal map object the simulation creates when the gun leaves its slot (sim world/timedDecals.ts),
//   turned to the shooter's facing (DecalView.rot) and removed after DISCARD_DECAL_LIFETIME s, like survev's timed
//   scorch decals (survev server decal.ts lifetime). It is ground art only: decals never collide and cannot be picked
//   up. The Boys and the Maadi are rifles, not launchers: nothing drops.
// - the Molotov's burning ground (rebirth/throwables.ts FIRE_DECAL_TYPE), flickering like the original light decals.
// The launcher bodies are the owner's art cut from the 2026-10-10 sheet at install time (tools/assets/decalSheet.ts);
// a machine without it draws the gun's held sprite instead (the sprite manifest's fallback). The Panzerfaust has no
// drawing on the sheet: its decal is its drawn held sprite.
import type { DecalDef, MapObjectDef } from "../types/index.ts";
import { FIRE_DECAL_TYPE, MOLOTOV_FIRE } from "./throwables.ts";

/** Seconds a discarded launcher lies on the ground before it fades out. */
export const DISCARD_DECAL_LIFETIME = 45;

export interface DiscardDecalArt {
    /** decal map object id */
    decal: string;
    /** sprite of the decal */
    sprite: string;
    /** logical size of the sprite (the owner's cut is fitted into it, barrel up) */
    size: readonly [number, number];
    /** length of the body on the ground, world units (sets the decal scale) */
    length: number;
    /** the sprite drawn while the owner's cut is not installed (the gun's held sprite); absent: `sprite` ships */
    fallback?: string;
}

/** The launchers that leave their body behind, by gun id. */
export const DISCARD_DECALS: Readonly<Record<string, DiscardDecalArt>> = {
    nlaw: {
        decal: "decal_nlaw_discard",
        sprite: "decal-nlaw-01.img",
        size: [64, 224],
        length: 4.2,
        fallback: "gun-potato-cannon-01.img",
    },
    bazooka: {
        decal: "decal_bazooka_discard",
        sprite: "decal-bazooka-01.img",
        size: [64, 232],
        length: 4.4,
        fallback: "gun-potato-cannon-01.img",
    },
    pvg42: {
        decal: "decal_pvg42_discard",
        sprite: "decal-pvg42-01.img",
        size: [56, 232],
        length: 4.2,
        fallback: "gun-long-01.img",
    },
    m202: {
        decal: "decal_m202_discard",
        sprite: "decal-m202-01.img",
        size: [88, 200],
        length: 3.6,
        fallback: "gun-m202-01.img",
    },
    panzerfaust: { decal: "decal_panzerfaust_discard", sprite: "gun-panzerfaust-01.img", size: [56, 210], length: 3.8 },
};

/** The decal a discarded `gun` leaves, undefined when it leaves none. */
export function discardDecalOf(gun: string): string | undefined {
    return Object.hasOwn(DISCARD_DECALS, gun) ? DISCARD_DECALS[gun].decal : undefined;
}

/** The burning ground's sprite (our own, committed under /rebirth/fx/) and its logical size. */
export const FIRE_DECAL_SPRITE = "map-molotov-fire-01.img";
export const FIRE_DECAL_SPRITE_SIZE = [256, 256] as const;
export const FIRE_DECAL_URL = "/rebirth/fx/map-molotov-fire-01.svg";

/** Pixels per world unit of the client (render/camera.ts PIXELS_PER_UNIT). */
const PX = 16;
const DOT = { type: 0 as const, pos: { x: 0, y: 0 }, rad: 1 };

/** The rebirth ground decals: the fire, then the launcher bodies (registry order). */
export function rebirthGroundDecals(): Record<string, MapObjectDef> {
    const fire: DecalDef = {
        type: "decal",
        collision: { ...DOT, rad: MOLOTOV_FIRE.rad },
        height: 0,
        lifetime: MOLOTOV_FIRE.duration,
        // the sprite's flames reach its edge: 2 x rad across
        img: {
            sprite: FIRE_DECAL_SPRITE,
            scale: (MOLOTOV_FIRE.rad * 2 * PX) / FIRE_DECAL_SPRITE_SIZE[0],
            alpha: 1,
            tint: 0xffffff,
            zIdx: 12,
            ignoreAdjust: true,
            flicker: true,
            flickerMin: 0.94,
            flickerMax: 1.06,
            flickerRate: 0.3,
        },
    };
    const out: Record<string, MapObjectDef> = { [FIRE_DECAL_TYPE]: fire };
    for (const art of Object.values(DISCARD_DECALS)) {
        out[art.decal] = {
            type: "decal",
            collision: { ...DOT },
            height: 0,
            lifetime: DISCARD_DECAL_LIFETIME,
            img: {
                sprite: art.sprite,
                scale: Number(((art.length * PX) / art.size[1]).toFixed(4)),
                alpha: 1,
                tint: 0xffffff,
                zIdx: 12,
                ignoreAdjust: true,
            },
        } satisfies DecalDef;
    }
    return out;
}
