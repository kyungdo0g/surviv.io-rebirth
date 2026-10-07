// Battle-royale HUD (DOM, inside #ui-game), laid out like the original desktop HUD (survev client/index.html,
// css/game.css, ui/ui.ts, ui/ui2.ts; docs/research/ui/hud.md):
// - top right: alive counter (#ui-leaderboard-alive); the kill counter only shows on the big map in the original
//   (js-ui-map-show, changelog 0.4.1), so it stays hidden; the kill leader box (#ui-kill-leader-wrapper) to its
//   left and the kill feed below it (#ui-killfeed-wrapper, killFeed.ts);
// - top centre: "Waiting for players..." until the match starts and "Spectating <name>" while spectating;
// - upper centre: announcements (red zone, roles): fade in 400 ms, hold 3 s, fade out 800 ms;
// - bottom centre: the active player's kill message for 7 s (#ui-kills);
// - above the minimap: the red-zone timer (#ui-map-info, gas / pulsing danger icon) and the spectator counter;
// - top left while spectating: next / previous player, match stats and leave buttons (#ui-spectate-options).
// M7: faction maps show the red and blue alive counts (#ui-leaderboard-alive-faction, the original AliveCounts with two
// counts) instead of the single counter; on Savannah (sniperMode) the empty kill leader box reads "Searching for the
// Hunted" (survev ui.ts updateKillLeader).
// M8 small layout (hudSm.css; survev index.html #ui-settings-container-mobile, css/game.css .ui-map-wrapper-mobile):
// the leaderboard and the kill leader box are hidden, the alive count moves beside the red-zone timer under the minimap
// (#ui-alive-info) and the kill feed under them. Toggle Minimap (V) on the large layout drops the timer and the
// spectator counter to the bottom-left corner (survev ui.ts hideMiniMap: map info bottom auto, counter bottom 6 left
// 98).
import type { MatchStats } from "@rebirth/sim";
import { HUD_INTERACTIVE_ATTR } from "../input/input.ts";
import { t } from "../l10n/index.ts";
import { KillFeed } from "./killFeed.ts";
import "./match.css";

/**
 * Rebirth addition, not in the original client: a short red vignette when the local player takes red-zone damage.
 * Set to false for the original look; the Enhanced hit effects setting turns it off too (`gasFlashEnabled`,
 * user/2026-10-07-hit-feedback), so that setting off is exactly v0.8.82.
 */
export const GAS_DAMAGE_FLASH = true;
const FLASH_DECAY = 1.6;
const FLASH_PEAK = 0.55;
/** survev ui2.ts displayKillMessage duration */
const KILL_MESSAGE_TIME = 7;
/** survev ui.ts displayAnnouncement: fadeIn(400), 3000 ms, fadeOut(800) */
const ANNOUNCE_IN = 0.4;
const ANNOUNCE_HOLD = 3;
const ANNOUNCE_OUT = 0.8;

export interface MatchHudCallbacks {
    spectate(action: "next" | "prev"): void;
    leave(): void;
}

/** Where the red-zone timer and the spectator counter go this frame. */
export interface MapInfoLayout {
    /** HUD scale factor (survev screenScaleFactor) */
    scale: number;
    /** the small layout: hudSm.css places them under the minimap */
    small: boolean;
    /** Toggle Minimap hid the minimap */
    minimapHidden: boolean;
}

function div(id: string, cls = "", text = ""): HTMLDivElement {
    const e = document.createElement("div");
    if (id) e.id = id;
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
}

function button(id: string, cls: string, text: string, click: () => void): HTMLAnchorElement {
    const a = document.createElement("a");
    a.id = id;
    a.className = cls;
    a.textContent = text;
    a.setAttribute(HUD_INTERACTIVE_ATTR, "");
    a.addEventListener("click", (ev) => {
        ev.stopPropagation();
        click();
    });
    a.addEventListener("mousedown", (ev) => ev.stopPropagation());
    return a;
}

/** "1h 2m 3s" / "2m 3s" / "3s" (survev ui.ts humanizeTime) */
export function humanizeTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor(seconds / 60) % 60;
    const s = Math.floor(seconds) % 60;
    let out = "";
    if (h > 0) out += `${h}h `;
    if (h > 0 || m > 0) out += `${m}m `;
    return `${out}${s}s`;
}

/** "Red zone advances in 1 minute 20 seconds" (survev ui.ts displayGasAnnouncement). */
export function gasAnnouncement(mode: string, timeLeft: number): string {
    if (mode === "moving") return t("game-red-zone-advancing");
    if (mode !== "waiting") return "";
    let msg = t("game-red-zone-advances");
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft - minutes * 60;
    if (minutes > 1) msg += ` ${minutes} ${t("game-minutes")}`;
    if (minutes === 1) msg += ` ${minutes} ${t("game-minute")}`;
    if (seconds > 0) msg += ` ${Math.floor(seconds)} ${t("game-seconds")}`;
    return msg;
}

export class MatchHud {
    readonly killFeed = new KillFeed();
    private readonly alive = div("", "ui-players-alive js-ui-players-alive", "0");
    private readonly aliveBox = div("ui-leaderboard-alive");
    private readonly aliveFaction = div("ui-leaderboard-alive-faction");
    private readonly aliveRed = div("", "ui-players-alive-red js-ui-players-alive-red", "0");
    private readonly aliveBlue = div("", "ui-players-alive-blue js-ui-players-alive-blue", "0");
    /** small layout: the alive count beside the red-zone timer (survev #ui-alive-info) */
    private readonly aliveInfo = div("ui-alive-info");
    private readonly aliveMap = div("ui-map-counter-default", "", "0");
    private readonly aliveMapFaction = div("ui-map-counter-faction");
    private readonly aliveMapRed = document.createElement("span");
    private readonly aliveMapBlue = document.createElement("span");
    private readonly killLeaderEnabled: boolean;
    /** "game-waiting-for-hunted" on sniperMode maps, else "game-waiting-for-new-leader" */
    private waitingLeaderKey = "game-waiting-for-new-leader";
    private readonly kills = div("", "ui-player-kills js-ui-player-kills", "0");
    private readonly leaderName = div("ui-kill-leader-name");
    private readonly leaderCount = div("ui-kill-leader-count", "", "0");
    private readonly leaderWrapper = div("ui-kill-leader-wrapper");
    private readonly waiting = div("ui-waiting-text", "top-center-text");
    private readonly spectateText = div("ui-spectate-text", "top-center-text");
    private readonly spectatePlayer = div("spectate-player", "spectate-text");
    private readonly announcement = div("ui-announcement");
    private readonly killBox = div("ui-kills");
    private readonly killText = div("ui-kill-text");
    private readonly killCount = div("ui-kill-count");
    private readonly mapInfo = div("ui-map-info");
    private readonly gasIcon = div("ui-gas-icon", "gas-icon");
    private readonly gasTimer = div("ui-gas-timer", "", "0:00");
    private readonly specCounter = div("ui-spec-counter");
    private readonly specCounterNumber = div("ui-spec-counter-number", "", "0");
    private readonly spectateOptions = div("ui-spectate-options");
    private readonly statsButton: HTMLAnchorElement;
    private readonly spectateStats = div("ui-spectate-stats");
    private readonly statsTable = document.createElement("tbody");
    private readonly flash = div("ui-gas-flash");
    private readonly last = new Map<string, string | number | boolean>();
    private killTicker = Number.MAX_VALUE;
    private announceTicker = Number.MAX_VALUE;
    private flashLevel = 0;
    /** the Enhanced hit effects setting (fx/hitFeedback.ts): off disables the red-zone flash as well */
    gasFlashEnabled = true;

    constructor(root: HTMLElement, cb: MatchHudCallbacks, opts: { killLeaderEnabled: boolean }) {
        // top right: alive counter and the (big map only) kill counter
        this.aliveBox.append(this.alive);
        this.aliveFaction.append(this.aliveRed, this.aliveBlue);
        const leaderboard = div("ui-leaderboard");
        leaderboard.append(this.aliveBox, this.aliveFaction, div("", "ui-leaderboard-header", t("game-alive")));
        const killCounter = div("ui-kill-counter");
        killCounter.append(this.kills);
        const killCounterWrapper = div("ui-kill-counter-wrapper", "js-ui-map-show");
        killCounterWrapper.append(killCounter, div("", "ui-kill-counter-header", t("game-kills")));
        const leaderboardWrapper = div("ui-leaderboard-wrapper");
        leaderboardWrapper.append(leaderboard, killCounterWrapper);

        this.leaderName.textContent = t("game-waiting-for-new-leader");
        // the spaces between the three inline blocks come from the original's line-broken markup (survev 8715a605
        // index.html; docs/research/provenance/visual-diff.md)
        this.leaderWrapper.append(this.leaderName, " ", div("ui-kill-leader-icon"), " ", this.leaderCount);
        const leaderContainer = div("ui-kill-leader-container");
        leaderContainer.append(this.leaderWrapper);
        leaderContainer.style.display = opts.killLeaderEnabled ? "block" : "none";
        this.killLeaderEnabled = opts.killLeaderEnabled;
        this.setLayout(false, false);
        this.aliveMapRed.className = "ui-map-counter-red";
        this.aliveMapBlue.className = "ui-map-counter-blue";
        this.aliveMapFaction.append(this.aliveMapRed, ":", this.aliveMapBlue);
        this.aliveInfo.append(div("ui-alive-icon", "ui-map-icon alive-icon"), this.aliveMap, this.aliveMapFaction);

        // "Waiting for players..." keeps the original's trailing dots outside the translated span
        const waitingSpan = document.createElement("span");
        waitingSpan.textContent = t("game-waiting-for-players");
        this.waiting.append(waitingSpan, "...");
        this.spectateText.append(div("", "spectate-text spectate-desc", t("game-spectating")), this.spectatePlayer);
        const topCenter = div("ui-top-center");
        topCenter.append(this.waiting, this.spectateText);
        const upperCenter = div("ui-upper-center");
        upperCenter.append(this.announcement);

        this.killBox.append(this.killText, this.killCount);
        const bottomCenter = div("ui-bottom-center-1");
        bottomCenter.append(this.killBox);

        this.mapInfo.append(this.gasIcon, this.gasTimer);
        this.specCounter.append(div("ui-spec-counter-icon"), this.specCounterNumber);

        // spectate options: the original hides next/prev in solo (keys only); rebirth shows them as
        // "Next Player" / "Previous Player" (strings of the original table)
        const buttons = div("ui-spectate-buttons");
        this.statsButton = button("btn-spectate-view-stats", "menu-option btn-darken", t("game-view-match-stats"), () =>
            this.toggleStats(),
        );
        buttons.append(
            button("btn-spectate-next-player", "menu-option btn-darken", t("game-spectate-next"), () =>
                cb.spectate("next"),
            ),
            button("btn-spectate-prev-player", "menu-option btn-darken", t("game-spectate-previous"), () =>
                cb.spectate("prev"),
            ),
            this.statsButton,
            button("btn-spectate-quit", "menu-option btn-darken btn-quit", t("game-leave-game"), () => cb.leave()),
        );
        const table = document.createElement("table");
        table.id = "ui-spectate-stats-table";
        table.append(this.statsTable);
        this.spectateStats.append(div("ui-spectate-stats-header", "", t("game-your-results")), table);
        this.spectateOptions.append(buttons, this.spectateStats);
        const spectateWrapper = div("ui-spectate-options-wrapper");
        spectateWrapper.append(this.spectateOptions);

        root.append(
            this.flash,
            leaderContainer,
            this.killFeed.root,
            leaderboardWrapper,
            topCenter,
            upperCenter,
            bottomCenter,
            this.mapInfo,
            this.aliveInfo,
            this.specCounter,
            spectateWrapper,
        );
        this.setSpectating(null);
        this.setWaiting(false);
    }

    /** Writes a DOM property only when the value changed. */
    private set(key: string, value: string | number | boolean, write: () => void): void {
        if (this.last.get(key) === value) return;
        this.last.set(key, value);
        write();
    }

    /**
     * Small layout: 15 px kill feed lines under the minimap (hudSm.css), else under the kill leader box when the mode
     * has one (survev ui.ts onMapLoad); mobile: no kill feed fade.
     */
    setLayout(small: boolean, mobile: boolean): void {
        this.killFeed.setLayout(small, mobile);
        this.killFeed.root.style.top = small ? "" : this.killLeaderEnabled ? "60px" : "12px";
        this.last.delete("mapScale");
    }

    setAlive(count: number): void {
        this.set("alive", count, () => {
            this.alive.textContent = String(count);
            this.aliveMap.textContent = String(count);
            this.aliveBox.style.display = "block";
            this.aliveFaction.style.display = "none";
            this.aliveMap.style.display = "inline-block";
            this.aliveMapFaction.style.display = "none";
        });
    }

    /** Faction alive counts [Red, Blue] in place of the single counter (survev ui.ts updatePlayersAliveRed/Blue). */
    setAliveFaction(red: number, blue: number): void {
        this.set("alive", `${red}:${blue}`, () => {
            this.aliveRed.textContent = String(red);
            this.aliveBlue.textContent = String(blue);
            this.aliveMapRed.textContent = String(red);
            this.aliveMapBlue.textContent = String(blue);
            this.aliveBox.style.display = "none";
            this.aliveFaction.style.display = "block";
            this.aliveMap.style.display = "none";
            this.aliveMapFaction.style.display = "inline-block";
        });
    }

    /** Sniper mode maps (Savannah) wait for The Hunted instead of a kill leader. */
    setSniperMode(on: boolean): void {
        this.waitingLeaderKey = on ? "game-waiting-for-hunted" : "game-waiting-for-new-leader";
    }

    setLocalKills(count: number): void {
        this.set("kills", count, () => {
            this.kills.textContent = String(count);
        });
    }

    /** Kill leader name and kills, or "Waiting for new leader" (survev ui.ts updateKillLeader). */
    setKillLeader(name: string | null, kills: number): void {
        const text = name ?? t(this.waitingLeaderKey);
        this.set("leader", `${text}|${kills}`, () => {
            this.leaderName.textContent = text;
            this.leaderCount.textContent = String(name ? kills : 0);
        });
    }

    /** Red-zone timer "m:ss" and its icon (survev ui.ts m_update). */
    setGas(mode: string, timeLeft: number): void {
        const moving = mode === "moving";
        const text = `${Math.floor(timeLeft / 60)}:${`0${timeLeft % 60}`.slice(-2)}`;
        this.set("gas", `${moving}|${text}`, () => {
            this.mapInfo.classList.toggle("icon-pulse", moving);
            this.gasIcon.className = moving ? "danger-icon" : "gas-icon";
            this.gasTimer.textContent = text;
        });
    }

    setWaiting(waiting: boolean): void {
        this.set("waiting", waiting, () => {
            this.waiting.style.display = waiting ? "block" : "none";
        });
    }

    announce(text: string): void {
        if (!text) return;
        this.announcement.textContent = text;
        this.announceTicker = 0;
    }

    showKillMessage(text: string, count: string): void {
        this.killText.textContent = text;
        this.killCount.textContent = count;
        this.killTicker = 0;
    }

    /** Fades the kill message out now (survev ui2.ts hideKillMessage, when the stats screen opens). */
    hideKillMessage(): void {
        this.killTicker = Math.max(this.killTicker, KILL_MESSAGE_TIME - 0.2);
    }

    /** Spectate mode on (with the watched player's name) or off (survev ui.ts setSpectating / setSpectateTarget). */
    setSpectating(name: string | null): void {
        const on = name !== null;
        this.set("spectating", `${on}|${name}`, () => {
            this.spectateText.style.display = on ? "block" : "none";
            this.spectateOptions.style.display = on ? "block" : "none";
            this.spectatePlayer.textContent = name ?? "";
            if (!on) this.toggleStats(true);
        });
    }

    /** Eye icon with the number of spectators, only while someone watches (survev updateSpectatorCountDisplay). */
    setSpectatorCount(count: number): void {
        this.set("specCount", count, () => {
            this.specCounter.style.display = count > 0 ? "block" : "none";
            this.specCounterNumber.textContent = String(count);
        });
    }

    /** The "Your Results" table of the spectate options (survev ui.ts setLocalStats). */
    setLocalStats(stats: MatchStats): void {
        const rows: Array<[string, string]> = [
            [t("game-kills"), String(stats.kills)],
            [t("game-damage-dealt"), String(stats.damageDealt)],
            [t("game-damage-taken"), String(stats.damageTaken)],
            [t("game-survived"), humanizeTime(stats.timeAlive)],
        ];
        this.statsTable.replaceChildren(
            ...rows.map(([label, value]) => {
                const tr = document.createElement("tr");
                const a = document.createElement("td");
                a.className = "ui-spectate-stats-category";
                a.textContent = label;
                const b = document.createElement("td");
                b.className = "ui-spectate-stats-value";
                b.textContent = value;
                tr.append(a, b);
                return tr;
            }),
        );
    }

    private toggleStats(hide = false): void {
        const show = this.spectateStats.style.display !== "inline-block" && !hide;
        this.spectateStats.style.display = show ? "inline-block" : "none";
        this.statsButton.textContent = t(show ? "game-hide-match-stats" : "game-view-match-stats");
    }

    /** Rebirth addition (GAS_DAMAGE_FLASH): the local player just took red-zone damage. */
    flashGas(): void {
        if (GAS_DAMAGE_FLASH && this.gasFlashEnabled) this.flashLevel = FLASH_PEAK;
    }

    update(dt: number, map: MapInfoLayout): void {
        this.killFeed.update(dt);
        this.killTicker += dt;
        const killOpacity = this.killTicker >= KILL_MESSAGE_TIME ? 0 : 1 - smooth(this.killTicker, 6.8, 7);
        this.set("killOpacity", killOpacity.toFixed(3), () => {
            this.killBox.style.opacity = killOpacity.toFixed(3);
        });
        this.announceTicker += dt;
        const at = this.announceTicker;
        let announceOpacity = 0;
        if (at < ANNOUNCE_IN) announceOpacity = at / ANNOUNCE_IN;
        else if (at < ANNOUNCE_IN + ANNOUNCE_HOLD) announceOpacity = 1;
        else announceOpacity = Math.max(0, 1 - (at - ANNOUNCE_IN - ANNOUNCE_HOLD) / ANNOUNCE_OUT);
        this.set("announce", announceOpacity.toFixed(3), () => {
            this.announcement.style.display = announceOpacity > 0 ? "block" : "none";
            this.announcement.style.opacity = announceOpacity.toFixed(3);
        });
        this.flashLevel = Math.max(0, this.flashLevel - dt * FLASH_DECAY);
        this.set("flash", this.flashLevel.toFixed(3), () => {
            this.flash.style.opacity = this.flashLevel.toFixed(3);
            this.flash.style.display = this.flashLevel > 0 ? "block" : "none";
        });
        this.set("mapScale", `${map.small}|${map.scale}|${map.minimapHidden}`, () => this.placeMapInfo(map));
    }

    /**
     * The map info sits above the minimap and scales with it (survev #ui-map-container: bottom 52, info 218, counter
     * 218); with the minimap hidden the info hangs from the container (bottom auto) and the counter goes to bottom 6
     * left 98. The small layout leaves both to hudSm.css.
     */
    private placeMapInfo(map: MapInfoLayout): void {
        const s = map.scale;
        const px = (v: number) => (map.small ? "" : `${v}px`);
        const transform = map.small ? "" : `scale(${s})`;
        this.mapInfo.style.bottom = px(12 + (map.minimapHidden ? 52 - 36 : 270) * s);
        this.mapInfo.style.left = px(12 + 82 * s);
        this.mapInfo.style.transform = transform;
        this.specCounter.style.bottom = px(12 + (map.minimapHidden ? 52 + 6 : 270) * s);
        this.specCounter.style.left = px(12 + (map.minimapHidden ? 98 : 6) * s);
        this.specCounter.style.transform = transform;
    }

    /** Text shown by the announcement right now ("" when hidden) (tests). */
    get announcementText(): string {
        return this.announcement.style.display === "none" ? "" : (this.announcement.textContent ?? "");
    }
}

function smooth(v: number, a: number, b: number): number {
    const x = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return x * x * (3 - 2 * x);
}
