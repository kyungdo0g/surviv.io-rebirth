// Effect buses of the audio engine (survev client/src/lib/createJS.ts EQ presets and reverbs, audioManager.ts;
// docs/research/ui/audiovisual-style.md "Sound engine"):
// - "muffled": a 10-band EQ that strips most of the mids and highs, for sounds from the other floor;
// - "club": a heavy high cut for the club's music heard from outside or underground;
// - "reverb": the cathedral impulse response, sent while the listener is underground (volume 1 underground, 1/3 and
//   2/3 on the stairs, times the reverb's 0.7).
// Each EQ starts with a x16 gain stage that makes up for the cuts, like the original.

type Band = readonly [frequency: number, q: number, gain: number, type: BiquadFilterType];

const Q = 2.8284 / 2;
const MUFFLED: readonly Band[] = [
    [20, Q, -6, "peaking"],
    [40, Q, -7, "peaking"],
    [80, Q, -10, "peaking"],
    [160, Q, -13, "peaking"],
    [320, Q, -22, "peaking"],
    [640, Q, -18, "peaking"],
    [1280, Q, -25, "peaking"],
    [2560, Q, -10, "peaking"],
    [5120, Q, -30, "peaking"],
    [10240, Q, -25, "peaking"],
];
const CLUB: readonly Band[] = [
    [20, Q, -6, "lowshelf"],
    [63, Q, -3, "lowshelf"],
    [125, Q, -3, "lowshelf"],
    [250, Q, -6, "lowshelf"],
    [500, Q, -18, "peaking"],
    [1000, Q, -36, "peaking"],
    [2000, Q, -48, "peaking"],
    [4000, Q, -50, "highshelf"],
    [8000, Q, -50, "highshelf"],
    [16000, Q, -50, "highshelf"],
];
const EQ_MAKEUP_GAIN = 16;
/** survev soundDefs.ts Reverbs.cathedral */
const REVERB_PATH = "audio/reverb/cathedral_01.mp3";
const REVERB_VOLUME = 0.7;
/** reverb amount per listener layer while underground (survev audioManager.update) */
const LAYER_REVERB = [0, 1, 1 / 3, 2 / 3];

function eqChain(ctx: AudioContext, bands: readonly Band[], out: AudioNode): AudioNode {
    const input = ctx.createGain();
    input.gain.value = EQ_MAKEUP_GAIN;
    let prev: AudioNode = input;
    for (const [frequency, q, gain, type] of bands) {
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = frequency;
        f.Q.value = q;
        f.gain.value = gain;
        prev.connect(f);
        prev = f;
    }
    prev.connect(out);
    return input;
}

export class AudioBuses {
    readonly muffled: AudioNode;
    readonly club: AudioNode;
    /** send input of the reverb */
    readonly reverb: GainNode;
    private readonly convolver: ConvolverNode;
    private readonly reverbOut: GainNode;
    private loaded = false;

    constructor(ctx: AudioContext, master: AudioNode, assetRoot: string) {
        this.muffled = eqChain(ctx, MUFFLED, master);
        this.club = eqChain(ctx, CLUB, master);
        this.reverb = ctx.createGain();
        this.convolver = ctx.createConvolver();
        this.reverbOut = ctx.createGain();
        this.reverbOut.gain.value = 0;
        this.reverb.connect(this.convolver).connect(this.reverbOut).connect(master);
        void fetch(assetRoot + REVERB_PATH)
            .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(`HTTP ${res.status}`))))
            .then((data) => ctx.decodeAudioData(data))
            .then((buffer) => {
                this.convolver.buffer = buffer;
                this.loaded = true;
            })
            .catch((err) => console.warn(`audio ${REVERB_PATH}: ${err}`));
    }

    /** Sets the reverb amount for a listener on `layer`, underground or not. */
    setUnderground(underground: boolean, layer: number): void {
        const volume = this.loaded && underground ? (LAYER_REVERB[layer] ?? 0) * REVERB_VOLUME : 0;
        if (Math.abs(this.reverbOut.gain.value - volume) > 1e-4) this.reverbOut.gain.value = volume;
    }

    get reverbVolume(): number {
        return this.reverbOut.gain.value;
    }
}
