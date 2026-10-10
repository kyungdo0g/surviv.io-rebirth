// Bot setup helpers split out of bot.ts (the 600-line rule): the team mode of a game, the skill profile from the
// options, and the Emote message of an intent's emote.
import type { Rng } from "@rebirth/core";
import { v2 } from "@rebirth/core";
import { GameObjectDefs, hasDef } from "@rebirth/defs";
import type { EmoteRequest } from "@rebirth/sim";
import type { BotOptions } from "./bot.ts";
import type { IntentEmote } from "./brain/context.ts";
import { drawSkill, type SkillProfile, skillOf, tierOfSkill } from "./skill.ts";

/** A game's team mode as a BotOptions.teamMode (sim Game.teamMode, the Joined message's u8). */
export function teamModeOf(n: number): 1 | 2 | 4 {
    return n > 2 ? 4 : n === 2 ? 2 : 1;
}

/** The bot's skill profile: a drawn tier, an exact s (g = sense ?? s), or the preset's (PRESET_SKILL). */
export function resolveSkill(opts: BotOptions, rng: Rng): SkillProfile {
    const k = opts.skill;
    if (k === undefined) return skillOf(opts.difficulty ?? "normal");
    if (typeof k === "string") return drawSkill(rng, k);
    const s = Math.min(1, Math.max(0, k));
    const g = Math.min(1, Math.max(0, opts.sense ?? s));
    return { tier: tierOfSkill(s), s, g };
}

/** The Emote message for an intent's emote: pings (def type "ping") mark their position, emotes float over the bot. */
export function emoteRequest(e: IntentEmote): EmoteRequest {
    const isPing = hasDef(e.type) && GameObjectDefs[e.type].type === "ping";
    return isPing && e.pos ? { type: e.type, isPing, pos: v2.copy(e.pos) } : { type: e.type, isPing };
}
