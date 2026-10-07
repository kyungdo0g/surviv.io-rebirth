// Sounds and particles driven by the game state: shots and tracers (via BulletSystem), reload and item-use
// sounds, casings, melee swings and hits, and the local player's weapon switch, pickup and dry-fire sounds.
// Behaviour follows survev client/src/objects/player.ts (update: switch sounds; playActionStartEffect;
// animPlaySound; animMeleeCollision), shot.ts (casings, cycle/pull sounds) and the PickupMsg handler. M4: button
// use and obstacle destruction effects (survev obstacle.ts: use particle + on/off sound, 5-10 explode particles
// + explode sound). M5: the pin and lever of a thrown grenade (survev animThrowableParticles).
// M9: the tracer queries of BulletScene (shooter, previous player transforms for pans, containers for blood, stairs,
// bright floors); the kill frame's flesh-hit sound (survev game.ts Kill handler); melee hits as in survev player.ts
// animMeleeCollision: teammates come last, players behind an obstacle are not hit, cleaving weapons skip obstacles
// behind a wall, and the particles draw just above the hit object's render order.
// Rebirth (user/2026-10-07-hit-feedback): a melee hit on a player is passed to `hitListener` (fx/hitFeedback.ts) after
// its original effects, with the weapon's damage.
import { type Collider, collider, math, type Vec2 } from "@rebirth/core";
import {
    DamageType,
    GameConfig,
    GameObjectDefs,
    type GunDef,
    MapObjectDefs,
    type MeleeDef,
    type ObstacleDef,
} from "@rebirth/defs";
import type { LocalPlayerState, ObstacleView, PlayerView, Snapshot } from "@rebirth/sim";
import type { Container } from "pixi.js";
import type { AudioEngine, SoundHandle } from "../audio/audio.ts";
import type { AnimEffect } from "../objects/anims.ts";
import type { ObstacleFx, PlayerFx } from "../objects/types.ts";
import type { ObjectWorld } from "../objects/world.ts";
import type { BulletScene, BulletSystem } from "./bullets.ts";
import type { PlayerHitListener } from "./hitFeedback.ts";
import type { ParticleSystem } from "./particles.ts";

/** players draw at zOrd 18; casings go just above them */
const PLAYER_Z_ORD = 18;
const PLAYER_FX_Z_ORD = PLAYER_Z_ORD + 1;
const CASING_SPEED = 9.5;
const HIT_PARTICLE_SPEED = 7.5;

function rotate(v: Vec2, ang: number): Vec2 {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

function sameLayer(a: number, b: number): boolean {
    return (a & 1) === (b & 1) || ((a & 2) !== 0 && (b & 2) !== 0);
}

function gunDef(id: string): GunDef | undefined {
    const def = id ? GameObjectDefs[id] : undefined;
    return def?.type === "gun" ? def : undefined;
}

/** Render layer and zOrd of a player view (objects/player.ts update; survev player.ts updateRenderLayer). */
export function playerRenderOrder(view: PlayerView, viewerLayer: number): { layer: number; zOrd: number } {
    let zOrd = PLAYER_Z_ORD;
    if (view.layer & 2 && (view.layer & 1) === (viewerLayer & 1)) zOrd += 100;
    return { layer: view.layer, zOrd };
}

interface MeleeObstacle {
    view: ObstacleView;
    def: ObstacleDef;
    col: Collider;
}

/**
 * Obstacles a melee probe can be blocked by on pos -> pos + dir * len (survev collisionHelpers.intersectSegment):
 * collidable, not windows, at least `height` tall, on `layer`. Returns the nearest hit's id and distance.
 */
function firstBlocker(
    obstacles: readonly MeleeObstacle[],
    pos: Vec2,
    dir: Vec2,
    len: number,
    height: number,
    layer: number,
): { id: number; dist: number } | null {
    const end = { x: pos.x + dir.x * len, y: pos.y + dir.y * len };
    let best: { id: number; dist: number } | null = null;
    for (const o of obstacles) {
        if (o.view.dead || !o.def.collidable || o.def.isWindow || o.def.height < height) continue;
        if (!sameLayer(o.view.layer, layer)) continue;
        const res = collider.intersectSegment(o.col, pos, end);
        if (!res) continue;
        const dist = Math.hypot(res.point.x - pos.x, res.point.y - pos.y);
        if (!best || dist < best.dist) best = { id: o.view.id, dist };
    }
    return best;
}

export class GameEffects implements PlayerFx, ObstacleFx, BulletScene {
    readonly audio: AudioEngine;
    readonly particles: ParticleSystem;
    readonly bullets: BulletSystem;
    private world: ObjectWorld | null = null;
    localId = -1;
    cameraPos: Vec2 = { x: 0, y: 0 };
    /** layer of the followed player (the camera's layer) */
    activeLayer = 0;
    /** player positions and facings of the previous snapshot (pan sweeps of the tracer check) */
    private readonly prevPlayers = new Map<number, { pos: Vec2; dir: Vec2 }>();
    /** kill-frame hit sounds played (tests, M9) */
    killHitSounds = 0;
    /** rebirth Enhanced hit effects: told about melee hits on players after their original effects */
    hitListener: PlayerHitListener | null = null;
    /** latest local state (set before the snapshot's views are applied, so view hooks see this snapshot) */
    private local: LocalPlayerState | null = null;
    private prevLocal: LocalPlayerState | null = null;
    private readonly actionSounds = new Map<number, SoundHandle | null>();
    private cycleSound: SoundHandle | null = null;
    /** a gun switch within this window plays the gun's full deploy sound (survev gunSwitchCooldown) */
    private gunSwitchCooldown = 0;
    private dryFired = false;
    /** weapon set whose sounds were last preloaded */
    private preloadKey = "";

    constructor(audio: AudioEngine, particles: ParticleSystem, bullets: BulletSystem) {
        this.audio = audio;
        this.particles = particles;
        this.bullets = bullets;
    }

    setWorld(world: ObjectWorld | null, localId: number): void {
        this.world = world;
        this.localId = localId;
        this.prevLocal = null;
        this.local = null;
        this.actionSounds.clear();
        this.prevPlayers.clear();
    }

    forEachObstacle(cb: (view: ObstacleView) => void): void {
        this.world?.forEachView("obstacle", cb);
    }

    forEachPlayer(cb: (view: PlayerView) => void): void {
        this.world?.forEachView("player", cb);
    }

    get activeAlive(): boolean {
        return !!this.local && !this.local.dead;
    }

    playerById(id: number): PlayerView | undefined {
        const view = this.world?.get(id);
        return view?.kind === "player" ? view : undefined;
    }

    playerOld(id: number): { pos: Vec2; dir: Vec2 } | undefined {
        return this.prevPlayers.get(id);
    }

    playerContainer(id: number): Container | null {
        return this.world?.playerContainer(id) ?? null;
    }

    segmentOnStairs(a: Vec2, b: Vec2): boolean {
        return this.world?.segmentOnStairs(a, b) ?? false;
    }

    brightSurfaceAt(pos: Vec2, layer: number): boolean {
        return this.world?.brightSurfaceAt(pos, layer) ?? false;
    }

    insideStairMask(pos: Vec2, rad: number): boolean {
        return this.world?.insideStructureMask(pos, rad) ?? false;
    }

    /** Call before the snapshot's objects are applied. */
    beginSnapshot(s: Snapshot): void {
        this.prevLocal = this.local;
        this.local = s.local;
        this.prevPlayers.clear();
        this.forEachPlayer((p) => this.prevPlayers.set(p.id, { pos: p.pos, dir: p.dir }));
    }

    /** Call after the snapshot's objects are applied. */
    endSnapshot(s: Snapshot): void {
        if (s.bullets?.length) this.bullets.addEvents(s.bullets, this);
        // bullets often miss their hit sound on the frame a player dies: the Kill message plays it (survev game.ts)
        for (const kill of s.kills ?? []) {
            if (kill.damageType !== DamageType.Player) continue;
            const target = this.playerById(kill.targetId);
            if (!target) continue;
            this.bullets.playerHitSound(target);
            this.killHitSounds++;
        }
        if (this.prevLocal) this.localChanges(this.prevLocal, s.local);
    }

    update(dt: number, cameraPos: Vec2, layer: number): void {
        this.cameraPos = cameraPos;
        this.activeLayer = layer;
        this.audio.cameraPos = cameraPos;
        this.audio.activeLayer = layer;
        this.gunSwitchCooldown -= dt;
        this.bullets.update(dt, this);
        this.particles.update(dt);
    }

    /** Empty-gun click: once per trigger press when the clip and the reserve are both empty (survev player.ts). */
    localInput(shootHold: boolean): void {
        const local = this.local;
        if (!shootHold) {
            this.dryFired = false;
            return;
        }
        if (!local || this.dryFired || local.dead) return;
        const slot = local.weapons[local.curWeapIdx];
        const gun = gunDef(slot?.type ?? "");
        if (!gun || gun.ammoInfinite) return;
        if (slot.ammo === 0 && (local.inventory[gun.ammo] ?? 0) === 0) {
            this.audio.playSound(gun.sound.empty);
            this.dryFired = true;
        }
    }

    /** Local weapon switch and pickup sounds, from consecutive local states. */
    private localChanges(prev: LocalPlayerState, cur: LocalPlayerState): void {
        const prevWeap = prev.weapons[prev.curWeapIdx]?.type ?? "";
        const curWeap = cur.weapons[cur.curWeapIdx]?.type ?? "";
        if (prev.curWeapIdx !== cur.curWeapIdx || prevWeap !== curWeap) this.switchSound(curWeap);

        // one pickup sound per snapshot: a new weapon, else new gear, else a grown inventory stack
        let picked = "";
        for (let i = 0; i < cur.weapons.length && !picked; i++) {
            const type = cur.weapons[i].type;
            const swapped = prev.weapons.some((w, j) => j !== i && w.type === type);
            if (type && type !== prev.weapons[i]?.type && !swapped && type !== "fists") picked = type;
        }
        for (const gear of ["helmet", "chest", "backpack", "outfit"] as const) {
            if (!picked && cur[gear] && cur[gear] !== prev[gear]) picked = cur[gear] ?? "";
        }
        if (!picked) {
            for (const [item, count] of Object.entries(cur.inventory)) {
                if (count > (prev.inventory[item] ?? 0)) {
                    picked = item;
                    break;
                }
            }
        }
        if (picked) {
            const def = GameObjectDefs[picked] as { sound?: { pickup?: string } } | undefined;
            this.audio.playSound(def?.sound?.pickup, { channel: "ui" });
        }
        this.preloadWeapons(cur);
    }

    private switchSound(weapon: string): void {
        const def = weapon ? GameObjectDefs[weapon] : undefined;
        if (!def) return;
        if (def.type === "melee" || def.type === "throwable") {
            this.audio.playSound(def.sound.deploy, { channel: "sfx", pos: this.cameraPos, fallOff: 3 });
        } else if (def.type === "gun") {
            let sound = "gun_switch_01";
            if (this.gunSwitchCooldown > 0) sound = def.sound.deploy;
            else this.gunSwitchCooldown = GameConfig.player.freeSwitchCooldown;
            this.audio.stop(this.cycleSound);
            this.cycleSound = this.audio.playSound(sound);
        }
    }

    /** Loads the sounds of the local loadout so their first play is not dropped. */
    preloadWeapons(local: LocalPlayerState): void {
        const key = local.weapons.map((w) => w.type).join();
        if (key === this.preloadKey) return;
        this.preloadKey = key;
        const names: Array<string | undefined> = ["gun_switch_01"];
        for (const w of local.weapons) {
            const def = w.type ? (GameObjectDefs[w.type] as { sound?: Record<string, string> }) : undefined;
            if (def?.sound) names.push(...Object.values(def.sound).filter((v) => typeof v === "string"));
        }
        this.audio.preload(names);
        this.audio.preload(names, "sfx");
    }

    private isLocal(player: PlayerView): boolean {
        return player.id === this.localId;
    }

    actionStart(player: PlayerView, pos: Vec2, dir: Vec2): void {
        this.audio.stop(this.actionSounds.get(player.id));
        this.actionSounds.delete(player.id);
        const action = player.action;
        if (!action || action.type === "none" || !action.item) return;
        const def = GameObjectDefs[action.item];
        let sound: string | undefined;
        // the alternate full reload plays its own sound (survev player.ts playActionStartSfx: Action.ReloadAlt)
        if (action.type === "reload" && def?.type === "gun")
            sound = action.alt && def.sound.reloadAlt ? def.sound.reloadAlt : def.sound.reload;
        else if (action.type === "use" && (def?.type === "heal" || def?.type === "boost")) sound = def.sound.use;
        if (sound) {
            const handle = this.audio.playSound(sound, {
                channel: this.isLocal(player) ? "activePlayer" : "otherPlayers",
                pos,
                fallOff: 2,
                layer: player.layer,
            });
            this.actionSounds.set(player.id, handle);
        }
        // revolvers and shotguns eject their spent shells on reload (survev playActionStartEffect)
        if (action.type === "reload" && def?.type === "gun" && def.caseTiming === "reload") {
            for (let n = 0; n < def.maxReload; n++) {
                const side = n % 2 === 0 ? -1 : 1;
                const speed = def.maxReload <= 2 ? 1 : 0.8 + Math.random() * 0.4;
                this.casing(def, player, pos, dir, Math.PI + (Math.PI / 4) * side, speed, 0);
            }
        }
    }

    shot(player: PlayerView, pos: Vec2, dir: Vec2): void {
        const def = gunDef(player.activeWeapon);
        if (!def) return;
        // bolt-action and pump guns cycle after the shot, or play the pull when the clip ran dry (survev shot.ts)
        if (this.isLocal(player) && def.fireMode === "single" && def.pullDelay && this.local) {
            const ammoLeft = this.local.weapons[this.local.curWeapIdx]?.ammo ?? 0;
            this.audio.stop(this.cycleSound);
            this.cycleSound = this.audio.playSound(ammoLeft > 0 ? def.sound.cycle : def.sound.pull);
        }
        if (def.caseTiming === "shoot") {
            this.casing(def, player, pos, dir, -Math.PI / 2, 1, def.pullDelay !== undefined ? def.pullDelay * 0.45 : 0);
        }
    }

    /** One spent shell flying out of the gun (survev shot.ts createCasingParticle). */
    private casing(def: GunDef, player: PlayerView, pos: Vec2, dir: Vec2, angle: number, speed: number, delay: number) {
        const p = def.particle;
        const shellDir = p.shellForward ? { x: dir.x * p.shellForward, y: dir.y * p.shellForward } : rotate(dir, angle);
        let vel = rotate(
            { x: shellDir.x * speed * CASING_SPEED, y: shellDir.y * speed * CASING_SPEED },
            (Math.random() - 0.5) * (Math.PI / 3),
        );
        const reach = GameConfig.player.radius + p.shellOffset;
        let shellPos = { x: pos.x + dir.x * reach, y: pos.y + dir.y * reach };
        if (p.shellOffsetY) {
            shellPos = { x: shellPos.x + shellDir.x * p.shellOffsetY, y: shellPos.y + shellDir.y * p.shellOffsetY };
        }
        if (p.shellReverse) vel = { x: -vel.x, y: -vel.y };
        // a gun's own casing (survev particle.casing: the .50 guns' "50cal"), else its ammo's
        this.particles.add(p.casing ?? def.ammo, player.layer, shellPos, vel, {
            scale: p.shellScale,
            rot: -Math.atan2(shellDir.y, shellDir.x),
            zOrd: PLAYER_FX_Z_ORD,
            delay,
        });
    }

    animEffect(player: PlayerView, pos: Vec2, dir: Vec2, effect: AnimEffect): void {
        const def = GameObjectDefs[player.activeWeapon || "fists"];
        if (effect.kind === "sound") {
            const sound = def && "sound" in def ? (def.sound as Record<string, string | undefined>)[effect.sound] : "";
            this.audio.playSound(sound, { channel: "sfx", pos, fallOff: 3, layer: player.layer });
        } else if (effect.kind === "melee" && def?.type === "melee") {
            this.meleeHit(player, pos, dir, def, effect.playerHit);
        } else if (effect.kind === "throwParticles" && def?.type === "throwable" && def.useThrowParticles) {
            this.throwParticles(player, pos, dir);
        }
    }

    /** The pin and the lever of a thrown grenade fly off to the sides (survev player.ts animThrowableParticles). */
    private throwParticles(player: PlayerView, pos: Vec2, dir: Vec2): void {
        const ang = Math.atan2(dir.y, dir.x);
        const pinOff = rotate({ x: 0.75, y: 0.75 }, ang);
        const pinVel = rotate({ x: dir.x * 4.5, y: dir.y * 4.5 }, Math.PI * 0.5);
        this.particles.add("fragPin", player.layer, { x: pos.x + pinOff.x, y: pos.y + pinOff.y }, pinVel, {
            zOrd: PLAYER_FX_Z_ORD,
        });
        const leverOff = rotate({ x: 0.75, y: -0.75 }, ang);
        const leverVel = rotate({ x: dir.x * 3.5, y: dir.y * 3.5 }, -Math.PI * 0.25);
        this.particles.add("fragLever", player.layer, { x: pos.x + leverOff.x, y: pos.y + leverOff.y }, leverVel, {
            zOrd: PLAYER_FX_Z_ORD,
        });
    }

    /**
     * Client-side melee impact (survev player.ts animMeleeCollision): blood and hit sound on players, chips and punch
     * sound on obstacles. Enemies first, then obstacles, teammates last, deepest first within each; one hit unless the
     * weapon cleaves. A player behind an obstacle the probe crosses is not hit; cleaving weapons also skip obstacles
     * behind a wall. Particles draw just above the hit object (obstacles: the attacker's render order).
     */
    private meleeHit(player: PlayerView, pos: Vec2, dir: Vec2, def: MeleeDef, playerHitKey?: string): void {
        const ang = Math.atan2(dir.y, dir.x);
        const off = rotate({ x: def.attack.offset.x + ((player.scale || 1) - 1), y: def.attack.offset.y }, ang);
        const center = { x: pos.x + off.x, y: pos.y + off.y };
        const rad = def.attack.rad;
        const circle = collider.createCircle(center, rad);
        const meleeDist = rad + Math.hypot(off.x, off.y);
        const all: MeleeObstacle[] = [];
        this.forEachObstacle((o) => {
            const odef = MapObjectDefs[o.type] as ObstacleDef | undefined;
            if (odef)
                all.push({
                    view: o,
                    def: odef,
                    col: collider.transform(odef.collision, o.pos, math.oriToRad(o.ori), o.scale),
                });
        });
        const near = all.filter((o) => collider.intersect(circle, o.col) !== null);
        const own = playerRenderOrder(player, this.activeLayer);
        const hits: Array<{
            prio: number;
            pen: number;
            pos: Vec2;
            vel: Vec2;
            layer: number;
            zOrd: number;
            particle: string;
            sound: () => void;
            player?: PlayerView;
        }> = [];
        for (const o of near) {
            const { view, def: odef } = o;
            if (view.dead || odef.height < GameConfig.player.meleeHeight || !sameLayer(view.layer, player.layer & 1)) {
                continue;
            }
            const res = collider.intersect(circle, o.col);
            if (!res) continue;
            if (def.cleave) {
                const toObstacle = { x: view.pos.x - pos.x, y: view.pos.y - pos.y };
                const len = Math.hypot(toObstacle.x, toObstacle.y);
                const meleeDir = len > 1e-6 ? { x: toObstacle.x / len, y: toObstacle.y / len } : { x: 1, y: 0 };
                const wall = firstBlocker(all, pos, meleeDir, meleeDist, odef.height, player.layer);
                if (wall && wall.id !== view.id) continue;
            }
            const point = { x: center.x + res.dir.x * (rad - res.pen), y: center.y + res.dir.y * (rad - res.pen) };
            const vel = rotate(
                { x: -res.dir.x * HIT_PARTICLE_SPEED, y: -res.dir.y * HIT_PARTICLE_SPEED },
                (Math.random() - 0.5) * (Math.PI / 3),
            );
            hits.push({
                prio: 1,
                pen: res.pen,
                pos: point,
                vel,
                layer: own.layer,
                zOrd: own.zOrd,
                particle: odef.hitParticle,
                sound: () => this.audio.playGroup(odef.sound.punch, { pos: point, layer: player.layer }),
            });
        }
        const ownTeam = this.world?.teamOf(player.id) ?? 0;
        this.forEachPlayer((p) => {
            if (p.id === player.id || p.dead || !sameLayer(p.layer, player.layer)) return;
            const prad = GameConfig.player.radius * (p.scale || 1);
            const d = Math.hypot(p.pos.x - center.x, p.pos.y - center.y);
            if (d >= prad + rad) return;
            const toP = { x: p.pos.x - pos.x, y: p.pos.y - pos.y };
            const len = Math.hypot(toP.x, toP.y);
            const meleeDir = len > 1e-6 ? { x: toP.x / len, y: toP.y / len } : { x: 1, y: 0 };
            const end = { x: pos.x + meleeDir.x * meleeDist, y: pos.y + meleeDir.y * meleeDist };
            const line = collider.intersectSegment({ type: 0, pos: p.pos, rad: prad }, pos, end);
            const pt = line ? line.point : p.pos;
            const distToPlayer = Math.hypot(pt.x - pos.x, pt.y - pos.y);
            const blocker = firstBlocker(near, pos, meleeDir, meleeDist, GameConfig.player.meleeHeight, player.layer);
            if (blocker && blocker.dist < distToPlayer) return;
            const team = this.world?.teamOf(p.id) ?? 0;
            const vel = rotate(meleeDir, (Math.random() - 0.5) * (Math.PI / 3));
            const sounds = def.sound as Record<string, string | undefined>;
            const sound = (playerHitKey && sounds[playerHitKey]) || def.sound.playerHit;
            const order = playerRenderOrder(p, this.activeLayer);
            const at = { x: p.pos.x, y: p.pos.y };
            hits.push({
                prio: team !== 0 && team === ownTeam ? 2 : 0,
                pen: prad + rad - d,
                pos: at,
                vel,
                layer: order.layer,
                zOrd: order.zOrd,
                particle: "bloodSplat",
                sound: () => this.audio.playSound(sound, { channel: "hits", pos: at, layer: player.layer }),
                player: p,
            });
        });
        hits.sort((a, b) => a.prio - b.prio || b.pen - a.pen);
        const count = def.cleave ? hits.length : Math.min(hits.length, 1);
        for (let i = 0; i < count; i++) {
            const h = hits[i];
            this.particles.add(h.particle, h.layer, h.pos, h.vel, { zOrd: h.zOrd + 1 });
            h.sound();
            if (h.player) this.hitListener?.onPlayerHit(h.player, h.pos, h.vel, def.damage, player.id);
        }
    }

    obstacleButton(view: ObstacleView, center: Vec2): void {
        const def = MapObjectDefs[view.type] as ObstacleDef | undefined;
        const button = def?.button;
        if (!button || !view.button) return;
        if (button.useParticle) {
            const ang = Math.random() * Math.PI * 2;
            const speed = 5 + Math.random() * 10;
            this.particles.add(button.useParticle, view.layer, center, {
                x: Math.cos(ang) * speed,
                y: Math.sin(ang) * speed,
            });
        }
        const sound = view.button.onOff ? button.sound.on : button.sound.off;
        this.audio.playSound(sound, { channel: "sfx", pos: view.pos, layer: view.layer });
    }

    obstacleDestroyed(view: ObstacleView, center: Vec2): void {
        const def = MapObjectDefs[view.type] as ObstacleDef | undefined;
        if (!def) return;
        const particles = Array.isArray(def.explodeParticle) ? def.explodeParticle : [def.explodeParticle];
        const count = Math.floor(5 + Math.random() * 6);
        for (let i = 0; i < count && particles.length; i++) {
            const ang = Math.random() * Math.PI * 2;
            const speed = 5 + Math.random() * 10;
            const type = particles[Math.floor(Math.random() * particles.length)];
            this.particles.add(type, view.layer, center, { x: Math.cos(ang) * speed, y: Math.sin(ang) * speed });
        }
        this.audio.playSound(def.sound.explode, { channel: "sfx", pos: center, layer: view.layer });
    }

    clear(): void {
        this.bullets.clear();
        this.particles.clear();
    }
}
