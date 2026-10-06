// Map generation validation (M7b, mapValidation.ts): main, main_spring, main_summer, snow, turkey.
import { describe, expect, it } from "vitest";
import { describeMapCases } from "./mapValidation.ts";

describeMapCases(["main", "main_spring", "main_summer", "snow", "turkey"], { describe, it, expect });
