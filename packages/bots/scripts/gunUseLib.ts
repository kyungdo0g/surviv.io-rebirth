// Population metrics of the owner's gun-use items (bot round 6, user reports 42-44), measured apart from the faction
// A/B: one match where half the bots (one parity of the spawn index) play the smart brain with the three flags and the
// other half without them (the brain name "baseline", its features overridden), personas and skill tiers drawn as on
// the server. A read-only probe watches both halves the same way:
// - loadouts (report 43, 42): every 5 s, the living bots holding a gun, by half and skill tier: the share carrying a
//   DMR, a close gun (SMG or shotgun) next to a DMR, a bolt sniper, and a potato gun (the Spud Gun, the Potato Cannon);
// - follow-up shots (report 44): after a shot with a slow-cycling gun (quickSwitch.ts slowCycling), the time to the
//   same bot's next shot when it comes within 3 s, by half and tier, and the quick switches the bots made;
// - DMR uptake (report 43): DMRs a bot saw lying within 15 u (each loot item once per bot) and DMRs it picked up (a DMR
//   in a gun slot that was not there a second before);
// - kills by the potato guns.
import { WeaponSlot } from "@rebirth/defs";
import type { Game } from "@rebirth/sim";
import { BRAIN_PRESETS, type BrainFeatures } from "../src/brain/features.ts";
import { slowCycling } from "../src/brain/quickSwitch.ts";
import type { BotController } from "../src/controller.ts";
import type { SkillTierName } from "../src/difficulty.ts";
import { POTATO_GUNS } from "../src/knowledge/gunTiers.ts";
import { gunInfo } from "../src/knowledge/weapons.ts";
import { type MatchProbe, runMatch } from "../src/runner.ts";

export const GUN_FLAGS = ["potatoGuns", "dmrFit", "quickSwitch"] as const;
export const TIERS: readonly SkillTierName[] = ["beginner", "intermediate", "expert"];

/** The smart preset without the three gun-use flags. */
export function withoutGunUse(): Readonly<BrainFeatures> {
    const f = { ...BRAIN_PRESETS.smart } as BrainFeatures;
    for (const k of GUN_FLAGS) f[k] = false;
    return Object.freeze(f);
}

export interface TierMetrics {
    /** loadout samples of living bots with a gun */
    samples: number;
    dmr: number;
    closeDmr: number;
    sniper: number;
    potato: number;
    /** follow-up shots after a slow gun's shot: count and summed seconds */
    follow: number;
    followSum: number;
    /** quick switches made (QuickSwitch.count) */
    quick: number;
    /** DMRs seen lying close by and DMRs picked up */
    dmrSeen: number;
    dmrTaken: number;
    bots: number;
    kills: number;
}

export type HalfMetrics = Record<SkillTierName, TierMetrics> & { potatoKills: number };

export const emptyTier = (): TierMetrics => ({
    samples: 0,
    dmr: 0,
    closeDmr: 0,
    sniper: 0,
    potato: 0,
    follow: 0,
    followSum: 0,
    quick: 0,
    dmrSeen: 0,
    dmrTaken: 0,
    bots: 0,
    kills: 0,
});
export const emptyHalf = (): HalfMetrics => ({
    beginner: emptyTier(),
    intermediate: emptyTier(),
    expert: emptyTier(),
    potatoKills: 0,
});

const SAMPLE_S = 5;
const LOOT_S = 1;
const DMR_SEEN = 15;
const FOLLOW_MAX = 3;

class GunProbe implements MatchProbe {
    readonly name = "guns";
    readonly halves: Record<"on" | "off", HalfMetrics> = { on: emptyHalf(), off: emptyHalf() };
    private readonly info = new Map<number, { on: boolean; tier: SkillTierName }>();
    private readonly lastShot = new Map<number, { t: number; slow: boolean }>();
    private readonly onIdx: (index: number) => boolean;
    private game: Game | null = null;
    private nextSample = 0;
    private nextLoot = 0;
    private readonly dmrSeen = new Set<string>();
    private readonly dmrHeld = new Map<number, string[]>();

    constructor(onIdx: (index: number) => boolean) {
        this.onIdx = onIdx;
    }

    private metricsOf(id: number): TierMetrics | null {
        const i = this.info.get(id);
        return i ? this.halves[i.on ? "on" : "off"][i.tier] : null;
    }

    start(game: Game, bots: readonly BotController[]): void {
        this.game = game;
        bots.forEach((b, i) => {
            this.info.set(b.playerId, { on: this.onIdx(i), tier: b.bot.skill.tier });
        });
    }

    tick(game: Game, bots: readonly BotController[]): void {
        if (game.time >= this.nextLoot) {
            this.nextLoot = game.time + LOOT_S;
            this.dmrUptake(game, bots);
        }
        if (game.time < this.nextSample) return;
        this.nextSample = game.time + SAMPLE_S;
        for (const b of bots) {
            const p = game.getPlayer(b.playerId);
            const m = this.metricsOf(b.playerId);
            if (!p || p.dead || p.downed || !m) continue;
            const guns = [WeaponSlot.Primary, WeaponSlot.Secondary]
                .map((s) => p.weaponManager.weapons[s]?.type ?? "")
                .filter((t) => (gunInfo(t)?.score ?? 0) > 0 || POTATO_GUNS.has(t));
            if (!guns.length) continue;
            const cls = guns.map((t) => gunInfo(t)?.cls);
            m.samples++;
            if (cls.includes("dmr")) m.dmr++;
            if (cls.includes("dmr") && (cls.includes("smg") || cls.includes("shotgun"))) m.closeDmr++;
            if (cls.includes("sniper")) m.sniper++;
            if (guns.some((t) => POTATO_GUNS.has(t))) m.potato++;
        }
    }

    private dmrUptake(game: Game, bots: readonly BotController[]): void {
        for (const b of bots) {
            const p = game.getPlayer(b.playerId);
            const m = this.metricsOf(b.playerId);
            if (!p || p.dead || p.downed || !m) continue;
            for (const l of b.bot.model.loot.values()) {
                if (gunInfo(l.type)?.cls !== "dmr") continue;
                const key = `${p.id}:${l.id}`;
                if (this.dmrSeen.has(key) || Math.hypot(l.pos.x - p.pos.x, l.pos.y - p.pos.y) > DMR_SEEN) continue;
                this.dmrSeen.add(key);
                m.dmrSeen++;
            }
            // a DMR in a slot that held something else (or nothing) a second ago
            const slots = [WeaponSlot.Primary, WeaponSlot.Secondary].map((s) => p.weaponManager.weapons[s]?.type ?? "");
            const before = this.dmrHeld.get(p.id) ?? ["", ""];
            for (let i = 0; i < 2; i++) if (slots[i] !== before[i] && gunInfo(slots[i])?.cls === "dmr") m.dmrTaken++;
            this.dmrHeld.set(p.id, slots);
        }
    }

    readonly observer = {
        onShotFired: (shooter: { id: number }, weaponType: string) => {
            const now = this.game?.time ?? 0;
            const last = this.lastShot.get(shooter.id);
            const m = this.metricsOf(shooter.id);
            if (last?.slow && m && now - last.t <= FOLLOW_MAX) {
                m.follow++;
                m.followSum += now - last.t;
            }
            this.lastShot.set(shooter.id, { t: now, slow: slowCycling(weaponType) });
        },
        onPlayerKilled: (_v: unknown, params: { gameSourceType?: string }, credit: { id: number } | undefined) => {
            const i = credit ? this.info.get(credit.id) : undefined;
            if (i && params.gameSourceType && POTATO_GUNS.has(params.gameSourceType))
                this.halves[i.on ? "on" : "off"].potatoKills++;
        },
    };

    finish(_game: Game, bots: readonly BotController[]): unknown {
        for (const b of bots) {
            const m = this.metricsOf(b.playerId);
            if (m) m.quick += b.bot.quick?.count ?? 0;
        }
        return null;
    }
}

export interface GunTask {
    seed: number;
    bots: number;
    map: string;
    /** which half plays the three flags: 0 even indices, 1 odd indices */
    half: 0 | 1;
}

/** One match of the gun-use comparison; its metrics per half. */
export function runGunMatch(task: GunTask): Record<"on" | "off", HalfMetrics> {
    const onIdx = (i: number) => i % 2 === task.half;
    const probe = new GunProbe(onIdx);
    const report = runMatch({
        mapName: task.map,
        seed: task.seed,
        bots: task.bots,
        difficulty: "population",
        population: { personas: true },
        maxTicks: 60000,
        brainFeatures: { baseline: withoutGunUse() },
        assign: (i) => ({ brain: onIdx(i) ? "smart" : "baseline" }),
        probes: [probe],
    });
    for (const p of report.players) {
        const m = probe.halves[p.brain === "smart" ? "on" : "off"][p.tier];
        m.kills += p.kills;
        m.bots++;
    }
    return probe.halves;
}
