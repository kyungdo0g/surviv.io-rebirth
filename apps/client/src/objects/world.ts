// Keeps one render view per object id in sync with the snapshots, culls views outside the camera and updates
// the visible ones every frame with interpolated positions.
import type { Vec2 } from "@rebirth/core";
import type { ObjectKind, ObjectView, PlayerView, Snapshot } from "@rebirth/sim";
import type { SnapshotInterpolator } from "../net/interp.ts";
import type { ViewBounds } from "../render/camera.ts";
import { BuildingRender } from "./building.ts";
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

function overlaps(a: ViewBounds, b: ViewBounds): boolean {
    return a.min.x <= b.max.x && a.max.x >= b.min.x && a.min.y <= b.max.y && a.max.y >= b.min.y;
}

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

    /** Whether the local player stands under a building's roof (survev map.insideBuildingCeiling). */
    localIndoors(): boolean {
        for (const { render } of this.entries.values()) {
            if (render instanceof BuildingRender && render.localInside) return true;
        }
        return false;
    }

    update(ctx: FrameContext, now: number, view: ViewBounds): void {
        let visible = 0;
        for (const [id, entry] of this.entries) {
            const pos = this.interp.pos(id, now, entry.data.pos);
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

    clear(): void {
        for (const id of [...this.entries.keys()]) this.remove(id);
        this.applied = 0;
    }
}
