// The in-game client: feeds transport snapshots into the object views, follows the local player with the
// camera, samples input every frame and draws the minimap and debug HUD.
import type { Vec2 } from "@rebirth/core";
import { getMapDef } from "@rebirth/defs";
import type { LocalPlayerState, MapData, Snapshot, TerrainShape } from "@rebirth/sim";
import type { Application, Ticker } from "pixi.js";
import { mapSprites, outfitSprites } from "../assets/spriteSets.ts";
import type { TextureStore } from "../assets/textures.ts";
import { InputManager } from "../input/input.ts";
import { DebugHudBind } from "../input/keybinds.ts";
import { createTerrainGraphics } from "../map/terrain.ts";
import { SnapshotInterpolator } from "../net/interp.ts";
import type { Transport } from "../net/transport.ts";
import { ObjectWorld } from "../objects/world.ts";
import { Camera } from "../render/camera.ts";
import { Renderer } from "../render/renderer.ts";
import { DebugHud } from "../ui/debugHud.ts";
import { Minimap } from "../ui/minimap.ts";
import { buildTerrainShape } from "./terrainSource.ts";

/** extra world units around the screen kept un-culled */
const CULL_MARGIN = 4;

export interface ClientOptions {
    showDebugHud?: boolean;
    /** overrides the camera zoom radius (world units) for debugging, like the original's debug zoom */
    debugZoom?: number;
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
    world: ObjectWorld | null = null;
    minimap: Minimap | null = null;
    map: MapData | null = null;
    terrain: TerrainShape | null = null;
    terrainSource: "sim" | "fallback" | "" = "";
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
    private cameraPlaced = false;
    private readonly debugZoom: number | undefined;

    constructor(app: Application, transport: Transport, textures: TextureStore, opts: ClientOptions = {}) {
        this.app = app;
        this.transport = transport;
        this.textures = textures;
        this.renderer = new Renderer(app, this.camera);
        this.hud = new DebugHud(!!opts.showDebugHud);
        this.debugZoom = opts.debugZoom;
        this.renderer.overlay.addChild(this.hud.container);
        transport.onJoin((map, playerId) => this.join(map, playerId));
        transport.onSnapshot((s) => this.onSnapshot(s));
        app.ticker.add(this.frame);
    }

    private join(map: MapData, playerId: number): void {
        this.map = map;
        this.localId = playerId;
        const mapDef = getMapDef(map.mapName);
        const terrain = buildTerrainShape(map);
        this.terrain = terrain.shape;
        this.terrainSource = terrain.source;
        if (terrain.source === "fallback") console.warn("buildTerrain missing from @rebirth/sim: drawing rectangles");
        for (const old of this.renderer.terrain.removeChildren()) old.destroy();
        this.renderer.terrain.addChild(createTerrainGraphics(map, terrain.shape));
        this.renderer.setUnderground(mapDef.biome.colors.underground, map.width, map.height);
        this.app.renderer.background.color = mapDef.biome.colors.background;
        this.world = new ObjectWorld({ renderer: this.renderer, textures: this.textures, mapDef }, this.interp);
        this.minimap = new Minimap(this.app, this.textures, map, terrain.shape);
        this.renderer.overlay.addChildAt(this.minimap.container, 0);
        this.camera.pos = { x: map.width / 2, y: map.height / 2 };

        const sprites = mapSprites(map);
        outfitSprites("outfitBase", sprites);
        this.preloaded = this.textures.preload(sprites).then(() => {
            this.texturesReady = true;
        });
    }

    private onSnapshot(s: Snapshot): void {
        if (!this.world) return;
        this.world.applySnapshot(s);
        this.interp.push(s, performance.now() / 1000);
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

    private readonly frame = (ticker: Ticker): void => {
        const dt = Math.min(ticker.deltaMS / 1000, 0.1);
        const now = performance.now() / 1000;
        if (this.input.wasPressed(DebugHudBind)) this.hud.toggle();
        const world = this.world;
        const screen = this.app.screen;
        this.camera.resize(screen.width, screen.height);
        if (!world || !this.local) {
            this.renderer.update(dt);
            this.input.endFrame();
            return;
        }
        this.visualPos = world.visualPos(this.localId, now) ?? this.localPos;
        this.camera.follow(dt, this.visualPos, this.debugZoom ?? this.local.zoom, !this.cameraPlaced);
        this.cameraPlaced = true;

        this.transport.sendInput(this.input.sample(this.camera, this.visualPos));
        this.input.endFrame();

        this.renderer.activeLayer = this.local.layer;
        const ctx = { dt, localPos: this.visualPos, localLayer: this.local.layer, localId: this.localId };
        world.update(ctx, now, this.camera.viewBounds(CULL_MARGIN));
        this.renderer.update(dt);
        this.minimap?.update(this.camera, this.visualPos);
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
        this.minimap?.destroy();
    }
}
