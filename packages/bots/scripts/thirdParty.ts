// Third parties in a 1v1 (owner request 2026-10-10; brain/thirdParty.ts): population matches on worker threads.
//   node packages/bots/scripts/thirdParty.ts [--bots 80] [--seeds 1-3] [--seconds 300] [--off thirdPartyReact]
// A bot fighting one enemy (the fight behaviour on it for a second) is shot at by another (its bullets fly at the
// bot): within REACT_WINDOW the bot switched its target to the newcomer, or kept its first opponent and at the window's
// end stood out of the newcomer's line of fire (behind cover), or in it having moved REPOSITION u, or in it near where
// it stood (tunnel vision). Also: how
// many of the bots died within DEATH_WINDOW, and to whom.
import { parseArgs } from "node:util";
import { isMainThread, parentPort, Worker } from "node:worker_threads";
import type { Game } from "@rebirth/sim";
import { BRAIN_PRESETS, type BrainFeature, type BrainFeatures } from "../src/brain/features.ts";
import type { BotController } from "../src/controller.ts";
import { runMatch } from "../src/runner.ts";

const REACT_WINDOW = 2;
const DEATH_WINDOW = 10;
const REPOSITION = 3;
const DUEL_FOR = 1;

interface Task {
    seed: number;
    bots: number;
    seconds: number;
    off: BrainFeature[];
}

type Outcome = "switched" | "covered" | "moved" | "tunnel";

interface Result {
    events: Record<Outcome, number>;
    died: number;
    diedToNewcomer: number;
}

function runTask(task: Task): Result {
    const features: BrainFeatures = { ...BRAIN_PRESETS.smart };
    for (const f of task.off) features[f] = false;
    const res: Result = { events: { switched: 0, covered: 0, moved: 0, tunnel: 0 }, died: 0, diedToNewcomer: 0 };
    const duel = new Map<number, { target: number; since: number }>();
    const open = new Map<
        number,
        { at: number; first: number; newcomer: number; pos: { x: number; y: number }; outcome: Outcome | null }
    >();
    const watching: Array<{ bot: number; newcomer: number; until: number }> = [];
    runMatch({
        seed: task.seed,
        bots: task.bots,
        difficulty: "population",
        population: { personas: true },
        maxTicks: task.seconds * 100,
        brainFeatures: { smart: features },
        probes: [
            {
                name: "thirdParty",
                tick(game: Game, bots: readonly BotController[]) {
                    if (game.tick % 5 !== 0) return;
                    const now = game.time;
                    for (const b of bots) {
                        const p = game.getPlayer(b.playerId);
                        if (!p || p.dead || p.downed) {
                            duel.delete(b.playerId);
                            open.delete(b.playerId);
                            continue;
                        }
                        const it = b.bot.intent;
                        const model = b.bot.model;
                        const o = open.get(b.playerId);
                        if (o) {
                            if (it.targetId === o.newcomer) o.outcome = "switched";
                            if (now - o.at >= REACT_WINDOW) {
                                const nc = game.getPlayer(o.newcomer);
                                const hidden = !nc || nc.dead || !model.lineOfFire(nc.pos, p.pos);
                                const moved = Math.hypot(p.pos.x - o.pos.x, p.pos.y - o.pos.y) >= REPOSITION;
                                const out = o.outcome ?? (hidden ? "covered" : moved ? "moved" : "tunnel");
                                res.events[out]++;
                                watching.push({ bot: b.playerId, newcomer: o.newcomer, until: now + DEATH_WINDOW });
                                open.delete(b.playerId);
                            }
                            continue;
                        }
                        if (it.behaviour !== "fight" || !it.targetId) {
                            duel.delete(b.playerId);
                            continue;
                        }
                        const d = duel.get(b.playerId);
                        if (!d || d.target !== it.targetId) {
                            duel.set(b.playerId, { target: it.targetId, since: now });
                            continue;
                        }
                        const uf = model.underFire;
                        if (now - d.since < DUEL_FOR || !uf || now - uf.time > 0.2) continue;
                        if (uf.shooterId === d.target || uf.shooterId === 0 || model.isTeammate(uf.shooterId)) continue;
                        open.set(b.playerId, {
                            at: now,
                            first: d.target,
                            newcomer: uf.shooterId,
                            pos: { ...p.pos },
                            outcome: null,
                        });
                        duel.delete(b.playerId);
                    }
                },
                observer: {
                    onPlayerKilled(victim, _params, killer) {
                        for (let i = watching.length - 1; i >= 0; i--) {
                            const w = watching[i];
                            if (w.bot !== victim.id) continue;
                            res.died++;
                            if (killer?.id === w.newcomer) res.diedToNewcomer++;
                            watching.splice(i, 1);
                        }
                    },
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
        },
    });
    const off = (values.off ? values.off.split(",") : []) as BrainFeature[];
    const tasks: Task[] = seedsOf(values.seeds).map((seed) => ({
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
    const ev: Record<string, number> = {};
    for (const r of results) for (const [k, v] of Object.entries(r.events)) ev[k] = (ev[k] ?? 0) + v;
    const n = Object.values(ev).reduce((a, b) => a + b, 0);
    const pct = (a: number) => (n ? `${((100 * a) / n).toFixed(0)}%` : "-");
    const died = results.reduce((a, r) => a + r.died, 0);
    const toNew = results.reduce((a, r) => a + r.diedToNewcomer, 0);
    console.log(
        `${results.length} matches${off.length ? `, off: ${off.join(",")}` : ""}: third parties ${n}; switched ${pct(ev.switched)}, covered from the newcomer ${pct(ev.covered)}, moved ${pct(ev.moved)}, tunnel vision ${pct(ev.tunnel)}; died within ${DEATH_WINDOW} s ${pct(died)} (to the newcomer ${pct(toNew)})`,
    );
}

if (isMainThread) await main();
else parentPort?.on("message", (t: Task) => parentPort?.postMessage(runTask(t)));
