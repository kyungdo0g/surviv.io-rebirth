// The loadout crosshair as a CSS cursor over the game (survev client/src/crosshair.ts): the def's SVG with its white
// recoloured, the stroke width and the 64 px size scaled, as a data URL centred on its hotspot; the default crosshair
// is the system "crosshair" cursor (its def's `cursor`).
import { GameObjectDefs } from "@rebirth/defs";
import type { Crosshair } from "@rebirth/sim";

interface CrosshairDefLike {
    type: string;
    code?: string;
    cursor?: string;
}

/** survev getCrosshairDims: 64 px times the size, rounded to a multiple of 4 */
export function crosshairDims(c: Crosshair): { width: number; height: number } {
    const side = Math.round((64 * c.size) / 4) * 4;
    return { width: side, height: side };
}

function hex(color: number): string {
    return `#${(color & 0xffffff).toString(16).padStart(6, "0")}`;
}

/** The crosshair's image as a CSS `url(...)` (also the loadout menu's preview). */
export function crosshairUrl(c: Crosshair): string {
    const def = GameObjectDefs[c.type] as CrosshairDefLike | undefined;
    if (def?.type !== "crosshair" || !def.code) return "";
    const { width, height } = crosshairDims(c);
    const svg = def.code
        .replace(/white/g, hex(c.color))
        .replace(/stroke-width=".5"/g, `stroke-width="${c.stroke}"`)
        .replace(/width="64"/g, `width="${width}"`)
        .replace(/height="64"/g, `height="${height}"`)
        .replace(/#/g, "%23");
    return `url('data:image/svg+xml;utf8,${svg}')`;
}

/** The CSS `cursor` value for the crosshair (survev setElemCrosshair). */
export function crosshairCursor(c: Crosshair): string {
    const def = GameObjectDefs[c.type] as CrosshairDefLike | undefined;
    if (def?.type !== "crosshair") return "crosshair";
    if (def.cursor) return def.cursor;
    const { width, height } = crosshairDims(c);
    return `${crosshairUrl(c)} ${width / 2} ${height / 2}, crosshair`;
}
