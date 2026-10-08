// Movement statistics of bots against the owner's gameplay videos (round 5, user report 36; src/metrics/moveStats.ts).
//   node packages/bots/scripts/movestats.ts [--seeds 1,2] [--secs 200] [--mode solo] [--bots 80] [--human tracks.json]
//        [--save tracks.json] [--tracks tracks.json]
// Plays population matches (skill mix and personas, like the server), records every bot's position at 30 Hz while it
// walks (downed and dead frames are gaps) and prints the statistics pooled, by tier, and next to HUMAN_REFERENCE (or the
// statistics of `--human`: tracks in running-speed units exported from the video analysis).
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import type { Game } from "@rebirth/sim";
import type { BotController } from "../src/controller.ts";
import {
    addTrack,
    emptyCounts,
    HUMAN_REFERENCE,
    type MoveCounts,
    type MoveStats,
    moveStats,
    TRACK_HZ,
} from "../src/metrics/moveStats.ts";
import { runMatch } from "../src/runner.ts";

const { values } = parseArgs({
    options: {
        seeds: { type: "string", default: "1,2" },
        secs: { type: "string", default: "200" },
        mode: { type: "string", default: "solo" },
        human: { type: "string" },
        tracks: { type: "string" },
        save: { type: "string" },
        bots: { type: "string", default: "80" },
    },
});
const MODES: Record<string, 1 | 2 | 4> = { solo: 1, duo: 2, squad: 4 };

const tracks = new Map<string, { xs: number[]; ys: number[]; tier: string; beh: string[] }>();
if (values.tracks) {
    // a saved dump (--save): { key: { x, y, tier } } at 30 Hz, null where the bot was not walking
    const data = JSON.parse(readFileSync(values.tracks, "utf8")) as Record<
        string,
        { x: (number | null)[]; y: (number | null)[]; tier: string }
    >;
    const nan = (v: number | null) => v ?? Number.NaN;
    for (const [k, t] of Object.entries(data))
        tracks.set(k, { xs: t.x.map(nan), ys: t.y.map(nan), tier: t.tier, beh: [] });
}
for (const seed of values.tracks ? [] : values.seeds.split(",").map(Number)) {
    let frame = -1;
    runMatch({
        seed,
        teamMode: MODES[values.mode],
        bots: Number(values.bots),
        difficulty: "population",
        population: { personas: true },
        maxTicks: Number(values.secs) * 100,
        onTick(game: Game, bots: readonly BotController[]) {
            const f = Math.floor((game.tick * TRACK_HZ) / 100);
            if (f === frame) return;
            frame = f;
            for (const b of bots) {
                const p = game.getPlayer(b.playerId);
                if (!p) continue;
                const key = `${seed}:${b.playerId}`;
                let t = tracks.get(key);
                if (!t) {
                    t = { xs: [], ys: [], tier: b.bot.skill.tier, beh: [] };
                    tracks.set(key, t);
                }
                const walking = !p.dead && !p.downed;
                t.xs.push(walking ? p.pos.x : Number.NaN);
                t.ys.push(walking ? p.pos.y : Number.NaN);
                t.beh.push(b.bot.intent.behaviour);
            }
        },
    });
}

if (values.save) {
    const out: Record<string, { x: number[]; y: number[]; tier: string }> = {};
    for (const [k, t] of tracks) out[k] = { x: t.xs, y: t.ys, tier: t.tier };
    writeFileSync(values.save, JSON.stringify(out));
}
const all = emptyCounts();
const byTier = new Map<string, MoveCounts>();
for (const t of tracks.values()) {
    addTrack(all, t.xs, t.ys);
    let c = byTier.get(t.tier);
    if (!c) byTier.set(t.tier, (c = emptyCounts()));
    addTrack(c, t.xs, t.ys);
}
const columns: Array<[string, MoveStats]> = [["human (ref)", HUMAN_REFERENCE]];
if (values.human) {
    const h = emptyCounts();
    const data = JSON.parse(readFileSync(values.human, "utf8")) as Record<
        string,
        { x: (number | null)[]; y: (number | null)[] }
    >;
    for (const t of Object.values(data))
        addTrack(
            h,
            t.x.map((v) => v ?? Number.NaN),
            t.y.map((v) => v ?? Number.NaN),
            1,
        );
    columns.push(["human (file)", moveStats(h)]);
}
columns.push(["bots", moveStats(all)]);
for (const tier of ["beginner", "intermediate", "expert"]) {
    const c = byTier.get(tier);
    if (c) columns.push([tier, moveStats(c)]);
}
// by behaviour group: stretches of 2 s or more in one group
const GROUPS: Record<string, string> = { fight: "fight", flee: "flee", evade: "flee", disengage: "flee" };
const groups = new Map<string, MoveCounts>();
for (const t of tracks.values()) {
    let start = 0;
    for (let i = 1; i <= t.beh.length; i++) {
        const g = GROUPS[t.beh[start]] ?? "travel";
        if (i < t.beh.length && (GROUPS[t.beh[i]] ?? "travel") === g) continue;
        let c = groups.get(g);
        if (!c) groups.set(g, (c = emptyCounts()));
        addTrack(c, t.xs.slice(start, i + 1), t.ys.slice(start, i + 1));
        start = i;
    }
}
for (const [g, c] of groups) columns.push([g, moveStats(c)]);
const keys = Object.keys(HUMAN_REFERENCE) as Array<keyof MoveStats>;
console.log(`${"statistic".padEnd(18)}${columns.map(([n]) => n.padStart(14)).join("")}`);
for (const k of keys) console.log(`${k.padEnd(18)}${columns.map(([, s]) => s[k].toFixed(3).padStart(14)).join("")}`);
