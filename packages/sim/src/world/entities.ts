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

/** Live state of a door obstacle (survev obstacle.ts door). */
export interface DoorState {
    open: boolean;
    /** false: only buttons and puzzles move it (and `openOnce` doors after their first use) */
    canUse: boolean;
    /** locked doors never open automatically and refuse Interact until unlocked */
    locked: boolean;
    /** increments when an interaction starts (the client plays the def's change sound) */
    seq: number;
    closedPos: Vec2;
    closedOri: number;
    /** 0 both ways, else the side the door always swings to (-1 / 1; one-way auto doors open from that side) */
    openOneWay: number;
    openDelay: number;
    openOnce: boolean;
    autoOpen: boolean;
    autoClose: boolean;
    autoCloseDelay: number;
    slideToOpen: boolean;
    slideOffset: number;
}

/** A door action deferred by `openDelay`, a button's `useDelay` or an auto door's `autoCloseDelay`. */
export interface DelayedDoorAction {
    ticker: number;
    type: "toggle" | "open" | "close";
    /** player whose position decides the swing side (0 for none) */
    playerId: number;
    /** a button's `useDir`: its x component overrides the swing side */
    dir?: Vec2;
    lock?: "lock" | "unlock";
}

function normalizeOri(ori: number): number {
    return ((ori % 4) + 4) % 4;
}

export class Obstacle {
    readonly kind = "obstacle";
    readonly id: number;
    readonly type: string;
    readonly def: ObstacleDef;
    /** doors move when they open (see doors.ts); other obstacles never move */
    pos: Vec2;
    ori: number;
    /** doors next to stairs take layer 2/3 so they work from both floors (survev checkLayer) */
    layer: number;
    readonly originalLayer: number;
    readonly parentId: number;
    /** puzzle piece label (BuildingChildDef.puzzlePiece), "" for none */
    readonly puzzlePiece: string;
    /** faction team of faction-mode obstacles (def `teamId`; stored only, 0 for none) */
    readonly teamId: number;
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
    readonly door?: DoorState;
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
    /** seconds until a dead `regrow` obstacle comes back (0: not scheduled) */
    regrowTicker = 0;
    /** deferred door action (openDelay, button useDelay, auto close) */
    delayedDoor: DelayedDoorAction | null = null;
    /** seconds until a button's `useExpiration` restores the door state below (0: none) */
    useExpirationTicker = 0;
    memorizedDoorState: { open: boolean; canUse: boolean; useDir: Vec2 } | null = null;
    /** smartLoot replacement crates: their loot belongs to `lootOwnerId` (survev shouldApplyLootOwner) */
    applyLootOwner = false;
    lootOwnerId = 0;
    /**
     * Rebirth air drop tiers: the map object this obstacle turns into instead of its def's `destroyType` ("" for that).
     * Set on a landed tiered air drop (match/planes.ts); server-side only, so the shell's tier is not on the wire.
     */
    destroyTypeOverride = "";
    /**
     * Rebirth hit-counted explosion gate (ObstacleDef.explosionGate.hitsToOpen, blast_door_01): the qualifying hits it
     * took and the door's shares they add up to (combat.ts gateHitShare); its health follows the shares left.
     */
    gateHits = 0;
    gateShares = 0;
    /** set by the world to keep the broadphase in sync when the collider shrinks or moves */
    onBoundsChanged?: (obstacle: Obstacle) => void;
    /**
     * Disguise of the player `skinPlayerId` (an outfit's `obstacleType`, world/disguise.ts): follows the wearer, shows
     * their health, never collides and takes no damage (survev obstacle.ts isSkin); 0 for map obstacles.
     */
    readonly skinPlayerId: number;

    constructor(spawn: GeneratedObject, skinPlayerId = 0) {
        this.id = spawn.id;
        this.type = spawn.type;
        this.def = defOf(spawn.type, "obstacle");
        this.pos = v2.copy(spawn.pos);
        this.ori = normalizeOri(spawn.ori);
        this.layer = spawn.layer;
        this.originalLayer = spawn.layer;
        this.parentId = spawn.parentId;
        this.puzzlePiece = spawn.puzzlePiece ?? "";
        this.teamId = this.def.teamId ?? 0;
        this.scale = spawn.scale;
        this.maxScale = spawn.scale;
        // obstacles shrink to `scale.destroy` of their spawn scale as they lose health (survev obstacle.ts)
        this.minScale = spawn.scale * this.def.scale.destroy;
        this.maxHealth = this.def.health;
        this.health = this.def.health;
        this.skinPlayerId = skinPlayerId;
        this.collidable = this.def.collidable && !this.isSkin;
        this.destructible = this.def.destructible;
        this.isWall = !!this.def.isWall;
        this.isTree = !!this.def.isTree;
        this.height = this.def.height;
        const door = this.def.door;
        if (door) {
            // doors start closed; `openOneWay` is a side (-1 / 1) or a boolean meaning 1 (survev door defs)
            const oneWay = door.openOneWay === true ? 1 : door.openOneWay === false ? 0 : door.openOneWay;
            this.door = {
                open: false,
                canUse: door.canUse,
                locked: !!door.locked,
                seq: 0,
                closedPos: v2.copy(this.pos),
                closedOri: this.ori,
                openOneWay: oneWay,
                openDelay: door.openDelay ?? 0,
                openOnce: !!door.openOnce,
                autoOpen: !!door.autoOpen,
                autoClose: !!door.autoClose,
                autoCloseDelay: door.autoCloseDelay ?? 0,
                slideToOpen: !!door.slideToOpen,
                slideOffset: door.slideOffset ?? 0,
            };
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
        if (this.def.aabb) {
            b = unionBounds(b, toBounds(transformOri(this.def.aabb, this.pos, this.ori, this.scale)));
        } else if (this.interactionRad > 0) {
            // interactable obstacles reach `interactionRad` beyond their collider (survev updateCollider)
            const m = this.interactionRad;
            b = { min: { x: b.min.x - m, y: b.min.y - m }, max: { x: b.max.x + m, y: b.max.y + m } };
        }
        return b;
    }

    private refreshShape(): void {
        this.collider = this.computeCollider();
        this.bounds = this.computeBounds();
        this.onBoundsChanged?.(this);
    }

    /** Moves and turns the obstacle (doors); the collider follows immediately. */
    setTransform(pos: Vec2, ori: number): void {
        this.pos = v2.copy(pos);
        this.ori = normalizeOri(ori);
        this.refreshShape();
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
        this.refreshShape();
        return this.dead;
    }

    /**
     * One more qualifying hit on a hit-counted gate, worth `shares` of the door's `total`: the health drops to the
     * shares left (exactly 0 at the last one). Returns true when it was destroyed.
     */
    gateHit(shares: number, total: number): boolean {
        if (this.dead || !(shares > 0) || !(total > 0)) return false;
        this.gateHits++;
        this.gateShares = Math.min(total, this.gateShares + shares);
        const left = total - this.gateShares;
        return this.damage(left === 0 ? this.health : this.health - (this.maxHealth * left) / total);
    }

    /** Destroys the obstacle whatever its health and destructibility (opened air drop crates, crushed objects). */
    kill(): void {
        if (this.dead) return;
        this.health = 0;
        this.healthT = 0;
        this.dead = true;
        this.scale = this.minScale;
        this.refreshShape();
    }

    /** A dead `regrow` obstacle comes back at full health and scale (survev obstacle.ts regrow). */
    regrow(): void {
        this.dead = false;
        this.scale = this.maxScale;
        this.health = this.maxHealth;
        this.healthT = 1;
        this.gateHits = 0;
        this.gateShares = 0;
        this.refreshShape();
    }

    get isSkin(): boolean {
        return this.skinPlayerId !== 0;
    }

    /** Whether this obstacle currently blocks movement (open doors still block where their panel is). */
    get blocking(): boolean {
        return this.collidable && !this.dead;
    }

    /** Usable by Interact or a melee hit right now (survev `interactable`: button, else door canUse). */
    get interactable(): boolean {
        return !this.dead && (this.button ? this.button.canUse : (this.door?.canUse ?? false));
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
        const door = this.door;
        if (door) view.door = { open: door.open, locked: door.locked, canUse: door.canUse, seq: door.seq };
        if (this.button) view.button = { ...this.button };
        if (this.isSkin) view.skinPlayerId = this.skinPlayerId;
        return view;
    }
}

export interface ZoomRegion {
    zoomIn?: Bounds;
    zoomOut?: Bounds;
    zoom?: number;
    noZoom?: boolean;
}

/** Live state of a building `puzzle` (survev building.ts puzzle). */
export interface PuzzleState {
    solved: boolean;
    /** failed attempts (the client plays the fail sound on a change) */
    errSeq: number;
    /** labels of the pieces pressed so far */
    inputCode: string[];
    /** pieces stay locked until it runs out, then the puzzle resets (after an error or a completion) */
    resetTicker: number;
    /** the completeUseType obstacles are triggered when it runs out */
    completeTicker: number;
    /** no piece pressed for pieceResetDelay: counts as an error */
    idleResetTicker: number;
    /** player who pressed the last piece of the solution (0 for none) */
    solvedBy: number;
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
    /** heal regions in world space (bathhouse steam room, oasis) */
    readonly healRegions: Array<{ collision: Collider; healRate: number }>;
    /** players dying here bloody the building's gore decals (club bathhouse pool) */
    readonly goreRegion?: Bounds;
    /** direct children (obstacles, decals, child buildings) */
    readonly childIds: number[] = [];
    /** structure this building is a floor of (0 for none; set by the world) */
    parentStructureId = 0;
    occupied = false;
    ceilingDead = false;
    ceilingDamaged = false;
    /** a `disableBuildingOccupied` obstacle died: the occupied emitters stop for good */
    occupiedDisabled = false;
    /** walls still to break before the roof collapses (def `ceiling.destroy.wallCount`; Infinity without) */
    wallsToDestroy: number;
    readonly puzzle?: PuzzleState;

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
        this.healRegions = (this.def.healRegions ?? []).map((r) => ({
            collision: transformOri(cleanCollider(r.collision), this.pos, this.ori, 1),
            healRate: r.healRate,
        }));
        if (this.def.goreRegion) this.goreRegion = toBounds(transformOri(this.def.goreRegion, this.pos, this.ori, 1));
        this.wallsToDestroy = this.def.ceiling.destroy?.wallCount ?? Number.POSITIVE_INFINITY;
        if (this.def.puzzle) {
            this.puzzle = {
                solved: false,
                errSeq: 0,
                inputCode: [],
                resetTicker: 0,
                completeTicker: 0,
                idleResetTicker: 0,
                solvedBy: 0,
            };
        }
    }

    toView(): BuildingView {
        const view: BuildingView = {
            id: this.id,
            kind: "building",
            type: this.type,
            pos: v2.copy(this.pos),
            layer: this.layer,
            ori: this.ori,
            occupied: this.occupied,
            ceilingDead: this.ceilingDead,
            ceilingDamaged: this.ceilingDamaged,
            occupiedDisabled: this.occupiedDisabled,
        };
        if (this.puzzle) view.puzzle = { solved: this.puzzle.solved, errSeq: this.puzzle.errSeq };
        return view;
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
    /** a solved puzzle switched the interior music to the def's `interiorSound.soundAlt` */
    interiorSoundAlt = false;

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
            interiorSoundAlt: this.interiorSoundAlt,
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
    /** gore decals (club pool): players killed in their building's gore region (at most 255) */
    goreKills = 0;
    /** rebirth: free rotation in radians added to `ori` (a discarded launcher's body, timedDecals.ts) */
    rot = 0;

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
        const view: DecalView = {
            id: this.id,
            kind: "decal",
            type: this.type,
            pos: v2.copy(this.pos),
            layer: this.layer,
            ori: this.ori,
            scale: this.scale,
            goreKills: this.goreKills,
        };
        if (this.rot) view.rot = this.rot;
        return view;
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
