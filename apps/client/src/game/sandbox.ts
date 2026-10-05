// Boots a local game: the loopback simulation (default) or the renderer fixture, and exposes the test surface
// on window.__rebirth.
import type { Vec2 } from "@rebirth/core";
import type { Application } from "pixi.js";
import { TextureStore } from "../assets/textures.ts";
import { FixtureTransport } from "../dev/fixtures.ts";
import { debugGlobals } from "../globals.ts";
import { LoopbackTransport } from "../net/loopback.ts";
import type { Transport } from "../net/transport.ts";
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
}

export function bootSandbox(app: Application, opts: SandboxOptions): GameClient {
    const textures = new TextureStore();
    let transport: Transport;
    let loopback: LoopbackTransport | null = null;
    if (opts.fixture) {
        transport = new FixtureTransport();
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
        onRespawn: lb ? () => lb.respawn() : undefined,
        playerName: lb ? (id) => lb.playerName(id) : undefined,
    });

    const globals = debugGlobals();
    globals.mode = loopback ? "loopback" : "fixture";
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
