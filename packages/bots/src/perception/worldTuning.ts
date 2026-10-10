// Tuning of the world model (split out of world.ts, the 600-line rule).
import { GameConfig } from "@rebirth/defs";

export const BULLET_HEIGHT = GameConfig.bullet.height;
/** Remembered loot is forgotten after this long without being seen. */
export const LOOT_MEMORY = 90;
/** A bullet passing this close counts as being shot at. */
export const NEAR_MISS = 3;
/** An enemy is on the screen while this much of its body (radius 1) pokes in past the edge. */
export const BODY_ON_SCREEN = 0.5;
/**
 * A contact seen again within this long keeps its sighting (reaction) when its body stayed on the screen (it only
 * dipped behind a roof edge, a bush or a canopy); one that went off the screen starts over after SIGHTING_GAP.
 */
export const SIGHTING_KEEP = 1.5;
export const SIGHTING_GAP = 0.6;
/** Obstacles with this much health or less break to one bullet (windows: health 1): they stop no shot for long. */
export const FRAGILE_HEALTH = 2;
/** An enemy under a tree canopy this close is plain to see (not faint). */
export const FAINT_NEAR = 5;
/** Edge rays of a body (radius 1) test this far off its centre (perception/rays.ts EDGE_TEST, metrics/truth.ts). */
export const BODY_EDGE = 0.9;
