// Default key bindings of the original client (survev client/src/inputBinds.ts defaultBinds), by
// KeyboardEvent.code so they do not depend on the keyboard layout. Mouse buttons are "Mouse0".."Mouse4" and the
// wheel is "WheelUp"/"WheelDown". Movement additionally accepts the arrow keys. Actions the original leaves unbound
// (Loot, Use, Revive, Equip Other Gun, Previous/Next Scope) have an empty code list until rebinding exists. The emote
// and team ping wheel binds never reach the server (controls.md: client only).
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
    { action: Input.Loot, codes: [] },
    { action: Input.EquipOtherGun, codes: [] },
    { action: Input.EquipPrevScope, codes: [] },
    { action: Input.EquipNextScope, codes: [] },
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
    { action: Input.CycleUIMode, codes: ["KeyV"] },
    { action: Input.Fullscreen, codes: ["KeyL"] },
];

export const FireBind: readonly BindCode[] = ["Mouse0"];
/** Emote Menu (hold right mouse) and Team Ping Hold (C): client-only wheels, never sent as inputs (M6, emoteWheel.ts) */
export const EmoteMenuBind: BindCode = "Mouse2";
export const TeamPingBind: BindCode = "KeyC";
/** client-only toggles */
export const DebugHudBind: BindCode = "F3";
/**
 * Sound on/off. M is the original's Toggle Map bind (client-only, never sent to the server); until the full-screen
 * map exists it toggles the sound, which the original only offered in the menus.
 */
export const MuteBind: BindCode = "KeyM";
