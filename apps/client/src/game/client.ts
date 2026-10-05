// The in-game client: feeds transport snapshots into the object views, follows the local player with the
// camera, samples input every frame, and drives the effects (tracers, particles, sounds), the DOM HUD, the minimap
// and the debug HUD.
import type { Vec2 } from "@rebirth/core";
import { GameConfig, GameObjectDefs, getMapDef } from "@rebirth/defs";
import {
    buildTerrain,
    type LocalPlayerState,
    type MapData,
    type PlayerView,
    type Snapshot,
    sameLayer,
    type TerrainShape,
} from "@rebirth/sim";
import type { Application, Ticker } from "pixi.js";
import { mapSprites, outfitSprites } from "../assets/spriteSets.ts";
import type { TextureStore } from "../assets/textures.ts";
import { AudioEngine } from "../audio/audio.ts";
import { BulletSystem } from "../fx/bullets.ts";
import { GameEffects } from "../fx/effects.ts";
import { ParticleSystem } from "../fx/particles.ts";
import { InputManager } from "../input/input.ts";
import { DebugHudBind, MuteBind } from "../input/keybinds.ts";
import { itemName } from "../l10n/index.ts";
import { createTerrainGraphics } from "../map/terrain.ts";
import { SnapshotInterpolator } from "../net/interp.ts";
import type { Transport } from "../net/transport.ts";
import { ObjectWorld } from "../objects/world.ts";
import { Camera } from "../render/camera.ts";
import { Renderer } from "../render/renderer.ts";
import { DebugHud } from "../ui/debugHud.ts";
import { Hud, type HudFrame } from "../ui/hud.ts";
import { Minimap } from "../ui/minimap.ts";

/** extra world units around the screen kept un-culled */
const CULL_MARGIN = 4;
/** the loot prompt key: Interact (F) by default (survev ui2.ts getInteractionKey) */
const LOOT_KEY = "F";

export interface ClientOptions {
    showDebugHud?: boolean;
    /** overrides the camera zoom radius (world units) for debugging, like the original's debug zoom */
    debugZoom?: number;
    /** sandbox respawn; shows the button on the death overlay */
    onRespawn?: () => void;
    /** display name of a player id (killer on the death overlay) */
    playerName?: (id: number) => string | undefined;
    /** parent element of the DOM HUD (default document.body) */
    hudParent?: HTMLElement;
}

export class GameClient {
    readonly app: Application;
    readonly transport: Transport;
    readonly textures: TextureStore;
    readonly camera = new Camera();
    readonly renderer: Renderer;
    readonly input = new InputManager();
    readonly interp = new SnapshotInterpolator();
    readonly hud: DebugHud;
    readonly ui: Hud;
    readonly audio = new AudioEngine();
    readonly particles: ParticleSystem;
    readonly bullets: BulletSystem;
    readonly effects: GameEffects;
    world: ObjectWorld | null = null;
    minimap: Minimap | null = null;
    map: MapData | null = null;
    terrain: TerrainShape | null = null;
    localId = -1;
    local: LocalPlayerState | null = null;
    /** latest snapshot tick */
    tick = 0;
    snapshotCount = 0;
    /** local player position in the latest snapshot (authoritative, not interpolated) */
    readonly localPos: Vec2 = { x: 0, y: 0 };
    /** position the local player was drawn at this frame */
    visualPos: Vec2 = { x: 0, y: 0 };
    preloaded: Promise<void> = Promise.resolve();
    /** map sprites are loaded and at least one snapshot has been applied */
    texturesReady = false;
    /** loot prompt shown this frame (tests) */
    interaction: HudFrame["interaction"] = null;
    private cameraPlaced = false;
    private readonly debugZoom: number | undefined;
    private readonly playerName: ClientOptions["playerName"];

    constructor(app: Application, transport: Transport, textures: TextureStore, opts: ClientOptions = {}) {
        this.app = app;
        this.transport = transport;
        this.textures = textures;
        this.renderer = new Renderer(app, this.camera);
        this.hud = new DebugHud(!!opts.showDebugHud);
        this.debugZoom = opts.debugZoom;
        this.playerName = opts.playerName;
        this.renderer.overlay.addChild(this.hud.container);
        this.particles = new ParticleSystem(this.renderer, textures);
        this.bullets = new BulletSystem(this.renderer, textures, this.audio, this.particles);
        this.effects = new GameEffects(this.audio, this.particles, this.bullets);
        this.ui = new Hud(opts.hudParent ?? document.body, {
            action: (action) => this.input.queueAction(action),
            respawn: opts.onRespawn,
        });
        transport.onJoin((map, playerId) => this.join(map, playerId));
        transport.onSnapshot((s) => this.onSnapshot(s));
        app.ticker.add(this.frame);
    }

    private join(map: MapData, playerId: number): void {
        if (this.map === map && this.world) {
            // same game, new local player (sandbox respawn): drop every view, the next snapshot rebuilds them
            this.world.clear();
            this.interp.clear();
            this.effects.clear();
            this.localId = playerId;
            this.local = null;
            this.cameraPlaced = false;
            this.effects.setWorld(this.world, playerId);
            return;
        }
        this.map = map;
        this.localId = playerId;
        const mapDef = getMapDef(map.mapName);
        // the same deterministic polygons the simulation uses for surfaces
        const terrain = buildTerrain(map);
        this.terrain = terrain;
        for (const old of this.renderer.terrain.removeChildren()) old.destroy();
        this.renderer.terrain.addChild(createTerrainGraphics(map, terrain));
        this.renderer.setUnderground(mapDef.biome.colors.underground, map.width, map.height);
        this.app.renderer.background.color = mapDef.biome.colors.background;
        this.world = new ObjectWorld(
            { renderer: this.renderer, textures: this.textures, mapDef, fx: this.effects },
            this.interp,
        );
        this.effects.setWorld(this.world, playerId);
        this.bullets.setMap(mapDef);
        this.particles.valueAdjust = mapDef.biome.valueAdjust;
        this.minimap = new Minimap(this.app, this.textures, map, terrain);
        this.renderer.overlay.addChildAt(this.minimap.container, 0);
        this.camera.pos = { x: map.width / 2, y: map.height / 2 };

        const sprites = mapSprites(map);
        outfitSprites("outfitBase", sprites);
        this.preloaded = this.textures.preload(sprites).then(() => {
            this.texturesReady = true;
        });
        this.audio.preload(["player_bullet_hit_01", "player_bullet_hit_02", "bullet_whiz_01", "punch_swing_01"]);
    }

    private onSnapshot(s: Snapshot): void {
        if (!this.world) return;
        this.effects.beginSnapshot(s);
        this.world.applySnapshot(s);
        this.effects.endSnapshot(s);
        this.interp.push(s, performance.now() / 1000);
        if (!this.local) this.effects.preloadWeapons(s.local);
        this.local = s.local;
        this.tick = s.tick;
        this.snapshotCount++;
        const me = this.world.get(this.localId);
        if (me) {
            this.localPos.x = me.pos.x;
            this.localPos.y = me.pos.y;
        }
    }

    get ready(): boolean {
        return this.texturesReady && this.snapshotCount > 0;
    }

    /**
     * Nearest loot the local player stands on, as the prompt text (survev lootBarn.getClosestLoot: centre within
     * the item's GameConfig.lootRadius, inside the simulation's pickup reach of player radius + loot radius), skipping
     * a gun while both gun slots are full and a non-gun is out (survev ui2.ts).
     */
    private findInteraction(): HudFrame["interaction"] {
        const local = this.local;
        const world = this.world;
        const me = world?.get(this.localId) as PlayerView | undefined;
        if (!local || !world || !me || local.dead || me.downed) return null;
        const hasBothGuns = !!local.weapons[0]?.type && !!local.weapons[1]?.type;
        const holdingGun = GameConfig.WeaponType[local.curWeapIdx] === "gun";
        let best: { type: string; count: number } | null = null;
        let bestDist = Number.POSITIVE_INFINITY;
        world.forEachView("loot", (loot) => {
            if (!sameLayer(loot.layer, me.layer)) return;
            const def = GameObjectDefs[loot.type];
            if (!def) return;
            const rad = GameConfig.lootRadius[def.type] ?? 1;
            const d2 = (loot.pos.x - this.localPos.x) ** 2 + (loot.pos.y - this.localPos.y) ** 2;
            if (d2 >= rad * rad || d2 >= bestDist) return;
            if (def.type === "gun" && hasBothGuns && !holdingGun) return;
            bestDist = d2;
            best = { type: loot.type, count: loot.count };
        });
        const found = best as { type: string; count: number } | null;
        if (!found) return null;
        const name = itemName(found.type);
        return { key: LOOT_KEY, text: found.count > 1 ? `${name} (${found.count})` : name };
    }

    /** Screen position (CSS pixels) of a world position (tests aim with it). */
    worldToScreen(p: Vec2): Vec2 {
        return this.camera.worldToScreen(p);
    }

    private readonly frame = (ticker: Ticker): void => {
        const dt = Math.min(ticker.deltaMS / 1000, 0.1);
        const now = performance.now() / 1000;
        if (this.input.wasPressed(DebugHudBind)) this.hud.toggle();
        if (this.input.wasPressed(MuteBind)) this.audio.toggleMute();
        const world = this.world;
        const screen = this.app.screen;
        this.camera.resize(screen.width, screen.height);
        if (!world || !this.local) {
            this.renderer.update(dt);
            this.ui.update({ dt, local: null, interaction: null });
            this.input.endFrame();
            return;
        }
        this.visualPos = world.visualPos(this.localId, now) ?? this.localPos;
        this.camera.follow(dt, this.visualPos, this.debugZoom ?? this.local.zoom, !this.cameraPlaced);
        this.cameraPlaced = true;

        const input = this.input.sample(this.camera, this.visualPos);
        this.transport.sendInput(input);
        this.effects.localInput(input.shootHold);
        this.input.endFrame();

        this.renderer.activeLayer = this.local.layer;
        const ctx = { dt, localPos: this.visualPos, localLayer: this.local.layer, localId: this.localId };
        world.update(ctx, now, this.camera.viewBounds(CULL_MARGIN));
        this.effects.update(dt, this.camera.pos, this.local.layer);
        const masks = world.takeStairMasks();
        if (masks) this.renderer.setStairMasks(masks);
        this.renderer.update(dt);
        this.minimap?.update(this.camera, this.visualPos);
        this.interaction = this.findInteraction();
        this.ui.update({
            dt,
            local: this.local,
            interaction: this.interaction,
            killerName: this.local.killedBy ? this.playerName?.(this.local.killedBy) : undefined,
        });
        this.hud.update(dt, () => ({
            fps: this.renderer.fps(),
            tick: this.tick,
            pos: this.localPos,
            layer: this.local?.layer ?? 0,
            zoom: this.camera.zoom,
            sprites: this.renderer.spriteCount(),
            objects: world.size,
            visibleObjects: world.visibleCount,
        }));
    };

    destroy(): void {
        this.app.ticker.remove(this.frame);
        this.transport.close();
        this.input.destroy();
        this.world?.clear();
        this.effects.clear();
        this.minimap?.destroy();
        this.ui.destroy();
        this.audio.destroy();
    }
}
