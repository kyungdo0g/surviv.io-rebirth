// Event-mode visuals of a player (M7; survev client/src/objects/player.ts updateVisuals, updateFrozenState and the haste
// effect; docs/research/modes/faction.md, cobalt.md, snow.md, potato.md, items/perks.md):
// - Cobalt class visors (the role def's visorImg) over a worn helmet;
// - faction maps: the team arm patch (player-patch-01 / -02 tinted with the team colour; the potato faction's -01po /
//   -02po untinted) and helmets tinted with their baseTintRed / baseTintBlue;
// - perks: the Flak Jacket outline (player-armor-base-01 at 0.215, tint 0x380606, alpha 0.7) and the Cast Ironskin black
//   pan (loot-melee-pan-black at 0.4, anchor 0.575 / 0.5);
// - frozen (PlayerView.frozen, snowball / potato hits): a random frozen sprite of the map (biome.frozenSprites, else the
//   snow map's player-snow-01..03) over the body, turned by `frozenOri` quarter turns + 90° ± 22.5°, fading out over
//   0.25 s once the player thaws;
// - haste (PlayerView.haste): the Windwalk / Takedown / Inspiration particle emitter around the player and the
//   ability_stim_01 sound whenever a new burst starts (`seq` changed), stopped when it ends.
// Player scale (Leadership, Cast Ironskin, Small Arms, Spud Gun hits) is PlayerView.scale, applied by player.ts.
import type { Vec2 } from "@rebirth/core";
import { GameConfig, GameObjectDefs, type HelmetDef, type MapDef, type RoleDef } from "@rebirth/defs";
import type { PlayerView } from "@rebirth/sim";
import type { Sprite } from "pixi.js";
import type { TextureStore } from "../assets/textures.ts";
import type { AudioEngine } from "../audio/audio.ts";
import type { Emitter, ParticleSystem } from "../fx/particles.ts";

/** the snow map's frozen sprites (its pre-fork def; snow is not in the v0.8.82 client, modes/snow.md) */
const SNOW_FROZEN_SPRITES = ["player-snow-01.img", "player-snow-02.img", "player-snow-03.img"];
const FROZEN_FADE = 0.25;
const HASTE_SOUND = "ability_stim_01";
const FLAK_TINT = 0x380606;

export interface PlayerModeDeps {
    textures: TextureStore;
    mapDef: MapDef;
    particles?: ParticleSystem;
    audio?: AudioEngine;
    /** team of a player (faction maps: 1 Red, 2 Blue), 0 when unknown */
    teamOf?(playerId: number): number;
}

/** Faction (1 Red, 2 Blue) of a player on a faction map, else 0. */
export function factionOf(deps: PlayerModeDeps, playerId: number): number {
    if (!deps.mapDef.gameMode.factionMode) return 0;
    const team = deps.teamOf?.(playerId) ?? 0;
    return team === 1 || team === 2 ? team : 0;
}

/** Helmet tint: the faction's tint on faction maps (survev updateVisuals), else the base tint. */
export function helmetTint(helmet: HelmetDef, faction: number): number {
    if (faction === 1) return helmet.skinImg.baseTintRed;
    if (faction === 2) return helmet.skinImg.baseTintBlue;
    return helmet.skinImg.baseTint;
}

export class PlayerModeSprites {
    private readonly deps: PlayerModeDeps;
    readonly flak: Sprite;
    readonly steelskin: Sprite;
    readonly patch: Sprite;
    /** the frozen overlay (survev bodyEffectSprite) */
    readonly frozen: Sprite;
    readonly visor: Sprite;
    private frozenTicker = 0;
    private frozenImage = true;
    private hasteSeq = -1;
    private hasteEmitter: Emitter | null = null;
    private seen = false;

    constructor(deps: PlayerModeDeps, sprite: () => Sprite) {
        this.deps = deps;
        this.flak = sprite();
        this.steelskin = sprite();
        this.patch = sprite();
        this.frozen = sprite();
        this.visor = sprite();
        this.frozen.visible = false;
    }

    /** Key of everything updateVisuals draws here (the view rebuilds its visuals when it changes). */
    visualsKey(view: PlayerView): string {
        const perks = (view.perks ?? []).map((p) => p.type).join("+");
        return `${view.role ?? ""}|${perks}|${factionOf(this.deps, view.id)}`;
    }

    /** Visors, patches and perk sprites for the current gear (part of the player's updateVisuals). */
    updateVisuals(view: PlayerView, ghillie: boolean, bodyScale: number): void {
        const tex = this.deps.textures;
        const has = (perk: string) => (view.perks ?? []).some((p) => p.type === perk);

        this.flak.visible = has("flak_jacket") && !ghillie;
        if (this.flak.visible) {
            tex.apply(this.flak, "player-armor-base-01.img", 0.215 * bodyScale);
            this.flak.scale.set(0.215);
            this.flak.tint = FLAK_TINT;
            this.flak.alpha = 0.7;
        }
        this.steelskin.visible = has("steelskin") && !ghillie;
        if (this.steelskin.visible) {
            tex.apply(this.steelskin, "loot-melee-pan-black.img", 0.4 * bodyScale);
            this.steelskin.scale.set(0.4);
            this.steelskin.anchor.set(0.575, 0.5);
        }

        const faction = factionOf(this.deps, view.id);
        this.patch.visible = faction > 0 && !ghillie;
        if (this.patch.visible) {
            const potato = !!this.deps.mapDef.gameMode.potatoMode;
            const sprite = potato ? `player-patch-0${faction}po.img` : `player-patch-0${faction}.img`;
            tex.apply(this.patch, sprite, 0.25 * bodyScale);
            this.patch.scale.set(0.25);
            this.patch.tint = potato ? 0xffffff : GameConfig.teamColors[faction - 1];
        }

        const role = view.role ? (GameObjectDefs[view.role] as RoleDef | undefined) : undefined;
        const visor = role?.visorImg;
        this.visor.visible = !!visor && !!view.helmet && !ghillie;
        if (visor && this.visor.visible) {
            const scale = visor.spriteScale || 0.15;
            tex.apply(this.visor, visor.baseSprite, scale * bodyScale);
            this.visor.position.set((view.downed ? 1 : -1) * 3.33, 0);
            this.visor.scale.set(scale);
        }
    }

    /** Per frame: the frozen overlay and the haste emitter. */
    update(view: PlayerView, pos: Vec2, layer: number, zOrd: number, dt: number): void {
        this.updateFrozen(view, dt);
        this.updateHaste(view, pos, layer, zOrd);
        this.seen = true;
    }

    private updateFrozen(view: PlayerView, dt: number): void {
        const frozen = !!view.frozen && !view.dead;
        if (frozen && this.frozenImage) {
            const list = this.deps.mapDef.biome.frozenSprites ?? SNOW_FROZEN_SPRITES;
            const sprite = list[Math.floor(Math.random() * list.length)] ?? SNOW_FROZEN_SPRITES[0];
            this.deps.textures.apply(this.frozen, sprite, 0.25);
            this.frozen.rotation =
                ((view.frozenOri ?? 0) * Math.PI) / 2 + Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 0.25;
            this.frozen.tint = 0xffffff;
            this.frozen.scale.set(0.25);
            this.frozenImage = false;
        }
        if (frozen) {
            this.frozenTicker = FROZEN_FADE;
        } else {
            this.frozenTicker -= dt;
            this.frozenImage = true;
        }
        this.frozen.alpha = frozen ? 1 : Math.max(0, Math.min(1, this.frozenTicker / FROZEN_FADE));
        this.frozen.visible = this.frozenTicker > 0;
    }

    private updateHaste(view: PlayerView, pos: Vec2, layer: number, zOrd: number): void {
        const haste = view.dead ? undefined : view.haste;
        const type = haste?.type ?? "none";
        if (haste && type !== "none" && haste.seq !== this.hasteSeq) {
            if (this.seen) {
                this.deps.audio?.playSound(HASTE_SOUND, { channel: "sfx", pos, fallOff: 1, layer, filter: "muffled" });
            }
            this.hasteEmitter?.stop();
            this.hasteEmitter = this.deps.particles?.addEmitter(type, { pos, layer }) ?? null;
            this.hasteSeq = haste.seq;
        } else if (type === "none" && this.hasteEmitter) {
            this.hasteEmitter.stop();
            this.hasteEmitter = null;
        }
        if (this.hasteEmitter) {
            this.hasteEmitter.pos = { x: pos.x, y: pos.y + 0.1 };
            this.hasteEmitter.layer = layer;
            this.hasteEmitter.zOrd = zOrd + 1;
        }
    }

    /** the frozen overlay is drawn (tests) */
    get frozenShown(): boolean {
        return this.frozen.visible && this.frozen.alpha > 0;
    }

    /** a haste emitter runs (tests) */
    get hasteActive(): boolean {
        return !!this.hasteEmitter;
    }

    stop(): void {
        this.hasteEmitter?.stop();
        this.hasteEmitter = null;
    }
}
