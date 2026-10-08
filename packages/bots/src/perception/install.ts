// Installs the perception and navigation extensions a bot's BrainFeatures enable on its WorldModel (the Bot constructor
// calls it once, right after creating the model). With every flag off nothing is installed: the model keeps its inert
// threat board and intel and no underground navigation, so a baseline bot perceives and walks exactly as before.
// - threats: the real threat board (perception/threatTracker.ts)
// - threats, assess or opportunism: the real enemy intel (perception/enemyIntel.ts)
// - basements: underground navigation (nav/underground.ts): the path follower then plans into and out of basements and
//   bunkers when asked for a layer-1 goal, and out of them whenever the bot is underground
// - faction, on a 50v50 map: the faction knowledge (perception/factionIntel.ts) and the shared faction / squad boards
import type { BrainFeatures } from "../brain/features.ts";
import { UndergroundNav } from "../nav/underground.ts";
import { EnemyIntelTracker } from "./enemyIntel.ts";
import { FactionIntel } from "./factionIntel.ts";
import { isFactionMap } from "./factionMap.ts";
import { ThreatTracker } from "./threatTracker.ts";
import type { WorldModel } from "./world.ts";

export function installPerception(model: WorldModel, features: Readonly<BrainFeatures>): void {
    if (features.threats) model.threats = new ThreatTracker();
    if (features.threats || features.assess || features.opportunism) model.intel = new EnemyIntelTracker();
    if (features.basements) model.underground = UndergroundNav.forMap(model.map, model.nav);
    if (features.faction && isFactionMap(model.map)) model.faction = new FactionIntel(model.map);
}
