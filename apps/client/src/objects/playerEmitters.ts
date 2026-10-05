// Heal and boost particles around a player (survev client/src/objects/player.ts updateActionEffect and the passive
// heal emitter): while a heal is used the loadout's heal effect emitter (heal_basic: red crosses rising around the
// player) runs, while a boost is used the boost effect (boost_basic: green arrows); standing in a building heal
// region (PlayerView.healEffect, the bathhouse steam room) runs heal_basic too. Emitters follow the player slightly
// above its centre, on its render layer, just over it. M6: both sides of a revive (action "revive") run the heal effect
// in purple (survev updateActionEffect Action.Revive: hsv(0.83, 1, 0.7..1)).
import type { Vec2 } from "@rebirth/core";
import { GameObjectDefs } from "@rebirth/defs";
import type { PlayerView } from "@rebirth/sim";
import type { Emitter, ParticleSystem } from "../fx/particles.ts";

/** the default loadout's effects (players have no cosmetic loadout yet) */
const HEAL_EFFECT = "heal_basic";
const BOOST_EFFECT = "boost_basic";
const REVIVE_EFFECT = "revive";

/** survev util.hsvToRgb(0.83, 1, v) for v in 0.7..1, packed */
function reviveColor(): number {
    const v = 0.7 + Math.random() * 0.3;
    const h = 0.83 * 6;
    const f = h - Math.floor(h);
    // sector 4: (t, p, v) with s = 1
    const r = v * f;
    const b = v;
    return (Math.round(r * 255) << 16) | Math.round(b * 255);
}

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
        if (!view.dead && action?.type === "use") {
            const def = GameObjectDefs[action.item];
            if (def?.type === "heal") type = HEAL_EFFECT;
            else if (def?.type === "boost") type = BOOST_EFFECT;
        } else if (!view.dead && action?.type === "revive") {
            type = REVIVE_EFFECT;
        }
        if (type !== this.useItemType) {
            this.useItem?.stop();
            const revive = type === REVIVE_EFFECT;
            this.useItem = type
                ? this.particles.addEmitter(revive ? HEAL_EFFECT : type, {
                      pos,
                      layer,
                      zOrd,
                      color: revive ? reviveColor : undefined,
                  })
                : null;
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
