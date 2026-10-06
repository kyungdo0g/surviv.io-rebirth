// Player reports (rebirth M8): the HTTP API a client calls to report a player of its match, shared by the server
// (apps/server/src/moderation/reports.ts) and clients. POST {baseUrl}/api/report with a JSON body; the reporter is
// authenticated by the join token of its game connection (find_game's / the party joinGame's `token`, also
// GameConnection.joinToken), which stays valid for reports while the game runs and REPORT_WINDOW_MS (15 minutes by
// default) after it ended. Limits: REPORT_MAX_PER_MATCH (3) reports per reporter per match, one per reported player.

/** Why a player is reported. */
export const ReportReason = {
    Cheating: "cheating",
    Teaming: "teaming",
    Name: "name",
    Other: "other",
} as const;
export type ReportReasonValue = (typeof ReportReason)[keyof typeof ReportReason];
export const REPORT_REASONS: readonly ReportReasonValue[] = Object.values(ReportReason);

/** Longest free text accepted (characters; longer text is rejected). */
export const REPORT_TEXT_MAX_LENGTH = 200;

export interface ReportRequest {
    /** the reporter's join token for the game (may be sent as `Authorization: Bearer <token>` instead) */
    token: string;
    /** reported player: its player id in the game (kill feed / player infos) */
    playerId: number;
    reason: ReportReasonValue;
    /** optional details, at most REPORT_TEXT_MAX_LENGTH characters */
    text?: string;
    /** optional: the game id; when given it must be the token's game */
    gameId?: string;
}

/**
 * Error codes of a refused report: invalid_request (400, bad body), invalid_token (401, unknown or expired token),
 * game_mismatch (400), self_report (400), unknown_player (404, no such player in the match), duplicate (409, this
 * player was already reported by this reporter in this match), report_limit (429, REPORT_MAX_PER_MATCH reached),
 * rate_limited (429, too many requests from this address).
 */
export type ReportError =
    | "invalid_request"
    | "invalid_token"
    | "game_mismatch"
    | "self_report"
    | "unknown_player"
    | "duplicate"
    | "report_limit"
    | "rate_limited";

export type ReportResponse = { ok: true; id: string } | { ok: false; error: ReportError | string };

/** POST {baseUrl}/api/report; resolves with the server's answer (never throws for an HTTP error status). */
export async function submitReport(baseUrl: string, req: ReportRequest): Promise<ReportResponse> {
    let res: Response;
    try {
        res = await fetch(`${baseUrl}/api/report`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(req),
        });
    } catch {
        return { ok: false, error: "network_error" };
    }
    const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    if (res.ok && typeof body.id === "string") return { ok: true, id: body.id };
    return { ok: false, error: body.error ?? `http_${res.status}` };
}
