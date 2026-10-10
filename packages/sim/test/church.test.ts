// The church (the owner's wave 3, 2026-10-10; packages/defs rebirth/buildings/church.ts): its brittle shell brings the
// whole church down once 40 % of its pieces are broken, killing everyone inside and burying its furniture and loot
// (sim world/collapse.ts); the reliquary opens on the bell code only; the bell tower gives the lookout's 4x view.
import { type Vec2, v2 } from "@rebirth/core";
import {
    CHURCH_BRITTLE_PIECES,
    CHURCH_CODE,
    CHURCH_COLLAPSE_WALLS,
    CHURCH_RELIQUARY_DOOR,
    CHURCH_TOWER,
    DamageType,
    getMapObjectDefOfType,
    LOOKOUT_ZOOM,
} from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { rotateOri } from "../src/geom/transform.ts";
import { type Building, Game, interactObstacle, type Obstacle } from "../src/index.ts";
import { generateShowcase } from "../src/mapgen/showcase.ts";
import { childObstacles, placePlayer, stepSeconds } from "./buildingHelpers.ts";

const TYPE = "church_01";

/** A sandbox game on the church's showcase map. */
function churchGame(): { game: Game; church: Building } {
    const show = generateShowcase(TYPE, 1);
    const game = new Game(
        { mapName: show.mapName, seed: 1 },
        { generation: show.generation, spawnLoot: true, sandbox: true },
    );
    const church = game.world.buildings.find((b) => b.type === TYPE);
    if (!church) throw new Error("no church");
    return { game, church };
}

/** A church-local point in world space. */
const at = (b: Building, x: number, y: number): Vec2 => v2.add(b.pos, rotateOri({ x, y }, b.ori));

const live = (game: Game, b: Building): Obstacle[] =>
    b.childIds.map((id) => game.world.get(id)).filter((o): o is Obstacle => o?.kind === "obstacle" && !o.dead);

describe("the church", () => {
    it("caves in at 40 % of its brittle shell: everyone inside is buried with its furniture and loot", () => {
        const def = getMapObjectDefOfType("building", TYPE);
        expect(CHURCH_BRITTLE_PIECES).toBeGreaterThanOrEqual(15);
        expect(def.ceiling.destroy).toMatchObject({ wallCount: CHURCH_COLLAPSE_WALLS, collapse: true });
        expect(CHURCH_COLLAPSE_WALLS).toBe(Math.round(CHURCH_BRITTLE_PIECES * 0.4));

        const { game, church } = churchGame();
        const inNave = placePlayer(game, at(church, 0, 0));
        const inTower = placePlayer(game, at(church, 0, -18));
        const outside = placePlayer(game, at(church, 0, -34));
        const shooter = placePlayer(game, at(church, 26, 0));
        // loot on the church's floor (its local frame: 34 x 52 inside)
        const lootInside = () =>
            [...game.world.objects.values()].filter((o) => {
                if (o.kind !== "loot") return false;
                const q = rotateOri(v2.sub(o.pos, church.pos), (4 - church.ori) % 4);
                return Math.abs(q.x) < 17 && Math.abs(q.y) < 26;
            }).length;
        expect(lootInside()).toBeGreaterThan(5);

        const brittle = live(game, church).filter((o) => o.type.startsWith("rebirth_wall_brk_"));
        expect(brittle).toHaveLength(CHURCH_BRITTLE_PIECES);
        const pews = live(game, church).filter((o) => o.type === "couch_01");
        expect(pews).toHaveLength(8);
        const hit = (w: Obstacle) =>
            game.damageObstacle(w, {
                amount: 1000,
                damageType: DamageType.Player,
                gameSourceType: "ak47",
                sourceId: shooter.id,
            });
        for (const w of brittle.slice(0, CHURCH_COLLAPSE_WALLS - 1)) hit(w);
        // one piece short: the church stands
        expect([church.ceilingDead, inNave.dead, inTower.dead]).toEqual([false, false, false]);
        expect(pews.every((p) => !p.dead)).toBe(true);

        hit(brittle[CHURCH_COLLAPSE_WALLS - 1]);
        expect(church.ceilingDead).toBe(true);
        expect([inNave.dead, inTower.dead, outside.dead, shooter.dead]).toEqual([true, true, false, false]);
        expect(inNave.killedBy).toBe(shooter.id);
        expect(live(game, church)).toEqual([]);
        expect(lootInside()).toBe(0);
    });

    it("opens the reliquary on the bell code only", () => {
        const { game, church } = churchGame();
        const switches = childObstacles(game, church, "switch_03").filter((o) => o.puzzlePiece);
        const doors = childObstacles(game, church, CHURCH_RELIQUARY_DOOR.type);
        expect([switches.length, doors.length]).toEqual([3, 1]);
        const piece = (label: string) => switches.find((o) => o.puzzlePiece === label)!;
        const p = placePlayer(game, at(church, 0, 0));
        interactObstacle(game, doors[0], p);
        for (const label of [...CHURCH_CODE].reverse()) interactObstacle(game, piece(label), p);
        stepSeconds(game, 3);
        expect(doors[0].door!.open).toBe(false);
        for (const label of CHURCH_CODE) interactObstacle(game, piece(label), p);
        stepSeconds(game, 2.5);
        expect(doors[0].door!.open).toBe(true);
    });

    it("gives the 4x view in the bell tower only", () => {
        const { game, church } = churchGame();
        const t = CHURCH_TOWER;
        const p = placePlayer(game, at(church, (t.min.x + t.max.x) / 2, (t.min.y + t.max.y) / 2));
        stepSeconds(game, 0.2);
        expect(p.zoom).toBe(LOOKOUT_ZOOM);
        game.teleportPlayer(p.id, at(church, 0, 0), 0);
        stepSeconds(game, 0.2);
        expect(p.zoom).toBeLessThan(LOOKOUT_ZOOM);
    });
});
