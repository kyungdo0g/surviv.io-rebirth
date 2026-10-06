// Shared helpers of the M7 specs (event modes on the client): loopback boots on the event maps, sim shortcuts through
// window.__rebirth.game and the M7 test hooks. Screenshots go to __screens__/M7.
import type { Page } from "@playwright/test";

export const SCREENS = "tests/e2e/__screens__/M7";

/** Loads a loopback route and waits until the local state is rendered (no sprite-count wait: waiting rooms are dark). */
export async function bootMode(page: Page, query: string): Promise<void> {
    await page.goto(query);
    await page.waitForFunction(() => (window as any).__rebirth?.mode === "loopback", null, { timeout: 30_000 });
    await page.waitForFunction(() => (window as any).__rebirth.ready === true, null, { timeout: 60_000 });
    await page.waitForFunction(() => !!(window as any).__rebirth.local, null, { timeout: 15_000 });
}

export async function localId(page: Page): Promise<number> {
    return page.evaluate(() => (window as any).__rebirth.player.id as number);
}

/** Promotes player `id` to `role` in the sandbox game (the sim's role system, announced like a scheduled promotion). */
export async function promote(page: Page, id: number, role: string): Promise<void> {
    await page.evaluate(
        ({ id, role }) => {
            const g = (window as any).__rebirth.game;
            g.roles.promote(g.getPlayer(id), role);
        },
        { id, role },
    );
}

/** Drops loot of `type` on the local player's position (sandbox game). */
export async function lootAtPlayer(page: Page, type: string, count = 1): Promise<void> {
    await page.evaluate(
        ({ type, count }) => {
            const r = (window as any).__rebirth;
            const p = r.game.getPlayer(r.player.id);
            r.game.loot.addLoot(type, { x: p.pos.x, y: p.pos.y }, p.layer, count);
        },
        { type, count },
    );
}

/** Loot items of `type` lying within `rad` of the local player (sim world). */
export async function lootNear(page: Page, type: string, rad = 6): Promise<number> {
    return page.evaluate(
        ({ type, rad }) => {
            const r = (window as any).__rebirth;
            const p = r.game.getPlayer(r.player.id).pos;
            const box = { min: { x: p.x - rad, y: p.y - rad }, max: { x: p.x + rad, y: p.y + rad } };
            return r.game.world.query(box).filter((e: any) => e.kind === "loot" && e.type === type).length;
        },
        { type, rad },
    );
}

/** The local player's perk types as the simulation holds them. */
export async function localPerks(page: Page): Promise<string[]> {
    return page.evaluate(() => ((window as any).__rebirth.local.perks ?? []).map((p: any) => p.type) as string[]);
}
