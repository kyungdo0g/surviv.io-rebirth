// Spectating: a dead player asks to spectate (Begin), cycles through the living players (Next / Prev, with a
// cooldown) and is moved to another target 2 s after the watched player died. The default target is the alive
// end of the killer chain (whoever killed my killer, ...), then the first living player.
// Behaviour follows survev server/src/game/client.ts (update, getSpectablePlayers, getNewPlayerToSpectate,
// handleSpectateMsg) and objects/player.ts getAliveKiller; docs/research/ui/hud.md "Spectate". Team modes (M6a):
// while a member of the viewer's group is alive and connected the viewer only cycles through its living teammates
// (0.1 s cooldown), and a viewer watching its own eliminated group stays on it (the "team eliminated" screen).
import type { Player } from "../world/player.ts";

export type SpectateAction = "begin" | "next" | "prev";

interface SpectateState {
    targetId: number;
    /** seconds until next/prev is accepted again */
    cooldown: number;
    /** seconds the current target has been dead */
    deadTimer: number;
    pending: "next" | "prev" | null;
}

/** What spectating needs from the game. */
export interface SpectateHost {
    readonly rules: { spectateSwitchDelay: number; spectateCooldown: number };
    readonly over: boolean;
    players(): Iterable<Player>;
    getPlayer(id: number): Player | undefined;
}

/** Longest killer chain followed (survev getAliveKiller: 80). */
const MAX_KILLER_CHAIN = 80;
/** next/prev cooldown while spectating teammates (survev getSpectateCooldown) */
const TEAM_SPECTATE_COOLDOWN = 0.1;

/** The viewer's group still has a living, connected member: it spectates its team (survev shouldSpectateTeam). */
function spectatesTeam(viewer: Player): boolean {
    const group = viewer.group;
    return !!group && group.players.length > 1 && !group.allDeadOrDisconnected;
}

export class SpectateSystem {
    private readonly host: SpectateHost;
    private readonly states = new Map<number, SpectateState>();

    constructor(host: SpectateHost) {
        this.host = host;
    }

    /** Id of the player `viewerId` spectates, 0 when it does not spectate. */
    targetOf(viewerId: number): number {
        return this.states.get(viewerId)?.targetId ?? 0;
    }

    /** Handles a spectate request; living players cannot spectate (survev handleSpectateMsg). */
    request(viewer: Player, action: SpectateAction): void {
        if (!viewer.dead) return;
        let state = this.states.get(viewer.id);
        if (action === "begin") {
            const current = state ? this.host.getPlayer(state.targetId) : undefined;
            if (current && !current.dead) return;
            const target = this.newTarget(viewer, current);
            if (!target) return;
            if (!state) {
                state = { targetId: 0, cooldown: 0, deadTimer: 0, pending: null };
                this.states.set(viewer.id, state);
            }
            state.targetId = target.id;
            state.deadTimer = 0;
            return;
        }
        if (state) state.pending = action;
    }

    /** Stops spectating (the viewer left or respawned). */
    remove(viewerId: number): void {
        this.states.delete(viewerId);
    }

    /** Per tick: automatic switch away from dead or removed targets, next/prev, spectator counts. */
    update(dt: number): void {
        for (const [viewerId, state] of this.states) {
            const viewer = this.host.getPlayer(viewerId);
            if (!viewer?.dead) {
                this.states.delete(viewerId);
                continue;
            }
            let target = this.host.getPlayer(state.targetId);
            let next: Player | undefined;
            const group = viewer.group;
            const ownGroupOut = !!group && target?.group === group && group.allDeadOrDisconnected;
            if (!target) {
                next = this.newTarget(viewer, undefined);
            } else if (target.dead && !this.host.over && !ownGroupOut) {
                state.deadTimer += dt;
                if (state.deadTimer > this.host.rules.spectateSwitchDelay) {
                    next = this.newTarget(viewer, target);
                    state.deadTimer = 0;
                }
            } else {
                state.deadTimer = 0;
            }
            state.cooldown -= dt;
            if (state.cooldown <= 0 && state.pending) {
                const list = this.spectatable(viewer, target);
                if (list.length > 0) {
                    const step = state.pending === "next" ? 1 : -1;
                    const idx = target ? list.indexOf(target) : -1;
                    next = list[(((idx + step) % list.length) + list.length) % list.length];
                }
                state.cooldown = spectatesTeam(viewer) ? TEAM_SPECTATE_COOLDOWN : this.host.rules.spectateCooldown;
                state.pending = null;
            }
            if (next) {
                state.targetId = next.id;
                target = next;
            }
            if (!target) this.states.delete(viewerId);
        }
        for (const p of this.host.players()) p.spectatorCount = 0;
        for (const state of this.states.values()) {
            const target = this.host.getPlayer(state.targetId);
            if (target) target.spectatorCount++;
        }
    }

    /**
     * Living players in id order (team modes: the viewer's living teammates while its group plays on), plus the current
     * target even when dead (keeps next/prev indices stable).
     */
    private spectatable(viewer: Player, current: Player | undefined): Player[] {
        const out: Player[] = [];
        const pool = spectatesTeam(viewer) && viewer.group ? viewer.group.players : this.host.players();
        for (const p of pool) if (!p.dead || p === current) out.push(p);
        return out.sort((a, b) => a.id - b.id);
    }

    /**
     * The first living teammate while the viewer's group plays on; else the alive end of the killer chain of the
     * current target (or the viewer), else the first living player (survev getNewPlayerToSpectate).
     */
    private newTarget(viewer: Player, current: Player | undefined): Player | undefined {
        const killer = spectatesTeam(viewer) ? undefined : this.aliveKiller(current ?? viewer);
        if (killer) return killer;
        return this.spectatable(viewer, undefined).find((p) => p !== viewer);
    }

    private aliveKiller(player: Player): Player | undefined {
        const seen = new Set<Player>();
        let killer = player.killedBy ? this.host.getPlayer(player.killedBy) : undefined;
        for (let i = 0; i < MAX_KILLER_CHAIN && killer; i++) {
            if (killer === player || seen.has(killer)) return undefined;
            if (!killer.dead) return killer;
            seen.add(killer);
            killer = killer.killedBy ? this.host.getPlayer(killer.killedBy) : undefined;
        }
        return undefined;
    }
}
