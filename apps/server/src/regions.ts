// Regions (M8): each region is its own server. REGION names this server's region; REGION_SERVERS lists the origins of
// the other regions' servers, so /api/site_info can tell the client where each region's find_game lives (the original
// picked a region through its API host; survev server/src/api/apiServer.ts getSiteInfo lists one `pops` entry per
// region). The region labels use the original client's l10n keys (index.html #server-opts; survev config.ts "local").

/** Region ids: lowercase letters, digits, "-" and "_", up to 32 characters (the original ids: na, sa, eu, as, kr). */
export const REGION_ID = /^[a-z0-9][a-z0-9_-]{0,31}$/;

/** The original regions' label keys (index.html `#server-opts` data-l10n); any other region is "index-local". */
const REGION_L10N: Readonly<Record<string, string>> = {
    na: "index-north-america",
    sa: "index-south-america",
    eu: "index-europe",
    as: "index-asia",
    kr: "index-korea",
};

export function regionL10n(region: string): string {
    return REGION_L10N[region] ?? "index-local";
}

/** The origin of an http(s) URL that names nothing but a host (and port); throws otherwise. */
function originOf(raw: string): string {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw new Error(`"${raw}" is not a URL`);
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`"${raw}" is not an http(s) URL`);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
        throw new Error(`"${raw}" must be an origin (scheme://host[:port], no path)`);
    }
    return url.origin;
}

/**
 * REGION_SERVERS: `id=url` entries separated by commas (`kr=https://kr.example.com,eu=https://eu.example.com`), as
 * region id -> origin in list order. Throws for a malformed entry, a bad id or URL, or a repeated id.
 */
export function parseRegionServers(text: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const part of text.split(",")) {
        const entry = part.trim();
        if (!entry) continue;
        const eq = entry.indexOf("=");
        if (eq < 0) throw new Error(`"${entry}" is not id=url`);
        const id = entry.slice(0, eq).trim();
        if (!REGION_ID.test(id)) throw new Error(`"${id}" is not a region id (a-z, 0-9, - and _)`);
        if (Object.hasOwn(out, id)) throw new Error(`region "${id}" is listed twice`);
        out[id] = originOf(entry.slice(eq + 1).trim());
    }
    return out;
}

/**
 * site_info `regions`: this server's region first (origin "", the answering server), then the others in list order.
 * An entry for this server's own region is ignored, so every server of a deployment can share one REGION_SERVERS list.
 */
export function siteRegions(region: string, servers: Readonly<Record<string, string>>): Record<string, string> {
    const out: Record<string, string> = { [region]: "" };
    for (const [id, origin] of Object.entries(servers)) if (id !== region) out[id] = origin;
    return out;
}
