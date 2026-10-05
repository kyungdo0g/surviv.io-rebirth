// Door panel animation and sounds (survev client/src/objects/obstacle.ts door state; docs/research/mechanics/
// doors-layers-ceilings.md "Door behaviour"). The simulation moves a door at once (a hinged door turns a quarter around
// its hinge, a sliding door moves by `slideOffset`); the client moves the drawn panel towards it at the def's
// `openSpeed` (units per second, and pi x openSpeed radians per second for the swing), linearly like the original.
// A new interaction (`door.seq`) plays `sound.change` (a vault door starting its delayed opening), every open/close
// plays `sound.open` / `sound.close`, and a scheduled unlock plays `sound.unlock` when the def has one. The casing
// (vault frame) stays where the closed door is.
import { math, type Vec2, v2 } from "@rebirth/core";
import type { ObstacleDef } from "@rebirth/defs";
import type { ObstacleView } from "@rebirth/sim";
import type { AudioEngine } from "../audio/audio.ts";

type DoorDef = NonNullable<ObstacleDef["door"]>;

/** shortest signed difference b - a in (-PI, PI] */
function angleDiff(a: number, b: number): number {
    const d = (b - a) % (Math.PI * 2);
    return d > Math.PI ? d - Math.PI * 2 : d < -Math.PI ? d + Math.PI * 2 : d;
}

export class DoorAnim {
    private readonly def: DoorDef;
    /** drawn panel position and rotation (radians, counter-clockwise) */
    pos: Vec2;
    rot: number;
    /** where the closed door is (the casing follows it) */
    closedPos: Vec2;
    private targetPos: Vec2;
    private targetRot: number;
    private open: boolean;
    private locked: boolean;
    private seq: number;

    constructor(def: DoorDef, view: ObstacleView) {
        this.def = def;
        this.pos = v2.copy(view.pos);
        this.rot = math.oriToRad(view.ori);
        this.targetPos = v2.copy(view.pos);
        this.targetRot = this.rot;
        this.open = view.door?.open ?? false;
        this.locked = view.door?.locked ?? false;
        this.seq = view.door?.seq ?? 0;
        this.closedPos = this.closedPosOf(view);
    }

    /** the closed position: an open sliding door slid by slideOffset along its local -y (survev updateData) */
    private closedPosOf(view: ObstacleView): Vec2 {
        if (!view.door?.open || !this.def.slideToOpen) return v2.copy(view.pos);
        const offset = v2.rotate({ x: this.def.slideOffset, y: 0 }, math.oriToRad(view.ori) + Math.PI * 0.5);
        return v2.add(view.pos, offset);
    }

    /** whether the panel is still moving (tests) */
    get moving(): boolean {
        return v2.distance(this.pos, this.targetPos) > 1e-4 || Math.abs(angleDiff(this.rot, this.targetRot)) > 1e-4;
    }

    /** A new snapshot of the door: retarget the panel and play the state sounds (not for doors just seen). */
    setData(view: ObstacleView, audio: AudioEngine | undefined, isNew: boolean): void {
        const door = view.door;
        this.targetPos = v2.copy(view.pos);
        this.targetRot = math.oriToRad(view.ori);
        if (!door) return;
        this.closedPos = this.closedPosOf(view);
        if (isNew) {
            this.pos = v2.copy(view.pos);
            this.rot = this.targetRot;
        }
        const sound = this.def.sound as DoorDef["sound"] & { unlock?: string };
        const play = (name: string | undefined) =>
            audio?.playSound(name, { channel: "sfx", pos: view.pos, layer: view.layer, filter: "muffled" });
        const seq = door.seq ?? 0;
        if (!isNew && seq !== this.seq && sound.change) play(sound.change);
        if (!isNew && door.open !== this.open) play(door.open ? sound.open : sound.close);
        if (!isNew && this.locked && !door.locked && sound.unlock) play(sound.unlock);
        this.seq = seq;
        this.open = door.open;
        this.locked = door.locked;
    }

    update(dt: number): void {
        const speed = this.def.openSpeed;
        const diff = v2.sub(this.targetPos, this.pos);
        const len = v2.length(diff);
        const step = Math.min(len, speed * dt);
        if (len > 1e-4) this.pos = v2.add(this.pos, v2.mul(diff, step / len));
        else this.pos = v2.copy(this.targetPos);
        const ang = angleDiff(this.rot, this.targetRot);
        const angStep = Math.sign(ang) * Math.PI * speed * dt;
        this.rot += Math.abs(ang) < Math.abs(angStep) ? ang : angStep;
    }
}
