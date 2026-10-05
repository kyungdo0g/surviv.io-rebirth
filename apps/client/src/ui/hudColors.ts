// Health bar colour steps of the original HUD (survev client/src/ui/ui2.ts render; docs/research/ui/hud.md
// "Health bar"): grey exactly at 100, white down to 75, light to dark red down to 25, red below; red when downed.
const STEPS: ReadonlyArray<{ health: number; color: readonly [number, number, number] }> = [
    { health: 100, color: [179, 179, 179] },
    { health: 100, color: [255, 255, 255] },
    { health: 75, color: [255, 255, 255] },
    { health: 75, color: [255, 158, 158] },
    { health: 25, color: [255, 82, 82] },
    { health: 25, color: [255, 0, 0] },
    { health: 0, color: [255, 0, 0] },
];

/** RGB of the local health bar at `health` (0..100). */
export function healthBarColor(health: number, downed: boolean): [number, number, number] {
    if (downed) return [255, 0, 0];
    const rounded = Math.ceil(health);
    let end = 0;
    while (STEPS[end].health > rounded && end < STEPS.length - 1) end++;
    const a = STEPS[Math.max(end - 1, 0)];
    const b = STEPS[end];
    const span = b.health - a.health;
    const t = span === 0 ? 0 : Math.min(1, Math.max(0, (health - a.health) / span));
    return [0, 1, 2].map((i) => Math.floor(a.color[i] + (b.color[i] - a.color[i]) * t)) as [number, number, number];
}
