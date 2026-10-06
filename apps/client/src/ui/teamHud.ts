// Team HUD (duo / squad; survev client/src/ui/ui.ts updateTeam / updateHealthBar and the team indicator loop of m_update,
// docs/research/ui/hud.md "Team HUD"): one row per group member (the viewer included) in join order with the name, the
// member's group colour swatch (yellow, magenta, cyan, orange), a 200 px health bar in the teammate palette (grey at
// 100, white down to 75, pink below, a pulsing red bar at 25 and under, red while downed) and a status icon (pulsing
// "down", skull when dead, a cross when disconnected; the name fades to 30 % when dead or disconnected). Off-screen
// living teammates get an indicator at the screen edge, 32 px in, turned towards them. The spectate buttons move below
// the rows (rows x 48 + 12 px). M8 small layout (hudSm.css): 110 px rows right of the minimap, indicators 16 px in at
// half size (survev ui.ts layoutSm).
import { GameConfig } from "@rebirth/defs";
import type { TeamMemberView } from "@rebirth/sim";
import type { Camera } from "../render/camera.ts";
import "./team.css";

/** survev ui.ts teamMemberHeight */
const ROW_HEIGHT = 48;
const EDGE_OFFSET = 32;
const EDGE_OFFSET_SM = 16;

/** CSS colour of group colour slot `idx` (GameConfig.groupColors). */
export function groupColorCss(idx: number): string {
    const c = GameConfig.groupColors[idx] ?? 0xffffff;
    return `#${c.toString(16).padStart(6, "0")}`;
}

/** Background colour of a teammate's bar (survev ui.ts updateHealthBar, including its Interpolate(45) quirk). */
export function teamHealthColor(health: number, downed: boolean): string | null {
    if (health <= 25) return null;
    if (downed) return "red";
    let a = [255, 45, 45];
    let b = [255, 112, 112];
    if (Math.abs(health - 100) <= 0.2) {
        a = [179, 179, 179];
        b = a;
    } else if (health >= 75 - 0.2) {
        a = [255, 255, 255];
        b = a;
    }
    const c = [0, 1, 2].map((i) => Math.floor(a[i] + ((b[i] - a[i]) / 45) * health));
    return `rgba(${c[0]},${c[1]},${c[2]},1)`;
}

interface Row {
    div: HTMLDivElement;
    name: HTMLDivElement;
    color: HTMLDivElement;
    status: HTMLDivElement;
    bar: HTMLDivElement;
    key: string;
}

interface Indicator {
    div: HTMLDivElement;
    shown: boolean;
}

export interface TeamHudFrame {
    team: readonly TeamMemberView[] | undefined;
    /** the followed player (indicators are not drawn for it) */
    activeId: number;
    camera: Camera;
    /** interpolated position of a member drawn this frame, else null (the status position is used) */
    visualPos(id: number): { x: number; y: number } | null;
    /** faction maps show no edge indicators (survev ui.ts: `!factionMode`) (M7) */
    factionMode?: boolean;
    /** the small layout: indicators 16 px in at half size (survev ui.ts m_update layoutSm, M8) */
    small?: boolean;
}

export class TeamHud {
    readonly root: HTMLDivElement;
    private readonly list: HTMLDivElement;
    private readonly indicators: HTMLDivElement;
    private readonly rows: Row[] = [];
    private readonly arrows: Indicator[] = [];
    private readonly hudRoot: HTMLElement;
    private shownRows = -1;

    constructor(hudRoot: HTMLElement) {
        this.hudRoot = hudRoot;
        this.list = document.createElement("div");
        this.list.id = "ui-team";
        this.root = document.createElement("div");
        this.root.id = "ui-top-left";
        this.root.append(this.list);
        this.indicators = document.createElement("div");
        this.indicators.id = "ui-team-indicators";
        for (let i = 0; i < 4; i++) {
            this.rows.push(this.createRow(i));
            const div = document.createElement("div");
            div.className = "ui-team-indicator ui-indicator-main";
            div.dataset.id = String(i);
            const pos = document.createElement("div");
            pos.className = "ui-team-indicator-pos";
            pos.style.backgroundColor = groupColorCss(i);
            div.append(pos);
            this.indicators.append(div);
            this.arrows.push({ div, shown: false });
        }
        hudRoot.prepend(this.indicators, this.root);
    }

    private createRow(i: number): Row {
        const div = document.createElement("div");
        div.className = "ui-team-member";
        div.dataset.id = String(i);
        div.style.display = "none";
        const name = document.createElement("div");
        name.className = "ui-team-member-name";
        const color = document.createElement("div");
        color.className = "ui-team-member-color";
        color.style.backgroundColor = groupColorCss(i);
        const status = document.createElement("div");
        status.className = "ui-team-member-status";
        const health = document.createElement("div");
        health.className = "ui-team-member-health";
        const bar = document.createElement("div");
        bar.className = "ui-bar-inner";
        health.append(bar);
        div.append(name, color, status, health);
        this.list.append(div);
        return { div, name, color, status, bar, key: "" };
    }

    /** rows shown (tests) */
    get memberCount(): number {
        return Math.max(0, this.shownRows);
    }

    update(frame: TeamHudFrame): void {
        const team = frame.team ?? [];
        if (team.length !== this.shownRows) {
            this.shownRows = team.length;
            this.rows.forEach((r, i) => {
                r.div.style.display = i < team.length ? "block" : "none";
            });
            // the spectate buttons sit under the rows (survev ui.ts spectateOptionsWrapper top)
            const spectate = this.hudRoot.querySelector<HTMLElement>("#ui-spectate-options-wrapper");
            if (spectate) spectate.style.top = `${team.length > 0 ? team.length * ROW_HEIGHT + 12 : 12}px`;
        }
        for (let i = 0; i < this.rows.length; i++) {
            const m = team[i];
            if (m) this.updateRow(this.rows[i], m);
            this.updateIndicator(this.arrows[i], m, frame);
        }
    }

    private updateRow(row: Row, m: TeamMemberView): void {
        const health = Math.round(m.health * 10) / 10;
        const key = `${m.playerId}|${m.name}|${health}|${m.downed}|${m.dead}|${m.disconnected}`;
        if (key === row.key) return;
        row.key = key;
        row.div.dataset.playerId = String(m.playerId);
        row.name.textContent = m.name;
        // a share of the bar's CSS width (200 px, 110 px on the small layout; survev reads it from the CSS), >= 1 px
        row.bar.style.width = m.dead ? "0px" : `max(${health}%, 1px)`;
        const color = teamHealthColor(health, m.downed);
        row.bar.classList.toggle("ui-bar-danger", color === null);
        row.bar.style.backgroundColor = color ?? "";
        let status = "ui-team-member-status";
        if (m.disconnected) status += " ui-team-member-status-disconnected";
        else if (m.dead) status += " ui-team-member-status-dead";
        else if (m.downed) status += " ui-team-member-status-downed icon-pulse";
        row.status.className = status;
        row.name.style.opacity = m.disconnected || m.dead ? "0.3" : "1";
        row.div.dataset.state = m.dead ? "dead" : m.disconnected ? "disconnected" : m.downed ? "downed" : "alive";
    }

    /** Edge indicator of an off-screen living teammate (survev ui.ts: rot = atan2(dir.y, -dir.x) - PI / 2). */
    private updateIndicator(ind: Indicator, m: TeamMemberView | undefined, frame: TeamHudFrame): void {
        let show = false;
        if (m && m.playerId !== frame.activeId && !m.dead && !frame.factionMode) {
            const cam = frame.camera;
            const pos = frame.visualPos(m.playerId) ?? m.pos;
            const view = cam.viewBounds();
            const rad = GameConfig.player.radius;
            const onscreen =
                pos.x + rad >= view.min.x &&
                pos.x - rad <= view.max.x &&
                pos.y + rad >= view.min.y &&
                pos.y - rad <= view.max.y;
            if (!onscreen) {
                const dx = pos.x - cam.pos.x;
                const dy = pos.y - cam.pos.y;
                const len = Math.hypot(dx, dy);
                const dir = len > 1e-6 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 };
                const hx = (view.max.x - view.min.x) / 2;
                const hy = (view.max.y - view.min.y) / 2;
                const t = Math.min(
                    Math.abs(dir.x) > 1e-6 ? hx / Math.abs(dir.x) : Number.POSITIVE_INFINITY,
                    Math.abs(dir.y) > 1e-6 ? hy / Math.abs(dir.y) : Number.POSITIVE_INFINITY,
                );
                const edge = cam.worldToScreen({ x: cam.pos.x + dir.x * t, y: cam.pos.y + dir.y * t });
                const off = frame.small ? EDGE_OFFSET_SM : EDGE_OFFSET;
                const x = Math.min(Math.max(edge.x, off), cam.screenWidth - off);
                const y = Math.min(Math.max(edge.y, off), cam.screenHeight - off);
                const rot = Math.atan2(dir.y, -dir.x) - Math.PI * 0.5;
                ind.div.style.left = `${x.toFixed(1)}px`;
                ind.div.style.top = `${y.toFixed(1)}px`;
                const half = frame.small ? " scale(0.5)" : "";
                ind.div.style.transform = `translate(-50%, -50%) rotate(${rot.toFixed(3)}rad)${half}`;
                show = true;
            }
        }
        if (show !== ind.shown) {
            ind.shown = show;
            ind.div.style.display = show ? "block" : "none";
        }
    }

    /** indicators shown (tests) */
    get indicatorCount(): number {
        return this.arrows.filter((a) => a.shown).length;
    }

    clear(): void {
        this.shownRows = -1;
        for (const r of this.rows) r.key = "";
        this.update({
            team: [],
            activeId: -1,
            camera: null as unknown as Camera,
            visualPos: () => null,
        });
    }

    destroy(): void {
        this.root.remove();
        this.indicators.remove();
    }
}
