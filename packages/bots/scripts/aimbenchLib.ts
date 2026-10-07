// The aim bench (scripts/aimbench.ts): a duel range on the flat main terrain (no objects, no loot) where one bot fights
// a scripted target that never fights back. The target appears in the shooter's view at a given distance and a random
// bearing and stands still, strafes left-right (ADAD, 12 u/s, switching every 0.3-0.6 s) or walks across the line of
// fire. Measured from the moment the shooter first sees it: time to the first shot, time to the first hit, bullet hit
// rate and time to kill. Each trial is seeded and independent, so a cell's numbers replay exactly. The shooter plays
// its normal fight (it strafes, closes in with a shotgun), so the numbers compare aim models under the same brain.
// A cell's shooter is a difficulty preset or a skill level s (skill.ts skillParams(s, s): the tier calibration). Its
// view is the snapshot (the legacy cells and fixture: targets may sit in the margin outside the 16:9 screen, timed
// from the model's first sighting) or the human screen (targets inside the true 16:9 screen, timed from the tick they
// show on it: perception/sight.ts).
import { createRng, type Rng, type Vec2, v2 } from "@rebirth/core";
import { getDefOfType, WeaponSlot } from "@rebirth/defs";
import {
    type Bullet,
    type CombatObserver,
    emptyInput,
    Game,
    type GenerateMapResult,
    generateMap,
    type Player,
    SNAPSHOT_EVERY_TICKS,
    TICK_HZ,
    VIEW_ASPECT,
    VIEW_MARGIN,
} from "@rebirth/sim";
import { BRAIN_PRESETS, type BrainFeatures, DEFAULT_BRAIN } from "../src/brain/features.ts";
import { BotController } from "../src/controller.ts";
import { DIFFICULTY_PRESETS, type Difficulty, type DifficultyParams, type MotorModel } from "../src/difficulty.ts";
import { onHumanScreen } from "../src/perception/sight.ts";
import { skillParams } from "../src/skill.ts";

export const BENCH_GUNS = ["ak47", "m9", "mosin", "m870"] as const;
export const BENCH_DISTANCES = [10, 20, 35] as const;
export const BENCH_SCOPES = ["1xscope", "4xscope"] as const;
export const BENCH_PATTERNS = ["stationary", "strafe", "cross"] as const;
/** The tier calibration's guns (design 4.2: three pistols, an SMG, a rifle, a shotgun, a sniper, a DMR, an LMG). */
export const TIER_GUNS = ["ot38", "m9", "glock", "mp5", "ak47", "m870", "mosin", "mk12", "m249"] as const;

export type BenchPattern = (typeof BENCH_PATTERNS)[number];
/** "snapshot": targets anywhere the snapshot reaches (legacy); "screen": inside the 16:9 screen only. */
export type BenchView = "snapshot" | "screen";

export interface BenchCell {
    difficulty: Difficulty;
    gun: string;
    distance: number;
    scope: string;
    pattern: BenchPattern;
    /** skill level s: the shooter is skillParams(s, s) instead of the preset (`difficulty` then only labels it) */
    skill?: number;
    /** default "snapshot" */
    view?: BenchView;
}

export interface TrialResult {
    /** the shooter saw the target */
    seen: boolean;
    /** seconds from first sight to the first shot / hit / kill (null: never within the trial) */
    firstShot: number | null;
    firstHit: number | null;
    ttk: number | null;
    bullets: number;
    hits: number;
}

/**
 * The shooter's brain: the default one without holstering. Alone in the warmup it would holster at once (nothing seen
 * yet) and every trial would time the draw as well; the bench measures the aim of a player with its gun out (the
 * first shot of a holstered bot waits for its reaction and then the draw: bot.ts gateReaction).
 */
const BENCH_BRAIN: Readonly<BrainFeatures> = Object.freeze({ ...BRAIN_PRESETS[DEFAULT_BRAIN], holster: false });

/** Trial length after the target appears (seconds). */
export const TRIAL_SECONDS = 8;
/** Shooter alone before the target appears (it starts exploring, its aim follows its walk). */
const WARMUP_TICKS = 60;

let generation: GenerateMapResult | null = null;
let arena: Vec2 | null = null;

function flatGeneration(): GenerateMapResult {
    if (!generation) {
        const gen = generateMap("main", 12345, 1);
        generation = { ...gen, objects: [], lootSpawns: [], mapData: { ...gen.mapData, objects: [] } };
    }
    return generation;
}

function flatGame(seed: number): Game {
    return new Game(
        { mapName: "main", seed, teamMode: 1 },
        { generation: flatGeneration(), spawnLoot: false, sandbox: true },
    );
}

/** A dry spot near the map centre with no water within 45 units (the same for every trial). */
function arenaSpot(game: Game): Vec2 {
    if (arena) return arena;
    const w = game.mapData.width;
    for (let r = 0; r < w / 2 && !arena; r += 7) {
        for (let a = 0; a < 16 && !arena; a++) {
            const p = {
                x: w / 2 + Math.cos((a / 16) * Math.PI * 2) * r,
                y: w / 2 + Math.sin((a / 16) * Math.PI * 2) * r,
            };
            let dry = true;
            for (let dx = -45; dx <= 45 && dry; dx += 3) {
                for (let dy = -45; dy <= 45 && dry; dy += 3) {
                    if (game.world.isOnWater({ x: p.x + dx, y: p.y + dy }, 0)) dry = false;
                }
            }
            if (dry) arena = p;
        }
    }
    if (!arena) throw new Error("no dry arena");
    return arena;
}

function place(game: Game, name: string, pos: Vec2): Player {
    const id = game.addPlayer(name);
    game.teleportPlayer(id, pos);
    const p = game.getPlayer(id);
    if (!p) throw new Error("player not added");
    p.input = { ...emptyInput(), toMouseDir: { x: 1, y: 0 } };
    return p;
}

/** Zoom radius of a scope (desktop zoom radii). */
function zoomOf(scope: string): number {
    return scope === "4xscope" ? 48 : 28;
}

/** Half extents of the visible area for a scope: the snapshot (sim viewBounds) or the human screen (no margin). */
function viewHalf(scope: string, view: BenchView = "snapshot"): Vec2 {
    const zoom = zoomOf(scope);
    const margin = view === "screen" ? 0 : VIEW_MARGIN;
    return { x: zoom + margin, y: zoom / VIEW_ASPECT + margin };
}

/** Whether a target `distance` away can be in view at all with `scope` (inside the view by 1.5 units). */
export function cellVisible(distance: number, scope: string, view: BenchView = "snapshot"): boolean {
    return distance < viewHalf(scope, view).x - 1.5;
}

/** A bearing that puts a target `distance` away inside the view with `scope` (rejection sampling). */
function bearing(rng: Rng, distance: number, scope: string, view: BenchView = "snapshot"): number {
    const half = viewHalf(scope, view);
    for (let i = 0; i < 200; i++) {
        const a = rng.range(0, Math.PI * 2);
        if (Math.abs(Math.cos(a) * distance) < half.x - 1.5 && Math.abs(Math.sin(a) * distance) < half.y - 1.5)
            return a;
    }
    return rng.bool() ? 0 : Math.PI;
}

/** Shooter parameters: the preset (or skill level s, g = s) with the motor model overridden (A/B runs). */
export function benchParams(difficulty: Difficulty, motor?: MotorModel, skill?: number): DifficultyParams {
    const p = skill === undefined ? DIFFICULTY_PRESETS[difficulty] : skillParams(skill, skill);
    return motor && motor !== p.motor.model ? { ...p, motor: { ...p.motor, model: motor } } : p;
}

/** Called every tick of a trial after the target appeared (diagnostics): the shooter's controller, the game, the target. */
export type TrialProbe = (bot: BotController, game: Game, target: Player) => void;

export function runTrial(cell: BenchCell, seed: number, motor?: MotorModel, probe?: TrialProbe): TrialResult {
    const out: TrialResult = { seen: false, firstShot: null, firstHit: null, ttk: null, bullets: 0, hits: 0 };
    const view = cell.view ?? "snapshot";
    if (!cellVisible(cell.distance, cell.scope, view)) return out;
    const game = flatGame(seed);
    const spot = arenaSpot(game);
    const rng = createRng(seed ^ 0x6b43a9b5);
    const shooter = place(game, "shooter", spot);
    const gun = getDefOfType("gun", cell.gun);
    shooter.weaponManager.setWeapon(WeaponSlot.Primary, cell.gun, gun.maxClip);
    shooter.backpack = "backpack02";
    shooter.inv.set(gun.ammo, shooter.inv.capacity(gun.ammo));
    shooter.weaponManager.setCurWeapIndex(WeaponSlot.Primary);
    shooter.weaponManager.weapons[WeaponSlot.Primary].cooldown = 0;
    if (cell.scope !== "1xscope") {
        shooter.inv.set(cell.scope, 1);
        shooter.scope = cell.scope;
    }
    const bot = new BotController(game, shooter.id, {
        seed,
        difficulty: benchParams(cell.difficulty, motor, cell.skill),
        brain: BENCH_BRAIN,
    });
    for (let i = 0; i < WARMUP_TICKS; i++) {
        bot.update();
        game.step();
    }

    const a = bearing(rng, cell.distance, cell.scope, view);
    const toTarget = { x: Math.cos(a), y: Math.sin(a) };
    const perp = v2.perp(toTarget);
    let start = v2.add(shooter.pos, v2.mul(toTarget, cell.distance));
    if (cell.pattern === "cross") start = v2.sub(start, v2.mul(perp, 4));
    const target = place(game, "target", start);
    let strafeSign = rng.bool() ? 1 : -1;
    let switchAt = game.time + rng.range(0.3, 0.6);

    const shots: number[] = [];
    let firstHitAt: number | null = null;
    const observer: CombatObserver = {
        onShotFired: (p: Player, _w: string, bullets: readonly Bullet[]) => {
            if (p.id !== shooter.id) return;
            shots.push(game.time);
            out.bullets += bullets.length;
        },
        onBulletHitPlayer: (b: Bullet, t: Player) => {
            if (b.shooterId !== shooter.id || t.id !== target.id) return;
            out.hits++;
            if (firstHitAt === null) firstHitAt = game.time;
        },
    };
    game.observer = observer;
    const end = game.time + TRIAL_SECONDS + SNAPSHOT_EVERY_TICKS / TICK_HZ;
    let killedAt: number | null = null;
    let seenAt: number | null = null;
    // human screen: timed from the first tick the target's body shows on the 16:9 screen
    let exposedAt: number | null = null;
    const zoom = zoomOf(cell.scope);
    while (game.time < end && killedAt === null && !shooter.dead) {
        // the strafing and crossing target walks with the touch stick: any direction at the base run speed (12 u/s)
        const input = { ...emptyInput(), toMouseDir: v2.neg(toTarget) };
        if (cell.pattern === "strafe") {
            if (game.time >= switchAt) {
                strafeSign = -strafeSign;
                switchAt = game.time + rng.range(0.3, 0.6);
            }
            Object.assign(input, { touchMoveActive: true, touchMoveLen: 255, touchMoveDir: v2.mul(perp, strafeSign) });
        } else if (cell.pattern === "cross") {
            Object.assign(input, { touchMoveActive: true, touchMoveLen: 255, touchMoveDir: perp });
        }
        game.setInput(target.id, input);
        if (exposedAt === null && onHumanScreen(shooter.pos, zoom, target.pos, 1)) exposedAt = game.time;
        bot.update();
        // the first sighting (the model forgets the contact once it sees it dead)
        if (seenAt === null) seenAt = bot.bot.model.contacts.get(target.id)?.firstSeen ?? null;
        game.step();
        probe?.(bot, game, target);
        if (target.dead) killedAt = game.time;
    }
    if (seenAt === null) return out;
    out.seen = true;
    if (view === "screen" && exposedAt !== null) seenAt = Math.min(seenAt, exposedAt);
    const after = shots.find((t) => t >= seenAt);
    out.firstShot = after !== undefined ? after - seenAt : null;
    out.firstHit = firstHitAt !== null ? Math.max(0, firstHitAt - seenAt) : null;
    out.ttk = killedAt !== null ? killedAt - seenAt : null;
    return out;
}

export interface CellStats {
    trials: number;
    /** trials in which the shooter saw the target */
    seen: number;
    /** fraction of seen trials with a shot / a hit / a kill */
    shotRate: number;
    hitTrialRate: number;
    killRate: number;
    /** mean and median seconds from first sight (over the trials where it happened) */
    firstShot: number | null;
    firstShotMedian: number | null;
    firstHit: number | null;
    ttk: number | null;
    ttkMedian: number | null;
    /** hits / bullets over all trials */
    hitRate: number | null;
    bullets: number;
    hits: number;
}

function meanOf(xs: number[]): number | null {
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function medianOf(xs: number[]): number | null {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const r4 = (v: number | null) => (v === null ? null : Math.round(v * 10000) / 10000);

export function summarize(trials: readonly TrialResult[]): CellStats {
    const seen = trials.filter((t) => t.seen);
    const shots = seen.flatMap((t) => (t.firstShot === null ? [] : [t.firstShot]));
    const hits = seen.flatMap((t) => (t.firstHit === null ? [] : [t.firstHit]));
    const kills = seen.flatMap((t) => (t.ttk === null ? [] : [t.ttk]));
    const bullets = seen.reduce((a, t) => a + t.bullets, 0);
    const hitCount = seen.reduce((a, t) => a + t.hits, 0);
    const n = Math.max(1, seen.length);
    return {
        trials: trials.length,
        seen: seen.length,
        shotRate: r4(seen.length ? shots.length / n : 0) ?? 0,
        hitTrialRate: r4(seen.length ? hits.length / n : 0) ?? 0,
        killRate: r4(seen.length ? kills.length / n : 0) ?? 0,
        firstShot: r4(meanOf(shots)),
        firstShotMedian: r4(medianOf(shots)),
        firstHit: r4(meanOf(hits)),
        ttk: r4(meanOf(kills)),
        ttkMedian: r4(medianOf(kills)),
        hitRate: bullets ? r4(hitCount / bullets) : null,
        bullets,
        hits: hitCount,
    };
}

/** Label of a cell's shooter: the preset name or "s0.15" for a skill level. */
export function shooterLabel(c: Pick<BenchCell, "difficulty" | "skill">): string {
    return c.skill === undefined ? c.difficulty : `s${c.skill}`;
}

export function cellKey(c: BenchCell): string {
    return `${shooterLabel(c)}/${c.gun}/${c.distance}/${c.scope.replace("scope", "")}/${c.pattern}`;
}

export function allCells(difficulties: readonly Difficulty[]): BenchCell[] {
    const out: BenchCell[] = [];
    for (const difficulty of difficulties)
        for (const gun of BENCH_GUNS)
            for (const distance of BENCH_DISTANCES)
                for (const scope of BENCH_SCOPES)
                    for (const pattern of BENCH_PATTERNS) out.push({ difficulty, gun, distance, scope, pattern });
    return out;
}

/** Options of a custom cell grid (scripts/aimbench.ts --skill / --guns / --patterns / --scope / --view). */
export interface CellGrid {
    shooters: ReadonlyArray<{ difficulty: Difficulty; skill?: number }>;
    guns: readonly string[];
    distances?: readonly number[];
    patterns: readonly BenchPattern[];
    /** "both": 1x and 4x at every distance (the stock grid); "auto": 4x from 30 units on, else 1x (design 4.2) */
    scopes: "both" | "auto";
    view: BenchView;
}

export function gridCells(g: CellGrid): BenchCell[] {
    const out: BenchCell[] = [];
    for (const sh of g.shooters)
        for (const gun of g.guns)
            for (const distance of g.distances ?? BENCH_DISTANCES) {
                const scopes = g.scopes === "both" ? BENCH_SCOPES : [distance >= 30 ? "4xscope" : "1xscope"];
                for (const scope of scopes)
                    for (const pattern of g.patterns)
                        out.push({
                            ...sh,
                            gun,
                            distance,
                            scope,
                            pattern,
                            ...(g.view !== "snapshot" ? { view: g.view } : {}),
                        });
            }
    return out;
}

/**
 * Seed of trial `k` of a cell (FNV-1a of the cell without its difficulty): every difficulty and motor model faces the
 * same bearings and target scripts, whatever subset of cells runs and on whichever worker.
 */
export function trialSeed(baseSeed: number, cell: BenchCell, k: number): number {
    let h = 0x811c9dc5;
    for (const ch of `${baseSeed}/${cell.gun}/${cell.distance}/${cell.scope}/${cell.pattern}/${k}`) {
        h ^= ch.charCodeAt(0);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h % 2147483647 || 1;
}

export interface AimSummary {
    /** mean seconds from first sight to the first shot / first hit / kill, over the cells that saw the target */
    firstShot: number | null;
    firstHit: number | null;
    ttk: number | null;
    /** pooled bullet hit rate */
    hitRate: number | null;
    killRate: number;
    trials: number;
}

/** The recorded baseline (test/fixtures/aim-baseline.json). */
export interface AimBaseline {
    version: 1;
    command: string;
    motor: MotorModel;
    seed: number;
    trialsPerCell: number;
    trialSeconds: number;
    /** by shooter label: a preset name (the fixture) or "s0.15" */
    summary: Partial<Record<string, AimSummary>>;
    cells: Record<string, CellStats>;
}

export function summarizeDifficulty(trials: readonly TrialResult[]): AimSummary {
    const s = summarize(trials);
    return {
        firstShot: s.firstShot,
        firstHit: s.firstHit,
        ttk: s.ttk,
        hitRate: s.hitRate,
        killRate: s.killRate,
        trials: s.seen,
    };
}
