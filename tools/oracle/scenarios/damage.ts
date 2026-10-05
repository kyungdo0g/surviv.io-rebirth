// damage.json: survev's Player.damage pipeline in isolation (headshot, perks, chest, helmet), called directly.
import type { Ctx, FixtureResult } from "../lib/context.ts";
import { Harness } from "../lib/harness.ts";
import { CENTERED, type HeadshotMode } from "../lib/rng.ts";

const AMOUNTS = [1, 10, 17.5, 24, 30, 50, 72, 100, 125];
const HELMETS = ["", "helmet01", "helmet02", "helmet03", "helmet04"];
const CHESTS = ["", "chest01", "chest02", "chest03", "chest04"];
const PERKS = ["none", "steelskin", "flak_jacket"];
/** gun used as the bullet source (its headshotMult applies to head hits) */
const BULLET_SOURCE = "ak47";
/** throwable used as the explosion source */
const EXPLOSION_SOURCE = "frag";
const CAP = 100000;

interface HitKind {
    name: "body" | "head" | "explosion" | "gas" | "bleeding";
    headshot: HeadshotMode;
    damageType: string;
    gameSourceType?: string;
    isExplosion?: boolean;
}

const HITS: HitKind[] = [
    { name: "body", headshot: "never", damageType: "Player", gameSourceType: BULLET_SOURCE },
    { name: "head", headshot: "always", damageType: "Player", gameSourceType: BULLET_SOURCE },
    {
        name: "explosion",
        headshot: "always",
        damageType: "Player",
        gameSourceType: EXPLOSION_SOURCE,
        isExplosion: true,
    },
];

const IGNORES_ARMOR: HitKind[] = [
    { name: "gas", headshot: "always", damageType: "Gas" },
    { name: "bleeding", headshot: "always", damageType: "Bleeding" },
];

export function damage(ctx: Ctx): FixtureResult {
    const { sv } = ctx;
    const h = new Harness(sv, { seed: 41 });
    h.setMode(CENTERED, "never");
    const target = h.addPlayer(h.center);
    const rows: unknown[][] = [];

    const apply = (hit: HitKind, amount: number): number => {
        h.setMode(CENTERED, hit.headshot);
        return h.withHealthCap(CAP, () => {
            target.health = CAP;
            target.damage({
                amount,
                damageType: sv.GameConfig.DamageType[hit.damageType],
                gameSourceType: hit.gameSourceType,
                isExplosion: hit.isExplosion,
                dir: sv.v2.create(1, 0),
            });
            const dealt = CAP - target.health;
            target.health = 100;
            return dealt;
        });
    };
    const level = (id: string) => (id ? ctx.defs[id].level : 0);
    const setPerk = (perk: string) => {
        for (const p of ["steelskin", "flak_jacket"]) if (target.hasPerk(p)) target.removePerk(p);
        if (perk !== "none") target.addPerk(perk);
    };

    for (const perk of PERKS) {
        setPerk(perk);
        for (const hit of [...HITS, ...IGNORES_ARMOR]) {
            const amounts = IGNORES_ARMOR.includes(hit) ? [10] : AMOUNTS;
            const helmets = IGNORES_ARMOR.includes(hit) ? ["", "helmet04"] : HELMETS;
            const chests = IGNORES_ARMOR.includes(hit) ? ["", "chest04"] : CHESTS;
            for (const amount of amounts) {
                for (const helmet of helmets) {
                    for (const chest of chests) {
                        h.setArmor(target, helmet, chest);
                        rows.push([amount, hit.name, level(helmet), level(chest), perk, apply(hit, amount)]);
                    }
                }
            }
        }
    }
    setPerk("none");

    const armor = (ids: string[]) =>
        Object.fromEntries(ids.filter(Boolean).map((id) => [ctx.defs[id].level, ctx.defs[id].damageReduction]));
    return {
        params: {
            call: "player.damage({ amount, damageType, gameSourceType, isExplosion, dir }) on a test player",
            healthCap: `GameConfig.player.health raised to ${CAP} during each call so no result is clamped`,
            bulletSource: { id: BULLET_SOURCE, headshotMult: ctx.defs[BULLET_SOURCE].headshotMult },
            explosionSource: { id: EXPLOSION_SOURCE, isExplosion: true },
            headshot: "body: headshotChance = 0; head: headshotChance = 1; explosions never roll headshots",
            helmetReduction: armor(HELMETS),
            chestReduction: armor(CHESTS),
            perkProperties: {
                steelskin: sv.PerkProperties.steelskin.damageReduction,
                flak_jacket: sv.PerkProperties.flak_jacket.damageReduction,
                flak_jacket_explosion: sv.PerkProperties.flak_jacket.explosionDamageReduction,
                note: "survev-only constants (PerkProperties in shared/defs/gameObjects/perkDefs.ts); not in our defs",
            },
        },
        data: {
            formula:
                "d = amount; head: d *= headshotMult; flak_jacket: d -= d * (explosion ? 0.9 : 0.1); " +
                "steelskin: d -= d * 0.45; chest (not head): d -= d * chest.damageReduction; " +
                "helmet: d -= d * helmet.damageReduction * (head ? 1 : 0.3); gas and bleeding skip all of it",
            columns: ["amount", "hit", "helmetLevel", "chestLevel", "perk", "damage"],
            rows,
        },
    };
}
