import { describe, expect, it } from "vitest";
import { DEFAULT_TAGS, getVisibleTags, type TagConfigRow } from "../utils/tagConfig";

describe("DEFAULT_TAGS", () => {
	it("has 17 expense tags", () => {
		expect(DEFAULT_TAGS.expense).toHaveLength(17);
	});

	it("has 5 income tags", () => {
		expect(DEFAULT_TAGS.income).toHaveLength(5);
	});

	it("has 0 transfer tags", () => {
		expect(DEFAULT_TAGS.transfer).toHaveLength(0);
	});
});

describe("getVisibleTags", () => {
	it("returns all default expense tags when no configs exist", () => {
		const result = getVisibleTags("expense", []);
		expect(result).toEqual(DEFAULT_TAGS.expense);
	});

	it("hides a default tag when config has isHidden: true", () => {
		const configs: TagConfigRow[] = [
			{ transactionType: "expense", tag: "foods", isCustom: false, isHidden: true },
		];
		const result = getVisibleTags("expense", configs);
		expect(result).not.toContain("foods");
		expect(result).toContain("grocery");
	});

	it("adds custom tags to the list", () => {
		const configs: TagConfigRow[] = [
			{ transactionType: "expense", tag: "my-custom-tag", isCustom: true, isHidden: false },
		];
		const result = getVisibleTags("expense", configs);
		expect(result).toContain("my-custom-tag");
		expect(result).toContain("foods");
	});

	it("does not add hidden custom tags", () => {
		const configs: TagConfigRow[] = [
			{ transactionType: "expense", tag: "hidden-tag", isCustom: true, isHidden: true },
		];
		const result = getVisibleTags("expense", configs);
		expect(result).not.toContain("hidden-tag");
	});

	it("deduplicates custom tags that collide with defaults", () => {
		const configs: TagConfigRow[] = [
			{ transactionType: "expense", tag: "foods", isCustom: true, isHidden: false },
		];
		const result = getVisibleTags("expense", configs);
		expect(result.filter((tag) => tag === "foods")).toHaveLength(1);
	});

	it("only includes configs matching the requested type", () => {
		const configs: TagConfigRow[] = [
			{ transactionType: "income", tag: "side-hustle", isCustom: true, isHidden: false },
		];
		const result = getVisibleTags("expense", configs);
		expect(result).not.toContain("side-hustle");
	});

	it("returns custom transfer tags when added", () => {
		const configs: TagConfigRow[] = [
			{ transactionType: "transfer", tag: "savings", isCustom: true, isHidden: false },
		];
		const result = getVisibleTags("transfer", configs);
		expect(result).toEqual(["savings"]);
	});

	it("returns empty array for transfer with no configs", () => {
		const result = getVisibleTags("transfer", []);
		expect(result).toEqual([]);
	});
});
