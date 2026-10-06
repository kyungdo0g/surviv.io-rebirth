// The interaction prompt (survev client/src/ui/ui2.ts m_update "Interaction"; docs/research/ui/hud.md
// "Interaction prompt and action timer"): usable obstacles first (buttons such as air drop crates, "[F] Unlock Air
// Drop": the button's interactionText + the object's name, the deepest overlap within interactionRad + player
// radius), then loot under the player, which wins when both apply. Rebirth also runs the pie timer for the opening
// of a crate the local player used (its `button.useDelay`), which the original leaves to the crate animation.
// M5: usable doors (not automatic ones) prompt "[F] Open Door" / "[F] Close Door" (survev obstacle.ts getInteraction);
// touching a closed door that is locked, or a one-way door from the wrong side, plays its error sound (survev
// player.ts isNearDoorError, at most every 0.5 s), and so does pressing F at a locked door (rebirth: feedback for a
// refused interaction).
// M6: a downed teammate within reviveRange on the player's layer, not already being revived, prompts "[F] Revive
// Teammate" while the player stands with no action running; it wins over loot and objects. During an item use or a
// revive the prompt is "[X] Cancel" (survev ui2.ts m_update "Reviving", InteractionType.Revive / Cancel). With the
// Revivify perk (LocalPlayerState.perks, M7a) a downed player gets "[F] Revive Self" and may cancel its own revive.
import { collider, math, type Vec2 } from "@rebirth/core";
import { GameConfig, GameObjectDefs, Input, MapObjectDefs, type ObstacleDef } from "@rebirth/defs";
import type { LocalPlayerState, ObstacleView, PlayerView } from "@rebirth/sim";
import { sameLayer } from "@rebirth/sim";
import type { AudioEngine } from "../audio/audio.ts";
import { bindLabel, binds } from "../input/keybinds.ts";
import { itemName, t, tryT } from "../l10n/index.ts";
import type { ObjectWorld } from "../objects/world.ts";

/**
 * The key shown in a prompt: Cancel's bind for a cancel, else Revive / Open/Use / Loot when bound, else Interact's
 * (F by default); "<Unbound>" when there is none (survev ui2.ts getInteractionKey; M8 rebinding).
 */
export function promptKey(kind: "cancel" | "revive" | "object" | "loot"): string {
    const table = binds();
    const own = { cancel: Input.Cancel, revive: Input.Revive, object: Input.Use, loot: Input.Loot }[kind];
    const code = table.get(own) ?? (kind === "cancel" ? null : table.get(Input.Interact));
    return code ? bindLabel(code) : "<Unbound>";
}
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
    /** the downed teammate a revive prompt is for (M6) */
    reviveId?: number;
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
        if (!local || !me || local.dead) return null;
        const action = local.action?.type ?? "none";
        const selfRevive = (local.perks ?? []).some((p) => p.type === "self_revive");
        if (action === "use" || (action === "revive" && (!me.downed || selfRevive))) {
            return { key: promptKey("cancel"), text: t("game-cancel") };
        }
        const revive =
            action === "none" && (!me.downed || selfRevive) ? this.findRevive(world, local, me, selfRevive) : null;
        if (revive) return revive;
        if (me.downed) return null;
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
            prompt = { key: promptKey("object"), text, obstacleId: o.id, door };
        });
        const loot = this.findLoot(world, local, me, pos);
        return loot ?? prompt;
    }

    /**
     * A downed teammate the player can revive, or itself with Revivify (survev ui2.ts m_update "Reviving": "Revive Self"
     * when the target is the player or the player is downed; distances from the snapshot).
     */
    private findRevive(
        world: ObjectWorld,
        local: LocalPlayerState,
        me: PlayerView,
        selfRevive: boolean,
    ): Prompt | null {
        const ids = (local.team ?? []).map((m) => m.playerId);
        if (selfRevive && !ids.includes(me.id)) ids.push(me.id);
        for (const id of ids) {
            if (id === me.id && !selfRevive) continue;
            const view = (id === me.id ? me : world.get(id)) as PlayerView | undefined;
            if (view?.kind !== "player" || !view.downed || view.dead || view.action?.type === "revive") continue;
            const d = Math.hypot(view.pos.x - me.pos.x, view.pos.y - me.pos.y);
            if (d < GameConfig.player.reviveRange && sameLayer(view.layer, me.layer)) {
                const self = selfRevive && (view.id === me.id || me.downed);
                return {
                    key: promptKey("revive"),
                    text: t(self ? "game-revive-self" : "game-revive-teammate"),
                    reviveId: view.id,
                };
            }
        }
        return null;
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
        return { key: promptKey("loot"), text: found.count > 1 ? `${name} (${found.count})` : name };
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
