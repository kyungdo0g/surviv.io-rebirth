// The interaction prompt (survev client/src/ui/ui2.ts m_update "Interaction"; docs/research/ui/hud.md
// "Interaction prompt and action timer"): usable obstacles first (buttons such as air drop crates, "[F] Unlock Air
// Drop": the button's interactionText + the object's name, the deepest overlap within interactionRad + player
// radius), then loot under the player, which wins when both apply. Rebirth also runs the pie timer for the opening
// of a crate the local player used (its `button.useDelay`), which the original leaves to the crate animation.
// M5: usable doors (not automatic ones) prompt "[F] Open Door" / "[F] Close Door" (survev obstacle.ts getInteraction);
// touching a closed door that is locked, or a one-way door from the wrong side, plays its error sound (survev
// player.ts isNearDoorError, at most every 0.5 s), and so does pressing F at a locked door (rebirth: feedback for a
// refused interaction).
import { collider, math, type Vec2 } from "@rebirth/core";
import { GameConfig, GameObjectDefs, MapObjectDefs, type ObstacleDef } from "@rebirth/defs";
import type { LocalPlayerState, ObstacleView, PlayerView } from "@rebirth/sim";
import { sameLayer } from "@rebirth/sim";
import type { AudioEngine } from "../audio/audio.ts";
import { itemName, t, tryT } from "../l10n/index.ts";
import type { ObjectWorld } from "../objects/world.ts";

/** the prompt key: Interact (F) by default (survev ui2.ts getInteractionKey) */
export const INTERACT_KEY = "F";
/** a use counts as ours when the button flips this soon after our Interact press (s) */
const USE_MATCH_WINDOW = 1;
/** the door error sound repeats at most this often (s) */
const DOOR_ERROR_COOLDOWN = 0.5;
/** a door counts as touched within the player radius plus this (survev player.ts) */
const DOOR_TOUCH_PAD = 0.25;
const FALLBACK_DOOR_ERROR = "door_error_01";

export interface Prompt {
    key: string;
    text: string;
    /** obstacle id when the prompt is for a button or a door */
    obstacleId?: number;
    door?: boolean;
}

interface PendingUse {
    obstacleId: number;
    seq: number;
    age: number;
}

/** Text of a button prompt: action + object (survev ui2.ts getInteractionText, InteractionType.Object). */
function buttonText(def: ObstacleDef, type: string): string {
    const action = t(def.button?.interactionText || "game-use");
    const object = tryT(`game-${type}`);
    return object ? `${action} ${object}` : action;
}

export class InteractionTracker {
    private readonly audio: AudioEngine | null;
    private pending: PendingUse | null = null;
    private nearDoorError = false;
    private doorErrorTicker = 0;
    /** door error sounds played (tests) */
    doorErrors = 0;

    constructor(audio: AudioEngine | null = null) {
        this.audio = audio;
    }
    /** client-side opening timer of the crate the local player used */
    private opening: { obstacleId: number; label: string; time: number; duration: number } | null = null;

    /** Nearest usable button or loot for the player, as the prompt to show. */
    find(world: ObjectWorld, local: LocalPlayerState | null, me: PlayerView | undefined, pos: Vec2): Prompt | null {
        if (!local || !me || local.dead || me.downed) return null;
        let prompt: Prompt | null = null;
        let bestPen = 0;
        world.forEachView("obstacle", (o) => {
            if (o.dead || !sameLayer(o.layer, me.layer)) return;
            const def = MapObjectDefs[o.type] as ObstacleDef | undefined;
            if (!def) return;
            let rad: number;
            let text: string;
            let door = false;
            if (def.button && o.button?.canUse) {
                rad = def.button.interactionRad;
                text = buttonText(def, o.type);
            } else if (def.door && o.door?.canUse && !def.door.autoOpen) {
                rad = def.door.interactionRad;
                text = t(o.door.open ? "game-close-door" : "game-open-door");
                door = true;
            } else {
                return;
            }
            const col = collider.transform(def.collision, o.pos, math.oriToRad(o.ori), o.scale);
            const res = collider.intersect(collider.createCircle(pos, rad + GameConfig.player.radius), col);
            if (!res || res.pen < bestPen) return;
            bestPen = res.pen;
            prompt = { key: INTERACT_KEY, text, obstacleId: o.id, door };
        });
        const loot = this.findLoot(world, local, me, pos);
        return loot ?? prompt;
    }

    /**
     * Loot the player stands on (survev lootBarn.getClosestLoot: centre within the item's GameConfig.lootRadius),
     * skipping a gun while both gun slots are full and a non-gun is out (survev ui2.ts).
     */
    private findLoot(world: ObjectWorld, local: LocalPlayerState, me: PlayerView, pos: Vec2): Prompt | null {
        const hasBothGuns = !!local.weapons[0]?.type && !!local.weapons[1]?.type;
        const holdingGun = GameConfig.WeaponType[local.curWeapIdx] === "gun";
        let best: { type: string; count: number } | null = null;
        let bestDist = Number.POSITIVE_INFINITY;
        world.forEachView("loot", (loot) => {
            if (!sameLayer(loot.layer, me.layer)) return;
            const def = GameObjectDefs[loot.type];
            if (!def) return;
            const rad = GameConfig.lootRadius[def.type] ?? 1;
            const d2 = (loot.pos.x - pos.x) ** 2 + (loot.pos.y - pos.y) ** 2;
            if (d2 >= rad * rad || d2 >= bestDist) return;
            if (def.type === "gun" && hasBothGuns && !holdingGun) return;
            bestDist = d2;
            best = { type: loot.type, count: loot.count };
        });
        const found = best as { type: string; count: number } | null;
        if (!found) return null;
        const name = itemName(found.type);
        return { key: INTERACT_KEY, text: found.count > 1 ? `${name} (${found.count})` : name };
    }

    /** The local player pressed Interact while `prompt` was shown. */
    interacted(prompt: Prompt | null, world: ObjectWorld): void {
        if (prompt?.obstacleId === undefined) return;
        const view = world.get(prompt.obstacleId) as ObstacleView | undefined;
        if (view?.button) this.pending = { obstacleId: prompt.obstacleId, seq: view.button.seq, age: 0 };
        if (view?.door?.locked && !view.door.open) this.playDoorError(view);
    }

    private playDoorError(view: ObstacleView): void {
        if (this.doorErrorTicker > 0) return;
        this.doorErrorTicker = DOOR_ERROR_COOLDOWN;
        const def = MapObjectDefs[view.type] as ObstacleDef | undefined;
        const sound = def?.door?.sound.error || FALLBACK_DOOR_ERROR;
        this.audio?.playSound(sound, { channel: "sfx", pos: view.pos, fallOff: 1, layer: view.layer });
        this.doorErrors++;
    }

    /**
     * Touching a closed locked door, or a one-way door from its closed side, plays its error sound once per touch
     * (survev player.ts doorErrorObstacle: within the player radius + 0.25 of the door, on the player's layer).
     */
    updateDoors(dt: number, world: ObjectWorld, me: PlayerView | undefined, pos: Vec2): void {
        this.doorErrorTicker -= dt;
        if (!me || me.dead) return;
        let touched: ObstacleView | null = null;
        world.forEachView("obstacle", (o) => {
            if (touched || o.dead || !o.door || o.door.open || o.layer !== me.layer) return;
            const def = MapObjectDefs[o.type] as ObstacleDef | undefined;
            if (!def?.door) return;
            const rot = math.oriToRad(o.ori);
            const col = collider.transform(def.collision, o.pos, rot, o.scale);
            const res = collider.intersect(
                collider.createCircle(pos, GameConfig.player.radius * (me.scale || 1) + DOOR_TOUCH_PAD),
                col,
            );
            if (!res) return;
            const toDoor = { x: o.pos.x - pos.x, y: o.pos.y - pos.y };
            const doorDir = { x: Math.cos(rot), y: Math.sin(rot) };
            const wrongSide = !!def.door.openOneWay && toDoor.x * doorDir.x + toDoor.y * doorDir.y < 0;
            if (o.door.locked || wrongSide) touched = o;
        });
        const near = touched !== null;
        if (near && !this.nearDoorError && this.doorErrorTicker <= 0 && touched) {
            const view = touched as ObstacleView;
            const def = MapObjectDefs[view.type] as ObstacleDef | undefined;
            // only doors that have an error sound complain on touch (the original plays the def's sound as is)
            if (def?.door?.sound.error) this.playDoorError(view);
        }
        this.nearDoorError = near;
    }

    /** Advances the opening timer; returns it for the pie, or null. */
    update(dt: number, world: ObjectWorld): { label: string; time: number; duration: number } | null {
        const pending = this.pending;
        if (pending) {
            pending.age += dt;
            const view = world.get(pending.obstacleId) as ObstacleView | undefined;
            const def = view ? (MapObjectDefs[view.type] as ObstacleDef | undefined) : undefined;
            if (view?.button && view.button.seq !== pending.seq && def?.button) {
                this.pending = null;
                if (def.button.destroyOnUse && def.button.useDelay > 0) {
                    this.opening = {
                        obstacleId: view.id,
                        label: buttonText(def, view.type),
                        time: 0,
                        duration: def.button.useDelay,
                    };
                }
            } else if (pending.age > USE_MATCH_WINDOW) {
                this.pending = null;
            }
        }
        const open = this.opening;
        if (!open) return null;
        open.time += dt;
        const view = world.get(open.obstacleId) as ObstacleView | undefined;
        if (!view || view.dead || open.time >= open.duration) {
            this.opening = null;
            return null;
        }
        return { label: open.label, time: open.time, duration: open.duration };
    }

    clear(): void {
        this.pending = null;
        this.opening = null;
    }
}
