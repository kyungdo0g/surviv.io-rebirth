// Personal gun taste (owner 2026-10-08: "tiers are not absolute"; some players take a MAC-10 (Uzi) over an AK-47
// because it fires faster). A drawn persona gets its own taste (persona.ts drawGunTaste, bot.ts): about a fifth of the
// bots love fire rate, and every drawn bot carries a small class bias. The S-rule still keeps the M249 and the PKP on
// top, and nobody gives an S-rule gun up for a pistol.
import { createRng } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { Bot } from "../src/bot.ts";
import { gunDesire, gunPickupValue, slotToReplaceByDesire, type Taste } from "../src/knowledge/desire.ts";
import {
    CLASS_BIAS,
    drawGunTaste,
    FIRE_RATE_LOVER_SHARE,
    fireRateBonus,
    GUN_TASTE_SALT,
    NEUTRAL,
    PERSONA_NAMES,
    PERSONAS,
    type PersonaParams,
    withPersona,
} from "../src/persona.ts";
import { giveGun, testWorld } from "./brain-world.ts";
import { flatGame } from "./helpers.ts";

const taste = (persona: Readonly<PersonaParams>, s = 0.5): Taste => ({ persona, s });
/** a looter (class affinities close to 1) that loves fire rate, and the same looter without the taste */
const lover = withPersona(PERSONAS.looter, { fireRateLove: 1 });
const plain = PERSONAS.looter;

/** A bot with nothing in its bag holding `guns` (slot index -> id). */
function holding(guns: Record<number, string>) {
    const w = testWorld();
    // testWorld starts with an MP5 in slot 0
    for (const slot of [0, 1]) w.model.self.weapons[slot] = { type: "", ammo: 0 };
    for (const [slot, id] of Object.entries(guns)) giveGun(w, Number(slot), id, undefined, 0);
    for (const k of Object.keys(w.model.self.inventory)) w.model.self.inventory[k] = 0;
    return w.model.self;
}

describe("gun taste (owner 2026-10-08)", () => {
    it("a fire-rate lover takes a MAC-10 over an AK-47 and a Vector over an M4A1; a default bot takes the AK-47", () => {
        expect(fireRateBonus("mac10", lover)).toBe(24);
        expect(fireRateBonus("ak47", lover)).toBe(0);
        expect(fireRateBonus("glock_dual", lover)).toBe(0); // pistols stay backups
        expect(gunDesire("mac10", taste(lover))).toBeGreaterThan(gunDesire("ak47", taste(lover)));
        expect(gunDesire("vector", taste(lover))).toBeGreaterThan(gunDesire("m4a1", taste(lover)));
        for (const p of [plain, NEUTRAL]) {
            expect(gunDesire("ak47", taste(p))).toBeGreaterThan(gunDesire("mac10", taste(p)));
            expect(gunDesire("m4a1", taste(p))).toBeGreaterThan(gunDesire("vector", taste(p)));
        }
        // with nothing in hand, and with only an M9 (under-armed: the lover does not count its MAC-10 as weak)
        for (const self of [holding({}), holding({ 1: "m9" })]) {
            expect(gunPickupValue(self, "mac10", taste(lover))).toBeGreaterThan(
                gunPickupValue(self, "ak47", taste(lover)),
            );
            expect(gunPickupValue(self, "ak47", taste(plain))).toBeGreaterThan(
                gunPickupValue(self, "mac10", taste(plain)),
            );
        }
        // both slots full, an AK-47 next to a Mosin: the lover gives the AK up for a MAC-10 (two tiers down, a close gun
        // next to its sniper); a default bot never drops a higher tier for a lower one
        const full = holding({ 0: "ak47", 1: "mosin" });
        expect(gunPickupValue(full, "mac10", taste(lover))).toBeGreaterThan(0);
        expect(slotToReplaceByDesire(full, taste(lover), "mac10")).toBe(0);
        expect(gunPickupValue(full, "mac10", taste(plain))).toBe(0);
        // the taste reaches two tiers at most: a MAC-10 (C+) never replaces a B+ SCAR-H
        expect(gunPickupValue(holding({ 0: "scar", 1: "mosin" }), "mac10", taste(lover))).toBe(0);
    });

    it("nobody drops an S-rule gun for a pistol, nor for a fast gun", () => {
        const fast = ["mac10", "vector", "vz61_dual", "tec9_dual", "p30l_dual", "m9", "glock_dual"];
        const tastes = [NEUTRAL, ...PERSONA_NAMES.map((n) => PERSONAS[n])].flatMap((p) => [
            p,
            withPersona(p, { fireRateLove: 1 }),
        ]);
        const both = holding({ 0: "m249", 1: "pkp" });
        const withPistol = holding({ 0: "m249", 1: "m9" });
        for (const p of tastes) {
            for (const s of [0.15, 0.5, 0.85]) {
                for (const id of fast) expect(gunPickupValue(both, id, taste(p, s)), `${p.name} ${id}`).toBe(0);
                // an M249 next to an M9: a found SMG or pistol replaces the M9, never the M249
                expect(slotToReplaceByDesire(withPistol, taste(p, s), "mac10"), p.name).toBe(1);
                expect(gunDesire("m249", taste(p, s))).toBeGreaterThan(gunDesire("vector", taste(p, s)));
            }
        }
    });

    it("about a fifth of the drawn bots love fire rate; every one carries a small class bias, never junk over better", () => {
        let lovers = 0;
        const N = 2000;
        for (let seed = 1; seed <= N; seed++) {
            const base = PERSONAS[PERSONA_NAMES[seed % PERSONA_NAMES.length]];
            const t = drawGunTaste(base, createRng(seed ^ GUN_TASTE_SALT));
            if (t.fireRateLove) lovers++;
            for (const [cls, a] of Object.entries(t.classAffinity)) {
                const b = base.classAffinity[cls as keyof typeof base.classAffinity];
                expect(a).toBeGreaterThanOrEqual(b * (1 - CLASS_BIAS) - 1e-9);
                expect(a).toBeLessThanOrEqual(b * (1 + CLASS_BIAS) + 1e-9);
            }
            // the bias alone never lifts a gun over one two tiers above it (the SMG-loving rat included)
            const plainTaste = taste(withPersona(t, { fireRateLove: 0 }));
            expect(gunDesire("ak47", plainTaste), base.name).toBeGreaterThan(gunDesire("mac10", plainTaste));
            expect(gunDesire("m4a1", plainTaste), base.name).toBeGreaterThan(gunDesire("ak47", plainTaste));
        }
        expect(lovers / N).toBeGreaterThan(FIRE_RATE_LOVER_SHARE - 0.03);
        expect(lovers / N).toBeLessThan(FIRE_RATE_LOVER_SHARE + 0.03);
    });

    it("bots draw their taste from their own seeded stream: named personas only, deterministic, opt-out", () => {
        const game = flatGame({ sandbox: true });
        const a = new Bot(game.mapData, { seed: 7, persona: "rusher" });
        const b = new Bot(game.mapData, { seed: 7, persona: "rusher" });
        expect(a.persona).not.toBe(PERSONAS.rusher);
        expect(a.persona.name).toBe("rusher");
        expect(a.persona).toEqual(b.persona);
        expect(a.persona).toEqual(drawGunTaste(PERSONAS.rusher, createRng(7 ^ GUN_TASTE_SALT)));
        expect(new Bot(game.mapData, { seed: 7 }).persona).toBe(NEUTRAL);
        expect(new Bot(game.mapData, { seed: 7, persona: "neutral" }).persona).toBe(NEUTRAL);
        expect(new Bot(game.mapData, { seed: 7, persona: PERSONAS.rusher }).persona).toBe(PERSONAS.rusher);
        expect(new Bot(game.mapData, { seed: 7, persona: "rusher", taste: false }).persona).toBe(PERSONAS.rusher);
    });
});
