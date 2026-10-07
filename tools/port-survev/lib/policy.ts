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
}

const stringList = (v: unknown, what: string): string[] => {
    if (!Array.isArray(v) || !v.every((x) => typeof x === "string"))
        throw new Error(`policy.json: ${what} must list strings`);
    return v;
};

/** Parses and checks a policy object (unknown keys other than `$comment` are errors, so typos never pass). */
export function parsePolicy(raw: unknown): PortPolicy {
    if (!isPlainObject(raw)) throw new Error("policy.json must be an object");
    const known = new Set(["$comment", "survevOnlyGameObjects", "survevSkins", "survevGameConfig"]);
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
    };
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
