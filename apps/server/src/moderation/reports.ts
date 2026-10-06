// Player reports (M8; API in @rebirth/protocol report.ts): validation, limits and storage. A report is accepted from
// a joined player's join token (ReportSessions) against another player of the same match, at most
// REPORT_MAX_PER_MATCH per reporter per match and once per reported player, and appended as one JSON line to
// REPORTS_FILE (default ./data/reports.jsonl) with the match and both players' records: name, address and the
// anti-cheat telemetry snapshot at the time of the report. GET /api/admin/reports reads the file back, newest first.
import { randomUUID } from "node:crypto";
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { REPORT_REASONS, REPORT_TEXT_MAX_LENGTH, type ReportError, type ReportReasonValue } from "@rebirth/protocol";
import { z } from "zod";
import type { MatchContext, PlayerRecord, ReportSessions } from "./matches.ts";

export interface ReportRecord {
    id: string;
    /** ISO time */
    time: string;
    gameId: string;
    mapName: string;
    teamMode: number;
    reason: ReportReasonValue;
    text: string;
    reporter: PlayerRecord;
    reported: PlayerRecord;
}

/** The JSON body of POST /api/report (the token may come from the Authorization header instead). */
export const ReportBody = z.object({
    token: z.string().min(1).max(64).optional(),
    gameId: z.string().max(64).optional(),
    playerId: z.number().int().min(1).max(0xffff),
    reason: z.enum(REPORT_REASONS as [ReportReasonValue, ...ReportReasonValue[]]),
    text: z.string().max(REPORT_TEXT_MAX_LENGTH).optional(),
});
export type ReportBody = z.infer<typeof ReportBody>;

// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is the point
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;

/** Free text as stored: control characters removed, whitespace collapsed, trimmed. */
export function cleanReportText(text: string | undefined): string {
    return (text ?? "").replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim();
}

export type ReportOutcome =
    | { ok: true; record: ReportRecord }
    | { ok: false; status: 400 | 401 | 404 | 409 | 429; error: ReportError };

export interface ReportDeps {
    sessions: ReportSessions;
    store: ReportStore;
    maxPerMatch: number;
    /** the live room or archived match of a game id */
    findMatch(gameId: string): MatchContext | null;
    now?: () => number;
}

/** Validates and stores one report from the holder of `token`. */
export function fileReport(deps: ReportDeps, token: string, body: ReportBody): ReportOutcome {
    const who = deps.sessions.get(token);
    if (!who) return { ok: false, status: 401, error: "invalid_token" };
    if (body.gameId !== undefined && body.gameId !== who.gameId)
        return { ok: false, status: 400, error: "game_mismatch" };
    if (body.playerId === who.playerId) return { ok: false, status: 400, error: "self_report" };
    const match = deps.findMatch(who.gameId);
    const reported = match?.player(body.playerId) ?? null;
    if (!match || !reported) return { ok: false, status: 404, error: "unknown_player" };
    if (who.reported.has(body.playerId)) return { ok: false, status: 409, error: "duplicate" };
    if (who.reported.size >= deps.maxPerMatch) return { ok: false, status: 429, error: "report_limit" };
    const reporter = match.player(who.playerId) ?? {
        playerId: who.playerId,
        name: who.name,
        ip: who.ip,
        bot: false,
        telemetry: null,
    };
    const record: ReportRecord = {
        id: randomUUID(),
        time: new Date((deps.now ?? Date.now)()).toISOString(),
        gameId: match.gameId,
        mapName: match.mapName,
        teamMode: match.teamMode,
        reason: body.reason,
        text: cleanReportText(body.text),
        reporter: { ...reporter, ip: reporter.ip ?? who.ip },
        reported,
    };
    deps.store.append(record);
    who.reported.add(body.playerId);
    return { ok: true, record };
}

export interface ReportQuery {
    limit?: number;
    gameId?: string;
    playerId?: number;
    reason?: string;
}

/** Most bytes read from the end of the reports file to list recent reports. */
const TAIL_BYTES = 16 * 1024 * 1024;

/** Reports as JSON lines in a file. */
export class ReportStore {
    readonly file: string;

    constructor(file: string) {
        this.file = file;
    }

    append(record: ReportRecord): void {
        mkdirSync(dirname(this.file), { recursive: true });
        appendFileSync(this.file, `${JSON.stringify(record)}\n`);
    }

    /** Newest first, read from the last TAIL_BYTES of the file. */
    recent(q: ReportQuery = {}): ReportRecord[] {
        if (!existsSync(this.file)) return [];
        const size = statSync(this.file).size;
        const start = Math.max(0, size - TAIL_BYTES);
        const buf = Buffer.alloc(size - start);
        const fd = openSync(this.file, "r");
        try {
            readSync(fd, buf, 0, buf.length, start);
        } finally {
            closeSync(fd);
        }
        const lines = buf.toString("utf8").split("\n");
        // a cut first line is incomplete
        if (start > 0) lines.shift();
        const limit = q.limit ?? 100;
        const out: ReportRecord[] = [];
        for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
            const line = lines[i].trim();
            if (!line) continue;
            let r: ReportRecord;
            try {
                r = JSON.parse(line) as ReportRecord;
            } catch {
                continue;
            }
            if (q.gameId && r.gameId !== q.gameId) continue;
            if (q.playerId !== undefined && r.reported?.playerId !== q.playerId) continue;
            if (q.reason && r.reason !== q.reason) continue;
            out.push(r);
        }
        return out;
    }
}
