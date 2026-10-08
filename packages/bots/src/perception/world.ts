// What a bot knows: built only from its own snapshots (what a real client receives) plus the static MapData, cut down
// to what the client draws on its 16:9 screen (perception/sight.ts; bot overhaul COMBAT-1/2, both brains): enemies,
// loot and grenades in the snapshot's margin are not on the screen and so not seen; bullets only by the part of their
// tracer that crosses the screen, with a fuzzy origin for an off-screen shooter (perception/bulletSight.ts). Players
// under a roof the bot is not under are hidden (the original client draws the ceiling over them), and so are enemies
// and loot under a bush or a table (perception/foliage.ts) until they shoot or get hit; an enemy under a tree canopy is
// seen only faintly (Contact.faint, round 3 item 26); players in smoke are already left out of the snapshot by the
// simulation. Enemies that leave view are remembered for a while with their last position and estimated velocity, and
// where and why they vanished for longer (perception/lastSeen.ts, round 3 item 25); loot is remembered until the bot
// sees its spot empty. Teammates are known from the team UI (minimap, edge indicators), so they are not clipped.
import { type Bounds, type Collider, type Vec2, v2 } from "@rebirth/core";
import { GameConfig, type ObstacleDef } from "@rebirth/defs";
import {
    type BuildingView,
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
import { sameLayer } from "../nav/cellGrid.ts";
import { NavGrid } from "../nav/grid.ts";
import type { UndergroundNav } from "../nav/underground.ts";
import { AirdropMemory } from "./airdrops.ts";
import { bulletOrigin, perceiveBullets, type SeenBullet } from "./bulletSight.ts";
import type { FactionIntel } from "./factionIntel.ts";
import { canopyAmong, concealedAmong, LOOT_RAD, Reveals } from "./foliage.ts";
import { type EnemyIntelProvider, NO_INTEL } from "./intel.ts";
import { LastSeenTracker } from "./lastSeen.ts";
import { segmentHitsCollider } from "./rays.ts";
import { roofRegions } from "./roofs.ts";
import { emptySelf, type SelfState } from "./selfState.ts";
import { screenBounds } from "./sight.ts";
import { NO_THREATS, type ThreatBoard } from "./threats.ts";
import { Trails } from "./trails.ts";

export type { SelfState } from "./selfState.ts";

const BULLET_HEIGHT = GameConfig.bullet.height;
/** Remembered loot is forgotten after this long without being seen. */
const LOOT_MEMORY = 90;
/** A bullet passing this close counts as being shot at. */
const NEAR_MISS = 3;
/** An enemy is on the screen while this much of its body (radius 1) pokes in past the edge. */
const BODY_ON_SCREEN = 0.5;
/**
 * A contact seen again within this long keeps its sighting (reaction) when its body stayed on the screen (it only
 * dipped behind a roof edge, a bush or a canopy); one that went off the screen starts over after SIGHTING_GAP.
 */
const SIGHTING_KEEP = 1.5;
const SIGHTING_GAP = 0.6;
/** Obstacles with this much health or less break to one bullet (windows: health 1): they stop no shot for long. */
const FRAGILE_HEALTH = 2;
/** An enemy under a tree canopy this close is plain to see (not faint). */
const FAINT_NEAR = 5;
/** Edge rays of a body (radius 1) test this far off its centre (perception/rays.ts EDGE_TEST, metrics/truth.ts). */
const BODY_EDGE = 0.9;

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
    /**
     * while out of sight: its body stayed on the screen the whole time (behind a roof edge, a bush, a canopy), so seeing
     * it again within SIGHTING_KEEP is no new sighting; false once it left the screen (undefined counts as true)
     */
    stayedOnScreen?: boolean;
    /** visible only faintly: under a tree canopy and not revealed by its own shot or a hit (brain/faint.ts) */
    faint?: boolean;
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
    /** collidable, alive and at least bullet height: stops bullets on its own floor */
    solid: boolean;
    /** stops the bot's bullets: solid, on the bot's floor (refreshed with every snapshot) */
    blocksBullets: boolean;
    /** blocks movement */
    blocksMove: boolean;
    /** when it was last in a snapshot (WorldModel.rememberedObstacle) */
    seenAt?: number;
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
    /** grenades and other projectiles on the screen, not under someone else's roof */
    projectiles: ProjectileView[] = [];
    /** when each projectile in `projectiles` first showed on the screen (dodge reactions count from it) */
    readonly projectileSeen = new Map<number, number>();
    smokes: SmokeView[] = [];
    /** bullets whose tracer crosses the screen, cut to the part on it (perception/bulletSight.ts) */
    bullets: SeenBullet[] = [];
    /** the last bullet that passed close: where its shooter seems to be (the screen entry estimate when off screen) */
    underFire: { time: number; from: Vec2; shooterId: number } | null = null;
    /** last time the bot lost health to something other than the gas */
    lastHurt = Number.NEGATIVE_INFINITY;
    /** last time the bot lost health at all */
    lastHealthLoss = Number.NEGATIVE_INFINITY;
    gameOver = false;
    aliveCount = 0;
    /** the snapshot's area (the screen plus VIEW_MARGIN): objects there are streamed, not necessarily drawn */
    view: Bounds = { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
    /** the 16:9 screen the client draws (perception/sight.ts) at `screenZoom` */
    screen: Bounds = { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
    /** zoom radius the screen shows (self.zoom) */
    screenZoom = 0;
    /** own and enemy positions of the last snapshots (lagged percepts: melee chase and swing) */
    readonly trails = new Trails();
    /** where and why enemies dropped out of sight, kept longer than the contacts (perception/lastSeen.ts) */
    readonly lastSeen = new LastSeenTracker();
    /** how long enemies are remembered after leaving view */
    memory = 4;
    /** off-screen threats (perception/threats.ts); inert unless a real board is installed (BrainFeatures.threats) */
    threats: ThreatBoard = NO_THREATS;
    /** per-enemy intel (perception/intel.ts); inert unless a real provider is installed */
    intel: EnemyIntelProvider = NO_INTEL;
    /** air drops the snapshots told the bot about, for every brain (perception/airdrops.ts, LOOT) */
    readonly airdrops = new AirdropMemory();
    /** Underground navigation (nav/underground.ts; PathFollower.steer `goalLayer`), null without features.basements */
    underground: UndergroundNav | null = null;
    /** 50v50 knowledge (perception/factionIntel.ts), null unless BrainFeatures.faction on a faction map */
    faction: FactionIntel | null = null;
    private obstacleCache = new Map<number, SeenObstacle>();
    private readonly roofCache = new Map<number, Bounds[]>();
    /** the regions of the roofs over someone else's head this snapshot (not over the bot; perception/drawn.ts) */
    roofBoxes: Bounds[] = [];
    /** concealed enemies shown for a moment by their own shot or a hit */
    private readonly reveals = new Reveals();

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
        this.updateScreen();
        this.team = snap.local.team ?? [];
        this.teammates.clear();
        for (const m of this.team) if (m.playerId !== this.selfId) this.teammates.add(m.playerId);
        this.smokes = snap.smokes ?? [];
        this.updateRoofs(snap);
        this.bullets = perceiveBullets(
            snap.bullets ?? [],
            this.selfId,
            this.self.pos,
            this.screenZoom,
            this.time,
            this.roofBoxes,
        );
        this.updateObjects(snap);
        this.updateBullets();
        this.threats.ingest(snap, this);
        this.intel.ingest(snap, this);
        this.airdrops.ingest(snap, this);
        this.faction?.ingest(snap, this);
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
            s.outfit = me.outfit ?? "";
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

    /**
     * The screen at the zoom the snapshot gives. The client camera eases into a new zoom (survev game.ts zoom lerp), but
     * the fairness truth (metrics/truth.ts) and the aim bench use the zoom as given, so the bot does too.
     */
    private updateScreen(): void {
        this.screenZoom = this.self.zoom;
        this.screen = screenBounds(this.self.pos, this.screenZoom);
    }

    /** Whether a concealed player shows anyway right now (it fired or was hit a moment ago: foliage.ts Reveals). */
    revealed(id: number): boolean {
        return this.reveals.shown(id, this.time);
    }

    /** Whether a point lies on the bot's screen, grown by `slack`. */
    onScreen(p: Vec2, slack = 0): boolean {
        const s = this.screen;
        return p.x >= s.min.x - slack && p.x <= s.max.x + slack && p.y >= s.min.y - slack && p.y <= s.max.y + slack;
    }

    /** The bot stands in the red zone right now. */
    inGasNow(): boolean {
        const gas = this.gas;
        if (!gas || gas.mode === "inactive") return false;
        const c = gasCircle(gas);
        return v2.distance(this.self.pos, c.pos) >= c.rad;
    }

    /**
     * The buildings of the snapshot and the roofs over someone else's head (the ones the bot is not under): before the
     * bullets, whose tracers do not show under those roofs, and the players and loot they hide.
     */
    private updateRoofs(snap: Snapshot): void {
        this.buildings = [];
        for (const o of snap.objects) if (o.kind === "building") this.buildings.push(o);
        const selfPos = this.self.pos;
        const roofs = roofRegions(this.buildings, this.roofCache).filter(
            (r) => !r.regions.some((b) => pointInBounds(selfPos, b)),
        );
        this.roofBoxes = [];
        for (const r of roofs) for (const b of r.regions) this.roofBoxes.push(b);
    }

    private updateObjects(snap: Snapshot): void {
        const now = this.time;
        this.obstacles = [];
        this.obstacleById.clear();
        // obstacles first: foliage and roofs decide what else is seen
        for (const o of snap.objects) {
            if (o.kind === "obstacle") {
                const seen = this.seeObstacle(o);
                if (!seen) continue;
                // snapshots carry the obstacles of every floor (the sim culls only players and loot of other floors),
                // but a bullet only meets the ones on its own floor: a basement crate right below two bots fighting
                // on the ground blocked every shot between them, and they stood face to face without firing
                seen.blocksBullets = seen.solid && sameLayer(this.self.layer, o.layer);
                this.obstacles.push(seen);
                this.obstacleById.set(o.id, seen);
                seen.seenAt = now;
            }
        }
        const selfPos = this.self.pos;
        // roofs over someone else's head (updateRoofs)
        const boxes = this.roofBoxes;
        const hidden = (p: Vec2): boolean => {
            for (const b of boxes) if (pointInBounds(p, b)) return true;
            return false;
        };
        this.reveals.note(this.bullets, snap.objects, this.selfId, now, (p) => this.onScreen(p));
        for (const c of this.contacts.values()) c.visible = false;
        const seenLoot = new Set<number>();
        // players on the screen, drawn or hidden (a roof, a bush): a contact lost there keeps its sighting
        const onScreen = new Set<number>();
        for (const o of snap.objects) {
            if (o.kind === "player") {
                if (o.id === this.selfId) continue;
                if (this.onScreen(o.pos, BODY_ON_SCREEN)) onScreen.add(o.id);
                if (hidden(o.pos)) continue;
                // teammates are known from the team UI; enemies only as the screen draws them
                if (!this.isTeammate(o.id) && !this.enemyShows(o, now)) continue;
                this.updateContact(o, now);
            } else if (o.kind === "loot") {
                if (!this.onScreen(o.pos) || hidden(o.pos) || concealedAmong(this.obstacles, o.pos, o.layer, LOOT_RAD))
                    continue;
                seenLoot.add(o.id);
                this.loot.set(o.id, {
                    id: o.id,
                    type: o.type,
                    pos: v2.copy(o.pos),
                    count: o.count,
                    layer: o.layer,
                    lastSeen: now,
                });
            }
        }
        // grenades on the screen and not under someone else's roof (the client draws neither)
        this.projectiles = (snap.projectiles ?? []).filter(
            (p) => this.onScreen(p.pos, BODY_ON_SCREEN) && !hidden(p.pos),
        );
        for (const p of this.projectiles) if (!this.projectileSeen.has(p.id)) this.projectileSeen.set(p.id, now);
        if (this.projectileSeen.size > this.projectiles.length) {
            for (const id of this.projectileSeen.keys()) {
                if (!this.projectiles.some((p) => p.id === id)) this.projectileSeen.delete(id);
            }
        }
        // forget loot whose spot is in plain view on the screen but empty, and loot not seen for a long time
        const s = this.screen;
        const inner = { min: { x: s.min.x + 2, y: s.min.y + 2 }, max: { x: s.max.x - 2, y: s.max.y - 2 } };
        for (const [id, l] of this.loot) {
            if (seenLoot.has(id)) continue;
            const plain = pointInBounds(l.pos, inner) && !hidden(l.pos);
            if (now - l.lastSeen > LOOT_MEMORY || (plain && !concealedAmong(this.obstacles, l.pos, l.layer, LOOT_RAD)))
                this.loot.delete(id);
        }
        for (const [id, c] of this.contacts) {
            if (c.dead || (!c.visible && now - c.lastSeen > this.memory + 1)) this.contacts.delete(id);
            else if (!c.visible && !onScreen.has(id)) c.stayedOnScreen = false;
        }
        const seen: Contact[] = [];
        for (const c of this.contacts.values()) if (c.visible && !c.teammate) seen.push(c);
        this.trails.record(now, selfPos, seen);
        this.lastSeen.note(this, snap.deletedPlayerIds, hidden);
    }

    /** An enemy in the snapshot shows on the screen: inside it, and not under a bush or canopy unless just revealed. */
    private enemyShows(o: PlayerView, now: number): boolean {
        if (!this.onScreen(o.pos, BODY_ON_SCREEN)) return false;
        return !concealedAmong(this.obstacles, o.pos, o.layer) || this.reveals.shown(o.id, now);
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
            this.noteFaint(c, now);
            return;
        }
        const dt = now - c.lastSeen;
        // a new sighting (reaction delay starts over, velocity unknown) after a long gap, or once it had left the
        // screen; a contact that only dipped behind a roof edge, a bush or a canopy on the screen keeps its sighting
        // (bot overhaul COMBAT-3: exposure has its own, shorter reaction in brain/combat.ts)
        const kept = c.stayedOnScreen !== false;
        c.stayedOnScreen = true;
        if (dt > SIGHTING_KEEP || (dt > SIGHTING_GAP && !kept)) {
            c.firstSeen = now;
            c.vel = { x: 0, y: 0 };
        } else if (dt > SIGHTING_GAP) {
            c.vel = v2.div(v2.sub(o.pos, c.pos), dt);
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
        this.noteFaint(c, now);
    }

    /**
     * An enemy under a tree canopy shows faintly unless its own shot just gave it away (a hit only shows blood somewhere
     * under the leaves), or it stands within FAINT_NEAR (what pokes out from under the canopy is plain that close)
     * (round 3 item 26).
     */
    private noteFaint(c: Contact, now: number): void {
        const faint =
            !c.teammate &&
            !this.reveals.shotShown(c.id, now) &&
            v2.distance(c.pos, this.self.pos) > FAINT_NEAR &&
            canopyAmong(this.obstacles, c.pos, c.layer);
        if (faint) c.faint = true;
        else if (c.faint) c.faint = false;
    }

    private seeObstacle(o: ObstacleView): SeenObstacle | undefined {
        this.nav.observeObstacle(o);
        this.underground?.observeObstacle(o);
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
        // a window (health 1) breaks to the first bullet: no cover, and no reason to hold fire behind it (bot overhaul
        // COMBAT-9; diagnosis round 1 issue 3 missed cause: intact windows counted as walls)
        const fragile = def.destructible && def.health <= FRAGILE_HEALTH;
        const solid = alive && def.height >= BULLET_HEIGHT && !fragile;
        const seen: SeenObstacle = {
            view: o,
            def,
            col: obstacleCollider(def, o.pos, o.ori, o.scale),
            solid,
            blocksBullets: solid,
            blocksMove: alive,
            seenAt: this.time,
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
            const from = bulletOrigin(b);
            if (distToSegment(me, b.pos, end) < NEAR_MISS && v2.dot(v2.sub(me, from), b.dir) > 0) {
                this.underFire = { time: this.time, from: v2.copy(from), shooterId: b.shooterId };
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

    /**
     * Whether a shot from `from` can reach some of a body (radius 1) standing at `to`: the centre ray or either edge ray
     * (0.9 of the radius across the line, the fairness metric's body ray) is clear. A cover spot must block all three: a
     * single centre ray let bots hold "cover" with half the body out and get shot there (adversarial review).
     */
    bodyLineOfFire(from: Vec2, to: Vec2): boolean {
        if (this.lineOfFire(from, to)) return true;
        const side = v2.mul(v2.perp(v2.normalizeSafe(v2.sub(to, from))), BODY_EDGE);
        return this.lineOfFire(from, v2.add(to, side)) || this.lineOfFire(from, v2.sub(to, side));
    }

    /**
     * An obstacle out of the snapshot now as it was last seen, within `maxAge` seconds (undefined: never seen, too long
     * ago, or in the snapshot: obstacleById has it). A container the bot heads for can drop out of view while its path
     * leads around a building, and it stays the goal (brain/scavenge.ts).
     */
    rememberedObstacle(id: number, maxAge: number): SeenObstacle | undefined {
        if (this.obstacleById.has(id)) return undefined;
        const o = this.obstacleCache.get(id);
        if (!o || o.seenAt === undefined || this.time - o.seenAt > maxAge) return undefined;
        return o.view.dead ? undefined : o;
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
