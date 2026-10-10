// Server console: commands typed into the terminal that runs the server (stdin only; nothing is exposed over HTTP or
// WebSocket). `give <player> <item> [count]` hands a human player a gun (with ammo) or a bag item (ammo, heals,
// boosts, throwables, scopes).
import { createInterface } from "node:readline";
import { GameObjectDefs, WeaponSlot } from "@rebirth/defs";
import { BAG_ITEMS, type Player } from "@rebirth/sim";
import type { RunningServer } from "./server.ts";

interface Target {
    id: number;
    name: string;
    player: Player;
}

const HELP = [
    "commands:",
    "  players                        list the human players",
    "  give <player> <item> [count]   give a gun (full clip + ammo) or a bag item (e.g. give me m870, give 3 frag 5)",
    "  items                          list the item ids give accepts",
    "  help                           this text",
    "<player> is a name (or part of it), a player id, or `me` for the first human.",
].join("\n");

function humans(server: RunningServer): Target[] {
    const out: Target[] = [];
    for (const room of server.host.rooms.values()) {
        for (const rec of room.playerRecords()) {
            const player = room.game.getPlayer(rec.playerId);
            if (!rec.bot && player && !player.dead) out.push({ id: rec.playerId, name: rec.name, player });
        }
    }
    return out;
}

function findTarget(server: RunningServer, query: string): Target | string {
    const list = humans(server);
    if (!list.length) return "no human player in a game";
    if (query === "me") return list[0];
    const q = query.toLowerCase();
    const matches = list.filter((t) => String(t.id) === q || t.name.toLowerCase() === q);
    const found = matches.length ? matches : list.filter((t) => t.name.toLowerCase().includes(q));
    if (found.length === 1) return found[0];
    return found.length ? `ambiguous: ${found.map((t) => `${t.name} (${t.id})`).join(", ")}` : `no player "${query}"`;
}

function isGun(item: string): boolean {
    return GameObjectDefs[item]?.type === "gun";
}

function itemIds(): { guns: string[]; bag: string[] } {
    return {
        guns: Object.keys(GameObjectDefs).filter(isGun),
        bag: BAG_ITEMS.filter((i) => GameObjectDefs[i]),
    };
}

/** Gives `item` to `player`; returns what happened, or an error text. */
function give(player: Player, item: string, count: number | undefined): string {
    const def = GameObjectDefs[item];
    const wm = player.weaponManager;
    if (def?.type === "gun") {
        // the first empty gun slot, else the slot of the gun in hand, else the primary
        let slot: number = WeaponSlot.Primary;
        if (wm.weapons[WeaponSlot.Primary].type && !wm.weapons[WeaponSlot.Secondary].type) {
            slot = WeaponSlot.Secondary;
        } else if (wm.weapons[WeaponSlot.Primary].type && wm.weapons[WeaponSlot.Secondary].type) {
            slot = wm.curWeapIdx === WeaponSlot.Secondary ? WeaponSlot.Secondary : WeaponSlot.Primary;
        }
        wm.setWeapon(slot, item, def.maxClip);
        if (BAG_ITEMS.includes(def.ammo)) player.inv.give(def.ammo, player.inv.capacity(def.ammo));
        wm.setCurWeapIndex(slot);
        return `${item} in slot ${slot + 1} with full ammo`;
    }
    if (def && BAG_ITEMS.includes(item)) {
        const res = player.inv.give(item, count ?? player.inv.capacity(item));
        if (def.type === "throwable" && res.added > 0) {
            wm.setWeapon(WeaponSlot.Throwable, item, 0);
            wm.setCurWeapIndex(WeaponSlot.Throwable);
        }
        return res.added > 0 ? `${res.added}x ${item}` : `${item}: bag already full`;
    }
    return `unknown item "${item}" (type items for the list)`;
}

export function runCommand(server: RunningServer, line: string): string {
    const [cmd, ...args] = line.trim().split(/\s+/);
    switch (cmd?.toLowerCase()) {
        case "":
        case undefined:
            return "";
        case "help":
            return HELP;
        case "players": {
            const list = humans(server);
            return list.length ? list.map((t) => `${t.id}\t${t.name}`).join("\n") : "no human player in a game";
        }
        case "items": {
            const { guns, bag } = itemIds();
            return `guns: ${guns.join(" ")}\nbag items: ${bag.join(" ")}`;
        }
        case "give": {
            if (args.length < 2) return "usage: give <player> <item> [count]";
            const target = findTarget(server, args[0]);
            if (typeof target === "string") return target;
            const count = args[2] === undefined ? undefined : Number.parseInt(args[2], 10);
            if (count !== undefined && !(count > 0)) return `bad count "${args[2]}"`;
            return `${target.name}: ${give(target.player, args[1].toLowerCase(), count)}`;
        }
        default:
            return `unknown command "${cmd}" (type help)`;
    }
}

/** Reads commands from the terminal. Returns a function that stops reading. */
export function startConsole(server: RunningServer): () => void {
    const rl = createInterface({ input: process.stdin });
    // a readline interface swallows Ctrl+C; hand it on so the server still shuts down
    rl.on("SIGINT", () => process.emit("SIGINT"));
    rl.on("line", (line) => {
        try {
            const out = runCommand(server, line);
            if (out) console.log(out);
        } catch (err) {
            console.error("command failed:", err);
        }
    });
    console.log("console: type `help` for commands (give, players, items)");
    return () => rl.close();
}
