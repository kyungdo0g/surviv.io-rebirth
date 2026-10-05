// The menu application (M6, `/?menu=1`, `/?net=1`, `/?team=CODE`): the start page, the team lobby and the network games
// they launch. Quick play (Play Solo / Duo / Squad) joins through find_game with the team mode; Create Team / Join
// Team open a party room (net/party.ts) whose leader's start sends every member a joinGame URL, which the game
// connects to directly. Leaving a game ("Play New Game", "Leave Game", or a dropped connection) returns to the start
// page, or to the lobby with a gameComplete for a party game, like the original's onQuit (survev main.ts,
// ui/teamMenu.ts onGameComplete). Room errors leave the lobby with the original's error text (teamMenu.ts
// errorTypeToString); an error that arrives during a game is shown when the game ends.
import type { Application } from "pixi.js";
import type { GameClient } from "../game/client.ts";
import { bootSandbox } from "../game/sandbox.ts";
import { debugGlobals } from "../globals.ts";
import { t } from "../l10n/index.ts";
import { PartyClient, type PartyErrorType, type PartyState } from "../net/party.ts";
import { loadSetting, saveSetting } from "./dom.ts";
import { MainMenu } from "./mainMenu.ts";
import { TeamLobby } from "./teamLobby.ts";

const MODE_KEY = "rebirth.gameModeIdx";
const FILL_KEY = "rebirth.teamAutoFill";

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

    constructor(app: Application, opts: MenuAppOptions) {
        this.app = app;
        this.opts = opts;
        this.menu = new MainMenu(document.body, {
            play: (mode) => this.quickPlay(mode),
            createTeam: () => this.openParty(null),
            joinTeam: (code) => this.openParty(code),
            langChanged: () => this.lobby.applyStrings(),
        });
        this.lobby = new TeamLobby({
            setProps: (props) => {
                this.party?.setRoomProps(props);
                saveSetting(MODE_KEY, String(props.gameModeIdx));
                saveSetting(FILL_KEY, String(props.autoFill));
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
        this.exposeGlobals();
        if (opts.teamCode) this.openParty(opts.teamCode);
    }

    private get playerName(): string {
        return this.menu.name || "Player";
    }

    private quickPlay(teamMode: 1 | 2 | 4): void {
        if (this.client) return;
        this.menu.setError("");
        this.menu.hide();
        this.partyGame = false;
        const autoFill = loadSetting(FILL_KEY) !== "false";
        this.client = bootSandbox(this.app, {
            mapName: this.opts.mapName,
            seed: 1,
            showDebugHud: this.opts.showDebugHud,
            debugZoom: this.opts.debugZoom,
            net: { server: this.opts.server, name: this.playerName, teamMode, autoFill },
            onQuit: (error) => this.gameEnded(error),
        });
    }

    /** Creates a room (`code` null) or joins room `code`. */
    private openParty(code: string | null): void {
        this.party?.close();
        this.menu.setError("");
        this.lobby.reset(code === null);
        this.menu.show("lobby");
        const storedMode = Number(loadSetting(MODE_KEY));
        const gameModeIdx = storedMode === 1 || storedMode === 2 ? storedMode : 2;
        const autoFill = loadSetting(FILL_KEY) !== "false";
        const first =
            code === null
                ? { create: { region: "", autoFill, gameModeIdx }, name: this.playerName }
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
        this.menu.hide();
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
    }

    private exposeGlobals(): void {
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
