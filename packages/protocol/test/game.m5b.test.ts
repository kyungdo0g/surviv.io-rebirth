// Encoder/decoder against the simulation for the M5b building state (desert map): bots open and break doors, walk
// down the chrysanthemum bunker's stairs to the underground floor (other-floor culling), solve the saloon's bottle
// puzzle (puzzle state, sliding secret door, interior music switch), use the cellar recorder (recorder events), break
// a shack's walls until its roof collapses, use the police control panel (cell doors). Every netsync frame goes
// through a shared-cache encoder and a decoder fed by the Map message; the decoded snapshot must equal
// Game.getSnapshot within quantization tolerance.
import { type Vec2, v2 } from "@rebirth/core";
import { DamageType, Input } from "@rebirth/defs";
import {
    type Building,
    emptyInput,
    Game,
    interactObstacle,
    type Obstacle,
    type PlayerInput,
    PUZZLE_CODES,
    SNAPSHOT_EVERY_TICKS,
    type Snapshot,
    type Structure,
} from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { ClientEncoder, encodeMapMsg, MsgType, ObjectCache, ServerMsgDecoder } from "../src/index.ts";
import { assertClose } from "./close.ts";
import { snapshotTolerances } from "./gen.ts";

interface Bot {
    id: number;
    input: PlayerInput;
    encoder: ClientEncoder;
    decoder: ServerMsgDecoder;
}

function building(game: Game, type: string): Building {
    const b = game.world.buildings.find((x) => x.type === type);
    if (!b) throw new Error(`no ${type}`);
    return b;
}

function children(game: Game, b: Building, type?: string): Obstacle[] {
    const out: Obstacle[] = [];
    for (const id of b.childIds) {
        const o = game.world.get(id);
        if (o?.kind === "obstacle" && (!type || o.type === type)) out.push(o);
    }
    return out;
}

function keys(dir: Vec2): Partial<PlayerInput> {
    return { moveLeft: dir.x < -0.5, moveRight: dir.x > 0.5, moveUp: dir.y > 0.5, moveDown: dir.y < -0.5 };
}

describe("Update encoder/decoder against the simulation (M5b buildings)", () => {
    it("decoded snapshots equal getSnapshot through doors, stairs, a puzzle, a recorder and a roof collapse", () => {
        const game = new Game({ mapName: "desert", seed: 77 }, { sandbox: true });
        game.rules.minActiveTime = 0;
        const mapFrame = encodeMapMsg(game.mapData);
        const ctx = { width: game.mapData.width, height: game.mapData.height };
        const cache = new ObjectCache(ctx);
        const tol = snapshotTolerances(Math.max(ctx.width, ctx.height));
        const bots: Bot[] = [];
        let seq = 0;
        const addBot = (pos: Vec2, layer = 0): Bot => {
            const id = game.addPlayer(`bot${bots.length}`);
            game.teleportPlayer(id, pos, layer);
            const decoder = new ServerMsgDecoder();
            decoder.decode(mapFrame);
            const bot = { id, input: emptyInput(0), encoder: new ClientEncoder(cache), decoder };
            bots.push(bot);
            return bot;
        };
        const send = (bot: Bot, input: Partial<PlayerInput>) => {
            bot.input = { ...emptyInput(++seq & 0xff), toMouseDir: bot.input.toMouseDir, ...input };
            game.setInput(bot.id, bot.input);
        };

        const police = building(game, "police_01");
        const [policeDoor] = children(game, police, "house_door_01");
        const [panel] = children(game, police, "control_panel_01");
        const cells = children(game, police, "cell_door_01");
        const saloon = building(game, "saloon_01");
        const saloonStructure = game.world.get(saloon.parentStructureId) as Structure;
        const [secretDoor] = children(game, saloon, "saloon_door_secret");
        const cellar = building(game, "saloon_cellar_01");
        const [recorder] = children(game, cellar, "recorder_04");
        const shack = building(game, "shack_01");
        const shackWalls = children(game, shack).filter((o) => o.isWall);
        let bunker: Structure | undefined;
        for (const o of game.world.objects.values())
            if (o.kind === "structure" && o.type === "bunker_structure_08b") bunker = o;
        if (!bunker) throw new Error("no chrysanthemum bunker");
        const stair = bunker.stairs[0];
        const stairMid = v2.mul(v2.add(stair.collision.min, stair.collision.max), 0.5);

        const doorBot = addBot(v2.add(policeDoor.pos, v2.mul(v2.normalize(v2.sub(police.pos, policeDoor.pos)), -1.6)));
        const stairsBot = addBot(v2.sub(stairMid, v2.mul(stair.downDir, 6)));
        const saloonBot = addBot(saloon.pos);
        const cellarBot = addBot(v2.add(recorder.pos, { x: 1.5, y: 0 }), 1);
        // a viewer watching the shack's roof collapse
        addBot(v2.add(shack.pos, { x: 0, y: -12 }));
        const policeBot = addBot(police.pos);

        const totals = {
            snapshots: 0,
            openDoors: 0,
            underground: 0,
            onStairs: 0,
            puzzles: 0,
            solved: 0,
            soundAlt: 0,
            recorders: 0,
            ceilingDead: 0,
            deadDoors: 0,
        };
        const order = PUZZLE_CODES.saloon;
        const bottles = new Map(
            children(game, saloon)
                .filter((o) => o.puzzlePiece)
                .map((o) => [o.puzzlePiece, o]),
        );
        for (let tick = 1; tick <= 900; tick++) {
            for (const bot of bots) send(bot, {});
            if (tick === 10) send(doorBot, { actions: [Input.Interact] });
            send(stairsBot, {
                ...keys(stair.downDir),
                toMouseDir: stair.downDir,
                actions: tick % 40 ? [] : [Input.Interact],
            });
            if (tick >= 20 && tick < 20 + order.length) {
                interactObstacle(game, bottles.get(order[tick - 20])!, game.getPlayer(saloonBot.id)!);
            }
            if (tick === 300) interactObstacle(game, recorder, game.getPlayer(cellarBot.id)!);
            if (tick >= 100 && tick % 50 === 0) {
                const wall = shackWalls.find((w) => !w.dead);
                if (wall) game.damageObstacle(wall, { amount: 1000, damageType: DamageType.Player });
            }
            if (tick === 400) interactObstacle(game, panel, game.getPlayer(policeBot.id)!);
            if (tick === 600) game.damageObstacle(policeDoor, { amount: 1000, damageType: DamageType.Player });
            game.step();
            if (game.tick % SNAPSHOT_EVERY_TICKS !== 0) continue;
            for (const bot of bots) {
                const snap: Snapshot = game.getSnapshot(bot.id);
                const msgs = bot.decoder.decode(bot.encoder.encodeFrame(snap, bot.input.seq));
                const msg = msgs.find((m) => m.type === MsgType.Update);
                if (msg?.type !== MsgType.Update) throw new Error("expected an update");
                assertClose(msg.snapshot, snap, tol, `tick ${game.tick} player ${bot.id}`);
                totals.snapshots++;
                for (const o of snap.objects) {
                    if (o.kind === "obstacle" && o.door?.open) totals.openDoors++;
                    if (o.kind === "obstacle" && o.door && o.dead) totals.deadDoors++;
                    if (o.kind === "building" && o.puzzle) totals.puzzles++;
                    if (o.kind === "building" && o.puzzle?.solved) totals.solved++;
                    if (o.kind === "building" && o.ceilingDead) totals.ceilingDead++;
                    if (o.kind === "structure" && o.interiorSoundAlt) totals.soundAlt++;
                }
                if (snap.local.layer === 1) totals.underground++;
                if (snap.local.layer & 2) totals.onStairs++;
                totals.recorders += snap.recorders?.length ?? 0;
            }
        }
        expect(policeDoor.dead).toBe(true);
        expect(secretDoor.door?.open).toBe(true);
        expect(saloonStructure.interiorSoundAlt).toBe(true);
        expect(shack.ceilingDead).toBe(true);
        for (const c of cells) expect(c.door?.open).toBe(true);
        expect(game.getPlayer(stairsBot.id)?.layer).toBe(1);
        expect(totals.snapshots).toBeGreaterThan(1500);
        expect(totals.openDoors).toBeGreaterThan(100);
        expect(totals.deadDoors).toBeGreaterThan(0);
        expect(totals.underground).toBeGreaterThan(100);
        expect(totals.onStairs).toBeGreaterThan(0);
        expect(totals.puzzles).toBeGreaterThan(0);
        expect(totals.solved).toBeGreaterThan(0);
        expect(totals.soundAlt).toBeGreaterThan(0);
        expect(totals.recorders).toBeGreaterThan(0);
        expect(totals.ceilingDead).toBeGreaterThan(0);
    }, 60_000);
});
