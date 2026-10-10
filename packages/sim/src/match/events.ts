// Match events shared by the simulation and the network decoder: the damage source of a kill (kill feed wording)
// and a small event log that hands each viewer the events it has not seen yet.
import { DamageType, GameObjectDefs, hasDef, hasMapObjectDef } from "@rebirth/defs";
import type { DamageSource } from "../view.ts";

/**
 * How a player died, from the Kill message fields (survev client ui2.ts kill feed): the damage type, then the
 * weapon's def type for player damage (guns, melee; throwables and exploding map objects are explosions).
 */
export function damageSourceOf(damageType: number, itemSourceType: string, mapSourceType: string): DamageSource {
    switch (damageType) {
        case DamageType.Gas:
            return "gas";
        case DamageType.Bleeding:
            return "bleed";
        case DamageType.Airdrop:
            return "airdrop";
        case DamageType.Airstrike:
            return "airstrike";
        case DamageType.Collapse:
            return "collapse";
    }
    if (itemSourceType && hasDef(itemSourceType)) {
        const type = GameObjectDefs[itemSourceType].type;
        if (type === "gun") return "gun";
        if (type === "melee") return "melee";
        if (type === "throwable" || type === "explosion") return "explosion";
    }
    if (mapSourceType && hasMapObjectDef(mapSourceType)) return "explosion";
    return "other";
}

interface Entry<T> {
    seq: number;
    tick: number;
    value: T;
}

/**
 * Append-only event log with sequence numbers. Each viewer remembers the last sequence number it saw (taken from
 * the shared counter), so events reach every viewer exactly once whatever the snapshot cadence; entries older than
 * the retention window are dropped (a viewer that did not take a snapshot for that long misses them).
 */
export class EventLog<T> {
    private readonly entries: Array<Entry<T>> = [];

    push(seq: number, tick: number, value: T): void {
        this.entries.push({ seq, tick, value });
    }

    /** Values logged after `seq`, oldest first. */
    since(seq: number): T[] {
        const out: T[] = [];
        for (let i = this.entries.length - 1; i >= 0 && this.entries[i].seq > seq; i--) out.push(this.entries[i].value);
        return out.reverse();
    }

    /** Drops entries logged before `minTick`. */
    prune(minTick: number): void {
        let n = 0;
        while (n < this.entries.length && this.entries[n].tick < minTick) n++;
        if (n > 0) this.entries.splice(0, n);
    }

    get size(): number {
        return this.entries.length;
    }
}
