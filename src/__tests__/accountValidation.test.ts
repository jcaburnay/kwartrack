import { describe, expect, it } from "vitest";
import {
	validateCommon,
	validateCredit,
	validateName,
	validateTimeDeposit,
} from "../utils/accountValidation";

describe("validateName", () => {
	it("accepts 1-50 chars after trim", () => {
		expect(validateName("A")).toEqual({ ok: true });
		expect(validateName("A".repeat(50))).toEqual({ ok: true });
	});

	it("rejects empty and overlength names", () => {
		expect(validateName("")).toMatchObject({ ok: false, field: "name" });
		expect(validateName("  ")).toMatchObject({ ok: false, field: "name" });
		expect(validateName("A".repeat(51))).toMatchObject({ ok: false, field: "name" });
	});
});

describe("validateCommon", () => {
	it("accepts initial balance >= 0", () => {
		expect(validateCommon({ name: "Cash", initialBalanceCentavos: 0 })).toEqual({ ok: true });
		expect(validateCommon({ name: "Cash", initialBalanceCentavos: 500_00 })).toEqual({ ok: true });
	});

	it("rejects negative initial balance", () => {
		expect(validateCommon({ name: "Cash", initialBalanceCentavos: -1 })).toMatchObject({
			ok: false,
			field: "initialBalance",
		});
	});
});

describe("validateCredit", () => {
	it("requires credit limit > 0", () => {
		expect(
			validateCredit({
				name: "Card",
				initialBalanceCentavos: 0,
				creditLimitCentavos: 0,
			}),
		).toMatchObject({ field: "creditLimit" });
	});

	it("blocks initial balance exceeding limit", () => {
		expect(
			validateCredit({
				name: "Card",
				initialBalanceCentavos: 200_00,
				creditLimitCentavos: 100_00,
			}),
		).toMatchObject({ field: "initialBalance" });
	});
});

describe("validateTimeDeposit", () => {
	const today = new Date("2026-04-24T00:00:00Z");

	it("requires positive principal, rate, and future maturity", () => {
		expect(
			validateTimeDeposit(
				{
					name: "TD",
					principalCentavos: 100_000_00,
					interestRateBps: 600,
					maturityDate: "2027-04-24",
					interestPostingInterval: "monthly",
				},
				today,
			),
		).toEqual({ ok: true });

		expect(
			validateTimeDeposit(
				{
					name: "TD",
					principalCentavos: 0,
					interestRateBps: 600,
					maturityDate: "2027-04-24",
					interestPostingInterval: "monthly",
				},
				today,
			),
		).toMatchObject({ field: "principal" });

		expect(
			validateTimeDeposit(
				{
					name: "TD",
					principalCentavos: 100,
					interestRateBps: 600,
					maturityDate: "2020-01-01",
					interestPostingInterval: "monthly",
				},
				today,
			),
		).toMatchObject({ field: "maturityDate" });
	});
});
