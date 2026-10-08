// Population metrics of the bot interactions (BrainFeatures.doors and BrainFeatures.puzzles): one full match per seed
// and flag setting on a map (main by default), every bot on the default brain with both flags on, or both off (the rest
// of the smart preset unchanged), the server's skill-tier mix and personas. A read-only probe (runner.ts MatchProbe)
// watches the game and the bots:
// - puzzles: a bot attempted a site (brain/puzzleSites.ts: code puzzles, switches, control panels, vault doors) when
//   its puzzle memory reached the "press" stage there (distinct bot and site); a bot solved it when the site's doors
//   opened while it worked the site (press or wait stage); doors that opened while no bot worked the site (a vault
//   door the path follower opened on its way, say) count apart;
// - rooms: a site's room behind the doors counts as looted when a container in it was broken after the doors opened;
// - doors: hand doors (not automatic ones) switching from closed to open and back, in the game; the closes behind
//   (DoorBrain.closes) and the door alerts (each new DoorBrain.alert, "heard" ones apart) of the bots;
// - air drops: shells (defs airdropCrate) seen in the game, used (button used up, kill ticker running, or gone), and
//   the inner crate left in their place broken;
// - the match: stuck events (path follower), deaths and gas deaths, bot tick p50 / p99 of the default brain (ms).
import { type Vec2, v2 } from "@rebirth/core";
import { GameConfig, type GasStage } from "@rebirth/defs";
import type { Game } from "@rebirth/sim";
import { BRAIN_PRESETS, type BrainFeatures, DEFAULT_BRAIN } from "../src/brain/features.ts";
import { type PuzzleSite, puzzleSites } from "../src/brain/puzzleSites.ts";
import type { BotController } from "../src/controller.ts";
import type { SkillTierName } from "../src/difficulty.ts";
import { type MatchProbe, runMatch } from "../src/runner.ts";

export type FlagSetting = "on" | "off";

export interface InteractionTask {
    seed: number;
    bots: number;
    flags: FlagSetting;
    map: string;
    /** gas stage durations divided by this (1: normal; the first stage keeps its length) */
    gasDiv: number;
    maxTicks: number;
}

export type TierCounts = Record<SkillTierName, number>;

export interface SiteCounts {
    attempted: number;
    solved: number;
    /** matches where its doors opened (by anyone) */
    opened: number;
    looted: number;
}

export interface InteractionResult {
    task: InteractionTask;
    ticks: number;
    gameSeconds: number;
    over: boolean;
    exceptions: number;
    errors: string[];
    bots: TierCounts;
    attempted: TierCounts;
    solved: TierCounts;
    /** sites whose doors opened while no bot worked them */
    openedElse: number;
    sites: Record<string, SiteCounts>;
    roomsLooted: number;
    roomContainersBroken: number;
    doorsOpened: number;
    doorsClosed: number;
    closedBehind: number;
    doorAlerts: number;
    doorAlertsHeard: number;
    airdropsSeen: number;
    airdropsOpened: number;
    airdropCratesBroken: number;
    stuckEvents: number;
    /** seconds alive summed over the bots */
    aliveSeconds: number;
    deaths: number;
    gasDeaths: number;
    botTickP50: number;
    botTickP99: number;
}

export const TIERS: readonly SkillTierName[] = ["beginner", "intermediate", "expert"];
export const tierCounts = (): TierCounts => ({ beginner: 0, intermediate: 0, expert: 0 });
/** Air drop shells are looked for this often (ticks); the doors and the bots are read every tick. */
const SCAN_TICKS = 10;
/** The inner crate stands where its shell stood. */
const INNER_NEAR = 1.5;

/** The default brain's preset with both interaction flags set (`on`) or cleared (`off`). */
export function interactionFeatures(flags: FlagSetting): Readonly<BrainFeatures> {
    const f = { ...BRAIN_PRESETS[DEFAULT_BRAIN] } as BrainFeatures;
    f.doors = flags === "on";
    f.puzzles = flags === "on";
    return Object.freeze(f);
}

/** The gas stages with every stage after the first `div` times shorter (undefined: the normal gas). */
export function gasStages(div: number): GasStage[] | undefined {
    if (div <= 1) return undefined;
    return GameConfig.gas.stages.map((st, i) => (i === 0 ? st : { ...st, duration: Math.max(1, st.duration / div) }));
}

function obstacle(game: Game, id: number) {
    const o = game.world.objects.get(id);
    return o?.kind === "obstacle" ? o : undefined;
}

interface SiteWatch {
    site: PuzzleSite;
    opened: boolean;
    /** containers of the rooms still standing when the doors opened */
    standing: Set<number>;
    broken: number;
}

interface Shell {
    pos: Vec2;
    used: boolean;
    /** obstacle id of the inner crate (0: not found yet) */
    inner: number;
    innerBroken: boolean;
}

class InteractionProbe implements MatchProbe {
    readonly name = "interactions";
    private readonly doorOpen = new Map<number, boolean>();
    private readonly sites: SiteWatch[] = [];
    private readonly attempts = new Set<string>();
    private readonly alerts = new Map<number, unknown>();
    private readonly shells = new Map<number, Shell>();
    readonly attempted = tierCounts();
    readonly solved = tierCounts();
    readonly siteCounts: Record<string, SiteCounts> = {};
    openedElse = 0;
    doorsOpened = 0;
    doorsClosed = 0;
    doorAlerts = 0;
    doorAlertsHeard = 0;
    closedBehind = 0;

    start(game: Game): void {
        for (const o of game.world.objects.values())
            if (o.kind === "obstacle" && o.door && !o.door.autoOpen) this.doorOpen.set(o.id, o.door.open);
        for (const site of puzzleSites(game.mapData)) {
            this.sites.push({ site, opened: false, standing: new Set(), broken: 0 });
            this.siteCounts[site.entry.building] ??= { attempted: 0, solved: 0, opened: 0, looted: 0 };
        }
    }

    tick(game: Game, bots: readonly BotController[]): void {
        for (const [id, was] of this.doorOpen) {
            const open = obstacle(game, id)?.door?.open;
            if (open === undefined || open === was) continue;
            this.doorOpen.set(id, open);
            if (open) this.doorsOpened++;
            else this.doorsClosed++;
        }
        for (const b of bots) {
            const pm = b.bot.brain.mem.puzzle;
            if (pm.site >= 0 && pm.stage === "press") {
                const key = `${b.playerId}:${pm.site}`;
                const s = this.sites[pm.site];
                if (!this.attempts.has(key) && s) {
                    this.attempts.add(key);
                    this.attempted[b.bot.skill.tier]++;
                    this.siteCounts[s.site.entry.building].attempted++;
                }
            }
            const alert = b.bot.brain.doors?.alert ?? null;
            if (alert && this.alerts.get(b.playerId) !== alert) {
                this.doorAlerts++;
                if (alert.kind === "heard") this.doorAlertsHeard++;
            }
            this.alerts.set(b.playerId, alert);
        }
        for (const w of this.sites) this.watchSite(game, bots, w);
        if (game.tick % SCAN_TICKS === 0) this.scanShells(game);
    }

    private watchSite(game: Game, bots: readonly BotController[], w: SiteWatch): void {
        if (w.opened) {
            for (const id of w.standing) {
                const o = obstacle(game, id);
                if (o && !o.dead) continue;
                w.standing.delete(id);
                w.broken++;
            }
            return;
        }
        if (!w.site.doors.some((d) => obstacle(game, d.id)?.door?.open)) return;
        const counts = this.siteCounts[w.site.entry.building];
        w.opened = true;
        counts.opened++;
        for (const room of w.site.rooms)
            for (const id of room.containers) if (obstacle(game, id)?.dead === false) w.standing.add(id);
        let credited = false;
        for (const b of bots) {
            const pm = b.bot.brain.mem.puzzle;
            if (pm.site !== w.site.index || (pm.stage !== "press" && pm.stage !== "wait")) continue;
            this.solved[b.bot.skill.tier]++;
            credited = true;
        }
        if (credited) counts.solved++;
        else this.openedElse++;
    }

    private scanShells(game: Game): void {
        const present = new Set<number>();
        for (const o of game.world.objects.values()) {
            if (o.kind !== "obstacle" || !o.def.airdropCrate) continue;
            present.add(o.id);
            let s = this.shells.get(o.id);
            if (!s) this.shells.set(o.id, (s = { pos: v2.copy(o.pos), used: false, inner: 0, innerBroken: false }));
            if (o.dead || o.killTicker > 0 || (o.button && !o.button.canUse)) s.used = true;
        }
        for (const [id, s] of this.shells) {
            if (!present.has(id)) s.used = true;
            if (!s.used || s.innerBroken) continue;
            if (s.inner) {
                if (!obstacle(game, s.inner) || obstacle(game, s.inner)?.dead) s.innerBroken = true;
                continue;
            }
            if (present.has(id) && obstacle(game, id)?.dead === false) continue;
            const box = { min: v2.sub(s.pos, { x: 2, y: 2 }), max: v2.add(s.pos, { x: 2, y: 2 }) };
            for (const o of game.world.grid.query(box)) {
                if (o.kind !== "obstacle" || o.def.airdropCrate || o.dead || !o.destructible) continue;
                if (v2.distance(o.pos, s.pos) < INNER_NEAR) s.inner = o.id;
            }
        }
    }

    finish(_game: Game, bots: readonly BotController[]): unknown {
        for (const w of this.sites) if (w.broken > 0) this.siteCounts[w.site.entry.building].looted++;
        this.closedBehind = bots.reduce((a, b) => a + (b.bot.brain.doors?.closes ?? 0), 0);
        return null;
    }

    get roomsLooted(): number {
        return this.sites.filter((w) => w.broken > 0).length;
    }

    get roomContainersBroken(): number {
        return this.sites.reduce((a, w) => a + w.broken, 0);
    }

    get shellList(): Shell[] {
        return [...this.shells.values()];
    }
}

/** Plays one match of the task and returns its interaction metrics. */
export function runInteractionMatch(task: InteractionTask, clock: () => number): InteractionResult {
    const probe = new InteractionProbe();
    const report = runMatch({
        mapName: task.map,
        seed: task.seed,
        bots: task.bots,
        difficulty: "population",
        population: { personas: true },
        brainFeatures: { [DEFAULT_BRAIN]: interactionFeatures(task.flags) },
        gasStages: gasStages(task.gasDiv),
        maxTicks: task.maxTicks,
        probes: [probe],
        clock,
    });
    const bots = tierCounts();
    for (const p of report.players) bots[p.tier]++;
    const timing = report.botTickMs[DEFAULT_BRAIN];
    const shells = probe.shellList;
    return {
        task,
        ticks: report.ticks,
        gameSeconds: report.gameSeconds,
        over: report.over,
        exceptions: report.exceptions,
        errors: report.errors,
        bots,
        attempted: probe.attempted,
        solved: probe.solved,
        openedElse: probe.openedElse,
        sites: probe.siteCounts,
        roomsLooted: probe.roomsLooted,
        roomContainersBroken: probe.roomContainersBroken,
        doorsOpened: probe.doorsOpened,
        doorsClosed: probe.doorsClosed,
        closedBehind: probe.closedBehind,
        doorAlerts: probe.doorAlerts,
        doorAlertsHeard: probe.doorAlertsHeard,
        airdropsSeen: shells.length,
        airdropsOpened: shells.filter((s) => s.used).length,
        airdropCratesBroken: shells.filter((s) => s.innerBroken).length,
        stuckEvents: report.stuckEvents,
        aliveSeconds: report.players.reduce((a, p) => a + p.timeAlive, 0),
        deaths: report.players.filter((p) => p.dead).length,
        gasDeaths: report.causes.gas ?? 0,
        botTickP50: timing?.p50 ?? 0,
        botTickP99: timing?.p99 ?? 0,
    };
}
