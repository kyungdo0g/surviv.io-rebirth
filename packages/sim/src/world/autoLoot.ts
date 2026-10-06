// Mobile auto loot (M8): every tick a touch player (the original JoinMsg.isMobile) that stands takes the nearest loot in
// its touch pickup reach when it is an obvious gain, and opens the closed doors it can reach. Both pause for 3 s after
// the player dropped something (loot/drops.ts playerDropLoot sets the timer).
// Behaviour follows survev server/src/game/objects/player.ts update "Mobile auto interaction" (2024-2099) and dropLoot
// (4153); docs/research/ui/controls.md "Mobile and touch controls" (auto pickup except outfits, auto-opening doors).
import { getDef, hasDef, WeaponSlot } from "@rebirth/defs";
import { gearQuality, isBagItem } from "../items/inventory.ts";
import type { Loot } from "../loot/loot.ts";
import { closestLoot, freeGunSlot, pickupLoot } from "../loot/pickup.ts";
import { droppablePerk } from "../perks/perks.ts";
import type { SimContext } from "./context.ts";
import { interactableObstacles, interactObstacle } from "./interact.ts";
import type { Player } from "./player.ts";

/** Timer comparisons tolerate float drift of summed 0.01 s steps. */
const TIME_EPS = 1e-9;

/**
 * Whether auto loot takes `loot` (survev player.ts update): a gun into an empty gun slot that is not the held one, a
 * melee weapon over fists, a perk when the player has no loot perk (never Trick or Treat?), better armour or backpacks,
 * any other item until its bag stack is full; never outfits.
 *
 * Differences from survev, each to avoid a pickup the player would only refuse:
 * - survev tests the gun slot with `freeSlot.slot && ...`, which also skips the primary slot (index 0, falsy); this
 *   reads it as the intended "a slot was found", so a first gun is auto looted like fandom's mobile page describes.
 * - a perk the player already holds or cannot take (perk cap), and a helmet while the role helmet is worn, are left
 *   alone: survev's pickupLoot refuses them and kicks the item away again every 0.1 s, each time as a new loot object.
 */
export function wantsAutoLoot(ctx: SimContext, player: Player, loot: Loot): boolean {
    if (!hasDef(loot.type)) return false;
    const def = getDef(loot.type);
    const wm = player.weaponManager;
    switch (def.type) {
        case "gun": {
            const slot = freeGunSlot(player, loot.type).slot;
            return slot !== null && slot !== wm.curWeapIdx && !wm.weapons[slot].type;
        }
        case "melee":
            return wm.weapons[WeaponSlot.Melee].type === "fists";
        case "perk": {
            if (loot.type === "halloween_mystery" || droppablePerk(player)) return false;
            if (player.hasPerk(loot.type)) return false;
            // without a loot perk only a rolled Trick or Treat? perk frees a slot (loot/pickup.ts pickupPerk)
            const rolled = player.perkSources.some((s) => s.replaceOnDeath === "halloween_mystery");
            return rolled || player.perks.length < ctx.rules.perks.lootPerkCap;
        }
        case "outfit":
            return false;
        case "helmet":
        case "chest":
        case "backpack":
            if (def.type === "helmet" && player.hasRoleHelmet) return false;
            return gearQuality(player[def.type]) < gearQuality(loot.type);
        default:
            return !isBagItem(loot.type) || player.inv.get(loot.type) < player.inv.capacity(loot.type);
    }
}

/** One tick of mobile auto interaction; call after the player moved (it reuses the player's scratch buffer). */
export function updateAutoLoot(ctx: SimContext, player: Player, dt: number): void {
    if (player.mobileDropTicker > 0) player.mobileDropTicker = Math.max(0, player.mobileDropTicker - dt);
    if (!player.isMobile || player.mobileDropTicker > TIME_EPS || player.downed || player.dead) return;
    const loot = closestLoot(ctx, player);
    // pickups wait for a revive to end (survev pickupLoot refuses during Action.Revive)
    if (loot && player.action.type !== "revive" && wantsAutoLoot(ctx, player, loot)) pickupLoot(ctx, player, loot);
    for (const obstacle of interactableObstacles(ctx, player)) {
        if (obstacle.door && !obstacle.door.open) interactObstacle(ctx, obstacle, player);
    }
}
