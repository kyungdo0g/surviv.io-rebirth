// Air drop memory for every brain (bot overhaul LOOT-7a): the drops the bot's snapshots told it about, kept apart from
// the threat board so a bot without BrainFeatures.threats knows about drops too (the threat board also turns on fight
// avoidance: airdrop fix concern 0). Only what a client sees: the "ping_airdrop" minimap marker (sent to every player
// when a crate is released, mapLife 10 s: sim match/planes.ts; this memory keeps it), falling crates in view
// (Snapshot.airdrops with their fall progress), the landed airdrop_crate_* obstacle in view and whether it can still be
// opened, and the inner crate an opened drop leaves (crate_10..13, tier_airdrop_* loot). WorldModel.observe feeds every
// snapshot to `ingest`. Pure perception: no rng, so no brain decides differently until a behaviour reads it.
import { type Vec2, v2 } from "@rebirth/core";
import { GameConfig } from "@rebirth/defs";
import type { Snapshot } from "@rebirth/sim";
import { colliderCenter } from "../geom.ts";
import type { WorldModel } from "./world.ts";

/** Seconds from release to landing (GameConfig.airdrop.fallTime). */
const FALL_TIME = GameConfig.airdrop.fallTime;
/** Sightings within this distance of a known drop are the same drop. */
const SAME_DROP = 4;
/** A drop not seen for this long is forgotten (the threat board's AIRDROP_MEMORY). */
const FORGET = 180;
/** Obstacles are matched to the known drops every this many snapshots. */
const SCAN_EVERY = 3;

/** One known air drop. */
export interface KnownAirdrop {
    /** where it lands or landed */
    pos: Vec2;
    /**
     * "marked": the map marker only; "falling": the crate is in the air; "landed": standing, closed; "opened": opened
     * (its inner crate, if still standing, is `innerId`)
     */
    stage: "marked" | "falling" | "landed" | "opened";
    /** game time it was first known */
    since: number;
    /** game time of the latest sighting of the marker, the crate or the obstacle */
    lastSeen: number;
    /** the landed crate's obstacle id (0 before it landed or was seen) */
    obstacleId: number;
    /** estimated game time of the landing */
    landsAt: number;
    /** the inner crate's obstacle id while it stands (0 none seen) */
    innerId: number;
}

export class AirdropMemory {
    private readonly drops: KnownAirdrop[] = [];

    /** Takes in one snapshot (called by WorldModel.observe after the objects were updated). */
    ingest(snap: Snapshot, model: WorldModel): void {
        const now = model.time;
        for (const ind of snap.mapIndicators ?? []) {
            if (ind.type !== "ping_airdrop" || ind.dead) continue;
            const d = this.find(ind.pos);
            if (d) d.lastSeen = Math.max(d.lastSeen, now);
            else this.add(ind.pos, "marked", now, now + FALL_TIME);
        }
        for (const a of snap.airdrops ?? []) {
            const landsAt = now + (1 - a.fallT) * FALL_TIME;
            const d = this.find(a.pos) ?? this.add(a.pos, "falling", now, landsAt);
            d.lastSeen = now;
            d.landsAt = landsAt;
            if (d.stage === "marked") d.stage = "falling";
            if (a.landed && d.stage === "falling") d.stage = "landed";
        }
        if (this.drops.length === 0) return;
        for (const d of this.drops)
            if ((d.stage === "marked" || d.stage === "falling") && now >= d.landsAt) d.stage = "landed";
        if (model.snapshots % SCAN_EVERY === 0) this.scan(model, now);
        for (let i = this.drops.length - 1; i >= 0; i--) {
            const d = this.drops[i];
            if (now - d.lastSeen > FORGET) this.drops.splice(i, 1);
        }
    }

    /** Matches the obstacles in view to the known drops: the crate itself, opened or not, and the inner crate. */
    private scan(model: WorldModel, now: number): void {
        for (const d of this.drops) {
            let innerSeen = false;
            for (const o of model.obstacles) {
                if (Math.abs(o.view.pos.x - d.pos.x) > SAME_DROP || Math.abs(o.view.pos.y - d.pos.y) > SAME_DROP)
                    continue;
                if (o.def.airdropCrate) {
                    d.obstacleId = o.view.id;
                    d.lastSeen = now;
                    if (d.stage !== "opened") d.stage = o.view.dead || !o.view.button?.canUse ? "opened" : "landed";
                } else if (!o.view.dead && o.def.loot.some((l) => (l.tier ?? "").startsWith("tier_airdrop"))) {
                    d.innerId = o.view.id;
                    d.stage = "opened";
                    d.lastSeen = now;
                    innerSeen = true;
                }
            }
            // the inner crate's spot in plain view and no inner crate there: broken (or never seen)
            if (!innerSeen && d.innerId !== 0 && inView(model, d.pos)) d.innerId = 0;
            // a crate's spot in plain view after landing with no crate at all: it was opened and its inner crate broken
            if (d.stage === "landed" && now > d.landsAt + 1 && inView(model, d.pos) && !this.crateAt(model, d)) {
                d.stage = "opened";
            }
        }
    }

    private crateAt(model: WorldModel, d: KnownAirdrop): boolean {
        return model.obstacles.some(
            (o) => !o.view.dead && o.def.airdropCrate && v2.distance(colliderCenter(o.col), d.pos) < SAME_DROP,
        );
    }

    private find(pos: Vec2): KnownAirdrop | undefined {
        return this.drops.find((d) => v2.distance(d.pos, pos) < SAME_DROP);
    }

    private add(pos: Vec2, stage: KnownAirdrop["stage"], now: number, landsAt: number): KnownAirdrop {
        const d: KnownAirdrop = {
            pos: v2.copy(pos),
            stage,
            since: now,
            lastSeen: now,
            obstacleId: 0,
            landsAt,
            innerId: 0,
        };
        this.drops.push(d);
        return d;
    }

    /** Drops known now, oldest first. */
    known(): readonly KnownAirdrop[] {
        return this.drops;
    }

    /** Drops still worth going for: not opened yet, or opened with the inner crate standing. */
    open(): KnownAirdrop[] {
        return this.drops.filter((d) => d.stage !== "opened" || d.innerId !== 0);
    }
}

/** Whether `p` is well inside the bot's snapshot view (an obstacle there would be in the snapshot). */
function inView(model: WorldModel, p: Vec2): boolean {
    const v = model.view;
    return p.x > v.min.x + 6 && p.x < v.max.x - 6 && p.y > v.min.y + 6 && p.y < v.max.y - 6;
}
