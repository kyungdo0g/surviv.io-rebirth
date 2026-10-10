// Early deaths in population matches (owner, 2026-10-08: "they die en masse from the very start: I ran 200 players and
// before long it was down to 40"). One classic solo match on the main map with the server's skill tiers and personas
// and the normal gas; a read-only probe records:
// - the alive count every 15 s and at every gas stage change;
// - every death: time, cause (fists, another melee weapon, the gun's class, gas, explosion, ...), the killer's and the
//   victim's armed state (a gun with ammo in a gun slot) and what each was doing (the brain's behaviour, a fist rush in
//   the last 3 s, a fist fight between two unarmed players);
// - fist rush episodes (an unarmed bot in the "rush" behaviour on one target) and fist duels (an unarmed bot in the
//   "fight" behaviour on an unarmed target) and how they ended;
// - density: the nearest other player at the first think and the players within 20 / 40 u at 10 s and 30 s.
// Used by scripts/earlyDeaths.ts (worker threads, markdown table).
import { v2 } from "@rebirth/core";
import { GameObjectDefs, gunClass, hasDef, WeaponSlot } from "@rebirth/defs";
import type { DamageParams, Game, Player } from "@rebirth/sim";
import { BRAIN_PRESETS, type BrainFeature, type BrainFeatures } from "../src/brain/features.ts";
import type { BotController } from "../src/controller.ts";
import { gunInfo } from "../src/knowledge/weapons.ts";
import { type MatchProbe, runMatch } from "../src/runner.ts";

export interface DeathRow {
    /** game seconds */
    t: number;
    cause: string;
    victimArmed: boolean;
    /** a gun with rounds in the magazine in the victim's hands */
    victimGunOut: boolean;
    killerArmed: boolean | null;
    victimBeh: string;
    killerBeh: string;
    victimRushing: boolean;
    killerRushing: boolean;
    victimPersona: string;
    killerPersona: string;
    victimTier: string;
    killerTier: string;
    /** where the victim died, its id and its killer's (0: none), the weapon or map object that dealt the blow */
    x: number;
    y: number;
    victimId: number;
    killerId: number;
    src: string;
    /** the killer dealt the first hit of their exchange; seconds from that hit; distance and victim behaviour then */
    killerStarted: boolean | null;
    engageSecs: number;
    startDist: number;
    victimBehAtStart: string;
}

/** An armed bot started fighting a target (first 150 s): why it could have, and the scores it chose from. */
export interface FightStart {
    t: number;
    dist: number;
    targetArmed: boolean;
    /** the target was fighting or rushing this bot already */
    mutual: boolean;
    /** the bot was hit or shot at in the last 3 s */
    hurt: boolean;
    persona: string;
    tier: string;
    fight: number;
    loot: number;
    /** the behaviour it left */
    from: string;
}

/** Two standing players first within ENCOUNTER_DIST of each other (first 150 s), and what came of it within 10 s. */
export interface Encounter {
    t: number;
    /** armed players among the two (0, 1, 2) */
    armed: number;
    /** a hit between them within ENCOUNTER_WINDOW; one of them killed by the other within it */
    hit: boolean;
    kill: boolean;
}

/** Exchanges of hits between two players (a new one after 30 s without a hit): when, who, and whether one died. */
export interface Exchange {
    start: number;
    dist: number;
    targetBeh: string;
    /** the first hitter's and its target's armed state */
    byArmed: boolean;
    targetArmed: boolean;
    /** "starterKilled" (the first hitter killed the other), "starterDied", "none" */
    outcome: string;
    /**
     * the first hitter's side at its first hit: its behaviour, whether it hunted (earlyPace), whether the target had
     * hurt it or shot at it in the last 6 s, and whether the target hunted
     */
    byBeh?: string;
    byHunting?: boolean;
    byProvoked?: boolean;
    targetHunting?: boolean;
    /** the first hitter aimed at this target (its intent's target), and seconds since the target last provoked it */
    byAimed?: boolean;
    byProvokedAgo?: number;
}

export interface Episode {
    start: number;
    end: number;
    /** "rusherDied" / "targetDied" (by the episode's other side) / "otherDied" / "armed" / "brokeOff" / "open" */
    outcome: string;
    /** got within 3 u of the target */
    reached: boolean;
    /** the rusher's persona and the target's held gun class (rushes) */
    persona: string;
    gun: string;
}

export interface MatchResult {
    seed: number;
    bots: number;
    /** [game seconds, alive] every 15 s */
    alive: Array<[number, number]>;
    /** [game seconds, stage, alive] at every gas stage change */
    stages: Array<[number, number, number]>;
    deaths: DeathRow[];
    rushes: Episode[];
    duels: Episode[];
    exchanges: Exchange[];
    fightStarts: FightStart[];
    encounters: Encounter[];
    /** bullets fired and bullets that hit a player in the first 120 s (armed bots' accuracy) */
    shots: { bullets: number; hits: number };
    /** game second each bot first held a gun with ammo (-1: never, dead unarmed or still unarmed at the end) */
    armedAt: number[];
    /** nearest other player at the first think (spawn spread), and players within 20 / 40 u at 10 s and 30 s */
    spawnNearest: number[];
    near: Record<string, number[]>;
    /** per-second shares of unarmed bots' behaviours in the first 120 s */
    unarmedBeh: Record<string, number>;
    gameSeconds: number;
    over: boolean;
    winner: number;
}

const ALIVE_STEP = 15;
const SAMPLE_TICKS = 5;
const RUSH_RECENT = 3;
const REACH = 3;
/** an episode ends once its behaviour has been off this long */
const EPISODE_GAP = 1;
/** hits between the same two players this far apart start a new exchange */
const PAIR_GAP = 30;
/** two players this close meet (an encounter), judged over the next ENCOUNTER_WINDOW seconds */
const ENCOUNTER_DIST = 15;
const ENCOUNTER_WINDOW = 10;
const ENCOUNTER_UNTIL = 150;

function armedP(p: Player): boolean {
    const w = p.weaponManager.weapons;
    for (const slot of [WeaponSlot.Primary, WeaponSlot.Secondary]) {
        const s = w[slot];
        const info = s?.type ? gunInfo(s.type) : undefined;
        if (!s || !info || info.score <= 0) continue;
        if (s.ammo > 0 || (p.inventory[info.ammo] ?? 0) > 0) return true;
    }
    return false;
}

function gunOut(p: Player): boolean {
    const idx = p.weaponManager.curWeapIdx;
    if (idx !== WeaponSlot.Primary && idx !== WeaponSlot.Secondary) return false;
    const s = p.weaponManager.weapons[idx];
    return !!s?.type && !!gunInfo(s.type) && s.ammo > 0;
}

/** The cause of a death: fists, another melee, the gun class, gas, bleed, explosion, airdrop, airstrike, other. */
export function causeOf(params: DamageParams): string {
    switch (params.damageType) {
        case 2:
            return "gas";
        case 1:
            return "bleed";
        case 3:
            return "airdrop";
        case 4:
            return "airstrike";
    }
    const id = params.gameSourceType ?? "";
    if (id && hasDef(id)) {
        const type = GameObjectDefs[id].type;
        if (type === "melee") return id === "fists" ? "fists" : "melee";
        if (type === "gun") return `gun:${gunClass(id) ?? "other"}`;
        if (type === "throwable" || type === "explosion") return "explosion";
    }
    if (params.mapSourceType) return "explosion";
    return "other";
}

interface Open {
    bot: number;
    target: number;
    start: number;
    last: number;
    reached: boolean;
    persona: string;
    gun: string;
}

class EarlyDeathProbe implements MatchProbe {
    readonly name = "earlyDeaths";
    readonly result: Omit<MatchResult, "seed" | "bots" | "gameSeconds" | "over" | "winner"> = {
        alive: [],
        stages: [],
        deaths: [],
        rushes: [],
        duels: [],
        exchanges: [],
        fightStarts: [],
        encounters: [],
        shots: { bullets: 0, hits: 0 },
        armedAt: [],
        spawnNearest: [],
        near: { "20@10": [], "40@10": [], "20@30": [], "40@30": [] },
        unarmedBeh: {},
    };
    private byId = new Map<number, BotController>();
    private lastRush = new Map<number, number>();
    private openRush = new Map<number, Open>();
    private openDuel = new Map<number, Open>();
    private lastStage = -1;
    private firstArmed = new Map<number, number>();
    private lastFight = new Map<number, { target: number; beh: string }>();
    private nextAlive = 0;
    private nearDone = new Set<number>();
    private spawnDone = false;

    private pairs = new Map<string, Exchange & { by: number; last: number }>();
    private met = new Map<string, Encounter>();

    readonly observer = {
        onShotFired: (_shooter: Player, _weapon: string, bullets: readonly unknown[]) => {
            if ((this.game?.time ?? 0) < 120) this.result.shots.bullets += bullets.length;
        },
        onBulletHitPlayer: () => {
            if ((this.game?.time ?? 0) < 120) this.result.shots.hits++;
        },
        onPlayerDamaged: (target: Player, params: DamageParams, amount: number) => {
            const src = params.sourceId ? this.game?.getPlayer(params.sourceId) : undefined;
            if (!src || src === target || params.damageType !== 0 || amount <= 0) return;
            const now = this.game?.time ?? 0;
            const key = src.id < target.id ? `${src.id}:${target.id}` : `${target.id}:${src.id}`;
            const m = this.met.get(key);
            if (m && now - m.t < ENCOUNTER_WINDOW) m.hit = true;
            const old = this.pairs.get(key);
            if (old && now - old.last < PAIR_GAP) {
                old.last = now;
                return;
            }
            if (old) this.result.exchanges.push(plain(old));
            this.pairs.set(key, {
                start: now,
                last: now,
                by: src.id,
                dist: v2.distance(src.pos, target.pos),
                targetBeh: this.byId.get(target.id)?.bot.intent.behaviour ?? "",
                byArmed: armedP(src),
                targetArmed: armedP(target),
                outcome: "none",
                ...this.starterSide(src.id, target.id, now),
            });
        },
        onPlayerKilled: (victim: Player, params: DamageParams, _credit: Player | undefined) => {
            const now = this.game?.time ?? 0;
            const killer = params.sourceId ? this.game?.getPlayer(params.sourceId) : undefined;
            const vb = this.byId.get(victim.id);
            const kb = killer && killer !== victim ? this.byId.get(killer.id) : undefined;
            const recent = (id: number) => now - (this.lastRush.get(id) ?? Number.NEGATIVE_INFINITY) < RUSH_RECENT;
            const kid = killer && killer !== victim ? killer.id : 0;
            const key = kid < victim.id ? `${kid}:${victim.id}` : `${victim.id}:${kid}`;
            const ex = kid ? this.pairs.get(key) : undefined;
            const enc = kid ? this.met.get(key) : undefined;
            if (enc && now - enc.t < ENCOUNTER_WINDOW) enc.kill = true;
            if (ex) {
                ex.outcome = ex.by === kid ? "starterKilled" : "starterDied";
                this.result.exchanges.push(plain(ex));
                this.pairs.delete(key);
            }
            this.result.deaths.push({
                t: now,
                cause: causeOf(params),
                victimArmed: armedP(victim),
                victimGunOut: gunOut(victim),
                killerArmed: killer && killer !== victim ? armedP(killer) : null,
                victimBeh: vb?.bot.intent.behaviour ?? "",
                killerBeh: kb?.bot.intent.behaviour ?? "",
                victimRushing: recent(victim.id),
                killerRushing: kb ? recent(kb.playerId) : false,
                victimPersona: vb?.bot.persona.name ?? "",
                killerPersona: kb?.bot.persona.name ?? "",
                victimTier: vb?.bot.skill.tier ?? "",
                killerTier: kb?.bot.skill.tier ?? "",
                x: Math.round(victim.pos.x * 10) / 10,
                y: Math.round(victim.pos.y * 10) / 10,
                victimId: victim.id,
                killerId: kid,
                src: params.gameSourceType || params.mapSourceType || "",
                killerStarted: ex ? ex.by === kid : null,
                engageSecs: ex ? now - ex.start : -1,
                startDist: ex ? ex.dist : -1,
                victimBehAtStart: ex ? (ex.by === kid ? ex.targetBeh : "(started it)") : "",
            });
            this.closeFor(victim.id, killer?.id ?? 0, now);
        },
    };
    private game: Game | null = null;

    start(game: Game, bots: readonly BotController[]): void {
        this.game = game;
        for (const b of bots) this.byId.set(b.playerId, b);
    }

    tick(game: Game, bots: readonly BotController[]): void {
        const now = game.time;
        if (game.gas.stage !== this.lastStage) {
            this.lastStage = game.gas.stage;
            this.result.stages.push([now, game.gas.stage, game.aliveCount]);
        }
        if (now >= this.nextAlive) {
            this.result.alive.push([Math.round(now), game.aliveCount]);
            this.nextAlive += ALIVE_STEP;
        }
        if (game.tick % SAMPLE_TICKS !== 0) return;
        const living: Player[] = [];
        for (const b of bots) {
            const p = game.getPlayer(b.playerId);
            if (p && !p.dead) living.push(p);
        }
        if (!this.spawnDone && now > 0.5) {
            this.spawnDone = true;
            for (const p of living) this.result.spawnNearest.push(nearest(p, living));
        }
        if (now < ENCOUNTER_UNTIL) this.noteEncounters(living, now);
        for (const at of [10, 30]) {
            if (now < at || this.nearDone.has(at)) continue;
            this.nearDone.add(at);
            for (const p of living) {
                let n20 = 0;
                let n40 = 0;
                for (const q of living) {
                    if (q === p) continue;
                    const d = v2.distance(p.pos, q.pos);
                    if (d < 20) n20++;
                    if (d < 40) n40++;
                }
                this.result.near[`20@${at}`].push(n20);
                this.result.near[`40@${at}`].push(n40);
            }
        }
        for (const b of bots) {
            const p = game.getPlayer(b.playerId);
            if (!p || p.dead) continue;
            const intent = b.bot.intent;
            const armed = armedP(p);
            if (armed && !this.firstArmed.has(p.id)) this.firstArmed.set(p.id, now);
            if (!armed && now < 120) {
                const k = intent.behaviour;
                this.result.unarmedBeh[k] = (this.result.unarmedBeh[k] ?? 0) + SAMPLE_TICKS / 100;
            }
            const target = intent.targetId ? game.getPlayer(intent.targetId) : undefined;
            this.noteFightStart(b, p, target, armed, now);
            if (intent.behaviour === "rush" && target && !target.dead) {
                this.lastRush.set(p.id, now);
                this.track(this.openRush, p, target, now, b, true);
            } else if (intent.behaviour === "fight" && !armed && target && !target.dead && !armedP(target)) {
                this.track(this.openDuel, p, target, now, b, false);
            }
            if (armed) {
                this.end(this.openRush, p.id, now, "armed");
                this.end(this.openDuel, p.id, now, "armed");
            }
        }
        for (const [map, out] of [
            [this.openRush, this.result.rushes],
            [this.openDuel, this.result.duels],
        ] as const) {
            for (const [id, o] of map) {
                if (now - o.last > EPISODE_GAP) {
                    out.push(episode(o, "brokeOff"));
                    map.delete(id);
                }
            }
        }
    }

    private noteEncounters(living: readonly Player[], now: number): void {
        for (let i = 0; i < living.length; i++) {
            const a = living[i];
            if (a.downed) continue;
            for (let j = i + 1; j < living.length; j++) {
                const b = living[j];
                if (b.downed || v2.distance(a.pos, b.pos) >= ENCOUNTER_DIST) continue;
                const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
                if (this.met.has(key)) continue;
                const e: Encounter = {
                    t: now,
                    armed: (armedP(a) ? 1 : 0) + (armedP(b) ? 1 : 0),
                    hit: false,
                    kill: false,
                };
                this.met.set(key, e);
                this.result.encounters.push(e);
            }
        }
    }

    /** Exchange.byBeh .. targetHunting (see there). */
    private starterSide(by: number, target: number, now: number): Partial<Exchange> {
        const b = this.byId.get(by);
        if (!b) return {};
        const m = b.bot.model;
        const uf = m.underFire;
        const c = m.contacts.get(target);
        return {
            byBeh: b.bot.intent.behaviour,
            byHunting: b.bot.brain.mem.early.hunting,
            byProvoked:
                (now - m.lastHurt < 6 && (!c || v2.distance(c.pos, m.self.pos) < 8)) ||
                (!!uf && uf.shooterId === target && now - uf.time < 6) ||
                (!!c && now - c.lastShotAt < 2),
            targetHunting: this.byId.get(target)?.bot.brain.mem.early.hunting ?? false,
            byAimed: b.bot.intent.targetId === target,
            byProvokedAgo: now - (b.bot.brain.mem.early.provoked.get(target) ?? Number.NEGATIVE_INFINITY),
        };
    }

    private noteFightStart(b: BotController, p: Player, t: Player | undefined, armed: boolean, now: number): void {
        const intent = b.bot.intent;
        const prev = this.lastFight.get(p.id);
        const fighting = intent.behaviour === "fight" && !!t && !t.dead;
        this.lastFight.set(p.id, { target: fighting && t ? t.id : 0, beh: intent.behaviour });
        if (!fighting || !t || !armed || now > 150 || prev?.target === t.id) return;
        const tb = this.byId.get(t.id);
        const ti = tb?.bot.intent;
        const m = b.bot.model;
        const scores = b.bot.brain.lastScores;
        this.result.fightStarts.push({
            t: now,
            dist: v2.distance(p.pos, t.pos),
            targetArmed: armedP(t),
            mutual: !!ti && ti.targetId === p.id && (ti.behaviour === "fight" || ti.behaviour === "rush"),
            hurt: now - m.lastHurt < 3 || (!!m.underFire && now - m.underFire.time < 3),
            persona: b.bot.persona.name,
            tier: b.bot.skill.tier,
            fight: scores.fight ?? 0,
            loot: Math.max(scores.loot ?? 0, scores.break ?? 0, scores.sweep ?? 0),
            from: prev?.beh ?? "",
        });
    }

    private track(map: Map<number, Open>, p: Player, t: Player, now: number, b: BotController, rush: boolean): void {
        let o = map.get(p.id);
        if (o && o.target !== t.id) {
            (rush ? this.result.rushes : this.result.duels).push(episode(o, "brokeOff"));
            map.delete(p.id);
            o = undefined;
        }
        if (!o) {
            const held = t.weaponManager.weapons[t.weaponManager.curWeapIdx]?.type ?? "";
            o = {
                bot: p.id,
                target: t.id,
                start: now,
                last: now,
                reached: false,
                persona: b.bot.persona.name,
                gun: gunClass(held) ?? (held ? "melee" : "?"),
            };
            map.set(p.id, o);
        }
        o.last = now;
        if (v2.distance(p.pos, t.pos) < REACH) o.reached = true;
    }

    private end(map: Map<number, Open>, id: number, now: number, outcome: string): void {
        const o = map.get(id);
        if (!o) return;
        o.last = now;
        (map === this.openRush ? this.result.rushes : this.result.duels).push(episode(o, outcome));
        map.delete(id);
    }

    /** `victim` died (killed by `killer`, 0 for none): the episodes it was in end. */
    private closeFor(victim: number, killer: number, now: number): void {
        for (const map of [this.openRush, this.openDuel]) {
            for (const [id, o] of map) {
                if (o.bot === victim) this.end(map, id, now, o.target === killer ? "rusherDied" : "otherDied");
                else if (o.target === victim) this.end(map, id, now, killer === o.bot ? "targetDied" : "otherDied");
            }
        }
    }

    finishOpen(ids: readonly number[]): void {
        for (const id of ids) this.result.armedAt.push(this.firstArmed.get(id) ?? -1);
        for (const ex of this.pairs.values()) this.result.exchanges.push(plain(ex));
        this.pairs.clear();
        for (const [map, out] of [
            [this.openRush, this.result.rushes],
            [this.openDuel, this.result.duels],
        ] as const) {
            for (const o of map.values()) out.push(episode(o, "open"));
            map.clear();
        }
    }
}

function plain(e: Exchange & { by: number; last: number }): Exchange {
    return {
        start: e.start,
        dist: e.dist,
        targetBeh: e.targetBeh,
        byArmed: e.byArmed,
        targetArmed: e.targetArmed,
        outcome: e.outcome,
        byBeh: e.byBeh,
        byHunting: e.byHunting,
        byProvoked: e.byProvoked,
        targetHunting: e.targetHunting,
        byAimed: e.byAimed,
        byProvokedAgo: Number.isFinite(e.byProvokedAgo) ? e.byProvokedAgo : -1,
    };
}

function episode(o: Open, outcome: string): Episode {
    return { start: o.start, end: o.last, outcome, reached: o.reached, persona: o.persona, gun: o.gun };
}

function nearest(p: Player, all: readonly Player[]): number {
    let best = Number.POSITIVE_INFINITY;
    for (const q of all) if (q !== p) best = Math.min(best, v2.distance(p.pos, q.pos));
    return best;
}

export interface EarlyDeathTask {
    seed: number;
    bots: number;
    /** smart features turned off for every bot (ablations) */
    off?: BrainFeature[];
    /** stop after this many game seconds (default: the whole match, at most 15 minutes) */
    seconds?: number;
}

export function runEarlyDeathMatch(task: EarlyDeathTask): MatchResult {
    const probe = new EarlyDeathProbe();
    const features = { ...BRAIN_PRESETS.smart } as BrainFeatures;
    for (const f of task.off ?? []) features[f] = false;
    const report = runMatch({
        seed: task.seed,
        bots: task.bots,
        difficulty: "population",
        population: { personas: true },
        maxTicks: Math.round((task.seconds ?? 900) * 100),
        brainFeatures: { smart: Object.freeze(features) },
        probes: [probe],
    });
    probe.finishOpen(report.players.map((p) => p.id));
    return {
        seed: task.seed,
        bots: task.bots,
        ...probe.result,
        gameSeconds: report.gameSeconds,
        over: report.over,
        winner: report.winners[0] ?? 0,
    };
}
