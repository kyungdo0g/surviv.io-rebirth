// Outfits by persona taste (bot overhaul LOOT2, user report 22; BrainFeatures.outfits). Outfits change nothing in a
// fight (only the ghillie suit's tint, a camouflage: client player.ts), so wearing one is pure taste: some players put
// on every new outfit they find, some only the ones they like, most never bother. Each bot draws its habit once, from
// the persona's `outfitMix`, on the persona stream (never the brain's), the first time it sees an outfit:
// - "any": every outfit it has not worn yet (never the basic outfit, never back to one it took off);
// - "liked": only outfits on its own ranked list (4-8 of the lootable outfits; cautious personas lean to camouflage:
//   ghillie, camo patterns, the obstacle disguises), and only one it ranks above what it wears (it never swaps back);
// - "never": NEUTRAL, today's bot.
// It must cost little and never come before combat or safety: an outfit is worth a detour of at most OUTFIT_DIST, only
// when nothing threatened the bot for QUIET seconds, nobody is in view, it is not hurt and the zone does not press;
// as loot it is worth little (OUTFIT_VALUE) and its loot score is capped below every fight, flight, heal or zone score
// (OUTFIT_SCORE). A role outfit (noDrop: the role's kit) is never taken off.
import { GameObjectDefs, hasDef } from "@rebirth/defs";
import type { BrainCtx } from "./context.ts";
import { zonePressure } from "./survival.ts";

export type OutfitStyle = "any" | "liked" | "never";

export interface OutfitTaste {
    style: OutfitStyle;
    /** "liked": the outfits it likes, best first */
    likes: readonly string[];
}

/** An outfit farther than this is not worth the walk. */
export const OUTFIT_DIST = 15;
/** Loot value of a wanted outfit (a liked one up to +4 by rank); a box of ammo is worth 12-60. */
export const OUTFIT_VALUE = 10;
/** The loot score of an outfit stays below this (fights, flights, heals and a pressing zone score more). */
export const OUTFIT_SCORE = 0.26;
/** Seconds without a threat (an enemy in view, a close bullet, damage, gunfire heard) before an outfit is considered. */
const QUIET = 5;
/** Below this health the bot has better things to do. */
const MIN_HEALTH = 60;
/** Zone pressure (survival.ts) above which no detour is taken. */
const ZONE_PRESS = 0.15;
/** Camouflage outfits besides the ghillie suit and the obstacle disguises (defs: obstacleType). */
const CAMO = new Set(["outfitCamo", "outfitWoodland", "outfitDesertCamo", "outfitVerde", "outfitKhaki"]);

interface OutfitDef {
    type: string;
    noDrop?: boolean;
    noDropOnDeath?: boolean;
    ghillie?: boolean;
    obstacleType?: string;
}

function outfitDef(id: string): OutfitDef | undefined {
    if (!id || !hasDef(id)) return undefined;
    const d = GameObjectDefs[id] as unknown as OutfitDef;
    return d.type === "outfit" ? d : undefined;
}

/** Outfits that can lie on the ground as loot (not the basic outfit, role kits or loadout-only skins). */
export function lootableOutfit(id: string): boolean {
    const d = outfitDef(id);
    return !!d && !d.noDrop && !d.noDropOnDeath && id !== "outfitBase";
}

let pool: string[] | null = null;

/** Every lootable outfit, in defs order. */
export function outfitPool(): readonly string[] {
    if (!pool) pool = Object.keys(GameObjectDefs).filter(lootableOutfit);
    return pool;
}

export function isCamo(id: string): boolean {
    const d = outfitDef(id);
    return !!d && (!!d.ghillie || !!d.obstacleType || CAMO.has(id));
}

/**
 * Draws a bot's outfit habit from its persona (`outfitMix`) and `next` (the persona stream): one draw for the habit
 * when more than one has weight, then for "liked" one for the list's length and one per pick (weighted without
 * replacement, camouflage weighted 1 + 2 x (0.6 - riskTolerance), at least 0.3).
 */
export function drawOutfitTaste(ctx: Pick<BrainCtx, "persona">, next: () => number): OutfitTaste {
    const mix = ctx.persona.outfitMix;
    const habits = (["any", "liked", "never"] as const).filter((h) => mix[h] > 0);
    let style: OutfitStyle = "never";
    if (habits.length === 1) style = habits[0];
    else if (habits.length > 1) {
        const total = habits.reduce((a, h) => a + mix[h], 0);
        let r = next() * total;
        style = habits[habits.length - 1];
        for (const h of habits) {
            if (r < mix[h]) {
                style = h;
                break;
            }
            r -= mix[h];
        }
    }
    if (style !== "liked") return { style, likes: [] };
    const camoWeight = Math.max(0.3, 1 + 2 * (0.6 - ctx.persona.riskTolerance));
    const left = outfitPool().map((id) => ({ id, w: isCamo(id) ? camoWeight : 1 }));
    const n = Math.min(left.length, 4 + Math.floor(next() * 5));
    const likes: string[] = [];
    while (likes.length < n && left.length) {
        const total = left.reduce((a, x) => a + x.w, 0);
        let r = next() * total;
        let k = left.length - 1;
        for (let i = 0; i < left.length; i++) {
            if (r < left[i].w) {
                k = i;
                break;
            }
            r -= left[i].w;
        }
        likes.push(left[k].id);
        left.splice(k, 1);
    }
    return { style, likes };
}

/** The bot's outfit habit (drawn on first use; "never" for NEUTRAL without a draw). */
export function outfitTaste(ctx: BrainCtx): OutfitTaste {
    const lm = ctx.mem.loot2;
    if (!lm.outfitTaste) lm.outfitTaste = drawOutfitTaste(ctx, () => ctx.personaRng.next());
    return lm.outfitTaste;
}

/** Remembers the outfit the bot wears (call once per decision while the feature is on). */
export function noteOutfit(ctx: BrainCtx): void {
    if (ctx.self.outfit) ctx.mem.loot2.outfitsWorn.add(ctx.self.outfit);
}

/** Quiet enough for an outfit: nothing threatened the bot for a while, nobody in view, healthy, no zone hurry. */
export function outfitTime(ctx: BrainCtx): boolean {
    if (ctx.now - ctx.mem.loot2.lastThreat < QUIET) return false;
    if (ctx.visibleEnemies.some((e) => !e.downed)) return false;
    if (ctx.self.health < MIN_HEALTH || ctx.self.downed) return false;
    if (ctx.model.inGasNow() || zonePressure(ctx.model) > ZONE_PRESS) return false;
    return true;
}

/**
 * What the outfit `type` lying `dist` away is worth to the bot as loot (0: leave it). Draws the bot's habit the first
 * time a lootable outfit is close and the moment is quiet (BrainFeatures.outfits only: the caller gates it).
 */
export function outfitValue(ctx: BrainCtx, type: string, dist: number): number {
    if (dist > OUTFIT_DIST || !lootableOutfit(type)) return 0;
    const cur = ctx.self.outfit;
    if (type === cur || outfitDef(cur)?.noDrop) return 0;
    // (the habit is drawn only now: a persona that never sees an outfit draws nothing)
    if (ctx.persona.outfitMix.any <= 0 && ctx.persona.outfitMix.liked <= 0) return 0;
    if (!outfitTime(ctx)) return 0;
    const taste = outfitTaste(ctx);
    if (taste.style === "never" || ctx.mem.loot2.outfitsWorn.has(type)) return 0;
    if (taste.style === "any") return OUTFIT_VALUE;
    const rank = taste.likes.indexOf(type);
    if (rank < 0) return 0;
    const current = taste.likes.indexOf(cur);
    if (current >= 0 && current <= rank) return 0;
    return OUTFIT_VALUE + 4 * (1 - rank / taste.likes.length);
}

/** Whether `type` is an outfit (its loot score is capped at OUTFIT_SCORE). */
export function isOutfit(type: string): boolean {
    return !!outfitDef(type);
}
