// Per-player match telemetry of the anti-cheat (M8): combat counters fed by the simulation's CombatObserver (shots,
// bullet hits, headshots, kills by gun class), input-stream detectors fed by the session (aim snaps, constant aim
// deltas, input rate, movement key spam) and the suspicion score computed from them with AntiCheatThresholds.
// Nothing here trusts the client: every number comes from server-side events and the raw input messages.
import { type GunClass, gunClass } from "@rebirth/defs";
import type { PlayerInput } from "@rebirth/sim";
import { AimHistory, angleDeltaDeg, ConstantAimDetector, RateWindow, ramp } from "./aim.ts";
import type { AccuracyGroup, AntiCheatThresholds } from "./thresholds.ts";

/** Accuracy group of a gun class (special guns: potato cannon, bugle... are not scored). */
export function accuracyGroup(cls: GunClass | undefined): AccuracyGroup | null {
    switch (cls) {
        case "pistol":
        case "smg":
        case "assault":
        case "lmg":
            return "auto";
        case "dmr":
        case "sniper":
            return "precision";
        case "shotgun":
            return "shotgun";
        default:
            return null;
    }
}

export interface WeaponClassStats {
    /** trigger pulls */
    shots: number;
    /** bullets fired (pellets, Splinter side bullets) */
    bullets: number;
    /** bullets that struck an enemy player */
    bulletHits: number;
    /** shots with at least one bullet on an enemy player */
    shotHits: number;
    /** hits the server rolled as headshots (random: rules.headshotChance, so informational only) */
    headshots: number;
    damage: number;
    kills: number;
}

/** One gun shot, remembered per bullet until its bullets stop. */
export interface ShotRecord {
    playerId: number;
    cls: GunClass | undefined;
    /** largest aim step (degrees) right before the shot (AimHistory.maxRecentStepDeg) */
    snapDeg: number;
    /** the first shot after a pause (thresholds snap.openingGapMs): the shot that acquired a target */
    opening: boolean;
    /** a bullet of the shot hit an enemy */
    hit: boolean;
}

export type ComponentCode = "accuracy" | "snap" | "constant_aim" | "input_rate" | "move_spam";

export interface ScoreComponent {
    code: ComponentCode;
    /** 0..1 */
    value: number;
    /** points added to the score (value x weight) */
    points: number;
    /** human-readable evidence */
    detail: string;
}

export interface SuspicionScore {
    /** 0-100 */
    score: number;
    /** components above zero, largest first */
    components: ScoreComponent[];
}

export interface TelemetrySnapshot extends SuspicionScore {
    playerId: number;
    name: string;
    shots: number;
    bullets: number;
    bulletHits: number;
    /** bulletHits / bullets */
    accuracy: number;
    headshots: number;
    byClass: Partial<Record<GunClass, WeaponClassStats & { accuracy: number }>>;
    kills: number;
    /** shooter-to-victim distance of credited kills (world units) */
    killDistance: { avg: number; max: number };
    aim: {
        /** opening shots that hit an enemy at range (snap.minTargetDist or farther) */
        openingHits: number;
        /** ...of which right after an aim snap */
        snapHits: number;
        snapRatio: number;
        constantAimRuns: number;
        longestConstantRun: number;
    };
    input: {
        messages: number;
        peakPerSecond: number;
        spikeSeconds: number;
        peakMoveTogglesPerSecond: number;
        moveSpamSeconds: number;
    };
}

const round = (v: number, digits = 3) => Math.round(v * 10 ** digits) / 10 ** digits;

function emptyStats(): WeaponClassStats {
    return { shots: 0, bullets: 0, bulletHits: 0, shotHits: 0, headshots: 0, damage: 0, kills: 0 };
}

export class PlayerTelemetry {
    readonly playerId: number;
    name: string;
    /** client address (reports and bans need it; never sent to players) */
    ip: string;
    /** the player's socket closed (its stats stay for reports) */
    left = false;
    /**
     * Touch client (M8): its aim stick jumps straight to a new direction on every touch, so aim snaps are normal and
     * the snap component is not scored.
     */
    isMobile = false;
    private readonly th: AntiCheatThresholds;
    private readonly classes = new Map<GunClass | "other", WeaponClassStats>();
    private readonly aim = new AimHistory();
    private readonly constantAim: ConstantAimDetector;
    private readonly inputRate: RateWindow;
    private readonly moveToggles: RateWindow;
    private lastMove = -1;
    private messages = 0;
    private lastShotAt = Number.NEGATIVE_INFINITY;
    private openingHits = 0;
    private snapHits = 0;
    private kills = 0;
    private killDistSum = 0;
    private killDistMax = 0;

    constructor(playerId: number, name: string, ip: string, thresholds: AntiCheatThresholds) {
        this.playerId = playerId;
        this.name = name;
        this.ip = ip;
        this.th = thresholds;
        this.constantAim = new ConstantAimDetector(thresholds.constantAim);
        this.inputRate = new RateWindow(thresholds.inputRate.maxPerSecond);
        this.moveToggles = new RateWindow(thresholds.moveSpam.maxTogglesPerSecond);
    }

    private stats(cls: GunClass | undefined): WeaponClassStats {
        const key = cls ?? "other";
        let s = this.classes.get(key);
        if (!s) {
            s = emptyStats();
            this.classes.set(key, s);
        }
        return s;
    }

    /** One Input message (already sanitized: unit direction, clamped length) arriving at `now` (ms). */
    onInput(input: PlayerInput, now: number): void {
        this.messages++;
        this.inputRate.add(now);
        const angle = Math.atan2(input.toMouseDir.y, input.toMouseDir.x);
        const prev = this.aim.last;
        if (prev) this.constantAim.push(angleDeltaDeg(prev.angle, angle));
        this.aim.push({ t: now, angle, len: input.toMouseLen });
        const move =
            (input.moveLeft ? 1 : 0) | (input.moveRight ? 2 : 0) | (input.moveUp ? 4 : 0) | (input.moveDown ? 8 : 0);
        if (this.lastMove >= 0 && move !== this.lastMove) {
            let changed = move ^ this.lastMove;
            let n = 0;
            for (; changed; changed &= changed - 1) n++;
            this.moveToggles.add(now, n);
        }
        this.lastMove = move;
    }

    /** A shot of `weaponType` with `bullets` bullets at `now`: counted, and its snap measure taken. */
    onShot(weaponType: string, bullets: number, now: number): ShotRecord {
        const cls = gunClass(weaponType);
        const s = this.stats(cls);
        s.shots++;
        s.bullets += bullets;
        const { windowInputs, windowMs, minMouseLen, openingGapMs } = this.th.snap;
        const snapDeg = this.aim.maxRecentStepDeg(windowInputs, now - windowMs, minMouseLen);
        const opening = now - this.lastShotAt >= openingGapMs;
        this.lastShotAt = now;
        return { playerId: this.playerId, cls, snapDeg, opening, hit: false };
    }

    /** A bullet of `shot` struck an enemy `distance` units from where the bullet started. */
    onBulletHit(shot: ShotRecord, distance: number): void {
        const s = this.stats(shot.cls);
        s.bulletHits++;
        if (shot.hit) return;
        shot.hit = true;
        s.shotHits++;
        if (!shot.opening || distance < this.th.snap.minTargetDist) return;
        this.openingHits++;
        if (shot.snapDeg >= this.th.snap.angleDeg) this.snapHits++;
    }

    /** Damage this player dealt to an enemy with `weaponType`. */
    onDamage(weaponType: string, amount: number, headshot: boolean): void {
        const s = this.stats(gunClass(weaponType));
        s.damage += amount;
        if (headshot) s.headshots++;
    }

    onKill(weaponType: string, distance: number): void {
        this.kills++;
        this.killDistSum += distance;
        this.killDistMax = Math.max(this.killDistMax, distance);
        const cls = gunClass(weaponType);
        if (cls) this.stats(cls).kills++;
    }

    score(): SuspicionScore {
        const th = this.th;
        const w = th.weights;
        const components: ScoreComponent[] = [];
        const add = (code: ComponentCode, value: number, weight: number, detail: string) => {
            if (value > 0) components.push({ code, value: round(value), points: round(value * weight, 1), detail });
        };
        // accuracy: the most suspicious weapon group with enough bullets
        const groups = new Map<AccuracyGroup, { bullets: number; hits: number }>();
        for (const [cls, s] of this.classes) {
            const g = cls === "other" ? null : accuracyGroup(cls);
            if (!g) continue;
            const t = groups.get(g) ?? { bullets: 0, hits: 0 };
            t.bullets += s.bullets;
            t.hits += s.bulletHits;
            groups.set(g, t);
        }
        let best: { value: number; detail: string } | null = null;
        for (const [g, t] of groups) {
            const gth = th.accuracy[g];
            if (t.bullets < gth.minBullets || t.bullets === 0) continue;
            const acc = t.hits / t.bullets;
            const value = ramp(acc, gth.soft, gth.hard);
            if (!best || value > best.value) {
                best = { value, detail: `${g} accuracy ${(acc * 100).toFixed(0)}% over ${t.bullets} bullets` };
            }
        }
        if (best) add("accuracy", best.value, w.accuracy, best.detail);
        if (!this.isMobile && this.openingHits >= th.snap.minHits && this.openingHits > 0) {
            const ratio = this.snapHits / this.openingHits;
            add(
                "snap",
                ramp(ratio, th.snap.soft, th.snap.hard),
                w.snap,
                `${this.snapHits} of ${this.openingHits} opening hits right after a >=${th.snap.angleDeg} deg aim snap`,
            );
        }
        const runs = this.constantAim.runs;
        add(
            "constant_aim",
            th.constantAim.hardRuns > 0 ? Math.min(1, runs / th.constantAim.hardRuns) : 0,
            w.constantAim,
            `${runs} runs of ${th.constantAim.minRun} constant aim deltas (longest ${this.constantAim.longestRun})`,
        );
        add(
            "input_rate",
            ramp(this.inputRate.spikeSeconds, th.inputRate.soft, th.inputRate.hard),
            w.inputRate,
            `${this.inputRate.spikeSeconds} s above ${th.inputRate.maxPerSecond} inputs/s (peak ${this.inputRate.peak})`,
        );
        add(
            "move_spam",
            ramp(this.moveToggles.spikeSeconds, th.moveSpam.soft, th.moveSpam.hard),
            w.moveSpam,
            `${this.moveToggles.spikeSeconds} s above ${th.moveSpam.maxTogglesPerSecond} movement key changes/s`,
        );
        components.sort((a, b) => b.points - a.points);
        const total = components.reduce((sum, c) => sum + c.value * w[weightKey(c.code)], 0);
        return { score: Math.min(100, Math.round(total)), components };
    }

    snapshot(): TelemetrySnapshot {
        const byClass: TelemetrySnapshot["byClass"] = {};
        let shots = 0;
        let bullets = 0;
        let bulletHits = 0;
        let headshots = 0;
        for (const [cls, s] of this.classes) {
            shots += s.shots;
            bullets += s.bullets;
            bulletHits += s.bulletHits;
            headshots += s.headshots;
            if (cls !== "other") byClass[cls] = { ...s, damage: round(s.damage, 1), accuracy: accuracyOf(s) };
        }
        return {
            playerId: this.playerId,
            name: this.name,
            ...this.score(),
            shots,
            bullets,
            bulletHits,
            accuracy: bullets > 0 ? round(bulletHits / bullets) : 0,
            headshots,
            byClass,
            kills: this.kills,
            killDistance: {
                avg: this.kills > 0 ? round(this.killDistSum / this.kills, 1) : 0,
                max: round(this.killDistMax, 1),
            },
            aim: {
                openingHits: this.openingHits,
                snapHits: this.snapHits,
                snapRatio: this.openingHits > 0 ? round(this.snapHits / this.openingHits) : 0,
                constantAimRuns: this.constantAim.runs,
                longestConstantRun: this.constantAim.longestRun,
            },
            input: {
                messages: this.messages,
                peakPerSecond: this.inputRate.peak,
                spikeSeconds: this.inputRate.spikeSeconds,
                peakMoveTogglesPerSecond: this.moveToggles.peak,
                moveSpamSeconds: this.moveToggles.spikeSeconds,
            },
        };
    }
}

function accuracyOf(s: WeaponClassStats): number {
    return s.bullets > 0 ? round(s.bulletHits / s.bullets) : 0;
}

function weightKey(code: ComponentCode): keyof AntiCheatThresholds["weights"] {
    switch (code) {
        case "constant_aim":
            return "constantAim";
        case "input_rate":
            return "inputRate";
        case "move_spam":
            return "moveSpam";
        default:
            return code;
    }
}
