// Foliage and furniture drawn over players (bot overhaul COMBAT-2): the original client draws an obstacle's sprite at
// its img.zIdx and a player at zOrd 18 (apps/client/src/objects/player.ts PLAYER_Z_ORD, obstacle.ts), so bushes
// (zIdx 60, alpha 0.97-1), tables (60), broken stairs, statue tops and tree canopies (200/201/800/801) hide a body that
// lies fully under the opaque core of the sprite. A dead obstacle draws its residue under the players (DEAD_Z_ORD 5)
// and hides nothing. The sprite's world size is its logical pixel size x img.scale x the obstacle's scale / 16 pixels
// per unit (apps/client/src/assets/textures.ts, render/camera.ts PIXELS_PER_UNIT); the pixel sizes are client data
// (apps/client/src/generated/sprite-sizes.json), copied here for the sprites of obstacles drawn above players.
// Diagnosis round 1 issue 1 (RC1) and its verification: the sprite core is ~80% of the half size (the art has soft,
// transparent edges); tables are opaque rectangles. Round 3 (user report 26): bushes, tables, broken stairs and statue
// tops hide a body fully, a tree canopy only partly (a human still makes out a body under it, faintly): those are
// "partial" concealers, and a player under one is seen faint (WorldModel Contact.faint, brain/faint.ts) instead of
// hidden. Pure geometry: no rng, no clock.
import { type Vec2, v2 } from "@rebirth/core";
import { GameConfig } from "@rebirth/defs";
import type { ObjectView } from "@rebirth/sim";
import { rotateOri } from "../geom.ts";
import { sameLayer } from "../nav/cellGrid.ts";
import type { SeenBullet } from "./bulletSight.ts";
import type { SeenObstacle } from "./world.ts";

/** zOrd of players in the client: obstacles drawn above it can hide them. */
const PLAYER_Z_ORD = 18;
/** Sprites this opaque or more hide what is under them (bush_01 0.97, tree_11 0.92). */
const MIN_ALPHA = 0.9;
const PIXELS_PER_UNIT = 16;
/** Fraction of the half size that is opaque: round foliage, tree canopies, everything else (rectangles). */
const CORE_BUSH = 0.85;
const CORE_ROUND = 0.8;
const CORE_BOX = 0.9;
/** A player's body radius (a body is hidden only when all of it is under the sprite). */
export const BODY_RAD = GameConfig.player.radius;
/** Radius of a loot item's sprite on the ground (hidden only when all of it is under the sprite). */
export const LOOT_RAD = 0.6;

/** Logical pixel sizes [w, h] of the sprites of obstacles drawn above players (sprite-sizes.json). */
const SPRITE_PX: Readonly<Record<string, readonly [number, number]>> = {
    "map-brush-01sv.img": [192, 192],
    "map-brush-02sv.img": [192, 192],
    "map-bush-01.img": [144, 144],
    "map-bush-01cb.img": [144, 144],
    "map-bush-01f.img": [144, 144],
    "map-bush-01sv.img": [144, 144],
    "map-bush-01x.img": [144, 144],
    "map-bush-03.img": [152, 152],
    "map-bush-04.img": [150, 150],
    "map-bush-04cb.img": [150, 150],
    "map-bush-05.img": [144, 144],
    "map-bush-06.img": [192, 192],
    "map-bush-07.img": [144, 144],
    "map-bush-07sp.img": [144, 144],
    "map-bush-07x.img": [144, 144],
    "map-class-shell-03a.img": [160, 160],
    "map-stairs-broken-01.img": [160, 128],
    "map-statue-top-01.img": [416, 416],
    "map-statue-top-02.img": [416, 416],
    "map-table-01.img": [160, 128],
    "map-table-01x.img": [160, 128],
    "map-table-02.img": [288, 160],
    "map-table-02x.img": [288, 160],
    "map-table-03.img": [160, 160],
    "map-table-03x.img": [160, 160],
    "map-tree-03.img": [256, 256],
    "map-tree-03cb.img": [256, 256],
    "map-tree-03sv.img": [256, 256],
    "map-tree-05.img": [512, 512],
    "map-tree-05c.img": [512, 512],
    "map-tree-06.img": [256, 256],
    "map-tree-07.img": [256, 256],
    "map-tree-07sp.img": [256, 256],
    "map-tree-07su.img": [256, 256],
    "map-tree-08.img": [512, 512],
    "map-tree-08f.img": [512, 512],
    "map-tree-08sp.img": [512, 512],
    "map-tree-08su.img": [512, 512],
    "map-tree-10.img": [256, 256],
    "map-tree-11.img": [256, 256],
    "map-tree-12.img": [512, 512],
};

/** The opaque part of a concealing sprite, in world units: a circle, or a box (half extents in world axes). */
export interface Concealer {
    c: Vec2;
    /** circle radius, or 0 for a box */
    r: number;
    hx: number;
    hy: number;
    layer: number;
    /** a tree canopy: a body under it is seen faintly, not hidden (round 3, user report 26) */
    partial: boolean;
}

/** Sprite family of a def's image: round art (bushes, canopies) or a rectangle (tables, stairs); trees are partial. */
function coreOf(sprite: string): { core: number; round: boolean; partial: boolean } {
    if (sprite.includes("bush") || sprite.includes("brush")) return { core: CORE_BUSH, round: true, partial: false };
    if (sprite.includes("table") || sprite.includes("stairs")) return { core: CORE_BOX, round: false, partial: false };
    return { core: CORE_ROUND, round: true, partial: sprite.includes("tree") };
}

const cache = new WeakMap<SeenObstacle, Concealer | null>();

/** The opaque core of the sprite `o` draws above players, or null (drawn below them, dead, or unknown art). */
export function concealerOf(o: SeenObstacle): Concealer | null {
    const hit = cache.get(o);
    if (hit !== undefined) return hit;
    let out: Concealer | null = null;
    const img = o.def.img;
    const px = img?.sprite ? SPRITE_PX[img.sprite] : undefined;
    if (img && px && !o.view.dead && (img.zIdx ?? 0) > PLAYER_Z_ORD && (img.alpha ?? 1) >= MIN_ALPHA) {
        const { core, round, partial } = coreOf(img.sprite ?? "");
        const s = ((img.scale ?? 1) * o.view.scale * core) / (2 * PIXELS_PER_UNIT);
        const pos = o.view.pos;
        const layer = o.view.layer;
        if (round) {
            out = { c: v2.copy(pos), r: Math.min(px[0], px[1]) * s, hx: 0, hy: 0, layer, partial };
        } else {
            // quarter turns swap the box's extents (obstacle ori 0..3)
            const ext = rotateOri({ x: px[0] * s, y: px[1] * s }, o.view.ori);
            out = { c: v2.copy(pos), r: 0, hx: Math.abs(ext.x), hy: Math.abs(ext.y), layer, partial };
        }
    }
    cache.set(o, out);
    return out;
}

/** Whether a round body of radius `rad` at `p` lies fully under the concealer `k`. */
export function covers(k: Concealer, p: Vec2, rad: number): boolean {
    if (k.r > 0) return v2.distance(p, k.c) + rad <= k.r;
    return Math.abs(p.x - k.c.x) + rad <= k.hx && Math.abs(p.y - k.c.y) + rad <= k.hy;
}

/** The first concealer among `obstacles` on `layer` covering a body of radius `rad` at `p` that is partial or not. */
function coveringAmong(
    obstacles: readonly SeenObstacle[],
    p: Vec2,
    layer: number,
    rad: number,
    partial: boolean,
): boolean {
    for (const o of obstacles) {
        const k = concealerOf(o);
        if (!k || k.partial !== partial || !sameLayer(k.layer, layer)) continue;
        // cheap reject before the exact test
        const reach = (k.r > 0 ? k.r : Math.max(k.hx, k.hy)) + 1;
        if (Math.abs(p.x - k.c.x) > reach || Math.abs(p.y - k.c.y) > reach) continue;
        if (covers(k, p, rad)) return true;
    }
    return false;
}

/**
 * Whether some obstacle among `obstacles` on `layer` draws its opaque sprite over all of a body at `p` and hides it
 * (bushes, tables, broken stairs, statue tops; not tree canopies, which only make it faint: canopyAmong).
 */
export function concealedAmong(obstacles: readonly SeenObstacle[], p: Vec2, layer: number, rad = BODY_RAD): boolean {
    return coveringAmong(obstacles, p, layer, rad, false);
}

/** Whether a tree canopy among `obstacles` on `layer` lies over all of a body at `p` (seen faintly, round 3 item 26). */
export function canopyAmong(obstacles: readonly SeenObstacle[], p: Vec2, layer: number, rad = BODY_RAD): boolean {
    return coveringAmong(obstacles, p, layer, rad, true);
}

/** A concealed player that fires or is hit shows (muzzle flash, tracer, blood) this long (HARNESS REVEAL_SECONDS: 2). */
const REVEAL = 1;
/** A hit this close to a player's centre is a hit on it (blood shows where it stands). */
const HIT_MATCH = 1.5;

/**
 * Concealed players a human would still spot for a moment (critique of COMBAT-2: bots must not be blinder than humans
 * to bush campers): one firing from under foliage (its muzzle flash and the start of its tracer on the screen), and one
 * a bullet hits on the screen (the blood).
 */
export class Reveals {
    private readonly until = new Map<number, number>();
    /** revealed by its own shot (the muzzle flash pins it down even under a canopy) */
    private readonly untilShot = new Map<number, number>();

    /** One snapshot: its perceived bullets and players; `onScreen` tells a point on the bot's screen. */
    note(
        bullets: readonly SeenBullet[],
        objects: readonly ObjectView[],
        selfId: number,
        now: number,
        onScreen: (p: Vec2) => boolean,
    ): void {
        for (const b of bullets) {
            if (b.shooterId === selfId) continue;
            if (b.shotFx && !b.clipped && b.reflectCount === 0) {
                this.until.set(b.shooterId, now + REVEAL);
                this.untilShot.set(b.shooterId, now + REVEAL);
            }
            if (!b.hitPlayer || b.endDist === undefined) continue;
            const end = v2.add(b.pos, v2.mul(b.dir, b.endDist));
            if (!onScreen(end)) continue;
            for (const o of objects) {
                if (o.kind === "player" && o.id !== b.shooterId && v2.distance(o.pos, end) < HIT_MATCH)
                    this.until.set(o.id, now + REVEAL);
            }
        }
        if (this.until.size > 64) for (const [id, t] of this.until) if (t < now) this.until.delete(id);
        if (this.untilShot.size > 64) for (const [id, t] of this.untilShot) if (t < now) this.untilShot.delete(id);
    }

    /** Whether player `id` shows now despite being concealed. */
    shown(id: number, now: number): boolean {
        return now <= (this.until.get(id) ?? Number.NEGATIVE_INFINITY);
    }

    /**
     * Whether player `id` fired from where it stands a moment ago: under a canopy that pins a faint body down, while a
     * hit only shows blood somewhere under the leaves (it stays faint: round 3 item 26).
     */
    shotShown(id: number, now: number): boolean {
        return now <= (this.untilShot.get(id) ?? Number.NEGATIVE_INFINITY);
    }
}
