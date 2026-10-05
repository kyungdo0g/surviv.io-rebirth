// What a bot knows: built only from its own snapshots (what a real client receives) plus the static MapData. Players
// under a roof the bot is not under are hidden (the original client draws the ceiling over them), players in smoke
// are already left out of the snapshot by the simulation. Enemies that leave view are remembered for a while with
// their last position and estimated velocity; loot is remembered until the bot sees its spot empty.
import { type Bounds, type Collider, type Vec2, v2 } from "@rebirth/core";
import { GameConfig, type ObstacleDef } from "@rebirth/defs";
import {
    type BuildingView,
    type BulletEvent,
    type GasView,
    gasCircle,
    type LocalPlayerState,
    type MapData,
    type ObstacleView,
    type PlayerView,
    type ProjectileView,
    type SmokeView,
    type Snapshot,
    type TeamMemberView,
    viewBounds,
} from "@rebirth/sim";
import { distToSegment, obstacleCollider, obstacleDef, pointInBounds } from "../geom.ts";
import { gunInfo } from "../knowledge/weapons.ts";
import { NavGrid } from "../nav/grid.ts";
import { roofRegions } from "./roofs.ts";

const BULLET_HEIGHT = GameConfig.bullet.height;
/** Remembered loot is forgotten after this long without being seen. */
const LOOT_MEMORY = 90;
/** A bullet passing this close counts as being shot at. */
const NEAR_MISS = 3;

export interface SelfState {
    id: number;
    pos: Vec2;
    dir: Vec2;
    layer: number;
    health: number;
    boost: number;
    zoom: number;
    dead: boolean;
    downed: boolean;
    weapons: Array<{ type: string; ammo: number }>;
    curWeapIdx: number;
    inventory: Record<string, number>;
    scope: string;
    helmet: string;
    chest: string;
    backpack: string;
    action: { type: string; item: string; time: number; duration: number; targetId: number };
    cooldowns: number[];
    kills: number;
}

export interface Contact {
    id: number;
    pos: Vec2;
    vel: Vec2;
    dir: Vec2;
    layer: number;
    dead: boolean;
    downed: boolean;
    activeWeapon: string;
    helmet: string;
    chest: string;
    /** in the latest snapshot (and not hidden under a roof) */
    visible: boolean;
    lastSeen: number;
    /** start of the current continuous sighting (reaction delay) */
    firstSeen: number;
    teammate: boolean;
    /** last time this player fired (shot seq change or a bullet of it), -Infinity when never seen firing */
    lastShotAt: number;
    shotSeq: number;
    /** being revived / reviving (action type "revive") */
    reviving: boolean;
    /** last time this player was seen holding a gun (it keeps it when it switches to its fists) */
    lastArmedAt: number;
}

export interface SeenLoot {
    id: number;
    type: string;
    pos: Vec2;
    count: number;
    layer: number;
    lastSeen: number;
}

export interface SeenObstacle {
    view: ObstacleView;
    def: ObstacleDef;
    col: Collider;
    /** stops bullets: collidable, alive and at least bullet height */
    blocksBullets: boolean;
    /** blocks movement */
    blocksMove: boolean;
}

function emptySelf(): SelfState {
    return {
        id: 0,
        pos: { x: 0, y: 0 },
        dir: { x: 1, y: 0 },
        layer: 0,
        health: 100,
        boost: 0,
        zoom: 28,
        dead: false,
        downed: false,
        weapons: [],
        curWeapIdx: 2,
        inventory: {},
        scope: "1xscope",
        helmet: "",
        chest: "",
        backpack: "",
        action: { type: "none", item: "", time: 0, duration: 0, targetId: 0 },
        cooldowns: [0, 0, 0, 0],
        kills: 0,
    };
}

export class WorldModel {
    readonly map: MapData;
    readonly nav: NavGrid;
    selfId = 0;
    time = 0;
    tick = 0;
    snapshots = 0;
    self: SelfState = emptySelf();
    readonly contacts = new Map<number, Contact>();
    obstacles: SeenObstacle[] = [];
    readonly obstacleById = new Map<number, SeenObstacle>();
    buildings: BuildingView[] = [];
    readonly loot = new Map<number, SeenLoot>();
    gas: GasView | null = null;
    team: TeamMemberView[] = [];
    readonly teammates = new Set<number>();
    readonly groupOf = new Map<number, number>();
    /** team (side) of every player from PlayerInfos: solo per player, duo / squad the group, 50v50 the faction */
    readonly teamOf = new Map<number, number>();
    projectiles: ProjectileView[] = [];
    smokes: SmokeView[] = [];
    bullets: BulletEvent[] = [];
    /** the last bullet that passed close: where it came from */
    underFire: { time: number; from: Vec2; shooterId: number } | null = null;
    /** last time the bot lost health to something other than the gas */
    lastHurt = Number.NEGATIVE_INFINITY;
    /** last time the bot lost health at all */
    lastHealthLoss = Number.NEGATIVE_INFINITY;
    gameOver = false;
    aliveCount = 0;
    view: Bounds = { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
    /** how long enemies are remembered after leaving view */
    memory = 4;
    private obstacleCache = new Map<number, SeenObstacle>();
    private readonly roofCache = new Map<number, Bounds[]>();

    constructor(map: MapData, nav: NavGrid = NavGrid.forMap(map)) {
        this.map = map;
        this.nav = nav;
    }

    get myGroup(): number | undefined {
        return this.groupOf.get(this.selfId);
    }

    isTeammate(id: number): boolean {
        if (id === this.selfId || this.teammates.has(id)) return true;
        // 50v50: the whole faction is friendly (PlayerInfos teamId is the faction; no friendly fire, M7a)
        const t = this.teamOf.get(id);
        const myTeam = this.teamOf.get(this.selfId);
        if (t !== undefined && myTeam !== undefined && t === myTeam && this.team.length > 0) return true;
        const g = this.groupOf.get(id);
        const mine = this.myGroup;
        return g !== undefined && mine !== undefined && g === mine && this.team.length > 0;
    }

    observe(snap: Snapshot): void {
        this.snapshots++;
        this.time = snap.time;
        this.tick = snap.tick;
        if (this.selfId === 0) this.selfId = snap.localPlayerId;
        for (const info of snap.playerInfos ?? []) {
            this.groupOf.set(info.playerId, info.groupId);
            this.teamOf.set(info.playerId, info.teamId);
        }
        for (const id of snap.deletedPlayerIds ?? []) this.contacts.delete(id);
        if (snap.gameOver) this.gameOver = true;
        if (snap.aliveCount !== undefined) this.aliveCount = snap.aliveCount;
        // while spectating, the snapshot follows someone else: keep the last own state
        const spectating = (snap.spectatingId ?? 0) !== 0 || snap.localPlayerId !== this.selfId;
        if (snap.gas) this.gas = snap.gas;
        if (spectating) {
            this.self.dead = true;
            return;
        }
        let me: PlayerView | undefined;
        for (const o of snap.objects) {
            if (o.kind === "player" && o.id === this.selfId) {
                me = o;
                break;
            }
        }
        this.updateSelf(snap.local, me);
        this.view = viewBounds(this.self.pos, this.self.zoom);
        this.team = snap.local.team ?? [];
        this.teammates.clear();
        for (const m of this.team) if (m.playerId !== this.selfId) this.teammates.add(m.playerId);
        this.projectiles = snap.projectiles ?? [];
        this.smokes = snap.smokes ?? [];
        this.bullets = snap.bullets ?? [];
        this.updateObjects(snap);
        this.updateBullets();
    }

    private updateSelf(local: LocalPlayerState, me: PlayerView | undefined): void {
        const s = this.self;
        const prevHealth = s.health;
        s.id = this.selfId;
        if (me) {
            s.pos = v2.copy(me.pos);
            s.dir = v2.copy(me.dir);
            s.downed = me.downed;
            s.layer = me.layer;
        }
        s.health = local.health;
        s.boost = local.boost;
        s.zoom = local.zoom;
        s.dead = !!local.dead || !!me?.dead;
        s.weapons = local.weapons.map((w) => ({ type: w.type, ammo: w.ammo }));
        s.curWeapIdx = local.curWeapIdx;
        s.inventory = { ...local.inventory };
        s.scope = local.scope ?? "1xscope";
        s.helmet = local.helmet ?? "";
        s.chest = local.chest ?? "";
        s.backpack = local.backpack ?? "";
        const a = local.action;
        s.action = a
            ? { type: a.type, item: a.item, time: a.time, duration: a.duration, targetId: a.targetId ?? 0 }
            : { type: "none", item: "", time: 0, duration: 0, targetId: 0 };
        s.cooldowns = local.cooldowns?.weapons ?? [0, 0, 0, 0];
        s.kills = local.kills ?? 0;
        if (this.snapshots > 1 && s.health < prevHealth - 1e-6 && !s.downed) {
            this.lastHealthLoss = this.time;
            if (!this.inGasNow()) this.lastHurt = this.time;
        }
    }

    /** The bot stands in the red zone right now. */
    inGasNow(): boolean {
        const gas = this.gas;
        if (!gas || gas.mode === "inactive") return false;
        const c = gasCircle(gas);
        return v2.distance(this.self.pos, c.pos) >= c.rad;
    }

    private updateObjects(snap: Snapshot): void {
        const now = this.time;
        this.buildings = [];
        for (const o of snap.objects) if (o.kind === "building") this.buildings.push(o);
        const selfPos = this.self.pos;
        // roofs over someone else's head: the ones the bot is not under
        const roofs = roofRegions(this.buildings, this.roofCache).filter(
            (r) => !r.regions.some((b) => pointInBounds(selfPos, b)),
        );
        const hidden = (p: Vec2): boolean => {
            for (const r of roofs) {
                for (const b of r.regions) if (pointInBounds(p, b)) return true;
            }
            return false;
        };
        for (const c of this.contacts.values()) c.visible = false;
        this.obstacles = [];
        this.obstacleById.clear();
        const seenLoot = new Set<number>();
        for (const o of snap.objects) {
            switch (o.kind) {
                case "player":
                    if (o.id !== this.selfId && !hidden(o.pos)) this.updateContact(o, now);
                    break;
                case "obstacle": {
                    const seen = this.seeObstacle(o);
                    if (seen) {
                        this.obstacles.push(seen);
                        this.obstacleById.set(o.id, seen);
                    }
                    break;
                }
                case "loot":
                    if (hidden(o.pos)) break;
                    seenLoot.add(o.id);
                    this.loot.set(o.id, {
                        id: o.id,
                        type: o.type,
                        pos: v2.copy(o.pos),
                        count: o.count,
                        layer: o.layer,
                        lastSeen: now,
                    });
                    break;
                default:
                    break;
            }
        }
        // forget loot whose spot is in plain view but empty, and loot not seen for a long time
        const inner = {
            min: { x: this.view.min.x + 2, y: this.view.min.y + 2 },
            max: { x: this.view.max.x - 2, y: this.view.max.y - 2 },
        };
        for (const [id, l] of this.loot) {
            if (seenLoot.has(id)) continue;
            if (now - l.lastSeen > LOOT_MEMORY || (pointInBounds(l.pos, inner) && !hidden(l.pos))) this.loot.delete(id);
        }
        for (const [id, c] of this.contacts) {
            if (c.dead || (!c.visible && now - c.lastSeen > this.memory + 1)) this.contacts.delete(id);
        }
    }

    private updateContact(o: PlayerView, now: number): void {
        let c = this.contacts.get(o.id);
        const teammate = this.isTeammate(o.id);
        const shotSeq = o.shot?.seq ?? 0;
        if (!c) {
            c = {
                id: o.id,
                pos: v2.copy(o.pos),
                vel: { x: 0, y: 0 },
                dir: v2.copy(o.dir),
                layer: o.layer,
                dead: o.dead,
                downed: o.downed,
                activeWeapon: o.activeWeapon,
                helmet: o.helmet,
                chest: o.chest,
                visible: true,
                lastSeen: now,
                firstSeen: now,
                teammate,
                lastShotAt: Number.NEGATIVE_INFINITY,
                shotSeq,
                reviving: o.action?.type === "revive",
                lastArmedAt: gunInfo(o.activeWeapon) ? now : Number.NEGATIVE_INFINITY,
            };
            this.contacts.set(o.id, c);
            return;
        }
        const dt = now - c.lastSeen;
        if (dt > 0.6) {
            // a new sighting: reaction delay starts over, velocity unknown
            c.firstSeen = now;
            c.vel = { x: 0, y: 0 };
        } else if (dt > 1e-6) {
            const inst = v2.div(v2.sub(o.pos, c.pos), dt);
            c.vel = v2.lerp(0.5, c.vel, inst);
        }
        if (shotSeq !== c.shotSeq) c.lastShotAt = now;
        c.shotSeq = shotSeq;
        c.pos = v2.copy(o.pos);
        c.dir = v2.copy(o.dir);
        c.layer = o.layer;
        c.dead = o.dead;
        c.downed = o.downed;
        c.activeWeapon = o.activeWeapon;
        c.helmet = o.helmet;
        c.chest = o.chest;
        c.visible = true;
        c.lastSeen = now;
        c.teammate = teammate;
        c.reviving = o.action?.type === "revive";
        if (gunInfo(o.activeWeapon)) c.lastArmedAt = now;
    }

    private seeObstacle(o: ObstacleView): SeenObstacle | undefined {
        this.nav.observeObstacle(o);
        const cached = this.obstacleCache.get(o.id);
        if (
            cached &&
            cached.view.pos.x === o.pos.x &&
            cached.view.pos.y === o.pos.y &&
            cached.view.ori === o.ori &&
            cached.view.scale === o.scale &&
            cached.view.dead === o.dead
        ) {
            cached.view = o;
            return cached;
        }
        const def = obstacleDef(o.type);
        if (!def) return undefined;
        const alive = !o.dead && def.collidable;
        const seen: SeenObstacle = {
            view: o,
            def,
            col: obstacleCollider(def, o.pos, o.ori, o.scale),
            blocksBullets: alive && def.height >= BULLET_HEIGHT,
            blocksMove: alive,
        };
        this.obstacleCache.set(o.id, seen);
        return seen;
    }

    private updateBullets(): void {
        const me = this.self.pos;
        for (const b of this.bullets) {
            if (b.shooterId === this.selfId || this.isTeammate(b.shooterId)) continue;
            const c = this.contacts.get(b.shooterId);
            if (c) c.lastShotAt = this.time;
            const end = v2.add(b.pos, v2.mul(b.dir, b.endDist ?? b.maxDist));
            if (distToSegment(me, b.pos, end) < NEAR_MISS && v2.dot(v2.sub(me, b.pos), b.dir) > 0) {
                this.underFire = { time: this.time, from: v2.copy(b.pos), shooterId: b.shooterId };
            }
        }
    }

    /** No visible bullet-stopping obstacle between a and b. */
    lineOfFire(a: Vec2, b: Vec2): boolean {
        for (const o of this.obstacles) {
            if (!o.blocksBullets) continue;
            if (segmentHitsCollider(o.col, a, b)) return false;
        }
        return true;
    }

    /** Living enemies, visible or remembered. */
    enemies(): Contact[] {
        const out: Contact[] = [];
        for (const c of this.contacts.values()) if (!c.teammate && !c.dead) out.push(c);
        return out;
    }

    /** Whether `p` is inside the next safe circle (with `margin` units to spare). */
    insideSafeZone(p: Vec2, margin = 0): boolean {
        const gas = this.gas;
        if (!gas || gas.mode === "inactive") return true;
        return v2.distance(p, gas.posNew) < gas.radNew - margin;
    }

    /** Whether `p` is inside the current red-zone circle (with margin). */
    insideCurrentCircle(p: Vec2, margin = 0): boolean {
        const gas = this.gas;
        if (!gas || gas.mode === "inactive") return true;
        const c = gasCircle(gas);
        return v2.distance(p, c.pos) < c.rad - margin;
    }
}

function segmentHitsCollider(col: Collider, a: Vec2, b: Vec2): boolean {
    // quick reject on the bounding box
    if (col.type === 0) {
        if (distToSegment(col.pos, a, b) > col.rad) return false;
        return true;
    }
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    if (maxX < col.min.x || minX > col.max.x || maxY < col.min.y || minY > col.max.y) return false;
    // slab test
    let t0 = 0;
    let t1 = 1;
    const d = { x: b.x - a.x, y: b.y - a.y };
    for (const axis of ["x", "y"] as const) {
        const da = d[axis];
        if (Math.abs(da) < 1e-9) {
            if (a[axis] < col.min[axis] || a[axis] > col.max[axis]) return false;
            continue;
        }
        let ta = (col.min[axis] - a[axis]) / da;
        let tb = (col.max[axis] - a[axis]) / da;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
        if (t0 > t1) return false;
    }
    return true;
}
