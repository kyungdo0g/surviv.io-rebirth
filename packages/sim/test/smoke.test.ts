// Smoke (M5): emitter timing and cloud growth, vision obscured (1x camera) inside and 0.5 s after, players hidden
// in smoke from other players' snapshots, fire extinguishers, smoke views.
import { v2 } from "@rebirth/core";
import { DamageType, GameConfig } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { spawnAt, steps } from "./combatHelpers.ts";
import { clearSpot, fxGame } from "./fxHelpers.ts";

const ZOOM = GameConfig.scopeZoomRadius.desktop;

describe("smoke", () => {
    it("emits 3 clouds at once and 8 more every 1.75 s; clouds grow to 5.5-6.5 and vanish after rules.smokeDuration", () => {
        const origin = clearSpot();
        const { game } = fxGame(origin);
        game.fxRng = game.lootRng;
        game.smokes.addEmitter(origin, 0);
        expect(game.smokes.smokes).toHaveLength(3);
        const counts: number[] = [];
        for (let i = 0; i < 1700; i++) {
            game.step();
            counts.push(game.smokes.smokes.length);
        }
        // the first regular cloud on the first update, then every 1.75 s
        expect(counts[0]).toBe(4);
        expect(counts[174]).toBe(4);
        expect(counts[175]).toBe(5);
        expect(Math.max(...counts)).toBe(11);
        // gone 16 s after the start (conflicts.md smoke-duration: survev timing)
        expect(counts[1599]).toBe(11);
        expect(counts[1600]).toBe(0);
        game.smokes.addEmitter(origin, 0);
        steps(game, 300);
        // the 3 start clouds and the first regular one are fully grown, the others still growing
        const clouds = game.smokes.smokes;
        expect(clouds.every((s) => s.maxSize >= 5.5 && s.maxSize <= 6.5 && s.rad <= s.maxSize)).toBe(true);
        expect(clouds.slice(0, 4).every((s) => s.rad === s.maxSize)).toBe(true);
        expect(clouds[4].rad).toBeLessThan(clouds[4].maxSize);
        // clouds drift slowly and stay near the emitter
        expect(game.smokes.smokes.every((s) => v2.distance(s.pos, origin) < 6)).toBe(true);
    });

    it("forces the camera to 1x inside smoke and until 0.5 s after leaving", () => {
        const origin = clearSpot();
        const { game, p } = fxGame(origin);
        p.inv.set("4xscope", 1);
        p.scope = "4xscope";
        game.step();
        expect(p.zoom).toBe(ZOOM["4xscope"]);
        game.smokes.addEmitter(origin, 0);
        steps(game, 20);
        expect(p.visionObscured).toBe(true);
        expect(p.zoom).toBe(ZOOM["1xscope"]);
        expect(game.getSnapshot(p.id).local.zoom).toBe(ZOOM["1xscope"]);
        game.teleportPlayer(p.id, v2.add(origin, { x: 40, y: 0 }));
        steps(game, 49);
        expect(p.zoom).toBe(ZOOM["1xscope"]);
        steps(game, 2);
        expect(p.zoom).toBe(ZOOM["4xscope"]);
    });

    it("hides players inside smoke from players farther than rules.smokeRevealDistance", () => {
        const origin = clearSpot();
        const { game, p: hider } = fxGame(origin);
        const far = spawnAt(game, v2.add(origin, { x: 20, y: 0 }));
        const near = spawnAt(game, v2.add(origin, { x: 4, y: 0 }));
        const ids = (viewer: number) => game.getSnapshot(viewer).objects.map((o) => o.id);
        game.step();
        expect(ids(far.id)).toContain(hider.id);
        game.smokes.addEmitter(origin, 0);
        steps(game, 30);
        const snap = game.getSnapshot(far.id);
        expect(snap.objects.map((o) => o.id)).not.toContain(hider.id);
        expect(snap.deletedIds).toContain(hider.id);
        expect(snap.smokes?.length).toBeGreaterThan(0);
        expect(ids(near.id)).toContain(hider.id);
        expect(ids(hider.id)).toContain(hider.id);
        // the knob turns the rule off (the original only draws the smoke above the player)
        game.rules.smokeHidesPlayers = false;
        expect(ids(far.id)).toContain(hider.id);
    });

    it("comes out of destroyed fire extinguishers and smoke grenades, with views for the client", () => {
        const origin = clearSpot();
        const { game, p } = fxGame(origin, [{ type: "fire_ext_01", pos: { x: 6, y: 0 } }]);
        const ext = [...game.world.objects.values()].find((o) => o.type === "fire_ext_01")!;
        if (ext.kind !== "obstacle") throw new Error("obstacle expected");
        game.damageObstacle(ext, { amount: 500, damageType: DamageType.Player, sourceId: p.id });
        expect(game.smokes.smokes).toHaveLength(3);
        steps(game, 50);
        const views = game.getSnapshot(p.id).smokes ?? [];
        expect(views).toHaveLength(4);
        for (const s of views) {
            expect(s.layer).toBe(0);
            expect(s.interior).toBe(false);
            expect(s.rad).toBeGreaterThan(0);
            expect(s.id).toBeGreaterThan(0);
        }
        expect(new Set(views.map((s) => s.id)).size).toBe(4);
    });
});
