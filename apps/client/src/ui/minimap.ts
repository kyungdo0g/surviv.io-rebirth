// Bottom-left minimap like the original (survev client/src/ui/ui.ts redraw/m_render and client/src/map.ts
// renderMap): the whole map is rendered once into a texture (terrain + every map object whose definition has
// map.display, using map.color and map.scale), shown at 80% alpha inside a masked 256 px square that scrolls so
// the local player stays centered, with the player dot and the camera's view rectangle on top. M4: the red zone,
// the next safe zone and the line to it, and the map indicators (air drop pings) are drawn over the map texture
// inside the same mask (mapMarkers.ts).
import { collider, math, type Vec2 } from "@rebirth/core";
import {
    type BuildingDef,
    GameConfig,
    getMapDef,
    type MapObjectDef,
    MapObjectDefs,
    type ObstacleDef,
} from "@rebirth/defs";
import type { MapData, MapIndicatorView, TerrainShape } from "@rebirth/sim";
import { type Application, Container, Graphics, RenderTexture, Sprite, Text } from "pixi.js";
import type { TextureStore } from "../assets/textures.ts";
import type { GasTracker } from "../fx/gas.ts";
import { drawTerrain } from "../map/terrain.ts";
import { buildingLocalBounds } from "../objects/building.ts";
import type { Camera } from "../render/camera.ts";
import { MapIndicators, MinimapGas, type PingFields } from "./mapMarkers.ts";

const MARGIN = 16;
const SIZE = 256;
const BORDER = 4;
/** on-screen width of the whole map in px at UI scale 1 (survev ui.ts redraw: screenScaleFactor * 1600 / 1.2) */
const MAP_DISPLAY_SIZE = 1600 / 1.2;
const MAP_ALPHA = 0.8;

interface Shape {
    col: { type: 0; pos: Vec2; rad: number } | { type: 1; min: Vec2; max: Vec2 };
    scale: number;
    color: number;
}

function minimapShapes(def: MapObjectDef): Shape[] {
    if (def.type !== "obstacle" && def.type !== "building") return [];
    const map = def.map;
    if (!map?.display) return [];
    if (def.type === "building" && def.map?.shapes) {
        return def.map.shapes.map((s) => ({ col: s.collider, scale: 1, color: s.color }));
    }
    let col: Shape["col"] | null = null;
    if (def.type === "obstacle") col = (def as ObstacleDef).collision;
    else {
        const b = def as BuildingDef;
        const zoomIn = b.ceiling.zoomRegions[0]?.zoomIn;
        const bounds = zoomIn ?? buildingLocalBounds(b);
        if (bounds) col = { type: 1, min: bounds.min, max: bounds.max };
    }
    return col && map.color !== undefined ? [{ col, scale: map.scale ?? 1, color: map.color }] : [];
}

function zIdxOf(def: MapObjectDef): number {
    if (def.type === "building") return 750 + (def.zIdx ?? 0);
    return def.type === "obstacle" ? (def.img.zIdx ?? 0) : 0;
}

/** UI scale of the original HUD for this screen size (survev ui.ts resize) */
export function uiScale(width: number, height: number): number {
    return Math.min(1, math.clamp(width / 1280, 0.75, 1) * math.clamp(height / 1024, 0.75, 1));
}

export interface MinimapFrame {
    dt: number;
    gas: GasTracker | null;
    /** interpolation blend between the last two snapshots (the moving red zone) */
    alpha: number;
}

export class Minimap {
    readonly container = new Container({ label: "minimap" });
    /** everything clipped to the minimap square: map, gas, indicators */
    private readonly clip = new Container({ label: "minimap-clip" });
    private readonly mapSprite: Sprite;
    readonly gas = new MinimapGas();
    readonly indicators: MapIndicators;
    private readonly mask = new Graphics();
    private readonly border = new Graphics();
    private readonly viewRect = new Graphics();
    private readonly playerOuter: Sprite;
    private readonly playerInner: Sprite;
    private readonly map: MapData;
    private readonly texture: RenderTexture;
    /** screen-space rectangle of the minimap (for tests) */
    rect = { x: 0, y: 0, width: 0, height: 0 };

    constructor(app: Application, textures: TextureStore, map: MapData, terrain: TerrainShape) {
        this.map = map;
        this.texture = Minimap.renderMapTexture(app, map, terrain);
        this.mapSprite = new Sprite(this.texture);
        this.mapSprite.anchor.set(0.5);
        this.mapSprite.alpha = MAP_ALPHA;
        this.playerOuter = new Sprite();
        this.playerInner = new Sprite();
        for (const s of [this.playerOuter, this.playerInner]) s.anchor.set(0.5);
        textures.apply(this.playerOuter, "player-map-outer.img", 0.3);
        textures.apply(this.playerInner, "player-map-inner.img", 0.2);
        // the local player is in their own group: group color 0 (survev ui.ts updatePlayerMapSprites)
        this.playerInner.tint = GameConfig.groupColors[0];
        this.indicators = new MapIndicators(textures);
        // survev ui.ts container order: map, gas, safe zone, map sprites (pings), player dots, border
        this.clip.addChild(this.mapSprite, this.gas.container, this.indicators.container);
        this.container.addChild(this.clip, this.viewRect, this.playerOuter, this.playerInner, this.border, this.mask);
        this.clip.mask = this.mask;
    }

    /** Applies a snapshot's map indicators; returns the pings that just appeared (sounds, edge indicators). */
    applyIndicators(list: readonly MapIndicatorView[]): Array<{ def: PingFields; pos: Vec2 }> {
        return this.indicators.apply(list);
    }

    static renderMapTexture(app: Application, map: MapData, terrain: TerrainShape): RenderTexture {
        const size = Math.min(
            2048,
            Math.max(512, Math.ceil(MAP_DISPLAY_SIZE * Math.min(window.devicePixelRatio || 1, 2))),
        );
        const unitsPerPx = map.height / size;
        const colors = getMapDef(map.mapName).biome.colors;
        const root = new Container();

        // terrain in world units, flipped so +y is up
        const ground = new Graphics();
        ground.rect(0, 0, map.width, map.height).fill(colors.grass);
        drawTerrain(ground, map, terrain, colors, { gridThickness: unitsPerPx, mapRender: true });
        ground
            .rect(0, 0, map.width, map.height)
            .stroke({ width: unitsPerPx * 2, color: 0x000000, alpha: 1, alignment: 1 });
        ground.position.y = map.height;
        ground.scale.y = -1;
        root.addChild(ground);

        const shapes = new Graphics();
        const renders = map.objects
            .map((obj) => ({ obj, def: MapObjectDefs[obj.type] }))
            .filter((r) => r.def)
            .map((r) => ({ obj: r.obj, zIdx: zIdxOf(r.def), shapes: minimapShapes(r.def) }))
            .filter((r) => r.shapes.length)
            .sort((a, b) => a.zIdx - b.zIdx);
        for (const r of renders) {
            for (const shape of r.shapes) {
                const col = collider.transform(shape.col, r.obj.pos, math.oriToRad(r.obj.ori), r.obj.scale);
                if (col.type === 0) {
                    shapes.circle(col.pos.x, map.height - col.pos.y, col.rad * shape.scale).fill(shape.color);
                } else {
                    const hx = ((col.max.x - col.min.x) / 2) * shape.scale;
                    const hy = ((col.max.y - col.min.y) / 2) * shape.scale;
                    const cx = (col.min.x + col.max.x) / 2;
                    const cy = map.height - (col.min.y + col.max.y) / 2;
                    shapes.rect(cx - hx, cy - hy, hx * 2, hy * 2).fill(shape.color);
                }
            }
        }
        root.addChild(shapes);
        root.scale.set(1 / unitsPerPx);

        const names = new Container();
        for (const place of map.places) {
            // the original sends place positions normalized to the map size
            const normalized = place.pos.x <= 1 && place.pos.y <= 1;
            const x = normalized ? place.pos.x * size : place.pos.x / unitsPerPx;
            const y = normalized ? place.pos.y * size : (map.height - place.pos.y) / unitsPerPx;
            const text = new Text({
                text: place.name,
                style: {
                    fontFamily: "Arial",
                    fontSize: 22,
                    fontWeight: "bold",
                    fill: 0xffffff,
                    stroke: { color: 0x000000, width: 1 },
                    dropShadow: { color: 0x000000, blur: 1, angle: Math.PI / 3, distance: 1, alpha: 1 },
                    align: "center",
                },
            });
            text.anchor.set(0.5);
            text.position.set(x, y);
            text.alpha = 0.75;
            names.addChild(text);
        }

        const texture = RenderTexture.create({ width: size, height: size, resolution: 1, antialias: true });
        app.renderer.render({ container: root, target: texture, clear: true, clearColor: colors.background });
        app.renderer.render({ container: names, target: texture, clear: false });
        root.destroy({ children: true });
        names.destroy({ children: true });
        return texture;
    }

    /** Lays the minimap out for the screen and scrolls it to `playerPos`. */
    update(camera: Camera, playerPos: Vec2, frame?: MinimapFrame): void {
        const scale = uiScale(camera.screenWidth, camera.screenHeight);
        const size = SIZE * scale;
        const left = MARGIN;
        const top = camera.screenHeight - size - MARGIN;
        const center = { x: left + size / 2, y: top + size / 2 };
        this.rect = { x: left, y: top, width: size, height: size };

        const mapSize = MAP_DISPLAY_SIZE * scale;
        this.mapSprite.width = mapSize;
        this.mapSprite.height = mapSize;
        this.mapSprite.position.set(
            center.x + mapSize / 2 - (playerPos.x / this.map.width) * mapSize,
            center.y - mapSize / 2 + (playerPos.y / this.map.height) * mapSize,
        );
        const originX = this.mapSprite.x - mapSize / 2;
        const originY = this.mapSprite.y - mapSize / 2;
        const px = (p: Vec2) => ({
            x: originX + (p.x / this.map.width) * mapSize,
            y: originY + (1 - p.y / this.map.height) * mapSize,
        });

        this.mask.clear().rect(left, top, size, size).fill(0xffffff);
        this.border
            .clear()
            .rect(left + BORDER / 2, top + BORDER / 2, size - BORDER, size - BORDER)
            .stroke({ width: BORDER, color: 0x000000 });

        const view = camera.viewBounds();
        const a = px(view.min);
        const b = px(view.max);
        const x0 = Math.max(left, Math.min(a.x, b.x));
        const y0 = Math.max(top, Math.min(a.y, b.y));
        const x1 = Math.min(left + size, Math.max(a.x, b.x));
        const y1 = Math.min(top + size, Math.max(a.y, b.y));
        this.viewRect.clear();
        if (x1 > x0 && y1 > y0)
            this.viewRect.rect(x0, y0, x1 - x0, y1 - y0).stroke({ width: 1, color: 0xffffff, alpha: 0.6 });

        const proj = { toMap: px, pxPerUnit: mapSize / this.map.width, uiScale: scale, rect: this.rect };
        if (frame?.gas) this.gas.update(proj, frame.gas, playerPos, frame.alpha);
        this.indicators.update(frame?.dt ?? 0, proj);

        this.playerOuter.position.set(center.x, center.y);
        this.playerOuter.scale.set(0.3 * scale);
        this.playerInner.position.set(center.x, center.y);
        this.playerInner.scale.set(0.2 * scale);
    }

    destroy(): void {
        this.indicators.clear();
        this.container.destroy({ children: true });
        this.texture.destroy(true);
    }
}
