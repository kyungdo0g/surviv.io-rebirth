// Red zone: the stage machine of GameConfig.gas.stages (inactive -> waiting -> moving -> waiting ...), circle
// interpolation, the choice of each next safe circle and the global damage tick.
// Behaviour follows docs/research/mechanics/gas.md (survev server/src/game/objects/gas.ts). Timers count whole
// ticks: a stage of `duration` seconds lasts round(duration * TICK_HZ) ticks, and the tick that starts the match
// already counts as the first tick of stage 1 (survev advances the stage, then adds that tick's dt).
import { math, type Rng, type Vec2, v2 } from "@rebirth/core";
import { GameConfig, GasMode, type GasStage } from "@rebirth/defs";
import { TICK_HZ } from "../api.ts";
import { randomPointInCircle } from "../mapgen/random.ts";
import type { GasModeName, GasView } from "../view.ts";

/** Zone radius before the start, as a fraction of the map size (survev gas.ts constructor: radOld 0.85). */
const PRE_START_RAD_OLD = 0.85;
/** The next centre is clamped so at least 75% of the circle radius stays inside the map (gas.md). */
const CENTER_CLAMP = 0.75;

const MODE_NAMES: readonly GasModeName[] = ["inactive", "waiting", "moving"];

/** What the centre of the next safe circle is chosen from. */
export interface CircleChoice {
    /** index of the circle being chosen */
    circleIdx: number;
    /** centre of the previous safe circle */
    prevPos: Vec2;
    radOld: number;
    radNew: number;
}

export class Gas {
    readonly width: number;
    readonly height: number;
    /** (width + height) / 2: stage radii are fractions of it */
    readonly mapSize: number;
    readonly stages: readonly GasStage[];
    /** GasMode value */
    mode: number = GasMode.Inactive;
    stage = 0;
    circleIdx = -1;
    duration: number;
    damage: number;
    posOld: Vec2;
    posNew: Vec2;
    currentPos: Vec2;
    radOld: number;
    radNew: number;
    currentRad: number;
    gasT = 0;
    /** advancing through the stages (false before the start and after the last stage) */
    running = false;
    /** true on the ticks where players in the gas take damage (every damageTickRate seconds since creation) */
    doDamage = false;
    /** called after circleIdx changed (plane, role and unlock schedules key off it) */
    onCircle: ((circleIdx: number) => void) | null = null;
    /** test hook: replaces the random choice of each next safe-circle centre (the result is still clamped) */
    chooseCenter: ((choice: CircleChoice) => Vec2) | null = null;
    private readonly rng: Rng;
    private ticker = 0;
    private durationTicks = 0;
    private damageTicker = 0;
    private readonly damageTickTicks: number;

    constructor(width: number, height: number, rng: Rng, stages: readonly GasStage[] = GameConfig.gas.stages) {
        this.width = width;
        this.height = height;
        this.mapSize = (width + height) / 2;
        this.stages = stages;
        this.rng = rng;
        this.damageTickTicks = Math.max(1, Math.round(GameConfig.gas.damageTickRate * TICK_HZ));
        const first = stages[0];
        this.posOld = { x: width / 2, y: height / 2 };
        this.posNew = v2.copy(this.posOld);
        this.currentPos = v2.copy(this.posOld);
        this.radOld = PRE_START_RAD_OLD * this.mapSize;
        this.radNew = first.rad * this.mapSize;
        this.currentRad = this.radNew;
        this.duration = first.duration;
        this.damage = first.damage;
    }

    /** The match started: the first circle begins (no-op once started). */
    start(): void {
        if (this.stage === 0) this.advance();
    }

    /** One tick: stage progress, interpolation while moving, stage changes, the damage tick. */
    update(): void {
        this.ticker++;
        if (this.running) {
            this.gasT = this.durationTicks > 0 ? math.clamp(this.ticker / this.durationTicks, 0, 1) : 1;
            if (this.mode === GasMode.Moving) {
                this.currentPos = v2.lerp(this.gasT, this.posOld, this.posNew);
                this.currentRad = math.lerp(this.gasT, this.radOld, this.radNew);
            }
            if (this.gasT >= 1) this.advance();
        }
        this.doDamage = false;
        if (++this.damageTicker >= this.damageTickTicks) {
            this.damageTicker = 0;
            this.doDamage = true;
        }
    }

    private advance(): void {
        this.stage++;
        this.running = true;
        const stage = this.stages[this.stage];
        if (!stage) {
            // past the last stage the zone stays closed and keeps dealing the last damage (gas.md)
            this.running = false;
            return;
        }
        this.mode = stage.mode;
        this.radOld = this.currentRad;
        this.radNew = stage.rad * this.mapSize;
        this.duration = stage.duration;
        this.durationTicks = Math.round(stage.duration * TICK_HZ);
        this.damage = stage.damage;
        const circleIdxOld = this.circleIdx;
        if (this.mode === GasMode.Waiting) {
            this.posOld = v2.copy(this.posNew);
            this.posNew = this.nextCenter();
            this.currentPos = v2.copy(this.posOld);
            this.currentRad = this.radOld;
            this.circleIdx++;
        }
        this.ticker = 0;
        this.gasT = 0;
        if (this.circleIdx !== circleIdxOld) this.onCircle?.(this.circleIdx);
    }

    /** Previous centre + a uniform point within radOld - radNew, clamped to keep 75% of the radius on the map. */
    private nextCenter(): Vec2 {
        const choice: CircleChoice = {
            circleIdx: this.circleIdx + 1,
            prevPos: v2.copy(this.posOld),
            radOld: this.radOld,
            radNew: this.radNew,
        };
        const pos = this.chooseCenter
            ? this.chooseCenter(choice)
            : v2.add(choice.prevPos, randomPointInCircle(this.rng, Math.max(0, this.radOld - this.radNew)));
        const r = this.radNew * CENTER_CLAMP;
        return {
            x: math.clamp(pos.x, r, Math.max(r, this.width - r)),
            y: math.clamp(pos.y, r, Math.max(r, this.height - r)),
        };
    }

    /** Whether `pos` is in the red zone: outside the current circle (player centre, no margin). */
    isInGas(pos: Vec2): boolean {
        return v2.distance(pos, this.currentPos) >= this.currentRad;
    }

    /** Whether `pos` is outside the next safe circle. */
    isOutsideSafeZone(pos: Vec2): boolean {
        return v2.distance(pos, this.posNew) >= this.radNew;
    }

    view(): GasView {
        return {
            mode: MODE_NAMES[this.mode] ?? "inactive",
            stage: this.stage,
            circleIdx: this.circleIdx,
            duration: this.duration,
            gasT: this.gasT,
            posOld: v2.copy(this.posOld),
            posNew: v2.copy(this.posNew),
            radOld: this.radOld,
            radNew: this.radNew,
            damage: this.damage,
        };
    }
}

/** The red-zone circle a GasView describes (the original client's gas.getCircle): old circle unless moving. */
export function gasCircle(gas: GasView): { pos: Vec2; rad: number } {
    const t = gas.mode === "moving" ? gas.gasT : 0;
    return { pos: v2.lerp(t, gas.posOld, gas.posNew), rad: math.lerp(t, gas.radOld, gas.radNew) };
}

/** Seconds left in the current gas stage (the HUD timer shows floor of it as m:ss). */
export function gasTimeLeft(gas: GasView): number {
    return Math.max(0, gas.duration * (1 - gas.gasT));
}
