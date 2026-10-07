// Pure geometry and rules of the client bullet hit check (survev client/src/objects/bullet.ts addBullet / m_update,
// player.ts m_hasActivePan / m_getPanSegment, util.sameAudioLayer, coldet.intersectSegmentSegment) (M9).
import type { Vec2 } from "@rebirth/core";
import { GameObjectDefs, type MeleeDef } from "@rebirth/defs";
import type { BulletEvent, PlayerView } from "@rebirth/sim";

/** Tracer width of a bullet: halved for Splinter Rounds side bullets, doubled for thick ones (survev addBullet). */
export function tracerWidth(base: number, e: Pick<BulletEvent, "splinter" | "thick">): number {
    let width = base;
    if (e.splinter) width *= 0.5;
    if (e.thick) width *= 2;
    return width;
}

/**
 * Tracer tint (survev addBullet, client bullet.ts:163-172): AP Rounds bullets take the ammo's apSaturated colour where
 * it has one, else saturated bullets the chambered or saturated colour, else the saturated colour on a bright floor,
 * else regular.
 */
export function tracerTint(
    colors: Record<string, number>,
    saturated: boolean,
    brightFloor: boolean,
    apRounds = false,
): number {
    if (apRounds && colors.apSaturated !== undefined) return colors.apSaturated;
    if (saturated) return colors.chambered ?? colors.saturated ?? colors.regular ?? 0xffffff;
    if (brightFloor) return colors.saturated ?? colors.regular ?? 0xffffff;
    return colors.regular ?? 0xffffff;
}

/** Layers 0 ground / 1 underground / 2-3 stairs; stair layers see both floors (survev util.sameLayer). */
export function sameLayer(a: number, b: number): boolean {
    return (a & 1) === (b & 1) || ((a & 2) !== 0 && (b & 2) !== 0);
}

/** survev util.sameAudioLayer: the bullet whiz needs the listener on the bullet's layer or either on stairs */
export function sameAudioLayer(a: number, b: number): boolean {
    return a === b || (a & 2) !== 0 || (b & 2) !== 0;
}

/** World segment of a player's pan (survev player.ts m_getPanSegment + math.transformSegment). */
export function panSegmentOf(view: PlayerView, pos: Vec2, dir: Vec2): { p0: Vec2; p1: Vec2 } | null {
    const surface = (GameObjectDefs.pan as MeleeDef | undefined)?.reflectSurface;
    if (!surface) return null;
    let { p0, p1 } = view.wearingPan ? surface.unequipped : surface.equipped;
    const scale = view.scale || 1;
    if (scale !== 1) {
        if (view.wearingPan) {
            p0 = { x: p0.x * scale, y: p0.y * scale };
            p1 = { x: p1.x * scale, y: p1.y * scale };
        } else {
            const s = (scale - 1) * 0.75;
            p0 = { x: p0.x + s, y: p0.y - s };
            p1 = { x: p1.x + s, y: p1.y - s };
        }
    }
    const ang = Math.atan2(dir.y, dir.x);
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const at = (p: Vec2) => ({ x: pos.x + p.x * c - p.y * s, y: pos.y + p.x * s + p.y * c });
    return { p0: at(p0), p1: at(p1) };
}

/** A held pan (not mid-swing) or one worn on the back (survev player.ts m_hasActivePan). */
export function hasActivePan(view: PlayerView): boolean {
    return !!view.wearingPan || (view.activeWeapon === "pan" && view.anim?.type !== "melee");
}

/** Intersection point of the segments a-b and c-d, or null (survev coldet.intersectSegmentSegment). */
export function segmentHit(a: Vec2, b: Vec2, c: Vec2, d: Vec2): Vec2 | null {
    const r = { x: b.x - a.x, y: b.y - a.y };
    const s = { x: d.x - c.x, y: d.y - c.y };
    const den = r.x * s.y - r.y * s.x;
    if (Math.abs(den) < 1e-12) return null;
    const qp = { x: c.x - a.x, y: c.y - a.y };
    const t = (qp.x * s.y - qp.y * s.x) / den;
    const u = (qp.x * r.y - qp.y * r.x) / den;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return { x: a.x + r.x * t, y: a.y + r.y * t };
}

/**
 * Where the segment a -> b crosses a player's pan, tested at its current transform first, then at `old` (the previous
 * snapshot) so a turning pan is not tunnelled through; the normal is the pan's at the current transform (survev
 * bullet.ts:292-329).
 */
export function panHit(
    view: PlayerView,
    old: { pos: Vec2; dir: Vec2 },
    a: Vec2,
    b: Vec2,
): { point: Vec2; normal: Vec2 } | null {
    const newSeg = panSegmentOf(view, view.pos, view.dir);
    const oldSeg = panSegmentOf(view, old.pos, old.dir);
    if (!newSeg || !oldSeg) return null;
    const point = segmentHit(a, b, newSeg.p0, newSeg.p1) ?? segmentHit(a, b, oldSeg.p0, oldSeg.p1);
    if (!point) return null;
    const dx = newSeg.p1.x - newSeg.p0.x;
    const dy = newSeg.p1.y - newSeg.p0.y;
    const len = Math.hypot(dx, dy) || 1;
    return { point, normal: { x: -dy / len, y: dx / len } };
}
