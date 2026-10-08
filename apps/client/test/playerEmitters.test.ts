// Heal / boost / last stand particles around a player (objects/playerEmitters.ts; survev client player.ts
// updateActionEffect and adrenalineEmitter): the default loadout's effects, a loadout effect with two emitters
// (survev's gearshift) and Indomitable Spirit's blue boost effect while PlayerView.lastStand is set.
import type { Vec2 } from "@rebirth/core";
import type { PlayerView } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import type { TextureStore } from "../src/assets/textures.ts";
import { ParticleSystem } from "../src/fx/particles.ts";
import { PlayerEmitters } from "../src/objects/playerEmitters.ts";
import { SpritePool } from "../src/render/pool.ts";
import type { Renderer } from "../src/render/renderer.ts";

function particles(): ParticleSystem {
    const renderer = { pool: new SpritePool(), add: () => {}, overgroundLayer: () => 2 } as unknown as Renderer;
    return new ParticleSystem(renderer, { apply: () => {} } as unknown as TextureStore);
}

function view(extra: Partial<PlayerView> = {}): PlayerView {
    return {
        id: 1,
        kind: "player",
        type: "player",
        pos: { x: 10, y: 10 },
        layer: 0,
        dir: { x: 1, y: 0 },
        dead: false,
        downed: false,
        activeWeapon: "fists",
        outfit: "outfitBase",
        helmet: "",
        chest: "",
        backpack: "",
        scale: 1,
        ...extra,
    };
}

const using = (item: string): Partial<PlayerView> => ({ action: { type: "use", seq: 1, item, duration: 3 } });
const pos: Vec2 = { x: 10, y: 10 };

/** emitter types the system runs (its private list, tests only) */
function running(ps: ParticleSystem): string[] {
    const list = (ps as unknown as { emitters: Array<{ type: string; ticker: number; duration: number }> }).emitters;
    return list.filter((e) => e.ticker < e.duration).map((e) => e.type);
}

describe("player heal and boost emitters", () => {
    it("run heal_basic / boost_basic until a loadout names another effect", () => {
        const ps = particles();
        const fx = new PlayerEmitters(ps);
        fx.update(view(using("bandage")), pos, 0, 10);
        expect(running(ps)).toEqual(["heal_basic"]);
        fx.update(view(using("soda")), pos, 0, 10);
        expect(running(ps)).toEqual(["boost_basic"]);
        fx.stop();
        expect(running(ps)).toEqual([]);
    });

    it("run every emitter of the loadout's effect: survev's gearshift runs two", () => {
        const ps = particles();
        const fx = new PlayerEmitters(ps);
        fx.setLoadout("heal_diamond", "boost_gearshift");
        fx.update(view(using("soda")), pos, 0, 10);
        expect(running(ps)).toEqual(["boost_gearshift_01", "boost_gearshift_02"]);
        expect(fx.active).toBe(2);
        fx.update(view(using("healthkit")), pos, 0, 10);
        expect(running(ps)).toEqual(["heal_diamond"]);
    });

    it("show Indomitable Spirit's last stand as the boost effect in blue, a third of the delay", () => {
        const ps = particles();
        const fx = new PlayerEmitters(ps);
        fx.update(view({ lastStand: true }), pos, 0, 10);
        const list = (ps as unknown as { emitters: Array<{ type: string; rateMult: number; color?: () => number }> })
            .emitters;
        expect(list.map((e) => e.type)).toEqual(["boost_basic"]);
        expect(list[0].rateMult).toBe(0.33);
        expect(list[0].color?.()).toBe(0x4da6ff);
        fx.update(view({ lastStand: false }), pos, 0, 10);
        expect(running(ps)).toEqual([]);
        // a dead player shows none
        fx.update(view({ lastStand: true, dead: true }), pos, 0, 10);
        expect(running(ps)).toEqual([]);
    });
});
