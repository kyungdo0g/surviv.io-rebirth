// 50v50 Faction mode (M7a): the Red (1) and Blue (2) teams above the squads, team assignment (a joiner goes to the
// team with fewer living players, a party's later members follow its first), spawn bands on the team's side of the
// river, living counts per team (the original AliveCounts), the faction minimap rows (the original faction
// PlayerStatus, every 0.5 s) with the enemies revealed by firing, the scheduled gold military drop and survev's
// comeback drop.
// Behaviour follows survev server/src/game/game.ts (one team per faction), objects/player.ts getGroupAndTeam /
// getSmallestTeam, map.ts getSpawnPos (factionModeSplitOri, divideAabb), gameModeManager.ts updateAliveCounts and
// objects/plane.ts isOneTeamWinning / helpLosingTeam; docs/research/modes/faction.md.
import { type Bounds, type Vec2, v2 } from "@rebirth/core";
import { getMapDef } from "@rebirth/defs";
import type { FactionMemberView } from "../view.ts";
import type { Player } from "../world/player.ts";

/** Spawn bands: the map split in 10 slices across the river; Red spawns in slice 0, Blue in slice 9 (survev map.ts). */
const SPAWN_DIVISIONS = 10;

export interface FactionTeam {
    /** FactionTeam: Red 1, Blue 2 */
    readonly id: number;
    /** members in join order (dead and disconnected included) */
    readonly players: Player[];
    /** the team's first Commander, kept for game over messages even after it died (survev Team.leader) */
    leader: Player | null;
    /** Lone Survivr was handed out (once per team) */
    lastManApplied: boolean;
}

/** What the faction system needs from the game. */
export interface FactionHost {
    readonly options: { mapName: string };
    readonly mapData: { width: number; height: number; shoreInset: number };
    readonly gas: { readonly circleIdx: number; readonly timeScale?: number; isInGas(pos: Vec2): boolean };
    readonly rules: {
        roles: {
            factionStatusInterval: number;
            factionRevealTime: number;
            factionGoldDrop: { circleIdx: number; wait: number; crate: string } | null;
            helpLosingTeam: boolean;
            helpLosingTeamCrate: string;
            potatoGoldCrate: string;
        };
    };
    readonly planes: {
        scheduleCrate(crateType: string, wait: number): void;
        addAirdrop(target: Vec2, crateType?: string): void;
        readonly zones: {
            addZone(pos: Vec2, rad: number, planes: number, wait: number, interval: number): void;
            zonePos(rad: number): Vec2;
        };
    };
    readonly roleRng: { range(min: number, max: number): number };
}

/** survev helpLosingTeam: the comeback air strike (5 planes over a radius-50 zone, 1.5 s, 1 s apart). */
const HELP_STRIKE = { rad: 50, planes: 5, wait: 1.5, interval: 1 };
/** the comeback drop lands within 5 u of the chosen player (survev v2.randomUnit(5)) */
const HELP_DROP_OFFSET = 5;

export class FactionSystem {
    readonly teams: FactionTeam[];
    /** 0: the river runs left-right, Red below / Blue above; 1: top-bottom, Red left / Blue right (survev) */
    readonly splitOri: 0 | 1;
    /** the comeback drop was sent (once per match) */
    sentHelp = false;
    private readonly host: FactionHost;
    /** faction minimap rows per team, in id order, rebuilt at each refresh and on membership changes */
    private readonly rows = new Map<number, FactionMemberView[]>();
    /** per team, its members revealed by firing at the last refresh */
    private readonly revealed = new Map<number, FactionMemberView[]>();
    private statusTicker = Number.POSITIVE_INFINITY;

    constructor(host: FactionHost, factions: number, splitOri: 0 | 1) {
        this.host = host;
        this.splitOri = splitOri;
        this.teams = [];
        for (let id = 1; id <= Math.max(2, factions); id++) {
            this.teams.push({ id, players: [], leader: null, lastManApplied: false });
        }
    }

    team(id: number): FactionTeam | undefined {
        return this.teams.find((t) => t.id === id);
    }

    /** The team with the fewest living players; Red on a tie (survev getSmallestTeam). */
    smallestTeam(): FactionTeam {
        let best = this.teams[0];
        for (const t of this.teams) if (living(t).length < living(best).length) best = t;
        return best;
    }

    add(player: Player, teamId: number): void {
        this.team(teamId)?.players.push(player);
        this.statusTicker = Number.POSITIVE_INFINITY;
    }

    remove(player: Player): void {
        for (const t of this.teams) {
            const i = t.players.indexOf(player);
            if (i >= 0) t.players.splice(i, 1);
            if (t.leader === player) t.leader = null;
        }
        this.statusTicker = Number.POSITIVE_INFINITY;
    }

    /** Living players of each team, Red first (the original AliveCounts in 50v50). */
    aliveCounts(): number[] {
        return this.teams.map((t) => living(t).length);
    }

    /**
     * Spawn area of a team's first squad member: the outermost tenth of the team's half (conflicts.md
     * faction-spawn-band: survev's tenth over fandom's sixth), inside the shore inset.
     */
    spawnBand(teamId: number): Bounds {
        const { width, height, shoreInset } = this.host.mapData;
        const min = { x: shoreInset, y: shoreInset };
        const max = { x: width - shoreInset, y: height - shoreInset };
        const idx = (Math.max(1, Math.min(2, teamId)) - 1) * (SPAWN_DIVISIONS - 1);
        // the teams are split across the river: divide perpendicular to it (survev divideAabb along splitOri ^ 1)
        if ((this.splitOri ^ 1) === 0) {
            const w = (max.x - min.x) / SPAWN_DIVISIONS;
            return { min: { x: min.x + w * idx, y: min.y }, max: { x: min.x + w * (idx + 1), y: max.y } };
        }
        const h = (max.y - min.y) / SPAWN_DIVISIONS;
        return { min: { x: min.x, y: min.y + h * idx }, max: { x: max.x, y: min.y + h * (idx + 1) } };
    }

    /** A new gas circle: the scheduled gold military drop (conflicts.md faction-gold-drop). */
    onCircle(circleIdx: number): void {
        const gold = this.host.rules.roles.factionGoldDrop;
        // the wait stretches with the gas on a map grown by the player cap (Gas.timeScale)
        const wait = gold ? gold.wait * (this.host.gas.timeScale ?? 1) : 0;
        if (gold && gold.circleIdx === circleIdx) this.host.planes.scheduleCrate(this.goldCrate(gold.crate), wait);
    }

    /** A gold drop crate of this map: potato faction maps drop the potato variant (survev plane.ts:273-278). */
    private goldCrate(crate: string): string {
        return getMapDef(this.host.options.mapName).gameMode.potatoMode ? this.host.rules.roles.potatoGoldCrate : crate;
    }

    /**
     * A gun was fired: when a living, connected enemy has the shooter within its view radius, the shooter shows on the
     * enemy faction's minimap for rules.roles.factionRevealTime (survev weaponManager.ts:1013-1025 timeUntilHidden).
     */
    onShot(shooter: Player): void {
        const time = this.host.rules.roles.factionRevealTime;
        if (time <= 0) return;
        for (const t of this.teams) {
            if (t.id === shooter.teamId) continue;
            for (const p of t.players) {
                if (p.dead || p.disconnected || v2.distance(p.pos, shooter.pos) > p.zoom) continue;
                shooter.timeUntilHidden = time;
                return;
            }
        }
    }

    /** Per tick: reveal timers run down; the faction minimap rows refresh at the original faction PlayerStatus rate. */
    update(dt: number): void {
        for (const t of this.teams) {
            for (const p of t.players)
                if (p.timeUntilHidden > 0) p.timeUntilHidden = Math.max(0, p.timeUntilHidden - dt);
        }
        this.statusTicker += dt;
        if (this.statusTicker < this.host.rules.roles.factionStatusInterval - 1e-9) return;
        this.refreshRows();
    }

    private refreshRows(): void {
        this.statusTicker = 0;
        for (const t of this.teams) {
            const members = [...t.players].sort((a, b) => a.id - b.id);
            const row = (p: Player) => ({
                playerId: p.id,
                pos: v2.copy(p.pos),
                dead: p.dead,
                downed: p.downed,
                role: p.role,
            });
            this.rows.set(t.id, members.map(row));
            this.revealed.set(t.id, members.filter((p) => p.timeUntilHidden > 0).map(row));
        }
    }

    /**
     * The minimap rows of `player`'s faction, then the enemies revealed by firing at the last refresh (survev
     * getPlayerStatus: `visible` for the own team or timeUntilHidden > 0; hidden enemies carry no data), in id order
     * (copies).
     */
    statusView(player: Player): FactionMemberView[] {
        if (this.statusTicker === Number.POSITIVE_INFINITY) this.refreshRows();
        const out = [...(this.rows.get(player.teamId) ?? [])];
        for (const t of this.teams) if (t.id !== player.teamId) out.push(...(this.revealed.get(t.id) ?? []));
        return out.map((r) => ({ ...r, pos: { x: r.pos.x, y: r.pos.y } }));
    }

    /**
     * After a kill (survev kill -> isOneTeamWinning / helpLosingTeam, fork flag): once per match, outside circle 0, when
     * the connected living gap is at least 10 % of the connected living players or 5, a gold drop lands near the
     * losing team's player farthest from the winners' centre (out of the gas) and an air strike hits the densest group.
     */
    checkHelpLosingTeam(): void {
        // survev plane.ts:213 skips circle 0 only (circleIdx == 0)
        if (!this.host.rules.roles.helpLosingTeam || this.sentHelp || this.host.gas.circleIdx === 0) return;
        const counts = this.teams.map((t) => living(t).filter((p) => !p.disconnected).length);
        const max = Math.max(...counts);
        const min = Math.min(...counts);
        if (max + min === 0 || ((max - min) / (max + min) < 0.1 && max - min < 5)) return;
        const losing = this.teams[counts.indexOf(min)];
        const winning = this.teams[counts.indexOf(max)];
        const winners = living(winning).filter((p) => !p.disconnected);
        const center = { x: 0, y: 0 };
        for (const p of winners) {
            center.x += p.pos.x / Math.max(1, winners.length);
            center.y += p.pos.y / Math.max(1, winners.length);
        }
        const candidates = living(losing).filter((p) => !p.disconnected && !this.host.gas.isInGas(p.pos));
        if (candidates.length === 0) return;
        let far = candidates[0];
        for (const p of candidates) if (v2.distance(center, p.pos) > v2.distance(center, far.pos)) far = p;
        const a = this.host.roleRng.range(0, Math.PI * 2);
        const pos = v2.add(far.pos, { x: Math.cos(a) * HELP_DROP_OFFSET, y: Math.sin(a) * HELP_DROP_OFFSET });
        this.host.planes.addAirdrop(pos, this.goldCrate(this.host.rules.roles.helpLosingTeamCrate));
        this.sentHelp = true;
        const s = HELP_STRIKE;
        const zones = this.host.planes.zones;
        zones.addZone(zones.zonePos(s.rad), s.rad, s.planes, s.wait, s.interval);
    }
}

/** Living players of a team (downed included). */
export function living(team: FactionTeam): Player[] {
    return team.players.filter((p) => !p.dead);
}
