// Client settings, the original ConfigManager (survev client/src/config.ts; docs/research/ui/menus.md "Settings modal":
// muteAudio false, master / sound / music volume 1, screenShake true, anonPlayerNames false, touch styles "anywhere",
// touchAimLine true, region "na", gameModeIdx 2, teamAutoFill true). The values live in one JSON object under
// localStorage "rebirth.config" (the original kept one "surviv_config" key); every storage access is wrapped in
// try/catch, so blocked storage (private mode, sandboxed frames) keeps the settings for the page's lifetime only.
// M6 / M7 stored separate keys (rebirth.playerName, rebirth.lang, rebirth.gameModeIdx, rebirth.teamAutoFill,
// rebirth.perkModeRole); the first load imports them into the object and removes them.
// Rebirth settings (not in the original ConfigManager): enhancedHitFx (on by default; user/2026-10-07-hit-feedback,
// fx/hitFeedback.ts), off restoring the v0.8.82 hit feedback; weatherFx (on by default; user/2026-10-08-rain,
// fx/weather.ts), off drawing a rainy match without its rain and tint.

export type TouchStyle = "anywhere" | "locked";

export interface ConfigValues {
    /** the start page's name field (max 16 characters) */
    playerName: string;
    /** menu / HUD language; "" until the player picked one */
    lang: "" | "en" | "ko";
    /** chosen region id (site_info `pops` key) */
    region: string;
    /** team lobby queue mode: 1 duo, 2 squad */
    gameModeIdx: number;
    teamAutoFill: boolean;
    muteAudio: boolean;
    masterVolume: number;
    soundVolume: number;
    musicVolume: number;
    screenShake: boolean;
    /** rebirth: stronger hit feedback (hit markers, damage vignette and arcs, body flashes, more blood) */
    enhancedHitFx: boolean;
    /** rebirth: the rainy matches' rain and darker tint (effects only) */
    weatherFx: boolean;
    anonPlayerNames: boolean;
    touchMoveStyle: TouchStyle;
    touchAimStyle: TouchStyle;
    touchAimLine: boolean;
    /** last Cobalt class (the original config's perkModeRole) */
    perkModeRole: string;
    /** key binds as the original's base64 share code ("" = the default binds) */
    binds: string;
}

export type ConfigKey = keyof ConfigValues;

export const CONFIG_DEFAULTS: Readonly<ConfigValues> = {
    playerName: "",
    lang: "",
    region: "na",
    gameModeIdx: 2,
    teamAutoFill: true,
    muteAudio: false,
    masterVolume: 1,
    soundVolume: 1,
    musicVolume: 1,
    screenShake: true,
    enhancedHitFx: true,
    weatherFx: true,
    anonPlayerNames: false,
    touchMoveStyle: "anywhere",
    touchAimStyle: "anywhere",
    touchAimLine: true,
    perkModeRole: "",
    binds: "",
};

export const CONFIG_STORAGE_KEY = "rebirth.config";

/** the subset of `Storage` the store uses (tests pass a Map-backed one) */
export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

const LEGACY_KEYS = {
    playerName: "rebirth.playerName",
    lang: "rebirth.lang",
    gameModeIdx: "rebirth.gameModeIdx",
    teamAutoFill: "rebirth.teamAutoFill",
    perkModeRole: "rebirth.perkModeRole",
} as const satisfies Partial<Record<ConfigKey, string>>;

function defaultStorage(): StorageLike | null {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** `value` as a valid setting for `key`, or undefined when it is not one. */
export function validateSetting<K extends ConfigKey>(key: K, value: unknown): ConfigValues[K] | undefined {
    const def = CONFIG_DEFAULTS[key];
    if (typeof value !== typeof def) return undefined;
    switch (key) {
        case "lang":
            return value === "" || value === "en" || value === "ko" ? (value as ConfigValues[K]) : undefined;
        case "touchMoveStyle":
        case "touchAimStyle":
            return value === "anywhere" || value === "locked" ? (value as ConfigValues[K]) : undefined;
        case "masterVolume":
        case "soundVolume":
        case "musicVolume":
            return Number.isFinite(value) ? (clamp01(value as number) as ConfigValues[K]) : undefined;
        case "gameModeIdx":
            return value === 1 || value === 2 ? (value as ConfigValues[K]) : undefined;
        case "playerName":
            return (value as string).slice(0, 16) as ConfigValues[K];
        default:
            return value as ConfigValues[K];
    }
}

type Listener = (key: ConfigKey) => void;

export class ConfigStore {
    private readonly storage: () => StorageLike | null;
    private readonly values: ConfigValues;
    private readonly listeners = new Set<Listener>();

    constructor(storage: () => StorageLike | null = defaultStorage) {
        this.storage = storage;
        this.values = { ...CONFIG_DEFAULTS };
        this.load();
    }

    get<K extends ConfigKey>(key: K): ConfigValues[K] {
        return this.values[key];
    }

    /** Stores a setting (invalid values are ignored) and tells the listeners when it changed. */
    set<K extends ConfigKey>(key: K, value: ConfigValues[K]): void {
        const valid = validateSetting(key, value);
        if (valid === undefined || valid === this.values[key]) return;
        this.values[key] = valid;
        this.save();
        for (const fn of [...this.listeners]) fn(key);
    }

    /** Calls `fn` after every change; returns the unsubscribe function. */
    onChange(fn: Listener): () => void {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    private read(key: string): string | null {
        try {
            return this.storage()?.getItem(key) ?? null;
        } catch {
            return null;
        }
    }

    private load(): void {
        const raw = this.read(CONFIG_STORAGE_KEY);
        let stored: Record<string, unknown> = {};
        if (raw) {
            try {
                const parsed: unknown = JSON.parse(raw);
                if (parsed && typeof parsed === "object") stored = parsed as Record<string, unknown>;
            } catch {
                stored = {};
            }
        }
        for (const key of Object.keys(CONFIG_DEFAULTS) as ConfigKey[]) {
            const valid = validateSetting(key, stored[key]);
            if (valid !== undefined) (this.values as unknown as Record<string, unknown>)[key] = valid;
        }
        if (this.migrateLegacy(stored)) this.save();
    }

    /** Imports the M6 / M7 keys the JSON object does not have yet; true when anything was imported. */
    private migrateLegacy(stored: Record<string, unknown>): boolean {
        let migrated = false;
        const take = (key: ConfigKey, legacyKey: string, parse: (v: string) => unknown) => {
            const v = this.read(legacyKey);
            if (v === null) return;
            migrated = true;
            if (key in stored) return;
            const valid = validateSetting(key, parse(v));
            if (valid !== undefined) (this.values as unknown as Record<string, unknown>)[key] = valid;
        };
        take("playerName", LEGACY_KEYS.playerName, (v) => v);
        take("lang", LEGACY_KEYS.lang, (v) => v);
        take("gameModeIdx", LEGACY_KEYS.gameModeIdx, (v) => Number(v));
        take("teamAutoFill", LEGACY_KEYS.teamAutoFill, (v) => v !== "false");
        take("perkModeRole", LEGACY_KEYS.perkModeRole, (v) => v);
        if (!migrated) return false;
        try {
            const storage = this.storage();
            for (const legacyKey of Object.values(LEGACY_KEYS)) storage?.removeItem(legacyKey);
        } catch {
            // the old keys stay; they are only read while the JSON object lacks the setting
        }
        return true;
    }

    private save(): void {
        try {
            this.storage()?.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.values));
        } catch {
            // storage unavailable: the settings last for this page only
        }
    }
}

let shared: ConfigStore | null = null;

/** The page's settings (loaded on first use). */
export function config(): ConfigStore {
    shared ??= new ConfigStore();
    return shared;
}
