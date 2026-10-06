// Moderation services of a server (M8): the name filter, bans, player reports (with the token registry and the
// archive of closed matches they need) and the anti-cheat flag log. One instance per running server (server.ts).
import type { ServerConfig } from "../config.ts";
import { BanList } from "./bans.ts";
import { MatchArchive, ReportSessions } from "./matches.ts";
import { NameFilter, NO_NAME_FILTER } from "./nameFilter.ts";
import { ReportStore } from "./reports.ts";
import { SuspectLog } from "./suspects.ts";

export interface Moderation {
    readonly names: NameFilter;
    readonly bans: BanList;
    readonly reports: ReportStore;
    readonly sessions: ReportSessions;
    readonly matches: MatchArchive;
    readonly suspects: SuspectLog;
}

export function createModeration(config: ServerConfig): Moderation {
    return {
        names: config.nameFilterFile ? NameFilter.fromFile(config.nameFilterFile) : NO_NAME_FILTER,
        bans: new BanList(config.banFile),
        reports: new ReportStore(config.reportsFile),
        sessions: new ReportSessions(config.reportWindowMs),
        matches: new MatchArchive(config.reportWindowMs),
        suspects: new SuspectLog({ file: config.suspectsFile, log: config.log }),
    };
}

/** Drops expired report tokens and archived matches. */
export function sweepModeration(m: Moderation): void {
    m.sessions.sweep();
    m.matches.sweep();
}
