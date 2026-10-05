// Minimap indicators (the original MapIndicators section, 16 ids): timed map pings (air drops, air strikes, unlocks,
// the Woods King's kill pings) and, since M7a, tracked indicators that follow an object for as long as it exists:
// The Hunted (role def `mapIndicator`, equipped) and loot with a def `mapIndicator` lying on the ground (the unclaimed
// Woods King helmet). Behaviour follows survev server/src/game/objects/mapIndicator.ts (MapIndicatorBarn) and
// objects/loot.ts / player.ts promoteToRole (allocIndicator).
import { type Vec2, v2 } from "@rebirth/core";
import { TICK_HZ } from "../api.ts";
import type { MapIndicatorView } from "../view.ts";
import { EventLog } from "./events.ts";

/** Indicator ids 0..15 (net.ts MaxMapIndicators 16). */
const MAX_INDICATORS = 16;
/** A dead indicator's id is reused once its death report expired (one snapshot never holds an id twice). */
const INDICATOR_RETENTION_TICKS = 10 * TICK_HZ;
/** Tracked indicators move when their object moved more than this (survev updatePosition). */
const MOVE_EPS = 0.1;

export interface MapIndicator {
    id: number;
    type: string;
    pos: Vec2;
    equipped: boolean;
    dead: boolean;
    /** tick at which a timed indicator expires; Infinity for tracked ones */
    expiresTick: number;
    /** key of the tracked object ("" for timed pings) */
    key: string;
}

/** An object a tracked indicator follows this tick. */
export interface TrackedIndicator {
    /** stable identity, e.g. "player:12" or "loot:345" */
    key: string;
    type: string;
    pos: Vec2;
    equipped: boolean;
}

export class MapIndicatorSystem {
    readonly indicators: MapIndicator[] = [];
    /** indicators that died, reported once to every viewer */
    readonly deadIndicators = new EventLog<MapIndicator>();
    private readonly host: { readonly tick: number; nextEventSeq(): number };
    private readonly freeIds: number[] = [];
    private readonly retired: Array<{ id: number; tick: number }> = [];

    constructor(host: { readonly tick: number; nextEventSeq(): number }) {
        this.host = host;
        for (let i = 0; i < MAX_INDICATORS; i++) this.freeIds.push(i);
    }

    /** A timed map marker (ping defs: their `mapLife`). */
    add(type: string, pos: Vec2, lifeSeconds: number): void {
        this.alloc(type, pos, false, this.host.tick + Math.round(lifeSeconds * TICK_HZ), "");
    }

    private alloc(type: string, pos: Vec2, equipped: boolean, expiresTick: number, key: string): void {
        const id = this.freeIds.shift();
        if (id === undefined) return;
        this.indicators.push({ id, type, pos: v2.copy(pos), equipped, dead: false, expiresTick, key });
    }

    /**
     * Tracked indicators of this tick: new objects get an indicator, followed ones move with them, and indicators of
     * objects no longer listed die.
     */
    sync(tracked: readonly TrackedIndicator[]): void {
        const byKey = new Map<string, TrackedIndicator>();
        for (const t of tracked) byKey.set(t.key, t);
        for (let i = 0; i < this.indicators.length; i++) {
            const ind = this.indicators[i];
            if (!ind.key) continue;
            const t = byKey.get(ind.key);
            if (!t || t.type !== ind.type) {
                this.retire(i--);
                continue;
            }
            byKey.delete(ind.key);
            if (v2.distance(ind.pos, t.pos) > MOVE_EPS) ind.pos = v2.copy(t.pos);
            ind.equipped = t.equipped;
        }
        for (const t of byKey.values()) this.alloc(t.type, t.pos, t.equipped, Number.POSITIVE_INFINITY, t.key);
    }

    private retire(i: number): void {
        const ind = this.indicators[i];
        const tick = this.host.tick;
        this.indicators.splice(i, 1);
        ind.dead = true;
        this.deadIndicators.push(this.host.nextEventSeq(), tick, ind);
        this.retired.push({ id: ind.id, tick });
    }

    /** Timed indicators expire; retired ids come back once their death report is gone. */
    update(): void {
        const tick = this.host.tick;
        for (let i = 0; i < this.indicators.length; i++) {
            if (tick >= this.indicators[i].expiresTick) this.retire(i--);
        }
        const minTick = tick - INDICATOR_RETENTION_TICKS;
        this.deadIndicators.prune(minTick);
        while (this.retired.length > 0 && this.retired[0].tick < minTick) {
            this.freeIds.push(this.retired.shift()!.id);
        }
    }

    /** Live indicators plus those that died after event `seq` (dead), sorted by id. */
    views(seq: number): MapIndicatorView[] {
        const out: MapIndicatorView[] = [];
        const view = (i: MapIndicator): MapIndicatorView => ({
            id: i.id,
            type: i.type,
            pos: v2.copy(i.pos),
            dead: i.dead,
            equipped: i.equipped,
        });
        for (const i of this.deadIndicators.since(seq)) out.push(view(i));
        for (const i of this.indicators) out.push(view(i));
        return out.sort((a, b) => a.id - b.id);
    }
}
