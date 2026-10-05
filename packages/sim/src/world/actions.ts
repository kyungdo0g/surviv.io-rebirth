// One-shot input actions (equip, reload, interact, revive, scopes...) applied at the start of a player's tick.
// Behaviour follows survev server/src/game/objects/player.ts handleInput and shouldAcceptInput (downed players, M6a).
import { Input, WeaponSlot } from "@rebirth/defs";
import { SCOPE_LEVELS } from "../items/inventory.ts";
import { closestLoot, pickupLoot } from "../loot/pickup.ts";
import { throwThrowable } from "../weapons/throwable.ts";
import { selectThrowable, useItem } from "./consumables.ts";
import type { SimContext } from "./context.ts";
import { acceptsWhileDowned, playerToRevive, startRevive } from "./downed.ts";
import { interactableObstacles, useObstacle } from "./interact.ts";
import type { Player } from "./player.ts";

export function handleActions(ctx: SimContext, player: Player, actions: readonly number[]): void {
    const wm = player.weaponManager;
    // the mobile client sends Interact then Cancel: a revive started by the Interact survives the Cancel (survev)
    let ignoreCancel = false;
    for (const action of actions) {
        if (player.downed && !acceptsWhileDowned(player, action)) continue;
        switch (action) {
            case Input.StowWeapons:
            case Input.EquipMelee:
                wm.setCurWeapIndex(WeaponSlot.Melee);
                break;
            case Input.EquipPrimary:
                wm.setCurWeapIndex(WeaponSlot.Primary);
                break;
            case Input.EquipSecondary:
                wm.setCurWeapIndex(WeaponSlot.Secondary);
                break;
            case Input.EquipThrowable:
                if (wm.curWeapIdx === WeaponSlot.Throwable) {
                    // pressing it again drops a cooked throwable and cycles the type (survev handleInput)
                    throwThrowable(ctx, player, true);
                    if (wm.cooking) player.cancelAnim();
                    wm.showNextThrowable();
                } else {
                    wm.setCurWeapIndex(WeaponSlot.Throwable);
                }
                break;
            case Input.EquipFragGrenade:
                selectThrowable(player, "frag");
                break;
            case Input.EquipSmokeGrenade:
                selectThrowable(player, "smoke");
                break;
            case Input.UseBandage:
                useItem(ctx, player, "bandage");
                break;
            case Input.UseHealthKit:
                useItem(ctx, player, "healthkit");
                break;
            case Input.UseSoda:
                useItem(ctx, player, "soda");
                break;
            case Input.UsePainkiller:
                useItem(ctx, player, "painkiller");
                break;
            case Input.EquipNextWeap:
            case Input.EquipPrevWeap: {
                const step = action === Input.EquipNextWeap ? 1 : -1;
                let idx = wm.curWeapIdx;
                for (let i = 0; i < WeaponSlot.Count; i++) {
                    idx = (((idx + step) % WeaponSlot.Count) + WeaponSlot.Count) % WeaponSlot.Count;
                    if (wm.weapons[idx].type) break;
                }
                wm.setCurWeapIndex(idx);
                break;
            }
            case Input.EquipLastWeap:
                wm.setCurWeapIndex(wm.lastWeaponIdx);
                break;
            case Input.EquipOtherGun: {
                const targets = [WeaponSlot.Primary, WeaponSlot.Secondary, WeaponSlot.Melee].filter(
                    (s) => s !== wm.curWeapIdx,
                );
                const slot = targets.find((s) => wm.weapons[s].type);
                if (slot !== undefined) wm.setCurWeapIndex(slot);
                break;
            }
            case Input.SwapWeapSlots:
                wm.swapWeaponSlots();
                break;
            case Input.Reload:
                if (player.action.type !== "revive") wm.scheduledReload = true;
                break;
            case Input.Cancel:
                if (!ignoreCancel) player.cancelAction();
                break;
            case Input.Revive:
                startRevive(ctx, player, playerToRevive(ctx, player));
                break;
            case Input.Interact:
            case Input.Loot: {
                // Interact revives a downed teammate in reach (a downed player only itself, with Revivify), picks up
                // loot and uses every button in reach (survev player.ts handleInput: revive, loot, then obstacles)
                if (action === Input.Interact && (!player.downed || player.hasPerk("self_revive"))) {
                    if (startRevive(ctx, player, playerToRevive(ctx, player))) ignoreCancel = true;
                }
                const loot = player.downed ? undefined : closestLoot(ctx, player);
                if (loot) pickupLoot(ctx, player, loot);
                if (action === Input.Interact) {
                    for (const obstacle of interactableObstacles(ctx, player)) useObstacle(ctx, obstacle, player);
                }
                break;
            }
            case Input.Use:
                for (const obstacle of interactableObstacles(ctx, player)) useObstacle(ctx, obstacle, player);
                break;
            case Input.EquipNextScope:
            case Input.EquipPrevScope: {
                const step = action === Input.EquipNextScope ? 1 : -1;
                for (let i = SCOPE_LEVELS.indexOf(player.scope) + step; i >= 0 && i < SCOPE_LEVELS.length; i += step) {
                    if (player.inv.has(SCOPE_LEVELS[i])) {
                        player.scope = SCOPE_LEVELS[i];
                        break;
                    }
                }
                break;
            }
            default:
                break;
        }
    }
}
