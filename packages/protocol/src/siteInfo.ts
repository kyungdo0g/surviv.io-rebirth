// GET {baseUrl}/api/site_info (survev shared/types/api.ts SiteInfoRes, served by apps/server/src/http.ts): the play
// buttons and the region populations of the start page. rebirth M8 adds `regions`, the origin of every region's server
// (the original chose a region server through its API host; here each region is its own server and the client calls
// that server's find_game).

export interface SiteInfoMode {
    mapName: string;
    teamMode: number;
    enabled: boolean;
}

export interface SiteInfoRes {
    modes: SiteInfoMode[];
    /** players per region id ("na", "sa", "eu", "as", "kr", or a server's own REGION id) */
    pops: Record<string, { playerCount: number; l10n: string }>;
    /** region id -> origin of that region's server ("" for the answering server itself); rebirth M8 */
    regions?: Record<string, string>;
    youtube: { name: string; link: string };
    twitch: unknown[];
    country: string;
    gitRevision: string;
    captchaEnabled: boolean;
    clientTheme: string;
}
