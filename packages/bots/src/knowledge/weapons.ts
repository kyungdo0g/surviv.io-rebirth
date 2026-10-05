// What bots know about guns, derived from the defs: a class (shotgun, smg, rifle, dmr, sniper, pistol), the distances
// they like to fight at, a sustained-DPS based score used to compare guns on the ground, and a suitability curve per
// distance used to pick the slot in a fight. Ranges follow docs/research/items/guns.md (bullet distance, spread) and
// the community loadout advice (docs/research/namu.md /팁: a medium-range gun plus a shotgun or SMG).
import { GameObjectDefs, type GunDef, hasDef } from "@rebirth/defs";

export type WeaponClass = "shotgun" | "smg" | "rifle" | "dmr" | "sniper" | "pistol" | "useless";

export interface GunInfo {
    id: string;
    def: GunDef;
    cls: WeaponClass;
    ammo: string;
    /** bullet travel distance */
    range: number;
    bulletSpeed: number;
    /** distances the bot prefers to fight at with it */
    idealMin: number;
    idealMax: number;
    /** farthest distance worth shooting at */
    maxEngage: number;
    /** sustained damage per second over magazine + reload */
    dps: number;
    /** comparison score for loot decisions (0 for guns bots never want) */
    score: number;
}

/** Guns bots never pick up: no damage (flare gun, bugle, potato guns) or ammo outside the bag. */
const USELESS = new Set(["flare_gun", "flare_gun_dual", "bugle", "potato_cannon", "potato_smg", "m9_cursed"]);

const cache = new Map<string, GunInfo | null>();

function classify(def: GunDef, range: number): WeaponClass {
    if (def.bulletCount > 1 || (def.ammo === "12gauge" && range < 40)) return "shotgun";
    if (def.fireMode === "single" && def.fireDelay >= 0.7 && range >= 300) return "sniper";
    if (def.fireMode === "single" && range >= 300) return "dmr";
    if (def.pistol || def.switchDelay <= 0.3) return "pistol";
    if (range < 130 || def.shotSpread >= 6) return "smg";
    return "rifle";
}

const IDEAL: Readonly<Record<WeaponClass, [number, number, number]>> = {
    shotgun: [2, 8, 14],
    smg: [4, 16, 32],
    pistol: [4, 16, 30],
    rifle: [8, 30, 55],
    dmr: [15, 42, 70],
    sniper: [20, 50, 80],
    useless: [0, 0, 0],
};

/** Gun knowledge for a GameObjectDefs id, or undefined when it is not a gun. */
export function gunInfo(id: string): GunInfo | undefined {
    if (!id) return undefined;
    const hit = cache.get(id);
    if (hit !== undefined) return hit ?? undefined;
    if (!hasDef(id) || GameObjectDefs[id].type !== "gun") {
        cache.set(id, null);
        return undefined;
    }
    const def = GameObjectDefs[id] as GunDef;
    const bullet = hasDef(def.bulletType)
        ? (GameObjectDefs[def.bulletType] as { damage?: number; distance?: number; speed?: number })
        : {};
    const damage = bullet.damage ?? 0;
    const range = bullet.distance ?? 0;
    const useless = USELESS.has(id) || damage <= 0;
    const cls = useless ? "useless" : classify(def, range);
    const burst = def.fireMode === "burst" ? (def.burstCount ?? 1) : 1;
    const cycle =
        def.fireMode === "burst" ? (def.fireDelay + (burst - 1) * (def.burstDelay ?? 0)) / burst : def.fireDelay;
    const perShot = damage * def.bulletCount;
    // pellets spread: a shotgun lands roughly two thirds of them at its fighting range
    const hitRate = def.bulletCount > 1 ? 0.65 : Math.max(0.35, 1 - (def.shotSpread + def.moveSpread * 0.5) / 30);
    const clip = Math.max(1, def.maxClip);
    const sustained = (clip * perShot * hitRate) / (clip * Math.max(cycle, 0.01) + def.reloadTime);
    const [idealMin, idealMax, maxEngageBase] = IDEAL[cls];
    const maxEngage = Math.min(maxEngageBase, range * 0.9);
    // longer reach is worth more: it wins fights before they start
    const reach = cls === "sniper" || cls === "dmr" ? 1.25 : cls === "rifle" ? 1.15 : cls === "shotgun" ? 1.1 : 1;
    const score = useless ? 0 : sustained * reach;
    const info: GunInfo = {
        id,
        def,
        cls,
        ammo: def.ammo,
        range,
        bulletSpeed: bullet.speed ?? 100,
        idealMin,
        idealMax,
        maxEngage,
        dps: sustained,
        score,
    };
    cache.set(id, info);
    return info;
}

/** How well a gun fits a fight at `dist` (0 useless .. 1 ideal). */
export function suitability(info: GunInfo, dist: number): number {
    if (info.cls === "useless" || dist > info.range) return 0;
    if (dist < info.idealMin) return 0.7 + 0.3 * (dist / Math.max(info.idealMin, 1e-6));
    if (dist <= info.idealMax) return 1;
    if (dist >= info.maxEngage) return Math.max(0, 0.25 * (1 - (dist - info.maxEngage) / info.maxEngage));
    return 1 - 0.75 * ((dist - info.idealMax) / Math.max(info.maxEngage - info.idealMax, 1e-6));
}

/** Rounds left for a gun: magazine plus bag. */
export function totalAmmo(gun: { type: string; ammo: number }, inventory: Readonly<Record<string, number>>): number {
    const info = gunInfo(gun.type);
    if (!info) return 0;
    return gun.ammo + (inventory[info.ammo] ?? 0);
}

/** Whether a held weapon id is a melee weapon (or nothing): such a player cannot shoot. */
export function isMeleeWeapon(id: string): boolean {
    return !id || !hasDef(id) || GameObjectDefs[id].type === "melee";
}
