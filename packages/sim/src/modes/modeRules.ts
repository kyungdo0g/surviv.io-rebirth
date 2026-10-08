// Event-mode knobs (M7b). Values follow docs/research/modes/*.md with their conflict resolutions, cited per field;
// `game.rules.modes` is a mutable copy.
import { GameObjectDefs } from "@rebirth/defs";

/** What a snowball / potato hit does to a non-teammate besides its damage (survev explosion.ts). */
export interface ThrowableHitRule {
    /** seconds the target is slowed by GameConfig.player.frozenSpeedPenalty and shows the frozen pose */
    freeze: number;
    /** random items the target drops (survev dropRandomLoot: a bag item, gun, melee, droppable perk or armour) */
    dropRandomLoot: number;
    /** zoom radius each hit takes off the target's view, summed up to `viewShrink.max` (survev PMG-134 shots) */
    viewShrink?: number;
}

/** How the PMG-134's view shrink adds up and wears off (survev server player.ts decrementViewDistance). */
export interface ViewShrinkRule {
    /** largest summed shrink */
    max: number;
    /** seconds after the last hit until the full view comes back at once */
    duration: number;
}

export interface ModeRules {
    /**
     * Snowball and potato hits by explosion type (throwables.md "Snowball": a hit slows the target and makes it drop
     * random items; the client defs show the frozen sprites but no duration, open-questions.md freeze-and-drop-effects).
     * Read from the explosion defs' `freezeDuration` / `dropRandomLoot` (survev balance, explosionsDefs.ts: the heavy
     * snowball slows 2 s, the heavy potato drops 2 items); the PMG-134 shot also shrinks the view.
     */
    throwableHits: Readonly<Record<string, ThrowableHitRule>>;
    /**
     * PMG-134 view shrink: 1.5 per hit up to 32, gone 2.5 s after the last hit (survev player.ts:4592-4597,
     * 1911-1918)
     */
    viewShrink: ViewShrinkRule;
    /**
     * Potato maps replace every wheel, death and win emote with emote_potato (survev emoteFromSlot; potato.md "Core rule":
     * pings and team-only emotes still work)
     */
    potatoEmotes: boolean;
    /**
     * Cobalt: joining players wait at the Twins bunker (bunker_twins_sublevel_01, underground) while the class menu is
     * open and are moved to a normal spawn point once they have a class (cobalt.md "Class selection and spawning", survev
     * addPlayer / roleSelect). Off: they wait at their spawn point. Either way they cannot act or be hurt meanwhile.
     */
    cobaltWaitingRoom: boolean;
}

/** survev explosion.ts:240-242: each PMG-134 shot takes 1.5 off the target's zoom radius */
const POTATO_LMG_VIEW_SHRINK = 1.5;

/** Every explosion def with a `freezeDuration`: its slow and random drops (survev explosion.ts:209-243). */
function throwableHitsFromDefs(): Record<string, ThrowableHitRule> {
    const out: Record<string, ThrowableHitRule> = {};
    for (const [id, def] of Object.entries(GameObjectDefs)) {
        if (def.type !== "explosion" || def.freezeDuration === undefined) continue;
        out[id] = { freeze: def.freezeDuration, dropRandomLoot: def.dropRandomLoot ?? 0 };
    }
    if (out.explosion_potato_lmgshot) out.explosion_potato_lmgshot.viewShrink = POTATO_LMG_VIEW_SHRINK;
    return out;
}

export function defaultModeRules(): ModeRules {
    return {
        throwableHits: throwableHitsFromDefs(),
        viewShrink: { max: 32, duration: 2.5 },
        potatoEmotes: true,
        cobaltWaitingRoom: true,
    };
}
