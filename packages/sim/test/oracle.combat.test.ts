// Damage pipeline, time-to-kill and melee compared with the survev oracle (damage.json, ttk.json, melee.json).
// The oracle runs in "centered" mode (zero deviation and jitter, headshots forced through headshotChance 0 / 1);
// a constant 0.5 rng and the headshotChance knob reproduce that here.
import { v2 } from "@rebirth/core";
import { DamageType, getDefOfType, Input, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import {
    canHeadshot,
    computeDamage,
    type DamageParams,
    defaultRules,
    type Game,
    type Player,
    type PlayerInput,
} from "../src/index.ts";
import { constantRng, flatGame, giveGun, openSpot, send, spawnAt, steps } from "./combatHelpers.ts";
import { hasFixture, loadFixture, Mismatches, TICK } from "./oracleHelpers.ts";

const HOLD = { shootHold: true };
const CLICK = { shootHold: true, shootStart: true };
const ARMOR: Record<string, [string, string]> = {
    none: ["", ""],
    lvl1: ["helmet01", "chest01"],
    lvl2: ["helmet02", "chest02"],
    lvl3: ["helmet03", "chest03"],
};

interface Hit {
    tick: number;
    amount: number;
}

/** Records every damage event on `target` (bullet damage goes through game.damagePlayer). */
function watchHits(game: Game, target: Player): Hit[] {
    const hits: Hit[] = [];
    const original = game.damagePlayer.bind(game);
    game.damagePlayer = (t, params) => {
        const before = t.health;
        original(t, params);
        // damage is applied during step(), before the tick counter advances: it belongs to tick + 1
        if (t === target && before !== t.health) hits.push({ tick: game.tick + 1, amount: before - t.health });
    };
    return hits;
}

/** A duel at `distance` (centre to centre) in centered mode; headshots always or never. */
function duel(distance: number, headshot: boolean, survevHeadshotRule = false) {
    const game = flatGame();
    game.combatRng = constantRng();
    game.rules.headshotChance = headshot ? 1 : 0;
    // survev rolls headshots for any headshotMult (also 1); the original rule needs > 1
    game.rules.headshotNeedsMultAboveOne = !survevHeadshotRule;
    const origin = openSpot(game, distance + 30);
    const shooter = spawnAt(game, origin);
    const target = spawnAt(game, v2.add(origin, { x: distance, y: 0 }), { x: -1, y: 0 });
    return { game, shooter, target };
}

describe.skipIf(!hasFixture("damage"))("oracle: damage.json", () => {
    const fixture = loadFixture("damage");

    it("matches every row of survev's damage matrix (with survev's steelskin 0.45)", () => {
        const rules = { ...defaultRules(), steelskinReduction: fixture.meta.params.perkProperties.steelskin };
        const m = new Mismatches();
        for (const [amount, hit, helmetLevel, chestLevel, perk, damage] of fixture.rows as any[][]) {
            const target = {
                helmet: helmetLevel ? `helmet0${helmetLevel}` : "",
                chest: chestLevel ? `chest0${chestLevel}` : "",
                hasPerk: (p: string) => p === perk,
            };
            const params: DamageParams =
                hit === "gas" || hit === "bleeding"
                    ? { amount, damageType: hit === "gas" ? DamageType.Gas : DamageType.Bleeding }
                    : {
                          amount,
                          damageType: DamageType.Player,
                          gameSourceType: hit === "explosion" ? "frag" : "ak47",
                          isExplosion: hit === "explosion",
                      };
            const ours = computeDamage(params, hit === "head", target, rules);
            m.near(`${amount} ${hit} h${helmetLevel} c${chestLevel} ${perk}`, ours, damage, 1e-6 * Math.max(1, damage));
        }
        expect(m.checked).toBe(fixture.rows.length);
        expect(m.list).toEqual([]);
    });
});

/** Our version of the oracle's ttk case: probe damage per hit, then a kill run with the trigger held. */
function ttkCase(gun: string, armor: string, distance: number, headshot: boolean) {
    const def = getDefOfType("gun", gun);
    const trigger: Partial<PlayerInput> = def.fireMode === "single" ? CLICK : HOLD;
    // probe: one shot (one burst) at a fresh target
    const probe = duel(distance, headshot);
    giveGun(probe.shooter, gun, { reserve: 990 });
    [probe.target.helmet, probe.target.chest] = ARMOR[armor];
    // the oracle measures damage per hit with the health cap raised: record the unclamped amount
    const probeHits: Hit[] = [];
    const original = probe.game.damagePlayer.bind(probe.game);
    probe.game.damagePlayer = (t, params) => {
        if (t === probe.target) {
            const rules = probe.game.rules;
            const head = rules.headshotChance >= 1 && canHeadshot(params, rules);
            probeHits.push({ tick: probe.game.tick + 1, amount: computeDamage(params, head, t, rules) });
        }
        original(t, params);
    };
    send(probe.game, probe.shooter, trigger);
    probe.game.step();
    const firstShot = probe.game.tick;
    send(probe.game, probe.shooter, {});
    steps(probe.game, 300);
    if (probeHits.length === 0) return { outOfRange: true };
    const flightTicks = probeHits[0].tick - firstShot;

    const run = duel(distance, headshot);
    giveGun(run.shooter, gun, { reserve: 990 });
    [run.target.helmet, run.target.chest] = ARMOR[armor];
    const hits = watchHits(run.game, run.target);
    const shots: number[] = [];
    let reloaded = false;
    for (let i = 0; i < 4000 && !run.target.dead; i++) {
        const seq = run.shooter.shotSeq;
        send(run.game, run.shooter, trigger);
        run.game.step();
        if (run.shooter.shotSeq !== seq) shots.push(run.game.tick);
        if (run.shooter.weapons[WeaponSlot.Primary].ammo === 0) reloaded = true;
    }
    if (!run.target.dead) return { killed: false };
    const death = run.game.tick;
    return {
        damagePerHit: probeHits[0].amount,
        hitsToKill: hits.length,
        shotsToKill: shots.filter((s) => s <= death - flightTicks).length,
        ttk: (death - shots[0]) * TICK,
        flightSeconds: flightTicks * TICK,
        reloaded,
    };
}

describe.skipIf(!hasFixture("ttk"))("oracle: ttk.json", () => {
    const fixture = loadFixture("ttk");

    it("matches damage per hit, hits and shots to kill exactly, and TTK within survev's per-shot tick residue", () => {
        const m = new Mismatches();
        for (const [gun, cases] of Object.entries<any[]>(fixture.guns)) {
            const def = getDefOfType("gun", gun);
            for (const c of cases) {
                const key = `${gun} ${c.armor} ${c.distance}m ${c.headshot}`;
                const ours = ttkCase(gun, c.armor, c.distance, c.headshot === "always");
                if (c.outOfRange) {
                    m.equal(`${key} outOfRange`, ours.outOfRange ?? false, true);
                    continue;
                }
                m.near(`${key} damagePerHit`, ours.damagePerHit, c.damagePerHit, 1e-5);
                m.equal(`${key} hitsToKill`, ours.hitsToKill, c.hitsToKill);
                m.equal(`${key} shotsToKill`, ours.shotsToKill, c.shotsToKill);
                m.near(`${key} flight`, ours.flightSeconds, c.flightSeconds, 1e-9);
                // survev's 100 Hz residue adds up to a tick per shot; a magazine reload adds a tick per action
                const reloadActions = c.reloadedDuringKill ? Math.ceil(def.maxClip / def.maxReload) + 1 : 0;
                const tol = TICK * (c.shotsToKill + reloadActions) + 1e-9;
                m.near(`${key} ttk`, ours.ttk, c.ttk, tol);
                // exact timing never makes a kill slower than survev's, except bursts: survev decrements a new
                // burst queue in the tick it is created, so its burst gaps are burstDelay - dt
                const slack = def.fireMode === "burst" ? TICK * c.shotsToKill : 0;
                if (ours.ttk !== undefined && ours.ttk > c.ttk + slack + 1e-9) {
                    m.list.push(`${key} ttk slower: ${ours.ttk} > ${c.ttk}`);
                }
            }
        }
        expect(m.checked).toBeGreaterThan(1000);
        expect(m.list).toEqual([]);
    }, 20_000);
});

/** The oracle's melee kill run: the target stands attack.offset.x + 0.5 in front, attack spammed. */
function meleeRun(weapon: string, armor: string, headshot: boolean) {
    const def = getDefOfType("melee", weapon);
    const { game, shooter, target } = duel(def.attack.offset.x + 0.5, headshot, true);
    shooter.weaponManager.setWeapon(WeaponSlot.Melee, weapon, 0);
    shooter.weaponManager.weapons[WeaponSlot.Melee].cooldown = 0;
    [target.helmet, target.chest] = ARMOR[armor];
    const hits = watchHits(game, target);
    steps(game, 100);
    const start = game.tick;
    for (let i = 0; i < 3000 && !target.dead; i++) {
        send(game, shooter, CLICK);
        game.step();
    }
    return { start, death: game.tick, hits: hits.map((h) => ({ tick: h.tick - start, amount: h.amount })) };
}

describe.skipIf(!hasFixture("melee"))("oracle: melee.json", () => {
    const fixture = loadFixture("melee");

    it("matches every melee weapon's damage, hits to kill, first hit and swing interval", () => {
        const m = new Mismatches();
        for (const [weapon, entry] of Object.entries<any>(fixture.weapons)) {
            for (const [variant, rows] of [
                ["body", entry.body],
                ["headshot", entry.headshot],
            ] as const) {
                for (const row of rows as any[]) {
                    const key = `${weapon} ${variant} ${row.armor}`;
                    const run = meleeRun(weapon, row.armor, variant === "headshot");
                    m.near(`${key} damagePerHit`, run.hits[0]?.amount, row.damagePerHit, 1e-6);
                    m.equal(`${key} hitsToKill`, run.hits.length, row.hitsToKill);
                    m.near(
                        `${key} firstHitAfterInput`,
                        run.hits[0] ? run.hits[0].tick * TICK : null,
                        row.firstHitAfterInput,
                        TICK + 1e-9,
                    );
                    m.near(`${key} ttk`, (run.death - run.start) * TICK, row.ttk, TICK * row.hitsToKill + 1e-9);
                    const theirs = (row.hitIntervals ?? []).map((h: { value: number }) => h.value) as number[];
                    for (let i = 1; i < run.hits.length; i++) {
                        const iv = (run.hits[i].tick - run.hits[i - 1].tick) * TICK;
                        const nearest = theirs.reduce(
                            (a, b) => (Math.abs(b - iv) < Math.abs(a - iv) ? b : a),
                            theirs[0],
                        );
                        m.near(`${key} interval`, iv, nearest, TICK + 1e-9);
                    }
                }
            }
            // equip delay from a gun
            const { game, shooter } = duel(5, false);
            shooter.weaponManager.setWeapon(WeaponSlot.Melee, weapon, 0);
            giveGun(shooter, "m9");
            steps(game, 200);
            send(game, shooter, { ...CLICK, actions: [Input.EquipMelee] });
            const ref = game.tick;
            game.step();
            for (let i = 0; i < 300 && shooter.animType !== "melee"; i++) {
                send(game, shooter, CLICK);
                game.step();
            }
            m.near(`${weapon} equipDelayFromGun`, (game.tick - ref) * TICK, entry.equipDelayFromGun, TICK + 1e-9);
        }
        expect(m.checked).toBeGreaterThan(500);
        expect(m.list).toEqual([]);
    });

    it("deviates on purpose for melee headshots: the original rule never rolls them (headshotMult 1)", () => {
        const def = getDefOfType("melee", "fists");
        const { game, shooter, target } = duel(def.attack.offset.x + 0.5, true);
        target.helmet = "helmet01";
        send(game, shooter, CLICK);
        steps(game, 20);
        // body damage (24 x 0.925) instead of survev's head damage (24 x 0.75)
        expect(100 - target.health).toBeCloseTo(24 * (1 - 0.3 * 0.25), 9);
    });
});
