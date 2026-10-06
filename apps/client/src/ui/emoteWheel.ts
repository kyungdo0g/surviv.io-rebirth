// Emote and team ping wheels (survev client/src/emote.ts m_update / triggerPing / triggerEmote / inputReset,
// index.html #ui-emotes / #ui-team-pings; docs/research/ui/hud.md "Pings and emote wheel", controls.md binds 31-32):
// - hold the Emote Menu bind (right mouse) and the emote wheel opens at the cursor: four quarter wedges with the
//   loadout's emotes (top, right, bottom, left) around a close button; drag towards a wedge (35 px dead zone) and
//   release to send it;
// - hold Team Ping Hold (C) and then the right mouse button for the ping wheel: danger (top), coming (right), help
//   (bottom) and the team-only medical (bottom left) and ammo (top left, the held gun's ammo) emotes, greyed in solo.
//   A ping marks the world position under the point where the wheel opened: on the minimap that is the map position
//   there, else the world under the cursor (survev uiManager.getWorldPosFromMapPos / camera.screenToPoint);
// - the client throttle mirrors the server's: each emote or ping adds one, six in a row grey the wheels for 9 s, the
//   counter decays by one every 3 s; the wheel closes by itself after 10 s; the aim freezes while it is open.
// M8 touch (survev emote.ts touch listeners, ui2.ts #ui-emote-button; hud.md "Pings and emote wheel"): the emote button
// ("surviv icon") opens the emote wheel at the screen centre (`openTouchEmote`) and a tap on the open big map opens the
// ping wheel there (`openTouchPing`), whose map pings mark the tapped map point; tapping a wedge sends it at once, a
// tap anywhere else closes the wheel. Sending an emote from the ping wheel closes the big map (survev triggerPing).
import type { Vec2 } from "@rebirth/core";
import { GameConfig, GameObjectDefs, Input } from "@rebirth/defs";
import type { EmoteRequest } from "@rebirth/sim";
import { spriteUrl } from "../assets/hudImages.ts";
import type { InputManager } from "../input/input.ts";

/** survev emote.ts emoteTimeout */
const WHEEL_TIMEOUT = 10;
/** wedges highlight beyond this distance from the wheel centre (px) */
const DEAD_ZONE = 35;
/** survev multiplies both cooldowns by 1.5 */
const COOLDOWN_SCALE = 1.5;
const AMMO_EMOTES: Readonly<Record<string, string>> = {
    "9mm": "emote_ammo9mm",
    "12gauge": "emote_ammo12gauge",
    "762mm": "emote_ammo762mm",
    "556mm": "emote_ammo556mm",
    "50AE": "emote_ammo50ae",
    "308sub": "emote_ammo308sub",
    flare: "emote_ammoflare",
    "45acp": "emote_ammo45acp",
};

interface Wedge {
    parent: HTMLDivElement;
    image: HTMLDivElement;
    /** wedge spans the angles between vC and vA (degrees, counter-clockwise, +y up) */
    angleA: number;
    angleC: number;
    ping: string;
    emote: string;
    ammo?: boolean;
    close?: boolean;
    imageKey: string;
}

interface WedgeSpec {
    name: string;
    shape: "circle" | "quarter" | "eighth";
    vA: Vec2;
    vC: Vec2;
    ping?: string;
    emote?: string;
    ammo?: boolean;
    close?: boolean;
}

function degrees(v: Vec2): number {
    const a = (Math.atan2(v.y, v.x) * 180) / Math.PI;
    return a < 0 ? a + 360 : a;
}

/** survev emote.ts isAngleBetween */
function angleBetween(target: number, a1: number, a2: number): boolean {
    if (a1 <= a2) {
        if (a2 - a1 <= 180) return a1 <= target && target <= a2;
        return a2 <= target || target <= a1;
    }
    if (a1 - a2 <= 180) return a2 <= target && target <= a1;
    return a1 <= target || target <= a2;
}

function texture(type: string): string {
    return (GameObjectDefs[type] as { texture?: string } | undefined)?.texture ?? "";
}

function isTeamOnly(type: string): boolean {
    return !!(GameObjectDefs[type] as { teamOnly?: boolean } | undefined)?.teamOnly;
}

export interface EmoteWheelDeps {
    /** #ui-game */
    root: HTMLElement;
    send(req: EmoteRequest): void;
    /** world position a ping marks for a screen position (minimap or world view) */
    pingWorldPos(screen: Vec2): Vec2;
    /** touch devices: wedges take taps (M8) */
    touch?: boolean;
    /** an emote went out from the ping wheel: the big map closes (survev triggerPing, M8) */
    closeBigMap?(): void;
}

export interface EmoteWheelFrame {
    dt: number;
    input: InputManager;
    /** the local player is alive and not spectating */
    enabled: boolean;
    teamMode: number;
    /** ammo type of the held gun ("" for none): picks the ammo emote */
    ammo: string;
}

export class EmoteWheel {
    private readonly deps: EmoteWheelDeps;
    private readonly emoteWheel: HTMLDivElement;
    private readonly pingWheel: HTMLDivElement;
    private readonly emoteWedges: Wedge[];
    private readonly pingWedges: Wedge[];
    private pingKeyDown = false;
    private pingKeyTriggered = false;
    private pingMouseTriggered = false;
    private emoteMouseTriggered = false;
    private displayed: Wedge[] | null = null;
    private selected: Wedge | null = null;
    private screenPos: Vec2 = { x: 0, y: 0 };
    private timeout = 0;
    private counter = 0;
    private softTicker = 0;
    private hardTicker = 0;
    private greyed = false;
    private teamMode = 1;
    /** touch: where the open wheel was tapped (survev emoteTouchedPos), null before a tap */
    private touchPos: Vec2 | null = null;
    /** touch: the big map point a ping marks (survev bigmapPingPos) */
    private pingScreenPos: Vec2 | null = null;
    private readonly cleanups: Array<() => void> = [];
    /** requests sent (tests) */
    readonly sent: EmoteRequest[] = [];

    constructor(deps: EmoteWheelDeps) {
        this.deps = deps;
        const loadout = GameConfig.defaultEmoteLoadout;
        const slot = (i: number) => loadout[i] ?? "";
        const emoteSpecs: WedgeSpec[] = [
            { name: "middle", shape: "circle", vA: { x: -1, y: 1 }, vC: { x: 1, y: 1 }, close: true },
            { name: "top", shape: "quarter", vA: { x: -1, y: 1 }, vC: { x: 1, y: 1 }, emote: slot(0) },
            { name: "right", shape: "quarter", vA: { x: 1, y: 1 }, vC: { x: 1, y: -1 }, emote: slot(1) },
            { name: "bottom", shape: "quarter", vA: { x: 1, y: -1 }, vC: { x: -1, y: -1 }, emote: slot(2) },
            { name: "left", shape: "quarter", vA: { x: -1, y: -1 }, vC: { x: -1, y: 1 }, emote: slot(3) },
        ];
        const pingSpecs: WedgeSpec[] = [
            { name: "middle", shape: "circle", vA: { x: -1, y: 1 }, vC: { x: 1, y: 1 }, close: true },
            { name: "top", shape: "quarter", vA: { x: -1, y: 1 }, vC: { x: 1, y: 1 }, ping: "ping_danger" },
            { name: "right", shape: "quarter", vA: { x: 1, y: 1 }, vC: { x: 1, y: -1 }, ping: "ping_coming" },
            { name: "bottom", shape: "quarter", vA: { x: 1, y: -1 }, vC: { x: -1, y: -1 }, ping: "ping_help" },
            {
                name: "bottom-left",
                shape: "eighth",
                vA: { x: -1, y: -1 },
                vC: { x: -1, y: 0 },
                emote: "emote_medical",
            },
            {
                name: "top-left",
                shape: "eighth",
                vA: { x: -1, y: 0 },
                vC: { x: -1, y: 1 },
                emote: "emote_ammo",
                ammo: true,
            },
        ];
        this.emoteWheel = this.buildWheel("ui-emotes", "ui-emote", emoteSpecs);
        this.pingWheel = this.buildWheel("ui-team-pings", "ui-team-ping", pingSpecs);
        this.emoteWedges = this.wedgesOf(this.emoteWheel, emoteSpecs);
        this.pingWedges = this.wedgesOf(this.pingWheel, pingSpecs);
        deps.root.append(this.emoteWheel, this.pingWheel);
        if (deps.touch) this.bindTouch();
    }

    /** Touch listeners (survev emote.ts): wedge taps select, any other tap while a wheel is open closes it. */
    private bindTouch(): void {
        const onWedge = (e: TouchEvent) => {
            e.stopPropagation();
            const t = e.changedTouches[0];
            if (t) this.touchPos = { x: t.clientX, y: t.clientY };
        };
        for (const wheel of [this.emoteWheel, this.pingWheel]) {
            wheel.classList.add("ui-emote-touch");
            for (const node of wheel.querySelectorAll<HTMLElement>(".ui-emote")) {
                node.addEventListener("touchstart", onWedge, { passive: true });
                this.cleanups.push(() => node.removeEventListener("touchstart", onWedge));
            }
        }
        const onDocument = () => {
            if (this.open) this.reset();
        };
        document.addEventListener("touchstart", onDocument, { passive: true });
        this.cleanups.push(() => document.removeEventListener("touchstart", onDocument));
    }

    /** Touch: the emote button opens the emote wheel at `center` (the screen centre). */
    openTouchEmote(center: Vec2): void {
        if (this.pingMouseTriggered || this.emoteMouseTriggered) return;
        this.screenPos = { x: center.x, y: center.y };
        this.emoteMouseTriggered = true;
    }

    /** Touch: a tap on the open big map at `mapPoint` opens the ping wheel at `center` (the screen centre). */
    openTouchPing(center: Vec2, mapPoint: Vec2): void {
        this.reset();
        this.screenPos = { x: center.x, y: center.y };
        this.pingScreenPos = { x: mapPoint.x, y: mapPoint.y };
        this.pingMouseTriggered = true;
    }

    private buildWheel(id: string, prefix: string, specs: WedgeSpec[]): HTMLDivElement {
        const wheel = document.createElement("div");
        wheel.id = id;
        wheel.className = "ui-emote-wheel";
        for (const s of specs) {
            const parent = document.createElement("div");
            parent.id = `${prefix}-${s.name}`;
            parent.className = `ui-emote-${s.name} ui-emote-${s.shape} ui-emote-parent`;
            const bg = document.createElement("div");
            bg.className = `ui-emote ui-emote-bg-${s.shape}`;
            const hl = document.createElement("div");
            hl.className = "ui-emote ui-emote-hl";
            const image = document.createElement("div");
            image.className = `ui-emote-image ${s.shape === "eighth" ? "ui-emote-image-small" : "ui-emote-image-large"}`;
            parent.append(bg, hl, image);
            wheel.append(parent);
        }
        return wheel;
    }

    private wedgesOf(wheel: HTMLDivElement, specs: WedgeSpec[]): Wedge[] {
        return specs.map((s, i) => {
            const parent = wheel.children[i] as HTMLDivElement;
            const wedge: Wedge = {
                parent,
                image: parent.lastElementChild as HTMLDivElement,
                angleA: degrees(s.vA),
                angleC: degrees(s.vC),
                ping: s.ping ?? "",
                emote: s.emote ?? "",
                ammo: s.ammo,
                close: s.close,
                imageKey: "",
            };
            this.setImage(wedge);
            return wedge;
        });
    }

    /** The emote loadout of the game (the Joined message): slots 0-3 go top, right, bottom, left. */
    setLoadout(loadout: readonly string[]): void {
        for (let i = 0; i < 4; i++) {
            const w = this.emoteWedges[i + 1];
            const type = loadout[i] ?? "";
            const def = GameObjectDefs[type] as { type?: string } | undefined;
            if (!w || def?.type !== "emote" || w.emote === type) continue;
            w.emote = type;
            this.setImage(w);
        }
    }

    private setImage(w: Wedge): void {
        const sprite = w.close ? "close.img" : texture(w.ping || w.emote);
        if (sprite === w.imageKey) return;
        w.imageKey = sprite;
        const url = spriteUrl(sprite);
        w.image.style.backgroundImage = url ? `url(${url})` : "";
    }

    /** a wheel is open */
    get open(): boolean {
        return this.displayed !== null;
    }

    /** which wheel is open (tests) */
    get openWheel(): "emote" | "ping" | null {
        if (!this.displayed) return null;
        return this.displayed === this.pingWedges ? "ping" : "emote";
    }

    /** where the open wheel is centred (the frozen aim point) */
    get center(): Vec2 {
        return this.screenPos;
    }

    update(frame: EmoteWheelFrame): void {
        const input = frame.input;
        this.teamMode = frame.teamMode;
        this.updateThrottle(frame.dt);
        // survev: losing focus resets the wheels (the releases it causes must not send anything)
        if (!frame.enabled || input.lostFocus) {
            if (this.open || this.pingKeyDown) this.reset();
            this.pingKeyDown = false;
            return;
        }
        const mouse = input.mouse;
        if (input.wasBindPressed(Input.TeamPingMenu) && !this.pingKeyDown) {
            this.pingKeyDown = true;
            this.pingKeyTriggered = true;
        }
        if (input.wasBindReleased(Input.TeamPingMenu) && this.pingKeyDown) {
            this.pingKeyDown = false;
            this.pingKeyTriggered = this.open;
        }
        if (input.wasBindPressed(Input.EmoteMenu)) {
            if (!this.pingMouseTriggered && !this.emoteMouseTriggered && this.pingKeyDown) {
                this.screenPos = { x: mouse.x, y: mouse.y };
                this.pingMouseTriggered = true;
            }
            if (!this.pingMouseTriggered) {
                this.screenPos = { x: mouse.x, y: mouse.y };
                this.emoteMouseTriggered = true;
            }
        }
        if (input.wasBindReleased(Input.EmoteMenu)) {
            this.select(mouse, frame.ammo);
            if (this.pingKeyTriggered && this.pingMouseTriggered) this.triggerPing();
            else if (this.emoteMouseTriggered) this.triggerEmote();
        }
        if ((this.pingMouseTriggered || this.emoteMouseTriggered) && !this.open) this.show();
        if (!this.open) return;
        this.timeout += frame.dt;
        if (this.timeout > WHEEL_TIMEOUT) {
            this.reset();
            return;
        }
        if (!this.deps.touch) {
            this.select(mouse, frame.ammo);
            return;
        }
        // touch: the tapped wedge is sent at once (survev m_update: mousePos = emoteTouchedPos)
        if (!this.touchPos) return;
        this.select(this.touchPos, frame.ammo);
        if (!this.selected) return;
        if (this.pingMouseTriggered) this.triggerPing();
        else this.triggerEmote();
    }

    private updateThrottle(dt: number): void {
        const threshold = GameConfig.player.emoteThreshold;
        this.softTicker -= dt;
        if (this.counter >= threshold && this.hardTicker > 0) {
            this.hardTicker -= dt;
            if (this.hardTicker < 0) this.counter = 0;
        } else if (this.softTicker < 0 && this.counter > 0) {
            this.counter--;
            this.softTicker = GameConfig.player.emoteSoftCooldown * COOLDOWN_SCALE;
        }
        const greyed = this.hardTicker > 0;
        if (greyed !== this.greyed) {
            this.greyed = greyed;
            this.emoteWheel.classList.toggle("ui-emote-greyed", greyed);
            this.pingWheel.classList.toggle("ui-emote-greyed", greyed);
        }
    }

    private show(): void {
        const ping = this.pingMouseTriggered;
        const wheel = ping ? this.pingWheel : this.emoteWheel;
        wheel.style.display = "block";
        wheel.style.left = `${this.screenPos.x}px`;
        wheel.style.top = `${this.screenPos.y}px`;
        this.displayed = ping ? this.pingWedges : this.emoteWedges;
        this.selected = null;
        this.timeout = 0;
        for (const w of this.displayed) {
            w.parent.classList.remove("ui-emote-selected");
            w.parent.classList.toggle("ui-emote-disabled", this.disabledInMode(w));
        }
    }

    private disabledInMode(w: Wedge): boolean {
        return this.teamMode <= 1 && isTeamOnly(w.emote);
    }

    /** Highlights the wedge under the cursor (survev m_update selector loop). */
    private select(mouse: Vec2, ammo: string): void {
        const wedges = this.displayed;
        if (!wedges) return;
        const v = { x: mouse.x - this.screenPos.x, y: -(mouse.y - this.screenPos.y) };
        const dist = Math.hypot(v.x, v.y);
        const angle = degrees(v);
        let selected: Wedge | null = null;
        for (const w of wedges) {
            if (w.ammo) {
                w.emote = AMMO_EMOTES[ammo] ?? "emote_ammo";
                this.setImage(w);
            }
            const target = w.ping || w.emote;
            if (this.hardTicker > 0 || this.disabledInMode(w)) continue;
            if (dist <= DEAD_ZONE && !target) selected = w;
            else if (dist > DEAD_ZONE && target && angleBetween(angle, w.angleC, w.angleA)) selected = w;
        }
        if (selected === this.selected) return;
        this.selected?.parent.classList.remove("ui-emote-selected");
        selected?.parent.classList.add("ui-emote-selected");
        this.selected = selected;
    }

    private triggerPing(): void {
        const s = this.selected;
        if (s && !this.greyed) {
            const def = GameObjectDefs[s.ping] as { pingMap?: boolean } | undefined;
            if (s.ping && def?.pingMap) {
                const at = this.pingScreenPos ?? this.screenPos;
                this.send({ type: s.ping, isPing: true, pos: this.deps.pingWorldPos(at) });
            } else if (s.emote) {
                this.send({ type: s.emote, isPing: false });
                this.deps.closeBigMap?.();
            }
        }
        this.reset();
        this.pingKeyTriggered = this.pingKeyDown;
    }

    private triggerEmote(): void {
        const s = this.selected;
        if (s?.emote && !this.greyed) this.send({ type: s.emote, isPing: false });
        this.reset();
    }

    private send(req: EmoteRequest): void {
        this.sent.push(req);
        this.deps.send(req);
        this.counter++;
        if (this.counter >= GameConfig.player.emoteThreshold && !(this.hardTicker > 0)) {
            this.hardTicker = GameConfig.player.emoteHardCooldown * COOLDOWN_SCALE;
        }
    }

    /** Closes the wheels and drops the pending triggers (survev inputReset). */
    reset(): void {
        this.pingMouseTriggered = false;
        this.pingKeyTriggered = false;
        this.emoteMouseTriggered = false;
        this.displayed = null;
        this.selected = null;
        this.timeout = 0;
        this.touchPos = null;
        this.pingScreenPos = null;
        this.emoteWheel.style.display = "none";
        this.pingWheel.style.display = "none";
        for (const w of [...this.emoteWedges, ...this.pingWedges]) w.parent.classList.remove("ui-emote-selected");
    }

    destroy(): void {
        for (const fn of this.cleanups.splice(0)) fn();
        this.emoteWheel.remove();
        this.pingWheel.remove();
    }
}
