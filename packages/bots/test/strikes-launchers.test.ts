// Air strike variants, strobes and launchers (bot round 6, the owner's open items 32 and 37, and item 5): strike marker
// radii per variant from the defs, a thrown strobe as a strip warning 3 s before its marker that never makes a bot
// detour, the frag's distances from its explosion def, and the beta launchers' class, minimum distance and use.
import { v2 } from "@rebirth/core";
import { AIRSTRIKE_VARIANTS, GameObjectDefs, STROBE_STRIKE_DELAY } from "@rebirth/defs";
import type { ProjectileView } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { fragMinDist } from "../src/brain/fragMath.ts";
import { launcherReason, launcherSafe, launcherSlot } from "../src/brain/launch.ts";
import { inStrike, strikeBlocks, strikeDangers } from "../src/brain/strikes.ts";
import { carrySlot, fightSlot, heldGunsWithAmmo } from "../src/knowledge/arsenal.ts";
import { gunClassOf } from "../src/knowledge/gunTiers.ts";
import { launcherSpec } from "../src/knowledge/launchers.ts";
import { lootValue } from "../src/knowledge/loot.ts";
import { gunInfo, suitability } from "../src/knowledge/weapons.ts";
import { bombBlast, markerRadius, StrobeWatch, strobeLateral, strobeStrip } from "../src/perception/strobes.ts";
import { ThreatTracker } from "../src/perception/threatTracker.ts";
import { addEnemy, addObstacle, ctxOf, FixedBoard, giveGun, NOW, testWorld } from "./brain-world.ts";
import { newModel, ORIGIN, snap } from "./perceptionSnap.ts";

describe("strike markers per variant", () => {
    it("the lines' spread plus the variant bomb's blast: heavy shells reach 38 u, carpet lines 21 u (28 with Broken Arrow)", () => {
        expect(bombBlast(AIRSTRIKE_VARIANTS.normal.bombType)).toBe(14);
        expect(bombBlast(AIRSTRIKE_VARIANTS.heavy.bombType)).toBe(38);
        expect(strobeLateral("strobe")).toBe(5);
        expect(strobeLateral("strobe", true)).toBe(10);
        expect(strobeLateral("strobe_carpet")).toBeCloseTo(21);
        expect(strobeLateral("strobe_carpet", true)).toBeCloseTo(28);
        // + the bombs' 4 u jitter and the 1 u body
        expect(markerRadius("normal")).toBe(5 + 4 + 14 + 1);
        expect(markerRadius("heavy")).toBe(5 + 4 + 38 + 1);
        expect(markerRadius("carpet")).toBeCloseTo(21 + 4 + 14 + 1);
        expect(markerRadius("carpet", true)).toBeCloseTo(28 + 4 + 14 + 1);
        expect(markerRadius(undefined)).toBe(markerRadius("normal"));
    });

    it("a strobe's marker keeps its full radius (no zone margin on top) and never blocks a way past it", () => {
        const w = testWorld();
        const board = new FixedBoard();
        w.model.threats = board;
        const at = v2.add(w.spot, { x: 40, y: 0 });
        board.zones = [
            { kind: "airstrike", pos: at, rad: markerRadius("heavy"), until: NOW + 5, strobe: true, variant: "heavy" },
        ];
        const ctx = ctxOf(w, ["pursuit"]);
        expect(strikeDangers(ctx)[0].rad).toBe(markerRadius("heavy"));
        // a goal inside it is left alone, a goal beyond it is not (no detour for strobes)
        expect(strikeBlocks(ctx, at)).toBe(true);
        expect(strikeBlocks(ctx, v2.add(w.spot, { x: 120, y: 0 }))).toBe(false);
        // a 50v50 zone (no strobe) still blocks the way through it, with its bombs' blast past its edge
        board.zones = [{ kind: "airstrike", pos: at, rad: 20, until: NOW + 5 }];
        const zctx = ctxOf(w, ["pursuit"]);
        expect(strikeDangers(zctx)[0].rad).toBe(20 + 14);
        expect(strikeBlocks(zctx, v2.add(w.spot, { x: 120, y: 0 }))).toBe(true);
    });
});

describe("thrown strobes", () => {
    const strobe = (type: string, pos = { x: 100, y: 100 }, dir = { x: 1, y: 0 }): ProjectileView => ({
        id: 7,
        type,
        pos,
        posZ: 1,
        dir,
        layer: 0,
    });

    it("are a strip warning from the strobe along its flight, from the moment they show until the strike is over", () => {
        const watch = new StrobeWatch();
        watch.update([strobe("strobe")], NOW);
        const zones = watch.dangers(NOW);
        expect(zones.length).toBeGreaterThan(1);
        expect(zones.every((z) => z.strobe && z.kind === "airstrike")).toBe(true);
        // the strip starts at the strobe and runs along +x for the bomb line (19 x 2 u + drift)
        expect(zones[0].pos).toEqual({ x: 100, y: 100 });
        const last = zones[zones.length - 1].pos;
        expect(last.y).toBeCloseTo(100);
        expect(last.x).toBeGreaterThan(135);
        // nothing behind the strobe or far to the side
        const inside = (p: { x: number; y: number }) => zones.some((z) => v2.distance(z.pos, p) < z.rad);
        expect(inside({ x: 120, y: 100 })).toBe(true);
        expect(inside({ x: 60, y: 100 })).toBe(false);
        expect(inside({ x: 120, y: 140 })).toBe(false);
        // the warning lasts through the 3 s before the marker and the strike after it
        expect(zones[0].until).toBeGreaterThan(NOW + STROBE_STRIKE_DELAY + 3);
        expect(watch.covers({ x: 100.5, y: 100 })).toBe(true);
        watch.update([], zones[0].until + 0.1);
        expect(watch.dangers(zones[0].until + 0.1)).toEqual([]);
    });

    it("the threat board warns of a strobe it sees thrown, before its marker, and takes the marker as that strip", () => {
        const model = newModel();
        const board = new ThreatTracker();
        model.threats = board;
        const at = v2.add(ORIGIN, { x: 10, y: 5 });
        model.observe(snap(20, { projectiles: [strobe("strobe_heavy", at, { x: 0, y: 1 })] }));
        const early = board.dangerZones().filter((z) => z.strobe);
        expect(early.length).toBeGreaterThan(1);
        expect(early[0].variant).toBe("heavy");
        // 3 s later its marker goes up where the strobe lies: no second (circle) danger for it
        model.observe(
            snap(23, {
                mapIndicators: [{ id: 3, type: "ping_airstrike_heavy", pos: at, dead: false, equipped: false }],
            }),
        );
        const later = board.dangerZones().filter((z) => z.strobe);
        expect(later.length).toBe(early.length);
        // a marker of a strobe never seen is a circle of the variant's reach
        const other = newModel();
        const b2 = new ThreatTracker();
        other.threats = b2;
        const far = v2.add(ORIGIN, { x: 0, y: -12 });
        other.observe(
            snap(30, {
                mapIndicators: [{ id: 4, type: "ping_airstrike_carpet", pos: far, dead: false, equipped: false }],
            }),
        );
        const circle = b2.dangerZones().find((z) => z.strobe);
        expect(circle?.rad).toBeCloseTo(markerRadius("carpet"));
        expect(circle?.variant).toBe("carpet");
    });

    it("a heavy strobe's strip is as wide as its shells' 38 u blast, a carpet strobe's as its 21 u spread", () => {
        const heavy = strobeStrip("strobe_heavy", { x: 0, y: 0 }, { x: 0, y: 1 }, NOW);
        expect(heavy[0].rad).toBe(5 + 4 + 38 + 1);
        expect(heavy[0].variant).toBe("heavy");
        const carpet = strobeStrip("strobe_carpet", { x: 0, y: 0 }, { x: 0, y: 1 }, NOW);
        expect(carpet[0].rad).toBeCloseTo(21 + 4 + 14 + 1);
    });

    it("bots never detour for strobes: they are worth nothing as loot", () => {
        const w = testWorld();
        for (const t of ["strobe", "strobe_heavy", "strobe_carpet"]) expect(lootValue(w.model.self, t), t).toBe(0);
    });

    it("a bot standing in a thrown strobe's strip evacuates it", () => {
        const w = testWorld();
        const board = new FixedBoard();
        w.model.threats = board;
        board.zones = strobeStrip("strobe", v2.add(w.spot, { x: -5, y: 0 }), { x: 1, y: 0 }, NOW + 6);
        const ctx = ctxOf(w, ["pursuit"]);
        expect(inStrike(ctx, w.spot)).toBe(true);
    });
});

describe("frag distances from the defs", () => {
    it("never thrown inside the frag's own blast (explosion_frag rad.max + body + slack)", () => {
        const max = (GameObjectDefs.explosion_frag as { rad: { max: number } }).rad.max;
        expect(fragMinDist("frag")).toBeCloseTo(max + 1.5);
    });
});

describe("launchers", () => {
    const ids = ["m79", "mgl", "gl06", "rpg7", "panzerfaust", "m202"];

    it("have a real class and a minimum distance past their blast and their arming distance", () => {
        for (const id of ids) {
            expect(gunClassOf(id), id).toBe("launcher");
            const spec = launcherSpec(id);
            expect(spec, id).toBeDefined();
            if (!spec) continue;
            expect(spec.minDist, id).toBeGreaterThanOrEqual(spec.armDistance);
            expect(spec.minDist, id).toBeGreaterThan(spec.blastMax + 1);
            expect(spec.blastDamage, id).toBeGreaterThan(0);
            const info = gunInfo(id);
            expect(info?.cls, id).toBe("launcher");
            expect(info?.score ?? 0, id).toBeGreaterThan(0);
            // point blank: no use at all
            expect(suitability(info!, spec.minDist - 1), id).toBe(0);
            expect(suitability(info!, spec.minDist + 1), id).toBeGreaterThan(0);
        }
        // the RPG-7: 150-damage blast out to 14 u, armed after 5 u
        expect(launcherSpec("rpg7")?.minDist).toBe(14 + 1 + 2);
        // the M79's grenade: no damage in its carrier bullet, the explosion's 125
        expect(launcherSpec("m79")?.hitDamage).toBe(0);
        expect(launcherSpec("m79")?.blastDamage).toBe(125);
        expect(launcherSpec("ak47")).toBeUndefined();
    });

    it("fire at a group, never at point blank, and leave a lone runner in the open to the other gun", () => {
        const w = testWorld();
        giveGun(w, 0, "ak47", 30, 120);
        giveGun(w, 1, "rpg7", 1, 2);
        const t = addEnemy(w, 2, { x: 30, y: 0 }, { vel: { x: 0, y: 5 } });
        // a lone moving target in the open: the AK
        let ctx = ctxOf(w, ["pursuit"]);
        expect(launcherSlot(ctx, t, 30)).toBe(-1);
        // a second enemy inside the blast: the RPG
        addEnemy(w, 3, { x: 33, y: 4 });
        ctx = ctxOf(w, ["pursuit"]);
        const spec = launcherSpec("rpg7")!;
        expect(launcherReason(ctx, spec, t)).toBe("group");
        expect(launcherSlot(ctx, t, 30)).toBe(1);
        // point blank (and rushing in): never
        const close = addEnemy(w, 4, { x: 12, y: 0 });
        ctx = ctxOf(w, ["pursuit"]);
        expect(launcherSafe(ctx, spec, close, 12)).toBe(false);
        expect(launcherSlot(ctx, t, 30)).toBe(-1);
    });

    it("fire at an enemy behind cover or standing still", () => {
        const w = testWorld();
        giveGun(w, 0, "ak47", 30, 120);
        giveGun(w, 1, "m79", 1, 4);
        const still = addEnemy(w, 2, { x: 25, y: 0 });
        expect(launcherSlot(ctxOf(w, []), still, 25)).toBe(1);
        const c = testWorld();
        giveGun(c, 0, "ak47", 30, 120);
        giveGun(c, 1, "m79", 1, 4);
        addObstacle(c, { x: 22, y: 0 }, "stone_01");
        const hid = addEnemy(c, 2, { x: 25, y: 0 }, { vel: { x: 0, y: 4 } });
        expect(launcherReason(ctxOf(c, []), launcherSpec("m79")!, hid)).toBe("cover");
    });

    it("the PMG-134 is scored by its potatoes' explosion, not its 0-damage carrier bullet", () => {
        const def = GameObjectDefs.potato_lmg as { bulletType: string; projType?: string };
        expect((GameObjectDefs[def.bulletType] as { damage?: number }).damage ?? 0).toBe(0);
        const proj = GameObjectDefs[def.projType ?? ""] as { explosionType: string };
        const blast = (GameObjectDefs[proj.explosionType] as { damage: number }).damage;
        expect(gunInfo("potato_lmg")?.damage).toBe(blast);
        expect(gunInfo("potato_lmg")?.cls).toBe("lmg");
        expect(gunInfo("potato_lmg")?.score ?? 0).toBeGreaterThan(0);
    });

    it("are never ranked by time to kill nor carried between fights", () => {
        const w = testWorld();
        giveGun(w, 0, "ak47", 30, 120);
        giveGun(w, 1, "mgl", 6, 12);
        const guns = heldGunsWithAmmo(w.model.self);
        expect(guns.map((g) => g.info.cls).sort()).toEqual(["launcher", "rifle"]);
        for (const d of [8, 25, 45]) expect(fightSlot(w.model.self, guns, d), String(d)).toBe(0);
        expect(carrySlot(w.model.self, guns)).toBe(0);
        // a launcher alone: fired beyond its minimum distance, fists inside it
        w.model.self.weapons[0] = { type: "", ammo: 0 };
        const alone = heldGunsWithAmmo(w.model.self);
        expect(fightSlot(w.model.self, alone, 30)).toBe(1);
        expect(fightSlot(w.model.self, alone, 5)).toBe(2);
    });
});
