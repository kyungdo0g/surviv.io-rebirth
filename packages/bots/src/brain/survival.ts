// Staying alive: healing and boosting when hurt and safe (smoke first when an enemy is close, namu.md /팁), rotating
// into the next safe zone ahead of the red zone (follow the line to the safe zone; run when inside the gas), and
// fleeing a fight the bot cannot win.
import { type Vec2, v2 } from "@rebirth/core";
import { GameConfig } from "@rebirth/defs";
import { type GasView, gasCircle, gasTimeLeft } from "@rebirth/sim";
import { isMeleeWeapon } from "../knowledge/weapons.ts";
import type { WorldModel } from "../perception/world.ts";
import { addCombatLayer, findCover, freeDir } from "./combat.ts";
import { type BrainCtx, emptyIntent, type Intent } from "./context.ts";

/** Effective rotation speed through terrain and obstacles (u/s; the player runs at 12). */
const TRAVEL_SPEED = 8.5;

/** Heal or boost item to use now, or "" (healthkit when badly hurt, bandages otherwise, boosts when healthy). */
export function healItem(ctx: BrainCtx): string {
    const { self, params } = ctx;
    const inv = self.inventory;
    const h = self.health;
    if (h < 100 - 1e-6) {
        if (h < 45 && inv.healthkit > 0) return "healthkit";
        if (h < params.healBelow + 15 && inv.bandage > 0 && h < 92) return "bandage";
        if (h < params.healBelow && inv.healthkit > 0) return "healthkit";
    }
    if (self.boost < params.boostAbove) {
        if (inv.painkiller > 0 && self.boost < 50) return "painkiller";
        if (inv.soda > 0) return "soda";
    }
    return "";
}

/** Utility of healing now (0..1). */
export function healScore(ctx: BrainCtx): number {
    const { self, params, now, model } = ctx;
    if (self.action.type === "use") return 0.9;
    const item = healItem(ctx);
    if (!item) return 0;
    const isHeal = item === "healthkit" || item === "bandage";
    let s = isHeal ? 0.35 + 0.6 * Math.max(0, (params.healBelow + 10 - self.health) / 100) : 0.2;
    if (isHeal && self.health < params.healBelow) s = Math.max(s, 0.55);
    const close = ctx.visibleEnemies.some((e) => v2.distance(e.pos, self.pos) < 30 && !e.downed);
    if (close) s *= self.health < 35 ? 0.6 : 0.25;
    if (now - model.lastHurt < 1.5) s *= 0.6;
    const gas = model.gas;
    if (model.inGasNow() && gas && gas.damage >= 3) s *= 0.3;
    return Math.min(0.92, s);
}

export function planHeal(ctx: BrainCtx): Intent {
    const intent = emptyIntent("heal");
    const { self, model, mem, now, rng } = ctx;
    const using = self.action.type === "use";
    const threat = ctx.visibleEnemies.find((e) => !e.downed) ?? ctx.target;
    if (!using) {
        // an enemy close by: blind it with smoke first, then heal inside
        if (threat && self.inventory.smoke > 0 && now - mem.lastSmoke > 10 && self.health < 50) {
            mem.lastSmoke = now;
            intent.throwPlan = { item: "smoke", pos: v2.add(self.pos, v2.mul(self.dir, 1.5)), cook: 0.15 };
            return intent;
        }
        const item = healItem(ctx);
        if (item && now - mem.lastUseRequest > 0.6) {
            mem.lastUseRequest = now;
            intent.useItem = item;
        }
    }
    if (threat) {
        const cover = findCover(model, threat.pos, 10);
        if (cover) {
            intent.goal = cover;
            intent.arriveDist = 0.6;
        } else {
            const away = v2.normalizeSafe(v2.sub(self.pos, threat.pos));
            intent.moveDir = freeDir(model, self.pos, away);
        }
        intent.aim = v2.copy(threat.pos);
    } else if (!model.insideSafeZone(self.pos, 4)) {
        intent.goal = zoneTarget(model, rng.next());
        intent.arriveDist = 3;
    } else {
        intent.stop = true;
    }
    return intent;
}

/** Duration of the moving stage that follows a waiting stage (GameConfig stage table; 0 when unknown). */
/**
 * Expected duration of the moving stage that follows a waiting stage: the GameConfig stage table, scaled by how the
 * waiting stage the bot sees compares with the table (servers and tests may run shorter stage tables).
 */
function nextMoveDuration(gas: GasView): number {
    if (gas.mode !== "waiting") return 0;
    const table = GameConfig.gas.stages;
    const waiting = table[gas.stage]?.duration ?? 0;
    const moving = table[gas.stage + 1]?.duration ?? 0;
    const scale = waiting > 0 ? Math.min(1.5, gas.duration / waiting) : 1;
    return moving * scale;
}

/** How hard the zone presses the bot to leave (0 inside the safe zone .. >1 late). */
export function zonePressure(model: WorldModel): number {
    const gas = model.gas;
    if (!gas || gas.mode === "inactive") return 0;
    const dist = v2.distance(model.self.pos, gas.posNew);
    if (dist < gas.radNew) return 0;
    const need = (dist - gas.radNew * 0.6) / TRAVEL_SPEED;
    return need / Math.max(gasTimeLeft(gas) + nextMoveDuration(gas), 1);
}

/** Whether going to `p` keeps the bot on its way to the safe zone (or the zone does not press yet). */
export function onTheWay(model: WorldModel, p: Vec2): boolean {
    const gas = model.gas;
    if (!gas || gas.mode === "inactive" || zonePressure(model) < 0.3) return true;
    return v2.distance(p, gas.posNew) < v2.distance(model.self.pos, gas.posNew) + 3;
}

/** A point well inside the next safe circle, along the line from the bot to the circle centre. */
export function zoneTarget(model: WorldModel, jitter: number): Vec2 {
    const gas = model.gas;
    const me = model.self.pos;
    if (!gas) return v2.copy(me);
    const center = gas.posNew;
    const rad = gas.radNew;
    const dist = v2.distance(me, center);
    const depth = rad * (0.45 + 0.2 * jitter);
    if (dist <= depth || rad < 1) return v2.copy(center);
    const p = v2.add(center, v2.mul(v2.normalizeSafe(v2.sub(me, center)), depth));
    const cell = model.nav.nearestWalkable(p, 10, model.nav.component(model.nav.nearestWalkable(me, 3)));
    return cell >= 0 ? model.nav.center(cell) : p;
}

/** Utility of moving into the safe zone now (0..1). */
export function zoneScore(ctx: BrainCtx): number {
    const { model, self } = ctx;
    const gas = model.gas;
    if (!gas || gas.mode === "inactive") return 0;
    if (model.inGasNow()) return gas.damage >= 5 ? 0.97 : 0.93;
    const dist = v2.distance(self.pos, gas.posNew);
    const margin = Math.min(6, gas.radNew * 0.25);
    if (dist < gas.radNew - margin) {
        // inside the next circle; late circles keep the bot away from the edge of the current one
        const c = gasCircle(gas);
        return v2.distance(self.pos, c.pos) > c.rad - 4 ? 0.6 : 0;
    }
    const pressure = zonePressure(model);
    if (gas.mode === "moving") return Math.min(0.9, 0.55 + pressure);
    // early circles are weak: finish looting nearby first, but leave with time to spare
    return Math.min(0.9, 0.2 + 0.8 * pressure + (gas.circleIdx >= 2 ? 0.15 : 0));
}

export function planZone(ctx: BrainCtx): Intent {
    const intent = emptyIntent("zone");
    intent.goal = zoneTarget(ctx.model, (ctx.self.id % 7) / 7);
    intent.arriveDist = 3;
    addCombatLayer(ctx, intent);
    return intent;
}

/** Utility of running away (0..1): unarmed against an armed enemy, badly hurt, or outnumbered. */
export function fleeScore(ctx: BrainCtx): number {
    const { self } = ctx;
    const threats = ctx.visibleEnemies.filter((e) => !e.downed && v2.distance(e.pos, self.pos) < 35);
    if (threats.length === 0) return 0;
    const armedThreat = threats.some((e) => !isMeleeWeapon(e.activeWeapon));
    if (!ctx.armed && armedThreat) return threats.some((e) => v2.distance(e.pos, self.pos) < 4) ? 0.5 : 0.8;
    const hasHeals = (self.inventory.healthkit ?? 0) + (self.inventory.bandage ?? 0) > 0;
    if (self.health < 25 && hasHeals) return 0.72;
    if (threats.length >= 3) return 0.62;
    return 0;
}


export function planFlee(ctx: BrainCtx): Intent {
    const intent = emptyIntent("flee");
    const { self, model, now, mem } = ctx;
    const threats = ctx.visibleEnemies.filter((e) => !e.downed);
    let away = { x: 0, y: 0 };
    for (const e of threats) {
        const d = Math.max(1, v2.distance(e.pos, self.pos));
        away = v2.add(away, v2.mul(v2.normalizeSafe(v2.sub(self.pos, e.pos)), 1 / d));
    }
    // run towards the safe zone rather than into the gas
    if (model.gas && model.gas.mode !== "inactive") {
        const toZone = v2.normalizeSafe(v2.sub(model.gas.posNew, self.pos));
        away = v2.add(v2.normalizeSafe(away), v2.mul(toZone, model.insideSafeZone(self.pos, 10) ? 0.2 : 0.8));
    }
    const dir = v2.normalizeSafe(away);
    const goal = v2.add(self.pos, v2.mul(dir, 25));
    const cell = model.nav.nearestWalkable(goal, 10);
    intent.goal = cell >= 0 ? model.nav.center(cell) : goal;
    intent.arriveDist = 3;
    if (threats.length && self.inventory.smoke > 0 && now - mem.lastSmoke > 12) {
        mem.lastSmoke = now;
        intent.throwPlan = { item: "smoke", pos: v2.add(self.pos, v2.mul(dir, -3)), cook: 0.15 };
    }
    addCombatLayer(ctx, intent);
    return intent;
}
