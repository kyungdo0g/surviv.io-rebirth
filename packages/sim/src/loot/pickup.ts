// Picking up loot: which item is in reach and what taking it does to the inventory, slots and gear; perks (M7a: one
// droppable loot perk, swapped on a second pickup; Trick or Treat rolls its perk) and gear granting a perk or a role.
// Behaviour follows survev server/src/game/objects/player.ts (getClosestLoot, getFreeGunSlot, pickupLoot).
import { v2 } from "@rebirth/core";
import { GameConfig, getDef, hasDef, WeaponSlot } from "@rebirth/defs";
import { gearLevel, gearQuality, isBagItem } from "../items/inventory.ts";
import { addPerk, removePerk } from "../perks/perks.ts";
import { setHelmet } from "../roles/roles.ts";
import { gunDef } from "../weapons/weaponManager.ts";
import type { SimContext } from "../world/context.ts";
import type { Player } from "../world/player.ts";
import { sameLayer } from "../world/world.ts";
import { dropGun, dropMelee, playerDropLoot, rollLootTier } from "./drops.ts";
import type { Loot } from "./loot.ts";

/** survev net.PickupMsgType, plus "busy" for refusals that send no message. */
export type PickupResult =
    | "success"
    | "full"
    | "alreadyOwned"
    | "alreadyEquipped"
    | "betterItemEquipped"
    | "gunCannotFire"
    | "busy";

/** Seconds between pickups, longer after taking a gun (survev pickupTicker). */
const PICKUP_COOLDOWN = 0.1;
const GUN_PICKUP_COOLDOWN = 0.2;
/** Items put back on the ground by a refused pickup are pushed 4..4.5 behind the player (survev). */
const RETURN_SPEED_MIN = 4;
const RETURN_SPEED_MAX = 4.5;
/** Loot search radius around the player (survev: rad + 5). */
const SEARCH_EXTRA = 5;
/** Touch players reach loot from 1.4x its radius (survev player.ts getClosestLoot; ui/controls.md). */
const TOUCH_LOOT_RAD_MULT = GameConfig.player.touchLootRadMult;

/**
 * Nearest loot on the player's layer whose pickup circle the player's centre is inside (centre distance < player
 * rad + loot rad, the loot rad x touchLootRadMult for mobile players).
 */
export function closestLoot(ctx: SimContext, player: Player): Loot | undefined {
    const r = player.rad + SEARCH_EXTRA;
    const box = { min: v2.sub(player.pos, { x: r, y: r }), max: v2.add(player.pos, { x: r, y: r }) };
    let best: Loot | undefined;
    let bestDist = Number.MAX_VALUE;
    for (const obj of ctx.world.query(box, player.scratch)) {
        if (obj.kind !== "loot" || obj.destroyed || !sameLayer(obj.layer, player.layer)) continue;
        // owned loot (smartLoot crates) is only for its owner for a while (survev getClosestLoot)
        if (obj.ownerId !== 0 && obj.ownerId !== player.id) continue;
        const rad = player.rad + obj.rad * (player.isMobile ? TOUCH_LOOT_RAD_MULT : 1);
        const distSq = v2.distanceSqr(player.pos, obj.pos);
        if (distSq < rad * rad && distSq < bestDist) {
            bestDist = distSq;
            best = obj;
        }
    }
    return best;
}

interface GunSlotChoice {
    slot: number | null;
    isDual: boolean;
    cause: PickupResult;
}

/** Slot a picked up gun goes to: a matching single pistol (dual), an empty gun slot, else the held gun slot. */
export function freeGunSlot(player: Player, type: string): GunSlotChoice {
    const wm = player.weaponManager;
    const gunSlots = [WeaponSlot.Primary, WeaponSlot.Secondary];
    for (const slot of gunSlots) {
        const slotDef = gunDef(wm.weapons[slot].type);
        if (slotDef?.dualWieldType && wm.weapons[slot].type === type) return { slot, isDual: true, cause: "success" };
    }
    for (const slot of gunSlots) {
        if (wm.weapons[slot].type === "") return { slot, isDual: false, cause: "success" };
    }
    if (GameConfig.WeaponType[wm.curWeapIdx] === "gun") {
        const newDef = gunDef(type);
        const owned = wm.activeWeapon === type || newDef?.dualWieldType === wm.activeWeapon;
        return { slot: wm.curWeapIdx, isDual: false, cause: owned ? "alreadyOwned" : "success" };
    }
    return { slot: null, isDual: false, cause: "full" };
}

/**
 * Takes a loot item. Returns the pickup result, or null when nothing happened (pickup cooldown, no gun slot).
 * Leftovers (bag overflow, swapped gear, refused items) go back on the ground behind the player.
 */
export function pickupLoot(ctx: SimContext, player: Player, loot: Loot): PickupResult | null {
    // downed players cannot pick anything up (survev pickupLoot; downed-revive.md "While downed")
    if (loot.destroyed || player.downed || !hasDef(loot.type)) return null;
    const def = getDef(loot.type);
    if ((player.action.type === "use" && def.type !== "gun") || player.pickupTicker > 0) return null;
    player.pickupTicker = PICKUP_COOLDOWN;
    const wm = player.weaponManager;
    let amountLeft = 0;
    let lootToAdd = loot.type;
    let result: PickupResult = "success";

    switch (def.type) {
        case "ammo":
        case "scope":
        case "heal":
        case "boost":
        case "throwable": {
            if (!isBagItem(loot.type)) break;
            const res = player.inv.give(loot.type, loot.count);
            if (res.added <= 0) result = def.type === "scope" ? "alreadyOwned" : "full";
            amountLeft = res.remaining;
            break;
        }
        case "melee":
            if (wm.weapons[WeaponSlot.Melee].type === loot.type) {
                result = "alreadyEquipped";
                amountLeft = 1;
                break;
            }
            dropMelee(ctx, player);
            wm.setWeapon(WeaponSlot.Melee, loot.type, 0);
            break;
        case "gun": {
            const choice = freeGunSlot(player, loot.type);
            result = choice.cause;
            const idx = choice.slot;
            if (idx === null) {
                player.pickupTicker = 0;
                return null;
            }
            const oldDef = gunDef(wm.weapons[idx].type);
            // the Commander's flare gun cannot be swapped out before it was fired (survev canDropFlare)
            const lockedFlare = oldDef?.bulletType === "bullet_flare" && player.role === "leader" && !player.firedFlare;
            if (oldDef?.noDrop || lockedFlare) {
                player.pickupTicker = 0;
                return null;
            }
            // preloaded guns hand over their ammo; what does not fit drops
            if (loot.isPreloadedGun && isBagItem(def.ammo)) {
                const rest = player.inv.give(def.ammo, def.ammoSpawnCount).remaining;
                if (rest > 0) playerDropLoot(ctx, player, def.ammo, rest);
            }
            if (choice.cause === "alreadyOwned") {
                amountLeft = 1;
                break;
            }
            player.pickupTicker = GUN_PICKUP_COOLDOWN;
            let gunType = loot.type;
            if (def.dualWieldType && choice.isDual) {
                gunType = def.dualWieldType;
                // going from single to dual cancels a reload of that slot
                if (wm.curWeapIdx === idx && player.isReloading()) {
                    player.cancelAction();
                    if (wm.weapons[idx].ammo <= 0) wm.scheduledReload = true;
                }
            }
            let newAmmo = 0;
            if (oldDef) {
                // the magazine is kept only when a single pistol becomes its dual version
                newAmmo = oldDef.dualWieldType === gunType ? wm.weapons[idx].ammo : 0;
                const becomesDual = !!oldDef.dualWieldType && wm.weapons[idx].type === loot.type;
                if (!becomesDual) dropGun(ctx, player, idx);
            }
            wm.setWeapon(idx, gunType, newAmmo);
            // a new gun is drawn when the melee slot is out
            if (!choice.isDual && wm.curWeapIdx === WeaponSlot.Melee) wm.setCurWeapIndex(idx);
            break;
        }
        case "helmet":
        case "chest":
        case "backpack": {
            const current = player[def.type];
            amountLeft = 1;
            if (gearQuality(current) > gearQuality(loot.type)) {
                result = "betterItemEquipped";
                break;
            }
            if (current === loot.type) {
                result = "alreadyEquipped";
            } else {
                // swap: the old piece drops (nothing drops for level 0 gear)
                lootToAdd = current;
                if (def.type === "helmet") {
                    // a helmet's perk and role come and go with it (desert Lieutenant Helmet, Woods King helmet)
                    player.hasRoleHelmet = false;
                    setHelmet(ctx, player, loot.type);
                } else {
                    player[def.type] = loot.type;
                }
            }
            if (gearLevel(lootToAdd) === 0) lootToAdd = "";
            break;
        }
        case "outfit":
            amountLeft = 1;
            // the Commander keeps its outfit (survev noDropOutfit; conflicts.md role-commander-outfit-block)
            if (player.noDropOutfit) {
                result = "betterItemEquipped";
                break;
            }
            if (player.outfit === loot.type) {
                result = "alreadyEquipped";
                break;
            }
            lootToAdd = player.outfit;
            player.outfit = loot.type;
            break;
        case "perk": {
            const taken = pickupPerk(ctx, player, loot.type);
            result = taken.result;
            amountLeft = taken.dropped ? 1 : 0;
            lootToAdd = taken.dropped;
            break;
        }
        default:
            player.pickupTicker = 0;
            return null;
    }

    if (amountLeft > 0 && lootToAdd !== "" && hasDef(lootToAdd)) {
        const addDef = getDef(lootToAdd) as { noDrop?: boolean };
        if (loot.type === lootToAdd || !addDef.noDrop) {
            ctx.loot.addLoot(lootToAdd, loot.pos, loot.layer, amountLeft, {
                pushSpeed: ctx.lootRng.range(RETURN_SPEED_MIN, RETURN_SPEED_MAX),
                dir: v2.neg(player.dir),
                noSideAmmo: true,
            });
        }
    }
    ctx.loot.remove(loot);
    player.lastPickup = { type: loot.type, result };
    return result;
}

/**
 * Takes a perk (survev pickupLoot "perk"): Trick or Treat? rolls tier_halloween_mystery_perks and gives that perk
 * (not droppable; halloween_mystery drops in its place on death). A held perk is refused; a held loot perk is swapped
 * (it drops); without one, a player already holding `rules.perks.lootPerkCap` perks is refused. Perks with
 * `emoteOnPickup` emote (conflicts.md perk-perky-shoot-emote). Returns the result and the perk to put back down.
 */
function pickupPerk(ctx: SimContext, player: Player, type: string): { result: PickupResult; dropped: string } {
    const mystery = type === "halloween_mystery";
    const perk = mystery ? rollLootTier(ctx, "tier_halloween_mystery_perks") || type : type;
    if (player.hasPerk(perk)) return { result: "alreadyEquipped", dropped: type };
    const slot = player.perkSources.find((s) => s.droppable || s.replaceOnDeath === "halloween_mystery");
    if (!slot && player.perks.length >= ctx.rules.perks.lootPerkCap) return { result: "full", dropped: type };
    let dropped = "";
    if (slot) {
        // a rolled trick-or-treat perk is simply replaced; a loot perk drops
        dropped = slot.replaceOnDeath ? "" : slot.type;
        removePerk(player, slot.type);
    }
    addPerk(player, perk, { droppable: !mystery, replaceOnDeath: mystery ? "halloween_mystery" : "" });
    const def = hasDef(perk) ? (getDef(perk) as { emoteOnPickup?: string }) : undefined;
    if (def?.emoteOnPickup) ctx.addEmote(player, def.emoteOnPickup);
    return { result: "success", dropped };
}
