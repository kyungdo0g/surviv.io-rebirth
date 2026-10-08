// Loadout menu helpers (survev content wave stage 4b): the crosshair as a CSS cursor (survev client/src/crosshair.ts)
// and the localStorage store, which validates what it reads.
import { defaultLoadout } from "@rebirth/sim";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { crosshairCursor, crosshairDims, crosshairUrl } from "../src/menu/crosshair.ts";

describe("crosshair cursor", () => {
    it("the default crosshair is the system cursor; others are their recoloured SVG centred on the hotspot", () => {
        expect(crosshairCursor(defaultLoadout().crosshair)).toBe("crosshair");
        const c = { type: "crosshair_027", color: 0xff0000, size: 0.5, stroke: 1 };
        expect(crosshairDims(c)).toEqual({ width: 32, height: 32 });
        const cursor = crosshairCursor(c);
        expect(cursor.startsWith("url('data:image/svg+xml;utf8,")).toBe(true);
        expect(cursor).toContain("%23ff0000");
        expect(cursor).not.toContain("white");
        expect(cursor).toContain('width="32"');
        expect(cursor.endsWith(" 16 16, crosshair")).toBe(true);
        expect(crosshairUrl({ ...c, type: "nope" })).toBe("");
    });
});

describe("loadout store", () => {
    let store: Map<string, string>;
    beforeEach(() => {
        vi.resetModules();
        store = new Map();
        vi.stubGlobal("localStorage", {
            getItem: (k: string) => store.get(k) ?? null,
            setItem: (k: string, v: string) => void store.set(k, v),
        });
    });

    it("saves to localStorage and reads back validated; a broken entry gives the defaults", async () => {
        const { loadLoadout, saveLoadout, joinLoadout } = await import("../src/menu/loadoutStore.ts");
        expect(loadLoadout()).toEqual(defaultLoadout());
        saveLoadout({ ...defaultLoadout(), outfit: "outfitAurora", melee: "katana" });
        expect(JSON.parse(store.get("rebirth.loadout")!)).toMatchObject({ outfit: "outfitAurora", melee: "fists" });
        expect(joinLoadout()).toMatchObject({ outfit: "outfitAurora", melee: "fists", heal: "heal_basic" });

        vi.resetModules();
        store.set("rebirth.loadout", "{not json");
        const fresh = await import("../src/menu/loadoutStore.ts");
        expect(fresh.loadLoadout()).toEqual(defaultLoadout());
    });

    it("keeps the loadout in memory when storage is blocked", async () => {
        vi.stubGlobal("localStorage", {
            getItem: () => {
                throw new Error("blocked");
            },
            setItem: () => {
                throw new Error("blocked");
            },
        });
        const { loadLoadout, saveLoadout } = await import("../src/menu/loadoutStore.ts");
        saveLoadout({ ...defaultLoadout(), heal: "heal_moon" });
        expect(loadLoadout().heal).toBe("heal_moon");
    });
});
