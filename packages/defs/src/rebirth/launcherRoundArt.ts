// The launcher rounds drawn in flight (owner, 2026-10-08: the M79, MGL and GL-06 fire the same 40 mm round, the
// RPG-7, Panzerfaust and M202 their own rockets, "탄두 사진 같이 있음"): our own art, minimal hand-written SVGs seen
// from above, nose up, committed under apps/client/public/rebirth/guns/proj-<name>-01.svg next to the held sprites
// (heldGunArt.ts) and served at /rebirth/guns/. Presentation only: the client draws them (fx/bullets.ts for the
// rockets and the GL-06's grenade, which are bullets; objects/projectiles.ts for the M79 and MGL's lobbed m79_grenade,
// whose bullets bullet_m79 / bullet_mgl are invisible), turned along the flight; the defs, the simulation and the wire
// are unchanged. docs/research/rebirth-deviations.md "Top-down held sprites".

/** The round sprites and their logical size (the SVG's width and height). */
export const LAUNCHER_ROUND_ART = {
    "proj-40mm-01.img": [16, 34],
    "proj-rpg7-01.img": [16, 58],
    "proj-m202-01.img": [16, 54],
    "proj-panzerfaust-01.img": [18, 46],
} as const satisfies Readonly<Record<string, readonly [number, number]>>;

export type LauncherRoundSprite = keyof typeof LAUNCHER_ROUND_ART;

export interface LauncherRound {
    sprite: LauncherRoundSprite;
    /** draw scale, world px (16 per unit) per sprite px: the RPG-7's round about one body across */
    scale: number;
}

/**
 * What a flying launcher round draws, by bullet or throwable type: the 40 mm grenade for the GL-06's bullet and the
 * M79 and MGL's projectile (m79_grenade, which the projectile view grows with its height like a frag), each rocket
 * for its bullet (the M202's four in its fan).
 */
export const LAUNCHER_ROUNDS: Readonly<Record<string, LauncherRound>> = {
    m79_grenade: { sprite: "proj-40mm-01.img", scale: 0.4 },
    bullet_gl06: { sprite: "proj-40mm-01.img", scale: 0.45 },
    bullet_rpg7: { sprite: "proj-rpg7-01.img", scale: 0.6 },
    bullet_panzerfaust: { sprite: "proj-panzerfaust-01.img", scale: 0.6 },
    bullet_m202: { sprite: "proj-m202-01.img", scale: 0.5 },
};

/** The round `type` (a bullet or throwable id) is drawn with in flight, if any. */
export function launcherRound(type: string): LauncherRound | undefined {
    return Object.hasOwn(LAUNCHER_ROUNDS, type) ? LAUNCHER_ROUNDS[type] : undefined;
}
