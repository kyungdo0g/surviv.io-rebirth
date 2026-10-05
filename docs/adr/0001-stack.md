# ADR 0001: Technology stack

Status: accepted (2026-10-05)

## Decision

- TypeScript (strict, ESM, `erasableSyntaxOnly`) in a pnpm workspace; Node 22 runs `.ts` sources directly for tools, tests and the server.
- Client: PixiJS v8 (WebGL) + Vite; HUD and menus in plain DOM.
- Server: Node 22, `ws` for WebSockets behind a transport interface, Hono for HTTP.
- Simulation: shared `packages/sim`, fixed 100 Hz timestep, deterministic (seeded sfc32 rng, no wall clock), server-authoritative with client interpolation; snapshots about every 3rd tick.
- Protocol: own LSB-first bitstream with quantized floats and integer type ids from a registry; a `PROTOCOL_HASH` over the id lists is checked at join.
- Tooling: Vitest, Playwright (pinned to the preinstalled Chromium build), Biome.

## Why

- One language and one simulation codebase for server, client sandbox and tests.
- No native build steps (pure-JS `ws`, prebuilt binaries only), so CI and agents can run everything.
- Determinism makes balance tests, replays and oracle comparisons with survev possible.
