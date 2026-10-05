// Routes: /?gallery=<filter>&page=<n> sprite gallery; /?fixture=1 renderer fixture; anything else (including
// /?sandbox=1&map=<name>&seed=<n>) the loopback sandbox on the main map. Debug: &debug=1 shows the HUD (F3
// toggles it), &zoom=<radius> overrides the camera zoom radius. Sandbox: &dummies=<n> standing dummies in front of
// the player, &loot=0 removes the map loot, &give=<gunId> a gun with full ammo in slot 1. &lang=ko Korean HUD.
import { Application } from "pixi.js";
import { mountGallery } from "./dev/gallery.ts";
import { bootSandbox } from "./game/sandbox.ts";
import { debugGlobals } from "./globals.ts";
import { parseLang, setLang } from "./l10n/index.ts";

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
    setLang(parseLang(route.get("lang")));
    if (route.has("gallery")) {
        await mountGallery(app, route.get("gallery") ?? "", Number(route.get("page") ?? 0));
        return;
    }
    const seed = Number(route.get("seed") ?? 1);
    bootSandbox(app, {
        mapName: route.get("map") ?? "main",
        seed: Number.isFinite(seed) ? seed : 1,
        fixture: route.get("fixture") === "1",
        showDebugHud: route.get("debug") === "1",
        debugZoom: route.has("zoom") ? Number(route.get("zoom")) || undefined : undefined,
        dummies: Math.max(0, Math.min(16, Math.floor(Number(route.get("dummies") ?? 0) || 0))),
        loot: route.get("loot") !== "0",
        give: route.get("give") ?? undefined,
    });
}

main();
