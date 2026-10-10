// The in-game client: feeds transport snapshots into the object views, follows the active player (the local
// player, or the spectated one) with the camera, samples input every frame, and drives the effects (tracers,
// particles, sounds), the red zone, planes and air drops, the DOM HUD and match UI, the minimap and the debug HUD.
// M5: explosions, projectiles, smoke, recorders, ambience and interior music (worldFx.ts), air strike zones, door
// prompts and errors, camera shake and the underground view.
// M6: team play (teamPlay.ts: team HUD, names, minimap team dots, emote / ping wheels, emotes and pings), revive and
// cancel prompts, the revive pie timer and the downed health bar.
// M7 (modes.ts): perk slots and HUD drops, roles and their announcements, faction counters, colours and minimap
// members, the Cobalt class menu, the big map (M / G), haste and frozen player effects, tracer variants; mute moved to N.
// M8: the HUD layout (uiLayout.ts: the small phone layout, re-evaluated on resize / rotation) and the HUD toggles of
// clientControls.ts (Toggle Minimap, Hide UI) applied to the HUD, the minimap and the match HUD every frame.
// M9: the map's falling camera particles (cameraEmitters.ts), the world queries behind footsteps, wading, bushes and the
// ceiling ray scan (worldQuery.ts, handed to the views with their deps), and the map's particle sprites preloaded.
// Rebirth: the Enhanced hit effects (fx/hitFeedback.ts, user/2026-10-07-hit-feedback), drawn after the camera shake;
// the rainy matches (fx/weather.ts in worldFx.ts, user/2026-10-08-rain), decided from the map seed.
import type { Vec2 } from "@rebirth/core";
import { GameObjectDefs, getMapDef, Input, MapObjectDefs, type RoleDef } from "@rebirth/defs";
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
import { bindAudioSettings } from "../audio/shared.ts";
import { BulletSystem } from "../fx/bullets.ts";
import { CameraEmitters } from "../fx/cameraEmitters.ts";
import { GameEffects } from "../fx/effects.ts";
import { FlashbangFx } from "../fx/flashbang.ts";
import { GasShape, WORLD_GAS_COLOR } from "../fx/gas.ts";
import { bindHitFx, HitFeedback } from "../fx/hitFeedback.ts";
import { mapParticleSprites } from "../fx/particleDefsAll.ts";
import { ParticleSystem } from "../fx/particles.ts";
import { rainyMatch } from "../fx/weather.ts";
import { debugCameraAt } from "../globals.ts";
import { InputManager } from "../input/input.ts";
import { DebugHudBind } from "../input/keybinds.ts";
import { createTerrainGraphics } from "../map/terrain.ts";
import { SnapshotInterpolator } from "../net/interp.ts";
import type { Transport } from "../net/transport.ts";
import { crateTierMarkSprites } from "../objects/crateTierMark.ts";
import { FadingSprites } from "../objects/fading.ts";
import { AirSystem } from "../objects/planes.ts";
import type { ViewDeps } from "../objects/types.ts";
import { ObjectWorld } from "../objects/world.ts";
import { WorldQuery, type WorldQueryDeps } from "../objects/worldQuery.ts";
import { Camera } from "../render/camera.ts";
import { Renderer } from "../render/renderer.ts";
import { airstrikeAnnouncement } from "../ui/airstrikeVariantStyle.ts";
import { DebugHud } from "../ui/debugHud.ts";
import { Hud, type HudFrame } from "../ui/hud.ts";
import { Minimap } from "../ui/minimap.ts";
import { PingIndicator } from "../ui/pingIndicator.ts";
import type { ReportFlowDeps } from "../ui/report.ts";
import { HudLayout, hudScale, UiLayout } from "../ui/uiLayout.ts";
import { ClientControls } from "./clientControls.ts";
import { InteractionTracker, type Prompt } from "./interaction.ts";
import { MatchUi } from "./match.ts";
import { ModeUi } from "./modes.ts";
import { TeamPlay } from "./teamPlay.ts";
import { surfaceAt, WorldFx } from "./worldFx.ts";

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
    /** play with the touch controls (M8) */
    touch?: boolean;
    /** the in-game menu's Quit Game (M8) */
    onQuit?: () => void;
    /** network games: sends a player report (M8; absent hides the Report buttons) */
    report?: ReportFlowDeps["submit"];
    /** the sandbox's ?rain=1 / ?rain=0: forces the weather instead of the map seed's (rebirth isRainyMatch) */
    rain?: boolean;
    /** the sandbox's ?dark=1: darkness everywhere (dev check of fx/darkness.ts) */
    dark?: boolean;
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
    /** rebirth Enhanced hit effects (setting enhancedHitFx) */
    readonly hitFx: HitFeedback;
    /** rebirth flashbang: the white-out and muffled hearing of the active player (fx/flashbang.ts) */
    readonly flashFx: FlashbangFx;
    readonly gasOverlay = new GasShape(WORLD_GAS_COLOR);
    readonly interactions: InteractionTracker;
    readonly pingIndicator: PingIndicator;
    readonly teamPlay: TeamPlay;
    readonly modes: ModeUi;
    readonly controls: ClientControls;
    /** small / large HUD layout (M8) */
    readonly layout: HudLayout;
    world: ObjectWorld | null = null;
    /** queries of the world views and terrain (ground surfaces, bushes, ceiling scans; M9) */
    worldQueries: WorldQuery | null = null;
    /** the map's falling leaves / snow around the camera (M9) */
    cameraFx: CameraEmitters | null = null;
    air: AirSystem | null = null;
    worldFx: WorldFx | null = null;
    minimap: Minimap | null = null;
    map: MapData | null = null;
    terrain: TerrainShape | null = null;
    private terrainQuery: Terrain | null = null;
    /** the local player's id (from the join) */
    localId = -1;
    /** the player the camera follows: the local player, or the one being spectated */
    activeId = -1;
    local: LocalPlayerState | null = null;
    /** the local state of the snapshot being applied (the views read it before `local` takes it) */
    private snapLocal: LocalPlayerState | null = null;
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
    private readonly rain: boolean | undefined;
    private readonly dark: boolean;
    private readonly ownsAudio: boolean;
    private readonly unbindAudio: () => void = () => {};
    private readonly unbindHitFx: () => void;
    private destroyed = false;

    constructor(app: Application, transport: Transport, textures: TextureStore, opts: ClientOptions = {}) {
        this.app = app;
        this.transport = transport;
        this.textures = textures;
        this.audio = opts.audio ?? new AudioEngine();
        this.ownsAudio = !opts.audio;
        if (this.ownsAudio) this.unbindAudio = bindAudioSettings(this.audio);
        this.interactions = new InteractionTracker(this.audio);
        this.renderer = new Renderer(app, this.camera);
        this.renderer.gas.addChild(this.gasOverlay.display);
        this.hud = new DebugHud(!!opts.showDebugHud);
        this.debugZoom = opts.debugZoom;
        this.rain = opts.rain;
        this.dark = !!opts.dark;
        this.renderer.overlay.addChild(this.hud.container);
        this.pingIndicator = new PingIndicator(textures);
        this.renderer.overlay.addChild(this.pingIndicator.container);
        this.particles = new ParticleSystem(this.renderer, textures);
        this.bullets = new BulletSystem(this.renderer, textures, this.audio, this.particles);
        this.effects = new GameEffects(this.audio, this.particles, this.bullets);
        const parent = opts.hudParent ?? document.body;
        this.ui = new Hud(parent, {
            action: (action) => this.input.queueAction(action),
            useItem: (item) => this.input.queueUseItem(item),
            drop: (item, weapIdx) => {
                this.transport.dropItem(item, weapIdx);
                this.modes.dropped(item);
            },
        });
        const touch = !!opts.touch;
        this.layout = new HudLayout(this.ui.root, touch);
        const playAgain = opts.onPlayAgain ?? (() => {});
        this.match = new MatchUi({
            hudRoot: this.ui.root,
            parent,
            audio: this.audio,
            killLeaderEnabled: true,
            spectate: (action) => this.transport.spectate(action),
            playAgain,
            teamMode: () => this.teamPlay.teamMode,
            onLocalRole: () => this.modes.onLocalRole(),
            extraButton: () => this.controls.report?.statsButton() ?? null,
        });
        this.hitFx = new HitFeedback({
            renderer: this.renderer,
            textures,
            audio: this.audio,
            particles: this.particles,
            camera: this.camera,
            hudRoot: this.ui.root,
        });
        this.flashFx = new FlashbangFx(this.ui.root, this.audio);
        this.unbindHitFx = bindHitFx(this.hitFx, [this.bullets, this.effects], (on) => {
            this.match.hud.gasFlashEnabled = on;
        });
        this.modes = new ModeUi({
            parent,
            hudRoot: this.ui.root,
            audio: this.audio,
            transport,
            minimap: () => this.minimap,
            teamOf: (id) => this.match.teamId(id),
        });
        this.teamPlay = new TeamPlay({
            renderer: this.renderer,
            textures,
            audio: this.audio,
            camera: this.camera,
            hudRoot: this.ui.root,
            transport,
            minimap: () => this.minimap,
            map: () => this.map,
            pingTint: (id, idx) => this.modes.pingTint(id, idx),
            pingSound: (id, def) => this.modes.pingSound(id, def),
            factionOf: (id) => this.modes.factionOf(id),
            touch,
            closeBigMap: () => this.modes.setBigMap(false),
        });
        this.controls = new ClientControls({
            app,
            renderer: this.renderer,
            textures,
            camera: this.camera,
            input: this.input,
            hudRoot: this.ui.root,
            parent,
            touch,
            modes: this.modes,
            match: this.match,
            emoteWheel: this.teamPlay.wheel,
            layout: this.layout,
            minimap: () => this.minimap,
            quit: opts.onQuit ?? playAgain,
            report: opts.report ?? null,
        });
        this.layout.onChange((state) => {
            this.ui.setLayout(state);
            this.match.hud.setLayout(state.layout === UiLayout.Sm, state.mobile);
        });
        transport.onJoin((map, playerId) => this.join(map, playerId));
        transport.onSnapshot((s) => this.onSnapshot(s));
        app.ticker.add(this.frame);
    }

    private join(map: MapData, playerId: number): void {
        if (this.destroyed) return;
        this.match.reset(playerId);
        this.interactions.clear();
        this.teamPlay.clear();
        this.modes.reset();
        if (this.map === map && this.world) {
            // same game, new local player (sandbox respawn): drop every view, the next snapshot rebuilds them
            this.world.clear();
            this.air?.clear();
            this.interp.clear();
            this.effects.clear();
            this.worldFx?.clear();
            this.minimap?.airstrikeZones.clear();
            this.localId = playerId;
            this.activeId = playerId;
            this.local = null;
            this.cameraPlaced = false;
            this.effects.setWorld(this.world, playerId);
            this.hitFx.setWorld(this.world, playerId);
            return;
        }
        this.map = map;
        this.localId = playerId;
        this.activeId = playerId;
        const mapDef = getMapDef(map.mapName);
        this.ui.setMap(map.mapName);
        this.match.setMap(map.mapName);
        this.modes.setMap(map.mapName);
        // the same deterministic polygons the simulation uses for surfaces
        this.terrainQuery = createTerrain(map);
        const terrain = buildTerrain(map);
        this.terrain = terrain;
        for (const old of this.renderer.terrain.removeChildren()) old.destroy();
        this.renderer.terrain.addChild(createTerrainGraphics(map, terrain));
        this.renderer.setUnderground(mapDef.biome.colors.underground, map.width, map.height);
        this.app.renderer.background.color = mapDef.biome.colors.background;
        const terrainQuery = this.terrainQuery;
        const fading = new FadingSprites(this.renderer);
        this.worldFx?.destroy();
        // ground surfaces, bushes and the ceiling ray scan for the player and building views (M9)
        const queries = new WorldQuery(terrainQuery, mapDef, () => this.world);
        this.worldQueries = queries;
        const deps: ViewDeps & WorldQueryDeps = {
            renderer: this.renderer,
            textures: this.textures,
            mapDef,
            fx: this.effects,
            particles: this.particles,
            audio: this.audio,
            viewerPos: () => this.visualPos,
            fading,
            surfaceAt: (pos, layer) => surfaceAt(terrainQuery, pos, layer),
            teamOf: (id) => this.match.teamId(id),
            nameOf: (id) => this.match.name(id),
            effectsOf: (id) => this.match.effectsOf(id),
            loadedAmmo: (id, gun) => {
                const l = this.snapLocal;
                const w = l && id === this.activeId ? l.weapons[l.curWeapIdx] : undefined;
                return w?.type === gun ? w.ammo : undefined;
            },
            worldQueries: queries,
        };
        this.world = new ObjectWorld(deps, this.interp);
        this.cameraFx?.stop();
        this.cameraFx = new CameraEmitters(this.particles, mapDef.biome.particles.camera);
        this.worldFx = new WorldFx({
            renderer: this.renderer,
            textures: this.textures,
            audio: this.audio,
            particles: this.particles,
            camera: this.camera,
            world: this.world,
            mapDef,
            terrain: terrainQuery,
            terrainShape: terrain,
            fading,
            rainy: rainyMatch(map, this.rain),
            groundSurface: (pos) => queries.groundSurface(pos, 0),
            dark: this.dark,
        });
        this.bullets.shotListener = (pos, layer) => this.worldFx?.darkness.addShot(pos, layer);
        this.effects.setWorld(this.world, playerId);
        this.hitFx.setWorld(this.world, playerId);
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
        this.minimap = new Minimap(this.app, this.textures, map, terrain, this.layout.state.mobile);
        this.renderer.overlay.addChildAt(this.minimap.container, 0);
        this.camera.pos = { x: map.width / 2, y: map.height / 2 };

        const sprites = mapSprites(map);
        outfitSprites("outfitBase", sprites);
        // break debris, hit chips and the falling camera particles (M9)
        mapParticleSprites(
            map.objects.map((o) => o.type),
            mapDef.biome.particles.camera,
            sprites,
        );
        // air drops: plane, chute, the crates of the map and what they turn into
        sprites.set(mapDef.biome.airdrop.planeImg, 3);
        sprites.set(mapDef.biome.airdrop.airdropImg, 1.5);
        for (const crate of mapDef.gameConfig.planes.crates) {
            mapObjectSprites(crate.name, sprites);
            const destroyType = (MapObjectDefs[crate.name] as { destroyType?: string } | undefined)?.destroyType;
            if (destroyType) mapObjectSprites(destroyType, sprites);
            // rebirth air drop tiers: the tier crates and their stars, ready when the first shell opens
            crateTierMarkSprites(crate.name, sprites);
        }
        this.preloaded = this.textures.preload(sprites).then(() => {
            this.texturesReady = true;
        });
        this.audio.preload(["player_bullet_hit_01", "player_bullet_hit_02", "bullet_whiz_01", "punch_swing_01"]);
        this.audio.preload(["leader_assigned_01", "leader_dead_01", "ping_airdrop_01"], "ui");
        // emotes and team pings (M6)
        this.audio.preload(["emote_01", "ping_danger_01", "ping_coming_01", "ping_help_01"], "ui");
        // role announcements, HUD drops and haste bursts (M7)
        const roles = Object.values(GameObjectDefs).filter((d): d is RoleDef => d.type === "role");
        this.audio.preload(["loot_drop_01", ...roles.flatMap((r) => [r.sound.assign, r.sound.dead])], "ui");
        this.audio.preload(["ability_stim_01"], "sfx");
        this.hitFx.preload();
    }

    private onSnapshot(s: Snapshot): void {
        if (!this.world || this.destroyed) return;
        if (s.localPlayerId !== this.activeId) this.retarget(s.localPlayerId);
        this.effects.beginSnapshot(s);
        this.snapLocal = s.local;
        this.world.applySnapshot(s);
        this.effects.endSnapshot(s);
        this.teamPlay.applySnapshot(s, this.localId, this.world);
        this.worldFx?.apply(s);
        // rebirth: announce each new heavy or carpet air strike zone (ui/airstrikeVariantStyle.ts; normal stays silent)
        for (const zone of this.minimap?.airstrikeZones.apply(s.airstrikeZones ?? []) ?? []) {
            const text = zone.announce ? airstrikeAnnouncement(zone.variant) : null;
            if (text) this.match.hud.announce(text);
        }
        this.interp.push(s, performance.now() / 1000);
        this.air?.apply(s.planes ?? [], s.airdrops ?? []);
        if (this.minimap && s.mapIndicators?.length) {
            for (const ping of this.minimap.applyIndicators(s.mapIndicators)) {
                const def = this.minimap.styledPing(ping);
                // map-event pings always play at full volume (survev emote.ts addPing)
                this.audio.playSound(def.sound, { channel: "ui" });
                if (def.mapEvent) this.pingIndicator.show(def, ping.pos);
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
        this.hitFx.applySnapshot(s);
        if (s.flash) this.flashFx.flash(s.flash);
        this.modes.applySnapshot(s, this.localId, this.match.spectating);
    }

    /** The snapshots now follow another player (spectating): re-aim the camera and the "local" effects. */
    private retarget(id: number): void {
        this.activeId = id;
        this.cameraPlaced = false;
        this.local = null;
        this.interactions.clear();
        if (this.world) this.effects.setWorld(this.world, id);
        this.hitFx.setActive(id);
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
        this.controls.handleKeys(this.input);
        const world = this.world;
        const screen = this.app.screen;
        this.camera.resize(screen.width, screen.height);
        const small = this.layout.small;
        const scale = hudScale(this.layout.state);
        const controls = this.controls;
        this.match.update(
            uiDt,
            { scale, small, minimapHidden: controls.minimapHidden || controls.hudHidden },
            {
                next: this.input.wasPressed("ArrowRight"),
                prev: this.input.wasPressed("ArrowLeft"),
            },
        );
        this.modes.update(uiDt, this.input, screen.width, screen.height);
        this.ui.setHidden(controls.hudHidden);
        if (!world || !this.local) {
            this.controls.touchSample(dt, null, true);
            this.teamPlay.updateWheel(uiDt, this.input, null, false);
            this.renderer.update(dt);
            this.ui.update({ dt, local: null, interaction: null });
            this.input.endFrame();
            return;
        }
        this.visualPos = world.visualPos(this.activeId, now) ?? this.localPos;
        const camAt = debugCameraAt() ?? this.visualPos;
        this.camera.follow(dt, camAt, this.debugZoom ?? this.local.zoom, !this.cameraPlaced);
        this.cameraPlaced = true;

        const spectating = this.match.spectating;
        this.teamPlay.updateWheel(uiDt, this.input, this.local, !spectating);
        const touch = this.controls.touchSample(dt, this.local, spectating);
        const input = this.input.sample(this.camera, this.visualPos, touch);
        if (!spectating) {
            this.transport.sendInput(input);
            this.effects.localInput(input.shootHold);
            if (input.actions.includes(Input.Interact)) this.interactions.interacted(this.interaction, world);
        }
        this.input.endFrame();

        this.renderer.activeLayer = this.local.layer;
        this.worldQueries?.beginFrame(dt, this.visualPos, this.local.layer, this.snapshotCount);
        this.cameraFx?.update(dt, this.camera.pos, this.debugZoom ?? this.local.zoom, this.local.layer);
        const ctx = { dt, localPos: this.visualPos, localLayer: this.local.layer, localId: this.activeId };
        world.update(ctx, now, this.camera.viewBounds(CULL_MARGIN));
        // the structures in view, before anything is placed over the ground (renderer.addOverground)
        const masks = world.takeStairMasks();
        if (masks) this.renderer.setStairMasks(masks);
        this.teamPlay.update({
            dt: uiDt,
            now,
            world,
            local: this.local,
            localId: this.localId,
            activeId: this.activeId,
            spectating,
            small,
        });
        this.air?.update({
            dt: uiDt,
            viewerPos: this.visualPos,
            viewerLayer: this.local.layer,
            viewerIndoors: world.localIndoors(),
        });
        this.effects.update(dt, this.camera.pos, this.local.layer);
        const me = world.get(this.activeId) as PlayerView | undefined;
        if (!spectating) this.interactions.updateDoors(dt, world, me, this.visualPos);
        this.worldFx?.update({ dt, viewerPos: this.visualPos, viewerLayer: this.local.layer });
        this.minimap?.airstrikeZones.update(uiDt, this.renderer);
        this.camera.applyShake();
        this.hitFx.update({
            dt,
            now,
            activePos: this.visualPos,
            local: this.local,
            downed: !!me?.downed,
            cursor: spectating || controls.touch ? null : this.input.mouse,
            aimDir: me?.dir ?? { x: 1, y: 0 },
            hudHidden: controls.hudHidden,
            hudScale: scale,
        });
        this.flashFx.update(dt);
        this.renderer.update(dt);
        this.renderGas(now);
        this.pingIndicator.update(uiDt, this.camera);
        this.controls.update({ dt, world, local: this.local, pos: this.visualPos, spectating });
        if (this.minimap) {
            this.minimap.small = small;
            this.minimap.setHidden(controls.minimapHidden || controls.hudHidden);
        }
        this.minimap?.update(this.camera, this.visualPos, {
            dt: uiDt,
            gas: this.match.gas,
            alpha: this.interp.alpha(now),
            team: this.teamPlay.minimapFrame(now),
            faction: this.modes.minimapFrame(
                this.activeId,
                (this.teamPlay.team ?? []).map((m) => m.playerId),
                (id) => this.teamPlay.playerPos(id, now)?.pos ?? null,
            ),
        });
        const canInteract = !spectating && !this.modes.awaitingClass(this.local);
        this.interactions.small = small;
        this.interaction = canInteract ? this.interactions.find(world, this.local, me, this.localPos) : null;
        const objectAction = this.interactions.update(uiDt, world);
        const targetId = this.local.action?.type === "revive" ? (this.local.action.targetId ?? 0) : 0;
        const frame: HudFrame = {
            dt,
            local: this.local,
            interaction: this.interaction,
            objectAction,
            downed: !!me?.downed,
            actionTarget: targetId && !me?.downed ? this.match.name(targetId) : "",
            activeId: this.activeId,
            faction: this.modes.factionOf(this.activeId),
        };
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
        this.unbindHitFx();
        this.hitFx.destroy();
        this.flashFx.destroy();
        this.worldFx?.destroy();
        this.worldFx = null;
        this.cameraFx?.stop();
        this.cameraFx = null;
        this.minimap?.destroy();
        this.minimap = null;
        this.teamPlay.destroy();
        this.controls.destroy();
        this.layout.destroy();
        this.modes.destroy();
        this.ui.destroy();
        this.match.dispose();
        this.renderer.destroy();
        this.unbindAudio();
        if (this.ownsAudio) this.audio.destroy();
    }
}
