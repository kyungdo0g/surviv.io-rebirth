// The local player's gun switch sound (survev client/src/objects/player.ts:1058-1089): a switch plays the generic
// gun_switch_01 and opens the free-switch window (GameConfig.player.freeSwitchCooldown, 1 s); a second switch inside
// it plays the gun's own `sound.deploy`, and so does a switch between the two gun slots right after a shot when both
// guns share a `deployGroup` (survev `deployFull`: the M870 and SPAS-12 pair, the launchers), because that switch
// skips the fire delay. survev starts the shot's fire delay in objects/shot.ts:226-227.
// Rebirth (owner, 2026-10-08: "no switch sound for any of the new guns"): the owner's new guns play their own switch
// clip on every switch (docs/research/rebirth-deviations.md "New-gun sounds"); the original and survev guns keep the
// original rule.
import { GameConfig, type GunDef, NEW_GUN_IDS } from "@rebirth/defs";

const NEW_GUNS: ReadonlySet<string> = new Set(NEW_GUN_IDS);
const GENERIC = "gun_switch_01";

/** Whether `idx` is one of the two gun slots (survev: `lastWeapIdx == 0 || lastWeapIdx == 1`). */
const gunSlot = (idx: number) => idx === 0 || idx === 1;

export class GunSwitchSound {
    /** a switch inside this window plays the gun's own deploy sound */
    gunSwitchCooldown = 0;
    /** the local player's fire delay after a shot (survev player.fireDelay) */
    fireDelay = 0;

    update(dt: number): void {
        this.gunSwitchCooldown -= dt;
        this.fireDelay -= dt;
    }

    /** A local shot of `def` (survev shot.ts:226-227). */
    shot(def: GunDef): void {
        this.fireDelay = def.fireDelay;
    }

    /**
     * The sound of a switch to gun `def` (id `id`) from slot `lastIdx`, where `lastDef` is the gun now in that slot (if
     * any) and `curIdx` the new slot.
     */
    switchTo(id: string, def: GunDef, curIdx: number, lastIdx: number, lastDef: GunDef | undefined): string {
        const deployFull =
            gunSlot(lastIdx) &&
            gunSlot(curIdx) &&
            this.fireDelay > 0 &&
            def.deployGroup !== undefined &&
            lastDef?.deployGroup !== undefined &&
            def.deployGroup === lastDef.deployGroup;
        let sound = GENERIC;
        if (this.gunSwitchCooldown > 0 || deployFull) sound = def.sound.deploy;
        else this.gunSwitchCooldown = GameConfig.player.freeSwitchCooldown;
        if (NEW_GUNS.has(id) && def.sound.deploy) sound = def.sound.deploy;
        this.fireDelay = 0;
        return sound || GENERIC;
    }
}
