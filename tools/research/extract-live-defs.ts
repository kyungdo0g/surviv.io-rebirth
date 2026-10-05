// Extracts the game definitions from the original surviv.io client served by the 2026 Kongregate relaunch.
// Usage: NODE_USE_ENV_PROXY=1 node tools/research/extract-live-defs.ts [--fetch]
// Writes research-cache/live/defs.json ({ gameObjects, mapObjects, maps, gameConfig, meta }).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

const DIR = "research-cache/live";
const BASE = "https://surviv.io";

async function fetchBundles(): Promise<string[]> {
    mkdirSync(DIR, { recursive: true });
    const html = await (await fetch(BASE)).text();
    writeFileSync(join(DIR, "index.html"), html);
    const scripts = [...html.matchAll(/src="(js\/[^"]+\.js)"/g)].map((m) => m[1]);
    for (const s of scripts) writeFileSync(join(DIR, s.split("/").pop()!), await (await fetch(`${BASE}/${s}`)).text());
    return scripts.map((s) => s.split("/").pop()!);
}

function bundleFiles(): string[] {
    const html = readFileSync(join(DIR, "index.html"), "utf8");
    return [...html.matchAll(/src="js\/([^"]+\.js)"/g)].map((m) => m[1]).filter((f) => !f.startsWith("manifest"));
}

type Factory = (module: { exports: any }, exports: any, require: (id: number) => any) => void;

function loadModules(files: string[]): Record<string, Factory> {
    const modules: Record<string, Factory> = {};
    const chunks: any[] = [];
    const sandbox: any = { self: { webpackChunk: chunks }, console };
    sandbox.window = sandbox.self;
    vm.createContext(sandbox);
    for (const f of files) vm.runInContext(readFileSync(join(DIR, f), "utf8"), sandbox, { filename: f });
    for (const [, mods] of chunks) Object.assign(modules, mods);
    return modules;
}

function makeRequire(modules: Record<string, Factory>) {
    const cache: Record<string, { exports: any }> = {};
    const req: any = (id: number) => {
        if (cache[id]) return cache[id].exports;
        const module = (cache[id] = { exports: {} });
        modules[id](module, module.exports, req);
        return module.exports;
    };
    req.d = (exports: any, getters: Record<string, () => unknown>) => {
        for (const k in getters)
            if (!Object.hasOwn(exports, k)) Object.defineProperty(exports, k, { enumerable: true, get: getters[k] });
    };
    req.r = (exports: any) => Object.defineProperty(exports, "__esModule", { value: true });
    req.n = (m: any) => (m?.__esModule ? () => m.default : () => m);
    req.o = (o: object, p: string) => Object.hasOwn(o, p);
    req.g = globalThis;
    return req;
}

function findModule(modules: Record<string, Factory>, needle: RegExp): string[] {
    return Object.entries(modules)
        .filter(([, f]) => needle.test(f.toString()))
        .map(([id]) => id);
}

if (process.argv.includes("--fetch") || !existsSync(join(DIR, "index.html"))) await fetchBundles();
const modules = loadModules(bundleFiles());
const req = makeRequire(modules);

const tryReq = (id: string) => {
    try {
        return req(Number(id));
    } catch (err) {
        return { __error: String(err) };
    }
};

// Building children pick a random obstacle through closures made by randomObstacleType(weights);
// wrap the helper so each closure remembers its weights and can be serialized.
for (const id of findModule(modules, /randomObstacleType\s*:/)) {
    const helpers = req(Number(id));
    if (typeof helpers.randomObstacleType !== "function") continue;
    const orig = helpers.randomObstacleType;
    helpers.randomObstacleType = (weights: Record<string, number>) =>
        Object.assign(orig(weights), { __weights: weights });
}

const goId = findModule(modules, /GameObject ".concat\(|GameObject "\s*\+/)[0];
const gameObjects = tryReq(goId);
const moIds = findModule(modules, /house_red_01:/);
const mapDefIds = findModule(modules, /desertDefs|mapId\s*:\s*\d|gasStage|spawnReplacements/);
const cfgIds = findModule(modules, /protocolVersion\s*:/);

const out = {
    meta: {
        source: BASE,
        fetchedFrom: readFileSync(join(DIR, "index.html"), "utf8").length,
        gameObjectModule: goId,
        mapObjectCandidates: moIds,
        mapDefCandidates: mapDefIds,
        gameConfigCandidates: cfgIds,
    },
    gameObjects,
    mapObjects: tryReq(moIds[0]),
    mapDefCandidates: Object.fromEntries(mapDefIds.map((id) => [id, tryReq(id)])),
    gameConfig: Object.fromEntries(cfgIds.map((id) => [id, tryReq(id)])),
};
writeFileSync(
    join(DIR, "defs.json"),
    JSON.stringify(out, (_k, v) => (typeof v === "function" ? (v.__weights ?? `[fn ${v.name}]`) : v), 1),
);
console.log(`gameObjects: ${Object.keys(gameObjects).length} (module ${goId})`);
console.log(
    `mapObjects: ${Object.keys(out.mapObjects).length} (module ${moIds.join(",")}); map def candidates: ${mapDefIds.join(",")}; config: ${cfgIds.join(",")}`,
);
