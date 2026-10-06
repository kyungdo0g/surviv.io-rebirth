// Heal and boost particles around a player (survev client/src/objects/player.ts updateActionEffect and the passive
// heal emitter): while a heal is used the loadout's heal effect emitter (heal_basic: red crosses rising around the
// player) runs, while a boost is used the boost effect (boost_basic: green arrows); standing in a building heal
// region (PlayerView.healEffect, the bathhouse steam room) runs heal_basic too. Emitters follow the player slightly
// above its centre, on its render layer, just over it. A downed player being revived runs revive_basic (purple crosses;
// the 0.8.82 client's updateActionEffect: Action.Revive while downed, the reviver shows nothing; survev later moved
// the purple heal effect to both sides). M9: with Mass Medicate (aoe_heal) the use-item emitter covers the heal range
// (scale 1.5, radius medicHealRange / 1.5, a quarter of the delay).
import type { Vec2 } from "@rebirth/core";
import { GameConfig, GameObjectDefs } from "@rebirth/defs";
import type { PlayerView } from "@rebirth/sim";
import type { Emitter, EmitterOptions, ParticleSystem } from "../fx/particles.ts";

/** the default loadout's effects (players have no cosmetic loadout yet) */
const HEAL_EFFECT = "heal_basic";
const BOOST_EFFECT = "boost_basic";
const REVIVE_EFFECT = "revive_basic";
const AOE_SCALE = 1.5;

export class PlayerEmitters {
    private readonly particles: ParticleSystem;
    private useItem: Emitter | null = null;
    private useItemType = "";
    private passiveHeal: Emitter | null = null;

    constructor(particles: ParticleSystem) {
        this.particles = particles;
    }

    update(view: PlayerView, pos: Vec2, layer: number, zOrd: number): void {
        let type = "";
        const action = view.action;
        const opts: EmitterOptions = { pos, layer, zOrd };
        if (!view.dead && action?.type === "use") {
            const def = GameObjectDefs[action.item];
            if (def?.type === "heal") type = HEAL_EFFECT;
            else if (def?.type === "boost") type = BOOST_EFFECT;
            if (view.perks?.some((p) => p.type === "aoe_heal")) {
                opts.scale = AOE_SCALE;
                opts.radius = GameConfig.player.medicHealRange / AOE_SCALE;
                opts.rateMult = 0.25;
            }
        } else if (!view.dead && view.downed && action?.type === "revive") {
            type = REVIVE_EFFECT;
        }
        if (type !== this.useItemType) {
            this.useItem?.stop();
            this.useItem = type ? this.particles.addEmitter(type, opts) : null;
            this.useItemType = type;
        }
        const heal = !!view.healEffect && !view.dead;
        if (heal && !this.passiveHeal) this.passiveHeal = this.particles.addEmitter(HEAL_EFFECT, { pos, layer, zOrd });
        else if (!heal && this.passiveHeal) {
            this.passiveHeal.stop();
            this.passiveHeal = null;
        }
        for (const e of [this.useItem, this.passiveHeal]) {
            if (!e) continue;
            e.pos = { x: pos.x, y: pos.y + 0.1 };
            e.layer = layer;
            e.zOrd = zOrd;
        }
    }

    /** emitters running (tests) */
    get active(): number {
        return (this.useItem ? 1 : 0) + (this.passiveHeal ? 1 : 0);
    }

    stop(): void {
        this.useItem?.stop();
        this.passiveHeal?.stop();
        this.useItem = null;
        this.passiveHeal = null;
        this.useItemType = "";
    }
}
