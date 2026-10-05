// Boots a game: the loopback simulation (default), a game on the server (`net`), or the renderer fixture, and
// exposes the test surface on window.__rebirth.
import type { Vec2 } from "@rebirth/core";
import type { Application } from "pixi.js";
import { TextureStore } from "../assets/textures.ts";
import { FixtureTransport } from "../dev/fixtures.ts";
import { debugGlobals } from "../globals.ts";
import { LoopbackTransport } from "../net/loopback.ts";
import type { Transport } from "../net/transport.ts";
import { describeDisconnect, WsTransport } from "../net/ws.ts";
import type { PlayerRender } from "../objects/player.ts";
import { GameClient } from "./client.ts";

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
    /** gun id given to the local player in slot 1 with full ammo */
    give?: string;
    /** play on a game server instead of the loopback simulation */
    net?: {
        /** HTTP origin of the server; "" uses the page's origin (the Vite dev server proxies /api and /play) */
        server: string;
        name: string;
    };
}

export function bootSandbox(app: Application, opts: SandboxOptions): GameClient {
    const textures = new TextureStore();
    let transport: Transport;
    let loopback: LoopbackTransport | null = null;
    let ws: WsTransport | null = null;
    if (opts.fixture) {
        transport = new FixtureTransport();
    } else if (opts.net) {
        ws = new WsTransport({
            baseUrl: opts.net.server,
            name: opts.net.name,
            mapName: opts.mapName,
            onDisconnect: (reason) => {
                debugGlobals().disconnect = { reason, message: describeDisconnect(reason) };
                console.warn(`disconnected: ${describeDisconnect(reason)}`);
            },
        });
        transport = ws;
    } else {
        loopback = new LoopbackTransport(
            { mapName: opts.mapName, seed: opts.seed },
            { init: { spawnLoot: opts.loot ?? true }, dummies: opts.dummies, give: opts.give },
        );
        transport = loopback;
    }
    const lb = loopback;
    const client = new GameClient(app, transport, textures, {
        showDebugHud: opts.showDebugHud,
        debugZoom: opts.debugZoom,
        onRespawn: lb ? () => lb.respawn() : ws ? () => location.reload() : undefined,
        playerName: lb ? (id) => lb.playerName(id) : undefined,
    });

    const globals = debugGlobals();
    globals.mode = loopback ? "loopback" : ws ? "network" : "fixture";
    transport.onSnapshot((s) => {
        globals.lastSnapshot = s;
    });
    globals.client = client;
    globals.transport = transport;
    globals.game = loopback?.game;
    globals.player = {
        get id() {
            return client.localId;
        },
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
    return client;
}
