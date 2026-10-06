// The real enemy intel (installed by perception/install.ts for BrainFeatures threats, assess or opportunism): what a
// player can tell about each enemy from its own snapshots, like a human watching the screen:
// - estHealth: starts at 100; every bullet the bot sees stop on an enemy (BulletEvent hitPlayer + endDist: the tracer
//   ends on its body, blood flies) costs the expected damage of that bullet: def damage with falloff and ricochet
//   division, the visible helmet / chest reductions, and the headshot chance x the gun's headshotMult (the client cannot
//   tell a headshot); the bot's own melee swings that reach an enemy count the same way. Heals the bot watches finish
//   add their def heal; while the enemy is out of sight the estimate drifts back up (it probably healed).
// - action: PlayerView.action of a visible enemy (reload, use, revive).
// - engagedWith: the player its bullets fly towards (or that its bullets hit, or that shoots it).
// - justFought: in the kill feed within 10 s, or hit by someone else within the last few seconds.
// - lastHitByMe: game time of the bot's latest hit on it.
// Damage pipeline: sim combat/damage.ts computeDamage (survev player.ts) and combat/bullets.ts (falloff, ricochets).
import { type Vec2, v2 } from "@rebirth/core";
import { GameConfig, GameObjectDefs, hasDef } from "@rebirth/defs";
import type { BulletEvent, PlayerView, Snapshot } from "@rebirth/sim";
import { distToSegment, rotateOri } from "../geom.ts";
import type { EnemyAction, EnemyIntel, EnemyIntelProvider } from "./intel.ts";
import type { WorldModel } from "./world.ts";

const HEADSHOT_CHANCE = GameConfig.player.headshotChance;
/** Kill feed entries count as a recent fight for this long. */
const KILL_FEED_MEMORY = 10;
/** Hits by someone else count as a recent fight for this long. */
const HIT_BY_OTHER_MEMORY = 6;
/** `engagedWith` is dropped this long after its last evidence. */
const ENGAGE_MEMORY = 3;
/** Out of sight this long, the estimate starts drifting back to full health at DRIFT_RATE HP/s. */
const DRIFT_DELAY = 8;
const DRIFT_RATE = 4;
/** A hit lands on the player whose centre is this close to the tracer's end (body radius 1, scaled up to ~1.4). */
const HIT_MATCH_DIST = 1.8;
/** A bullet flies "towards" a player passing this close to its path. */
const AIM_MATCH_DIST = 3;
/** Intel on players not seen for this long is dropped. */
const FORGET_AFTER = 60;

const FRESH: Readonly<EnemyIntel> = Object.freeze({ estHealth: 100, action: null, justFought: false });

interface IntelState extends EnemyIntel {
    lastSeen: number;
    helmet: string;
    chest: string;
    killFeedAt: number;
    hitByOtherAt: number;
    engagedAt: number;
    /** the heal being watched: item and when it started */
    useItem: string;
    useStart: number;
    useDuration: number;
}

function reductionOf(item: string): number {
    if (!item || !hasDef(item)) return 0;
    return (GameObjectDefs[item] as { damageReduction?: number }).damageReduction ?? 0;
}

/**
 * Expected damage of one hit of `base` raw damage from `source` on a target wearing `helmet` / `chest`: headshot unknown,
 * so its chance x the source's headshotMult (computeDamage: body hits lose the chest reduction and 30 % of the helmet's,
 * head hits the whole helmet reduction).
 */
export function expectedHitDamage(base: number, source: string, helmet: string, chest: string): number {
    const mult = hasDef(source) ? ((GameObjectDefs[source] as { headshotMult?: number }).headshotMult ?? 1) : 1;
    const h = reductionOf(helmet);
    const c = reductionOf(chest);
    const body = (1 - c) * (1 - 0.3 * h);
    const head = mult * (1 - h);
    return base * ((1 - HEADSHOT_CHANCE) * body + HEADSHOT_CHANCE * head);
}

/** Raw damage of a bullet that stopped `endDist` from its start (def damage, ricochet division, distance falloff). */
export function bulletBaseDamage(b: BulletEvent): number {
    if (!hasDef(b.bulletType)) return 0;
    const def = GameObjectDefs[b.bulletType] as { damage?: number; distance?: number; falloff?: number };
    let dmg = (def.damage ?? 0) / (b.reflectCount + 1);
    if (GameConfig.bullet.falloff && def.falloff !== undefined && def.distance) {
        const t = Math.min(1, Math.max(0, (b.endDist ?? 0) / def.distance));
        dmg *= 1 + (def.falloff - 1) * t;
    }
    return dmg;
}

export class EnemyIntelTracker implements EnemyIntelProvider {
    now = 0;
    private readonly states = new Map<number, IntelState>();
    private readonly hitBullets = new Set<number>();
    private readonly hitOrder: number[] = [];
    private selfAnimSeq = -1;

    of(id: number): Readonly<EnemyIntel> {
        return this.states.get(id) ?? FRESH;
    }

    ingest(snap: Snapshot, model: WorldModel): void {
        const prevNow = this.now;
        this.now = model.time;
        if (model.self.dead) return;
        let me: PlayerView | undefined;
        for (const o of snap.objects) {
            if (o.kind !== "player") continue;
            if (o.id === model.selfId) {
                me = o;
                continue;
            }
            if (model.isTeammate(o.id) || !model.contacts.get(o.id)?.visible || o.dead) continue;
            this.see(o);
        }
        this.ingestBullets(model);
        if (me) this.ingestMelee(me, model);
        this.ingestKills(snap, model);
        this.decay(this.now - prevNow);
    }

    private state(id: number): IntelState {
        let s = this.states.get(id);
        if (!s) {
            s = {
                estHealth: 100,
                action: null,
                justFought: false,
                lastSeen: this.now,
                helmet: "",
                chest: "",
                killFeedAt: Number.NEGATIVE_INFINITY,
                hitByOtherAt: Number.NEGATIVE_INFINITY,
                engagedAt: Number.NEGATIVE_INFINITY,
                useItem: "",
                useStart: 0,
                useDuration: 0,
            };
            this.states.set(id, s);
        }
        return s;
    }

    private see(o: PlayerView): void {
        const s = this.state(o.id);
        s.lastSeen = this.now;
        s.helmet = o.helmet;
        s.chest = o.chest;
        const type = o.action?.type ?? "none";
        const action: EnemyAction = type === "reload" || type === "use" || type === "revive" ? type : null;
        // a heal it was seen using to the end restores its def heal
        if (s.useItem && (type !== "use" || o.action?.item !== s.useItem)) {
            if (this.now - s.useStart >= s.useDuration - 0.15) this.applyHeal(s, s.useItem);
            s.useItem = "";
        }
        if (type === "use" && o.action && !s.useItem) {
            s.useItem = o.action.item;
            s.useStart = this.now;
            s.useDuration = o.action.duration;
        }
        s.action = action;
    }

    private applyHeal(s: IntelState, item: string): void {
        if (!hasDef(item)) return;
        const def = GameObjectDefs[item] as { type: string; heal?: number; maxHeal?: number };
        if (def.type !== "heal") return;
        s.estHealth = Math.min(def.maxHeal ?? 100, s.estHealth + (def.heal ?? 0));
    }

    private markHit(id: number): boolean {
        if (this.hitBullets.has(id)) return false;
        this.hitBullets.add(id);
        this.hitOrder.push(id);
        if (this.hitOrder.length > 512) this.hitBullets.delete(this.hitOrder.shift() as number);
        return true;
    }

    /** The player (self, a visible contact) whose centre is closest to `p` within `maxDist`, or 0. */
    private playerAt(p: Vec2, model: WorldModel, maxDist: number, exclude: number): number {
        let best = 0;
        let bestD = maxDist;
        if (exclude !== model.selfId) {
            const d = v2.distance(model.self.pos, p);
            if (d < bestD) {
                bestD = d;
                best = model.selfId;
            }
        }
        for (const c of model.contacts.values()) {
            if (!c.visible || c.dead || c.id === exclude) continue;
            const d = v2.distance(c.pos, p);
            if (d < bestD) {
                bestD = d;
                best = c.id;
            }
        }
        return best;
    }

    private ingestBullets(model: WorldModel): void {
        const selfId = model.selfId;
        for (const b of model.bullets) {
            const shooter = b.shooterId;
            const enemyShooter = shooter !== 0 && shooter !== selfId && !model.isTeammate(shooter);
            if (b.hitPlayer && b.endDist !== undefined) {
                if (!this.markHit(b.id)) continue;
                const end = v2.add(b.pos, v2.mul(b.dir, b.endDist));
                const target = this.playerAt(end, model, HIT_MATCH_DIST, shooter);
                if (target === 0) continue;
                if (target !== selfId && !model.isTeammate(target)) {
                    const s = this.state(target);
                    s.estHealth = Math.max(
                        0,
                        s.estHealth - expectedHitDamage(bulletBaseDamage(b), b.sourceType, s.helmet, s.chest),
                    );
                    if (shooter === selfId) s.lastHitByMe = this.now;
                    else if (shooter !== 0) {
                        s.hitByOtherAt = this.now;
                        this.engage(s, shooter);
                    }
                }
                if (enemyShooter) this.engage(this.state(shooter), target);
                continue;
            }
            // a fresh shot: who it flies towards
            if (!enemyShooter || !b.shotFx || b.reflectCount > 0) continue;
            const s = this.state(shooter);
            const end = v2.add(b.pos, v2.mul(b.dir, b.maxDist));
            let best = 0;
            let bestD = AIM_MATCH_DIST;
            const consider = (id: number, p: Vec2) => {
                if (id === shooter || v2.dot(v2.sub(p, b.pos), b.dir) <= 0) return;
                const d = distToSegment(p, b.pos, end);
                if (d < bestD) {
                    bestD = d;
                    best = id;
                }
            };
            consider(selfId, model.self.pos);
            for (const c of model.contacts.values()) if (c.visible && !c.dead) consider(c.id, c.pos);
            if (best) this.engage(s, best);
        }
    }

    private engage(s: IntelState, other: number): void {
        s.engagedWith = other;
        s.engagedAt = this.now;
    }

    /** The bot's own melee swing: an enemy inside the attack circle takes the weapon's expected damage. */
    private ingestMelee(me: PlayerView, model: WorldModel): void {
        const anim = me.anim;
        if (!anim) return;
        const started = anim.seq !== this.selfAnimSeq;
        this.selfAnimSeq = anim.seq;
        if (!started || anim.type !== "melee") return;
        const weapon = model.self.weapons[2]?.type ?? "";
        if (!hasDef(weapon)) return;
        const def = GameObjectDefs[weapon] as {
            type: string;
            damage?: number;
            attack?: { offset: Vec2; rad: number };
        };
        if (def.type !== "melee" || !def.attack) return;
        const dir = model.self.dir;
        // the offset is along the facing (x) and to its side (y)
        const off = def.attack.offset;
        const side = rotateOri(dir, 1);
        const center = v2.add(model.self.pos, v2.add(v2.mul(dir, off.x), v2.mul(side, off.y)));
        const target = this.playerAt(center, model, def.attack.rad + 1, model.selfId);
        if (target === 0 || model.isTeammate(target)) return;
        const s = this.state(target);
        s.estHealth = Math.max(0, s.estHealth - expectedHitDamage(def.damage ?? 0, weapon, s.helmet, s.chest));
        s.lastHitByMe = this.now;
    }

    private ingestKills(snap: Snapshot, model: WorldModel): void {
        for (const k of snap.kills ?? []) {
            if (k.killerId && k.killerId !== model.selfId && !model.isTeammate(k.killerId)) {
                this.state(k.killerId).killFeedAt = this.now;
            }
            if (k.killed) {
                this.states.delete(k.targetId);
                continue;
            }
            if (k.downed && !model.isTeammate(k.targetId) && k.targetId !== model.selfId) {
                const s = this.state(k.targetId);
                s.killFeedAt = this.now;
                // a revived player stands up with 24 HP (sim M6a)
                s.estHealth = Math.min(s.estHealth, 24);
            }
        }
        for (const id of snap.deletedPlayerIds ?? []) this.states.delete(id);
    }

    private decay(dt: number): void {
        const now = this.now;
        for (const [id, s] of this.states) {
            const unseen = now - s.lastSeen;
            if (unseen > FORGET_AFTER) {
                this.states.delete(id);
                continue;
            }
            if (unseen > 0.5) {
                s.action = null;
                s.useItem = "";
            }
            const drift = Math.min(dt, unseen - DRIFT_DELAY);
            if (drift > 0) s.estHealth = Math.min(100, s.estHealth + DRIFT_RATE * drift);
            if (s.engagedWith !== undefined && now - s.engagedAt > ENGAGE_MEMORY) s.engagedWith = undefined;
            s.justFought = now - s.killFeedAt < KILL_FEED_MEMORY || now - s.hitByOtherAt < HIT_BY_OTHER_MEMORY;
        }
    }
}
