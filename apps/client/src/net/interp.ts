// Interpolation of object positions (and player facing) between the last two snapshots, like the original client
// (survev client/src/objects/player.ts: visualPosOld -> pos over camera.m_interpInterval). Objects are drawn one
// snapshot interval in the past, so motion is smooth regardless of the frame rate.
import type { Vec2 } from "@rebirth/core";
import type { Snapshot } from "@rebirth/sim";

interface Track {
    prev: Vec2;
    cur: Vec2;
    prevAngle: number;
    curAngle: number;
    hasDir: boolean;
}

/** shortest signed difference b - a in (-PI, PI] */
function angleDiff(a: number, b: number): number {
    const d = (b - a) % (Math.PI * 2);
    return d > Math.PI ? d - Math.PI * 2 : d < -Math.PI ? d + Math.PI * 2 : d;
}

export class SnapshotInterpolator {
    private readonly tracks = new Map<number, Track>();
    /** wall-clock time (s) the latest snapshot arrived */
    private recvTime = 0;
    private lastSimTime = -1;
    /** interpolation interval (s): simulation time between the last two snapshots */
    interval = 0.03;
    enabled = true;

    /** Records the snapshot's object positions; `now` is the wall-clock time in seconds. */
    push(s: Snapshot, now: number): void {
        if (this.lastSimTime >= 0 && s.time > this.lastSimTime) {
            this.interval = Math.min(0.25, Math.max(0.005, s.time - this.lastSimTime));
        }
        this.lastSimTime = s.time;
        this.recvTime = now;
        const seen = new Set<number>();
        for (const obj of s.objects) {
            seen.add(obj.id);
            const angle = obj.kind === "player" ? Math.atan2(obj.dir.y, obj.dir.x) : 0;
            const track = this.tracks.get(obj.id);
            if (!track) {
                const pos = { x: obj.pos.x, y: obj.pos.y };
                this.tracks.set(obj.id, {
                    prev: pos,
                    cur: pos,
                    prevAngle: angle,
                    curAngle: angle,
                    hasDir: obj.kind === "player",
                });
                continue;
            }
            track.prev = track.cur;
            track.cur = { x: obj.pos.x, y: obj.pos.y };
            track.prevAngle = track.curAngle;
            track.curAngle = angle;
        }
        // objects absent from this snapshot stop moving instead of replaying their last step
        for (const [id, track] of this.tracks) {
            if (seen.has(id)) continue;
            track.prev = track.cur;
            track.prevAngle = track.curAngle;
        }
        for (const id of s.deletedIds) this.tracks.delete(id);
    }

    /** blend factor between the previous and the latest snapshot at wall-clock time `now` */
    alpha(now: number): number {
        if (!this.enabled) return 1;
        return Math.min(1, Math.max(0, (now - this.recvTime) / this.interval));
    }

    pos(id: number, now: number, fallback: Vec2): Vec2 {
        const track = this.tracks.get(id);
        if (!track) return fallback;
        const t = this.alpha(now);
        return {
            x: track.prev.x + (track.cur.x - track.prev.x) * t,
            y: track.prev.y + (track.cur.y - track.prev.y) * t,
        };
    }

    dir(id: number, now: number, fallback: Vec2): Vec2 {
        const track = this.tracks.get(id);
        if (!track?.hasDir) return fallback;
        const a = track.prevAngle + angleDiff(track.prevAngle, track.curAngle) * this.alpha(now);
        return { x: Math.cos(a), y: Math.sin(a) };
    }

    delete(id: number): void {
        this.tracks.delete(id);
    }

    clear(): void {
        this.tracks.clear();
        this.lastSimTime = -1;
    }
}
