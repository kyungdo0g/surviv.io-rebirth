// Role loadouts (M7a). The original client role defs carry no items: role kits were server data. A map's
// `gameConfig.roles.roleOverrides` (survev closures serialized as $byTeam / $weighted) is merged over the kit below
// like survev's util.mergeDeep (objects merge, arrays replace); roles without a map override use these kits, which are
// docs/research/items/roles.md "Starting gear (50v50)" and "Cobalt classes" with its conflict resolutions:
// no healing items on promotion (conflicts.md role-promotion-heals), no Bugler pan (role-bugler-pan), the Grenadier's
// MP220 with 12 frags + 8 MIRVs (grenadier-weapon, grenadier-grenades), the Lone Survivr's M249 / PKP 50/50.
import type { Rng } from "@rebirth/core";
import type { ByTeam, MapDef, RoleOverride, RoleWeapon, RoleWeaponSpec, Weighted } from "@rebirth/defs";

type TeamValue<T> = T | ByTeam<T>;

/** A role kit (survev roleDefs defaultItems). */
export interface RoleLoadout {
    /** per weapon slot; an entry with type "" refills the gun already in that slot instead */
    weapons: RoleWeaponSpec[];
    backpack?: string;
    helmet?: TeamValue<string>;
    chest?: string;
    outfit?: TeamValue<string>;
    /** the role's outfit cannot be swapped for a looted one (survev noDropOutfit: the Commander) */
    noDropOutfit?: boolean;
    inventory?: Record<string, number>;
}

/** A role kit resolved for one player: team values picked, weighted choices rolled. */
export interface ResolvedLoadout {
    weapons: RoleWeapon[];
    backpack: string;
    helmet: string;
    chest: string;
    outfit: string;
    noDropOutfit: boolean;
    inventory: Record<string, number>;
}

const NONE: RoleWeapon = { type: "", ammo: 0 };
const w = (type: string, ammo = 0, fillInv = false): RoleWeapon => (fillInv ? { type, ammo, fillInv } : { type, ammo });
const byTeam = <T>(red: T, blue: T): ByTeam<T> => ({ $byTeam: { red, blue } });

/** Kits of roles.md (survev pre-fork roleDefs 172a4348 minus fork additions; classes per the fandom class pages). */
export const ROLE_LOADOUTS: Readonly<Record<string, RoleLoadout>> = {
    leader: {
        weapons: [
            byTeam(w("m1014", 8, true), w("an94", 45, true)),
            w("flare_gun", 1),
            byTeam(w("machete_taiga"), w("kukri_trad")),
            NONE,
        ],
        backpack: "backpack03",
        helmet: "helmet04_leader",
        chest: "chest03",
        outfit: byTeam("outfitRedLeader", "outfitBlueLeader"),
        noDropOutfit: true,
        inventory: { "8xscope": 1 },
    },
    // survev-only Captain (survev roleDefs.ts:162-193): weapons refilled, the leader outfit, healing items
    captain: {
        weapons: [NONE, NONE, NONE, NONE],
        backpack: "backpack03",
        helmet: "helmet04_captain",
        chest: "chest03",
        outfit: byTeam("outfitRedLeader", "outfitBlueLeader"),
        noDropOutfit: true,
        inventory: { "8xscope": 1, bandage: 10, healthkit: 1, soda: 2 },
    },
    // survev-only Classless (survev roleDefs.ts:557-571): its helmet, nothing else (outfitClassless comes with the
    // survev outfits)
    classless: {
        weapons: [NONE, NONE, NONE, NONE],
        helmet: "helmet04_classless",
        inventory: {},
    },
    lieutenant: {
        weapons: [NONE, byTeam(w("m4a1", 40, true), w("grozas", 40, true)), w("spade_assault"), NONE],
        backpack: "backpack03",
        helmet: "helmet03_lt",
        chest: "chest03",
        inventory: { "4xscope": 1 },
    },
    medic: {
        weapons: [NONE, NONE, w("bonesaw_rusted"), w("smoke")],
        backpack: "backpack03",
        helmet: "helmet04_medic",
        chest: "chest03",
        inventory: { "4xscope": 1, bandage: 30, healthkit: 4, soda: 15, painkiller: 4, smoke: 6 },
    },
    marksman: {
        weapons: [
            NONE,
            byTeam<RoleWeapon | Weighted<RoleWeapon>>(
                {
                    $weighted: [
                        { ...w("l86", 30, true), weight: 0.9 },
                        { ...w("scarssr", 10, true), weight: 0.1 },
                    ],
                },
                {
                    $weighted: [
                        { ...w("svd", 10, true), weight: 0.9 },
                        { ...w("scarssr", 10, true), weight: 0.1 },
                    ],
                },
            ),
            w("kukri_sniper"),
            NONE,
        ],
        backpack: "backpack03",
        helmet: "helmet03_marksman",
        chest: "chest03",
        inventory: { "8xscope": 1 },
    },
    recon: {
        weapons: [NONE, w("glock_dual", 34, true), w("crowbar_recon"), NONE],
        backpack: "backpack03",
        helmet: "helmet03_recon",
        chest: "chest03",
        inventory: { "4xscope": 1, soda: 6 },
    },
    grenadier: {
        weapons: [NONE, w("mp220", 2, true), w("katana"), w("mirv", 8)],
        backpack: "backpack03",
        helmet: "helmet03_grenadier",
        chest: "chest03",
        inventory: { "4xscope": 1, frag: 12, mirv: 8 },
    },
    bugler: {
        weapons: [NONE, w("bugle", 1), NONE, NONE],
        backpack: "backpack03",
        helmet: "helmet03_bugler",
        chest: "chest03",
        inventory: { "4xscope": 1 },
    },
    last_man: {
        weapons: [
            NONE,
            {
                $weighted: [
                    { ...w("m249", 100, true), weight: 1 },
                    { ...w("pkp", 200, true), weight: 1 },
                ],
            },
            NONE,
            w("mirv", 8),
        ],
        backpack: "backpack03",
        helmet: byTeam("helmet04_last_man_red", "helmet04_last_man_blue"),
        chest: "chest04",
        inventory: { "8xscope": 1, mirv: 8 },
    },
    healer: { weapons: [NONE, NONE, NONE, NONE], outfit: "outfitMedic", inventory: { healthkit: 1 } },
    tank: { weapons: [NONE, NONE, NONE, NONE], outfit: "outfitTank", chest: "chest01" },
    sniper: { weapons: [NONE, NONE, NONE, NONE], outfit: "outfitSniper", inventory: { "2xscope": 1 } },
    scout: { weapons: [NONE, NONE, NONE, NONE], outfit: "outfitScout", inventory: { soda: 1 } },
    demo: { weapons: [NONE, NONE, NONE, NONE], outfit: "outfitDemo", backpack: "backpack01" },
    assault: { weapons: [NONE, NONE, NONE, NONE], outfit: "outfitAssault", inventory: { bandage: 5 } },
};

function isByTeam<T>(v: unknown): v is ByTeam<T> {
    return typeof v === "object" && v !== null && "$byTeam" in v;
}

function isWeighted<T>(v: unknown): v is Weighted<T> {
    return typeof v === "object" && v !== null && "$weighted" in v;
}

/** Team-dependent values use the faction (Red 1, Blue 2); other modes alternate by team id (survev clampedTeamId). */
function pickTeam<T>(v: TeamValue<T>, teamId: number): T {
    if (!isByTeam<T>(v)) return v;
    const clamped = ((Math.max(teamId, 1) - 1) % 2) + 1;
    return clamped === 1 ? v.$byTeam.red : v.$byTeam.blue;
}

/** A weighted choice with the seeded rng (survev util.weightedRandom). */
function pickWeighted<T extends object>(v: T | Weighted<T>, rng: Rng): T {
    if (!isWeighted<T>(v)) return v;
    const choice = rng.weighted(v.$weighted, (o) => o.weight);
    const { weight: _weight, ...rest } = choice;
    return rest as unknown as T;
}

export function resolveWeapon(spec: RoleWeaponSpec, teamId: number, rng: Rng): RoleWeapon {
    return pickWeighted<RoleWeapon>(pickTeam<RoleWeapon | Weighted<RoleWeapon>>(spec, teamId), rng);
}

/** The kit of `role` with the map's override merged in (survev promoteToRole mergeDeep), or null for none. */
export function roleLoadout(role: string, map: MapDef): RoleLoadout | null {
    const base = ROLE_LOADOUTS[role];
    const override: RoleOverride | undefined = map.gameConfig.roles?.roleOverrides?.[role];
    const items = override?.defaultItems;
    if (!items) return base ?? null;
    const merged: RoleLoadout = { ...(base ?? { weapons: [NONE, NONE, NONE, NONE] }) };
    if (items.weapons) merged.weapons = items.weapons;
    if (items.backpack !== undefined) merged.backpack = items.backpack;
    if (items.helmet !== undefined) merged.helmet = items.helmet;
    if (items.chest !== undefined) merged.chest = items.chest;
    if (items.outfit !== undefined) merged.outfit = items.outfit;
    if (items.inventory) merged.inventory = { ...(base?.inventory ?? {}), ...items.inventory };
    return merged;
}

/** Picks the team values and rolls the weighted choices of a kit for a player of `teamId`. */
export function resolveLoadout(kit: RoleLoadout, teamId: number, rng: Rng): ResolvedLoadout {
    return {
        weapons: kit.weapons.map((spec) => resolveWeapon(spec, teamId, rng)),
        backpack: kit.backpack ?? "",
        helmet: kit.helmet === undefined ? "" : pickTeam(kit.helmet, teamId),
        chest: kit.chest ?? "",
        outfit: kit.outfit === undefined ? "" : pickTeam(kit.outfit, teamId),
        noDropOutfit: kit.noDropOutfit ?? false,
        inventory: { ...(kit.inventory ?? {}) },
    };
}
