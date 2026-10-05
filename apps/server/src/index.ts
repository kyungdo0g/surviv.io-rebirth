// Entry point: `node apps/server/src/index.ts` (env: PORT, HOST, MAX_PLAYERS, MAP_NAME... see config.ts).
import { loadConfig } from "./config.ts";
import { startServer } from "./server.ts";

const config = loadConfig();
const server = await startServer(config);
console.log(`listening on ${server.url}${config.clientDist ? ` (serving ${config.clientDist})` : ""}`);

let stopping = false;
const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`${signal}: shutting down`);
    server.close().then(
        () => process.exit(0),
        () => process.exit(1),
    );
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
