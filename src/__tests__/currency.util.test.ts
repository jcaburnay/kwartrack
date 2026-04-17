import { describe, expect, it } from "vitest";
import { formatPesos } from "../utils/currency";

describe("formatPesos", () => {
	it("formats 0 centavos as P0.00", () => {
		expect(formatPesos(0n)).toBe("P0.00");
	});

	it("formats 1 centavo as P0.01", () => {
		expect(formatPesos(1n)).toBe("P0.01");
	});

	it("formats 100 centavos as P1.00", () => {
		expect(formatPesos(100n)).toBe("P1.00");
	});

	it("formats 500 centavos as P5.00", () => {
		expect(formatPesos(500n)).toBe("P5.00");
	});

	it("formats 999 centavos as P9.99", () => {
		expect(formatPesos(999n)).toBe("P9.99");
	});

	it("formats 620_000 centavos as P6,200.00", () => {
		expect(formatPesos(620_000n)).toBe("P6,200.00");
	});

	it("formats 12_050_000 centavos as P120,500.00", () => {
		expect(formatPesos(12_050_000n)).toBe("P120,500.00");
	});

	it("formats 12_000_000 centavos as P120,000.00", () => {
		expect(formatPesos(12_000_000n)).toBe("P120,000.00");
	});
});
