// Heal and boost particles around a player (survev client/src/objects/player.ts updateActionEffect and the passive
// heal emitter): while a heal is used the loadout's heal effect emitter (heal_basic: red crosses rising around the
// player) runs, while a boost is used the boost effect (boost_basic: green arrows); standing in a building heal
// region (PlayerView.healEffect, the bathhouse steam room) runs heal_basic too. Emitters follow the player slightly
// above its centre, on its render layer, just over it. A downed player being revived runs revive_basic (purple crosses;
// the 0.8.82 client's updateActionEffect: Action.Revive while downed, the reviver shows nothing; survev later moved
// the purple heal effect to both sides). M9: with Mass Medicate (aoe_heal) the use-item emitter covers the heal range
// (scale 1.5, radius medicHealRange / 1.5, a quarter of the delay).
// A heal / boost effect def names one emitter or a list (survev's boost_gearshift runs two, survev
// healEffectDefs.ts); players have no cosmetic loadout yet, so every player uses heal_basic / boost_basic until
// `setLoadout` names another effect (docs/handoff/survev-content.md, open question "Loadout"). For a second after
// Indomitable Spirit absorbs a fatal hit (PlayerView.lastStand) the boost effect's first emitter runs in blue with a
// third of the delay (survev player.ts adrenalineEmitter: color 0x4da6ff, rateMult 0.33).
import type { Vec2 } from "@rebirth/core";
import { GameConfig, GameObjectDefs } from "@rebirth/defs";
import type { PlayerView } from "@rebirth/sim";
import type { Emitter, EmitterOptions, ParticleSystem } from "../fx/particles.ts";

/** the default loadout's effects */
export const DEFAULT_HEAL_EFFECT = "heal_basic";
export const DEFAULT_BOOST_EFFECT = "boost_basic";
const REVIVE_EFFECT = "revive_basic";
const AOE_SCALE = 1.5;
const LAST_STAND_COLOR = 0x4da6ff;
const LAST_STAND_RATE = 0.33;

/** The emitters a heal / boost effect def runs (its `emitter`, one or a list); the default's for an unknown id. */
export function effectEmitters(effect: string, kind: "heal_effect" | "boost_effect"): string[] {
    const def = GameObjectDefs[effect] as { type?: string; emitter?: string | string[] } | undefined;
    if (def?.type !== kind || !def.emitter)
        return [kind === "heal_effect" ? DEFAULT_HEAL_EFFECT : DEFAULT_BOOST_EFFECT];
    return Array.isArray(def.emitter) ? [...def.emitter] : [def.emitter];
}

export class PlayerEmitters {
    private readonly particles: ParticleSystem;
    private useItem: Emitter[] = [];
    private useItemKey = "";
    private passiveHeal: Emitter | null = null;
    private lastStand: Emitter | null = null;
    private healEmitters = [DEFAULT_HEAL_EFFECT];
    private boostEmitters = [DEFAULT_BOOST_EFFECT];

    constructor(particles: ParticleSystem) {
        this.particles = particles;
    }

    /** The player's loadout heal / boost effects (survev PlayerInfo loadout.heal / loadout.boost). */
    setLoadout(heal: string, boost: string): void {
        this.healEmitters = effectEmitters(heal, "heal_effect");
        this.boostEmitters = effectEmitters(boost, "boost_effect");
    }

    update(view: PlayerView, pos: Vec2, layer: number, zOrd: number): void {
        let types: readonly string[] = [];
        const action = view.action;
        const opts: EmitterOptions = { pos, layer, zOrd };
        if (!view.dead && action?.type === "use") {
            const def = GameObjectDefs[action.item];
            if (def?.type === "heal") types = this.healEmitters;
            else if (def?.type === "boost") types = this.boostEmitters;
            if (view.perks?.some((p) => p.type === "aoe_heal")) {
                opts.scale = AOE_SCALE;
                opts.radius = GameConfig.player.medicHealRange / AOE_SCALE;
                opts.rateMult = 0.25;
            }
        } else if (!view.dead && view.downed && action?.type === "revive") {
            types = [REVIVE_EFFECT];
        }
        const key = types.join(",");
        if (key !== this.useItemKey) {
            for (const e of this.useItem) e.stop();
            this.useItem = types.map((type) => this.particles.addEmitter(type, { ...opts }));
            this.useItemKey = key;
        }
        const heal = !!view.healEffect && !view.dead;
        if (heal && !this.passiveHeal) {
            this.passiveHeal = this.particles.addEmitter(DEFAULT_HEAL_EFFECT, { pos, layer, zOrd });
        } else if (!heal && this.passiveHeal) {
            this.passiveHeal.stop();
            this.passiveHeal = null;
        }
        const lastStandType = view.lastStand && !view.dead ? this.boostEmitters[0] : "";
        if (lastStandType !== (this.lastStand?.type ?? "")) {
            this.lastStand?.stop();
            this.lastStand = lastStandType
                ? this.particles.addEmitter(lastStandType, {
                      pos,
                      layer,
                      zOrd,
                      rateMult: LAST_STAND_RATE,
                      color: () => LAST_STAND_COLOR,
                  })
                : null;
        }
        for (const e of [...this.useItem, this.passiveHeal, this.lastStand]) {
            if (!e) continue;
            e.pos = { x: pos.x, y: pos.y + 0.1 };
            e.layer = layer;
            e.zOrd = zOrd;
        }
    }

    /** emitters running (tests) */
    get active(): number {
        return this.useItem.length + (this.passiveHeal ? 1 : 0) + (this.lastStand ? 1 : 0);
    }

    stop(): void {
        for (const e of this.useItem) e.stop();
        this.passiveHeal?.stop();
        this.lastStand?.stop();
        this.useItem = [];
        this.passiveHeal = null;
        this.lastStand = null;
        this.useItemKey = "";
    }
}
