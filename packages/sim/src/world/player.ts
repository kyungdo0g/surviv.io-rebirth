// Player state, per-tick update (actions, animations, movement, zoom, weapons), and its views.
// Behaviour follows survev server/src/game/objects/player.ts (update, recalculateSpeed, doAction, cancelAction, zoom);
// downed players and revives (M6a) live in downed.ts.
import { type Bounds, collider, math, type Vec2, v2 } from "@rebirth/core";
import { GameConfig, getDef, WeaponSlot } from "@rebirth/defs";
import type { HitRecord } from "../combat/combat.ts";
import { emptyInput, type PlayerInput } from "../input.ts";
import { Inventory, type InventoryOwner, isBagItem, SCOPE_LEVELS, THROWABLE_LIST } from "../items/inventory.ts";
import type { PickupResult } from "../loot/pickup.ts";
import { updateEmoteThrottle } from "../match/emotes.ts";
import type { Group } from "../match/teams.ts";
import type { ActionType, AnimType, LocalPlayerState, MatchStats, PlayerView } from "../view.ts";
import { gunDef, TIME_EPS, WeaponManager } from "../weapons/weaponManager.ts";
import { handleActions } from "./actions.ts";
import { completeUse, updateBoost, updateFabricate, useItem } from "./consumables.ts";
import type { SimContext } from "./context.ts";
import { applyKnockback, completeRevive, updateDowned } from "./downed.ts";
import type { Building } from "./entities.ts";
import { VISION_RECOVERY_TIME } from "./smoke.ts";
import { updateSurroundings } from "./surroundings.ts";
import { type Entity, sameLayer, type World } from "./world.ts";

const PLAYER = GameConfig.player;
const ZOOM_RADIUS = GameConfig.scopeZoomRadius.desktop;
/** Extra distance pushed out of an obstacle so the next sub-step starts clear (survev player.ts). */
const PUSH_EPS = 0.001;
/** One-shot input actions kept between two ticks at most. */
const MAX_PENDING_ACTIONS = 32;
/** Movement multiplier while a shot slowdown or an item use runs (survev recalculateSpeed). */
const BUSY_SPEED_MULT = 0.5;
/** Combat Medic speed bonus while using items when the player is not in a game (survev field_medic.speedBoost). */
const FIELD_MEDIC_SPEED = 1;
/** Action timers stop here (survev clamps to net.Constants.ActionMaxDuration 8.5 s). */
const ACTION_MAX_TIME = 8.5;

/** Number of collision sub-steps for one tick of movement (survev player.ts). */
export function movementSteps(speed: number, dt: number): number {
    return Math.round(Math.max(speed * dt + 5, 5));
}

/** Internal action type; "reloadAlt" is the Mosin's full-clip reload and shows as "reload". */
export type PlayerActionType = "none" | "reload" | "reloadAlt" | "use" | "revive";

export class Player implements InventoryOwner {
    readonly kind = "player";
    readonly type = "player";
    readonly id: number;
    readonly name: string;
    pos: Vec2;
    /** position before this tick's movement (move spread, pan sweep) */
    posOld: Vec2;
    dir: Vec2 = { x: 1, y: 0 };
    /** facing before this tick (pan sweep) */
    dirOld: Vec2 = { x: 1, y: 0 };
    /** 0 ground, 1 underground, 2/3 on stairs (upper / lower half) (M5b) */
    layer = 0;
    /** layer its bullets fly on: on stairs, facing down or up them shoots into that floor (M5b) */
    aimLayer = 0;
    /** standing in a building heal region this tick (M5b) */
    healEffect = false;
    /** class / role id ("" for none) */
    // TODO(M7): Cobalt classes; TODO(M8): roles (kill leader, faction roles)
    role = "";
    scale = 1;
    health: number = PLAYER.health;
    boost = 0;
    dead = false;
    downed = false;
    readonly weaponManager: WeaponManager;
    readonly inv: Inventory;
    outfit: string = PLAYER.defaultItems.outfit;
    /** outfit the player joined with: it never drops on death (survev compares with the loadout outfit) */
    readonly loadoutOutfit: string = PLAYER.defaultItems.outfit;
    backpack: string = PLAYER.defaultItems.backpack;
    helmet: string = PLAYER.defaultItems.helmet;
    chest: string = PLAYER.defaultItems.chest;
    scope: string = PLAYER.defaultItems.scope;
    /** perk ids (M2: only consulted by the damage pipeline and ammo stats) */
    readonly perks: string[] = [];
    /** camera zoom radius in world units */
    zoom: number;
    indoors = false;
    insideZoomRegion = false;
    /** speed of the last tick in units per second (0 when standing still) */
    speed = 0;
    /** intended velocity of the last tick (movement keys x speed); thrown grenades inherit part of it */
    moveVel: Vec2 = { x: 0, y: 0 };
    /** in smoke, or left it less than 0.5 s ago: the camera is forced to 1x (survev visionObscured) */
    visionObscured = false;
    private visionRecoveryTicker = 0;
    /** seconds towards the next Fabricate refill */
    fabricateTicker = 0;
    /** the game this player is in (set by Game.addPlayer; throws need it to spawn projectiles) */
    ctx: SimContext | null = null;
    input: PlayerInput = emptyInput();
    /** shootStart latched until a tick consumes it (inputs may arrive faster or slower than ticks) */
    shootStart = false;
    shootHold = false;
    private shootStartPending = false;
    private pendingActions: number[] = [];
    private pendingUseItem = "";

    animType: AnimType = "none";
    animSeq = 0;
    private animTicker = 0;
    /** `targetId`: the player a reviver revives (itself for a self revive), 0 otherwise (M6a) */
    readonly action = { type: "none" as PlayerActionType, item: "", time: 0, duration: 0, seq: 0, targetId: 0 };
    shotSeq = 0;
    shotOffhand = false;
    wearingPan = false;
    /** speed.attack and the x0.5 slowdown apply while this runs (fireDelay after each shot) */
    shotSlowdownTimer = 0;
    pickupTicker = 0;

    kills = 0;
    /** id of the player credited with this player's death (0 for none) */
    killedBy = 0;
    lastDamagedBy = 0;
    damageDealt = 0;
    damageTaken = 0;
    lastHit: HitRecord | null = null;
    lastPickup: { type: string; result: PickupResult } | null = null;

    /** team id (solo: one per player, 1-255; the GameOver message's teamId) (M4); duo/squad: the group id (M6a) */
    teamId = 0;
    /** group id (solo: the team id) and the group itself (M6a) */
    groupId = 0;
    group: Group | null = null;
    /** times knocked down this match (bleed escalation) (M6a) */
    downedCount = 0;
    /** damage is ignored while this runs, right after a knock (M6a) */
    downedDamageTicker = 0;
    /** seconds until the next bleed tick (M6a) */
    bleedTicker = 0;
    /** id of the player who knocked this one down (kill credit), 0 for none (M6a) */
    downedBy = 0;
    /** knock-back velocity of a fresh knock (M6a) */
    knockback: Vec2 = { x: 0, y: 0 };
    /** the player this one revives (itself for a self revive) / the player reviving this one (M6a) */
    playerBeingRevived: Player | null = null;
    revivedBy: Player | null = null;
    /** emote throttle (survev emoteCounter / emoteSoftTicker / emoteHardTicker) (M6a) */
    emoteCounter = 0;
    emoteSoftTicker = 0;
    emoteHardTicker = 0;
    /** emote wheel (slots 0-3), win and death emotes (GameConfig.defaultEmoteLoadout; no loadouts yet) */
    readonly emoteLoadout: string[] = [...GameConfig.defaultEmoteLoadout];
    /** seconds alive (match stats, start condition) */
    timeAlive = 0;
    /** seconds in the gas since entering it, counted from rules.gasDamageRampFromCircle (escalation rule) */
    timeInsideGas = 0;
    /** order of death in the match (0 first); -1 while alive (ranks) */
    killedIndex = -1;
    /** the client left; the player stays in the game (survev: players older than minActiveTime do not despawn) */
    disconnected = false;
    /** players spectating this one */
    spectatorCount = 0;

    /** buildings whose ceiling zoom region the player is inside (updated every tick) */
    readonly occupiedBuildings: Building[] = [];
    bounds: Bounds;
    /** broadphase scratch buffer shared by this player's systems (never used re-entrantly) */
    readonly scratch: Entity[] = [];

    constructor(id: number, name: string, pos: Vec2) {
        this.id = id;
        this.name = name;
        this.pos = v2.copy(pos);
        this.posOld = v2.copy(pos);
        this.inv = new Inventory(this, PLAYER.defaultItems.inventory);
        this.weaponManager = new WeaponManager(this, PLAYER.defaultItems.weapons);
        this.zoom = ZOOM_RADIUS[this.scope] ?? ZOOM_RADIUS["1xscope"];
        this.bounds = this.computeBounds();
    }

    get rad(): number {
        return PLAYER.radius * this.scale;
    }

    get activeWeapon(): string {
        return this.weaponManager.activeWeapon;
    }

    get curWeapIdx(): number {
        return this.weaponManager.curWeapIdx;
    }

    get weapons(): ReadonlyArray<{ type: string; ammo: number }> {
        return this.weaponManager.weapons;
    }

    get inventory(): Readonly<Record<string, number>> {
        return this.inv.items;
    }

    hasPerk(perk: string): boolean {
        return this.perks.includes(perk);
    }

    /** A held pan (not mid-swing) or one worn on the back reflects bullets (survev hasActivePan). */
    hasActivePan(): boolean {
        return this.wearingPan || (this.activeWeapon === "pan" && this.animType !== "melee");
    }

    isReloading(): boolean {
        return this.action.type === "reload" || this.action.type === "reloadAlt";
    }

    computeBounds(): Bounds {
        // the broadphase uses the visual radius so partly visible players are still sent
        const r = PLAYER.maxVisualRadius * this.scale;
        return { min: { x: this.pos.x - r, y: this.pos.y - r }, max: { x: this.pos.x + r, y: this.pos.y + r } };
    }

    /** Stores the latest input; one-shot parts (shootStart, actions) are kept until a tick consumes them. */
    receiveInput(input: PlayerInput): void {
        this.input = { ...input, toMouseDir: v2.copy(input.toMouseDir), actions: [...input.actions] };
        if (input.shootStart) this.shootStartPending = true;
        if (input.useItem) this.pendingUseItem = input.useItem;
        // bounded: a client flooding inputs between ticks cannot grow the queue without limit
        if (this.pendingActions.length < MAX_PENDING_ACTIONS) this.pendingActions.push(...input.actions);
    }

    doAction(item: string, type: PlayerActionType, duration: number, targetId = 0): void {
        // an action already in progress is not replaced (survev doAction)
        if (this.action.type !== "none") return;
        this.action.type = type;
        this.action.item = item;
        this.action.time = 0;
        this.action.duration = duration;
        this.action.targetId = targetId;
        this.action.seq++;
    }

    /** Cancels the running action; a revive is cancelled on both sides (survev cancelAction). */
    cancelAction(): void {
        if (this.action.type === "none") return;
        const revived = this.playerBeingRevived;
        if (revived) {
            this.playerBeingRevived = null;
            if (revived === this.revivedBy) {
                this.revivedBy = null;
            } else {
                revived.revivedBy = null;
                revived.cancelAction();
                this.cancelAnim();
            }
        }
        const reviver = this.revivedBy;
        if (reviver) {
            this.revivedBy = null;
            if (reviver.playerBeingRevived) {
                reviver.playerBeingRevived = null;
                reviver.cancelAction();
                reviver.cancelAnim();
            }
        }
        this.action.type = "none";
        this.action.item = "";
        this.action.time = 0;
        this.action.duration = 0;
        this.action.targetId = 0;
        this.action.seq++;
    }

    playAnim(type: AnimType, duration: number): void {
        this.animType = type;
        this.animSeq++;
        this.animTicker = duration;
    }

    cancelAnim(): void {
        this.animType = "none";
        this.animSeq++;
        this.animTicker = 0;
    }

    onItemAdded(item: string): void {
        const def = getDef(item);
        const wm = this.weaponManager;
        if (def.type === "scope") {
            // a better scope is equipped right away
            if (SCOPE_LEVELS.indexOf(item) > SCOPE_LEVELS.indexOf(this.scope)) this.scope = item;
        } else if (def.type === "throwable") {
            if (!wm.weapons[WeaponSlot.Throwable].type && THROWABLE_LIST.includes(item)) {
                wm.setWeapon(WeaponSlot.Throwable, item, 0);
            }
        } else if (def.type === "ammo") {
            // picking up ammo for an empty held gun reloads it
            const gun = gunDef(this.activeWeapon);
            if (gun && wm.activeSlot.ammo <= 0 && gun.ammo === item) wm.scheduledReload = true;
        }
    }

    onItemRemoved(item: string): void {
        const def = getDef(item);
        if (def.type === "scope" && this.scope === item) {
            for (let i = SCOPE_LEVELS.indexOf(item); i >= 0; i--) {
                if (this.inv.has(SCOPE_LEVELS[i])) {
                    this.scope = SCOPE_LEVELS[i];
                    break;
                }
            }
        } else if (def.type === "throwable" && this.weaponManager.weapons[WeaponSlot.Throwable].type === item) {
            this.weaponManager.showNextThrowable();
        }
    }

    /**
     * Move speed for this tick (survev recalculateSpeed; docs/research/mechanics/movement.md). Downed players crawl at
     * downedMoveSpeed, 2 while being revived or self reviving, without the melee equip bonus (rules.downedEquipBonus);
     * a reviver moves at half its normal speed (rules.reviverSpeed; conflicts.md reviver-speed).
     */
    computeSpeed(world: World): number {
        const rules = this.ctx?.rules;
        const reviving = this.action.type === "revive";
        const reviver = reviving && this.action.targetId !== 0 && !(this.downed && this.hasPerk("self_revive"));
        const survevReviver = reviver && rules?.reviverSpeed === "survev";
        let speed = PLAYER.moveSpeed;
        if (survevReviver) speed = PLAYER.downedMoveSpeed + 2;
        else if (this.downed) speed = reviving ? PLAYER.downedRezMoveSpeed : PLAYER.downedMoveSpeed;
        const def = getDef(this.activeWeapon || "fists") as { speed?: { equip?: number; attack?: number } };
        // the equip bonus is lost while a melee hit is pending
        const equip = !this.downed || (rules?.downedEquipBonus ?? false);
        if (equip && this.weaponManager.meleeAttacks.length === 0) speed += def.speed?.equip ?? 0;
        if (this.shotSlowdownTimer > 0 && def.speed?.attack !== undefined) speed += def.speed.attack;
        if (world.isOnWater(this.pos, this.layer)) speed -= PLAYER.waterSpeedPenalty;
        if (this.boost >= 50) speed += PLAYER.boostMoveSpeed;
        if (this.animType === "cook") speed -= PLAYER.cookSpeedPenalty;
        // Combat Medic: no slowdown while using items, a small bonus instead
        const medic = this.hasPerk("field_medic") && this.action.type === "use";
        const busy = this.action.type === "use" && !medic;
        if (this.shotSlowdownTimer > 0 || busy || (reviver && !survevReviver)) speed *= BUSY_SPEED_MULT;
        if (medic) speed += this.ctx?.rules.fieldMedicSpeedBonus ?? FIELD_MEDIC_SPEED;
        return math.clamp(speed, 1, 10000);
    }

    /** Unit movement vector from the held keys; +y is up, diagonals are normalized. */
    static movementFromInput(input: PlayerInput): Vec2 {
        const m = { x: 0, y: 0 };
        if (input.moveUp) m.y += 1;
        if (input.moveDown) m.y -= 1;
        if (input.moveLeft) m.x -= 1;
        if (input.moveRight) m.x += 1;
        if (m.x !== 0 && m.y !== 0) {
            m.x *= Math.SQRT1_2;
            m.y *= Math.SQRT1_2;
        }
        return m;
    }

    update(ctx: SimContext, dt: number): void {
        if (this.dead) {
            this.pendingActions.length = 0;
            this.shootStartPending = false;
            this.pendingUseItem = "";
            return;
        }
        const world = ctx.world;
        const input = this.input;
        this.dirOld = this.dir;
        if (v2.lengthSqr(input.toMouseDir) > 1e-12) this.dir = v2.normalize(input.toMouseDir);
        this.shootHold = input.shootHold;
        this.shootStart = this.shootStartPending;
        this.shootStartPending = false;
        const actions = this.pendingActions;
        this.pendingActions = [];
        handleActions(ctx, this, actions);
        const use = this.pendingUseItem;
        this.pendingUseItem = "";
        if (use) useItem(ctx, this, use);

        // boost heals and decays before the action and movement (survev player.ts update)
        updateBoost(this, ctx.rules, dt);
        updateFabricate(this, ctx.rules, dt);
        // revive range, damage buffer, bleeding (may kill), emote throttle (M6a)
        updateDowned(ctx, this, dt);
        if (this.dead) return;
        updateEmoteThrottle(this, dt);
        this.updateAction(ctx, dt);
        if (this.animType !== "none") {
            this.animTicker -= dt;
            if (this.animTicker <= TIME_EPS) this.cancelAnim();
        }

        this.posOld = v2.copy(this.pos);
        const slide = applyKnockback(this, dt);
        if (slide) this.pos = v2.add(this.pos, slide);
        const movement = Player.movementFromInput(input);
        const moving = movement.x !== 0 || movement.y !== 0;
        this.speed = moving ? this.computeSpeed(world) : 0;
        this.moveVel = v2.mul(movement, this.speed);
        const objs = moveWithCollision(world, this, movement, this.speed, dt, this.scratch);
        this.pickupTicker -= dt;
        this.updateVision(ctx, dt);
        this.updateZoom(objs);
        updateSurroundings(ctx, this, objs, dt);
        this.pos = world.clampToMap(this.pos, this.rad);
        this.bounds = this.computeBounds();
        world.updateBounds(this);

        // a downed player's weapons do nothing, cooldowns included (survev weaponManager.update)
        if (!this.downed) this.weaponManager.update(ctx, dt);
        this.shotSlowdownTimer = Math.max(0, this.shotSlowdownTimer - dt);
        this.shootStart = false;
    }

    /** Advances the running action; a finished shell reload chains the next shell in the same tick. */
    private updateAction(ctx: SimContext, dt: number): void {
        const action = this.action;
        if (action.type === "none") return;
        action.time = Math.min(action.time + dt, ACTION_MAX_TIME);
        if (action.time < action.duration - TIME_EPS) return;
        if (action.type === "revive") {
            // only the reviver's side completes a revive; the downed side waits for it (survev update)
            if (this.playerBeingRevived) completeRevive(ctx, this);
            if (!this.revivedBy || this.playerBeingRevived === this.revivedBy) this.cancelAction();
            return;
        }
        const carry = Math.max(0, action.time - action.duration);
        const wm = this.weaponManager;
        let again = false;
        if (this.isReloading()) again = wm.reload();
        else if (action.type === "use") completeUse(this, action.item, ctx);
        this.cancelAction();
        if (again && wm.tryReload(carry)) return;
        const slot = wm.curWeapIdx;
        if ((slot === WeaponSlot.Primary || slot === WeaponSlot.Secondary) && wm.activeSlot.ammo === 0) {
            wm.scheduledReload = true;
        }
    }

    /** Smoke obscures vision while the player touches a cloud and for 0.5 s after (survev player.ts update). */
    private updateVision(ctx: SimContext, dt: number): void {
        if (ctx.smokes.touches(this.pos, this.rad, this.layer)) {
            this.visionObscured = true;
            this.visionRecoveryTicker = 0;
            return;
        }
        this.visionRecoveryTicker += dt;
        if (this.visionRecoveryTicker >= VISION_RECOVERY_TIME - TIME_EPS) this.visionObscured = false;
    }

    /** Scope zoom, overridden by building zoom regions while indoors and by smoke (survev player.ts). */
    private updateZoom(objs: readonly Entity[]): void {
        const lowestZoom = ZOOM_RADIUS["1xscope"];
        let finalZoom = Math.max(lowestZoom, ZOOM_RADIUS[this.scope] ?? lowestZoom);
        let regionZoom = lowestZoom;
        let outsideAllRegions = true;
        this.indoors = false;
        this.occupiedBuildings.length = 0;
        const pos = this.pos;
        const rad = this.rad;
        for (const obj of objs) {
            if (obj.kind !== "building" || obj.ceilingDead) continue;
            // only check the layer when not on stairs
            if (this.layer < 2 && this.layer !== obj.layer) continue;
            for (const region of obj.zoomRegions) {
                if (region.zoomIn && circleTouchesBounds(pos, rad, region.zoomIn)) {
                    this.indoors = true;
                    this.insideZoomRegion = !region.noZoom;
                    outsideAllRegions = false;
                    if (region.zoom) regionZoom = region.zoom;
                    if (!this.occupiedBuildings.includes(obj)) this.occupiedBuildings.push(obj);
                }
                if (region.zoomOut && circleTouchesBounds(pos, rad, region.zoomOut)) {
                    outsideAllRegions = false;
                    if (this.insideZoomRegion && region.zoom) regionZoom = region.zoom;
                }
            }
        }
        if (this.insideZoomRegion) finalZoom = regionZoom;
        if (this.visionObscured || this.downed) finalZoom = lowestZoom;
        this.zoom = finalZoom;
        if (outsideAllRegions) this.insideZoomRegion = false;
    }

    private viewActionType(): ActionType {
        return this.action.type === "reloadAlt" ? "reload" : this.action.type;
    }

    toView(): PlayerView {
        return {
            id: this.id,
            kind: "player",
            type: this.type,
            pos: v2.copy(this.pos),
            layer: this.layer,
            dir: v2.copy(this.dir),
            dead: this.dead,
            downed: this.downed,
            activeWeapon: this.activeWeapon,
            outfit: this.outfit,
            helmet: this.helmet,
            chest: this.chest,
            backpack: this.backpack,
            scale: this.scale,
            anim: { type: this.animType, seq: this.animSeq },
            action: {
                type: this.viewActionType(),
                seq: this.action.seq,
                item: this.action.item,
                duration: this.action.duration,
            },
            shot: { seq: this.shotSeq, offHand: this.shotOffhand },
            wearingPan: this.wearingPan,
            healEffect: this.healEffect && !this.dead,
        };
    }

    localState(): LocalPlayerState {
        const wm = this.weaponManager;
        const inventory: Record<string, number> = {};
        for (const [item, count] of Object.entries(this.inv.items)) if (isBagItem(item)) inventory[item] = count;
        return {
            health: this.health,
            boost: this.boost,
            zoom: this.zoom,
            layer: this.layer,
            weapons: wm.weapons.map((w) => ({ type: w.type, ammo: w.ammo })),
            curWeapIdx: wm.curWeapIdx,
            inventory,
            scope: this.scope,
            outfit: this.outfit,
            helmet: this.helmet,
            chest: this.chest,
            backpack: this.backpack,
            action: {
                type: this.viewActionType(),
                item: this.action.item,
                time: this.action.time,
                duration: this.action.duration,
                targetId: this.action.targetId,
            },
            cooldowns: {
                weapons: wm.weapons.map((w) => Math.max(0, w.cooldown)),
                freeSwitch: Math.max(0, wm.freeSwitchTimer),
            },
            kills: this.kills,
            dead: this.dead,
            killedBy: this.killedBy,
            stats: this.matchStats(),
            spectatorCount: this.spectatorCount,
        };
    }

    /** Match stats as the client shows them: damage rounded, whole seconds (the original PlayerStats record). */
    matchStats(): MatchStats {
        return {
            kills: this.kills,
            damageDealt: Math.round(this.damageDealt),
            damageTaken: Math.round(this.damageTaken),
            timeAlive: Math.floor(this.timeAlive + 1e-9),
        };
    }
}

/** Circle vs box overlap, inclusive of the centre lying inside (survev coldet.testCircleAabb). */
export function circleTouchesBounds(pos: Vec2, rad: number, b: Bounds): boolean {
    const cx = math.clamp(pos.x, b.min.x, b.max.x);
    const cy = math.clamp(pos.y, b.min.y, b.max.y);
    const dx = pos.x - cx;
    const dy = pos.y - cy;
    return dx * dx + dy * dy < rad * rad || (dx === 0 && dy === 0);
}

/**
 * Moves the player along `movement` (unit or zero vector) at `speed` for `dt` seconds in sub-steps, pushing
 * it out of blocking obstacles on its layer after each sub-step so it can never tunnel through them.
 * Returns the broadphase result (also used for zoom regions).
 */
export function moveWithCollision(
    world: World,
    player: Player,
    movement: Vec2,
    speed: number,
    dt: number,
    out: Entity[] = [],
): Entity[] {
    const moving = movement.x !== 0 || movement.y !== 0;
    const steps = moving ? movementSteps(speed, dt) : 1;
    const reach = PLAYER.maxVisualRadius * player.scale + speed * dt;
    const query = {
        min: { x: player.pos.x - reach, y: player.pos.y - reach },
        max: { x: player.pos.x + reach, y: player.pos.y + reach },
    };
    const objs = world.query(query, out);
    const stepLen = moving ? (speed / steps) * dt : 0;
    const rad = player.rad;
    let x = player.pos.x;
    let y = player.pos.y;
    for (let i = 0; i < steps; i++) {
        x += movement.x * stepLen;
        y += movement.y * stepLen;
        for (const obj of objs) {
            if (obj.kind !== "obstacle" || !obj.blocking || !sameLayer(obj.layer, player.layer)) continue;
            const res = collider.intersect({ type: 0, pos: { x, y }, rad }, obj.collider);
            if (res) {
                x += res.dir.x * (res.pen + PUSH_EPS);
                y += res.dir.y * (res.pen + PUSH_EPS);
            }
        }
    }
    player.pos = { x, y };
    return objs;
}
