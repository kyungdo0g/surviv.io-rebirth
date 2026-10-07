// Weapon metrics (user reports 8, 12, 17 and 18): the tier of the best gun carried at the checkpoints (the living, and
// the dead with what they carried when they died: survivorship), pistol-only bots that see a better gun, usable guns
// dropped for lower-tier ones, S-tier guns seen and taken, holstering while travelling, the gun in hand during fights
// (a pistol while the other gun suits the range better; the gun that suits the range best) and slot switches. Uses
// the gun tiers of knowledge/gunTiers.ts. Read-only.
import { v2 } from "@rebirth/core";
import { WeaponSlot } from "@rebirth/defs";
import type { Player } from "@rebirth/sim";
import type { BotController } from "../controller.ts";
import { gunRank, gunTier, isWeakGun } from "../knowledge/gunTiers.ts";
import { gunInfo, suitability } from "../knowledge/weapons.ts";
import { sameLayer } from "../nav/cellGrid.ts";
import { livingBots, type MetricsCtx, SAMPLE } from "./context.ts";
import { bestGun, isSTier, seesBetterGun, usableGuns } from "./truth.ts";
import { CHECKPOINTS, type LoadoutSample } from "./types.ts";

/** Behaviours of a bot on its way somewhere (holstering makes it faster: report 17). */
export const TRAVEL = new Set(["explore", "zone", "loot", "sweep", "regroup", "airdrop"]);
/** Behaviours of a fight (no S-tier pickup expected meanwhile). */
const FIGHTING = new Set(["fight", "flee", "disengage", "thirdparty", "assist", "guard", "hold"]);
/** Hurt this recently: not safe. */
export const HURT_RECENT = 3;
/** An S-tier gun seen this close outside a fight must be held this soon (triage threshold). */
const S_TIER_RANGE = 20;
const S_TIER_WINDOW = 15;

interface Opportunity {
    lootId: number;
    since: number;
}

/** A loadout sample of player `p` (alive or not) at `t`. */
export function loadoutOf(bot: BotController, p: Player, t: number, alive: boolean): LoadoutSample {
    const guns = usableGuns(p);
    const best = bestGun(guns);
    const weakOnly = !!best && isWeakGun(best.id);
    return {
        t,
        alive,
        best: best ? (gunTier(best.id)?.tier ?? "D") : "none",
        bestId: best?.id ?? "",
        weakOnly,
        pistolOnly: guns.length > 0 && guns.every((g) => g.info.cls === "pistol"),
        unarmed: !best,
        seesBetter: alive && (weakOnly || !best) && seesBetterGun(bot, p),
    };
}

export class ArsenalCollector {
    private readonly ctx: MetricsCtx;
    /** every bot's loadout at the last sample (kept as it was when the bot died) */
    private readonly last = new Map<number, LoadoutSample>();
    private readonly slots = new Map<number, { types: string[]; usable: Set<string>; cur: number }>();
    private readonly chance = new Map<number, Opportunity[]>();
    private nextCheckpoint = 0;
    /** downgrades seen (from -> to), for the report */
    readonly downgrades: Array<{ from: string; to: string }> = [];

    constructor(ctx: MetricsCtx) {
        this.ctx = ctx;
    }

    tick(): void {
        const { game } = this.ctx;
        const tick = game.tick;
        if (tick % SAMPLE.state === 0) {
            this.swaps();
            this.sTier();
        }
        if (tick % SAMPLE.slow === 0) {
            this.slow();
            for (const { bot, p } of livingBots(this.ctx)) this.last.set(p.id, loadoutOf(bot, p, game.time, true));
        }
        while (this.nextCheckpoint < CHECKPOINTS.length && game.time >= CHECKPOINTS[this.nextCheckpoint] - 1e-6) {
            this.checkpoint(CHECKPOINTS[this.nextCheckpoint++]);
        }
    }

    private checkpoint(t: number): void {
        const { game } = this.ctx;
        for (const bot of this.ctx.bots) {
            const m = this.ctx.metrics.get(bot.playerId);
            if (!m) continue;
            const p = game.getPlayer(bot.playerId);
            // (a downed player is out of the fight: not one of the living with a weak gun; adversarial review: 17 of 26
            // "living unarmed" bots at 120 s of a 50v50 were downed, punched down unarmed)
            if (p && !p.dead) {
                m.loadout.push(loadoutOf(bot, p, t, !p.downed));
                continue;
            }
            const was = this.last.get(bot.playerId);
            m.loadout.push(
                was
                    ? { ...was, t, alive: false, seesBetter: false }
                    : {
                          t,
                          alive: false,
                          best: "none",
                          bestId: "",
                          weakOnly: false,
                          pistolOnly: false,
                          unarmed: true,
                          seesBetter: false,
                      },
            );
        }
    }

    /** Gun swaps: a usable gun gone from both slots while a lower-tier gun came in (report 12). */
    private swaps(): void {
        for (const { p, m } of livingBots(this.ctx)) {
            const wm = p.weaponManager;
            const types = [wm.weapons[WeaponSlot.Primary]?.type ?? "", wm.weapons[WeaponSlot.Secondary]?.type ?? ""];
            const usable = new Set(usableGuns(p).map((g) => g.id));
            const prev = this.slots.get(p.id);
            this.slots.set(p.id, { types, usable, cur: wm.curWeapIdx });
            if (!prev) continue;
            // slot switches between the two guns during a fight (report 18)
            const gunSlot = (i: number) => i === WeaponSlot.Primary || i === WeaponSlot.Secondary;
            if (prev.cur !== wm.curWeapIdx && gunSlot(prev.cur) && gunSlot(wm.curWeapIdx)) {
                const behaviour = this.ctx.byId.get(p.id)?.bot.intent.behaviour;
                if (behaviour === "fight") m.fightSwitches++;
            }
            const gone = prev.types.filter((t) => t && !types.includes(t) && prev.usable.has(t) && gunInfo(t));
            const came = types.filter((t) => t && !prev.types.includes(t) && gunInfo(t));
            for (const from of gone) {
                const to = came.find((t) => gunRank(t) < gunRank(from));
                if (to === undefined) continue;
                m.tierDowngrades++;
                if (this.downgrades.length < 50) this.downgrades.push({ from, to });
            }
        }
    }

    /** S-tier guns seen within 20 units outside a fight, and whether they are held within 15 s. */
    private sTier(): void {
        const { game } = this.ctx;
        const now = game.time;
        for (const { bot, p, m } of livingBots(this.ctx)) {
            const list = this.chance.get(p.id) ?? [];
            const holds = [WeaponSlot.Primary, WeaponSlot.Secondary].some((s) =>
                isSTier(p.weaponManager.weapons[s]?.type ?? ""),
            );
            // resolve open opportunities
            for (let i = list.length - 1; i >= 0; i--) {
                const o = list[i];
                const item = game.world.objects.get(o.lootId);
                const gone = !item || (item.kind === "loot" && item.destroyed);
                if (holds) {
                    m.sTierSeen++;
                    m.sTierTaken++;
                    list.splice(i, 1);
                } else if (gone) {
                    // someone else took it: not this bot's miss
                    list.splice(i, 1);
                } else if (now - o.since > S_TIER_WINDOW) {
                    m.sTierSeen++;
                    list.splice(i, 1);
                }
            }
            if (!holds && !p.downed && !FIGHTING.has(bot.bot.intent.behaviour)) {
                const model = bot.bot.model;
                for (const l of model.loot.values()) {
                    if (l.lastSeen !== model.time || !isSTier(l.type) || !sameLayer(p.layer, l.layer)) continue;
                    if (v2.distance(p.pos, l.pos) > S_TIER_RANGE || list.some((o) => o.lootId === l.id)) continue;
                    if (this.seen(p.id, l.id)) continue;
                    list.push({ lootId: l.id, since: now });
                }
            }
            this.chance.set(p.id, list);
        }
    }

    private readonly counted = new Map<number, Set<number>>();
    /** Each loot item is one opportunity per bot. */
    private seen(botId: number, lootId: number): boolean {
        let s = this.counted.get(botId);
        if (!s) this.counted.set(botId, (s = new Set()));
        if (s.has(lootId)) return true;
        s.add(lootId);
        return false;
    }

    /** Travel holstering and the gun in hand during fights (every 0.5 s). */
    private slow(): void {
        const { game } = this.ctx;
        const dt = SAMPLE.slow / 100;
        for (const { bot, p, m } of livingBots(this.ctx)) {
            if (p.downed) continue;
            const it = bot.bot.intent;
            const model = bot.bot.model;
            const guns = usableGuns(p);
            const enemyInView = model.enemies().some((c) => c.visible && !c.downed);
            const hurt = model.time - model.lastHurt < HURT_RECENT;
            if (guns.length && TRAVEL.has(it.behaviour) && !enemyInView && !hurt) {
                m.travelSamples++;
                if (p.weaponManager.curWeapIdx === WeaponSlot.Melee) m.travelHolstered++;
            }
            if (it.behaviour !== "fight") continue;
            m.fightSeconds += dt;
            const t = it.targetId ? game.getPlayer(it.targetId) : undefined;
            const cur = guns.find((g) => g.slot === p.weaponManager.curWeapIdx);
            if (!t || t.dead || !cur) continue;
            const d = v2.distance(p.pos, t.pos);
            const other = guns.find((g) => g.slot !== cur.slot);
            m.fightGunSamples++;
            if (cur.info.cls === "pistol") {
                m.fightPistol++;
                if (other && other.info.cls !== "pistol" && suitability(other.info, d) > suitability(cur.info, d)) {
                    m.wrongSlotPistol++;
                }
            }
            if (other && other.id !== cur.id) {
                m.twoGunSamples++;
                if (suitability(cur.info, d) >= suitability(other.info, d) - 0.05) m.rightGun++;
            }
        }
    }
}
