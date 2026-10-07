// Promotion to a role and losing it (M7a): role perks, the role kit (backpack, items, outfit, role helmet, chest,
// weapons; map overrides with team and weighted choices), the announcement, Lone Survivr's refill, and the gear that
// carries a perk or a role (the desert Lieutenant Helmet's Firepower, the K-pot-ato's Rare Potato, the Woods King's
// Shishigami no Kabuto). Behaviour follows survev server/src/game/objects/player.ts promoteToRole / removeRole and the
// helmet branch of pickupLoot, docs/research/items/roles.md "What promotion does".
import { GameObjectDefs, getDef, getDefOfType, getMapDef, hasDef, WeaponSlot } from "@rebirth/defs";
import { isBagItem } from "../items/inventory.ts";
import { dropGun, playerDropLoot } from "../loot/drops.ts";
import { addPerk, giveHaste, removePerk, removePerksWhere } from "../perks/perks.ts";
import { gunDef } from "../weapons/weaponManager.ts";
import type { SimContext } from "../world/context.ts";
import { setOutfit } from "../world/disguise.ts";
import type { Player } from "../world/player.ts";
import { type ResolvedLoadout, resolveLoadout, resolveRolePerks, roleLoadout } from "./loadouts.ts";

const MAX_STAT = 100;

export interface PromoteOptions {
    /** keep the current weapons (Commander succession keeps the Lieutenant's guns, like survev's Captain) */
    keepWeapons?: boolean;
}

function noDrop(id: string): boolean {
    return !!id && hasDef(id) && !!(GameObjectDefs[id] as { noDrop?: boolean }).noDrop;
}

function gearLevelOf(id: string): number {
    return id && hasDef(id) ? ((GameObjectDefs[id] as { level?: number }).level ?? 0) : 0;
}

/** Drops a piece of gear the player takes off (nothing for no-drop and level 0 gear). */
function dropGear(ctx: SimContext, player: Player, id: string): void {
    if (!id || noDrop(id) || gearLevelOf(id) < 1) return;
    playerDropLoot(ctx, player, id);
}

/**
 * Promotes `player` to `role` (survev promoteToRole). A role change first strips the old role's no-drop helmet and
 * chest and its perks; a loot perk the new role also grants is dropped. Announced to everyone.
 */
export function promoteToRole(ctx: SimContext, player: Player, role: string, opts: PromoteOptions = {}): void {
    if (!hasDef(role) || getDef(role).type !== "role") return;
    const def = getDefOfType("role", role);
    const rules = ctx.rules.roles;
    if (role === "leader") {
        // the Commander's flare gun is locked until fired; the fork fires it after 15 s (role-leader-auto-flare)
        player.firedFlare = !rules.leaderFlareLocked;
        player.flareTimer = rules.leaderAutoFlareDelay;
    }
    if (player.role === role) return;
    if (player.role) {
        if (noDrop(player.helmet)) player.helmet = "";
        if (noDrop(player.chest)) player.chest = "";
    }
    player.role = role;
    ctx.announceRole({ playerId: player.id, killerId: 0, role, assigned: true, killed: false });
    if (role === "last_man") {
        // Lone Survivr: full health and adrenaline and a 5 s Windwalk burst (survev promoteToRole)
        player.health = MAX_STAT;
        player.boost = MAX_STAT;
        giveHaste(player, "windwalk", rules.lastManHasteDuration);
    }
    const newPerks = new Set(resolveRolePerks(def.perks ?? [], ctx.roleRng));
    if (role === "last_man" && rules.lastManExtraPerks.length > 0)
        newPerks.add(ctx.roleRng.pick(rules.lastManExtraPerks));
    // Classless: one random class perk it does not hold; earlier role perks stay (survev player.ts:935-972)
    const classless = role === "classless";
    if (classless) {
        const pool = rules.classlessPerkPool.filter((p) => !player.hasPerk(p));
        if (pool.length) newPerks.add(ctx.roleRng.pick(pool));
    }
    for (const src of [...player.perkSources]) {
        if (src.fromRole) {
            if (newPerks.has(src.type) || classless) newPerks.delete(src.type);
            else removePerk(player, src.type);
        } else if (src.droppable && newPerks.has(src.type)) {
            playerDropLoot(ctx, player, src.type);
            removePerk(player, src.type);
        }
    }
    for (const perk of newPerks) addPerk(player, perk, { fromRole: true });
    const kit = roleLoadout(role, getMapDef(ctx.options.mapName));
    if (kit) applyLoadout(ctx, player, resolveLoadout(kit, player.teamId, ctx.roleRng), opts);
}

/**
 * Classless kill: one of the killer's role perks is swapped for a random pool perk it does not hold, unless it holds
 * all four Lone Survivr perks (survev player.ts:2768-2797, the "secret" interaction).
 */
export function swapClasslessPerk(ctx: SimContext, player: Player): void {
    if (["takedown", "steelskin", "field_medic", "splinter"].every((p) => player.hasPerk(p))) return;
    const rolePerks = player.perkSources.filter((s) => s.fromRole).map((s) => s.type);
    const pool = ctx.rules.roles.classlessPerkPool.filter((p) => !player.hasPerk(p));
    if (!rolePerks.length || !pool.length) return;
    const old = ctx.roleRng.pick(rolePerks);
    const perk = ctx.roleRng.pick(pool);
    removePerk(player, old);
    addPerk(player, perk, { fromRole: true });
}

/** Applies a resolved kit in survev's order: backpack, items, outfit, role helmet, chest, weapons. */
function applyLoadout(ctx: SimContext, player: Player, kit: ResolvedLoadout, opts: PromoteOptions): void {
    if (kit.backpack) {
        if (player.backpack !== kit.backpack) dropGear(ctx, player, player.backpack);
        player.backpack = kit.backpack;
    }
    for (const [item, amount] of Object.entries(kit.inventory)) {
        if (!isBagItem(item) || amount <= 0) continue;
        const rest = player.inv.give(item, amount).remaining;
        if (rest > 0) playerDropLoot(ctx, player, item, rest);
    }
    player.noDropOutfit = kit.noDropOutfit;
    if (kit.outfit) {
        const old = getDef(player.outfit) as { noDrop?: boolean; noDropOnDeath?: boolean };
        if (!old.noDrop && !old.noDropOnDeath && player.outfit !== player.loadoutOutfit) {
            playerDropLoot(ctx, player, player.outfit);
        }
        setOutfit(ctx, player, kit.outfit);
    }
    if (kit.helmet) {
        if (player.helmet && !player.hasRoleHelmet) {
            dropGear(ctx, player, player.helmet);
            setHelmet(ctx, player, "");
        }
        setHelmet(ctx, player, kit.helmet);
        player.hasRoleHelmet = true;
    } else if (player.hasRoleHelmet) {
        setHelmet(ctx, player, "");
        player.hasRoleHelmet = false;
    }
    if (kit.chest) {
        if (player.chest !== kit.chest) dropGear(ctx, player, player.chest);
        player.chest = kit.chest;
    }
    if (opts.keepWeapons) return;
    const wm = player.weaponManager;
    kit.weapons.forEach((weapon, i) => {
        const cur = wm.weapons[i];
        if (!weapon.type) {
            // an empty kit slot refills the gun already there (fandom: promotion refills the magazine)
            const def = gunDef(cur.type);
            if (def) cur.ammo = Math.max(cur.ammo, wm.ammoStats(def).maxClip);
            return;
        }
        const def = getDef(weapon.type);
        if (def.type === "gun") {
            // the old gun drops, its magazine back in the bag first (survev weaponManager.dropGun)
            if (cur.type) dropGun(ctx, player, i);
            if (weapon.fillInv && isBagItem(def.ammo)) player.inv.set(def.ammo, player.inv.capacity(def.ammo));
        } else if (def.type === "melee" && cur.type && cur.type !== "fists") {
            const curDef = getDef(cur.type) as { noDropOnDeath?: boolean };
            if (!curDef.noDropOnDeath) playerDropLoot(ctx, player, cur.type);
        }
        wm.setWeapon(i, weapon.type, weapon.ammo);
    });
    if (wm.weapons[WeaponSlot.Throwable].type && !player.inv.has(wm.weapons[WeaponSlot.Throwable].type)) {
        wm.showNextThrowable();
    }
}

/** Takes the role away (survev removeRole): its helmet goes, its perks go. */
export function removeRole(ctx: SimContext, player: Player): void {
    if (!player.role) return;
    player.role = "";
    player.noDropOutfit = false;
    if (player.hasRoleHelmet) {
        player.hasRoleHelmet = false;
        setHelmet(ctx, player, "");
    }
    removePerksWhere(player, (s) => s.fromRole);
}

/**
 * Wears `helmet` (pickups, role kits, death): the old helmet's perk and role leave with it, the new one's arrive
 * (gear.md: helmet03_lt_aged Firepower, helmet03_potato Rare Potato; helmet03_forest makes its wearer the Woods King).
 */
export function setHelmet(ctx: SimContext, player: Player, helmet: string): void {
    const old = player.helmet;
    if (old === helmet) return;
    const oldDef = old && hasDef(old) ? getDefOfType("helmet", old) : undefined;
    player.helmet = helmet;
    if (oldDef?.perk) removePerksWhere(player, (s) => s.fromGear && s.type === oldDef.perk);
    if (oldDef?.role && player.role === oldDef.role) removeRole(ctx, player);
    const def = helmet && hasDef(helmet) ? getDefOfType("helmet", helmet) : undefined;
    if (def?.perk) addPerk(player, def.perk, { fromGear: true });
    if (def?.role && !player.dead) promoteToRole(ctx, player, def.role);
}
