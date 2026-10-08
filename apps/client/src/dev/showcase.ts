// Building showcase bar (rebirth test mode): /?building=<type> boots the loopback sandbox on a map holding only that
// building or structure (sim generateShowcase, no gas); this bar steps through every one (◀ ▶, the [ and ] keys, or
// the list grouped by map). Stepping reloads the page with the next type and keeps the other query parameters.
import { type ShowcaseEntry, showcaseEntries } from "@rebirth/sim";
import { debugGlobals } from "../globals.ts";

/** The entry `?building=` names: a type, or anything else (`1`, an unknown id) for the first one. */
export function resolveShowcase(param: string): ShowcaseEntry {
    const all = showcaseEntries();
    const found = all.find((e) => e.type === param);
    if (!found && param !== "1" && param !== "") console.warn(`showcase: ${param} is not a spawned building`);
    return found ?? all[0];
}

function showcaseUrl(type: string): string {
    const route = new URLSearchParams(location.search);
    route.set("building", type);
    return `${location.pathname}?${route.toString()}`;
}

const BAR_STYLE =
    "position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:50;display:flex;gap:6px;align-items:center;" +
    "padding:6px 10px;border-radius:6px;background:rgba(0,0,0,0.6);color:#fff;font:14px 'Roboto Condensed',sans-serif";
const BUTTON_STYLE = "min-width:32px;padding:2px 8px;font:inherit;cursor:pointer";

/** Mounts the bar for `current` and exposes `window.__rebirth.showcase` (type, map, index, count, goto). */
export function mountShowcaseBar(current: ShowcaseEntry): void {
    const all = showcaseEntries();
    const index = all.findIndex((e) => e.type === current.type);
    const go = (i: number): void => {
        const next = all[(i + all.length) % all.length];
        location.assign(showcaseUrl(next.type));
    };

    const bar = document.createElement("div");
    bar.id = "showcase-bar";
    bar.style.cssText = BAR_STYLE;
    const prev = document.createElement("button");
    prev.textContent = "◀";
    prev.title = "previous building ([)";
    prev.style.cssText = BUTTON_STYLE;
    prev.onclick = () => go(index - 1);
    const next = document.createElement("button");
    next.textContent = "▶";
    next.title = "next building (])";
    next.style.cssText = BUTTON_STYLE;
    next.onclick = () => go(index + 1);
    const select = document.createElement("select");
    select.style.font = "inherit";
    let group: HTMLOptGroupElement | null = null;
    for (const e of all) {
        if (group?.label !== e.mapName) {
            group = document.createElement("optgroup");
            group.label = e.mapName;
            select.appendChild(group);
        }
        const opt = document.createElement("option");
        opt.value = e.type;
        opt.textContent = e.type;
        group.appendChild(opt);
    }
    select.value = current.type;
    select.onchange = () => location.assign(showcaseUrl(select.value));
    const count = document.createElement("span");
    count.textContent = `${index + 1}/${all.length} · ${current.mapName}`;
    bar.append(prev, select, next, count);
    document.body.appendChild(bar);

    window.addEventListener("keydown", (ev) => {
        if (ev.target instanceof HTMLSelectElement || ev.target instanceof HTMLInputElement) return;
        if (ev.code === "BracketLeft") go(index - 1);
        else if (ev.code === "BracketRight") go(index + 1);
    });
    debugGlobals().showcase = {
        type: current.type,
        mapName: current.mapName,
        index,
        count: all.length,
        types: all.map((e) => e.type),
        goto: (type: string) => location.assign(showcaseUrl(type)),
    };
}
