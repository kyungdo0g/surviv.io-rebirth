// heal.json: bandage / healthkit / soda / painkiller use time and effect, and what cancels a use.
import type { Ctx, FixtureResult } from "../lib/context.ts";
import { Harness } from "../lib/harness.ts";
import { actionName, SLOT } from "../lib/measure.ts";
import { CENTERED } from "../lib/rng.ts";

const ITEMS = ["bandage", "healthkit", "soda", "painkiller"];
const EVENT_AT = 1;

interface UseResult {
    started: boolean;
    completed: boolean;
    seconds: number | null;
    itemsUsed: number;
    healthDelta: number;
    boostDelta: number;
}

export function heal(ctx: Ctx): FixtureResult {
    const { sv } = ctx;
    const { GameConfig, v2 } = sv;
    const solo = new Harness(sv, { seed: 91 });
    const duo = new Harness(sv, { seed: 92, teamMode: "duo" });
    for (const h of [solo, duo]) h.setMode(CENTERED, "never");
    let row = 0;

    const fresh = (h: Harness, health: number, group?: any, boost = 0) => {
        const p = h.addPlayer(h.rowPos(row++, 6), { group });
        h.stepSeconds(1);
        p.health = health;
        p.boost = boost;
        return p;
    };

    /** Presses useItem, optionally runs `event` EVENT_AT seconds in, then waits for the action to end. */
    const use = (h: Harness, p: any, item: string, event?: () => void) => {
        p.invManager.set(item, 3);
        const health0 = p.health;
        const boost0 = p.boost;
        const start = h.tick;
        h.press(p, [], item);
        h.step();
        const started = p.actionType === GameConfig.Action.UseItem && p.actionItem === item;
        let afterEvent: string | undefined;
        let end: number | undefined;
        for (let i = 0; i < Math.round(10 / h.dt); i++) {
            if (event && h.span(start, h.tick) >= EVENT_AT && afterEvent === undefined) {
                event();
                h.step();
                afterEvent = actionName(sv, p.actionType);
            } else {
                h.step();
            }
            if (p.actionType !== GameConfig.Action.UseItem || p.actionItem !== item) {
                end = h.tick;
                break;
            }
        }
        const itemsUsed = 3 - p.invManager.get(item);
        const result: UseResult & { actionAfterEvent?: string } = {
            started,
            completed: itemsUsed > 0,
            seconds: end === undefined || !started ? null : h.span(start, end),
            itemsUsed,
            healthDelta: p.health - health0,
            boostDelta: p.boost - boost0,
        };
        if (event) result.actionAfterEvent = afterEvent;
        return result;
    };

    const uses: Record<string, unknown> = {};
    for (const item of ITEMS) {
        const isHeal = ctx.defs[item].type === "heal";
        uses[item] = {
            def: {
                useTime: ctx.defs[item].useTime,
                heal: ctx.defs[item].heal,
                maxHeal: ctx.defs[item].maxHeal,
                boost: ctx.defs[item].boost,
            },
            fromHealth10: use(solo, fresh(solo, 10), item),
            fromHealth95: use(solo, fresh(solo, 95), item),
            atFullHealth: use(solo, fresh(solo, 100), item),
            ...(isHeal ? {} : { fromBoost90: use(solo, fresh(solo, 50, undefined, 90), item) }),
        };
    }

    const withGun = (p: any, current: number) => {
        solo.giveGun(p, "ak47", { ammo: 10 });
        p.weaponManager.setCurWeapIndex(current);
        solo.stepSeconds(1);
        return p;
    };
    const cancel: Record<string, unknown> = {};
    {
        const p = fresh(solo, 10);
        cancel.cancelInput = use(solo, p, "bandage", () => solo.press(p, ["Cancel"]));
    }
    {
        const p = withGun(fresh(solo, 10), SLOT.melee);
        cancel.switchWeapon = use(solo, p, "bandage", () => solo.press(p, ["EquipPrimary"]));
    }
    {
        const p = withGun(fresh(solo, 10), SLOT.primary);
        cancel.fireGun = use(solo, p, "bandage", () => solo.hold(p, { shootHold: true }));
        solo.hold(p, {});
    }
    {
        const p = fresh(solo, 10);
        cancel.meleeAttack = use(solo, p, "bandage", () => solo.hold(p, { shootHold: true, shootStart: true }));
        solo.hold(p, {});
    }
    {
        const p = fresh(solo, 30);
        cancel.takeDamage = use(solo, p, "bandage", () =>
            p.damage({ amount: 10, damageType: GameConfig.DamageType.Player, dir: v2.create(1, 0) }),
        );
    }
    {
        const p = fresh(solo, 10);
        p.invManager.set("healthkit", 1);
        cancel.secondItem = use(solo, p, "bandage", () => solo.press(p, [], "healthkit"));
        cancel.secondItem = { ...(cancel.secondItem as object), healthkitsLeft: p.invManager.get("healthkit") };
    }
    {
        const p = withGun(fresh(solo, 10), SLOT.primary);
        cancel.reloadInput = use(solo, p, "bandage", () => solo.press(p, ["Reload"]));
        solo.step();
        cancel.reloadInput = { ...(cancel.reloadInput as object), actionAfterUse: actionName(sv, p.actionType) };
    }
    {
        const p = fresh(solo, 10);
        cancel.walking = use(solo, p, "bandage", () => solo.hold(p, { moveRight: true }));
        solo.hold(p, {});
    }
    {
        const group = duo.game.playerBarn.addGroup(false);
        fresh(duo, 100, group);
        const p = fresh(duo, 10, group);
        cancel.knockedDown = use(duo, p, "bandage", () =>
            p.damage({ amount: 50, damageType: GameConfig.DamageType.Player, dir: v2.create(1, 0) }),
        );
    }
    {
        // a heal started during a reload replaces the reload
        const p = withGun(fresh(solo, 10), SLOT.primary);
        p.weapons[SLOT.primary].ammo = 5;
        solo.press(p, ["Reload"]);
        solo.step(5);
        const reloading = actionName(sv, p.actionType);
        cancel.useDuringReload = { reloadingBefore: reloading, ...use(solo, p, "bandage") };
    }

    return {
        params: {
            player: "test player with boost 0 (no regeneration) unless noted; 3 of the item in the inventory",
            input: "useItem sent in an input message, as the client does",
            cancelCases: `event applied ${EVENT_AT} s after the use input (bandage use time 3 s)`,
            seconds: "from the use input to the end of the tick the action ended (completed or cancelled)",
        },
        data: {
            notes: [
                "healing items: refused when health == maxHeal; the heal is added at completion and clamped to 100",
                "boost items: boost is added at completion and clamped to 100; usable at any health",
                "moving halves the speed during a use but does not cancel it",
            ],
            uses,
            cancel,
        },
    };
}
