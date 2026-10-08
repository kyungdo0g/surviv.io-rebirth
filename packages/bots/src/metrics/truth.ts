// Ground truth for the match metrics: what a human player at a bot's place would see of another player (the 16:9
// screen of perception/sight.ts, building roofs, smoke, foliage, other floors), the guns a player really carries, and
// its nearest standing enemy. Reads the simulation and the bot's own model only; never writes either.
import { type Bounds, type Vec2, v2 } from "@rebirth/core";
import { WeaponSlot } from "@rebirth/defs";
import type { Game, Player } from "@rebirth/sim";
import type { BotController } from "../controller.ts";
import { pointInBounds } from "../geom.ts";
import { gunRank, gunTier, isWeakGun } from "../knowledge/gunTiers.ts";
import { type GunInfo, gunInfo } from "../knowledge/weapons.ts";
import { sameLayer } from "../nav/cellGrid.ts";
import { concealed, onHumanScreen } from "../perception/sight.ts";

/** A player's body radius: a body whose edge pokes onto the screen counts as on it (triage threshold: 1 unit slack). */
export const BODY_SLACK = 1;

/** Living players of other teams, standing (not downed) unless `downed`. */
export function enemiesOf(game: Game, p: Player, downed = false): Player[] {
    const out: Player[] = [];
    for (const q of game.players()) {
        if (q.dead || q === p || q.teamId === p.teamId || (!downed && q.downed)) continue;
        out.push(q);
    }
    return out;
}

/** Distance to the nearest standing enemy (Infinity without one). */
export function nearestEnemy(game: Game, p: Player): number {
    let best = Number.POSITIVE_INFINITY;
    for (const q of game.players()) {
        if (q.dead || q.downed || q === p || q.teamId === p.teamId) continue;
        best = Math.min(best, v2.distance(p.pos, q.pos));
    }
    return best;
}

/** Ground-floor ceilings (zoomIn regions in world space) of a game, looked up by a coarse grid. */
export class RoofIndex {
    private readonly cells = new Map<number, Array<{ building: { ceilingDead: boolean }; region: Bounds }>>();
    private static readonly CELL = 32;

    constructor(game: Game) {
        for (const b of game.world.buildings) {
            if (b.layer !== 0) continue;
            for (const z of b.zoomRegions) {
                if (!z.zoomIn) continue;
                const r = z.zoomIn;
                const c = RoofIndex.CELL;
                for (let x = Math.floor(r.min.x / c); x <= Math.floor(r.max.x / c); x++) {
                    for (let y = Math.floor(r.min.y / c); y <= Math.floor(r.max.y / c); y++) {
                        const k = x * 4096 + y;
                        let list = this.cells.get(k);
                        if (!list) this.cells.set(k, (list = []));
                        list.push({ building: b, region: r });
                    }
                }
            }
        }
    }

    /** The standing ceilings over `p` (none: open air). */
    over(p: Vec2): Bounds[] {
        const c = RoofIndex.CELL;
        const list = this.cells.get(Math.floor(p.x / c) * 4096 + Math.floor(p.y / c));
        if (!list) return [];
        const out: Bounds[] = [];
        for (const e of list) if (!e.building.ceilingDead && pointInBounds(p, e.region)) out.push(e.region);
        return out;
    }

    /** `target` is under a roof the viewer is not under (the original client draws that ceiling over it). */
    hides(viewer: Vec2, target: Vec2): boolean {
        const roofs = this.over(target);
        return roofs.length > 0 && !roofs.some((r) => pointInBounds(viewer, r));
    }
}

export type Sight = "visible" | "offscreen" | "hidden";

/** What a human at `viewer`'s place sees of `target`: on the 16:9 screen and not hidden by a roof, smoke or foliage. */
export function humanSight(game: Game, roofs: RoofIndex, bot: BotController, viewer: Player, target: Player): Sight {
    if (!onHumanScreen(viewer.pos, viewer.zoom, target.pos, BODY_SLACK)) return "offscreen";
    if (!sameLayer(viewer.layer, target.layer)) return "hidden";
    // (underground no ceiling hides anything: the client covers the ground floor with the underground fill)
    if ((viewer.layer & 1) === 0 && roofs.hides(viewer.pos, target.pos)) return "hidden";
    if (game.hiddenInSmoke(viewer, target)) return "hidden";
    if (concealed(bot.bot.model, target.pos, target.layer)) return "hidden";
    return "visible";
}

/** Some ray from the viewer to the target's centre or its body edges is clear in the bot's view of the obstacles. */
export function bodyLineOfFire(bot: BotController, from: Vec2, to: Vec2): boolean {
    const model = bot.bot.model;
    if (model.lineOfFire(from, to)) return true;
    const side = v2.mul(v2.perp(v2.normalizeSafe(v2.sub(to, from))), BODY_SLACK * 0.9);
    return model.lineOfFire(from, v2.add(to, side)) || model.lineOfFire(from, v2.sub(to, side));
}

export interface CarriedGun {
    slot: number;
    id: string;
    info: GunInfo;
    /** magazine plus bag */
    rounds: number;
    rank: number;
}

/** The guns in a player's two gun slots that have ammo (magazine or bag). */
export function usableGuns(p: Player): CarriedGun[] {
    const out: CarriedGun[] = [];
    for (const slot of [WeaponSlot.Primary, WeaponSlot.Secondary]) {
        const w = p.weaponManager.weapons[slot];
        const info = w?.type ? gunInfo(w.type) : undefined;
        if (!info || info.cls === "useless") continue;
        const rounds = w.ammo + p.inv.get(info.ammo);
        if (rounds > 0) out.push({ slot, id: w.type, info, rounds, rank: gunRank(w.type) });
    }
    return out;
}

/** The best usable gun by tier (then by magazine plus bag), or null unarmed. */
export function bestGun(guns: readonly CarriedGun[]): CarriedGun | null {
    let best: CarriedGun | null = null;
    for (const g of guns) if (!best || g.rank > best.rank || (g.rank === best.rank && g.rounds > best.rounds)) best = g;
    return best;
}

/** Whether the bot perceives a gun better than weak (seen loot on its floor within `range` units). */
export function seesBetterGun(bot: BotController, p: Player, range = 40): boolean {
    for (const l of bot.bot.model.loot.values()) {
        if (!sameLayer(p.layer, l.layer) || v2.distance(p.pos, l.pos) > range) continue;
        const info = gunInfo(l.type);
        if (info && info.cls !== "useless" && !isWeakGun(l.type) && gunTier(l.type)) return true;
    }
    return false;
}

/** Whether a gun id is in the S tier (m249, pkp: knowledge/gunTiers.ts). */
export function isSTier(id: string): boolean {
    return gunTier(id)?.tier === "S";
}
