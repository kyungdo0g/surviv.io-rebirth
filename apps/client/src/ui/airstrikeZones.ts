// 50v50 air strike zones (survev client/src/objects/plane.ts AirstrikeZone; docs/research/mechanics/
// airdrop-airstrike.md "Air strikes"): a yellow (0xeaff00) circle with a 1.5 px outline and a 20 % fill on the map
// for the zone's whole duration, fading in over its first 0.5 s and out over its last 0.5 s. The snapshot lists every
// live zone with its progress; the client advances the timer between snapshots.
// Rebirth addition: the same circle drawn faintly on the ground in the world (the original shows it on the map only),
// on the ground floor and hidden underground like the planes.
import type { Vec2 } from "@rebirth/core";
import type { AirstrikeZoneView } from "@rebirth/sim";
import { Container, Graphics } from "pixi.js";
import { PIXELS_PER_UNIT } from "../render/camera.ts";
import { type Renderer, toLocal } from "../render/renderer.ts";
import type { MapProjection } from "./mapMarkers.ts";

const COLOR = 0xeaff00;
const FADE = 0.5;
/** in-world style: thin outline and a very light fill so the ground stays readable */
const WORLD_LINE_ALPHA = 0.55;
const WORLD_FILL_ALPHA = 0.07;
const WORLD_LINE_WIDTH = 0.2;
/** just under the planes (1501) and air drops (1500) */
const WORLD_Z_ORD = 1490;

interface Zone {
    id: number;
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

export class AirstrikeZones {
    /** minimap overlay (added to the minimap's clipped container) */
    readonly mapContainer = new Container({ label: "minimap-airstrike-zones" });
    private readonly zones = new Map<number, Zone>();

    /** zones currently shown (tests) */
    get count(): number {
        return this.zones.size;
    }

    get list(): Array<{ id: number; pos: Vec2; rad: number; alpha: number }> {
        return [...this.zones.values()].map((z) => ({ id: z.id, pos: z.pos, rad: z.rad, alpha: z.map.alpha }));
    }

    apply(list: readonly AirstrikeZoneView[]): void {
        for (const z of this.zones.values()) z.seen = false;
        for (const data of list) {
            let z = this.zones.get(data.id);
            if (!z) {
                z = {
                    id: data.id,
                    pos: { x: data.pos.x, y: data.pos.y },
                    rad: data.rad,
                    duration: data.duration,
                    ticker: data.zoneT * data.duration,
                    map: new Graphics(),
                    world: new Graphics({ label: "airstrike-zone" }),
                    drawnMapRad: -1,
                    seen: true,
                };
                z.world
                    .circle(0, 0, data.rad * PIXELS_PER_UNIT)
                    .fill({ color: COLOR, alpha: WORLD_FILL_ALPHA })
                    .stroke({ width: WORLD_LINE_WIDTH * PIXELS_PER_UNIT, color: COLOR, alpha: WORLD_LINE_ALPHA });
                this.mapContainer.addChild(z.map);
                this.zones.set(data.id, z);
            }
            z.seen = true;
            // follow the authoritative progress when the local timer drifted
            const ticker = data.zoneT * data.duration;
            if (Math.abs(ticker - z.ticker) > 0.25) z.ticker = ticker;
        }
        for (const z of [...this.zones.values()]) if (!z.seen) this.remove(z);
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
            z.world.alpha = this.alpha(z);
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
                z.map
                    .clear()
                    .circle(0, 0, rad)
                    .fill({ color: COLOR, alpha: 0.2 })
                    .stroke({ width: 1.5, color: COLOR });
            }
            z.map.position.set(p.x, p.y);
            z.map.alpha = this.alpha(z);
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
