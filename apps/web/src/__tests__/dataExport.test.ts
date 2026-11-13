import { describe, expect, it } from "vitest";
import { ENTITY_KEYS, ENTITY_LABELS } from "../utils/dataExport";

describe("budget period exports", () => {
	it("offers canonical periods and their allocations alongside legacy records", () => {
		expect(ENTITY_KEYS).toContain("budget_period");
		expect(ENTITY_KEYS).toContain("budget_period_allocation");
		expect(ENTITY_LABELS).toMatchObject({
			budget_period: "Budget periods",
			budget_period_allocation: "Budget period allocations",
		});
	});
});
