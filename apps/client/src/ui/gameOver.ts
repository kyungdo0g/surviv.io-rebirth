// End-of-life stats screen (#ui-stats), like the original solo screen (survev client/src/ui/ui.ts showStats,
// css/game.css #ui-stats*; docs/research/ui/hud.md "Death and win screens"): a dark backdrop, the title ("You
// died." or "Winner winner chicken dinner!"), "Solo Rank #N", one card with the player's name, kills, damage dealt,
// damage taken and survival time, and the buttons "Play New Game" and, while players remain, "Spectate".
// Timing: the screen fades in over 1 s after 2.5 s (1.75 s for a win); the card fades in 0.75 s later, its rows one
// by one 250 ms apart, the buttons 500 ms after the last row.
import type { GameOverEvent, PlayerStatsView } from "@rebirth/sim";
import { HUD_INTERACTIVE_ATTR } from "../input/input.ts";
import { t } from "../l10n/index.ts";
import { humanizeTime } from "./matchHud.ts";

const LOSS_DELAY = 2.5;
const WIN_DELAY = 1.75;
const SCREEN_FADE = 1;
/** survev showStats: baseDelay 750 ms, elemDelay 250 ms, elemFadeTime 500 ms (one player card) */
const CARD_DELAY = 0.75;
const ROW_DELAY = 0.25;
const ELEM_FADE = 0.5;
const BUTTON_EXTRA_DELAY = 0.5;

export interface GameOverCallbacks {
    playAgain(): void;
    spectate(): void;
}

export interface GameOverInfo {
    event: GameOverEvent;
    /** the local player's name (the card title) */
    name: string;
    /** fallback stats when the event carries none */
    stats: PlayerStatsView | null;
    /** players still alive: "Spectate" is offered while any remain */
    aliveCount: number;
}

interface Timed {
    el: HTMLElement;
    /** seconds after the screen opened */
    at: number;
}

function el(tag: string, id: string, cls = "", text = ""): HTMLElement {
    const e = document.createElement(tag);
    if (id) e.id = id;
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
}

export class GameOverScreen {
    readonly root = el("div", "ui-stats");
    private readonly bg = el("div", "ui-stats-bg");
    private readonly contents = el("div", "ui-stats-contents");
    private readonly header = el("div", "ui-stats-header");
    private readonly infoBox = el("div", "ui-stats-info-box");
    private readonly options = el("div", "ui-stats-options");
    private readonly cb: GameOverCallbacks;
    private timed: Timed[] = [];
    private ticker = 0;
    private delay = LOSS_DELAY;
    private open = false;
    /** the screen shows a win (tests) */
    won = false;

    constructor(parent: HTMLElement, cb: GameOverCallbacks) {
        this.cb = cb;
        const inner = el("div", "ui-stats-contents-inner");
        inner.append(this.header, this.infoBox, this.options);
        this.contents.append(inner);
        this.root.append(this.bg, this.contents);
        this.root.style.display = "none";
        parent.append(this.root);
    }

    get visible(): boolean {
        return this.open;
    }

    /** Builds the screen for a GameOver result; it fades in after the original delay. */
    show(info: GameOverInfo): void {
        const ev = info.event;
        const won = ev.winningTeamId !== 0 && ev.winningTeamId === ev.teamId;
        this.won = won;
        this.delay = won ? WIN_DELAY : LOSS_DELAY;
        this.ticker = 0;
        this.open = true;
        this.timed = [];
        const title = won ? t("game-chicken") : `${t("game-You")} ${t("game-you-died")}.`;
        const overview = el("div", "", "ui-stats-header-overview");
        const rank = el("div", "");
        rank.append(
            el("span", "", "ui-stats-header-stat", `${t("game-solo-rank")} `),
            el("span", "", "ui-stats-header-value", `#${ev.teamRank}`),
        );
        overview.append(rank);
        this.header.replaceChildren(el("div", "", "ui-stats-header-title", title), overview);

        const stats = ev.playerStats[0] ?? info.stats;
        const card = el("div", "", `ui-stats-info-player${stats?.dead ? " ui-stats-info-status" : ""}`);
        const rows: HTMLElement[] = [el("div", "", "ui-stats-info-player-name", info.name)];
        if (stats) {
            const row = (label: string, value: string) => {
                const r = el("div", "", "ui-stats-info");
                r.append(el("div", "", "", label), el("div", "", "", value));
                return r;
            };
            rows.push(
                row(t("game-kills"), String(stats.kills)),
                row(t("game-damage-dealt"), String(stats.damageDealt)),
                row(t("game-damage-taken"), String(stats.damageTaken)),
                row(t("game-survived"), humanizeTime(stats.timeAlive)),
            );
        }
        card.append(...rows);
        this.infoBox.replaceChildren(card);
        this.timed.push({ el: card, at: this.delay + CARD_DELAY });
        rows.forEach((r, i) => {
            this.timed.push({ el: r, at: this.delay + CARD_DELAY + ELEM_FADE + i * ROW_DELAY });
        });

        const buttons: HTMLElement[] = [];
        const restart = this.button("ui-stats-restart btn-green btn-darken menu-option", t("game-play-new-game"), () =>
            this.cb.playAgain(),
        );
        buttons.push(restart);
        const canSpectate = !ev.gameOver && info.aliveCount > 0;
        if (canSpectate) {
            buttons.push(
                this.button("btn-green btn-darken menu-option ui-stats-spectate", t("game-spectate"), () =>
                    this.cb.spectate(),
                ),
            );
        } else {
            restart.classList.add("ui-stats-restart-wide");
        }
        this.options.replaceChildren(...buttons);
        const elemIdx = rows.length + 1;
        buttons.forEach((b, i) => {
            this.timed.push({
                el: b,
                at: this.delay + CARD_DELAY + (elemIdx + i) * ROW_DELAY + BUTTON_EXTRA_DELAY,
            });
        });
        for (const item of this.timed) item.el.style.opacity = "0";
        this.root.style.display = "block";
        this.update(0);
    }

    private button(cls: string, text: string, click: () => void): HTMLElement {
        const a = el("a", "", cls, text);
        a.setAttribute(HUD_INTERACTIVE_ATTR, "");
        a.addEventListener("click", (ev) => {
            ev.stopPropagation();
            if (Number(a.style.opacity) > 0.1) click();
        });
        a.addEventListener("mousedown", (ev) => ev.stopPropagation());
        return a;
    }

    hide(): void {
        this.open = false;
        this.root.style.display = "none";
    }

    update(dt: number): void {
        if (!this.open) return;
        this.ticker += dt;
        const screen = Math.min(1, Math.max(0, (this.ticker - this.delay) / SCREEN_FADE));
        this.bg.style.opacity = screen.toFixed(3);
        this.contents.style.opacity = screen.toFixed(3);
        this.bg.style.display = "block";
        for (const item of this.timed) {
            const o = Math.min(1, Math.max(0, (this.ticker - item.at) / ELEM_FADE));
            item.el.style.opacity = o.toFixed(3);
            item.el.style.pointerEvents = o > 0.1 ? "" : "none";
        }
    }

    /** All of the screen, buttons included, has faded in (tests). */
    get settled(): boolean {
        return this.open && this.timed.every((item) => this.ticker >= item.at + ELEM_FADE);
    }
}
