// Keeps one render view per object id in sync with the snapshots, culls views outside the camera and updates
// the visible ones every frame with interpolated positions. M9: dead bodies, and the queries the hit effects need
// (a player's container for blood splats, teams, segments over stairs, bright floors).
import { type Collider, collider, math, type Vec2 } from "@rebirth/core";
import { type BuildingDef, type DecalDef, MapObjectDefs, type StructureDef } from "@rebirth/defs";
import type { ObjectKind, ObjectView, PlayerView, Snapshot, StructureView } from "@rebirth/sim";
import type { Container } from "pixi.js";
import type { SnapshotInterpolator } from "../net/interp.ts";
import type { ViewBounds } from "../render/camera.ts";
import { BuildingRender } from "./building.ts";
import { DeadBodyRender } from "./deadBody.ts";
import { DecalRender } from "./decal.ts";
import { LootRender } from "./loot.ts";
import { ObstacleRender } from "./obstacle.ts";
import { PlayerRender } from "./player.ts";
import { StructureRender } from "./structure.ts";
import type { FrameContext, ObjectRender, ViewDeps } from "./types.ts";

interface Entry {
    render: ObjectRender;
    data: ObjectView;
}

/** Floor surfaces of a building or decal in world space, for `brightSurfaceAt` (survev map.getGroundSurface). */
interface SurfaceCache {
    zIdx: number;
    surfaces: Array<{ bright: boolean; cols: Collider[] }>;
}

function overlaps(a: ViewBounds, b: ViewBounds): boolean {
    return a.min.x <= b.max.x && a.max.x >= b.min.x && a.min.y <= b.max.y && a.max.y >= b.min.y;
}

/** Map object types that can be unlit (fx/darkness.ts): structures with a `dark` floor and `dark` buildings. */
let darkTypeSet: Set<string> | null = null;
function darkTypes(): Set<string> {
    if (darkTypeSet) return darkTypeSet;
    darkTypeSet = new Set();
    for (const [type, def] of Object.entries(MapObjectDefs)) {
        const d = def as StructureDef | BuildingDef;
        if (d.type === "structure" ? d.layers.some((l) => l.dark) : d.type === "building" && d.dark)
            darkTypeSet.add(type);
    }
    return darkTypeSet;
}

const inBox = (p: Vec2, b: ViewBounds) => p.x >= b.min.x && p.x <= b.max.x && p.y >= b.min.y && p.y <= b.max.y;

export class ObjectWorld {
    private readonly deps: ViewDeps;
    private readonly interp: SnapshotInterpolator;
    private readonly entries = new Map<number, Entry>();
    /** views drawn last frame (not culled) */
    visibleCount = 0;
    /** a structure entered or left the view since the last `takeStairMasks()` */
    private structuresDirty = false;
    /** snapshots applied so far */
    private applied = 0;
    /** structure id -> layer index -> building view id (structureLayer cache) */
    private readonly layerCache = new Map<string, number>();
    /** world-space floor surfaces of buildings and decals in view, by id (brightSurfaceAt) */
    private readonly surfaceCache = new Map<number, SurfaceCache | null>();

    constructor(deps: ViewDeps, interp: SnapshotInterpolator) {
        this.deps = deps;
        this.interp = interp;
    }

    get size(): number {
        return this.entries.size;
    }

    get(id: number): ObjectView | undefined {
        return this.entries.get(id)?.data;
    }

    /** render view of an object (debug and tests) */
    renderOf(id: number): ObjectRender | undefined {
        return this.entries.get(id)?.render;
    }

    private create(view: ObjectView): ObjectRender {
        switch (view.kind) {
            case "player":
                return new PlayerRender(this.deps, view.id);
            case "obstacle":
                return new ObstacleRender(this.deps, view.id);
            case "building":
                return new BuildingRender(this.deps, view.id);
            case "structure":
                return new StructureRender(view.id);
            case "decal":
                return new DecalRender(this.deps, view.id);
            case "loot":
                return new LootRender(this.deps, view.id, this.applied > 0);
            case "deadBody":
                return new DeadBodyRender(this.deps, view.id, (pos, rad) => this.insideStructureStairs(pos, rad));
        }
    }

    applySnapshot(s: Snapshot): void {
        for (const id of s.deletedIds) this.remove(id);
        for (const view of s.objects) {
            let entry = this.entries.get(view.id);
            let isNew = false;
            if (entry && entry.data.kind !== view.kind) {
                this.remove(view.id);
                entry = undefined;
            }
            if (!entry) {
                entry = { render: this.create(view), data: view };
                this.entries.set(view.id, entry);
                isNew = true;
                if (view.kind === "structure") this.structuresDirty = true;
            }
            entry.data = view;
            (entry.render as ObjectRender<ObjectView>).setData(view, isNew);
        }
        this.applied++;
    }

    /** Calls `cb` with the latest view of every object of `kind`. */
    forEachView<K extends ObjectKind>(kind: K, cb: (view: Extract<ObjectView, { kind: K }>) => void): void {
        for (const { data } of this.entries.values()) {
            if (data.kind === kind) cb(data as Extract<ObjectView, { kind: K }>);
        }
    }

    remove(id: number): void {
        const entry = this.entries.get(id);
        if (!entry) return;
        if (entry.render instanceof StructureRender) this.structuresDirty = true;
        entry.render.destroy();
        this.entries.delete(id);
        this.interp.delete(id);
        this.surfaceCache.delete(id);
    }

    /** Stair masks of every structure in view when they changed since the last call, else null. */
    takeStairMasks(): ViewBounds[] | null {
        if (!this.structuresDirty) return null;
        this.structuresDirty = false;
        const masks: ViewBounds[] = [];
        for (const { render } of this.entries.values()) {
            if (render instanceof StructureRender) masks.push(...render.masks);
        }
        return masks;
    }

    /** Interpolated position of an object, or undefined when it is not in view. */
    visualPos(id: number, now: number): Vec2 | undefined {
        const entry = this.entries.get(id);
        return entry && this.interp.pos(id, now, entry.data.pos);
    }

    /** The building of a structure's layer `index` (0 ground, 1 underground), when in view. */
    structureLayer(structure: StructureView, index: number): BuildingRender | null {
        const def = MapObjectDefs[structure.type] as StructureDef | undefined;
        const layerDef = def?.layers[index];
        if (!layerDef) return null;
        // generator.ts genStructure: layer buildings sit at addAdjust(pos, layer.pos, ori) on layer `index`
        const key = `${structure.id}:${index}`;
        const cached = this.layerCache.get(key);
        const hit = cached !== undefined ? this.entries.get(cached)?.render : undefined;
        if (hit instanceof BuildingRender) return hit;
        const pos = math.addAdjust(structure.pos, layerDef.pos, structure.ori);
        for (const [id, { render, data }] of this.entries) {
            if (!(render instanceof BuildingRender) || data.type !== layerDef.type || data.layer !== index) continue;
            if (Math.abs(data.pos.x - pos.x) < 0.5 && Math.abs(data.pos.y - pos.y) < 0.5) {
                this.layerCache.set(key, id);
                return render;
            }
        }
        return null;
    }

    /** Whether `pos` is under a roof of a building on `layer` (survev map.insideBuildingCeiling). */
    insideCeiling(pos: Vec2, layer = 0): boolean {
        for (const { render, data } of this.entries.values()) {
            if (render instanceof BuildingRender && data.layer === layer && render.insideCeiling(pos)) return true;
        }
        return false;
    }

    /** Whether a circle at `pos` touches a structure's stair mask (survev map.insideStructureMask). */
    insideStructureMask(pos: Vec2, rad = 0): boolean {
        return this.insideStructureBoxes(pos, rad, "masks");
    }

    /** Whether a circle at `pos` touches a structure's stairs (survev map.insideStructureStairs). */
    insideStructureStairs(pos: Vec2, rad = 0): boolean {
        return this.insideStructureBoxes(pos, rad, "stairs");
    }

    private insideStructureBoxes(pos: Vec2, rad: number, which: "masks" | "stairs"): boolean {
        for (const { render } of this.entries.values()) {
            if (!(render instanceof StructureRender)) continue;
            for (const m of render[which]) {
                const dx = Math.max(m.min.x - pos.x, 0, pos.x - m.max.x);
                const dy = Math.max(m.min.y - pos.y, 0, pos.y - m.max.y);
                if (dx * dx + dy * dy <= rad * rad) return true;
            }
        }
        return false;
    }

    /**
     * Whether a player on layer 1 at `pos` is underground (survev player.ts isUnderground): inside a structure's
     * second layer that is not marked `underground: false`; true anywhere else on layer 1.
     */
    isUnderground(pos: Vec2, layer: number): boolean {
        if (layer !== 1) return false;
        for (const { data } of this.entries.values()) {
            if (data.kind !== "structure") continue;
            const def = MapObjectDefs[data.type] as StructureDef | undefined;
            const layerDef = def?.layers[1];
            if (!layerDef) continue;
            const b = this.structureLayer(data, 1);
            if (b?.insideCeiling(pos)) return layerDef.underground ?? true;
        }
        return true;
    }

    /**
     * Rebirth (wave 3): whether `pos` on `layer` is inside an unlit building (fx/darkness.ts): under the ceiling of a
     * structure floor marked `layers[i].dark` on that floor's layer, or of a building marked `dark` on its layer.
     * A stairs layer (2, 3) counts as its floor (`layer & 1`, as fx surfaceAt): a shot fired down the stairwell
     * (bullet layer 3, sim aimLayerOf) or a viewer on its lower half is in the dark floor's light.
     */
    inDarkness(pos: Vec2, layer: number): boolean {
        if (darkTypes().size === 0) return false;
        const floor = layer & 1;
        for (const { render, data } of this.entries.values()) {
            if (!darkTypes().has(data.type)) continue;
            if (data.kind === "structure") {
                const layerDef = (MapObjectDefs[data.type] as StructureDef | undefined)?.layers[floor];
                if (layerDef?.dark && this.structureLayer(data, floor)?.insideCeiling(pos)) return true;
                // on its stairs (either half): from the top step a viewer looks down into the dark floor, which the
                // stairs layer shows lit otherwise (review of PR #19: a stair camper saw the whole station)
                if (layer & 2 && render instanceof StructureRender && render.stairs.some((b) => inBox(pos, b)))
                    return true;
            } else if (render instanceof BuildingRender && data.layer === floor) {
                if ((MapObjectDefs[data.type] as BuildingDef | undefined)?.dark && render.insideCeiling(pos))
                    return true;
            }
        }
        return false;
    }

    /** Whether the local player stands under a building's roof (survev map.insideBuildingCeiling). */
    localIndoors(): boolean {
        for (const { render } of this.entries.values()) {
            if (render instanceof BuildingRender && render.localInside) return true;
        }
        return false;
    }

    /** The buildings whose roof the local player stands under (rebirth: no rain streaks over them, fx/weather.ts). */
    localRoofs(): BuildingRender[] {
        const roofs: BuildingRender[] = [];
        for (const { render } of this.entries.values()) {
            if (render instanceof BuildingRender && render.localInside) roofs.push(render);
        }
        return roofs;
    }

    update(ctx: FrameContext, now: number, view: ViewBounds): void {
        let visible = 0;
        for (const [id, entry] of this.entries) {
            const pos = this.interp.pos(this.anchorOf(entry.data), now, entry.data.pos);
            const inView = overlaps(entry.render.bounds(pos), view);
            entry.render.setVisible(inView);
            if (!inView) continue;
            visible++;
            if (entry.render instanceof PlayerRender) {
                const p = entry.data as PlayerView;
                entry.render.update(ctx, pos, this.interp.dir(id, now, p.dir));
            } else {
                entry.render.update(ctx, pos);
            }
        }
        this.visibleCount = visible;
    }

    /**
     * Whose interpolated position an object is drawn at: a living disguise sticks to its wearer (survev obstacle.ts
     * isSkin), everything else to itself.
     */
    private anchorOf(data: ObjectView): number {
        if (data.kind !== "obstacle" || data.skinPlayerId === undefined || data.dead) return data.id;
        return this.entries.has(data.skinPlayerId) ? data.skinPlayerId : data.id;
    }

    /** The root container of a player's view (blood splats are parented to it), null when it is not in view. */
    playerContainer(id: number): Container | null {
        const render = this.entries.get(id)?.render;
        return render instanceof PlayerRender ? render.container : null;
    }

    /** Team of a player (PlayerInfoView.teamId), 0 when unknown. */
    teamOf(id: number): number {
        return this.deps.teamOf?.(id) ?? 0;
    }

    /**
     * Whether the segment a -> b crosses the stairs of a structure in view outside its stair masks: a bullet there is
     * drawn on the stairs layer (survev bullet.ts m_update; `lootOnly` stairs do not count).
     */
    segmentOnStairs(a: Vec2, b: Vec2): boolean {
        for (const { render } of this.entries.values()) {
            if (!(render instanceof StructureRender)) continue;
            const hits = (boxes: ViewBounds[]) =>
                boxes.some((m) => collider.intersectSegment({ type: 1, min: m.min, max: m.max }, b, a) !== null);
            if (hits(render.bulletStairs) && !hits(render.masks)) return true;
        }
        return false;
    }

    /**
     * Whether the ground at `pos` is a bright floor (`isBright` surface data: the bunker grass and tiles), on which
     * tracers use their saturated colour. Decal surfaces come first, then the floor of the topmost building (survev
     * map.getGroundSurface); terrain and rivers are never bright.
     */
    brightSurfaceAt(pos: Vec2, layer: number): boolean {
        const onStairs = (layer & 2) !== 0;
        let zIdx = 0;
        let bright: boolean | null = null;
        for (const [id, { data }] of this.entries) {
            if (data.kind !== "decal" && data.kind !== "building") continue;
            const cache = this.surfacesOf(id, data);
            if (!cache) continue;
            if (data.kind === "decal") {
                const sameLayer = (data.layer & 1) === (layer & 1) || ((data.layer & 2) !== 0 && onStairs);
                if (sameLayer && cache.surfaces[0].cols.some((c) => collider.contains(c, pos))) return false;
                continue;
            }
            if (cache.zIdx < zIdx || !(data.layer === layer || onStairs) || (data.layer === 1 && onStairs)) continue;
            for (const s of cache.surfaces) {
                if (s.cols.some((c) => collider.contains(c, pos))) {
                    zIdx = cache.zIdx;
                    bright = s.bright;
                }
            }
        }
        return bright ?? false;
    }

    private surfacesOf(id: number, data: ObjectView): SurfaceCache | null {
        const cached = this.surfaceCache.get(id);
        if (cached !== undefined) return cached;
        let out: SurfaceCache | null = null;
        if (data.kind === "building") {
            const def = MapObjectDefs[data.type] as BuildingDef | undefined;
            const rot = math.oriToRad(data.ori);
            const surfaces = (def?.floor.surfaces ?? []).map((s) => ({
                bright: s.data?.isBright === true,
                cols: s.collision.map((c) => collider.transform(c, data.pos, rot, 1)),
            }));
            if (surfaces.length) out = { zIdx: def?.zIdx ?? 0, surfaces };
        } else if (data.kind === "decal") {
            const def = MapObjectDefs[data.type] as DecalDef | undefined;
            if (def?.surface) {
                const col = collider.transform(def.collision, data.pos, math.oriToRad(data.ori), data.scale);
                out = { zIdx: 0, surfaces: [{ bright: false, cols: [col] }] };
            }
        }
        this.surfaceCache.set(id, out);
        return out;
    }

    clear(): void {
        for (const id of [...this.entries.keys()]) this.remove(id);
        this.layerCache.clear();
        this.surfaceCache.clear();
        this.applied = 0;
    }
}
