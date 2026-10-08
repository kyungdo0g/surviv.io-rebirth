// Strobe and strike-marker dangers (bot round 6, owner's open items 32 and 37), from the defs instead of the iron bomb's
// numbers for every strike:
// - a strike marker seen without its strobe (a "ping_airstrike" map ping or a variant's coloured copy: defs
//   isAirstrikePing / airstrikePingVariant) is a circle around the marker as wide as the strike lines spread to the
//   side plus the blast of the variant's bomb (AIRSTRIKE_VARIANTS bombType): the strobe's lines fly 0 / 5 / 5 / 10 / 10
//   u beside it (sim rules strobeAirstrikeOffset 5 u, survev projectile.ts:194-206), the carpet strobe's 1.4x as far
//   (0 ... 21 u, 28 with Broken Arrow; defs STROBE_STRIKES offsetMult), plus the bombs' jitter, the iron bomb's 14 u
//   blast or the heavy shell's 38 u, and the body radius;
// - a thrown strobe in view is a warning 3 s before its marker (survev's strikeDelay, defs STROBE_STRIKE_DELAY): its
//   strike lines start at the strobe and run along its flight direction (sim combat/projectiles.ts: every line is a
//   plane over the strobe, offset sideways, flying the throw direction; its bombs land from the strobe on, bombOffset
//   apart: match/airstrikes.ts bombPositions), so the danger is that strip (as a row of circles), from the moment the
//   strobe shows until its last bombs have fallen.
// Strobe dangers only ask a bot to step out of them: they never make it detour (brain/strikes.ts strikeBlocks).
import { type Vec2, v2 } from "@rebirth/core";
import {
    AIRSTRIKE_BOMB_DRIFT_MAX,
    AIRSTRIKE_VARIANTS,
    type AirstrikeVariant,
    GameConfig,
    GameObjectDefs,
    hasDef,
    isStrobe,
    STROBE_STRIKE_DELAY,
    STROBE_STRIKES,
    strobeStrikeOf,
} from "@rebirth/defs";
import { defaultRules, type ProjectileView } from "@rebirth/sim";
import type { DangerZone } from "./threats.ts";

/** Sideways spacing of a strobe's strike lines (sim rules strobeAirstrikeOffset). */
const LINE_STEP = defaultRules().strobeAirstrikeOffset;
const BODY = GameConfig.player.radius;
/** After the marker: the first plane spawns 1 s later and flies 2.5 s to its line; the lines come within 3 s; the
 * bombs fall about a second (sim combat/projectiles.ts STROBE_FIRST_STRIKE / STROBE_STRIKE_WINDOW,
 * match/airstrikes.ts AIRSTRIKE_SPAWN_TIME). */
const AFTER_MARKER = 1 + 2.5 + 3 + 1;
/** A strobe out of view is forgotten this long after its strike ended; strobes kept at most. */
const MAX_STROBES = 16;
/** Circles along a strip are this far apart at most (a fraction of their radius). */
const STEP_SHARE = 0.6;

const blastCache = new Map<string, number>();

/** rad.max of the explosion a throwable makes (0 when it makes none): explosion_bomb_iron 14, the heavy shell 38. */
export function bombBlast(type: string): number {
    const hit = blastCache.get(type);
    if (hit !== undefined) return hit;
    let rad = 0;
    if (hasDef(type)) {
        const t = GameObjectDefs[type] as { explosionType?: string };
        if (t.explosionType && hasDef(t.explosionType))
            rad = (GameObjectDefs[t.explosionType] as { rad?: { max: number } }).rad?.max ?? 0;
    }
    blastCache.set(type, rad);
    return rad;
}

/** How far to the side a strobe's farthest strike line flies (lines 0 / step / step / 2 step ...: ceil((n-1)/2)). */
export function strobeLateral(type: string, brokenArrow = false): number {
    const s = strobeStrikeOf(type) ?? STROBE_STRIKES.strobe;
    const lines = s.strikes + (brokenArrow ? s.brokenArrowBonus : 0);
    return Math.ceil((lines - 1) / 2) * LINE_STEP * s.offsetMult;
}

/** The strobe type behind a variant's marker: the variant strobe's, else the original strobe. */
function strobeOfVariant(variant: AirstrikeVariant): string {
    for (const [type, s] of Object.entries(STROBE_STRIKES)) if (s.variant === variant) return type;
    return "strobe";
}

/**
 * Danger radius around a strike marker of `variant` whose strobe the bot did not see: the lines' sideways spread, the
 * bombs' jitter, the variant bomb's blast and the body radius (normal 5 + 4 + 14 + 1 = 24, heavy 48, carpet 40).
 */
export function markerRadius(variant: AirstrikeVariant | undefined, brokenArrow = false): number {
    const v = AIRSTRIKE_VARIANTS[variant ?? "normal"];
    return (
        strobeLateral(strobeOfVariant(variant ?? "normal"), brokenArrow) + v.bombJitter + bombBlast(v.bombType) + BODY
    );
}

/** Seconds a marker stays dangerous after it shows (the strike lines and their bombs). */
export const MARKER_DANGER_TIME = AFTER_MARKER;

/**
 * The strip a strobe of `type` at `pos` thrown along `dir` bombs, as circles: from the strobe to the last bomb of a
 * line (bombCount - 1 offsets ahead, plus the bombs' forward drift), each as wide as the lines' spread plus the
 * jitter, the bomb's blast and the body radius.
 */
export function strobeStrip(type: string, pos: Vec2, dir: Vec2, until: number, brokenArrow = false): DangerZone[] {
    const s = strobeStrikeOf(type) ?? STROBE_STRIKES.strobe;
    const v = AIRSTRIKE_VARIANTS[s.variant];
    const rad = strobeLateral(type, brokenArrow) + v.bombJitter + bombBlast(v.bombType) + BODY;
    const len = (v.bombCount - 1) * v.bombOffset + AIRSTRIKE_BOMB_DRIFT_MAX;
    const n = Math.max(1, Math.ceil(len / (rad * STEP_SHARE)));
    const d = v2.normalizeSafe(dir, { x: 1, y: 0 });
    const out: DangerZone[] = [];
    for (let i = 0; i <= n; i++) {
        const p = v2.add(pos, v2.mul(d, (len * i) / n));
        out.push({ kind: "airstrike", pos: p, rad, until, strobe: true, ...variantOf(s.variant) });
    }
    return out;
}

function variantOf(variant: AirstrikeVariant): { variant?: AirstrikeVariant } {
    return variant !== "normal" ? { variant } : {};
}

interface SeenStrobe {
    id: number;
    type: string;
    pos: Vec2;
    dir: Vec2;
    seenAt: number;
    /** when its last bombs have fallen */
    until: number;
}

/** Thrown strobes the bot saw (its screen), each a strip danger until its strike is over. */
export class StrobeWatch {
    private readonly strobes = new Map<number, SeenStrobe>();

    update(projectiles: readonly ProjectileView[], now: number): void {
        for (const p of projectiles) {
            if (!isStrobe(p.type)) continue;
            const known = this.strobes.get(p.id);
            if (known && known.type === p.type && now < known.until) {
                // it rolls to a stop: the lines start where it lies when its marker goes up
                known.pos = v2.copy(p.pos);
                continue;
            }
            this.strobes.set(p.id, {
                id: p.id,
                type: p.type,
                pos: v2.copy(p.pos),
                dir: v2.normalizeSafe(p.dir, { x: 1, y: 0 }),
                seenAt: now,
                until: now + STROBE_STRIKE_DELAY + AFTER_MARKER,
            });
        }
        for (const [id, s] of this.strobes) if (now >= s.until) this.strobes.delete(id);
        if (this.strobes.size > MAX_STROBES) {
            const oldest = [...this.strobes.values()].sort((a, b) => a.seenAt - b.seenAt)[0];
            this.strobes.delete(oldest.id);
        }
    }

    /** The strips of the strobes still dangerous. */
    dangers(now: number): DangerZone[] {
        const out: DangerZone[] = [];
        for (const s of this.strobes.values())
            if (now < s.until) out.push(...strobeStrip(s.type, s.pos, s.dir, s.until));
        return out;
    }

    /** Whether a marker at `pos` belongs to a strobe already watched (its strip covers it better than a circle). */
    covers(pos: Vec2): boolean {
        for (const s of this.strobes.values()) if (v2.distance(s.pos, pos) < 3) return true;
        return false;
    }
}
