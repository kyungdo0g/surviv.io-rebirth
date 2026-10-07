// Round 3 tactics metrics (user reports 19, 20, 22, 23, 25 and 26; stage EVALUATE), read-only. Ground truth comes from
// the simulation (true positions, smoke, damage) and the bot's own view of the obstacles; the bot's memory is read
// only to label what it chose:
// - fire from a shooter the bot could not see: an episode starts with a bullet that hit the bot or passed close
//   (WorldModel.underFire) from a shooter off its 16:9 screen or hidden, and ends after 3 s of quiet (15 s at most).
//   Its reaction is the movement MOVE picked (brain/evade.ts: run, cover, push) or a flight, plus the weapon side
//   COMBAT picked (brain/unseenFire.ts: return, hold) or return fire seen as shots with no target; also how long it
//   took, the share of the episode out of the true shooter's line of fire, damage and deaths;
// - smoke: a fight target that went into smoke the bot is not in, and what the bot did (brain/smokeFight.ts spray,
//   frag, hold; shots at the cloud);
// - a fight target lost from sight (off the screen or hidden for 0.5 s): whether the bot searched (behaviour
//   "search"), found it (on its screen again within 30 s), or gave the search up, and when;
// - concealment: shots at targets under a tree canopy; every 0.5 s, enemies on the bot's screen in reach with a clear
//   line, by concealment (open, canopy, bush), and how often the bot fired at them (a revealed one does not count);
// - cover in fights: fight samples with cover that blocks the target's line within 5 u of the bot, or none of the
//   bot's body in the target's line of fire;
// - outfits: changes, and those made with an enemy in view, hurt or under threat.
import { v2 } from "@rebirth/core";
import type { DamageParams, Player } from "@rebirth/sim";
import type { BotController } from "../controller.ts";
import { distanceToCollider } from "../geom.ts";
import { gunInfo } from "../knowledge/weapons.ts";
import { sameLayer } from "../nav/cellGrid.ts";
import { segmentHitsCollider } from "../perception/rays.ts";
import { concealed, onHumanScreen, underCanopy } from "../perception/sight.ts";
import { livingBots, type MetricsCtx, SAMPLE } from "./context.ts";
import type { Round3Bot } from "./round3Types.ts";
import { BODY_SLACK, bodyLineOfFire, humanSight, usableGuns } from "./truth.ts";

const UNSEEN_QUIET = 3;
const UNSEEN_MAX = 15;
const SMOKE_GONE = 1;
const SMOKE_MAX = 20;
/** A target out of sight this long is lost; a loss is followed this long. */
const LOST_AFTER = 0.5;
const LOST_MAX = 30;
/** A concealed player that fired or was hit this recently is revealed (COMBAT-2: 1 s, metrics/fairness.ts: 2 s). */
const REVEAL = 2;
const ENGAGEMENT_GAP = 3;
/** Cover counts when it blocks the target's line this close to the bot. */
const COVER_NEAR = 5;
/** Concealment samples reach this far at most (and no farther than the held gun's range). */
const CONCEAL_RANGE = 45;
const FLIGHT = new Set(["flee", "evacuate", "disengage"]);

interface UnseenEp {
    start: number;
    last: number;
    shooter: number;
    move: string;
    weapon: string;
    reactedAt: number;
    spotted: boolean;
}

interface SmokeEp {
    target: number;
    start: number;
    lastIn: number;
    choice: string;
    shots: number;
}

interface LostEp {
    target: number;
    lostAt: number;
    armed: boolean;
    searching: boolean;
    searched: boolean;
    gaveUp: boolean;
}

interface Track {
    unseen: UnseenEp | null;
    underFireAt: number;
    smoke: SmokeEp | null;
    lost: LostEp | null;
    /** the fight target and when the bot last saw it (on its screen, not hidden), armed and in reach then */
    seen: { id: number; at: number; armed: boolean; inReach: boolean } | null;
    /** the last fight target and when it was the target */
    lastTarget: { id: number; at: number } | null;
    outfit: string;
    throws: number;
}

export class TacticsCollector {
    private readonly ctx: MetricsCtx;
    private readonly r3: (id: number) => Round3Bot | undefined;
    private readonly tracks = new Map<number, Track>();
    private readonly firedAt = new Map<number, number>();
    private readonly hurtAt = new Map<number, number>();
    private readonly lastShotAt = new Map<number, Map<number, number>>();

    constructor(ctx: MetricsCtx, r3: (id: number) => Round3Bot | undefined) {
        this.ctx = ctx;
        this.r3 = r3;
    }

    private track(id: number): Track {
        let t = this.tracks.get(id);
        if (!t) {
            t = {
                unseen: null,
                underFireAt: Number.NEGATIVE_INFINITY,
                smoke: null,
                lost: null,
                seen: null,
                lastTarget: null,
                outfit: "",
                throws: 0,
            };
            this.tracks.set(id, t);
        }
        return t;
    }

    private revealed(id: number, now: number): boolean {
        const f = this.firedAt.get(id) ?? Number.NEGATIVE_INFINITY;
        const h = this.hurtAt.get(id) ?? Number.NEGATIVE_INFINITY;
        return now - f <= REVEAL || now - h <= REVEAL;
    }

    onShotFired(shooter: Player): void {
        const { game, byId } = this.ctx;
        const now = game.time;
        this.firedAt.set(shooter.id, now);
        const bot = byId.get(shooter.id);
        const r3 = this.r3(shooter.id);
        if (!bot || !r3) return;
        const tr = this.track(shooter.id);
        const tid = bot.bot.intent.targetId;
        if (!tid && tr.unseen && !tr.unseen.weapon) tr.unseen.weapon = "return";
        // fire at the cloud (smokeFight.ts sprays with no target id) or at the target while it hides in it
        const sm = tr.smoke ? game.getPlayer(tr.smoke.target) : undefined;
        if (tr.smoke && sm && (!tid || tid === sm.id) && game.smokes.contains(sm.pos, sm.layer)) {
            tr.smoke.shots++;
            r3.smokeShots++;
        }
        const t = tid ? game.getPlayer(tid) : undefined;
        if (!t || t.dead || t.teamId === shooter.teamId) return;
        if (!underCanopy(bot.bot.model, t.pos, t.layer)) return;
        r3.canopyShots++;
        let last = this.lastShotAt.get(shooter.id);
        if (!last) this.lastShotAt.set(shooter.id, (last = new Map()));
        if (now - (last.get(t.id) ?? Number.NEGATIVE_INFINITY) > ENGAGEMENT_GAP) r3.canopyFirstShots++;
        last.set(t.id, now);
    }

    onPlayerDamaged(target: Player, params: DamageParams, amount: number): void {
        const { game, byId, roofs } = this.ctx;
        const now = game.time;
        if (params.sourceId) this.hurtAt.set(target.id, now);
        const bot = byId.get(target.id);
        const r3 = this.r3(target.id);
        if (bot && r3) {
            const tr = this.track(target.id);
            if (tr.unseen) r3.unseenDamage += amount;
            const shooter = params.sourceId ? game.getPlayer(params.sourceId) : undefined;
            if (
                shooter &&
                !params.isExplosion &&
                shooter.teamId !== target.teamId &&
                gunInfo(params.gameSourceType ?? "")
            )
                if (humanSight(game, roofs, bot, target, shooter) !== "visible")
                    this.stimulus(target.id, shooter.id, now);
        }
        // a hit on a target hiding in smoke, by the bot that shot into it
        const src = params.sourceId ? byId.get(params.sourceId) : undefined;
        const sr3 = params.sourceId ? this.r3(params.sourceId) : undefined;
        const sm = src ? this.tracks.get(src.playerId)?.smoke : undefined;
        if (
            sr3 &&
            sm &&
            sm.target === target.id &&
            !params.isExplosion &&
            gunInfo(params.gameSourceType ?? "") &&
            game.smokes.contains(target.pos, target.layer)
        )
            sr3.smokeHits++;
    }

    private stimulus(botId: number, shooterId: number, now: number): void {
        const r3 = this.r3(botId);
        if (!r3) return;
        const tr = this.track(botId);
        if (!tr.unseen) {
            r3.unseenEpisodes++;
            tr.unseen = {
                start: now,
                last: now,
                shooter: shooterId,
                move: "",
                weapon: "",
                reactedAt: -1,
                spotted: false,
            };
        }
        tr.unseen.last = now;
        tr.unseen.shooter = shooterId;
    }

    tick(): void {
        const tick = this.ctx.game.tick;
        if (tick % SAMPLE.events === 0) this.nearMisses();
        if (tick % SAMPLE.state === 0) this.episodes();
        if (tick % SAMPLE.slow === 0) this.samples();
    }

    /** Close bullets from a shooter the bot cannot see (the bot's own near-miss record, judged on true positions). */
    private nearMisses(): void {
        const { game, roofs } = this.ctx;
        for (const { bot, p } of livingBots(this.ctx)) {
            const uf = bot.bot.model.underFire;
            const tr = this.track(p.id);
            if (!uf || uf.time <= tr.underFireAt) continue;
            tr.underFireAt = uf.time;
            const shooter = game.getPlayer(uf.shooterId);
            if (!shooter || shooter.dead || shooter.teamId === p.teamId) continue;
            if (humanSight(game, roofs, bot, p, shooter) !== "visible") this.stimulus(p.id, shooter.id, game.time);
        }
    }

    /** Unseen-fire reactions, smoke stand-offs, lost targets and outfits (every 0.1 s). */
    private episodes(): void {
        const { game, roofs } = this.ctx;
        const now = game.time;
        for (const { bot, p } of livingBots(this.ctx)) {
            const r3 = this.r3(p.id);
            if (!r3) continue;
            const tr = this.track(p.id);
            const b = bot.bot;
            const it = b.intent;
            const mem = b.brain.mem;
            // outfits
            if (tr.outfit && p.outfit !== tr.outfit) {
                r3.outfitSwaps++;
                const seen = [...b.model.contacts.values()].some(
                    (c) => c.visible && !c.teammate && !c.dead && !c.downed,
                );
                const lastThreat = (mem.loot2 as { lastThreat?: number }).lastThreat ?? Number.NEGATIVE_INFINITY;
                if (seen || p.health < 60 || now - lastThreat < 5) r3.outfitUnsafe++;
            }
            tr.outfit = p.outfit;
            if (p.downed) continue;
            if (it.behaviour === "fight" && it.targetId) tr.lastTarget = { id: it.targetId, at: now };
            this.unseenStep(bot, r3, tr, now);
            this.smokeStep(bot, p, r3, tr, now);
            // lost targets: the fight target as the bot last saw it
            if (it.behaviour === "fight" && it.targetId) {
                const t = game.getPlayer(it.targetId);
                if (t && !t.dead && humanSight(game, roofs, bot, p, t) === "visible") {
                    const held = p.weaponManager.weapons[p.weaponManager.curWeapIdx]?.type ?? "";
                    const reach = gunInfo(held)?.range ?? 0;
                    tr.seen = {
                        id: t.id,
                        at: now,
                        armed: usableGuns(t).length > 0,
                        inReach: v2.distance(p.pos, t.pos) <= Math.min(reach, CONCEAL_RANGE),
                    };
                }
            }
            this.lostStep(bot, p, r3, tr, now);
        }
    }

    private unseenStep(bot: BotController, r3: Round3Bot, tr: Track, now: number): void {
        const ep = tr.unseen;
        if (!ep) return;
        const mem = bot.bot.brain.mem;
        const evade = (mem.pursuit as { evade?: { style: string; since: number; noticeAt: number } | null }).evade;
        const unseen = (mem.fight as { unseen?: { choice: string; since: number } | null }).unseen;
        if (!ep.move && evade && evade.since >= ep.start - 0.5) {
            ep.move = evade.style;
            const at = Math.max(evade.noticeAt, evade.since);
            if (ep.reactedAt < 0 || at < ep.reactedAt) ep.reactedAt = at;
        }
        if (!ep.weapon && unseen && unseen.since >= ep.start - 0.5 && unseen.choice !== "evade") {
            ep.weapon = unseen.choice;
            if (ep.reactedAt < 0 || unseen.since < ep.reactedAt) ep.reactedAt = unseen.since;
        }
        if (!ep.move && FLIGHT.has(bot.bot.intent.behaviour)) {
            ep.move = "flee";
            if (ep.reactedAt < 0) ep.reactedAt = now;
        }
        if (bot.bot.intent.targetId === ep.shooter) ep.spotted = true;
        if (now - ep.last > UNSEEN_QUIET || now - ep.start > UNSEEN_MAX) this.closeUnseen(r3, tr);
    }

    private closeUnseen(r3: Round3Bot, tr: Track, died = false): void {
        const ep = tr.unseen;
        if (!ep) return;
        tr.unseen = null;
        let key = `${ep.move || "none"}+${ep.weapon || "none"}`;
        if (key === "none+none" && ep.spotted) key = "spotted";
        r3.unseenReactions[key] = (r3.unseenReactions[key] ?? 0) + 1;
        if (ep.reactedAt >= 0) r3.unseenLatency.push(Math.round(Math.max(0, ep.reactedAt - ep.start) * 100) / 100);
        if (died) r3.unseenDeaths++;
    }

    private smokeStep(bot: BotController, p: Player, r3: Round3Bot, tr: Track, now: number): void {
        const { game } = this.ctx;
        const mem = bot.bot.brain.mem;
        const sm = (mem.fight as { smoke?: { target: number; choice: string } | null }).smoke;
        const th = bot.bot.throws.throws;
        const threw = th !== tr.throws;
        tr.throws = th;
        const ep = tr.smoke;
        if (ep) {
            const t = game.getPlayer(ep.target);
            const inSmoke = !!t && !t.dead && game.smokes.contains(t.pos, t.layer);
            if (inSmoke) ep.lastIn = now;
            if (!ep.choice && sm && sm.target === ep.target) ep.choice = sm.choice;
            if (!ep.choice && threw) ep.choice = "frag";
            if (!t || t.dead || now - ep.lastIn > SMOKE_GONE || now - ep.start > SMOKE_MAX) {
                const key = ep.choice || (ep.shots > 0 ? "shot" : "none");
                r3.smokeReactions[key] = (r3.smokeReactions[key] ?? 0) + 1;
                tr.smoke = null;
            }
            return;
        }
        const lt = tr.lastTarget;
        if (!lt || now - lt.at > 2 || !tr.seen || tr.seen.id !== lt.id || now - tr.seen.at > 2) return;
        const t = game.getPlayer(lt.id);
        if (!t || t.dead || t.downed || v2.distance(t.pos, p.pos) > CONCEAL_RANGE) return;
        if (!game.smokes.contains(t.pos, t.layer) || game.smokes.contains(p.pos, p.layer)) return;
        r3.smokeEpisodes++;
        tr.smoke = { target: t.id, start: now, lastIn: now, choice: "", shots: 0 };
    }

    private lostStep(bot: BotController, p: Player, r3: Round3Bot, tr: Track, now: number): void {
        const { game, roofs } = this.ctx;
        const ep = tr.lost;
        const beh = bot.bot.intent.behaviour;
        if (ep) {
            const t = game.getPlayer(ep.target);
            if (!t || t.dead || now - ep.lostAt > LOST_MAX) {
                tr.lost = null;
                return;
            }
            if (humanSight(game, roofs, bot, p, t) === "visible") {
                r3.lostFound++;
                r3.findTimes.push(Math.round((now - ep.lostAt) * 10) / 10);
                if (ep.searched) r3.lostFoundBySearch++;
                tr.lost = null;
                return;
            }
            if (beh === "search") {
                if (!ep.searched) r3.lostSearched++;
                ep.searching = ep.searched = true;
            } else if (ep.searching && !ep.gaveUp) {
                ep.searching = false;
                ep.gaveUp = true;
                r3.lostGaveUp++;
                r3.giveUpTimes.push(Math.round((now - ep.lostAt) * 10) / 10);
            }
            if (ep.searched && !ep.searching) tr.lost = null;
            return;
        }
        const s = tr.seen;
        if (!s || now - s.at < LOST_AFTER || now - s.at > LOST_AFTER + 0.2) return;
        const t = game.getPlayer(s.id);
        if (!t || t.dead || humanSight(game, roofs, bot, p, t) === "visible") return;
        r3.lostEpisodes++;
        const armed = s.armed && s.inReach;
        if (armed) r3.lostArmed++;
        tr.lost = { target: s.id, lostAt: s.at, armed, searching: false, searched: false, gaveUp: false };
        if (beh === "search") {
            tr.lost.searching = tr.lost.searched = true;
            r3.lostSearched++;
        }
    }

    /** Concealment, cover in fights, the unseen shooter's line of fire, frag chances (every 0.5 s). */
    private samples(): void {
        const { game, roofs } = this.ctx;
        const now = game.time;
        const dt = SAMPLE.slow / 100;
        const players = [...game.players()].filter((q) => !q.dead && !q.downed);
        for (const { bot, p } of livingBots(this.ctx)) {
            const r3 = this.r3(p.id);
            if (!r3 || p.downed) continue;
            const tr = this.track(p.id);
            const b = bot.bot;
            const it = b.intent;
            const held = p.weaponManager.weapons[p.weaponManager.curWeapIdx]?.type ?? "";
            const gi = gunInfo(held);
            const range = gi ? Math.min(gi.range, CONCEAL_RANGE) : 0;
            let enemyOnScreen = false;
            for (const q of players) {
                if (q === p || q.teamId === p.teamId || !onHumanScreen(p.pos, p.zoom, q.pos, BODY_SLACK)) continue;
                if (!sameLayer(p.layer, q.layer) || roofs.hides(p.pos, q.pos) || game.hiddenInSmoke(p, q)) continue;
                const bush = concealed(b.model, q.pos, q.layer);
                if (!bush) enemyOnScreen = true;
                if (!range || v2.distance(p.pos, q.pos) > range || this.revealed(q.id, now)) continue;
                if (!b.model.lineOfFire(p.pos, q.pos)) continue;
                const kind = bush ? "bush" : underCanopy(b.model, q.pos, q.layer) ? "canopy" : "open";
                const c = r3.conceal[kind];
                c.samples++;
                // the trigger actually down at it (the intent of the last decision can be a few snapshots old: the bot
                // holds fire at a target that just walked under a bush, bot.ts fireHolds)
                if (it.fire && it.targetId === q.id && (p.input.shootStart || p.input.shootHold)) c.fire++;
            }
            if (enemyOnScreen && (p.inv.get("frag") > 0 || p.inv.get("mirv") > 0)) r3.fragChanceSeconds += dt;
            // cover in fights
            const t = it.behaviour === "fight" && it.targetId ? game.getPlayer(it.targetId) : undefined;
            if (t && !t.dead && !t.downed && sameLayer(p.layer, t.layer) && v2.distance(p.pos, t.pos) < 60) {
                r3.coverSamples++;
                if (!bodyLineOfFire(bot, t.pos, p.pos)) r3.coverHidden++;
                for (const o of b.model.obstacles) {
                    if (!o.blocksBullets || o.view.dead) continue;
                    if (distanceToCollider(p.pos, o.col) > COVER_NEAR) continue;
                    if (segmentHitsCollider(o.col, p.pos, t.pos)) {
                        r3.coverNear++;
                        break;
                    }
                }
            }
            // during unseen fire: out of the true shooter's line of fire
            const ep = tr.unseen;
            const shooter = ep ? game.getPlayer(ep.shooter) : undefined;
            if (ep && shooter && !shooter.dead) {
                r3.unseenSamples++;
                if (!bodyLineOfFire(bot, shooter.pos, p.pos)) r3.unseenSafeSamples++;
            }
        }
    }

    /** A bot died, or the match ended: close its open episodes. */
    close(id: number, died: boolean): void {
        const tr = this.tracks.get(id);
        const r3 = this.r3(id);
        if (!tr || !r3) return;
        this.closeUnseen(r3, tr, died);
        if (tr.smoke) {
            const key = tr.smoke.choice || (tr.smoke.shots > 0 ? "shot" : "none");
            r3.smokeReactions[key] = (r3.smokeReactions[key] ?? 0) + 1;
        }
        this.tracks.delete(id);
    }
}
