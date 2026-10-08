// The owner's loot weights (deliberate rebirth deviations, user/2026-10-08-loot-speed): every weight the owner set on
// 2026-10-08, in one table, so the full rarity list the owner will send later only means editing the numbers below.
// Pure data (no imports): the modules that place the rows read it.
// - classicFloor: rows appended to `tier_guns` of OWNER_CLASSIC_FLOOR_MAPS (rebirth/ownerLoot.ts);
// - goldDrop: rows appended to the gold drop (`tier_airdrop_rare`) of main and its seasonal copies, with the Barrett
//   (rebirth/survevGuns.ts REBIRTH_GOLD_GUNS);
// - airdropTier1: rows added to the tier 1 air drop (`tier_airdrop_tier1`) where the map's normal drop lacks the gun,
//   like the MK12 / M39 there (rebirth/airdropLoot.ts AIRDROP_TIER1_ADDED_DMRS);
// - ringCase: the whole bathhouse ring case table (`tier_ring_case`, case_07) on every map but the potato modes
//   (rebirth/ownerLoot.ts);
// - clubVaultBoxes: the box types of the two deposit boxes in the club's secret room (club_01, behind the 4-switch
//   puzzle), survev's `{ deposit_box_01: 3, deposit_box_02: 1 }` (rebirth/ownerLoot.ts);
// - clubVault: the whole gun roll of the club's own gun box, deposit_box_02_club (`tier_club_vault`), on every map but
//   the potato modes (rebirth/ownerLoot.ts);
// - m202: the M202 FLASH in both normal air drop tiers and as the gold drop's main gun (rebirth/newGunLoot.ts
//   NEW_GUN_TIER1 / NEW_GUN_TIER2 / NEW_GUN_GOLD read it); goldBonus: the gold crates' bonus roll (ownerLoot.ts);
// - panzerfaustFloor: the Panzerfaust on the floor (`tier_guns`, which crates, pots and boxes roll through tier_world)
//   of every map but the potato modes whose floor has the flare gun (rebirth/ownerLoot.ts).
// A map's loot bans (gunClasses.ts LOOT_BANS: Savannah) still remove rows; docs/research/rebirth-deviations.md lists
// the resulting chances and packages/defs/test/ownerLoot.test.ts pins them.

/** Maps whose floor (`tier_guns`) gets OWNER_LOOT_WEIGHTS.classicFloor: main and its spring and summer copies. */
export const OWNER_CLASSIC_FLOOR_MAPS: readonly string[] = ["main", "main_spring", "main_summer"];

/** The owner's loot weights (2026-10-08), by table. Edit the numbers here. */
export const OWNER_LOOT_WEIGHTS = {
    /** `tier_guns` of main and its spring / summer copies: the USAS-12 "extremely rare", as the PKP's 0.005 there */
    classicFloor: { usas: 0.005 },
    /**
     * gold drop (`tier_airdrop_rare`) of main, spring, summer and snow: the SVD and SCAR-SSR "sometimes", at the new
     * gold snipers' 0.5 (M200, Hécate II, Lynx); with the Barrett's 1 and the new guns' rows a gold crate is 28.01,
     * so each comes out of 1 gold crate in 56 (1.8 %)
     */
    goldDrop: { svd: 0.5, scarssr: 0.5 },
    /** tier 1 air drop: the L86A2 as a low-tier DMR, at the MK12's / M39's tier 1 weight on main (2.5 x 0.5) */
    airdropTier1: { l86: 1.25 },
    /**
     * the bathhouse ring case (case_07): Groza-S and dual OTs-38 by far the commonest, the PKP about 1 %, the PMG-134
     * and the M79 both very, very rare (0.1 % each); survev's M9 (0.01) is gone. Weights sum to 1, so they read as
     * chances
     */
    ringCase: { grozas: 0.825, ots38_dual: 0.163, pkp: 0.01, potato_lmg: 0.001, m79: 0.001 },
    /**
     * the two deposit boxes of the club's secret room (club_01; survev deposit_box_01 3 : deposit_box_02 1): the gun
     * box half the time instead of a quarter, and the gun box is the club's own (deposit_box_02_club: survev's
     * tier_soviet 1-2 roll plus a clubVault gun instead of a floor gun). deposit_box_01 rolls tier_world only
     */
    clubVaultBoxes: { deposit_box_01: 1, deposit_box_02_club: 1 },
    /**
     * the gun roll of the club's gun box (deposit_box_02_club): "slightly better than tier_guns". Built from main's
     * floor: its junk (the single pistols below B-, the M1100, MAC-10 and flare guns), its S and A+ guns and its rarest
     * rows left out, the mid tier raised: mostly AK-47 / HK416 / MP5 / M870 class, a small chance (4.3 % on main) of
     * an A gun (SCAR-H, M4A1, MK12, Saiga-12). A map keeps only the rows its floor allows (rebirth/ownerLoot.ts). The
     * bots' tier of each gun in its comment
     */
    clubVault: {
        hk416: 4, // B
        ak47: 4, // B
        mp5: 4, // B
        m870: 4, // A-
        famas: 2.5, // A-
        groza: 2.5, // B
        spas12: 2.5, // A
        ump9: 1.5, // B
        mp220: 1, // A-
        dp28: 1, // A-
        scar: 0.3, // A
        m4a1: 0.3, // A
        mk12: 0.3, // B+
        saiga: 0.3, // A
    },
    /**
     * the M202 FLASH, the endgame comeback weapon: barely ever in a normal air drop (0.05 in tier 1 and in tier 2,
     * against the sheet's tier 2 0.2), now and then the gold drop's main gun (the sheet's 0.25: 1 gold crate in 112)
     * and sometimes its bonus extra item: every gold crate rolls `tier_airdrop_gold_bonus` once, the M202 at 0.1
     * against nothing at 0.9 ("" is no item), 1 gold crate in 10
     */
    m202: { airdropTier1: 0.05, airdropTier2: 0.05, goldMain: 0.25 },
    goldBonus: { m202: 0.1, "": 0.9 },
    /** the Panzerfaust, "a downgraded M202", from ordinary loot: a little above the flare gun's 0.145 */
    panzerfaustFloor: { panzerfaust: 0.2 },
} as const satisfies Readonly<Record<string, Readonly<Record<string, number>>>>;
