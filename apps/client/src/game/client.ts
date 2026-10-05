// The in-game client: feeds transport snapshots into the object views, follows the active player (the local
// player, or the spectated one) with the camera, samples input every frame, and drives the effects (tracers,
// particles, sounds), the red zone, planes and air drops, the DOM HUD and match UI, the minimap and the debug HUD.
import type { Vec2 } from "@rebirth/core";
import { getMapDef, Input, MapObjectDefs } from "@rebirth/defs";
import {
    buildTerrain,
    createTerrain,
    isTerrainWater,
    type LocalPlayerState,
    type MapData,
    type PlayerView,
    type Snapshot,
    type Terrain,
    type TerrainShape,
} from "@rebirth/sim";
import type { Application, Ticker } from "pixi.js";
import { mapObjectSprites, mapSprites, outfitSprites } from "../assets/spriteSets.ts";
import type { TextureStore } from "../assets/textures.ts";
import { AudioEngine } from "../audio/audio.ts";
import { BulletSystem } from "../fx/bullets.ts";
import { GameEffects } from "../fx/effects.ts";
import { GasShape, WORLD_GAS_COLOR } from "../fx/gas.ts";
import { ParticleSystem } from "../fx/particles.ts";
import { InputManager } from "../input/input.ts";
import { DebugHudBind, MuteBind } from "../input/keybinds.ts";
import { createTerrainGraphics } from "../map/terrain.ts";
import { SnapshotInterpolator } from "../net/interp.ts";
import type { Transport } from "../net/transport.ts";
import { AirSystem } from "../objects/planes.ts";
import { ObjectWorld } from "../objects/world.ts";
import { Camera } from "../render/camera.ts";
import { Renderer } from "../render/renderer.ts";
import { DebugHud } from "../ui/debugHud.ts";
import { Hud, type HudFrame } from "../ui/hud.ts";
import { Minimap, uiScale } from "../ui/minimap.ts";
import { PingIndicator } from "../ui/pingIndicator.ts";
import { InteractionTracker, type Prompt } from "./interaction.ts";
import { MatchUi } from "./match.ts";

/** extra world units around the screen kept un-culled */
const CULL_MARGIN = 4;

export interface ClientOptions {
    showDebugHud?: boolean;
    /** overrides the camera zoom radius (world units) for debugging, like the original's debug zoom */
    debugZoom?: number;
    /** "Play New Game" / "Leave Game": a new life (sandbox respawn) or a new game */
    onPlayAgain?: () => void;
    /** parent element of the DOM HUD (default document.body) */
    hudParent?: HTMLElement;
    /** audio engine shared across games (kept unlocked); a private one when absent */
    audio?: AudioEngine;
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
    readonly match: MatchUi;
    readonly audio: AudioEngine;
    readonly particles: ParticleSystem;
    readonly bullets: BulletSystem;
    readonly effects: GameEffects;
    readonly gasOverlay = new GasShape(WORLD_GAS_COLOR);
    readonly interactions = new InteractionTracker();
    readonly pingIndicator: PingIndicator;
    world: ObjectWorld | null = null;
    air: AirSystem | null = null;
    minimap: Minimap | null = null;
    map: MapData | null = null;
    terrain: TerrainShape | null = null;
    private terrainQuery: Terrain | null = null;
    /** the local player's id (from the join) */
    localId = -1;
    /** the player the camera follows: the local player, or the one being spectated */
    activeId = -1;
    local: LocalPlayerState | null = null;
    /** latest snapshot tick */
    tick = 0;
    snapshotCount = 0;
    /** active player position in the latest snapshot (authoritative, not interpolated) */
    readonly localPos: Vec2 = { x: 0, y: 0 };
    /** position the active player was drawn at this frame */
    visualPos: Vec2 = { x: 0, y: 0 };
    preloaded: Promise<void> = Promise.resolve();
    /** map sprites are loaded and at least one snapshot has been applied */
    texturesReady = false;
    /** interaction prompt shown this frame (tests) */
    interaction: Prompt | null = null;
    private cameraPlaced = false;
    private readonly debugZoom: number | undefined;
    private readonly ownsAudio: boolean;
    private destroyed = false;

    constructor(app: Application, transport: Transport, textures: TextureStore, opts: ClientOptions = {}) {
        this.app = app;
        this.transport = transport;
        this.textures = textures;
        this.audio = opts.audio ?? new AudioEngine();
        this.ownsAudio = !opts.audio;
        this.renderer = new Renderer(app, this.camera);
        this.renderer.gas.addChild(this.gasOverlay.display);
        this.hud = new DebugHud(!!opts.showDebugHud);
        this.debugZoom = opts.debugZoom;
        this.renderer.overlay.addChild(this.hud.container);
        this.pingIndicator = new PingIndicator(textures);
        this.renderer.overlay.addChild(this.pingIndicator.container);
        this.particles = new ParticleSystem(this.renderer, textures);
        this.bullets = new BulletSystem(this.renderer, textures, this.audio, this.particles);
        this.effects = new GameEffects(this.audio, this.particles, this.bullets);
        const parent = opts.hudParent ?? document.body;
        this.ui = new Hud(parent, { action: (action) => this.input.queueAction(action) });
        const playAgain = opts.onPlayAgain ?? (() => {});
        this.match = new MatchUi({
            hudRoot: this.ui.root,
            parent,
            audio: this.audio,
            killLeaderEnabled: true,
            spectate: (action) => this.transport.spectate(action),
            playAgain,
        });
        transport.onJoin((map, playerId) => this.join(map, playerId));
        transport.onSnapshot((s) => this.onSnapshot(s));
        app.ticker.add(this.frame);
    }

    private join(map: MapData, playerId: number): void {
        if (this.destroyed) return;
        this.match.reset(playerId);
        this.interactions.clear();
        if (this.map === map && this.world) {
            // same game, new local player (sandbox respawn): drop every view, the next snapshot rebuilds them
            this.world.clear();
            this.air?.clear();
            this.interp.clear();
            this.effects.clear();
            this.localId = playerId;
            this.activeId = playerId;
            this.local = null;
            this.cameraPlaced = false;
            this.effects.setWorld(this.world, playerId);
            return;
        }
        this.map = map;
        this.localId = playerId;
        this.activeId = playerId;
        const mapDef = getMapDef(map.mapName);
        // the same deterministic polygons the simulation uses for surfaces
        this.terrainQuery = createTerrain(map);
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
        this.air = new AirSystem({
            renderer: this.renderer,
            textures: this.textures,
            audio: this.audio,
            particles: this.particles,
            mapDef,
            isWater: (p) => (this.terrainQuery ? isTerrainWater(this.terrainQuery, p) : false),
        });
        this.minimap?.destroy();
        this.minimap = new Minimap(this.app, this.textures, map, terrain);
        this.renderer.overlay.addChildAt(this.minimap.container, 0);
        this.camera.pos = { x: map.width / 2, y: map.height / 2 };

        const sprites = mapSprites(map);
        outfitSprites("outfitBase", sprites);
        // air drops: plane, chute, the crates of the map and what they turn into
        sprites.set(mapDef.biome.airdrop.planeImg, 3);
        sprites.set(mapDef.biome.airdrop.airdropImg, 1.5);
        for (const crate of mapDef.gameConfig.planes.crates) {
            mapObjectSprites(crate.name, sprites);
            const destroyType = (MapObjectDefs[crate.name] as { destroyType?: string } | undefined)?.destroyType;
            if (destroyType) mapObjectSprites(destroyType, sprites);
        }
        this.preloaded = this.textures.preload(sprites).then(() => {
            this.texturesReady = true;
        });
        this.audio.preload(["player_bullet_hit_01", "player_bullet_hit_02", "bullet_whiz_01", "punch_swing_01"]);
        this.audio.preload(["leader_assigned_01", "leader_dead_01", "ping_airdrop_01"], "ui");
    }

    private onSnapshot(s: Snapshot): void {
        if (!this.world || this.destroyed) return;
        if (s.localPlayerId !== this.activeId) this.retarget(s.localPlayerId);
        this.effects.beginSnapshot(s);
        this.world.applySnapshot(s);
        this.effects.endSnapshot(s);
        this.interp.push(s, performance.now() / 1000);
        this.air?.apply(s.planes ?? [], s.airdrops ?? []);
        if (this.minimap && s.mapIndicators?.length) {
            for (const ping of this.minimap.applyIndicators(s.mapIndicators)) {
                // map-event pings always play at full volume (survev emote.ts addPing)
                this.audio.playSound(ping.def.sound, { channel: "ui" });
                if (ping.def.mapEvent) this.pingIndicator.show(ping.def, ping.pos);
            }
        }
        if (!this.local) this.effects.preloadWeapons(s.local);
        this.local = s.local;
        this.tick = s.tick;
        this.snapshotCount++;
        const me = this.world.get(this.activeId);
        if (me) {
            this.localPos.x = me.pos.x;
            this.localPos.y = me.pos.y;
        }
        this.match.applySnapshot(s, this.localPos);
    }

    /** The snapshots now follow another player (spectating): re-aim the camera and the "local" effects. */
    private retarget(id: number): void {
        this.activeId = id;
        this.cameraPlaced = false;
        this.local = null;
        this.interactions.clear();
        if (this.world) this.effects.setWorld(this.world, id);
    }

    get ready(): boolean {
        return this.texturesReady && this.snapshotCount > 0;
    }

    /** Screen position (CSS pixels) of a world position (tests aim with it). */
    worldToScreen(p: Vec2): Vec2 {
        return this.camera.worldToScreen(p);
    }

    private readonly frame = (ticker: Ticker): void => {
        const dt = Math.min(ticker.deltaMS / 1000, 0.1);
        // DOM timers (kill feed, announcements, stats screen) follow the wall clock like the original's jQuery
        // animations, even when frames are slow
        const uiDt = Math.min(ticker.deltaMS / 1000, 1);
        const now = performance.now() / 1000;
        if (this.input.wasPressed(DebugHudBind)) this.hud.toggle();
        if (this.input.wasPressed(MuteBind)) this.audio.toggleMute();
        const world = this.world;
        const screen = this.app.screen;
        this.camera.resize(screen.width, screen.height);
        const scale = uiScale(screen.width, screen.height);
        this.match.update(uiDt, scale, {
            next: this.input.wasPressed("ArrowRight"),
            prev: this.input.wasPressed("ArrowLeft"),
        });
        if (!world || !this.local) {
            this.renderer.update(dt);
            this.ui.update({ dt, local: null, interaction: null });
            this.input.endFrame();
            return;
        }
        this.visualPos = world.visualPos(this.activeId, now) ?? this.localPos;
        this.camera.follow(dt, this.visualPos, this.debugZoom ?? this.local.zoom, !this.cameraPlaced);
        this.cameraPlaced = true;

        const spectating = this.match.spectating;
        const input = this.input.sample(this.camera, this.visualPos);
        if (!spectating) {
            this.transport.sendInput(input);
            this.effects.localInput(input.shootHold);
            if (input.actions.includes(Input.Interact)) this.interactions.interacted(this.interaction, world);
        }
        this.input.endFrame();

        this.renderer.activeLayer = this.local.layer;
        const ctx = { dt, localPos: this.visualPos, localLayer: this.local.layer, localId: this.activeId };
        world.update(ctx, now, this.camera.viewBounds(CULL_MARGIN));
        this.air?.update({
            dt: uiDt,
            viewerPos: this.visualPos,
            viewerLayer: this.local.layer,
            viewerIndoors: world.localIndoors(),
        });
        this.effects.update(dt, this.camera.pos, this.local.layer);
        const masks = world.takeStairMasks();
        if (masks) this.renderer.setStairMasks(masks);
        this.renderer.update(dt);
        this.renderGas(now);
        this.pingIndicator.update(uiDt, this.camera);
        this.minimap?.update(this.camera, this.visualPos, {
            dt: uiDt,
            gas: this.match.gas,
            alpha: this.interp.alpha(now),
        });
        const me = world.get(this.activeId) as PlayerView | undefined;
        this.interaction = spectating ? null : this.interactions.find(world, this.local, me, this.localPos);
        const objectAction = this.interactions.update(uiDt, world);
        const frame: HudFrame = { dt, local: this.local, interaction: this.interaction, objectAction };
        this.ui.update(frame);
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

    /** The red zone over the world, in screen space (survev gas.ts m_render). */
    private renderGas(now: number): void {
        const gas = this.match.gas;
        const circle = gas.circle(this.interp.alpha(now));
        const screen = { x: 0, y: 0, width: this.camera.screenWidth, height: this.camera.screenHeight };
        if (!circle) {
            this.gasOverlay.render({ x: 0, y: 0 }, 1, false, screen);
            return;
        }
        const pos = this.camera.worldToScreen(circle.pos);
        this.gasOverlay.render(pos, circle.rad * this.camera.z(), gas.active, screen);
    }

    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.app.ticker.remove(this.frame);
        this.transport.close();
        this.input.destroy();
        this.world?.clear();
        this.air?.clear();
        this.effects.clear();
        this.minimap?.destroy();
        this.minimap = null;
        this.ui.destroy();
        this.match.dispose();
        this.renderer.destroy();
        if (this.ownsAudio) this.audio.destroy();
    }
}
