// Synthetic worlds for the brain feature tests: a WorldModel on the flat map with the bot's own state, contacts,
// obstacles and gas set by hand (no simulation), synthetic intel and threat providers, and a BrainCtx built by the real
// Brain.context for a chosen feature set.
import { createRng, type Vec2, v2 } from "@rebirth/core";
import { getDefOfType, type ObstacleDef } from "@rebirth/defs";
import type { GasView, MapData, Snapshot } from "@rebirth/sim";
import { Brain } from "../src/brain/brain.ts";
import type { BrainCtx } from "../src/brain/context.ts";
import { BRAIN_PRESETS, type BrainFeature, type BrainFeatures, withFeatures } from "../src/brain/features.ts";
import { DIFFICULTY_PRESETS, type Difficulty } from "../src/difficulty.ts";
import { obstacleCollider, obstacleDef } from "../src/geom.ts";
import type { EnemyIntel, EnemyIntelProvider } from "../src/perception/intel.ts";
import type {
    AirdropIntel,
    DangerZone,
    ReportedThreat,
    ThreatBoard,
    UnseenShooter,
} from "../src/perception/threats.ts";
import { type Contact, type SelfState, WorldModel } from "../src/perception/world.ts";
import { flatGame, openSpot } from "./helpers.ts";

export const NOW = 100;

export interface TestWorld {
    model: WorldModel;
    /** the bot's position */
    spot: Vec2;
}

const game = flatGame({ sandbox: true });
const SPOT = openSpot(game);

/** A bot on the flat map at an open spot (or on `map` at `at`), full health, an mp5 with a full magazine and 90 rounds in the bag. */
export function testWorld(map: MapData = game.mapData, at: Vec2 = SPOT): TestWorld {
    const model = new WorldModel(map);
    model.selfId = 1;
    model.time = NOW;
    model.snapshots = 10;
    const self: SelfState = {
        id: 1,
        pos: v2.copy(at),
        dir: { x: 1, y: 0 },
        layer: 0,
        health: 100,
        boost: 0,
        zoom: 28,
        dead: false,
        downed: false,
        weapons: [
            { type: "mp5", ammo: 30 },
            { type: "", ammo: 0 },
            { type: "fists", ammo: 0 },
            { type: "", ammo: 0 },
        ],
        curWeapIdx: 0,
        inventory: { "9mm": 90 },
        scope: "1xscope",
        helmet: "",
        chest: "",
        backpack: "backpack02",
        action: { type: "none", item: "", time: 0, duration: 0, targetId: 0 },
        cooldowns: [0, 0, 0, 0],
        kills: 0,
    };
    model.self = self;
    model.aliveCount = 40;
    return { model, spot: v2.copy(at) };
}

/** A gun in `slot` with `mag` rounds loaded and `reserve` of its ammo in the bag. */
export function giveGun(w: TestWorld, slot: number, type: string, mag?: number, reserve = 90): void {
    const def = getDefOfType("gun", type);
    w.model.self.weapons[slot] = { type, ammo: mag ?? def.maxClip };
    w.model.self.inventory[def.ammo] = reserve;
}

/** A standing enemy contact `off` from the bot, visible, seen for 5 s, facing +x, holding an mp5. */
export function addEnemy(w: TestWorld, id: number, off: Vec2, over: Partial<Contact> = {}): Contact {
    const c: Contact = {
        id,
        pos: v2.add(w.spot, off),
        vel: { x: 0, y: 0 },
        dir: { x: 1, y: 0 },
        layer: 0,
        dead: false,
        downed: false,
        activeWeapon: "mp5",
        helmet: "",
        chest: "",
        visible: true,
        lastSeen: NOW,
        firstSeen: NOW - 5,
        teammate: false,
        lastShotAt: Number.NEGATIVE_INFINITY,
        shotSeq: 0,
        reviving: false,
        lastArmedAt: NOW,
        ...over,
    };
    w.model.contacts.set(id, c);
    return c;
}

/** Faces contact `c` towards `p`. */
export function faceTo(c: Contact, p: Vec2): void {
    c.dir = v2.normalizeSafe(v2.sub(p, c.pos));
}

let nextObstacleId = 5000;

/** A bullet-stopping obstacle of `type` (default a crate) at `off` from the bot. */
export function addObstacle(w: TestWorld, off: Vec2, type = "crate_01"): void {
    const def = obstacleDef(type) as ObstacleDef;
    const pos = v2.add(w.spot, off);
    const id = nextObstacleId++;
    const seen = {
        view: { kind: "obstacle" as const, id, type, pos, layer: 0, ori: 0, scale: 1, healthT: 1, dead: false },
        def,
        col: obstacleCollider(def, pos, 0, 1),
        blocksBullets: true,
        blocksMove: true,
    };
    w.model.obstacles.push(seen);
    w.model.obstacleById.set(id, seen);
}

/** A gas view: `mode` with the next circle at `off` from the bot with radius `radNew`. */
export function setGas(w: TestWorld, off: Vec2, radNew: number, mode: GasView["mode"] = "waiting"): void {
    const pos = v2.add(w.spot, off);
    w.model.gas = {
        mode,
        stage: 3,
        circleIdx: 1,
        duration: 60,
        gasT: 0,
        posOld: pos,
        posNew: pos,
        radOld: radNew * 2,
        radNew,
        damage: 2,
    };
}

/** Intel from a table (unknown players look fresh). */
export class TableIntel implements EnemyIntelProvider {
    readonly table = new Map<number, Partial<EnemyIntel>>();
    of(id: number): Readonly<EnemyIntel> {
        return { estHealth: 100, action: null, justFought: false, ...this.table.get(id) };
    }
    ingest(_snap: Snapshot, _model: WorldModel): void {}
}

/** A threat board with fixed contents. */
export class FixedBoard implements ThreatBoard {
    shooters: UnseenShooter[] = [];
    reports: ReportedThreat[] = [];
    zones: DangerZone[] = [];
    drops: AirdropIntel[] = [];
    hot: Array<{ pos: Vec2; heat: number }> = [];
    heat(pos: Vec2, r: number): number {
        let h = 0;
        for (const s of this.hot) if (v2.distance(s.pos, pos) < r) h += s.heat;
        return h;
    }
    unseenShooters(): readonly UnseenShooter[] {
        return this.shooters;
    }
    reported(): readonly ReportedThreat[] {
        return this.reports;
    }
    dangerZones(): readonly DangerZone[] {
        return this.zones;
    }
    airdrops(): readonly AirdropIntel[] {
        return this.drops;
    }
    ingest(_snap: Snapshot, _model: WorldModel): void {}
}

/** The Brain of `w` with the baseline plus `features` (or a whole feature set). */
export function brainOf(
    w: TestWorld,
    features: readonly BrainFeature[] | Readonly<BrainFeatures>,
    difficulty: Difficulty = "normal",
    seed = 1,
): Brain {
    const f = Array.isArray(features) ? withFeatures(BRAIN_PRESETS.baseline, features) : (features as BrainFeatures);
    return new Brain(w.model, DIFFICULTY_PRESETS[difficulty], createRng(seed), f);
}

/** A BrainCtx of `w` at NOW (the real Brain.context: target selection, assessment). */
export function ctxOf(w: TestWorld, features: readonly BrainFeature[], difficulty: Difficulty = "normal"): BrainCtx {
    return brainOf(w, features, difficulty).context(NOW);
}
