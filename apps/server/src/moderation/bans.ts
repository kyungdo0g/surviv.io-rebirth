// Basic bans (M8): IP addresses / subnets and name patterns, kept in BAN_FILE (JSON, default ./data/bans.json) and
// checked at find_game (IP) and at Join (IP and name; the socket is closed with DisconnectReason.Banned). Admins add
// and remove bans through /api/admin/bans; edits to the file by hand are picked up within a few seconds.
// File format: {"bans": [{"id", "type": "ip" | "name", "value", "reason", "createdAt", "expiresAt": ISO | null}]}.
// IP values: an address ("203.0.113.7", "2001:db8::1") or a CIDR subnet ("203.0.113.0/24", "2001:db8::/32").
// Name values: a pattern compared with the normalized name (lower case, letters only, see nameFilter.ts foldName);
// "*" matches anything ("*cheat*" bans every name containing "cheat").
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { BlockList, isIP } from "node:net";
import { dirname } from "node:path";
import { z } from "zod";
import { recomposeJamo } from "./hangul.ts";
import { foldName } from "./nameFilter.ts";

export type BanType = "ip" | "name";

export interface Ban {
    id: string;
    type: BanType;
    value: string;
    reason: string;
    /** ISO time */
    createdAt: string;
    /** ISO time, null for permanent */
    expiresAt: string | null;
}

const BanSchema = z.object({
    id: z.string().min(1).max(64),
    type: z.enum(["ip", "name"]),
    value: z.string().min(1).max(64),
    reason: z.string().max(200).default(""),
    createdAt: z.string().default(() => new Date(0).toISOString()),
    expiresAt: z.string().nullable().default(null),
});
const BanFile = z.union([z.object({ bans: z.array(z.unknown()) }), z.array(z.unknown())]);

/** File reloads are looked for at most this often. */
const RELOAD_CHECK_MS = 5000;

/** IPv4-mapped IPv6 addresses ("::ffff:1.2.3.4", what dual-stack sockets report) as plain IPv4. */
export function normalizeIp(ip: string): string {
    const lower = ip.trim().toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    return mapped ? mapped[1] : lower;
}

/** Whether `value` is an IP address or a CIDR subnet. */
export function validIpBan(value: string): boolean {
    const [addr, prefix, extra] = value.split("/");
    if (extra !== undefined) return false;
    const family = isIP(normalizeIp(addr));
    if (family === 0) return false;
    if (prefix === undefined) return true;
    const n = Number(prefix);
    return /^\d+$/.test(prefix) && n >= 0 && n <= (family === 4 ? 32 : 128);
}

function ipMatcher(value: string): BlockList {
    const list = new BlockList();
    const [addr, prefix] = value.split("/");
    const ip = normalizeIp(addr);
    const family = isIP(ip) === 6 ? "ipv6" : "ipv4";
    if (prefix === undefined) list.addAddress(ip, family);
    else list.addSubnet(ip, Number(prefix), family);
    return list;
}

/** The comparison key of a name: lower-case letters (see nameFilter.ts foldName), Hangul recomposed. */
export function nameKey(name: string): string {
    return recomposeJamo(foldName(name, false));
}

function nameMatcher(pattern: string): RegExp {
    const parts = pattern.split("*").map((p) => nameKey(p).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return new RegExp(`^${parts.join(".*")}$`, "u");
}

interface CompiledBan {
    ban: Ban;
    ip?: BlockList;
    name?: RegExp;
}

export interface NewBan {
    type: BanType;
    value: string;
    reason?: string;
    /** minutes until it expires; absent or 0 for permanent */
    durationMinutes?: number;
}

export class BanList {
    readonly file: string | null;
    private readonly now: () => number;
    private compiled: CompiledBan[] = [];
    private mtimeMs = -1;
    private lastCheck = Number.NEGATIVE_INFINITY;

    constructor(file: string | null, now: () => number = Date.now) {
        this.file = file;
        this.now = now;
        this.load();
    }

    /** (Re)reads the file; a missing file is an empty list, invalid entries are skipped with a warning. */
    load(): void {
        this.lastCheck = this.now();
        if (!this.file) return;
        let text: string;
        try {
            const st = statSync(this.file);
            this.mtimeMs = st.mtimeMs;
            text = readFileSync(this.file, "utf8");
        } catch {
            this.mtimeMs = -1;
            this.compiled = [];
            return;
        }
        let entries: unknown[] = [];
        try {
            const parsed = BanFile.parse(JSON.parse(text));
            entries = Array.isArray(parsed) ? parsed : parsed.bans;
        } catch (err) {
            console.warn(`BAN_FILE ${this.file}: unreadable (${(err as Error).message}); keeping no bans`);
        }
        const out: CompiledBan[] = [];
        for (const raw of entries) {
            const res = BanSchema.safeParse(raw);
            if (!res.success || (res.data.type === "ip" && !validIpBan(res.data.value))) {
                console.warn(`BAN_FILE ${this.file}: skipping invalid ban ${JSON.stringify(raw)}`);
                continue;
            }
            out.push(compile(res.data));
        }
        this.compiled = out;
    }

    /** Re-reads the file when it changed on disk (checked at most every few seconds). */
    private maybeReload(): void {
        if (!this.file || this.now() - this.lastCheck < RELOAD_CHECK_MS) return;
        this.lastCheck = this.now();
        let mtime = -1;
        try {
            mtime = statSync(this.file).mtimeMs;
        } catch {
            // deleted: no bans
        }
        if (mtime !== this.mtimeMs) this.load();
    }

    private active(): CompiledBan[] {
        this.maybeReload();
        const now = this.now();
        return this.compiled.filter((c) => c.ban.expiresAt === null || Date.parse(c.ban.expiresAt) > now);
    }

    /** Bans in force. */
    list(): Ban[] {
        return this.active().map((c) => ({ ...c.ban }));
    }

    /** The ban matching a client address, or null. */
    matchIp(ip: string): Ban | null {
        const addr = normalizeIp(ip);
        const family = isIP(addr);
        if (family === 0) return null;
        for (const c of this.active()) if (c.ip?.check(addr, family === 6 ? "ipv6" : "ipv4")) return c.ban;
        return null;
    }

    /** The ban matching a player name, or null. */
    matchName(name: string): Ban | null {
        const key = nameKey(name);
        for (const c of this.active()) if (c.name?.test(key)) return c.ban;
        return null;
    }

    /** The ban matching an address or (when given) a name. */
    check(ip: string, name?: string): Ban | null {
        return this.matchIp(ip) ?? (name === undefined ? null : this.matchName(name));
    }

    /** Adds a ban and saves the file; throws on an invalid value. */
    add(spec: NewBan): Ban {
        const value = spec.value.trim();
        if (spec.type === "ip" && !validIpBan(value)) throw new Error("invalid IP address or subnet");
        // a pattern without letters ("*", "123") would match every name or none
        if (spec.type === "name" && !nameKey(value.replaceAll("*", ""))) throw new Error("name pattern has no letters");
        const now = this.now();
        const ban: Ban = {
            id: randomUUID(),
            type: spec.type,
            value,
            reason: (spec.reason ?? "").slice(0, 200),
            createdAt: new Date(now).toISOString(),
            expiresAt: spec.durationMinutes ? new Date(now + spec.durationMinutes * 60_000).toISOString() : null,
        };
        this.maybeReload();
        this.compiled.push(compile(ban));
        this.save();
        return ban;
    }

    /** Removes a ban by id and saves the file; false when there is none. */
    remove(id: string): boolean {
        this.maybeReload();
        const before = this.compiled.length;
        this.compiled = this.compiled.filter((c) => c.ban.id !== id);
        if (this.compiled.length === before) return false;
        this.save();
        return true;
    }

    /** Writes the bans (expired ones dropped) atomically: a temporary file renamed over the old one. */
    private save(): void {
        if (!this.file) return;
        const now = this.now();
        this.compiled = this.compiled.filter((c) => c.ban.expiresAt === null || Date.parse(c.ban.expiresAt) > now);
        mkdirSync(dirname(this.file), { recursive: true });
        const tmp = `${this.file}.${process.pid}.tmp`;
        writeFileSync(tmp, `${JSON.stringify({ bans: this.compiled.map((c) => c.ban) }, null, 2)}\n`);
        renameSync(tmp, this.file);
        this.mtimeMs = statSync(this.file).mtimeMs;
    }
}

function compile(ban: Ban): CompiledBan {
    return ban.type === "ip" ? { ban, ip: ipMatcher(ban.value) } : { ban, name: nameMatcher(ban.value) };
}
