// Shared helpers of the M5 specs (throwables, explosions, smoke, heals, air strikes, doors, roofs, layers) against the
// loopback simulation. They reach into the sandbox Game (window.__rebirth.game) to place players and objects.
// Screenshots go to __screens__/M5.
import type { Page } from "@playwright/test";

export const SCREENS = "tests/e2e/__screens__/M5";

/** World position of the local player in the simulation. */
export async function localPos(page: Page): Promise<{ x: number; y: number }> {
    return page.evaluate(() => {
        const r = (window as any).__rebirth;
        const p = r.game.getPlayer(r.player.id).pos;
        return { x: p.x, y: p.y };
    });
}

/** Moves the mouse onto a world position (aiming). */
export async function aimAt(page: Page, pos: { x: number; y: number }): Promise<void> {
    const s = await page.evaluate((p) => (window as any).__rebirth.worldToScreen(p), pos);
    await page.mouse.move(s.x, s.y);
}

/**
 * Teleports the local player to the nearest free spot (canPlayerSpawn) at least `minDist` units from `from`, searching
 * rings around `around`. Returns the new position or null.
 */
export async function moveLocalAway(
    page: Page,
    from: { x: number; y: number },
    minDist: number,
    around: { x: number; y: number },
): Promise<{ x: number; y: number } | null> {
    return page.evaluate(
        ({ from, minDist, around }) => {
            const r = (window as any).__rebirth;
            const g = r.game;
            for (let ring = 0; ring < 30; ring += 1) {
                for (let a = 0; a < 24; a++) {
                    const ang = (a / 24) * Math.PI * 2;
                    const p = { x: around.x + Math.cos(ang) * ring, y: around.y + Math.sin(ang) * ring };
                    if (Math.hypot(p.x - from.x, p.y - from.y) < minDist) continue;
                    if (g.canPlayerSpawn(p)) {
                        g.teleportPlayer(r.player.id, p);
                        return p;
                    }
                }
            }
            return null;
        },
        { from, minDist, around },
    );
}

/** Keeps the local player alive in the simulation (tests that stand near explosions); returns a stop function. */
export async function keepLocalAlive(page: Page): Promise<() => Promise<void>> {
    await page.evaluate(() => {
        const r = (window as any).__rebirth;
        r.keepAlive = setInterval(() => {
            const p = r.game.getPlayer(r.player.id);
            if (p && !p.dead) p.health = 100;
        }, 20);
    });
    return async () => {
        await page.evaluate(() => clearInterval((window as any).__rebirth.keepAlive));
    };
}

/** Equipped weapon id of the local player. */
export async function equipped(page: Page): Promise<string> {
    return page.evaluate(() => {
        const l = (window as any).__rebirth.local;
        return l.weapons[l.curWeapIdx]?.type ?? "";
    });
}
