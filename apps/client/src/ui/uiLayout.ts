// HUD layout (M8; survev client/src/device.ts onResize, ui/ui.ts resize, ui/touch.ts setMobileStyling;
// docs/research/ui/hud.md "Layout"): the original has a large desktop layout (UiLayout.Lg) and a small one
// (UiLayout.Sm) used on phones and tablets, or when the longer screen side is <= 850 px, or <= 900 px at
// devicePixelRatio >= 3. The layout is re-evaluated on every resize and orientation change. The small layout moves the
// minimap to the top left, hides the leaderboard and the kill leader, puts the kill feed under the minimap and
// rearranges the bottom HUD (hudSm.css; landscape and portrait differ). Its HUD scale factor is 0.5626 (else the
// desktop scale below). `HudLayout` keeps the state and writes the classes `ui-layout-sm` and `ui-landscape` /
// `ui-portrait` on #ui-game.

/** survev device.ts UiLayout */
export const UiLayout = { Lg: "lg", Sm: "sm" } as const;
export type UiLayoutName = (typeof UiLayout)[keyof typeof UiLayout];

/** HUD scale factor of the small layout (survev ui.ts resize: screenScaleFactor) */
export const SM_HUD_SCALE = 0.5626;

/** Ammo column orders (survev touch.ts setMobileStyling "Reorder ammo for mobile"; hud.md "Inventory"). */
export const AMMO_ORDER_LANDSCAPE = ["50AE", "9mm", "308sub", "12gauge", "flare", "762mm", "45acp", "556mm"] as const;
export const AMMO_ORDER_PORTRAIT = ["9mm", "12gauge", "762mm", "556mm", "50AE", "308sub", "flare", "45acp"] as const;

export interface LayoutState {
    layout: UiLayoutName;
    /** the screen is wider than tall */
    landscape: boolean;
    /** a phone or tablet (survev device.mobile): no kill feed fade, no item count pop */
    mobile: boolean;
    width: number;
    height: number;
}

/** The layout of a screen (survev device.ts onResize). */
export function uiLayoutFor(width: number, height: number, pixelRatio: number, mobile: boolean): UiLayoutName {
    const layoutDim = width > height ? width : height;
    return mobile || layoutDim <= 850 || (layoutDim <= 900 && pixelRatio >= 3) ? UiLayout.Sm : UiLayout.Lg;
}

/** Desktop HUD scale of the original for this screen size (survev ui.ts resize). */
export function uiScale(width: number, height: number): number {
    const clamp = (v: number) => Math.min(1, Math.max(0.75, v));
    return Math.min(1, clamp(width / 1280) * clamp(height / 1024));
}

/** HUD scale factor of a layout state: 0.5626 on the small layout, else the desktop scale. */
export function hudScale(state: LayoutState): number {
    return state.layout === UiLayout.Sm ? SM_HUD_SCALE : uiScale(state.width, state.height);
}

/** Ammo order of the item column: the portrait order on a small portrait screen, else the landscape (desktop) one. */
export function ammoOrder(state: Pick<LayoutState, "layout" | "landscape">): readonly string[] {
    return state.layout === UiLayout.Sm && !state.landscape ? AMMO_ORDER_PORTRAIT : AMMO_ORDER_LANDSCAPE;
}

/** Kill feed line spacing: 35 px, 15 px on the small layout (survev ui2.ts render killFeed offset). */
export function killFeedSpacing(small: boolean): number {
    return small ? 15 : 35;
}

/**
 * Opacity of a kill feed line `ticker` seconds old: fades in over 0.25 s and out between 6 s and 6.5 s, no fade on
 * mobile (survev ui2.ts updateKillFeed "Shorter animation on mobile").
 */
export function killFeedOpacity(ticker: number, mobile: boolean): number {
    if (mobile) return ticker < 6.5 ? 1 : 0;
    const smooth = (v: number, a: number, b: number) => {
        const x = Math.min(1, Math.max(0, (v - a) / (b - a)));
        return x * x * (3 - 2 * x);
    };
    return smooth(ticker, 0, 0.25) * (1 - smooth(ticker, 6, 6.5));
}

/**
 * Scale of an item's image `ticker` seconds after its count went up: a sine pop to 1.33 over 0.05 x pi s, none on
 * mobile (survev ui2.ts updateAnimationWidth + render loot width).
 */
export function itemPopScale(ticker: number, mobile: boolean): number {
    if (mobile) return 1;
    const w = Math.sin(Math.min(ticker / 0.05, Math.PI));
    return 1 + (w < 0.001 ? 0 : w) * 0.33;
}

/**
 * Width (% of the weapon column) of a weapon slot `ticker` seconds after it was equipped: a sine pulse from 83.33 % to
 * 100 % and back over 0.09 x pi s, 83.33 % otherwise and on mobile (survev ui2.ts updateAnimationWidth, render
 * weapons `math.lerp(width, 83.33, 100)`).
 */
export function slotPulseWidth(ticker: number, mobile: boolean): number {
    if (mobile) return 83.33;
    const w = Math.sin(Math.min(ticker / 0.09, Math.PI));
    return 83.33 + (w < 0.001 ? 0 : w) * (100 - 83.33);
}

export function layoutState(width: number, height: number, pixelRatio: number, mobile: boolean): LayoutState {
    return {
        layout: uiLayoutFor(width, height, pixelRatio, mobile),
        landscape: width > height,
        mobile,
        width,
        height,
    };
}

/** The live layout of the page: evaluated on resize / orientation change and every frame, applied to #ui-game. */
export class HudLayout {
    state: LayoutState;
    private readonly root: HTMLElement;
    private readonly mobile: boolean;
    private readonly listeners = new Set<(s: LayoutState) => void>();
    private readonly onResize = () => this.evaluate();

    constructor(root: HTMLElement, mobile: boolean) {
        this.root = root;
        this.mobile = mobile;
        this.state = this.measure();
        this.apply();
        window.addEventListener("resize", this.onResize);
        window.addEventListener("orientationchange", this.onResize);
    }

    get small(): boolean {
        return this.state.layout === UiLayout.Sm;
    }

    private measure(): LayoutState {
        return layoutState(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1, this.mobile);
    }

    /** Re-reads the screen; listeners hear about a changed layout or orientation (a size change alone is quiet). */
    evaluate(): void {
        const next = this.measure();
        const prev = this.state;
        this.state = next;
        if (next.layout === prev.layout && next.landscape === prev.landscape) return;
        this.apply();
        for (const fn of [...this.listeners]) fn(next);
    }

    /** Calls `fn` now and on every layout / orientation change. */
    onChange(fn: (s: LayoutState) => void): () => void {
        this.listeners.add(fn);
        fn(this.state);
        return () => this.listeners.delete(fn);
    }

    private apply(): void {
        const s = this.state;
        this.root.classList.toggle("ui-layout-sm", s.layout === UiLayout.Sm);
        this.root.classList.toggle("ui-landscape", s.landscape);
        this.root.classList.toggle("ui-portrait", !s.landscape);
    }

    destroy(): void {
        window.removeEventListener("resize", this.onResize);
        window.removeEventListener("orientationchange", this.onResize);
        this.listeners.clear();
    }
}
