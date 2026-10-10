// Point-blank hugging (owner report 2026-10-10: two players pressed body to body on stairs, both shooting guns whose
// muzzle reaches past the other's body, so every bullet spawns beyond the target; neither swaps to melee). Population
// matches on worker threads:
//   node packages/bots/scripts/hugging.ts [--bots 80] [--seeds 1-3] [--seconds 300] [--workers 3] [--off feature,...]
//        [--dist 2] [--time 2]
// Counts episodes of two standing enemies within HUG_DIST of each other for more than HUG_TIME, and for each the
// weapons in hand (gun or melee), the behaviours (the brain's intent) and the layers (stairs) when it began, and how
// it ended.
import { parseArgs } from "node:util";
import { isMainThread, parentPort, Worker } from "node:worker_threads";
import { GameObjectDefs, hasDef } from "@rebirth/defs";
import type { Game } from "@rebirth/sim";
import { BRAIN_PRESETS, type BrainFeature, type BrainFeatures } from "../src/brain/features.ts";
import type { BotController } from "../src/controller.ts";
import { runMatch } from "../src/runner.ts";

let HUG_DIST = 2;
let HUG_TIME = 2;

interface Task {
    dist: number;
    time: number;
    seed: number;
    bots: number;
    seconds: number;
    off: BrainFeature[];
}

interface Result {
    seed: number;
    hugs: number;
    hugSeconds: number;
    /** "gun/gun", "gun/melee", "melee/melee" at the start of each episode */
    hands: Record<string, number>;
    behaviours: Record<string, number>;
    stairs: number;
    endings: Record<string, number>;
    botSeconds: number;
}

function held(game: Game, id: number): "gun" | "melee" | "other" {
    const p = game.getPlayer(id);
    if (!p) return "other";
    const t = p.weaponManager.weapons[p.weaponManager.curWeapIdx]?.type ?? "";
    if (!t || !hasDef(t)) return "melee";
    const type = GameObjectDefs[t].type;
    return type === "gun" ? "gun" : type === "melee" ? "melee" : "other";
}

function runTask(task: Task): Result {
    HUG_DIST = task.dist;
    HUG_TIME = task.time;
    const features: BrainFeatures = { ...BRAIN_PRESETS.smart };
    for (const f of task.off) features[f] = false;
    const res: Result = {
        seed: task.seed,
        hugs: 0,
        hugSeconds: 0,
        hands: {},
        behaviours: {},
        stairs: 0,
        endings: {},
        botSeconds: 0,
    };
    const add = (r: Record<string, number>, k: string) => {
        r[k] = (r[k] ?? 0) + 1;
    };
    // pair key -> since when within HUG_DIST, counted already, and the start's description
    const close = new Map<string, { since: number; counted: boolean; a: number; b: number }>();
    let byId = new Map<number, BotController>();
    runMatch({
        seed: task.seed,
        bots: task.bots,
        difficulty: "population",
        population: { personas: true },
        maxTicks: task.seconds * 100,
        brainFeatures: { smart: features },
        probes: [
            {
                name: "hugging",
                start(_game, bots) {
                    byId = new Map(bots.map((b) => [b.playerId, b]));
                },
                tick(game: Game, bots: readonly BotController[]) {
                    if (game.tick % 5 !== 0) return;
                    const now = game.time;
                    const live = bots
                        .map((b) => game.getPlayer(b.playerId))
                        .filter((p) => p && !p.dead && !p.downed) as NonNullable<ReturnType<Game["getPlayer"]>>[];
                    res.botSeconds += live.length * 0.05;
                    const seen = new Set<string>();
                    for (let i = 0; i < live.length; i++) {
                        for (let j = i + 1; j < live.length; j++) {
                            const a = live[i];
                            const b = live[j];
                            if (Math.abs(a.pos.x - b.pos.x) > HUG_DIST || Math.abs(a.pos.y - b.pos.y) > HUG_DIST)
                                continue;
                            if (Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y) > HUG_DIST) continue;
                            const key = `${a.id}:${b.id}`;
                            seen.add(key);
                            const c = close.get(key);
                            if (!c) close.set(key, { since: now, counted: false, a: a.id, b: b.id });
                            else if (!c.counted && now - c.since > HUG_TIME) {
                                c.counted = true;
                                res.hugs++;
                                const ha = held(game, a.id);
                                const hb = held(game, b.id);
                                add(res.hands, [ha, hb].sort().join("/"));
                                for (const id of [a.id, b.id])
                                    add(res.behaviours, byId.get(id)?.bot.intent.behaviour ?? "-");
                                if ((a.layer & 2) !== 0 || (b.layer & 2) !== 0) res.stairs++;
                            }
                        }
                    }
                    for (const [key, c] of close) {
                        if (seen.has(key)) continue;
                        close.delete(key);
                        if (!c.counted) continue;
                        res.hugSeconds += now - c.since;
                        const pa = game.getPlayer(c.a);
                        const pb = game.getPlayer(c.b);
                        const ending =
                            pa?.dead || pb?.dead ? "a death" : pa?.downed || pb?.downed ? "a knock" : "moved apart";
                        add(res.endings, ending);
                    }
                },
            },
        ],
    });
    return res;
}

function seedsOf(s: string): number[] {
    const [a, b] = s.split("-").map(Number);
    return b === undefined ? [a] : Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

async function main(): Promise<void> {
    const { values } = parseArgs({
        options: {
            bots: { type: "string", default: "80" },
            seeds: { type: "string", default: "1-3" },
            seconds: { type: "string", default: "300" },
            workers: { type: "string", default: "3" },
            off: { type: "string", default: "" },
            dist: { type: "string", default: "2" },
            time: { type: "string", default: "2" },
        },
    });
    const off = (values.off ? values.off.split(",") : []) as BrainFeature[];
    HUG_DIST = Number(values.dist);
    HUG_TIME = Number(values.time);
    const tasks: Task[] = seedsOf(values.seeds).map((seed) => ({
        dist: HUG_DIST,
        time: HUG_TIME,
        seed,
        bots: Number(values.bots),
        seconds: Number(values.seconds),
        off,
    }));
    const results: Result[] = [];
    let next = 0;
    await Promise.all(
        Array.from({ length: Math.min(Number(values.workers), tasks.length) }, () => {
            const w = new Worker(new URL(import.meta.url));
            return new Promise<void>((resolve, reject) => {
                const feed = () => {
                    if (next >= tasks.length) {
                        void w.terminate();
                        resolve();
                        return;
                    }
                    w.postMessage(tasks[next++]);
                };
                w.on("message", (r: Result) => {
                    results.push(r);
                    feed();
                });
                w.on("error", reject);
                feed();
            });
        }),
    );
    const sum = (f: (r: Result) => number) => results.reduce((a, r) => a + f(r), 0);
    const merge = (f: (r: Result) => Record<string, number>) => {
        const out: Record<string, number> = {};
        for (const r of results) for (const [k, v] of Object.entries(f(r))) out[k] = (out[k] ?? 0) + v;
        return Object.entries(out)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => `${k} ${v}`)
            .join(", ");
    };
    const mins = sum((r) => r.botSeconds) / 60;
    console.log(
        `${results.length} matches, ${values.bots} bots, ${values.seconds} s${off.length ? `, off: ${off.join(",")}` : ""}`,
    );
    console.log(
        `hugs (two standing players within ${HUG_DIST} u for over ${HUG_TIME} s): ${sum((r) => r.hugs)} (${((100 * sum((r) => r.hugs)) / mins).toFixed(2)} per 100 bot-minutes), ${sum((r) => r.hugSeconds).toFixed(0)} s in all, on stairs ${sum((r) => r.stairs)}`,
    );
    console.log(`hands: ${merge((r) => r.hands)}`);
    console.log(`behaviours: ${merge((r) => r.behaviours)}`);
    console.log(`endings: ${merge((r) => r.endings)}`);
}

if (isMainThread) await main();
else parentPort?.on("message", (t: Task) => parentPort?.postMessage(runTask(t)));
