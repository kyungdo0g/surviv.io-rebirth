// Basement looting probe (owner, 2026-10-08: "why don't the bots go underground? the military base's basement shows no
// sign of being looted"): per structure with an underground floor (the military base, the bunkers, the mansion and barn
// cellars, the club's bathhouse) which bots walk down, when, through which behaviour, how many of its containers are
// opened and how many items are picked up down there; and the same numbers for the surface buildings to compare.
// Read-only (MatchProbe): positions, layers, Player.lastPickup and obstacle deaths, nothing of the bots is changed.
import type { Bounds, Vec2 } from "@rebirth/core";
import type { Game, Player } from "@rebirth/sim";
import type { BotController } from "../src/controller.ts";
import { pointInBounds } from "../src/geom.ts";
import { NavGrid } from "../src/nav/grid.ts";
import { type UndergroundGrid, UndergroundNav } from "../src/nav/underground.ts";
import type { MatchProbe } from "../src/runner.ts";

/** Positions and layers are sampled this often (ticks; the sim runs 100 per second). */
const POS_EVERY = 10;
/** A bot this close to a stair's top on the ground passed by the stairs. */
const NEAR_STAIRS = 15;

export interface PlaceRecord {
    /** structure (underground) or building def id */
    type: string;
    /** containers (destructible obstacles with loot) on its floor, and how many were destroyed by the end */
    containers: number;
    opened: number;
    /** game seconds of each container destroyed */
    openedAt: number[];
    /** loot items lying on its floor at the start */
    lootStart: number;
    /** distinct bots that stood on its floor (underground: layer 1), with the game second of their first time */
    entered: number;
    enterAt: number[];
    /** personas of the bots that went in */
    personas: Record<string, number>;
    /** behaviour of each bot when it first set foot on the stairs or the floor */
    behaviours: Record<string, number>;
    /** underground: bots that stepped on its stairs but never reached the floor; bots that passed by its stairs */
    stairsOnly: number;
    passedBy: number;
    /** items picked up on its floor */
    pickups: number;
    /** bots that died on its floor */
    deaths: number;
}

export interface BasementReport {
    seed: number;
    gameSeconds: number;
    bots: number;
    underground: PlaceRecord[];
    surface: PlaceRecord[];
    /** pickups on the surface outside every building's interior */
    openPickups: number;
    /** game second of every bot death (early deaths: the owner's other report) */
    deathTimes: number[];
}

interface Place {
    rec: PlaceRecord;
    containerIds: number[];
    bots: Set<number>;
    stairBots: Set<number>;
    nearBots: Set<number>;
    region: UndergroundGrid | null;
    boxes: Bounds[];
}

function record(type: string): PlaceRecord {
    return {
        type,
        containers: 0,
        opened: 0,
        openedAt: [],
        lootStart: 0,
        entered: 0,
        enterAt: [],
        personas: {},
        behaviours: {},
        stairsOnly: 0,
        passedBy: 0,
        pickups: 0,
        deaths: 0,
    };
}

function inBoxes(p: Vec2, boxes: readonly Bounds[]): boolean {
    for (const b of boxes) if (pointInBounds(p, b)) return true;
    return false;
}

export class BasementProbe implements MatchProbe {
    readonly name = "basements";
    private readonly under: Place[] = [];
    private readonly surface: Place[] = [];
    private readonly lastPickup = new Map<number, unknown>();
    private readonly deadSeen = new Set<number>();
    private readonly openedSeen = new Set<number>();
    private openPickups = 0;
    private readonly deathTimes: number[] = [];
    private nav: UndergroundNav | null = null;

    start(game: Game, _bots: readonly BotController[]): void {
        // its own copy of the underground grids (never the bots' shared one)
        const nav = new UndergroundNav(game.mapData, NavGrid.pristine(game.mapData));
        this.nav = nav;
        for (const r of nav.regions) {
            this.under.push({
                rec: record(r.type),
                containerIds: [],
                bots: new Set(),
                stairBots: new Set(),
                nearBots: new Set(),
                region: r,
                boxes: [],
            });
        }
        for (const b of game.world.buildings) {
            if (b.layer !== 0) continue;
            const boxes = b.zoomRegions.flatMap((z) => (z.zoomIn ? [z.zoomIn] : []));
            if (boxes.length === 0) continue;
            this.surface.push({
                rec: record(b.type),
                containerIds: [],
                bots: new Set(),
                stairBots: new Set(),
                nearBots: new Set(),
                region: null,
                boxes,
            });
        }
        for (const o of game.world.objects.values()) {
            if (o.kind !== "obstacle" && o.kind !== "loot") continue;
            const container = o.kind === "obstacle" && o.destructible && !o.dead && !!o.def.loot?.length;
            if (o.kind === "obstacle" && !container) continue;
            const place = this.placeAt(o.pos, o.layer);
            if (!place) continue;
            if (o.kind === "loot") place.rec.lootStart++;
            else place.containerIds.push(o.id);
        }
        for (const p of [...this.under, ...this.surface]) p.rec.containers = p.containerIds.length;
    }

    private placeAt(pos: Vec2, layer: number): Place | null {
        if ((layer & 1) === 1) {
            for (const p of this.under) if (p.region?.onFloor(pos, 0.5)) return p;
            return null;
        }
        if (layer !== 0) return null;
        for (const p of this.surface) if (inBoxes(pos, p.boxes)) return p;
        return null;
    }

    tick(game: Game, bots: readonly BotController[]): void {
        const now = game.time;
        for (const bot of bots) {
            const p = game.getPlayer(bot.playerId);
            if (!p) continue;
            if (p.dead) {
                if (!this.deadSeen.has(p.id)) {
                    this.deadSeen.add(p.id);
                    this.deathTimes.push(Math.round(now));
                    const at = this.placeAt(p.pos, p.layer);
                    if (at) at.rec.deaths++;
                }
                continue;
            }
            const lp = p.lastPickup;
            if (lp && lp !== this.lastPickup.get(p.id) && lp.result === "success") {
                const at = this.placeAt(p.pos, p.layer);
                if (at) at.rec.pickups++;
                else this.openPickups++;
            }
            this.lastPickup.set(p.id, lp);
            if (game.tick % POS_EVERY === 0) this.sample(bot, p, now);
        }
        if (game.tick % POS_EVERY === 0) {
            for (const place of [...this.under, ...this.surface]) {
                for (const id of place.containerIds) {
                    if (this.openedSeen.has(id)) continue;
                    const o = game.world.objects.get(id);
                    if (o && !(o.kind === "obstacle" && o.dead)) continue;
                    this.openedSeen.add(id);
                    place.rec.opened++;
                    place.rec.openedAt.push(Math.round(now));
                }
            }
        }
    }

    private sample(bot: BotController, p: Player, now: number): void {
        const nav = this.nav;
        if (!nav) return;
        const behaviour = bot.bot.intent.behaviour;
        const enter = (place: Place) => {
            if (place.bots.has(p.id)) return;
            place.bots.add(p.id);
            place.rec.entered++;
            place.rec.enterAt.push(Math.round(now));
            const persona = bot.bot.persona.name;
            place.rec.personas[persona] = (place.rec.personas[persona] ?? 0) + 1;
            if (!place.stairBots.has(p.id))
                place.rec.behaviours[behaviour] = (place.rec.behaviours[behaviour] ?? 0) + 1;
        };
        if (p.layer === 0) {
            const s = this.placeAt(p.pos, 0);
            if (s) enter(s);
            for (const place of this.under) {
                if (place.nearBots.has(p.id)) continue;
                for (const portal of place.region?.portals ?? []) {
                    if (portal.top && Math.hypot(portal.top.x - p.pos.x, portal.top.y - p.pos.y) < NEAR_STAIRS) {
                        place.nearBots.add(p.id);
                        break;
                    }
                }
            }
            return;
        }
        const portal = nav.portalAt(p.pos, 0.5);
        if (portal && (p.layer & 2) !== 0) {
            const place = this.under[portal.region.id];
            if (!place.stairBots.has(p.id) && !place.bots.has(p.id)) {
                place.stairBots.add(p.id);
                place.rec.behaviours[behaviour] = (place.rec.behaviours[behaviour] ?? 0) + 1;
            }
        }
        if ((p.layer & 1) === 1) {
            const place = this.placeAt(p.pos, p.layer);
            if (place) enter(place);
        }
    }

    finish(game: Game, bots: readonly BotController[]): BasementReport {
        for (const place of this.under) {
            let only = 0;
            for (const id of place.stairBots) if (!place.bots.has(id)) only++;
            place.rec.stairsOnly = only;
            place.rec.passedBy = place.nearBots.size;
        }
        return {
            seed: 0,
            gameSeconds: game.time,
            bots: bots.length,
            underground: this.under.map((p) => p.rec),
            surface: this.surface.map((p) => p.rec),
            openPickups: this.openPickups,
            deathTimes: this.deathTimes,
        };
    }
}

/** Display names of the underground structures (docs/research/maps/bunkers.md, rebirth-deviations.md). */
export const UNDERGROUND_NAMES: Readonly<Record<string, string>> = {
    military_base_01: "military base basement",
    bunker_structure_02: "Hydra bunker",
    bunker_structure_03: "Storm bunker",
    bunker_structure_04: "Conch bunker",
    bunker_structure_05: "Crossing bunker",
    bunker_structure_08: "Chrysanthemum bunker (vaults)",
    club_structure_01: "club bathhouse",
    mansion_structure_01: "mansion cellar",
    barn_basement_structure_01: "barn basement",
};

export interface PlaceRow {
    name: string;
    instances: number;
    /** instances at least one bot went into */
    reached: number;
    entered: number;
    stairsOnly: number;
    passedBy: number;
    /** median game second of the first entry per instance (-1 none) */
    firstEnter: number;
    containers: number;
    opened: number;
    lootStart: number;
    pickups: number;
    deaths: number;
    personas: Record<string, number>;
    behaviours: Record<string, number>;
}

function median(xs: number[]): number {
    if (xs.length === 0) return -1;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
}

function add(into: Record<string, number>, from: Record<string, number>): void {
    for (const [k, v] of Object.entries(from)) into[k] = (into[k] ?? 0) + v;
}

/** Rows per structure (underground) or building type (surface), summed over matches. */
export function placeRows(recs: readonly PlaceRecord[], names: Readonly<Record<string, string>> = {}): PlaceRow[] {
    const rows = new Map<string, PlaceRow & { firsts: number[] }>();
    for (const r of recs) {
        let row = rows.get(r.type);
        if (!row) {
            row = {
                name: names[r.type] ?? r.type,
                instances: 0,
                reached: 0,
                entered: 0,
                stairsOnly: 0,
                passedBy: 0,
                firstEnter: -1,
                containers: 0,
                opened: 0,
                lootStart: 0,
                pickups: 0,
                deaths: 0,
                personas: {},
                behaviours: {},
                firsts: [],
            };
            rows.set(r.type, row);
        }
        row.instances++;
        if (r.entered > 0) {
            row.reached++;
            row.firsts.push(Math.min(...r.enterAt));
        }
        row.entered += r.entered;
        row.stairsOnly += r.stairsOnly;
        row.passedBy += r.passedBy;
        row.containers += r.containers;
        row.opened += r.opened;
        row.lootStart += r.lootStart;
        row.pickups += r.pickups;
        row.deaths += r.deaths;
        add(row.personas, r.personas);
        add(row.behaviours, r.behaviours);
    }
    return [...rows.values()].map(({ firsts, ...row }) => ({ ...row, firstEnter: median(firsts) }));
}

function top(rec: Record<string, number>, n = 4): string {
    return Object.entries(rec)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([k, v]) => `${k} ${v}`)
        .join(", ");
}

/** A plain-text table of rows. */
export function formatRows(rows: readonly PlaceRow[], underground: boolean): string {
    const head = underground
        ? "structure                       | inst | reached | bots in | stairs only | passed by | first in (s) | containers opened | loot at start | pickups | deaths | behaviours / personas"
        : "building                        | inst | reached | bots in | first in (s) | containers opened | loot at start | pickups";
    const lines = [head];
    for (const r of rows) {
        const opened = `${r.opened}/${r.containers}`.padStart(9);
        const base = `${r.name.padEnd(31)} | ${String(r.instances).padStart(4)} | ${String(r.reached).padStart(7)} | ${String(r.entered).padStart(7)}`;
        if (underground) {
            lines.push(
                `${base} | ${String(r.stairsOnly).padStart(11)} | ${String(r.passedBy).padStart(9)} | ` +
                    `${String(r.firstEnter).padStart(12)} | ${opened.padStart(17)} | ${String(r.lootStart).padStart(13)} | ` +
                    `${String(r.pickups).padStart(7)} | ${String(r.deaths).padStart(6)} | ${top(r.behaviours)} / ${top(r.personas)}`,
            );
        } else {
            lines.push(
                `${base} | ${String(r.firstEnter).padStart(12)} | ${opened.padStart(17)} | ` +
                    `${String(r.lootStart).padStart(13)} | ${String(r.pickups).padStart(7)}`,
            );
        }
    }
    return lines.join("\n");
}

/** Every surface building summed into one row (`label`). */
export function totalRow(rows: readonly PlaceRow[], label: string): PlaceRow {
    const t: PlaceRow = {
        name: label,
        instances: 0,
        reached: 0,
        entered: 0,
        stairsOnly: 0,
        passedBy: 0,
        firstEnter: -1,
        containers: 0,
        opened: 0,
        lootStart: 0,
        pickups: 0,
        deaths: 0,
        personas: {},
        behaviours: {},
    };
    for (const r of rows) {
        t.instances += r.instances;
        t.reached += r.reached;
        t.entered += r.entered;
        t.stairsOnly += r.stairsOnly;
        t.passedBy += r.passedBy;
        t.containers += r.containers;
        t.opened += r.opened;
        t.lootStart += r.lootStart;
        t.pickups += r.pickups;
        t.deaths += r.deaths;
        add(t.personas, r.personas);
        add(t.behaviours, r.behaviours);
    }
    return t;
}
