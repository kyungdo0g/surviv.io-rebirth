// gas.json: main map, solo: gas stages, radius and damage over a whole game.
import type { Ctx, FixtureResult } from "../lib/context.ts";
import { Harness } from "../lib/harness.ts";
import { seeded } from "../lib/rng.ts";

const SAMPLE_SECONDS = 5;
const CAP = 1e6;

function gasState(g: any) {
    return {
        stage: g.stage,
        mode: g.mode,
        circleIdx: g.circleIdx,
        duration: g.duration,
        damage: g.damage,
        gasT: g.gasT,
        currentRad: g.currentRad,
        radOld: g.radOld,
        radNew: g.radNew,
        currentPos: { x: g.currentPos.x, y: g.currentPos.y },
        posNew: { x: g.posNew.x, y: g.posNew.y },
    };
}

export function gas(ctx: Ctx): FixtureResult {
    const { sv } = ctx;
    const h = new Harness(sv, { map: "main", teamMode: "solo", seed: 71, started: true });
    h.setMode(seeded(72), "random");
    const g = h.game.gas;
    const { width, height } = h.game.map;
    // two god-mode players keep the game running; a probe stands in the corner farthest from the gas centre
    for (const dx of [-5, 5]) {
        const p = h.addPlayer({ x: width / 2 + dx, y: height / 2 });
        p.debug.godMode = true;
    }
    const probe = h.addPlayer({ x: 2, y: 2 });
    const events = h.watchDamage(probe);
    const margin = 2;
    const corners = [
        { x: margin, y: margin },
        { x: width - margin, y: margin },
        { x: margin, y: height - margin },
        { x: width - margin, y: height - margin },
    ];
    const farthestCorner = () =>
        corners.reduce((best, c) =>
            Math.hypot(c.x - g.currentPos.x, c.y - g.currentPos.y) >
            Math.hypot(best.x - g.currentPos.x, best.y - g.currentPos.y)
                ? c
                : best,
        );

    const preStart = { time: null, ...gasState(g) };
    const startTick = h.stepUntil(() => h.game.started, Math.round(30 / h.dt));
    if (startTick === undefined) throw new Error("gas: the game did not start");
    const t = () => h.span(startTick, h.tick);
    const stages: unknown[] = [preStart, { time: 0, ...gasState(g) }];
    const samples: unknown[] = [{ time: 0, ...gasState(g) }];
    const damage: unknown[] = [];
    let endTime: number | null = null;

    h.withHealthCap(CAP, () => {
        probe.health = CAP;
        const sampleTicks = Math.round(SAMPLE_SECONDS / h.dt);
        const maxTicks = Math.round(600 / h.dt);
        for (let i = 0; i < maxTicks && g._running; i++) {
            h.teleport(probe, farthestCorner());
            const stage = g.stage;
            const seen = events.length;
            h.step();
            if (g.stage !== stage && g._running) stages.push({ time: t(), ...gasState(g) });
            if (!g._running) endTime = t();
            if ((h.tick - startTick) % sampleTicks === 0) {
                samples.push({ time: t(), probeInGas: g.isInGas(probe.pos), ...gasState(g) });
            }
            for (const e of events.slice(seen)) {
                if (e.damageType !== sv.GameConfig.DamageType.Gas) continue;
                damage.push({
                    time: t(),
                    damage: e.applied,
                    stageDamage: g.damage,
                    stage: g.stage,
                    circleIdx: g.circleIdx,
                    timeInsideGas: probe.timeInsideGas,
                });
            }
            probe.health = CAP;
        }
    });

    const measured = (stages as Array<ReturnType<typeof gasState>>).map((s) => ({
        mode: s.mode,
        duration: s.duration,
        rad: Math.round((s.radNew / g.mapSize) * 1e9) / 1e9,
        damage: s.damage,
    }));
    const ours = ctx.config.gas?.stages ?? [];
    return {
        params: {
            map: "main",
            teamMode: "solo",
            seed: "game created with seeded(71); gas circle placement uses seeded(72)",
            start: "time 0 = the tick the game started (2 players alive for GameConfig.player.minActiveTime)",
            probe:
                "test player teleported every tick to the map corner farthest from the gas centre; its health cap is " +
                "raised and reset after every hit, so gas damage is never clamped",
            sampleSeconds: SAMPLE_SECONDS,
        },
        data: {
            mapSize: g.mapSize,
            mapWidth: width,
            damageTickRate: sv.GameConfig.gas.damageTickRate,
            notes: [
                "gas damage per hit = stage damage * (1 + timeInsideGas * 0.025); timeInsideGas only grows while " +
                    "circleIdx > 2 and resets outside the gas (player.ts)",
                "radius values are absolute metres; stage rad fractions are radNew / mapSize",
            ],
            lastStageEndsAt: endTime,
            stagesMatchOurGameConfig: JSON.stringify(measured) === JSON.stringify(ours),
            stages,
            samples,
            probeDamage: damage,
        },
    };
}
