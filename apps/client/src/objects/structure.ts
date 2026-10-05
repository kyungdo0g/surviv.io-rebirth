// Structure (bunker entrances, bridges): draws nothing itself; its layers are separate buildings. It keeps the
// world-space stair masks (the renderer hides the stairs layer inside them from the ground) and culling bounds.
// survev client/src/objects/structure.ts.
import { collider, math, type Vec2 } from "@rebirth/core";
import { MapObjectDefs, type StructureDef } from "@rebirth/defs";
import type { StructureView } from "@rebirth/sim";
import type { ViewBounds } from "../render/camera.ts";
import { boxAround, type FrameContext, type ObjectRender } from "./types.ts";

export class StructureRender implements ObjectRender<StructureView> {
    readonly id: number;
    /** world-space masks hiding stairs from the ground layer */
    masks: ViewBounds[] = [];
    private data!: StructureView;

    constructor(id: number) {
        this.id = id;
    }

    setData(view: StructureView, isNew: boolean): void {
        this.data = view;
        if (!isNew) return;
        const def = MapObjectDefs[view.type] as StructureDef;
        this.masks = def.mask.map((m) => collider.transform(m, view.pos, math.oriToRad(view.ori), 1));
    }

    update(_ctx: FrameContext, _pos: Vec2): void {}

    bounds(pos: Vec2): ViewBounds {
        return this.masks.length
            ? collider.boundingAabb(this.masks.map((m) => ({ type: 1 as const, ...m })))
            : boxAround(pos, 1);
    }

    setVisible(_visible: boolean): void {}

    destroy(): void {
        this.masks = [];
    }

    get layer(): number {
        return this.data.layer;
    }
}
