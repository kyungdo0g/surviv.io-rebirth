// The drop-item action (survev player.ts dropItem / dropInventoryItem / dropArmor and weaponManager canDropFlare):
// armour, a gun (not the Commander's unfired flare gun), the melee weapon, the droppable perk, or part of a bag stack.
// Snowball and potato hits use it to make the target drop a random item (survev dropRandomLoot, M7b); the original
// DropItem message (HUD right-click) will reuse it.
import { getDef, hasDef, WeaponSlot } from "@rebirth/defs";
import { dropGun, dropMelee, playerDropLoot } from "../loot/drops.ts";
import { removePerk } from "../perks/perks.ts";
import { setHelmet } from "../roles/roles.ts";
import type { SimContext } from "./context.ts";
import type { Player } from "./player.ts";

/** Ground stacks hold at most this many rounds (survev splitUpLoot). */
const AMMO_STACK = 60;

function splitUpLoot(ctx: SimContext, player: Player, item: string, amount: number): void {
    for (let i = 0; i < Math.floor(amount / AMMO_STACK); i++) playerDropLoot(ctx, player, item, AMMO_STACK);
    if (amount % AMMO_STACK !== 0) playerDropLoot(ctx, player, item, amount % AMMO_STACK);
}

/** Half a bag stack (rounded down, at least 1; small ammo stacks whole up to 5 or the ammo's minStackSize). */
function dropBagItem(ctx: SimContext, player: Player, item: string): void {
    const count = player.inv.get(item);
    if (count <= 0) return;
    const def = getDef(item) as { type: string; minStackSize?: number };
    let amount = Math.max(1, Math.floor(count / 2));
    switch (def.type) {
        case "ammo":
            if (def.minStackSize && count <= def.minStackSize) amount = Math.min(def.minStackSize, count);
            else if (count <= 5) amount = Math.min(5, count);
            splitUpLoot(ctx, player, item, amount);
            break;
        case "scope":
            amount = 1;
            playerDropLoot(ctx, player, item, 1);
            break;
        case "heal":
        case "boost":
            playerDropLoot(ctx, player, item, amount);
            break;
        case "throwable":
            if (player.weaponManager.cooking) return;
            splitUpLoot(ctx, player, item, amount);
            break;
        default:
            return;
    }
    player.inv.take(item, amount);
}

/** Drops the worn helmet or chest `item`; a role helmet takes its role, a perk helmet its perk (survev dropArmor). */
function dropArmor(ctx: SimContext, player: Player, item: string): void {
    const def = getDef(item) as { type: string; noDrop?: boolean };
    if (def.noDrop) return;
    if (def.type === "helmet" && player.helmet === item) {
        setHelmet(ctx, player, "");
        player.hasRoleHelmet = false;
    } else if (def.type === "chest" && player.chest === item) {
        player.chest = "";
    } else {
        return;
    }
    playerDropLoot(ctx, player, item, 1);
}

/** Whether the gun of a slot may be dropped: a Commander's flare gun only once fired (survev canDropFlare). */
function canDropGun(player: Player, idx: number): boolean {
    const type = player.weaponManager.weapons[idx]?.type;
    if (!type || !hasDef(type)) return false;
    const def = getDef(type) as { ammo?: string };
    return player.role !== "leader" || def.ammo !== "flare" || player.firedFlare;
}

/**
 * Drops `item` (survev dropItem). `weapIdx` names the gun slot for guns. Players without a Cobalt class cannot drop.
 * A running action is cancelled; a reload of an emptied gun is rescheduled.
 */
export function dropItem(ctx: SimContext, player: Player, item: string, weapIdx = 0): void {
    if (player.dead || player.awaitingClass || !hasDef(item)) return;
    const def = getDef(item);
    const idx = Math.max(0, Math.min(WeaponSlot.Count - 1, Math.floor(weapIdx)));
    switch (def.type) {
        case "helmet":
        case "chest":
            dropArmor(ctx, player, item);
            break;
        case "gun":
            if (player.weaponManager.weapons[idx]?.type === item && canDropGun(player, idx)) dropGun(ctx, player, idx);
            break;
        case "melee":
            if (player.weaponManager.weapons[WeaponSlot.Melee].type === item) dropMelee(ctx, player);
            break;
        case "perk": {
            const src = player.perkSources.find((s) => s.droppable && s.type === item);
            if (src) {
                playerDropLoot(ctx, player, item, 1);
                removePerk(player, item);
            }
            break;
        }
    }
    if (Object.hasOwn(player.inv.items, item)) dropBagItem(ctx, player, item);
    const reloading = player.isReloading();
    player.cancelAction();
    const wm = player.weaponManager;
    if (reloading && wm.activeSlot.ammo === 0) wm.scheduledReload = true;
}

/** Every item dropRandomLoot may pick: bag items but the 1x scope, guns and melee, the droppable perk, armour. */
export function randomDropCandidates(player: Player): Array<{ item: string; weapIdx: number }> {
    const out: Array<{ item: string; weapIdx: number }> = [];
    for (const [item, count] of Object.entries(player.inv.items)) {
        if (count > 0 && item !== "1xscope") out.push({ item, weapIdx: 0 });
    }
    player.weaponManager.weapons.forEach((w, i) => {
        if (i === WeaponSlot.Throwable || !w.type || w.type === "fists" || !hasDef(w.type)) return;
        if ((getDef(w.type) as { noDrop?: boolean }).noDrop) return;
        out.push({ item: w.type, weapIdx: i });
    });
    for (const s of player.perkSources) if (s.droppable) out.push({ item: s.type, weapIdx: 0 });
    for (const armor of [player.helmet, player.chest]) {
        if (armor && hasDef(armor) && !(getDef(armor) as { noDrop?: boolean }).noDrop) {
            out.push({ item: armor, weapIdx: 0 });
        }
    }
    return out;
}

/** A snowball / potato hit: one random droppable item drops (survev dropRandomLoot). */
export function dropRandomLoot(ctx: SimContext, player: Player): void {
    const candidates = randomDropCandidates(player);
    if (candidates.length === 0) return;
    const pick = candidates[ctx.lootRng.int(0, candidates.length - 1)];
    dropItem(ctx, player, pick.item, pick.weapIdx);
}
