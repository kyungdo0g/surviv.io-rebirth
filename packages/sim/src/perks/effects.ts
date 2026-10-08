// Perk effects that run over time or on events (M7a): haste, Last Breath and bugle timers, Gift of the Woods
// regeneration, That Sucks and Gabby Ghost, Takedown on kills, Last Breath and Martyrdom on death, Inspiration when
// the bugle is played, Windwalk when enemy fire passes close.
// Behaviour follows survev server/src/game/objects/player.ts (update: haste / last breath / bugler / gotw / bleed /
// chatty blocks; kill: takedown, initLastBreath, martyrdom; playBugle) and objects/bullet.ts (windwalk), with the
// values of rules.perks (perks/perkRules.ts, docs/research/items/perks.md).
import { DamageType, getDef, hasDef, idsOfType } from "@rebirth/defs";
import { dropPirateBounty } from "../loot/drops.ts";
import { boostHealAmounts } from "../rules.ts";
import { gunDef } from "../weapons/weaponManager.ts";
import type { SimContext } from "../world/context.ts";
import { teammatesInRange } from "../world/downed.ts";
import type { Player } from "../world/player.ts";
import type { PerkRules } from "./perkRules.ts";
import { giveHaste, recalcScale, updateFat, updateHaste } from "./perks.ts";

const PLAYER_MAX_HEALTH = 100;
const MAX_BOOST = 100;
/** The bugle emotes of Inspiration and Last Breath come in the faction colours (FactionTeam Red 1, Blue 2). */
const FACTION_COLORS: Readonly<Record<number, string>> = { 1: "red", 2: "blue" };

let emoteIds: string[] | null = null;
/** Gabby Ghost picks from every emote def, locked ones included (survev trick_chatty: Object.keys(EmotesDefs)). */
function allEmotes(): string[] {
    emoteIds ??= idsOfType("emote");
    return emoteIds;
}

/** Per-tick perk timers, before the action and movement of the player's tick (survev update order). */
export function updatePerks(ctx: SimContext, player: Player, dt: number): void {
    // survev-only Combat Stimulants bonus and Indomitable Spirit effect (survev player.ts:1797-1803, 2128-2133)
    player.combatStimsTicker = Math.max(0, player.combatStimsTicker - dt);
    player.lastStandTicker = Math.max(0, player.lastStandTicker - dt);
    const rules = ctx.rules.perks;
    updateHaste(player, dt);
    updateFat(player, dt);
    if (player.lastBreathTicker > 0) {
        player.lastBreathTicker -= dt;
        if (player.lastBreathTicker <= 1e-9) {
            player.lastBreathTicker = 0;
            recalcScale(player);
        }
    }
    if (player.bugleTicker > 0) rechargeBugle(player, dt, rules.bugleRechargeTime);
    // Gift of the Woods heals on top of adrenaline, never while downed (conflicts.md gotw-while-downed)
    if (player.hasPerk("gotw") && !player.downed) {
        const rate = rules.gotwRegenRate ?? boostHealAmounts(ctx.rules.boostModel)[0];
        player.health = Math.min(PLAYER_MAX_HEALTH, player.health + rate * dt);
    }
    // That Sucks: 1 bleed damage every 3 s, standing or downed (perks.md trick_drain)
    if (player.hasPerk("trick_drain")) {
        player.drainTicker -= dt;
        if (player.drainTicker <= 1e-9) {
            player.drainTicker = rules.trickDrainInterval;
            ctx.damagePlayer(player, { amount: rules.trickDrainDamage, damageType: DamageType.Bleeding });
        }
    } else {
        player.drainTicker = 0;
    }
    // Gabby Ghost: a random emote every 5-15 s (perks.md trick_chatty)
    if (player.hasPerk("trick_chatty")) {
        player.chattyTicker -= dt;
        if (player.chattyTicker < 0) {
            player.chattyTicker = ctx.fxRng.range(rules.chattyInterval[0], rules.chattyInterval[1]);
            const emotes = allEmotes();
            ctx.addEmote(player, emotes[ctx.fxRng.int(0, emotes.length - 1)]);
        }
    }
}

/** AFK filter of promotions: time moving / standing still and since the last move (survev movingTicker...). */
export function trackActivity(player: Player, moving: boolean, dt: number): void {
    if (moving) {
        player.movingTime += dt;
        player.timeWithoutMoving = 0;
    } else {
        player.stillTime += dt;
        player.timeWithoutMoving += dt;
    }
}

/** The bugle regains one charge every 8 s until its magazine is full (survev update "Bugler logic"). */
function rechargeBugle(player: Player, dt: number, interval: number): void {
    player.bugleTicker -= dt;
    if (player.bugleTicker > 1e-9) return;
    player.bugleTicker = 0;
    const wm = player.weaponManager;
    const bugle = wm.weapons.find((w) => w.type === "bugle");
    const def = gunDef("bugle");
    if (!bugle || !def) return;
    bugle.ammo++;
    if (bugle.ammo < wm.ammoStats(def).maxClip) player.bugleTicker = interval;
}

/** Emote of a bugle effect over an affected teammate, in its faction colour (none outside factions). */
function bugleEmote(ctx: SimContext, player: Player, kind: "inspiration" | "final"): void {
    const color = FACTION_COLORS[player.teamId];
    if (color) ctx.addEmote(player, `emote_bugle_${kind}_${color}`);
}

/**
 * Inspiration: the bugle was played (survev playBugle): every teammate within 30 u (the bugler included) gets the
 * Inspire haste for 3 s, and the bugle starts recharging.
 */
export function playBugle(ctx: SimContext, player: Player): void {
    const rules = ctx.rules.perks;
    player.bugleTicker = rules.bugleRechargeTime;
    for (const p of teammatesInRange(ctx, player, rules.inspirationRange)) {
        giveHaste(p, "inspire", rules.inspirationHasteDuration);
        if (p !== player) bugleEmote(ctx, p, "inspiration");
    }
}

/**
 * A player died (survev kill): Last Breath bloodlusts the teammates within 60 u (bonus damage, size, Inspire haste
 * for 5 s), and Martyrdom (the perk, or the Grenadier / Demo role) scatters 12 martyr_nades.
 */
export function onPerkHolderDeath(ctx: SimContext, player: Player): void {
    const rules = ctx.rules.perks;
    if (player.hasPerk("final_bugle")) {
        for (const p of teammatesInRange(ctx, player, rules.lastBreathRange)) {
            if (p === player) continue;
            p.lastBreathTicker = rules.lastBreathDuration;
            giveHaste(p, "inspire", rules.lastBreathDuration);
            bugleEmote(ctx, p, "final");
            recalcScale(p);
        }
    }
    if (player.hasPerk("martyrdom") || rules.martyrdomRoles.includes(player.role)) {
        const { x, y } = player.pos;
        ctx.projectiles.addSplit(
            player.id,
            "martyr_nade",
            { x, y },
            player.layer,
            { x: 0, y: 0 },
            rules.martyrdomCount,
            rules.martyrdomMaxVel,
        );
    }
}

/**
 * Takedown: a kill of an enemy gives +25 HP, +25 adrenaline and a 3 s haste (knocks do not count) (perks.md).
 * Pirate's Bounty: a kill whose final hit is a melee weapon drops the bounty at the victim (survev player.ts:2727).
 */
export function onKillCredited(ctx: SimContext, killer: Player, victim?: Player, weapon?: string): void {
    if (victim && killer.hasPerk("pirate") && weapon && hasDef(weapon) && getDef(weapon).type === "melee") {
        dropPirateBounty(ctx, victim);
    }
    if (killer.dead || !killer.hasPerk("takedown")) return;
    const rules = ctx.rules.perks;
    killer.health = Math.min(PLAYER_MAX_HEALTH, killer.health + rules.takedownHealth);
    killer.boost = Math.min(MAX_BOOST, killer.boost + rules.takedownBoost);
    giveHaste(killer, "takedown", rules.takedownHasteDuration);
}

/**
 * Windwalk: fire from `sourceTeamId` passed within the trigger distance of `player` (survev bullet.ts: enemy bullets
 * only, no re-trigger while the Windwalk haste runs).
 */
export function windwalkTrigger(rules: PerkRules, player: Player, sourceTeamId: number): void {
    if (player.dead || !player.hasPerk("windwalk") || player.haste.type === "windwalk") return;
    if (sourceTeamId !== 0 && sourceTeamId === player.teamId) return;
    giveHaste(player, "windwalk", rules.windwalkDuration);
}
