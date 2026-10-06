// Potato weapon swap: breaking a `swapWeaponOnDestroy` obstacle (potatoes) replaces the weapon that broke it with a
// random weapon of the same kind; Rare Potato only rolls quality weapons.
// Behaviour follows survev server/src/game/objects/player.ts randomWeaponSwap; docs/research/modes/potato.md
// (the pool is built from the v0.8.82 defs, CONFLICT potato-swap-pool).
import { GameObjectDefs, getDef, hasDef, WeaponSlot } from "@rebirth/defs";
import type { DamageParams } from "../combat/damage.ts";
import { simMapDef } from "../modes/mapFixes.ts";
import type { SimContext } from "../world/context.ts";
import type { Player } from "../world/player.ts";

type SwapKind = "gun" | "melee" | "throwable";

interface SwapDef {
    type: string;
    noPotatoSwap?: boolean;
    quality?: number;
    switchDelay?: number;
    ammo?: string;
    maxClip?: number;
    ammoSpawnCount?: number;
}

/** Rare Potato: only weapons of this quality are rolled (survev PerkProperties.rare_potato.quality). */
const RARE_POTATO_QUALITY = 1;

const pools = new Map<string, string[]>();

/** Weapons of a kind that may be rolled (every def without `noPotatoSwap`; tomatoes only in faction mode). */
function swapPool(kind: SwapKind, factionMode: boolean): string[] {
    const key = `${kind}:${factionMode}`;
    let pool = pools.get(key);
    if (!pool) {
        pool = Object.keys(GameObjectDefs).filter((id) => {
            const def = GameObjectDefs[id] as SwapDef;
            if (def.type !== kind || def.noPotatoSwap) return false;
            return factionMode || id !== "tomato";
        });
        pools.set(key, pool);
    }
    return pool;
}

/**
 * Replaces the weapon of `params.gameSourceType` (the slot in hand when it is the active weapon, else the slot
 * holding it, else the kind's default slot) with a random weapon of the same kind. Guns come with a full magazine
 * and their spare spawn ammo, throwables with a third of the bag. Nothing happens for `noPotatoSwap` items.
 */
export function randomWeaponSwap(ctx: SimContext, player: Player, params: DamageParams): void {
    if (player.dead) return;
    // (the fork's "Lone Survivr keeps its weapons", 0.2.31, is not in v0.8.82)
    const oldWeapon = params.gameSourceType;
    if (!oldWeapon || !hasDef(oldWeapon)) return;
    const oldDef = getDef(oldWeapon) as SwapDef;
    if (oldDef.noPotatoSwap) return;
    if (oldDef.type !== "gun" && oldDef.type !== "melee" && oldDef.type !== "throwable") return;
    const kind: SwapKind = oldDef.type;
    const factionMode = !!simMapDef(ctx.world.mapData.mapName).gameMode.factionMode;
    let pool = swapPool(kind, factionMode);
    if (player.hasPerk("rare_potato")) {
        pool = pool.filter((id) => (GameObjectDefs[id] as SwapDef).quality === RARE_POTATO_QUALITY);
    }
    if (pool.length === 0) return;
    const chosen = pool[ctx.lootRng.int(0, pool.length - 1)];
    const chosenDef = getDef(chosen) as SwapDef;
    const wm = player.weaponManager;
    let index = wm.activeWeapon === oldWeapon ? wm.curWeapIdx : wm.weapons.findIndex((w) => w.type === oldWeapon);
    if (index < 0) {
        index = kind === "gun" ? WeaponSlot.Primary : kind === "melee" ? WeaponSlot.Melee : WeaponSlot.Throwable;
    }
    const slotType = wm.weapons[index].type;
    if (slotType && hasDef(slotType) && (getDef(slotType) as SwapDef).noPotatoSwap) return;
    if (index === wm.curWeapIdx && player.isReloading()) player.cancelAction();
    if (kind === "gun") {
        const def = getDef(chosen);
        if (def.type !== "gun") return;
        wm.setWeapon(index, chosen, wm.ammoStats(def).maxClip);
        player.inv.give(def.ammo, Math.max(def.ammoSpawnCount - def.maxClip, 0));
        if (index === wm.curWeapIdx) player.shotSlowdownTimer = 0;
    } else if (kind === "melee") {
        wm.setWeapon(index, chosen, 0);
    } else {
        if (!wm.cooking) wm.setWeapon(index, chosen, 0);
        const space = player.inv.capacity(chosen);
        player.inv.give(chosen, Math.max(Math.floor(space / 3), 1));
    }
    if (chosenDef.switchDelay !== undefined) wm.weapons[index].cooldown = chosenDef.switchDelay;
    // the new weapon shows in a loot emote (survev randomWeaponSwap addEmote("emote_loot"))
    ctx.addEmote(player, "emote_loot", chosen);
}
