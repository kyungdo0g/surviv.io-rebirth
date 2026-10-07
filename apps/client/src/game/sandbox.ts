// Boots a game: the loopback simulation (default), a game on the server (`net`), or the renderer fixture, and
// exposes the test surface on window.__rebirth. "Play New Game" respawns the local player in a sandbox, and
// otherwise tears the client down and boots a fresh game (a new loopback match, or a new WebSocket game).
// M6: games launched by the menu (menu/app.ts) pass `onQuit`: leaving the game ("Play New Game", "Leave Game", a lost
// connection before the result) tears it down and hands control back to the menu instead.
// M8: touch devices play with the touch controls and join as mobile players (isMobile: the loopback's AddPlayerOptions,
// the network Join message); network games can report players (the game server's /api/report with the join token);
// the in-game menu's Quit Game returns to the menu (the start page when the game was not launched from it); a banned
// address gets the banned text.
import type { Vec2 } from "@rebirth/core";
import { DisconnectReason, type ReportResponse, submitReport } from "@rebirth/protocol";
import { type Application, UPDATE_PRIORITY } from "pixi.js";
import { TextureStore } from "../assets/textures.ts";
import type { AudioEngine } from "../audio/audio.ts";
import { sharedAudio } from "../audio/shared.ts";
import { FixtureTransport } from "../dev/fixtures.ts";
import { debugGlobals } from "../globals.ts";
import { isTouchMode } from "../input/device.ts";
import { t } from "../l10n/index.ts";
import { LoopbackTransport } from "../net/loopback.ts";
import type { Transport } from "../net/transport.ts";
import { describeDisconnect, WsTransport } from "../net/ws.ts";
import type { BuildingRender } from "../objects/building.ts";
import type { ObstacleRender } from "../objects/obstacle.ts";
import type { PlayerRender } from "../objects/player.ts";
import { showToast } from "../ui/toast.ts";
import { GameClient } from "./client.ts";
import { exposeHitFx } from "./debugHitFx.ts";
import { exposeLayerFx } from "./debugLayers.ts";
import { exposeM7 } from "./debugM7.ts";
import { exposeM8 } from "./debugM8.ts";
import { exposeM9 } from "./debugM9.ts";
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
    /** rebirth new-gun beta (the server's GUN_BETA): the new and survev-only guns are common floor loot */
    gunBeta?: boolean;
    /**
     * Loopback match rules: true (default) for the sandbox (starts at once, never ends, always joinable); false for
     * a real match (two players alive for 10 s start it, the last one alive wins).
     */
    sandbox?: boolean;
    /** red-zone stage table: "fast" for the shortened one (gasStages.ts), else the original */
    gas?: string;
    /** loopback team mode: 2 duo, 4 squad (M6) */
    teamMode?: 1 | 2 | 4;
    /** loopback team modes: idle teammates in the local player's group (M6) */
    teammates?: number;
    /** play on a game server instead of the loopback simulation */
    net?: {
        /** HTTP origin of the server; "" uses the page's origin (the Vite dev server proxies /api and /play) */
        server: string;
        name: string;
        /** find_game team mode (M6) */
        teamMode?: 1 | 2 | 4;
        /** find_game auto fill (M6) */
        autoFill?: boolean;
        /** a party's joinGame URL: connect to it instead of calling find_game (M6) */
        joinUrl?: string;
        /** find_game region (M8) */
        region?: string;
    };
    /**
     * Leaving the game returns to the caller (the menu) with an error text for a failed or lost connection, instead of
     * starting a new game (M6).
     */
    onQuit?: (error?: string) => void;
}

/** Menu text of a disconnect reason (survev main.ts getErrorString; index-* strings). */
function quitError(reason: string): string {
    switch (reason) {
        case "find_game_failed":
            return t("index-failed-finding-game");
        case "invalid_protocol":
            return t("index-invalid-protocol");
        case "invalid_token":
        case "join_timeout":
        case "full":
            return t("index-failed-joining-game");
        case DisconnectReason.Banned:
            return describeDisconnect(reason);
        default:
            return t("index-host-closed");
    }
}

/**
 * HTTP origin of the game server behind a /play WebSocket URL, for its /api/report (M8); "" when that is this page's
 * origin (the dev server proxies /api).
 */
function httpOriginOf(wsUrl: string): string {
    try {
        const url = new URL(wsUrl, location.href);
        url.protocol = url.protocol === "wss:" ? "https:" : "http:";
        return url.origin === location.origin ? "" : url.origin;
    } catch {
        return "";
    }
}

/** textures and the (unlocked) audio engine outlive a game, so a new game starts warm */
let sharedTextures: TextureStore | null = null;

export function bootSandbox(app: Application, opts: SandboxOptions): GameClient {
    sharedTextures ??= new TextureStore();
    const audio: AudioEngine = sharedAudio();
    const textures = sharedTextures;
    const touch = isTouchMode();
    const globals = debugGlobals();
    let transport: Transport;
    let loopback: LoopbackTransport | null = null;
    let ws: WsTransport | null = null;
    let client: GameClient | null = null;
    let quitting = false;
    const quit = (error?: string): void => {
        if (quitting || !opts.onQuit) return;
        quitting = true;
        client?.destroy();
        opts.onQuit(error);
    };
    if (opts.fixture) {
        transport = new FixtureTransport();
    } else if (opts.net) {
        const conn = new WsTransport({
            baseUrl: opts.net.server,
            name: opts.net.name,
            mapName: opts.mapName,
            teamMode: opts.net.teamMode,
            autoFill: opts.net.autoFill,
            joinUrl: opts.net.joinUrl,
            region: opts.net.region,
            useTouch: touch,
            isMobile: touch,
            onDisconnect: (reason) => {
                const normal = conn.endedNormally;
                globals.disconnect = { reason, normal, message: describeDisconnect(reason) };
                if (!normal) console.warn(`disconnected: ${describeDisconnect(reason)}`);
                // like the original's onClose: a lost game without its result on screen goes back to the menu
                if (!normal && !client?.match.gameOver.visible) quit(quitError(reason));
                // no menu to go back to: say what happened over the game
                if (!normal && !opts.onQuit) showToast(describeDisconnect(reason), { error: true, durationMs: 8000 });
            },
        });
        ws = conn;
        transport = ws;
    } else {
        loopback = new LoopbackTransport(
            { mapName: opts.mapName, seed: opts.seed, teamMode: opts.teamMode ?? 1 },
            {
                init: {
                    spawnLoot: opts.loot ?? true,
                    sandbox: opts.sandbox ?? true,
                    gasStages: gasStagesFor(opts.gas),
                    gunBeta: opts.gunBeta ?? false,
                },
                dummies: opts.dummies,
                teammates: opts.teammates,
                give: opts.give,
                isMobile: touch,
            },
        );
        transport = loopback;
    }
    const lb = loopback;
    const playAgain = (): void => {
        if (opts.onQuit) {
            quit();
            return;
        }
        if (lb && (opts.sandbox ?? true)) {
            lb.respawn();
            return;
        }
        client?.destroy();
        bootSandbox(app, opts);
    };
    const net = opts.net;
    const reportVia = ws;
    // a party game connects to the joinGame URL's server, which also takes its reports
    const reportBase = net?.joinUrl ? httpOriginOf(net.joinUrl) : (net?.server ?? "");
    client = new GameClient(app, transport, textures, {
        showDebugHud: opts.showDebugHud,
        debugZoom: opts.debugZoom,
        onPlayAgain: playAgain,
        audio,
        touch,
        // Quit Game: back to the menu, or to the start page for games launched by URL
        onQuit: () => {
            if (opts.onQuit) quit();
            else location.assign("/");
        },
        report: reportVia
            ? (req) => {
                  const token = reportVia.connection.joinToken;
                  if (!token) return Promise.resolve<ReportResponse>({ ok: false, error: "invalid_token" });
                  return submitReport(reportBase, { token, ...req });
              }
            : undefined,
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
    globals.teammates = loopback?.teammates ?? [];
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
    globals.perf = { sampleFrames: (frames: number) => sampleFrameTimes(client.app, frames) };
    exposeWorldFeel(client);
    exposeM5(client);
    exposeM6(client);
    exposeM7(client);
    exposeM8(client);
    exposeM9(client);
    exposeLayerFx(client);
    exposeHitFx(client, loopback?.game);
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
        /** air strike planes the client created since boot (rebirth variants: carpet sends 6) */
        get strikePlanesSeen() {
            return client.air?.strikePlanesSeen ?? 0;
        },
    };
}

/** M9 world-feel hooks: camera particles, ground surfaces, a player's footsteps / wading / bush effects. */
function exposeWorldFeel(client: GameClient): void {
    debugGlobals().worldFeel = {
        get cameraEmitter() {
            return { type: client.cameraFx?.type ?? "", running: !!client.cameraFx?.running };
        },
        get particles() {
            return client.particles.count;
        },
        /** sounds merged into a playing instance (canCoalesce) */
        get coalesced() {
            return client.audio.coalesced;
        },
        surfaceAt: (x: number, y: number, layer = 0) =>
            client.worldQueries?.groundSurface({ x, y }, layer).type ?? null,
        /** footsteps, splashes and bush effects played by a player's view, its surface and wading depth */
        steps: (id: number) => {
            const r = client.world?.renderOf(id) as PlayerRender | undefined;
            const steps = r && "steps" in r ? r.steps : null;
            return steps ? { ...steps.counts, surface: steps.surface, depth: steps.depth } : null;
        },
    };
}

/** CPU time per ticker frame over a sample, in ms */
interface FrameTimes {
    avgMs: number;
    medianMs: number;
    /** mean of the frames between the 5th and the 95th percentile (stalls of a loaded machine left out) */
    trimmedMs: number;
    maxMs: number;
    frames: number;
}

/**
 * CPU time of a ticker frame (every callback: the game client's update, then Pixi's render) over the next `frames`
 * frames, in ms (M9 frame-time check): a first and a last ticker callback bracket the frame.
 */
function sampleFrameTimes(app: Application, frames: number): Promise<FrameTimes> {
    return new Promise((resolve) => {
        let start = 0;
        const times: number[] = [];
        const begin = (): void => {
            start = performance.now();
        };
        const end = (): void => {
            if (!start) return;
            times.push(performance.now() - start);
            if (times.length < frames) return;
            app.ticker.remove(begin);
            app.ticker.remove(end);
            const sorted = [...times].sort((a, b) => a - b);
            const mid = sorted.slice(Math.floor(sorted.length * 0.05), Math.ceil(sorted.length * 0.95));
            resolve({
                avgMs: times.reduce((a, b) => a + b, 0) / times.length,
                medianMs: sorted[Math.floor(sorted.length / 2)],
                trimmedMs: mid.reduce((a, b) => a + b, 0) / mid.length,
                maxMs: sorted[sorted.length - 1],
                frames: times.length,
            });
        };
        app.ticker.add(begin, undefined, UPDATE_PRIORITY.INTERACTION + 1);
        app.ticker.add(end, undefined, UPDATE_PRIORITY.UTILITY - 1);
    });
}

/** M6 test hooks: team HUD, minimap team dots, names, emotes and pings, revive prompt. */
function exposeM6(client: GameClient): void {
    const globals = debugGlobals();
    const team = client.teamPlay;
    globals.team = {
        get members() {
            return team.team ?? [];
        },
        get hudRows() {
            return team.hud.memberCount;
        },
        get indicators() {
            return team.hud.indicatorCount;
        },
        get names() {
            return team.names.shown;
        },
        get minimapDots() {
            return client.minimap?.teamDots ?? 0;
        },
    };
    globals.emotes = {
        get received() {
            return team.received;
        },
        get sent() {
            return team.wheel.sent;
        },
        get bubbles() {
            return team.emotes.bubbleCount;
        },
        get shown() {
            return team.emotes.emotesShown;
        },
        get pings() {
            return team.emotes.activePings;
        },
        get mapPings() {
            return client.minimap?.indicators.playerPingCount ?? 0;
        },
        get wheel() {
            return team.wheel.openWheel;
        },
    };
    /** a player's view as last received (downed, action, anim), or null when not in view */
    globals.playerView = (id: number) => client.world?.get(id) ?? null;
    /** bleed splats a player's view has spawned */
    globals.playerBleeds = (id: number) => (client.world?.renderOf(id) as PlayerRender | undefined)?.bleeds ?? 0;
    /** the right-hand gun sprite a player's view draws: texture id, drawn length in sprite px (rebirth bar guns) */
    globals.heldGun = (id: number) => {
        const sprite = (client.world?.renderOf(id) as any)?.gunR?.container?.children?.[0];
        if (!sprite?.texture) return null;
        return { texture: sprite.texture.label as string, height: sprite.texture.height * Math.abs(sprite.scale.y) };
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
        /** tint of the last map-event ping's edge indicator (rebirth: ping_airstrike takes the zone's colour) */
        get pingTint() {
            return client.pingIndicator.tint;
        },
        /** burst particle scale last drawn for an explosion type (rebirth: sized from the def radius) */
        burstScale: (type: string) => client.worldFx?.explosions.lastBurstScale.get(type) ?? 0,
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
