// movement.json: player speed (distance per second over many ticks) per active weapon and situation.
import { type Ctx, type FixtureResult, idsOfType } from "../lib/context.ts";
import { Harness, type InputState, type Vec } from "../lib/harness.ts";
import { SLOT } from "../lib/measure.ts";
import { CENTERED } from "../lib/rng.ts";

const MEASURE_TICKS = 100;
const RIGHT: InputState = { moveRight: true };

/** Distance per second while `input` is held for `ticks` ticks; `eachTick` runs before every tick. */
function speedOf(h: Harness, p: any, input: InputState, ticks = MEASURE_TICKS, eachTick?: () => void): number {
    const start: Vec = { x: p.pos.x, y: p.pos.y };
    h.hold(p, { ...input, dir: input.dir ?? { x: 1, y: 0 } });
    for (let i = 0; i < ticks; i++) {
        eachTick?.();
        h.step();
    }
    h.hold(p, {});
    return Math.hypot(p.pos.x - start.x, p.pos.y - start.y) / (ticks * h.dt);
}

function equipped(ctx: Ctx, h: Harness, id: string, row: number): any {
    const p = h.addPlayer(h.rowPos(row, 6));
    p.debug.godMode = true;
    const type = ctx.defs[id].type;
    if (type === "gun") {
        h.giveGun(p, id);
        p.weaponManager.setCurWeapIndex(SLOT.primary);
    } else if (type === "melee") {
        p.weaponManager.setWeapon(SLOT.melee, id, 0);
    } else {
        p.invManager.set(id, 3);
        p.weaponManager.setWeapon(SLOT.throwable, id, 0);
        p.weaponManager.setCurWeapIndex(SLOT.throwable);
    }
    h.stepSeconds(1.5);
    return p;
}

function perWeapon(ctx: Ctx) {
    const h = new Harness(ctx.sv, { seed: 61 });
    h.setMode(CENTERED, "never");
    const out: Record<string, Record<string, number>> = { gun: {}, melee: {}, throwable: {} };
    const throwables = idsOfType(ctx.defs, "throwable").filter((id) => ctx.defs[id].handImg?.equip);
    const ids = [...idsOfType(ctx.defs, "gun"), ...idsOfType(ctx.defs, "melee"), ...throwables];
    ids.forEach((id, row) => {
        const p = equipped(ctx, h, id, row);
        out[ctx.defs[id].type][id] = speedOf(h, p, RIGHT);
    });
    return out;
}

function situations(ctx: Ctx) {
    const h = new Harness(ctx.sv, { seed: 62 });
    h.setMode(CENTERED, "never");
    const { GameConfig } = ctx.sv;
    let row = 0;
    const fists = () => equipped(ctx, h, "fists", row++);
    const out: Record<string, unknown> = {};

    out.fists = speedOf(h, fists(), RIGHT);
    out.fistsDiagonal = speedOf(h, fists(), { moveRight: true, moveUp: true });
    for (const boost of [25, 49.9, 50, 50.01, 75, 100]) {
        const p = fists();
        out[`fistsBoost${boost}`] = speedOf(h, p, RIGHT, MEASURE_TICKS, () => {
            p.boost = boost;
        });
    }

    // ocean: the map border inside shoreInset is water
    const swimmer = h.addPlayer({ x: 12, y: h.center.y });
    swimmer.debug.godMode = true;
    h.stepSeconds(1.5);
    const onWater = h.game.map.isOnWater(swimmer.pos, swimmer.layer);
    out.fistsInWater = { onWater, speed: speedOf(h, swimmer, { moveUp: true, dir: { x: 0, y: 1 } }) };

    for (const gun of ["ak47", "m249", "m870", "mosin"]) {
        const p = equipped(ctx, h, gun, row++);
        const def = ctx.defs[gun];
        out[`${gun}Firing`] = {
            speed: speedOf(h, p, { moveRight: true, shootHold: true, shootStart: def.fireMode === "single" }),
            note: "trigger held while walking: speed while shotSlowdownTimer > 0 is (base + equip + attack) * 0.5",
        };
    }

    const healer = fists();
    healer.invManager.set("bandage", 5);
    healer.health = 10;
    h.press(healer, [], "bandage");
    h.step();
    out.usingBandage = { action: healer.actionType === GameConfig.Action.UseItem, speed: speedOf(h, healer, RIGHT) };

    const cook = equipped(ctx, h, "frag", row++);
    h.hold(cook, { shootHold: true, shootStart: true });
    h.step(5);
    out.cookingFrag = {
        cooking: cook.animType === GameConfig.Anim.Cook,
        speed: speedOf(h, cook, { moveRight: true, shootHold: true }, 50),
    };
    return out;
}

function downedSpeeds(ctx: Ctx) {
    const h = new Harness(ctx.sv, { seed: 63, teamMode: "duo" });
    h.setMode(CENTERED, "never");
    const { GameConfig, v2 } = ctx.sv;
    const knock = (p: any) => p.damage({ amount: 200, damageType: GameConfig.DamageType.Player, dir: v2.create(1, 0) });
    const pair = (y: number) => {
        const group = h.game.playerBarn.addGroup(false);
        const reviver = h.addPlayer({ x: 300, y }, { group });
        const downed = h.addPlayer({ x: 300, y }, { group });
        return { reviver, downed };
    };

    const a = pair(300);
    knock(a.downed);
    h.stepSeconds(3); // knock-back velocity decays below survev's 0.01 cut-off
    const crawling = speedOf(h, a.downed, RIGHT, 50);

    const b = pair(340);
    knock(b.downed);
    h.stepSeconds(3);
    h.teleport(b.reviver, b.downed.pos);
    h.press(b.reviver, ["Interact"]);
    h.step();
    const reviving = b.reviver.actionType === GameConfig.Action.Revive;
    const reviverSpeed = speedOf(h, b.reviver, RIGHT, 30);

    const c = pair(380);
    knock(c.downed);
    h.stepSeconds(3);
    h.teleport(c.reviver, c.downed.pos);
    h.press(c.reviver, ["Interact"]);
    h.step();
    const beingRevivedSpeed = speedOf(h, c.downed, RIGHT, 30);
    return {
        downedCrawl: crawling,
        reviving: { active: reviving, speed: reviverSpeed },
        beingRevived: { speed: beingRevivedSpeed },
        note:
            "survev: downed = downedMoveSpeed (4), reviver = downedMoveSpeed + 2 ('not specified in game config so " +
            "i just estimated', player.ts recalculateSpeed), being revived = downedRezMoveSpeed (2); equip speed of " +
            "the active weapon is added on top",
    };
}

export function movement(ctx: Ctx): FixtureResult {
    return {
        params: {
            measure: `displacement over ${MEASURE_TICKS} ticks (unless noted) divided by the elapsed time`,
            map: "empty oracle map (grass); water rows use the ocean strip at the map border",
            boost: "fistsBoostN: boost reset to N before every tick (it decays during the tick before speed is computed)",
        },
        data: {
            baseMoveSpeed: ctx.sv.GameConfig.player.moveSpeed,
            perWeapon: perWeapon(ctx),
            situations: situations(ctx),
            downed: downedSpeeds(ctx),
        },
    };
}
