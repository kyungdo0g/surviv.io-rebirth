// A bot playing over the network like any client: HeadlessClient runs find_game, joins and decodes every Update;
// each snapshot goes through the same Bot as in-process bots and the resulting input is sent back.
import { HeadlessClient, type HeadlessClientOptions } from "@rebirth/protocol";
import type { Snapshot } from "@rebirth/sim";
import { Bot, type BotOptions } from "./bot.ts";
import { teamModeOf } from "./botSetup.ts";

export interface NetworkBotOptions extends BotOptions, Omit<HeadlessClientOptions, "bot"> {}

export class NetworkBot {
    readonly client: HeadlessClient;
    readonly options: NetworkBotOptions;
    bot: Bot | null = null;
    private lastTime = -1;

    constructor(opts: NetworkBotOptions) {
        this.options = opts;
        this.client = new HeadlessClient({ ...opts, bot: true });
    }

    /** Creates a bot, runs find_game and joins. */
    static async join(opts: NetworkBotOptions): Promise<NetworkBot> {
        const nb = new NetworkBot(opts);
        await nb.connect();
        return nb;
    }

    /** Joins (find_game + connect), then plays until the connection ends. */
    async connect(): Promise<void> {
        const { map } = await this.client.connect();
        this.attach(map);
    }

    /** Joins through a /play URL directly. */
    async connectTo(url: string): Promise<void> {
        const { map } = await this.client.connectTo(url);
        this.attach(map);
    }

    private attach(map: NonNullable<HeadlessClient["map"]>): void {
        this.bot = new Bot(map, { teamMode: teamModeOf(this.client.joined?.teamMode ?? 1), ...this.options });
        this.client.onUpdate((msg) => this.onSnapshot(msg.snapshot));
        if (this.client.snapshot) this.onSnapshot(this.client.snapshot);
    }

    private onSnapshot(snap: Snapshot): void {
        const bot = this.bot;
        if (!bot || !this.client.connected) return;
        bot.observe(snap);
        // Cobalt: the class menu choice (M7b; the original PerkModeRoleSelect message)
        if (bot.classChoice) this.client.sendRoleSelect(bot.classChoice);
        // team pings and emotes the brain asked for (the original Emote message)
        const emote = bot.takeEmote();
        if (emote) this.client.sendEmote(emote);
        const dt = this.lastTime < 0 ? 0.03 : Math.max(0, snap.time - this.lastTime);
        this.lastTime = snap.time;
        this.client.sendInput(bot.act(dt));
    }

    get playerId(): number {
        return this.client.joined?.playerId ?? 0;
    }

    close(): void {
        this.client.close();
    }
}
