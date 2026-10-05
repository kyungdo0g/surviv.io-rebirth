// Random generators for the M6a sections (team HUD rows, emotes and pings) used by the round-trip property tests.
import type { Rng } from "@rebirth/core";
import type { EmoteEvent, FactionMemberView, TeamMemberView } from "@rebirth/sim";
import type { NetCtx } from "../src/index.ts";
import { randGameType, randPos, randString } from "./gen.ts";

/** A group of 1-4 members with names known to the decoder (`names` receives them as PlayerInfos would). */
export function randTeam(rng: Rng, ctx: NetCtx, ids: readonly number[], names: Map<number, string>): TeamMemberView[] {
    return ids.map((playerId) => {
        let name = names.get(playerId);
        if (name === undefined) {
            name = randString(rng, 16);
            names.set(playerId, name);
        }
        const dead = rng.bool(0.2);
        return {
            playerId,
            name,
            health: dead ? 0 : rng.range(0, 100),
            downed: !dead && rng.bool(0.3),
            dead,
            disconnected: rng.bool(0.1),
            pos: randPos(rng, ctx),
            role: rng.bool(0.7) ? "" : randGameType(rng),
        };
    });
}

/** A faction of 1-60 members for the 50v50 minimap (M7a). */
export function randFaction(rng: Rng, ctx: NetCtx, ids: readonly number[]): FactionMemberView[] {
    return ids.map((playerId) => {
        const dead = rng.bool(0.2);
        return {
            playerId,
            pos: randPos(rng, ctx),
            dead,
            downed: !dead && rng.bool(0.2),
            role: rng.bool(0.8) ? "" : randGameType(rng),
        };
    });
}

/** Some faction members moved, died or changed role. */
export function mutateFaction(rng: Rng, ctx: NetCtx, rows: readonly FactionMemberView[]): FactionMemberView[] {
    return rows.map((m) => {
        if (rng.bool(0.6)) return m;
        const next = { ...m, pos: rng.bool(0.7) ? randPos(rng, ctx) : { ...m.pos } };
        if (rng.bool(0.1)) next.dead = !next.dead;
        if (rng.bool(0.1)) next.role = rng.bool(0.5) ? "" : randGameType(rng);
        return next;
    });
}

/** Some members changed (health only, position only, or everything). */
export function mutateTeam(rng: Rng, ctx: NetCtx, team: readonly TeamMemberView[]): TeamMemberView[] {
    return team.map((m) => {
        if (rng.bool(0.5)) return m;
        const next = { ...m, pos: { ...m.pos } };
        if (rng.bool(0.5)) next.health = rng.range(0, 100);
        if (rng.bool(0.5)) next.pos = randPos(rng, ctx);
        if (rng.bool(0.2)) next.downed = !next.downed;
        if (rng.bool(0.1)) next.disconnected = !next.disconnected;
        return next;
    });
}

export function randEmotes(rng: Rng, ctx: NetCtx): EmoteEvent[] {
    if (rng.bool(0.6)) return [];
    return Array.from({ length: rng.int(1, 5) }, () => {
        const isPing = rng.bool(0.4);
        const e: EmoteEvent = {
            playerId: rng.int(1, 65535),
            type: randGameType(rng),
            itemType: rng.bool(0.8) ? "" : randGameType(rng),
            isPing,
        };
        if (isPing) e.pos = randPos(rng, ctx);
        return e;
    });
}
