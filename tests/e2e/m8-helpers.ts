// Shared helpers of the M8 spec (client polish: touch controls, settings, rebinding, reports, routing). Touch drags go
// through the Chrome DevTools Protocol (Input.dispatchTouchEvent) so the page sees real multi-touch events. Screenshots
// go to __screens__/M8.
import type { CDPSession, Page } from "@playwright/test";

export const SCREENS = "tests/e2e/__screens__/M8";

/** Loads a loopback route and waits until the local state is rendered. */
export async function bootLoopback(page: Page, query: string): Promise<void> {
    await page.goto(query);
    await page.waitForFunction(() => (window as any).__rebirth?.mode === "loopback", null, { timeout: 30_000 });
    await page.waitForFunction(() => (window as any).__rebirth.ready === true, null, { timeout: 60_000 });
    await page.waitForFunction(() => !!(window as any).__rebirth.local, null, { timeout: 15_000 });
}

/** Loads a menu route and waits for the menu hooks. */
export async function openMenu(page: Page, query: string): Promise<void> {
    await page.goto(query);
    await page.waitForFunction(() => !!(window as any).__rebirth?.menu, null, { timeout: 30_000 });
}

export interface Finger {
    id: number;
    x: number;
    y: number;
}

/** One touch point held on the screen, moved in steps (CDP touch events). */
export class TouchDriver {
    private readonly cdp: CDPSession;
    private readonly page: Page;
    private readonly down = new Map<number, Finger>();

    private constructor(page: Page, cdp: CDPSession) {
        this.page = page;
        this.cdp = cdp;
    }

    static async create(page: Page): Promise<TouchDriver> {
        return new TouchDriver(page, await page.context().newCDPSession(page));
    }

    private points(): Array<{ x: number; y: number; id: number }> {
        return [...this.down.values()].map((f) => ({ x: f.x, y: f.y, id: f.id }));
    }

    async start(id: number, x: number, y: number): Promise<void> {
        this.down.set(id, { id, x, y });
        await this.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: this.points() });
    }

    /** Moves finger `id` to (x, y) in `steps` frames. */
    async move(id: number, x: number, y: number, steps = 5): Promise<void> {
        const f = this.down.get(id);
        if (!f) throw new Error(`finger ${id} is not down`);
        const from = { x: f.x, y: f.y };
        for (let i = 1; i <= steps; i++) {
            f.x = from.x + ((x - from.x) * i) / steps;
            f.y = from.y + ((y - from.y) * i) / steps;
            await this.cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: this.points() });
            await this.page.waitForTimeout(30);
        }
    }

    /** Lifts every finger (a CDP touchEnd carries no points). */
    async endAll(): Promise<void> {
        this.down.clear();
        await this.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
}
