// Healing items and boost: starting a use (Input.UseBandage... or PlayerInput.useItem), its effect when the use
// action completes, and the per-tick boost logic (heal by tier, decay, the floor of boost-granting perks).
// Behaviour follows docs/research/mechanics/heal-actions.md and boost.md (survev objects/player.ts useHealingItem,
// useBoostItem, the action block and the boost block of update).
import { GameConfig, getDef, hasDef, WeaponSlot } from "@rebirth/defs";
import { isBagItem, SCOPE_LEVELS, THROWABLE_LIST } from "../items/inventory.ts";
import { perkMinBoost } from "../perks/perks.ts";
import { boostHealAmounts, type SimRules } from "../rules.ts";
import type { SimContext } from "./context.ts";
import { teammatesInRange } from "./downed.ts";
import type { Player } from "./player.ts";

const PLAYER = GameConfig.player;
const MAX_BOOST = 100;

/** Upper boost edge of each tier from GameConfig.player.boostBreakpoints: 25, 50, 87.5, 100. */
export const BOOST_TIER_EDGES: readonly number[] = (() => {
    const bp = PLAYER.boostBreakpoints;
    const total = bp.reduce((a, b) => a + b, 0);
    let sum = 0;
    return bp.map((b) => {
        sum += b;
        return (sum / total) * MAX_BOOST;
    });
})();

/**
 * Heal rate in HP/s at `boost`: the last tier whose [previous edge, edge] holds it, so a value exactly on an edge
 * heals at the higher tier (survev player.ts boostHeals.findLast); 0 at 0 boost.
 */
export function boostHealRate(boost: number, rules: Pick<SimRules, "boostModel">): number {
    if (!(boost > 0)) return 0;
    const amounts = boostHealAmounts(rules.boostModel);
    let rate = 0;
    for (let i = 0; i < BOOST_TIER_EDGES.length; i++) {
        const prev = i > 0 ? BOOST_TIER_EDGES[i - 1] : 0;
        if (boost >= prev && boost <= BOOST_TIER_EDGES[i]) rate = amounts[i];
    }
    return rate;
}

/** Lowest boost the player's perks allow: Leadership keeps it full (survev perkDefs leadership minBoost 100). */
export function minBoost(player: Player): number {
    return perkMinBoost(player);
}

/**
 * Boost at the start of a player's tick: clamped up to the perk floor, heals by tier, then decays (not below the
 * floor); downed players have none (survev player.ts update, boost.md "Formula in code").
 */
export function updateBoost(player: Player, rules: Pick<SimRules, "boostModel">, dt: number): void {
    if (player.downed) {
        player.boost = 0;
        return;
    }
    const floor = minBoost(player);
    player.boost = Math.min(Math.max(player.boost, floor), MAX_BOOST);
    if (!(player.boost > 0)) return;
    player.health = Math.min(PLAYER.health, player.health + boostHealRate(player.boost, rules) * dt);
    if (player.boost > floor) player.boost = Math.max(floor, player.boost - PLAYER.boostDecay * dt);
}

/** Whether a throwable is being cooked (survev weaponManager cookingThrowable: the cook animation runs). */
function isCooking(player: Player): boolean {
    return player.animType === "cook";
}

/**
 * Uses a bag item (the original InputMsg.useItem): heals and boosts start their use action, scopes are equipped,
 * throwables are selected in the throwable slot. Downed players cannot use anything (survev handleInput).
 */
export function useItem(ctx: SimContext, player: Player, item: string): void {
    if (player.dead || player.downed || !item || !isBagItem(item) || !hasDef(item) || !player.inv.has(item)) return;
    const def = getDef(item);
    switch (def.type) {
        case "heal": {
            const aoe = player.hasPerk("aoe_heal");
            // refused at full health (Mass Medicate excepted), during another use or a revive, while cooking
            const busy = player.action.type === "use" || player.action.type === "revive";
            if ((!aoe && player.health >= def.maxHeal) || busy || isCooking(player)) return;
            startUse(ctx, player, item, def.useTime);
            break;
        }
        case "boost":
            // boosts have no fullness check: a soda at 100 boost is wasted (boost.md)
            if (player.action.type === "use" || player.action.type === "revive" || isCooking(player)) return;
            startUse(ctx, player, item, def.useTime);
            break;
        case "scope":
            if (SCOPE_LEVELS.includes(item)) player.scope = item;
            break;
        case "throwable":
            selectThrowable(player, item);
            break;
    }
}

function startUse(ctx: SimContext, player: Player, item: string, useTime: number): void {
    const aoe = player.hasPerk("aoe_heal");
    // a Mass Medicate medic always shows the item it uses (survev useHealingItem / useBoostItem)
    if (aoe) ctx.addEmote(player, "emote_loot", item);
    const mult = aoe ? ctx.rules.aoeHealUseTimeMult : 1;
    player.cancelAction();
    player.doAction(item, "use", useTime * mult);
}

/** Puts `item` in the throwable slot and equips it (Input.EquipFragGrenade / EquipSmokeGrenade, useItem). */
export function selectThrowable(player: Player, item: string): void {
    const wm = player.weaponManager;
    if (!THROWABLE_LIST.includes(item) || !player.inv.has(item) || wm.cooking) return;
    if (wm.weapons[WeaponSlot.Throwable].type !== item) wm.setWeapon(WeaponSlot.Throwable, item, 0);
    wm.setCurWeapIndex(WeaponSlot.Throwable);
}

/**
 * Fabricate (original rule): every `rules.fabricateInterval` seconds the pack is filled with frag grenades up to its
 * capacity (fandom Fabricate; survev's 8 weighted explosives every 10 s is a fork rework).
 */
export function updateFabricate(player: Player, rules: Pick<SimRules, "fabricateInterval">, dt: number): void {
    if (!player.hasPerk("fabricate")) {
        player.fabricateTicker = 0;
        return;
    }
    player.fabricateTicker += dt;
    if (player.fabricateTicker < rules.fabricateInterval - 1e-9) return;
    player.fabricateTicker = 0;
    player.inv.give("frag", player.inv.capacity("frag"));
}

/**
 * Effect of a completed use action: heal (capped at 100) or boost (capped at 100), then one item is used up. With a
 * game context, a Mass Medicate medic gives the effect to every standing teammate within medicHealRange (8 u, itself
 * included; survev applyActionFunc, boost.md / heal-actions.md).
 */
export function completeUse(player: Player, item: string, ctx?: SimContext): void {
    if (!hasDef(item)) return;
    const def = getDef(item);
    if (def.type !== "heal" && def.type !== "boost") return;
    const targets =
        ctx && player.hasPerk("aoe_heal")
            ? teammatesInRange(ctx, player, PLAYER.medicHealRange).filter((p) => !p.downed)
            : [player];
    for (const t of targets) {
        if (def.type === "heal") t.health = Math.min(PLAYER.health, t.health + def.heal);
        else t.boost = Math.min(MAX_BOOST, t.boost + def.boost);
    }
    player.inv.take(item, 1);
}
