// Player skeleton animation: bone poses, idle poses per weapon and the keyframed attack/throw animations, ported as
// data from the original client (survev client/src/animData.ts, the same values as the 0.8.82 bundle), plus the
// playback that blends an animation over the idle pose (survev player.ts playAnim/updateAnim).
// A pose's `pivot` is the bone's offset from the body centre in pixels: a hand container is drawn with
// pivot = -pose.pivot, rotation = pose.rot and position = pose.pos, so rotating a pose swings the hand around the
// body like a shoulder joint.
import type { Vec2 } from "@rebirth/core";
import { GameConfig, GameObjectDefs, type MeleeDef } from "@rebirth/defs";

export interface Pose {
    pivot: Vec2;
    rot: number;
    pos: Vec2;
}

export const Bone = { HandL: 0, HandR: 1, FootL: 2, FootR: 3, MeleeL: 4, MeleeR: 5 } as const;
export const BONE_COUNT = 6;

type BonePoses = Partial<Record<number, Pose>>;

function pose(x: number, y: number, rot = 0, pos: Vec2 = { x: 0, y: 0 }): Pose {
    return { pivot: { x, y }, rot, pos: { x: pos.x, y: pos.y } };
}

export const IDENTITY_POSE: Readonly<Pose> = pose(0, 0);

export function copyPose(out: Pose, src: Readonly<Pose>): void {
    out.pivot.x = src.pivot.x;
    out.pivot.y = src.pivot.y;
    out.rot = src.rot;
    out.pos.x = src.pos.x;
    out.pos.y = src.pos.y;
}

function lerpPose(out: Pose, t: number, a: Readonly<Pose>, b: Readonly<Pose>): void {
    out.pivot.x = a.pivot.x + (b.pivot.x - a.pivot.x) * t;
    out.pivot.y = a.pivot.y + (b.pivot.y - a.pivot.y) * t;
    out.rot = a.rot + (b.rot - a.rot) * t;
    out.pos.x = a.pos.x + (b.pos.x - a.pos.x) * t;
    out.pos.y = a.pos.y + (b.pos.y - a.pos.y) * t;
}

const H = Bone.HandL;
const R = Bone.HandR;

export const IDLE_POSES: Readonly<Record<string, BonePoses>> = {
    fists: { [H]: pose(14, -12.25), [R]: pose(14, 12.25) },
    slash: { [H]: pose(18, -8.25), [R]: pose(6, 20.25) },
    meleeTwoHanded: { [H]: pose(10.5, -14.25), [R]: pose(18, 6.25) },
    meleeKatana: { [H]: pose(8.5, 13.25), [R]: pose(-3, 17.75) },
    meleeNaginata: { [H]: pose(19, -7.25), [R]: pose(8.5, 24.25) },
    machete: { [H]: pose(14, -12.25), [R]: pose(1, 17.75) },
    cutlass: { [H]: pose(14, -12.25), [R]: pose(6, 16) },
    rifle: { [H]: pose(28, 5.25), [R]: pose(14, 1.75) },
    dualRifle: { [H]: pose(5.75, -16), [R]: pose(5.75, 16) },
    bullpup: { [H]: pose(28, 5.25), [R]: pose(24, 1.75) },
    minigun: { [H]: pose(18, 7.25), [R]: pose(54, 0) },
    launcher: { [H]: pose(20, 10), [R]: pose(2, 22) },
    pistol: { [H]: pose(14, 1.75), [R]: pose(14, 1.75) },
    dualPistol: { [H]: pose(15.75, -8.75), [R]: pose(15.75, 8.75) },
    throwable: { [H]: pose(15.75, -9.625), [R]: pose(15.75, 9.625) },
    downed: {
        [H]: pose(14, -12.25),
        [R]: pose(14, 12.25),
        [Bone.FootL]: pose(-15.75, -9),
        [Bone.FootR]: pose(-15.75, 9),
    },
};

export type AnimEffect =
    | { time: number; kind: "sound"; sound: string }
    | { time: number; kind: "melee"; playerHit?: string }
    | { time: number; kind: "throwableState"; state: "cook" | "throwing" };

interface Keyframe {
    time: number;
    bones: BonePoses;
    easing?: (t: number) => number;
}

export interface AnimDef {
    keyframes: Keyframe[];
    effects: AnimEffect[];
}

const frame = (time: number, bones: BonePoses, easing?: (t: number) => number): Keyframe => ({ time, bones, easing });
const PI = Math.PI;

function attack(type: string): MeleeDef["attack"] {
    return (GameObjectDefs[type] as MeleeDef).attack;
}

/** One-handed anims that follow the fists timing: swing sound at 0, hit at the first damage time. */
function fistTimed(frames: (dt: number, cd: number) => Keyframe[]): AnimDef {
    const a = attack("fists");
    return {
        keyframes: frames(a.damageTimes[0], a.cooldownTime),
        effects: [
            { time: 0, kind: "sound", sound: "swing" },
            { time: a.damageTimes[0], kind: "melee" },
        ],
    };
}

/** Two-handed swings: wind up to +rot, strike to -rot, swing sound and hit at the damage time. */
function twoHanded(type: string, l: Vec2, r: Vec2, windT: number, windRot: number, hitT: number, hitRot: number) {
    const a = attack(type);
    const dt = a.damageTimes[0];
    return {
        keyframes: [
            frame(0, { [H]: pose(l.x, l.y), [R]: pose(r.x, r.y) }),
            frame(dt * windT, { [H]: pose(l.x, l.y, windRot), [R]: pose(r.x, r.y, windRot) }),
            frame(dt * hitT, { [H]: pose(l.x, l.y, hitRot), [R]: pose(r.x, r.y, hitRot) }),
            frame(a.cooldownTime, { [H]: pose(l.x, l.y), [R]: pose(r.x, r.y) }),
        ],
        effects: [
            { time: dt, kind: "sound", sound: "swing" },
            { time: dt, kind: "melee" },
        ],
    } satisfies AnimDef;
}

function axeLike(type: string): AnimDef {
    const a = attack(type);
    const dt = a.damageTimes[0];
    return {
        keyframes: [
            frame(0, { [H]: pose(10.5, -14.25), [R]: pose(18, 6.25) }),
            frame(dt * 0.4, { [H]: pose(9, -14.25, PI * 0.4), [R]: pose(18, 6.25, PI * 0.4) }),
            frame(dt, { [H]: pose(9, -14.25, -PI * 0.4), [R]: pose(18, 6.25, -PI * 0.4) }),
            frame(a.cooldownTime, { [H]: pose(10.5, -14.25), [R]: pose(18, 6.25) }),
        ],
        effects: [
            { time: dt, kind: "sound", sound: "swing" },
            { time: dt, kind: "melee" },
        ],
    };
}

function buildAnimations(): Record<string, AnimDef> {
    const hook = attack("hook");
    const saw = attack("saw");
    const sawShort = saw.damageTimes[0];
    const fists = attack("fists");
    const throwTime = GameConfig.player.throwTime;
    const crawl = GameConfig.player.crawlTime;
    const crawlFrames = (mid1: [Vec2, Vec2], mid2: [Vec2, Vec2]): AnimDef => ({
        keyframes: [
            frame(0, { [H]: pose(14, -12.25), [Bone.FootL]: pose(-15.75, -9) }),
            frame(crawl * 0.33, { [H]: pose(mid1[0].x, mid1[0].y), [Bone.FootL]: pose(mid1[1].x, mid1[1].y) }),
            frame(crawl * 0.66, { [H]: pose(mid2[0].x, mid2[0].y), [Bone.FootL]: pose(mid2[1].x, mid2[1].y) }),
            frame(crawl, { [H]: pose(14, -12.25), [Bone.FootL]: pose(-15.75, -9) }),
        ],
        effects: [],
    });
    return {
        none: { keyframes: [], effects: [] },
        fists: fistTimed((dt, cd) => [
            frame(0, { [R]: pose(14, 12.25) }),
            frame(dt, { [R]: pose(29.75, 1.75) }),
            frame(cd, { [R]: pose(14, 12.25) }),
        ]),
        stab: fistTimed((dt, cd) => [
            frame(0, { [R]: pose(6, 20.25) }),
            frame(dt, { [R]: pose(29.75, 1.75) }),
            frame(cd, { [R]: pose(6, 20.25) }),
        ]),
        cut: fistTimed((dt, cd) => [
            frame(0, { [R]: pose(14, 12.25) }),
            frame(dt * 0.25, { [R]: pose(14, 12.25, -PI * 0.35) }),
            frame(dt * 1.25, { [R]: pose(14, 12.25, PI * 0.35) }),
            frame(cd, { [R]: pose(14, 12.25) }),
        ]),
        cutReverse: fistTimed((dt, cd) => [
            frame(0, { [R]: pose(1, 17.75) }),
            frame(dt * 0.4, { [R]: pose(25, 6.25, PI * 0.3) }),
            frame(dt * 1.4, { [R]: pose(25, 6.25, -PI * 0.5) }),
            frame(cd, { [R]: pose(1, 17.75) }),
        ]),
        thrust: fistTimed((dt, cd) => [
            frame(0, { [R]: pose(14, 12.25) }),
            frame(dt * 0.4, { [R]: pose(5, 12.25, PI * 0.1) }),
            frame(dt * 1.4, { [R]: pose(25, 6.25) }),
            frame(cd, { [R]: pose(14, 12.25) }),
        ]),
        slash: fistTimed((dt, cd) => [
            frame(0, { [H]: pose(18, -8.25), [R]: pose(6, 20.25) }),
            frame(dt, { [H]: pose(6, -22.25), [R]: pose(6, 20.25, -PI * 0.6) }),
            frame(cd, { [H]: pose(18, -8.25), [R]: pose(6, 20.25) }),
        ]),
        hook: {
            keyframes: [
                frame(0, { [R]: pose(14, 12.25) }),
                frame(hook.damageTimes[0] * 0.25, { [R]: pose(14, 12.25, PI * 0.1) }),
                frame(hook.damageTimes[0], { [R]: pose(24, 1.75) }),
                frame(hook.damageTimes[0] + 0.05, { [R]: pose(14, 12.25, -PI * 0.3) }),
                frame(hook.damageTimes[0] + 0.1, { [R]: pose(14, 12.25) }),
            ],
            effects: [
                { time: 0, kind: "sound", sound: "swing" },
                { time: hook.damageTimes[0], kind: "melee" },
            ],
        },
        pan: {
            keyframes: [
                frame(0, { [R]: pose(14, 12.25) }),
                frame(0.15, { [R]: pose(22, -8.25, -PI * 0.2) }),
                frame(0.25, { [R]: pose(28, -8.25, PI * 0.5) }),
                frame(0.55, { [R]: pose(14, 12.25) }),
            ],
            effects: [
                { time: 0, kind: "sound", sound: "swing" },
                { time: attack("pan").damageTimes[0], kind: "melee" },
            ],
        },
        axeSwing: axeLike("woodaxe"),
        hammerSwing: axeLike("stonehammer"),
        katanaSwing: twoHanded("katana", { x: 8.5, y: 13.25 }, { x: -3, y: 17.75 }, 0.3, PI * 0.2, 0.9, -PI * 1.2),
        naginataSwing: twoHanded("naginata", { x: 19, y: -7.25 }, { x: 8.5, y: 24.25 }, 0.3, PI * 0.3, 0.9, -PI * 0.85),
        sawSwing: {
            keyframes: [
                frame(0, { [R]: pose(1, 17.75) }),
                frame(sawShort * 0.4, { [R]: pose(25, 6.25, PI * 0.3) }),
                frame(sawShort, { [R]: pose(25, 6.25, -PI * 0.3) }),
                frame(saw.damageTimes[1] - 0.1, { [R]: pose(25, 17.75, -PI * 0.25) }),
                frame(saw.damageTimes[1] * 0.6, { [R]: pose(-36, 7.75, -PI * 0.25) }),
                frame(saw.damageTimes[1] + 0.2, { [R]: pose(1, 17.75) }),
            ],
            effects: [
                { time: 0, kind: "sound", sound: "swing" },
                { time: 0.4, kind: "sound", sound: "swing" },
                { time: saw.damageTimes[0], kind: "melee" },
                { time: saw.damageTimes[1], kind: "melee", playerHit: "playerHit2" },
            ],
        },
        cutReverseShort: {
            keyframes: [
                frame(0, { [R]: pose(1, 17.75) }),
                frame(sawShort * 0.4, { [R]: pose(25, 6.25, PI * 0.3) }),
                frame(sawShort, { [R]: pose(25, 6.25, -PI * 0.3) }),
                frame(fists.cooldownTime, { [R]: pose(14, 17.75) }),
            ],
            effects: [
                { time: 0, kind: "sound", sound: "swing" },
                { time: fists.damageTimes[0], kind: "melee" },
            ],
        },
        cook: {
            keyframes: [
                frame(0, { [H]: pose(15.75, -9.625), [R]: pose(15.75, 9.625) }),
                frame(0.1, { [H]: pose(14, -1.75), [R]: pose(14, 1.75) }),
                frame(0.3, { [H]: pose(14, -1.75), [R]: pose(14, 1.75) }),
                frame(0.4, { [H]: pose(22.75, -1.75), [R]: pose(1.75, 14) }),
                frame(99999, { [H]: pose(22.75, -1.75), [R]: pose(1.75, 14) }),
            ],
            effects: [
                { time: 0, kind: "sound", sound: "pullPin" },
                { time: 0.1, kind: "throwableState", state: "cook" },
            ],
        },
        throw: {
            keyframes: [
                frame(0, { [H]: pose(22.75, -1.75), [R]: pose(1.75, 14.175) }),
                frame(0.15, { [H]: pose(5.25, -15.75), [R]: pose(29.75, 1.75) }),
                frame(0.15 + throwTime, { [H]: pose(15.75, -9.625), [R]: pose(15.75, 9.625) }),
            ],
            effects: [
                { time: 0, kind: "sound", sound: "throwing" },
                { time: 0, kind: "throwableState", state: "throwing" },
            ],
        },
        crawl_forward: crawlFrames(
            [
                { x: 19.25, y: -10.5 },
                { x: -20.25, y: -9 },
            ],
            [
                { x: 5.25, y: -15.75 },
                { x: -11.25, y: -9 },
            ],
        ),
        crawl_backward: crawlFrames(
            [
                { x: 5.25, y: -15.75 },
                { x: -11.25, y: -9 },
            ],
            [
                { x: 19.25, y: -10.5 },
                { x: -20.25, y: -9 },
            ],
        ),
        revive: {
            keyframes: [
                frame(0, { [H]: pose(14, -12.25), [R]: pose(14, 12.25) }),
                frame(0.2, { [H]: pose(24.5, -8.75), [R]: pose(5.25, 21) }),
                frame(0.2 + GameConfig.player.reviveDuration, { [H]: pose(24.5, -8.75), [R]: pose(5.25, 21) }),
            ],
            effects: [],
        },
    };
}

export const ANIMATIONS: Readonly<Record<string, AnimDef>> = buildAnimations();

/** Plays one animation at a time over the idle pose (survev player.ts anim state). */
export class AnimPlayer {
    name = "none";
    mirror = false;
    ticker = 0;
    private readonly weights: number[] = new Array(BONE_COUNT).fill(0);
    private readonly poses: Pose[] = Array.from({ length: BONE_COUNT }, () => pose(0, 0));
    private readonly scratch = pose(0, 0);

    get active(): boolean {
        return this.name !== "none";
    }

    /** Starts `name` (unknown names stop the animation); `current` are the bones as drawn now. */
    play(name: string, mirror: boolean, current: readonly Pose[]): void {
        this.name = ANIMATIONS[name] ? name : "none";
        this.mirror = mirror;
        this.ticker = 0;
        for (let i = 0; i < BONE_COUNT; i++) {
            this.weights[i] = 0;
            copyPose(this.poses[i], current[i] ?? IDENTITY_POSE);
        }
    }

    stop(current: readonly Pose[]): void {
        this.play("none", false, current);
    }

    /** Advances the animation; `onEffect` runs for every effect whose time was crossed this frame. */
    update(dt: number, current: readonly Pose[], onEffect: (effect: AnimEffect) => void): void {
        if (!this.active) return;
        const anim = ANIMATIONS[this.name];
        const frames = anim.keyframes;
        const before = this.ticker;
        this.ticker += dt;
        let a = -1;
        let b = 0;
        while (this.ticker >= frames[b].time && b < frames.length - 1) {
            a++;
            b++;
        }
        a = Math.max(a, 0);
        const span = frames[b].time - frames[a].time;
        const t = span > 0 ? Math.min((this.ticker - frames[a].time) / span, 1) : 1;
        const easing = frames[b].easing;
        const lerpT = easing ? easing(t) : t;
        for (let i = 0; i < BONE_COUNT; i++) {
            const bone = this.mirror ? (i % 2 === 0 ? i + 1 : i - 1) : i;
            const fa = frames[a].bones[bone];
            const fb = frames[b].bones[bone];
            if (!fa || !fb) continue;
            this.weights[i] = a === b ? t : 1;
            lerpPose(this.poses[i], lerpT, fa, fb);
            if (this.mirror) {
                this.poses[i].pos.y *= -1;
                this.poses[i].pivot.y *= -1;
                this.poses[i].rot *= -1;
            }
        }
        const lastFrame = b === frames.length - 1 && Math.abs(t - 1) < 1e-6;
        const effectTicker = lastFrame ? this.ticker + 1 : this.ticker;
        for (const effect of anim.effects) {
            if (effect.time >= before && effect.time < effectTicker) onEffect(effect);
        }
        if (lastFrame) this.stop(current);
    }

    /** Writes the idle pose blended with the animation into `out` (survev "Compute blended bone positions"). */
    blend(idle: BonePoses, out: Pose[]): void {
        for (let i = 0; i < BONE_COUNT; i++) {
            const idlePose = idle[i] ?? IDENTITY_POSE;
            if (this.weights[i] > 0) {
                lerpPose(this.scratch, this.weights[i], idlePose, this.poses[i]);
                copyPose(out[i], this.scratch);
            } else {
                copyPose(out[i], idlePose);
            }
        }
    }
}
