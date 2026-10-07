// Sprite id ("map-tree-01.img") -> Pixi Texture, through the generated sprite manifest (spriteManifest.ts).
// Every texture reports the manifest's logical size, the size the definitions' scales are relative to, whatever its
// pixel resolution. SVGs are rasterized once per id at a resolution that matches their on-screen size at the reference
// zoom, so small sprites stay cheap and large ones stay sharp; PNGs (the original v0.8.82 atlas frames, stored at their
// atlas scale) are used at their own resolution, or shrunk when that is more than the sprite needs, never enlarged.
// Missing sprites get a loud placeholder and are recorded in `window.__rebirth.missingSprites`, unless their manifest
// entry names a fallback sprite (the rebirth's new-gun loot icons when the owner's art is not installed): that one is
// drawn instead and the id is recorded in `window.__rebirth.spriteFallbacks`.
// Rebirth: `greySpriteId(id)` names a greyscale copy of a sprite (made once from its texture), so a tint replaces the
// sprite's colours instead of multiplying them (the variant strobes' yellow-green art in their red / magenta).
import { ImageSource, type Sprite, Texture } from "pixi.js";
import { debugGlobals } from "../globals.ts";
import { SPRITES } from "./spriteManifest.ts";

const ASSET_ROOT = "/assets/";

/** Zoom the rasterization targets: a 1920x1080 screen at the 1x scope radius, 960 / (28 * 16) ~ 2.1. */
const REFERENCE_ZOOM = 2.1;
const MIN_RESOLUTION = 0.25;
const MAX_RESOLUTION = 3;
const MAX_TEXTURE_DIM = 4096;
const DEFAULT_CONCURRENCY = 8;
/** Suffix of a greyscale copy's id; its luminance is scaled by GREY_GAIN so the brightest parts take the full tint. */
const GREY_SUFFIX = "#grey";
const GREY_GAIN = 1.3;

/** Id of the greyscale copy of sprite `id` (TextureStore.apply draws it; tint it to recolour the sprite). */
export function greySpriteId(id: string): string {
    return isEmptySprite(id) ? id : `${id}${GREY_SUFFIX}`;
}

/** RGBA pixels (canvas ImageData order) turned to grey in place: luminance x GREY_GAIN, alpha kept. */
export function greyscalePixels(data: Uint8ClampedArray): void {
    for (let i = 0; i < data.length; i += 4) {
        const l = Math.min(255, (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) * GREY_GAIN);
        data[i] = l;
        data[i + 1] = l;
        data[i + 2] = l;
    }
}

/** Ids that mean "no image" in the definitions. */
export function isEmptySprite(id: string | undefined): boolean {
    return !id || id === "none" || id === ".img" || id === "none.img";
}

function createPlaceholder(): Texture {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const cell = size / 4;
    for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
            ctx.fillStyle = (x + y) % 2 ? "#ff00ff" : "#000000";
            ctx.fillRect(x * cell, y * cell, cell, cell);
        }
    }
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, size - 4, size - 4);
    const texture = new Texture({ source: new ImageSource({ resource: canvas }) });
    texture.label = "placeholder";
    return texture;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
    const img = new Image();
    img.src = src;
    await img.decode();
    return img;
}

export class TextureStore {
    readonly placeholder = createPlaceholder();
    /** device pixel ratio the textures were sized for */
    readonly pixelRatio: number;
    private readonly textures = new Map<string, Texture>();
    private readonly pending = new Map<string, Promise<Texture>>();
    /** sprites waiting for a texture that is still loading, by sprite id */
    private readonly waiting = new Map<string, Set<Sprite>>();
    /** the sprite id each sprite currently wants (a sprite may be re-targeted before its first load ends) */
    private readonly wanted = new WeakMap<Sprite, string>();
    readonly missing: string[];
    loadedCount = 0;

    constructor(pixelRatio = window.devicePixelRatio || 1) {
        this.pixelRatio = Math.min(pixelRatio, 2);
        const globals = debugGlobals();
        globals.missingSprites ??= [];
        this.missing = globals.missingSprites;
    }

    /**
     * Points `sprite` at the texture for `id` now, or as soon as it has loaded. `scale` is the sprite's definition
     * scale (texture pixels -> screen pixels at zoom 1) and only matters for the first request of an id.
     */
    apply(sprite: Sprite, id: string | undefined, scale = 1): void {
        const key = isEmptySprite(id) ? "" : id!;
        this.wanted.set(sprite, key);
        if (!key) {
            sprite.texture = Texture.EMPTY;
            return;
        }
        const tex = this.textures.get(key);
        if (tex) {
            sprite.texture = tex;
            return;
        }
        sprite.texture = Texture.EMPTY;
        let set = this.waiting.get(key);
        if (!set) {
            set = new Set();
            this.waiting.set(key, set);
        }
        set.add(sprite);
        void this.request(key, scale);
    }

    /** Whether the texture for `id` has loaded, so apply() shows it at once (preload checks). */
    isLoaded(id: string): boolean {
        return this.textures.has(id);
    }

    /** Loads every `[id, scale]` (largest scale per id wins), `concurrency` at a time. */
    async preload(entries: Iterable<readonly [string, number]>, concurrency = DEFAULT_CONCURRENCY): Promise<void> {
        const scales = new Map<string, number>();
        for (const [id, scale] of entries) {
            if (isEmptySprite(id) || this.textures.has(id)) continue;
            scales.set(id, Math.max(scales.get(id) ?? 0, scale));
        }
        const queue = [...scales];
        const worker = async () => {
            for (let next = queue.pop(); next; next = queue.pop()) {
                await this.request(next[0], next[1]);
            }
        };
        await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
    }

    /** Raster resolution for a sprite drawn at `scale` (definition scale relative to the logical size). */
    resolutionFor(scale: number): number {
        const res = Math.ceil(scale * REFERENCE_ZOOM * this.pixelRatio * 4) / 4;
        return Math.min(MAX_RESOLUTION, Math.max(MIN_RESOLUTION, res));
    }

    private request(id: string, scale: number): Promise<Texture> {
        const loaded = this.textures.get(id);
        if (loaded) return Promise.resolve(loaded);
        let promise = this.pending.get(id);
        if (!promise) {
            promise = this.load(id, scale).then((tex) => {
                this.pending.delete(id);
                this.textures.set(id, tex);
                this.loadedCount++;
                const set = this.waiting.get(id);
                if (set) {
                    for (const sprite of set) {
                        if (!sprite.destroyed && this.wanted.get(sprite) === id) sprite.texture = tex;
                    }
                    this.waiting.delete(id);
                }
                return tex;
            });
            this.pending.set(id, promise);
        }
        return promise;
    }

    private markMissing(id: string, reason: string): Promise<Texture> | Texture {
        const fallback = SPRITES[id]?.fallback;
        if (fallback && fallback !== id) {
            const globals = debugGlobals();
            globals.spriteFallbacks ??= [];
            (globals.spriteFallbacks as string[]).push(id);
            return this.load(fallback, 1);
        }
        if (!this.missing.includes(id)) {
            this.missing.push(id);
            console.warn(`sprite ${id}: ${reason}`);
        }
        return this.placeholder;
    }

    /** The greyscale copy of `base`'s texture (the base itself when it has no pixels to read: empty, placeholder). */
    private async loadGrey(id: string, base: string, scale: number): Promise<Texture> {
        const tex = await this.request(base, scale);
        const resource = tex.source?.resource as HTMLImageElement | HTMLCanvasElement | undefined;
        if (tex === this.placeholder || tex === Texture.EMPTY || !resource?.width) return tex;
        const canvas = document.createElement("canvas");
        canvas.width = resource.width;
        canvas.height = resource.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(resource, 0, 0);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        greyscalePixels(pixels.data);
        ctx.putImageData(pixels, 0, 0);
        const source = new ImageSource({
            resource: canvas,
            alphaMode: "premultiply-alpha-on-upload",
            resolution: tex.source.resolution,
            autoGenerateMipmaps: true,
        });
        const grey = new Texture({ source });
        grey.label = id;
        return grey;
    }

    private async load(id: string, scale: number): Promise<Texture> {
        if (id.endsWith(GREY_SUFFIX)) return this.loadGrey(id, id.slice(0, -GREY_SUFFIX.length), scale);
        const entry = SPRITES[id];
        if (!entry) return this.markMissing(id, "not in the sprite manifest");
        // the original client names it without shipping an image, and drew nothing (survev: Texture.from of an unknown id)
        if (entry.source === "none" || !entry.path) return Texture.EMPTY;
        const url = ASSET_ROOT + entry.path;
        try {
            const isSvg = entry.path.endsWith(".svg");
            let img: HTMLImageElement;
            if (isSvg) {
                const res = await fetch(url);
                if (!res.ok) return this.markMissing(id, `HTTP ${res.status}`);
                img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(await res.text())}`);
            } else {
                img = await loadImage(url);
            }
            const iw = Math.max(1, img.naturalWidth || img.width);
            const ih = Math.max(1, img.naturalHeight || img.height);
            const [w, h] = entry.size ?? [iw, ih];
            // a raster has no more detail than its own pixels (an atlas frame stored at 0.5 or 0.75 included)
            const native = isSvg ? Number.POSITIVE_INFINITY : iw / w;
            const r = Math.min(this.resolutionFor(scale), native, MAX_TEXTURE_DIM / Math.max(w, h));
            let resource: HTMLImageElement | HTMLCanvasElement = img;
            if (r < native) {
                const canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.ceil(w * r));
                canvas.height = Math.max(1, Math.ceil(h * r));
                // CPU-backed canvas: hundreds of GPU-accelerated canvases overload the GPU process (software GL)
                const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = "high";
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resource = canvas;
            }
            // the texture reports the logical size whatever the raster resolution
            const source = new ImageSource({
                resource,
                alphaMode: "premultiply-alpha-on-upload",
                resolution: resource.width / w,
                autoGenerateMipmaps: true,
            });
            const texture = new Texture({ source });
            texture.label = id;
            return texture;
        } catch (err) {
            return this.markMissing(id, String(err));
        }
    }
}
