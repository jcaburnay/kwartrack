import { describe, expect, it } from "vitest";
import { formatPesos, fromCentavos, toAmountString, toCentavos } from "../utils/currency";

describe("toCentavos", () => {
	it("converts integer-peso string to centavos", () => {
		expect(toCentavos("12")).toBe(1200n);
	});
	it("converts decimal-peso string to centavos", () => {
		expect(toCentavos("12.50")).toBe(1250n);
	});
	it("converts number input to centavos", () => {
		expect(toCentavos(12.5)).toBe(1250n);
	});
	it("rounds to nearest centavo", () => {
		expect(toCentavos("12.005")).toBe(1201n);
	});
	it("treats empty/whitespace string as zero", () => {
		expect(toCentavos("")).toBe(0n);
		expect(toCentavos("   ")).toBe(0n);
	});
	it("returns 0n for NaN-producing input", () => {
		expect(toCentavos("abc")).toBe(0n);
	});
});

describe("fromCentavos", () => {
	it("converts centavos to peso number", () => {
		expect(fromCentavos(1250n)).toBe(12.5);
	});
	it("converts zero", () => {
		expect(fromCentavos(0n)).toBe(0);
	});
	it("handles large values", () => {
		expect(fromCentavos(12345678n)).toBe(123456.78);
	});
	it("preserves 2-decimal precision for non-integer pesos", () => {
		expect(fromCentavos(12345n)).toBe(123.45);
	});
});

describe("toAmountString", () => {
	it("formats centavos as fixed-2 peso string for form defaults", () => {
		expect(toAmountString(1250n)).toBe("12.50");
	});
	it("formats integer pesos with trailing zeros", () => {
		expect(toAmountString(1200n)).toBe("12.00");
	});
	it("formats zero", () => {
		expect(toAmountString(0n)).toBe("0.00");
	});
});

describe("round-trip identity", () => {
	it("toCentavos(toAmountString(x)) === x", () => {
		for (const c of [0n, 1n, 50n, 1250n, 999999n]) {
			expect(toCentavos(toAmountString(c))).toBe(c);
		}
	});
});

describe("formatPesos (existing, unchanged)", () => {
	it("still formats 0", () => {
		expect(formatPesos(0n)).toBe("P0.00");
	});

	it("still formats 1 centavo as P0.01", () => {
		expect(formatPesos(1n)).toBe("P0.01");
	});

	it("still formats 100 centavos as P1.00", () => {
		expect(formatPesos(100n)).toBe("P1.00");
	});

	it("still formats 500 centavos as P5.00", () => {
		expect(formatPesos(500n)).toBe("P5.00");
	});

	it("still formats 999 centavos as P9.99", () => {
		expect(formatPesos(999n)).toBe("P9.99");
	});

	it("still formats 620_000 centavos as P6,200.00", () => {
		expect(formatPesos(620_000n)).toBe("P6,200.00");
	});

	it("still formats with separators", () => {
		expect(formatPesos(12050000n)).toBe("P120,500.00");
	});

	it("still formats 12_000_000 centavos as P120,000.00", () => {
		expect(formatPesos(12_000_000n)).toBe("P120,000.00");
	});
});
