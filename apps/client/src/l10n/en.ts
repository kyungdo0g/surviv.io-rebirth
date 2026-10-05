// English HUD strings, keyed like the original string table (l10n/en "game-*" keys; values from the original
// v0.8.82 client bundle). Item names come from the bundle too (src/generated/l10n-en-items.json,
// scripts/l10n-items.ts).
import items from "../generated/l10n-en-items.json";

export const en: Readonly<Record<string, string>> = {
    "word-order": "svo",
    "game-reloading": "Reloading",
    "game-using": "Using",
    "game-kill": "Kill",
    "game-kills": "Kills",
    "game-alive": "Alive",
    "game-You": "You",
    "game-you": "you",
    "game-you-died": "died",
    "game-killed": "killed",
    "game-with": "with",
    "game-play-new-game": "Play New Game",
    "game-level-1": "Lvl. 1",
    "game-level-2": "Lvl. 2",
    "game-level-3": "Lvl. 3",
    "game-level-4": "Lvl. 4",
    "game-sound": "Sound",
};

/** "game-<id>" item names */
export const enItems: Readonly<Record<string, string>> = items.names;
/** "game-hud-<id>" short names shown in the weapon slots (dual guns, melee skins, throwables) */
export const enHudItems: Readonly<Record<string, string>> = items.hud;
