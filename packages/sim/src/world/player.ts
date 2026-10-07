// Player state, per-tick update (actions, animations, movement, zoom, weapons), and its views.
// Behaviour follows survev server/src/game/objects/player.ts (update, recalculateSpeed, doAction, cancelAction, zoom);
// downed players and revives (M6a) live in downed.ts.
import { type Bounds, math, type Vec2, v2 } from "@rebirth/core";
import { GameConfig, getDef, WeaponSlot } from "@rebirth/defs";
import type { HitRecord } from "../combat/combat.ts";
import { emptyInput, type PlayerInput } from "../input.ts";
import { Inventory, type InventoryOwner, SCOPE_LEVELS, THROWABLE_LIST } from "../items/inventory.ts";
import type { PickupResult } from "../loot/pickup.ts";
import { updateEmoteThrottle } from "../match/emotes.ts";
import type { Group } from "../match/teams.ts";
import { trackActivity, updatePerks } from "../perks/effects.ts";
import type { PerkSource } from "../perks/perks.ts";
import type { AnimType, HasteName, LocalPlayerState, MatchStats, PlayerView } from "../view.ts";
import { gunDef, TIME_EPS, WeaponManager } from "../weapons/weaponManager.ts";
import { handleActions } from "./actions.ts";
import { updateAutoLoot } from "./autoLoot.ts";
import { completeUse, updateBoost, updateFabricate, useItem } from "./consumables.ts";
import type { SimContext } from "./context.ts";
import { applyKnockback, completeRevive, updateDowned } from "./downed.ts";
import type { Building } from "./entities.ts";
import { circleTouchesBounds, moveWithCollision } from "./movement.ts";
import { playerLocalState, playerMatchStats, playerView } from "./playerView.ts";
import { VISION_RECOVERY_TIME } from "./smoke.ts";
import { updateSurroundings } from "./surroundings.ts";
import type { Entity, World } from "./world.ts";

export { circleTouchesBounds, movementSteps, moveWithCollision } from "./movement.ts";

const PLAYER = GameConfig.player;
/** One-shot input actions kept between two ticks at most. */
const MAX_PENDING_ACTIONS = 32;
/** Movement multiplier while a shot slowdown or an item use runs (survev recalculateSpeed). */
const BUSY_SPEED_MULT = 0.5;
/** Combat Medic speed bonus while using items when the player is not in a game (survev field_medic.speedBoost). */
const FIELD_MEDIC_SPEED = 1;
/** Action timers stop here (survev clamps to net.Constants.ActionMaxDuration 8.5 s). */
const ACTION_MAX_TIME = 8.5;

/** Internal action type; "reloadAlt" is the Mosin's full-clip reload and shows as "reload". */
export type PlayerActionType = "none" | "reload" | "reloadAlt" | "use" | "revive";

export class Player implements InventoryOwner {
    readonly kind = "player";
    readonly type = "player";
    readonly id: number;
    readonly name: string;
    /**
     * Touch client (M8; the original JoinMsg.isMobile): the mobile scope zoom table, a 1.4x loot pickup radius and
     * server-side auto loot / door opening (survev player.ts constructor, getClosestLoot, update; autoLoot.ts)
     */
    readonly isMobile: boolean;
    /** camera radius per scope: GameConfig.scopeZoomRadius.mobile or .desktop (survev player.ts scopeZoomRadius) */
    readonly zoomRadius: Readonly<Record<string, number>>;
    /** auto loot waits while this runs: 3 s after the player dropped something (survev mobileDropTicker) */
    mobileDropTicker = 0;
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
    /** seconds the heal effect still shows after a coconut heal (survev player.ts healEffectTicker) */
    healEffectTicker = 0;
    /** role id ("" for none): faction roles, Lone Survivr, map roles, Cobalt classes (M7a, roles/roles.ts) */
    role = "";
    /** the worn helmet came with the role (it leaves with the role); the role's outfit cannot be swapped (Commander) */
    hasRoleHelmet = false;
    noDropOutfit = false;
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
    /** perk ids, in grant order (M7a: add / remove through perks/perks.ts so effects and sources follow) */
    readonly perks: string[] = [];
    /** where each perk came from (droppable loot perk, role, helmet), parallel to `perks` by type */
    readonly perkSources: PerkSource[] = [];
    /** speed burst: Windwalk, Takedown, Inspire (M7a) */
    readonly haste = { type: "none" as HasteName, ticker: 0, seq: 0 };
    /** seconds of Last Breath left (bonus damage, size, M7a) */
    lastBreathTicker = 0;
    /** Combat Stimulants (survev-only perk): seconds its bonus still runs after a heal or boost */
    combatStimsTicker = 0;
    /** Indomitable Spirit absorbed a fatal hit: seconds its effect still shows (survev lastStandEffectTicker) */
    lastStandTicker = 0;
    /** Spud Gun hits: extra size, shrinking 2.5 s after the last hit (survev fatModifier / fatTicker, M7a) */
    fat = { mod: 0, ticker: 0 };
    /** snowball / potato hit: slowed for `ticker` s, frozen pose turned by `ori` (M7b, modes/frozen.ts) */
    frozen = { ticker: 0, ori: 0 };
    /** PMG-134 hits: zoom radius taken off the view until `ticker` s pass without a hit (modes/frozen.ts) */
    viewShrink = { amount: 0, ticker: 0 };
    /** Cobalt: no class chosen yet; the player waits (in the Twins bunker) and cannot act or be hurt (M7b) */
    awaitingClass = false;
    /** seconds until the bugle regains a charge (Inspiration), 0 when not recharging */
    bugleTicker = 0;
    /** Gabby Ghost and That Sucks timers */
    chattyTicker = 0;
    drainTicker = 0;
    /** AFK filter of promotions: seconds moving / standing still, seconds since the last move (survev) */
    movingTime = 0;
    stillTime = 0;
    timeWithoutMoving = 0;
    /** the Commander's flare gun was fired (it may then be dropped); seconds until its automatic shot (fork knob) */
    firedFlare = true;
    flareTimer = 0;
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

    constructor(id: number, name: string, pos: Vec2, isMobile = false) {
        this.id = id;
        this.name = name;
        this.isMobile = isMobile;
        this.zoomRadius = GameConfig.scopeZoomRadius[isMobile ? "mobile" : "desktop"];
        this.pos = v2.copy(pos);
        this.posOld = v2.copy(pos);
        this.inv = new Inventory(this, PLAYER.defaultItems.inventory);
        this.weaponManager = new WeaponManager(this, PLAYER.defaultItems.weapons);
        this.zoom = this.zoomRadius[this.scope] ?? this.zoomRadius["1xscope"];
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
        if (input.touchMoveDir) this.input.touchMoveDir = v2.copy(input.touchMoveDir);
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
        const def = getDef(this.activeWeapon || "fists") as {
            type: string;
            speed?: { equip?: number; attack?: number };
        };
        const perks = rules?.perks;
        // the equip bonus is lost while a melee hit is pending; Small Arms replaces a gun's equip modifier by +1
        const equip = !this.downed || (rules?.downedEquipBonus ?? false);
        let equipSpeed = def.speed?.equip ?? 0;
        if (def.type === "gun" && this.hasPerk("small_arms")) equipSpeed = perks?.smallArmsGunEquipSpeed ?? 1;
        if (equip && this.weaponManager.meleeAttacks.length === 0) speed += equipSpeed;
        if (this.shotSlowdownTimer > 0 && def.speed?.attack !== undefined) speed += def.speed.attack;
        // One With Nature: faster in water instead of slower (perks.md tree_climbing)
        if (world.isOnWater(this.pos, this.layer)) {
            speed += this.hasPerk("tree_climbing") ? (perks?.treeClimbingWaterSpeed ?? 2) : -PLAYER.waterSpeedPenalty;
        }
        if (this.boost >= 50) speed += PLAYER.boostMoveSpeed;
        if (this.animType === "cook") speed -= PLAYER.cookSpeedPenalty;
        if (this.haste.type !== "none") speed += perks?.hasteSpeedBonus ?? PLAYER.hasteSpeedBonus;
        if (this.frozen.ticker > 0) speed -= PLAYER.frozenSpeedPenalty;
        // Combat Medic: no slowdown while using items, a small bonus instead
        const medic = this.hasPerk("field_medic") && this.action.type === "use";
        const busy = this.action.type === "use" && !medic;
        if (this.shotSlowdownTimer > 0 || busy || (reviver && !survevReviver)) speed *= BUSY_SPEED_MULT;
        if (medic) speed += this.ctx?.rules.fieldMedicSpeedBonus ?? FIELD_MEDIC_SPEED;
        return math.clamp(speed, 1, 10000);
    }

    /**
     * Unit movement vector: the touch stick's direction while it is active with a non-zero pull (its pull does not
     * scale the speed; survev player.ts update and handleInput normalizeSafe), else the held keys; +y is up, diagonals
     * are normalized.
     */
    static movementFromInput(input: PlayerInput): Vec2 {
        const stick = input.touchMoveDir;
        if (input.touchMoveActive && input.touchMoveLen && stick) return v2.normalizeSafe(stick);
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
        // Cobalt players choosing a class do nothing (survev update / handleInput: perkMode && !role)
        if (this.dead || this.awaitingClass) {
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
        // haste, Last Breath, bugle, Gift of the Woods, That Sucks, Gabby Ghost (M7a); That Sucks may kill
        updatePerks(ctx, this, dt);
        if (this.dead) return;
        // revive range, damage buffer, bleeding (may kill), emote throttle (M6a)
        updateDowned(ctx, this, dt);
        if (this.dead) return;
        updateEmoteThrottle(this, dt);
        // snowball / potato slowdown (survev update "Projectile slowdown logic")
        if (this.frozen.ticker > 0) this.frozen.ticker = Math.max(0, this.frozen.ticker - dt);
        if (this.viewShrink.amount > 0) {
            this.viewShrink.ticker -= dt;
            if (this.viewShrink.ticker <= 0) this.viewShrink = { amount: 0, ticker: 0 };
        }
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
        trackActivity(this, moving, dt);
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
        // mobile players loot and open doors by walking over them (M8; after the movement broadphase is used: the loot
        // and door searches reuse its scratch buffer)
        updateAutoLoot(ctx, this, dt);

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

    /**
     * Scope zoom less the PMG-134 view shrink (never below 1x), overridden by building zoom regions while indoors and
     * by smoke (survev player.ts).
     */
    private updateZoom(objs: readonly Entity[]): void {
        const lowestZoom = this.zoomRadius["1xscope"];
        const scopeZoom = this.zoomRadius[this.scope] ?? lowestZoom;
        let finalZoom = Math.max(lowestZoom, scopeZoom - this.viewShrink.amount);
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

    toView(): PlayerView {
        return playerView(this);
    }

    localState(): LocalPlayerState {
        return playerLocalState(this);
    }

    /** Match stats as the client shows them: damage rounded, whole seconds (the original PlayerStats record). */
    matchStats(): MatchStats {
        return playerMatchStats(this);
    }
}
