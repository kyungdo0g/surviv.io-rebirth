// Map generation validation (M7b, mapValidation.ts): halloween, potato, potato_spring, savannah.
import { describe, expect, it } from "vitest";
import { describeMapCases } from "./mapValidation.ts";

describeMapCases(["halloween", "potato", "potato_spring", "savannah"], { describe, it, expect });
