// Rebirth screen-space hit feedback (user/2026-10-07-hit-feedback), drawn in the renderer's screen layer over the world
// and under the UI overlay:
// - the hit marker: four diagonal ticks at the crosshair when the active player's hit landed, tinted by variant (white
//   body, blue armour, gold headshot, orange knock, red kill) and sized by the damage, with an expanding ring for knocks
//   and kills (fx/hitFeedbackMath.ts MARKER_STYLES);
// - damage arcs: a red ±25° arc around the active player pointing at whoever hurt it (or back along the hit's direction
//   when the attacker is not in view), one per attacker, at most four, fading over one second.
// Every shape is built once (white marker, red arcs; arcs are rebuilt only when the screen size changes their radius);
// variants only change tint, alpha, scale, rotation and position. Nothing here exists in v0.8.82.
import type { Vec2 } from "@rebirth/core";
import { type Container, Graphics } from "pixi.js";
import {
    ARC_HALF_ANGLE,
    ARC_LIFE,
    arcAlpha,
    arcAngle,
    arcRadius,
    MARKER_STYLES,
    MAX_ARCS,
    type MarkerVariant,
    markerFrame,
    RING_LIFE,
} from "./hitFeedbackMath.ts";

/** marker ticks run from 6 to 14 px off the centre, at 45 degrees */
const TICK_INNER = 6;
const TICK_OUTER = 14;
const RING_START = 14;
const RING_END = 26;
const ARC_COLOR = 0xd01414;
/** two arcs from attackers with no id merge when their directions are this close (radians) */
const ARC_MERGE_ANGLE = 0.5;

function buildMarker(): Graphics {
    const g = new Graphics({ label: "hit-marker" });
    const ticks = (width: number, color: number, alpha: number) => {
        for (let i = 0; i < 4; i++) {
            const a = Math.PI / 4 + (i * Math.PI) / 2;
            const c = Math.cos(a);
            const s = Math.sin(a);
            g.moveTo(c * TICK_INNER, s * TICK_INNER).lineTo(c * TICK_OUTER, s * TICK_OUTER);
        }
        g.stroke({ width, color, alpha, cap: "round" });
    };
    // a dark outline keeps the white ticks readable on snow and sand; tinting leaves it dark
    ticks(5, 0x000000, 0.55);
    ticks(3, 0xffffff, 1);
    g.visible = false;
    return g;
}

function buildRing(): Graphics {
    const g = new Graphics({ label: "hit-marker-ring" });
    g.circle(0, 0, RING_START).stroke({ width: 2, color: 0xffffff, alpha: 1 });
    g.visible = false;
    return g;
}

interface Arc {
    g: Graphics;
    active: boolean;
    sourceId: number;
    /** world direction the hit travelled (+y up), null when unknown */
    dir: Vec2 | null;
    hasDir: boolean;
    age: number;
    k: number;
}

export class HitMarkers {
    private readonly marker = buildMarker();
    private readonly ring = buildRing();
    private variant: MarkerVariant = 0;
    private k = 0;
    private age = Number.POSITIVE_INFINITY;
    private ringAge = Number.POSITIVE_INFINITY;
    private readonly arcs: Arc[] = [];
    private arcR = 0;
    /** markers shown since boot by variant, arcs started (tests, debug) */
    readonly shown = [0, 0, 0, 0, 0];
    arcsStarted = 0;

    constructor(parent: Container) {
        parent.addChild(this.ring, this.marker);
        for (let i = 0; i < MAX_ARCS; i++) {
            const g = new Graphics({ label: "damage-arc" });
            g.visible = false;
            parent.addChild(g);
            this.arcs.push({ g, active: false, sourceId: 0, dir: { x: 0, y: 0 }, hasDir: false, age: 0, k: 0 });
        }
    }

    /** Shows the marker for a hit of `variant` and intensity k (one per snapshot: the strongest variant wins). */
    showMarker(variant: MarkerVariant, k: number): void {
        this.variant = variant;
        this.k = k;
        this.age = 0;
        this.marker.tint = MARKER_STYLES[variant].tint;
        if (MARKER_STYLES[variant].ring) {
            this.ringAge = 0;
            this.ring.tint = MARKER_STYLES[variant].tint;
        }
        this.shown[variant]++;
    }

    /**
     * An arc toward the attacker `sourceId` (0: not in view) for a hit along `dir` of intensity k: a repeat hit refreshes
     * its arc; with all four busy, the one closest to expiring is replaced.
     */
    addArc(sourceId: number, dir: Vec2 | undefined, k: number): void {
        let slot: Arc | undefined;
        for (const a of this.arcs) {
            if (!a.active) continue;
            if (sourceId !== 0 && a.sourceId === sourceId) slot = a;
            else if (sourceId === 0 && a.sourceId === 0 && dir && a.hasDir && a.dir) {
                const da = Math.abs(Math.atan2(dir.y, dir.x) - Math.atan2(a.dir.y, a.dir.x));
                if (Math.min(da, Math.PI * 2 - da) < ARC_MERGE_ANGLE) slot = a;
            }
            if (slot) break;
        }
        if (!slot) slot = this.arcs.find((a) => !a.active);
        if (!slot) slot = this.arcs.reduce((best, a) => (a.age > best.age ? a : best));
        // a refreshed arc keeps what is left of a stronger hit
        slot.k = slot.active && slot.sourceId === sourceId ? Math.max(slot.k * (1 - slot.age / ARC_LIFE), k) : k;
        slot.active = true;
        slot.sourceId = sourceId;
        slot.hasDir = !!dir;
        if (dir && slot.dir) {
            slot.dir.x = dir.x;
            slot.dir.y = dir.y;
        }
        slot.age = 0;
        this.arcsStarted++;
    }

    get activeArcs(): number {
        let n = 0;
        for (const a of this.arcs) if (a.active) n++;
        return n;
    }

    /** marker on screen now (tests) */
    get markerVisible(): boolean {
        return this.marker.visible;
    }

    /**
     * Per frame. `at`: where the marker goes (the cursor, or the target on touch / while spectating); `center`: the active
     * player on screen; `sourcePos(id)`: an attacker's screen position when it is in view; `hidden`: Hide UI.
     */
    update(
        dt: number,
        at: Vec2,
        center: Vec2,
        screen: { width: number; height: number },
        sourcePos: (id: number) => Vec2 | null,
        hidden: boolean,
        hudScale: number,
    ): void {
        this.age += dt;
        this.ringAge += dt;
        const style = MARKER_STYLES[this.variant];
        const size = Math.min(1.25, Math.max(0.75, hudScale));
        if (this.age < style.life && !hidden) {
            const f = markerFrame(this.variant, this.k, this.age);
            this.marker.visible = true;
            this.marker.position.set(at.x, at.y);
            this.marker.scale.set(f.scale * size);
            this.marker.alpha = f.alpha;
        } else {
            this.marker.visible = false;
        }
        if (this.ringAge < RING_LIFE && !hidden) {
            const t = this.ringAge / RING_LIFE;
            this.ring.visible = true;
            this.ring.position.set(at.x, at.y);
            // the ring grows with the marker's size, so it starts just outside the ticks
            const grow = (RING_START + (RING_END - RING_START) * t) / RING_START;
            this.ring.scale.set(grow * style.base * size);
            this.ring.alpha = 0.9 * (1 - t);
        } else {
            this.ring.visible = false;
        }
        this.updateArcs(dt, center, screen, sourcePos, hidden);
    }

    private updateArcs(
        dt: number,
        center: Vec2,
        screen: { width: number; height: number },
        sourcePos: (id: number) => Vec2 | null,
        hidden: boolean,
    ): void {
        const r = arcRadius(screen.width, screen.height);
        if (Math.abs(r - this.arcR) > 0.5) {
            this.arcR = r;
            for (const a of this.arcs) drawArc(a.g, r);
        }
        for (const a of this.arcs) {
            if (!a.active) continue;
            a.age += dt;
            const alpha = arcAlpha(a.age, a.k);
            const angle = arcAngle(center, a.sourceId ? sourcePos(a.sourceId) : null, a.hasDir ? a.dir : null);
            if (a.age >= ARC_LIFE || alpha <= 0) {
                a.active = false;
                a.g.visible = false;
                continue;
            }
            a.g.visible = !hidden && angle !== null;
            if (!a.g.visible) continue;
            a.g.position.set(center.x, center.y);
            a.g.rotation = angle ?? 0;
            a.g.scale.set(1 + 0.15 * a.k);
            a.g.alpha = alpha;
        }
    }

    /** Hides everything (the setting turned off, a new active player). */
    clear(): void {
        this.age = Number.POSITIVE_INFINITY;
        this.ringAge = Number.POSITIVE_INFINITY;
        this.marker.visible = false;
        this.ring.visible = false;
        for (const a of this.arcs) {
            a.active = false;
            a.g.visible = false;
        }
    }

    destroy(): void {
        this.marker.destroy();
        this.ring.destroy();
        for (const a of this.arcs) a.g.destroy();
    }
}

/** A ±25 degree arc at radius `r` around the origin, pointing along +x: a soft outer glow under an 8 px core. */
function drawArc(g: Graphics, r: number): void {
    g.clear();
    const arc = (radius: number, width: number, alpha: number) => {
        // start each arc with a move so no line joins it to the previous one
        g.moveTo(Math.cos(-ARC_HALF_ANGLE) * radius, Math.sin(-ARC_HALF_ANGLE) * radius);
        g.arc(0, 0, radius, -ARC_HALF_ANGLE, ARC_HALF_ANGLE).stroke({ width, color: ARC_COLOR, alpha, cap: "round" });
    };
    arc(r + 5, 4, 0.35);
    arc(r, 8, 0.9);
}
