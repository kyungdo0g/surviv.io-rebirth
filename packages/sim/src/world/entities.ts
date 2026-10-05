// Static map entities: obstacles, buildings, structures and decals created from generated map objects.
// Behaviour follows survev server/src/game/objects/{obstacle,building,structure}.ts.
import { type Bounds, type Collider, math, type Vec2, v2 } from "@rebirth/core";
import {
    type BuildingDef,
    type DecalDef,
    getMapObjectDef,
    type MapObjectDefOfType,
    type ObstacleDef,
    type StructureDef,
} from "@rebirth/defs";
import { cleanCollider, rotateOri, toBounds, transformOri, unionBounds } from "../geom/transform.ts";
import { getBoundingCollider } from "../mapgen/bounds.ts";
import type { GeneratedObject } from "../mapgen/generator.ts";
import type { BuildingView, DecalView, ObstacleView, StructureView } from "../view.ts";

function defOf<T extends "obstacle" | "building" | "structure" | "decal">(
    type: string,
    kind: T,
): MapObjectDefOfType<T> {
    const def = getMapObjectDef(type);
    if (def.type !== kind) throw new Error(`map object ${type} is a ${def.type}, expected ${kind}`);
    return def as MapObjectDefOfType<T>;
}

export class Obstacle {
    readonly kind = "obstacle";
    readonly id: number;
    readonly type: string;
    readonly def: ObstacleDef;
    readonly pos: Vec2;
    readonly ori: number;
    readonly layer: number;
    readonly parentId: number;
    readonly maxScale: number;
    readonly minScale: number;
    readonly maxHealth: number;
    readonly collidable: boolean;
    readonly destructible: boolean;
    readonly isWall: boolean;
    readonly isTree: boolean;
    readonly height: number;
    scale: number;
    health: number;
    healthT = 1;
    dead = false;
    /** world-space collider at the current scale */
    collider: Collider;
    /** broadphase bounds: the collider plus the sprite bounds (`def.aabb`, e.g. tree canopies) */
    bounds: Bounds;
    readonly door?: { open: boolean; locked: boolean; canUse: boolean };
    /** interactable obstacles (def `button`: air drop crates, switches) */
    readonly button?: { onOff: boolean; canUse: boolean; seq: number };
    /** reach of Interact around the collider (button or door `interactionRad`; 0 when not interactable) */
    readonly interactionRad: number;
    /** seconds until a used `destroyOnUse` button dies (0: not scheduled) */
    killTicker = 0;
    /** seconds until a button with `useCooldown` can be used again */
    interactCooldown = 0;
    /** player who used it last (0 for none) */
    interactedBy = 0;
    /** set by the world to keep the broadphase in sync when the collider shrinks */
    onBoundsChanged?: (obstacle: Obstacle) => void;

    constructor(spawn: GeneratedObject) {
        this.id = spawn.id;
        this.type = spawn.type;
        this.def = defOf(spawn.type, "obstacle");
        this.pos = v2.copy(spawn.pos);
        this.ori = spawn.ori;
        this.layer = spawn.layer;
        this.parentId = spawn.parentId;
        this.scale = spawn.scale;
        this.maxScale = spawn.scale;
        // obstacles shrink to `scale.destroy` of their spawn scale as they lose health (survev obstacle.ts)
        this.minScale = spawn.scale * this.def.scale.destroy;
        this.maxHealth = this.def.health;
        this.health = this.def.health;
        this.collidable = this.def.collidable;
        this.destructible = this.def.destructible;
        this.isWall = !!this.def.isWall;
        this.isTree = !!this.def.isTree;
        this.height = this.def.height;
        if (this.def.door) {
            // doors start closed (and collidable)
            this.door = { open: false, locked: !!this.def.door.locked, canUse: this.def.door.canUse };
        }
        if (this.def.button) this.button = { onOff: false, canUse: true, seq: 0 };
        this.interactionRad = this.def.button?.interactionRad ?? this.def.door?.interactionRad ?? 0;
        this.collider = this.computeCollider();
        this.bounds = this.computeBounds();
    }

    private computeCollider(): Collider {
        return transformOri(this.def.collision, this.pos, this.ori, this.scale);
    }

    private computeBounds(): Bounds {
        let b = toBounds(this.collider);
        if (this.def.aabb) b = unionBounds(b, toBounds(transformOri(this.def.aabb, this.pos, this.ori, this.scale)));
        return b;
    }

    /** Applies damage; the obstacle shrinks with its health and dies at 0. Returns true when it was destroyed. */
    damage(amount: number): boolean {
        if (this.dead || !this.destructible || !(amount > 0)) return false;
        this.health = Math.max(0, this.health - amount);
        this.healthT = math.clamp(this.health / this.maxHealth, 0, 1);
        this.scale = math.lerp(this.healthT, this.minScale, this.maxScale);
        if (this.health <= 0) {
            this.dead = true;
            this.healthT = 0;
            this.scale = this.minScale;
        }
        this.collider = this.computeCollider();
        this.bounds = this.computeBounds();
        this.onBoundsChanged?.(this);
        return this.dead;
    }

    /** Destroys the obstacle whatever its health and destructibility (opened air drop crates, crushed objects). */
    kill(): void {
        if (this.dead) return;
        this.health = 0;
        this.healthT = 0;
        this.dead = true;
        this.scale = this.minScale;
        this.collider = this.computeCollider();
        this.bounds = this.computeBounds();
        this.onBoundsChanged?.(this);
    }

    /** Whether this obstacle currently blocks movement. */
    get blocking(): boolean {
        return this.collidable && !this.dead && !(this.door?.open ?? false);
    }

    toView(): ObstacleView {
        const view: ObstacleView = {
            id: this.id,
            kind: "obstacle",
            type: this.type,
            pos: v2.copy(this.pos),
            layer: this.layer,
            ori: this.ori,
            scale: this.scale,
            healthT: this.healthT,
            dead: this.dead,
        };
        if (this.door) view.door = { ...this.door };
        if (this.button) view.button = { ...this.button };
        return view;
    }
}

export interface ZoomRegion {
    zoomIn?: Bounds;
    zoomOut?: Bounds;
    zoom?: number;
    noZoom?: boolean;
}

export class Building {
    readonly kind = "building";
    readonly id: number;
    readonly type: string;
    readonly def: BuildingDef;
    readonly pos: Vec2;
    readonly ori: number;
    readonly layer: number;
    readonly parentId: number;
    readonly zIdx: number;
    readonly bounds: Bounds;
    /** floor surfaces in world space (house, water under bridges, ...) */
    readonly surfaces: Array<{ type: string; colliders: Collider[] }>;
    /** ceiling zoom regions in world space */
    readonly zoomRegions: ZoomRegion[];
    readonly childIds: number[] = [];
    occupied = false;
    ceilingDead = false;
    ceilingDamaged = false;

    constructor(spawn: GeneratedObject) {
        this.id = spawn.id;
        this.type = spawn.type;
        this.def = defOf(spawn.type, "building");
        this.pos = v2.copy(spawn.pos);
        this.ori = spawn.ori;
        this.layer = spawn.layer;
        this.parentId = spawn.parentId;
        this.zIdx = this.def.zIdx ?? 0;
        this.bounds = toBounds(transformOri(getBoundingCollider(this.type), this.pos, this.ori, 1));
        this.surfaces = this.def.floor.surfaces.map((s) => ({
            type: s.type,
            colliders: s.collision.map((c) => transformOri(c, this.pos, this.ori, 1)),
        }));
        this.zoomRegions = this.def.ceiling.zoomRegions.map((r) => ({
            zoomIn: r.zoomIn ? toBounds(transformOri(r.zoomIn, this.pos, this.ori, 1)) : undefined,
            zoomOut: r.zoomOut ? toBounds(transformOri(r.zoomOut, this.pos, this.ori, 1)) : undefined,
            zoom: r.zoom,
            noZoom: r.noZoom,
        }));
    }

    toView(): BuildingView {
        return {
            id: this.id,
            kind: "building",
            type: this.type,
            pos: v2.copy(this.pos),
            layer: this.layer,
            ori: this.ori,
            occupied: this.occupied,
            ceilingDead: this.ceilingDead,
            ceilingDamaged: this.ceilingDamaged,
        };
    }
}

export interface Stair {
    collision: Bounds;
    downDir: Vec2;
    downOri: number;
    upOri: number;
    /** half of the stairs towards the lower floor */
    downAabb: Bounds;
    upAabb: Bounds;
    noCeilingReveal: boolean;
    lootOnly: boolean;
}

/** Splits a box in half across `axis`; returns [half towards axis, half away]. */
function splitBounds(b: Bounds, axis: Vec2): [Bounds, Bounds] {
    const c = v2.mul(v2.add(b.min, b.max), 0.5);
    let left: Bounds;
    let right: Bounds;
    if (Math.abs(axis.y) > Math.abs(axis.x)) {
        left = { min: v2.copy(b.min), max: { x: b.max.x, y: c.y } };
        right = { min: { x: b.min.x, y: c.y }, max: v2.copy(b.max) };
    } else {
        left = { min: v2.copy(b.min), max: { x: c.x, y: b.max.y } };
        right = { min: { x: c.x, y: b.min.y }, max: v2.copy(b.max) };
    }
    return v2.dot(v2.sub(b.max, b.min), axis) > 0 ? [right, left] : [left, right];
}

/** A multi-layer map object (bunkers, bridges): its layers are child buildings, stairs switch layers. */
export class Structure {
    readonly kind = "structure";
    readonly id: number;
    readonly type: string;
    readonly def: StructureDef;
    readonly pos: Vec2;
    readonly ori: number;
    readonly layer: number;
    readonly parentId: number;
    readonly bounds: Bounds;
    readonly stairs: Stair[];
    readonly layerObjIds: number[] = [];

    constructor(spawn: GeneratedObject) {
        this.id = spawn.id;
        this.type = spawn.type;
        this.def = defOf(spawn.type, "structure");
        this.pos = v2.copy(spawn.pos);
        this.ori = spawn.ori;
        this.layer = spawn.layer;
        this.parentId = spawn.parentId;
        this.bounds = toBounds(transformOri(getBoundingCollider(this.type), this.pos, this.ori, 1));
        this.stairs = this.def.stairs.map((s) => {
            const collision = toBounds(transformOri(s.collision, this.pos, this.ori, 1));
            const downDir = rotateOri(s.downDir, this.ori);
            const downOri = math.radToOri(Math.atan2(downDir.y, downDir.x));
            const [downAabb, upAabb] = splitBounds(collision, downDir);
            return {
                collision,
                downDir,
                downOri,
                upOri: (downOri + 2) % 4,
                downAabb,
                upAabb,
                noCeilingReveal: !!s.noCeilingReveal,
                lootOnly: !!s.lootOnly,
            };
        });
    }

    toView(): StructureView {
        return {
            id: this.id,
            kind: "structure",
            type: this.type,
            pos: v2.copy(this.pos),
            layer: this.layer,
            ori: this.ori,
        };
    }
}

export class Decal {
    readonly kind = "decal";
    readonly id: number;
    readonly type: string;
    readonly def: DecalDef;
    readonly pos: Vec2;
    readonly ori: number;
    readonly scale: number;
    readonly layer: number;
    readonly parentId: number;
    readonly collider: Collider;
    readonly bounds: Bounds;
    /** ground surface override (e.g. "water" puddles) */
    readonly surface?: string;

    constructor(spawn: GeneratedObject) {
        this.id = spawn.id;
        this.type = spawn.type;
        this.def = defOf(spawn.type, "decal");
        this.pos = v2.copy(spawn.pos);
        this.ori = spawn.ori;
        this.scale = spawn.scale;
        this.layer = spawn.layer;
        this.parentId = spawn.parentId;
        this.collider = transformOri(cleanCollider(this.def.collision), this.pos, this.ori, this.scale);
        this.bounds = toBounds(this.collider);
        this.surface = this.def.surface?.type;
    }

    toView(): DecalView {
        return {
            id: this.id,
            kind: "decal",
            type: this.type,
            pos: v2.copy(this.pos),
            layer: this.layer,
            ori: this.ori,
            scale: this.scale,
        };
    }
}

export type MapEntity = Obstacle | Building | Structure | Decal;

export function createMapEntity(spawn: GeneratedObject): MapEntity {
    switch (spawn.kind) {
        case "obstacle":
            return new Obstacle(spawn);
        case "building":
            return new Building(spawn);
        case "structure":
            return new Structure(spawn);
        case "decal":
            return new Decal(spawn);
    }
}
