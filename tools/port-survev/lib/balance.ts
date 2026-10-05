// Applies docs/research/provenance/balance-revert.json entries (reverting survev fork balance changes) to the
// server-only data the port takes from survev: map loot tables, map generation, map game config, GameConfig and
// survev-only map objects. Values that come from the original client are authoritative and never modified.
//
// Entry shapes handled (see the research file): target "main.lootTable.tier_guns[bar]" + field "weight",
// target "faction.mapGen.fixedSpawns.cache_01f" + field "count" (the spawn count itself), target "bullet_an94.damage"
// + field "damage" (field already part of the target), an optional `maps` list naming every map the entry applies to.
import { clone, deepEqual, isPlainObject } from "./util.ts";

export interface RevertEntry {
    section: string;
    target: string;
    field?: string;
    forkValue?: unknown;
    originalValue?: unknown;
    maps?: string[];
    line?: unknown;
    confidence?: string;
    note?: string;
}

export interface RevertLog {
    status: "applied" | "skipped";
    entry: RevertEntry;
    reason: string;
    targets?: string[];
}

export interface RevertContext {
    maps: Record<string, any>;
    gameConfig: Record<string, any>;
    /** GameConfig keys present in the original client (dot paths); those are not reverted */
    originalGameConfigPaths: Set<string>;
    gameObjects: Record<string, any>;
    mapObjects: Record<string, any>;
    mapObjectStatus: Record<string, string>;
    /** every map object id of either source: map spawn reverts must not point anywhere else */
    knownMapObjects?: Set<string>;
}

const SERVER_SECTIONS = new Set(["loottables", "mapspawns", "roles", "perks", "other"]);
const REMOVE = Symbol("remove");
const MAPGEN_KEYS = new Set([
    "densitySpawns",
    "fixedSpawns",
    "randomSpawns",
    "spawnReplacements",
    "customSpawnRules",
    "importantSpawns",
    "places",
    "bridgeTypes",
    "map",
]);

/**
 * The value to write, REMOVE for "did not exist in the original", or undefined when not concrete.
 * Strings: "absent"/"removed"/"none"/"n/a" (optionally with a parenthesized note) mean REMOVE, numeric and
 * JSON-encoded strings are parsed, any other text is a description and not concrete.
 */
export function concreteValue(v: unknown): unknown {
    if (v === undefined || v === null) return undefined;
    if (typeof v !== "string") return v;
    const s = v.trim();
    if (/^(absent|removed|none|not present|n\/a|-)(\s*\(.*\))?$/i.test(s)) return REMOVE;
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    if (/^["{[]/.test(s)) {
        try {
            return JSON.parse(s);
        } catch {
            return undefined;
        }
    }
    return undefined;
}

/** Splits "main.lootTable.tier_x[item]" into path tokens; `[""]` selects the empty (no drop) loot entry. */
const tokens = (s: string | undefined) =>
    s
        ? s
              .split(/[.:/\s[\]]+/)
              .filter(Boolean)
              .map((t) => (t === '""' ? "" : t))
        : [];

const isLootTable = (v: unknown): v is any[] =>
    Array.isArray(v) && v.length > 0 && v.every((e) => isPlainObject(e) && typeof e.name === "string" && "weight" in e);

function mapShortcut(map: any, tok: string): string | undefined {
    if (tok.startsWith("tier_")) return "lootTable";
    if (MAPGEN_KEYS.has(tok)) return "mapGen";
    if (isPlainObject(map.gameConfig) && tok in map.gameConfig) return "gameConfig";
    return undefined;
}

type Slot =
    | { kind: "prop"; holder: any; key: string; path: string }
    | { kind: "loot"; table: any[]; name: string; prop: "weight" | "count"; path: string };

/** Walks `path` from a root, with shortcuts for map defs, `[name]` selectors and single-element arrays. */
function walkPath(root: any, path: string[], label: string, isMap: boolean): Slot | undefined {
    let node = root;
    let where = label;
    for (let i = 0; i < path.length; i++) {
        const tok = path[i];
        const last = i === path.length - 1;
        if (isMap && node === root) {
            if (tok === "lootTables" || tok === "lootTable") {
                node = root.lootTable;
                where += ".lootTable";
                continue;
            }
            const shortcut = tok in root ? undefined : mapShortcut(root, tok);
            if (shortcut) {
                node = root[shortcut];
                where += `.${shortcut}`;
            }
        }
        if (isLootTable(node) || (Array.isArray(node) && node.length === 0)) {
            const next = path[i + 1];
            if (!last && (i + 2 !== path.length || (next !== "count" && next !== "weight"))) return undefined;
            return {
                kind: "loot",
                table: node,
                name: tok,
                prop: next === "count" ? "count" : "weight",
                path: `${where}.${tok}`,
            };
        }
        if (Array.isArray(node)) {
            if (/^\d+$/.test(tok)) {
                if (last) return { kind: "prop", holder: node, key: tok, path: `${where}[${tok}]` };
                node = node[Number(tok)];
                where += `[${tok}]`;
                continue;
            }
            const named = node.find((e) => isPlainObject(e) && (e.name === tok || e.type === tok || e.role === tok));
            if (named) {
                if (last) return undefined;
                node = named;
                where += `[${tok}]`;
                continue;
            }
            if (node.length !== 1 || !isPlainObject(node[0])) return undefined;
            node = node[0];
            where += "[0]";
        }
        if (!isPlainObject(node)) return undefined;
        if (last) return { kind: "prop", holder: node, key: tok, path: `${where}.${tok}` };
        node = node[tok];
        where += `.${tok}`;
        if (node === undefined) return undefined;
    }
    return undefined;
}

function currentValue(slot: Slot): unknown {
    if (slot.kind === "prop") return slot.holder[slot.key];
    const e = slot.table.find((x) => x.name === slot.name);
    return e === undefined ? undefined : e[slot.prop];
}

/** Writes the original value; returns a skip reason or undefined when applied. */
function write(slot: Slot, value: unknown, fork: unknown): string | undefined {
    const cur = currentValue(slot);
    if (value === REMOVE) {
        if (cur === undefined) return "already absent";
        if (slot.kind === "loot")
            slot.table.splice(
                slot.table.findIndex((x) => x.name === slot.name),
                1,
            );
        else if (Array.isArray(slot.holder)) slot.holder.splice(Number(slot.key), 1);
        else delete slot.holder[slot.key];
        return undefined;
    }
    if (deepEqual(cur, value)) return "already the original value";
    if (fork !== undefined && fork !== REMOVE && cur !== undefined && !deepEqual(cur, fork)) {
        return `current value ${JSON.stringify(cur)} matches neither forkValue nor originalValue`;
    }
    if (slot.kind === "prop") {
        slot.holder[slot.key] = clone(value);
        return undefined;
    }
    if (typeof value !== "number") return `loot ${slot.prop} must be a number, got ${JSON.stringify(value)}`;
    const entry = slot.table.find((x) => x.name === slot.name);
    if (entry) entry[slot.prop] = value;
    else slot.table.push({ name: slot.name, count: 1, weight: 1, [slot.prop]: value });
    return undefined;
}

function originalReason(kind: string, id: string, def: unknown, path: string[]): string {
    const value = path.reduce<any>((a, k) => (isPlainObject(a) || Array.isArray(a) ? (a as any)[k] : undefined), def);
    return value === undefined
        ? `${kind} ${id} comes from the original client, which has no ${path.join(".")} (not ported)`
        : `${kind} ${id} comes from the original client (${path.join(".")} = ${JSON.stringify(value)})`;
}

/** For map spawn reverts: the id a new value or a newly added spawn key names, when no source defines it. */
function unknownMapObject(slot: Slot, value: unknown, ctx: RevertContext): string | undefined {
    if (!ctx.knownMapObjects || value === REMOVE) return undefined;
    const ids = typeof value === "string" ? [value] : [];
    if (slot.kind === "prop" && !Array.isArray(slot.holder) && currentValue(slot) === undefined) ids.push(slot.key);
    return ids.find((id) => id !== "" && !ctx.knownMapObjects!.has(id));
}

type Root = [label: string, root: any, isMap: boolean, below: string[]];

function applyEntry(entry: RevertEntry, ctx: RevertContext): RevertLog {
    const skip = (reason: string): RevertLog => ({ status: "skipped", entry, reason });
    const section = String(entry.section ?? "").toLowerCase();
    if (!SERVER_SECTIONS.has(section)) return skip(`section "${entry.section}" is client data: original client wins`);
    const value = concreteValue(entry.originalValue);
    if (value === undefined) return skip("originalValue is not concrete");
    if (entry.field?.includes("/")) return skip("entry covers several fields");
    const target = tokens(entry.target);
    const field = tokens(entry.field);
    if (target.length === 0) return skip("empty target");
    const fork = concreteValue(entry.forkValue);
    // the field may be part of the target already ("bullet_an94.damage" + "damage") or only describe the target's
    // value ("fixedSpawns.cache_01f" + "count", "spawnReplacements.x" + "replacement", "randomSpawns" + "spawns")
    const fieldInTarget = field.length > 0 && field.every((f, i) => target[target.length - field.length + i] === f);
    const path = fieldInTarget ? target : [...target, ...field];
    const shapes = fieldInTarget || field.length === 0 ? [0] : [0, field.length];

    const [head, ...rest] = path;
    const listed = (Array.isArray(entry.maps) ? entry.maps : []).filter((m) => m in ctx.maps);
    let roots: Root[];
    let requireFork = false;
    if (head in ctx.maps) {
        const names = listed.length > 0 ? listed : [head];
        roots = names.map((m) => [`maps.${m}`, ctx.maps[m], true, rest]);
    } else if (/^(gameconfig|config)$/i.test(head)) {
        const key = rest.join(".");
        if ([...ctx.originalGameConfigPaths].some((p) => p === key || key.startsWith(`${p}.`))) {
            return skip("GameConfig key comes from the original client");
        }
        roots = [["gameConfig", ctx.gameConfig, false, rest]];
    } else if (head in ctx.gameObjects) {
        return skip(originalReason("game object", head, ctx.gameObjects[head], rest));
    } else if (head in ctx.mapObjects) {
        if (ctx.mapObjectStatus[head] !== "survev-only") {
            return skip(originalReason("map object", head, ctx.mapObjects[head], rest));
        }
        roots = [[`mapObjects.${head}`, ctx.mapObjects[head], false, rest]];
    } else {
        // no map named: the listed maps, else every map whose value at the path is still the fork value
        const names = listed.length > 0 ? listed : Object.keys(ctx.maps);
        roots = names.map((m) => [`maps.${m}`, ctx.maps[m], true, path]);
        requireFork = listed.length === 0;
    }
    const targets: string[] = [];
    const reasons = new Set<string>();
    const holdsFork = (slot: Slot) => {
        const cur = currentValue(slot);
        return fork !== undefined && (fork === REMOVE ? cur === undefined : deepEqual(cur, fork));
    };
    for (const [label, root, isMap, below] of roots) {
        // prefer the reading of target/field whose current value is the fork value, then one that exists
        const score = (x: Slot) => (holdsFork(x) ? 2 : currentValue(x) !== undefined ? 1 : 0);
        let slot: Slot | undefined;
        for (const drop of shapes) {
            const s = walkPath(root, drop ? below.slice(0, -drop) : below, label, isMap);
            if (s && (!slot || score(s) > score(slot))) slot = s;
        }
        if (!slot) continue;
        if (requireFork && !holdsFork(slot)) continue;
        const unknownId = section === "mapspawns" ? unknownMapObject(slot, value, ctx) : undefined;
        if (unknownId) {
            reasons.add(`${slot.path}: originalValue names ${unknownId}, a map object neither source defines`);
            continue;
        }
        const why = write(slot, value, fork);
        if (why) reasons.add(`${slot.path}: ${why}`);
        else targets.push(slot.path);
    }
    if (targets.length > 0) return { status: "applied", entry, reason: "reverted to originalValue", targets };
    if (reasons.size > 0) return skip([...reasons].join("; "));
    return skip("target not resolvable in the ported data");
}

export function applyBalanceRevert(entries: unknown, ctx: RevertContext): RevertLog[] {
    if (!Array.isArray(entries)) throw new Error("balance-revert.json must be an array");
    return entries.map((e) =>
        isPlainObject(e) && typeof e.target === "string"
            ? applyEntry(e as RevertEntry, ctx)
            : { status: "skipped" as const, entry: e as RevertEntry, reason: "malformed entry" },
    );
}
