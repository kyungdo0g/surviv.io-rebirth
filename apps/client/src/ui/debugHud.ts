// Tiny debug readout (fps, tick, position, zoom, sprite and object counts), toggled with F3.
import type { Vec2 } from "@rebirth/core";
import { Container, Graphics, Text } from "pixi.js";

export interface HudStats {
    fps: number;
    tick: number;
    pos: Vec2;
    layer: number;
    zoom: number;
    sprites: number;
    objects: number;
    visibleObjects: number;
}

const REFRESH_INTERVAL = 0.25;

export class DebugHud {
    readonly container = new Container({ label: "debug-hud" });
    private readonly bg = new Graphics();
    private readonly text = new Text({
        text: "",
        style: { fontFamily: "monospace", fontSize: 12, fill: 0xffffff, lineHeight: 15 },
    });
    private ticker = REFRESH_INTERVAL;

    constructor(visible = false) {
        this.text.position.set(8, 6);
        this.container.addChild(this.bg, this.text);
        this.container.position.set(8, 8);
        this.container.visible = visible;
    }

    get visible(): boolean {
        return this.container.visible;
    }

    toggle(): void {
        this.container.visible = !this.container.visible;
        this.ticker = REFRESH_INTERVAL;
    }

    update(dt: number, stats: () => HudStats): void {
        if (!this.container.visible) return;
        this.ticker += dt;
        if (this.ticker < REFRESH_INTERVAL) return;
        this.ticker = 0;
        const s = stats();
        this.text.text = [
            `fps ${s.fps.toFixed(0)}`,
            `tick ${s.tick}`,
            `pos ${s.pos.x.toFixed(2)}, ${s.pos.y.toFixed(2)}  layer ${s.layer}`,
            `zoom ${s.zoom.toFixed(2)}`,
            `sprites ${s.sprites}  objects ${s.visibleObjects}/${s.objects}`,
        ].join("\n");
        this.bg
            .clear()
            .roundRect(0, 0, this.text.width + 16, this.text.height + 12, 4)
            .fill({ color: 0x000000, alpha: 0.5 });
    }
}
