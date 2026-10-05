// The red zone on the client (survev client/src/gas.ts; docs/research/mechanics/gas.md "Client presentation"):
// - GasTracker keeps the latest GasView and interpolates the stage progress between two snapshots, so the
//   closing circle moves smoothly (the original's circleTOld -> circleT over the interpolation interval).
// - GasShape fills everything outside the circle with the original's 512-segment edge. The world draws it red
//   0xff0000 at 60 % alpha in screen space above every world layer; the minimap draws it in black at 60 %.
import type { Vec2 } from "@rebirth/core";
import type { GasModeName, GasView } from "@rebirth/sim";
import { Mesh, MeshGeometry, type Shader, Texture } from "pixi.js";

/** the annulus reaches this many pixels past the farthest corner of the covered area */
const OUTER_MARGIN = 16;
/** segments of the hole (survev gas.ts) */
const SEGMENTS = 512;
/** in-world gas colour and alpha (survev game.ts new Gas -> GasRenderer(0xff0000), alpha 0.6) */
export const WORLD_GAS_COLOR = 0xff0000;
/** minimap gas colour (survev ui.ts new GasRenderer(canvasMode, 0x000000)) */
export const MAP_GAS_COLOR = 0x000000;
const GAS_ALPHA = 0.6;

export interface Circle {
    pos: Vec2;
    rad: number;
}

export class GasTracker {
    view: GasView | null = null;
    /** progress of the previous and the latest snapshot within the current stage */
    private prevT = 0;
    private curT = 0;

    /** Records a snapshot's gas; returns the new mode when it changed (the HUD announces it). */
    push(gas: GasView): GasModeName | null {
        const old = this.view;
        const changed = !old || old.mode !== gas.mode;
        // a new stage restarts the progress: never blend across stages (the circle would jump)
        this.prevT = old && old.stage === gas.stage ? this.curT : gas.gasT;
        this.curT = gas.gasT;
        this.view = gas;
        return changed ? gas.mode : null;
    }

    clear(): void {
        this.view = null;
        this.prevT = 0;
        this.curT = 0;
    }

    /** The match started: the zone is drawn (the original isActive: mode != Inactive). */
    get active(): boolean {
        return !!this.view && this.view.mode !== "inactive";
    }

    get mode(): GasModeName {
        return this.view?.mode ?? "inactive";
    }

    /** Current red-zone circle; `alpha` blends from the previous to the latest snapshot (gasCircle in the sim). */
    circle(alpha = 1): Circle | null {
        const g = this.view;
        if (!g) return null;
        const t = g.mode === "moving" ? this.prevT + (this.curT - this.prevT) * alpha : 0;
        return {
            pos: { x: g.posOld.x + (g.posNew.x - g.posOld.x) * t, y: g.posOld.y + (g.posNew.y - g.posOld.y) * t },
            rad: g.radOld + (g.radNew - g.radOld) * t,
        };
    }

    /** The next safe circle (the white ring on the map). */
    safeZone(): Circle | null {
        const g = this.view;
        return g ? { pos: g.posNew, rad: g.radNew } : null;
    }

    /** Whole seconds left in the stage, as the HUD timer shows them (survev ui.ts: floor(duration * (1 - t))). */
    timeLeft(): number {
        const g = this.view;
        return g ? Math.max(Math.floor(g.duration * (1 - this.curT)), 0) : 0;
    }

    /** Seconds left rounded up, for the "advances in" announcement (survev gas.ts setFullState). */
    timeLeftCeil(): number {
        const g = this.view;
        return g ? Math.max(Math.ceil(g.duration * (1 - this.curT)), 0) : 0;
    }
}

/** Area the overlay must cover, in the parent's pixels (the screen, or the minimap square). */
export interface CoverRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * The overlay: everything outside a circle, drawn as a 512-segment annulus from the circle out to just past the
 * farthest corner of the area to cover. Same edge as the original's square with a circular hole, but every vertex
 * stays near the screen: the original's 100000-radii square loses float precision on the GPU (seams).
 */
export class GasShape {
    readonly display: Mesh<MeshGeometry, Shader>;
    private readonly geometry: MeshGeometry;
    private readonly unit: Float32Array;

    constructor(color: number) {
        this.unit = new Float32Array(SEGMENTS * 2);
        for (let i = 0; i < SEGMENTS; i++) {
            const theta = (i / SEGMENTS) * Math.PI * 2;
            this.unit[i * 2] = Math.sin(theta);
            this.unit[i * 2 + 1] = Math.cos(theta);
        }
        // vertex 2i: inner ring, 2i + 1: outer ring; one quad per segment
        const indices = new Uint32Array(SEGMENTS * 6);
        for (let i = 0; i < SEGMENTS; i++) {
            const a = i * 2;
            const b = ((i + 1) % SEGMENTS) * 2;
            indices.set([a, a + 1, b, b, a + 1, b + 1], i * 6);
        }
        this.geometry = new MeshGeometry({
            positions: new Float32Array(SEGMENTS * 4),
            uvs: new Float32Array(SEGMENTS * 4),
            indices,
        });
        this.display = new Mesh({ geometry: this.geometry, texture: Texture.WHITE });
        this.display.label = "gas";
        this.display.tint = color;
        this.display.alpha = GAS_ALPHA;
        this.display.visible = false;
    }

    /** Fills everything outside the circle at `pos` with radius `rad` that lies in `cover` (parent pixels). */
    render(pos: Vec2, rad: number, visible: boolean, cover: CoverRect): void {
        const far = Math.max(
            Math.hypot(cover.x - pos.x, cover.y - pos.y),
            Math.hypot(cover.x + cover.width - pos.x, cover.y - pos.y),
            Math.hypot(cover.x - pos.x, cover.y + cover.height - pos.y),
            Math.hypot(cover.x + cover.width - pos.x, cover.y + cover.height - pos.y),
        );
        // the polygon's flat sides cut in by rad * (1 - cos(pi / SEGMENTS)): cover that too
        const outer = (far + OUTER_MARGIN) / Math.cos(Math.PI / SEGMENTS);
        const inner = Math.max(0, rad);
        if (!visible || inner >= outer) {
            this.display.visible = false;
            return;
        }
        const positions = this.geometry.positions;
        for (let i = 0; i < SEGMENTS; i++) {
            const ux = this.unit[i * 2];
            const uy = this.unit[i * 2 + 1];
            positions[i * 4] = pos.x + ux * inner;
            positions[i * 4 + 1] = pos.y + uy * inner;
            positions[i * 4 + 2] = pos.x + ux * outer;
            positions[i * 4 + 3] = pos.y + uy * outer;
        }
        this.geometry.getBuffer("aPosition").update();
        this.display.visible = true;
    }

    destroy(): void {
        this.display.destroy();
    }
}
