// Kill feed and kill texts (survev client/src/ui/ui2.ts getKillFeedText / getKillFeedColor / getKillText /
// getKillCountText / role texts, game.ts Kill and RoleAnnouncement handlers; docs/research/ui/hud.md "Kill feed"):
// six lines under the kill leader box, newest on top, each fading in over 0.25 s and out between 6 s and 6.5 s,
// 35 px apart. Texts are assembled from the string table exactly like the original (no per-language grammar), the
// weapon is the localized item name, colours: the active player's team died #d1777c, its team got the kill
// #00bfff, else #efeeee; role events use the role's kill feed colour (kill leader #ff8400).
import { DamageType, GameObjectDefs, MapObjectDefs, type RoleDef } from "@rebirth/defs";
import type { KillEvent, RoleAnnouncementEvent } from "@rebirth/sim";
import { itemName, t, tryT } from "../l10n/index.ts";

/** survev ui2.ts maxKillFeedLines */
export const KILL_FEED_LINES = 6;
const LINE_SPACING = 35;
/** killfeed names are cut to 180 px of bold 16px Arial (survev player.ts nameTruncated) */
const NAME_FONT = "bold 16px arial";
const NAME_MAX_PX = 180;

export interface PlayerNames {
    /** display name, "" when unknown */
    name(id: number): string;
    /** team id, 0 when unknown */
    teamId(id: number): number;
}

let measureCtx: CanvasRenderingContext2D | null = null;

/** `name` cut with an ellipsis to fit the kill feed (survev helpers.truncateString). */
export function truncateName(name: string): string {
    measureCtx ??= document.createElement("canvas").getContext("2d");
    const ctx = measureCtx;
    if (!ctx) return name;
    ctx.font = NAME_FONT;
    let out = name;
    for (let i = name.length; i > 0 && ctx.measureText(out).width > NAME_MAX_PX; ) out = `${name.substring(0, --i)}…`;
    return out;
}

/** Localized name of a damage source: an item ("AK-47") or a map object, "" when the table has none. */
export function sourceName(type: string): string {
    if (!type) return "";
    if (GameObjectDefs[type]) return itemName(type);
    return tryT(`game-${type}`);
}

/** Kill feed line of a kill (survev getKillFeedText). */
export function killFeedText(e: KillEvent, names: PlayerNames): string {
    const sourceType = e.itemSourceType || e.mapSourceType;
    const target = truncateName(names.name(e.targetId));
    const downed = e.downed && !e.killed;
    // knock-outs and environment deaths name the credited player, other kills the one who dealt the hit
    const useCredit =
        downed ||
        e.damageType === DamageType.Gas ||
        e.damageType === DamageType.Bleeding ||
        e.damageType === DamageType.Airdrop;
    const killerId = useCredit ? e.killCreditId : e.killerId;
    const killer = names.teamId(killerId) ? truncateName(names.name(killerId)) : "";
    switch (e.damageType) {
        case DamageType.Player:
            return `${killer} ${t(downed ? "game-knocked-out" : "game-killed")} ${target} ${t("game-with")} ${sourceName(sourceType)}`;
        case DamageType.Bleeding: {
            const txt = t(killer ? "game-finally-killed" : "game-finally-bled-out");
            return killer ? `${killer} ${txt} ${target}` : `${target} ${txt}`;
        }
        case DamageType.Gas: {
            if (downed) return `${t("game-the-red-zone")} ${t("game-knocked-out")} ${target}`;
            const txt = t(killer ? "game-finally-killed" : "game-died-outside");
            return killer ? `${killer} ${txt} ${target}` : `${target} ${txt}`;
        }
        case DamageType.Airdrop: {
            const mapObj = MapObjectDefs[sourceType] as { airdropCrate?: boolean } | undefined;
            const txt = downed
                ? t("game-knocked-out")
                : mapObj && !mapObj.airdropCrate
                  ? t("game-killed")
                  : t("game-crushed");
            return `${t("game-the-air-drop")} ${txt} ${target}`;
        }
        case DamageType.Airstrike: {
            const txt = t(downed ? "game-knocked-out" : "game-killed");
            if (killer) return `${killer} ${txt} ${target} ${t("game-with")} ${t("game-an-air-strike")}`;
            return `${t("game-the-air-strike")} ${txt} ${target}`;
        }
        default:
            return "";
    }
}

/** Kill feed colour of a kill seen by a player of team `activeTeamId` (survev getKillFeedColor). */
export function killFeedColor(e: KillEvent, activeTeamId: number, names: PlayerNames): string {
    if (activeTeamId && activeTeamId === names.teamId(e.targetId)) return "#d1777c";
    if (activeTeamId && activeTeamId === names.teamId(e.killCreditId)) return "#00bfff";
    return "#efeeee";
}

/** Kill feed line and colour of a role event, or null when the role does not post one (survev game.ts). */
export function roleFeed(e: RoleAnnouncementEvent, names: PlayerNames): { text: string; color: string } | null {
    const def = GameObjectDefs[e.role] as RoleDef | undefined;
    if (!def) return null;
    const role = t(`game-${e.role}`);
    const color = def.killFeed?.color ?? "#efeeee";
    if (e.assigned && def.killFeed?.assign) {
        return { text: `${truncateName(names.name(e.playerId))} ${t("game-promoted-to")} ${role}!`, color };
    }
    if (e.killed && def.killFeed?.dead) {
        const killer = e.killerId && e.killerId !== e.playerId ? truncateName(names.name(e.killerId)) : "";
        const text = killer ? `${killer} ${t("game-killed")} ${role}!` : `${role} ${t("game-is-dead")}!`;
        return { text, color };
    }
    return null;
}

/**
 * Centre message of the active player's kill (survev getKillText + getKillCountText): "YOU killed <target> with
 * <weapon>" and "N Kills"; a spectator sees the spectated player's name instead of YOU.
 */
export function killMessage(e: KillEvent, names: PlayerNames, spectating: boolean): { text: string; count: string } {
    const completeKill = e.killerId === e.killCreditId;
    const suicide = e.killCreditId === e.targetId;
    const knockedOut = e.downed && !e.killed;
    const you = spectating ? truncateName(names.name(e.killCreditId)) : t("game-you").toUpperCase();
    const killTxt = t(knockedOut ? "game-knocked-out" : completeKill ? "game-killed" : "game-finally-killed");
    const target = suicide
        ? spectating
            ? t("game-themselves")
            : t("game-yourself").toUpperCase()
        : truncateName(names.name(e.targetId));
    const sourceType = e.itemSourceType || e.mapSourceType;
    const damageTxt = e.damageType === DamageType.Airstrike ? t("game-an-air-strike") : sourceName(sourceType);
    const text =
        damageTxt && (completeKill || knockedOut)
            ? `${you} ${killTxt} ${target} ${t("game-with")} ${damageTxt}`
            : `${you} ${killTxt} ${target}`;
    const count = e.killed && !suicide ? `${e.killerKills} ${t(e.killerKills !== 1 ? "game-kills" : "game-kill")}` : "";
    return { text, count };
}

interface Line {
    div: HTMLDivElement;
    text: HTMLDivElement;
    ticker: number;
    last: { top: string; opacity: string; text: string; color: string };
}

function smoothstep(v: number, a: number, b: number): number {
    const x = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return x * x * (3 - 2 * x);
}

/** The six kill feed lines (DOM), animated like survev ui2.ts. */
export class KillFeed {
    readonly root: HTMLDivElement;
    private readonly lines: Line[] = [];

    constructor() {
        const contents = document.createElement("div");
        contents.id = "ui-killfeed-contents";
        for (let i = 0; i < KILL_FEED_LINES; i++) {
            const div = document.createElement("div");
            div.id = `ui-killfeed-${i}`;
            div.className = "killfeed-div";
            div.style.opacity = "0";
            const text = document.createElement("div");
            text.className = "killfeed-text";
            div.append(text);
            contents.append(div);
            this.lines.push({
                div,
                text,
                ticker: Number.MAX_VALUE,
                last: { top: "", opacity: "0", text: "", color: "" },
            });
        }
        const feed = document.createElement("div");
        feed.id = "ui-killfeed";
        feed.append(contents);
        this.root = document.createElement("div");
        this.root.id = "ui-killfeed-wrapper";
        this.root.append(feed);
    }

    /** Reuses the oldest line for a new message at the top (survev addKillFeedMessage). */
    add(text: string, color: string): void {
        if (!text) return;
        const oldest = this.lines.reduce((a, b) => (b.ticker > a.ticker ? b : a));
        oldest.ticker = 0;
        if (oldest.last.text !== text) oldest.text.textContent = text;
        if (oldest.last.color !== color) oldest.text.style.color = color;
        oldest.last.text = text;
        oldest.last.color = color;
        this.lines.sort((a, b) => a.ticker - b.ticker);
    }

    update(dt: number): void {
        let offset = 0;
        for (const line of this.lines) {
            line.ticker += dt;
            const tk = line.ticker;
            const opacity = (smoothstep(tk, 0, 0.25) * (1 - smoothstep(tk, 6, 6.5))).toFixed(3);
            const top = `${Math.floor(offset * LINE_SPACING)}px`;
            offset += Math.min(tk / 0.25, 1);
            if (opacity !== line.last.opacity) line.div.style.opacity = opacity;
            if (top !== line.last.top) line.div.style.top = top;
            line.last.opacity = opacity;
            line.last.top = top;
        }
    }

    /** Texts of the lines currently shown, newest first (tests). */
    visibleTexts(): string[] {
        return this.lines.filter((l) => Number(l.last.opacity) > 0).map((l) => l.last.text);
    }

    clear(): void {
        for (const line of this.lines) {
            line.ticker = Number.MAX_VALUE;
            line.div.style.opacity = "0";
            line.last.opacity = "0";
        }
    }
}
