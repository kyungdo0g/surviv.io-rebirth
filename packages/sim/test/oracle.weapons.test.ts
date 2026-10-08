// Gun timings, pellets, bullets, switch delays and move speeds compared with the survev oracle (weapons.json,
// movement.json). Timings are compared with the 1000 Hz recordings: our cooldowns carry their sub-tick remainder,
// while survev's fixed-step float residue adds a tick to many 100 Hz intervals (tools/oracle/README.md).
import { GameConfig, GUN_SPEED_OVERRIDES, getDefOfType, Input, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import type { Game, Player, PlayerInput } from "../src/index.ts";
import { constantRng, flatGame, giveGun, openSpot, send, spawnAt, steps } from "./combatHelpers.ts";
import { hasFixture, histogramValues, loadFixture, Mismatches, TICK } from "./oracleHelpers.ts";

// the cursor far away like the oracle scenario: USAS-12 rounds (toMouseHit) stop at the cursor (M9)
const HOLD = { shootHold: true, toMouseLen: 1000 };
const CLICK = { shootHold: true, shootStart: true, toMouseLen: 1000 };
const READY_TICKS = 300;

function triggerFor(gun: string): Partial<PlayerInput> {
    return getDefOfType("gun", gun).fireMode === "single" ? CLICK : HOLD;
}

function newShooter(): { game: Game; p: Player } {
    const game = flatGame();
    game.combatRng = constantRng();
    const p = spawnAt(game, openSpot(game, 10));
    return { game, p };
}

/** Steps with `input` until a shot happens; returns the tick of the shot. */
function waitForShot(game: Game, p: Player, input: Partial<PlayerInput>, maxTicks: number): number | null {
    for (let i = 0; i < maxTicks; i++) {
        const seq = p.shotSeq;
        send(game, p, input);
        game.step();
        if (p.shotSeq !== seq) return game.tick;
    }
    return null;
}

interface Reload {
    action: string;
    start: number;
    end: number;
    duration: number;
    ammoAfter: number;
}

/** The fixture's fireAndReload measurement on our simulation. */
function fireAndReload(gun: string) {
    const def = getDefOfType("gun", gun);
    const { game, p } = newShooter();
    giveGun(p, gun, { reserve: 990 });
    steps(game, READY_TICKS);
    const weapon = p.weaponManager.weapons[WeaponSlot.Primary];
    const shots: Array<{ tick: number; pellets: number }> = [];
    for (let i = 0; i < 6000 && weapon.ammo > 0; i++) {
        send(game, p, triggerFor(gun));
        const seq = p.shotSeq;
        game.step();
        if (p.shotSeq !== seq) {
            const pellets = game.bullets.reports.filter((r) => r.tick === game.tick && r.bullet.reflectCount === 0);
            shots.push({ tick: game.tick, pellets: pellets.length });
        }
    }
    send(game, p, {});
    const last = shots[shots.length - 1].tick;
    const reloads: Reload[] = [];
    let open: Reload | null = null;
    let lastChange = game.tick;
    for (let i = 0; i < 3000; i++) {
        const seq = p.action.seq;
        game.step();
        if (p.action.seq !== seq) {
            if (open) {
                open.end = (game.tick - last) * TICK;
                open.duration = open.end - open.start;
                open.ammoAfter = weapon.ammo;
                reloads.push(open);
                open = null;
            }
            if (p.action.type !== "none") {
                const name = p.action.type === "reloadAlt" ? "ReloadAlt" : "Reload";
                open = { action: name, start: (game.tick - last) * TICK, end: 0, duration: 0, ammoAfter: 0 };
            }
            lastChange = game.tick;
        }
        if (!open && weapon.ammo >= def.maxClip) break;
        if (!open && (game.tick - lastChange) * TICK > 3) break;
    }
    const full = weapon.ammo >= def.maxClip;
    const next = full ? waitForShot(game, p, triggerFor(gun), 500) : null;
    return {
        shotsPerMag: shots.length,
        pellets: [...new Set(shots.map((s) => s.pellets))],
        intervals: shots.slice(1).map((s, i) => (s.tick - shots[i].tick) * TICK),
        reloads,
        fullAfterLastShot: full && reloads.length ? reloads[reloads.length - 1].end : null,
        lastShotToNextMagFirstShot: next === null ? null : (next - last) * TICK,
    };
}

/** The fixture's switchDelays measurement: free switch, rapid switch and pickup into the active slot. */
function switchDelays(gun: string) {
    const def = getDefOfType("gun", gun);
    const trigger = triggerFor(gun);
    const free = newShooter();
    free.p.weaponManager.setWeapon(WeaponSlot.Primary, gun, def.maxClip);
    steps(free.game, READY_TICKS);
    send(free.game, free.p, { ...trigger, actions: [Input.EquipPrimary] });
    const freeRef = free.game.tick;
    const freeShot = waitForShot(free.game, free.p, trigger, 500);

    const rapid = newShooter();
    giveGun(rapid.p, gun);
    steps(rapid.game, READY_TICKS);
    send(rapid.game, rapid.p, { actions: [Input.EquipMelee] });
    rapid.game.step();
    send(rapid.game, rapid.p, { ...trigger, actions: [Input.EquipPrimary] });
    const rapidRef = rapid.game.tick;
    const rapidShot = waitForShot(rapid.game, rapid.p, trigger, 500);

    const pickup = newShooter();
    giveGun(pickup.p, gun === "m9" ? "glock" : "m9");
    steps(pickup.game, READY_TICKS);
    pickup.p.weaponManager.setWeapon(WeaponSlot.Primary, gun, def.maxClip);
    const ref = pickup.game.tick;
    const pickupShot = waitForShot(pickup.game, pickup.p, trigger, 500);
    const span = (a: number, b: number | null) => (b === null ? null : (b - a) * TICK);
    return {
        freeSwitch: span(freeRef, freeShot),
        rapidSwitch: span(rapidRef, rapidShot),
        pickupIntoActiveSlot: span(ref, pickupShot),
    };
}

describe.skipIf(!hasFixture("weapons"))("oracle: weapons.json", () => {
    const fixture = loadFixture("weapons");

    it("matches every gun's magazine, pellets, fire intervals, reloads and switch delays", () => {
        const m = new Mismatches();
        for (const [gun, entry] of Object.entries<any>(fixture.guns)) {
            const def = getDefOfType("gun", gun);
            const want = entry.tick1000Hz;
            const ours = fireAndReload(gun);
            m.equal(`${gun} shotsPerMag`, ours.shotsPerMag, want.shotsPerMag);
            m.equal(`${gun} pellets`, ours.pellets, histogramValues(want.pelletsPerShot));
            // every interval within one tick of an interval survev recorded at 1000 Hz
            const theirs = histogramValues(want.intervals);
            for (const iv of new Set(ours.intervals.map((x) => Math.round(x * 1000) / 1000))) {
                const nearest = theirs.reduce((a, b) => (Math.abs(b - iv) < Math.abs(a - iv) ? b : a), theirs[0]);
                m.near(`${gun} interval`, iv, nearest, TICK + 0.001);
            }
            const reloads = want.reload.actions as Reload[];
            m.equal(
                `${gun} reload actions`,
                ours.reloads.map((r) => `${r.action}:${r.ammoAfter}`),
                reloads.map((r) => `${r.action}:${r.ammoAfter}`),
            );
            for (let i = 0; i < Math.min(reloads.length, ours.reloads.length); i++) {
                // survev at 1000 Hz still adds 1 ms of residue per action
                m.near(`${gun} reload ${i} duration`, ours.reloads[i].duration, reloads[i].duration, 0.002);
            }
            if (reloads.length)
                m.near(`${gun} first reload start`, ours.reloads[0]?.start, reloads[0].start, TICK + 0.001);
            const shells = Math.max(1, reloads.length);
            m.near(
                `${gun} fullAfterLastShot`,
                ours.fullAfterLastShot,
                want.reload.fullAfterLastShot,
                TICK + 0.002 * shells,
            );
            m.near(
                `${gun} lastShotToNextMagFirstShot`,
                ours.lastShotToNextMagFirstShot,
                want.reload.lastShotToNextMagFirstShot,
                2 * TICK + 0.002 * shells,
            );
            const sw = switchDelays(gun);
            m.near(`${gun} freeSwitch`, sw.freeSwitch, want.switch.freeSwitch, TICK + 0.001);
            m.near(`${gun} rapidSwitch`, sw.rapidSwitch, want.switch.rapidSwitch, TICK + 0.001);
            m.near(
                `${gun} pickupIntoActiveSlot`,
                sw.pickupIntoActiveSlot,
                want.switch.pickupIntoActiveSlot,
                TICK + 0.001,
            );
            // bullets: centered flight
            const bullet = getDefOfType("bullet", def.bulletType);
            const centered = entry.bullet.centered;
            if (centered) {
                m.near(`${gun} bullet speed`, bullet.speed, centered.speed, 1e-9);
                m.near(`${gun} bullet distance`, bullet.distance, centered.configuredDistance.min, 1e-9);
            }
        }
        expect(m.checked).toBeGreaterThan(500);
        expect(m.list).toEqual([]);
    });

    it("matches the quick-switch table (deploy groups)", () => {
        const m = new Mismatches();
        for (const row of fixture.quickSwitch as any[]) {
            const { game, p } = newShooter();
            giveGun(p, row.b, { slot: WeaponSlot.Secondary });
            giveGun(p, row.a, { slot: WeaponSlot.Primary });
            steps(game, READY_TICKS);
            const a1 = waitForShot(game, p, triggerFor(row.a), 500)!;
            send(game, p, { actions: [Input.EquipSecondary] });
            const b1 = waitForShot(game, p, triggerFor(row.b), 500)!;
            send(game, p, { actions: [Input.EquipPrimary] });
            const a2 = waitForShot(game, p, triggerFor(row.a), 500)!;
            m.near(`${row.a}->${row.b} aShotToBShot`, (b1 - a1) * TICK, row.aShotToBShot, TICK + 0.001);
            m.near(`${row.a}->${row.b} bShotToAShot`, (a2 - b1) * TICK, row.bShotToAShot, TICK + 0.001);
        }
        expect(m.list).toEqual([]);
    });
});

describe.skipIf(!hasFixture("movement"))("oracle: movement.json", () => {
    const fixture = loadFixture("movement");

    it("matches the equip speed of every weapon (the owner's speed overrides moved by their own difference)", () => {
        const m = new Mismatches();
        const { game, p } = newShooter();
        // the rebirth's deliberate speed changes on survev guns (defs rebirth/gunSpeeds.ts: the PMG-134 held is
        // equip -1 and carry -2 instead of survev's -1.5): the oracle's speed plus that difference
        const shift = new Map(
            GUN_SPEED_OVERRIDES.map((o) => [o.id, o.rebirth.equip + (o.rebirth.carry ?? 0) - o.survev.equip]),
        );
        for (const [kind, speeds] of Object.entries<Record<string, number>>(fixture.perWeapon)) {
            const slot =
                kind === "gun" ? WeaponSlot.Primary : kind === "melee" ? WeaponSlot.Melee : WeaponSlot.Throwable;
            for (const [id, speed] of Object.entries(speeds)) {
                p.weaponManager.setWeapon(slot, id, 0);
                p.weaponManager.curWeapIdx = slot;
                const expected = speed + (kind === "gun" ? (shift.get(id) ?? 0) : 0);
                m.near(`${kind} ${id}`, p.computeSpeed(game.world), expected, 1e-9);
            }
        }
        expect(m.checked).toBeGreaterThan(100);
        expect(m.list).toEqual([]);
    });

    it("matches boost, water and item-use speeds (firing and cooking are covered elsewhere)", () => {
        const m = new Mismatches();
        const { game, p } = newShooter();
        const s = fixture.situations;
        m.near("fists", p.computeSpeed(game.world), s.fists, 1e-9);
        for (const [key, value] of Object.entries<any>(s)) {
            const match = /^fistsBoost([\d.]+)$/.exec(key);
            // exactly 50: survev decays boost before moving, so its sample sits just below the threshold
            if (!match || Number(match[1]) === 50) continue;
            p.boost = Number(match[1]);
            m.near(key, p.computeSpeed(game.world), value, 1e-9);
        }
        p.boost = 0;
        const dry = p.pos;
        p.pos = { x: 1, y: 1 };
        expect(game.world.isOnWater(p.pos, 0)).toBe(true);
        m.near("fistsInWater", p.computeSpeed(game.world), s.fistsInWater.speed, 1e-9);
        p.pos = dry;
        p.doAction("bandage", "use", 3);
        m.near("usingBandage", p.computeSpeed(game.world), s.usingBandage.speed, 1e-9);
        expect(GameConfig.player.moveSpeed).toBe(fixture.baseMoveSpeed);
        expect(m.list).toEqual([]);
    });
});
