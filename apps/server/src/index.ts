// Entry point: `node apps/server/src/index.ts` (env: PORT, HOST, MAX_PLAYERS, MAP_NAME, BOT_FILL, BOT_DIFFICULTY,
// ADMIN_TOKEN... see config.ts and docs/deploy.md).
import { loadConfig } from "./config.ts";
import { startServer } from "./server.ts";

const config = loadConfig();
const server = await startServer(config);
console.log(`listening on ${server.url}${config.clientDist ? ` (serving ${config.clientDist})` : ""}`);
if (config.botFill > 0) {
    const mix = config.botSkillMix;
    const skill =
        config.botDifficulty === "mixed"
            ? `skill mix ${mix.beginner}/${mix.intermediate}/${mix.expert} beginner/intermediate/expert`
            : `${config.botDifficulty} bots`;
    console.log(
        `bot fill: games fill up to ${config.botFill} players (${skill}, personas ${config.botPersonas ? "on" : "off"})`,
    );
}
const m = server.moderation;
console.log(
    [
        `moderation: admin API ${config.adminToken ? "on" : "off (no ADMIN_TOKEN)"}`,
        `anti-cheat ${config.antiCheat ? `on (flag score ${config.antiCheat.flagScore})` : "off"}`,
        `name filter ${config.nameFilterFile ? `${m.names.entries.length} entries` : "off"}`,
        `${m.bans.list().length} bans (${config.banFile})`,
        `reports to ${config.reportsFile}`,
    ].join(", "),
);

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
