// ttk.json: hits and time to kill a 100 HP target per gun x armor set x distance (centered mode).
import type { Ctx, FixtureResult } from "../lib/context.ts";
import { type DamageEvent, Harness } from "../lib/harness.ts";
import { SLOT, triggerFor, waitBulletsGone, waitForShot } from "../lib/measure.ts";
import { CENTERED, type HeadshotMode } from "../lib/rng.ts";

export const TTK_GUNS = [
    "ak47",
    "m870",
    "mp220",
    "mosin",
    "sv98",
    "m9",
    "mp5",
    "vector",
    "scar",
    "m249",
    "dp28",
    "famas",
    "mk12",
    "spas12",
    "deagle",
    "an94",
    "groza",
    "ump9",
    "mac10",
    "saiga",
    "m1014",
    "garand",
    "m39",
    "qbb97",
    "l86",
    "blr",
];

export const HEADSHOT_GUNS = ["ak47", "m870", "mosin", "sv98", "m9", "deagle", "an94", "scar", "mk12", "m39", "blr"];

export const ARMOR_SETS = [
    { name: "none", helmet: "", chest: "" },
    { name: "lvl1", helmet: "helmet01", chest: "chest01" },
    { name: "lvl2", helmet: "helmet02", chest: "chest02" },
    { name: "lvl3", helmet: "helmet03", chest: "chest03" },
];

export const DISTANCES = [5, 20, 50];

const PROBE_CAP = 10000;
const MAX_KILL_SECONDS = 40;

interface Case {
    armor: (typeof ARMOR_SETS)[number];
    distance: number;
    headshot: HeadshotMode;
}

function bulletHits(events: DamageEvent[]): DamageEvent[] {
    return events.filter((e) => e.damageType === 0);
}

function runCase(h: Harness, gun: string, c: Case, row: number) {
    const { x: x0, y } = h.rowPos(row, 16);
    const spawn = (dx: number) => h.addPlayer({ x: x0 + dx, y });
    const def = h.sv.GameObjectDefs.typeToDef(gun, "gun");
    const trigger = triggerFor(def.fireMode);
    h.setMode(CENTERED, c.headshot);

    // probe: one shot against a target whose health cap is raised, so no hit is clamped by remaining health
    const probeShooter = spawn(0);
    probeShooter.debug.godMode = true;
    h.giveGun(probeShooter, gun);
    probeShooter.weaponManager.setCurWeapIndex(SLOT.primary);
    const probeTarget = spawn(c.distance);
    h.setArmor(probeTarget, c.armor.helmet, c.armor.chest);
    const probeEvents = h.watchDamage(probeTarget);
    h.stepSeconds(3);
    const probe = h.withHealthCap(PROBE_CAP, () => {
        probeTarget.health = PROBE_CAP;
        h.hold(probeShooter, trigger);
        const shot = waitForShot(h, probeShooter, 300);
        h.hold(probeShooter, {});
        // burst guns: let the whole burst fire before the cap is restored
        h.stepUntil(() => probeShooter.weaponManager.bursts.length === 0, 100);
        waitBulletsGone(h, 600);
        return shot;
    });
    probeTarget.health = 100;
    h.teleport(probeTarget, { x: 1250, y }); // out of the way of the kill run (beyond every bullet's range)
    const hits = bulletHits(probeEvents);
    if (!probe || hits.length === 0) {
        return { ...caseKey(c), outOfRange: true, pellets: probe?.bullets.length ?? 0 };
    }
    const probeShots = h.shotsBy(probeShooter).length; // a burst gun fires its whole burst
    const flightTicks = hits[0].tick - probe.tick;
    const perHit = [...new Set(hits.map((e) => e.applied))];
    const travel = probe.bullets.map((b) => b.distanceTraveled ?? 0);

    // kill: fresh pair at the same geometry, trigger held until the target dies
    const shooter = spawn(0);
    shooter.debug.godMode = true;
    h.giveGun(shooter, gun);
    shooter.weaponManager.setCurWeapIndex(SLOT.primary);
    const target = spawn(c.distance);
    h.setArmor(target, c.armor.helmet, c.armor.chest);
    const events = h.watchDamage(target);
    h.stepSeconds(3);
    const shotsBefore = h.shotsBy(shooter).length;
    let emptied = false;
    h.hold(shooter, trigger);
    const deathTick = h.stepUntil(
        () => {
            if (shooter.weapons[SLOT.primary].ammo === 0) emptied = true;
            return target.dead;
        },
        Math.round(MAX_KILL_SECONDS / h.dt),
    );
    h.hold(shooter, {});
    waitBulletsGone(h, 600);
    const shots = h.shotsBy(shooter).slice(shotsBefore);
    if (deathTick === undefined || shots.length === 0) {
        return { ...caseKey(c), killed: false, pellets: probe.bullets.length, damagePerHit: perHit };
    }
    const killHits = bulletHits(events).filter((e) => e.tick <= deathTick);
    return {
        ...caseKey(c),
        pellets: probe.bullets.length,
        pelletHitsPerShot: hits.length / probeShots,
        damagePerHit: perHit.length === 1 ? perHit[0] : perHit,
        damagePerShot: hits.reduce((a, e) => a + e.applied, 0) / probeShots,
        bulletTravelAtHit: Math.min(...travel),
        flightSeconds: flightTicks * h.dt,
        hitsToKill: killHits.length,
        shotsToKill: shots.filter((s) => s.tick <= deathTick - flightTicks).length,
        ttk: (deathTick - shots[0].tick) * h.dt,
        reloadedDuringKill: emptied,
    };
}

function caseKey(c: Case) {
    return { armor: c.armor.name, distance: c.distance, headshot: c.headshot };
}

export function ttk(ctx: Ctx): FixtureResult {
    const guns: Record<string, unknown[]> = {};
    for (const gun of TTK_GUNS) {
        const h = new Harness(ctx.sv, { seed: 31 });
        const cases: Case[] = [];
        for (const headshot of ["never", "always"] as const) {
            if (headshot === "always" && !HEADSHOT_GUNS.includes(gun)) continue;
            for (const armor of ARMOR_SETS) for (const distance of DISTANCES) cases.push({ armor, distance, headshot });
        }
        guns[gun] = cases.map((c, row) => runCase(h, gun, c, row));
        process.stdout.write(".");
    }
    process.stdout.write("\n");
    return {
        params: {
            random: "centered: zero spread deviation and pellet jitter, every pellet flies along the aim line",
            headshot: "never for every gun; always (headshotChance = 1) for the headshot subset",
            target: "100 HP test player, no perks, no boost, standing still; armor sets helmetN + chestN",
            distance: "centre-to-centre metres between shooter and target (both radius 1)",
            ttk: "seconds from the end of the tick of the first shot to the end of the tick the target died",
            damagePerHit:
                "applied damage of one pellet/bullet hit after falloff and armor, measured on a probe target whose " +
                "health cap was raised to 10000 so it is never clamped",
            shotsToKill: "shots fired no later than (death tick - bullet flight ticks)",
            trigger: "auto/burst: held; single: spam-clicked every tick; magazine reloads happen if needed",
            armorSets: ARMOR_SETS,
            distances: DISTANCES,
            headshotGuns: HEADSHOT_GUNS,
        },
        data: {
            notes: [
                "falloff uses the bullet's distanceTraveled at the end of the tick it hits (bullet.ts), not the " +
                    "exact contact point",
                "outOfRange: the probe shot never reached the target (bullet distance shorter than the gap)",
            ],
            guns,
        },
    };
}
