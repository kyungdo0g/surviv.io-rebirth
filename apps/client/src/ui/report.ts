// Player reports (M8, rebirth: the original client had no report button): network games only. The death / result
// screen offers "Report" for the player who killed the local player, the spectate options for the player being
// watched. The dialog picks a reason (packages/protocol REPORT_REASONS) and optional details (at most
// REPORT_TEXT_MAX_LENGTH characters), then POSTs /api/report to the game server with the game connection's join token
// (protocol report.ts submitReport); a toast shows the result, every refusal code with its own text.
import { REPORT_REASONS, REPORT_TEXT_MAX_LENGTH, type ReportReasonValue, type ReportResponse } from "@rebirth/protocol";
import { HUD_INTERACTIVE_ATTR } from "../input/input.ts";
import { t, tryT } from "../l10n/index.ts";
import { applyL10n, h } from "../menu/dom.ts";
import { showToast } from "./toast.ts";
import "./settings.css";

export interface ReportTarget {
    playerId: number;
    name: string;
}

export interface ReportRequestFields {
    playerId: number;
    reason: ReportReasonValue;
    text?: string;
}

/** Toast text of a report answer (every ReportError code, plus network / HTTP failures). */
export function reportResultText(res: ReportResponse): string {
    if (res.ok) return t("game-report-sent");
    return tryT(`game-report-error-${res.error}`) || t("game-report-error");
}

class ReportDialog {
    readonly root: HTMLDivElement;
    private readonly title: HTMLDivElement;
    private readonly reasons = new Map<ReportReasonValue, HTMLAnchorElement>();
    private readonly text: HTMLTextAreaElement;
    private readonly count: HTMLDivElement;
    private readonly submitBtn: HTMLAnchorElement;
    private readonly submit: (req: ReportRequestFields) => Promise<ReportResponse>;
    private target: ReportTarget | null = null;
    private reason: ReportReasonValue | null = null;
    private sending = false;

    constructor(parent: HTMLElement, submit: (req: ReportRequestFields) => Promise<ReportResponse>) {
        this.submit = submit;
        this.title = h("div", { cls: "ui-report-target" });
        const reasonRow = h("div", { cls: "ui-report-reasons" });
        for (const reason of REPORT_REASONS) {
            const b = h("a", {
                cls: "btn-game-menu btn-darken btn-report-reason",
                l10n: `game-report-reason-${reason}`,
                click: () => this.pick(reason),
            });
            b.dataset.reason = reason;
            this.reasons.set(reason, b);
            reasonRow.append(b);
        }
        this.text = h("textarea", { id: "ui-report-text", cls: "ui-report-text" });
        this.text.maxLength = REPORT_TEXT_MAX_LENGTH;
        this.text.addEventListener("input", () => this.updateCount());
        this.count = h("div", { cls: "ui-report-count" });
        this.submitBtn = h("a", {
            id: "btn-report-submit",
            cls: "btn-game-menu btn-darken btn-report",
            l10n: "game-report-submit",
            click: () => void this.send(),
        });
        const content = h(
            "div",
            { cls: "modal-content" },
            h(
                "div",
                { cls: "modal-header" },
                h("span", { cls: "close close-corner", click: () => this.close() }),
                h("h2", { l10n: "game-report-player" }),
            ),
            h(
                "div",
                { cls: "modal-body" },
                this.title,
                h("p", { l10n: "game-report-reason" }),
                reasonRow,
                h("p", { l10n: "game-report-details" }),
                this.text,
                this.count,
                h(
                    "div",
                    { cls: "ui-report-buttons" },
                    this.submitBtn,
                    h("a", {
                        id: "btn-report-cancel",
                        cls: "btn-game-menu btn-darken",
                        l10n: "game-cancel",
                        click: () => this.close(),
                    }),
                ),
            ),
        );
        this.root = h("div", { id: "ui-report-modal", cls: "ui-report-modal" }, content);
        this.root.setAttribute(HUD_INTERACTIVE_ATTR, "");
        this.root.hidden = true;
        this.root.addEventListener("mousedown", (ev) => ev.stopPropagation());
        parent.append(this.root);
    }

    get visible(): boolean {
        return !this.root.hidden;
    }

    open(target: ReportTarget): void {
        this.target = target;
        this.reason = null;
        this.sending = false;
        this.text.value = "";
        applyL10n(this.root);
        this.title.textContent = target.name;
        for (const b of this.reasons.values()) b.classList.remove("btn-report-reason-selected");
        this.updateCount();
        this.updateSubmit();
        this.root.hidden = false;
    }

    close(): void {
        this.root.hidden = true;
        this.target = null;
    }

    private pick(reason: ReportReasonValue): void {
        this.reason = reason;
        for (const [r, b] of this.reasons) b.classList.toggle("btn-report-reason-selected", r === reason);
        this.updateSubmit();
    }

    private updateCount(): void {
        this.count.textContent = `${this.text.value.length} / ${REPORT_TEXT_MAX_LENGTH}`;
    }

    private updateSubmit(): void {
        this.submitBtn.classList.toggle("btn-disabled", !this.reason || this.sending);
    }

    private async send(): Promise<void> {
        const target = this.target;
        if (!target || !this.reason || this.sending) return;
        this.sending = true;
        this.updateSubmit();
        const text = this.text.value.trim().slice(0, REPORT_TEXT_MAX_LENGTH);
        const res = await this.submit({ playerId: target.playerId, reason: this.reason, ...(text ? { text } : {}) });
        this.close();
        showToast(reportResultText(res), { error: !res.ok });
    }

    destroy(): void {
        this.root.remove();
    }
}

export interface ReportFlowDeps {
    /** parent of the dialog */
    parent: HTMLElement;
    /** #ui-game (the spectate options live there) */
    hudRoot: HTMLElement;
    /** sends the report (submitReport against the game server with the join token) */
    submit(req: ReportRequestFields): Promise<ReportResponse>;
    /** who killed the local player, null when nobody (red zone, a win) */
    killer(): ReportTarget | null;
    /** the player being watched while spectating, else null */
    spectated(): ReportTarget | null;
}

export class ReportFlow {
    private readonly deps: ReportFlowDeps;
    private readonly dialog: ReportDialog;
    private readonly spectateButton: HTMLAnchorElement;
    /** reports answered (tests) */
    results: ReportResponse[] = [];

    constructor(deps: ReportFlowDeps) {
        this.deps = deps;
        this.dialog = new ReportDialog(deps.parent, async (req) => {
            const res = await deps.submit(req);
            this.results.push(res);
            return res;
        });
        this.spectateButton = this.button("btn-spectate-report", "menu-option btn-darken btn-report", () => {
            const target = deps.spectated();
            if (target) this.dialog.open(target);
        });
        this.spectateButton.style.display = "none";
    }

    private button(id: string, cls: string, click: () => void): HTMLAnchorElement {
        const a = h("a", { id, cls, l10n: "game-report" });
        a.setAttribute(HUD_INTERACTIVE_ATTR, "");
        a.addEventListener("click", (ev) => {
            ev.stopPropagation();
            click();
        });
        a.addEventListener("mousedown", (ev) => ev.stopPropagation());
        return a;
    }

    get dialogOpen(): boolean {
        return this.dialog.visible;
    }

    closeDialog(): void {
        this.dialog.close();
    }

    /** The death / result screen's Report button for the killer, or null when there is nobody to report. */
    statsButton(): HTMLElement | null {
        const killer = this.deps.killer();
        if (!killer) return null;
        return this.button("btn-stats-report", "btn-darken menu-option ui-stats-report btn-report", () => {
            this.dialog.open(killer);
        });
    }

    /** Per frame: the spectate options' Report button follows the watched player. */
    update(): void {
        const target = this.deps.spectated();
        if (!this.spectateButton.isConnected) {
            const buttons = this.deps.hudRoot.querySelector("#ui-spectate-buttons");
            if (!buttons) return;
            buttons.append(this.spectateButton);
        }
        const display = target ? "" : "none";
        if (this.spectateButton.style.display !== display) this.spectateButton.style.display = display;
    }

    destroy(): void {
        this.dialog.destroy();
        this.spectateButton.remove();
    }
}
