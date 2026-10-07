// Test hooks of the rebirth Enhanced hit effects on window.__rebirth.hitFx (read by tests/e2e/hit-feedback.spec.ts;
// fx/hitFeedback.ts, user/2026-10-07-hit-feedback): what is on screen and the counters since boot, the setting, and a
// loopback-only `hurtLocal` that deals a scripted hit to the followed player.
import { DamageType } from "@rebirth/defs";
import type { Game } from "@rebirth/sim";
import { config } from "../config.ts";
import { debugGlobals } from "../globals.ts";
import type { GameClient } from "./client.ts";

export interface HurtOptions {
    headshot?: boolean;
    damageType?: number;
    /** weapon credited with the hit (default ak47) */
    weapon?: string;
}

export function exposeHitFx(client: GameClient, game: Game | undefined): void {
    const globals = debugGlobals();
    const fx = client.hitFx;
    globals.hitFx = {
        get enabled() {
            return fx.enabled;
        },
        set(on: boolean) {
            config().set("enhancedHitFx", on);
        },
        get state() {
            return {
                markerVisible: fx.markers.markerVisible,
                markers: [...fx.markers.shown],
                arcs: fx.markers.activeArcs,
                arcsStarted: fx.markers.arcsStarted,
                flashes: fx.flashes.count,
                flashesStarted: fx.flashes.started,
                flashesSkipped: fx.flashes.skipped,
                vignette: fx.vignette.shown,
                kick: fx.kickOffset,
                lastShake: client.camera.lastShake,
                ...fx.stats,
            };
        },
        /**
         * Loopback only: a hit of `amount` on the followed player from `fromId` (0 for none), travelling from that
         * player towards it, through the simulation's damage pipeline (so the snapshot carries it like a real hit).
         */
        hurtLocal(fromId: number, amount: number, opts: HurtOptions = {}) {
            if (!game) return false;
            const target = game.getPlayer(client.activeId);
            if (!target) return false;
            const from = fromId ? game.getPlayer(fromId) : undefined;
            const dx = from ? target.pos.x - from.pos.x : 1;
            const dy = from ? target.pos.y - from.pos.y : 0;
            const len = Math.hypot(dx, dy) || 1;
            const chance = game.rules.headshotChance;
            game.rules.headshotChance = opts.headshot ? 1 : 0;
            try {
                game.damagePlayer(target, {
                    amount,
                    damageType: opts.damageType ?? DamageType.Player,
                    gameSourceType: opts.weapon ?? "ak47",
                    sourceId: fromId,
                    dir: { x: dx / len, y: dy / len },
                });
            } finally {
                game.rules.headshotChance = chance;
            }
            return true;
        },
    };
}
