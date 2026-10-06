// Map generation validation (M7b, mapValidation.ts): cobalt, faction, faction_potato.
import { describe, expect, it } from "vitest";
import { describeMapCases } from "./mapValidation.ts";

describeMapCases(["cobalt", "faction", "faction_potato"], { describe, it, expect });
