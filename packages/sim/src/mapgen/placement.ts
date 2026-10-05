// Placement strategies chosen by a definition's terrain flags (survev map.ts genOnGrass, genOnBeach, genOnRiver,
// genOnRiverShore, genOnWaterEdge, genBridge, genRiverCabin, genLocationSpawn, genFromMapDef, genDensitySpawn).
import { type Bounds, math, type Vec2, v2 } from "@rebirth/core";
import { getMapObjectDef } from "@rebirth/defs";
import { boundsInsideBounds } from "../geom/polygon.ts";
import { rotateOri, toBounds, transformOri } from "../geom/transform.ts";
import { getBoundingAabb, getBoundingCollider } from "./bounds.ts";
import type { MapGenerator } from "./generator.ts";
import { randomPointInBounds, randomPointInCircle } from "./random.ts";
import { type River, riverWaterWidthAt } from "./terrain.ts";

/** Objects that spawn near either team's map edge in faction mode (survev map.ts genOnGrass). */
const FACTION_EDGE_OBJECTS = ["warehouse_01f", "house_red_01", "house_red_02", "barn_01"];
/** Team objects that may spawn anywhere on their team's side. */
const FACTION_TEAM_OBJECTS = ["potato_01f", "potato_02f", "potato_03f", "tomato_01", "tomato_02", "tomato_03"];
/** Objects kept away from the map edges, closer to the river. */
const FACTION_CENTER_OBJECTS = ["greenhouse_01", "bunker_structure_03"];
const FACTION_DIVISIONS = 10;

/** Splits a box into `n` equal slices along x (`axisX`) or y, nearest the origin first. */
function divideBounds(b: Bounds, axisX: boolean, n: number, idx: number): Bounds {
    if (axisX) {
        const w = (b.max.x - b.min.x) / n;
        return { min: { x: b.min.x + w * idx, y: b.min.y }, max: { x: b.min.x + w * (idx + 1), y: b.max.y } };
    }
    const h = (b.max.y - b.min.y) / n;
    return { min: { x: b.min.x, y: b.min.y + h * idx }, max: { x: b.max.x, y: b.min.y + h * (idx + 1) } };
}

function teamIdOf(type: string): number | undefined {
    const def = getMapObjectDef(type);
    return "teamId" in def ? def.teamId : undefined;
}

function factionGrassPos(gen: MapGenerator, type: string, spawn: Bounds): Vec2 {
    const teamId = teamIdOf(type);
    let idx: number;
    if (teamId) {
        idx = FACTION_TEAM_OBJECTS.includes(type)
            ? gen.rng.int((teamId - 1) * (FACTION_DIVISIONS / 2), teamId * (FACTION_DIVISIONS / 2) - 1)
            : (teamId - 1) * (FACTION_DIVISIONS - 1);
    } else if (FACTION_EDGE_OBJECTS.includes(type)) {
        idx = (gen.rng.int(1, 2) - 1) * (FACTION_DIVISIONS - 1);
    } else if (FACTION_CENTER_OBJECTS.includes(type)) {
        idx = gen.rng.int(1, FACTION_DIVISIONS - 2);
    } else {
        return randomPointInBounds(gen.rng, spawn.min, spawn.max);
    }
    // teams are split across the river: divide perpendicular to it
    const axisX = (gen.factionSplitOri ^ 1) === 0;
    const slice = divideBounds(spawn, axisX, FACTION_DIVISIONS, idx);
    return randomPointInBounds(gen.rng, slice.min, slice.max);
}

export function genOnGrass(gen: MapGenerator, type: string, placeSpawns: PlaceSpawns): void {
    const def = getMapObjectDef(type);
    const reserved = placeSpawns.take(type);
    if (reserved) {
        gen.genAuto(type, reserved.pos, 0, reserved.ori, 1);
        return;
    }
    const local = getBoundingCollider(type);
    gen.trySpawn(type, () => {
        const { ori, scale } = gen.getOriAndScale(type);
        const b = toBounds(transformOri(local, { x: 0, y: 0 }, ori, scale));
        let w = b.max.x - b.min.x;
        let h = b.max.y - b.min.y;
        if (!def.terrain?.beach) {
            w += gen.grassInset;
            h += gen.grassInset;
        }
        const spawn = {
            min: { x: gen.shoreInset + w, y: gen.shoreInset + h },
            max: { x: gen.width - gen.shoreInset - w, y: gen.height - gen.shoreInset - h },
        };
        if (spawn.min.x > spawn.max.x || spawn.min.y > spawn.max.y) return false;
        const pos = gen.factionMode
            ? factionGrassPos(gen, type, spawn)
            : randomPointInBounds(gen.rng, spawn.min, spawn.max);
        if (!gen.canSpawn(type, pos, ori, scale)) return false;
        gen.genAuto(type, pos, 0, ori, scale);
        return true;
    });
}

export function genOnBeach(gen: MapGenerator, type: string): void {
    const b = getBoundingAabb(type);
    const objSize = Math.max(b.max.x - b.min.x, b.max.y - b.min.y) / 2;
    gen.trySpawn(type, () => {
        const { ori, scale } = gen.getOriAndScale(type);
        const side = gen.rng.int(0, 3);
        const min = { x: gen.shoreInset + objSize, y: gen.shoreInset + objSize };
        const max = { x: min.x + gen.beachSize, y: gen.height - gen.shoreInset - objSize };
        // a point on the left beach strip, rotated about the map centre onto one of the four sides
        const temp = randomPointInBounds(gen.rng, min, max);
        const pos = v2.add(gen.center, rotateOri(v2.sub(gen.center, temp), side));
        if (!gen.canSpawn(type, pos, ori, 1)) return false;
        gen.genAuto(type, pos, 0, ori, scale);
        return true;
    });
}

export function genOnRiver(gen: MapGenerator, type: string, river?: River): void {
    const rivers = gen.rivers;
    if (!rivers.length) return;
    const def = getMapObjectDef(type);
    gen.trySpawn(type, () => {
        const selected = river ?? gen.rng.pick(rivers);
        const t = gen.rng.next();
        let width = riverWaterWidthAt(selected, t);
        if (def.type === "obstacle") {
            const col = def.collision;
            const rad = col.type === 0 ? col.rad : v2.length(v2.mul(v2.sub(col.max, col.min), 0.5));
            width -= rad + 1;
        }
        if (def.terrain?.riverShore) width += selected.shoreWidth / 4;
        const offset = gen.rng.range(-width, width);
        const pos = v2.add(selected.spline.getPos(t), v2.mul(selected.spline.getNormal(t), offset));
        const { ori, scale } = gen.getOriAndScale(type);
        if (!gen.canSpawn(type, pos, ori, scale)) return false;
        gen.genAuto(type, pos, 0, ori, scale);
        return true;
    });
}

export function genOnRiverShore(gen: MapGenerator, type: string, river?: River): void {
    const rivers = gen.rivers;
    if (!rivers.length) return;
    gen.trySpawn(type, () => {
        const selected = river ?? gen.rng.pick(rivers);
        const t = gen.rng.next();
        const width = riverWaterWidthAt(selected, t);
        let offset = gen.rng.range(width, width + selected.shoreWidth);
        if (gen.rng.next() < 0.5) offset = -offset;
        const pos = v2.add(selected.spline.getPos(t), v2.mul(selected.spline.getNormal(t), offset));
        const { ori, scale } = gen.getOriAndScale(type);
        if (!gen.canSpawn(type, pos, ori, scale)) return false;
        gen.genAuto(type, pos, 0, ori, scale);
        return true;
    });
}

/** Buildings facing the sea from the beach (huts on stilts, docks, the waterfront warehouse complex). */
export function genOnWaterEdge(gen: MapGenerator, type: string): void {
    const def = getMapObjectDef(type);
    const waterEdge = def.terrain?.waterEdge;
    if (!waterEdge) return;
    const b = getBoundingAabb(type);
    const height = b.max.y - b.min.y;
    const edgeRot = Math.atan2(waterEdge.dir.y, waterEdge.dir.x);
    gen.trySpawn(type, () => {
        const teamId = teamIdOf(type);
        let side: number;
        if (gen.factionMode && teamId) {
            // red takes the bottom/left edge, blue the top/right edge
            side = gen.factionSplitOri === 0 ? (teamId === 1 ? 3 : 1) : teamId === 1 ? 2 : 0;
        } else {
            side = gen.rng.int(0, 3);
        }
        const ori = math.radToOri(side * Math.PI * 0.5 - edgeRot);
        let dist = gen.rng.range(waterEdge.distMin, waterEdge.distMax);
        // per-type distance corrections (survev map.ts genOnWaterEdge)
        if (type.includes("hut")) dist -= 16;
        else if (type === "warehouse_complex_01") dist -= gen.shoreInset - 6.5;
        else if (type === "bunker_structure_04") dist -= 24;
        const minX = gen.shoreInset + dist;
        const temp = { x: minX, y: gen.rng.range(gen.shoreInset + height, gen.height - gen.shoreInset - height) };
        const pos = v2.add(gen.center, rotateOri(v2.sub(gen.center, temp), side));
        if (!gen.canSpawn(type, pos, ori, 1)) return false;
        gen.genAuto(type, pos, 0, ori, 1);
        return true;
    });
}

/** Ori facing along a river normal (survev map.ts genBridge). */
function normalOri(norm: Vec2): number {
    return math.radToOri(Math.atan2(norm.y, norm.x));
}

export function genBridge(gen: MapGenerator, type: string, river?: River, warnOnFailure = true): boolean {
    let rivers = gen.normalRivers;
    if (!rivers.length) return false;
    if (type === "bunker_structure_05") {
        rivers = rivers.filter((r) => r.waterWidth > 8);
        if (!rivers.length) {
            if (warnOnFailure) gen.warnings.push(`failed to spawn ${type}: no river wider than 8`);
            return false;
        }
    }
    const def = getMapObjectDef(type);
    const nearbyRiver = def.terrain?.nearbyRiver;
    return gen.trySpawn(
        type,
        () => {
            const { scale } = gen.getOriAndScale(type);
            let ori: number;
            const t = gen.rng.next();
            const selected = river ?? gen.rng.pick(rivers);
            let pos = selected.spline.getPos(t);
            if (nearbyRiver) {
                // next to the river (river shacks), facing it
                const otherSide = gen.rng.next() < 0.5;
                const offset = selected.waterWidth * 2 * (otherSide ? -1 : 1);
                pos = v2.add(pos, v2.mul(selected.spline.getNormal(t), offset));
                const finalNorm = selected.spline.getNormal(selected.spline.getClosestT(pos));
                const riverOri = (normalOri(finalNorm) + (otherSide ? 2 : 0)) % 4;
                ori = (nearbyRiver.facingOri + riverOri) % 4;
            } else {
                ori = normalOri(selected.spline.getNormal(t));
            }
            if (type === "bunker_structure_05") ori %= 2;
            if (!gen.canSpawn(type, pos, ori, scale)) return false;
            const obj = gen.genAuto(type, pos, 0, ori, scale);
            if (obj && (obj.kind === "structure" || obj.kind === "building")) {
                gen.bridges.push({ type, pos: obj.pos, ori });
            }
            return true;
        },
        undefined,
        warnOnFailure,
    );
}

/** Random bridges per river, by river width (survev map.ts generateBridges); returns the attempt count. */
export function generateBridges(gen: MapGenerator): number {
    let total = 0;
    const maxBridges = { medium: 3, large: 2, xlarge: 0 };
    for (const river of gen.normalRivers) {
        const w = river.waterWidth;
        const size = w < 9 && w > 4 ? "medium" : w < 20 && w > 8 ? "large" : "xlarge";
        const type = gen.def.mapGen.bridgeTypes[size];
        if (!type) continue;
        // full length rivers have about 33 points; shorter ones get fewer attempts
        const max = Math.ceil(maxBridges[size] * (river.spline.points.length / 33));
        total += max;
        for (let i = 0; i < max; i++) genBridge(gen, type, river, false);
    }
    return total;
}

/** A cabin by the river, with a dock on wide rivers (survev map.ts genRiverCabin / genCabinDock). */
export function genRiverCabin(gen: MapGenerator): void {
    const rivers = gen.normalRivers;
    if (!rivers.length) return;
    const type = "cabin_01";
    const def = getMapObjectDef(type);
    const facingOri = def.terrain?.nearbyRiver?.facingOri ?? 1;
    const inset = gen.grassInset + gen.shoreInset;
    const mapBound = { min: { x: inset, y: inset }, max: { x: gen.width - inset, y: gen.height - inset } };
    const local = getBoundingCollider(type);
    const lb = toBounds(local);
    // survev computes `max.y - min.y / 2` here (operator precedence); kept for identical spacing
    const height = lb.max.y - lb.min.y / 2;
    gen.trySpawn(type, () => {
        const t = gen.rng.range(0.1, 0.9);
        const river = gen.rng.pick(rivers);
        const otherSide = gen.rng.next() < 0.5;
        const offset = (river.waterWidth + height) * (otherSide ? -1 : 1);
        const pos = v2.add(river.spline.getPos(t), v2.mul(river.spline.getNormal(t), offset));
        const finalNorm = river.spline.getNormal(river.spline.getClosestT(pos));
        const riverOri = (normalOri(finalNorm) + (otherSide ? 2 : 0)) % 4;
        const ori = (facingOri + riverOri) % 4;
        if (!boundsInsideBounds(toBounds(transformOri(local, pos, ori, 1)), mapBound)) return false;
        if (!gen.canSpawn(type, pos, ori, 1)) return false;
        gen.genAuto(type, pos, 0, ori);
        genCabinDock(gen, river, pos, ori, otherSide);
        return true;
    });
}

function genCabinDock(gen: MapGenerator, river: River, pos: Vec2, ori: number, otherSide: boolean): void {
    if (river.waterWidth < 8) return;
    const type = "dock_01";
    gen.trySpawn(
        type,
        () => {
            const t = river.spline.getClosestT(pos) + gen.rng.range(-0.04, 0.04);
            const offset = river.waterWidth * (otherSide ? -1 : 1) + gen.rng.range(-5, 0);
            const dockPos = v2.add(river.spline.getPos(t), v2.mul(river.spline.getNormal(t), offset));
            if (!gen.canSpawn(type, dockPos, ori)) return false;
            gen.genAuto(type, dockPos, 0, ori);
            return true;
        },
        100,
        false,
    );
}

/** Spawn within `rad` of a fractional map position (survev map.ts genLocationSpawn). */
export function genLocationSpawn(gen: MapGenerator, type: string, pos: Vec2, rad: number): boolean {
    const center = { x: pos.x * gen.width, y: pos.y * gen.height };
    return gen.trySpawn(type, () => {
        const { ori } = gen.getOriAndScale(type);
        const p = v2.add(center, randomPointInCircle(gen.rng, rad));
        if (!gen.canSpawn(type, p, ori)) return false;
        gen.genAuto(type, p, 0, ori);
        return true;
    });
}

/** Positions reserved near named places before rivers exist (survev map.ts generatePlaceSpawns). */
export interface PlaceSpawns {
    take(type: string): { pos: Vec2; ori: number } | undefined;
}

/** Spawns `count` objects with the strategy their terrain flags select (survev map.ts genFromMapDef). */
export function genFromMapDef(gen: MapGenerator, type: string, count: number, places: PlaceSpawns): void {
    const def = getMapObjectDef(type);
    const terrain = def.terrain;
    for (let i = 0; i < count; i++) {
        if (terrain?.waterEdge) genOnWaterEdge(gen, type);
        else if (terrain?.river) genOnRiver(gen, type);
        else if (terrain?.bridge) {
            if (!gen.normalRivers.length) gen.warnOnce(`${type} needs a river to bridge; none was generated`);
            genBridge(gen, type);
        } else if (terrain?.grass) genOnGrass(gen, type, places);
        else if (terrain?.beach) genOnBeach(gen, type);
        else if (terrain?.riverShore) genOnRiverShore(gen, type);
        else {
            gen.warnOnce(`${type} has no supported placement terrain; placed on grass`);
            genOnGrass(gen, type, places);
        }
    }
}
