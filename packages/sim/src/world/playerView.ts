// Views of a player: what other players see (PlayerView), its own HUD state (LocalPlayerState) and its match stats.
import { v2 } from "@rebirth/core";
import { isBagItem } from "../items/inventory.ts";
import { perkViews } from "../perks/perks.ts";
import type { ActionType, LocalPlayerState, MatchStats, PlayerView } from "../view.ts";
import type { Player } from "./player.ts";

function viewActionType(p: Player): ActionType {
    return p.action.type === "reloadAlt" ? "reload" : p.action.type;
}

export function playerView(p: Player): PlayerView {
    return {
        id: p.id,
        kind: "player",
        type: p.type,
        pos: v2.copy(p.pos),
        layer: p.layer,
        dir: v2.copy(p.dir),
        dead: p.dead,
        downed: p.downed,
        activeWeapon: p.activeWeapon,
        outfit: p.outfit,
        helmet: p.helmet,
        chest: p.chest,
        backpack: p.backpack,
        scale: p.scale,
        anim: { type: p.animType, seq: p.animSeq },
        action: {
            type: viewActionType(p),
            seq: p.action.seq,
            item: p.action.item,
            duration: p.action.duration,
        },
        shot: { seq: p.shotSeq, offHand: p.shotOffhand },
        wearingPan: p.wearingPan,
        healEffect: p.healEffect && !p.dead,
        role: p.role,
        perks: perkViews(p),
        haste: { type: p.haste.type, seq: p.haste.seq },
        frozen: p.frozen.ticker > 0,
        frozenOri: p.frozen.ticker > 0 ? p.frozen.ori : 0,
    };
}

export function playerLocalState(p: Player): LocalPlayerState {
    const wm = p.weaponManager;
    const inventory: Record<string, number> = {};
    for (const [item, count] of Object.entries(p.inv.items)) if (isBagItem(item)) inventory[item] = count;
    return {
        health: p.health,
        boost: p.boost,
        zoom: p.zoom,
        layer: p.layer,
        weapons: wm.weapons.map((w) => ({ type: w.type, ammo: w.ammo })),
        curWeapIdx: wm.curWeapIdx,
        inventory,
        scope: p.scope,
        outfit: p.outfit,
        helmet: p.helmet,
        chest: p.chest,
        backpack: p.backpack,
        action: {
            type: viewActionType(p),
            item: p.action.item,
            time: p.action.time,
            duration: p.action.duration,
            targetId: p.action.targetId,
        },
        cooldowns: {
            weapons: wm.weapons.map((w) => Math.max(0, w.cooldown)),
            freeSwitch: Math.max(0, wm.freeSwitchTimer),
        },
        kills: p.kills,
        dead: p.dead,
        killedBy: p.killedBy,
        stats: playerMatchStats(p),
        spectatorCount: p.spectatorCount,
        role: p.role,
        perks: perkViews(p),
    };
}

/** Match stats as the client shows them: damage rounded, whole seconds (the original PlayerStats record). */
export function playerMatchStats(p: Player): MatchStats {
    return {
        kills: p.kills,
        damageDealt: Math.round(p.damageDealt),
        damageTaken: Math.round(p.damageTaken),
        timeAlive: Math.floor(p.timeAlive + 1e-9),
    };
}
