// Region select (M8; survev index.html #server-select-main / #team-server-select, siteInfo.ts region pops; docs/research/
// ui/menus.md "Start menu"): GET /api/site_info lists the regions with their players (`pops`) and, rebirth, the origin
// of each region's server (`regions`, "" for the answering server). Options read "<Region> [N players]" with the
// original names of na / sa / eu / as / kr (an unknown id, e.g. a server's own REGION, is shown as it is). The select
// hides while there is only one region. The choice is stored in the config; Play sends find_game to that region's
// server.
import type { SiteInfoRes } from "@rebirth/protocol";
import { t, tryT } from "../l10n/index.ts";
import { h } from "./dom.ts";

export interface RegionInfo {
    id: string;
    players: number;
    /** HTTP origin of the region's server; "" = the server the page talks to */
    origin: string;
}

/** l10n keys of the original region ids (and survev's "local") */
const REGION_KEYS: Readonly<Record<string, string>> = {
    na: "index-north-america",
    sa: "index-south-america",
    eu: "index-europe",
    as: "index-asia",
    kr: "index-korea",
    local: "index-local",
};

export function regionName(id: string): string {
    const key = REGION_KEYS[id];
    return (key && tryT(key)) || id;
}

/** The regions of a site_info answer, in its `pops` order (plus regions that only appear in `regions`). */
export function parseRegions(info: Pick<SiteInfoRes, "pops" | "regions">): RegionInfo[] {
    const ids = [...Object.keys(info.pops ?? {})];
    for (const id of Object.keys(info.regions ?? {})) if (!ids.includes(id)) ids.push(id);
    return ids.map((id) => ({
        id,
        players: Math.max(0, Math.floor(Number(info.pops?.[id]?.playerCount) || 0)),
        origin: typeof info.regions?.[id] === "string" ? (info.regions[id] as string) : "",
    }));
}

/** GET {server}/api/site_info; [] when it fails. */
export async function fetchRegions(server: string): Promise<RegionInfo[]> {
    try {
        const res = await fetch(`${server}/api/site_info`);
        if (!res.ok) return [];
        return parseRegions((await res.json()) as SiteInfoRes);
    } catch {
        return [];
    }
}

/** The region to preselect: the stored one if listed, else this server's, else the first. */
export function pickRegion(list: readonly RegionInfo[], stored: string): string {
    if (list.some((r) => r.id === stored)) return stored;
    return (list.find((r) => r.origin === "") ?? list[0])?.id ?? stored;
}

export class RegionSelect {
    readonly root: HTMLDivElement;
    readonly select: HTMLSelectElement;
    private list: RegionInfo[] = [];

    constructor(id: string, onChange: (region: string) => void) {
        this.select = h("select", { id, cls: "region-select server-select menu-option" });
        this.select.addEventListener("change", () => onChange(this.select.value));
        this.root = h("div", { cls: "region-select-wrap" }, this.select);
        this.root.hidden = true;
    }

    get value(): string {
        return this.select.value;
    }

    /** Fills the options (hidden for fewer than two regions) and selects `selected`. */
    setRegions(list: readonly RegionInfo[], selected: string): void {
        this.list = [...list];
        this.render();
        this.setValue(selected);
        this.root.hidden = list.length < 2;
    }

    setValue(region: string): void {
        if (this.list.some((r) => r.id === region)) this.select.value = region;
    }

    setEnabled(enabled: boolean): void {
        this.select.disabled = !enabled;
    }

    /** Re-reads the region names (language change). */
    applyStrings(): void {
        const value = this.select.value;
        this.render();
        this.setValue(value);
    }

    private render(): void {
        this.select.replaceChildren(
            ...this.list.map((r) => {
                const option = h("option", { text: `${regionName(r.id)} [${r.players} ${t("index-players")}]` });
                option.value = r.id;
                return option;
            }),
        );
    }
}
