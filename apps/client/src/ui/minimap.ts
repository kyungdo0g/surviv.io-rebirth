// Bottom-left minimap like the original (survev client/src/ui/ui.ts redraw/m_render and client/src/map.ts
// renderMap): the whole map is rendered once into a texture (terrain + every map object whose definition has
// map.display, using map.color and map.scale), shown at 80% alpha inside a masked 256 px square that scrolls so
// the local player stays centered, with the player dot on top (no view rectangle: the original draws none, see
// docs/research/provenance/visual-diff.md). M4: the red zone,
// the next safe zone and the line to it, and the map indicators (air drop pings) are drawn over the map texture
// inside the same mask (mapMarkers.ts). M5: the 50v50 air strike zones (airstrikeZones.ts) between the gas and the
// indicators, like the original's container order. M6: teammate dots (minimapTeam.ts) over the indicators, the
// followed player's own dot in its group colour (downed / dead icons), team pings (MapIndicators.addPlayerPing), and
// `screenToWorld` for pings placed on the minimap.
// M7: faction members outside the group (minimapFaction.ts) under the group's dots, role map icons for the followed
// player and its group, and the big map (M / G, survev ui.ts displayMapLarge + redraw): the same layers drawn over a
// square as large as the smaller screen side, centred, at full alpha, every marker at its map position, without the
// line to the safe zone.
// M8: the small layout (uiLayout.ts) puts a 192 px minimap (x the 0.5626 HUD scale) with a 4 px margin and a 1 px
// border in the top-left corner and draws its dots at 0.15 / 0.25 (survev ui.ts getMinimapSize / Margin / BorderWidth,
// redraw, updatePlayerMapSprites); Toggle Minimap (V) and Hide UI hide it (`setHidden`; the big map still opens).
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
import { zoneStyle } from "./airstrikeVariantStyle.ts";
import { AirstrikeZones } from "./airstrikeZones.ts";
import { type AppearedPing, MapIndicators, MinimapGas, type PingFields } from "./mapMarkers.ts";
import { MinimapFaction, type MinimapFactionFrame } from "./minimapFaction.ts";
import { MinimapTeam, type MinimapTeamFrame, memberDot, memberTint } from "./minimapTeam.ts";
import { SM_HUD_SCALE, uiScale } from "./uiLayout.ts";

/** size, margin and border of the minimap at HUD scale 1: desktop and small layout (survev ui.ts getMinimap*) */
const LG = { size: 256, margin: 16, border: 4 };
const SM = { size: 192, margin: 4, border: 1 };
/** the small layout draws player dots at 0.15 instead of 0.2 and the group ring at 0.25 instead of 0.3 */
const SM_DOT_MULT = 0.15 / 0.2;
const SM_RING_SCALE = 0.25;
const RING_SCALE = 0.3;
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

/**
 * The type the map draws for a displayed object: the alternate barns pass for the plain barn (`map.displayType`, which
 * the server substitutes in survev map.ts genBuilding; objects without `map.display` are never drawn).
 */
function shownType(type: string): string {
    const def = MapObjectDefs[type] as { map?: { displayType?: string } } | undefined;
    const shown = def?.map?.displayType;
    return shown && MapObjectDefs[shown] ? shown : type;
}

function zIdxOf(def: MapObjectDef): number {
    if (def.type === "building") return 750 + (def.zIdx ?? 0);
    return def.type === "obstacle" ? (def.img.zIdx ?? 0) : 0;
}

export interface MinimapFrame {
    dt: number;
    gas: GasTracker | null;
    /** interpolation blend between the last two snapshots (the moving red zone) */
    alpha: number;
    /** the followed player's group (team modes, M6) */
    team?: MinimapTeamFrame | null;
    /** the followed player's faction outside its group (faction maps, M7) */
    faction?: MinimapFactionFrame | null;
}

export class Minimap {
    readonly container = new Container({ label: "minimap" });
    /** everything clipped to the minimap square: map, gas, indicators */
    private readonly clip = new Container({ label: "minimap-clip" });
    private readonly mapSprite: Sprite;
    readonly gas = new MinimapGas();
    readonly indicators: MapIndicators;
    readonly airstrikeZones = new AirstrikeZones();
    readonly team: MinimapTeam;
    readonly faction: MinimapFaction;
    /** the big map is open (M7) */
    big = false;
    /** the small (phone) layout: top left, 192 px x 0.5626 (M8) */
    small = false;
    /** Toggle Minimap / Hide UI hid the minimap (the big map still shows) (M8) */
    hidden = false;
    private readonly mask = new Graphics();
    private readonly border = new Graphics();
    private readonly playerOuter: Sprite;
    private readonly playerInner: Sprite;
    private readonly map: MapData;
    private readonly texture: RenderTexture;
    /** pixel size of the map texture (tests) */
    get textureSize(): number {
        return this.texture.width;
    }
    /** font size of the place names in texture pixels (tests: 22 px on the big map once scaled to the screen) */
    placeLabelPx = 0;
    private readonly textures: TextureStore;
    private localDotKey = "";
    private localDotScale = 0.2;
    /** screen-space rectangle of the minimap (for tests) */
    rect = { x: 0, y: 0, width: 0, height: 0 };
    /** screen position of the map's top-left corner and its on-screen size, as last drawn */
    private mapOrigin = { x: 0, y: 0, size: 1 };

    constructor(app: Application, textures: TextureStore, map: MapData, terrain: TerrainShape, mobile = false) {
        this.map = map;
        this.textures = textures;
        this.texture = Minimap.renderMapTexture(app, map, terrain, mobile);
        this.placeLabelPx = Minimap.lastLabelPx;
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
        this.team = new MinimapTeam(textures);
        this.faction = new MinimapFaction(textures);
        // survev ui.ts container order: map, gas, safe zone, map sprites (pings, player dots), border
        this.clip.addChild(
            this.mapSprite,
            this.gas.container,
            this.airstrikeZones.mapContainer,
            this.faction.container,
            this.team.container,
            this.indicators.container,
        );
        this.container.addChild(this.clip, this.playerOuter, this.playerInner, this.border, this.mask);
        this.clip.mask = this.mask;
    }

    /** teammate dots drawn (tests) */
    get teamDots(): number {
        return this.team.count;
    }

    /**
     * The followed player's centre dot: group colour slot `idx`, the downed icon or a skull (M6); a role map icon
     * without the ring, in the team colour on faction maps (`faction` 1 Red, 2 Blue) (M7).
     */
    setLocalDot(idx: number, state: { dead: boolean; downed: boolean; role?: string }, faction = 0): void {
        const look = memberDot(state);
        const key = `${idx}|${look.sprite}|${faction}`;
        if (key === this.localDotKey) return;
        this.localDotKey = key;
        this.textures.apply(this.playerInner, look.sprite, look.scale);
        this.playerInner.tint = memberTint(idx, look.icon, faction);
        this.playerOuter.visible = !look.icon;
        this.localDotScale = look.scale;
    }

    /** Opens or closes the big map (M7). */
    setBig(big: boolean): void {
        this.big = big;
        this.mapSprite.alpha = big ? 1 : MAP_ALPHA;
        this.container.visible = !this.hidden || big;
    }

    /** Hides the minimap (Toggle Minimap, Hide UI); the big map still shows (survev ui.ts hideMiniMap). */
    setHidden(hidden: boolean): void {
        this.hidden = hidden;
        this.container.visible = !hidden || this.big;
    }

    /** Screen rectangle that takes taps and pings: the big map, or the minimap while it shows. */
    get tapRect(): { x: number; y: number; width: number; height: number } | null {
        return this.hidden && !this.big ? null : this.rect;
    }

    /** World position under a screen point inside the minimap, or null outside it (pings on the map, M6). */
    screenToWorld(p: Vec2): Vec2 | null {
        const r = this.tapRect;
        if (!r) return null;
        if (r.width <= 0 || p.x < r.x || p.y < r.y || p.x > r.x + r.width || p.y > r.y + r.height) return null;
        const o = this.mapOrigin;
        return {
            x: ((p.x - o.x) / o.size) * this.map.width,
            y: (1 - (p.y - o.y) / o.size) * this.map.height,
        };
    }

    /** Applies a snapshot's map indicators; returns the pings that just appeared (sounds, edge indicators). */
    applyIndicators(list: readonly MapIndicatorView[]): AppearedPing[] {
        return this.indicators.apply(list);
    }

    /**
     * The fields a ping that just appeared plays and shows with: a ping_airstrike marking a heavy or carpet zone is
     * re-tinted in the zone's variant colour (rebirth, airstrikeVariantStyle.ts), on the map and for the edge
     * indicator.
     */
    styledPing(ping: AppearedPing): PingFields {
        if (ping.type !== "ping_airstrike") return ping.def;
        const variant = this.airstrikeZones.variantNear(ping.pos);
        if (!variant || variant === "normal") return ping.def;
        const tint = zoneStyle(variant).color;
        this.indicators.tint(ping.id, tint);
        return { ...ping.def, tint };
    }

    /**
     * The map texture (survev map.ts renderMap). The original renders it as many pixels as the screen is tall (a
     * portrait phone: wide, times the pixel ratio up to 2) with place names in 22 px bold Arial (20 px on mobile), so
     * the big map shows them at 22 px and the minimap at its larger scale. Rebirth keeps those label sizes but renders
     * the texture at the device resolution and at least as large as the minimap's 1333 px map, so it stays sharp
     * (also after the window grows; the original re-renders it on resize).
     */
    /** font size of the place names of the last texture rendered, in texture pixels */
    private static lastLabelPx = 0;

    static renderMapTexture(app: Application, map: MapData, terrain: TerrainShape, mobile = false): RenderTexture {
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const { width, height } = app.screen;
        let screenScale = mobile && width < height ? width : height;
        if (mobile) screenScale *= ratio;
        screenScale = Math.max(screenScale, 1);
        const base = Math.max(mobile ? screenScale : screenScale * ratio, MAP_DISPLAY_SIZE * ratio);
        const size = Math.min(4096, Math.max(256, Math.round(base)));
        // label sizes of the original's screen-sized texture, scaled to this one
        const labelScale = size / screenScale;
        Minimap.lastLabelPx = (mobile ? 20 : 22) * labelScale;
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
            .filter((obj) => (MapObjectDefs[obj.type] as { map?: { display?: boolean } } | undefined)?.map?.display)
            .map((obj) => ({ obj, def: MapObjectDefs[shownType(obj.type)] }))
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
                    fontSize: (mobile ? 20 : 22) * labelScale,
                    fontWeight: "bold",
                    fill: 0xffffff,
                    stroke: { color: 0x000000, width: labelScale },
                    dropShadow: {
                        color: 0x000000,
                        blur: labelScale,
                        angle: Math.PI / 3,
                        distance: labelScale,
                        alpha: 1,
                    },
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

    /** Lays the minimap (or the big map) out for the screen and scrolls it to `playerPos`. */
    update(camera: Camera, playerPos: Vec2, frame?: MinimapFrame): void {
        const scale = this.small ? SM_HUD_SCALE : uiScale(camera.screenWidth, camera.screenHeight);
        const dims = this.small ? SM : LG;
        let size: number;
        let left: number;
        let top: number;
        let mapSize: number;
        let originX: number;
        let originY: number;
        if (this.big) {
            // survev ui.ts redraw: the whole map in a square of the smaller screen side, centred
            size = Math.min(camera.screenWidth, camera.screenHeight);
            left = (camera.screenWidth - size) / 2;
            top = (camera.screenHeight - size) / 2;
            mapSize = size;
            originX = left;
            originY = top;
        } else {
            size = dims.size * scale;
            left = dims.margin;
            top = this.small ? dims.margin : camera.screenHeight - size - dims.margin;
            mapSize = MAP_DISPLAY_SIZE * scale;
            const cx = left + size / 2;
            const cy = top + size / 2;
            originX = cx - (playerPos.x / this.map.width) * mapSize;
            originY = cy - mapSize + (playerPos.y / this.map.height) * mapSize;
        }
        this.rect = { x: left, y: top, width: size, height: size };
        this.mapSprite.width = mapSize;
        this.mapSprite.height = mapSize;
        this.mapSprite.position.set(originX + mapSize / 2, originY + mapSize / 2);
        this.mapOrigin = { x: originX, y: originY, size: mapSize };
        const px = (p: Vec2) => ({
            x: originX + (p.x / this.map.width) * mapSize,
            y: originY + (1 - p.y / this.map.height) * mapSize,
        });

        this.mask.clear().rect(left, top, size, size).fill(0xffffff);
        this.border.clear();
        if (!this.big) {
            const b = dims.border;
            this.border.rect(left + b / 2, top + b / 2, size - b, size - b).stroke({ width: b, color: 0x000000 });
        }

        // map sprites: the desktop HUD scale, or the small layout's 0.15 / 0.25 dot scales
        const spriteScale = this.small ? SM_DOT_MULT : scale;
        const ringScale = this.small ? SM_RING_SCALE : RING_SCALE * scale;
        const proj = {
            toMap: px,
            pxPerUnit: mapSize / this.map.width,
            uiScale: spriteScale,
            ringScale,
            rect: this.rect,
        };
        if (frame?.gas) this.gas.update(proj, frame.gas, playerPos, frame.alpha, !this.big);
        this.airstrikeZones.updateMap(proj);
        this.indicators.update(frame?.dt ?? 0, proj);
        this.faction.update(frame?.dt ?? 0, proj, frame?.faction ?? null);
        this.team.update(frame?.dt ?? 0, proj, frame?.team ?? null);

        const me = px(playerPos);
        this.playerOuter.position.set(me.x, me.y);
        this.playerOuter.scale.set(ringScale);
        this.playerInner.position.set(me.x, me.y);
        this.playerInner.scale.set(this.localDotScale * spriteScale);
    }

    destroy(): void {
        this.indicators.clear();
        this.team.clear();
        this.faction.clear();
        this.airstrikeZones.destroy();
        this.container.destroy({ children: true });
        this.texture.destroy(true);
    }
}
