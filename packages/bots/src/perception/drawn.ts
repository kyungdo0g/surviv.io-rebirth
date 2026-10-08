// Whether the original client draws an obstacle on the bot's screen, for the interaction code that reads an obstacle's
// state (a door open or shut, a switch on, a container broken): the snapshot also carries the obstacles of the other
// floor, the ones under a roof the bot is not under, and a margin past the screen edge (sim viewBounds), none of which a
// player sees. Drawn means:
// - on the bot's floor (cellGrid.ts sameLayer: stairs see both floors). The client fades render layer 1 out while the
//   viewer is not on it and covers layer 0 with the underground fill while it is (apps/client/src/render/layerRules.ts);
// - its middle on the 16:9 screen (WorldModel.onScreen, half a unit of slack);
// - not under the ceiling of a building the bot is not under (WorldModel.roofBoxes; perception/roofs.ts). Ceilings are
//   ground-floor sprites, so underground they hide nothing (the fill covers them). A door gets two probes PROBE out on
//   either side of its panel: a door in an outer wall shows from outside, its ceiling side hidden.
// Sound is another matter: door sounds carry to the other floor at half volume (perception/doorWatch.ts "heard").
import type { Vec2 } from "@rebirth/core";
import { v2 } from "@rebirth/core";
import { colliderCenter, pointInBounds } from "../geom.ts";
import { sameLayer } from "../nav/cellGrid.ts";
import type { SeenObstacle, WorldModel } from "./world.ts";

/** A door is drawn when one of two points this far out on either side of its panel is not under a foreign roof. */
export const DOOR_PROBE = 1.5;
/** Screen slack: an obstacle whose middle is this close past the edge still shows. */
const SCREEN_SLACK = 0.5;

/** Whether `p` lies under the ceiling of a building the bot is not under (and so is covered on its screen). */
export function underForeignRoof(model: WorldModel, p: Vec2): boolean {
    if ((model.self.layer & 1) === 1) return false;
    for (const b of model.roofBoxes) if (pointInBounds(p, b)) return true;
    return false;
}

/**
 * Whether the client draws obstacle `o` on the bot's screen: its floor, on the screen, not under a foreign roof.
 * `normal`: a door's panel normal (doorGeom.ts DoorShape.normal) for the two-probe rule; null or undefined for anything
 * else (one probe at its middle).
 */
export function drawnObstacle(model: WorldModel, o: SeenObstacle, normal?: Vec2 | null): boolean {
    if (!sameLayer(model.self.layer, o.view.layer)) return false;
    const c = colliderCenter(o.col);
    if (!model.onScreen(c, SCREEN_SLACK)) return false;
    if (!normal) return !underForeignRoof(model, c);
    const out = v2.mul(normal, DOOR_PROBE);
    return !underForeignRoof(model, v2.add(c, out)) || !underForeignRoof(model, v2.sub(c, out));
}
