// Art and sound fallbacks of the owner's new guns (beta, 2026-10-07). The owner's files are gitignored
// (assets-user/: the loot icons cut from the line-art sheets of assets-user/source/2026-10-07-sheets/, the recorded or
// derived clips of assets-user/audio/guns/, see its MANIFEST.md); tools/assets/newGuns.ts installs them into the
// client's asset folder, and anything missing is replaced by the original gun named here, so the game always draws
// and plays something. Values: docs/design/new-gun-stats.json `guns.<id>.assets` (lootImg.fallback, sounds), with the
// owner's later decisions (MANIFEST.md "Owner decisions", round 2): the Mk 14 EBR fires like the MK12 SPR and
// switches / reloads like the Mk 20 SSR (whose def plays the SCAR files), the AS Val and the AK-47 reload like the new
// AK-74 (so its donor is the AK-47's reload), the TEC-9 reloads like the G18C.

/** The sheet's fallback loot icon of each new gun (an original gun's icon), drawn while the owner's is missing. */
export const NEW_GUN_LOOT_FALLBACKS: Readonly<Record<string, string>> = {
    ak74: "loot-weapon-ak.img",
    g36c: "loot-weapon-hk416.img",
    m16a4: "loot-weapon-famas.img",
    sig550: "loot-weapon-hk416.img",
    g3: "loot-weapon-scar.img",
    honeybadger: "loot-weapon-m4a1.img",
    fal: "loot-weapon-m39.img",
    mk14: "loot-weapon-m39.img",
    wa2000: "loot-weapon-sv98.img",
    tec9: "loot-weapon-m93r.img",
    tec9_dual: "loot-weapon-m9-dual.img",
    vz61: "loot-weapon-glock.img",
    vz61_dual: "loot-weapon-glock-dual.img",
    bizon: "loot-weapon-mp5.img",
    m1928: "loot-weapon-m1a1.img",
    asval: "loot-weapon-vss.img",
    p90: "loot-weapon-vector.img",
    dp12: "loot-weapon-m870.img",
    aa12: "loot-weapon-saiga.img",
    m79: "loot-weapon-potato-cannon.img",
    mgl: "loot-weapon-potato-cannon.img",
    gl06: "loot-weapon-potato-cannon.img",
    rpg7: "loot-weapon-potato-cannon.img",
    panzerfaust: "loot-weapon-potato-cannon.img",
    m202: "loot-weapon-potato-cannon.img",
    m200: "loot-weapon-sv98.img",
    hecate: "loot-weapon-awc.img",
    lynx: "loot-weapon-awc.img",
    boys: "loot-weapon-mosin.img",
    m60: "loot-weapon-pkp.img",
    mg42: "loot-weapon-pkp.img",
    dshk: "loot-weapon-pkp.img",
};

/**
 * Every sound a new gun names that the original lists lack -> the original sound that plays when the owner's clip is
 * missing (the sheet's donors; a name two guns share, `tec9_01`, takes the single gun's). The shared empty and pickup
 * sounds (empty_fire_01 / 02, gun_pickup_01) are the originals' and need no entry.
 */
export const NEW_GUN_SOUND_DONORS: Readonly<Record<string, string>> = {
    ak74_01: "ak47_01",
    ak74_reload_01: "ak47_reload_01",
    ak74_switch_01: "ak47_switch_01",
    g36c_01: "hk416_01",
    g36c_reload_01: "hk416_reload_01",
    g36c_switch_01: "hk416_switch_01",
    m16a4_01: "famas_01",
    m16a4_reload_01: "famas_reload_01",
    m16a4_switch_01: "famas_switch_01",
    sig550_01: "hk416_01",
    sig550_reload_01: "hk416_reload_01",
    sig550_switch_01: "hk416_switch_01",
    g3_01: "scar_01",
    g3_reload_01: "scar_reload_01",
    g3_switch_01: "scar_switch_01",
    honeybadger_01: "m4a1_01",
    honeybadger_reload_01: "m4a1_reload_01",
    honeybadger_switch_01: "m4a1_switch_01",
    fal_01: "m39_01",
    fal_reload_01: "m39_reload_01",
    fal_switch_01: "m39_switch_01",
    // owner (MANIFEST.md round 2): Mk 14 fire = MK12 SPR fire, switch and reload = Mk 20 SSR (the SCAR files)
    mk14_01: "mk12_01",
    mk14_reload_01: "scar_reload_01",
    mk14_switch_01: "scar_switch_01",
    wa2000_01: "sv98_01",
    wa2000_reload_01: "sv98_reload_01",
    wa2000_switch_01: "sv98_cycle_01",
    wa2000_cycle_01: "sv98_cycle_01",
    wa2000_pull_01: "sv98_pull_01",
    tec9_01: "m93r_01",
    // owner (MANIFEST.md round 1): TEC-9 reload = the original G18C reload, so the dual TEC-9's is the dual G18C's
    tec9_reload_01: "glock_reload_01",
    tec9_switch_01: "m93r_switch_01",
    tec9_reload_02: "glock_reload_02",
    vz61_01: "glock_01",
    vz61_reload_01: "glock_reload_01",
    vz61_switch_01: "glock_switch_01",
    vz61_reload_02: "glock_reload_02",
    bizon_01: "mp5_01",
    bizon_reload_01: "mp5_reload_01",
    bizon_switch_01: "mp5_switch_01",
    m1928_01: "m1a1_01",
    m1928_reload_01: "m1a1_reload_01",
    m1928_switch_01: "m1a1_switch_01",
    asval_01: "vss_01",
    // owner (MANIFEST.md round 1): AS Val reload = AK-74 reload, whose own donor is the AK-47's
    asval_reload_01: "ak47_reload_01",
    asval_switch_01: "vss_switch_01",
    p90_01: "vector_01",
    p90_reload_01: "vector_reload_01",
    p90_switch_01: "vector_switch_01",
    dp12_01: "m870_01",
    dp12_reload_01: "m870_reload_01",
    dp12_switch_01: "m870_cycle_01",
    dp12_cycle_01: "m870_cycle_01",
    dp12_pull_01: "m870_pull_01",
    aa12_01: "saiga_01",
    aa12_reload_01: "saiga_reload_01",
    aa12_switch_01: "saiga_switch_01",
    m79_01: "potato_cannon_01",
    m79_reload_01: "potato_cannon_reload_01",
    m79_switch_01: "potato_cannon_switch_01",
    mgl_01: "potato_cannon_01",
    mgl_reload_01: "potato_cannon_reload_01",
    mgl_switch_01: "potato_cannon_switch_01",
    gl06_01: "potato_cannon_01",
    gl06_reload_01: "potato_cannon_reload_01",
    gl06_switch_01: "potato_cannon_switch_01",
    rpg7_01: "potato_cannon_01",
    rpg7_reload_01: "potato_cannon_reload_01",
    rpg7_switch_01: "potato_cannon_switch_01",
    panzerfaust_01: "potato_cannon_01",
    panzerfaust_switch_01: "potato_cannon_switch_01",
    panzerfaust_discard_01: "gun_pickup_01",
    m202_01: "potato_cannon_01",
    m202_switch_01: "potato_cannon_switch_01",
    m202_discard_01: "gun_pickup_01",
    m200_01: "sv98_01",
    m200_reload_01: "sv98_reload_01",
    m200_switch_01: "sv98_cycle_01",
    m200_cycle_01: "sv98_cycle_01",
    m200_pull_01: "sv98_pull_01",
    hecate_01: "awc_01",
    hecate_reload_01: "awc_reload_01",
    hecate_switch_01: "awc_cycle_01",
    hecate_cycle_01: "awc_cycle_01",
    hecate_pull_01: "awc_pull_01",
    lynx_01: "awc_01",
    lynx_reload_01: "awc_reload_01",
    lynx_switch_01: "awc_cycle_01",
    lynx_cycle_01: "awc_cycle_01",
    lynx_pull_01: "awc_pull_01",
    boys_01: "mosin_01",
    boys_switch_01: "mosin_cycle_01",
    boys_cycle_01: "mosin_cycle_01",
    boys_pull_01: "mosin_pull_01",
    boys_discard_01: "gun_pickup_01",
    m60_01: "pkp_01",
    m60_reload_01: "pkp_reload_01",
    m60_switch_01: "pkp_switch_01",
    mg42_01: "pkp_01",
    mg42_reload_01: "pkp_reload_01",
    mg42_switch_01: "pkp_switch_01",
    dshk_01: "pkp_01",
    dshk_reload_01: "pkp_reload_01",
    dshk_switch_01: "pkp_switch_01",
};

/**
 * Original sounds the owner's folder replaces (MANIFEST.md round 1: "the AK-74 reload also replaces the AK-47's",
 * ak47_reload_01.mp3 there being a copy of ak74_reload_01.mp3); without the owner's file the original plays.
 */
export const REPLACED_ORIGINAL_SOUNDS: readonly string[] = ["ak47_reload_01"];

/** Asset path (under the client's /assets/) of an installed new-gun sound, the owner's clip or its donor's copy. */
export function newGunSoundPath(name: string): string {
    return `audio/rebirth/guns/${name}.mp3`;
}

/** Asset path of an installed new-gun loot icon ("loot-weapon-ak74.img" -> img/rebirth/loot-weapon-ak74.png). */
export function newGunIconPath(sprite: string): string {
    return `img/rebirth/${sprite.replace(/\.img$/, "")}.png`;
}
