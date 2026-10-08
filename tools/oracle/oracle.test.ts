// Shape and sanity checks of the recorded oracle fixtures. Reads tools/oracle/fixtures only (no .survev needed).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FIXTURES = join(import.meta.dirname, "fixtures");
const NAMES = ["patch", "weapons", "ttk", "damage", "melee", "movement", "gas", "boost", "heal", "revive"] as const;

function load(name: (typeof NAMES)[number]): any {
    return JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8"));
}

const ourDefs: Record<string, any> = JSON.parse(
    readFileSync(join(import.meta.dirname, "../../packages/defs/src/generated/gameObjects.json"), "utf8"),
);

describe("fixture metadata", () => {
    const metas = NAMES.map((n) => load(n).meta);

    it("every fixture names its inputs", () => {
        for (const [i, meta] of metas.entries()) {
            expect(meta.fixture).toBe(NAMES[i]);
            expect(meta.survevCommit).toMatch(/^[0-9a-f]{40}$/);
            expect(typeof meta.defs.protocolHash).toBe("number");
            expect(meta.defs.gameObjectsSha256).toMatch(/^[0-9a-f]{64}$/);
            expect(meta.simulation.dt).toBe(0.01);
            expect(meta.params).toBeTypeOf("object");
        }
    });

    it("all fixtures come from the same inputs and a verified defs patch", () => {
        for (const meta of metas) {
            expect(meta.survevCommit).toBe(metas[0].survevCommit);
            expect(meta.defs).toEqual(metas[0].defs);
            expect(meta.patch.verification.every((v: any) => v.ok)).toBe(true);
        }
    });

    it("the patch made survev use our values", () => {
        const patch = load("patch");
        // survev balance (tools/port-survev policy survevBalance): our AN-94 is survev's 20; the 0.8.82 bonus bullets
        // are ours only
        expect(patch.verification.find((v: any) => v.check.includes("bullet_an94")).actual).toBe(
            ourDefs.bullet_an94.damage,
        );
        const bonus = patch.gameplayChanges.find((c: any) => c.id === "mp5" && c.path === "bulletTypeBonus");
        expect(bonus).toMatchObject({ ours: "bullet_mp5_bonus" });
    });
});

describe("weapons.json", () => {
    const w = load("weapons");
    const guns = Object.keys(ourDefs).filter((id) => ourDefs[id].type === "gun");

    it("covers every gun of our defs (or says why not)", () => {
        for (const id of guns) expect(id in w.guns || id in w.skipped).toBe(true);
        expect(Object.keys(w.skipped)).toEqual([]);
    });

    it("ak47 fires every ~0.1 s, 30 rounds, 2.5 s reload", () => {
        const ak = w.guns.ak47;
        const interval100 = ak.tick100Hz.intervals[0].value;
        expect(interval100).toBeGreaterThanOrEqual(0.1);
        expect(interval100).toBeLessThanOrEqual(0.11);
        expect(ak.tick1000Hz.intervals[0].value).toBeCloseTo(0.1, 2);
        expect(ak.tick100Hz.shotsPerMag).toBe(30);
        expect(ak.tick1000Hz.reload.actions[0].duration).toBeCloseTo(2.5, 2);
    });

    it("pellets, single-shell and alternate reloads", () => {
        expect(w.pelletsPerShot.m870).toBe(9);
        expect(w.pelletsPerShot.m1100).toBe(ourDefs.m1100.bulletCount);
        expect(w.guns.m870.tick100Hz.reload.actions).toHaveLength(5);
        const mosin = w.guns.mosin.tick1000Hz;
        expect(mosin.reload.actions[0]).toMatchObject({ action: "ReloadAlt", ammoBefore: 0, ammoAfter: 5 });
        expect(mosin.reload.actions[0].duration).toBeCloseTo(3, 2);
        expect(mosin.partialReload.actions[0].duration).toBeCloseTo(0.9, 2);
    });

    it("magazines, switch delays and bullet ranges follow the defs", () => {
        for (const [id, g] of Object.entries<any>(w.guns)) {
            const def = ourDefs[id];
            expect(g.tick100Hz.shotsPerMag, id).toBe(def.maxClip);
            expect(g.tick1000Hz.switch.freeSwitch, id).toBeCloseTo(0.25, 2);
            expect(g.tick1000Hz.switch.rapidSwitch, id).toBeCloseTo(def.switchDelay, 2);
            const bullet = ourDefs[def.bulletType];
            expect(g.bullet.centered.speed, id).toBeCloseTo(bullet.speed * (1 + bullet.variance), 6);
            expect(g.bullet.centered.distance.max, id).toBeCloseTo(bullet.distance * (1 + bullet.variance), 3);
        }
    });
});

describe("ttk.json", () => {
    const t = load("ttk");
    const find = (gun: string, armor: string, distance: number, headshot = "never") =>
        t.guns[gun].find((c: any) => c.armor === armor && c.distance === distance && c.headshot === headshot);

    it("an94 deals its bullet's damage at point blank without armor", () => {
        expect(find("an94", "none", 5).damagePerHit).toBeCloseTo(ourDefs.bullet_an94.damage, 1);
    });

    it("hits to kill match the measured damage per hit", () => {
        for (const cases of Object.values<any[]>(t.guns)) {
            for (const c of cases) {
                if (c.outOfRange || typeof c.damagePerHit !== "number") continue;
                expect(c.hitsToKill).toBe(Math.ceil(100 / c.damagePerHit - 1e-9));
                expect(c.ttk).toBeGreaterThanOrEqual(0);
            }
        }
    });

    it("armor slows kills and headshots speed them up", () => {
        expect(find("ak47", "lvl3", 20).ttk).toBeGreaterThan(find("ak47", "none", 20).ttk);
        const mosin = ourDefs.bullet_mosin.damage * ourDefs.mosin.headshotMult;
        expect(find("mosin", "none", 20, "always").hitsToKill).toBe(Math.ceil(100 / mosin - 1e-9));
        expect(find("m870", "none", 50).outOfRange).toBe(true);
    });
});

describe("damage.json", () => {
    const d = load("damage");
    const col = Object.fromEntries(d.columns.map((c: string, i: number) => [c, i]));
    const level = (type: string, l: number) =>
        l === 0
            ? 0
            : Object.values<any>(ourDefs).find((x) => x.type === type && x.level === l && !x.role).damageReduction;

    it("matches the documented formula for every row", () => {
        const headshotMult = d.meta.params.bulletSource.headshotMult;
        for (const r of d.rows) {
            const hit = r[col.hit];
            let x = r[col.amount];
            if (hit !== "gas" && hit !== "bleeding") {
                const head = hit === "head";
                if (head) x *= headshotMult;
                if (r[col.perk] === "flak_jacket") x -= x * (hit === "explosion" ? 0.9 : 0.1);
                if (r[col.perk] === "steelskin") x -= x * 0.45;
                if (!head) x -= x * level("chest", r[col.chestLevel]);
                x -= x * level("helmet", r[col.helmetLevel]) * (head ? 1 : 0.3);
            }
            expect(r[col.damage]).toBeCloseTo(x, 5);
        }
    });
});

describe("other fixtures", () => {
    it("melee: fists 24 damage, 5 hits unarmored", () => {
        const fists = load("melee").weapons.fists;
        expect(fists.body[0]).toMatchObject({ armor: "none", hitsToKill: 5, damagePerHit: 24 });
    });

    it("movement: base 12 + equip speed, water penalty 3", () => {
        const m = load("movement");
        expect(m.perWeapon.melee.fists).toBeCloseTo(12 + ourDefs.fists.speed.equip, 6);
        expect(m.situations.fistsInWater.speed).toBeCloseTo(m.situations.fists - 3, 6);
        expect(m.perWeapon.gun.ak47).toBeCloseTo(12 + ourDefs.ak47.speed.equip, 6);
    });

    it("gas: survev stages equal our gameConfig gas.stages", () => {
        const g = load("gas");
        expect(g.stagesMatchOurGameConfig).toBe(true);
        expect(g.stages).toHaveLength(17);
        expect(g.samples[1].time).toBeCloseTo(5, 6);
    });

    it("boost: regen bands and decay", () => {
        const rate = (b: number) => load("boost").instant.find((r: any) => r.boost === b);
        expect(rate(10).regenPerSecond).toBeCloseTo(0.5, 6);
        expect(rate(40).regenPerSecond).toBeCloseTo(1.25, 6);
        expect(rate(60).regenPerSecond).toBeCloseTo(1.5, 6);
        expect(rate(95).regenPerSecond).toBeCloseTo(1.75, 6);
        expect(rate(60).decayPerSecond).toBeCloseTo(0.375, 6);
    });

    it("heal: bandage +15 in ~3 s, healthkit to full in ~6 s, cancel keeps the item", () => {
        const h = load("heal");
        expect(h.uses.bandage.fromHealth10).toMatchObject({ completed: true, healthDelta: 15, itemsUsed: 1 });
        expect(h.uses.bandage.fromHealth10.seconds).toBeCloseTo(3, 1);
        expect(h.uses.healthkit.fromHealth10.healthDelta).toBe(90);
        expect(h.cancel.cancelInput).toMatchObject({ completed: false, itemsUsed: 0 });
    });

    it("revive: 8 s, 24 health, bleeding 2 per second", () => {
        const r = load("revive");
        expect(r.revived.reviveSeconds).toBeCloseTo(8, 1);
        expect(r.revived.healthAfterRevive).toBe(24);
        expect(r.bleedOut.secondsToDeath).toBeCloseTo(50, 0);
    });
});
