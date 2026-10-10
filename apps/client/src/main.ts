// Routes (M8): `/` with no query, and any route that is neither a game nor a dev page, opens the start menu.
// - Menu (M6): /?menu=1, /?net=1 without a name, or /?team=<room code> (also /#<code>) open the start page: name, region,
//   Play Solo / Duo / Squad, Create Team / Join Team (the party lobby) against the dev proxy or &server=; &name= prefills
//   the name, &lang= the language (else the stored choice).
// - Network: /?net=1&name=<player name> joins a solo game on the server through the dev proxy, or &server=<http origin>
//   a specific server (&mode=2|4 a duo / squad one).
// - Loopback sandbox: only when one of sandbox, seed, map, give, dummies, loot, team (2|4), teammates, gas, fixture,
//   zoom, debug is in the query (e.g. /?sandbox=1&map=<name>&seed=<n>). Debug: &debug=1 shows the HUD (F3 toggles it),
//   &zoom=<radius> overrides the camera zoom radius. Sandbox: &dummies=<n> standing dummies in front of the player,
//   &loot=0 removes the map loot, &give=<id,...> guns with full ammo and bag items (throwables, heals, boosts, scopes)
//   filled to capacity, the first gun or throwable equipped (any gun id, the new beta guns included: give=dshk,rpg7).
//   &beta=1 turns on the new-gun beta (the server's GUN_BETA: new and survev-only guns as common floor loot).
//   &lang=ko Korean HUD. &rain=1 makes the match rain, &rain=0 keeps it dry (else the map seed decides, 30 % of the
//   classic and 50v50 seeds; fx/weather.ts). &dark=1 makes every place pitch dark (a dev check of the unlit
//   interiors' overlay, fx/darkness.ts: shots and explosions light it up).
//   Match (M4): the loopback runs a sandbox match (starts at once, never ends) unless &sandbox=0 (a real match: two
//   players alive for 10 s start it, the last one alive wins); &gas=fast uses a shortened red-zone stage table.
//   Teams (M6): &team=2|4 makes the loopback a duo / squad game with &teammates=<n> idle teammates in the local
//   player's group (behind it) and the dummies as enemies.
//   Building showcase: &building=<type> (or 1 for the first) plays on a map holding only that building or structure,
//   without gas; [ and ] (or the bar at the top) step through every building the maps spawn (dev/showcase.ts).
// - Dev pages: /?gallery=<filter>&page=<n> sprite gallery; /?fixture=1 renderer fixture.
// - Any route: &touch=1 forces the touch controls on, &touch=0 off (else phones, tablets and coarse pointers, M8).
import "@fontsource/roboto-condensed/400.css";
import "@fontsource/roboto-condensed/700.css";
import "@fontsource/noto-sans-kr/400.css";
import "@fontsource/noto-sans-kr/700.css";
import { Application } from "pixi.js";
import { probeOwnerHeldArt } from "./assets/ownerHeldArt.ts";
import { mountGallery } from "./dev/gallery.ts";
import { bootSandbox } from "./game/sandbox.ts";
import { debugGlobals } from "./globals.ts";
import { parseLang, setLang } from "./l10n/index.ts";
import { MenuApp } from "./menu/app.ts";
import { storedLang } from "./menu/mainMenu.ts";

/** A party room code from `?team=` (a loopback `team=2|4` is a team mode, not a code) or the URL hash. */
function roomCodeOf(route: URLSearchParams): string {
    const team = route.get("team") ?? "";
    if (team && team !== "2" && team !== "4") return team.replace(/^#/, "");
    const hash = location.hash.replace(/^#/, "");
    return /^[A-Za-z0-9]{4}$/.test(hash) ? hash : "";
}

function teamModeOf(value: string | null): 1 | 2 | 4 {
    return value === "2" ? 2 : value === "4" ? 4 : 1;
}

/** Query keys that open the loopback sandbox (M8: anything else without a game route opens the menu). */
const SANDBOX_KEYS = [
    "sandbox",
    "seed",
    "map",
    "give",
    "beta",
    "dummies",
    "loot",
    "team",
    "teammates",
    "gas",
    "fixture",
    "zoom",
    "debug",
    "building",
    "rain",
    "dark",
] as const;

function isSandboxRoute(route: URLSearchParams): boolean {
    return SANDBOX_KEYS.some((key) => {
        if (!route.has(key)) return false;
        // `team` is a team mode only as 2 / 4; any other value is a party room code (the menu)
        return key !== "team" || route.get("team") === "2" || route.get("team") === "4";
    });
}

async function main() {
    const globals = debugGlobals();
    const app = new Application();
    await app.init({
        resizeTo: window,
        background: "#80af49",
        antialias: false,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
    });
    document.getElementById("game")!.appendChild(app.canvas);
    globals.app = app;
    // which of the owner's held sprites pnpm assets installed (objects/heldGun.ts draws only those)
    await probeOwnerHeldArt();

    const route = new URLSearchParams(location.search);
    const roomCode = roomCodeOf(route);
    const netRoute = route.get("net") === "1" || route.has("server");
    const menu =
        route.get("menu") === "1" ||
        !!roomCode ||
        (route.get("net") === "1" && !route.has("name")) ||
        (!netRoute && !isSandboxRoute(route) && !route.has("gallery"));
    setLang(route.has("lang") ? parseLang(route.get("lang")) : (storedLang() ?? "en"));
    if (route.has("gallery")) {
        await mountGallery(app, route.get("gallery") ?? "", Number(route.get("page") ?? 0));
        return;
    }
    const debugZoom = route.has("zoom") ? Number(route.get("zoom")) || undefined : undefined;
    if (menu) {
        new MenuApp(app, {
            server: route.get("server") ?? "",
            mapName: route.get("map") ?? "main",
            name: route.get("name") ?? undefined,
            teamCode: roomCode || undefined,
            showDebugHud: route.get("debug") === "1",
            debugZoom,
        });
        return;
    }
    const seed = Number(route.get("seed") ?? 1);
    const net = netRoute
        ? {
              server: route.get("server") ?? "",
              name: route.get("name") ?? "Player",
              teamMode: teamModeOf(route.get("mode")),
          }
        : undefined;
    bootSandbox(app, {
        mapName: route.get("map") ?? "main",
        seed: Number.isFinite(seed) ? seed : 1,
        fixture: route.get("fixture") === "1",
        showDebugHud: route.get("debug") === "1",
        debugZoom,
        dummies: Math.max(0, Math.min(16, Math.floor(Number(route.get("dummies") ?? 0) || 0))),
        loot: route.get("loot") !== "0",
        give: route.get("give") ?? undefined,
        gunBeta: route.get("beta") === "1",
        sandbox: route.get("sandbox") !== "0",
        gas: route.get("gas") ?? undefined,
        teamMode: teamModeOf(route.get("team")),
        teammates: Math.max(0, Math.min(3, Math.floor(Number(route.get("teammates") ?? 0) || 0))),
        building: route.get("building") ?? undefined,
        rain: route.has("rain") ? route.get("rain") === "1" : undefined,
        dark: route.get("dark") === "1",
        net,
    });
}

main();
