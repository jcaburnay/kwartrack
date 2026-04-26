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
	it("rejects when shares don't sum to total", () => {
		const bad = {
			...base,
			participants: [
				{ personId: "user-self", shareCentavos: 100000, shareInputValue: null },
				{ personId: "p-2", shareCentavos: 100000, shareInputValue: null },
			],
		};
		expect(validateSplit(bad)).toEqual({
			ok: false,
			field: "participants",
			message: "Shares must sum to the total",
		});
	});
});
