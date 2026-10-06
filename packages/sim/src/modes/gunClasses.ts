// Gun classes of the v0.8.82 guns. The defs carry no class field; the grouping follows docs/research/items/guns.md
// "Stat tables by class". Mode rules use it: the Woods tier_guns holds only shotguns and LMGs (modes/woods.md), Savannah
// bans shotguns, LMGs, assault rifles but the SCAR-H and high-quality SMGs but the CZ-3A1 (modes/savannah.md "Rules").

export type GunClass = "pistol" | "smg" | "shotgun" | "assault" | "dmr" | "sniper" | "lmg" | "special";

const CLASSES: Readonly<Record<GunClass, readonly string[]>> = {
    pistol: [
        "m9",
        "m9_dual",
        "m93r",
        "m93r_dual",
        "glock",
        "glock_dual",
        "p30l",
        "p30l_dual",
        "ot38",
        "ot38_dual",
        "ots38",
        "ots38_dual",
        "colt45",
        "colt45_dual",
        "m1911",
        "m1911_dual",
        "deagle",
        "deagle_dual",
        "flare_gun",
        "flare_gun_dual",
    ],
    smg: ["mp5", "mac10", "ump9", "vector", "vector45", "scorpion", "m1a1"],
    shotgun: ["m870", "m1100", "mp220", "saiga", "spas12", "m1014", "usas"],
    assault: ["ak47", "scar", "an94", "groza", "grozas", "famas", "hk416", "m4a1"],
    dmr: ["mk12", "m39", "garand", "svd", "l86", "vss", "mkg45", "scarssr"],
    sniper: ["mosin", "sv98", "awc", "blr", "model94", "scout_elite"],
    lmg: ["dp28", "bar", "m249", "qbb97", "pkp"],
    special: ["potato_cannon", "potato_smg", "bugle", "m9_cursed"],
};

const BY_GUN = new Map<string, GunClass>();
for (const [cls, guns] of Object.entries(CLASSES) as Array<[GunClass, readonly string[]]>) {
    for (const gun of guns) BY_GUN.set(gun, cls);
}

/** Class of a gun id; undefined for anything that is not a known gun. */
export function gunClass(type: string): GunClass | undefined {
    return BY_GUN.get(type);
}

/** Every gun id of a class. */
export function gunsOfClass(cls: GunClass): readonly string[] {
    return CLASSES[cls];
}
