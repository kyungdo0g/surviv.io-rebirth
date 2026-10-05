// Default key bindings of the original client (survev client/src/inputBinds.ts defaultBinds), by
// KeyboardEvent.code so they do not depend on the keyboard layout. Mouse buttons are "Mouse0".."Mouse4" and the
// wheel is "WheelUp"/"WheelDown". Movement additionally accepts the arrow keys.
import { Input } from "@rebirth/defs";

export type BindCode = string;

export const MovementBinds = {
    moveLeft: ["KeyA", "ArrowLeft"],
    moveRight: ["KeyD", "ArrowRight"],
    moveUp: ["KeyW", "ArrowUp"],
    moveDown: ["KeyS", "ArrowDown"],
} as const satisfies Record<string, readonly BindCode[]>;

/** one-shot actions sent in PlayerInput.actions; values are the defs `Input` constants */
export const ActionBinds: ReadonlyArray<{ action: number; codes: readonly BindCode[] }> = [
    { action: Input.Reload, codes: ["KeyR"] },
    { action: Input.Cancel, codes: ["KeyX"] },
    { action: Input.Interact, codes: ["KeyF"] },
    { action: Input.EquipPrimary, codes: ["Digit1"] },
    { action: Input.EquipSecondary, codes: ["Digit2"] },
    { action: Input.EquipMelee, codes: ["Digit3"] },
    { action: Input.EquipThrowable, codes: ["Digit4"] },
    { action: Input.EquipNextWeap, codes: ["WheelDown"] },
    { action: Input.EquipPrevWeap, codes: ["WheelUp"] },
    { action: Input.EquipLastWeap, codes: ["KeyQ"] },
    { action: Input.StowWeapons, codes: ["KeyE"] },
    { action: Input.UseBandage, codes: ["Digit7"] },
    { action: Input.UseHealthKit, codes: ["Digit8"] },
    { action: Input.UseSoda, codes: ["Digit9"] },
    { action: Input.UsePainkiller, codes: ["Digit0"] },
    { action: Input.SwapWeapSlots, codes: ["KeyT"] },
    { action: Input.ToggleMap, codes: ["KeyM"] },
    { action: Input.CycleUIMode, codes: ["KeyV"] },
    { action: Input.EmoteMenu, codes: ["Mouse2"] },
    { action: Input.TeamPingMenu, codes: ["KeyC"] },
    { action: Input.Fullscreen, codes: ["KeyL"] },
];

export const FireBind: readonly BindCode[] = ["Mouse0"];
/** client-only toggles */
export const DebugHudBind: BindCode = "F3";
