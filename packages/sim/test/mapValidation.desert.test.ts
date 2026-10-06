// Map generation validation (M7b, mapValidation.ts): desert, woods, woods_snow, woods_spring, woods_summer.
import { describe, expect, it } from "vitest";
import { describeMapCases } from "./mapValidation.ts";

describeMapCases(["desert", "woods", "woods_snow", "woods_spring", "woods_summer"], { describe, it, expect });
