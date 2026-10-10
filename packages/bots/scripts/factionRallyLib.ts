// 50v50 river and rally probe (owner 2026-10-08: "most of the faction's bots stand in the river"; "most players go to
// the Commander, except some"). One 100-bot faction match on the faction map with every bot on the default brain and
// the server's population (skill tiers and the persona mix, apps/server/src/bots.ts), and a read-only probe that every
// half second notes for each standing bot whether it is in water (the sim's own test, World.isOnWater: rivers, lakes
// and the sea; bridges and docks are dry) and whether that water is the main river's (the front: the widest river's
// water polygon, sim mapgen/terrain.ts), whether it stood still there (moved under STILL_MOVE since the last sample),
// its behaviour (the brain's last intent) and the match phase; and every second, for each faction with a standing
// Commander, which standing members are within RALLY_NEAR of it, split into the bots that rally and the minority that
// keeps to itself (brain/factionRally.ts keepsToItself: the same draw as the bots', so a run of the code before the
// rally splits the same bots) and by persona, with the behaviours of the rallying bots that are not near it.
// Used by scripts/factionRally.ts (before / after numbers).
import type { Vec2 } from "@rebirth/core";
import { GameConfig, type GasStage } from "@rebirth/defs";
import type { Game } from "@rebirth/sim";
import { keepsToItself } from "../src/brain/factionRally.ts";
import type { BotController } from "../src/controller.ts";
import { type MatchProbe, type MatchReport, runMatch } from "../src/runner.ts";

/** Samples every this many ticks (100 Hz: half a second). */
const SAMPLE_TICKS = 50;
/** Rally samples every this many ticks (one second). */
const RALLY_TICKS = 100;
/** Moved less than this between two samples: standing still. */
const STILL_MOVE = 0.4;
/** Within this distance of the Commander counts as with it (task: 40 u). */
export const RALLY_NEAR = 40;
/** Phase bounds (game seconds): before the Commander (50 s), early, middle, late. */
export const PHASES: readonly [name: string, from: number][] = [
    ["0-50", 0],
    ["50-120", 50],
    ["120-240", 120],
    ["240-420", 240],
    ["420+", 420],
];

/** Quarter-speed gas after the first circle (test/helpers.ts QUICK_GAS). */
export const QUICK_GAS: GasStage[] = GameConfig.gas.stages.map((st, i) =>
    i === 0 ? st : { ...st, duration: Math.max(1, st.duration / 4) },
);

function phaseOf(t: number): string {
    let name = PHASES[0][0];
    for (const [n, from] of PHASES) if (t >= from) name = n;
    return name;
}

export interface WaterRow {
    /** standing bot-seconds */
    standing: number;
    /** of them in water */
    water: number;
    /** of them in water and standing still */
    still: number;
    /** of them in the main river's water, and standing still there */
    river?: number;
    riverStill?: number;
}

export interface RallyRow {
    /** member-samples of factions with a standing Commander (the Commander left out) */
    samples: number;
    /** of them within RALLY_NEAR of the Commander */
    near: number;
}

export interface RiverRallyResult {
    water: Record<string, WaterRow>;
    /** water seconds by behaviour (all phases) and still-in-water seconds by behaviour */
    waterBy: Record<string, number>;
    stillBy: Record<string, number>;
    rally: Record<string, RallyRow>;
    rallyByPersona: Record<string, RallyRow>;
    /** by phase: the members that rally (by the draw) and the minority that keeps to itself */
    rallying?: Record<string, RallyRow>;
    own?: Record<string, RallyRow>;
    /** member-seconds of rallying members farther than RALLY_NEAR from the Commander, by behaviour */
    farBy?: Record<string, number>;
    /** seconds a Commander stood (any faction) */
    commanderSeconds: number;
}

const add = (o: Record<string, number>, k: string, v: number) => {
    o[k] = (o[k] ?? 0) + v;
};

const count = (o: Record<string, RallyRow>, k: string, near: boolean) => {
    const r = (o[k] ??= { samples: 0, near: 0 });
    r.samples++;
    if (near) r.near++;
};

/** Even-odd point-in-polygon test (sim geom/polygon.ts, not exported). */
function inPolygon(p: Vec2, poly: readonly Vec2[]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i];
        const b = poly[j];
        if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
}

/** The read-only probe (see the header). */
export class RiverRallyProbe implements MatchProbe {
    readonly name = "riverRally";
    readonly water: Record<string, WaterRow> = {};
    readonly waterBy: Record<string, number> = {};
    readonly stillBy: Record<string, number> = {};
    readonly rally: Record<string, RallyRow> = {};
    readonly rallyByPersona: Record<string, RallyRow> = {};
    readonly rallying: Record<string, RallyRow> = {};
    readonly own: Record<string, RallyRow> = {};
    readonly farBy: Record<string, number> = {};
    commanderSeconds = 0;
    private readonly last = new Map<number, { x: number; y: number }>();
    private mainRiver: readonly Vec2[] | null | undefined;

    tick(game: Game, bots: readonly BotController[]): void {
        if (game.tick % SAMPLE_TICKS === 0) this.sampleWater(game, bots);
        if (game.tick % RALLY_TICKS === 0) this.sampleRally(game, bots);
    }

    /** The main river's water polygon: the widest open river of the terrain (null on a map without one). */
    private riverPoly(game: Game): readonly Vec2[] | null {
        if (this.mainRiver === undefined) {
            let best: { waterWidth: number; waterPoly: Vec2[] } | null = null;
            for (const r of game.world.terrain.rivers)
                if (!r.looped && (!best || r.waterWidth > best.waterWidth)) best = r;
            this.mainRiver = best?.waterPoly ?? null;
        }
        return this.mainRiver;
    }

    private sampleWater(game: Game, bots: readonly BotController[]): void {
        const dt = SAMPLE_TICKS / 100;
        const phase = phaseOf(game.time);
        const row = (this.water[phase] ??= { standing: 0, water: 0, still: 0, river: 0, riverStill: 0 });
        const poly = this.riverPoly(game);
        for (const b of bots) {
            const p = game.getPlayer(b.playerId);
            if (!p || p.dead || p.downed) {
                this.last.delete(b.playerId);
                continue;
            }
            const prev = this.last.get(b.playerId);
            this.last.set(b.playerId, { x: p.pos.x, y: p.pos.y });
            row.standing += dt;
            if (!game.world.isOnWater(p.pos, p.layer)) continue;
            const beh = b.bot.intent.behaviour;
            const still = !!prev && Math.hypot(p.pos.x - prev.x, p.pos.y - prev.y) < STILL_MOVE;
            const river = !!poly && inPolygon(p.pos, poly);
            row.water += dt;
            add(this.waterBy, beh, dt);
            if (river) row.river = (row.river ?? 0) + dt;
            if (still) {
                row.still += dt;
                add(this.stillBy, beh, dt);
                if (river) row.riverStill = (row.riverStill ?? 0) + dt;
            }
        }
    }

    private sampleRally(game: Game, bots: readonly BotController[]): void {
        const phase = phaseOf(game.time);
        const byId = new Map<number, BotController>();
        for (const b of bots) byId.set(b.playerId, b);
        const players = [...game.players()].filter((p) => !p.dead && !p.downed);
        for (const team of [1, 2]) {
            const cmd = players.find((p) => p.teamId === team && p.role === "leader");
            if (!cmd) continue;
            this.commanderSeconds += 1;
            for (const p of players) {
                if (p.teamId !== team || p === cmd) continue;
                const near = Math.hypot(p.pos.x - cmd.pos.x, p.pos.y - cmd.pos.y) <= RALLY_NEAR;
                const b = byId.get(p.id);
                const persona = b?.bot.persona.name ?? "?";
                count(this.rally, phase, near);
                count(this.rallyByPersona, persona, near);
                const own = keepsToItself(p.id, persona, p.role ?? "");
                count(own ? this.own : this.rallying, phase, near);
                if (!own && !near && b) add(this.farBy, b.bot.intent.behaviour, 1);
            }
        }
    }

    finish(): RiverRallyResult {
        return {
            water: this.water,
            waterBy: this.waterBy,
            stillBy: this.stillBy,
            rally: this.rally,
            rallyByPersona: this.rallyByPersona,
            rallying: this.rallying,
            own: this.own,
            farBy: this.farBy,
            commanderSeconds: this.commanderSeconds,
        };
    }
}

export interface RallyTask {
    seed: number;
    gas?: "quick" | "normal";
    maxTicks?: number;
    difficulty?: "population" | "mixed";
    /** the server's persona mix (default true); false: every bot neutral, as test/faction.test.ts plays */
    personas?: boolean;
}

export interface RallyMatch {
    task: RallyTask;
    over: boolean;
    winningTeam: number;
    gameSeconds: number;
    wallMs: number;
    exceptions: number;
    errors: string[];
    teamKills: number;
    kills: number[];
    deaths: number[];
    alive: number[];
    probe: RiverRallyResult;
}

/** One match with the probe (the server's population: skill tiers and personas). */
export function runRallyMatch(task: RallyTask, clock?: () => number): RallyMatch {
    const probe = new RiverRallyProbe();
    const report: MatchReport = runMatch({
        faction: true,
        seed: task.seed,
        gasStages: task.gas === "quick" ? QUICK_GAS : undefined,
        maxTicks: task.maxTicks ?? 60000,
        difficulty: task.difficulty ?? "population",
        population: { personas: task.personas ?? true },
        probes: [probe],
        ...(clock ? { clock } : {}),
    });
    const side = (team: number, f: (p: MatchReport["players"][number]) => number) =>
        report.players.filter((p) => p.teamId === team).reduce((a, p) => a + f(p), 0);
    return {
        task,
        over: report.over,
        winningTeam: report.winningTeamId,
        gameSeconds: report.gameSeconds,
        wallMs: report.wallMs,
        exceptions: report.exceptions,
        errors: report.errors,
        teamKills: report.teamKills ?? 0,
        kills: [1, 2].map((t) => side(t, (p) => p.kills)),
        deaths: [1, 2].map((t) => side(t, (p) => (p.dead ? 1 : 0))),
        alive: [1, 2].map((t) => side(t, (p) => (p.dead ? 0 : 1))),
        probe: probe.finish(),
    };
}

const pct = (a: number, b: number) => (b > 0 ? `${((100 * a) / b).toFixed(1)}%` : "-");

function addRows(dst: Record<string, RallyRow>, src: Record<string, RallyRow> | undefined): void {
    for (const [k, v] of Object.entries(src ?? {})) {
        const o = (dst[k] ??= { samples: 0, near: 0 });
        o.samples += v.samples;
        o.near += v.near;
    }
}

const byPhase = (rows: Record<string, RallyRow>) =>
    PHASES.filter(([n]) => rows[n])
        .map(([n]) => `${n} ${pct(rows[n].near, rows[n].samples)}`)
        .join(", ");

/** The report of several matches: water share by phase and behaviour, rally share by phase and persona. */
export function formatRally(rows: readonly RallyMatch[]): string {
    const lines: string[] = [];
    const water: Record<string, Required<WaterRow>> = {};
    const waterBy: Record<string, number> = {};
    const stillBy: Record<string, number> = {};
    const farBy: Record<string, number> = {};
    const rally: Record<string, RallyRow> = {};
    const persona: Record<string, RallyRow> = {};
    const rallying: Record<string, RallyRow> = {};
    const own: Record<string, RallyRow> = {};
    for (const r of rows) {
        for (const [k, w] of Object.entries(r.probe.water)) {
            const o = (water[k] ??= { standing: 0, water: 0, still: 0, river: 0, riverStill: 0 });
            o.standing += w.standing;
            o.water += w.water;
            o.still += w.still;
            o.river += w.river ?? 0;
            o.riverStill += w.riverStill ?? 0;
        }
        for (const [k, v] of Object.entries(r.probe.waterBy)) add(waterBy, k, v);
        for (const [k, v] of Object.entries(r.probe.stillBy)) add(stillBy, k, v);
        for (const [k, v] of Object.entries(r.probe.farBy ?? {})) add(farBy, k, v);
        addRows(rally, r.probe.rally);
        addRows(persona, r.probe.rallyByPersona);
        addRows(rallying, r.probe.rallying);
        addRows(own, r.probe.own);
        lines.push(
            `seed ${r.task.seed}: winner ${r.winningTeam} (${r.over ? "over" : "NOT OVER"}) ${r.gameSeconds.toFixed(0)} s, ` +
                `kills ${r.kills.join("/")}, deaths ${r.deaths.join("/")}, alive ${r.alive.join("/")}, ` +
                `exceptions ${r.exceptions}, team kills ${r.teamKills}`,
        );
    }
    const total = { standing: 0, water: 0, still: 0, river: 0, riverStill: 0 };
    lines.push("phase     standing-s  in water  still in water  in the river  still in the river");
    const line = (name: string, w: Required<WaterRow>) =>
        `${name.padEnd(9)} ${w.standing.toFixed(0).padStart(10)}  ${pct(w.water, w.standing).padStart(8)}  ` +
        `${pct(w.still, w.standing).padStart(14)}  ${pct(w.river, w.standing).padStart(12)}  ` +
        `${pct(w.riverStill, w.standing).padStart(18)}`;
    for (const [name] of PHASES) {
        const w = water[name];
        if (!w) continue;
        for (const k of Object.keys(total) as (keyof typeof total)[]) total[k] += w[k];
        lines.push(line(name, w));
    }
    lines.push(line("all", total));
    const by = Object.entries(waterBy).sort((a, b) => b[1] - a[1]);
    lines.push(
        `water seconds by behaviour: ${by.map(([k, v]) => `${k} ${v.toFixed(0)} (still ${(stillBy[k] ?? 0).toFixed(0)})`).join(", ")}`,
    );
    lines.push(`within ${RALLY_NEAR} u of the Commander: ${byPhase(rally)}`);
    lines.push(`  members that rally: ${byPhase(rallying)}`);
    lines.push(`  members on their own: ${byPhase(own)}`);
    const far = Object.entries(farBy).sort((a, b) => b[1] - a[1]);
    const farTotal = far.reduce((a, [, v]) => a + v, 0);
    lines.push(
        `  rallying members farther, by behaviour: ${far.map(([k, v]) => `${k} ${pct(v, farTotal)}`).join(", ")}`,
    );
    lines.push(
        `by persona: ${Object.entries(persona)
            .map(([k, v]) => `${k} ${pct(v.near, v.samples)}`)
            .join(", ")}`,
    );
    const k = rows.reduce((a, r) => a + r.kills[0] + r.kills[1], 0);
    const d = rows.reduce((a, r) => a + r.deaths[0] + r.deaths[1], 0);
    const red = rows.filter((r) => r.winningTeam === 1).length;
    lines.push(
        `matches ${rows.length}, red wins ${red}, kills ${k}, deaths ${d}, ` +
            `exceptions ${rows.reduce((a, r) => a + r.exceptions, 0)}`,
    );
    return lines.join("\n");
}
