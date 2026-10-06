// M8 test hooks on window.__rebirth (read by tests/e2e/m8.spec.ts, m8-layout.spec.ts): the last sampled input and the
// touch sticks, the in-game menu, settings and binds, the camera's screen shake setting, reports, the HUD layout and
// the HUD toggles (Toggle Minimap, Hide UI).
import { config } from "../config.ts";
import { debugGlobals } from "../globals.ts";
import { binds } from "../input/keybinds.ts";
import type { GameClient } from "./client.ts";

export function exposeM8(client: GameClient): void {
    const globals = debugGlobals();
    const controls = client.controls;
    /** the PlayerInput built this frame (moves, aim, touchMoveActive / touchMoveDir / touchMoveLen, actions) */
    Object.defineProperty(globals, "lastInput", {
        get: () => client.input.last,
        configurable: true,
        enumerable: true,
    });
    globals.touch = {
        get enabled() {
            return !!controls.touch;
        },
        get sample() {
            return controls.lastTouch;
        },
        get moveDetected() {
            return controls.touch?.moveDetected ?? false;
        },
        get aimTouched() {
            return controls.touch?.aimTouched ?? false;
        },
        get range() {
            return controls.touch?.range ?? 0;
        },
        get lockedCenters() {
            return controls.touch?.lockedCenters ?? null;
        },
        get aimLineDots() {
            return controls.aimLine?.shown ?? 0;
        },
    };
    globals.gameMenu = {
        get open() {
            return controls.menu.visible;
        },
        get tab() {
            return controls.menu.currentTab;
        },
    };
    globals.reports = {
        get enabled() {
            return !!controls.report;
        },
        get results() {
            return controls.report?.results ?? [];
        },
        get killerId() {
            return client.match.killerId;
        },
    };
    globals.layout = {
        /** "sm" or "lg" */
        get name() {
            return client.layout.state.layout;
        },
        get landscape() {
            return client.layout.state.landscape;
        },
        get mobile() {
            return client.layout.state.mobile;
        },
    };
    globals.hudToggles = {
        get minimapHidden() {
            return controls.minimapHidden;
        },
        get hudHidden() {
            return controls.hudHidden;
        },
    };
    globals.cameraShake = {
        get enabled() {
            return client.camera.shakeEnabled;
        },
    };
    /** Master / SFX / Music volumes applied to the audio engine */
    globals.audioVolumes = () => client.audio.currentVolumes;
    exposeSettings();
}

/** Settings and binds (also on the menu page). */
export function exposeSettings(): void {
    const globals = debugGlobals();
    globals.config = {
        get: (key: string) => config().get(key as never),
        set: (key: string, value: unknown) => config().set(key as never, value as never),
    };
    globals.binds = {
        get list() {
            return [...binds().list()];
        },
        get code() {
            return binds().toShareCode();
        },
    };
}
