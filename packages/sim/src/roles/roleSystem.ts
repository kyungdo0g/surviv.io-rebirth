// Role scheduling and the rules that hand roles out (M7a): the 50v50 promotion schedule (one random eligible,
// non-AFK player per team), Lone Survivr when a team is down to its last standing players, the optional Commander
// succession, The Hunted (Savannah's kill leader), the Woods King's kill pings, Cobalt classes, the fork's automatic
// Commander flare, and the minimap indicators of roles and indicator loot.
// Behaviour follows survev server/src/game/objects/player.ts (PlayerBarn.update scheduled roles, scheduleRoleAssignments,
// promoteToKillLeader, kill), group.ts (Team.checkAndApplyLastMan / checkAndApplyCaptain) and
// docs/research/items/roles.md "50v50 promotion rules" / "Map roles" / "Cobalt classes".
import { getDefOfType, getMapDef, hasDef, type MapDef } from "@rebirth/defs";
import type { LootSystem } from "../loot/loot.ts";
import { type FactionSystem, living } from "../match/faction.ts";
import type { TrackedIndicator } from "../match/indicators.ts";
import type { SimContext } from "../world/context.ts";
import type { Player } from "../world/player.ts";
import { type PromoteOptions, promoteToRole, removeRole } from "./roles.ts";

/** What the role system needs from the game. */
export interface RoleHost extends SimContext {
    readonly loot: LootSystem;
    players(): Iterable<Player>;
    canJoin(): boolean;
    /** a Cobalt class was assigned: the player leaves the class menu / waiting room (M7b, modes/classSelect.ts) */
    onClassChosen?(player: Player): void;
}

interface ScheduledRole {
    role: string;
    ticks: number;
}

const TICK_HZ = 100;

export class RoleSystem {
    private readonly host: RoleHost;
    private readonly map: MapDef;
    /** the faction teams (50v50 only) */
    faction: FactionSystem | null = null;
    private readonly scheduled: ScheduledRole[] = [];
    private readonly succeeded = new Set<number>();

    constructor(host: RoleHost) {
        this.host = host;
        this.map = getMapDef(host.options.mapName);
    }

    private get rules() {
        return this.host.rules.roles;
    }

    /**
     * A new gas circle: the 50v50 roles of this circle are scheduled (survev scheduleRoleAssignments). A slot with
     * several roles rolls one, given to both teams.
     */
    onCircle(circleIdx: number): void {
        if (!this.faction) return;
        const schedule = this.rules.factionSchedule;
        if (schedule === "map") {
            for (const t of this.map.gameConfig.roles?.timings ?? []) {
                if (t.circleIdx === circleIdx)
                    this.scheduled.push({ role: t.role, ticks: Math.round(t.wait * TICK_HZ) });
            }
            return;
        }
        for (const slot of schedule) {
            if (slot.circleIdx !== circleIdx || slot.roles.length === 0) continue;
            const role = slot.roles.length === 1 ? slot.roles[0] : this.host.roleRng.pick(slot.roles);
            this.scheduled.push({ role, ticks: Math.round(slot.wait * TICK_HZ) });
        }
    }

    /** Per tick: due promotions, Cobalt's class timeout, the automatic flare, the indicators. */
    update(dt: number): void {
        for (let i = 0; i < this.scheduled.length; i++) {
            const s = this.scheduled[i];
            if (--s.ticks > 0) continue;
            this.scheduled.splice(i--, 1);
            for (const team of this.faction?.teams ?? []) {
                const pick = this.pickPromotable(living(team));
                if (pick) this.promote(pick, s.role);
            }
        }
        const gameMode = this.map.gameMode;
        for (const p of this.host.players()) {
            if (p.dead) continue;
            // Cobalt: a player who did not choose gets a random class (conflicts.md cobalt-role-timeout: 20 s)
            if (gameMode.perkMode && !p.role && p.timeAlive >= this.rules.perkModeRoleSelectTime - 1e-9) {
                const classes = gameMode.perkModeRoles ?? [];
                if (classes.length > 0) {
                    this.promote(p, this.host.roleRng.pick(classes));
                    this.host.onClassChosen?.(p);
                }
            }
            if (p.role === "leader" && this.rules.leaderAutoFlare && !p.firedFlare) this.autoFlare(p, dt);
        }
        this.host.planes.mapIndicators.sync(this.trackedIndicators());
    }

    /**
     * The player a scheduled role goes to (survev): a random living, connected, standing player without a role, AFK
     * players (alive over 5 s and still more than half of the time, or still for the last 5 s) skipped while anybody
     * else is eligible.
     */
    pickPromotable(candidates: readonly Player[]): Player | undefined {
        const eligible = candidates.filter((p) => !p.dead && !p.disconnected && !p.downed && !p.role);
        if (eligible.length === 0) return undefined;
        const r = this.rules;
        const active = eligible.filter((p) => {
            const total = p.movingTime + p.stillTime;
            if (total > r.afkMinTime && p.stillTime / total > r.afkStillFraction) return false;
            return p.timeWithoutMoving <= r.afkStillTime;
        });
        const pool = r.promotionSkipAfk && active.length > 0 ? active : eligible;
        return this.host.roleRng.pick([...pool].sort((a, b) => a.id - b.id));
    }

    /** Promotes `player` (announced); a team's first Commander is remembered for the game over (survev Team.leader). */
    promote(player: Player, role: string, opts: PromoteOptions = {}): void {
        promoteToRole(this.host, player, role, opts);
        if (role === "leader" && this.faction) {
            const team = this.faction.team(player.teamId);
            if (team && !team.leader) team.leader = player;
        }
    }

    remove(player: Player): void {
        removeRole(this.host, player);
    }

    /** Cobalt: a class chosen in the class menu (survev roleSelect: only the map's perkModeRoles, once). */
    selectClass(player: Player, role: string): boolean {
        const mode = this.map.gameMode;
        if (!mode.perkMode || player.role || player.dead || !(mode.perkModeRoles ?? []).includes(role)) return false;
        this.promote(player, role);
        this.host.onClassChosen?.(player);
        return true;
    }

    /** The fork's automatic Commander flare (conflicts.md role-leader-auto-flare, off by default). */
    private autoFlare(player: Player, dt: number): void {
        player.flareTimer -= dt;
        if (player.flareTimer > 0) return;
        player.firedFlare = true;
        const flare = player.weaponManager.weapons.find((w) => w.type === "flare_gun" && w.ammo > 0);
        if (!flare) return;
        flare.ammo--;
        this.host.planes.addAirdrop(this.host.world.clampToMap(player.pos, 0));
    }

    /** A faction player was knocked down: Lone Survivr may apply (survev down -> checkAndApplyLastMan). */
    onPlayerDowned(victim: Player): void {
        this.checkLastMan(victim.teamId);
    }

    /**
     * A player died, after the kill events (survev kill): the Woods King's kill ping, The Hunted loses its role,
     * faction teams check Lone Survivr and the Commander succession, and the comeback drop.
     */
    onPlayerKilled(victim: Player, credit: Player | undefined): void {
        if (credit && credit !== victim && credit.teamId !== victim.teamId && credit.role === "woods_king") {
            this.host.planes.addPing("ping_woodsking", victim.pos);
        }
        if (victim.role === "the_hunted") removeRole(this.host, victim);
        if (!this.faction) return;
        this.checkLastMan(victim.teamId);
        this.checkSuccession(victim.teamId);
        this.faction.checkHelpLosingTeam();
    }

    /** A player left the game: a faction team may have lost its Commander. */
    onPlayerRemoved(player: Player): void {
        if (this.faction) this.checkSuccession(player.teamId, player);
    }

    /**
     * Lone Survivr (survev checkAndApplyLastMan): once per team, when at most `lastManCount` of its living players are
     * standing and connected and the game no longer accepts joins, they become Lone Survivrs.
     */
    checkLastMan(teamId: number): void {
        const team = this.faction?.team(teamId);
        if (!team || team.lastManApplied) return;
        const standing = living(team).filter((p) => !p.downed && !p.disconnected);
        if (standing.length > this.rules.lastManCount || this.host.canJoin()) return;
        for (const p of standing.slice(0, this.rules.lastManCount))
            if (p.role !== "last_man") this.promote(p, "last_man");
        team.lastManApplied = true;
    }

    /** rules.roles.commanderSuccession: the first standing Lieutenant takes over a team left without a Commander. */
    private checkSuccession(teamId: number, leaving?: Player): void {
        const team = this.faction?.team(teamId);
        if (!team || !this.rules.commanderSuccession || this.succeeded.has(teamId)) return;
        const alive = living(team).filter((p) => p !== leaving && !p.disconnected);
        if (alive.some((p) => p.role === "leader")) return;
        const lt = alive.find((p) => p.role === "lieutenant" && !p.downed);
        if (!lt) return;
        this.succeeded.add(teamId);
        this.promote(lt, "leader", { keepWeapons: true });
    }

    /**
     * A new kill leader (survev promoteToKillLeader): on Savannah (`sniperMode`) it becomes The Hunted, and a previous
     * Hunted loses the role.
     */
    onKillLeader(leader: Player, previous: Player | undefined): void {
        if (!this.map.gameMode.sniperMode) return;
        if (previous && previous.role === "the_hunted") removeRole(this.host, previous);
        this.promote(leader, "the_hunted");
    }

    /** Tracked minimap indicators: role holders whose def has a `mapIndicator` and indicator loot on the ground. */
    trackedIndicators(): TrackedIndicator[] {
        const out: TrackedIndicator[] = [];
        for (const p of this.host.players()) {
            if (p.dead || !p.role || !hasDef(p.role)) continue;
            if (!getDefOfType("role", p.role).mapIndicator) continue;
            out.push({ key: `player:${p.id}`, type: p.role, pos: p.pos, equipped: true });
        }
        for (const loot of this.host.loot.indicatorItems) {
            out.push({ key: `loot:${loot.id}`, type: loot.type, pos: loot.pos, equipped: false });
        }
        return out;
    }
}
