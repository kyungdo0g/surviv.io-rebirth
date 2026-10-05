// Boots a game: the loopback simulation (default), a game on the server (`net`), or the renderer fixture, and
// exposes the test surface on window.__rebirth. "Play New Game" respawns the local player in a sandbox, and
// otherwise tears the client down and boots a fresh game (a new loopback match, or a new WebSocket game).
import type { Vec2 } from "@rebirth/core";
import type { Application } from "pixi.js";
import { TextureStore } from "../assets/textures.ts";
import { AudioEngine } from "../audio/audio.ts";
import { FixtureTransport } from "../dev/fixtures.ts";
import { debugGlobals } from "../globals.ts";
import { LoopbackTransport } from "../net/loopback.ts";
import type { Transport } from "../net/transport.ts";
import { describeDisconnect, WsTransport } from "../net/ws.ts";
import type { BuildingRender } from "../objects/building.ts";
import type { ObstacleRender } from "../objects/obstacle.ts";
import type { PlayerRender } from "../objects/player.ts";
import { GameClient } from "./client.ts";
import { gasStagesFor } from "./gasStages.ts";

export interface SandboxOptions {
    mapName: string;
    seed: number;
    /** use the hand-made renderer fixture instead of the simulation */
    fixture?: boolean;
    showDebugHud?: boolean;
    debugZoom?: number;
    /** standing dummy players spawned in front of the local player */
    dummies?: number;
    /** keep the map's loot (default true) */
    loot?: boolean;
    /** comma-separated items for the local player: guns with full ammo, bag items filled (net/loopback.ts) */
    give?: string;
    /**
     * Loopback match rules: true (default) for the sandbox (starts at once, never ends, always joinable); false for
     * a real match (two players alive for 10 s start it, the last one alive wins).
     */
    sandbox?: boolean;
    /** red-zone stage table: "fast" for the shortened one (gasStages.ts), else the original */
    gas?: string;
    /** play on a game server instead of the loopback simulation */
    net?: {
        /** HTTP origin of the server; "" uses the page's origin (the Vite dev server proxies /api and /play) */
        server: string;
        name: string;
    };
}

/** textures and the (unlocked) audio engine outlive a game, so a new game starts warm */
let sharedTextures: TextureStore | null = null;
let sharedAudio: AudioEngine | null = null;

export function bootSandbox(app: Application, opts: SandboxOptions): GameClient {
    sharedTextures ??= new TextureStore();
    sharedAudio ??= new AudioEngine();
    const textures = sharedTextures;
    const globals = debugGlobals();
    let transport: Transport;
    let loopback: LoopbackTransport | null = null;
    let ws: WsTransport | null = null;
    if (opts.fixture) {
        transport = new FixtureTransport();
    } else if (opts.net) {
        const conn = new WsTransport({
            baseUrl: opts.net.server,
            name: opts.net.name,
            mapName: opts.mapName,
            onDisconnect: (reason) => {
                const normal = conn.endedNormally;
                globals.disconnect = { reason, normal, message: describeDisconnect(reason) };
                if (!normal) console.warn(`disconnected: ${describeDisconnect(reason)}`);
            },
        });
        ws = conn;
        transport = ws;
    } else {
        loopback = new LoopbackTransport(
            { mapName: opts.mapName, seed: opts.seed },
            {
                init: {
                    spawnLoot: opts.loot ?? true,
                    sandbox: opts.sandbox ?? true,
                    gasStages: gasStagesFor(opts.gas),
                },
                dummies: opts.dummies,
                give: opts.give,
            },
        );
        transport = loopback;
    }
    const lb = loopback;
    let client: GameClient | null = null;
    const playAgain = (): void => {
        if (lb && (opts.sandbox ?? true)) {
            lb.respawn();
            return;
        }
        client?.destroy();
        bootSandbox(app, opts);
    };
    client = new GameClient(app, transport, textures, {
        showDebugHud: opts.showDebugHud,
        debugZoom: opts.debugZoom,
        onPlayAgain: playAgain,
        audio: sharedAudio,
    });
    exposeGlobals(client, transport, loopback, playAgain);
    globals.mode = loopback ? "loopback" : ws ? "network" : "fixture";
    globals.disconnect = undefined;
    return client;
}

function exposeGlobals(
    client: GameClient,
    transport: Transport,
    loopback: LoopbackTransport | null,
    playAgain: () => void,
): void {
    const globals = debugGlobals();
    const textures = client.textures;
    transport.onSnapshot((s) => {
        globals.lastSnapshot = s;
    });
    globals.client = client;
    globals.transport = transport;
    globals.game = loopback?.game;
    globals.playAgain = playAgain;
    globals.player = {
        get id() {
            return client.localId;
        },
        /** the followed player's position (the spectated player while spectating) */
        get pos() {
            return { x: client.localPos.x, y: client.localPos.y };
        },
    };
    globals.dummies = loopback?.dummies ?? [];
    globals.worldToScreen = (p: Vec2) => client.worldToScreen(p);
    /** interpolated world position an object is drawn at, or null when it is not in view */
    globals.visualPos = (id: number) => client.world?.visualPos(id, performance.now() / 1000) ?? null;
    Object.defineProperty(globals, "tick", { get: () => client.tick, configurable: true, enumerable: true });
    Object.defineProperty(globals, "ready", { get: () => client.ready, configurable: true, enumerable: true });
    Object.defineProperty(globals, "local", { get: () => client.local, configurable: true, enumerable: true });
    globals.renderer = {
        get spriteCount() {
            return client.renderer.spriteCount();
        },
        get fps() {
            return client.renderer.fps();
        },
        get objectCount() {
            return client.world?.size ?? 0;
        },
        get tracerCount() {
            return client.bullets.visibleCount;
        },
        get tracersSpawned() {
            return client.bullets.spawned;
        },
        get particleCount() {
            return client.particles.count;
        },
    };
    globals.playerAnim = (id: number) => (client.world?.renderOf(id) as PlayerRender | undefined)?.animName ?? null;
    exposeM5(client);
    globals.interaction = () => client.interaction;
    globals.audio = {
        get unlocked() {
            return client.audio.unlocked;
        },
        get muted() {
            return client.audio.isMuted;
        },
        get started() {
            return client.audio.started;
        },
        get requested() {
            return client.audio.requested;
        },
        get loaded() {
            return client.audio.loadedCount;
        },
    };
    globals.minimap = {
        get rect() {
            return client.minimap?.rect ?? null;
        },
        get visible() {
            return !!client.minimap?.container.visible;
        },
        get indicators() {
            return client.minimap?.indicators.count ?? 0;
        },
        /** red zone, safe-zone ring and line drawn on the minimap */
        get gas() {
            return client.minimap?.gas.state ?? null;
        },
    };
    globals.hud = {
        get visible() {
            return client.hud.visible;
        },
    };
    globals.textures = {
        get loaded() {
            return textures.loadedCount;
        },
    };
    const match = client.match;
    globals.match = {
        get activeId() {
            return client.activeId;
        },
        get spectating() {
            return match.spectating;
        },
        get aliveCount() {
            return match.aliveCount;
        },
        get localKills() {
            return match.localKills;
        },
        get killFeed() {
            return match.hud.killFeed.visibleTexts();
        },
        get announcement() {
            return match.hud.announcementText;
        },
        get gameOver() {
            const s = match.gameOver;
            return { visible: s.visible, won: s.won, settled: s.settled };
        },
    };
    globals.gas = {
        get active() {
            return match.gas.active;
        },
        get mode() {
            return match.gas.mode;
        },
        get timeLeft() {
            return match.gas.timeLeft();
        },
        get circle() {
            return match.gas.circle(1);
        },
        get safeZone() {
            return match.gas.safeZone();
        },
        get overlayVisible() {
            return client.gasOverlay.display.visible;
        },
    };
    globals.air = {
        get planes() {
            return client.air?.counts.planes ?? 0;
        },
        get airdrops() {
            return client.air?.counts.airdrops ?? 0;
        },
        /** the screen-edge air drop indicator is running */
        get pingIndicator() {
            return client.pingIndicator.active;
        },
    };
}

/** M5 test hooks: explosions, projectiles, smoke, air strike zones, doors, roofs, layers and ambience. */
function exposeM5(client: GameClient): void {
    const globals = debugGlobals();
    globals.fx = {
        get explosions() {
            return client.worldFx?.explosions.spawned ?? 0;
        },
        get explosionBursts() {
            return client.worldFx?.explosions.bursts ?? 0;
        },
        get projectiles() {
            const p = client.worldFx?.projectiles;
            return p
                ? { count: p.count, visible: p.visibleCount, shadows: p.shadowCount, maxPosZ: p.maxPosZ, topZ: p.topZ }
                : null;
        },
        get smokes() {
            const s = client.worldFx?.smokes;
            return s ? { count: s.count, visible: s.visibleCount } : null;
        },
        /** particles of a type spawned since boot */
        particles: (type: string) => client.particles.spawnedByType.get(type) ?? 0,
        get emitters() {
            return client.particles.emitterCount;
        },
        get shake() {
            return client.camera.lastShake;
        },
        get cameraZoom() {
            return client.camera.zoom;
        },
        get airstrikeZones() {
            return client.minimap?.airstrikeZones.list ?? [];
        },
        get recorders() {
            return client.worldFx?.recorders ?? 0;
        },
        get ambience() {
            return client.worldFx?.ambience.volumes ?? {};
        },
        get reverb() {
            return client.audio.reverbVolume;
        },
        get muffled() {
            return client.audio.muffledCount;
        },
        get doorErrors() {
            return client.interactions.doorErrors;
        },
        get layerFade() {
            return client.renderer.layerFade;
        },
        get underground() {
            return client.renderer.underground;
        },
    };
    const renderOf = (id: number) => client.world?.renderOf(id);
    globals.doorState = (id: number) => {
        const door = (renderOf(id) as ObstacleRender | undefined)?.door;
        return door ? { rot: door.rot, pos: { x: door.pos.x, y: door.pos.y }, moving: door.moving } : null;
    };
    globals.buildingState = (id: number) => {
        const b = renderOf(id) as BuildingRender | undefined;
        return b && "ceilingAlpha" in b ? { ceilingAlpha: b.ceilingAlpha, ...b.fxCounts } : null;
    };
    globals.throwableSprites = (id: number) => (renderOf(id) as PlayerRender | undefined)?.throwableSprites ?? null;
}
