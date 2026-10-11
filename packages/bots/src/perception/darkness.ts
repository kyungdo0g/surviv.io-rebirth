// Seeing in the dark (the owner's wave 3, 2026-10-10: the abandoned subway station is pitch dark inside). The server
// sends a dark floor's players, loot and grenades like any others (the darkness is the client's overlay, apps/client
// fx/darkness.ts), so a bot reading its snapshot would see in the dark what no player can. While the bot stands in the
// dark it sees, as the overlay lets a player see (the light sizes are shared: defs rebirth/darkness.ts):
// - what lies within the dim glow round itself (PLAYER_LIGHT, the body's radius on top);
// - what a muzzle flash lights: SHOT_LIGHT round anyone who just fired, for its life plus one snapshot (a shot's
//   flash lasts 0.08 s; bots read a snapshot every tick or two);
// - what an explosion lights: EXPLOSION_LIGHT x its blast radius round it for 0.5 s (anything that deals damage, and
//   the flashbang's flash; not smoke or fruit splats, as the client's light skips them).
// Sound is not darkened: gunfire still reaches the threat board as before. Where it is dark is the client's rule
// (ObjectWorld.inDarkness): under the ceiling of a structure floor marked dark on that floor (stairs layers count as
// their floor), under the ceiling of a building marked dark, and on the stairs of a structure with a dark floor.
import type { Bounds, Vec2 } from "@rebirth/core";
import {
    EXPLOSION_LIGHT,
    GameConfig,
    GameObjectDefs,
    getMapObjectDef,
    hasDef,
    hasMapObjectDef,
    PLAYER_LIGHT,
    SHOT_LIGHT,
} from "@rebirth/defs";
import type { MapData, Snapshot } from "@rebirth/sim";
import { colliderBounds, rotateOri, transformCollider } from "../geom.ts";

const BODY = GameConfig.player.radius;
/** a flash is kept this much past its life: the next snapshot may come a tick or two later */
const SNAPSHOT_SLACK = 0.05;

interface DarkArea {
    /** the floor (layer & 1) it is dark on */
    floor: number;
    boxes: Bounds[];
    /** stairs boxes of a structure with a dark floor: dark on a stairs layer (2, 3) */
    stairs: Bounds[];
}

interface Light {
    pos: Vec2;
    radius: number;
    until: number;
}

const inBox = (p: Vec2, b: Bounds) => p.x >= b.min.x && p.x <= b.max.x && p.y >= b.min.y && p.y <= b.max.y;

function zoomBoxes(type: string, pos: Vec2, ori: number): Bounds[] {
    if (!hasMapObjectDef(type)) return [];
    const def = getMapObjectDef(type);
    if (def.type !== "building") return [];
    const out: Bounds[] = [];
    for (const z of def.ceiling.zoomRegions)
        if (z.zoomIn) out.push(colliderBounds(transformCollider(z.zoomIn, pos, ori, 1)));
    return out;
}

const areaCache = new WeakMap<MapData, DarkArea[]>();

/** The dark places of a map (empty on most maps; cached per map). */
export function darkAreas(map: MapData): DarkArea[] {
    const known = areaCache.get(map);
    if (known) return known;
    const out: DarkArea[] = [];
    for (const o of map.objects) {
        if (!hasMapObjectDef(o.type)) continue;
        const def = getMapObjectDef(o.type);
        if (def.type === "building" && def.dark) {
            out.push({ floor: o.layer & 1, boxes: zoomBoxes(o.type, o.pos, o.ori), stairs: [] });
        } else if (def.type === "structure" && def.layers.some((l) => l.dark)) {
            const stairs = def.stairs.map((s) => colliderBounds(transformCollider(s.collision, o.pos, o.ori, 1)));
            def.layers.forEach((l, i) => {
                if (!l.dark) return;
                const at = rotateOri(l.pos, o.ori);
                const pos = { x: o.pos.x + at.x, y: o.pos.y + at.y };
                out.push({ floor: i & 1, boxes: zoomBoxes(l.type, pos, (o.ori + l.ori) % 4), stairs });
            });
        }
    }
    areaCache.set(map, out);
    return out;
}

/** Whether an explosion of `type` gives light (anything that deals damage, and the flashbang's flash). */
function lightRadius(type: string): number {
    if (!hasDef(type)) return 0;
    const d = GameObjectDefs[type] as { type?: string; damage?: number; rad?: { max: number } };
    if (d.type !== "explosion" || !d.rad) return 0;
    return (d.damage ?? 0) > 0 || type === "explosion_flashbang" ? d.rad.max * EXPLOSION_LIGHT.radiusMult : 0;
}

/** A bot's sight in the dark: where it is dark, and the flashes of light its snapshots show (see the header). */
export class DarkVision {
    private readonly areas: DarkArea[];
    private lights: Light[] = [];
    private readonly shotSeq = new Map<number, number>();
    /** the bot stood in the dark at its latest snapshot */
    active = false;
    private selfPos: Vec2 = { x: 0, y: 0 };

    constructor(map: MapData) {
        this.areas = darkAreas(map);
    }

    /** The vision for a map with a dark place, null for a map without one. */
    static forMap(map: MapData): DarkVision | null {
        const v = new DarkVision(map);
        return v.areas.length > 0 ? v : null;
    }

    /** Whether `pos` on `layer` is in the dark. */
    inDark(pos: Vec2, layer: number): boolean {
        const floor = layer & 1;
        for (const a of this.areas) {
            if (a.floor === floor && a.boxes.some((b) => inBox(pos, b))) return true;
            if (layer & 2 && a.stairs.some((b) => inBox(pos, b))) return true;
        }
        return false;
    }

    /** One snapshot: the bot's own place, and the shots and explosions that light the dark now. */
    note(snap: Snapshot, selfPos: Vec2, selfLayer: number, now: number): void {
        this.selfPos = selfPos;
        this.active = this.inDark(selfPos, selfLayer);
        this.lights = this.lights.filter((l) => l.until >= now);
        for (const o of snap.objects) {
            if (o.kind !== "player") continue;
            const seq = o.shot?.seq ?? 0;
            const last = this.shotSeq.get(o.id);
            this.shotSeq.set(o.id, seq);
            if (last !== undefined && seq !== last && this.inDark(o.pos, o.layer))
                this.lights.push({
                    pos: o.pos,
                    radius: SHOT_LIGHT.radius,
                    until: now + SHOT_LIGHT.duration + SNAPSHOT_SLACK,
                });
        }
        for (const e of snap.explosions ?? []) {
            const radius = lightRadius(e.type);
            if (radius > 0 && this.inDark(e.pos, e.layer))
                this.lights.push({ pos: e.pos, radius, until: now + EXPLOSION_LIGHT.duration });
        }
    }

    /**
     * Whether something whose edge lies `rad` from its centre at `p` shows to the bot: always outside the dark; in the
     * dark only in the glow round itself or in a flash of light.
     */
    shows(p: Vec2, rad = BODY): boolean {
        if (!this.active) return true;
        const near = (c: Vec2, r: number) => (p.x - c.x) ** 2 + (p.y - c.y) ** 2 <= (r + rad) ** 2;
        if (near(this.selfPos, PLAYER_LIGHT.radius)) return true;
        return this.lights.some((l) => near(l.pos, l.radius));
    }
}
