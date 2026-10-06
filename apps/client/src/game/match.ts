// Client side of the battle-royale loop: turns the M4 snapshot fields into HUD state, sounds and screens.
// - names of every player (playerInfos) for the kill feed, the kill leader and spectating;
// - the red zone (GasTracker): timer, the mode-change announcements and "Waiting for players";
// - kills and role events: kill feed lines, the active player's kill message, the local kill counter, the kill
//   leader box and its sounds (survev game.ts Kill / RoleAnnouncement handlers);
// - the GameOver result: the stats screen, victory music for a win (the original plays `menu_music` 1.3 s later,
//   docs/research/ui/hud.md CONFLICT victory-music), and spectating (Begin / Next / Prev, arrow keys).
// While spectating, snapshots follow the watched player (Snapshot.localPlayerId); the local id stays the one the
// client joined with.
// M6 teams: knock-outs show "<killer> knocked YOU out" to the downed player, the stats screen uses the team texts and
// one card per member, and a death while the team plays on (Snapshot.playerStats) shows the short "You died." screen.
// M7 (survev game.ts RoleAnnouncement / AliveCounts): faction maps show red / blue alive counts and white kill lines;
// every role is announced ("You've been promoted to Red Commander!" for the holder when the def announces it), with
// the role's assign / dead sound (Halloween kill leader voice lines; on perkMode maps a class's spawn sound only for its
// holder) and its kill feed line; the local player's role (`onLocalRole`) closes the Cobalt class menu.
// M8: "Anonymize player names" shows players outside the followed player's group as "Player<id>" in every name this
// class hands out (kill feed, kill messages, kill leader, spectating; survev player.ts getPlayerName / anonName); the
// local player's killer is kept for the death screen's Report button.
import { GameObjectDefs, getMapDef, type RoleDef } from "@rebirth/defs";
import type {
    KillEvent,
    MatchStats,
    PlayerInfoView,
    RoleAnnouncementEvent,
    Snapshot,
    SpectateActionName,
} from "@rebirth/sim";
import type { AudioEngine, SoundHandle } from "../audio/audio.ts";
import { config } from "../config.ts";
import { GasTracker } from "../fx/gas.ts";
import { GameOverScreen } from "../ui/gameOver.ts";
import {
    downedMessage,
    killFeedColor,
    killFeedText,
    killMessage,
    type PlayerNames,
    roleAnnouncement,
    roleFeed,
} from "../ui/killFeed.ts";
import { gasAnnouncement, type MapInfoLayout, MatchHud } from "../ui/matchHud.ts";

/** victory music of the original client (menu_music_01), started 1.3 s after the GameOver result */
const VICTORY_MUSIC = "menu_music";
const VICTORY_MUSIC_DELAY_MS = 1300;
/** the kill message fades out when the stats screen appears (survev ui.ts setBannerAd: delay - 150 ms) */
const KILL_MESSAGE_HIDE_LEAD = 0.15;

export interface MatchUiOptions {
    /** #ui-game, where the HUD parts go */
    hudRoot: HTMLElement;
    /** parent of the full-screen stats layer */
    parent: HTMLElement;
    audio: AudioEngine;
    killLeaderEnabled: boolean;
    spectate(action: SpectateActionName): void;
    /** "Play New Game" and "Leave Game" */
    playAgain(): void;
    /** 1 solo, 2 duo, 4 squad (M6; the stats screen texts) */
    teamMode?(): number;
    /** a role announcement for the local player arrived (M7: closes the Cobalt class menu) */
    onLocalRole?(role: string): void;
    /** extra button of the death / result screen (M8: Report) */
    extraButton?(): HTMLElement | null;
}

/** Generic name of an anonymized player (survev player.ts: `Player${playerId - 2750}`; rebirth ids start low). */
export function anonName(playerId: number): string {
    return `Player${playerId}`;
}

/** Event flags of the map that change the match UI (MapDef gameMode, M7). */
interface ModeFlags {
    factionMode: boolean;
    perkMode: boolean;
    spookyKillSounds: boolean;
    turkeyMode: boolean;
}

export class MatchUi implements PlayerNames {
    readonly gas = new GasTracker();
    readonly hud: MatchHud;
    readonly gameOver: GameOverScreen;
    private readonly opts: MatchUiOptions;
    private readonly infos = new Map<number, PlayerInfoView>();
    localId = -1;
    /** the player the snapshots follow (the spectated player while spectating) */
    activeId = -1;
    spectating = false;
    aliveCount = 0;
    localKills = 0;
    /** the GameOver result arrived */
    resultSeen = false;
    private hideKillIn = -1;
    private lastHealth = -1;
    private lastActive = -1;
    private statsKey = "";
    private victoryMusic: SoundHandle | null = null;
    private mode: ModeFlags = { factionMode: false, perkMode: false, spookyKillSounds: false, turkeyMode: false };
    /** faction alive counts [Red, Blue] (faction maps, M7) */
    teamAliveCounts: number[] | null = null;
    /** the player credited with the local player's death (0: none yet, the red zone, itself) (M8) */
    killerId = 0;

    constructor(opts: MatchUiOptions) {
        this.opts = opts;
        this.hud = new MatchHud(
            opts.hudRoot,
            {
                spectate: (action) => opts.spectate(action),
                leave: () => opts.playAgain(),
            },
            { killLeaderEnabled: opts.killLeaderEnabled },
        );
        this.gameOver = new GameOverScreen(opts.parent, {
            playAgain: () => opts.playAgain(),
            spectate: () => opts.spectate("begin"),
            extraButton: () => opts.extraButton?.() ?? null,
        });
    }

    /** The map's event flags (M7): faction counters and colours, class sounds, Halloween voice lines. */
    setMap(mapName: string): void {
        const mode = getMapDef(mapName).gameMode;
        this.mode = {
            factionMode: !!mode.factionMode,
            perkMode: !!mode.perkMode,
            spookyKillSounds: !!mode.spookyKillSounds,
            turkeyMode: !!mode.turkeyMode,
        };
        this.hud.setSniperMode(!!mode.sniperMode);
    }

    get factionMode(): boolean {
        return this.mode.factionMode;
    }

    /** Display name: anonymized outside the followed player's group when the setting is on (M8). */
    name(id: number): string {
        const info = this.infos.get(id);
        if (!info) return "";
        if (config().get("anonPlayerNames") && info.groupId !== this.infos.get(this.activeId)?.groupId) {
            return anonName(id);
        }
        return info.name;
    }

    /** The name the player chose, whatever the anonymize setting. */
    realName(id: number): string {
        return this.infos.get(id)?.name ?? "";
    }

    teamId(id: number): number {
        return this.infos.get(id)?.teamId ?? 0;
    }

    /** A new local player (join or sandbox respawn): everything of the previous life is reset. */
    reset(localId: number): void {
        this.localId = localId;
        this.activeId = localId;
        this.spectating = false;
        this.resultSeen = false;
        this.localKills = 0;
        this.killerId = 0;
        this.hideKillIn = -1;
        this.lastHealth = -1;
        this.lastActive = -1;
        this.statsKey = "";
        this.opts.audio.stop(this.victoryMusic);
        this.victoryMusic = null;
        this.gas.clear();
        this.gameOver.hide();
        this.hud.setSpectating(null);
        this.hud.setLocalKills(0);
        this.hud.hideKillMessage();
        this.hud.killFeed.clear();
    }

    /**
     * Applies one snapshot. `activePos` is the followed player's position (red-zone damage flash).
     * Returns true when the followed player changed (the client re-targets its camera).
     */
    applySnapshot(s: Snapshot, activePos: { x: number; y: number }): boolean {
        for (const info of s.playerInfos ?? []) this.infos.set(info.playerId, info);
        const activeChanged = s.localPlayerId !== this.activeId;
        this.activeId = s.localPlayerId;
        const spectating = (s.spectatingId ?? 0) !== 0 && s.localPlayerId !== this.localId;
        if (spectating !== this.spectating || (spectating && activeChanged)) {
            this.spectating = spectating;
            this.hud.setSpectating(spectating ? this.name(s.localPlayerId) : null);
            if (spectating) this.gameOver.hide();
        }

        if (s.gas) {
            const mode = this.gas.push(s.gas);
            if (mode && mode !== "inactive") this.hud.announce(gasAnnouncement(mode, this.gas.timeLeftCeil()));
            this.hud.setWaiting(s.gas.mode === "inactive");
        }
        for (const kill of s.kills ?? []) this.onKill(kill);
        for (const role of s.roleAnnouncements ?? []) this.onRole(role);
        if (s.aliveCount !== undefined) this.aliveCount = s.aliveCount;
        if (s.teamAliveCounts && s.teamAliveCounts.length >= 2) {
            this.teamAliveCounts = s.teamAliveCounts.slice(0, 2);
            this.hud.setAliveFaction(s.teamAliveCounts[0], s.teamAliveCounts[1]);
        } else if (s.aliveCount !== undefined) {
            this.hud.setAlive(s.aliveCount);
        }
        if (s.killLeader) {
            const leader = s.killLeader.id ? this.name(s.killLeader.id) : null;
            this.hud.setKillLeader(leader, s.killLeader.kills);
        }
        if (!this.spectating && s.local.kills !== undefined) this.setLocalKills(s.local.kills);
        this.hud.setSpectatorCount(s.local.spectatorCount ?? 0);
        if (s.local.stats && !this.spectating) this.setLocalStats(s.local.stats);
        if (s.playerStats && !this.resultSeen && s.playerStats.playerId === this.localId) {
            this.setLocalStats(s.playerStats);
            this.gameOver.showDeath(s.playerStats);
            this.hideKillIn = 2.5 - KILL_MESSAGE_HIDE_LEAD;
        }
        if (s.gameOver) this.onGameOver(s);
        this.checkGasDamage(s, activePos);
        return activeChanged;
    }

    /** The "Your Results" table, rebuilt only when a number changed. */
    private setLocalStats(stats: MatchStats): void {
        const key = `${stats.kills}|${stats.damageDealt}|${stats.damageTaken}|${stats.timeAlive}`;
        if (key === this.statsKey) return;
        this.statsKey = key;
        this.hud.setLocalStats(stats);
    }

    private setLocalKills(kills: number): void {
        this.localKills = kills;
        this.hud.setLocalKills(kills);
    }

    private onKill(e: KillEvent): void {
        const activeTeam = this.teamId(this.activeId);
        this.hud.killFeed.add(killFeedText(e, this), killFeedColor(e, activeTeam, this, this.mode.factionMode));
        if (e.killCreditId === this.activeId) {
            const msg = killMessage(e, this, this.spectating);
            this.hud.showKillMessage(msg.text, msg.count);
        } else if (e.targetId === this.activeId && e.downed && !e.killed) {
            this.hud.showKillMessage(downedMessage(e, this, this.spectating), "");
        }
        if (e.killCreditId === this.localId && e.killed) this.setLocalKills(e.killerKills);
        if (e.targetId === this.localId && e.killed && e.killCreditId && e.killCreditId !== this.localId) {
            this.killerId = e.killCreditId;
        }
    }

    private onRole(e: RoleAnnouncementEvent): void {
        const def = GameObjectDefs[e.role] as RoleDef | undefined;
        if (!def) return;
        const audio = this.opts.audio;
        const local = e.playerId === this.localId;
        const feed = roleFeed(e, this);
        if (e.assigned) {
            if (def.sound?.assign) {
                if (e.role === "kill_leader" && this.mode.spookyKillSounds) {
                    audio.playGroup("kill_leader_assigned", { channel: "ui" });
                } else if (e.role === "kill_leader" || !this.mode.perkMode || local) {
                    // perkMode: a class's spawn sound only for the player who chose it (survev game.ts)
                    audio.playSound(def.sound.assign, { channel: "ui" });
                }
            }
            if (local) this.opts.onLocalRole?.(e.role);
            if (feed) this.hud.killFeed.add(feed.text, feed.color);
            if (def.announce && local) this.hud.announce(roleAnnouncement(e.role, this.teamId(e.playerId)));
        } else if (e.killed) {
            if (feed) this.hud.killFeed.add(feed.text, feed.color);
            if (def.sound?.dead) {
                if (this.mode.spookyKillSounds) audio.playGroup("kill_leader_dead", { channel: "ui" });
                else audio.playSound(def.sound.dead, { channel: "ui" });
            }
        }
    }

    private onGameOver(s: Snapshot): void {
        const ev = s.gameOver;
        if (!ev || this.resultSeen) return;
        this.resultSeen = true;
        const stats = ev.playerStats.find((p) => p.playerId === this.localId) ?? ev.playerStats[0] ?? null;
        if (stats) this.setLocalStats(stats);
        this.gameOver.show({
            event: ev,
            name: this.realName(this.localId) || "",
            stats,
            aliveCount: s.aliveCount ?? this.aliveCount,
            teamMode: this.opts.teamMode?.() ?? 1,
            nameOf: (id) => this.name(id),
            factionAlive: this.mode.factionMode ? (s.teamAliveCounts ?? this.teamAliveCounts) : null,
            turkeyMode: this.mode.turkeyMode,
        });
        const won = ev.winningTeamId !== 0 && ev.winningTeamId === ev.teamId;
        this.hideKillIn = (won ? 1.75 : 2.5) - KILL_MESSAGE_HIDE_LEAD;
        if (won) {
            this.victoryMusic = this.opts.audio.playSound(VICTORY_MUSIC, {
                channel: "music",
                delay: VICTORY_MUSIC_DELAY_MS,
            });
        }
    }

    /** Rebirth addition: flash when the followed player's health dropped while standing in the red zone. */
    private checkGasDamage(s: Snapshot, pos: { x: number; y: number }): void {
        const health = s.local.dead ? 0 : s.local.health;
        const sameTarget = this.lastActive === s.localPlayerId;
        const dropped = sameTarget && this.lastHealth >= 0 && health < this.lastHealth - 1e-6;
        this.lastHealth = health;
        this.lastActive = s.localPlayerId;
        if (!dropped || s.local.dead || this.spectating) return;
        const circle = this.gas.circle(1);
        if (!this.gas.active || !circle || !(this.gas.view && this.gas.view.damage > 0)) return;
        if (Math.hypot(pos.x - circle.pos.x, pos.y - circle.pos.y) >= circle.rad) this.hud.flashGas();
    }

    /** The game is torn down: stop what keeps playing (the victory music) and drop the stats layer. */
    dispose(): void {
        this.opts.audio.stop(this.victoryMusic);
        this.victoryMusic = null;
        this.gameOver.root.remove();
    }

    /** Per frame: timers, animations and the spectate keys (Left / Right arrows, survev game.ts). */
    update(dt: number, map: MapInfoLayout, keys: { next: boolean; prev: boolean }): void {
        this.hud.setGas(this.gas.mode, this.gas.timeLeft());
        this.hud.update(dt, map);
        this.gameOver.update(dt);
        if (this.hideKillIn >= 0) {
            this.hideKillIn -= dt;
            if (this.hideKillIn < 0) this.hud.hideKillMessage();
        }
        if (this.spectating) {
            if (keys.next) this.opts.spectate("next");
            else if (keys.prev) this.opts.spectate("prev");
        }
    }
}
