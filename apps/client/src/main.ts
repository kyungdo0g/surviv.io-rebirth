// Routes: /?gallery=<filter>&page=<n> sprite gallery; /?fixture=1 renderer fixture; anything else (including
// /?sandbox=1&map=<name>&seed=<n>) the loopback sandbox on the main map. Debug: &debug=1 shows the HUD (F3
// toggles it), &zoom=<radius> overrides the camera zoom radius. Sandbox: &dummies=<n> standing dummies in front of
// the player, &loot=0 removes the map loot, &give=<id,...> guns with full ammo and bag items (throwables, heals,
// boosts, scopes) filled to capacity, the first gun or throwable equipped. &lang=ko Korean HUD.
// Match (M4): the loopback runs a sandbox match (starts at once, never ends) unless &sandbox=0 (a real match: two
// players alive for 10 s start it, the last one alive wins); &gas=fast uses a shortened red-zone stage table.
// Teams (M6): &team=2|4 makes the loopback a duo / squad game with &teammates=<n> idle teammates in the local player's
// group (behind it) and the dummies as enemies.
// Network: &net=1&name=<player name> joins a solo game on the server through the dev proxy, or &server=<http origin>
// a specific server (&mode=2|4 a duo / squad one).
// Menu (M6): /?menu=1, /?net=1 without a name, or /?team=<room code> (also /#<code>) open the start page: name, Play
// Solo / Duo / Squad, Create Team / Join Team (the party lobby) against the dev proxy or &server=; &name= prefills the
// name, &lang= the language (else the stored choice).
import "@fontsource/roboto-condensed/400.css";
import "@fontsource/roboto-condensed/700.css";
import "@fontsource/noto-sans-kr/400.css";
import "@fontsource/noto-sans-kr/700.css";
import { Application } from "pixi.js";
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

    const route = new URLSearchParams(location.search);
    const roomCode = roomCodeOf(route);
    const menu = route.get("menu") === "1" || !!roomCode || (route.get("net") === "1" && !route.has("name"));
    setLang(route.has("lang") ? parseLang(route.get("lang")) : ((menu ? storedLang() : null) ?? "en"));
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
    const net =
        route.get("net") === "1" || route.has("server")
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
        sandbox: route.get("sandbox") !== "0",
        gas: route.get("gas") ?? undefined,
        teamMode: teamModeOf(route.get("team")),
        teammates: Math.max(0, Math.min(3, Math.floor(Number(route.get("teammates") ?? 0) || 0))),
        net,
    });
}

main();
