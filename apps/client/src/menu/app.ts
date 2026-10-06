// The menu application (M6, `/?menu=1`, `/?net=1`, `/?team=CODE`): the start page, the team lobby and the network games
// they launch. Quick play (Play Solo / Duo / Squad) joins through find_game with the team mode; Create Team / Join
// Team open a party room (net/party.ts) whose leader's start sends every member a joinGame URL, which the game
// connects to directly. Leaving a game ("Play New Game", "Leave Game", or a dropped connection) returns to the start
// page, or to the lobby with a gameComplete for a party game, like the original's onQuit (survev main.ts,
// ui/teamMenu.ts onGameComplete). Room errors leave the lobby with the original's error text (teamMenu.ts
// errorTypeToString); an error that arrives during a game is shown when the game ends.
// M8: the region select (site_info `pops` / `regions`): quick play calls find_game on the chosen region's server and a
// new room carries the region; the start page plays the menu music (audio/menuMusic.ts), faded out when a game starts;
// the lobby settings live in the config (config.ts).
import type { Application } from "pixi.js";
import { MenuMusic } from "../audio/menuMusic.ts";
import { sharedAudio } from "../audio/shared.ts";
import { config } from "../config.ts";
import type { GameClient } from "../game/client.ts";
import { exposeSettings } from "../game/debugM8.ts";
import { bootSandbox } from "../game/sandbox.ts";
import { debugGlobals } from "../globals.ts";
import { t } from "../l10n/index.ts";
import { PartyClient, type PartyErrorType, type PartyState } from "../net/party.ts";
import { MainMenu } from "./mainMenu.ts";
import { fetchRegions, pickRegion, type RegionInfo } from "./regionSelect.ts";
import { TeamLobby } from "./teamLobby.ts";

export interface MenuAppOptions {
    /** HTTP origin of the game server; "" = this page's origin (the dev server proxies /api, /play and /team_v2) */
    server: string;
    mapName: string;
    /** prefill of the name field (`&name=`) */
    name?: string;
    /** join this room at once (`?team=CODE` or `#CODE`) */
    teamCode?: string;
    showDebugHud?: boolean;
    debugZoom?: number;
}

/** Text of a room error (survev teamMenu.ts errorTypeToString). */
export function partyErrorText(type: PartyErrorType): string {
    switch (type) {
        case "join_full":
            return t("index-team-is-full");
        case "join_not_found":
        case "join_failed":
            return t("index-failed-joining-team");
        case "create_failed":
            return t("index-failed-creating-team");
        case "find_game_error":
        case "find_game_full":
            return t("index-failed-finding-game");
        case "kicked":
            return t("index-team-kicked");
        default:
            return t("index-lost-connection");
    }
}

export class MenuApp {
    readonly menu: MainMenu;
    readonly lobby: TeamLobby;
    private readonly app: Application;
    private readonly opts: MenuAppOptions;
    private party: PartyClient | null = null;
    private client: GameClient | null = null;
    /** a party error that arrived during a game */
    private pendingError = "";
    /** the game in progress was started by the party room */
    private partyGame = false;
    private regions: RegionInfo[] = [];
    readonly music: MenuMusic;

    constructor(app: Application, opts: MenuAppOptions) {
        this.app = app;
        this.opts = opts;
        this.menu = new MainMenu(document.body, {
            play: (mode) => this.quickPlay(mode),
            createTeam: () => this.openParty(null),
            joinTeam: (code) => this.openParty(code),
            langChanged: () => this.lobby.applyStrings(),
            regionChanged: (region) => config().set("region", region),
        });
        this.lobby = new TeamLobby({
            setProps: (props) => {
                this.party?.setRoomProps(props);
                config().set("gameModeIdx", props.gameModeIdx);
                config().set("teamAutoFill", props.autoFill);
                if (props.region) config().set("region", props.region);
            },
            kick: (id) => this.party?.kick(id),
            play: () => this.party?.playGame(),
            leave: () => this.leaveParty(""),
        });
        this.menu.setLobbyPanel(this.lobby.panel);
        if (opts.name) {
            const input = this.menu.root.querySelector<HTMLInputElement>("#player-name-input-solo");
            if (input) input.value = opts.name.slice(0, 16);
        }
        this.music = new MenuMusic(sharedAudio());
        config().onChange((key) => {
            if (key === "muteAudio") this.music.refresh();
        });
        this.exposeGlobals();
        // nothing is drawn under the menu: the render loop only runs during a game
        app.stop();
        if (opts.teamCode) this.openParty(opts.teamCode);
        this.music.start();
        void this.loadRegions();
    }

    /** site_info regions for the selects (hidden with a single region). */
    private async loadRegions(): Promise<void> {
        const list = await fetchRegions(this.opts.server);
        this.regions = list;
        const chosen = pickRegion(list, config().get("region"));
        this.menu.regionSelect.setRegions(list, chosen);
        this.lobby.setRegions(list, chosen);
    }

    /** The region quick play and new rooms use ("" when the server lists none). */
    private get region(): string {
        if (!this.regions.length) return "";
        return pickRegion(this.regions, this.menu.regionSelect.value || config().get("region"));
    }

    /** The server find_game goes to: the chosen region's origin, "" (this server) meaning the menu's server. */
    private get gameServer(): string {
        const origin = this.regions.find((r) => r.id === this.region)?.origin ?? "";
        return origin || this.opts.server;
    }

    /** A game starts: the menu music fades out. */
    private startGame(): void {
        this.music.stop();
        this.menu.hide();
        this.app.start();
    }

    private get playerName(): string {
        return this.menu.name || "Player";
    }

    private quickPlay(teamMode: 1 | 2 | 4): void {
        if (this.client) return;
        this.menu.setError("");
        this.startGame();
        this.partyGame = false;
        const autoFill = config().get("teamAutoFill");
        const region = this.region;
        this.client = bootSandbox(this.app, {
            mapName: this.opts.mapName,
            seed: 1,
            showDebugHud: this.opts.showDebugHud,
            debugZoom: this.opts.debugZoom,
            net: {
                server: this.gameServer,
                name: this.playerName,
                teamMode,
                autoFill,
                ...(region ? { region } : {}),
            },
            onQuit: (error) => this.gameEnded(error),
        });
    }

    /** Creates a room (`code` null) or joins room `code`. */
    private openParty(code: string | null): void {
        this.party?.close();
        this.menu.setError("");
        this.lobby.reset(code === null);
        this.menu.show("lobby");
        const gameModeIdx = config().get("gameModeIdx");
        const autoFill = config().get("teamAutoFill");
        const first =
            code === null
                ? { create: { region: this.region, autoFill, gameModeIdx }, name: this.playerName }
                : { join: code, name: this.playerName };
        const party: PartyClient = new PartyClient(this.opts.server, first, {
            state: (s) => this.onPartyState(party, s),
            joinGame: (join) => this.joinPartyGame(party, join.url),
            error: (type) => this.onPartyError(party, type),
            kicked: () => this.onPartyError(party, "kicked"),
        });
        this.party = party;
    }

    private onPartyState(party: PartyClient, s: PartyState): void {
        if (party !== this.party) return;
        this.lobby.setState(s);
        const code = s.room.roomUrl.replace(/^#/, "");
        const url = new URL(location.href);
        if (code && url.searchParams.get("team") !== code) {
            url.searchParams.set("team", code);
            history.replaceState(null, "", url.toString());
        }
    }

    private joinPartyGame(party: PartyClient, url: string): void {
        if (party !== this.party || this.client) return;
        this.lobby.joiningGame = true;
        this.menu.setError("");
        this.startGame();
        this.partyGame = true;
        this.client = bootSandbox(this.app, {
            mapName: this.opts.mapName,
            seed: 1,
            showDebugHud: this.opts.showDebugHud,
            debugZoom: this.opts.debugZoom,
            net: { server: this.opts.server, name: this.playerName, joinUrl: url },
            onQuit: (error) => this.gameEnded(error),
        });
    }

    private onPartyError(party: PartyClient, type: PartyErrorType): void {
        if (party !== this.party) return;
        this.leaveParty(partyErrorText(type));
    }

    /** Leaves the room (button, error or kick): back to the start page with `error` under the buttons. */
    private leaveParty(error: string): void {
        this.party?.close();
        this.party = null;
        const url = new URL(location.href);
        if (url.searchParams.has("team")) {
            url.searchParams.delete("team");
            history.replaceState(null, "", url.toString());
        }
        if (this.client) {
            // the game goes on; the start page and the error show when it ends
            this.pendingError = error;
            return;
        }
        this.menu.show("start");
        this.menu.setError(error);
    }

    /** The game was left or lost: back to the lobby (party games) or the start page. */
    private gameEnded(error?: string): void {
        this.client = null;
        this.app.stop();
        const party = this.partyGame ? this.party : null;
        this.partyGame = false;
        if (party) {
            this.lobby.joiningGame = false;
            party.gameComplete();
            this.menu.show("lobby");
            if (party.state) this.lobby.setState(party.state);
        } else {
            this.menu.show("start");
        }
        this.menu.setError(this.pendingError || error || "");
        this.pendingError = "";
        this.music.start();
    }

    private exposeGlobals(): void {
        exposeSettings();
        const globals = debugGlobals();
        const self = this;
        globals.menu = {
            get visible() {
                return self.menu.visible;
            },
            get panel() {
                return self.menu.currentPanel;
            },
            get error() {
                return self.menu.errorText;
            },
            get inGame() {
                return !!self.client;
            },
            get musicPlaying() {
                return self.music.playing;
            },
            get regions() {
                return self.regions;
            },
            get region() {
                return self.region;
            },
            get settingsOpen() {
                return self.menu.settings.visible;
            },
            get keybindsOpen() {
                return self.menu.keybinds.visible;
            },
            /** the party room as last received (null outside a room) */
            get lobby() {
                const s = self.party?.state;
                if (!self.party || !s) return null;
                return {
                    code: self.lobby.roomCode,
                    link: self.lobby.link,
                    localPlayerId: s.localPlayerId,
                    leader: self.party.isLeader,
                    room: s.room,
                    players: s.players,
                };
            },
        };
    }
}
