// 50v50 air strike zones (survev client/src/objects/plane.ts AirstrikeZone; docs/research/mechanics/
// airdrop-airstrike.md "Air strikes"): a yellow (0xeaff00) circle with a 1.5 px outline and a 20 % fill on the map
// for the zone's whole duration, fading in over its first 0.5 s and out over its last 0.5 s. The snapshot lists every
// live zone with its progress; the client advances the timer between snapshots.
// Rebirth addition: the same circle drawn faintly on the ground in the world (the original shows it on the map only),
// on the ground floor and hidden underground like the planes.
// Rebirth air strike variants (docs/research/rebirth-deviations.md): each zone is drawn in its variant's style
// (airstrikeVariantStyle.ts; normal is the original yellow circle), and `apply` reports the zones that just appeared
// so the client announces the heavy and carpet ones.
import type { Vec2 } from "@rebirth/core";
import type { AirstrikeVariant } from "@rebirth/defs";
import type { AirstrikeZoneView } from "@rebirth/sim";
import { Container, Graphics } from "pixi.js";
import { PIXELS_PER_UNIT } from "../render/camera.ts";
import { type Renderer, toLocal } from "../render/renderer.ts";
import { type AirstrikeZoneStyle, blinkAlpha, innerRingRad, zoneStyle, zoneVariant } from "./airstrikeVariantStyle.ts";
import type { MapProjection } from "./mapMarkers.ts";

const FADE = 0.5;
/** just under the planes (1501) and air drops (1500) */
const WORLD_Z_ORD = 1490;
/** a zone first seen past this progress (joining or respawning mid-strike) is not announced */
const ANNOUNCE_MAX_T = 0.5;

/** A zone that just appeared (announcement, map ping tint). */
export interface NewAirstrikeZone {
    id: number;
    variant: AirstrikeVariant;
    pos: Vec2;
    /** it appeared early enough to be announced */
    announce: boolean;
}

interface Zone {
    id: number;
    variant: AirstrikeVariant;
    style: AirstrikeZoneStyle;
    pos: Vec2;
    rad: number;
    duration: number;
    ticker: number;
    map: Graphics;
    world: Graphics;
    drawnMapRad: number;
    seen: boolean;
}

function smoothstep(v: number, a: number, b: number): number {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
}

/**
 * Draws a zone of `radPx` pixels in its variant's style: the filled outline, then the inner ring (heavy: the planes'
 * aim radius; carpet: a double outline). `pxPerUnit` converts world radii (the aim radius) to pixels.
 */
function drawZone(g: Graphics, z: Zone, radPx: number, pxPerUnit: number, world: boolean): void {
    const s = z.style;
    const width = world ? s.worldLineWidth * PIXELS_PER_UNIT : s.mapLineWidth;
    g.circle(0, 0, radPx)
        .fill({ color: s.color, alpha: world ? s.worldFillAlpha : s.mapFillAlpha })
        .stroke({ width, color: s.color, alpha: world ? s.worldLineAlpha : 1 });
    const inner = innerRingRad(z.variant, z.rad) * pxPerUnit;
    if (inner > 0) {
        g.circle(0, 0, inner).stroke({ width: width * 0.6, color: s.color, alpha: world ? s.worldLineAlpha : 0.9 });
    }
}

export class AirstrikeZones {
    /** minimap overlay (added to the minimap's clipped container) */
    readonly mapContainer = new Container({ label: "minimap-airstrike-zones" });
    private readonly zones = new Map<number, Zone>();

    /** zones currently shown (tests) */
    get count(): number {
        return this.zones.size;
    }

    get list(): Array<{ id: number; variant: AirstrikeVariant; pos: Vec2; rad: number; alpha: number; color: number }> {
        return [...this.zones.values()].map((z) => ({
            id: z.id,
            variant: z.variant,
            pos: z.pos,
            rad: z.rad,
            alpha: z.map.alpha,
            color: z.style.color,
        }));
    }

    /** Applies a snapshot's zone list (complete); returns the zones that just appeared. */
    apply(list: readonly AirstrikeZoneView[]): NewAirstrikeZone[] {
        const added: NewAirstrikeZone[] = [];
        for (const z of this.zones.values()) z.seen = false;
        for (const data of list) {
            let z = this.zones.get(data.id);
            const variant = zoneVariant(data.variant);
            if (z && z.variant !== variant) {
                this.remove(z);
                z = undefined;
            }
            if (!z) {
                const style = zoneStyle(variant);
                z = {
                    id: data.id,
                    variant,
                    style,
                    pos: { x: data.pos.x, y: data.pos.y },
                    rad: data.rad,
                    duration: data.duration,
                    ticker: data.zoneT * data.duration,
                    map: new Graphics(),
                    world: new Graphics({ label: "airstrike-zone" }),
                    drawnMapRad: -1,
                    seen: true,
                };
                drawZone(z.world, z, data.rad * PIXELS_PER_UNIT, PIXELS_PER_UNIT, true);
                this.mapContainer.addChild(z.map);
                this.zones.set(data.id, z);
                added.push({ id: z.id, variant, pos: z.pos, announce: data.zoneT <= ANNOUNCE_MAX_T });
            }
            z.seen = true;
            // follow the authoritative progress when the local timer drifted
            const ticker = data.zoneT * data.duration;
            if (Math.abs(ticker - z.ticker) > 0.25) z.ticker = ticker;
        }
        for (const z of [...this.zones.values()]) if (!z.seen) this.remove(z);
        return added;
    }

    /** Variant of the zone centred within `maxDist` of `pos` (its ping_airstrike marker), or null. */
    variantNear(pos: Vec2, maxDist = 2): AirstrikeVariant | null {
        let best: Zone | null = null;
        let bestDist = maxDist;
        for (const z of this.zones.values()) {
            const d = Math.hypot(z.pos.x - pos.x, z.pos.y - pos.y);
            if (d <= bestDist) {
                best = z;
                bestDist = d;
            }
        }
        return best?.variant ?? null;
    }

    private remove(z: Zone): void {
        z.map.destroy();
        z.world.destroy();
        this.zones.delete(z.id);
    }

    private alpha(z: Zone): number {
        return smoothstep(z.ticker, 0, FADE) * (1 - smoothstep(z.ticker, z.duration - FADE, z.duration));
    }

    /** Advances the timers and draws the in-world circles; `viewerLayer` hides them underground. */
    update(dt: number, renderer: Renderer, viewerLayer: number): void {
        for (const z of this.zones.values()) {
            z.ticker = Math.min(z.duration, z.ticker + dt);
            const local = toLocal(z.pos);
            z.world.position.set(local.x, local.y);
            z.world.alpha = this.alpha(z) * blinkAlpha(z.style, z.ticker);
            const layer = (viewerLayer & 1) === 0 || viewerLayer & 2 ? 2 : 0;
            renderer.add(z.world, layer, WORLD_Z_ORD, z.id);
        }
    }

    /** Draws the zones on the minimap (call after the minimap laid itself out). */
    updateMap(proj: MapProjection): void {
        for (const z of this.zones.values()) {
            const p = proj.toMap(z.pos);
            const rad = z.rad * proj.pxPerUnit;
            if (Math.abs(rad - z.drawnMapRad) > 0.0001) {
                z.drawnMapRad = rad;
                drawZone(z.map.clear(), z, rad, proj.pxPerUnit, false);
            }
            z.map.position.set(p.x, p.y);
            z.map.alpha = this.alpha(z) * blinkAlpha(z.style, z.ticker);
        }
    }

    clear(): void {
        for (const z of [...this.zones.values()]) this.remove(z);
    }

    destroy(): void {
        this.clear();
        this.mapContainer.destroy({ children: true });
    }
}
