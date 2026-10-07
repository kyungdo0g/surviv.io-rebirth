// Bag items (ammo, heals, boosts, throwables, scopes) capped by the backpack level.
// Behaviour follows survev server/src/game/inventoryManager.ts.
import { GameConfig, GameObjectDefs, hasDef, type ThrowableDef } from "@rebirth/defs";

/** Every item that lives in the bag, in GameConfig.bagSizes order (the protocol order). */
export const BAG_ITEMS: readonly string[] = Object.keys(GameConfig.bagSizes);
const BAG_SET = new Set(BAG_ITEMS);

/** Scopes from weakest to strongest (survev gearDefs.ts SCOPE_LEVELS). */
export const SCOPE_LEVELS: readonly string[] = ["1xscope", "2xscope", "4xscope", "8xscope", "15xscope"];

/**
 * Throwables a player can hold, in inventory order. Throwables without an `equip` hand image cannot be held
 * (survev weaponManager.ts throwableList).
 */
export const THROWABLE_LIST: readonly string[] = Object.keys(GameObjectDefs)
    .filter((id) => {
        const def = GameObjectDefs[id];
        return def.type === "throwable" && !!def.handImg?.equip && BAG_SET.has(id);
    })
    .sort(
        (a, b) =>
            (GameObjectDefs[a] as ThrowableDef).inventoryOrder - (GameObjectDefs[b] as ThrowableDef).inventoryOrder,
    );

export function isBagItem(item: string): boolean {
    return BAG_SET.has(item);
}

/** Level of a backpack/helmet/chest id; 0 for "" (survev player.ts getGearLevel). */
export function gearLevel(id: string): number {
    if (!id || !hasDef(id)) return 0;
    return (GameObjectDefs[id] as { level?: number }).level ?? 0;
}

/** Gear comparison used by pickups: level x10, +1 for perk or role helmets (survev player.ts getGearQuality). */
export function gearQuality(id: string): number {
    if (!id || !hasDef(id)) return 0;
    const def = GameObjectDefs[id];
    let quality = gearLevel(id) * 10;
    if (def.type === "helmet") {
        if (def.perk) quality += 1;
        if (def.role) quality += 1;
    } else if (def.type === "backpack") {
        // the Experimental Pack's second perk slot makes it better than the Tactical Pack (survev player.ts:791-793)
        quality += def.maxPerks ?? 1;
    }
    return quality;
}

/** Hooks the inventory calls when an item count goes from 0 to positive or back. */
export interface InventoryOwner {
    readonly backpack: string;
    onItemAdded(item: string): void;
    onItemRemoved(item: string): void;
    /** extra capacity a perk gives (survev inventoryManager.ts getMaxCapacity: Flak Jacket +3 frags, +2 MIRVs) */
    capacityBonus?(item: string): number;
}

export class Inventory {
    /** counts for every bag item */
    readonly items: Record<string, number> = {};
    /** capacity per backpack level; maps may override rows (Woods frag / smoke, modes/bagSizes.ts) */
    sizes: Readonly<Record<string, readonly number[]>> = GameConfig.bagSizes;
    private readonly owner: InventoryOwner;

    constructor(owner: InventoryOwner, initial: Readonly<Record<string, number>> = {}) {
        this.owner = owner;
        for (const item of BAG_ITEMS) this.items[item] = initial[item] ?? 0;
    }

    get(item: string): number {
        return this.items[item] ?? 0;
    }

    has(item: string): boolean {
        return this.get(item) > 0;
    }

    capacity(item: string): number {
        const sizes = this.sizes[item];
        if (!sizes) return 0;
        return (
            sizes[Math.min(gearLevel(this.owner.backpack), sizes.length - 1)] + (this.owner.capacityBonus?.(item) ?? 0)
        );
    }

    set(item: string, amount: number): void {
        if (!isBagItem(item)) throw new Error(`Inventory.set: ${item} is not a bag item`);
        if (!(amount >= 0) || !Number.isInteger(amount)) throw new Error(`Inventory.set: bad amount ${amount}`);
        const old = this.items[item];
        if (old === amount) return;
        this.items[item] = amount;
        if (old === 0) this.owner.onItemAdded(item);
        else if (amount === 0) this.owner.onItemRemoved(item);
    }

    /** Adds up to the bag capacity; returns how much was added and how much is left over. */
    give(item: string, amount: number): { added: number; remaining: number } {
        const space = Math.max(this.capacity(item) - this.get(item), 0);
        const added = Math.min(space, amount);
        if (added > 0) this.set(item, this.get(item) + added);
        return { added, remaining: amount - added };
    }

    /** Removes up to `amount`; returns how much was actually taken. */
    take(item: string, amount: number): number {
        const taken = Math.min(this.get(item), amount);
        if (taken > 0) this.set(item, this.get(item) - taken);
        return taken;
    }

    clear(): void {
        for (const item of BAG_ITEMS) this.items[item] = 0;
    }
}
