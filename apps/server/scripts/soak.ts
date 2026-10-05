// Soak run: starts the server in a child process, joins N headless bots that send random inputs at up to 60 Hz
// (through the client's InputThrottle) for D seconds, then prints tick time p50/p99, bytes per client per second
// (down/up) and the server heap growth.
//   node apps/server/scripts/soak.ts            (80 bots, 60 s, 5 s warm-up)
//   BOTS=20 DURATION_S=10 node apps/server/scripts/soak.ts
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRng, type Rng } from "@rebirth/core";
import { Input } from "@rebirth/defs";
import { HeadlessClient, InputThrottle } from "@rebirth/protocol";
import { emptyInput, type PlayerInput } from "@rebirth/sim";
import type { HostStats } from "../src/host.ts";

const BOTS = Number(process.env.BOTS ?? 80);
const DURATION_S = Number(process.env.DURATION_S ?? 60);
const WARMUP_S = Number(process.env.WARMUP_S ?? 5);
const FRAME_MS = 1000 / 60;
const ACTIONS = [
    Input.Loot,
    Input.Interact,
    Input.Reload,
    Input.EquipPrimary,
    Input.EquipSecondary,
    Input.EquipNextWeap,
    Input.EquipMelee,
];

interface Bot {
    client: HeadlessClient;
    throttle: InputThrottle;
    input: PlayerInput;
    nextMoveChange: number;
    seq: number;
}

function startServerProcess(): Promise<{ url: string; stop: () => void }> {
    const entry = fileURLToPath(new URL("../src/index.ts", import.meta.url));
    const child = spawn(process.execPath, ["--expose-gc", entry], {
        env: {
            ...process.env,
            PORT: "0",
            HOST: "127.0.0.1",
            MAX_PLAYERS: String(Math.max(BOTS, 1)),
            MAX_CONNECTIONS_PER_IP: String(BOTS + 10),
            LOG: "0",
        },
        stdio: ["ignore", "pipe", "inherit"],
    });
    return new Promise((resolve, reject) => {
        let out = "";
        child.stdout.on("data", (chunk: Buffer) => {
            out += chunk.toString();
            const m = /listening on (\S+)/.exec(out);
            if (m) resolve({ url: m[1], stop: () => child.kill("SIGTERM") });
        });
        child.once("exit", (code) => reject(new Error(`server exited with ${code}`)));
    });
}

function randomize(rng: Rng, bot: Bot, now: number): void {
    const input: PlayerInput = { ...bot.input, shootStart: false, actions: [] };
    if (now >= bot.nextMoveChange) {
        bot.nextMoveChange = now + rng.range(500, 2000);
        input.moveLeft = rng.bool(0.3);
        input.moveRight = !input.moveLeft && rng.bool(0.4);
        input.moveUp = rng.bool(0.3);
        input.moveDown = !input.moveUp && rng.bool(0.4);
        input.shootHold = rng.bool(0.4);
    }
    // the mouse moves on about half of the frames
    if (rng.bool(0.5)) {
        const a = Math.atan2(input.toMouseDir.y, input.toMouseDir.x) + rng.range(-0.2, 0.2);
        input.toMouseDir = { x: Math.cos(a), y: Math.sin(a) };
        input.toMouseLen = Math.min(64, Math.max(2, input.toMouseLen + rng.range(-2, 2)));
    }
    input.shootStart = rng.bool(0.02);
    if (rng.bool(0.02)) input.actions = [rng.pick(ACTIONS)];
    input.seq = ++bot.seq & 0xff;
    bot.input = input;
    bot.throttle.push(input);
}

async function getStats(url: string, query = ""): Promise<HostStats> {
    return (await (await fetch(`${url}/api/stats${query}`)).json()) as HostStats;
}

async function main(): Promise<void> {
    const server = await startServerProcess();
    console.log(`server ${server.url}; joining ${BOTS} bots`);
    const rng = createRng(1234);
    const bots: Bot[] = [];
    let disconnects = 0;
    for (let i = 0; i < BOTS; i++) {
        const client = await HeadlessClient.join({ baseUrl: server.url, name: `bot${i}`, bot: true });
        client.onDisconnect((reason) => {
            if (reason !== "closed") disconnects++;
        });
        const bot: Bot = {
            client,
            throttle: new InputThrottle((input) => client.sendInput(input)),
            input: { ...emptyInput(0), toMouseLen: 10 },
            nextMoveChange: 0,
            seq: 0,
        };
        bots.push(bot);
    }
    const frameTimer = setInterval(() => {
        const now = performance.now();
        for (const bot of bots) if (bot.client.connected) randomize(rng, bot, now);
    }, FRAME_MS);

    await new Promise((r) => setTimeout(r, WARMUP_S * 1000));
    const base = await getStats(server.url, "?gc=1&reset=1");
    const start = performance.now();
    const down0 = bots.map((b) => b.client.bytesDown);
    const up0 = bots.map((b) => b.client.bytesUp);
    const msgs0 = bots.map((b) => b.client.framesUp);
    const updates0 = bots.map((b) => b.client.updates);
    for (let s = 1; s <= DURATION_S; s++) {
        await new Promise((r) => setTimeout(r, 1000));
        if (s % 10 === 0) {
            const st = await getStats(server.url);
            const g = st.games[0];
            console.log(
                `t=${s}s players=${st.players} tick p50=${g?.tickMs.p50}ms p99=${g?.tickMs.p99}ms heap=${st.heapUsedMb}MB`,
            );
        }
    }
    const elapsed = (performance.now() - start) / 1000;
    const end = await getStats(server.url, "?gc=1");
    clearInterval(frameTimer);
    const perClient = (now: number[], then: number[]) =>
        now.reduce((sum, v, i) => sum + (v - then[i]), 0) / bots.length / elapsed;
    const down = perClient(
        bots.map((b) => b.client.bytesDown),
        down0,
    );
    const up = perClient(
        bots.map((b) => b.client.bytesUp),
        up0,
    );
    const inputsPerSec = perClient(
        bots.map((b) => b.client.framesUp),
        msgs0,
    );
    const updatesPerSec = perClient(
        bots.map((b) => b.client.updates),
        updates0,
    );
    const game = end.games[0];
    const result = {
        bots: BOTS,
        games: end.games.length,
        players: end.players,
        seconds: Math.round(elapsed * 10) / 10,
        tickMs: game?.tickMs,
        netsyncMs: game?.netsyncMs,
        droppedTicks: game?.droppedTicks,
        skippedUpdates: game?.skippedUpdates,
        downBytesPerClientPerSec: Math.round(down),
        upBytesPerClientPerSec: Math.round(up),
        inputMsgsPerClientPerSec: Math.round(inputsPerSec * 10) / 10,
        updatesPerClientPerSec: Math.round(updatesPerSec * 10) / 10,
        heapStartMb: base.heapUsedMb,
        heapEndMb: end.heapUsedMb,
        heapGrowthMb: Math.round((end.heapUsedMb - base.heapUsedMb) * 10) / 10,
        rssMb: end.rssMb,
        cache: game?.cache,
        unexpectedDisconnects: disconnects,
    };
    console.log(JSON.stringify(result, null, 2));
    for (const bot of bots) {
        bot.throttle.dispose();
        bot.client.close();
    }
    server.stop();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
