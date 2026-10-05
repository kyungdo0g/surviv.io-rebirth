// Boots a local game: the loopback simulation (default) or the renderer fixture, and exposes the test surface
// on window.__rebirth.
import type { Application } from "pixi.js";
import { TextureStore } from "../assets/textures.ts";
import { FixtureTransport } from "../dev/fixtures.ts";
import { debugGlobals } from "../globals.ts";
import { LoopbackTransport } from "../net/loopback.ts";
import type { Transport } from "../net/transport.ts";
import { GameClient } from "./client.ts";

export interface SandboxOptions {
    mapName: string;
    seed: number;
    /** use the hand-made renderer fixture instead of the simulation */
    fixture?: boolean;
    showDebugHud?: boolean;
    debugZoom?: number;
}

export function bootSandbox(app: Application, opts: SandboxOptions): GameClient {
    const textures = new TextureStore();
    let transport: Transport;
    let loopback: LoopbackTransport | null = null;
    if (opts.fixture) {
        transport = new FixtureTransport();
    } else {
        loopback = new LoopbackTransport({ mapName: opts.mapName, seed: opts.seed });
        transport = loopback;
    }
    const client = new GameClient(app, transport, textures, {
        showDebugHud: opts.showDebugHud,
        debugZoom: opts.debugZoom,
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
    Object.defineProperty(globals, "tick", { get: () => client.tick, configurable: true, enumerable: true });
    Object.defineProperty(globals, "ready", { get: () => client.ready, configurable: true, enumerable: true });
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
