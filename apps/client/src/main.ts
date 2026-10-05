import { Application } from "pixi.js";
import { mountGallery } from "./dev/gallery.ts";

declare global {
    interface Window {
        __rebirth: Record<string, unknown>;
    }
}

async function main() {
    window.__rebirth = {};
    const app = new Application();
    await app.init({ resizeTo: window, background: "#80af49", antialias: true, autoDensity: true });
    document.getElementById("game")!.appendChild(app.canvas);
    window.__rebirth.app = app;

    const route = new URLSearchParams(location.search);
    if (route.has("gallery")) {
        await mountGallery(app, route.get("gallery") ?? "", Number(route.get("page") ?? 0));
        return;
    }
    await mountGallery(app, "loot-weapon");
}

main();
