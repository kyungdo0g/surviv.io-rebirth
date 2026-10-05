// Healing items, boost and their cancel rules compared with the survev oracle (heal.json, boost.json) and the item-use
// / cooking speeds of movement.json. Timings: our action timers carry no float residue, so survev's 3.01 s is our
// 3.00 s (tools/oracle/README.md "Fixed-step float residue"); health gained over a use is compared within one tick
// of boost regeneration.
import { DamageType, GameConfig, Input, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import {
    BOOST_TIER_EDGES,
    boostHealRate,
    defaultRules,
    type Game,
    type Player,
    type PlayerInput,
} from "../src/index.ts";
import { flatGame, giveGun, openSpot, send, spawnAt, steps } from "./combatHelpers.ts";
import { hasFixture, loadFixture, Mismatches, TICK } from "./oracleHelpers.ts";

const EVENT_AT_TICKS = 100;

function fresh(health: number, boost = 0): { game: Game; p: Player } {
    const game = flatGame();
    const p = spawnAt(game, openSpot(game, 20));
    steps(game, 100);
    p.health = health;
    p.boost = boost;
    return { game, p };
}

interface UseResult {
    started: boolean;
    completed: boolean;
    seconds: number | null;
    itemsUsed: number;
    healthDelta: number;
    boostDelta: number;
    actionAfterEvent?: string;
}

const ACTION_NAMES: Record<string, string> = { none: "None", reload: "Reload", reloadAlt: "ReloadAlt", use: "UseItem" };

/** The fixture's `use` measurement: useItem in an input, an optional event 1 s in, until the action ends. */
function use(game: Game, p: Player, item: string, event?: () => void): UseResult {
    p.inv.set(item, 3);
    const health0 = p.health;
    const boost0 = p.boost;
    const start = game.tick;
    send(game, p, { useItem: item });
    game.step();
    const started = p.action.type === "use" && p.action.item === item;
    let afterEvent: string | undefined;
    let end: number | undefined;
    for (let i = 0; i < 1000; i++) {
        if (event && game.tick - start >= EVENT_AT_TICKS && afterEvent === undefined) {
            event();
            game.step();
            afterEvent = ACTION_NAMES[p.action.type];
        } else {
            game.step();
        }
        if (p.action.type !== "use" || p.action.item !== item) {
            end = game.tick;
            break;
        }
    }
    const itemsUsed = 3 - p.inv.get(item);
    const result: UseResult = {
        started,
        completed: itemsUsed > 0,
        seconds: end === undefined || !started ? null : (end - start) * TICK,
        itemsUsed,
        healthDelta: p.health - health0,
        boostDelta: p.boost - boost0,
    };
    if (event) result.actionAfterEvent = afterEvent;
    return result;
}

/** Health tolerance of a use: one tick of the highest boost regeneration. */
const HEALTH_TOL = 1.75 * TICK;

function compareUse(m: Mismatches, what: string, ours: UseResult, want: any): void {
    m.equal(`${what} started`, ours.started, want.started);
    m.equal(`${what} completed`, ours.completed, want.completed);
    m.near(`${what} seconds`, ours.seconds, want.seconds, TICK);
    m.equal(`${what} itemsUsed`, ours.itemsUsed, want.itemsUsed);
    m.near(`${what} healthDelta`, ours.healthDelta, want.healthDelta, HEALTH_TOL);
    m.near(`${what} boostDelta`, ours.boostDelta, want.boostDelta, 0.375 * TICK + 1e-9);
    if (want.actionAfterEvent !== undefined)
        m.equal(`${what} actionAfterEvent`, ours.actionAfterEvent, want.actionAfterEvent);
}

function withGun(game: Game, p: Player, slot: number): Player {
    giveGun(p, "ak47", { ammo: 10, reserve: 90 });
    p.weaponManager.setCurWeapIndex(slot);
    steps(game, 100);
    return p;
}

describe.skipIf(!hasFixture("heal"))("oracle: heal.json", () => {
    const fixture = loadFixture("heal");

    it("matches use times and effects of every heal and boost item", () => {
        const m = new Mismatches();
        for (const [item, entry] of Object.entries<any>(fixture.uses)) {
            for (const [name, health, boost] of [
                ["fromHealth10", 10, 0],
                ["fromHealth95", 95, 0],
                ["atFullHealth", 100, 0],
                ["fromBoost90", 50, 90],
            ] as const) {
                if (!entry[name]) continue;
                const { game, p } = fresh(health, boost);
                compareUse(m, `${item} ${name}`, use(game, p, item), entry[name]);
            }
        }
        expect(m.checked).toBeGreaterThan(80);
        expect(m.list).toEqual([]);
    });

    it("matches the cancel rules", () => {
        const m = new Mismatches();
        const want = fixture.cancel;
        const press = (game: Game, p: Player, input: Partial<PlayerInput>) => () => send(game, p, input);
        {
            const { game, p } = fresh(10);
            compareUse(
                m,
                "cancelInput",
                use(game, p, "bandage", press(game, p, { actions: [Input.Cancel] })),
                want.cancelInput,
            );
        }
        {
            const { game, p } = fresh(10);
            withGun(game, p, WeaponSlot.Melee);
            const ev = press(game, p, { actions: [Input.EquipPrimary] });
            compareUse(m, "switchWeapon", use(game, p, "bandage", ev), want.switchWeapon);
        }
        {
            const { game, p } = fresh(10);
            withGun(game, p, WeaponSlot.Primary);
            compareUse(m, "fireGun", use(game, p, "bandage", press(game, p, { shootHold: true })), want.fireGun);
        }
        {
            const { game, p } = fresh(10);
            const ev = press(game, p, { shootHold: true, shootStart: true });
            compareUse(m, "meleeAttack", use(game, p, "bandage", ev), want.meleeAttack);
        }
        {
            const { game, p } = fresh(30);
            const ev = () => game.damagePlayer(p, { amount: 10, damageType: DamageType.Player, dir: { x: 1, y: 0 } });
            compareUse(m, "takeDamage", use(game, p, "bandage", ev), want.takeDamage);
        }
        {
            const { game, p } = fresh(10);
            p.inv.set("healthkit", 1);
            compareUse(
                m,
                "secondItem",
                use(game, p, "bandage", press(game, p, { useItem: "healthkit" })),
                want.secondItem,
            );
            m.equal("secondItem healthkitsLeft", p.inv.get("healthkit"), want.secondItem.healthkitsLeft);
        }
        {
            const { game, p } = fresh(10);
            withGun(game, p, WeaponSlot.Primary);
            const ev = press(game, p, { actions: [Input.Reload] });
            compareUse(m, "reloadInput", use(game, p, "bandage", ev), want.reloadInput);
            game.step();
            m.equal("reloadInput actionAfterUse", ACTION_NAMES[p.action.type], want.reloadInput.actionAfterUse);
        }
        {
            const { game, p } = fresh(10);
            compareUse(m, "walking", use(game, p, "bandage", press(game, p, { moveRight: true })), want.walking);
        }
        {
            // TODO(M6): knockedDown needs the downed state of team modes
            const { game, p } = fresh(10);
            withGun(game, p, WeaponSlot.Primary);
            p.weaponManager.weapons[WeaponSlot.Primary].ammo = 5;
            send(game, p, { actions: [Input.Reload] });
            steps(game, 5);
            m.equal(
                "useDuringReload reloadingBefore",
                ACTION_NAMES[p.action.type],
                want.useDuringReload.reloadingBefore,
            );
            compareUse(m, "useDuringReload", use(game, p, "bandage"), want.useDuringReload);
        }
        expect(m.list).toEqual([]);
    });

    it("starts uses from the Use* input actions as well", () => {
        const pairs = [
            [Input.UseBandage, "bandage"],
            [Input.UseHealthKit, "healthkit"],
            [Input.UseSoda, "soda"],
            [Input.UsePainkiller, "painkiller"],
        ] as const;
        for (const [action, item] of pairs) {
            const { game, p } = fresh(50);
            p.inv.set(item, 1);
            send(game, p, { actions: [action] });
            game.step();
            expect([item, p.action.type, p.action.item]).toEqual([item, "use", item]);
            steps(game, 700);
            expect([item, p.inv.get(item)]).toEqual([item, 0]);
        }
        // nothing in the bag, or downed-like refusals: no action
        const { game, p } = fresh(50);
        send(game, p, { actions: [Input.UseBandage] });
        game.step();
        expect(p.action.type).toBe("none");
    });
});

describe("perks around items", () => {
    it("Mass Medicate heals at full health with x rules.aoeHealUseTimeMult use time (conflicts.md medic-use-time)", () => {
        const { game, p } = fresh(100);
        p.perks.push("aoe_heal");
        const r = use(game, p, "bandage");
        expect(r.started).toBe(true);
        expect(r.seconds).toBeCloseTo(3 * game.rules.aoeHealUseTimeMult, 9);
    });

    it("Fabricate fills the pack with frags every rules.fabricateInterval seconds", () => {
        const { game, p } = fresh(100);
        p.backpack = "backpack02";
        p.perks.push("fabricate");
        steps(game, Math.round(game.rules.fabricateInterval * 100) - 1);
        expect(p.inv.get("frag")).toBe(0);
        game.step();
        expect(p.inv.get("frag")).toBe(p.inv.capacity("frag"));
        expect(p.weaponManager.weapons[WeaponSlot.Throwable].type).toBe("frag");
    });
});

describe.skipIf(!hasFixture("boost"))("oracle: boost.json", () => {
    const fixture = loadFixture("boost");

    it("uses the same tier edges and constants", () => {
        expect(BOOST_TIER_EDGES).toEqual([25, 50, 87.5, 100]);
        expect(GameConfig.player.boostDecay).toBe(fixture.config.boostDecay);
        expect(GameConfig.player.boostHealAmounts).toEqual(fixture.config.boostHealAmounts);
        expect(GameConfig.player.boostMoveSpeed).toBe(fixture.config.boostMoveSpeed);
    });

    it("matches regeneration, decay and speed of one tick at every boost value", () => {
        const m = new Mismatches();
        for (const row of fixture.instant as any[]) {
            const { game, p } = fresh(50, row.boost);
            const x = p.pos.x;
            send(game, p, { moveRight: true });
            game.step();
            send(game, p, {});
            m.near(`regen at ${row.boost}`, (p.health - 50) / TICK, row.regenPerSecond, 1e-6);
            m.near(`decay at ${row.boost}`, (row.boost - p.boost) / TICK, row.decayPerSecond, 1e-6);
            m.near(`speed at ${row.boost}`, (p.pos.x - x) / TICK, row.speed, 1e-6);
        }
        expect(m.checked).toBeGreaterThan(80);
        expect(m.list).toEqual([]);
    });

    it("matches one second of natural evolution and the full decay", () => {
        const m = new Mismatches();
        for (const row of fixture.natural as any[]) {
            const { game, p } = fresh(10, row.boost);
            steps(game, 100);
            m.near(`healthGained from ${row.boost}`, p.health - 10, row.healthGained, 1e-6);
            m.near(`boostAfter from ${row.boost}`, p.boost, row.boostAfter, 1e-6);
        }
        const { game, p } = fresh(1, 100);
        let healed = 0;
        const start = game.tick;
        while (p.boost > 0 && game.tick - start < 40000) {
            p.health = 1;
            game.step();
            healed += p.health - 1;
        }
        m.near("fullDecay seconds", (game.tick - start) * TICK, fixture.fullDecay.seconds, TICK);
        m.near("fullDecay totalHealing", healed, fixture.fullDecay.totalHealing, 0.02);
        expect(m.list).toEqual([]);
    });

    it("offers the wiki boost model behind rules.boostModel", () => {
        const rules = { ...defaultRules(), boostModel: "wiki" as const };
        expect([10, 25, 60, 90, 100].map((b) => boostHealRate(b, rules))).toEqual([1, 3.75, 4.75, 5, 5]);
        expect([0, 10, 25, 60, 90].map((b) => boostHealRate(b, defaultRules()))).toEqual([0, 0.5, 1.25, 1.5, 1.75]);
        const { game, p } = fresh(10, 60);
        game.rules.boostModel = "wiki";
        game.step();
        expect(p.health).toBeCloseTo(10 + 4.75 * TICK, 9);
        // Leadership keeps the boost full
        const lead = fresh(10, 0);
        lead.p.perks.push("leadership");
        steps(lead.game, 10);
        expect(lead.p.boost).toBe(100);
    });
});

describe.skipIf(!hasFixture("movement"))("oracle: movement.json (item use and cooking)", () => {
    const s = loadFixture("movement").situations;

    it("halves the speed while using an item and costs cookSpeedPenalty while cooking", () => {
        const heal = fresh(10);
        heal.p.inv.set("bandage", 1);
        send(heal.game, heal.p, { useItem: "bandage" });
        heal.game.step();
        send(heal.game, heal.p, { moveRight: true });
        heal.game.step();
        expect(heal.p.action.type).toBe("use");
        expect(heal.p.speed).toBeCloseTo(s.usingBandage.speed, 9);

        const cook = fresh(100);
        cook.p.inv.set("frag", 3);
        cook.p.weaponManager.setCurWeapIndex(WeaponSlot.Throwable);
        send(cook.game, cook.p, { shootHold: true, shootStart: true });
        steps(cook.game, 5);
        send(cook.game, cook.p, { shootHold: true, moveRight: true });
        steps(cook.game, 50);
        expect(cook.p.animType).toBe("cook");
        expect(cook.p.speed).toBeCloseTo(s.cookingFrag.speed, 9);
    });

    it("Combat Medic: no slowdown while using items, plus rules.fieldMedicSpeedBonus", () => {
        const { game, p } = fresh(10);
        p.perks.push("field_medic");
        p.inv.set("bandage", 1);
        send(game, p, { useItem: "bandage" });
        game.step();
        send(game, p, { moveRight: true });
        game.step();
        expect(p.speed).toBeCloseTo(s.fists + game.rules.fieldMedicSpeedBonus, 9);
    });
});
