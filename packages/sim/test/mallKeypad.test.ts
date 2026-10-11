// The mall's keypad (the owner's design, 2026-10-11; defs rebirth/buildings/mall.ts, mallLayout.ts MALL_KEYPAD): five
// number buttons 1 2 7 8 9 on the security office's wall; 1 9 8 7 (the year on the fallen "SINCE 1987" sign at the
// main entrance) opens the vault after survev bathhouse_01's 2 s, a wrong button is an error at once
// (`wrongPieceResets`) and the keys come back after 1 s. Use presses every button in reach (world/interact.ts), so the
// fins between the buttons must leave no spot a body can stand on from which Use reaches two of them.
import { collider, type Vec2, v2 } from "@rebirth/core";
import { MALL_CODE, MALL_KEYPAD, MALL_SIGN, MALL_VAULT_DOOR } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { rotateOri } from "../src/geom/transform.ts";
import { type Building, interactableObstacles, interactObstacle } from "../src/index.ts";
import { childObstacles, findBuilding, mapGame, placePlayer, stepSeconds } from "./buildingHelpers.ts";

const at = (b: Building, x: number, y: number): Vec2 => v2.add(b.pos, rotateOri({ x, y }, b.ori));

function keypadGame() {
    const game = mapGame("main", 12345);
    const mall = findBuilding(game, "mall_01");
    const keys = childObstacles(game, mall, "switch_03").filter((o) => o.puzzlePiece);
    const vault = childObstacles(game, mall, MALL_VAULT_DOOR.type);
    const key = (label: string) => keys.find((o) => o.puzzlePiece === label)!;
    return { game, mall, keys, vault, key };
}

describe("the mall's keypad", () => {
    it("has five labelled buttons, the code being the sign's year with a decoy left over", () => {
        const { keys, vault } = keypadGame();
        expect(keys.map((o) => o.puzzlePiece).sort()).toEqual(["1", "2", "7", "8", "9"]);
        expect(MALL_KEYPAD.map((k) => k.label)).toEqual(["1", "2", "7", "8", "9"]);
        expect(MALL_CODE.join("")).toBe("1987");
        expect(vault).toHaveLength(1);
        // the sign lies on the entrance plaza, south of the main doors (y -34) and inside the plaza (x -12..12)
        expect(MALL_SIGN.y).toBeLessThan(-35);
        expect(Math.abs(MALL_SIGN.x) + 4.4).toBeLessThan(12);
    });

    it("opens the vault on 1 9 8 7 after 2 s", () => {
        const { game, vault, key } = keypadGame();
        const p = placePlayer(game, key("1").pos);
        for (const label of MALL_CODE) interactObstacle(game, key(label), p);
        stepSeconds(game, 1.5);
        expect(vault[0].door!.open).toBe(false);
        stepSeconds(game, 1);
        expect(vault[0].door!.open).toBe(true);
    });

    it("errors at the first wrong button, the decoy or a digit out of turn, and takes the code again after 1 s", () => {
        const { game, mall, keys, vault, key } = keypadGame();
        const p = placePlayer(game, key("1").pos);
        for (const wrong of [["2"], ["1", "9", "7"], ["9"]]) {
            const err = mall.puzzle!.errSeq;
            for (const label of wrong) interactObstacle(game, key(label), p);
            // the error is at once: every key locks
            expect(mall.puzzle!.errSeq).toBe(err + 1);
            expect(keys.every((o) => !o.button!.canUse)).toBe(true);
            stepSeconds(game, 1.1);
            expect(keys.every((o) => o.button!.canUse && !o.button!.onOff)).toBe(true);
            expect(mall.puzzle!.inputCode).toEqual([]);
        }
        expect(vault[0].door!.open).toBe(false);
        for (const label of MALL_CODE) interactObstacle(game, key(label), p);
        stepSeconds(game, 2.5);
        expect(vault[0].door!.open).toBe(true);
    });

    it("gives the whole 10 s per button: four presses with 9 s between them still open it", () => {
        const { game, vault, key } = keypadGame();
        const p = placePlayer(game, key("1").pos);
        for (const label of MALL_CODE) {
            interactObstacle(game, key(label), p);
            if (label !== "7") stepSeconds(game, 9);
        }
        stepSeconds(game, 2.5);
        expect(vault[0].door!.open).toBe(true);
    });

    it("reaches one button at most from any spot a body fits, and each button from its own front", () => {
        const { game, mall, keys } = keypadGame();
        const p = placePlayer(game, at(mall, 0, 20));
        const rad = p.rad;
        const blockers = [...game.world.objects.values()].filter(
            (o) => o.kind === "obstacle" && !o.dead && o.def.collidable && v2.distance(o.pos, p.pos) < 30,
        );
        const fits = (pos: Vec2) =>
            blockers.every(
                (o) => o.kind !== "obstacle" || !collider.intersect(collider.createCircle(pos, rad), o.collider),
            );
        let spots = 0;
        let worst = 0;
        // the office in front of the keypad (x 3..13.5, y 18.5..22.5 in the mall's frame), every 0.05 units
        for (let x = 3; x <= 13.5; x += 0.05) {
            for (let y = 18.5; y <= 22.5; y += 0.05) {
                const pos = at(mall, x, y);
                if (!fits(pos)) continue;
                spots++;
                p.pos = pos;
                const reached = interactableObstacles(game, p).filter((o) => keys.includes(o));
                worst = Math.max(worst, reached.length);
            }
        }
        expect(spots).toBeGreaterThan(500);
        expect(worst).toBe(1);
        for (const k of MALL_KEYPAD) {
            // the body before the button's front (within its width), as far in as the fins and the walls let it
            let reached: string[] = [];
            for (let y = 19.6; y < 21.5 && !reached.length; y += 0.02) {
                for (let dx = -0.45; dx <= 0.45 && !reached.length; dx += 0.05) {
                    const pos = at(mall, k.x + dx, y);
                    if (!fits(pos)) continue;
                    p.pos = pos;
                    reached = interactableObstacles(game, p)
                        .filter((o) => keys.includes(o))
                        .map((o) => o.puzzlePiece);
                }
            }
            expect([k.label, reached]).toEqual([k.label, [k.label]]);
        }
    });
});
