// Role and 50v50 knobs (M7a). Promotion timing, role loadouts and the faction schedule were server-side in the
// original; values follow docs/research/items/roles.md and modes/faction.md with their conflict resolutions, each
// cited per line. `game.rules.roles` is a mutable copy.
import { type AirstrikeVariant, DEFAULT_AIRSTRIKE_VARIANT_WEIGHTS, GameConfig } from "@rebirth/defs";

/** One promotion slot of the 50v50 schedule: one of `roles` (picked once per game) at `wait` s into `circleIdx`. */
export interface RoleSlot {
    roles: readonly string[];
    circleIdx: number;
    wait: number;
}

export interface RoleRules {
    /**
     * 50v50 schedule (conflicts.md faction-promotion-order / role-promotion-timing): Commander 50 s, one random of
     * Lieutenant / Marksman / Recon / Grenadier 54 s, Medic 58 s, Bugler 62 s after circle 0 starts (survev pre-fork
     * 42f052d8). "map" uses the MapDef timings instead (survev's fork all-roles schedule, 50-74 s).
     */
    factionSchedule: readonly RoleSlot[] | "map";
    /**
     * Promotions skip AFK players while anybody else is eligible: alive over 5 s and still more than half of that
     * time, or no movement in the last 5 s (survev scheduled roles; fandom: bad connections are never Commander).
     */
    promotionSkipAfk: boolean;
    /** AFK filter thresholds (survev: 5 s alive, 50 % still, 5 s without moving) */
    afkMinTime: number;
    afkStillFraction: number;
    afkStillTime: number;
    /**
     * Lone Survivr: once per team, when at most this many of its living players stand (not downed, connected) and the
     * game no longer accepts joins (conflicts.md role-lone-survivr-trigger; 2 since 0.8.71)
     */
    lastManCount: number;
    /** promotion to Lone Survivr: 100 HP, 100 adrenaline and the Windwalk haste for 5 s (survev promoteToRole) */
    lastManHasteDuration: number;
    /**
     * extra Lone Survivr perk, one at random (conflicts.md role-lone-survivr-perks: v0.8.82 1/3 each); empty under
     * survev balance, whose role def lists four perks, two of them weighted picks (survev roleDefs.ts last_man)
     */
    lastManExtraPerks: readonly string[];
    /**
     * When a team's Commander dies (or leaves), its first living, standing Lieutenant becomes its Captain (Assume
     * Leadership and Firepower, the captain helmet, 8x scope), keeping its weapons (survev's Captain, v0.1.2;
     * wikigg/Captain). Not in v0.8.82; on since the survev content wave (survev is the gameplay baseline).
     */
    commanderSuccession: boolean;
    /**
     * Classless (survev-only Cobalt role from the Augmenting Vat): the class perks it draws from, every Cobalt class
     * perk but Martyrdom (survev perkDefs.ts:166-182 PerkProperties.classless.perkPool)
     */
    classlessPerkPool: readonly string[];
    /** the Commander's flare gun fires itself after 15 s (conflicts.md role-leader-auto-flare: fork 0.1.2, off) */
    leaderAutoFlare: boolean;
    leaderAutoFlareDelay: number;
    /** the Commander's flare gun cannot be dropped or swapped out before it was fired (survev weaponManager) */
    leaderFlareLocked: boolean;
    /**
     * Air strike wait overrides by circle (conflicts.md faction-airstrike-timing: strikes #2 / #4 at 24 / 18 s in
     * v0.8.82; the ported def holds the fork's 30 / 21 s). `{}` keeps the def timings.
     */
    factionAirstrikeWaits: Readonly<Record<number, number>>;
    /**
     * Rebirth (deliberate deviation requested by the user, docs/research/rebirth-deviations.md): roll weights of the
     * variant of every scheduled air strike zone on faction maps (normal / heavy / carpet, defs AIRSTRIKE_VARIANTS);
     * missing, non-positive or non-finite weights never win, none left means normal. `{ normal: 1 }` restores
     * v0.8.82. The server sets it from AIRSTRIKE_VARIANTS.
     */
    factionAirstrikeVariants: Readonly<Partial<Record<AirstrikeVariant, number>>>;
    /**
     * One scheduled gold military drop per match (conflicts.md faction-gold-drop: "same time each match", time
     * unknown; mid-game knob). null: none.
     */
    factionGoldDrop: { circleIdx: number; wait: number; crate: string } | null;
    /**
     * survev's comeback drop (fork v0.0.17): after circle 0, on a kill, when the connected alive gap reaches 10 % of the
     * living players or 5, once per match a gold drop lands near the losing team's player farthest from the winners and
     * a 5-plane air strike hits the densest cluster. Off (fork).
     */
    helpLosingTeam: boolean;
    helpLosingTeamCrate: string;
    /**
     * The gold drop and the comeback drop of a potato faction map (Potato vs Tomato): survev drops airdrop_crate_04po,
     * whose crate_13po adds 2 tier_airdrop_potato rolls (survev plane.ts:273-278; crateDefs.ts crate_13po)
     */
    potatoGoldCrate: string;
    /** seconds between faction status refreshes (original PlayerStatus rate in faction mode, net.ts 0.5 s) */
    factionStatusInterval: number;
    /**
     * seconds a shot in an enemy's view shows the shooter on the enemy faction's minimap (survev weaponManager.ts:1024
     * timeUntilHidden 1). Rebirth default 0, off: the owner played the original, where enemies show only on screen
     * (user/2026-10-08-faction-feedback; open-questions.md faction-minimap-reveal); 1 restores survev's reveal.
     */
    factionRevealTime: number;
    /**
     * Cobalt: a player without a class gets a random one after this many seconds, survev's server safety net: the
     * client confirms the highlighted class itself after GameConfig.player.perkModeRoleSelectDuration (20 s), the
     * server waits 5 s more so that choice arrives first (survev player.ts:225-231, 1497-1503; conflicts.md
     * cobalt-role-timeout)
     */
    perkModeRoleSelectTime: number;
}

export function defaultRoleRules(): RoleRules {
    return {
        factionSchedule: [
            { roles: ["leader"], circleIdx: 0, wait: 50 },
            { roles: ["lieutenant", "marksman", "recon", "grenadier"], circleIdx: 0, wait: 54 },
            { roles: ["medic"], circleIdx: 0, wait: 58 },
            { roles: ["bugler"], circleIdx: 0, wait: 62 },
        ],
        promotionSkipAfk: true,
        afkMinTime: 5,
        afkStillFraction: 0.5,
        afkStillTime: 5,
        lastManCount: 2,
        lastManHasteDuration: 5,
        lastManExtraPerks: [],
        commanderSuccession: true,
        classlessPerkPool: [
            "combat_stims",
            "field_medic",
            "steelskin",
            "endless_ammo",
            "chambered",
            "takedown",
            "small_arms",
            "tree_climbing",
            "amped_explosives",
            "flak_jacket",
            "firepower",
            "bonus_assault",
        ],
        leaderAutoFlare: false,
        leaderAutoFlareDelay: 15,
        leaderFlareLocked: true,
        factionAirstrikeWaits: { 2: 24, 4: 18 },
        factionAirstrikeVariants: { ...DEFAULT_AIRSTRIKE_VARIANT_WEIGHTS },
        factionGoldDrop: { circleIdx: 3, wait: 2, crate: "airdrop_crate_04" },
        helpLosingTeam: false,
        helpLosingTeamCrate: "airdrop_crate_04",
        potatoGoldCrate: "airdrop_crate_04po",
        factionStatusInterval: 0.5,
        factionRevealTime: 0,
        perkModeRoleSelectTime: GameConfig.player.perkModeRoleSelectDuration + 5,
    };
}
