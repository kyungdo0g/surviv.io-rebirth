// Where loot comes from: map loot spawners, destroyed obstacles, players dropping items and dying.
// Behaviour follows survev server/src/game/map.ts (loot_spawner), objects/obstacle.ts (kill), objects/player.ts
// (dropLoot, kill) and weaponManager.ts (_dropGun, dropMelee).
import { math, type Vec2, v2 } from "@rebirth/core";
import { GameObjectDefs, getDef, getMapDef, getMapObjectDef, hasMapObjectDef, type LootTableEntry, WeaponSlot } from "@rebirth/defs";
import { gearLevel, isBagItem } from "../items/inventory.ts";
import type { LootSpawn } from "../mapgen/generator.ts";
import { randomPointInCircle } from "../mapgen/random.ts";
import type { SimContext } from "../world/context.ts";
import { createMapEntity, type Obstacle } from "../world/entities.ts";
import type { Player } from "../world/player.ts";
import { type RolledItem, rollLootList, rollTier } from "./lootTable.ts";

/** Push speed of obstacle loot, divided by the item count when several drop (survev obstacle.ts kill). */
const OBSTACLE_PUSH_SPEED = 4.75;
/** Several items from one obstacle start within 0.1 of its loot point (survev). */
const OBSTACLE_MULTI_RAD = 0.1;

const warned = new Set<string>();
function warnUnknownTier(tier: string): void {
    // unknown tiers are data gaps in a map's loot table; ignoring them keeps the game running
    warned.add(tier);
}

/** Tiers referenced by map objects but missing from the map's loot table (diagnostics). */
export function unknownLootTiers(): string[] {
    return [...warned].sort();
}

function lootTables(ctx: SimContext): Readonly<Record<string, readonly LootTableEntry[]>> {
    return getMapDef(ctx.world.mapData.mapName).lootTable;
}

/** Rolls every map loot spawner once (survev map.ts genAuto loot_spawner: one roll per tier entry, no push). */
export function spawnMapLoot(ctx: SimContext, spawns: readonly LootSpawn[]): void {
    const tables = lootTables(ctx);
    for (const spawn of spawns) {
        if (!hasMapObjectDef(spawn.type)) continue;
        const def = getMapObjectDef(spawn.type);
        if (def.type !== "loot_spawner") continue;
        for (const entry of def.loot) {
            let item: RolledItem | undefined;
            if (entry.tier) {
                const rolled = rollTier(tables, entry.tier, ctx.lootRng, warnUnknownTier);
                // an empty roll ends the spawner (survev breaks out of the loop)
                if (!rolled) break;
                item = { type: rolled.name, count: rolled.count, preload: !!rolled.preload };
            } else if (entry.type) {
                item = { type: entry.type, count: entry.count ?? 1, preload: !!entry.props?.preloadGuns };
            }
            if (!item) continue;
            ctx.loot.addLoot(item.type, spawn.pos, spawn.layer, item.count, {
                pushSpeed: 0,
                preloadGun: item.preload,
                source: "map",
            });
        }
    }
}

/** The map object a destroyed obstacle turns into (broken windows, opened airdrop crates). */
export function spawnDestroyType(ctx: SimContext, obstacle: Obstacle): void {
    const type = obstacle.def.destroyType;
    // TODO(M8): smartLoot class shells need roles
    if (!type || obstacle.def.smartLoot || !hasMapObjectDef(type)) return;
    const def = getMapObjectDef(type);
    if (def.type !== "obstacle") return;
    const entity = createMapEntity({
        id: ctx.world.allocId(),
        kind: "obstacle",
        type,
        pos: v2.copy(obstacle.pos),
        ori: obstacle.ori,
        scale: ctx.lootRng.range(def.scale.createMin, def.scale.createMax),
        layer: obstacle.layer,
        parentId: obstacle.parentId,
    });
    ctx.world.add(entity);
}

/** Drops an obstacle's `loot` list where it stood, pushed along the killing hit (survev obstacle.ts kill). */
export function dropObstacleLoot(ctx: SimContext, obstacle: Obstacle, dir?: Vec2): void {
    const def = obstacle.def;
    if (def.loot.length === 0) return;
    let lootPos = v2.copy(obstacle.pos);
    let pushSpeed = OBSTACLE_PUSH_SPEED;
    if (def.lootSpawn) {
        lootPos = v2.add(obstacle.pos, v2.rotate(def.lootSpawn.offset, math.oriToRad(obstacle.ori)));
        pushSpeed *= def.lootSpawn.speedMult;
    }
    const items: RolledItem[] = rollLootList(lootTables(ctx), def.loot, ctx.lootRng, warnUnknownTier);
    let rad = 0;
    if (items.length > 1) {
        rad = OBSTACLE_MULTI_RAD;
        pushSpeed /= items.length;
    }
    for (const item of items) {
        const pos = v2.add(lootPos, randomPointInCircle(ctx.lootRng, rad));
        ctx.loot.addLoot(item.type, pos, obstacle.layer, item.count, {
            pushSpeed,
            dir,
            preloadGun: item.preload,
            source: "obstacle",
        });
    }
}

/** A player throws an item behind itself (survev player.ts dropLoot: speed 7.5..11 against the facing). */
export function playerDropLoot(ctx: SimContext, player: Player, type: string, count = 1, useCountForAmmo = false): void {
    ctx.loot.addLoot(type, player.pos, player.layer, count, {
        useCountForAmmo,
        pushSpeed: ctx.lootRng.range(7.5, 11),
        dir: v2.neg(player.dir),
        source: "player",
    });
}

/**
 * Drops the gun of a slot without clearing it: the magazine goes back into the bag, whatever does not fit drops
 * as the gun's side stacks; a dual gun drops as two singles (survev weaponManager.ts _dropGun).
 */
export function dropGunLoot(ctx: SimContext, player: Player, idx: number): void {
    const weapon = player.weaponManager.weapons[idx];
    const def = weapon.type ? getDef(weapon.type) : undefined;
    if (def?.type !== "gun" || def.noDrop) return;
    let overflow = 0;
    if (!player.weaponManager.isInfinite(def) && isBagItem(def.ammo)) {
        overflow = player.inv.give(def.ammo, weapon.ammo).remaining;
    }
    let item = weapon.type;
    if (def.isDual) {
        item = item.replace("_dual", "");
        playerDropLoot(ctx, player, item, 0, true);
    }
    playerDropLoot(ctx, player, item, overflow, true);
}

export function dropGun(ctx: SimContext, player: Player, idx: number): void {
    const type = player.weaponManager.weapons[idx].type;
    const def = type ? getDef(type) : undefined;
    if (def?.type === "gun" && def.noDrop) return;
    dropGunLoot(ctx, player, idx);
    player.weaponManager.setWeapon(idx, "", 0);
}

export function dropMelee(ctx: SimContext, player: Player): void {
    const wm = player.weaponManager;
    const type = wm.weapons[WeaponSlot.Melee].type;
    if (type === "fists") return;
    playerDropLoot(ctx, player, type);
    wm.setWeapon(WeaponSlot.Melee, "fists", 0);
}

/** Everything a dying player carried drops around its body (survev player.ts kill "drop loot"). */
export function dropEverythingOnDeath(ctx: SimContext, player: Player): void {
    const wm = player.weaponManager;
    const scatter = () => ({ pushSpeed: ctx.lootRng.range(7.5, 11), dir: v2.randomUnit(ctx.lootRng) });
    for (let i = 0; i < WeaponSlot.Count; i++) {
        const weapon = wm.weapons[i];
        if (!weapon.type) continue;
        const def = getDef(weapon.type);
        if (def.type === "gun") {
            dropGun(ctx, player, i);
            weapon.type = "";
        } else if (def.type === "melee") {
            if (def.noDropOnDeath || weapon.type === "fists") continue;
            ctx.loot.addLoot(weapon.type, player.pos, player.layer, 1, scatter());
            weapon.type = "fists";
        } else if (def.type === "throwable") {
            weapon.type = "";
        }
    }
    wm.setCurWeapIndex(WeaponSlot.Melee);
    for (const item of Object.keys(player.inv.items)) {
        // the 1x scope is built in
        if (item === "1xscope") continue;
        const amount = player.inv.get(item);
        if (amount > 0) ctx.loot.addLoot(item, player.pos, player.layer, amount, scatter());
    }
    for (const id of [player.helmet, player.chest, player.backpack]) {
        if (!id) continue;
        const def = GameObjectDefs[id] as { noDrop?: boolean };
        if (def.noDrop || gearLevel(id) < 1) continue;
        ctx.loot.addLoot(id, player.pos, player.layer, 1, scatter());
    }
    const outfit = getDef(player.outfit) as { noDrop?: boolean; noDropOnDeath?: boolean };
    if (!outfit.noDropOnDeath && !outfit.noDrop && player.outfit !== player.loadoutOutfit) {
        ctx.loot.addLoot(player.outfit, player.pos, player.layer, 1, scatter());
    }
    // TODO(M8): droppable perks drop as well
    player.inv.clear();
    player.helmet = "";
    player.chest = "";
    player.backpack = "backpack00";
    wm.showNextThrowable();
}
