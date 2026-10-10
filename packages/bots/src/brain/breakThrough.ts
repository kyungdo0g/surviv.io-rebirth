// Breaking through what blocks the way (BrainFeatures.breakThrough; owner requests 2026-10-09/10, nav/breakThrough.ts):
// the path follower plans through breakable obstacles of the classes the bot breaks (its mask: the house rule's and
// indoor obstacles for most players, glass walls elsewhere for a persona-driven share) and reports the obstacle on the
// way once the bot sees it; here, after the decision, a bot travelling (exploring, looting, sweeping, going to the zone
// and the like, no enemy close) draws its melee, walks up to it and punches it until it breaks, then walks on through.
// The draws come from the bot's seed (no rng stream shifts): a cautious, unskilled persona goes round a glass wall more
// often than a bold one; nearly everyone breaks the club's couch, the mansion's panels, the police station's interior
// walls and the greenhouse glass (the house rule).
import { v2 } from "@rebirth/core";
import { WeaponSlot } from "@rebirth/defs";
import { distanceToCollider, segmentHits } from "../geom.ts";
import { type BlockerSink, BREAK_BITS } from "../nav/breakThrough.ts";
import { sameLayer } from "../nav/cellGrid.ts";
import type { PersonaParams } from "../persona.ts";
import type { SkillProfile } from "../skill.ts";
import { closestPoint, meleeBreaks, meleeReach, swingLands } from "./containers.ts";
import type { BehaviourName, BrainCtx, Intent } from "./context.ts";

/** A reported obstacle is acted on this long after the follower last reported it... */
const FRESH = 0.6;
/** ...or, while the bot stands at it punching, this long after the last punch that took health off it. */
const HOLD = 3;
/** No breaking with a standing enemy in view this close: the fight comes first, and routes go round for HELD_BACK s. */
const ENEMY_NEAR = 18;
const HELD_BACK = 5;
/** The follower skips its stuck check this long after first reporting an obstacle, and after the last decision to break it. */
const ABOUT_TO = 1;
/**
 * Behaviours that travel to a goal: the only ones that break through on the way. Not the zone: a bot rotating ahead of
 * the gas keeps to the way it can walk (with the zone in, the 50v50 test's seed 11 ended with both factions' last
 * players dying in the closed zone on one tick).
 */
const TRAVEL: ReadonlySet<BehaviourName> = new Set<BehaviourName>([
    "explore",
    "loot",
    "break",
    "sweep",
    "basement",
    "puzzle",
    "regroup",
    "rally",
    "advance",
    "airdrop",
    "order",
]);

/** A unit number from the bot's seed and a salt (deterministic; no rng stream touched). */
function unit(seed: number, salt: number): number {
    let h = Math.imul((seed ^ salt) >>> 0, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** The share of players who break through the house rule's and indoor obstacles, and through glass walls elsewhere. */
export function breakShares(persona: Readonly<PersonaParams>, skill: Readonly<SkillProfile>): [number, number] {
    const bold = persona.aggressionBias + 0.5 * (persona.riskTolerance - 0.5);
    const houseRule = clamp(0.85 + 0.3 * bold + 0.2 * (skill.g - 0.5), 0.7, 0.98);
    const glass = clamp(0.3 + 0.8 * bold + 0.3 * (skill.g - 0.5), 0.05, 0.75);
    return [houseRule, glass];
}

/** The brain's side of breaking through: the bot's break classes and the obstacle the follower reported ahead. */
export class BreakThrough implements BlockerSink {
    readonly mask: number;
    /** the obstacle on the way the follower last reported, and when; the obstacle's health when last punched */
    ahead = 0;
    aheadAt = Number.NEGATIVE_INFINITY;
    private health = Number.POSITIVE_INFINITY;
    /** an enemy close held the bot back from breaking until then (game seconds), and the latest decision's time */
    private heldBackUntil = Number.NEGATIVE_INFINITY;
    /** when the obstacle ahead was first reported, and the obstacle the last decision broke and when */
    private firstAt = Number.NEGATIVE_INFINITY;
    private actingId = 0;
    private actingAt = Number.NEGATIVE_INFINITY;
    private lastNow = 0;
    /** the latest decision travels (TRAVEL): only then do routes break through */
    private travelling = true;
    /** decisions that went to breaking an obstacle on the way (diagnostics, tests) */
    acted = 0;

    constructor(enabled: boolean, persona: Readonly<PersonaParams>, skill: Readonly<SkillProfile>, seed: number) {
        const [houseRule, glass] = breakShares(persona, skill);
        this.mask = !enabled
            ? 0
            : (unit(seed, 0x6b1d) < houseRule ? BREAK_BITS.HouseRule : 0) |
              (unit(seed, 0x2f7a) < glass ? BREAK_BITS.Glass : 0);
    }

    /**
     * The break classes for the follower: none unless the bot travels (a flight or a fight takes the way it can walk
     * now), nor while an enemy close holds it back (it plans round instead).
     */
    breakMask(): number {
        return !this.travelling || this.heldBackUntil > this.lastNow ? 0 : this.mask;
    }

    blockerAhead(id: number, now: number): boolean {
        if (id !== this.ahead) {
            this.health = Number.POSITIVE_INFINITY;
            this.firstAt = now;
        }
        this.ahead = id;
        this.aheadAt = now;
        // breaking it, or about to (the next decision comes within a moment): no stuck check against it
        return now - this.firstAt < ABOUT_TO || (id === this.actingId && now - this.actingAt < ABOUT_TO);
    }

    /**
     * After the decision: a travelling bot with the reported obstacle in view breaks it (see the header). The goal
     * stays: once the obstacle is gone the follower walks on through.
     */
    apply(ctx: BrainCtx, intent: Intent): void {
        this.lastNow = ctx.now;
        this.travelling = TRAVEL.has(intent.behaviour) && !intent.targetId;
        if (!this.ahead || !this.travelling) return;
        const o = ctx.model.obstacleById.get(this.ahead);
        const me = ctx.self.pos;
        // (an obstacle reported on another floor is forgotten: down the stairs under it, the straight line to the goal
        // kept it "between" forever, punching a ground-floor door from the basement below)
        if (!o || o.view.dead || !meleeBreaks(ctx.self, o) || !sameLayer(o.view.layer, ctx.self.layer)) {
            this.ahead = 0;
            return;
        }
        const d = distanceToCollider(me, o.col);
        const reach = meleeReach(ctx.self);
        // punches landing on it keep the hold going while the bot stands still (the follower is not steered then)
        if (o.view.healthT < this.health - 1e-6) {
            if (Number.isFinite(this.health)) this.aheadAt = ctx.now;
            this.health = o.view.healthT;
        }
        // (also when the follower is not steered: a straight last approach or a stop at it, with the obstacle still
        // between the bot and where it is going)
        const to = intent.goal ?? intent.aim;
        const between = d <= reach + 1 && !!to && segmentHits(o.col, me, to);
        const fresh = ctx.now - this.aheadAt < FRESH || (d <= reach + 0.5 && ctx.now - this.aheadAt < HOLD) || between;
        if (!fresh) return;
        for (const e of ctx.visibleEnemies) {
            if (e.downed || v2.distance(e.pos, me) >= ENEMY_NEAR) continue;
            // no breaking now: the follower plans round the obstacle for a while
            this.heldBackUntil = ctx.now + HELD_BACK;
            this.ahead = 0;
            return;
        }
        const aim = closestPoint(o, me);
        intent.slot = WeaponSlot.Melee;
        intent.aim = aim;
        intent.lookAt = aim;
        if (d <= reach && swingLands(ctx, o, me)) {
            intent.stop = true;
            intent.moveDir = null;
            intent.fire = ctx.self.curWeapIdx === WeaponSlot.Melee;
        }
        this.acted++;
        this.actingId = o.view.id;
        this.actingAt = ctx.now;
    }
}
