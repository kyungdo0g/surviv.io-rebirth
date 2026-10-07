// A joining player's loadout (survev content wave stage 4b; survev player.ts constructor and setOutfit): the outfit
// (worn from the start and never dropped; a faction outfit of the other side falls back to the base outfit, like a
// pickup), the melee skin in the melee slot, the heal and boost particles every client sees (PlayerInfo) and the emote
// wheel with the win and death slots.
import { WeaponSlot } from "@rebirth/defs";
import { wearableOutfit } from "../loot/pickup.ts";
import type { SimContext } from "../world/context.ts";
import { setOutfit } from "../world/disguise.ts";
import type { Player } from "../world/player.ts";
import { type JoinLoadout, validateLoadout } from "./loadout.ts";

export function applyLoadout(ctx: SimContext, player: Player, input: Partial<JoinLoadout> | undefined): void {
    const loadout = validateLoadout(input);
    const outfit = wearableOutfit(ctx, player, loadout.outfit) ? loadout.outfit : player.outfit;
    player.loadoutOutfit = outfit;
    setOutfit(ctx, player, outfit);
    if (loadout.melee !== "fists") player.weaponManager.setWeapon(WeaponSlot.Melee, loadout.melee, 0);
    player.loadoutHeal = loadout.heal;
    player.loadoutBoost = loadout.boost;
    player.emoteLoadout.splice(0, player.emoteLoadout.length, ...loadout.emotes);
}
