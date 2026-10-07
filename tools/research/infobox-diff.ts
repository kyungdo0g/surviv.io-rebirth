// Field-by-field comparison of fandom item infoboxes (datamined from the original client) against survev defs.
// Usage: node --experimental-transform-types tools/research/infobox-diff.ts
// Inputs: research-cache/fandom-infobox.json (tools/research/fandom-infobox.ts), .survev (pnpm survev:fetch)
// Outputs: docs/research/data/fandom-item-stats.json, docs/research/data/wiki-vs-survev.json,
//          docs/research/provenance/wiki-vs-survev.md
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Infobox } from "./fandom-infobox.ts";

const SURVEV = resolve(".survev");
const { RawGameObjectDefs: defs } = await import(`${SURVEV}/shared/defs/gameObjectDefs.ts`);
const { GameConfig } = await import(`${SURVEV}/shared/gameConfig.ts`);
const boxes: Infobox[] = JSON.parse(readFileSync("research-cache/fandom-infobox.json", "utf8"));
const balanceLines = readFileSync(`${SURVEV}/balance.txt`, "utf8").split("\n");

const DEF_FILES: Record<string, string> = {
    gun: "shared/defs/gameObjects/gunDefs.ts",
    bullet: "shared/defs/gameObjects/bulletDefs.ts",
    melee: "shared/defs/gameObjects/meleeDefs.ts",
    throwable: "shared/defs/gameObjects/throwableDefs.ts",
    explosion: "shared/defs/gameObjects/explosionsDefs.ts",
    helmet: "shared/defs/gameObjects/gearDefs.ts",
    chest: "shared/defs/gameObjects/gearDefs.ts",
    backpack: "shared/defs/gameObjects/gearDefs.ts",
    scope: "shared/defs/gameObjects/gearDefs.ts",
    heal: "shared/defs/gameObjects/gearDefs.ts",
    boost: "shared/defs/gameObjects/gearDefs.ts",
    ammo: "shared/defs/gameObjects/gearDefs.ts",
    perk: "shared/defs/gameObjects/perkDefs.ts",
    config: "shared/gameConfig.ts",
};

// original-client internal ids that survev renamed
const ID_ALIASES: Record<string, string> = {};

const COSMETIC =
    /img|image|sprite|tint|sound|title|lore|rarity|pickup|caption|aura|hand|shell|world|loot|border|trail|pose|anim|mirror|^rot$|scale|^end|flare|tracerColor|description|tont|^internal|^name$|^use$|^special$|hideUI|baseTint|darkTint|noTint|reflect|hip|caseTiming|burstSounds|inventoryOrder|explosionEffectType|decalType|^bulletID$|^bulletType$|^ammo$|^obstacle$|^camo$/i;

type Flat = Record<string, unknown>;
function flatten(obj: unknown, prefix = "", out: Flat = {}): Flat {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
    } else out[prefix] = obj;
    return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function matchId(box: Infobox, type: string): string | undefined {
    const id = String(box.params.internalID ?? box.params.internal ?? "").trim();
    if (id && ID_ALIASES[id]) return ID_ALIASES[id];
    if (id && defs[id]?.type === type) return id;
    const title = norm(String(box.params.title ?? box.page));
    const byName = Object.entries<any>(defs).filter(([, d]) => d.type === type && norm(d.name ?? "") === title);
    if (byName.length === 1) return byName[0][0];
    const byId = Object.entries<any>(defs).filter(([k, d]) => d.type === type && id && norm(k) === norm(id));
    if (byId.length === 1) return byId[0][0];
    return undefined;
}

// wiki param -> [source def kind, dotted path] resolvers per infobox kind
type Resolver = (key: string, id: string, def: any) => { kind: string; ref: string; value: unknown } | undefined;

function bag(item: string, level: number) {
    const sizes = (GameConfig.bagSizes as Record<string, number[]>)[item];
    return sizes ? { kind: "config", ref: `bagSizes.${item}[${level}]`, value: sizes[level] } : undefined;
}

const defPath = (kind: string, id: string, def: any, path: string) => ({
    kind,
    ref: `${id}.${path}`,
    value: flatten(def)[path],
});

const sameName: Resolver = (key, id, def) => {
    const flat = flatten(def);
    if (key in flat) return { kind: def.type, ref: `${id}.${key}`, value: flat[key] };
    const tail = Object.keys(flat).filter((p) => p.split(".").pop() === key);
    if (tail.length === 1) return { kind: def.type, ref: `${id}.${tail[0]}`, value: flat[tail[0]] };
    // field absent in survev: compare against the wiki value as "not set"
    return { kind: def.type, ref: `${id}.${key}`, value: undefined };
};

const GUN_MAP: Record<string, string> = {
    headshotMLT: "headshotMult",
    equipSpeed: "speed.equip",
    attackSpeed: "speed.attack",
    recoil: "worldImg.recoil",
};
const BULLET_MAP: Record<string, string> = {
    dmg: "damage",
    obsDmg: "obstacleDamage",
    falloff: "falloff",
    range: "distance",
    speed: "speed",
    variance: "variance",
    shrapnel: "shrapnel",
    suppressed: "suppressed",
    tracerWidth: "tracerWidth",
    tracerLength: "tracerLength",
    skipCollision: "skipCollision",
};
const MELEE_MAP: Record<string, string> = {
    offsetX: "attack.offset.x",
    offsetY: "attack.offset.y",
    rad: "attack.rad",
    damageTimes: "attack.damageTimes",
    cooldownTime: "attack.cooldownTime",
    equipSpeed: "speed.equip",
    attackSpeed: "speed.attack",
};

const RESOLVERS: Record<string, { type: string; resolve: Resolver }> = {
    Gun: {
        type: "gun",
        resolve: (key, id, def) => {
            if (key in BULLET_MAP && def.bulletType && defs[def.bulletType]) {
                return defPath("bullet", def.bulletType, defs[def.bulletType], BULLET_MAP[key]);
            }
            if (key in GUN_MAP) return defPath("gun", id, def, GUN_MAP[key]);
            if (
                /^(proj|shrapnel|throwable)|^(damage|obstacleDamage|teamDamage|radMin|radMax|shrapnelCount|shrapnelType)$/.test(
                    key,
                )
            )
                return undefined;
            return sameName(key, id, def);
        },
    },
    Melee: {
        type: "melee",
        resolve: (key, id, def) =>
            key in MELEE_MAP ? defPath("melee", id, def, MELEE_MAP[key]) : sameName(key, id, def),
    },
    Throwable: {
        type: "throwable",
        resolve: (key, id, def) => {
            const lv = key.match(/^lv([0-4])$/);
            if (lv) return bag(id, Number(lv[1]));
            if (key.startsWith("throwPhysics")) {
                const sub = key.slice("throwPhysics".length);
                return defPath("throwable", id, def, `throwPhysics.${sub[0].toLowerCase()}${sub.slice(1)}`);
            }
            if (key === "speedEquip") return defPath("throwable", id, def, "speed.equip");
            if (key === "speedAttack") return defPath("throwable", id, def, "speed.attack");
            if (/^shrapnel/.test(key)) return undefined;
            const ex = key.match(/^explosion(.+)$/);
            if (ex && def.explosionType && defs[def.explosionType]) {
                const field = ex[1][0].toLowerCase() + ex[1].slice(1);
                const path = field === "radMin" ? "rad.min" : field === "radMax" ? "rad.max" : field;
                return defPath("explosion", def.explosionType, defs[def.explosionType], path);
            }
            return sameName(key, id, def);
        },
    },
    Helmet: {
        type: "helmet",
        resolve: (key, id, def) =>
            key === "defence" ? defPath("helmet", id, def, "damageReduction") : sameName(key, id, def),
    },
    Chest: {
        type: "chest",
        resolve: (key, id, def) =>
            key === "defence" ? defPath("chest", id, def, "damageReduction") : sameName(key, id, def),
    },
    Scope: {
        type: "scope",
        resolve: (key, id, def) => {
            const zr = GameConfig.scopeZoomRadius as Record<string, Record<string, number>>;
            if (key === "desktop" || key === "mobile") {
                return { kind: "config", ref: `scopeZoomRadius.${key}.${id}`, value: zr[key]?.[id] };
            }
            const lv = key.match(/^lv([0-4])$/);
            if (lv) return bag(id, Number(lv[1]));
            return sameName(key, id, def);
        },
    },
    Heal: {
        type: "heal",
        resolve: (key, id, def) => {
            const lv = key.match(/^lv([0-4])$/);
            return lv ? bag(id, Number(lv[1])) : sameName(key, id, def);
        },
    },
    Boost: {
        type: "boost",
        resolve: (key, id, def) => {
            const lv = key.match(/^lv([0-4])$/);
            return lv ? bag(id, Number(lv[1])) : sameName(key, id, def);
        },
    },
    Ammo: {
        type: "ammo",
        resolve: (key, id, def) => {
            const lv = key.match(/^lv([0-4])$/);
            return lv ? bag(id, Number(lv[1])) : sameName(key, id, def);
        },
    },
    Backpack: {
        type: "backpack",
        resolve: (key, id, def) => {
            if (key === "level") return defPath("backpack", id, def, "level");
            const level = def.level as number;
            return key in (GameConfig.bagSizes as object) ? bag(key, level) : sameName(key, id, def);
        },
    },
};

function parseWikiValue(v: unknown): unknown {
    if (typeof v !== "string") return v;
    const pct = v.match(/^(-?\d+(?:\.\d+)?)\s*%$/);
    if (pct) return Number(pct[1]) / 100;
    const list = v.split(/\s*,\s*/);
    if (list.length > 1 && list.every((x) => /^-?(\d+\.?\d*|\.\d+)$/.test(x))) return list.map(Number);
    return v;
}

function equal(wiki: unknown, survev: unknown): boolean {
    const w = parseWikiValue(wiki);
    if (
        (w === null || w === false || w === "None" || w === "") &&
        (survev === undefined || survev === false || survev === null || survev === "" || survev === 0)
    )
        return true;
    if (Array.isArray(survev) && survev.length === 1 && typeof w === "number") return Math.abs(survev[0] - w) < 1e-9;
    if (Array.isArray(survev) && Array.isArray(w))
        return survev.length === w.length && survev.every((x, i) => Math.abs(x - (w[i] as number)) < 1e-9);
    if (typeof w === "number" && typeof survev === "number") return Math.abs(w - survev) < 1e-9;
    if (typeof w === "number" && typeof survev === "boolean") return (w !== 0) === survev;
    if (typeof w === "boolean" && survev === undefined) return w === false;
    return String(w).toLowerCase() === String(survev).toLowerCase();
}

function balanceRefs(ids: string[]): number[] {
    const out: number[] = [];
    balanceLines.forEach((line, i) => {
        if (ids.some((id) => id && line.toLowerCase().includes(id.toLowerCase()))) out.push(i + 1);
    });
    return out;
}

interface Diff {
    kind: string;
    id: string;
    page: string;
    pageTimestamp: string;
    field: string;
    survevRef: string;
    survevFile: string;
    wiki: unknown;
    survev: unknown;
    gameplay: boolean;
    balanceLines: number[];
}

const diffs: Diff[] = [];
const unmatched: { kind: string; page: string; internal: unknown }[] = [];
const unresolved: Record<string, Set<string>> = {};
const stats: Record<string, { items: number; compared: number; equal: number; different: number }> = {};

for (const box of boxes) {
    const r = RESOLVERS[box.kind];
    if (!r) continue;
    const id = matchId(box, r.type);
    const st = (stats[box.kind] ??= { items: 0, compared: 0, equal: 0, different: 0 });
    if (!id) {
        unmatched.push({ kind: box.kind, page: box.page, internal: box.params.internalID ?? box.params.internal });
        continue;
    }
    st.items++;
    const def = defs[id];
    for (const [key, wiki] of Object.entries(box.params)) {
        if (wiki === null) continue;
        const res = r.resolve(key, id, def);
        if (!res) {
            (unresolved[box.kind] ??= new Set()).add(key);
            continue;
        }
        st.compared++;
        if (equal(wiki, res.value)) {
            st.equal++;
            continue;
        }
        st.different++;
        const ids = [id, def.bulletType, def.explosionType].filter(Boolean) as string[];
        diffs.push({
            kind: box.kind,
            id,
            page: box.page,
            pageTimestamp: box.timestamp,
            field: key,
            survevRef: res.ref,
            survevFile: DEF_FILES[res.kind] ?? "shared/defs/gameObjectDefs.ts",
            wiki: parseWikiValue(wiki),
            survev: res.value,
            gameplay: !COSMETIC.test(key),
            balanceLines: balanceRefs(ids),
        });
    }
}

mkdirSync("docs/research/data", { recursive: true });
writeFileSync(
    "docs/research/data/fandom-item-stats.json",
    JSON.stringify(
        {
            source: "survivio.fandom.com {{Item/*}} infobox templates (CC BY-SA 3.0), dumped via api.php",
            items: boxes.map((b) => ({
                kind: b.kind,
                page: b.page,
                revid: b.revid,
                timestamp: b.timestamp,
                params: b.params,
            })),
        },
        null,
        1,
    ),
);
writeFileSync(
    "docs/research/data/wiki-vs-survev.json",
    JSON.stringify(
        {
            stats,
            unmatched,
            unresolved: Object.fromEntries(Object.entries(unresolved).map(([k, v]) => [k, [...v]])),
            diffs,
        },
        null,
        1,
    ),
);

const fmt = (v: unknown) => (v === undefined ? "—" : JSON.stringify(v)).replace(/\|/g, "\\|");
const page = (p: string) => p.replace(/ /g, "_");
const md: string[] = [
    "# Fandom infobox stats vs survev defs",
    "",
    "> Generated by `node --experimental-transform-types tools/research/infobox-diff.ts`. Do not edit by hand.",
    "> The fandom `{{Item/*}}` infoboxes hold values datamined from the original client at the time of the page's last edit; survev values are at commit c6185e31.",
    "> A difference means one of: survev changed the value (check the balance.txt column), the wiki page reflects another era, or the wiki is wrong. Every gameplay row is a candidate for `conflicts.md`.",
    "",
    "## Coverage",
    "",
    "| Infobox | Items matched | Fields compared | Equal | Different |",
    "|---|---|---|---|---|",
];
for (const [k, s] of Object.entries(stats)) {
    md.push(`| ${k} | ${s.items} | ${s.compared} | ${s.equal} | ${s.different} [src:derived/infobox-diff] [H] |`);
}
md.push("");
for (const kind of Object.keys(stats)) {
    const rows = diffs.filter((d) => d.kind === kind && d.gameplay);
    if (!rows.length) continue;
    md.push(
        `## ${kind}: gameplay differences`,
        "",
        "| survev id | field (survev path) | survev | fandom | balance.txt lines | sources |",
        "|---|---|---|---|---|---|",
    );
    for (const d of rows) {
        const bal = d.balanceLines.length
            ? d.balanceLines
                  .slice(0, 6)
                  .map((l) => `[src:balance/${l}]`)
                  .join(" ")
            : "none";
        md.push(
            `| ${d.id} | ${d.field} (${d.survevRef}) | ${fmt(d.survev)} | ${fmt(d.wiki)} (page ${d.pageTimestamp.slice(0, 10)}) | ${bal} | [src:survev/${d.survevFile}] [src:fandom/${page(d.page)}] [L] |`,
        );
    }
    md.push("");
}
md.push("## Unmatched infoboxes", "");
if (!unmatched.length) md.push("- none [src:derived/infobox-diff] [H]");
for (const u of unmatched)
    md.push(
        `- ${u.kind} infobox on page "${u.page}" (internal id ${fmt(u.internal)}) has no survev def [src:fandom/${page(u.page)}] [M]`,
    );
md.push(
    "",
    "## Conflicts",
    "",
    "- see the gameplay difference tables above; each row is a conflict candidate [src:derived/infobox-diff] [L]",
    "",
    "## Open questions",
    "",
    "- which era each fandom infobox reflects (page timestamps are last-edit dates, not data dates) [src:derived/infobox-diff] [L]",
    "",
);
writeFileSync("docs/research/provenance/wiki-vs-survev.md", md.join("\n"));

console.log(JSON.stringify(stats));
console.log(`unmatched: ${unmatched.length}`, unmatched.map((u) => `${u.kind}:${u.page}(${u.internal})`).join(", "));
console.log(
    `gameplay diffs: ${diffs.filter((d) => d.gameplay).length}, cosmetic diffs: ${diffs.filter((d) => !d.gameplay).length}`,
);
for (const [k, v] of Object.entries(unresolved))
    console.log(`unresolved ${k}: ${[...v].filter((x) => !COSMETIC.test(x)).join(" ")}`);
