// Population metrics of the owner's early-game items (bot round 6, user reports 38-41), measured apart from the
// faction A/B: one match where half the bots (even spawn indices) play the smart brain with the four flags and the other
// half without them (the brain name "baseline", its features overridden), personas and skill tiers drawn as on the
// server. A read-only probe watches what the bots do, the same way for both halves:
// - melee rush: an unarmed bot in its first 60 s alive sees an armed enemy within 16 u (an encounter); it rushed when it
//   got within 3 u of that enemy within 10 s, still unarmed;
// - swap to melee: an armed bot with a bare-handed enemy within 3 u (an encounter); it swapped when it held its melee
//   slot within 1.5 s;
// - first looting: the first building interior each bot enters, in the top third of the map's buildings by good-gun
//   value (knowledge/buildingValue.ts);
// - crate first: an unarmed bot with a standing enemy in view 5-28 u away and a container worth breaking within 12 u
//   (an encounter); crate first when it chose the break behaviour within 2 s.
import { type Vec2, v2 } from "@rebirth/core";
import { getMapObjectDef, WeaponSlot } from "@rebirth/defs";
import type { Game, MapData } from "@rebirth/sim";
import { buildingSpots } from "../src/brain/explore.ts";
import { BRAIN_PRESETS, type BrainFeatures } from "../src/brain/features.ts";
import type { BotController } from "../src/controller.ts";
import { colliderBounds, transformCollider } from "../src/geom.ts";
import { buildingLootValue } from "../src/knowledge/buildingValue.ts";
import { gunInfo, isMeleeWeapon } from "../src/knowledge/weapons.ts";
import { type MatchProbe, runMatch } from "../src/runner.ts";

export const EARLY_FLAGS = ["fistRush", "meleeAnswer", "lootRoute", "crateFirst"] as const;

/** The smart preset without the four early-game flags. */
export function withoutEarly(): Readonly<BrainFeatures> {
    const f = { ...BRAIN_PRESETS.smart } as BrainFeatures;
    for (const k of EARLY_FLAGS) f[k] = false;
    return Object.freeze(f);
}

export interface Rate {
    n: number;
    yes: number;
}

export interface GroupMetrics {
    rush: Rate;
    swap: Rate;
    firstLoot: Rate;
    crate: Rate;
    kills: number;
    bots: number;
    wins: number;
}

const rate = (): Rate => ({ n: 0, yes: 0 });
const group = (): GroupMetrics => ({
    rush: rate(),
    swap: rate(),
    firstLoot: rate(),
    crate: rate(),
    kills: 0,
    bots: 0,
    wins: 0,
});

interface Pending {
    kind: "rush" | "swap" | "crate";
    bot: number;
    enemy: number;
    until: number;
    done: boolean;
}

const EARLY = 60;
const SAMPLE_TICKS = 10;

function hasGun(b: BotController): boolean {
    const self = b.bot.model.self;
    return self.weapons.some((w, i) => (i === 0 || i === 1) && !!w.type && (gunInfo(w.type)?.score ?? 0) > 0);
}

class EarlyProbe implements MatchProbe {
    readonly name = "early";
    readonly groups: Record<"on" | "off", GroupMetrics> = { on: group(), off: group() };
    private readonly pending: Pending[] = [];
    private readonly seen = new Set<string>();
    private readonly firstDone = new Set<number>();
    private interiors: Array<{ value: number; box: { min: Vec2; max: Vec2 } }> = [];
    private cut = 0;
    private readonly bornAt = new Map<number, number>();
    private readonly onIds = new Set<number>();
    private readonly onIdx: (index: number) => boolean;

    constructor(onIdx: (index: number) => boolean) {
        this.onIdx = onIdx;
    }

    private onOf(id: number): boolean {
        return this.onIds.has(id);
    }

    start(game: Game, bots: readonly BotController[]): void {
        bots.forEach((b, i) => {
            if (this.onIdx(i)) this.onIds.add(b.playerId);
        });
        this.interiors = interiorsOf(game.mapData);
        const values = this.interiors.map((i) => i.value).sort((a, b) => b - a);
        this.cut = values[Math.floor(values.length / 3)] ?? 0;
    }

    tick(game: Game, bots: readonly BotController[]): void {
        if (game.tick % SAMPLE_TICKS !== 0) return;
        const now = game.time;
        for (const b of bots) {
            const p = game.getPlayer(b.playerId);
            if (!p || p.dead || p.downed) continue;
            if (!this.bornAt.has(p.id)) this.bornAt.set(p.id, now);
            const g = this.groups[this.onOf(p.id) ? "on" : "off"];
            this.firstLooting(p.id, p.pos, g);
            const armed = hasGun(b);
            const early = now - (this.bornAt.get(p.id) ?? now) < EARLY;
            for (const c of b.bot.model.contacts.values()) {
                if (c.teammate || c.dead || c.downed || !c.visible) continue;
                const d = v2.distance(c.pos, p.pos);
                const enemyArmed = !!gunInfo(c.activeWeapon)?.score;
                if (!armed && early && enemyArmed && d < 16) this.encounter("rush", p.id, c.id, now + 10, g.rush);
                if (armed && !enemyArmed && isMeleeWeapon(c.activeWeapon) && d < 3)
                    this.encounter("swap", p.id, c.id, now + 1.5, g.swap);
                if (!armed && d > 5 && d < 28 && crateNear(b, 12))
                    this.encounter("crate", p.id, c.id, now + 2, g.crate);
            }
        }
        for (const q of this.pending) {
            if (q.done || now > q.until) continue;
            const b = bots.find((x) => x.playerId === q.bot);
            const p = game.getPlayer(q.bot);
            const e = game.getPlayer(q.enemy);
            if (!b || !p || p.dead) continue;
            const g = this.groups[this.onOf(q.bot) ? "on" : "off"];
            if (q.kind === "rush" && e && !hasGun(b) && v2.distance(p.pos, e.pos) < 3) {
                q.done = true;
                g.rush.yes++;
            } else if (q.kind === "swap" && b.bot.model.self.curWeapIdx === WeaponSlot.Melee) {
                q.done = true;
                g.swap.yes++;
            } else if (q.kind === "crate" && b.bot.brain.mem.current === "break") {
                q.done = true;
                g.crate.yes++;
            }
        }
        if (this.pending.length > 4000) this.pending.splice(0, 2000);
    }

    private encounter(kind: Pending["kind"], bot: number, enemy: number, until: number, r: Rate): void {
        const key = `${kind}:${bot}:${enemy}`;
        if (this.seen.has(key)) return;
        this.seen.add(key);
        r.n++;
        this.pending.push({ kind, bot, enemy, until, done: false });
    }

    private firstLooting(id: number, pos: Vec2, g: GroupMetrics): void {
        if (this.firstDone.has(id)) return;
        for (const i of this.interiors) {
            if (pos.x < i.box.min.x || pos.x > i.box.max.x || pos.y < i.box.min.y || pos.y > i.box.max.y) continue;
            this.firstDone.add(id);
            g.firstLoot.n++;
            if (i.value >= this.cut) g.firstLoot.yes++;
            return;
        }
    }
}

function interiorsOf(map: MapData): Array<{ value: number; box: { min: Vec2; max: Vec2 } }> {
    const out: Array<{ value: number; box: { min: Vec2; max: Vec2 } }> = [];
    const byId = new Map(map.objects.map((o) => [o.id, o]));
    for (const s of buildingSpots(map)) {
        const o = byId.get(s.id);
        if (!o) continue;
        const zone = getMapObjectDef(o.type).type === "building" ? findZone(o.type) : null;
        if (!zone) continue;
        out.push({
            value: buildingLootValue(map.mapName, o.type),
            box: colliderBounds(transformCollider(zone, o.pos, o.ori, o.scale)),
        });
    }
    return out;
}

function findZone(type: string) {
    const def = getMapObjectDef(type) as { ceiling?: { zoomRegions: Array<{ zoomIn?: unknown }> } };
    return (def.ceiling?.zoomRegions.find((r) => r.zoomIn)?.zoomIn ?? null) as
        | Parameters<typeof transformCollider>[0]
        | null;
}

/** A loot container worth breaking within `r` of the bot (from its own snapshot). */
function crateNear(b: BotController, r: number): boolean {
    const m = b.bot.model;
    for (const o of m.obstacles) {
        if (!o.def.destructible || !o.def.loot.length || o.view.dead || o.def.armorPlated || o.def.stonePlated)
            continue;
        if (o.def.loot.some((l) => (l.tier ?? "") === "tier_world" || (l.tier ?? "") === "tier_container")) {
            if (v2.distance(o.view.pos, m.self.pos) < r) return true;
        }
    }
    return false;
}

export interface EarlyTask {
    seed: number;
    bots: number;
    /** which half plays the four flags: 0 even indices, 1 odd indices */
    half: 0 | 1;
    /** ablation: the flags half plays only this one of the four (the other half none) */
    only?: (typeof EARLY_FLAGS)[number];
}

/** One match of the early-game comparison; its metrics per group. */
export function runEarlyMatch(task: EarlyTask): Record<"on" | "off", GroupMetrics> {
    const onIdx = (i: number) => i % 2 === task.half;
    const probe = new EarlyProbe(onIdx);
    const report = runMatch({
        seed: task.seed,
        bots: task.bots,
        difficulty: "population",
        population: { personas: true },
        maxTicks: 60000,
        brainFeatures: task.only
            ? { baseline: withoutEarly(), smart: { ...withoutEarly(), [task.only]: true } }
            : { baseline: withoutEarly() },
        assign: (i) => ({ brain: onIdx(i) ? "smart" : "baseline" }),
        probes: [probe],
    });
    for (const p of report.players) {
        const g = probe.groups[p.brain === "smart" ? "on" : "off"];
        g.kills += p.kills;
        g.bots++;
        if (report.winners.includes(p.id)) g.wins++;
    }
    return probe.groups;
}
