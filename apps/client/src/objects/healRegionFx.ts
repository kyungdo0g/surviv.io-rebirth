// Heal region effect of the rebirth buildings (the owner, 2026-10-08: the clinic's treatment rooms should look like they
// heal, so a first-time player gets it). Drawn under the roof, so it shows once the roof opens: a mint glow over each
// heal region that breathes (brighter while the followed player stands in it), heal crosses rising off the floor and a
// ring pulse spreading from the bed. A player standing in a region already gives off the heal crosses
// (playerEmitters.ts passiveHeal, from the sim's healEffect). Client only: the regions come from the building def
// (packages/defs rebirth/buildings REBIRTH_HEAL_FX_BUILDINGS lists the buildings that get it).
import { type Aabb, type Collider, collider, math, type Vec2, v2 } from "@rebirth/core";
import type { BuildingDef } from "@rebirth/defs";
import { type BuildingView, sameLayer } from "@rebirth/sim";
import { Graphics } from "pixi.js";
import { PIXELS_PER_UNIT as PX } from "../render/camera.ts";
import type { FrameContext, ViewDeps } from "./types.ts";

const GLOW_COLOR = 0x2fe08a;
const RING_COLOR = 0x19c46e;
/** the plus sign on the floor */
const MARK_COLOR = 0xeafff3;
/** glow alpha: idle breathing (base +- swing), with the followed player in a region */
const GLOW_IDLE = [0.65, 0.25] as const;
const GLOW_INSIDE = [0.95, 0.05] as const;
/** breathing speed (rad/s) */
const GLOW_SPEED = 2.2;
/** seconds between rising crosses per region: idle, with the followed player in it */
const CROSS_INTERVAL = [0.45, 0.22] as const;
/** rising speed of the crosses (units/s) */
const CROSS_SPEED = [0.6, 1.1] as const;
const PULSE_INTERVAL = 1.8;
/** the ring (waterRipple, a 142 px frame) grows to about 1x in its 1.75 s life; x2.2 spans a bed */
const PULSE_SCALE = 2.4;
/** the rising crosses, x the heal effect's size */
const CROSS_SCALE = 1.3;
/** over the furniture (10), under dead bodies (12) and players (18) */
const CROSS_Z_ORD = 11.5;
/** the roof is open enough to see the room */
const SEEN_BELOW_CEILING_ALPHA = 0.95;

interface Region {
    col: Collider;
    box: Aabb;
    /** where the ring pulse starts: the bed in the region, else its centre */
    focus: Vec2;
    crossTimer: number;
    pulseTimer: number;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Draws one region's glow in pixel space: layered fills brighter towards the middle, a rim and a plus sign. */
function drawGlow(g: Graphics, col: Collider): void {
    if (col.type === collider.Type.Circle) {
        const cx = col.pos.x * PX;
        const cy = -col.pos.y * PX;
        for (const [inset, alpha] of [
            [0, 0.16],
            [0.5, 0.12],
            [1, 0.12],
        ] as const) {
            if (col.rad > inset) g.circle(cx, cy, (col.rad - inset) * PX).fill({ color: GLOW_COLOR, alpha });
        }
        g.circle(cx, cy, Math.max(0, col.rad - 0.25) * PX).stroke({ width: 4, color: RING_COLOR, alpha: 0.75 });
        return;
    }
    const { min, max } = col;
    for (const [inset, alpha] of [
        [0, 0.16],
        [0.5, 0.12],
        [1, 0.12],
    ] as const) {
        const w = max.x - min.x - 2 * inset;
        const h = max.y - min.y - 2 * inset;
        if (w <= 0 || h <= 0) continue;
        g.roundRect((min.x + inset) * PX, -(max.y - inset) * PX, w * PX, h * PX, 0.6 * PX).fill({
            color: GLOW_COLOR,
            alpha,
        });
    }
    const rim = 0.25;
    g.roundRect(
        (min.x + rim) * PX,
        -(max.y - rim) * PX,
        (max.x - min.x - 2 * rim) * PX,
        (max.y - min.y - 2 * rim) * PX,
        0.5 * PX,
    ).stroke({ width: 4, color: RING_COLOR, alpha: 0.75 });
    const c = v2.mul(v2.add(min, max), 0.5);
    const arm = 1.6;
    const half = 0.45;
    g.rect((c.x - half) * PX, -(c.y + arm) * PX, 2 * half * PX, 2 * arm * PX)
        .rect((c.x - arm) * PX, -(c.y + half) * PX, 2 * arm * PX, 2 * half * PX)
        .fill({ color: MARK_COLOR, alpha: 0.55 });
}

export class HealRegionFx {
    private readonly deps: ViewDeps;
    private readonly regions: Region[] = [];
    private readonly glow = new Graphics({ label: "heal-region-glow" });
    private readonly layer: number;
    private t = Math.random() * 10;
    /** crosses and ring pulses spawned (tests: BuildingRender.fxCounts) */
    spawned = 0;

    constructor(deps: ViewDeps, def: BuildingDef, view: BuildingView) {
        this.deps = deps;
        this.layer = view.layer;
        const rot = math.oriToRad(view.ori);
        const beds = def.mapObjects
            .filter((c) => typeof c.type === "string" && c.type.startsWith("bed_"))
            .map((c) => v2.add(view.pos, v2.rotate(c.pos, rot)));
        for (const r of def.healRegions ?? []) {
            const col = collider.transform(r.collision, view.pos, rot, 1);
            const box = collider.toAabb(col);
            const focus = beds.find((b) => collider.contains(col, b)) ?? v2.mul(v2.add(box.min, box.max), 0.5);
            this.regions.push({ col, box, focus, crossTimer: rand(0, 0.5), pulseTimer: rand(0, PULSE_INTERVAL) });
            drawGlow(this.glow, col);
        }
        void deps.textures.preload([
            ["part-heal-basic.img", 0.25],
            ["player-ripple-01.img", PULSE_SCALE],
        ]);
    }

    /** Whether the followed player stands in one of the regions. */
    private localIn(ctx: FrameContext): boolean {
        return (
            sameLayer(ctx.localLayer, this.layer) && this.regions.some((r) => collider.contains(r.col, ctx.localPos))
        );
    }

    update(ctx: FrameContext, ceilingAlpha: number, floorZOrd: number, zIdx: number): void {
        this.t += ctx.dt;
        const inside = this.localIn(ctx);
        const [base, swing] = inside ? GLOW_INSIDE : GLOW_IDLE;
        this.glow.alpha = base + swing * Math.sin(this.t * GLOW_SPEED);
        this.glow.visible = true;
        this.deps.renderer.add(this.glow, this.layer, floorZOrd + 0.5, zIdx);
        const particles = this.deps.particles;
        if (!particles || ceilingAlpha >= SEEN_BELOW_CEILING_ALPHA) return;
        const interval = inside ? CROSS_INTERVAL[1] : CROSS_INTERVAL[0];
        for (const r of this.regions) {
            r.crossTimer -= ctx.dt;
            if (r.crossTimer <= 0) {
                r.crossTimer = rand(interval * 0.75, interval * 1.25);
                const pos = {
                    x: rand(r.box.min.x + 0.5, r.box.max.x - 0.5),
                    y: rand(r.box.min.y + 0.5, r.box.max.y - 0.5),
                };
                if (collider.contains(r.col, pos)) {
                    particles.add(
                        "heal_basic",
                        this.layer,
                        pos,
                        { x: 0, y: rand(...CROSS_SPEED) },
                        { zOrd: CROSS_Z_ORD, scale: CROSS_SCALE },
                    );
                    this.spawned++;
                }
            }
            r.pulseTimer -= ctx.dt;
            if (r.pulseTimer <= 0) {
                r.pulseTimer = PULSE_INTERVAL;
                particles.add(
                    "waterRipple",
                    this.layer,
                    r.focus,
                    { x: 0, y: 0 },
                    { color: RING_COLOR, zOrd: floorZOrd + 0.6, scale: PULSE_SCALE },
                );
                this.spawned++;
            }
        }
    }

    setVisible(visible: boolean): void {
        this.glow.visible = visible;
    }

    destroy(): void {
        this.glow.destroy();
    }
}
