import { defineConfig } from "vite";

// The game server (apps/server, default port 8001) is proxied so `/?net=1` works from the dev server. The server
// builds its WebSocket URL from the Host header, so the proxy must not rewrite the origin.
const SERVER = process.env.REBIRTH_SERVER ?? "127.0.0.1:8001";

export default defineConfig({
    server: {
        port: 5173,
        host: "127.0.0.1",
        proxy: {
            "/api": `http://${SERVER}`,
            "/health": `http://${SERVER}`,
            "/play": { target: `ws://${SERVER}`, ws: true },
        },
    },
    preview: { port: 4173, host: "127.0.0.1" },
    build: { target: "es2022", chunkSizeWarningLimit: 4096 },
});
