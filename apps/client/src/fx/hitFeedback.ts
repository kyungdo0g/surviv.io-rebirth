// Rebirth "Enhanced hit effects" (user/2026-10-07-hit-feedback; docs/research/rebirth-deviations.md): hit feedback on
// top of the original v0.8.82 effects, which keep playing untouched (the listener runs after them), behind the
// `enhancedHitFx` setting (on by default; off is exactly v0.8.82, the rebirth red-zone flash included).
// - The active player takes damage (Snapshot.hits, exact amounts): a red edge vignette scaled by the damage with a
//   pulsing floor below 25 HP (ui/hitVignette.ts), damage arcs toward the attacker (fx/hitMarkers.ts) and a small
//   camera kick along the hit, only with Screen shake on. Bleeding and gas add nothing (the original bleed effect and
//   the red-zone flash cover them); air drop crushes only pulse the vignette.
// - The active player deals damage: a hit marker at the cursor (at the target on touch and while spectating), white
//   body / blue armour / gold headshot / orange knock / red kill, and a short centred confirm sound.
// - Any player hit, seen by everyone (the client's own tracer and melee hits, nominal damage): a white-then-red body
//   flash (fx/hitFlash.ts) and more blood scaled by the damage, heavier on headshots the viewer dealt or took and on
//   kills and knocks. A server-confirmed hit the client saw nothing of within 0.15 s (explosions, missed tracers) gets
//   the flash and the blood from its exact amount.
// Everything is pooled or fixed-size and capped for big fights (fx/hitFeedbackMath.ts load limits): 32 per-frame target
// slots (players hit beyond them in one frame keep only the original effects), 16 pending server hits, 4 arcs, one
// marker, one vignette node, at most 8 flash sprites (the viewer's own hits first), extra blood at most 96 splats per
// second for the viewer's own hits and 32 for everyone else's, shared across the players hit in a frame and skipped
// on bodies too small on screen.
import type { Vec2 } from "@rebirth/core";
import { DamageType } from "@rebirth/defs";
import type { LocalPlayerState, ObjectView, PlayerView, Snapshot } from "@rebirth/sim";
import type { Container } from "pixi.js";
import type { TextureStore } from "../assets/textures.ts";
import type { AudioEngine } from "../audio/audio.ts";
import { config } from "../config.ts";
import type { Camera } from "../render/camera.ts";
import type { Renderer } from "../render/renderer.ts";
import { HitVignette } from "../ui/hitVignette.ts";
import { playerRenderOrder } from "./effects.ts";
import {
    addKick,
    CONFIRM_INTERVAL,
    CONFIRM_SOUNDS,
    confirmSound,
    extraBloodCount,
    type FlashParams,
    flashParams,
    hitIntensity,
    hitVariant,
    KICK_DECAY,
    kickAmount,
    MarkerVariant,
    MIN_BLOOD_RADIUS_PX,
    OTHER_BLOOD_BURST,
    OTHER_BLOOD_RATE,
    OWN_BLOOD_BURST,
    OWN_BLOOD_RATE,
    sharedBloodCount,
    strongerVariant,
    TokenBucket,
} from "./hitFeedbackMath.ts";
import { HitFlashes } from "./hitFlash.ts";
import { HitMarkers } from "./hitMarkers.ts";
import type { ParticleSystem } from "./particles.ts";

/** a server hit and a client hit on the same target this close in time are the same hit (seconds) */
const MATCH_WINDOW = 0.15;
const FRAME_SLOTS = 32;
const PENDING_SLOTS = 16;
/** the marker sits this far from the player along the aim when its target is not in view (px) */
const MARKER_FALLBACK_DIST = 80;
/** the kill / knock burst: splats evenly around the target */
const KILL_BURST = 6;
const ZERO: Vec2 = { x: 0, y: 0 };

/** Told about every player hit the client shows (bullets.ts, effects.ts), after the original effects. */
export interface PlayerHitListener {
    onPlayerHit(target: PlayerView, point: Vec2, dir: Vec2, nominal: number, shooterId: number): void;
}

/** What the hit feedback reads from the object world (ObjectWorld implements it). */
export interface HitWorld {
    get(id: number): ObjectView | undefined;
    playerContainer(id: number): Container | null;
    visualPos(id: number, now: number): Vec2 | undefined;
    teamOf(id: number): number;
}

export interface HitFeedbackDeps {
    renderer: Pick<Renderer, "pool" | "screen">;
    textures: TextureStore;
    audio: AudioEngine;
    particles: ParticleSystem;
    camera: Camera;
    /** HUD root for the vignette (null in tests) */
    hudRoot: HTMLElement | null;
    enabled?: boolean;
    /**
     * a player at `pos` on `layer` stands in the dark out of every light (fx/darkness.ts shrouded): no arc points at it
     * and no marker follows it, as both are drawn over the darkness overlay
     */
    shrouded?(pos: Vec2, layer: number): boolean;
}

export interface HitFeedbackFrame {
    dt: number;
    /** interpolation clock (seconds) */
    now: number;
    /** the active player's drawn position */
    activePos: Vec2;
    local: LocalPlayerState;
    downed: boolean;
    /** desktop cursor (screen px); null on touch and while spectating: the marker goes to its target */
    cursor: Vec2 | null;
    /** the active player's facing (world), for a marker whose target is out of view */
    aimDir: Vec2;
    hudHidden: boolean;
    hudScale: number;
}

interface FrameSlot {
    targetId: number;
    sum: number;
    point: Vec2;
    dir: Vec2;
    headshot: boolean;
    /** a hit the active player dealt or took (first claim on the flashes and the blood) */
    own: boolean;
}

interface Pending {
    targetId: number;
    amount: number;
    headshot: boolean;
    dir: Vec2;
    age: number;
    active: boolean;
}

const newSlot = (): FrameSlot => ({
    targetId: 0,
    sum: 0,
    point: { x: 0, y: 0 },
    dir: { x: 1, y: 0 },
    headshot: false,
    own: false,
});

export class HitFeedback implements PlayerHitListener {
    private readonly deps: HitFeedbackDeps;
    private enabledFlag: boolean;
    private world: HitWorld | null = null;
    private activeId = -1;
    /** layer of the active player (players on stairs draw above them on its floor) */
    private viewerLayer = 0;
    private time = 0;
    /** interpolation clock of the latest frame (the drawn positions of hit players) */
    private now = 0;
    readonly flashes: HitFlashes;
    readonly markers: HitMarkers;
    readonly vignette: HitVignette;
    private readonly kick: Vec2 = { x: 0, y: 0 };
    /** extra blood budgets: the active player's own hits, everyone else's */
    private readonly ownBlood = new TokenBucket(OWN_BLOOD_RATE, OWN_BLOOD_BURST);
    private readonly otherBlood = new TokenBucket(OTHER_BLOOD_RATE, OTHER_BLOOD_BURST);
    private readonly slots: FrameSlot[] = Array.from({ length: FRAME_SLOTS }, newSlot);
    private slotCount = 0;
    private readonly pending: Pending[] = Array.from({ length: PENDING_SLOTS }, () => ({
        targetId: 0,
        amount: 0,
        headshot: false,
        dir: { x: 1, y: 0 },
        age: 0,
        active: false,
    }));
    /** time of the latest client-seen hit per player (pruned to the players still known) */
    private readonly clientHits = new Map<number, number>();
    private lastConfirm = Number.NEGATIVE_INFINITY;
    private markerTarget = 0;
    // per-frame scratch (no allocation per hit or per frame): flash numbers, a splat's start and velocity, the view
    private readonly flashScratch: FlashParams = { alpha: 0, duration: 0 };
    private readonly splatPos: Vec2 = { x: 0, y: 0 };
    private readonly splatVel: Vec2 = { x: 0, y: 0 };
    private readonly splatOpts = { scale: 1, zOrd: 0 };
    private bounds: { min: Vec2; max: Vec2 } | null = null;
    /**
     * an attacker's screen position for the arcs (null when not in view, or hidden in the dark: the arc then keeps the
     * hit's direction), at the latest frame's clock
     */
    private readonly sourcePos = (id: number): Vec2 | null => {
        const pos = this.shownPos(id);
        return pos ? this.deps.camera.worldToScreen(pos) : null;
    };
    /** counters since boot (tests, debug); `dropped`: hits beyond the frame's FRAME_SLOTS players */
    readonly stats = { confirms: 0, extraBlood: 0, bursts: 0, kicks: 0, vignetteHits: 0, serverOnly: 0, dropped: 0 };

    constructor(deps: HitFeedbackDeps) {
        this.deps = deps;
        this.enabledFlag = deps.enabled ?? true;
        this.flashes = new HitFlashes(deps.renderer.pool, deps.textures);
        this.markers = new HitMarkers(deps.renderer.screen);
        this.vignette = new HitVignette(deps.hudRoot);
    }

    get enabled(): boolean {
        return this.enabledFlag;
    }

    /** Loads the confirm sounds (at game start, with the other preloads). */
    preload(): void {
        this.deps.audio.preload(CONFIRM_SOUNDS, "hits");
    }

    /** The setting changed; off drops every running effect at once. */
    setEnabled(on: boolean): void {
        if (on === this.enabledFlag) return;
        this.enabledFlag = on;
        if (!on) this.clear();
    }

    setWorld(world: HitWorld | null, activeId: number): void {
        this.world = world;
        this.clear();
        this.activeId = activeId;
    }

    /** The snapshots follow another player (spectating): its own HUD effects start fresh. */
    setActive(id: number): void {
        if (id === this.activeId) return;
        this.activeId = id;
        this.resetHud();
    }

    /** The current kick offset in world units (tests). */
    get kickOffset(): Vec2 {
        return { x: this.kick.x, y: this.kick.y };
    }

    // --- client-seen hits (any player) ---

    onPlayerHit(target: PlayerView, point: Vec2, dir: Vec2, nominal: number, shooterId: number): void {
        if (!this.enabledFlag || target.dead || !(nominal > 0)) return;
        const world = this.world;
        // the server drops teammate hits: no flash or extra blood where no damage is dealt
        const team = world?.teamOf(target.id) ?? 0;
        if (shooterId !== target.id && team !== 0 && team === (world?.teamOf(shooterId) ?? 0)) return;
        // the hit is seen either way, so its server confirmation never shows it a second time
        this.clientHits.set(target.id, this.time);
        let headshot = false;
        for (const p of this.pending) {
            if (!p.active || p.targetId !== target.id) continue;
            p.active = false;
            headshot = p.headshot;
            break;
        }
        const slot = this.slotFor(target.id);
        if (!slot) {
            // more players hit this frame than there are slots: this one keeps only the original effects
            this.stats.dropped++;
            return;
        }
        slot.sum += nominal;
        slot.point.x = point.x;
        slot.point.y = point.y;
        slot.dir.x = dir.x;
        slot.dir.y = dir.y;
        if (headshot) slot.headshot = true;
        if (target.id === this.activeId || shooterId === this.activeId) slot.own = true;
    }

    /** The frame slot of `targetId`, a new one, or null when all FRAME_SLOTS hold other players. */
    private slotFor(targetId: number): FrameSlot | null {
        for (let i = 0; i < this.slotCount; i++) if (this.slots[i].targetId === targetId) return this.slots[i];
        if (this.slotCount === FRAME_SLOTS) return null;
        const slot = this.slots[this.slotCount++];
        slot.targetId = targetId;
        slot.sum = 0;
        slot.headshot = false;
        slot.own = false;
        return slot;
    }

    // --- snapshot facts (the active player's hits, kills) ---

    applySnapshot(s: Snapshot): void {
        if (!this.enabledFlag) return;
        this.setActive(s.localPlayerId);
        const active = this.activeId;
        /** strongest marker variant of this snapshot, -1 for none */
        let variant = -1;
        let dealt = 0;
        let taken = 0;
        for (const h of s.hits ?? []) {
            if (h.targetId === active) {
                if (h.damageType === DamageType.Gas || h.damageType === DamageType.Bleeding) continue;
                taken += h.amount;
                if (h.damageType !== DamageType.Airdrop) this.takeHit(h.sourceId === active ? 0 : h.sourceId, h);
                this.serverHit(active, h.amount, h.headshot, h.dir);
            } else if (h.sourceId === active) {
                dealt += h.amount;
                variant = Math.max(variant, hitVariant(h.headshot, h.armored));
                this.markerTarget = h.targetId;
                if (h.targetId) this.serverHit(h.targetId, h.amount, h.headshot, undefined);
            }
        }
        if (taken > 0) {
            this.vignette.hit(hitIntensity(taken));
            this.stats.vignetteHits++;
        }
        for (const kill of s.kills ?? []) {
            const burst = kill.damageType === DamageType.Player || kill.damageType === DamageType.Airstrike;
            const knock = kill.downed && !kill.killed;
            const own = kill.killerId === active || kill.targetId === active;
            if (burst) this.killBurst(kill.targetId, knock, own);
            if (kill.killerId === active && kill.targetId !== active && (kill.killed || kill.downed)) {
                variant = Math.max(variant, knock ? MarkerVariant.Knock : MarkerVariant.Kill);
                this.markerTarget = kill.targetId;
            }
        }
        // kill > knock > headshot > armour > body (MarkerVariant order, strongerVariant)
        if (variant >= 0) {
            const v = strongerVariant(MarkerVariant.Body, variant as MarkerVariant);
            this.dealHit(v, v >= MarkerVariant.Knock ? 1 : hitIntensity(dealt));
        }
    }

    /** One hit taken from `sourceId` (0: unknown or self): an arc and the kick. */
    private takeHit(sourceId: number, h: { amount: number; dir?: Vec2 }): void {
        const k = hitIntensity(h.amount);
        if (sourceId || h.dir) this.markers.addArc(sourceId, h.dir, k);
        if (h.dir && this.deps.camera.shakeEnabled) {
            // the screen jolts along the hit's travel (the camera moves against it), like the dead body's slide
            addKick(this.kick, { x: -h.dir.x, y: -h.dir.y }, kickAmount(k));
            this.stats.kicks++;
        }
    }

    private dealHit(variant: MarkerVariant, k: number): void {
        this.markers.showMarker(variant, k);
        const strong = variant >= MarkerVariant.Knock;
        if (!strong && this.time - this.lastConfirm < CONFIRM_INTERVAL) return;
        this.lastConfirm = this.time;
        const sound = confirmSound(variant, k);
        this.deps.audio.playSound(sound.name, {
            channel: "hits",
            detune: sound.detune,
            volumeScale: sound.volumeScale,
            filter: "none",
        });
        this.stats.confirms++;
    }

    /** A server-confirmed hit on `targetId`: matched with a client hit, or kept 0.15 s waiting for one. */
    private serverHit(targetId: number, amount: number, headshot: boolean, dir: Vec2 | undefined): void {
        const seen = this.clientHits.get(targetId);
        if (seen !== undefined && this.time - seen <= MATCH_WINDOW) {
            if (headshot) this.headshotBurst(targetId);
            return;
        }
        const p = this.pending.find((q) => q.active && q.targetId === targetId) ?? this.pending.find((q) => !q.active);
        if (!p) return;
        if (!p.active) {
            p.amount = 0;
            p.headshot = false;
            p.age = 0;
            p.dir.x = 0;
            p.dir.y = 0;
        }
        p.active = true;
        p.targetId = targetId;
        p.amount += amount;
        p.headshot = p.headshot || headshot;
        if (dir) {
            p.dir.x = dir.x;
            p.dir.y = dir.y;
        }
    }

    private headshotBurst(targetId: number): void {
        const target = this.player(targetId);
        if (!target) return;
        // the extra two splats of a known headshot, a little bigger
        this.spray(target, this.drawnPos(target), ZERO, 2, 1, 1.3, true, true);
    }

    private killBurst(targetId: number, knock: boolean, own: boolean): void {
        // the snapshot carrying the Kill event already shows the target dead
        const view = targetId ? this.world?.get(targetId) : undefined;
        const target = view?.kind === "player" ? view : null;
        if (!target || !this.onScreen(target.pos)) return;
        if (!own && !this.bigEnough(target)) return;
        const order = playerRenderOrder(target, this.viewerLayer);
        const at = this.drawnPos(target);
        const n = (own ? this.ownBlood : this.otherBlood).take(KILL_BURST);
        const vel = this.splatVel;
        this.splatOpts.zOrd = order.zOrd + 1;
        for (let i = 0; i < n; i++) {
            const a = (i / KILL_BURST) * Math.PI * 2 + Math.random() * 0.4;
            const speed = 4 + Math.random() * 4;
            vel.x = Math.cos(a) * speed;
            vel.y = Math.sin(a) * speed;
            this.splatOpts.scale = 0.9 + Math.random() * 0.4;
            this.deps.particles.add("bloodSplat", target.layer, at, vel, this.splatOpts);
        }
        this.stats.extraBlood += n;
        this.stats.bursts++;
        if (knock) this.flashPlayer(target, flashParams(1, false, true, this.flashScratch), own);
    }

    private player(id: number): PlayerView | null {
        const view = id ? this.world?.get(id) : undefined;
        return view?.kind === "player" && !view.dead ? view : null;
    }

    /** Where `target` is drawn now (interpolated), so world blood starts on the body the viewer sees. */
    private drawnPos(target: PlayerView): Vec2 {
        return this.world?.visualPos(target.id, this.now) ?? target.pos;
    }

    private onScreen(pos: Vec2): boolean {
        // the frame's view (update), or the camera's now for a snapshot between frames
        const b = this.bounds ?? this.deps.camera.viewBounds(2);
        return pos.x >= b.min.x && pos.x <= b.max.x && pos.y >= b.min.y && pos.y <= b.max.y;
    }

    /** Whether `target`'s body is big enough on screen for other players' hits to bleed extra (not zoomed far out). */
    private bigEnough(target: PlayerView): boolean {
        return this.deps.camera.z() * (target.scale || 1) >= MIN_BLOOD_RADIUS_PX;
    }

    private flashPlayer(target: PlayerView, params: FlashParams, own: boolean): void {
        const container = this.world?.playerContainer(target.id);
        if (container) this.flashes.flash(target.id, container, target.scale || 1, params, own);
    }

    /**
     * `count` extra blood splats from `point` along `dir` (spread ±0.6 rad; any direction for a zero `dir`), scaled
     * by `scale`, drawn just above the target (survev bloodSplat, the hit sprites of the original), out of the own or
     * the others' budget.
     */
    private spray(
        target: PlayerView,
        point: Vec2,
        dir: Vec2,
        count: number,
        k: number,
        scale: number,
        any: boolean,
        own: boolean,
    ): void {
        if (count <= 0 || !this.onScreen(target.pos)) return;
        if (!own && !this.bigEnough(target)) return;
        const n = (own ? this.ownBlood : this.otherBlood).take(count);
        if (n === 0) return;
        const zOrd = playerRenderOrder(target, this.viewerLayer).zOrd + 1;
        const base = Math.atan2(dir.y, dir.x);
        const rad = 0.6 * (target.scale || 1);
        // the particle system copies the start and the velocity, so one scratch pair serves every splat
        const pos = this.splatPos;
        const vel = this.splatVel;
        pos.x = any ? point.x : point.x + dir.x * rad;
        pos.y = any ? point.y : point.y + dir.y * rad;
        for (let i = 0; i < n; i++) {
            const a = any ? Math.random() * Math.PI * 2 : base + (Math.random() - 0.5) * 1.2;
            const speed = (2.5 + Math.random() * 3.5) * (0.7 + 0.6 * k);
            vel.x = Math.cos(a) * speed;
            vel.y = Math.sin(a) * speed;
            this.splatOpts.scale = (0.6 + Math.random() * 0.4) * (0.8 + 0.4 * k) * scale;
            this.splatOpts.zOrd = zOrd;
            this.deps.particles.add("bloodSplat", target.layer, pos, vel, this.splatOpts);
        }
        this.stats.extraBlood += n;
    }

    // --- per frame ---

    update(f: HitFeedbackFrame): void {
        this.time += f.dt;
        this.now = f.now;
        this.ownBlood.refill(f.dt);
        this.otherBlood.refill(f.dt);
        this.viewerLayer = f.local.layer;
        if (!this.enabledFlag) return;
        this.bounds = this.deps.camera.viewBounds(2);
        // the active player's own hits first (they claim the flashes and their own blood), then everyone else's,
        // sharing the others' blood when many are hit at once
        let others = 0;
        for (let i = 0; i < this.slotCount; i++) if (!this.slots[i].own) others++;
        for (let pass = 0; pass < 2; pass++) {
            const own = pass === 0;
            for (let i = 0; i < this.slotCount; i++) {
                const slot = this.slots[i];
                if (slot.own !== own) continue;
                const target = this.player(slot.targetId);
                if (!target) continue;
                const k = hitIntensity(slot.sum);
                this.flashPlayer(target, flashParams(k, slot.headshot, false, this.flashScratch), own);
                const at = this.drawnPos(target);
                const count = own ? extraBloodCount(k) : sharedBloodCount(k, others);
                this.spray(target, at, slot.dir, count, k, 1, false, own);
                if (slot.headshot) this.spray(target, at, slot.dir, 2, k, 1.3, false, own);
            }
        }
        this.slotCount = 0;
        for (const p of this.pending) {
            if (!p.active) continue;
            p.age += f.dt;
            if (p.age < MATCH_WINDOW) continue;
            p.active = false;
            const target = this.player(p.targetId);
            if (!target) continue;
            // nothing on screen showed this hit (an explosion, a tracer the client missed): its exact amount; the
            // server only reports the active player's own hits
            const k = hitIntensity(p.amount);
            this.flashPlayer(target, flashParams(k, p.headshot, false, this.flashScratch), true);
            const hasDir = p.dir.x !== 0 || p.dir.y !== 0;
            this.spray(target, this.drawnPos(target), hasDir ? p.dir : ZERO, extraBloodCount(k), k, 1, !hasDir, true);
            this.stats.serverOnly++;
        }
        if (this.clientHits.size > 64) {
            for (const [id, at] of this.clientHits) if (this.time - at > 1) this.clientHits.delete(id);
        }
        this.flashes.update(f.dt);
        const standing = !f.local.dead && !f.downed;
        this.vignette.update(f.dt, standing ? f.local.health : null);
        const camera = this.deps.camera;
        if (camera.shakeEnabled && (this.kick.x !== 0 || this.kick.y !== 0)) camera.addOffset(this.kick.x, this.kick.y);
        const decay = Math.exp(-KICK_DECAY * f.dt);
        this.kick.x = Math.abs(this.kick.x * decay) < 1e-4 ? 0 : this.kick.x * decay;
        this.kick.y = Math.abs(this.kick.y * decay) < 1e-4 ? 0 : this.kick.y * decay;
        const center = camera.worldToScreen(f.activePos);
        const screen = { width: camera.screenWidth, height: camera.screenHeight };
        this.markers.update(f.dt, this.markerPos(f, center), center, screen, this.sourcePos, f.hudHidden, f.hudScale);
    }

    /** A player's drawn position, unless it is out of view or stands in the dark out of every light. */
    private shownPos(id: number): Vec2 | undefined {
        const pos = this.world?.visualPos(id, this.now);
        if (!pos) return undefined;
        const view = this.world?.get(id);
        if (view && this.deps.shrouded?.(pos, view.layer)) return undefined;
        return pos;
    }

    private markerPos(f: HitFeedbackFrame, center: Vec2): Vec2 {
        if (f.cursor) return f.cursor;
        const pos = this.markerTarget ? this.shownPos(this.markerTarget) : undefined;
        if (pos) return this.deps.camera.worldToScreen(pos);
        return { x: center.x + f.aimDir.x * MARKER_FALLBACK_DIST, y: center.y - f.aimDir.y * MARKER_FALLBACK_DIST };
    }

    private resetHud(): void {
        this.markers.clear();
        this.vignette.reset();
        this.kick.x = 0;
        this.kick.y = 0;
        this.markerTarget = 0;
    }

    /** Drops every running effect (setting off, a new world). */
    clear(): void {
        this.resetHud();
        this.flashes.clear();
        this.slotCount = 0;
        for (const p of this.pending) p.active = false;
        this.clientHits.clear();
    }

    destroy(): void {
        this.clear();
        this.markers.destroy();
        this.vignette.destroy();
    }
}

/**
 * Hooks the feedback to the systems that show player hits (bullets.ts, effects.ts) and follows the Enhanced hit effects
 * setting (config.ts `enhancedHitFx`); `onChange` hears the setting too (off is exactly v0.8.82, so the client turns the
 * rebirth red-zone flash off with it). Returns the unsubscribe function.
 */
export function bindHitFx(
    fx: HitFeedback,
    sources: ReadonlyArray<{ hitListener: PlayerHitListener | null }>,
    onChange: (on: boolean) => void,
): () => void {
    for (const source of sources) source.hitListener = fx;
    const cfg = config();
    const apply = () => {
        const on = cfg.get("enhancedHitFx");
        fx.setEnabled(on);
        onChange(on);
    };
    apply();
    return cfg.onChange((key) => {
        if (key === "enhancedHitFx") apply();
    });
}
