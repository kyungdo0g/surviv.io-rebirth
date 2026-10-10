// Breaking through what blocks the way (owner 2026-10-09/10; brain/breakThrough.ts): population matches with the
// feature on and off, the same seeds:
//   node packages/bots/scripts/breakThrough.ts [--bots 80] [--seeds 1-3] [--seconds 150]
// Prints per setting: path follower stuck events per bot-minute, idle seconds, decisions that went to breaking an
// obstacle on the way, and the obstacles the bots destroyed by break class (the house rule's types, other indoor
// obstacles, glass walls elsewhere) over the first `seconds` of each match.
import { parseArgs } from "node:util";
import { getMapObjectDef, hasMapObjectDef, type ObstacleDef } from "@rebirth/defs";
import type { Game } from "@rebirth/sim";
import { BRAIN_PRESETS, type BrainFeatures } from "../src/brain/features.ts";
import type { BotController } from "../src/controller.ts";
import { runMatch } from "../src/runner.ts";

function seedsOf(s: string): number[] {
    const [a, b] = s.split("-").map(Number);
    return b === undefined ? [a] : Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

const HOUSE_RULE = /^(couch_\d|police_wall_int_|mansion_wall_int_|club_wall_int_|glass_wall_10$)/;

interface Row {
    stuck: number;
    idle: number;
    botSeconds: number;
    acted: number;
    broken: Record<string, number>;
}

function run(seed: number, bots: number, seconds: number, on: boolean): Row {
    const features: BrainFeatures = { ...BRAIN_PRESETS.smart, breakThrough: on };
    let acted = 0;
    let botSeconds = 0;
    const alive = new Map<number, string>();
    const broken: Record<string, number> = { houseRule: 0, glass: 0, other: 0 };
    const report = runMatch({
        seed,
        bots,
        difficulty: "population",
        population: { personas: true },
        maxTicks: seconds * 100,
        brainFeatures: { smart: features },
        probes: [
            {
                name: "breakThrough",
                start(game: Game) {
                    for (const o of game.world.objects.values())
                        if (o.kind === "obstacle" && !o.dead && hasMapObjectDef(o.type)) alive.set(o.id, o.type);
                },
                tick(game: Game, list: readonly BotController[]) {
                    if (game.tick % 100 === 0)
                        botSeconds += list.filter((b) => !game.getPlayer(b.playerId)?.dead).length;
                },
                finish(game: Game, list: readonly BotController[]) {
                    for (const b of list) acted += b.bot.brain.breaker.acted;
                    for (const [id, type] of alive) {
                        const o = game.world.get(id);
                        if (o?.kind !== "obstacle" || !o.dead) continue;
                        const def = getMapObjectDef(type) as ObstacleDef;
                        if (HOUSE_RULE.test(type)) broken.houseRule++;
                        else if (def.material === "glass") broken.glass++;
                        else broken.other++;
                    }
                    return null;
                },
            },
        ],
    });
    return {
        stuck: report.stuckEvents,
        idle: report.players.reduce((a, p) => a + p.idleSeconds, 0),
        botSeconds,
        acted,
        broken,
    };
}

const { values } = parseArgs({
    options: {
        bots: { type: "string", default: "80" },
        seeds: { type: "string", default: "1-3" },
        seconds: { type: "string", default: "150" },
    },
});
for (const on of [false, true]) {
    const rows = seedsOf(values.seeds).map((s) => run(s, Number(values.bots), Number(values.seconds), on));
    const sum = (f: (r: Row) => number) => rows.reduce((a, r) => a + f(r), 0);
    const mins = sum((r) => r.botSeconds) / 60;
    console.log(
        `breakThrough ${on ? "on " : "off"}: stuck ${(sum((r) => r.stuck) / mins).toFixed(3)} per bot-minute, idle ${(sum((r) => r.idle) / mins).toFixed(2)} s per bot-minute, break decisions ${sum((r) => r.acted)}, destroyed: house rule ${sum((r) => r.broken.houseRule)}, glass ${sum((r) => r.broken.glass)}, other ${sum((r) => r.broken.other)} (${rows.length} matches, ${mins.toFixed(0)} bot-minutes)`,
    );
}
