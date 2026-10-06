// M8 glue of the in-game client: the in-game (Esc) menu, the touch controls (sticks, aim line, touch HUD buttons), the
// report flow of network games and the settings that act on a running game (screen shake; volumes and mute go through
// the shared audio engine, audio/shared.ts). Keys: Escape closes the big map first, else toggles the menu (survev
// game.ts / ui.ts toggleEscMenu); the Full Screen bind (L) toggles full screen; N mutes while unbound (rebirth).
// M8 HUD toggles (survev game.ts, ui.ts cycleVisibilityMode / cycleHud; hud.md "Minimap and full map"): Toggle Minimap
// (V) hides / shows the minimap while the big map is closed; Hide UI (unbound) hides the whole HUD and the minimap, and
// Escape brings a hidden HUD back. The in-game menu hides the perk-mode class picker while it is open. Touch: the
// emote button opens the emote wheel at the screen centre, a tap on the minimap opens the big map and a tap on the open
// big map opens the ping wheel for that point (survev emote.ts bigmapCollision touchend).
import type { Vec2 } from "@rebirth/core";
import { Input, WeaponSlot } from "@rebirth/defs";
import type { LocalPlayerState } from "@rebirth/sim";
import type { Application } from "pixi.js";
import type { TextureStore } from "../assets/textures.ts";
import { toggleMute } from "../audio/shared.ts";
import { config } from "../config.ts";
import { AimLine } from "../input/aimLine.ts";
import type { InputManager, TouchSample } from "../input/input.ts";
import { MENU_KEY, MuteBind } from "../input/keybinds.ts";
import { TouchControls } from "../input/touch.ts";
import type { ObjectWorld } from "../objects/world.ts";
import type { Camera } from "../render/camera.ts";
import type { Renderer } from "../render/renderer.ts";
import type { EmoteWheel } from "../ui/emoteWheel.ts";
import { GameMenu } from "../ui/gameMenu.ts";
import type { Minimap } from "../ui/minimap.ts";
import { MinimapButtons } from "../ui/minimapButtons.ts";
import { ReportFlow, type ReportFlowDeps } from "../ui/report.ts";
import { toggleFullscreen } from "../ui/settingsControls.ts";
import { TouchHud } from "../ui/touchHud.ts";
import { type HudLayout, hudScale } from "../ui/uiLayout.ts";
import type { MatchUi } from "./match.ts";
import type { ModeUi } from "./modes.ts";

export interface ClientControlsDeps {
    app: Application;
    renderer: Renderer;
    textures: TextureStore;
    camera: Camera;
    input: InputManager;
    /** #ui-game */
    hudRoot: HTMLElement;
    /** parent of the menu and dialogs */
    parent: HTMLElement;
    touch: boolean;
    modes: ModeUi;
    match: MatchUi;
    /** the emote / ping wheels (touch opens them from the emote button and the big map) */
    emoteWheel: EmoteWheel;
    layout: HudLayout;
    minimap(): Minimap | null;
    /** Quit Game */
    quit(): void;
    /** network games: sends a report (null hides the Report buttons) */
    report: ReportFlowDeps["submit"] | null;
}

export interface ControlsFrame {
    dt: number;
    world: ObjectWorld | null;
    local: LocalPlayerState | null;
    /** where the followed player is drawn */
    pos: Vec2;
    spectating: boolean;
}

export class ClientControls {
    readonly menu: GameMenu;
    readonly touch: TouchControls | null = null;
    readonly aimLine: AimLine | null = null;
    readonly touchHud: TouchHud | null = null;
    /** the desktop minimap's magnifier and minimize buttons */
    readonly mapButtons: MinimapButtons | null = null;
    readonly report: ReportFlow | null = null;
    private readonly deps: ClientControlsDeps;
    private readonly unsubscribe: () => void;
    /** the last touch input (tests) */
    lastTouch: TouchSample | null = null;
    /** Toggle Minimap (V) hid the minimap (survev ui.ts visibilityMode 1) */
    minimapHidden = false;
    /** Hide UI hid the HUD (survev ui.ts hudVisible false) */
    hudHidden = false;

    constructor(deps: ClientControlsDeps) {
        this.deps = deps;
        this.menu = new GameMenu(
            deps.parent,
            {
                quit: () => deps.quit(),
                toggled: (open) => deps.modes.roleMenu.setSuppressed(open),
            },
            deps.touch,
        );
        if (deps.touch) {
            const touch = new TouchControls({
                textures: deps.textures,
                target: deps.app.canvas,
                mapRect: () => deps.minimap()?.tapRect ?? null,
                mapTapped: (pos) => this.mapTapped(pos),
            });
            deps.renderer.overlay.addChild(touch.container);
            this.touch = touch;
            this.aimLine = new AimLine(deps.renderer, deps.textures);
            this.touchHud = new TouchHud(deps.hudRoot, {
                action: (a) => deps.input.queueAction(a),
                openMenu: () => this.menu.show(),
                closeBigMap: () => deps.modes.setBigMap(false),
                openEmoteWheel: () => deps.emoteWheel.openTouchEmote(this.screenCenter()),
            });
        }
        if (!deps.touch) {
            this.mapButtons = new MinimapButtons(deps.hudRoot, {
                // survev ui.ts: the magnifier toggles the big map on the large layout; minimize toggles the minimap
                toggleBigMap: () => deps.modes.setBigMap(!deps.modes.bigMap),
                toggleMinimap: () => {
                    if (!deps.modes.bigMap) this.minimapHidden = !this.minimapHidden;
                },
            });
        }
        const submit = deps.report;
        if (submit) {
            const match = deps.match;
            const target = (id: number) => (id ? { playerId: id, name: match.name(id) } : null);
            this.report = new ReportFlow({
                parent: deps.parent,
                hudRoot: deps.hudRoot,
                submit,
                killer: () => target(match.killerId),
                spectated: () => (match.spectating ? target(match.activeId) : null),
            });
        }
        const cfg = config();
        deps.camera.shakeEnabled = cfg.get("screenShake");
        this.unsubscribe = cfg.onChange((key) => {
            if (key === "screenShake") deps.camera.shakeEnabled = cfg.get("screenShake");
        });
    }

    private screenCenter(): Vec2 {
        const screen = this.deps.app.screen;
        return { x: screen.width / 2, y: screen.height / 2 };
    }

    /** Touch: the minimap opens the big map; a tap on the big map opens the ping wheel for that point. */
    private mapTapped(pos: Vec2): void {
        if (this.deps.modes.bigMap) this.deps.emoteWheel.openTouchPing(this.screenCenter(), pos);
        else this.deps.modes.setBigMap(true);
    }

    /**
     * Client-only keys of this frame: the menu / big map (Escape), Toggle Minimap, Hide UI, full screen and mute
     * (survev game.ts: Escape toggles the menu and also restores a hidden HUD).
     */
    handleKeys(input: InputManager): void {
        const escPressed = input.wasPressed(MENU_KEY);
        if (escPressed) {
            if (this.report?.dialogOpen) this.report.closeDialog();
            else if (this.deps.modes.bigMap) this.deps.modes.setBigMap(false);
            else this.menu.toggle();
        }
        if (input.wasBindPressed(Input.CycleUIMode) && !this.deps.modes.bigMap)
            this.minimapHidden = !this.minimapHidden;
        if (input.wasBindPressed(Input.HideUI) || (escPressed && this.hudHidden)) this.setHudHidden(!this.hudHidden);
        if (input.wasBindPressed(Input.Fullscreen)) toggleFullscreen();
        if (input.wasFreeKeyPressed(MuteBind)) toggleMute();
    }

    /** Hide UI (survev ui.ts cycleHud): showing the HUD again shows the minimap too (displayMiniMap). */
    setHudHidden(hidden: boolean): void {
        this.hudHidden = hidden;
        if (!hidden) this.minimapHidden = false;
    }

    /** The touch sticks of this frame, or null on desktop and for spectators. */
    touchSample(dt: number, local: LocalPlayerState | null, spectating: boolean): TouchSample | null {
        if (!this.touch) return null;
        const screen = this.deps.app.screen;
        const sample = this.touch.update({
            dt,
            width: screen.width,
            height: screen.height,
            holdingThrowable: local?.curWeapIdx === WeaponSlot.Throwable,
        });
        this.lastTouch = sample;
        return spectating ? null : sample;
    }

    update(frame: ControlsFrame): void {
        this.report?.update();
        this.touchHud?.update(this.deps.minimap()?.rect ?? null, this.deps.modes.bigMap, this.deps.layout.small);
        this.mapButtons?.update({
            scale: hudScale(this.deps.layout.state),
            hidden: this.deps.layout.small,
            bigMap: this.deps.modes.bigMap,
        });
        if (this.aimLine && this.touch) {
            const local = frame.local;
            const visible =
                !!local && !local.dead && !frame.spectating && this.touch.aimTouched && config().get("touchAimLine");
            this.aimLine.update(
                {
                    visible,
                    pos: frame.pos,
                    dir: this.touch.aim,
                    layer: local?.layer ?? 0,
                    weapon: local?.weapons[local.curWeapIdx]?.type ?? "",
                    zoom: local?.zoom ?? 28,
                },
                frame.world,
            );
        }
    }

    destroy(): void {
        this.unsubscribe();
        this.menu.destroy();
        this.touch?.destroy();
        this.aimLine?.destroy();
        this.touchHud?.destroy();
        this.mapButtons?.destroy();
        this.report?.destroy();
    }
}
