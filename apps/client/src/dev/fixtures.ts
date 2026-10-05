// Hand-made world for exercising the renderer without the simulation (/?fixture=1): a small island with a river,
// a few buildings (with their child obstacles), trees, bushes, crates and one player that walks at the
// original base speed (12 + 1 for fists) and faces the cursor. Not a simulation: no collisions.
import { math, type Vec2, v2 } from "@rebirth/core";
import { type BuildingDef, MapObjectDefs } from "@rebirth/defs";
import {
    type MapData,
    type MapObjectSpawn,
    type ObjectView,
    type PlayerInput,
    type PlayerView,
    SNAPSHOT_EVERY_TICKS,
    type Snapshot,
    TICK_HZ,
} from "@rebirth/sim";
import { type Transport, TransportEvents } from "../net/transport.ts";

const MOVE_SPEED = 13;
const PLAYER_ID = 1;

function heaviest(type: BuildingDef["mapObjects"][number]["type"]): string {
    if (typeof type === "string") return type;
    let best = "";
    let bestWeight = -1;
    for (const [id, w] of Object.entries(type)) {
        if (w > bestWeight) {
            best = id;
            bestWeight = w;
        }
    }
    return best;
}

function spawnWithChildren(out: MapObjectSpawn[], type: string, pos: Vec2, ori: number, nextId: () => number): void {
    const def = MapObjectDefs[type];
    if (!def) return;
    out.push({ id: nextId(), type, pos, ori, scale: 1, layer: 0 });
    if (def.type !== "building") return;
    for (const child of def.mapObjects) {
        const childType = heaviest(child.type);
        if (!childType) continue;
        const childOri = child.inheritOri === false ? child.ori : (child.ori + ori) % 4;
        const childPos = v2.add(pos, v2.rotate(child.pos, math.oriToRad(ori)));
        spawnWithChildren(out, childType, childPos, childOri, nextId);
    }
}

export function fixtureMap(): MapData {
    let id = 100;
    const nextId = () => id++;
    const objects: MapObjectSpawn[] = [];
    spawnWithChildren(objects, "house_red_01", { x: 140, y: 150 }, 0, nextId);
    spawnWithChildren(objects, "shack_01", { x: 95, y: 150 }, 1, nextId);
    spawnWithChildren(objects, "barn_01", { x: 150, y: 95 }, 0, nextId);
    const scatter: Array<[string, number, number]> = [
        ["tree_01", 110, 120],
        ["tree_01", 118, 112],
        ["tree_01", 170, 175],
        ["bush_01", 108, 104],
        ["bush_01", 125, 128],
        ["crate_01", 112, 92],
        ["crate_01", 117, 92],
        ["barrel_01", 122, 100],
        ["stone_01", 100, 124],
        ["stone_01", 180, 130],
        ["tree_01", 75, 180],
        ["tree_01", 185, 70],
    ];
    for (const [type, x, y] of scatter) objects.push({ id: nextId(), type, pos: { x, y }, ori: 0, scale: 1, layer: 0 });
    return {
        mapName: "main",
        seed: 1,
        width: 256,
        height: 256,
        shoreInset: 24,
        grassInset: 12,
        rivers: [
            {
                width: 6,
                looped: false,
                points: [
                    { x: 0, y: 40 },
                    { x: 80, y: 60 },
                    { x: 200, y: 50 },
                    { x: 256, y: 64 },
                ],
            },
        ],
        places: [{ name: "Fixture Town", pos: { x: 0.5, y: 0.45 } }],
        groundPatches: [],
        objects,
    };
}

function spawnToView(o: MapObjectSpawn): ObjectView | null {
    const def = MapObjectDefs[o.type];
    const base = { id: o.id, type: o.type, pos: o.pos, layer: o.layer };
    switch (def?.type) {
        case "obstacle":
            return {
                ...base,
                kind: "obstacle",
                ori: o.ori,
                scale: o.scale,
                healthT: 1,
                dead: false,
                door: def.door ? { open: false, locked: false, canUse: true } : undefined,
            };
        case "building":
            return {
                ...base,
                kind: "building",
                ori: o.ori,
                occupied: false,
                ceilingDead: false,
                ceilingDamaged: false,
            };
        case "structure":
            return { ...base, kind: "structure", ori: o.ori };
        case "decal":
            return { ...base, kind: "decal", ori: o.ori, scale: o.scale };
        default:
            return null;
    }
}

/** Transport over the fixture world: integrates the player's movement at TICK_HZ, snapshots every 3 ticks. */
export class FixtureTransport implements Transport {
    readonly map = fixtureMap();
    readonly events = new TransportEvents();
    private readonly statics: ObjectView[];
    private readonly player: PlayerView;
    private input: PlayerInput | null = null;
    private tick = 0;
    private acc = 0;
    private last = -1;
    private raf = 0;
    private closed = false;

    constructor() {
        this.statics = this.map.objects.map(spawnToView).filter((v): v is ObjectView => v !== null);
        this.player = {
            id: PLAYER_ID,
            kind: "player",
            type: "player",
            pos: { x: 128, y: 128 },
            layer: 0,
            dir: { x: 1, y: 0 },
            dead: false,
            downed: false,
            activeWeapon: "fists",
            outfit: "outfitBase",
            helmet: "helmet01",
            chest: "chest01",
            backpack: "backpack02",
            scale: 1,
        };
        queueMicrotask(() => {
            if (this.closed) return;
            this.events.emitJoin(this.map, PLAYER_ID);
            this.events.emitSnapshot(this.snapshot(true));
            this.raf = requestAnimationFrame(this.frame);
        });
    }

    onJoin(cb: Parameters<Transport["onJoin"]>[0]): void {
        this.events.onJoin(cb);
    }

    onSnapshot(cb: Parameters<Transport["onSnapshot"]>[0]): void {
        this.events.onSnapshot(cb);
    }

    sendInput(input: PlayerInput): void {
        this.input = input;
    }

    /** the fixture has no match: nobody dies, nothing to spectate */
    spectate(): void {}

    close(): void {
        this.closed = true;
        cancelAnimationFrame(this.raf);
        this.events.clear();
    }

    private snapshot(full: boolean): Snapshot {
        return {
            tick: this.tick,
            time: this.tick / TICK_HZ,
            localPlayerId: PLAYER_ID,
            local: { health: 100, boost: 0, zoom: 28, layer: 0, weapons: [], curWeapIdx: 2, inventory: {} },
            objects: full ? [...this.statics, { ...this.player }] : [{ ...this.player }],
            deletedIds: [],
        };
    }

    private step(): void {
        const input = this.input;
        this.tick++;
        if (!input) return;
        const move = {
            x: (input.moveRight ? 1 : 0) - (input.moveLeft ? 1 : 0),
            y: (input.moveUp ? 1 : 0) - (input.moveDown ? 1 : 0),
        };
        const dir = v2.normalizeSafe(move, { x: 0, y: 0 });
        this.player.pos = v2.add(this.player.pos, v2.mul(dir, MOVE_SPEED / TICK_HZ));
        this.player.dir = v2.normalizeSafe(input.toMouseDir, this.player.dir);
    }

    private readonly frame = (now: number): void => {
        if (this.closed) return;
        this.acc += this.last < 0 ? 0 : Math.min((now - this.last) / 1000, 0.25);
        this.last = now;
        for (let n = 0; this.acc >= 1 / TICK_HZ && n < 25; n++) {
            this.acc -= 1 / TICK_HZ;
            this.step();
            if (this.tick % SNAPSHOT_EVERY_TICKS === 0) this.events.emitSnapshot(this.snapshot(false));
        }
        this.raf = requestAnimationFrame(this.frame);
    };
}
