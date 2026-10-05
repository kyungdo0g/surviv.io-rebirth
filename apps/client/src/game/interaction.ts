// The interaction prompt (survev client/src/ui/ui2.ts m_update "Interaction"; docs/research/ui/hud.md
// "Interaction prompt and action timer"): usable obstacles first (buttons such as air drop crates, "[F] Unlock Air
// Drop": the button's interactionText + the object's name, the deepest overlap within interactionRad + player
// radius), then loot under the player, which wins when both apply. Rebirth also runs the pie timer for the opening
// of a crate the local player used (its `button.useDelay`), which the original leaves to the crate animation.
import { collider, math, type Vec2 } from "@rebirth/core";
import { GameConfig, GameObjectDefs, MapObjectDefs, type ObstacleDef } from "@rebirth/defs";
import type { LocalPlayerState, ObstacleView, PlayerView } from "@rebirth/sim";
import { sameLayer } from "@rebirth/sim";
import { itemName, t, tryT } from "../l10n/index.ts";
import type { ObjectWorld } from "../objects/world.ts";

/** the prompt key: Interact (F) by default (survev ui2.ts getInteractionKey) */
export const INTERACT_KEY = "F";
/** a use counts as ours when the button flips this soon after our Interact press (s) */
const USE_MATCH_WINDOW = 1;

export interface Prompt {
    key: string;
    text: string;
    /** obstacle id when the prompt is for a button */
    obstacleId?: number;
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
    private pending: PendingUse | null = null;
    /** client-side opening timer of the crate the local player used */
    private opening: { obstacleId: number; label: string; time: number; duration: number } | null = null;

    /** Nearest usable button or loot for the player, as the prompt to show. */
    find(world: ObjectWorld, local: LocalPlayerState | null, me: PlayerView | undefined, pos: Vec2): Prompt | null {
        if (!local || !me || local.dead || me.downed) return null;
        let prompt: Prompt | null = null;
        let bestPen = 0;
        world.forEachView("obstacle", (o) => {
            if (o.dead || !o.button?.canUse || !sameLayer(o.layer, me.layer)) return;
            const def = MapObjectDefs[o.type] as ObstacleDef | undefined;
            if (!def?.button) return;
            const col = collider.transform(def.collision, o.pos, math.oriToRad(o.ori), o.scale);
            const res = collider.intersect(
                collider.createCircle(pos, def.button.interactionRad + GameConfig.player.radius),
                col,
            );
            if (!res || res.pen < bestPen) return;
            bestPen = res.pen;
            prompt = { key: INTERACT_KEY, text: buttonText(def, o.type), obstacleId: o.id };
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
