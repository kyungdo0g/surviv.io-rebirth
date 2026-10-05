// Shared helpers of the M6 specs (teams, downed / revive, emotes and pings, party lobby). The loopback team sandbox
// (`/?team=4&teammates=N&dummies=M`) is driven through the sandbox Game on window.__rebirth.game. Screenshots go to
// __screens__/M6.
import type { Page } from "@playwright/test";

export const SCREENS = "tests/e2e/__screens__/M6";

/** defs Input.Interact */
export const INPUT_INTERACT = 7;
/** defs DamageType */
export const DAMAGE_PLAYER = 0;
export const DAMAGE_GAS = 2;

/** Loads a loopback team route and waits until the team HUD has its rows. */
export async function bootTeam(page: Page, query: string, members: number): Promise<void> {
    await page.goto(query);
    await page.waitForFunction(() => (window as any).__rebirth?.mode === "loopback", null, { timeout: 30_000 });
    await page.waitForFunction(() => (window as any).__rebirth.ready === true, null, { timeout: 45_000 });
    await page.waitForFunction(() => !!(window as any).__rebirth.local, null, { timeout: 15_000 });
    await page.waitForFunction((n) => (window as any).__rebirth.team.hudRows === n, members, { timeout: 15_000 });
}

export async function ids(page: Page): Promise<{ local: number; teammates: number[]; dummies: number[] }> {
    return page.evaluate(() => {
        const r = (window as any).__rebirth;
        return { local: r.player.id as number, teammates: r.teammates as number[], dummies: r.dummies as number[] };
    });
}

/** Sim state of a player: health, downed, dead and its action. */
export async function simPlayer(
    page: Page,
    id: number,
): Promise<{ health: number; downed: boolean; dead: boolean; action: string; pos: { x: number; y: number } }> {
    return page.evaluate((id) => {
        const p = (window as any).__rebirth.game.getPlayer(id);
        return {
            health: p.health,
            downed: p.downed,
            dead: p.dead,
            action: p.action.type,
            pos: { x: p.pos.x, y: p.pos.y },
        };
    }, id);
}

/** Deals lethal-sized damage to `target` (a knock in team modes). */
export async function knock(page: Page, target: number, opts: { sourceId?: number; gas?: boolean } = {}) {
    await page.evaluate(
        ({ target, sourceId, gas }) => {
            const g = (window as any).__rebirth.game;
            g.damagePlayer(g.getPlayer(target), {
                amount: 250,
                damageType: gas ? 2 : 0,
                gameSourceType: gas ? undefined : "fists",
                sourceId,
                dir: { x: 0, y: 1 },
            });
        },
        { target, sourceId: opts.sourceId, gas: !!opts.gas },
    );
}

/**
 * Teleports player `id` next to player `from`: `offset` if that spot is open ground, else the first open spot on the
 * circle of the same radius (no obstacle or building within 2.5 units, so trees do not hide it in screenshots).
 */
export async function placeNear(page: Page, id: number, from: number, offset: { x: number; y: number }) {
    await page.evaluate(
        ({ id, from, offset }) => {
            const g = (window as any).__rebirth.game;
            const c = g.getPlayer(from).pos;
            const rad = Math.hypot(offset.x, offset.y);
            const start = Math.atan2(offset.y, offset.x);
            const open = (p: { x: number; y: number }) =>
                g.canPlayerSpawn(p) &&
                g.world
                    .query({ min: { x: p.x - 2.5, y: p.y - 2.5 }, max: { x: p.x + 2.5, y: p.y + 2.5 } })
                    .every((e: any) => e.kind !== "obstacle" && e.kind !== "building");
            let spot = { x: c.x + offset.x, y: c.y + offset.y };
            for (let i = 0; i < 16; i++) {
                const a = start + (i * Math.PI) / 8;
                const p = { x: c.x + Math.cos(a) * rad, y: c.y + Math.sin(a) * rad };
                if (open(p)) {
                    spot = p;
                    break;
                }
            }
            g.teleportPlayer(id, spot);
        },
        { id, from, offset },
    );
}

/** Makes sandbox player `id` press Interact once (a revive when a downed teammate is in range). */
export async function pressInteract(page: Page, id: number) {
    await page.evaluate(
        ({ id, interact }) => {
            const g = (window as any).__rebirth.game;
            g.setInput(id, {
                seq: 1,
                moveLeft: false,
                moveRight: false,
                moveUp: false,
                moveDown: false,
                toMouseDir: { x: 1, y: 0 },
                toMouseLen: 4,
                shootStart: false,
                shootHold: false,
                actions: [interact],
            });
        },
        { id, interact: INPUT_INTERACT },
    );
}

/** Text of the kill feed lines currently shown, newest first. */
export async function killFeed(page: Page): Promise<string[]> {
    return page.evaluate(() => (window as any).__rebirth.match.killFeed as string[]);
}
