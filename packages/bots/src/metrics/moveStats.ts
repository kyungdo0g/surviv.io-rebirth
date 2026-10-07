// Movement statistics of a player track (round 5, user report 36: "bot-typical stiff movement"), computed the way the
// owner's gameplay videos were measured: positions at 30 Hz; moving or stopped by the 0.2 s average speed against the
// running speed (moving above 40% of it); an 8-way key direction per moving frame that moved a quarter of a running
// frame and lies within 15 degrees of an octant (wall slides and transitions keep the direction before), a new
// direction only after two such frames in a row. From that: key holds (runs of one direction), direction changes,
// reversals (135 degrees or more), stops of 0.2 s or more and the moving runs between them, the straight-line ratio of
// 2 s stretches (net over walked distance) and the reversals of every 10 s window. The videos (scratchpad
// video/play.mkv and v2/*.mkv, 1950 s of play) went through the same steps on the background scroll found by phase
// correlation (the player is always centred): HUMAN_REFERENCE. scripts/movestats.ts prints bots against it.

/** Frames per second of a track. */
export const TRACK_HZ = 30;
/** A stop lasts this long at least (s); shorter dips do not split a moving run. */
const MIN_STOP = 0.2;

export interface MoveStats {
    seconds: number;
    movingShare: number;
    holdP50: number;
    holdP90: number;
    changesPerSec: number;
    reversalsPerMin: number;
    stopsPerMin: number;
    stopP50: number;
    moveRunP50: number;
    moveRunP90: number;
    straightP50: number;
    /** reversals per minute of 10 s windows: median and 90th percentile */
    windowRevP50: number;
    windowRevP90: number;
}

/**
 * The owner's videos (round 5): 1934 s of valid flow at 30 Hz in ten recordings, through addTrack in running-speed units
 * (the scroll divided by the local running speed: the zoom changes with scopes and buildings).
 * The speed distribution is left out: frame timing jitter in the recording spreads the 0.2 s speeds (a straight run
 * at constant keys reads 0.73-1.0 of the running speed), so only stopped / moving is compared.
 */
export const HUMAN_REFERENCE: Readonly<MoveStats> = Object.freeze({
    seconds: 1934,
    movingShare: 0.664,
    holdP50: 0.267,
    holdP90: 0.867,
    changesPerSec: 2.14,
    reversalsPerMin: 16.3,
    stopsPerMin: 17.3,
    stopP50: 0.567,
    moveRunP50: 0.833,
    moveRunP90: 4.633,
    straightP50: 0.818,
    windowRevP50: 6.9,
    windowRevP90: 24,
});

function percentile(values: readonly number[], q: number): number {
    if (values.length === 0) return Number.NaN;
    const s = [...values].sort((a, b) => a - b);
    const i = (s.length - 1) * q;
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

function octantDistance(a: number, b: number): number {
    const d = Math.abs(a - b) % 8;
    return Math.min(d, 8 - d);
}

/** Raw counts of one track (summed over tracks before the rates are taken). */
export interface MoveCounts {
    frames: number;
    movingFrames: number;
    holds: number[];
    changes: number;
    reversals: number;
    stops: number[];
    moveRuns: number[];
    straight: number[];
    windowRevs: number[];
}

export function emptyCounts(): MoveCounts {
    return {
        frames: 0,
        movingFrames: 0,
        holds: [],
        changes: 0,
        reversals: 0,
        stops: [],
        moveRuns: [],
        straight: [],
        windowRevs: [],
    };
}

/** Lengths (s) of the runs of `true`. */
function runs(mask: readonly boolean[]): number[] {
    const out: number[] = [];
    let n = 0;
    for (const m of mask) {
        if (m) n++;
        else if (n) {
            out.push(n / TRACK_HZ);
            n = 0;
        }
    }
    if (n) out.push(n / TRACK_HZ);
    return out;
}

/**
 * Adds the track `xs`, `ys` (world units at TRACK_HZ; NaN where the player was not walking: downed, dead, teleported)
 * to `into`. `runSpeed`: the running speed (u/s; default the 85th percentile of the clearly moving speeds).
 */
export function addTrack(into: MoveCounts, xs: readonly number[], ys: readonly number[], runSpeed?: number): void {
    const n = xs.length - 1;
    if (n < TRACK_HZ * 2) return;
    const dx: number[] = [];
    const dy: number[] = [];
    const ok: boolean[] = [];
    for (let i = 0; i < n; i++) {
        const a = xs[i + 1] - xs[i];
        const b = ys[i + 1] - ys[i];
        const good = Number.isFinite(a) && Number.isFinite(b) && Math.hypot(a, b) < 3;
        dx.push(good ? a : 0);
        dy.push(good ? b : 0);
        ok.push(good);
    }
    const d = dx.map((a, i) => Math.hypot(a, dy[i]));
    // 0.2 s average speed (6 frames, centred)
    const K = 6;
    const sm: number[] = [];
    const okw: boolean[] = [];
    for (let i = 0; i < n; i++) {
        let sum = 0;
        let good = true;
        for (let j = i - K / 2; j < i + K / 2; j++) {
            if (j < 0 || j >= n || !ok[j]) {
                good = false;
                continue;
            }
            sum += d[j];
        }
        sm.push((sum / K) * TRACK_HZ);
        okw.push(good);
    }
    let ref = runSpeed ?? 0;
    if (!ref) {
        const top = Math.max(0, ...sm.filter((_, i) => okw[i]));
        ref = percentile(
            sm.filter((v, i) => okw[i] && v > 0.2 * top),
            0.85,
        );
    }
    if (!(ref > 0)) return;
    const moving = sm.map((v, i) => okw[i] && v / ref > 0.4);
    const good = okw;
    const perFrame = ref / TRACK_HZ;
    // key direction per frame (debounced)
    const octant: number[] = [];
    let cur = -1;
    let pend = -1;
    let pendN = 0;
    for (let i = 0; i < n; i++) {
        if (!moving[i]) {
            cur = -1;
            pend = -1;
            pendN = 0;
        } else if (ok[i] && d[i] > 0.25 * perFrame) {
            const a = Math.atan2(dy[i], dx[i]) / (Math.PI / 4);
            const r = Math.round(a);
            if (Math.abs(a - r) * 45 <= 15) {
                const o = ((r % 8) + 8) % 8;
                if (o === cur) {
                    pend = -1;
                    pendN = 0;
                } else if (cur < 0) cur = o;
                else {
                    pendN = o === pend ? pendN + 1 : 1;
                    pend = o;
                    if (pendN >= 2) {
                        cur = o;
                        pend = -1;
                        pendN = 0;
                    }
                }
            }
        }
        octant.push(cur);
    }
    // holds, changes, reversals; reversals per 10 s window
    let runO = -1;
    let runN = 0;
    let last = -1;
    const W = TRACK_HZ * 10;
    let winRev = 0;
    let winGood = 0;
    for (let i = 0; i < n; i++) {
        const o = octant[i];
        if (i > 0 && i % W === 0) {
            if (winGood >= W * 0.8) into.windowRevs.push((winRev * 60) / (winGood / TRACK_HZ));
            winRev = 0;
            winGood = 0;
        }
        if (good[i]) winGood++;
        if (o === runO && o >= 0) {
            runN++;
            continue;
        }
        if (runO >= 0 && runN) into.holds.push(runN / TRACK_HZ);
        if (o >= 0 && last >= 0 && o !== last) {
            into.changes++;
            if (octantDistance(o, last) >= 3) {
                into.reversals++;
                winRev++;
            }
        }
        if (o >= 0) last = o;
        runO = o;
        runN = 1;
    }
    if (runO >= 0 && runN) into.holds.push(runN / TRACK_HZ);
    into.frames += good.filter(Boolean).length;
    into.movingFrames += moving.filter(Boolean).length;
    for (const s of runs(good.map((g, i) => g && !moving[i]))) if (s >= MIN_STOP) into.stops.push(s);
    // moving runs between two stops of MIN_STOP or more (a dip shorter than that, such as a frame-timing hiccup in a
    // recording or a bump into a corner, does not split a run)
    const merged = [...moving];
    let gapStart = -1;
    for (let i = 0; i <= n; i++) {
        const still = i < n && good[i] && !moving[i];
        if (still && gapStart < 0) gapStart = i;
        if (!still && gapStart >= 0) {
            const before = gapStart > 0 && moving[gapStart - 1];
            const after = i < n && moving[i];
            if (before && after && i - gapStart < MIN_STOP * TRACK_HZ)
                for (let j = gapStart; j < i; j++) merged[j] = true;
            gapStart = -1;
        }
    }
    into.moveRuns.push(...runs(merged));
    // straight-line ratio of 2 s stretches moving at least 80% of the time
    const S = TRACK_HZ * 2;
    for (let i = 0; i + S < n; i += S / 2) {
        let mv = 0;
        let path = 0;
        let all = true;
        for (let j = i; j < i + S; j++) {
            if (moving[j]) mv++;
            if (!ok[j]) all = false;
            path += d[j];
        }
        if (!all || mv < 0.8 * S || path <= 0) continue;
        into.straight.push(Math.hypot(xs[i + S] - xs[i], ys[i + S] - ys[i]) / path);
    }
}

/** The statistics of the summed counts. */
export function moveStats(c: MoveCounts): MoveStats {
    const seconds = c.frames / TRACK_HZ;
    const movingSec = c.movingFrames / TRACK_HZ;
    return {
        seconds,
        movingShare: c.movingFrames / Math.max(1, c.frames),
        holdP50: percentile(c.holds, 0.5),
        holdP90: percentile(c.holds, 0.9),
        changesPerSec: c.changes / Math.max(1e-9, movingSec),
        reversalsPerMin: (60 * c.reversals) / Math.max(1e-9, movingSec),
        stopsPerMin: (60 * c.stops.length) / Math.max(1e-9, seconds),
        stopP50: percentile(c.stops, 0.5),
        moveRunP50: percentile(c.moveRuns, 0.5),
        moveRunP90: percentile(c.moveRuns, 0.9),
        straightP50: percentile(c.straight, 0.5),
        windowRevP50: percentile(c.windowRevs, 0.5),
        windowRevP90: percentile(c.windowRevs, 0.9),
    };
}
