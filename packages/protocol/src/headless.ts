// Headless game client for tests, soak runs and bots: a GameConnection that keeps the latest snapshot and offers
// promise helpers to wait for snapshots or the disconnect.
import type { Snapshot } from "@rebirth/sim";
import { GameConnection, type GameConnectionOptions } from "./connection.ts";

export interface HeadlessClientOptions extends GameConnectionOptions {
    /** keep every decoded snapshot in `history` (default false) */
    keepHistory?: boolean;
}

interface Waiter {
    pred: (s: Snapshot) => boolean;
    resolve: (s: Snapshot) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
}

export class HeadlessClient extends GameConnection {
    /** latest snapshot */
    snapshot: Snapshot | null = null;
    /** decoded updates so far */
    updates = 0;
    /** last input seq the server acknowledged */
    ack = 0;
    readonly history: Snapshot[] = [];
    private readonly waiters = new Set<Waiter>();

    constructor(opts: HeadlessClientOptions = {}) {
        super(opts);
        const keep = opts.keepHistory ?? false;
        this.onUpdate((msg) => {
            this.snapshot = msg.snapshot;
            this.ack = msg.ack;
            this.updates++;
            if (keep) this.history.push(msg.snapshot);
            for (const w of [...this.waiters]) {
                if (!w.pred(msg.snapshot)) continue;
                this.waiters.delete(w);
                clearTimeout(w.timer);
                w.resolve(msg.snapshot);
            }
        });
        this.onDisconnect((reason) => {
            for (const w of this.waiters) {
                clearTimeout(w.timer);
                w.reject(new Error(`disconnected (${reason}) while waiting for a snapshot`));
            }
            this.waiters.clear();
        });
    }

    /** Creates a client, runs find_game and joins. */
    static async join(opts: HeadlessClientOptions = {}): Promise<HeadlessClient> {
        const client = new HeadlessClient(opts);
        await client.connect();
        return client;
    }

    /** Joins through a /play URL directly. */
    static async joinUrl(url: string, opts: HeadlessClientOptions = {}): Promise<HeadlessClient> {
        const client = new HeadlessClient(opts);
        await client.connectTo(url);
        return client;
    }

    /** Resolves with the first future snapshot matching `pred` (default: the next one). */
    waitForSnapshot(pred: (s: Snapshot) => boolean = () => true, timeoutMs = 5000): Promise<Snapshot> {
        return new Promise((resolve, reject) => {
            if (this.disconnectReason !== null) {
                reject(new Error(`disconnected (${this.disconnectReason})`));
                return;
            }
            const waiter: Waiter = {
                pred,
                resolve,
                reject,
                timer: setTimeout(() => {
                    this.waiters.delete(waiter);
                    reject(new Error(`no matching snapshot within ${timeoutMs} ms`));
                }, timeoutMs),
            };
            this.waiters.add(waiter);
        });
    }

    /** Resolves with the disconnect reason. */
    waitForDisconnect(timeoutMs = 5000): Promise<string> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`still connected after ${timeoutMs} ms`)), timeoutMs);
            this.onDisconnect((reason) => {
                clearTimeout(timer);
                resolve(reason);
            });
        });
    }
}
