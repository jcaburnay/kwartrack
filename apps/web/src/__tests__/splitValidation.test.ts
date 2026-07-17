import { describe, expect, it } from "vitest";
import { type SplitInput, validateSplit } from "../utils/splitValidation";

const base: SplitInput = {
	description: "Mama Lou's",
	totalCentavos: 480000,
	date: "2026-04-26",
	paidFromAccountId: "acct-1",
	tagId: "tag-1",
	method: "equal",
	participants: [
		{ personId: "user-self", shareCentavos: 120000, shareInputValue: null },
		{ personId: "p-2", shareCentavos: 120000, shareInputValue: null },
		{ personId: "p-3", shareCentavos: 120000, shareInputValue: null },
		{ personId: "p-4", shareCentavos: 120000, shareInputValue: null },
	],
};

describe("validateSplit", () => {
	it("passes with the base case", () => {
		expect(validateSplit(base)).toEqual({ ok: true });
	});
	it("rejects empty description", () => {
		expect(validateSplit({ ...base, description: " " })).toEqual({
			ok: false,
			field: "description",
			message: "Description is required",
		});
	});
	it("rejects total ≤ 0", () => {
		expect(validateSplit({ ...base, totalCentavos: 0 })).toEqual({
			ok: false,
			field: "totalCentavos",
			message: "Total must be greater than 0",
		});
	});
	it("rejects missing tag", () => {
		expect(validateSplit({ ...base, tagId: null })).toEqual({
			ok: false,
			field: "tagId",
			message: "Tag is required",
		});
	});
	it("rejects missing paidFromAccountId", () => {
		expect(validateSplit({ ...base, paidFromAccountId: null })).toEqual({
			ok: false,
			field: "paidFromAccountId",
			message: "Paid-from account is required",
		});
	});
	it("rejects empty participants", () => {
		expect(validateSplit({ ...base, participants: [] })).toEqual({
			ok: false,
			field: "participants",
			message: "Add at least one participant",
		});
	});
	it("rejects a participant with a 0 share", () => {
		// Exact-with-0, percent-rounds-to-0, shares-floors-to-0, and the
		// all-zero fallback (computeShareCentavos === null) all surface here.
		const bad: SplitInput = {
			...base,
			participants: [
				{ personId: "p-2", shareCentavos: 240000, shareInputValue: null },
				{ personId: "p-3", shareCentavos: 240000, shareInputValue: null },
				{ personId: "p-4", shareCentavos: 0, shareInputValue: 0 },
			],
		};
		expect(validateSplit(bad)).toEqual({
			ok: false,
			field: "participants",
			message:
				"Each participant must owe more than 0 — remove anyone with a 0 share or adjust the split",
		});
	});
	it("rejects when shares exceed the total", () => {
		// Sum 140000 > total 100000 — invalid. (Sum < total is valid; the
		// remainder is the user-the-payer's implicit share.)
		const bad: SplitInput = {
			...base,
			totalCentavos: 100000,
			participants: [
				{ personId: "p-2", shareCentavos: 70000, shareInputValue: null },
				{ personId: "p-3", shareCentavos: 70000, shareInputValue: null },
			],
		};
		expect(validateSplit(bad)).toEqual({
			ok: false,
			field: "participants",
			message: "Shares exceed the total",
		});
	});
});
