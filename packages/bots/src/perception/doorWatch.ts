// Doors as a player perceives them (BrainFeatures.doors): their state as the snapshots show it, and the two things a
// door tells a human about other players.
// - "heard": a door in the snapshot opens, closes or is used (ObstacleView.door seq) while it stays in the snapshot. The
//   original client plays the door's sound for exactly that (apps/client/src/objects/door.ts setData: no sound for a
//   door just streamed in), on the sfx channel whose range is 48 units (sound-defs.json channels.sfx.maxRange), so the
//   change counts only while the door was in the snapshot at the previous observation too and lies within that range
//   (or is drawn on the screen, where the panel is seen moving).
// - "passed": a door on the screen (drawn, perception/drawn.ts: on the bot's floor, inside the 16:9 screen and not under
//   a roof the bot is not under) stands open while the bot last saw or heard it closed, or closed while it was open:
//   someone used it while the bot was away. A door of the other floor is never seen (the client fades that floor out),
//   only heard.
// What the bot believes about a door (its state) comes only from those two sources, never from a door in the
// snapshot's margin that it neither sees nor hears change. Who caused a change is decided by the caller (the brain:
// itself, a teammate, an enemy in view, or nobody it can see). Closed shapes come from MapData (the minimap knows every
// door's spawn) or from the first sighting of the door closed. Pure perception: no rng.
import { type Collider, type Vec2, v2 } from "@rebirth/core";
import type { MapData, MapObjectSpawn } from "@rebirth/sim";
import { colliderCenter, obstacleDef } from "../geom.ts";
import { type DoorShape, doorShape } from "../nav/doorGeom.ts";
import { drawnObstacle } from "./drawn.ts";
import type { SeenObstacle, WorldModel } from "./world.ts";

/** Range of the door sounds (sfx channel maxRange, apps/client/src/generated/sound-defs.json). */
export const DOOR_SOUND_RANGE = 48;
/** Events older than this are dropped. */
const EVENT_MEMORY = 30;

export type DoorCause = "self" | "team" | "enemy" | "unknown";

export interface DoorEvent {
    kind: "heard" | "passed";
    /** door obstacle id */
    id: number;
    /** the door's middle as it stands now */
    pos: Vec2;
    time: number;
    /** the door's state after the change */
    open: boolean;
    cause: DoorCause;
}

interface DoorRecord {
    open: boolean;
    seq: number;
    /** the collider at the last observation (where the panel was before a change) */
    col: Collider;
    /** observation index when the door was last in the snapshot */
    present: number;
    /** the state the bot believes (last seen on screen or heard), null before either */
    belief: boolean | null;
}

const spawnCache = new WeakMap<MapData, Map<number, MapObjectSpawn>>();

/** The MapData spawns of every door obstacle by id (shared by the bots of a map). */
function doorSpawns(map: MapData): Map<number, MapObjectSpawn> {
    let m = spawnCache.get(map);
    if (!m) {
        m = new Map();
        for (const o of map.objects) if (obstacleDef(o.type)?.door) m.set(o.id, o);
        spawnCache.set(map, m);
    }
    return m;
}

export class DoorWatch {
    private readonly records = new Map<number, DoorRecord>();
    private readonly shapes = new Map<number, DoorShape | null>();
    private count = 0;
    /** recent events, oldest first (EVENT_MEMORY) */
    readonly events: DoorEvent[] = [];

    /** The door's state the bot believes in (seen or heard), undefined when it knows nothing about it. */
    belief(id: number): boolean | undefined {
        return this.records.get(id)?.belief ?? undefined;
    }

    /** The door as it stands closed: from MapData, else from a sighting of it closed (null: unknown or no box). */
    shape(model: WorldModel, o: SeenObstacle): DoorShape | null {
        const id = o.view.id;
        const known = this.shapes.get(id);
        if (known !== undefined) return known;
        const sp = doorSpawns(model.map).get(id);
        let shape: DoorShape | null = null;
        if (sp && sp.type === o.view.type) shape = doorShape(id, o.def, sp.pos, sp.ori, sp.scale);
        else if (o.view.door && !o.view.door.open) shape = doorShape(id, o.def, o.view.pos, o.view.ori, o.view.scale);
        else return null;
        this.shapes.set(id, shape);
        return shape;
    }

    /**
     * Takes in the doors of the current snapshot (once per decision): returns the new events. `cause` names who changed a
     * door the bot heard or found changed (`before`: its collider before the change, when the bot saw it last).
     */
    observe(model: WorldModel, cause: (o: SeenObstacle, before: Collider) => DoorCause): DoorEvent[] {
        const now = model.time;
        const prev = this.count++;
        const fresh: DoorEvent[] = [];
        // (a door of the other floor is not drawn: the bot on the surface never saw the bathhouse vault open below it)
        const drawn = (o: SeenObstacle): boolean => drawnObstacle(model, o, this.shape(model, o)?.normal);
        for (const o of model.obstacles) {
            const door = o.view.door;
            if (!door || !o.def.door || o.view.dead) continue;
            const id = o.view.id;
            this.shape(model, o);
            const rec = this.records.get(id);
            const seq = door.seq ?? 0;
            if (!rec) {
                const seen = drawn(o);
                const belief = seen ? door.open : null;
                this.records.set(id, { open: door.open, seq, col: o.col, present: this.count, belief });
                continue;
            }
            // (an automatic door closing by itself, without a new use, tells nothing: everyone knows they do)
            const auto = o.def.door.autoClose;
            const changed = !(auto && !door.open && rec.seq === seq) && (rec.seq !== seq || rec.open !== door.open);
            const pos = colliderCenter(o.col);
            const live = rec.present === prev && changed;
            if (live && (v2.distance(pos, model.self.pos) <= DOOR_SOUND_RANGE || drawn(o))) {
                // heard (the door's sound played: it stayed in the snapshot) or seen moving on the screen
                fresh.push({ kind: "heard", id, pos, time: now, open: door.open, cause: cause(o, rec.col) });
                rec.belief = door.open;
            } else if (drawn(o)) {
                if (rec.belief !== null && rec.belief !== door.open && !(auto && !door.open)) {
                    fresh.push({ kind: "passed", id, pos, time: now, open: door.open, cause: cause(o, rec.col) });
                }
                rec.belief = door.open;
            }
            rec.open = door.open;
            rec.seq = seq;
            rec.col = o.col;
            rec.present = this.count;
        }
        for (const e of fresh) this.events.push(e);
        while (this.events.length && now - this.events[0].time > EVENT_MEMORY) this.events.shift();
        return fresh;
    }
}
