// melee.json: damage per hit, swing timing, equip delay and hits/time to kill for every melee weapon.
import { type Ctx, type FixtureResult, idsOfType } from "../lib/context.ts";
import { Harness } from "../lib/harness.ts";
import { histogram, intervals, SLOT } from "../lib/measure.ts";
import { CENTERED, type HeadshotMode } from "../lib/rng.ts";
import { ARMOR_SETS } from "./ttk.ts";

const CAP = 10000;
const ATTACK = { shootHold: true, shootStart: true };

function meleeTarget(h: Harness, def: any, row: number) {
    const { x, y } = h.rowPos(row, 10);
    const attacker = h.addPlayer({ x, y });
    attacker.debug.godMode = true;
    // centre of the attack circle is attack.offset ahead; the target (radius 1) overlaps it
    const target = h.addPlayer({ x: x + def.attack.offset.x + 0.5, y });
    return { attacker, target };
}

function probeDamage(h: Harness, id: string, def: any, row: number, armor: (typeof ARMOR_SETS)[number]) {
    const { attacker, target } = meleeTarget(h, def, row);
    attacker.weaponManager.setWeapon(SLOT.melee, id, 0);
    h.setArmor(target, armor.helmet, armor.chest);
    const events = h.watchDamage(target);
    h.stepSeconds(1);
    return h.withHealthCap(CAP, () => {
        target.health = CAP;
        h.hold(attacker, ATTACK);
        h.stepUntil(() => events.length > 0, 300);
        h.hold(attacker, {});
        h.step(Math.round(1 / h.dt)); // remaining damageTimes of the same swing
        target.health = 100;
        return events.map((e) => e.applied);
    });
}

function killRun(h: Harness, id: string, def: any, row: number, armor: (typeof ARMOR_SETS)[number]) {
    const { attacker, target } = meleeTarget(h, def, row);
    attacker.weaponManager.setWeapon(SLOT.melee, id, 0);
    h.setArmor(target, armor.helmet, armor.chest);
    const events = h.watchDamage(target);
    h.stepSeconds(1);
    const start = h.tick;
    h.hold(attacker, ATTACK);
    const death = h.stepUntil(() => target.dead, Math.round(30 / h.dt));
    h.hold(attacker, {});
    if (death === undefined) return { armor: armor.name, killed: false };
    return {
        armor: armor.name,
        hitsToKill: events.length,
        ttk: h.span(start, death),
        firstHitAfterInput: h.span(start, events[0].tick),
        hitIntervals: histogram(
            intervals(
                events.map((e) => e.tick),
                h.dt,
            ),
        ),
    };
}

/** Gun (ready, free switch available) -> EquipMelee with attack held: seconds until the first swing starts. */
function equipDelay(h: Harness, id: string, row: number): number | null {
    const p = h.addPlayer(h.rowPos(row, 10));
    p.debug.godMode = true;
    p.weaponManager.setWeapon(SLOT.melee, id, 0);
    h.giveGun(p, "m9");
    p.weaponManager.setCurWeapIndex(SLOT.primary);
    h.stepSeconds(2);
    const start = h.tick;
    h.press(p, ["EquipMelee"]);
    h.hold(p, ATTACK);
    const swing = h.stepUntil(() => p.animType === h.sv.GameConfig.Anim.Melee, 300);
    h.hold(p, {});
    return swing === undefined ? null : h.span(start, swing);
}

function meleeEntry(ctx: Ctx, id: string) {
    const def = ctx.defs[id];
    const h = new Harness(ctx.sv, { seed: 51 });
    let row = 0;
    const variant = (headshot: HeadshotMode) => {
        h.setMode(CENTERED, headshot);
        return ARMOR_SETS.map((armor) => {
            const perHit = [...new Set(probeDamage(h, id, def, row++, armor))];
            return { ...killRun(h, id, def, row++, armor), damagePerHit: perHit.length === 1 ? perHit[0] : perHit };
        });
    };
    h.setMode(CENTERED, "never");
    const equip = equipDelay(h, id, row++);
    return {
        def: {
            damage: def.damage,
            headshotMult: def.headshotMult,
            cooldownTime: def.attack.cooldownTime,
            damageTimes: def.attack.damageTimes,
            switchDelay: def.switchDelay,
            autoAttack: def.autoAttack,
            cleave: !!def.cleave,
            armorPiercing: !!def.armorPiercing,
            attackRad: def.attack.rad,
            attackOffset: def.attack.offset.x,
            equipSpeed: def.speed?.equip,
        },
        equipDelayFromGun: equip,
        body: variant("never"),
        headshot: variant("always"),
    };
}

export function melee(ctx: Ctx): FixtureResult {
    const weapons: Record<string, unknown> = {};
    for (const id of idsOfType(ctx.defs, "melee")) weapons[id] = meleeEntry(ctx, id);
    return {
        params: {
            random: "centered; body: headshotChance = 0, headshot: headshotChance = 1 (melee defs carry headshotMult)",
            attack: "shootHold + shootStart sent every tick (autoAttack weapons swing on hold, others on each click)",
            target: "100 HP test player standing attack.offset.x + 0.5 m in front of the attacker",
            damagePerHit: "measured with the health cap raised (never clamped)",
            ttk: "seconds from the first attack input to the end of the tick the target died",
            armorSets: ARMOR_SETS,
        },
        data: {
            notes: [
                "a swing starts when the weapon cooldown is < 0 and no melee animation plays; damage is applied at " +
                    "each attack.damageTimes offset; the next swing waits attack.cooldownTime",
                "survev ignores the melee armorPiercing flag: armor applies to melee like any non-explosion damage",
                "equipDelayFromGun: switching to melee always waits max(melee cooldown, switchDelay)",
            ],
            weapons,
        },
    };
}
