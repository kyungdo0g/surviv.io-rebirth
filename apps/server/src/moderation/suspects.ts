// Anti-cheat flags of the whole server (M8): the most recent ones in memory for GET /api/admin/suspects, each logged
// as one JSON line on stderr (event "anticheat_flag") and, with SUSPECTS_FILE, appended to a JSONL file with its full
// telemetry snapshot.
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { SuspectFlag } from "../anticheat/match.ts";

export interface SuspectLogOptions {
    /** flags kept in memory (default 500) */
    max?: number;
    /** JSONL file every flag is appended to, or null */
    file?: string | null;
    /** log a JSON line per flag (default true) */
    log?: boolean;
}

export interface SuspectQuery {
    limit?: number;
    gameId?: string;
    minScore?: number;
}

export class SuspectLog {
    private readonly flags: SuspectFlag[] = [];
    private readonly max: number;
    private readonly file: string | null;
    private readonly log: boolean;

    constructor(opts: SuspectLogOptions = {}) {
        this.max = opts.max ?? 500;
        this.file = opts.file ?? null;
        this.log = opts.log ?? true;
    }

    get size(): number {
        return this.flags.length;
    }

    record(flag: SuspectFlag): void {
        this.flags.push(flag);
        if (this.flags.length > this.max) this.flags.splice(0, this.flags.length - this.max);
        if (this.log) {
            const { stats: _stats, ...brief } = flag;
            console.warn(JSON.stringify({ level: "warn", event: "anticheat_flag", ...brief }));
        }
        if (this.file) {
            try {
                mkdirSync(dirname(this.file), { recursive: true });
                appendFileSync(this.file, `${JSON.stringify(flag)}\n`);
            } catch (err) {
                console.error(`SUSPECTS_FILE ${this.file}: ${(err as Error).message}`);
            }
        }
    }

    /** Newest first. */
    recent(q: SuspectQuery = {}): SuspectFlag[] {
        const limit = q.limit ?? 100;
        const out: SuspectFlag[] = [];
        for (let i = this.flags.length - 1; i >= 0 && out.length < limit; i--) {
            const f = this.flags[i];
            if (q.gameId && f.gameId !== q.gameId) continue;
            if (q.minScore !== undefined && f.score < q.minScore) continue;
            out.push(f);
        }
        return out;
    }
}
