// Fist encounters and house in-out loops in population matches (round 5, user report 35: "everyone bare-handed: bots
// that see me all run away; they go into a house, run out, go in ... for ever").
//   node packages/bots/scripts/fistprobe.ts [--seeds 1,2,3] [--mode solo] [--secs 150]
// Fist encounters: every 0.03 s, an unarmed bot that sees an unarmed enemy within 15 units, with no gun in view within
// 60 units and none seen in the last 15 s: the behaviour it chose, by the enemy's distance (0-4, 4-8, 8-15 units), and
// the share of flights (flee, evade, disengage). House loops: a bot leaves a building while it sees a standing enemy
// inside it, stays out 2 s or more and walks back in by choice (explore, loot, break or sweep) within 40 s.
import { parseArgs } from "node:util";
import { type Vec2, v2 } from "@rebirth/core";
import type { Game, Player } from "@rebirth/sim";
import type { BotController } from "../src/controller.ts";
import { type MatchProbe, runMatch } from "../src/runner.ts";

const { values } = parseArgs({
    options: {
        seeds: { type: "string", default: "1,2,3" },
        mode: { type: "string", default: "solo" },
        secs: { type: "string", default: "150" },
    },
});
const MODES: Record<string, 1 | 2 | 4> = { solo: 1, duo: 2, squad: 4 };
const FLIGHT = new Set(["flee", "evade", "disengage"]);
const BY_CHOICE = new Set(["explore", "loot", "break", "sweep"]);
const BANDS = ["0-4", "4-8", "8-15"] as const;

function gunned(p: Player): boolean {
    return p.weaponManager.weapons.slice(0, 2).some((w) => !!w.type);
}

interface Box {
    id: number;
    min: Vec2;
    max: Vec2;
}

interface Tally {
    samples: number;
    flights: number;
    /** samples by distance band and behaviour */
    bands: Record<string, Record<string, number>>;
    loops: number;
    unarmedLoops: number;
}

function probe(tally: Tally, secs: number): MatchProbe {
    const boxes: Box[] = [];
    const inside = (p: Vec2): number =>
        boxes.find((b) => p.x >= b.min.x && p.x <= b.max.x && p.y >= b.min.y && p.y <= b.max.y)?.id ?? 0;
    const where = new Map<number, number>();
    const exits = new Map<number, { at: number; building: number; outSince: number }>();
    return {
        name: "fists",
        start(game: Game) {
            for (const o of game.world.buildings) {
                if (o.layer !== 0) continue;
                for (const r of o.zoomRegions) if (r.zoomIn) boxes.push({ id: o.id, ...r.zoomIn });
            }
        },
        tick(game: Game, bots: readonly BotController[]) {
            if (game.tick % 3 !== 0) return;
            const t = game.time;
            for (const b of bots) {
                const p = game.getPlayer(b.playerId);
                if (!p || p.dead || p.downed) continue;
                const contacts = [...b.bot.model.contacts.values()].filter((c) => !c.teammate && !c.dead);
                const behaviour = b.bot.intent.behaviour;
                // house loops
                const now = inside(p.pos);
                const prev = where.get(p.id) ?? 0;
                if (now !== prev) {
                    const ex = exits.get(p.id) ?? { at: Number.NEGATIVE_INFINITY, building: 0, outSince: 0 };
                    if (prev && !now) {
                        ex.outSince = t;
                        if (contacts.some((c) => c.visible && !c.downed && inside(c.pos) === prev)) {
                            ex.at = t;
                            ex.building = prev;
                        }
                    }
                    if (now && now === ex.building && t - ex.at < 40 && t - ex.outSince >= 2) {
                        if (BY_CHOICE.has(behaviour)) {
                            tally.loops++;
                            if (!gunned(p)) tally.unarmedLoops++;
                        }
                        ex.at = Number.NEGATIVE_INFINITY;
                    }
                    exits.set(p.id, ex);
                    where.set(p.id, now);
                }
                // fist encounters
                if (gunned(p) || t > secs) continue;
                let nearD = 15;
                let armed = false;
                for (const c of contacts) {
                    const e = game.getPlayer(c.id);
                    if (!e) continue;
                    const d = v2.distance(e.pos, p.pos);
                    if (c.visible && gunned(e) && d < 60) armed = true;
                    if (t - c.lastSeen < 3 && t - c.lastArmedAt < 15 && d < 60) armed = true;
                    if (c.visible && !c.downed && !gunned(e) && d < nearD) nearD = d;
                }
                if (nearD >= 15 || armed) continue;
                tally.samples++;
                if (FLIGHT.has(behaviour)) tally.flights++;
                const band = nearD < 4 ? BANDS[0] : nearD < 8 ? BANDS[1] : BANDS[2];
                const row = (tally.bands[band] ??= {});
                row[behaviour] = (row[behaviour] ?? 0) + 1;
            }
        },
    };
}

const tally: Tally = { samples: 0, flights: 0, bands: {}, loops: 0, unarmedLoops: 0 };
for (const seed of values.seeds.split(",").map(Number)) {
    runMatch({
        seed,
        teamMode: MODES[values.mode],
        difficulty: "population",
        population: { personas: true },
        probes: [probe(tally, Number(values.secs))],
        maxTicks: Number(values.secs) * 100,
    });
}
const pct = (n: number, d: number) => `${((100 * n) / Math.max(1, d)).toFixed(1)}%`;
console.log(`fist encounter samples ${tally.samples}: flights ${pct(tally.flights, tally.samples)}`);
for (const band of BANDS) {
    const row = tally.bands[band] ?? {};
    const n = Object.values(row).reduce((a, b) => a + b, 0);
    const top = Object.entries(row)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([k, v]) => `${k} ${pct(v, n)}`);
    console.log(`  ${band.padEnd(5)} u  n ${String(n).padStart(6)}  ${top.join(", ")}`);
}
console.log(
    `house loops (out 2+ s after seeing an enemy inside, back in by choice) ${tally.loops}, unarmed ${tally.unarmedLoops}`,
);
