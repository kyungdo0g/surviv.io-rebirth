// Teammates' names in the world (survev client/src/objects/player.ts createPlayerNameText and the nameText update of
// m_update): bold 22 px Arial in cyan with a 1 px black drop shadow, drawn at half scale 30 px under the player's
// centre, for every member of the followed player's group except the followed player itself.
import { Text } from "pixi.js";
import { type Renderer, toLocal } from "../render/renderer.ts";

/** survev player.ts renderZOrd of players; names sit just over them */
const NAME_Z_ORD = 19;

export interface TeamNameEntry {
    playerId: number;
    name: string;
    pos: { x: number; y: number };
    layer: number;
}

export class TeamNames {
    private readonly renderer: Renderer;
    private readonly texts = new Map<number, Text>();

    constructor(renderer: Renderer) {
        this.renderer = renderer;
    }

    /** names drawn (tests) */
    get shown(): string[] {
        return [...this.texts.values()].filter((t) => t.visible).map((t) => t.text);
    }

    /** Draws a name for each entry (teammates in view) and hides the others. */
    update(entries: readonly TeamNameEntry[]): void {
        const seen = new Set<number>();
        for (const e of entries) {
            seen.add(e.playerId);
            let text = this.texts.get(e.playerId);
            if (!text) {
                text = new Text({
                    text: e.name,
                    resolution: 2,
                    style: {
                        fontFamily: "Arial",
                        fontWeight: "bold",
                        fontSize: 22,
                        align: "center",
                        fill: 0x00ffff,
                        dropShadow: { color: 0x000000, blur: 1, angle: Math.PI / 3, distance: 1, alpha: 1 },
                    },
                });
                text.anchor.set(0.5);
                text.scale.set(0.5);
                this.texts.set(e.playerId, text);
            }
            if (text.text !== e.name) text.text = e.name;
            const p = toLocal(e.pos);
            text.position.set(p.x, p.y + 30);
            text.visible = true;
            this.renderer.add(text, e.layer, NAME_Z_ORD, e.playerId);
        }
        for (const [id, text] of this.texts) {
            if (seen.has(id)) continue;
            text.destroy();
            this.texts.delete(id);
        }
    }

    clear(): void {
        for (const text of this.texts.values()) text.destroy();
        this.texts.clear();
    }
}
