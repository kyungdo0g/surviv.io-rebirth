// Gun classes of the v0.8.82 guns and the survev-only guns the port takes (tools/port-survev/policy.json). The defs
// carry no class field; the grouping follows docs/research/items/guns.md "Stat tables by class" and, for the
// survev-only guns, their survev.wiki.gg "Gun type" (Barrett M107 sniper rifle, ASh-12 assault rifle, S&W 500 pistol,
// IMD-2 LMG, SPAS-16 shotgun, PMG-134 LMG on the wiki but a potato gun here, with the other potato guns; the winter
// skins as their base). Mode rules use it: the Woods tier_guns holds only shotguns and LMGs (modes/woods.md), Savannah
// bans shotguns, LMGs, assault rifles but the SCAR-H and high-quality SMGs but the CZ-3A1 (modes/savannah.md "Rules").
// The rebirth's new guns (rebirth/newGuns.ts) take the classes of docs/design/new-gun-stats.json `gunClasses`; its six
// launchers are the new `launcher` class (the potato cannon stays `special` with the potato guns).

export type GunClass = "pistol" | "smg" | "shotgun" | "assault" | "dmr" | "sniper" | "lmg" | "launcher" | "special";

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
        "sw500",
        "tec9",
        "tec9_dual",
        "vz61",
        "vz61_dual",
    ],
    smg: ["mp5", "mac10", "ump9", "vector", "vector45", "scorpion", "m1a1", "bizon", "m1928", "asval", "p90"],
    shotgun: ["m870", "m1100", "mp220", "saiga", "spas12", "m1014", "usas", "spas16", "dp12", "aa12", "jackhammer"],
    assault: [
        "ak47",
        "scar",
        "an94",
        "groza",
        "grozas",
        "famas",
        "hk416",
        "m4a1",
        "ash12",
        "ak74",
        "g36c",
        "m16a4",
        "sig550",
        "g3",
        "honeybadger",
    ],
    dmr: ["mk12", "m39", "garand", "svd", "l86", "vss", "mkg45", "scarssr", "svd_winter", "fal", "mk14"],
    sniper: [
        "mosin",
        "sv98",
        "awc",
        "blr",
        "model94",
        "scout_elite",
        "barrett",
        "sv98_winter",
        "awc_winter",
        "wa2000",
        "m200",
        "hecate",
        "lynx",
        "boys",
        "pvg42",
        "maadi",
    ],
    lmg: ["dp28", "bar", "m249", "qbb97", "pkp", "imbel", "m60", "mg42", "dshk", "rpd", "bren", "mg3", "negev", "kpv"],
    launcher: ["m79", "mgl", "gl06", "rpg7", "panzerfaust", "m202", "nlaw", "paw20", "bazooka"],
    special: ["potato_cannon", "potato_smg", "bugle", "m9_cursed", "potato_lmg"],
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

/**
 * Items that never spawn on a map, removed from every loot table of its def by the port (tools/port-survev step 3c).
 * Savannah: no shotguns, no assault rifles but the SCAR-H, no LMGs, no high-quality SMGs but the CZ-3A1, no 2x scopes
 * (docs/research/modes/savannah.md "Rules", fandom Savannah_Map); the rebirth's quality 1 SMGs (AS Val, P90, M1928)
 * likewise (docs/design/new-gun-stats.md section 2: "banned on Savannah (quality 1 SMG)").
 */
export const LOOT_BANS: Readonly<Record<string, readonly string[]>> = {
    savannah: [
        ...gunsOfClass("shotgun"),
        ...gunsOfClass("lmg"),
        ...gunsOfClass("assault").filter((g) => g !== "scar"),
        "vector",
        "vector45",
        "asval",
        "p90",
        "m1928",
        "2xscope",
    ],
};
