// Gas compared with the survev oracle (tools/oracle/fixtures/gas.json: survev's gas on the main map with our data).
// The oracle game starts once two players were alive for minActiveTime; time 0 is that tick. A probe stands in
// the map corner farthest from the zone centre (re-teleported every tick) and its gas hits are recorded. The safe
// circle centres are random, so the oracle's centres are fed through the Gas.chooseCenter hook; everything else
// (stage timing, radii, interpolation, the damage tick, the optional escalation ramp) is ours.
import { type Vec2, v2 } from "@rebirth/core";
import { DamageType, GameConfig, unscaledMapDef } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { Game, type GenerateMapResult, generateMap, type Player } from "../src/index.ts";
import { hasFixture, loadFixture, Mismatches } from "./oracleHelpers.ts";

interface GasState {
    time: number | null;
    stage: number;
    mode: number;
    circleIdx: number;
    duration: number;
    damage: number;
    gasT: number;
    currentRad: number;
    radOld: number;
    radNew: number;
    currentPos: Vec2;
    posNew: Vec2;
}

interface GasFixture {
    mapSize: number;
    mapWidth: number;
    damageTickRate: number;
    lastStageEndsAt: number;
    stagesMatchOurGameConfig: boolean;
    stages: GasState[];
    samples: Array<GasState & { probeInGas?: boolean }>;
    probeDamage: Array<{
        time: number;
        damage: number;
        stageDamage: number;
        stage: number;
        circleIdx: number;
        timeInsideGas: number;
    }>;
}

interface Run {
    stages: GasState[];
    samples: Array<GasState & { probeInGas: boolean }>;
    damage: Array<{ time: number; damage: number; stageDamage: number; circleIdx: number; timeInsideGas: number }>;
    endTime: number | null;
}

const SAMPLE_TICKS = 500;
const CORNER_MARGIN = 2;
/** our stage timers count whole ticks; survev's float accumulation drifts by up to ~0.1 s over a game */
const STAGE_TIME_TOL = 0.1;

function stateOf(game: Game, time: number): GasState {
    const g = game.gas;
    return {
        time,
        stage: g.stage,
        mode: g.mode,
        circleIdx: g.circleIdx,
        duration: g.duration,
        damage: g.damage,
        gasT: g.gasT,
        currentRad: g.currentRad,
        radOld: g.radOld,
        radNew: g.radNew,
        currentPos: v2.copy(g.currentPos),
        posNew: v2.copy(g.posNew),
    };
}

let survevMainMap: GenerateMapResult | null = null;
/** survev's main map at its own size (720: the oracle ran there; ours is bigger, rebirth/mapScale.ts). */
function survevMain(): GenerateMapResult {
    survevMainMap ??= generateMap("main", 12345, 1, unscaledMapDef("main"));
    return survevMainMap;
}

/** Runs a whole gas cycle the way the oracle scenario does. */
function runGas(fx: GasFixture, ramp: boolean): Run {
    const gen = survevMain();
    const generation = { ...gen, objects: [], lootSpawns: [], mapData: { ...gen.mapData, objects: [] } };
    const game = new Game({ mapName: "main", seed: 71 }, { generation, spawnLoot: false });
    game.rules.gasDamageRamp = ramp;
    const { width, height } = game.mapData;
    // the oracle's safe circle centres
    game.gas.chooseCenter = (choice) => {
        const stage = fx.stages.find((s) => s.mode === 1 && s.circleIdx === choice.circleIdx);
        if (!stage) throw new Error(`no oracle circle ${choice.circleIdx}`);
        return stage.posNew;
    };
    // survev's float timeAlive needs 1001 ticks to reach minActiveTime (ours 1000): one idle tick aligns the
    // phase of the global 2 s damage grid (it runs from game creation) with the oracle's
    game.step();
    for (const dx of [-5, 5]) game.teleportPlayer(game.addPlayer(`center${dx}`), { x: width / 2 + dx, y: height / 2 });
    const probe: Player = game.getPlayer(game.addPlayer("probe"))!;
    game.teleportPlayer(probe.id, { x: CORNER_MARGIN, y: CORNER_MARGIN });

    let startTick = -1;
    const run: Run = { stages: [], samples: [], damage: [], endTime: null };
    const original = game.damagePlayer.bind(game);
    // record the probe's gas hits; nobody takes any damage (the oracle's players are god mode / capped)
    game.damagePlayer = (target, params) => {
        if (target === probe && params.damageType === DamageType.Gas && startTick >= 0) {
            run.damage.push({
                time: (game.tick + 1 - startTick) / 100,
                damage: params.amount,
                stageDamage: game.gas.damage,
                circleIdx: game.gas.circleIdx,
                timeInsideGas: probe.timeInsideGas,
            });
        }
        if (params.damageType !== DamageType.Gas && params.damageType !== DamageType.Airdrop) original(target, params);
    };
    const corners = [
        { x: CORNER_MARGIN, y: CORNER_MARGIN },
        { x: width - CORNER_MARGIN, y: CORNER_MARGIN },
        { x: CORNER_MARGIN, y: height - CORNER_MARGIN },
        { x: width - CORNER_MARGIN, y: height - CORNER_MARGIN },
    ];
    const farthest = () =>
        corners.reduce((best, c) =>
            v2.distance(c, game.gas.currentPos) > v2.distance(best, game.gas.currentPos) ? c : best,
        );

    for (let i = 0; i < 3000 && !game.started; i++) game.step();
    if (!game.started) throw new Error("the match did not start");
    startTick = game.tick;
    run.stages.push(stateOf(game, 0));
    run.samples.push({ ...stateOf(game, 0), probeInGas: game.gas.isInGas(probe.pos) });
    for (let i = 0; i < 60000 && run.endTime === null; i++) {
        game.teleportPlayer(probe.id, farthest());
        const stage = game.gas.stage;
        game.step();
        const t = (game.tick - startTick) / 100;
        if (game.gas.stage !== stage && game.gas.running) run.stages.push(stateOf(game, t));
        if (!game.gas.running) run.endTime = t;
        if ((game.tick - startTick) % SAMPLE_TICKS === 0) {
            run.samples.push({ ...stateOf(game, t), probeInGas: game.gas.isInGas(probe.pos) });
        }
    }
    return run;
}

const fixture = hasFixture("gas") ? loadFixture<GasFixture>("gas") : null;

describe.skipIf(!fixture)("gas vs survev oracle (gas.json)", () => {
    const fx = fixture!;
    const run = runGas(fx, true);

    it("uses the same stage table and map size", () => {
        expect(fx.stagesMatchOurGameConfig).toBe(true);
        expect(GameConfig.gas.stages.length).toBe(17);
        expect(GameConfig.gas.damageTickRate).toBe(fx.damageTickRate);
        const game = new Game({ mapName: "main", seed: 1 }, { generation: survevMain() });
        expect(game.gas.mapSize).toBe(fx.mapSize);
        // before the start: inactive, centred, radOld 0.85 and radNew 0.7425 of the map size
        const pre = fx.stages[0];
        expect(game.gas.mode).toBe(pre.mode);
        expect(game.gas.circleIdx).toBe(pre.circleIdx);
        expect(game.gas.radOld).toBeCloseTo(pre.radOld, 6);
        expect(game.gas.radNew).toBeCloseTo(pre.radNew, 6);
        expect(game.gas.currentPos).toEqual(pre.currentPos);
    });

    it("advances through every stage at the oracle's times with the same radii", () => {
        const m = new Mismatches();
        const oracle = fx.stages.slice(1);
        m.equal("stage count", run.stages.length, oracle.length);
        for (let i = 0; i < Math.min(oracle.length, run.stages.length); i++) {
            const o = oracle[i];
            const s = run.stages[i];
            const at = `stage ${o.stage}`;
            m.near(`${at} start time`, s.time, o.time, STAGE_TIME_TOL);
            m.equal(`${at} index`, s.stage, o.stage);
            m.equal(`${at} mode`, s.mode, o.mode);
            m.equal(`${at} circleIdx`, s.circleIdx, o.circleIdx);
            m.equal(`${at} duration`, s.duration, o.duration);
            m.equal(`${at} damage`, s.damage, o.damage);
            m.near(`${at} radOld`, s.radOld, o.radOld, 1e-6);
            m.near(`${at} radNew`, s.radNew, o.radNew, 1e-6);
            m.near(`${at} currentRad`, s.currentRad, o.currentRad, 1e-6);
            m.near(`${at} posNew.x`, s.posNew.x, o.posNew.x, 1e-6);
            m.near(`${at} posNew.y`, s.posNew.y, o.posNew.y, 1e-6);
            m.near(`${at} currentPos.x`, s.currentPos.x, o.currentPos.x, 1e-6);
            m.near(`${at} currentPos.y`, s.currentPos.y, o.currentPos.y, 1e-6);
        }
        m.near("last stage ends at", run.endTime, fx.lastStageEndsAt, STAGE_TIME_TOL);
        expect(m.list).toEqual([]);
        expect(m.checked).toBeGreaterThan(200);
    });

    it("matches the 5 s samples (radius and centre interpolation, progress, probe in gas)", () => {
        const m = new Mismatches();
        const boundaries = fx.stages.slice(1).map((s) => s.time ?? 0);
        const ours = new Map(run.samples.map((s) => [Math.round((s.time ?? 0) * 100), s]));
        let compared = 0;
        for (const o of fx.samples) {
            const s = ours.get(Math.round((o.time ?? 0) * 100));
            if (!s) {
                m.list.push(`no sample at ${o.time}`);
                continue;
            }
            compared++;
            const at = `t=${o.time}`;
            // the circle is continuous across stage changes; the stage index only away from a boundary
            m.near(`${at} currentRad`, s.currentRad, o.currentRad, 0.5);
            m.near(`${at} currentPos.x`, s.currentPos.x, o.currentPos.x, 0.5);
            m.near(`${at} currentPos.y`, s.currentPos.y, o.currentPos.y, 0.5);
            if (boundaries.some((b) => Math.abs(b - (o.time ?? 0)) <= STAGE_TIME_TOL)) continue;
            m.equal(`${at} stage`, s.stage, o.stage);
            m.equal(`${at} mode`, s.mode, o.mode);
            m.equal(`${at} circleIdx`, s.circleIdx, o.circleIdx);
            m.near(`${at} gasT`, s.gasT, o.gasT, 0.01);
            m.near(`${at} radNew`, s.radNew, o.radNew, 1e-6);
            if (o.probeInGas !== undefined) m.equal(`${at} probe in gas`, s.probeInGas, o.probeInGas);
        }
        expect(m.list).toEqual([]);
        expect(compared).toBe(fx.samples.length);
    });

    it("deals the oracle's gas damage on the same 2 s grid, escalation ramp included", () => {
        const m = new Mismatches();
        const oracle = fx.probeDamage;
        m.near("hit count", run.damage.length, oracle.length, 1);
        const n = Math.min(oracle.length, run.damage.length);
        for (let i = 0; i < n; i++) {
            const o = oracle[i];
            const s = run.damage[i];
            const at = `hit ${i} (t=${o.time})`;
            m.near(`${at} time`, s.time, o.time, 0.05);
            m.equal(`${at} stage damage`, s.stageDamage, o.stageDamage);
            m.equal(`${at} circleIdx`, s.circleIdx, o.circleIdx);
            m.near(`${at} timeInsideGas`, s.timeInsideGas, o.timeInsideGas, 0.05);
            m.near(`${at} damage`, s.damage, o.damage, 0.002 * o.damage + 0.01);
        }
        expect(m.list).toEqual([]);
        for (let i = 1; i < run.damage.length; i++) {
            expect(run.damage[i].time - run.damage[i - 1].time).toBeCloseTo(fx.damageTickRate, 6);
        }
    });

    it("without the escalation rule (0.8.82 default) every hit is the stage damage", () => {
        const plain = runGas(fx, false);
        expect(plain.damage.length).toBe(run.damage.length);
        for (const hit of plain.damage) expect(hit.damage).toBe(hit.stageDamage);
        expect(Math.max(...plain.damage.map((h) => h.damage))).toBe(22);
    });
});
