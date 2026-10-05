// Layers: v1 bots live on the ground floor (the navigation grid blocks structure stairs). A bot that still ends up on
// stairs (layers 2/3, e.g. pushed by a knock-back) or underground (layer 1) walks back up the nearest stairs: towards
// the stair, then against its down direction until it is on layer 0 again.
import { type Vec2, v2 } from "@rebirth/core";
import { getMapObjectDef, hasMapObjectDef } from "@rebirth/defs";
import type { MapData } from "@rebirth/sim";
import { colliderBounds, rotateOri, transformCollider } from "../geom.ts";
import { type BrainCtx, emptyIntent, type Intent } from "./context.ts";

interface StairInfo {
    center: Vec2;
    /** unit direction going down the stairs */
    down: Vec2;
    /** half the stair length along its down direction */
    halfLen: number;
}

const stairCache = new WeakMap<MapData, StairInfo[]>();

function stairsOf(map: MapData): StairInfo[] {
    let out = stairCache.get(map);
    if (out) return out;
    out = [];
    for (const o of map.objects) {
        if (!hasMapObjectDef(o.type)) continue;
        const def = getMapObjectDef(o.type);
        if (def.type !== "structure") continue;
        for (const s of def.stairs) {
            if (s.lootOnly) continue;
            const b = colliderBounds(transformCollider(s.collision, o.pos, o.ori, o.scale));
            const down = v2.normalizeSafe(rotateOri(s.downDir, o.ori));
            const ext = { x: (b.max.x - b.min.x) / 2, y: (b.max.y - b.min.y) / 2 };
            out.push({
                center: { x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2 },
                down,
                halfLen: Math.abs(down.x) * ext.x + Math.abs(down.y) * ext.y,
            });
        }
    }
    stairCache.set(map, out);
    return out;
}

/** The way back to the ground floor, or null when the bot is already on layer 0. */
export function planLayerEscape(ctx: BrainCtx): Intent | null {
    const { self, model } = ctx;
    if (self.layer === 0) return null;
    let best: StairInfo | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const s of stairsOf(model.map)) {
        const d = v2.distance(s.center, self.pos);
        if (d < bestD) {
            bestD = d;
            best = s;
        }
    }
    const intent = emptyIntent("explore");
    if (!best) return intent;
    // the bottom of the stairs (underground) or straight up them (on the stairs)
    const bottom = v2.add(best.center, v2.mul(best.down, best.halfLen + 1));
    const top = v2.sub(best.center, v2.mul(best.down, best.halfLen + 2));
    const onStairs = (self.layer & 2) !== 0;
    const target = onStairs || v2.distance(self.pos, bottom) < 2 ? top : bottom;
    intent.moveDir = v2.normalizeSafe(v2.sub(target, self.pos));
    return intent;
}
