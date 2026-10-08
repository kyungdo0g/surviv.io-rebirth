// The owner's new guns, as a beta (2026-10-07: "the guns are still beta, so just do the basics"): 30 guns plus the dual
// TEC-9 and dual vz. 61, with their bullets, explosions, the 40 mm lob and three new ammo types. Every number is the
// decided balance sheet's (docs/design/new-gun-stats.json, the machine-readable twin of new-gun-stats.md; ids, ammo and
// colours from docs/design/survev-content-and-new-guns.md section 8): newGuns.json holds its def objects unchanged,
// the loot icons included (loot-weapon-<id>.img, cut from the owner's sheets by tools/assets/newGuns.ts; the client
// draws the sheet's fallback icon, rebirth/newGunAssets.ts, while one is missing). packages/defs/test/newGuns.test.ts
// pins every def to the sheet.
// New fields (types/weapons.ts): charges + discardWhenEmpty (Boys 7 shots, Panzerfaust 1, M202 one volley), pumpEvery +
// pumpDelay (DP-12), speed.carry (DShK), goldOnly, handHeld, sound.discard; bullets noReflect, armDistance, noDistAdj.
// The owner's changes of 2026-10-08 are in the sheet too: the M79, GL-06 and MGL hold no equip slowdown and are held
// like a rifle (handHeld: rifle pose and hands, the muzzle on the aim line, barrelOffset 0), and the M202 fires a fixed
// 60° fan (fanAngle) bursting at the cursor, slides its shooter back (recoilKnockback) and breaks plated obstacles
// (armorPiercing, stonePiercing) with its bigger blasts.
import type {
    AmmoDef,
    BulletDef,
    EmoteDef,
    ExplosionDef,
    GameConfigDef,
    GameObjectDef,
    GunDef,
    ThrowableDef,
    TracerColor,
} from "../types/index.ts";
import data from "./newGuns.json" with { type: "json" };

export interface NewGunEntry {
    gun: GunDef;
    bullets: Record<string, BulletDef>;
    explosions: Record<string, ExplosionDef>;
    throwables: Record<string, ThrowableDef>;
}

interface NewGunData {
    ammo: Record<string, AmmoDef>;
    /** the sheet's five pack sizes (GameConfig.bagSizes has survev's five levels) */
    bagSizes: Record<string, number[]>;
    tracerColors: Record<string, TracerColor>;
    guns: Record<string, NewGunEntry>;
}

const DATA = data as unknown as NewGunData;

/** The new guns in the sheet's order (rifles, DMRs, snipers, pistols, SMGs, shotguns, launchers, snipers, LMGs). */
export const NEW_GUN_IDS: readonly string[] = Object.keys(DATA.guns);
/** The sheet's entry of a new gun (its gun, bullet, explosion and projectile defs). */
export function newGunEntry(id: string): NewGunEntry | undefined {
    return Object.hasOwn(DATA.guns, id) ? DATA.guns[id] : undefined;
}

/** New ammo: 40mm (teal; M79, GL-06, MGL), rocket (brown; RPG-7 only, gold only), 5.7x28 (pink; P90 only). */
export const NEW_AMMO_IDS = ["40mm", "rocket", "57mm"] as const;
/** Pseudo ammo of the single-use guns: no def and no bag row, like the bugle's (new-gun-stats.md 4.2). */
export const CHARGE_AMMO_IDS = ["boys_ammo", "panzerfaust_ammo", "m202_ammo"] as const;
/** Bag rows of the new ammo, inserted after this one so the ammo rows stay together (the wire order: schema 11). */
export const NEW_AMMO_BAG_AFTER = "45acp";
/** Ping emote of each new ammo (the sheet's ammo.*.emote ids; the emote wheel's ammo wedge pings the held gun's). */
export const NEW_AMMO_EMOTES: Readonly<Record<(typeof NEW_AMMO_IDS)[number], string>> = {
    "40mm": "emote_ammo40mm",
    rocket: "emote_ammorocket",
    "57mm": "emote_ammo57mm",
};
/**
 * Texture of a new ammo's ping emote: ammo-<id>.img, drawn by tools/assets/newGuns.ts like the original ammo emotes
 * (three nested squares in the ammo's loot tint); the client falls back to the generic ammo-box.img without it.
 */
export const newAmmoEmoteTexture = (ammo: string): string => `ammo-${ammo}.img`;

/** The ping emotes of the new ammo: the original ammo emotes' fields (emote_ammo45acp) with their own texture. */
function newAmmoEmoteDefs(): Record<string, EmoteDef> {
    const out: Record<string, EmoteDef> = {};
    for (const ammo of NEW_AMMO_IDS) {
        out[NEW_AMMO_EMOTES[ammo]] = {
            type: "emote",
            texture: newAmmoEmoteTexture(ammo),
            sound: "emote_01",
            channel: "ui",
            teamOnly: true,
            noCustom: true,
            category: 0,
        };
    }
    return out;
}

/**
 * The owner's loot icon of each new gun, its def's lootImg.sprite (cut from the 2026-10-07 line-art sheets by
 * tools/assets/newGuns.ts; the sheet's fallback icon, rebirth/newGunAssets.ts, stands in while one is missing).
 */
export const NEW_GUN_LOOT_ICONS: Readonly<Record<string, string>> = Object.fromEntries(
    NEW_GUN_IDS.map((id) => [id, `loot-weapon-${id.replace("_dual", "-dual")}.img`]),
);

/**
 * The new game objects in registry order: the new ammo, then each gun's bullets, explosions and projectiles (a def two
 * guns share, bullet_tec9 or the M79's grenade, once), then the guns, then the new ammo's ping emotes. Throws when two
 * guns define one id differently.
 */
export function newGunDefs(): Record<string, GameObjectDef> {
    const out: Record<string, GameObjectDef> = { ...DATA.ammo };
    const add = (id: string, def: GameObjectDef) => {
        if (Object.hasOwn(out, id) && JSON.stringify(out[id]) !== JSON.stringify(def)) {
            throw new Error(`new guns: "${id}" is defined twice with different values`);
        }
        out[id] = def;
    };
    for (const entry of Object.values(DATA.guns)) {
        for (const [id, def] of Object.entries(entry.bullets)) add(id, def);
        for (const [id, def] of Object.entries(entry.explosions)) add(id, def);
        for (const [id, def] of Object.entries(entry.throwables)) add(id, def);
    }
    for (const [id, entry] of Object.entries(DATA.guns)) add(id, entry.gun);
    for (const [id, def] of Object.entries(newAmmoEmoteDefs())) add(id, def);
    return out;
}

/**
 * GameConfig with the new ammo: bag rows (after .45 ACP, the sheet's first four pack sizes) and tracer colours. The
 * input is not mutated; an existing row throws.
 */
export function applyNewAmmoConfig(config: GameConfigDef): GameConfigDef {
    const bagSizes: Record<string, number[]> = {};
    for (const [item, sizes] of Object.entries(config.bagSizes)) {
        bagSizes[item] = sizes;
        if (item === NEW_AMMO_BAG_AFTER) {
            for (const id of NEW_AMMO_IDS) bagSizes[id] = [...DATA.bagSizes[id]];
        }
    }
    const tracerColors = { ...config.tracerColors };
    for (const id of NEW_AMMO_IDS) {
        if (Object.hasOwn(config.bagSizes, id) || Object.hasOwn(tracerColors, id)) {
            throw new Error(`new ammo "${id}" is already in GameConfig`);
        }
        tracerColors[id] = { ...DATA.tracerColors[id] };
    }
    if (!Object.hasOwn(bagSizes, NEW_AMMO_IDS[0])) throw new Error(`GameConfig.bagSizes has no ${NEW_AMMO_BAG_AFTER}`);
    return { ...config, bagSizes, tracerColors };
}
