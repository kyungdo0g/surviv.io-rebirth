// Knocked bots crawling (owner report 2026-10-10; brain/downed.ts): squad and 50v50 matches on worker threads.
//   node packages/bots/scripts/downed.ts [--mode squad|faction] [--seeds 1-3] [--seconds 300] [--off crawl]
// For every knock: how long it lasted, the share of that time the bot stood still (under STILL_SPEED, not being
// revived), its distance to the nearest standing teammate when knocked and when it ended, and how it ended.
import { parseArgs } from "node:util";
import { isMainThread, parentPort, Worker } from "node:worker_threads";
import type { Game, Player } from "@rebirth/sim";
import { BRAIN_PRESETS, type BrainFeature, type BrainFeatures } from "../src/brain/features.ts";
import { runMatch } from "../src/runner.ts";

const SAMPLE = 10;
const STILL_SPEED = 0.5;

interface Task {
    seed: number;
    faction: boolean;
    seconds: number;
    off: BrainFeature[];
}

interface Result {
    knocks: number;
    seconds: number;
    still: number;
    revived: number;
    died: number;
    friendStart: number;
    friendEnd: number;
    friendCount: number;
}

function nearestFriend(game: Game, p: Player): number {
    let best = Number.POSITIVE_INFINITY;
    for (const q of game.players()) {
        if (q === p || q.dead || q.downed || q.teamId !== p.teamId) continue;
        best = Math.min(best, Math.hypot(q.pos.x - p.pos.x, q.pos.y - p.pos.y));
    }
    return best;
}

function runTask(task: Task): Result {
    const features: BrainFeatures = { ...BRAIN_PRESETS.smart };
    for (const f of task.off) features[f] = false;
    const r: Result = {
        knocks: 0,
        seconds: 0,
        still: 0,
        revived: 0,
        died: 0,
        friendStart: 0,
        friendEnd: 0,
        friendCount: 0,
    };
    const open = new Map<number, { since: number; last: { x: number; y: number }; friend: number }>();
    runMatch({
        seed: task.seed,
        faction: task.faction,
        teamMode: 4,
        bots: task.faction ? 100 : 80,
        difficulty: "population",
        population: { personas: true },
        maxTicks: task.seconds * 100,
        brainFeatures: { smart: features },
        probes: [
            {
                name: "downed",
                tick(game: Game) {
                    if (game.tick % SAMPLE !== 0) return;
                    const dt = SAMPLE / 100;
                    for (const p of game.players()) {
                        const o = open.get(p.id);
                        if (p.downed && !p.dead) {
                            if (!o) {
                                open.set(p.id, {
                                    since: game.time,
                                    last: { ...p.pos },
                                    friend: nearestFriend(game, p),
                                });
                                r.knocks++;
                                continue;
                            }
                            const moved = Math.hypot(p.pos.x - o.last.x, p.pos.y - o.last.y);
                            o.last = { ...p.pos };
                            r.seconds += dt;
                            if (moved / dt < STILL_SPEED && !p.revivedBy && !p.playerBeingRevived) r.still += dt;
                        } else if (o) {
                            open.delete(p.id);
                            if (p.dead) r.died++;
                            else r.revived++;
                            const end = nearestFriend(game, p);
                            if (Number.isFinite(o.friend) && Number.isFinite(end)) {
                                r.friendStart += o.friend;
                                r.friendEnd += end;
                                r.friendCount++;
                            }
                        }
                    }
                },
            },
        ],
    });
    return r;
}

function seedsOf(s: string): number[] {
    const [a, b] = s.split("-").map(Number);
    return b === undefined ? [a] : Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

async function main(): Promise<void> {
    const { values } = parseArgs({
        options: {
            mode: { type: "string", default: "squad" },
            seeds: { type: "string", default: "1-3" },
            seconds: { type: "string", default: "300" },
            workers: { type: "string", default: "3" },
            off: { type: "string", default: "" },
        },
    });
    const off = (values.off ? values.off.split(",") : []) as BrainFeature[];
    const tasks: Task[] = seedsOf(values.seeds).map((seed) => ({
        seed,
        faction: values.mode === "faction",
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
                w.on("message", (res: Result) => {
                    results.push(res);
                    feed();
                });
                w.on("error", reject);
                feed();
            });
        }),
    );
    const sum = (f: (r: Result) => number) => results.reduce((a, r) => a + f(r), 0);
    const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(0)}%` : "-");
    console.log(
        `${values.mode}, ${results.length} matches, ${values.seconds} s${off.length ? `, off: ${off.join(",")}` : ""}: knocks ${sum((r) => r.knocks)}, knocked ${sum((r) => r.seconds).toFixed(0)} s, standing still ${pct(
            sum((r) => r.still),
            sum((r) => r.seconds),
        )}, revived ${sum((r) => r.revived)}, died ${sum((r) => r.died)}, nearest standing teammate ${(
            sum((r) => r.friendStart) /
                Math.max(
                    1,
                    sum((r) => r.friendCount),
                )
        ).toFixed(1)} u when knocked -> ${(
            sum((r) => r.friendEnd) /
                Math.max(
                    1,
                    sum((r) => r.friendCount),
                )
        ).toFixed(1)} u at the end`,
    );
}

if (isMainThread) await main();
else parentPort?.on("message", (t: Task) => parentPort?.postMessage(runTask(t)));
