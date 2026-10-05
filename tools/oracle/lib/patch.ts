// Makes survev run with OUR data: every game object id present in packages/defs gameObjects.json replaces
// survev's definition in place (deep replace, so survev's GunDefs/BulletDefs/... exports and the
// GameObjectDefs registry, which all share the same objects, see our values). survev-only ids are left alone.
//
// Exceptions (documented in the README):
// - KEEP_SURVEV_ONLY_FIELDS: server-only fields the original client never shipped but survev's logic reads.
//   They are re-added after the replace when our def lacks them.
// - ids we have and survev lacks (bonus bullets, bullet_potato, bullet_bugle, ...) are added to the registry
//   (and given a network id, so `game.netSync()` can serialize them).
//
// GameConfig: for the gameplay sections, every key present in both survev's GameConfig and our gameConfig.json
// takes our value (arrays replaced whole). Keys only we have (e.g. gas.stages, which survev keeps as a private
// const in server/src/game/objects/gas.ts) are reported, not applied.
import { readFileSync } from "node:fs";
import { GAME_CONFIG_JSON, GAME_OBJECTS_JSON } from "./paths.ts";
import type { Survev } from "./survev.ts";

export const KEEP_SURVEV_ONLY_FIELDS: Readonly<Record<string, readonly string[]>> = {
    // bullet.ts: shotgun pellets skip the +-1 m distance jitter (`noDistAdj`); explosive-rounds sound variant
    bullet: ["noDistAdj", "useExplosiveRoundsAlt"],
};

const GAMEPLAY_TYPES = new Set([
    "gun",
    "bullet",
    "melee",
    "throwable",
    "explosion",
    "helmet",
    "chest",
    "heal",
    "boost",
]);
const GAME_CONFIG_SECTIONS = [
    "player",
    "bullet",
    "projectile",
    "gas",
    "bagSizes",
    "lootRadius",
    "scopeZoomRadius",
    "airdrop",
    "airstrike",
    "map",
    "structureLayerCount",
] as const;

export interface ValueChange {
    id: string;
    path: string;
    /** changed: both define it; survevOnly: survev's field was dropped; oursOnly: our field was added */
    kind: "changed" | "survevOnly" | "oursOnly";
    survev: unknown;
    ours: unknown;
}

function changeKind(survev: unknown, ours: unknown): ValueChange["kind"] {
    if (ours === undefined) return "survevOnly";
    return survev === undefined ? "oursOnly" : "changed";
}

export interface PatchReport {
    replacedIds: number;
    idsWithChangedValues: number;
    addedIds: string[];
    keptSurvevOnly: Array<{ id: string; field: string; value: unknown }>;
    gameplayChanges: ValueChange[];
    gameConfigChanges: ValueChange[];
    gameConfigNotApplied: string[];
    verification: Array<{ check: string; expected: unknown; actual: unknown; ok: boolean }>;
}

export function readOurGameObjects(): Record<string, any> {
    return JSON.parse(readFileSync(GAME_OBJECTS_JSON, "utf8"));
}

export function readOurGameConfig(): Record<string, any> {
    return JSON.parse(readFileSync(GAME_CONFIG_JSON, "utf8"));
}

function isObject(v: unknown): v is Record<string, any> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

function leafDiffs(a: unknown, b: unknown, path: string, out: Array<{ path: string; a: unknown; b: unknown }>): void {
    if (isObject(a) && isObject(b)) {
        for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
            leafDiffs(a[k], b[k], path ? `${path}.${k}` : k, out);
        }
        return;
    }
    const norm = (v: unknown) => (typeof v === "function" ? "[function]" : JSON.stringify(v));
    if (norm(a) !== norm(b)) out.push({ path, a: typeof a === "function" ? "[function]" : a, b });
}

function replaceInPlace(target: Record<string, any>, source: Record<string, any>): void {
    for (const k of Object.keys(target)) delete target[k];
    Object.assign(target, structuredClone(source));
}

export function patchSurvev(sv: Survev): PatchReport {
    const ours = readOurGameObjects();
    const raw = sv.RawGameObjectDefs;
    const report: PatchReport = {
        replacedIds: 0,
        idsWithChangedValues: 0,
        addedIds: [],
        keptSurvevOnly: [],
        gameplayChanges: [],
        gameConfigChanges: [],
        gameConfigNotApplied: [],
        verification: [],
    };

    for (const [id, def] of Object.entries(ours)) {
        const target = raw[id];
        if (!target) {
            raw[id] = structuredClone(def);
            sv.GameObjectDefs.addType(id);
            report.addedIds.push(id);
            continue;
        }
        const diffs: Array<{ path: string; a: unknown; b: unknown }> = [];
        leafDiffs(target, def, "", diffs);
        const keep = KEEP_SURVEV_ONLY_FIELDS[def.type] ?? [];
        const kept = keep.filter((f) => target[f] !== undefined && def[f] === undefined).map((f) => [f, target[f]]);
        replaceInPlace(target, def);
        for (const [field, value] of kept) {
            target[field] = value;
            report.keptSurvevOnly.push({ id, field, value });
        }
        report.replacedIds++;
        const valueDiffs = diffs.filter((d) => !kept.some(([f]) => d.path === f || d.path.startsWith(`${f}.`)));
        if (valueDiffs.length) report.idsWithChangedValues++;
        if (GAMEPLAY_TYPES.has(def.type)) {
            for (const d of valueDiffs) {
                report.gameplayChanges.push({ id, path: d.path, kind: changeKind(d.a, d.b), survev: d.a, ours: d.b });
            }
        }
    }

    patchGameConfig(sv, readOurGameConfig(), report);
    verify(sv, ours, report);
    return report;
}

function patchGameConfig(sv: Survev, ours: Record<string, any>, report: PatchReport): void {
    const walk = (target: Record<string, any>, source: Record<string, any>, path: string) => {
        for (const [k, v] of Object.entries(source)) {
            const p = `${path}.${k}`;
            if (!(k in target)) {
                report.gameConfigNotApplied.push(p);
                continue;
            }
            if (isObject(v) && isObject(target[k])) {
                walk(target[k], v, p);
            } else if (JSON.stringify(target[k]) !== JSON.stringify(v)) {
                report.gameConfigChanges.push({
                    id: "GameConfig",
                    path: p,
                    kind: "changed",
                    survev: target[k],
                    ours: v,
                });
                target[k] = structuredClone(v);
            }
        }
    };
    for (const section of GAME_CONFIG_SECTIONS) {
        const target = sv.GameConfig[section];
        const source = ours[section];
        if (source === undefined) continue;
        if (isObject(target) && isObject(source)) walk(target, source, section);
        else if (JSON.stringify(target) !== JSON.stringify(source)) {
            report.gameConfigChanges.push({
                id: "GameConfig",
                path: section,
                kind: "changed",
                survev: target,
                ours: source,
            });
            sv.GameConfig[section] = structuredClone(source);
        }
    }
}

function verify(sv: Survev, ours: Record<string, any>, report: PatchReport): void {
    const check = (name: string, expected: unknown, actual: unknown) =>
        report.verification.push({
            check: name,
            expected,
            actual,
            ok: JSON.stringify(expected) === JSON.stringify(actual),
        });
    check(
        "GameObjectDefs.typeToDef('bullet_an94', 'bullet').damage",
        ours.bullet_an94.damage,
        sv.GameObjectDefs.typeToDef("bullet_an94", "bullet").damage,
    );
    check("BulletDefs.bullet_an94.damage", ours.bullet_an94.damage, sv.BulletDefs.bullet_an94.damage);
    check(
        "GameObjectDefs.typeToDef('mosin', 'gun').headshotMult",
        ours.mosin.headshotMult,
        sv.GameObjectDefs.typeToDef("mosin", "gun").headshotMult,
    );
    check("GunDefs.mosin.headshotMult", ours.mosin.headshotMult, sv.GunDefs.mosin.headshotMult);
    let mismatched = 0;
    for (const [id, def] of Object.entries(ours)) {
        const live = { ...sv.GameObjectDefs.typeToDef(id) };
        for (const f of KEEP_SURVEV_ONLY_FIELDS[def.type] ?? []) if (def[f] === undefined) delete live[f];
        if (JSON.stringify(live) !== JSON.stringify(def)) mismatched++;
    }
    check("ids whose survev def differs from ours after the patch", 0, mismatched);
    const failed = report.verification.filter((v) => !v.ok);
    if (failed.length) throw new Error(`defs patch verification failed: ${JSON.stringify(failed)}`);
}

/** Compact summary for fixture metadata (the full lists live in fixtures/patch.json). */
export function patchSummary(report: PatchReport) {
    return {
        replacedIds: report.replacedIds,
        idsWithChangedValues: report.idsWithChangedValues,
        gameplayValueChanges: report.gameplayChanges.length,
        addedIds: report.addedIds,
        keptSurvevOnlyFields: Object.fromEntries(
            Object.entries(KEEP_SURVEV_ONLY_FIELDS).map(([type, fields]) => [type, fields]),
        ),
        gameConfigChanges: report.gameConfigChanges.map((c) => c.path),
        verification: report.verification.map((v) => ({ check: v.check, actual: v.actual, ok: v.ok })),
    };
}
