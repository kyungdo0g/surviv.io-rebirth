// Team lobby panel (M6), after the original #team-menu (survev client/index.html, ui/teamMenu.ts refreshUi; docs/
// research/ui/menus.md "Team lobby"): "Creating Team ..." / "Joining Team ..." while connecting; then the invite link
// (`/?team=CODE`, click or the copy button to copy it) and the invite code, up to maxPlayers member rows (crown for
// the leader, a kick button the leader sees on the others, a pulsing player icon while a member is in a game), and the
// options column: Duo / Squad and Auto Fill / No Fill (only the leader can change them), the leader's Play button
// (spinner while the room finds a game) or a wait reason ("Waiting for leader to start game", "Joining game",
// "Game in progress"), and Leave Team.
import { t } from "../l10n/index.ts";
import type { PartyRoomProps, PartyState } from "../net/party.ts";
import { applyL10n, h } from "./dom.ts";

export interface TeamLobbyCallbacks {
    setProps(props: PartyRoomProps): void;
    kick(playerId: number): void;
    play(): void;
    leave(): void;
}

/** Shareable invite link for a room code: this page with `?team=CODE` (plus the game server parameter, if any). */
export function inviteLink(code: string): string {
    const here = new URL(location.href);
    const url = new URL("/", here.origin);
    const server = here.searchParams.get("server");
    if (server) url.searchParams.set("server", server);
    url.searchParams.set("team", code);
    return url.toString();
}

export class TeamLobby {
    readonly panel: HTMLDivElement;
    private readonly cb: TeamLobbyCallbacks;
    private readonly connecting: HTMLDivElement;
    private readonly connectingText: HTMLSpanElement;
    private readonly contents: HTMLDivElement;
    private readonly url: HTMLSpanElement;
    private readonly code: HTMLSpanElement;
    private readonly members: HTMLDivElement;
    private readonly duo: HTMLAnchorElement;
    private readonly squad: HTMLAnchorElement;
    private readonly fillAuto: HTMLAnchorElement;
    private readonly fillNone: HTMLAnchorElement;
    private readonly playBtn: HTMLAnchorElement;
    private readonly waitReason: HTMLDivElement;
    private state: PartyState | null = null;
    /** this member was sent into a game and has not reported back yet */
    joiningGame = false;

    constructor(cb: TeamLobbyCallbacks) {
        this.cb = cb;
        this.connectingText = h("span");
        this.connecting = h(
            "div",
            { id: "team-menu-connecting" },
            h("div", { cls: "ui-spinner" }),
            this.connectingText,
            " ...",
        );
        this.url = h("span", { id: "team-url", click: () => this.copyLink() });
        this.code = h("span", { id: "team-code" });
        const copy = h("a", { id: "team-copy-url", cls: "btn-darken", click: () => this.copyLink() });
        copy.title = t("index-copy");
        const desc = h(
            "div",
            { id: "team-desc" },
            h("div", { id: "team-desc-text" }, h("span", { l10n: "index-invite-link" }), ": ", this.url, copy),
            h("div", { id: "team-code-text" }, h("span", { cls: "label", l10n: "index-invite-code" }), ": ", this.code),
        );
        this.members = h("div", { id: "team-menu-member-list" });
        const props = (patch: Partial<PartyRoomProps>) => () => this.setProps(patch);
        const hollow = (id: string, key: string, click: () => void) =>
            h("a", { id, cls: "btn-hollow btn-darken team-menu-option", l10n: key, click });
        this.duo = hollow("btn-team-queue-mode-1", "index-duo", props({ gameModeIdx: 1 }));
        this.squad = hollow("btn-team-queue-mode-2", "index-squad", props({ gameModeIdx: 2 }));
        this.fillAuto = hollow("btn-team-fill-auto", "index-auto-fill", props({ autoFill: true }));
        this.fillNone = hollow("btn-team-fill-none", "index-no-fill", props({ autoFill: false }));
        this.playBtn = h("a", {
            id: "btn-start-team",
            cls: "btn-green btn-darken menu-option",
            click: () => this.play(),
        });
        this.waitReason = h("div", { id: "msg-wait-reason" });
        this.contents = h(
            "div",
            { id: "team-menu-contents" },
            desc,
            h(
                "div",
                { id: "team-menu-columns" },
                h("div", { id: "team-menu-members" }, this.members),
                h(
                    "div",
                    { id: "team-menu-options" },
                    h("div", { cls: "team-menu-options-buttons" }, this.duo, this.squad),
                    h("div", { cls: "team-menu-options-buttons" }, this.fillAuto, this.fillNone),
                    this.playBtn,
                    this.waitReason,
                ),
            ),
        );
        this.panel = h(
            "div",
            { id: "team-menu", cls: "menu-block" },
            h("a", {
                id: "btn-team-leave",
                cls: "btn-grey btn-darken menu-option",
                l10n: "index-leave-team",
                click: () => cb.leave(),
            }),
            this.connecting,
            this.contents,
        );
        this.reset(true);
    }

    /** Back to the connecting view ("Creating Team ..." or "Joining Team ..."). */
    reset(create: boolean): void {
        this.state = null;
        this.joiningGame = false;
        this.connectingText.dataset.l10n = create ? "index-creating-team" : "index-joining-team";
        this.connectingText.textContent = t(this.connectingText.dataset.l10n);
        this.connecting.hidden = false;
        this.contents.hidden = true;
    }

    get roomCode(): string {
        return this.state?.room.roomUrl.replace(/^#/, "") ?? "";
    }

    get link(): string {
        return this.roomCode ? inviteLink(this.roomCode) : "";
    }

    private get isLeader(): boolean {
        const s = this.state;
        return !!s && s.players.some((p) => p.playerId === s.localPlayerId && p.isLeader);
    }

    private setProps(patch: Partial<PartyRoomProps>): void {
        const room = this.state?.room;
        if (!room || !this.isLeader) return;
        this.cb.setProps({
            region: room.region,
            autoFill: patch.autoFill ?? room.autoFill,
            gameModeIdx: patch.gameModeIdx ?? room.gameModeIdx,
        });
    }

    private play(): void {
        if (!this.isLeader || this.state?.room.findingGame || this.joiningGame) return;
        this.cb.play();
    }

    private copyLink(): void {
        const link = this.link;
        if (!link) return;
        navigator.clipboard?.writeText(link).catch(() => {});
    }

    setState(state: PartyState): void {
        this.state = state;
        this.connecting.hidden = true;
        this.contents.hidden = false;
        this.render();
    }

    applyStrings(): void {
        applyL10n(this.panel);
        if (this.state) this.render();
    }

    private render(): void {
        const s = this.state;
        if (!s) return;
        const room = s.room;
        const leader = this.isLeader;
        const code = this.roomCode;
        this.url.textContent = this.link;
        this.code.textContent = code;
        const setButton = (b: HTMLAnchorElement, selected: boolean, enabled: boolean) => {
            b.classList.toggle("btn-hollow-selected", selected);
            b.classList.toggle("btn-opaque", !enabled);
        };
        setButton(this.duo, room.gameModeIdx === 1, leader && room.enabledGameModeIdxs.includes(1));
        setButton(this.squad, room.gameModeIdx === 2, leader && room.enabledGameModeIdxs.includes(2));
        setButton(this.fillAuto, room.autoFill, leader);
        setButton(this.fillNone, !room.autoFill, leader);

        const finding = room.findingGame || this.joiningGame;
        this.playBtn.replaceChildren();
        if (finding) this.playBtn.append(h("div", { cls: "ui-spinner" }), t("index-finding-game"));
        else this.playBtn.textContent = t("index-play");
        const playersInGame = s.players.some((p) => p.inGame);
        let wait = "";
        if (leader) {
            if (playersInGame && !this.joiningGame) wait = t("index-game-in-progress");
        } else if (finding) {
            wait = t("index-joining-game");
        } else if (playersInGame) {
            wait = t("index-game-in-progress");
        } else {
            wait = t("index-waiting-for-leader");
        }
        this.playBtn.hidden = !leader || !!wait;
        this.waitReason.replaceChildren();
        if (wait) {
            if (!leader && finding) this.waitReason.append(h("div", { cls: "ui-spinner" }));
            this.waitReason.append(`${wait} ...`);
        }
        this.waitReason.hidden = !wait;

        this.members.replaceChildren();
        for (let i = 0; i < room.maxPlayers; i++) {
            const p = s.players[i];
            let icon = "icon";
            if (p?.isLeader) icon += " icon-leader";
            else if (p && leader) icon += " icon-kick";
            const iconDiv = h("div", { cls: icon });
            if (p && !p.isLeader && leader) {
                iconDiv.dataset.playerid = String(p.playerId);
                iconDiv.addEventListener("click", () => this.cb.kick(p.playerId));
            }
            let nameCls = "name menu-option";
            if (!p) nameCls += " name-empty";
            else if (p.playerId === s.localPlayerId) nameCls += " name-self";
            const row = h(
                "div",
                { cls: "team-menu-member" },
                iconDiv,
                h("div", { cls: nameCls, text: p?.name ?? "" }),
                h("div", { cls: `icon${p?.inGame ? " icon-in-game" : ""}` }),
            );
            this.members.append(row);
        }
    }
}
