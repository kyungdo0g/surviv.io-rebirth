// The shared gun tier list (knowledge/gunTiers.ts, bot overhaul POPULATION-1): every gun a bot can get on the main map
// has a class and a tier (ground, containers, air drops and the duals of reachable pistols), no fork-only or
// post-0.8.82 gun is listed, classes follow the KB, the corrected tiers of the critique hold, skill demand and fit
// behave, and kill counts are whole hits (Mosin vs level 1 armour: 3, not 2).
import {
    GameObjectDefs,
    type GunDef,
    getMapDef,
    gunClass,
    hasDef,
    hasMapObjectDef,
    MapObjectDefs,
} from "@rebirth/defs";
import { generateMap } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import {
    bodyHitsToKill,
    carryPenalty,
    gunClassOf,
    gunRank,
    gunTier,
    isWeakGun,
    MOBILITY_MAX,
    mobilityPenalty,
    perfectTtk,
    S_RULE_GUNS,
    skillFit,
    TIER_BASE,
    TIER_ORDER,
    tieredGuns,
    tierRank,
} from "../src/knowledge/gunTiers.ts";
import { gunInfo } from "../src/knowledge/weapons.ts";
import { baseDesire, NEUTRAL, PERSONAS } from "../src/persona.ts";

/** Guns a player can hold on the main map: loot tiers of spawned objects and buildings, air drops, duals. */
function mainMapGuns(): Set<string> {
    const map = getMapDef("main");
    const types = new Set<string>();
    const tiers = new Set<string>();
    for (const seed of [1, 2]) {
        const gen = generateMap("main", seed, 1);
        for (const o of gen.objects) types.add(o.type);
        for (const l of gen.lootSpawns) tiers.add(l.type);
    }
    for (const c of map.gameConfig.planes?.crates ?? []) if (c.weight > 0) types.add(c.name);
    const queue = [...types];
    while (queue.length) {
        const t = queue.pop() as string;
        if (!hasMapObjectDef(t)) continue;
        const def = MapObjectDefs[t] as { destroyType?: string; loot?: Array<{ tier?: string; type?: string }> };
        if (def.destroyType && !types.has(def.destroyType)) {
            types.add(def.destroyType);
            queue.push(def.destroyType);
        }
        for (const l of def.loot ?? []) tiers.add(l.tier ?? l.type ?? "");
    }
    const items = new Set<string>();
    const seen = new Set<string>();
    const open = [...tiers];
    while (open.length) {
        const t = open.pop() as string;
        if (!t || seen.has(t)) continue;
        seen.add(t);
        if (!t.startsWith("tier_")) {
            items.add(t);
            continue;
        }
        for (const e of map.lootTable[t] ?? []) if (e.weight > 0 && e.name) open.push(e.name);
    }
    const guns = new Set([...items].filter((i) => hasDef(i) && GameObjectDefs[i].type === "gun"));
    // a second copy of a held pistol becomes its dual
    for (const g of [...guns]) {
        const dual = (GameObjectDefs[g] as GunDef).dualWieldType;
        if (dual) guns.add(dual);
    }
    return guns;
}

/**
 * Main-map guns this test's reach walk cannot see: the L86A2 drops only from the tier 1 air drop's inner crate
 * (rebirth/airdropLoot.ts AIRDROP_TIER1_ADDED_DMRS), which mainMapGuns() does not follow.
 */
const UNWALKED_MAIN: ReadonlySet<string> = new Set(["l86"]);
/** Very rare main-map rolls (the bathhouse ring case: the PMG-134) that stay off-map for desire purposes. */
const RARE_OFF_MAP: ReadonlySet<string> = new Set(["potato_lmg"]);

describe("gun tiers", () => {
    it("every gun reachable on the main map has a class and a tier; the main-map flag is honest", () => {
        const reachable = mainMapGuns();
        expect(reachable.size).toBeGreaterThan(40);
        for (const id of reachable) {
            const cls = gunClassOf(id);
            expect(cls, id).toBeDefined();
            if (cls === "useless") {
                expect(gunTier(id), id).toBeUndefined();
                continue;
            }
            if (!RARE_OFF_MAP.has(id)) expect(gunTier(id)?.mainMap, id).toBe(true);
        }
        for (const t of tieredGuns())
            if (t.mainMap && !UNWALKED_MAIN.has(t.id)) expect(reachable.has(t.id), t.id).toBe(true);
        // the critique's misses: the Scorpion (golden air drop) and the duals
        for (const id of ["scorpion", "ots38_dual", "ot38_dual", "p30l_dual", "deagle_dual", "m93r_dual", "glock_dual"])
            expect(reachable.has(id), id).toBe(true);
    }, 60_000);

    it("lists the ported survev-only guns, no unported post-0.8.82 gun; every other gun def is classed", () => {
        // the rebirth beta launchers are their own class since bot round 6 (knowledge/launchers.ts)
        for (const id of ["m79", "mgl", "gl06", "rpg7", "panzerfaust", "m202"])
            expect(gunClassOf(id), id).toBe("launcher");
        for (const id of ["pkm", "m134"]) {
            expect(gunTier(id)).toBeUndefined();
            expect(hasDef(id)).toBe(false);
        }
        for (const id of ["barrett", "ash12", "sw500", "imbel", "spas16", "svd_winter", "sv98_winter", "awc_winter"]) {
            expect(hasDef(id), id).toBe(true);
            expect(gunTier(id), id).toBeDefined();
        }
        // the PMG-134 is an LMG to the bots at its explosion damage (round 5, report 34)
        expect(gunClassOf("potato_lmg")).toBe("lmg");
        for (const [id, def] of Object.entries(GameObjectDefs)) {
            if (def.type !== "gun") continue;
            const cls = gunClassOf(id);
            expect(cls, id).toBeDefined();
            expect(gunInfo(id)?.cls, id).toBe(cls);
            if (cls !== "useless") expect(gunTier(id), id).toBeDefined();
        }
    });

    it("classes follow the KB (assault rifles are the bots' rifles, LMGs their own class)", () => {
        for (const t of tieredGuns()) {
            const kb = gunClass(t.id);
            // (round 5, report 34: the PMG-134, "special" in the KB, is an LMG to the bots; round 6, report 42: the Spud
            // Gun an SMG and the Potato Cannon a launcher)
            const potato: Record<string, string> = { potato_lmg: "lmg", potato_smg: "smg", potato_cannon: "launcher" };
            if (potato[t.id]) expect(t.cls, t.id).toBe(potato[t.id]);
            else expect(t.cls, t.id).toBe(kb === "assault" ? "rifle" : kb);
        }
        expect(gunInfo("m249")?.cls).toBe("lmg");
        expect(gunInfo("vss")?.cls).toBe("dmr");
        expect(gunInfo("m1014")?.cls).toBe("shotgun");
        // LMGs keep the rifles' fighting band
        expect(gunInfo("pkp")?.idealMax).toBe(gunInfo("ak47")?.idealMax);
    });

    it("holds the stat-rebuilt tiers (docs/design/gun-tiers.md) with the owner's rulings and the behaviour pins", () => {
        expect([...S_RULE_GUNS].sort()).toEqual(["m249", "pkp"]);
        // rulings: M249 / PKP on top (the M249 is A+ by its stats alone), AWM-S needs aim
        expect(gunTier("m249")?.tier).toBe("S");
        expect(gunTier("pkp")?.tier).toBe("S");
        expect(gunTier("awc")?.tier).toBe("S-aim");
        // stat tiers (gun-tiers.md section 6): the QBB-97 fell one step, the M1100 rose three (about 10 of its 18
        // pellets land at 10 u from the muzzle), the CZ-3A1 and the MAC-10 held
        expect(gunTier("qbb97")?.tier).toBe("A");
        expect(gunTier("scorpion")?.tier).toBe("A-");
        expect(gunTier("m1100")?.tier).toBe("B");
        expect(gunTier("mac10")?.tier).toBe("C+");
        expect(gunTier("dp12")?.tier).toBe("S");
        expect(gunTier("garand")?.tier).toBe("S-aim");
        // pistols low (report 12): single pistols B at most, duals A- at most (the dual P30L and DEagle are A by stats)
        expect(gunTier("p30l")?.tier).toBe("B");
        expect(gunTier("deagle")?.tier).toBe("B");
        expect(gunTier("p30l_dual")?.tier).toBe("A-");
        expect(gunTier("deagle_dual")?.tier).toBe("A-");
        expect(gunTier("ots38_dual")?.tier).toBe("B+");
        expect(gunTier("ot38_dual")?.tier).toBe("B-");
        expect(gunTier("colt45")?.tier).toBe("C");
        // owner 2026-10-08 (gun-tiers.md 1a): every DMR and sniper one tier up over the report 33 rulings (the MK12 /
        // M39 low-tier DMRs B+ -> A-, the Mosin A -> A+, the SV-98 with it); S-aim stays
        expect(gunTier("mosin")?.tier).toBe("A+");
        expect(gunTier("sv98")?.tier).toBe("A+");
        expect(gunTier("mk12")?.tier).toBe("A-");
        expect(gunTier("m39")?.tier).toBe("A-");
        expect(gunTier("wa2000")?.tier).toBe("B+");
        expect(gunTier("garand")?.tier).toBe("S-aim");
        expect(gunRank("mk12")).toBeLessThan(gunRank("garand"));
        // owner 2026-10-08: the RPG-7 and the Panzerfaust were far too low; the M202 is the endgame comeback gun, the
        // Panzerfaust its downgrade
        expect(gunTier("rpg7")?.tier).toBe("A-");
        expect(gunTier("panzerfaust")?.tier).toBe("B+");
        expect(gunTier("m202")?.tier).toBe("A+");
        expect(gunRank("m202")).toBeGreaterThan(gunRank("panzerfaust"));
        // behaviour pins (gun-tiers.md 2.6): the AK-47 at B (owner item 43) and the M9 at D, against their stats
        expect(gunTier("ak47")?.tier).toBe("B");
        for (const id of ["ot38", "m9", "glock"]) expect(gunTier(id)?.tier, id).toBe("D");
        // the user's order: M249 above an AK above an M9; a Mosin is not top tier and never above the SV-98, which
        // beats it on every stat
        expect(gunRank("m249")).toBeGreaterThan(gunRank("ak47"));
        expect(gunRank("ak47")).toBeGreaterThan(gunRank("m9"));
        expect(gunRank("mosin")).toBeLessThanOrEqual(gunRank("sv98"));
        expect(gunRank("mosin")).toBeLessThan(gunRank("awc"));
        expect(TIER_ORDER.map((t) => TIER_BASE[t])).toEqual(
            [...TIER_ORDER.map((t) => TIER_BASE[t])].sort((a, b) => a - b),
        );
        expect(tierRank(undefined)).toBe(-1);
    });

    it("weak guns are the C family and D", () => {
        for (const id of ["m9", "ot38", "glock", "m93r", "mac10", "glock_dual", "vz61", "colt45"])
            expect(isWeakGun(id), id).toBe(true);
        // the M1100 (B) and the dual M9 (B) left the weak tiers with the stat rebuild (gun-tiers.md section 6)
        for (const id of ["p30l", "deagle", "ot38_dual", "mp5", "m870", "ak47", "mosin", "m1100", "m9_dual"])
            expect(isWeakGun(id), id).toBe(false);
        expect(isWeakGun("flare_gun")).toBe(true);
    });

    it("skill demand: the one-shot snipers need the most, shotguns the least; the fit never rises as skill falls", () => {
        const demand = (id: string) => gunTier(id)?.skillDemand ?? -1;
        // gun-tiers.md F: the Hécate (F 0.23) and the AWM-S (0.26) need the most; no gun outside the snipers comes close
        expect(demand("hecate")).toBe(1);
        expect(demand("awc")).toBeGreaterThan(0.95);
        for (const t of tieredGuns())
            if (t.cls !== "sniper") expect(demand("awc"), t.id).toBeGreaterThan(t.skillDemand);
        expect(demand("m870")).toBe(0);
        expect(demand("saiga")).toBe(0);
        // the MP220 needs both shells to land (F 0.58): the most demanding shotgun
        for (const id of ["m870", "saiga", "spas12", "m1100", "dp12"])
            expect(demand("mp220"), id).toBeGreaterThan(demand(id));
        expect(demand("mosin")).toBeGreaterThan(demand("ak47"));
        for (const t of tieredGuns()) {
            let last = -1;
            for (const s of [0, 0.15, 0.5, 0.825, 1]) {
                const f = skillFit(t.id, s);
                expect(f).toBeGreaterThanOrEqual(last);
                last = f;
            }
            expect(skillFit(t.id, 1)).toBe(1);
        }
        // aim guns take the stronger penalty: a beginner gets 0.412 of an AWM-S (demand 0.98), 0.91 of an M249 (0.36)
        expect(skillFit("awc", 0)).toBeCloseTo(0.412, 6);
        expect(skillFit("m249", 0)).toBeCloseTo(0.91, 6);
        expect(skillFit("flare_gun", 1)).toBe(0);
    });

    it("kill counts are whole hits (critique A2/A3)", () => {
        expect(bodyHitsToKill("mosin")).toBe(2);
        expect(bodyHitsToKill("mosin", "helmet01", "chest01")).toBe(3);
        expect(perfectTtk("mosin", "helmet01", "chest01")).toBeCloseTo(3.5, 6);
        expect(bodyHitsToKill("sv98", "helmet01", "chest01")).toBe(2);
        expect(perfectTtk("sv98", "helmet01", "chest01")).toBeCloseTo(1.5, 6);
        // AWM-S: one body hit through chest02 + helmet01 (103), not through chest02 + helmet02 (98.2) or chest03
        expect(bodyHitsToKill("awc", "helmet01", "chest02")).toBe(1);
        expect(bodyHitsToKill("awc", "helmet02", "chest02")).toBe(2);
        expect(bodyHitsToKill("awc", "", "chest03")).toBe(2);
        // an OT-38 empties its 5 rounds and reloads before the 6th hit lands
        expect(bodyHitsToKill("ot38", "helmet01", "chest01")).toBe(6);
        expect(perfectTtk("ot38", "helmet01", "chest01")).toBeCloseTo(4 * 0.4 + 2, 6);
        expect(bodyHitsToKill("flare_gun")).toBe(Number.POSITIVE_INFINITY);
    });

    it("mobility: guns that must stop to hit or slow the shooter are handicapped", () => {
        expect(mobilityPenalty("m870")).toBe(0);
        expect(mobilityPenalty("mp5")).toBe(0);
        expect(mobilityPenalty("dp28")).toBeGreaterThan(mobilityPenalty("ak47"));
        expect(mobilityPenalty("pkp")).toBeGreaterThan(mobilityPenalty("m249"));
        for (const t of tieredGuns()) expect(mobilityPenalty(t.id)).toBeLessThanOrEqual(MOBILITY_MAX);
        // read from the defs: the held (speed.equip) and the carried (speed.carry) slowdowns count too; the RPG-7
        // (equip -2) is heavier to hold than the M79 (at most -1)
        expect(mobilityPenalty("rpg7")).toBeGreaterThan(mobilityPenalty("m79"));
        const speed = (id: string) => (GameObjectDefs[id] as { speed?: { carry?: number } }).speed;
        for (const t of tieredGuns()) {
            const carry = speed(t.id)?.carry ?? 0;
            expect(carryPenalty(t.id), t.id).toBeCloseTo(Math.max(0, -carry) / 12);
            expect(mobilityPenalty(t.id), t.id).toBeGreaterThanOrEqual(Math.min(MOBILITY_MAX, carryPenalty(t.id)));
        }
        // the DShK slows its carrier (-2 of 12): every persona minds it a little, a rusher more
        expect(carryPenalty("dshk")).toBeCloseTo(2 / 12);
        expect(baseDesire("dshk", NEUTRAL, 0.75)).toBeLessThan(baseDesire("m249", NEUTRAL, 0.75) + 1e-9);
        expect(baseDesire("dshk", PERSONAS.rusher, 0.75)).toBeLessThan(
            baseDesire("dshk", NEUTRAL, 0.75) * PERSONAS.rusher.classAffinity.lmg,
        );
    });
});
