import { describe, expect, it } from "vitest";
import { type DebtInput, validateDebt } from "../utils/debtValidation";

const base: DebtInput = {
	personId: "p-1",
	direction: "loaned",
	amountCentavos: 50000,
	date: "2026-04-26",
	description: "lunch IOU",
	paidAccountId: null,
	tagId: null,
};

describe("validateDebt", () => {
	it("passes with the base case (data-only debt)", () => {
		expect(validateDebt(base)).toEqual({ ok: true });
	});
	it("rejects missing person", () => {
		expect(validateDebt({ ...base, personId: null })).toEqual({
			ok: false,
			field: "personId",
			message: "Counter-party is required",
		});
	});
	it("rejects amount ≤ 0", () => {
		expect(validateDebt({ ...base, amountCentavos: 0 })).toEqual({
			ok: false,
			field: "amountCentavos",
			message: "Amount must be greater than 0",
		});
	});
	it("requires tag when paidAccountId is set", () => {
		const withAccount = { ...base, paidAccountId: "a-1", tagId: null };
		expect(validateDebt(withAccount)).toEqual({
			ok: false,
			field: "tagId",
			message: "Tag is required when an account is selected",
		});
	});
	it("accepts paid-from with a tag", () => {
		expect(validateDebt({ ...base, paidAccountId: "a-1", tagId: "t-1" })).toEqual({ ok: true });
	});
});
