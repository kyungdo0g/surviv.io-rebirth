// Gun tier rebuild, step 1 (docs/design/gun-tiers.md): pulls every gun's final stats from @rebirth/defs (rebirth layer
// applied), derives DPS / TTK / forgiveness / mobility and the raw score components, against the pre-rebuild tier list
// (baseline.json). Writes research-cache/gun-tiers/metrics.json for score.ts and report.ts.
// usage (repo root): node tools/research/gun-tiers/compute.ts  [env OUT=file, SIGMAS=1.6,3.5,5.4, AIM_TAU=inf, DODGE=0]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getDef, getDefOfType, gunClass, hasDef, idsOfType } from "../../../packages/defs/src/index.ts";
import {
    type ArmorLevel,
    type BulletDefLike,
    fullReloadTime,
    type GunDefLike,
    magazineDumpTime,
    shotInterval,
} from "./calc.ts";
import { type KillResult, killTime, type ModelGun, shotOutcomes } from "./model.ts";

type Any = any;
const OUT_DIR = resolve("research-cache/gun-tiers");
/** the tier list before the rebuild (gunTiers.ts at edd3d24): the cut shape and the "current" column */
const BASELINE = process.env.BASELINE ?? new URL("baseline.json", import.meta.url).pathname;

// ---------------------------------------------------------------------------------------------------------------
// Model constants (see docs/design/gun-tiers.md "Method")

/**
 * aim error (deg): expert, average, beginner. bot-population.md critique B used 1.6 / 5.4 (skill.ts SKILL_SIGMA band
 * midpoints s 0.825 / 0.5 / 0.15 give 1.8 / 3.2 / 6.2: SIGMAS=1.8,3.2,6.2 for the sensitivity run)
 */
const SIGMAS = (process.env.SIGMAS ?? "1.6,3.5,5.4").split(",").map(Number);
const SKILLS = ["expert", "average", "beginner"] as const;
type Skill = (typeof SKILLS)[number];
const SIGMA: Record<Skill, number> = { expert: SIGMAS[0], average: SIGMAS[1], beginner: SIGMAS[2] };
/** armour: none, level 1 (helmet01 + chest01), level 2 (helmet02 + chest02); defs damageReduction */
const ARMOR: ArmorLevel[] = [0, 1, 2].map((l) => ({
    helmet: l ? (getDef(`helmet0${l}`) as Any).damageReduction : 0,
    chest: l ? (getDef(`chest0${l}`) as Any).damageReduction : 0,
}));
/** how often a fight is against each armour level (mid-game mix) */
const ARMOR_MIX = [0.25, 0.45, 0.3];
/** seconds before the first shot: bot-population.md reaction floors 0.18 / 0.25 / 0.35 s plus ~0.08 s on target */
const ENGAGE: Record<Skill, number> = { expert: 0.25, average: 0.35, beginner: 0.45 };
/** share of shots fired while the shooter moves (critique B: "moving half the time") */
const MOVING = 0.5;
/** class fighting distances (task / critique B); launchers and the potato cannon: 15-40 u (past self-damage) */
const BAND: Record<string, [number, number]> = {
    shotgun: [5, 10],
    smg: [5, 20],
    pistol: [5, 20],
    rifle: [10, 35],
    lmg: [10, 35],
    dmr: [20, 50],
    sniper: [20, 50],
    launcher: [15, 40],
};
/** every gun at the same distances, weighted by how often fights happen there (range versatility) */
const UNIVERSAL: Array<[number, number]> = [
    [5, 0.12],
    [10, 0.2],
    [20, 0.25],
    [35, 0.2],
    [50, 0.13],
    [80, 0.1],
];
/**
 * ammo availability on the main map: 1 with a tier_ammo box row, 0.85 without one (crate-only or none), 0.7 for
 * rockets (only the 4 that come with the RPG-7); ammo.ts prints the table
 */
const AMMO_FACTOR: Record<string, number> = {
    "9mm": 1,
    "762mm": 1,
    "556mm": 1,
    "12gauge": 1,
    "45acp": 0.85,
    "50AE": 0.85,
    "308sub": 0.85,
    "57mm": 0.85,
    "40mm": 0.85,
    rocket: 0.7,
    potato_ammo: 1,
};
/**
 * deliberate aim: a shooter re-aims between shots, so the aim error of a shot shrinks with the time since the last
 * one: sigma x sqrt((tau + 0.1) / (tau + cycle)), 1 at an assault rifle's 0.1 s (SKILL_SIGMA was fitted mostly on
 * 0.1-0.2 s guns), clamped to 0.5 .. 1.1. AIM_TAU=inf turns it off (the critique's fixed sigma).
 */
const AIM_TAU = Number(process.env.AIM_TAU ?? 0.5);
export function aimK(cycle: number): number {
    if (!Number.isFinite(AIM_TAU)) return 1;
    return Math.min(1.1, Math.max(0.5, Math.sqrt((AIM_TAU + 0.1) / (AIM_TAU + cycle))));
}

// ---------------------------------------------------------------------------------------------------------------
// Gun set and classes

const SKIP = new Set(["flare_gun", "flare_gun_dual", "bugle", "m9_cursed"]);
const ids: string[] = idsOfType("gun").filter((id: string) => !SKIP.has(id));

/** bot class (gunTiers.ts kbClass) except that launchers and the potato guns keep a class of their own here */
function botClass(id: string): string {
    if (id === "potato_lmg") return "lmg";
    if (id === "potato_smg") return "smg";
    if (id === "potato_cannon") return "launcher";
    const c = gunClass(id);
    return c === "assault" ? "rifle" : (c ?? "special");
}

function band(id: string): number[] {
    const [lo, hi] = BAND[botClass(id)];
    return [0, 1, 2, 3].map((i) => Math.round((lo + ((hi - lo) * i) / 3) * 100) / 100);
}

const GRAVITY = 10.5;
function projectileRange(proj: Any): number {
    const vz = proj.throwPhysics?.velZ ?? 0;
    const speed = proj.throwPhysics?.speed ?? 0;
    const tLand = (vz + Math.sqrt(vz * vz + 2 * GRAVITY * 0.5)) / GRAVITY;
    return speed * Math.min(tLand, proj.fuseTime ?? Number.POSITIVE_INFINITY);
}

/** P(shrapnel range >= x) (sim bullets.ts distAdj, explosions.ts variance) */
function shrapRange(sh: Any, x: number): number {
    let p = 0;
    for (let i = 0; i <= 16; i++) {
        const adj = -1 + i / 8;
        const need = ((x - adj) / sh.distance - 1) / (sh.variance ?? 0);
        p += 1 - Math.min(1, Math.max(0, need));
    }
    return p / 17;
}
const shrapAt = (sh: Any, r: number) =>
    r <= 1 ? shrapRange(sh, 0) : (Math.asin(1 / r) / Math.PI) * shrapRange(sh, r - 1);

/**
 * shrapnel hit chance of a direct hit: bullets stop on the body and explode 0.1 behind (sim combat/bullets.ts
 * explodeOnHit); lob projectiles explode when their centre is within 1 + rad / 4 (combat/projectiles.ts)
 */
function shrapnelP(sh: Any, projRad?: number, speed = 0): number {
    let s = 0;
    let n = 0;
    for (let i = 0; i < 40; i++) {
        if (projRad === undefined) {
            const b = (i + 0.5) / 40;
            s += shrapAt(sh, Math.hypot(Math.sqrt(1 - b * b) + 0.1, b));
            n++;
        } else {
            const R = 1 + projRad / 4;
            const b = ((i + 0.5) / 40) * R;
            const x0 = Math.sqrt(R * R - b * b);
            for (let j = 0; j < 10; j++) {
                const x = Math.max(-x0, x0 - ((j + 0.5) / 10) * speed * 0.01);
                s += shrapAt(sh, Math.hypot(x, b));
                n++;
            }
        }
    }
    return s / n;
}

type BulletDef = BulletDefLike & { obstacleDamage?: number; onHit?: string; armDistance?: number };

function modelGun(id: string): ModelGun {
    const g = getDefOfType("gun", id) as Any;
    const gun: GunDefLike = { ...g, charges: g.charges };
    let bullet: BulletDef = hasDef(g.bulletType)
        ? { ...(getDef(g.bulletType) as Any) }
        : { damage: 0, obstacleDamage: 1, falloff: 1, distance: 0, speed: 1 };
    let speed = bullet.speed;
    let hitRadius = 1;
    let explosive: ModelGun["explosive"];
    const explosion = (eid?: string, projRad?: number, spd = 0): ModelGun["explosive"] => {
        if (!eid || !hasDef(eid)) return undefined;
        const e = getDef(eid) as Any;
        const sh = e.shrapnelCount && hasDef(e.shrapnelType) ? (getDef(e.shrapnelType) as Any) : undefined;
        return {
            damage: e.damage,
            shrapnelCount: sh ? e.shrapnelCount : 0,
            shrapnelDamage: sh ? sh.damage : 0,
            shrapnelP: sh ? shrapnelP(sh, projRad, spd) : 0,
            rad: e.rad,
            shrapnelDistance: sh?.distance ?? 0,
            shrapnelVariance: sh?.variance ?? 0,
            armDistance: projRad === undefined ? (bullet.armDistance ?? 0) : 0,
            cursor: projRad === undefined && !!g.toMouseHit,
        };
    };
    if (g.projType && hasDef(g.projType)) {
        const proj = getDef(g.projType) as Any;
        speed = proj.throwPhysics?.speed ?? speed;
        hitRadius = 1 + (proj.rad ?? 0) / 4;
        explosive = explosion(proj.explosionType, proj.rad ?? 0, speed);
        bullet = { damage: 0, obstacleDamage: 1, falloff: 1, distance: projectileRange(proj), speed, noDistAdj: true };
    } else if (bullet.onHit) {
        explosive = explosion(bullet.onHit);
    }
    const canHeadshot = g.headshotMult > 1 && bullet.damage > 0;
    const fsa = g.recoilTime < 1e9 && g.fireMode !== "burst";
    return { gun, bullet, speed, hitRadius, explosive, canHeadshot, fsa };
}

// ---------------------------------------------------------------------------------------------------------------
// Metrics

interface Ttk3 {
    a0: number;
    a1: number;
    a2: number;
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** E[TTK] at a distance for a skill (sigma) and armour; the better of spam and paced fire for FSA guns */
function ttkAt(
    mg: ModelGun,
    d: number,
    sigma: number,
    arm: ArmorLevel,
    perfect = false,
    deliberate = true,
): KillResult {
    const k = (cycle: number) => (deliberate ? aimK(cycle) : 1);
    const cycle = shotInterval(mg.gun);
    const c = { d, aimSigma: sigma * k(cycle), armor: arm, movingShare: perfect ? 0 : MOVING, paced: false };
    const pg = perfect ? { ...mg, gun: { ...mg.gun, shotSpread: 0, moveSpread: 0 }, speed: 1e9 } : mg;
    const spam = killTime(pg, c);
    if (!mg.fsa || perfect) return spam;
    const pacedCycle = Math.max(mg.gun.fireDelay, mg.gun.recoilTime ?? 0);
    const paced = killTime(pg, { ...c, aimSigma: sigma * k(pacedCycle), paced: true });
    return paced.ttk < spam.ttk ? paced : spam;
}

/** expected damage of the opening shot (standing, first-shot accuracy if the gun has it) at d against level 1 */
function alphaAt(mg: ModelGun, d: number, sigma: number): number {
    const cycle = mg.fsa ? Math.max(mg.gun.fireDelay, mg.gun.recoilTime ?? 0) : shotInterval(mg.gun);
    const o = shotOutcomes(mg, { d, aimSigma: sigma * aimK(cycle), armor: ARMOR[1], movingShare: 0, paced: mg.fsa });
    let e = 0;
    for (const [k, p] of o) e += (k / 1e4) * p;
    return e;
}

const cache = new Map<string, KillResult>();
const BACKUP = "ak47";
let BACKUP_MG: ModelGun;
function ttkC(
    id: string,
    mg: ModelGun,
    d: number,
    sigma: number,
    lvl: number,
    perfect = false,
    deliberate = true,
): KillResult {
    const k = `${id}|${d}|${sigma}|${lvl}|${perfect}|${deliberate}`;
    let r = cache.get(k);
    if (!r) {
        r = ttkAt(mg, d, sigma, ARMOR[lvl], perfect, deliberate);
        if (mg.gun.charges) {
            // a single-use gun that fails to kill leaves the fight to the backup gun: a typical one, the AK-47, after
            // the last charge and a 0.75 s switch
            const b = ttkC(BACKUP, BACKUP_MG, d, sigma, lvl, perfect, deliberate).ttk;
            const tEnd = r.tEnd ?? (mg.gun.charges - 1) * mg.gun.fireDelay;
            const pk = r.pKill;
            r = { ...r, ttk: pk > 0 ? pk * r.ttk + (1 - pk) * (tEnd + 0.75 + b) : tEnd + 0.75 + b };
        }
        cache.set(k, r);
    }
    return r;
}

/**
 * armour-mixed kill rate (kills/s) at d: 1 / (engagement + E[TTK]). TTK starts at the first shot, so a one-shot kill
 * reads ~0 s; the engagement time (reaction floor plus putting the cursor on the target) keeps rates finite and
 * comparable
 */
function rateAt(id: string, mg: ModelGun, d: number, sigma: number): number {
    const t0 = ENGAGE[SKILLS.find((s) => SIGMA[s] === sigma) ?? "average"];
    let r = 0;
    for (let l = 0; l < 3; l++) {
        const t = ttkC(id, mg, d, sigma, l).ttk;
        r += ARMOR_MIX[l] * (Number.isFinite(t) ? 1 / (t0 + t) : 0);
    }
    return r;
}

export interface GunRow {
    id: string;
    name: string;
    gclass: string;
    cls: string;
    dualOf?: string;
    // pulled stats
    ammo: string;
    ammoFactor: number;
    ammoSpawn: number;
    fireMode: string;
    damage: number;
    pellets: number;
    explosion: number;
    shrapnel: string;
    headshotMult: number;
    obstacleDamage: number;
    fireDelay: number;
    burst: string;
    rpm: number;
    mag: number;
    magExt: number;
    reloadTime: number;
    reloadType: string;
    fullReload: number;
    switchDelay: number;
    deployGroup: number | null;
    shotSpread: number;
    moveSpread: number;
    fsa: string;
    bulletSpeed: number;
    range: number;
    falloff: number;
    speedEquip: number;
    speedAttack: number;
    speedCarry: number;
    special: string[];
    // derived
    burstDps: number;
    sustainedDps: number;
    magDamage: number;
    perfect: Ttk3;
    band: number[];
    bandTtk: Record<Skill, Ttk3>;
    /** band TTK with the critique's fixed aim error (no deliberate-aim factor) */
    bandTtkFixed: Record<Skill, Ttk3>;
    /** forgiveness for gunTiers.ts: fixed-sigma expert / beginner band TTK at level 1 (critique B definition) */
    F: number;
    /** the same with the deliberate-aim factor */
    Fdel: number;
    killsPerMag: number;
    heldSpeed: number;
    firingSpeed: number;
    mobilityCost: number;
    rates: Record<Skill, { band: number[]; universal: number[] }>;
    /** expected opening-shot damage over the home band vs level 1, per skill */
    alpha: Record<Skill, number[]>;
    aimK: number;
    pKillCharges?: number;
}

const rows: GunRow[] = [];
const T0 = performance.now();
const MG = new Map<string, ModelGun>();
BACKUP_MG = modelGun(BACKUP);
for (const id of ids) {
    const g = getDefOfType("gun", id) as Any;
    const mg = modelGun(id);
    MG.set(id, mg);
    const bl = mg.bullet;
    const ex = mg.explosive;
    const interval = shotInterval(mg.gun);
    const shot = g.bulletCount * (bl.damage + (ex?.damage ?? 0));
    const clip = g.charges ?? g.maxClip;
    const dump = magazineDumpTime(mg.gun);
    const reload = fullReloadTime(mg.gun);
    const bd = band(id);
    const bandTtk = {} as Record<Skill, Ttk3>;
    for (const s of SKILLS) {
        const per = [0, 1, 2].map((l) => mean(bd.map((d) => ttkC(id, mg, d, SIGMA[s], l).ttk)));
        bandTtk[s] = { a0: per[0], a1: per[1], a2: per[2] };
    }
    const bandTtkFixed = {} as Record<Skill, Ttk3>;
    for (const s of SKILLS) {
        const per = [0, 1, 2].map((l) => mean(bd.map((d) => ttkC(id, mg, d, SIGMA[s], l, false, false).ttk)));
        bandTtkFixed[s] = { a0: per[0], a1: per[1], a2: per[2] };
    }
    const pf = [0, 1, 2].map((l) => mean(bd.map((d) => ttkC(id, mg, d, 0, l, true).ttk)));
    const shotsAvg = mean(bd.map((d) => ttkC(id, mg, d, SIGMA.average, 1).shots));
    // a charge gun's expected kills per pickup also count the pickups that never kill
    const pkAvg = g.charges ? mean(bd.map((d) => ttkC(id, mg, d, SIGMA.average, 1).pKill)) : 1;
    const sp = g.speed ?? { equip: 0, attack: 0 };
    const carry = sp.carry ?? 0;
    const held = 12 + carry + sp.equip;
    const firing = (held + sp.attack) * 0.5;
    const rates = {} as GunRow["rates"];
    for (const s of SKILLS) {
        rates[s] = {
            band: bd.map((d) => rateAt(id, mg, d, SIGMA[s])),
            universal: UNIVERSAL.map(([d]) => rateAt(id, mg, d, SIGMA[s])),
        };
    }
    const alpha = {} as GunRow["alpha"];
    for (const s of SKILLS) alpha[s] = bd.map((d) => alphaAt(mg, d, SIGMA[s]));
    const special: string[] = [];
    if (g.fireMode === "burst") special.push(`burst ${g.burstCount} (${g.burstDelay} s apart)`);
    if (g.pumpEvery) special.push(`pump: ${g.pumpEvery} shots, then ${g.pumpDelay} s`);
    if (g.charges)
        special.push(
            `${g.charges} charge${g.charges > 1 ? "s" : ""}, no reload${g.discardWhenEmpty ? ", discarded when empty" : ""}`,
        );
    if (ex)
        special.push(
            `explosive: ${ex.damage}${ex.shrapnelCount ? ` + ${ex.shrapnelCount}x${ex.shrapnelDamage} shrapnel (p ${ex.shrapnelP.toFixed(2)})` : ""}`,
        );
    if (g.projType) special.push(`projectile ${g.projType} (${mg.speed} u/s, ${bl.distance.toFixed(0)} u)`);
    if (mg.fsa) special.push(`first-shot accuracy after ${g.recoilTime} s`);
    if (g.reloadTimeAlt) special.push(`empty reload ${g.maxReloadAlt} in ${g.reloadTimeAlt} s`);
    if (g.goldOnly) special.push("gold only");
    const dualOf = g.isDual ? id.replace(/_dual$/, "") : undefined;
    const row: GunRow = {
        id,
        name: g.name ?? id,
        gclass: gunClass(id) ?? "special",
        cls: botClass(id),
        dualOf,
        ammo: g.charges ? "none (charges)" : g.ammo,
        ammoFactor: g.charges ? 1 : (AMMO_FACTOR[g.ammo] ?? 1),
        ammoSpawn: g.ammoSpawnCount,
        fireMode: g.fireMode,
        damage: bl.damage,
        pellets: g.bulletCount,
        explosion: ex?.damage ?? 0,
        shrapnel: ex?.shrapnelCount ? `${ex.shrapnelCount}x${ex.shrapnelDamage}` : "",
        headshotMult: g.headshotMult,
        obstacleDamage: hasDef(g.bulletType) ? (getDef(g.bulletType) as Any).obstacleDamage : 1,
        fireDelay: g.fireDelay,
        burst:
            g.fireMode === "burst"
                ? `${g.burstCount}x${g.burstDelay}`
                : g.pumpEvery
                  ? `pump ${g.pumpEvery}/${g.pumpDelay}`
                  : "",
        rpm: 60 / interval,
        mag: clip,
        magExt: g.charges ?? g.extendedClip,
        reloadTime: g.reloadTime,
        reloadType: g.charges ? "none" : g.maxReload < g.maxClip ? `per ${g.maxReload}` : "full",
        fullReload: reload,
        switchDelay: g.switchDelay,
        deployGroup: g.deployGroup ?? null,
        shotSpread: g.shotSpread,
        moveSpread: g.moveSpread,
        fsa: mg.fsa ? `${g.recoilTime}` : "",
        bulletSpeed: mg.speed,
        range: bl.distance,
        falloff: bl.falloff,
        speedEquip: sp.equip,
        speedAttack: sp.attack,
        speedCarry: carry,
        special,
        burstDps: shot / interval,
        sustainedDps: Number.isFinite(reload) ? (clip * shot) / (dump + reload) : (clip * shot) / dump,
        magDamage: clip * shot,
        perfect: { a0: pf[0], a1: pf[1], a2: pf[2] },
        band: bd,
        bandTtk,
        bandTtkFixed,
        F: bandTtkFixed.expert.a1 / bandTtkFixed.beginner.a1,
        Fdel: bandTtk.expert.a1 / bandTtk.beginner.a1,
        killsPerMag: Number.isFinite(shotsAvg) ? (pkAvg * clip) / Math.max(shotsAvg, 1) : 0,
        heldSpeed: held,
        firingSpeed: firing,
        mobilityCost: Math.max(0, -(carry + sp.equip)) + 0.5 * Math.max(0, -sp.attack),
        rates,
        alpha,
        aimK: aimK(mg.fsa ? Math.max(g.fireDelay, g.recoilTime) : interval),
    };
    if (g.charges) row.pKillCharges = mean(bd.map((d) => ttkC(id, mg, d, SIGMA.average, 1).pKill));
    rows.push(row);
    process.stderr.write(".");
}
process.stderr.write(` ${((performance.now() - T0) / 1000).toFixed(0)} s\n`);

// ---------------------------------------------------------------------------------------------------------------
// Scoring: every term is a log2 ratio against the median tiered gun at the same distance and skill

const current = new Map<string, Any>(JSON.parse(readFileSync(BASELINE, "utf8")).rows.map((t: Any) => [t.id, t]));
const refSet = rows.filter((r) => current.has(r.id));
const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const clampL = (x: number) => Math.max(-3, Math.min(3, x));
const l2 = (x: number, ref: number) => (x > 0 ? clampL(Math.log2(x / ref)) : -3);

// reference medians per (skill, distance)
const refRate = new Map<string, number>();
const allD = new Set<number>([...UNIVERSAL.map(([d]) => d), ...rows.flatMap((r) => r.band)]);
for (const s of SKILLS)
    for (const d of allD) {
        const xs = refSet.map((r) => rateAt(r.id, MG.get(r.id) as ModelGun, d, SIGMA[s]));
        refRate.set(`${s}|${d}`, median(xs));
    }

const refAlpha = new Map<string, number>();
for (const s of SKILLS)
    for (const d of allD) {
        const xs = refSet.map((r) => alphaAt(MG.get(r.id) as ModelGun, d, SIGMA[s]));
        refAlpha.set(`${s}|${d}`, median(xs));
    }
const medSust = median(refSet.map((r) => r.sustainedDps));
const medKpm = median(refSet.map((r) => r.killsPerMag).filter((x) => x > 0));

/** raw score components, log2 ratios against the median tiered gun (score.ts weights them) */
export interface Components {
    alpha: Record<Skill, number>;
    role: Record<Skill, number>;
    range: Record<Skill, number>;
    sustain: number;
    handling: number;
    ammo: number;
}

const components = new Map<string, Components>();
for (const r of rows) {
    const role = {} as Record<Skill, number>;
    const range = {} as Record<Skill, number>;
    const alpha = {} as Record<Skill, number>;
    for (const s of SKILLS) {
        alpha[s] = mean(r.band.map((d, i) => l2(r.alpha[s][i], refAlpha.get(`${s}|${d}`) as number)));
        role[s] = mean(r.band.map((d, i) => l2(r.rates[s].band[i], refRate.get(`${s}|${d}`) as number)));
        range[s] = UNIVERSAL.reduce(
            (a, [d, w], i) => a + w * l2(r.rates[s].universal[i], refRate.get(`${s}|${d}`) as number),
            0,
        );
    }
    // sustain: kills per magazine (average aim, level 1, home band) and sustained DPS; a charge gun's pickup is its
    // whole supply, so its kills per pickup also stand for its sustained damage
    const kpm = r.killsPerMag > 0 ? l2(r.killsPerMag, medKpm) : -3;
    const sus = r.mag && Number.isFinite(r.fullReload) ? l2(r.sustainedDps, medSust) : kpm;
    const sustain = 0.5 * kpm + 0.5 * sus;
    // handling: log2 of the speed held (carry + equip) over 12, half the log2 of the speed while firing over the
    // unpenalised 6, and -0.5 per second of switch delay above the 0.75 s standard
    const handling =
        Math.log2(r.heldSpeed / 12) + 0.5 * Math.log2(r.firingSpeed / 6) - 0.5 * Math.max(0, r.switchDelay - 0.75);
    const ammo = 2 * Math.log2(r.ammoFactor);
    components.set(r.id, { alpha, role, range, sustain, handling, ammo });
}

const out = {
    meta: { AIM_TAU, ENGAGE, SIGMA, ARMOR, ARMOR_MIX, MOVING, BAND, UNIVERSAL, AMMO_FACTOR, medSust, medKpm },
    rows,
    components: Object.fromEntries(components),
    current: Object.fromEntries(current),
};
const file = resolve(process.env.OUT ?? `${OUT_DIR}/metrics.json`);
mkdirSync(dirname(file), { recursive: true });
writeFileSync(
    file,
    JSON.stringify(out, (_, v) => (v === Number.POSITIVE_INFINITY ? "Infinity" : v), 1),
);
console.log(`wrote ${file}: ${rows.length} guns`);
