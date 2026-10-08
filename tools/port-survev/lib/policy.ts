// The port policy (tools/port-survev/policy.json): which survev-only content the port takes as survev has it
// (docs/adr/0003-survev-baseline.md). Everything not listed keeps the original-client policy of README.md.
import { readFileSync } from "node:fs";
import { isPlainObject } from "./util.ts";

export interface PortPolicy {
    /** survev-only game object ids ported unchanged, after every original id (in survev order) */
    survevOnlyGameObjects: string[];
    /** survev-only reskin id -> the original id it reskins: the base's original def + the skin's survev changes */
    survevSkins: Record<string, string>;
    /** GameConfig dot paths whose value comes from survev (arrays cut to the original's length) */
    survevGameConfig: string[];
    /**
     * Map generation as survev has it (survev content wave stage 3): no map-spawn balance reverts, no fork-reskin
     * revert, no map-generation parts of the event-map fixes (their loot parts stay until the loot stage)
     */
    survevMapGen: boolean;
    /** original map object ids whose survev def replaces the original (structure overrides: the Reserve's town) */
    survevMapObjects: string[];
    /**
     * survev-only map objects only survev's server code spawns (no map def names them), ported with what they reference:
     * the potato-faction gold drop airdrop_crate_04po (survev server/src/game/objects/plane.ts:273-278)
     */
    survevServerMapObjects: string[];
    /**
     * original map object id -> dot paths of image fields that take survev's value: the original names an image no
     * client ships and survev's same def names the art it draws (the snow air drops' opened image)
     */
    survevSpriteFixes: Record<string, string[]>;
    /**
     * survev balance (survev content wave stage 5, design option B): no balance revert and no event-map fixes; the
     * original game objects take survev's gameplay fields (lib/objects.ts SURVEV_GAMEPLAY_FIELDS), presentation stays
     */
    survevBalance: boolean;
}

const stringList = (v: unknown, what: string): string[] => {
    if (!Array.isArray(v) || !v.every((x) => typeof x === "string"))
        throw new Error(`policy.json: ${what} must list strings`);
    return v;
};

const spriteFixes = (v: unknown): Record<string, string[]> => {
    if (!isPlainObject(v)) throw new Error("policy.json: survevSpriteFixes must map ids to path lists");
    return Object.fromEntries(
        Object.entries(v).map(([id, paths]) => [id, stringList(paths, `survevSpriteFixes.${id}`)]),
    );
};

/** Parses and checks a policy object (unknown keys other than `$comment` are errors, so typos never pass). */
export function parsePolicy(raw: unknown): PortPolicy {
    if (!isPlainObject(raw)) throw new Error("policy.json must be an object");
    const known = new Set([
        "$comment",
        "survevOnlyGameObjects",
        "survevSkins",
        "survevGameConfig",
        "survevMapGen",
        "survevMapObjects",
        "survevServerMapObjects",
        "survevSpriteFixes",
        "survevBalance",
    ]);
    const unknown = Object.keys(raw).filter((k) => !known.has(k));
    if (unknown.length) throw new Error(`policy.json: unknown keys ${unknown.join(", ")}`);
    const skins = raw.survevSkins ?? {};
    if (!isPlainObject(skins) || !Object.values(skins).every((x) => typeof x === "string")) {
        throw new Error("policy.json: survevSkins must map skin ids to base ids");
    }
    const policy: PortPolicy = {
        survevOnlyGameObjects: stringList(raw.survevOnlyGameObjects ?? [], "survevOnlyGameObjects"),
        survevSkins: skins as Record<string, string>,
        survevGameConfig: stringList(raw.survevGameConfig ?? [], "survevGameConfig"),
        survevMapGen: raw.survevMapGen === true,
        survevMapObjects: stringList(raw.survevMapObjects ?? [], "survevMapObjects"),
        survevServerMapObjects: stringList(raw.survevServerMapObjects ?? [], "survevServerMapObjects"),
        survevSpriteFixes: spriteFixes(raw.survevSpriteFixes ?? {}),
        survevBalance: raw.survevBalance === true,
    };
    for (const key of ["survevMapGen", "survevBalance"] as const) {
        if (raw[key] !== undefined && typeof raw[key] !== "boolean") {
            throw new Error(`policy.json: ${key} must be a boolean`);
        }
    }
    const twice = policy.survevOnlyGameObjects.filter((id) => id in policy.survevSkins);
    if (twice.length) throw new Error(`policy.json: ${twice.join(", ")} listed both as survev-only and as skins`);
    return policy;
}

export function loadPolicy(file: string): PortPolicy {
    return parsePolicy(JSON.parse(readFileSync(file, "utf8")));
}

/** Every survev-only game object id the policy ports (plain and skins). */
export function portedSurvevIds(policy: PortPolicy): Set<string> {
    return new Set([...policy.survevOnlyGameObjects, ...Object.keys(policy.survevSkins)]);
}
