// The audio engine's mix against survev's client (audio/audio.ts; owner, 2026-10-08: "why is there no sound, the
// volume is far too weak"): the master gain is the Master slider itself (1 by default, not halved) and feeds a
// DynamicsCompressor before the speakers (survev lib/createJS.ts:457-460); a sound at its instance limit stops its
// instance that ends soonest and plays the new one (createJS.ts:680-690), counted per channel (audioManager.ts:148),
// so a fast gun never drops its own shots and another player's shots never mute the player's own.
// The switch sound (fx/switchSound.ts, survev player.ts:1058-1089): the generic click, the gun's own deploy sound on a
// quick re-switch or a same-deployGroup switch after a shot, and the owner's new guns their own clip on every switch.
import { GameConfig, type GunDef, getDefOfType } from "@rebirth/defs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AudioEngine } from "../src/audio/audio.ts";
import { GunSwitchSound } from "../src/fx/switchSound.ts";

class FakeParam {
    value = 1;
    setValueAtTime(v: number) {
        this.value = v;
    }
    linearRampToValueAtTime(v: number) {
        this.value = v;
    }
    cancelScheduledValues() {}
}

class FakeNode {
    readonly kind: string;
    readonly outputs: FakeNode[] = [];
    gain = new FakeParam();
    pan = new FakeParam();
    detune = new FakeParam();
    frequency = new FakeParam();
    Q = new FakeParam();
    type = "";
    buffer: unknown = null;
    loop = false;
    started = false;
    stopped = false;
    onended: (() => void) | null = null;
    constructor(kind: string) {
        this.kind = kind;
    }
    connect(node: FakeNode): FakeNode {
        this.outputs.push(node);
        return node;
    }
    disconnect() {}
    start() {
        this.started = true;
    }
    stop() {
        if (this.stopped) return;
        this.stopped = true;
        queueMicrotask(() => this.onended?.());
    }
}

class FakeContext {
    static last: FakeContext | null = null;
    readonly destination = new FakeNode("destination");
    readonly nodes: FakeNode[] = [];
    currentTime = 0;
    state = "running";
    constructor() {
        FakeContext.last = this;
    }
    private make(kind: string): FakeNode {
        const n = new FakeNode(kind);
        this.nodes.push(n);
        return n;
    }
    createGain() {
        return this.make("gain");
    }
    createDynamicsCompressor() {
        return this.make("compressor");
    }
    createBiquadFilter() {
        return this.make("biquad");
    }
    createConvolver() {
        return this.make("convolver");
    }
    createStereoPanner() {
        return this.make("panner");
    }
    createBufferSource() {
        return this.make("source");
    }
    decodeAudioData() {
        return Promise.resolve({ duration: 1 });
    }
    resume() {
        return Promise.resolve();
    }
    close() {
        return Promise.resolve();
    }
}

const listeners = new Map<string, () => void>();
const saved = { window: globalThis.window, AudioContext: globalThis.AudioContext, fetch: globalThis.fetch };

beforeAll(() => {
    Object.assign(globalThis, {
        window: {
            addEventListener: (type: string, fn: () => void) => listeners.set(type, fn),
            removeEventListener: () => {},
        },
        AudioContext: FakeContext,
        fetch: () => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }),
    });
});

afterAll(() => Object.assign(globalThis, saved));

/** An unlocked engine with `names` loaded. */
async function engine(names: string[]): Promise<{ audio: AudioEngine; ctx: FakeContext }> {
    const audio = new AudioEngine();
    listeners.get("pointerdown")?.();
    audio.preload(names);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    return { audio, ctx: FakeContext.last! };
}

describe("audio engine mix (survev's client)", () => {
    it("the master gain is the Master slider (1 by default) and feeds a compressor, then the speakers", async () => {
        const { audio, ctx } = await engine([]);
        const master = ctx.nodes.find((n) => n.outputs.some((o) => o.kind === "compressor"))!;
        expect(master.gain.value).toBe(1);
        const compressor = master.outputs.find((o) => o.kind === "compressor")!;
        expect(compressor.outputs).toEqual([ctx.destination]);
        audio.setVolumes({ master: 0.6, sound: 1, music: 1 });
        expect(master.gain.value).toBeCloseTo(0.6);
        audio.destroy();
    });

    it("a sound past its instance limit plays and stops the instance that ends soonest", async () => {
        const { audio } = await engine(["ak47_01"]);
        expect(audio.isLoaded("ak47_01", "activePlayer")).toBe(true);
        // ak47_01 allows 5 at once (survev soundDefs maxInstances 5); a burst of 8 own shots
        const handles = [];
        for (let i = 0; i < 8; i++) handles.push(audio.playSound("ak47_01"));
        expect(handles.every((h) => h !== null)).toBe(true);
        expect(audio.started).toBe(8);
        expect(audio.evicted).toBe(3);
        expect(handles.map((h) => h!.stopped)).toEqual([true, true, true, false, false, false, false, false]);
        audio.destroy();
    });

    it("other players' shots have their own instances: they never stop the player's own", async () => {
        const { audio } = await engine(["ak47_01"]);
        const own = [];
        for (let i = 0; i < 5; i++) own.push(audio.playSound("ak47_01"));
        for (let i = 0; i < 5; i++) {
            expect(audio.playSound("ak47_01", { channel: "otherPlayers", pos: { x: 3, y: 0 } })).not.toBeNull();
        }
        expect(audio.evicted).toBe(0);
        expect(own.every((h) => h && !h.stopped)).toBe(true);
        audio.destroy();
    });
});

describe("gun switch sound", () => {
    const gun = (id: string): GunDef => getDefOfType("gun", id);

    it("the generic click, then the gun's own deploy sound on a re-switch inside the free-switch window", () => {
        const s = new GunSwitchSound();
        expect(s.switchTo("ak47", gun("ak47"), 1, 0, gun("mp5"))).toBe("gun_switch_01");
        expect(s.switchTo("mp5", gun("mp5"), 0, 1, gun("ak47"))).toBe(gun("mp5").sound.deploy);
        s.update(GameConfig.player.freeSwitchCooldown + 0.01);
        expect(s.switchTo("ak47", gun("ak47"), 1, 0, gun("mp5"))).toBe("gun_switch_01");
    });

    it("deployFull: the same deployGroup right after a shot plays the full deploy sound", () => {
        const s = new GunSwitchSound();
        s.update(5);
        s.shot(gun("m870"));
        expect(s.switchTo("spas12", gun("spas12"), 1, 0, gun("m870"))).toBe(gun("spas12").sound.deploy);
        s.update(5);
        // no shot: the free click
        expect(s.switchTo("m870", gun("m870"), 0, 1, gun("spas12"))).toBe("gun_switch_01");
    });

    it("the owner's new guns play their own switch clip on every switch (rebirth)", () => {
        const s = new GunSwitchSound();
        expect(s.switchTo("rpg7", gun("rpg7"), 0, 1, gun("ak47"))).toBe("rpg7_switch_01");
        s.update(5);
        expect(s.switchTo("m202", gun("m202"), 1, 0, gun("rpg7"))).toBe("m202_switch_01");
    });
});
