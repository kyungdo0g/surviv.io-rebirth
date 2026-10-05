// Dev page that renders the sprites in the manifest one screen at a time: /?gallery=<name filter>&page=<n>
import { type Application, Assets, Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import manifest from "../generated/sprite-manifest.json";

const CELL = 112;
const PAD = 8;

export async function mountGallery(app: Application, filter: string, page = 0) {
    const cols = Math.max(1, Math.floor(app.screen.width / CELL));
    const perPage = cols * Math.max(1, Math.floor(app.screen.height / CELL));
    const matching = Object.keys(manifest as Record<string, string>)
        .filter((n) => n.includes(filter))
        .sort();
    const names = matching.slice(page * perPage, (page + 1) * perPage);
    const state = {
        matching: matching.length,
        pages: Math.ceil(matching.length / perPage),
        total: names.length,
        loaded: 0,
        failed: [] as string[],
        done: false,
    };
    window.__rebirth.gallery = state;

    const root = new Container();
    app.stage.addChild(root);

    const textures = await Promise.all(
        names.map(async (name) => {
            const src = `/assets/${(manifest as Record<string, string>)[name]}`;
            try {
                const tex: Texture = await Assets.load({ src, data: { resolution: 2 } });
                state.loaded++;
                return tex;
            } catch {
                state.failed.push(name);
                return undefined;
            }
        }),
    );

    names.forEach((name, i) => {
        const cell = new Container();
        cell.position.set((i % cols) * CELL, Math.floor(i / cols) * CELL);
        cell.addChild(new Graphics().rect(1, 1, CELL - 2, CELL - 2).fill({ color: 0x000000, alpha: 0.12 }));
        const tex = textures[i];
        if (tex) {
            const sprite = new Sprite(tex);
            sprite.anchor.set(0.5);
            const fit = Math.min(1, (CELL - 2 * PAD) / Math.max(tex.width, tex.height));
            sprite.scale.set(fit);
            sprite.position.set(CELL / 2, CELL / 2 - 6);
            cell.addChild(sprite);
        }
        const label = new Text({
            text: name.replace(/\.img$/, ""),
            style: { fontSize: 9, fill: tex ? 0xffffff : 0xff4040, wordWrap: true, wordWrapWidth: CELL - 4 },
        });
        label.position.set(2, CELL - 22);
        cell.addChild(label);
        root.addChild(cell);
    });

    // let two frames render before reporting completion
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    state.done = true;
}
