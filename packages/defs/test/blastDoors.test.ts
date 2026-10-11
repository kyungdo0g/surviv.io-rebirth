// The explosion-gated doors of the wave 3 buildings (the owner, 2026-10-10; rebirth/buildings/blastDoors.ts): wall-like
// steel slabs only explosions open, the blast door to counted launcher hits (the owner, 2026-10-11: one M202 rocket, two
// NLAW rounds, six RPG-7 rockets), the subway gate to launcher rounds and air strike bombs. The gate itself is applied by the sim (packages/sim combat.ts canDamageObstacle).
import { describe, expect, it } from "vitest";
import {
    BLAST_DOOR,
    BLAST_DOOR_ART,
    BLAST_DOOR_HITS_TO_OPEN,
    getDefOfType,
    getMapObjectDefOfType,
    hasDef,
    rebirthBuildingArt,
    SUBWAY_GATE,
    SUBWAY_GATE_EXPLOSIONS,
} from "../src/index.ts";

/** One hit's obstacle damage of an explosion at its centre. */
const centreHit = (id: string) => {
    const e = getDefOfType("explosion", id);
    return e.damage * e.obstacleDamage;
};

describe("explosion-gated doors", () => {
    it("are collidable, destructible, wall-high slabs blocking a 4-unit doorway, with steel sounds", () => {
        for (const [type, health, width] of [
            [BLAST_DOOR, 2000, 1.5],
            [SUBWAY_GATE, 300, 1],
        ] as const) {
            const d = getMapObjectDefOfType("obstacle", type);
            expect([d.collidable, d.destructible, d.isWall, d.height, d.health]).toEqual([
                true,
                true,
                false,
                10,
                health,
            ]);
            expect(d.extents).toEqual({ x: width / 2, y: 2 });
            expect([d.hitParticle, d.sound.bullet, d.sound.punch]).toEqual([
                "barrelChip",
                "wall_bullet",
                "metal_punch",
            ]);
            // the sprite covers the collider (64 px per unit at scale 0.25 = 16 px per unit on screen, as walls)
            const art = BLAST_DOOR_ART.find((a) => a.floor === d.img.sprite);
            expect(art?.size.map((s) => (s * (d.img.scale ?? 1)) / 16)).toEqual([width, 4]);
            expect(rebirthBuildingArt()).toContain(art);
        }
    });

    it("the blast door opens to one M202 rocket, two NLAW rounds or six RPG-7 rockets, nothing else", () => {
        const gate = getMapObjectDefOfType("obstacle", BLAST_DOOR).explosionGate;
        expect(gate).toEqual({ hitsToOpen: BLAST_DOOR_HITS_TO_OPEN });
        expect(BLAST_DOOR_HITS_TO_OPEN).toEqual({ explosion_m202: 1, explosion_nlaw: 2, explosion_rpg7: 6 });
        for (const id of Object.keys(BLAST_DOOR_HITS_TO_OPEN)) expect([id, hasDef(id)]).toEqual([id, true]);
        // the launchers' rounds really carry those explosions
        for (const [bullet, explosion] of [
            ["bullet_m202", "explosion_m202"],
            ["bullet_nlaw", "explosion_nlaw"],
            ["bullet_rpg7", "explosion_rpg7"],
        ]) {
            expect((getDefOfType("bullet", bullet) as { onHit?: string }).onHit).toBe(explosion);
        }
    });

    it("the buffed NLAW round hits harder than an RPG-7 round; the M202 volley still deals the most", () => {
        const round = (gun: string) => {
            const b = getDefOfType("bullet", `bullet_${gun}`);
            return b.damage + getDefOfType("explosion", `explosion_${gun}`).damage;
        };
        expect(round("nlaw")).toBeGreaterThan(round("rpg7"));
        expect(round("m202") * 4).toBeGreaterThan(round("nlaw"));
        expect(getDefOfType("explosion", "explosion_nlaw").rad.max).toBe(
            getDefOfType("explosion", "explosion_m202").rad.max,
        );
        // still three blasts for the 300-health subway gate (its rule is unchanged)
        expect(Math.ceil(300 / centreHit("explosion_nlaw"))).toBe(3);
    });

    it("the subway gate opens to every launcher and air strike explosion, never a grenade or a barrel", () => {
        const gate = getMapObjectDefOfType("obstacle", SUBWAY_GATE).explosionGate;
        expect(gate).toEqual({ explosionTypes: SUBWAY_GATE_EXPLOSIONS });
        for (const id of SUBWAY_GATE_EXPLOSIONS) expect([id, hasDef(id)]).toEqual([id, true]);
        for (const id of ["explosion_frag", "explosion_mirv", "explosion_barrel", "explosion_stove"]) {
            expect(SUBWAY_GATE_EXPLOSIONS).not.toContain(id);
        }
        // every launcher's own explosion is listed
        for (const gun of ["m202", "rpg7", "nlaw", "panzerfaust", "bazooka", "paw20", "m79", "gl06"]) {
            expect(SUBWAY_GATE_EXPLOSIONS).toContain(`explosion_${gun}`);
        }
    });
});
